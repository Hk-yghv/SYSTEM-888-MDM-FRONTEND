import express from 'express';
import ControlSystem from '../models/ControlSystem.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import SavedUrl from '../models/SavedUrl.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();

// GET all active system brands for Phone App and Control System directly from database
router.get('/all-brands', async (req, res) => {
    try {
        const foundBrands = new Set();

        if (isMongoConnected) {
            // 1. All ControlSystem documents
            const controlConfigs = await queryAllDBs(ControlSystem, (M) => M.find({}));
            controlConfigs.forEach(c => {
                if (c.brand && typeof c.brand === 'string') {
                    const trimmed = c.brand.trim();
                    if (trimmed) foundBrands.add(trimmed);
                }
                if (c.key === 'droplists' && Array.isArray(c.value)) {
                    const bCat = c.value.find(d => d.category === 'Brands');
                    if (bCat && Array.isArray(bCat.items)) {
                        bCat.items.forEach(b => b && typeof b === 'string' && foundBrands.add(b.trim()));
                    }
                }
            });

            // 2. All Users
            const users = await queryAllDBs(User, (M) => M.find({}));
            users.forEach(u => {
                if (u.brand && typeof u.brand === 'string') {
                    const trimmed = u.brand.trim();
                    if (trimmed) foundBrands.add(trimmed);
                }
            });

            // 3. All Contracts
            const contracts = await queryAllDBs(Contract, (M) => M.find({}));
            contracts.forEach(c => {
                if (c.brand && typeof c.brand === 'string') {
                    const trimmed = c.brand.trim();
                    if (trimmed) foundBrands.add(trimmed);
                }
            });
        }

        // 4. MEM_DB Fallback
        if (MEM_DB.controlSystem?.droplists) {
            const bCat = MEM_DB.controlSystem.droplists.find(d => d.category === 'Brands');
            if (bCat && Array.isArray(bCat.items)) {
                bCat.items.forEach(b => b && typeof b === 'string' && foundBrands.add(b.trim()));
            }
        }
        if (MEM_DB.controlSystems && Array.isArray(MEM_DB.controlSystems)) {
            MEM_DB.controlSystems.forEach(cs => cs.brand && foundBrands.add(cs.brand.trim()));
        }
        if (MEM_DB.users) MEM_DB.users.forEach(u => u.brand && foundBrands.add(u.brand.trim()));
        if (MEM_DB.contracts) MEM_DB.contracts.forEach(c => c.brand && foundBrands.add(c.brand.trim()));

        const brandsList = Array.from(foundBrands).filter(Boolean);
        if (brandsList.length === 0) {
            brandsList.push('888MDM');
        }

        res.json({ success: true, brands: brandsList });
    } catch (err) {
        console.error('Error fetching all brands from database:', err);
        res.json({ success: true, brands: ['888MDM'] });
    }
});

// Helper to sanitize and normalize brand_subbrands map so values are ALWAYS Arrays of strings
function normalizeBrandSubbrands(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const normalized = {};
    for (const [bKey, val] of Object.entries(input)) {
        if (!bKey) continue;
        if (Array.isArray(val)) {
            normalized[bKey] = val.filter(item => item && typeof item === 'string').map(item => item.trim());
        } else if (typeof val === 'string' && val.trim()) {
            normalized[bKey] = [val.trim()];
        } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter(item => item && typeof item === 'string').map(item => item.trim());
            normalized[bKey] = arr;
        } else {
            normalized[bKey] = [];
        }
    }
    return normalized;
}

// Helper to retrieve Global configurations across DBs
async function getGlobalConfigs() {
    if (!isMongoConnected) return MEM_DB.controlSystem || {};
    const globalDocs = await queryAllDBs(ControlSystem, (M) => M.find({ $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }] }));
    const mapped = {};
    if (Array.isArray(globalDocs)) {
        globalDocs.forEach(c => {
            if (c.key && mapped[c.key] === undefined) {
                mapped[c.key] = c.value;
            }
        });
    }
    return mapped;
}

