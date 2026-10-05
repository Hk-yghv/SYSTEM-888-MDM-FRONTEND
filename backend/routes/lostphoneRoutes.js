import express from 'express';
import Contract from '../models/Contract.js';
import PhoneLog from '../models/PhoneLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import ControlSystem from '../models/ControlSystem.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { sendTelegramMessage } from '../services/telegramBotService.js';

const router = express.Router();

const getLockphoneTelegramChatIds = async (brand) => {
    if (!isMongoConnected) {
        const brandConfig = MEM_DB.controlSystems?.find((config) => config.brand === brand);
        const globalConfig = MEM_DB.controlSystem || MEM_DB.controlSystems?.find((config) => !config.brand);
        const configuredIds = brandConfig?.lockphone_telegram_chat_ids ?? globalConfig?.lockphone_telegram_chat_ids;
        return Array.isArray(configuredIds) ? configuredIds : [];
    }

    const configurations = await queryAllDBs(ControlSystem, (Model) => Model.find({
        key: 'lockphone_telegram_chat_ids',
        brand: { $in: brand ? [brand, ''] : [''] }
    }));
    const brandConfig = configurations.find((config) => config.brand === brand);
    const globalConfig = configurations.find((config) => !config.brand || config.brand === 'Global');
    const configuredIds = brandConfig?.value ?? globalConfig?.value;
    return Array.isArray(configuredIds) ? configuredIds : [];
};

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

        // Replace {{customerName}} template with actual customer name (Khmer + English)
        let resolvedDisplayText = displayText || '';
        const fullName = contract.customerNameKh
            ? (contract.customerNameEn ? `${contract.customerNameKh} (${contract.customerNameEn})` : contract.customerNameKh)
            : contract.customerNameEn || '';

        if (resolvedDisplayText.includes('{{customerName}}')) {
            resolvedDisplayText = resolvedDisplayText.replace(/\{\{customerName\}\}/g, fullName);
        }

        const logData = {
            logId: `LOG-${Date.now()}`,
            contractId: contract.contractId,
            customerName: fullName || contract.customerNameEn || '',
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

        let telegramNotifications = { attempted: 0, sent: 0, failed: [] };
        if (newStatus === 'Locked') {
            try {
                const configuredIds = await getLockphoneTelegramChatIds(contract.brand || '');
                const chatIds = [...new Set(configuredIds.map((chatId) => String(chatId).trim()).filter(Boolean))];
                telegramNotifications.attempted = chatIds.length;

                if (chatIds.length > 0) {
                    const brandName = contract.brand || '';
                    const hotlineNumber = phoneNumber || '';
                    const telegramText = `LostPhone\n${brandName}\nDescription : ${resolvedDisplayText}\nPhone number: ${hotlineNumber}`;
                    const inlineKeyboard = [];
                    if (resolvedDisplayText && resolvedDisplayText.length <= 256) {
                        inlineKeyboard.push([{
                            text: 'Copy Description',
                            copy_text: { text: resolvedDisplayText }
                        }]);
                    }
                    if (hotlineNumber && hotlineNumber.length <= 256) {
                        inlineKeyboard.push([{
                            text: 'Copy Phone Number',
                            copy_text: { text: hotlineNumber }
                        }]);
                    }
                    const telegramOptions = inlineKeyboard.length > 0
                        ? { reply_markup: { inline_keyboard: inlineKeyboard } }
                        : undefined;
                    const deliveryResults = await Promise.allSettled(chatIds.map(async (chatId) => {
                        if (!/^-?\d+$/.test(chatId)) {
                            throw new Error('Invalid Telegram account/chat ID');
                        }
                        await sendTelegramMessage(chatId, telegramText, telegramOptions);
                    }));
                    telegramNotifications.failed = deliveryResults.flatMap((result, index) =>
                        result.status === 'rejected'
                            ? [{ chatId: chatIds[index], error: result.reason?.message || 'Telegram delivery failed' }]
                            : []
                    );
                    telegramNotifications.sent = deliveryResults.length - telegramNotifications.failed.length;
                    if (telegramNotifications.failed.length > 0) {
                        console.error(`Lock phone Telegram delivery failed for ${telegramNotifications.failed.length} recipient(s).`);
                    }
                }
            } catch (notificationError) {
                console.error('Could not load Lock Phone Telegram configuration:', notificationError);
                telegramNotifications.error = 'Could not load Telegram notification settings';
            }
        }

        res.json({
            success: true,
            newStatus: contract.lockPhoneStatus,
            contract,
            log: logData,
            telegramNotifications
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

// Helper: Auto-cleanup any Rejected DeviceActionLog older than 7 days
const cleanupOldRejectedLogs = async () => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        if (isMongoConnected) {
            const DeviceActionLogWrite = getWriteModel(DeviceActionLog) || DeviceActionLog;
            await DeviceActionLogWrite.deleteMany({
                status: 'Rejected',
                $or: [
                    { createdAt: { $lt: sevenDaysAgo } },
                    { date: { $lt: sevenDaysAgoStr } }
                ]
            });
        }

        if (MEM_DB.deviceActionLogs && MEM_DB.deviceActionLogs.length > 0) {
            MEM_DB.deviceActionLogs = MEM_DB.deviceActionLogs.filter(l => {
                if (l.status !== 'Rejected') return true;
                const logTime = l.createdAt ? new Date(l.createdAt).getTime() : (l.date ? new Date(l.date).getTime() : 0);
                if (!logTime) return true;
                return (Date.now() - logTime) <= (7 * 24 * 60 * 60 * 1000);
            });
        }
    } catch (e) {
        console.error('Failed to cleanup old rejected logs:', e?.message || e);
    }
};

// GET Device Action History
router.get('/history/device-actions', async (req, res) => {
    try {
        // Auto purge old rejected alerts older than 7 days
        await cleanupOldRejectedLogs();

        const { userBrand, userRole, username, isImmutable, page = 1, limit = 10, status, actionType, search } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true');
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};

        if (userBrand && !isMasterAdmin) {
            const matchedContracts = isMongoConnected
                ? await queryAllDBs(Contract, (M) => M.find({ brand: userBrand }).select('contractId'))
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        // Apply status / actionType filters
        if (status) filter.status = status;
        if (actionType) filter.actionType = actionType;
        if (search) {
            filter.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { contractId: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const allLogs = await queryAllDBs(DeviceActionLog, (M) => M.find(filter).sort({ createdAt: -1 }));
            const total = allLogs.length;
            let actualSkip = skip;
            let actualPage = parseInt(page) || 1;
            if (actualSkip >= total && total > 0) {
                actualSkip = 0;
                actualPage = 1;
            }
            const data = allLogs.slice(actualSkip, actualSkip + parseInt(limit));
            return res.json({ data, total, page: actualPage, totalPages: Math.ceil(total / parseInt(limit)) });
        }

        // MEM_DB fallback with filters
        let filtered = MEM_DB.deviceActionLogs || [];
        if (userBrand && !isMasterAdmin) {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        if (status) filtered = filtered.filter(l => l.status === status);
        if (actionType) filtered = filtered.filter(l => l.actionType === actionType);
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(l =>
                (l.customerName && l.customerName.toLowerCase().includes(s)) ||
                (l.model && l.model.toLowerCase().includes(s)) ||
                (l.serialNumber && l.serialNumber.toLowerCase().includes(s)) ||
                (l.contractId && l.contractId.toLowerCase().includes(s))
            );
        }
        const total = filtered.length;
        let actualSkip = skip;
        let actualPage = parseInt(page) || 1;
        if (actualSkip >= total && total > 0) {
            actualSkip = 0;
            actualPage = 1;
        }
        const data = filtered.slice(actualSkip, actualSkip + parseInt(limit));
        res.json({ data, total, page: actualPage, totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Device Action History
router.post('/history/device-actions', async (req, res) => {
    try {
        const { contractId, actionType, performedBy, reason, status: reqStatus } = req.body;
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
            logId: 'ACT-' + Date.now(),
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',
            actionType,
            status: reqStatus || 'Pending',
            performedBy: performedBy || 'Administrator',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `${actionType} action requested`
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

// PUT Mark Device Action as Done (Success)
router.put('/history/device-actions/:id/done', async (req, res) => {
    try {
        const { id } = req.params;

        if (isMongoConnected) {
            const DeviceActionLogWrite = getWriteModel(DeviceActionLog) || DeviceActionLog;
            // Try by MongoDB _id first
            let updated = null;
            try {
                updated = await DeviceActionLogWrite.findByIdAndUpdate(id, { status: 'Success' }, { new: true });
            } catch (_) { /* not a valid ObjectId */ }
            // Fallback: try by logId field
            if (!updated) {
                updated = await DeviceActionLogWrite.findOneAndUpdate({ logId: id }, { status: 'Success' }, { new: true });
            }
            if (!updated) return res.status(404).json({ error: 'Device action log not found' });
            return res.json(updated);
        }

        // MEM_DB fallback
        if (!MEM_DB.deviceActionLogs) MEM_DB.deviceActionLogs = [];
        const idx = MEM_DB.deviceActionLogs.findIndex(l => l.logId === id || String(l._id) === id);
        if (idx === -1) return res.status(404).json({ error: 'Device action log not found' });
        MEM_DB.deviceActionLogs[idx].status = 'Success';
        res.json(MEM_DB.deviceActionLogs[idx]);
    } catch (err) {
        console.error('Mark device action done error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Mark Device Action as Rejected (បដិសេធ)
router.put('/history/device-actions/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};

        if (isMongoConnected) {
            const DeviceActionLogWrite = getWriteModel(DeviceActionLog) || DeviceActionLog;
            const updateFields = { status: 'Rejected' };
            if (reason) updateFields.reason = reason;

            let updated = null;
            try {
                updated = await DeviceActionLogWrite.findByIdAndUpdate(id, updateFields, { new: true });
            } catch (_) { /* not a valid ObjectId */ }
            if (!updated) {
                updated = await DeviceActionLogWrite.findOneAndUpdate({ logId: id }, updateFields, { new: true });
            }
            if (!updated) return res.status(404).json({ error: 'Device action log not found' });
            return res.json(updated);
        }

        // MEM_DB fallback
        if (!MEM_DB.deviceActionLogs) MEM_DB.deviceActionLogs = [];
        const idx = MEM_DB.deviceActionLogs.findIndex(l => l.logId === id || String(l._id) === id);
        if (idx === -1) return res.status(404).json({ error: 'Device action log not found' });
        MEM_DB.deviceActionLogs[idx].status = 'Rejected';
        if (reason) MEM_DB.deviceActionLogs[idx].reason = reason;
        res.json(MEM_DB.deviceActionLogs[idx]);
    } catch (err) {
        console.error('Reject device action error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
