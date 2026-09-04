import express from 'express';
import FollowUp2 from '../models/FollowUp2.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!Array.isArray(MEM_DB.followUps2)) {
    MEM_DB.followUps2 = [];
}

// GET all follow up 2 records
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
                { source: regex },
                { phone: regex },
                { collateralType: regex },
                { responder: regex },
                { valuationRange: regex },
                { reason: regex },
                { followUpId: regex },
                { brand: regex },
                { createdBy: regex }
            ];
        }

        let allRecords = [];
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp2, (M) => M.find(filter).sort({ date: -1, createdAt: -1 }));
            const seenIds = new Set();
            results.forEach(r => {
                const id = r._id?.toString() || r.followUpId;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    allRecords.push(r);
                }
            });
        } else {
            allRecords = MEM_DB.followUps2.filter(item => {
                if (filter.brand && item.brand !== filter.brand) return false;
                if (date && item.date !== date) return false;
                if (startDate && item.date < startDate) return false;
                if (endDate && item.date > endDate) return false;
                if (status && item.status !== status) return false;
                if (search) {
                    const s = search.toLowerCase();
                    const combined = `${item.customerName} ${item.source} ${item.phone} ${item.collateralType} ${item.responder} ${item.valuationRange} ${item.reason} ${item.followUpId} ${item.brand} ${item.createdBy}`.toLowerCase();
                    if (!combined.includes(s)) return false;
                }
                return true;
            });
        }

        allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Calculate summary totals across all filtered items
        const totalRequestedAmount = allRecords.reduce((sum, r) => sum + (Number(r.requestedAmount) || 0), 0);
        const totalSuccess = allRecords.filter(r => r.status === 'ជោគជ័យ' || r.status === 'Success').length;
        const totalFailed = allRecords.filter(r => r.status === 'បរាជ័យ' || r.status === 'Failed').length;
        const totalRecords = allRecords.length;
        const successRate = totalRecords > 0 ? ((totalSuccess / totalRecords) * 100).toFixed(1) : 0;

        const summary = {
            totalRequestedAmount,
            totalSuccess,
            totalFailed,
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
        console.error('Fetch follow up 2 records error:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE follow up 2 record
router.post('/', async (req, res) => {
    try {
        const {
            customerName,
            source = 'Facebook',
            phone = '',
            requestedAmount = 0,
            collateralType = '',
            responder = '',
            date = new Date().toISOString().split('T')[0],
            valuationRange = '',
            status = 'ជោគជ័យ',
            reason = '',
            brand = '',
            notes = '',
            createdBy = 'Staff'
        } = req.body;

        if (!customerName) {
            return res.status(400).json({ error: 'Customer Name (ឈ្មោះអតិថិជន) is required' });
        }

        const currentYear = new Date().getFullYear();
        const autoId = `FU2-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newDoc = {
            followUpId: autoId,
            customerName,
            source: source || 'Facebook',
            phone: phone || '',
            requestedAmount: Number(requestedAmount) || 0,
            collateralType: collateralType || '',
            responder: responder || '',
            date,
            valuationRange: valuationRange || '',
            status: status || 'ជោគជ័យ',
            reason: reason || '',
            brand: brand || '',
            notes: notes || '',
            createdBy
        };

        let saved = newDoc;
        if (isMongoConnected) {
            const Model = getWriteModel(FollowUp2) || FollowUp2;
            const doc = new Model(newDoc);
            await doc.save();
            saved = doc.toObject();
        }

        MEM_DB.followUps2.unshift(saved);

        // Audit log
        recordSystemAudit({
            category: 'Contract',
            level: 'Information',
            action: 'FOLLOW_UP2_CREATE',
            taskCategory: 'Follow Up 2',
            description: `Created Follow Up 2 entry ${autoId} for ${customerName} (${phone}): Pawn Requested=$${requestedAmount}, Status=${status}`,
            username: createdBy,
            brand: brand || '',
            payload: newDoc
        }).catch(() => {});

        res.status(201).json(saved);
    } catch (err) {
        console.error('Create follow up 2 error:', err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE follow up 2 record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.__v;
        delete updateData.createdAt;

        if (updateData.requestedAmount !== undefined) {
            updateData.requestedAmount = Number(updateData.requestedAmount) || 0;
        }

        let updated = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp2, async (BoundM) => {
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
                const WriteModel = getWriteModel(FollowUp2) || FollowUp2;
                updated = await WriteModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }) ||
                          await WriteModel.findOneAndUpdate({ followUpId: id }, { $set: updateData }, { new: true });
            }
        }

        const idx = MEM_DB.followUps2.findIndex(f => f._id === id || f.followUpId === id);
        if (idx !== -1) {
            MEM_DB.followUps2[idx] = { ...MEM_DB.followUps2[idx], ...updateData };
            if (!updated) updated = MEM_DB.followUps2[idx];
        }

        if (updated) {
            return res.json(updated);
        }

        res.status(404).json({ error: 'Follow up 2 record not found' });
    } catch (err) {
        console.error('Update follow up 2 error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE follow up 2 record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            await queryAllDBs(FollowUp2, async (BoundM) => {
                try { await BoundM.findByIdAndDelete(id); } catch {}
                try { await BoundM.deleteMany({ followUpId: id }); } catch {}
                return [];
            });
        }

        MEM_DB.followUps2 = MEM_DB.followUps2.filter(f => f._id !== id && f.followUpId !== id);

        res.json({ message: 'Follow up 2 record deleted successfully' });
    } catch (err) {
        console.error('Delete follow up 2 error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
