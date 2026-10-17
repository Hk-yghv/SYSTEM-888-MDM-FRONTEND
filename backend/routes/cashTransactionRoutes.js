import express from 'express';
import CashTransaction from '../models/CashTransaction.js';
import PenaltyStatus from '../models/PenaltyStatus.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.cashTransactions) {
    MEM_DB.cashTransactions = [];
}

const normalizeCashTransaction = (record) => {
    const normalized = record && typeof record.toObject === 'function' ? record.toObject() : { ...record };
    const photoUrls = Array.isArray(normalized.photoUrls) ? normalized.photoUrls.filter(Boolean) : [];
    if (photoUrls.length === 0 && normalized.photoUrl) photoUrls.push(normalized.photoUrl);
    normalized.photoUrls = [...new Set(photoUrls)];
    normalized.photoUrl = normalized.photoUrls[0] || '';
    normalized.descriptionHistory = Array.isArray(normalized.descriptionHistory) ? normalized.descriptionHistory : [];
    normalized.descriptionStatus = normalized.descriptionStatus || normalized.descriptionHistory.at(-1)?.status || '';
    return normalized;
};

const isMasterAdmin = (user) => (
    user?.username === '@hakyonghouv' ||
    user?.username === 'hakyonghouv' ||
    user?.isImmutable === true ||
    user?.role === 'SuperAdmin'
);

const getTransactionById = async (id) => {
    if (isMongoConnected) {
        const result = await queryAllDBs(CashTransaction, (M) =>
            M.findOne({ $or: [{ _id: id }, { transactionId: id }] })
        );
        return (Array.isArray(result) ? result.find(Boolean) : result) || null;
    }
    return MEM_DB.cashTransactions.find(item => item.transactionId === id || item._id === id) || null;
};

