import express from 'express';
import Contract from '../models/Contract.js';
import WallpaperLog from '../models/WallpaperLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

// Toggle Wallpaper Lock
router.post('/wallpaper/toggle-lock', async (req, res) => {
    try {
        const {
            contractId,
            newStatus,
            performedBy,
            reason,
            wallpaperUrl,
            userName
        } = req.body;

        let contract = isMongoConnected
            ? await Contract.findOne({ contractId })
            : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        contract.lockWallpaperStatus = newStatus;
        if (isMongoConnected) await contract.save();

        const now = new Date();
        const logData = {
            logId: `WLOG-${Date.now()}`,
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
            reason: reason || `Wallpaper lock set to ${newStatus}`,
            wallpaperUrl: wallpaperUrl || ''
        };

        if (isMongoConnected) {
            const logDoc = new WallpaperLog(logData);
            await logDoc.save();
        }

        MEM_DB.wallpaperLogs.unshift(logData);

        res.json({
            success: true,
            newStatus: contract.lockWallpaperStatus,
            contract,
            log: logData
        });
    } catch (err) {
        console.error('Toggle wallpaper lock error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET Wallpaper Logs
router.get('/wallpaperlogs', async (req, res) => {
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
            const total = await WallpaperLog.countDocuments(filter);
            const data = await WallpaperLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.wallpaperLogs;
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

export default router;
