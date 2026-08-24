import express from 'express';
import Contract from '../models/Contract.js';
import PhoneLog from '../models/PhoneLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();

// Toggle Phone Lock
router.post('/lostphone/toggle-lock', async (req, res) => {
    try {
        const {
            contractId,
            newStatus,
            performedBy,
            reason,
            displayText,
            phoneNumber,
            userName
        } = req.body;

        let contract = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) => M.find({ contractId }));
            contract = results[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === contractId);
        }

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        contract.lockPhoneStatus = newStatus;
        if (isMongoConnected) await contract.save();

        const now = new Date();
        const resolvedDisplayText = displayText || '';

        const logData = {
            logId: `LOG-${Date.now()}`,
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',
            action: newStatus,
            performedBy: performedBy || 'SYSTEM',
            userName: userName || performedBy || 'SYSTEM',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `Device set to ${newStatus}`,
            displayText: resolvedDisplayText,
            phoneNumber: phoneNumber || ''
        };

        if (isMongoConnected) {
            const PhoneLogWrite = getWriteModel(PhoneLog) || PhoneLog;
            const logDoc = new PhoneLogWrite(logData);
            await logDoc.save();
        }

        MEM_DB.phoneLogs.unshift(logData);

        res.json({
            success: true,
            newStatus: contract.lockPhoneStatus,
            contract,
            log: logData
        });
    } catch (err) {
        console.error('Toggle phone lock error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Phone Logs
router.get('/phonelogs', async (req, res) => {
    try {
        const { action, userBrand, userRole, username, isImmutable, page = 1, limit = 10 } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true');
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (action) filter.action = action;
        if (userBrand && !isMasterAdmin) {
            const matchedContracts = isMongoConnected
                ? await queryAllDBs(Contract, (M) => M.find({ brand: userBrand }).select('contractId'))
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const allLogs = await queryAllDBs(PhoneLog, (M) => M.find(filter).sort({ createdAt: -1 }));
            const total = allLogs.length;
            const data = allLogs.slice(skip, skip + parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.phoneLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && !isMasterAdmin) {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Device Action History
router.get('/history/device-actions', async (req, res) => {
    try {
        const { userBrand, userRole, username, isImmutable, page = 1, limit = 10 } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true');
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (userBrand && !isMasterAdmin) {
            const matchedContracts = isMongoConnected
                ? await queryAllDBs(Contract, (M) => M.find({ brand: userBrand }).select('contractId'))
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const allLogs = await queryAllDBs(DeviceActionLog, (M) => M.find(filter).sort({ createdAt: -1 }));
            const total = allLogs.length;
            const data = allLogs.slice(skip, skip + parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.deviceActionLogs || [];
        if (userBrand && !isMasterAdmin) {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Device Action History
router.post('/history/device-actions', async (req, res) => {
    try {
        const { contractId, actionType, performedBy, reason } = req.body;
        let contract = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(Contract, (M) => M.find({ contractId }));
            contract = results[0] || null;
        } else {
            contract = MEM_DB.contracts.find(c => c.contractId === contractId);
        }
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        const now = new Date();
        const actionLog = {
            actionId: 'ACT-' + Date.now(),
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',
            actionType,
            status: 'Success',
            performedBy: performedBy || 'Administrator',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `${actionType} action executed successfully`
        };

        if (isMongoConnected) {
            const DeviceActionLogWrite = getWriteModel(DeviceActionLog) || DeviceActionLog;
            const doc = new DeviceActionLogWrite(actionLog);
            await doc.save();
        }

        if (!MEM_DB.deviceActionLogs) MEM_DB.deviceActionLogs = [];
        MEM_DB.deviceActionLogs.unshift(actionLog);

        res.status(201).json(actionLog);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
