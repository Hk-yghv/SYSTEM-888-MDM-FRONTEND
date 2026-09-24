import express from 'express';
import CalculateSchedule from '../models/CalculateSchedule.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.calculateSchedules) {
    MEM_DB.calculateSchedules = [];
}

export const broadcastCalculateUpdate = (eventData) => {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of sseClients) {
        try {
            client.res.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
};

// GET /api/calculate-schedules/stream (SSE for Realtime Instant Updates)
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const client = { id: Date.now() + Math.random(), res };
    sseClients.add(client);

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    const keepAlive = setInterval(() => {
        try {
            res.write(': keep-alive\n\n');
        } catch (e) {
            clearInterval(keepAlive);
            sseClients.delete(client);
        }
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(client);
    });
});

// GET /api/calculate-schedules
router.get('/', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const { userBrand = '', userRole = '', username = '', isImmutable = 'false', search = '' } = req.query;
        const isMasterAdmin = (
            username === '@hakyonghouv' ||
            username === 'hakyonghouv' ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin' ||
            userRole === 'SuperAdmin' ||
            userRole === 'Manager'
        );

        let records = [];
        if (isMongoConnected) {
            records = await queryAllDBs(CalculateSchedule, async (M) => {
                let query = {};
                if (search && search.trim()) {
                    const s = search.trim();
                    query.$or = [
                        { customerName: { $regex: s, $options: 'i' } },
                        { contractNumber: { $regex: s, $options: 'i' } },
                        { assetName: { $regex: s, $options: 'i' } }
                    ];
                }
                return await M.find(query).sort({ createdAt: -1 }).lean();
            });
        } else {
            let list = [...MEM_DB.calculateSchedules];
            if (search && search.trim()) {
                const s = search.trim().toLowerCase();
                list = list.filter(item =>
                    (item.customerName && item.customerName.toLowerCase().includes(s)) ||
                    (item.contractNumber && item.contractNumber.toLowerCase().includes(s)) ||
                    (item.assetName && item.assetName.toLowerCase().includes(s))
                );
            }
            records = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        if (!Array.isArray(records)) {
            records = [];
        }

        // Branch filtering if applicable (case-insensitive, includes unbranded records)
        if (userBrand && !isMasterAdmin && records.length > 0) {
            const b = userBrand.trim().toLowerCase();
            records = records.filter(r => !r.brand || r.brand.trim().toLowerCase() === b || r.brand.trim() === '');
        }

        res.json({ success: true, count: records.length, data: records });
    } catch (err) {
        console.error('Error fetching calculate schedules:', err);
        res.status(500).json({ success: false, error: err.message, data: [] });
    }
});

// POST /api/calculate-schedules
router.post('/', async (req, res) => {
    try {
        const {
            contractNumber = '',
            customerName = '',
            assetName = '',
            assetType = '',
            startDate = '',
            principal = 0,
            ratePercent = 0,
            months = 1,
            monthlyInterest = 0,
            totalInterest = 0,
            schedule = [],
            brand = '',
            createdBy = '',
            notes = ''
        } = req.body;

        if (!startDate || principal <= 0) {
            return res.status(400).json({ success: false, error: 'Start date and principal amount are required.' });
        }

        const newDoc = {
            contractNumber,
            customerName,
            assetName,
            assetType,
            startDate,
            principal: Number(principal),
            ratePercent: Number(ratePercent),
            months: Number(months),
            monthlyInterest: Number(monthlyInterest),
            totalInterest: Number(totalInterest),
            schedule,
            brand,
            createdBy,
            notes,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        let resultDoc = null;
        if (isMongoConnected) {
            const Model = getWriteModel(CalculateSchedule);
            resultDoc = await Model.create(newDoc);
        } else {
            newDoc._id = 'calc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            MEM_DB.calculateSchedules.unshift(newDoc);
            resultDoc = newDoc;
        }

        // Broadcast realtime update to all connected clients immediately
        broadcastCalculateUpdate({ type: 'CREATED', data: resultDoc });

        return res.status(201).json({ success: true, message: 'Saved successfully', data: resultDoc });
    } catch (err) {
        console.error('Error creating calculate schedule:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/calculate-schedules/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let targetSchedule = null;

        if (isMongoConnected) {
            const results = await queryAllDBs(CalculateSchedule, (M) => M.findById(id));
            targetSchedule = results.find(r => r != null) || null;
            const Model = getWriteModel(CalculateSchedule);
            await Model.findByIdAndDelete(id);
        } else {
            targetSchedule = MEM_DB.calculateSchedules.find(item => String(item._id) === String(id)) || null;
            MEM_DB.calculateSchedules = MEM_DB.calculateSchedules.filter(item => String(item._id) !== String(id));
        }

        // Broadcast deletion event
        broadcastCalculateUpdate({ type: 'DELETED', id });

        // Record audit log
        recordSystemAudit({
            category: 'Financial',
            level: 'Warning',
            action: 'CALCULATE_SCHEDULE_DELETE',
            taskCategory: 'Calculate Schedule',
            description: `Deleted calculate schedule record ${targetSchedule?.customerName || id} (Phone: ${targetSchedule?.phone || 'N/A'}, Price: $${targetSchedule?.phonePrice || 0})`,
            username: req.user?.username || req.query?.username || 'Staff',
            brand: targetSchedule?.brand || '',
            payload: {
                deletedData: targetSchedule || { id }
            }
        }).catch(() => {});

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting calculate schedule:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
