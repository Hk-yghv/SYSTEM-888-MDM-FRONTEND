import express from 'express';
import {
    FollowUp4Submit,
    FollowUp4RejectSubmit,
    FollowUp4RejectCS,
    FollowUp4Detail
} from '../models/FollowUp4.js';
import { isMongoConnected } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

const checkMasterAdmin = (username, userRole, isImmutable) => {
    return (
        username === '@hakyonghouv' ||
        username === 'hakyonghouv' ||
        isImmutable === 'true' ||
        userRole === 'Administrator' ||
        userRole === 'Admin'
    );
};

// Memory fallback arrays
const MEM_SUBMITS = [];
const MEM_REJECT_SUBMITS = [];
const MEM_REJECT_CS = [];
const MEM_DETAILS = [];

// ==========================================
// 1. FOLLOW UP SUBMIT ENDPOINTS
// ==========================================

// GET Submit records
router.get('/submit', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            brand = '',
            startDate = '',
            endDate = '',
            date = '',
            search = ''
        } = req.query;

        const isMaster = checkMasterAdmin(username, userRole, isImmutable);

        let filter = {};
        if (isMaster) {
            if (brand && brand !== 'ALL' && brand !== 'All') {
                filter.brand = { $in: [brand, new RegExp(`^${brand.trim()}$`, 'i')] };
            }
        } else {
            if (userBrand && userBrand !== 'ALL' && userBrand !== 'All') {
                filter.brand = { $in: [userBrand, '', null, new RegExp(`^${userBrand.trim()}$`, 'i')] };
            }
        }

        if (date) {
            filter.date = date;
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { name: searchRegex },
                { userName: searchRegex },
                { phone: searchRegex },
                { nameTelegram: searchRegex },
                { model: searchRegex },
                { description: searchRegex }
            ];
        }

        let items = [];
        if (isMongoConnected) {
            items = await queryAllDBs(FollowUp4Submit, (M) => M.find(filter).sort({ date: -1, createdAt: -1 }));
        } else {
            items = MEM_SUBMITS.filter(item => {
                if (filter.brand && item.brand !== filter.brand) return false;
                if (date && item.date !== date) return false;
                return true;
            });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error('Error fetching FollowUp4 Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Submit record
router.post('/submit', async (req, res) => {
    try {
        const {
            date,
            name = '',
            userName = '',
            phone = '',
            nameTelegram = '',
            fromSource = '',
            namePgTlFrom = '',
            contactType = '',
            namePgTlContact = '',
            appraisal = '',
            requested = '',
            assetType = '',
            model = '',
            status = 'PENDING',
            description = '',
            brand,
            createdBy = ''
        } = req.body;

        if (!brand || !date) {
            return res.status(400).json({ success: false, message: 'Date and Brand are required' });
        }

        const recordData = {
            date,
            name,
            userName,
            phone,
            nameTelegram,
            fromSource,
            namePgTlFrom,
            contactType,
            namePgTlContact,
            appraisal,
            requested,
            assetType,
            model,
            status,
            description,
            brand,
            createdBy
        };

        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4Submit) || FollowUp4Submit;
            const newRecord = new WriteModel(recordData);
            await newRecord.save();
            recordSystemAudit(req, 'CREATE_FOLLOWUP4_SUBMIT', `Created FollowUp4 submit record for ${name} (${brand})`);
            return res.json({ success: true, data: newRecord });
        } else {
            const memRecord = { _id: 'fu4_' + Date.now(), ...recordData, createdAt: new Date() };
            MEM_SUBMITS.unshift(memRecord);
            return res.json({ success: true, data: memRecord });
        }
    } catch (err) {
        console.error('Error creating FollowUp4 Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT Submit record
router.put('/submit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4Submit) || FollowUp4Submit;
            const updated = await WriteModel.findByIdAndUpdate(id, req.body, { new: true });
            recordSystemAudit(req, 'UPDATE_FOLLOWUP4_SUBMIT', `Updated FollowUp4 submit ID: ${id}`);
            return res.json({ success: true, data: updated });
        } else {
            const idx = MEM_SUBMITS.findIndex(s => s._id === id);
            if (idx !== -1) {
                MEM_SUBMITS[idx] = { ...MEM_SUBMITS[idx], ...req.body };
                return res.json({ success: true, data: MEM_SUBMITS[idx] });
            }
            return res.status(404).json({ success: false, message: 'Not found' });
        }
    } catch (err) {
        console.error('Error updating FollowUp4 Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE Submit record
router.delete('/submit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4Submit) || FollowUp4Submit;
            await WriteModel.findByIdAndDelete(id);
            recordSystemAudit(req, 'DELETE_FOLLOWUP4_SUBMIT', `Deleted FollowUp4 submit ID: ${id}`);
            return res.json({ success: true, message: 'Deleted successfully' });
        } else {
            const idx = MEM_SUBMITS.findIndex(s => s._id === id);
            if (idx !== -1) MEM_SUBMITS.splice(idx, 1);
            return res.json({ success: true, message: 'Deleted successfully' });
        }
    } catch (err) {
        console.error('Error deleting FollowUp4 Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 2. REJECT SUBMIT ENDPOINTS
// ==========================================

// GET Reject Submit records by date and brand
router.get('/reject-submit', async (req, res) => {
    try {
        const { date, brand } = req.query;
        let filter = {};
        if (date) filter.date = date;
        if (brand && brand !== 'ALL' && brand !== 'All') filter.brand = brand;

        let items = [];
        if (isMongoConnected) {
            items = await queryAllDBs(FollowUp4RejectSubmit, (M) => M.find(filter).sort({ date: -1 }));
        } else {
            items = MEM_REJECT_SUBMITS.filter(r => (!date || r.date === date) && (!brand || r.brand === brand));
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error('Error fetching Reject Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Batch Save Reject Submit counts for a date and brand
router.post('/reject-submit/save', async (req, res) => {
    try {
        const { date, brand, entries, createdBy = '' } = req.body;
        if (!date || !brand || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'date, brand, and entries array required' });
        }

        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4RejectSubmit) || FollowUp4RejectSubmit;
            for (const item of entries) {
                await WriteModel.findOneAndUpdate(
                    { date, brand, reason: item.reason },
                    { date, brand, reason: item.reason, count: Number(item.count) || 0, createdBy },
                    { upsert: true, new: true }
                );
            }
        } else {
            for (const item of entries) {
                const idx = MEM_REJECT_SUBMITS.findIndex(r => r.date === date && r.brand === brand && r.reason === item.reason);
                const rec = { date, brand, reason: item.reason, count: Number(item.count) || 0, createdBy };
                if (idx !== -1) MEM_REJECT_SUBMITS[idx] = rec;
                else MEM_REJECT_SUBMITS.push(rec);
            }
        }

        recordSystemAudit(req, 'SAVE_REJECT_SUBMIT', `Saved Reject Submit counts for ${date} brand ${brand}`);
        res.json({ success: true, message: 'Saved successfully' });
    } catch (err) {
        console.error('Error saving Reject Submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 3. REJECT CS ENDPOINTS
// ==========================================

// GET Reject CS records by date and brand
router.get('/reject-cs', async (req, res) => {
    try {
        const { date, brand } = req.query;
        let filter = {};
        if (date) filter.date = date;
        if (brand && brand !== 'ALL' && brand !== 'All') filter.brand = brand;

        let items = [];
        if (isMongoConnected) {
            items = await queryAllDBs(FollowUp4RejectCS, (M) => M.find(filter).sort({ date: -1 }));
        } else {
            items = MEM_REJECT_CS.filter(r => (!date || r.date === date) && (!brand || r.brand === brand));
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error('Error fetching Reject CS:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Batch Save Reject CS counts for a date and brand
router.post('/reject-cs/save', async (req, res) => {
    try {
        const { date, brand, entries, createdBy = '' } = req.body;
        if (!date || !brand || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'date, brand, and entries array required' });
        }

        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4RejectCS) || FollowUp4RejectCS;
            for (const item of entries) {
                await WriteModel.findOneAndUpdate(
                    { date, brand, reason: item.reason },
                    { date, brand, reason: item.reason, count: Number(item.count) || 0, createdBy },
                    { upsert: true, new: true }
                );
            }
        } else {
            for (const item of entries) {
                const idx = MEM_REJECT_CS.findIndex(r => r.date === date && r.brand === brand && r.reason === item.reason);
                const rec = { date, brand, reason: item.reason, count: Number(item.count) || 0, createdBy };
                if (idx !== -1) MEM_REJECT_CS[idx] = rec;
                else MEM_REJECT_CS.push(rec);
            }
        }

        recordSystemAudit(req, 'SAVE_REJECT_CS', `Saved Reject CS counts for ${date} brand ${brand}`);
        res.json({ success: true, message: 'Saved successfully' });
    } catch (err) {
        console.error('Error saving Reject CS:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 4. DETAIL ENDPOINTS
// ==========================================

// GET Detail metrics by date and brand or date range
router.get('/detail', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            brand = '',
            date = '',
            startDate = '',
            endDate = ''
        } = req.query;

        const isMaster = checkMasterAdmin(username, userRole, isImmutable);

        let filter = {};
        if (isMaster) {
            if (brand && brand !== 'ALL' && brand !== 'All') {
                filter.brand = { $in: [brand, new RegExp(`^${brand.trim()}$`, 'i')] };
            }
        } else {
            if (userBrand && userBrand !== 'ALL' && userBrand !== 'All') {
                filter.brand = { $in: [userBrand, '', null, new RegExp(`^${userBrand.trim()}$`, 'i')] };
            }
        }

        if (date) {
            filter.date = date;
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        let items = [];
        if (isMongoConnected) {
            items = await queryAllDBs(FollowUp4Detail, (M) => M.find(filter).sort({ date: -1 }));
        } else {
            items = MEM_DETAILS.filter(d => (!date || d.date === date) && (!brand || d.brand === brand));
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error('Error fetching Detail metrics:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Save Detail metrics for a single date & brand
router.post('/detail/save', async (req, res) => {
    try {
        const {
            date,
            brand,
            message = 0,
            page = 0,
            telegram = 0,
            noReply = 0,
            inquire = 0,
            rejectCs = 0,
            more = 0,
            pageSubmit = 0,
            telegramSubmit = 0,
            review = 0,
            reject = 0,
            success1 = 0,
            success2 = 0,
            createdBy = ''
        } = req.body;

        if (!date || !brand) {
            return res.status(400).json({ success: false, message: 'date and brand required' });
        }

        const metricsData = {
            date,
            brand,
            message: Number(message) || 0,
            page: Number(page) || 0,
            telegram: Number(telegram) || 0,
            noReply: Number(noReply) || 0,
            inquire: Number(inquire) || 0,
            rejectCs: Number(rejectCs) || 0,
            more: Number(more) || 0,
            pageSubmit: Number(pageSubmit) || 0,
            telegramSubmit: Number(telegramSubmit) || 0,
            review: Number(review) || 0,
            reject: Number(reject) || 0,
            success1: Number(success1) || 0,
            success2: Number(success2) || 0,
            createdBy
        };

        if (isMongoConnected) {
            const WriteModel = getWriteModel(FollowUp4Detail) || FollowUp4Detail;
            const updated = await WriteModel.findOneAndUpdate(
                { date, brand },
                metricsData,
                { upsert: true, new: true }
            );
            recordSystemAudit(req, 'SAVE_FOLLOWUP4_DETAIL', `Saved Detail metrics for ${date} brand ${brand}`);
            return res.json({ success: true, data: updated });
        } else {
            const idx = MEM_DETAILS.findIndex(d => d.date === date && d.brand === brand);
            if (idx !== -1) MEM_DETAILS[idx] = metricsData;
            else MEM_DETAILS.push(metricsData);
            return res.json({ success: true, data: metricsData });
        }
    } catch (err) {
        console.error('Error saving Detail metrics:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