// GET control system config (Auto-inherits Global settings if brand has no custom config)
router.get('/', async (req, res) => {
    try {
        const brand = (req.query.brand || '').trim();
        const globalConfigs = await getGlobalConfigs();
        const brandSubbrandsMap = normalizeBrandSubbrands(globalConfigs.brand_subbrands || MEM_DB.controlSystem?.brand_subbrands);
        globalConfigs.brand_subbrands = brandSubbrandsMap;
        globalConfigs.subbrands = (brand && Array.isArray(brandSubbrandsMap[brand])) ? brandSubbrandsMap[brand] : [];

        if (isMongoConnected) {
            if (!brand || brand === 'Global') {
                return res.json(globalConfigs);
            }

            // Fetch brand specific configs
            const brandDocs = await queryAllDBs(ControlSystem, (M) => M.find({ brand }));
            const brandMapped = {};
            if (Array.isArray(brandDocs)) {
                brandDocs.forEach(c => {
                    if (c.key && brandMapped[c.key] === undefined) {
                        brandMapped[c.key] = c.value;
                    }
                });
            }

            // Deep merge with Global configurations so any missing key or empty droplist category inherits from Global
            const merged = { ...globalConfigs, ...brandMapped };
            merged.brand_subbrands = brandSubbrandsMap;
            merged.subbrands = (brand && Array.isArray(brandSubbrandsMap[brand])) ? brandSubbrandsMap[brand] : [];

            if (globalConfigs.droplists && Array.isArray(globalConfigs.droplists)) {
                let brandDroplists = Array.isArray(brandMapped.droplists) ? brandMapped.droplists : [];
                const mergedDroplists = globalConfigs.droplists.map(gCat => {
                    const bCat = brandDroplists.find(d => d.category === gCat.category);
                    if (bCat && Array.isArray(bCat.items) && bCat.items.length > 0) {
                        return bCat;
                    }
                    // Inherit items from Global if brand has none for this category
                    return gCat;
                });
                brandDroplists.forEach(bCat => {
                    if (!mergedDroplists.some(d => d.category === bCat.category)) {
                        mergedDroplists.push(bCat);
                    }
                });
                merged.droplists = mergedDroplists;
            }

            return res.json(merged);
        }

        if (!MEM_DB.controlSystems) {
            MEM_DB.controlSystems = [{ brand: '', ...MEM_DB.controlSystem }];
        }
        let memConfig = MEM_DB.controlSystems.find(c => c.brand === brand);
        if (!memConfig) {
            memConfig = { brand, ...(MEM_DB.controlSystems.find(c => c.brand === '') || MEM_DB.controlSystem) };
            MEM_DB.controlSystems.push(memConfig);
        }
        memConfig.brand_subbrands = brandSubbrandsMap;
        memConfig.subbrands = brandSubbrandsMap[brand] || [];
        res.json(memConfig);
    } catch (err) {
        console.error('Error fetching control system config:', err);
        res.json(MEM_DB.controlSystem);
    }
});

