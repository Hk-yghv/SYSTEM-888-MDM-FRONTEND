import express from 'express';
import mongoose from 'mongoose';
import CashTransaction from '../models/CashTransaction.js';
import CashTransactionCounter from '../models/CashTransactionCounter.js';
import ControlSystem from '../models/ControlSystem.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { dbInstances, queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';
import { resolveUserIsolation } from '../utils/brandIsolation.js';

const router = express.Router();

if (!MEM_DB.cashTransactions) {
    MEM_DB.cashTransactions = [];
}

const normalizeCashTransaction = (record, firstSubBrandsByBrand = {}) => {
    const normalized = record && typeof record.toObject === 'function' ? record.toObject() : { ...record };
    if (!String(normalized.subBrand || '').trim()) {
        normalized.subBrand = firstSubBrandsByBrand[normalized.brand]?.[0] || '';
    }
    const photoUrls = Array.isArray(normalized.photoUrls) ? normalized.photoUrls.filter(Boolean) : [];
    if (photoUrls.length === 0 && normalized.photoUrl) photoUrls.push(normalized.photoUrl);
    normalized.photoUrls = [...new Set(photoUrls)];
    normalized.photoUrl = normalized.photoUrls[0] || '';
    return normalized;
};

const getFirstSubBrandsByBrand = async () => {
    if (!isMongoConnected) {
        return MEM_DB.controlSystem?.brand_subbrands ||
            MEM_DB.controlSystems?.find(item => item.key === 'brand_subbrands' && !item.brand)?.value ||
            {};
    }

    const config = await queryAllDBs(ControlSystem, Model => Model.findOne({
        key: 'brand_subbrands',
        $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }]
    }).select('value').lean());
    const value = config?.value;
    return value instanceof Map ? Object.fromEntries(value) : value || {};
};

const backfillMissingSubBrands = async (records, firstSubBrandsByBrand) => {
    const updates = records
        .filter(record => !String(record.subBrand || '').trim())
        .map(record => ({
            id: record._id,
            subBrand: firstSubBrandsByBrand[record.brand]?.[0]
        }))
        .filter(update => update.id && update.subBrand);
    if (updates.length === 0) return;

    const operations = updates.map(({ id, subBrand }) => ({
        updateOne: {
            filter: {
                _id: id,
                $or: [{ subBrand: { $exists: false } }, { subBrand: null }, { subBrand: '' }]
            },
            update: { $set: { subBrand } }
        }
    }));

    await Promise.all(dbInstances
        .filter(instance => instance.status === 'connected' && instance.conn)
        .map(async instance => {
            let Model;
            try {
                Model = instance.conn.model(CashTransaction.modelName);
            } catch {
                Model = instance.conn.model(CashTransaction.modelName, CashTransaction.schema);
            }
            await Model.bulkWrite(operations, { ordered: false });
        }));

    updates.forEach(({ id, subBrand }) => {
        const memoryRecord = MEM_DB.cashTransactions.find(record => String(record._id) === String(id));
        if (memoryRecord && !String(memoryRecord.subBrand || '').trim()) {
            memoryRecord.subBrand = subBrand;
        }
    });
};

const queryCashTransactionsAcrossDBs = async (filter) => {
    const connectedInstances = dbInstances.filter(instance => instance.status === 'connected' && instance.conn);
    const results = await Promise.all(connectedInstances.map(async instance => {
        let Model;
        try {
            Model = instance.conn.model(CashTransaction.modelName);
        } catch {
            Model = instance.conn.model(CashTransaction.modelName, CashTransaction.schema);
        }
        return Model.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    }));

    const uniqueRecords = new Map();
    results.flat().forEach(record => {
        const key = String(record._id || record.transactionId);
        if (!uniqueRecords.has(key)) uniqueRecords.set(key, record);
    });

    return [...uniqueRecords.values()].sort((a, b) => {
        const dateDifference = new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
        return dateDifference || String(b._id).localeCompare(String(a._id));
    });
};

// 'cash_in' and 'penalty' share the same OR sequence so numbers are
// globally unique across both income-type transactions for a given subbrand.
const SHARED_INCOME_TYPES = new Set(['cash_in', 'penalty']);

