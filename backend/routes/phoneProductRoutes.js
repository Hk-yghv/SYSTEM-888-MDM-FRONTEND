import express from 'express';
import PhoneProductCatalog from '../models/PhoneProductCatalog.js';
import ControlSystem from '../models/ControlSystem.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { getWriteModel, queryAllDBs } from '../config/multiDB.js';

const router = express.Router();
const VALUATION_PATH = '/phone-valuation';
const SETTINGS_PATH = '/settings/products';

if (!Array.isArray(MEM_DB.phoneProductCatalogs)) MEM_DB.phoneProductCatalogs = [];

const isMasterAdmin = (user) => (
    user.username === '@hakyonghouv' ||
    user.username === 'hakyonghouv' ||
    user.isImmutable ||
    user.role === 'Administrator' ||
    user.role === 'Admin'
);

const getRequestIdentity = async (req) => {
    const username = req.user?.username;
    if (!username) return null;

    const users = isMongoConnected
        ? await queryAllDBs(User, (Model) => Model.find({ username }).limit(1))
        : MEM_DB.users.filter((user) => user.username === username);
    const user = users[0];
    if (!user) return null;

    const permissions = user.permissions instanceof Map
        ? Object.fromEntries(user.permissions)
        : user.permissions || {};

    return {
        username: user.username,
        brand: String(user.brand || '').trim(),
        role: user.role || '',
        isImmutable: Boolean(user.isImmutable),
        permissions
    };
};

const hasPermission = (identity, pagePath, action) => (
    isMasterAdmin(identity) || identity.permissions?.[pagePath]?.[action] === true
);

const resolveCatalogBrand = (req, identity) => {
    const requestedBrand = String(req.query.brand ?? req.body?.brand ?? '').trim();
    if (isMasterAdmin(identity)) return requestedBrand;
    return identity.brand;
};

const getAvailableModels = async (brand) => {
    let config;
    if (isMongoConnected) {
        const configs = await queryAllDBs(ControlSystem, (Model) => Model.find({
            key: 'droplists',
            $or: [{ brand }, { brand: '' }, { brand: { $exists: false } }, { brand: null }]
        }));
        const brandConfig = configs.find((item) => item.brand === brand)?.value;
        const globalConfig = configs.find((item) => !item.brand)?.value;
        const brandModels = brandConfig?.find((item) => item.category === 'Device Models')?.items;
        config = Array.isArray(brandModels) && brandModels.length > 0 ? brandConfig : globalConfig;
    }
    if (!config) {
        const brandConfig = MEM_DB.controlSystems?.find((item) => item.brand === brand);
        config = brandConfig?.droplists || MEM_DB.controlSystem?.droplists;
    }

    const models = config?.find((item) => item.category === 'Device Models')?.items;
    return Array.isArray(models)
        ? [...new Set(models.map((model) => String(model || '').trim()).filter(Boolean))]
        : [];
};

const getAvailableVariants = async (brand) => {
    let variants;
    if (isMongoConnected) {
        const configs = await queryAllDBs(ControlSystem, (Model) => Model.find({
            key: 'product_variants',
            $or: [{ brand }, { brand: '' }, { brand: { $exists: false } }, { brand: null }]
        }));
        const brandConfig = configs.find((item) => item.brand === brand)?.value;
        const globalConfig = configs.find((item) => !item.brand)?.value;
        variants = Array.isArray(brandConfig) && brandConfig.length > 0 ? brandConfig : globalConfig;
    }
    if (!variants) {
        const brandConfig = MEM_DB.controlSystems?.find((item) => item.brand === brand);
        variants = brandConfig?.product_variants || MEM_DB.controlSystem?.product_variants;
    }
    return Array.isArray(variants) ? variants : [];
};