// GET /field-origins: Returns per-field origin { fieldName: 'global' | 'private' } for a brand
// This allows the frontend to display 🌐 Inherited or 🏷️ Private Override badges per field
router.get('/field-origins', async (req, res) => {
    try {
        const brand = (req.query.brand || '').trim();
        if (!brand || brand === 'Global') {
            // Everything is "global" when viewing Global config
            return res.json({ origins: {}, brand: '' });
        }

        const TRACKED_KEYS = ['call_phone_display', 'lockphone_display_text', 'lockphone_phone_number', 'lockphone_telegram_chat_ids', 'roles', 'droplists', 'late_penalty_per_day'];
        const origins = {};

        if (isMongoConnected) {
            const brandDocs = await queryAllDBs(ControlSystem, (M) => M.find({ brand, key: { $in: TRACKED_KEYS } }));
            const privateKeys = new Set(brandDocs.map(d => d.key));
            TRACKED_KEYS.forEach(key => {
                origins[key] = privateKeys.has(key) ? 'private' : 'global';
            });
        } else {
            // MEM_DB fallback
            const memConfig = MEM_DB.controlSystems?.find(c => c.brand === brand);
            TRACKED_KEYS.forEach(key => {
                origins[key] = (memConfig && memConfig[key] !== undefined) ? 'private' : 'global';
            });
        }

        res.json({ origins, brand });
    } catch (err) {
        console.error('Error fetching field origins:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /clone-global: Clones Global configurations into a target brand
router.post('/clone-global', async (req, res) => {
    try {
        const { brand } = req.body;
        if (!brand) return res.status(400).json({ error: 'Target brand is required' });

        const globalConfigs = await getGlobalConfigs();
        if (isMongoConnected) {
            const ControlSystemWrite = getWriteModel(ControlSystem) || ControlSystem;
            for (const [key, value] of Object.entries(globalConfigs)) {
                await ControlSystemWrite.findOneAndUpdate(
                    { key, brand },
                    { key, brand, value },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                ).catch(() => {});
            }
        }
        res.json({ success: true, message: `Global settings cloned to brand '${brand}' successfully!` });
    } catch (err) {
        console.error('Error cloning global settings to brand:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST control system config (supports single key or bulk configs)
router.post('/', async (req, res) => {
    try {
        const { key, value, brand, configs } = req.body;
        const targetBrand = brand === 'Global' ? '' : (brand || '');


        const updates = Array.isArray(configs)
            ? configs
            : (key ? [{ key, value }] : []);

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No configuration data provided' });
        }

        if (isMongoConnected) {
            const ControlSystemWrite = getWriteModel(ControlSystem) || ControlSystem;
            const saveItems = async () => {
                for (const item of updates) {
                    if (!item.key) continue;
                    let doc = await ControlSystemWrite.findOne({ key: item.key, brand: targetBrand });
                    if (!doc && targetBrand === '') {
                        doc = await ControlSystemWrite.findOne({
                            key: item.key,
                            $or: [{ brand: { $exists: false } }, { brand: null }]
                        });
                    }
                    if (doc) {
                        doc.value = item.value;
                        doc.brand = targetBrand;
                        doc.markModified('value');
                        await doc.save();
                    } else {
                        await ControlSystemWrite.findOneAndUpdate(
                            { key: item.key, brand: targetBrand },
                            { key: item.key, brand: targetBrand, value: item.value },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    }
                }
            };

            try {
                await saveItems();
            } catch (saveErr) {
                if (saveErr.code === 11000 || (saveErr.message && saveErr.message.includes('E11000'))) {
                    console.warn('Detected E11000 duplicate key index issue on ControlSystem. Repairing indexes...');
                    try {
                        await ControlSystem.collection.dropIndex('key_1');
                    } catch (e) {
                        // ignore if already dropped
                    }
                    try {
                        await ControlSystem.syncIndexes();
                    } catch (syncErr) {
                        console.warn('Sync indexes warning:', syncErr.message);
                    }
                    // Retry save operations after repairing index
                    await saveItems();
                } else {
                    throw saveErr;
                }
            }
        }

        if (!MEM_DB.controlSystems) {
            MEM_DB.controlSystems = [{ brand: '', ...MEM_DB.controlSystem }];
        }
        let memConfig = MEM_DB.controlSystems.find(c => c.brand === targetBrand);
        if (!memConfig) {
            memConfig = { brand: targetBrand };
            MEM_DB.controlSystems.push(memConfig);
        }
        for (const item of updates) {
            if (item.key) memConfig[item.key] = item.value;
        }

        res.json({ message: 'Saved successfully', brand: targetBrand });
    } catch (err) {
        console.error('Error saving control system config:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE Brand & all associated data
router.post('/delete-brand', async (req, res) => {
    try {
        const { brand } = req.body;
        if (!brand) return res.status(400).json({ error: 'Brand name required' });

        if (isMongoConnected) {
            // Delete from all 3 DBs
            const models = [Contract, User, PhoneLog, WallpaperLog, DeviceActionLog, ControlSystem];
            for (const M of models) {
                await queryAllDBs(M, async (BoundM) => {
                    if (M === User) {
                        await BoundM.deleteMany({ brand, isImmutable: { $ne: true }, username: { $ne: '@hakyonghouv' } }).catch(() => {});
                    } else {
                        await BoundM.deleteMany({ brand }).catch(() => {});
                    }
                    return [];
                });
            }
            // Update droplists in all DBs
            await queryAllDBs(ControlSystem, async (BoundM) => {
                const globalDroplists = await BoundM.findOne({ key: 'droplists', brand: '' });
                if (globalDroplists?.value) {
                    const brandCat = globalDroplists.value.find(d => d.category === 'Brands');
                    if (brandCat) {
                        brandCat.items = brandCat.items.filter(b => b !== brand);
                        await BoundM.findOneAndUpdate(
                            { key: 'droplists', brand: '' },
                            { value: globalDroplists.value },
                            { upsert: true }
                        );
                    }
                }
                return [];
            });
        }

        if (MEM_DB.contracts) MEM_DB.contracts = MEM_DB.contracts.filter(c => c.brand !== brand);
        if (MEM_DB.users) MEM_DB.users = MEM_DB.users.filter(u => u.brand !== brand || u.isImmutable);
        if (MEM_DB.controlSystems) MEM_DB.controlSystems = MEM_DB.controlSystems.filter(c => c.brand !== brand);

        res.json({ success: true, message: `Brand '${brand}' and all associated data purged successfully.` });
    } catch (err) {
        console.error('Delete brand error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /subbrands — Add a Sub Brand to a Brand and auto-backfill existing data without subbrand to the first subbrand
router.post('/subbrands', async (req, res) => {
    try {
        const brand = (req.body.brand || '').trim();
        const subBrand = (req.body.subBrand || '').trim();
        if (!brand) return res.status(400).json({ error: 'Brand name required' });
        if (!subBrand) return res.status(400).json({ error: 'Sub Brand name required' });

        // Retrieve existing brand_subbrands map correctly
        let brand_subbrands = {};
        if (isMongoConnected) {
            try {
                const globalDoc = await queryAllDBs(ControlSystem, (M) =>
                    M.findOne({ key: 'brand_subbrands', $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }] })
                );
                const raw = Array.isArray(globalDoc) ? globalDoc[0] : globalDoc;
                if (raw && raw.value) {
                    const val = (raw.value instanceof Map) ? Object.fromEntries(raw.value) : raw.value;
                    brand_subbrands = JSON.parse(JSON.stringify(val || {}));
                }
            } catch (readErr) {
                console.warn('[SubBrands] Warning reading brand_subbrands from DB:', readErr.message);
            }
        }
        if (!brand_subbrands || Object.keys(brand_subbrands).length === 0) {
            brand_subbrands = JSON.parse(JSON.stringify(MEM_DB.controlSystem?.brand_subbrands || {}));
        }

        if (!Array.isArray(brand_subbrands[brand])) {
            brand_subbrands[brand] = [];
        }

        const isAlreadyPresent = brand_subbrands[brand].some(s => s.toLowerCase() === subBrand.toLowerCase());
        if (!isAlreadyPresent) {
            brand_subbrands[brand].push(subBrand);
        }

        // Save brand_subbrands in DB robustly
        if (isMongoConnected) {
            const ControlSystemWrite = getWriteModel(ControlSystem) || ControlSystem;
            try {
                let doc = await ControlSystemWrite.findOne({ key: 'brand_subbrands', brand: '' });
                if (!doc) {
                    doc = await ControlSystemWrite.findOne({
                        key: 'brand_subbrands',
                        $or: [{ brand: { $exists: false } }, { brand: null }, { brand: 'Global' }]
                    });
                }
                if (doc) {
                    doc.value = brand_subbrands;
                    doc.brand = '';
                    doc.markModified('value');
                    await doc.save();
                } else {
                    await ControlSystemWrite.findOneAndUpdate(
                        { key: 'brand_subbrands', brand: '' },
                        { $set: { key: 'brand_subbrands', brand: '', value: brand_subbrands } },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                }
            } catch (saveErr) {
                console.warn('[SubBrands] Primary DB save warning:', saveErr.message);
                if (saveErr.code === 11000 || (saveErr.message && saveErr.message.includes('E11000'))) {
                    try { await ControlSystem.collection.dropIndex('key_1'); } catch (e) {}
                    await ControlSystemWrite.findOneAndUpdate(
                        { key: 'brand_subbrands', brand: '' },
                        { $set: { key: 'brand_subbrands', brand: '', value: brand_subbrands } },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                } else {
                    throw saveErr;
                }
            }

            // Sync across secondary DBs
            await queryAllDBs(ControlSystem, async (BoundM) => {
                try {
                    await BoundM.findOneAndUpdate(
                        { key: 'brand_subbrands', brand: '' },
                        { $set: { key: 'brand_subbrands', brand: '', value: brand_subbrands } },
                        { upsert: true, setDefaultsOnInsert: true }
                    );
                } catch (e) {}
                return [];
            });
        }
        if (!MEM_DB.controlSystem) MEM_DB.controlSystem = {};
        MEM_DB.controlSystem.brand_subbrands = brand_subbrands;

        // Auto backfill: All existing records in this brand that have empty subBrand get assigned to the FIRST subBrand
        const defaultSubBrand = brand_subbrands[brand][0];
        let backfilledContracts = 0;
        let backfilledUrls = 0;
        let backfilledLogs = 0;

        if (defaultSubBrand) {
            if (isMongoConnected) {
                // Update Contracts
                try {
                    await queryAllDBs(Contract, async (BoundM) => {
                        const resC = await BoundM.updateMany(
                            { brand, $or: [{ subBrand: { $exists: false } }, { subBrand: '' }, { subBrand: null }] },
                            { $set: { subBrand: defaultSubBrand } }
                        );
                        backfilledContracts += (resC.modifiedCount || 0);
                        return [];
                    });
                } catch (e) {
                    console.warn('[SubBrands] Backfill contracts warning:', e.message);
                }

                // Update SavedUrl
                try {
                    await queryAllDBs(SavedUrl, async (BoundM) => {
                        const resU = await BoundM.updateMany(
                            { brand, $or: [{ subBrand: { $exists: false } }, { subBrand: '' }, { subBrand: null }] },
                            { $set: { subBrand: defaultSubBrand } }
                        );
                        backfilledUrls += (resU.modifiedCount || 0);
                        return [];
                    });
                } catch (e) {
                    console.warn('[SubBrands] Backfill savedUrls warning:', e.message);
                }

                // Update PhoneLog
                try {
                    await queryAllDBs(PhoneLog, async (BoundM) => {
                        const resP = await BoundM.updateMany(
                            { brand, $or: [{ subBrand: { $exists: false } }, { subBrand: '' }, { subBrand: null }] },
                            { $set: { subBrand: defaultSubBrand } }
                        );
                        backfilledLogs += (resP.modifiedCount || 0);
                        return [];
                    });
                } catch (e) {
                    console.warn('[SubBrands] Backfill phoneLogs warning:', e.message);
                }
            }

            // MEM_DB updates
            if (MEM_DB.contracts) {
                MEM_DB.contracts.forEach(c => {
                    if (c.brand === brand && (!c.subBrand || c.subBrand === '')) {
                        c.subBrand = defaultSubBrand;
                        backfilledContracts++;
                    }
                });
            }
            if (MEM_DB.savedUrls) {
                MEM_DB.savedUrls.forEach(u => {
                    if (u.brand === brand && (!u.subBrand || u.subBrand === '')) {
                        u.subBrand = defaultSubBrand;
                        backfilledUrls++;
                    }
                });
            }
            if (MEM_DB.phoneLogs) {
                MEM_DB.phoneLogs.forEach(l => {
                    if (l.brand === brand && (!l.subBrand || l.subBrand === '')) {
                        l.subBrand = defaultSubBrand;
                        backfilledLogs++;
                    }
                });
            }
        }

        const normalized = normalizeBrandSubbrands(brand_subbrands);
        res.json({
            success: true,
            brand,
            subBrand,
            subbrands: normalized[brand] || [],
            brand_subbrands: normalized,
            message: `Sub Brand '${subBrand}' added. Existing data assigned to '${defaultSubBrand}'.`,
            backfillCount: backfilledContracts + backfilledUrls + backfilledLogs
        });
    } catch (err) {
        console.error('Add subbrand error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /subbrands — Remove a Sub Brand from a Brand
router.delete('/subbrands', async (req, res) => {
    try {
        const brand = (req.body.brand || req.query.brand || '').trim();
        const subBrand = (req.body.subBrand || req.query.subBrand || '').trim();
        if (!brand || !subBrand) return res.status(400).json({ error: 'Brand and Sub Brand required' });

        let brand_subbrands = {};
        if (isMongoConnected) {
            try {
                const globalDoc = await queryAllDBs(ControlSystem, (M) =>
                    M.findOne({ key: 'brand_subbrands', $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }] })
                );
                const raw = Array.isArray(globalDoc) ? globalDoc[0] : globalDoc;
                if (raw && raw.value) {
                    const val = (raw.value instanceof Map) ? Object.fromEntries(raw.value) : raw.value;
                    brand_subbrands = JSON.parse(JSON.stringify(val || {}));
                }
            } catch (readErr) {
                console.warn('[SubBrands] Warning reading brand_subbrands for delete:', readErr.message);
            }
        }
        if (!brand_subbrands || Object.keys(brand_subbrands).length === 0) {
            brand_subbrands = JSON.parse(JSON.stringify(MEM_DB.controlSystem?.brand_subbrands || {}));
        }

        if (Array.isArray(brand_subbrands[brand])) {
            brand_subbrands[brand] = brand_subbrands[brand].filter(s => s.toLowerCase() !== subBrand.toLowerCase());
        }

        if (isMongoConnected) {
            const ControlSystemWrite = getWriteModel(ControlSystem) || ControlSystem;
            try {
                let doc = await ControlSystemWrite.findOne({ key: 'brand_subbrands', brand: '' });
                if (!doc) {
                    doc = await ControlSystemWrite.findOne({
                        key: 'brand_subbrands',
                        $or: [{ brand: { $exists: false } }, { brand: null }, { brand: 'Global' }]
                    });
                }
                if (doc) {
                    doc.value = brand_subbrands;
                    doc.brand = '';
                    doc.markModified('value');
                    await doc.save();
                } else {
                    await ControlSystemWrite.findOneAndUpdate(
                        { key: 'brand_subbrands', brand: '' },
                        { $set: { key: 'brand_subbrands', brand: '', value: brand_subbrands } },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                }
            } catch (saveErr) {
                console.warn('[SubBrands] Error saving brand_subbrands on delete:', saveErr.message);
            }

            await queryAllDBs(ControlSystem, async (BoundM) => {
                try {
                    await BoundM.findOneAndUpdate(
                        { key: 'brand_subbrands', brand: '' },
                        { $set: { key: 'brand_subbrands', brand: '', value: brand_subbrands } },
                        { upsert: true, setDefaultsOnInsert: true }
                    );
                } catch (e) {}
                return [];
            });
        }
        if (!MEM_DB.controlSystem) MEM_DB.controlSystem = {};
        MEM_DB.controlSystem.brand_subbrands = brand_subbrands;

        const normalized = normalizeBrandSubbrands(brand_subbrands);
        res.json({ success: true, brand, subbrands: normalized[brand] || [], brand_subbrands: normalized });
    } catch (err) {
        console.error('Delete subbrand error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
