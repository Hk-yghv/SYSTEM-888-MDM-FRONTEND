import express from 'express';
import mongoose from 'mongoose';
import CashTransaction from '../models/CashTransaction.js';
import CashTransactionCounter from '../models/CashTransactionCounter.js';
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
    return normalized;
};

const getContractORParts = (subBrand, now = new Date()) => {
    const normalizedSubBrand = String(subBrand || '').trim();
    if (!normalizedSubBrand) return null;
    const year = now.getFullYear();
    return {
        year,
        subBrand: normalizedSubBrand,
        key: `${year}:${normalizedSubBrand.toLowerCase()}`,
        prefix: `${year}-${normalizedSubBrand}-`
    };
};

const getNextMemoryContractORSequence = ({ prefix }) => {
    const maxSequence = MEM_DB.cashTransactions.reduce((max, record) => {
        if (!record.contractOR?.startsWith(prefix)) return max;
        const sequence = Number(record.contractOR.slice(prefix.length));
        return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    return maxSequence + 1;
};

const getNextContractORPreview = async (parts) => {
    if (!isMongoConnected) return getNextMemoryContractORSequence(parts);

    const Counter = getWriteModel(CashTransactionCounter);
    if (!Counter) throw new Error('No database is available to generate Contract.OR.');
    const counter = await Counter.findOne({ key: parts.key }).select('sequence').lean();
    return (counter?.sequence || 0) + 1;
};

const reserveNextContractORSequence = async (parts) => {
    if (!isMongoConnected) return getNextMemoryContractORSequence(parts);

    const Counter = getWriteModel(CashTransactionCounter);
    if (!Counter) throw new Error('No database is available to generate Contract.OR.');
    const counter = await Counter.findOneAndUpdate(
        { key: parts.key },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return counter.sequence;
};

const advanceContractORSequence = async (parts, contractOR) => {
    if (!contractOR.startsWith(parts.prefix)) return;
    const sequence = Number(contractOR.slice(parts.prefix.length));
    if (!Number.isSafeInteger(sequence) || sequence < 1) return;
    if (!isMongoConnected) return;

    const Counter = getWriteModel(CashTransactionCounter);
    if (!Counter) throw new Error('No database is available to update Contract.OR sequence.');
    await Counter.findOneAndUpdate(
        { key: parts.key },
        { $max: { sequence } },
        { upsert: true, setDefaultsOnInsert: true }
    );
};

const formatContractOR = (parts, sequence) => `${parts.prefix}${String(sequence).padStart(8, '0')}`;

const findContractORConflict = async (contractOR, excludeId = '') => {
    if (!contractOR) return null;
    if (!isMongoConnected) {
        return MEM_DB.cashTransactions.find(record =>
            record.contractOR === contractOR &&
            record._id !== excludeId &&
            record.transactionId !== excludeId
        ) || null;
    }

    const records = await queryAllDBs(CashTransaction, M => M.find({ contractOR }));
    return records.find(record =>
        String(record._id) !== excludeId &&
        record.transactionId !== excludeId
    ) || null;
};

router.get('/cash-transactions/contract-or/next', async (req, res) => {
    try {
        const parts = getContractORParts(req.query.subBrand);
        if (!parts) return res.status(400).json({ error: 'Subbrand is required to generate Contract.OR.' });
        const sequence = await getNextContractORPreview(parts);
        return res.json({ contractOR: formatContractOR(parts, sequence) });
    } catch (err) {
        console.error('Preview Contract.OR error:', err);
        return res.status(500).json({ error: err.message });
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
                        { performedBy: { $regex: search, $options: 'i' } },
                        { contractOR: { $regex: search, $options: 'i' } }
                    ];
                }
                if (startDate || endDate) {
                    f.date = {};
                    if (startDate) f.date.$gte = startDate;
                    if (endDate) f.date.$lte = endDate;
                }
                return M.find(f).sort({ createdAt: -1, _id: -1 });
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
                    (item.performedBy || '').toLowerCase().includes(s) ||
                    (item.contractOR || '').toLowerCase().includes(s)
                );
            }
            if (startDate) list = list.filter(item => item.date >= startDate);
            if (endDate) list = list.filter(item => item.date <= endDate);
            allRecords = list.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
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
        const { type, date, amount, currency, paymentMethod, category, description, photoUrl, photoUrls, performedBy, brand, subBrand } = req.body;
        const numAmount = Number(amount);
        if (!['cash_out', 'cash_in', 'penalty'].includes(type) || !Number.isFinite(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Type and Amount are required.' });
        }
        const contractORParts = getContractORParts(subBrand);
        if (!contractORParts) {
            return res.status(400).json({ error: 'Subbrand is required to generate Contract.OR.' });
        }

        const images = [...new Set([
            ...(Array.isArray(photoUrls) ? photoUrls : []),
            ...(photoUrl ? [photoUrl] : [])
        ].filter(Boolean))];
        const cur = currency === 'KHR' ? 'KHR' : 'USD';
        // 1 USD = 4000 KHR for unified reporting estimate
        const amountUSD = cur === 'KHR' ? (numAmount / 4000) : numAmount;
        const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const contractORSequence = await reserveNextContractORSequence(contractORParts);
        const contractOR = String(req.body.contractOR || formatContractOR(contractORParts, contractORSequence)).trim();
        const contractORConflict = await findContractORConflict(contractOR);
        if (contractORConflict) {
            return res.status(409).json({ error: 'This Contract.OR is already assigned to another transaction.' });
        }
        await advanceContractORSequence(contractORParts, contractOR);

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
            subBrand: contractORParts?.subBrand || '',
            contractOR,
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
        const { date, amount, currency, paymentMethod, category, description, photoUrl, photoUrls, performedBy, contractOR, subBrand } = req.body;
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
        if (Object.prototype.hasOwnProperty.call(req.body, 'contractOR')) {
            const normalizedContractOR = String(contractOR || '').trim();
            if (!normalizedContractOR) {
                return res.status(400).json({ error: 'Contract.OR is required.' });
            }
            const conflict = await findContractORConflict(normalizedContractOR, id);
            if (conflict) {
                return res.status(409).json({ error: 'This Contract.OR is already assigned to another transaction.' });
            }
            updateData.contractOR = normalizedContractOR;
            updateData.subBrand = String(subBrand || '').trim();
            const parts = getContractORParts(subBrand);
            if (parts && normalizedContractOR) await advanceContractORSequence(parts, normalizedContractOR);
        }

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
            const filter = {
                $or: [
                    { transactionId: id },
                    ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : [])
                ]
            };
            const deletedResults = await queryAllDBs(CashTransaction, async M => {
                const deleted = await M.findOneAndDelete(filter);
                return deleted ? [deleted] : [];
            });
            targetItem = deletedResults[0] || null;
        } else {
            targetItem = MEM_DB.cashTransactions.find(item => item.transactionId === id || item._id === id) || null;
            if (!targetItem) return res.status(404).json({ error: 'Transaction record not found.' });
            MEM_DB.cashTransactions = MEM_DB.cashTransactions.filter(item => item.transactionId !== id && item._id !== id);
        }

        if (!targetItem) return res.status(404).json({ error: 'Transaction record not found.' });

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
