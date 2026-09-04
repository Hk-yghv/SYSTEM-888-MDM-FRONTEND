import express from 'express';
import FollowUp from '../models/FollowUp.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!Array.isArray(MEM_DB.followUps)) {
    MEM_DB.followUps = [];
}

// GET all follow up records
router.get('/', async (req, res) => {
    try {
        const {
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            brand = '',
            page = 1,
            limit = 10,
            search = '',
            startDate = '',
            endDate = '',
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

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { message: regex },
                { reason: regex },
                { followUpId: regex },
                { brand: regex },
                { createdBy: regex }
            ];
        }

        let allRecords = [];
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp, (M) => M.find(filter).sort({ date: -1, createdAt: -1 }));
            const seenIds = new Set();
            results.forEach(r => {
                const id = r._id?.toString() || r.followUpId;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    allRecords.push(r);
                }
            });
        } else {
            allRecords = MEM_DB.followUps.filter(item => {
                if (filter.brand && item.brand !== filter.brand) return false;
                if (startDate && item.date < startDate) return false;
                if (endDate && item.date > endDate) return false;
                if (search) {
                    const s = search.toLowerCase();
                    const combined = `${item.message} ${item.reason} ${item.followUpId} ${item.brand} ${item.createdBy}`.toLowerCase();
                    if (!combined.includes(s)) return false;
                }
                return true;
            });
        }

        allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Calculate summary totals across all filtered items
        const totalMessages = allRecords.reduce((sum, r) => sum + (Number(r.totalMessages) || 0), 0);
        const totalNoResponse = allRecords.reduce((sum, r) => sum + (Number(r.noResponse) || 0), 0);
        const totalRequested = allRecords.reduce((sum, r) => sum + (Number(r.requested) || 0), 0);
        const totalFailed = allRecords.reduce((sum, r) => sum + (Number(r.failed) || 0), 0);
        const totalSuccess = allRecords.reduce((sum, r) => sum + (Number(r.success) || 0), 0);
        const totalRecords = allRecords.length;
        const successRate = totalRequested > 0 ? ((totalSuccess / totalRequested) * 100).toFixed(1) : 0;

        const summary = {
            totalMessages,
            totalNoResponse,
            totalRequested,
            totalFailed,
            totalSuccess,
            totalRecords,
            successRate
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
            totalPages: Math.ceil(totalRecords / parseInt(limit)),
            summary
        });
    } catch (err) {
        console.error('Fetch follow up records error:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE follow up record
router.post('/', async (req, res) => {
    try {
        const {
            date = new Date().toISOString().split('T')[0],
            message,
            totalMessages = 0,
            noResponse = 0,
            requested = 0,
            failed = 0,
            success = 0,
            reason = '',
            brand = '',
            notes = '',
            createdBy = 'Staff'
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message សាកសួរ is required' });
        }

        const currentYear = new Date().getFullYear();
        const autoId = `FU-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newDoc = {
            followUpId: autoId,
            date,
            message,
            totalMessages: Number(totalMessages) || 0,
            noResponse: Number(noResponse) || 0,
            requested: Number(requested) || 0,
            failed: Number(failed) || 0,
            success: Number(success) || 0,
            reason: reason || '',
            brand: brand || '',
            notes: notes || '',
            createdBy
        };

        let saved = newDoc;
        if (isMongoConnected) {
            const Model = getWriteModel(FollowUp) || FollowUp;
            const doc = new Model(newDoc);
            await doc.save();
            saved = doc.toObject();
        }

        MEM_DB.followUps.unshift(saved);

        // Audit log
        recordSystemAudit({
            category: 'Contract',
            level: 'Information',
            action: 'FOLLOW_UP_CREATE',
            taskCategory: 'Follow Up 1',
            description: `Created follow-up record ${autoId} (${date}): TotalMessages=${totalMessages}, NoResponse=${noResponse}, Requested=${requested}, Success=${success}, Failed=${failed}`,
            username: createdBy,
            brand: brand || '',
            payload: newDoc
        }).catch(() => {});

        res.status(201).json(saved);
    } catch (err) {
        console.error('Create follow up error:', err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE follow up record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.__v;
        delete updateData.createdAt;

        if (updateData.totalMessages !== undefined) updateData.totalMessages = Number(updateData.totalMessages) || 0;
        if (updateData.noResponse !== undefined) updateData.noResponse = Number(updateData.noResponse) || 0;
        if (updateData.requested !== undefined) updateData.requested = Number(updateData.requested) || 0;
        if (updateData.failed !== undefined) updateData.failed = Number(updateData.failed) || 0;
        if (updateData.success !== undefined) updateData.success = Number(updateData.success) || 0;

        let updated = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp, async (BoundM) => {
                try {
                    let doc = await BoundM.findByIdAndUpdate(id, { $set: updateData }, { new: true });
                    if (!doc) {
                        doc = await BoundM.findOneAndUpdate({ followUpId: id }, { $set: updateData }, { new: true });
                    }
                    return doc ? [doc] : [];
                } catch {
                    return [];
                }
            });
            updated = results[0] || null;
            if (!updated) {
                const WriteModel = getWriteModel(FollowUp) || FollowUp;
                updated = await WriteModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }) ||
                          await WriteModel.findOneAndUpdate({ followUpId: id }, { $set: updateData }, { new: true });
            }
        }

        const idx = MEM_DB.followUps.findIndex(f => f._id === id || f.followUpId === id);
        if (idx !== -1) {
            MEM_DB.followUps[idx] = { ...MEM_DB.followUps[idx], ...updateData };
            if (!updated) updated = MEM_DB.followUps[idx];
        }

        if (updated) {
            return res.json(updated);
        }

        res.status(404).json({ error: 'Follow up record not found' });
    } catch (err) {
        console.error('Update follow up error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE follow up record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            await queryAllDBs(FollowUp, async (BoundM) => {
                try { await BoundM.findByIdAndDelete(id); } catch {}
                try { await BoundM.deleteMany({ followUpId: id }); } catch {}
                return [];
            });
        }

        MEM_DB.followUps = MEM_DB.followUps.filter(f => f._id !== id && f.followUpId !== id);

        res.json({ message: 'Follow up record deleted successfully' });
    } catch (err) {
        console.error('Delete follow up error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
