import express from 'express';
import ControlSystem from '../models/ControlSystem.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
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

// Helper to retrieve Global configurations across DBs
async function getGlobalConfigs() {
    if (!isMongoConnected) return MEM_DB.controlSystem || {};
    const globalDocs = await queryAllDBs(ControlSystem, (M) => M.find({ $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }] }));
    const mapped = {};
    globalDocs.forEach(c => {
        if (c.key && mapped[c.key] === undefined) {
            mapped[c.key] = c.value;
        }
    });
    return mapped;
}

// GET control system config (Auto-inherits Global settings if brand has no custom config)
router.get('/', async (req, res) => {
    try {
        const brand = (req.query.brand || '').trim();
        const globalConfigs = await getGlobalConfigs();

        if (isMongoConnected) {
            if (!brand || brand === 'Global') {
                return res.json(globalConfigs);
            }

            // Fetch brand specific configs
            const brandDocs = await queryAllDBs(ControlSystem, (M) => M.find({ brand }));
            const brandMapped = {};
            brandDocs.forEach(c => {
                if (c.key && brandMapped[c.key] === undefined) {
                    brandMapped[c.key] = c.value;
                }
            });

            // Deep merge with Global configurations so any missing key or empty droplist category inherits from Global
            // NOTE: We do NOT persist/clone this merge to DB — Private brand stays empty until admin explicitly saves.
            const merged = { ...globalConfigs, ...brandMapped };

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

        const TRACKED_KEYS = ['call_phone_display', 'lockphone_display_text', 'lockphone_phone_number', 'roles', 'droplists'];
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

export default router;