const normalizeCatalog = (body) => {
    if (!Array.isArray(body.products) || !Array.isArray(body.defects)) {
        return { error: 'Products and defects must be arrays.' };
    }
    if (body.products.length > 200 || body.defects.length > 100) {
        return { error: 'A catalog can contain up to 200 products and 100 defects.' };
    }

    const normalizeDefects = (items, productModel) => {
        if (!Array.isArray(items) || items.length > 100) {
            return { error: `Product ${productModel} can contain up to 100 defects.` };
        }
        const defectIds = new Set();
        const defects = [];
        for (const item of items) {
            const id = String(item?.id || '').trim();
            const name = String(item?.name || '').trim();
            if (!id || defectIds.has(id) || !name || name.length > 100) {
                return { error: `Each defect for ${productModel} needs a unique ID and a name.` };
            }
            const rawStatuses = Array.isArray(item.statuses)
                ? item.statuses
                : [{
                    id: `${id}-default`,
                    name: 'Default',
                    enabled: true,
                    minDeduction: item.minDeduction ?? item.deduction ?? 0,
                    maxDeduction: item.maxDeduction ?? item.deduction ?? item.minDeduction ?? 0
                }];
            if (rawStatuses.length > 50) return { error: `Defect ${name} can have up to 50 statuses.` };
            const statusIds = new Set();
            const statuses = [];
            for (const rawStatus of rawStatuses) {
                const statusId = String(rawStatus?.id || '').trim();
                const statusName = String(rawStatus?.name || '').trim();
                const minDeduction = Number(rawStatus?.minDeduction ?? 0);
                const maxDeduction = Number(rawStatus?.maxDeduction ?? minDeduction);
                if (!statusId || statusIds.has(statusId) || !statusName || statusName.length > 60) {
                    return { error: `Each status for ${name} needs a unique ID and a name.` };
                }
                if (
                    !Number.isFinite(minDeduction) ||
                    !Number.isFinite(maxDeduction) ||
                    minDeduction < 0 ||
                    maxDeduction < minDeduction ||
                    maxDeduction > 10000000
                ) {
                    return { error: `Status ${statusName} for ${name} needs a valid deduction range.` };
                }
                statusIds.add(statusId);
                statuses.push({
                    id: statusId,
                    name: statusName,
                    enabled: rawStatus.enabled !== false,
                    minDeduction,
                    maxDeduction
                });
            }
            defectIds.add(id);
            defects.push({ id, name, statuses });
        }
        return { defects };
    };

    const legacyDefects = normalizeDefects(body.defects, 'catalog');
    if (legacyDefects.error) return legacyDefects;
    const ids = new Set();
    const products = [];
    for (const item of body.products) {
        const id = String(item?.id || '').trim();
        const model = String(item?.model || '').trim();
        const variant = String(item?.variant || '').trim();
        const capacityGb = Number(item?.capacityGb);
        const valuationPrice = Number(item?.valuationPrice);
        const rawMarketPrice = item?.marketPrice !== undefined ? item.marketPrice : item?.khmer24MarketPrice;
        const marketPrice = rawMarketPrice == null || rawMarketPrice === '' ? null : Number(rawMarketPrice);
        if (!id || ids.has(id) || !model || model.length > 100 || variant.length > 40) {
            return { error: 'Each product needs a unique ID, model, and valid variant.' };
        }
        if (!Number.isInteger(capacityGb) || capacityGb < 1 || capacityGb > 100000) {
            return { error: `Product ${model} needs a valid capacity in GB.` };
        }
        if (!Number.isFinite(valuationPrice) || valuationPrice < 0 || valuationPrice > 10000000) {
            return { error: `Product ${model} needs a valid base price.` };
        }
        if (marketPrice !== null && (!Number.isFinite(marketPrice) || marketPrice < 0 || marketPrice > 10000000)) {
            return { error: `Product ${model} needs a valid market price.` };
        }
        ids.add(id);
        products.push({
            id,
            model,
            variant,
            capacityGb,
            valuationPrice,
            marketPrice,
            enabled: item.enabled !== false
        });
    }

    return { products, defects: legacyDefects.defects };
};

