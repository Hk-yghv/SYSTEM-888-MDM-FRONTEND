import express from 'express';
import axios from 'axios';
import PhoneProductCatalog from '../models/PhoneProductCatalog.js';
import ControlSystem from '../models/ControlSystem.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { getWriteModel, queryAllDBs } from '../config/multiDB.js';

const router = express.Router();
const VALUATION_PATH = '/phone-valuation';
const SETTINGS_PATH = '/settings/products';
const KHMER24_CATEGORY_URL = 'https://www.khmer24.com/km/c-mobile-phones-tablets';

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
        return { error: 'A catalog can contain up to 200 products and 100 defects.' };
    }

    const ids = new Set();
    const products = [];
    for (const item of body.products) {
        const id = String(item?.id || '').trim();
        const model = String(item?.model || '').trim();
        const variant = String(item?.variant || '').trim();
        const capacityGb = Number(item?.capacityGb);
        const valuationPrice = Number(item?.valuationPrice);
        if (!id || ids.has(id) || !model || model.length > 100 || variant.length > 40) {
            return { error: 'Each product needs a unique ID, model, and valid variant.' };
        }
        if (!Number.isInteger(capacityGb) || capacityGb < 1 || capacityGb > 100000) {
            return { error: `Product ${model} needs a valid capacity in GB.` };
        }
        if (!Number.isFinite(valuationPrice) || valuationPrice < 0 || valuationPrice > 10000000) {
            return { error: `Product ${model} needs a valid base price.` };
        }
        ids.add(id);
        products.push({
            id,
            model,
            variant,
            capacityGb,
            valuationPrice,
            khmer24MarketPrice: Number.isFinite(Number(item.khmer24MarketPrice)) ? Number(item.khmer24MarketPrice) : null,
            khmer24Listings: Array.isArray(item.khmer24Listings) ? item.khmer24Listings.slice(0, 10) : [],
            khmer24SyncedAt: item.khmer24SyncedAt || null
        });
    }

    const defectIds = new Set();
    const defects = [];
    for (const item of body.defects) {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        const minDeduction = Number(item?.minDeduction ?? item?.deduction ?? 0);
        const maxDeduction = Number(item?.maxDeduction ?? item?.deduction ?? minDeduction);
        if (!id || defectIds.has(id) || !name || name.length > 100) {
            return { error: 'Each defect needs a unique ID and a name.' };
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

    return { products, defects };
};

const readCatalog = async (brand) => {
    const normalizeLegacyDefects = (catalog) => ({
        ...catalog,
        defects: (catalog.defects || []).map((defect) => ({
            ...defect,
            minDeduction: Number(defect.minDeduction ?? defect.deduction ?? 0),
            maxDeduction: Number(defect.maxDeduction ?? defect.deduction ?? defect.minDeduction ?? 0)
        }))
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

const decodeHtml = (text) => text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));

const stripHtml = (html) => decodeHtml(
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim();

const normalizeComparable = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const parseKhmer24Listings = (html, product) => {
    const modelTokens = String(product.model || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    const requiredTokens = modelTokens.filter((token) => !['gb', 'g'].includes(token));
    const capacityPattern = new RegExp(`\\b${product.capacityGb}\\s*(?:gb|g)\\b`, 'i');
    const listings = [];
    const anchorPattern = /<a\b[^>]*href=["']([^"']*adid-\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorPattern.exec(html)) !== null) {
        const title = stripHtml(match[2]);
        const normalizedTitle = normalizeComparable(title);
        if (!title || !requiredTokens.every((token) => normalizedTitle.includes(normalizeComparable(token)))) continue;
        if (product.capacityGb && !capacityPattern.test(title)) continue;
        if (product.variant && !normalizedTitle.includes(normalizeComparable(product.variant))) continue;

        const withoutDiscountLabels = title.replace(/\$\s*[\d,]+(?:\.\d+)?\s*off/gi, '');
        const priceMatches = [...withoutDiscountLabels.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)];
        if (!priceMatches.length) continue;
        const price = Number(priceMatches[0][1].replace(/,/g, ''));
        if (!Number.isFinite(price) || price <= 0) continue;

        const path = match[1].startsWith('http') ? match[1] : `https://www.khmer24.com${match[1]}`;
        listings.push({ title, price, url: path });
        if (listings.length >= 50) break;
    }

    const unique = [...new Map(listings.map((listing) => [listing.url, listing])).values()];
    const prices = unique.map((listing) => listing.price).sort((a, b) => a - b);
    if (prices.length === 0) return { marketPrice: null, listings: [] };
    const middle = Math.floor(prices.length / 2);
    const marketPrice = prices.length % 2
        ? prices[middle]
        : Math.round(((prices[middle - 1] + prices[middle]) / 2) * 100) / 100;

    return { marketPrice, listings: unique.slice(0, 10) };
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

router.post('/sync-market-price/:productId', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasPermission(identity, SETTINGS_PATH, 'edit')) {
            return res.status(403).json({ error: 'Product settings edit permission required.' });
        }

        const brand = resolveCatalogBrand(req, identity);
        if (brand === null) return res.status(403).json({ error: 'You cannot sync another brand product catalog.' });
        const catalog = await readCatalog(brand);
        const product = catalog.products.find((item) => item.id === req.params.productId);
        if (!product) return res.status(404).json({ error: 'Phone product not found.' });

        const keyword = `${product.model} ${product.variant} ${product.capacityGb}GB`;
        const response = await axios.get(KHMER24_CATEGORY_URL, {
            params: { keyword },
            timeout: 12000,
            headers: { 'User-Agent': 'SYSTEM-MDM price lookup/1.0' },
            maxContentLength: 5 * 1024 * 1024
        });
        const result = parseKhmer24Listings(response.data, product);
        if (!result.marketPrice) {
            return res.status(404).json({ error: `No Khmer24 listings matched ${keyword}.` });
        }

        const updatedProducts = catalog.products.map((item) => item.id === product.id
            ? {
                ...item,
                khmer24MarketPrice: result.marketPrice,
                khmer24Listings: result.listings,
                khmer24SyncedAt: new Date().toISOString()
            }
            : item);
        const saved = await saveCatalog(brand, { products: updatedProducts, defects: catalog.defects || [] }, identity.username);
        return res.json({
            data: saved,
            marketPrice: result.marketPrice,
            fortyPercentPrice: Math.round(result.marketPrice * 0.4 * 100) / 100,
            listingCount: result.listings.length
        });
    } catch (error) {
        console.error('[PhoneProducts] Khmer24 sync failed:', error.message);
        return res.status(502).json({ error: 'Unable to fetch matching prices from Khmer24. Please try again later.' });
    }
});

export default router;
