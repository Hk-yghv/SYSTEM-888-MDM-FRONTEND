import express from 'express';
import Contract from '../models/Contract.js';
import PhoneLog from '../models/PhoneLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

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

        let contract = isMongoConnected
            ? await Contract.findOne({ contractId })
            : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        contract.lockPhoneStatus = newStatus;
        if (isMongoConnected) await contract.save();

        const now = new Date();
        const resolvedDisplayText = (displayText && !displayText.includes('ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ')) ? displayText : '';

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
            const logDoc = new PhoneLog(logData);
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
        const { action, userBrand, userRole, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (action) filter.action = action;
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const total = await PhoneLog.countDocuments(filter);
            const data = await PhoneLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.phoneLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && userRole !== 'Administrator') {
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
        const { userBrand, userRole, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const total = await DeviceActionLog.countDocuments(filter);
            const data = await DeviceActionLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.deviceActionLogs || [];
        if (userBrand && userRole !== 'Administrator') {
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
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);
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
            const doc = new DeviceActionLog(actionLog);
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