const getContractORParts = (type, subBrand, now = new Date()) => {
    const normalizedSubBrand = String(subBrand || '').trim();
    if (!['cash_out', 'cash_in', 'penalty'].includes(type) || !normalizedSubBrand) return null;
    const year = now.getFullYear();
    // cash_in and penalty share the same counter namespace so their OR
    // numbers are consecutive across both pages.
    const counterNamespace = SHARED_INCOME_TYPES.has(type) ? 'income' : type;
    return {
        year,
        type,
        subBrand: normalizedSubBrand,
        key: `${year}:${counterNamespace}:${normalizedSubBrand.toLowerCase()}`,
        prefix: `${year}-${normalizedSubBrand}-`
    };
};

const getExistingContractORSequence = async ({ type, prefix }) => {
    // For shared-namespace types (cash_in / penalty) scan both types at once.
    const typesFilter = SHARED_INCOME_TYPES.has(type)
        ? { $in: [...SHARED_INCOME_TYPES] }
        : type;

    if (!isMongoConnected) {
        return MEM_DB.cashTransactions.reduce((max, record) => {
            const matchType = Array.isArray(typesFilter['$in'])
                ? typesFilter['$in'].includes(record.type)
                : record.type === typesFilter;
            if (!matchType || !record.contractOR?.startsWith(prefix)) return max;
            const sequence = Number(record.contractOR.slice(prefix.length));
            return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
        }, 0);
    }

    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const records = await queryAllDBs(CashTransaction, M =>
        M.find({ type: typesFilter, contractOR: { $regex: `^${escapedPrefix}` } }).select('contractOR').lean()
    );
    return records.reduce((max, record) => {
        const sequence = Number(record.contractOR.slice(prefix.length));
        return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
};

const getNextMemoryContractORSequence = async (parts) => {
    const maxSequence = await getExistingContractORSequence(parts);
    return maxSequence + 1;
};

const getNextContractORPreview = async (parts) => {
    if (!isMongoConnected) return getNextMemoryContractORSequence(parts);

    const Counter = getWriteModel(CashTransactionCounter);
    if (!Counter) throw new Error('No database is available to generate Contract.OR.');
    const [counter, existingSequence] = await Promise.all([
        Counter.findOne({ key: parts.key }).select('sequence').lean(),
        getExistingContractORSequence(parts)
    ]);
    return Math.max(counter?.sequence || 0, existingSequence) + 1;
};

const reserveNextContractORSequence = async (parts) => {
    if (!isMongoConnected) return getNextMemoryContractORSequence(parts);

    const Counter = getWriteModel(CashTransactionCounter);
    if (!Counter) throw new Error('No database is available to generate Contract.OR.');
    const existingSequence = await getExistingContractORSequence(parts);
    await Counter.findOneAndUpdate(
        { key: parts.key },
        { $max: { sequence: existingSequence } },
        { upsert: true, setDefaultsOnInsert: true }
    );
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

const findContractORConflict = async (contractOR, type, excludeId = '') => {
    // When checking shared-namespace types (cash_in / penalty), look for
    // conflicts across ALL types in the same namespace so the same OR number
    // cannot be issued twice regardless of which page created it.
    const sharedTypes = SHARED_INCOME_TYPES.has(type) ? [...SHARED_INCOME_TYPES] : null;
    if (!contractOR) return null;

    if (!isMongoConnected) {
        return MEM_DB.cashTransactions.find(record =>
            (!type || (sharedTypes ? sharedTypes.includes(record.type) : record.type === type)) &&
            record.contractOR === contractOR &&
            record._id !== excludeId &&
            record.transactionId !== excludeId
        ) || null;
    }

    const typeQuery = sharedTypes ? { $in: sharedTypes } : type;
    const filter = contractOR ? { contractOR, ...(typeQuery ? { type: typeQuery } : {}) } : {};
    const records = await queryAllDBs(CashTransaction, M => M.find(filter));
    return records.find(record =>
        String(record._id) !== excludeId &&
        record.transactionId !== excludeId
    ) || null;
};

router.get('/cash-transactions/contract-or/next', async (req, res) => {
    try {
        const parts = getContractORParts(req.query.type, req.query.subBrand);
        if (!parts) return res.status(400).json({ error: 'Transaction type and subbrand are required to generate Contract.OR.' });
        const sequence = await getNextContractORPreview(parts);
        return res.json({ contractOR: formatContractOR(parts, sequence) });
    } catch (err) {
        console.error('Preview Contract.OR error:', err);
        return res.status(500).json({ error: err.message });
    }
});

/*
 * Keep Contract.OR sequences isolated by transaction type. The printed OR
 * format remains unchanged, so separate transaction types may share a number.
 */

// GET /api/cash-transactions
router.get('/cash-transactions', async (req, res) => {
    try {
        const {
            type, // 'cash_out' | 'cash_in' | 'penalty'
            page = 1,
            limit = 10,
            search = '',
            startDate = '',
            endDate = ''
        } = req.query;

        const isolation = await resolveUserIsolation(req);
        const firstSubBrandsByBrand = await getFirstSubBrandsByBrand();
        const requestedBrand = isolation.isMasterAdmin
            ? String(req.query.brand || isolation.brand || '').trim()
            : isolation.brand;
        const requestedSubBrand = String(req.query.subBrand || '').trim();
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let filter = {};
        if (type) filter.type = type;
        if (requestedBrand) filter.brand = requestedBrand;

        const allowedSubBrands = requestedSubBrand && requestedSubBrand !== 'All'
            ? (isolation.isMasterAdmin || isolation.effectiveSubBrands.includes(requestedSubBrand)
                ? [requestedSubBrand]
                : ['__UNAUTHORIZED__'])
            : isolation.effectiveSubBrands;
        const missingSubBrandClauses = Object.entries(firstSubBrandsByBrand)
            .filter(([brand, subBrands]) => {
                const firstSubBrand = subBrands?.[0];
                if (!firstSubBrand || (requestedBrand && brand.toLowerCase() !== requestedBrand.toLowerCase())) return false;
                if (requestedSubBrand && requestedSubBrand !== 'All') {
                    return firstSubBrand.toLowerCase() === requestedSubBrand.toLowerCase() &&
                        (isolation.isMasterAdmin || allowedSubBrands.includes(firstSubBrand));
                }
                return allowedSubBrands.length === 0 || allowedSubBrands.some(
                    subBrand => subBrand.toLowerCase() === firstSubBrand.toLowerCase()
                );
            })
            .map(([brand]) => ({
                brand,
                $or: [
                    { subBrand: { $exists: false } },
                    { subBrand: null },
                    { subBrand: '' }
                ]
            }));

        if (allowedSubBrands.length > 0 || missingSubBrandClauses.length > 0) {
            const subBrandConditions = [];
            if (allowedSubBrands.length > 0) {
                subBrandConditions.push({ subBrand: { $in: allowedSubBrands } });
            }
            subBrandConditions.push(...missingSubBrandClauses);
            filter.$and = [{
                $or: subBrandConditions
            }];
        }

        let allRecords = [];
        if (isMongoConnected) {
            if (search) {
                filter.$or = [
                    { category: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { performedBy: { $regex: search, $options: 'i' } },
                    { contractOR: { $regex: search, $options: 'i' } }
                ];
            }
            if (startDate || endDate) {
                filter.date = {};
                if (startDate) filter.date.$gte = startDate;
                if (endDate) filter.date.$lte = endDate;
            }
            allRecords = await queryCashTransactionsAcrossDBs(filter);
        } else {
            let list = MEM_DB.cashTransactions;
            if (type) list = list.filter(item => item.type === type);
            if (requestedBrand) list = list.filter(item => item.brand === requestedBrand);
            list = list.filter(item => {
                const subBrand = String(
                    item.subBrand || firstSubBrandsByBrand[item.brand]?.[0] || ''
                ).trim();
                return allowedSubBrands.length === 0 || allowedSubBrands.some(
                    allowed => allowed.toLowerCase() === subBrand.toLowerCase()
                );
            });
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
            allRecords.forEach(record => {
                if (!String(record.subBrand || '').trim()) {
                    record.subBrand = firstSubBrandsByBrand[record.brand]?.[0] || '';
                }
            });
        }

        if (isMongoConnected) {
            await backfillMissingSubBrands(allRecords, firstSubBrandsByBrand);
        }
        const total = allRecords.length;
        const data = allRecords.slice(skip, skip + parseInt(limit))
            .map(record => normalizeCashTransaction(record, firstSubBrandsByBrand));

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
        const contractORParts = getContractORParts(type, subBrand);
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
        const contractORConflict = await findContractORConflict(contractOR, type);
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
        const { type, date, amount, currency, paymentMethod, category, description, photoUrl, photoUrls, performedBy, contractOR, subBrand } = req.body;
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
            const conflict = await findContractORConflict(normalizedContractOR, type, id);
            if (conflict) {
                return res.status(409).json({ error: 'This Contract.OR is already assigned to another transaction.' });
            }
            updateData.contractOR = normalizedContractOR;
            updateData.subBrand = String(subBrand || '').trim();
            const parts = getContractORParts(type, subBrand);
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