const saveDescriptionStatus = async (status, createdBy) => {
    if (isMongoConnected) {
        const Model = getWriteModel(PenaltyStatus);
        if (!Model) throw new Error('No database is available to save penalty statuses.');
        await Model.updateOne(
            { status: { $regex: `^${status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { $setOnInsert: { status, createdBy } },
            { upsert: true }
        );
        return;
    }

    const exists = MEM_DB.penaltyStatuses.some(item => item.status.toLowerCase() === status.toLowerCase());
    if (!exists) MEM_DB.penaltyStatuses.push({ status, createdBy, createdAt: new Date().toISOString() });
};

// GET /api/cash-transactions/penalty-statuses
router.get('/cash-transactions/penalty-statuses', async (req, res) => {
    try {
        const statuses = isMongoConnected
            ? await queryAllDBs(PenaltyStatus, M => M.find({}).sort({ status: 1 }))
            : MEM_DB.penaltyStatuses;
        res.json({ data: [...new Set(statuses.map(item => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b)) });
    } catch (err) {
        console.error('Fetch penalty statuses error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/cash-transactions/:id/description-history
router.post('/cash-transactions/:id/description-history', async (req, res) => {
    try {
        const status = typeof req.body.status === 'string' ? req.body.status.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        if (!status || !description) {
            return res.status(400).json({ error: 'Status and description are required.' });
        }

        const item = await getTransactionById(req.params.id);
        if (!item || item.type !== 'penalty') {
            return res.status(404).json({ error: 'Penalty record not found.' });
        }

        const createdBy = req.user?.name || req.user?.username || 'Admin';
        await saveDescriptionStatus(status, createdBy);
        const historyEntry = {
            ...(isMongoConnected ? {} : { _id: `history-${Date.now()}-${Math.random().toString(36).slice(2)}` }),
            status,
            description,
            createdAt: new Date(),
            createdBy
        };

        if (isMongoConnected) {
            const Model = getWriteModel(CashTransaction);
            if (!Model) throw new Error('No database is available to save the description.');
            const updated = await Model.findOneAndUpdate(
                { $or: [{ _id: req.params.id }, { transactionId: req.params.id }] },
                { $set: { descriptionStatus: status }, $push: { descriptionHistory: historyEntry } },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ error: 'Penalty record not found on the write database.' });
            return res.json({ success: true, data: normalizeCashTransaction(updated) });
        }

        const storedItem = MEM_DB.cashTransactions.find(record =>
            record.transactionId === req.params.id || record._id === req.params.id
        );
        if (!storedItem) return res.status(404).json({ error: 'Penalty record not found.' });
        storedItem.descriptionStatus = status;
        storedItem.descriptionHistory = [...(storedItem.descriptionHistory || []), historyEntry];
        return res.json({ success: true, data: normalizeCashTransaction(storedItem) });
    } catch (err) {
        console.error('Save penalty description error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/cash-transactions/:id/description-history/:entryId
router.put('/cash-transactions/:id/description-history/:entryId', async (req, res) => {
    try {
        if (!isMasterAdmin(req.user)) {
            return res.status(403).json({ error: 'Only the master administrator can edit description history.' });
        }

        const status = typeof req.body.status === 'string' ? req.body.status.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        if (!status || !description) {
            return res.status(400).json({ error: 'Status and description are required.' });
        }

        const item = await getTransactionById(req.params.id);
        if (!item || item.type !== 'penalty') {
            return res.status(404).json({ error: 'Penalty record not found.' });
        }

        const history = Array.isArray(item.descriptionHistory) ? item.descriptionHistory : [];
        const entryIndex = history.findIndex(entry => String(entry._id || entry.id) === req.params.entryId);
        if (entryIndex < 0) return res.status(404).json({ error: 'Description history entry not found.' });
        await saveDescriptionStatus(status, req.user?.username || 'Master Administrator');
        history[entryIndex].status = status;
        history[entryIndex].description = description;

        if (isMongoConnected) {
            const Model = getWriteModel(CashTransaction);
            if (!Model) throw new Error('No database is available to update the description.');
            const doc = await Model.findOne({ $or: [{ _id: req.params.id }, { transactionId: req.params.id }] });
            if (!doc) return res.status(404).json({ error: 'Penalty record not found on the write database.' });
            const entry = doc.descriptionHistory.id(req.params.entryId);
            if (!entry) return res.status(404).json({ error: 'Description history entry not found on the write database.' });
            entry.status = status;
            entry.description = description;
            if (doc.descriptionHistory.length - 1 === doc.descriptionHistory.indexOf(entry)) {
                doc.descriptionStatus = status;
            }
            await doc.save();
            return res.json({ success: true, data: normalizeCashTransaction(doc) });
        }

        if (entryIndex === history.length - 1) item.descriptionStatus = status;
        item.descriptionHistory = history;
        return res.json({ success: true, data: normalizeCashTransaction(item) });
    } catch (err) {
        console.error('Edit penalty description history error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cash-transactions
router.get('/cash-transactions', async (req, res) => {
    try {
        const {
            type, // 'cash_out' | 'cash_in' | 'penalty'
            userBrand = '',
            userRole = '',
            username = '',
            isImmutable = 'false',
            page = 1,
            limit = 10,
            search = '',
            startDate = '',
            endDate = ''
        } = req.query;

        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator');
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let filter = {};
        if (type) filter.type = type;
        if (userBrand && !isMasterAdmin) {
            filter.brand = userBrand;
        }

        let allRecords = [];
        if (isMongoConnected) {
            allRecords = await queryAllDBs(CashTransaction, (M) => {
                let f = { ...filter };
                if (search) {
                    f.$or = [
                        { category: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } },
                        { performedBy: { $regex: search, $options: 'i' } }
                    ];
                }
                if (startDate || endDate) {
                    f.date = {};
                    if (startDate) f.date.$gte = startDate;
                    if (endDate) f.date.$lte = endDate;
                }
                return M.find(f).sort({ date: -1, createdAt: -1 });
            });
        } else {
            let list = MEM_DB.cashTransactions;
            if (type) list = list.filter(item => item.type === type);
            if (userBrand && !isMasterAdmin) list = list.filter(item => item.brand === userBrand);
            if (search) {
                const s = search.toLowerCase();
                list = list.filter(item =>
                    (item.category || '').toLowerCase().includes(s) ||
                    (item.description || '').toLowerCase().includes(s) ||
                    (item.performedBy || '').toLowerCase().includes(s)
                );
            }
            if (startDate) list = list.filter(item => item.date >= startDate);
            if (endDate) list = list.filter(item => item.date <= endDate);
            allRecords = list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        }

        const total = allRecords.length;
        const data = allRecords.slice(skip, skip + parseInt(limit)).map(normalizeCashTransaction);

        // Aggregations for KPI
        let totalUSD = 0;
        let totalKHR = 0;
        let grandTotalUSD = 0;

        allRecords.forEach(r => {
            if (r.currency === 'KHR') {
                totalKHR += Number(r.amount) || 0;
            } else {
                totalUSD += Number(r.amount) || 0;
            }
            grandTotalUSD += Number(r.amountUSD) || 0;
        });

        res.json({
            data,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            kpi: {
                totalUSD,
                totalKHR,
                grandTotalUSD,
                count: total
            }
        });
    } catch (err) {
        console.error('Fetch cash transactions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/cash-transactions (Create)
router.post('/cash-transactions', async (req, res) => {
    try {
        const { type, date, amount, currency, paymentMethod, category, description, photoUrl, photoUrls, performedBy, brand } = req.body;
        const numAmount = Number(amount);
        if (!['cash_out', 'cash_in', 'penalty'].includes(type) || !Number.isFinite(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Type and Amount are required.' });
        }

        const images = [...new Set([
            ...(Array.isArray(photoUrls) ? photoUrls : []),
            ...(photoUrl ? [photoUrl] : [])
        ].filter(Boolean))];
        const cur = currency === 'KHR' ? 'KHR' : 'USD';
        // 1 USD = 4000 KHR for unified reporting estimate
        const amountUSD = cur === 'KHR' ? (numAmount / 4000) : numAmount;
        const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newDoc = {
            transactionId,
            type,
            date: date || new Date().toISOString().split('T')[0],
            amount: numAmount,
            currency: cur,
            paymentMethod: paymentMethod === 'Bank' ? 'Bank' : 'Cash',
            amountUSD,
            category: category || 'General',
            description: description || '',
            photoUrl: images[0] || '',
            photoUrls: images,
            performedBy: performedBy || 'Admin',
            brand: brand || 'SYSTEM',
            createdAt: new Date().toISOString()
        };

        if (isMongoConnected) {
            const Model = getWriteModel(CashTransaction);
            if (!Model) return res.status(503).json({ error: 'No database is available to save the transaction.' });
            const savedDoc = await Model.create(newDoc);
            return res.status(201).json({ success: true, data: savedDoc });
        } else {
            MEM_DB.cashTransactions.unshift(newDoc);
            return res.status(201).json({ success: true, data: newDoc });
        }
    } catch (err) {
        console.error('Create cash transaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/cash-transactions/:id (Update)
router.put('/cash-transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, amount, currency, paymentMethod, category, description, photoUrl, photoUrls, performedBy } = req.body;
        const numAmount = Number(amount) || 0;
        const cur = currency === 'KHR' ? 'KHR' : 'USD';
        const amountUSD = cur === 'KHR' ? (numAmount / 4000) : numAmount;
        const images = [...new Set([
            ...(Array.isArray(photoUrls) ? photoUrls : []),
            ...(photoUrl ? [photoUrl] : [])
        ].filter(Boolean))];

        const updateData = {
            date,
            amount: numAmount,
            currency: cur,
            paymentMethod: paymentMethod === 'Bank' ? 'Bank' : 'Cash',
            amountUSD,
            category,
            description,
            photoUrl: images[0] || '',
            photoUrls: images,
            performedBy
        };

        if (isMongoConnected) {
            const Model = getWriteModel(CashTransaction);
            const updated = await Model.findByIdAndUpdate(id, { $set: updateData }, { new: true });
            return res.json({ success: true, data: updated });
        } else {
            const idx = MEM_DB.cashTransactions.findIndex(item => item.transactionId === id || item._id === id);
            if (idx !== -1) {
                MEM_DB.cashTransactions[idx] = { ...MEM_DB.cashTransactions[idx], ...updateData };
                return res.json({ success: true, data: MEM_DB.cashTransactions[idx] });
            }
            return res.status(404).json({ error: 'Transaction record not found.' });
        }
    } catch (err) {
        console.error('Update cash transaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/cash-transactions/:id (Delete)
router.delete('/cash-transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let targetItem = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(CashTransaction, (M) => M.findOne({ $or: [{ _id: id }, { transactionId: id }] }));
            targetItem = results.find(r => r != null) || null;
            const Model = getWriteModel(CashTransaction);
            await Model.findByIdAndDelete(id);
        } else {
            targetItem = MEM_DB.cashTransactions.find(item => item.transactionId === id || item._id === id) || null;
            MEM_DB.cashTransactions = MEM_DB.cashTransactions.filter(item => item.transactionId !== id && item._id !== id);
        }

        // Record audit log
        recordSystemAudit({
            category: 'Financial',
            level: 'Warning',
            action: 'CASH_TRANSACTION_DELETE',
            taskCategory: 'Cash Flow',
            description: `Deleted cash transaction ${targetItem?.transactionId || id} (Type: ${targetItem?.type || 'N/A'}, Amount: $${targetItem?.amount || 0}, Note: ${targetItem?.note || '-'})`,
            username: req.user?.username || req.query?.username || 'Staff',
            brand: targetItem?.brand || '',
            payload: {
                deletedData: targetItem || { id }
            }
        }).catch(() => {});

        return res.json({ success: true, message: 'Record deleted successfully.' });
    } catch (err) {
        console.error('Delete cash transaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
