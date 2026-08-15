import express from 'express';
import Contract from '../models/Contract.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

const sanitizeAndDecryptContract = (c) => {
    if (!c) return c;
    const obj = c.toObject ? c.toObject() : { ...c };
    obj.urlFb = obj.urlFb || obj.url_fb || '';
    obj.mosyleUrl = obj.mosyleUrl || obj.mosyle_url || obj.mosyleURL || obj.urlMosyle || '';
    return obj;
};

// GET contracts
router.get('/', async (req, res) => {
    try {
        const { status, userBrand, userRole, page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};
        if (status) query.status = status;
        if (userBrand && userRole !== 'Administrator') query.brand = userBrand;
        if (search) {
            query.$or = [
                { customerNameEn: { $regex: search, $options: 'i' } },
                { customerNameKh: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { contractId: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const total = await Contract.countDocuments(query);
            const contracts = await Contract.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            const data = contracts.map(sanitizeAndDecryptContract);
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.contracts;
        if (status) filtered = filtered.filter(c => c.status === status);
        if (userBrand && userRole !== 'Administrator') filtered = filtered.filter(c => c.brand === userBrand);
        if (search) filtered = filtered.filter(c =>
            (c.customerNameEn || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.customerNameKh || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.contractId || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.model || '').toLowerCase().includes(search.toLowerCase())
        );
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit)).map(sanitizeAndDecryptContract);
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE contract
router.post('/', async (req, res) => {
    try {
        const newContract = {
            contractId: 'CT-2026-' + Math.floor(100 + Math.random() * 900),
            status: 'Application',
            lockPhoneStatus: 'Unlocked',
            lockWallpaperStatus: 'Unlocked',
            ...req.body
        };

        let savedContract = newContract;

        if (isMongoConnected) {
            const doc = new Contract(newContract);
            await doc.save();
            savedContract = doc.toObject();
        }

        MEM_DB.contracts.unshift(savedContract);

        res.status(201).json(savedContract);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE contract
router.put('/:id', async (req, res) => {
    try {
        if (isMongoConnected) {
            const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (updated) return res.json(sanitizeAndDecryptContract(updated));
        }
        const idx = MEM_DB.contracts.findIndex(c => c._id === req.params.id || c.contractId === req.params.id);
        if (idx !== -1) {
            MEM_DB.contracts[idx] = { ...MEM_DB.contracts[idx], ...req.body };
            return res.json(sanitizeAndDecryptContract(MEM_DB.contracts[idx]));
        }
        res.status(404).json({ error: 'Contract not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE contract
router.delete('/:id', async (req, res) => {
    try {
        if (isMongoConnected) await Contract.findByIdAndDelete(req.params.id);
        MEM_DB.contracts = MEM_DB.contracts.filter(c => c._id !== req.params.id);
        res.json({ message: 'Contract deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
