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
        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin'
        );

        let filter = {};
        if (isMasterAdmin) {
            if (brand && brand !== 'ALL' && brand !== 'All') {
                filter.brand = { $in: [brand, new RegExp(`^${brand.trim()}$`, 'i')] };
            }
        } else {
            if (userBrand && userBrand !== 'ALL' && userBrand !== 'All') {
                filter.brand = { $in: [userBrand, '', null, new RegExp(`^${userBrand.trim()}$`, 'i')] };
            }
        }

        if (date) {
            const cleanDate = date.trim();
            filter.date = { $regex: new RegExp(`^${cleanDate}`) };
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        const isSuccessStatus = (st) => {
            const s = (st || '').trim().toLowerCase();
            return s === 'ជោគជ័យ' || s === 'success';
        };
        const isFailedStatus = (st) => {
            const s = (st || '').trim().toLowerCase();
            return s === 'បរាជ័យ' || s === 'failed';
        };
        const isReviewStatus = (st) => {
            const s = (st || '').trim().toLowerCase();
            return s === 'review' || s === 'ពិនិត្យ' || s === 'កំពុងពិនិត្យ' || s === 'រង់ចាំពិនិត្យ' || s === 'in review' || s === 'pending review';
        };

        if (status) {
            const sTrim = status.trim().toLowerCase();
            if (isReviewStatus(sTrim)) {
                filter.status = { $in: ['Review', 'review', 'ពិនិត្យ', 'កំពុងពិនិត្យ', 'រង់ចាំពិនិត្យ', 'In Review', 'Pending Review'] };
            } else if (isSuccessStatus(sTrim)) {
                filter.status = { $in: ['ជោគជ័យ', 'Success', 'success'] };
            } else if (isFailedStatus(sTrim)) {
                filter.status = { $in: ['បរាជ័យ', 'Failed', 'failed'] };
            } else {
                filter.status = status;
            }
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { customerName: regex },
                { source: regex },
                { phone: regex },
                { collateralType: regex },
                { model: regex },
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
                if (filter.brand) {
                    if (Array.isArray(filter.brand.$in)) {
                        if (!filter.brand.$in.includes(item.brand) && item.brand) return false;
                    } else if (item.brand !== filter.brand) {
                        return false;
                    }
                }
                if (date && !item.date?.startsWith(date) && item.date !== date) return false;
                if (startDate && item.date < startDate) return false;
                if (endDate && item.date > endDate) return false;
                if (status) {
                    if (isReviewStatus(status)) {
                        if (!isReviewStatus(item.status)) return false;
                    } else if (isSuccessStatus(status)) {
                        if (!isSuccessStatus(item.status)) return false;
                    } else if (isFailedStatus(status)) {
                        if (!isFailedStatus(item.status)) return false;
                    } else if (item.status !== status) {
                        return false;
                    }
                }
                if (search) {
                    const s = search.toLowerCase();
                    const combined = `${item.customerName} ${item.source} ${item.phone} ${item.collateralType} ${item.model || ''} ${item.responder} ${item.valuationRange} ${item.reason} ${item.followUpId} ${item.brand} ${item.createdBy}`.toLowerCase();
                    if (!combined.includes(s)) return false;
                }
                return true;
            });
        }

        allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Calculate summary totals across all filtered items
        const totalRequestedAmount = allRecords.reduce((sum, r) => sum + (Number(r.requestedAmount) || 0), 0);
        const totalSuccess = allRecords.filter(r => isSuccessStatus(r.status)).length;
        const totalFailed = allRecords.filter(r => isFailedStatus(r.status)).length;
        const totalReview = allRecords.filter(r => isReviewStatus(r.status)).length;
        const totalRecords = allRecords.length;
        const successRate = totalRecords > 0 ? ((totalSuccess / totalRecords) * 100).toFixed(1) : 0;

        const summary = {
            totalRequestedAmount,
            totalSuccess,
            totalFailed,
            totalReview,
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
            model = '',
            responder = '',
            date = new Date().toISOString().split('T')[0],
            valuationRange = '',
            status = 'ជោគជ័យ',
            reason = '',
            images = [],
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
            model: model || '',
            responder: responder || '',
            date,
            valuationRange: valuationRange || '',
            status: status || 'ជោគជ័យ',
            reason: reason || '',
            images: Array.isArray(images) ? images : (images ? [images] : []),
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

// GET single follow up 2 record by _id or followUpId
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let record = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp2, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            record = results[0] || null;
        } else {
            record = MEM_DB.followUps2.find(f => f._id === id || f.followUpId === id) || null;
        }
        if (!record) return res.status(404).json({ error: 'Follow up 2 record not found' });
        res.json(record);
    } catch (err) {
        console.error('Get follow up 2 by id error:', err);
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

        // Fetch previous record for diff
        let existing = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp2, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            existing = results[0] || null;
        } else {
            existing = MEM_DB.followUps2.find(f => f._id === id || f.followUpId === id);
        }

        const prevObj = existing ? (existing.toObject ? existing.toObject() : { ...existing }) : {};
        const changedFields = [];
        const diff = {};
        for (const key in updateData) {
            if (key === 'username' || key === 'lastModifiedBy') continue;
            const oldVal = prevObj[key];
            const newVal = updateData[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changedFields.push(key);
                diff[key] = { old: oldVal !== undefined ? oldVal : '', new: newVal !== undefined ? newVal : '' };
            }
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
            const diffSummary = changedFields.map(f => `${f}: "${diff[f]?.old}" ➔ "${diff[f]?.new}"`).join(', ');
            recordSystemAudit({
                category: 'Contract',
                level: 'Information',
                action: 'FOLLOW_UP_2_UPDATE',
                taskCategory: 'Follow Up 2',
                description: `Updated Follow-Up 2 record ${updated.followUpId || id} (${updated.customerName}): ${diffSummary || 'General Update'}`,
                username: req.body.username || req.body.createdBy || 'Staff',
                brand: updated.brand || '',
                payload: { diff, changedFields, previousData: prevObj, updatedData: updateData }
            }).catch(() => {});

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
        const username = req.query.username || 'Staff';

        let deletedItem = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(FollowUp2, (M) => M.findOne({ $or: [{ _id: id }, { followUpId: id }] }));
            deletedItem = results[0] || null;
            await queryAllDBs(FollowUp2, async (BoundM) => {
                try { await BoundM.findByIdAndDelete(id); } catch {}
                try { await BoundM.deleteMany({ followUpId: id }); } catch {}
                return [];
            });
        } else {
            deletedItem = MEM_DB.followUps2.find(f => f._id === id || f.followUpId === id);
        }

        MEM_DB.followUps2 = MEM_DB.followUps2.filter(f => f._id !== id && f.followUpId !== id);

        recordSystemAudit({
            category: 'Contract',
            level: 'Warning',
            action: 'FOLLOW_UP_2_DELETE',
            taskCategory: 'Follow Up 2',
            description: `Deleted Follow-Up 2 record ${deletedItem?.followUpId || id} (${deletedItem?.customerName || 'N/A'}, Phone: ${deletedItem?.phone || '-'})`,
            username,
            brand: deletedItem?.brand || '',
            payload: deletedItem || { id }
        }).catch(() => {});

        res.json({ message: 'Follow up 2 record deleted successfully' });
    } catch (err) {
        console.error('Delete follow up 2 error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
