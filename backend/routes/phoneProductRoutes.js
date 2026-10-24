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

const normalizeCatalog = (body) => {
    if (!Array.isArray(body.products) || !Array.isArray(body.defects)) {
        return { error: 'Products and defects must be arrays.' };
    }
    if (body.products.length > 200 || body.defects.length > 100) {
        return { error: 'A catalog can contain up to 200 products and 100 legacy defects.' };
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
            const minDeduction = Number(item?.minDeduction ?? item?.deduction ?? 0);
            const maxDeduction = Number(item?.maxDeduction ?? item?.deduction ?? minDeduction);
            if (!id || defectIds.has(id) || !name || name.length > 100) {
                return { error: `Each defect for ${productModel} needs a unique ID and a name.` };
            }
            if (
                !Number.isFinite(minDeduction) ||
                !Number.isFinite(maxDeduction) ||
                minDeduction < 0 ||
                maxDeduction < minDeduction ||
                maxDeduction > 10000000
            ) {
                return { error: `Defect ${name} needs a valid deduction range.` };
            }
            defectIds.add(id);
            defects.push({ id, name, minDeduction, maxDeduction });
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
        const productDefects = normalizeDefects(
            Array.isArray(item?.defects) ? item.defects : legacyDefects.defects,
            model
        );
        if (productDefects.error) return productDefects;
        ids.add(id);
        products.push({
            id,
            model,
            variant,
            capacityGb,
            valuationPrice,
            marketPrice,
            defects: productDefects.defects
        });
    }

    return { products, defects: [] };
};

const readCatalog = async (brand) => {
    const normalizeLegacyDefects = (catalog) => ({
        ...catalog,
        products: (catalog.products || []).map((product) => ({
            ...product,
            defects: (Array.isArray(product.defects) ? product.defects : catalog.defects || []).map((defect) => ({
                ...defect,
                minDeduction: Number(defect.minDeduction ?? defect.deduction ?? 0),
                maxDeduction: Number(defect.maxDeduction ?? defect.deduction ?? defect.minDeduction ?? 0)
            }))
        })),
        defects: catalog.defects || []
    });
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
        const [data, models] = await Promise.all([
            readCatalog(brand),
            getAvailableModels(brand)
        ]);
        return res.json({ data, brand, models });
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
