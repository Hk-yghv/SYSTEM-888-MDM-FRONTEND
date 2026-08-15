import express from 'express';
import ControlSystem from '../models/ControlSystem.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

// GET control system config
router.get('/', async (req, res) => {
    try {
        const brand = req.query.brand || '';
        if (isMongoConnected) {
            let configs = await ControlSystem.find({ brand });
            if (configs.length === 0 && brand) {
                configs = await ControlSystem.find({ brand: '' });
            }
            const mapped = {};
            configs.forEach(c => mapped[c.key] = c.value);
            if (Object.keys(mapped).length > 0) return res.json(mapped);
        }

        if (!MEM_DB.controlSystems) {
            MEM_DB.controlSystems = [{ brand: '', ...MEM_DB.controlSystem }];
        }
        let memConfig = MEM_DB.controlSystems.find(c => c.brand === brand);
        if (!memConfig) memConfig = MEM_DB.controlSystems.find(c => c.brand === '') || MEM_DB.controlSystem;
        res.json(memConfig);
    } catch (err) {
        res.json(MEM_DB.controlSystem);
    }
});

// POST control system config (supports single key or bulk configs)
router.post('/', async (req, res) => {
    try {
        const { key, value, brand, configs } = req.body;
        const targetBrand = brand || '';

        const updates = Array.isArray(configs)
            ? configs
            : (key ? [{ key, value }] : []);

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No configuration data provided' });
        }

        if (isMongoConnected) {
            const saveItems = async () => {
                for (const item of updates) {
                    if (!item.key) continue;
                    
                    // 1. Search for existing config matching key and targetBrand exactly
                    let doc = await ControlSystem.findOne({ key: item.key, brand: targetBrand });
                    
                    // 2. If not found and targetBrand is Global (''), search for legacy documents missing brand field
                    if (!doc && targetBrand === '') {
                        doc = await ControlSystem.findOne({
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
                        await ControlSystem.findOneAndUpdate(
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
            await Contract.deleteMany({ brand });
            await User.deleteMany({ brand, isImmutable: { $ne: true }, username: { $ne: '@hakyonghouv' } });
            await PhoneLog.deleteMany({ brand });
            await WallpaperLog.deleteMany({ brand });
            await DeviceActionLog.deleteMany({ brand });
            await ControlSystem.deleteMany({ brand });

            const globalDroplists = await ControlSystem.findOne({ key: 'droplists', brand: '' });
            if (globalDroplists && globalDroplists.value) {
                const brandCat = globalDroplists.value.find(d => d.category === 'Brands');
                if (brandCat) {
                    brandCat.items = brandCat.items.filter(b => b !== brand);
                    await ControlSystem.findOneAndUpdate(
                        { key: 'droplists', brand: '' },
                        { value: globalDroplists.value },
                        { upsert: true }
                    );
                }
            }
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
