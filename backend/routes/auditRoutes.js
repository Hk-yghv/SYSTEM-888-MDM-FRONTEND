import express from 'express';
import SystemAuditLog from '../models/SystemAuditLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

// GET /api/audit-logs - Query activity & audit logs with role and brand scoping
router.get('/', async (req, res) => {
    try {
        const {
            userBrand,
            userRole,
            username: requestingUser,
            isImmutable,
            brand,
            targetUser,
            category,
            level,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const isMasterAdmin = isImmutable === 'true' ||
            requestingUser === '@hakyonghouv' ||
            userRole === 'Administrator' ||
            userRole === 'Admin';

        const filter = {};

        // Scope access: Non-admin users can see their own activity logs
        if (!isMasterAdmin) {
            if (requestingUser) {
                const cleanUser = requestingUser.replace(/^@/, '');
                filter.username = new RegExp(`^@?${cleanUser}$`, 'i');
            }
        } else {
            // Master Admin filters
            if (brand) filter.brand = brand;
            if (targetUser) {
                const cleanTarget = targetUser.replace(/^@/, '');
                filter.username = new RegExp(`^@?${cleanTarget}$`, 'i');
            }
        }

        if (category && category !== 'All') filter.category = category;
        if (level && level !== 'All') filter.level = level;

        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.timestamp.$lte = end;
            }
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { description: regex },
                { username: regex },
                { eventId: regex },
                { action: regex },
                { path: regex },
                { ip: regex },
                { contractId: regex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        let logs = [];
        let total = 0;

        if (isMongoConnected) {
            const results = await queryAllDBs(SystemAuditLog, (M) =>
                M.find(filter).sort({ timestamp: -1 }).skip(skip).limit(take)
            );
            const countResults = await queryAllDBs(SystemAuditLog, (M) => M.countDocuments(filter));
            
            // Deduplicate across multi-DBs if needed
            const logMap = new Map();
            results.forEach(l => logMap.set(l._id ? l._id.toString() : l.eventId, l));
            logs = Array.from(logMap.values());
            total = Math.max(...countResults, logs.length);
        } else {
            const cleanReqUser = (requestingUser || '').replace(/^@/, '').toLowerCase();
            const cleanTargetUser = (targetUser || '').replace(/^@/, '').toLowerCase();

            const memLogs = (MEM_DB.systemAuditLogs || []).filter(item => {
                const itemCleanUser = (item.username || '').replace(/^@/, '').toLowerCase();
                if (!isMasterAdmin && cleanReqUser && itemCleanUser !== cleanReqUser) return false;
                if (isMasterAdmin && cleanTargetUser && itemCleanUser !== cleanTargetUser) return false;
                if (filter.brand && item.brand !== filter.brand) return false;
                if (filter.category && item.category !== filter.category) return false;
                if (filter.level && item.level !== filter.level) return false;
                if (search) {
                    const str = `${item.description} ${item.username} ${item.eventId} ${item.action} ${item.path} ${item.ip}`.toLowerCase();
                    if (!str.includes(search.toLowerCase())) return false;
                }
                return true;
            });
            total = memLogs.length;
            logs = memLogs.slice(skip, skip + take);
        }

        res.json({
            data: logs,
            total,
            page: parseInt(page),
            limit: take,
            totalPages: Math.ceil(total / take)
        });
    } catch (err) {
        console.error('Audit logs query error:', err.message);
        res.status(500).json({ error: err.message, data: [], total: 0 });
    }
});

// GET /api/audit-logs/customer/:identifier - Get customer/contract timeline history
router.get('/customer/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const filter = {
            $or: [
                { contractId: identifier },
                { customerId: identifier },
                { 'payload.contractId': identifier },
                { 'payload.serialNumber': identifier },
                { 'payload.imei1': identifier },
                { description: new RegExp(identifier, 'i') }
            ]
        };

        let logs = [];
        if (isMongoConnected) {
            logs = await queryAllDBs(SystemAuditLog, (M) => M.find(filter).sort({ timestamp: -1 }).limit(100));
        } else {
            logs = (MEM_DB.systemAuditLogs || []).filter(l =>
                l.contractId === identifier ||
                l.customerId === identifier ||
                (l.description && l.description.includes(identifier))
            ).slice(0, 100);
        }

        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/audit-logs/stats - Quick dashboard metrics for Windows Event Viewer
router.get('/stats', async (req, res) => {
    try {
        const { userBrand, userRole, username: requestingUser, isImmutable } = req.query;
        const isMasterAdmin = isImmutable === 'true' ||
            requestingUser === '@hakyonghouv' ||
            userRole === 'Administrator' ||
            userRole === 'Admin';

        const filter = {};
        if (!isMasterAdmin && requestingUser) {
            const cleanUser = requestingUser.replace(/^@/, '');
            filter.username = new RegExp(`^@?${cleanUser}$`, 'i');
        }

        let total = 0;
        let securityCount = 0;
        let errorCount = 0;
        let contractCount = 0;
        let navigationCount = 0;

        if (isMongoConnected) {
            const counts = await queryAllDBs(SystemAuditLog, async (M) => {
                const t = await M.countDocuments(filter);
                const s = await M.countDocuments({ ...filter, category: 'Security' });
                const e = await M.countDocuments({ ...filter, level: 'Error' });
                const c = await M.countDocuments({ ...filter, category: 'Contract' });
                const n = await M.countDocuments({ ...filter, category: 'Navigation' });
                return { t, s, e, c, n };
            });
            const first = counts[0] || { t: 0, s: 0, e: 0, c: 0, n: 0 };
            total = first.t;
            securityCount = first.s;
            errorCount = first.e;
            contractCount = first.c;
            navigationCount = first.n;
        } else {
            const mem = MEM_DB.systemAuditLogs || [];
            total = mem.length;
            securityCount = mem.filter(m => m.category === 'Security').length;
            errorCount = mem.filter(m => m.level === 'Error').length;
            contractCount = mem.filter(m => m.category === 'Contract').length;
            navigationCount = mem.filter(m => m.category === 'Navigation').length;
        }

        res.json({
            total,
            securityCount,
            errorCount,
            contractCount,
            navigationCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/audit-logs - Record user activity or page visit from frontend
router.post('/', async (req, res) => {
    try {
        const {
            category,
            level,
            action,
            taskCategory,
            description,
            username,
            name,
            role,
            brand,
            path,
            contractId,
            customerId,
            payload
        } = req.body;

        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        const deviceInfo = req.headers['user-agent'] || 'Windows Client';

        const entry = await recordSystemAudit({
            category: category || 'Navigation',
            level: level || 'Information',
            action: action || 'PAGE_VISIT',
            taskCategory: taskCategory || 'User Activity',
            description: description || `Visited ${path || 'system page'}`,
            username: username || req.user?.username || 'Anonymous',
            name: name || req.user?.name || '',
            role: role || req.user?.role || 'Staff',
            brand: brand || req.user?.brand || '',
            ip,
            deviceInfo,
            path: path || '',
            contractId: contractId || '',
            customerId: customerId || '',
            payload: payload || {}
        });

        res.status(201).json({ success: true, log: entry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
