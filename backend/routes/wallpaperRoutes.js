import express from 'express';
import Contract from '../models/Contract.js';
import WallpaperLog from '../models/WallpaperLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { resolveUserIsolation, applyIsolationFilter, filterInMemoryRecords } from '../utils/brandIsolation.js';

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
            subBrand: contract.subBrand || '',
            action: newStatus,
            performedBy: performedBy || 'SYSTEM',
            userName: userName || performedBy || 'SYSTEM',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `Wallpaper lock set to ${newStatus}`,
            wallpaperUrl: wallpaperUrl || ''
        };

        if (isMongoConnected) {
            const WallpaperLogWrite = getWriteModel(WallpaperLog) || WallpaperLog;
            const logDoc = new WallpaperLogWrite(logData);
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
        const { action, page = 1, limit = 10, search = '' } = req.query;
        const isolation = await resolveUserIsolation(req);
        const { isMasterAdmin, brand, effectiveSubBrands, hasSubBrandRestriction } = isolation;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const searchTerm = String(search).trim();
        const searchFields = [
            'logId', 'contractId', 'customerName', 'model', 'serialNumber',
            'action', 'performedBy', 'date', 'time', 'reason', 'brand', 'subBrand'
        ];
        let filter = {};
        if (action) filter.action = action;
        if (!isMasterAdmin && (brand || hasSubBrandRestriction)) {
            const contractQuery = {};
            if (brand) contractQuery.brand = brand;
            if (hasSubBrandRestriction && effectiveSubBrands.length > 0) {
                contractQuery.subBrand = { $in: effectiveSubBrands };
            }
            const matchedContracts = isMongoConnected
                ? await queryAllDBs(Contract, (M) => M.find(contractQuery).select('contractId'))
                : MEM_DB.contracts.filter(c => {
                    if (brand && c.brand !== brand) return false;
                    if (hasSubBrandRestriction && effectiveSubBrands.length > 0 && !effectiveSubBrands.includes(c.subBrand)) return false;
                    return true;
                });
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }
        if (searchTerm) {
            const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = searchFields.map(field => ({ [field]: { $regex: escapedSearch, $options: 'i' } }));
        }

        if (isMongoConnected) {
            const allLogs = await queryAllDBs(WallpaperLog, (M) => M.find(filter).sort({ createdAt: -1 }));
            const total = allLogs.length;
            const data = allLogs.slice(skip, skip + parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.wallpaperLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (!isMasterAdmin && (brand || hasSubBrandRestriction)) {
            const contractIds = MEM_DB.contracts.filter(c => {
                if (brand && c.brand !== brand) return false;
                if (hasSubBrandRestriction && effectiveSubBrands.length > 0 && !effectiveSubBrands.includes(c.subBrand)) return false;
                return true;
            }).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(log =>
                searchFields.some(field => String(log[field] ?? '').toLowerCase().includes(normalizedSearch))
            );
        }
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