const readCatalog = async (brand) => {
    const normalizeLegacyDefects = (catalog) => {
        const storedDefects = Array.isArray(catalog.defects) ? catalog.defects : [];
        const sourceDefects = storedDefects.length > 0
            ? storedDefects
            : (catalog.products || []).flatMap((product) => Array.isArray(product.defects) ? product.defects : []);
        const defectsByName = new Map();
        sourceDefects.forEach((defect) => {
            const name = String(defect.name || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            const statuses = Array.isArray(defect.statuses)
                ? defect.statuses.map((status) => ({
                    id: String(status.id || `status-${key}`),
                    name: String(status.name || '').trim(),
                    enabled: status.enabled !== false,
                    minDeduction: Number(status.minDeduction ?? 0),
                    maxDeduction: Number(status.maxDeduction ?? status.minDeduction ?? 0)
                })).filter((status) => status.name)
                : [{
                    id: `legacy-${key.replace(/[^a-z0-9]+/g, '-')}`,
                    name: 'Default',
                    enabled: true,
                    minDeduction: Number(defect.minDeduction ?? defect.deduction ?? 0),
                    maxDeduction: Number(defect.maxDeduction ?? defect.deduction ?? defect.minDeduction ?? 0)
                }];
            const existing = defectsByName.get(key);
            if (existing) {
                const statusesByName = new Map(existing.statuses.map((status) => [status.name.toLowerCase(), status]));
                statuses.forEach((status) => {
                    const statusKey = status.name.toLowerCase();
                    const matchingStatus = statusesByName.get(statusKey);
                    if (matchingStatus) {
                        matchingStatus.minDeduction = Math.min(matchingStatus.minDeduction, status.minDeduction);
                        matchingStatus.maxDeduction = Math.max(matchingStatus.maxDeduction, status.maxDeduction);
                        matchingStatus.enabled = matchingStatus.enabled || status.enabled;
                    } else {
                        existing.statuses.push(status);
                        statusesByName.set(statusKey, status);
                    }
                });
            } else {
                defectsByName.set(key, {
                    id: String(defect.id || `legacy-${key.replace(/[^a-z0-9]+/g, '-')}`),
                    name,
                    statuses
                });
            }
        });

        return {
            ...catalog,
            products: (catalog.products || []).map((product) => {
                const normalizedProduct = { ...product };
                delete normalizedProduct.defects;
                return normalizedProduct;
            }),
            defects: [...defectsByName.values()]
        };
    };
    if (isMongoConnected) {
        const catalogs = await queryAllDBs(PhoneProductCatalog, (Model) => Model.find({ brand }).limit(1).lean());
        if (catalogs[0]) return normalizeLegacyDefects(catalogs[0]);
    }
    return normalizeLegacyDefects(MEM_DB.phoneProductCatalogs.find((catalog) => catalog.brand === brand) || {
        brand,
        products: [],
        defects: []
    });
};

const saveCatalog = async (brand, data, username) => {
    if (isMongoConnected) {
        const CatalogWrite = getWriteModel(PhoneProductCatalog) || PhoneProductCatalog;
        const saved = await CatalogWrite.findOneAndUpdate(
            { brand },
            { $set: { ...data, brand, updatedBy: username } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        return saved.toObject();
    }

    let catalog = MEM_DB.phoneProductCatalogs.find((item) => item.brand === brand);
    if (!catalog) {
        catalog = { brand, products: [], defects: [] };
        MEM_DB.phoneProductCatalogs.push(catalog);
    }
    Object.assign(catalog, data, { updatedBy: username, updatedAt: new Date() });
    return catalog;
};

router.get('/', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        const canReadCatalog = hasPermission(identity, SETTINGS_PATH, 'read');
        const canReadValuation = hasPermission(identity, VALUATION_PATH, 'read');
        if (!canReadCatalog && !canReadValuation) {
            return res.status(403).json({ error: 'Phone product read permission required.' });
        }

        const brand = resolveCatalogBrand(req, identity);
        if (brand === null) return res.status(403).json({ error: 'You cannot access another brand product catalog.' });
        const [data, models, variants] = await Promise.all([
            readCatalog(brand),
            getAvailableModels(brand),
            getAvailableVariants(brand)
        ]);
        return res.json({ data, brand, models, variants });
    } catch (error) {
        console.error('[PhoneProducts] Catalog read failed:', error);
        return res.status(500).json({ error: 'Unable to load phone product catalog.' });
    }
});

router.put('/', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasPermission(identity, SETTINGS_PATH, 'edit')) {
            return res.status(403).json({ error: 'Product settings edit permission required.' });
        }

        const normalized = normalizeCatalog(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });
        const brand = resolveCatalogBrand(req, identity);
        if (brand === null) return res.status(403).json({ error: 'You cannot edit another brand product catalog.' });
        const availableModels = await getAvailableModels(brand);
        const unavailableModel = normalized.products.find((item) => !availableModels.includes(item.model));
        if (unavailableModel) {
            return res.status(400).json({ error: `Model "${unavailableModel.model}" is not configured for ${brand || 'Global'}.` });
        }
        const data = await saveCatalog(brand, normalized, identity.username);
        return res.json({ data, brand });
    } catch (error) {
        console.error('[PhoneProducts] Catalog save failed:', error);
        return res.status(500).json({ error: 'Unable to save phone product catalog.' });
    }
});

export default router;
