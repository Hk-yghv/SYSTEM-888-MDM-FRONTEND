import express from 'express';
import CashTransaction from '../models/CashTransaction.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.cashTransactions) {
    MEM_DB.cashTransactions = [];
}

// GET /api/cash-transactions
router.get('/cash-transactions', async (req, res) => {
    try {
        const {
            type, // 'cash_out' | 'cash_in'
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
        const data = allRecords.slice(skip, skip + parseInt(limit));

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
        const { type, date, amount, currency, category, description, photoUrl, performedBy, brand } = req.body;
        if (!type || !amount) {
            return res.status(400).json({ error: 'Type and Amount are required.' });
        }

        const numAmount = Number(amount) || 0;
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
            amountUSD,
            category: category || 'General',
            description: description || '',
            photoUrl: photoUrl || '',
            performedBy: performedBy || 'Admin',
            brand: brand || 'SYSTEM',
            createdAt: new Date().toISOString()
        };

        if (isMongoConnected) {
            const Model = getWriteModel(CashTransaction, brand);
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
        const { date, amount, currency, category, description, photoUrl, performedBy } = req.body;
        const numAmount = Number(amount) || 0;
        const cur = currency === 'KHR' ? 'KHR' : 'USD';
        const amountUSD = cur === 'KHR' ? (numAmount / 4000) : numAmount;

        const updateData = {
            date,
            amount: numAmount,
            currency: cur,
            amountUSD,
            category,
            description,
            photoUrl,
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
