import express from 'express';
import FollowUpSenSok from '../models/FollowUpSenSok.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!Array.isArray(MEM_DB.followUpsSenSok)) {
    MEM_DB.followUpsSenSok = [];
}

// GET all follow up Sen Sok records
router.get('/', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            brand = '',
            page = 1,
            limit = 15,
            search = '',
            startDate = '',
            endDate = '',
            date = '',
            status = '',
            fetchAll = 'false'
        } = req.query;

        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

        let filter = {};
        if (isMasterAdmin) {
            if (brand) filter.brand = brand;
        } else {
            if (userBrand) filter.brand = userBrand;
        }

        if (date) {
            filter.date = date;
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        if (status) {
            filter.status = status;
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { customerName: regex },
                { phone: regex },
                { location: regex },
                { source: regex },
                { collateralType: regex },
                { description: regex },
                { link: regex },
                { username: regex },
                { responder: regex },
                { followUpId: regex },
                { brand: regex }
            ];
        }

        let allRecords = [];
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUpSenSok, (M) => M.find(filter).sort({ date: -1, createdAt: -1 }));
            const seenIds = new Set();
            results.forEach(r => {
                const id = r._id?.toString() || r.followUpId;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    allRecords.push(r);
                }
            });
        } else {
            allRecords = MEM_DB.followUpsSenSok.filter(item => {
                if (filter.brand && item.brand !== filter.brand) return false;
                if (date && item.date !== date) return false;
                if (startDate && item.date < startDate) return false;
                if (endDate && item.date > endDate) return false;
                if (status && item.status !== status) return false;
                if (search) {
                    const combined = `${item.customerName || ''} ${item.phone || ''} ${item.location || ''} ${item.source || ''} ${item.collateralType || ''} ${item.description || ''} ${item.link || ''} ${item.username || ''} ${item.followUpId || ''} ${item.brand || ''}`.toLowerCase();
                    if (!combined.includes(search.toLowerCase())) return false;
                }
                return true;
            });
            allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
        }

        // Calculate summary metrics
        let totalRequestedAmount = 0;
        allRecords.forEach(item => {
            totalRequestedAmount += (Number(item.requestedAmount) || 0);
        });

        const totalRecords = allRecords.length;
        const summary = {
            totalRequestedAmount,
            totalRecords
        };

        if (fetchAll === 'true') {
            return res.json({ data: allRecords, total: totalRecords, summary });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const pagedData = allRecords.slice(skip, skip + parseInt(limit));

        res.json({
            data: pagedData,
            total: totalRecords,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalRecords / parseInt(limit)) || 1,
            summary
        });
    } catch (err) {
        console.error('Fetch follow up Sen Sok records error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET unique droplist suggestions based on previously saved records
router.get('/droplists', async (req, res) => {
    try {
        let allRecords = [];
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUpSenSok, (M) => M.find({}));
            const seenIds = new Set();
            results.forEach(r => {
                const id = r._id?.toString() || r.followUpId;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    allRecords.push(r);
                }
            });
        } else {
            allRecords = MEM_DB.followUpsSenSok;
        }

        const getUniqueValues = (field) => {
            const set = new Set();
            allRecords.forEach(r => {
                if (r[field] && typeof r[field] === 'string' && r[field].trim()) {
                    set.add(r[field].trim());
                }
            });
            return Array.from(set);
        };

        const locations = getUniqueValues('location');
        const sources = getUniqueValues('source');
        const collateralTypes = getUniqueValues('collateralType');
        const responders = getUniqueValues('responder');
        const usernames = getUniqueValues('username');
        const customerNames = getUniqueValues('customerName');

        res.json({
            locations,
            sources,
            collateralTypes,
            responders,
            usernames,
            customerNames
        });
    } catch (err) {
        console.error('Fetch follow up Sen Sok droplists error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single follow up Sen Sok record by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let record = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUpSenSok, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            record = results.find(r => r != null);
        } else {
            record = MEM_DB.followUpsSenSok.find(f => f._id === id || f.followUpId === id);
        }

        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json(record);
    } catch (err) {
        console.error('Fetch single follow up Sen Sok record error:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE follow up Sen Sok record
router.post('/', async (req, res) => {
    try {
        const {
            date = new Date().toISOString().split('T')[0],
            customerName,
            phone = '',
            location = 'ភ្នំពេញ',
            source = 'Facebook',
            requestedAmount = 0,
            collateralType = '',
            description = '',
            link = '',
            username = '',
            responder = '',
            brand = '',
            status = '',
            images = [],
            notes = ''
        } = req.body;

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({ error: 'Customer Name (ឈ្មោះអតិថិជន) is required' });
        }

        const currentYear = new Date().getFullYear();
        const autoId = `FUSS-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newDoc = {
            followUpId: autoId,
            date: date || new Date().toISOString().split('T')[0],
            customerName: customerName.trim(),
            phone: phone ? phone.trim() : '',
            location: location ? location.trim() : 'សែនសុខ',
            source: source ? source.trim() : 'Facebook',
            requestedAmount: Number(requestedAmount) || 0,
            collateralType: collateralType ? collateralType.trim() : '',
            description: description ? description.trim() : '',
            link: link ? link.trim() : '',
            username: username ? username.trim() : 'Staff',
            responder: responder ? responder.trim() : '',
            brand: brand || 'MDM',
            status: status || 'ជោគជ័យ',
            images: Array.isArray(images) ? images : (images ? [images] : []),
            notes: notes || ''
        };

        let saved = newDoc;
        if (isMongoConnected) {
            const Model = getWriteModel(FollowUpSenSok) || FollowUpSenSok;
            const doc = new Model(newDoc);
            await doc.save();
            saved = doc.toObject();
        }

        MEM_DB.followUpsSenSok.unshift(saved);

        // Audit log
        recordSystemAudit({
            category: 'Contract',
            level: 'Information',
            action: 'FOLLOW_UP_SEN_SOK_CREATE',
            taskCategory: 'Follow Up Sen Sok',
            description: `Created Follow Up Sen Sok entry ${autoId} for ${customerName} (${phone}): Location=${location}, Amount=$${requestedAmount}, Responder=${responder}, User=${username}`,
            username: username || 'Staff',
            brand: brand || '',
            payload: newDoc
        }).catch(() => { });

        res.status(201).json(saved);
    } catch (err) {
        console.error('Create follow up Sen Sok error:', err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE follow up Sen Sok record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            customerName,
            phone,
            location,
            source,
            requestedAmount,
            collateralType,
            description,
            link,
            username,
            responder,
            brand,
            status,
            images,
            notes
        } = req.body;

        const updateData = {};
        if (date !== undefined) updateData.date = date;
        if (customerName !== undefined) updateData.customerName = customerName.trim();
        if (phone !== undefined) updateData.phone = phone.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (source !== undefined) updateData.source = source.trim();
        if (requestedAmount !== undefined) updateData.requestedAmount = Number(requestedAmount) || 0;
        if (collateralType !== undefined) updateData.collateralType = collateralType.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (link !== undefined) updateData.link = link.trim();
        if (username !== undefined) updateData.username = username.trim();
        if (responder !== undefined) updateData.responder = responder.trim();
        if (brand !== undefined) updateData.brand = brand;
        if (status !== undefined) updateData.status = status;
        if (images !== undefined) updateData.images = Array.isArray(images) ? images : (images ? [images] : []);
        if (notes !== undefined) updateData.notes = notes;

        let updated = null;
        let existing = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUpSenSok, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            existing = results.find(r => r != null);
        } else {
            existing = MEM_DB.followUpsSenSok.find(f => f._id === id || f.followUpId === id);
        }

        if (isMongoConnected) {
            await queryAllDBs(FollowUpSenSok, async (BoundM) => {
                try {
                    let doc = await BoundM.findByIdAndUpdate(id, { $set: updateData }, { new: true });
                    if (!doc) {
                        doc = await BoundM.findOneAndUpdate({ followUpId: id }, { $set: updateData }, { new: true });
                    }
                    if (doc && !updated) updated = doc.toObject();
                } catch { }
            });

            if (!updated) {
                const WriteModel = getWriteModel(FollowUpSenSok) || FollowUpSenSok;
                try {
                    updated = await WriteModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
                    if (!updated) {
                        updated = await WriteModel.findOneAndUpdate({ followUpId: id }, { $set: updateData }, { new: true });
                    }
                } catch { }
            }
        }

        const idx = MEM_DB.followUpsSenSok.findIndex(f => f._id === id || f.followUpId === id);
        if (idx !== -1) {
            MEM_DB.followUpsSenSok[idx] = { ...MEM_DB.followUpsSenSok[idx], ...updateData };
            if (!updated) updated = MEM_DB.followUpsSenSok[idx];
        }

        if (updated) {
            // Audit log
            recordSystemAudit({
                category: 'Contract',
                level: 'Information',
                action: 'FOLLOW_UP_SEN_SOK_UPDATE',
                taskCategory: 'Follow Up Sen Sok',
                description: `Updated Follow Up Sen Sok entry ${updated.followUpId || id} for ${updated.customerName || ''}`,
                username: req.query.username || username || 'Staff',
                brand: updated.brand || '',
                payload: { old: existing, new: updated }
            }).catch(() => { });

            return res.json(updated);
        }

        res.status(404).json({ error: 'Follow up Sen Sok record not found' });
    } catch (err) {
        console.error('Update follow up Sen Sok error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE follow up Sen Sok record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const operatorUsername = req.query.username || 'Staff';

        let existing = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUpSenSok, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            existing = results.find(r => r != null);
            await queryAllDBs(FollowUpSenSok, async (BoundM) => {
                try { await BoundM.findByIdAndDelete(id); } catch { }
                try { await BoundM.deleteMany({ followUpId: id }); } catch { }
            });
        }

        const beforeLen = MEM_DB.followUpsSenSok.length;
        if (!existing) {
            existing = MEM_DB.followUpsSenSok.find(f => f._id === id || f.followUpId === id);
        }
        MEM_DB.followUpsSenSok = MEM_DB.followUpsSenSok.filter(f => f._id !== id && f.followUpId !== id);

        // Audit log
        recordSystemAudit({
            category: 'Contract',
            level: 'Warning',
            action: 'FOLLOW_UP_SEN_SOK_DELETE',
            taskCategory: 'Follow Up Sen Sok',
            description: `Deleted Follow Up Sen Sok record ${existing?.followUpId || id} (${existing?.customerName || 'Unknown'})`,
            username: operatorUsername,
            brand: existing?.brand || '',
            payload: existing
        }).catch(() => { });

        res.json({ message: 'Record deleted successfully', id });
    } catch (err) {
        console.error('Delete follow up Sen Sok error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
