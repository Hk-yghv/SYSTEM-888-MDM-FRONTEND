import express from 'express';
import CalculateSchedule from '../models/CalculateSchedule.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();

if (!MEM_DB.calculateSchedules) {
    MEM_DB.calculateSchedules = [];
}

let sseClients = new Set();

const broadcastUpdate = (eventData) => {
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
        const { userBrand = '', userRole = '', username = '', isImmutable = 'false', search = '' } = req.query;
        const isMasterAdmin = (username === '@hakyonghouv' || username === 'hakyonghouv' || isImmutable === 'true' || userRole === 'Administrator' || userRole === 'Admin');

        let filter = {};
        if (userBrand && !isMasterAdmin) {
            filter.brand = userBrand;
        }

        let records = [];
        if (isMongoConnected) {
            records = await queryAllDBs(CalculateSchedule, (M) => {
                let f = { ...filter };
                if (search) {
                    f.$or = [
                        { customerName: { $regex: search, $options: 'i' } },
                        { contractNumber: { $regex: search, $options: 'i' } },
                        { assetName: { $regex: search, $options: 'i' } }
                    ];
                }
                return M.find(f).sort({ createdAt: -1 });
            });
        } else {
            let list = [...MEM_DB.calculateSchedules];
            if (userBrand && !isMasterAdmin) {
                list = list.filter(item => item.brand === userBrand);
            }
            if (search) {
                const s = search.toLowerCase();
                list = list.filter(item =>
                    (item.customerName && item.customerName.toLowerCase().includes(s)) ||
                    (item.contractNumber && item.contractNumber.toLowerCase().includes(s)) ||
                    (item.assetName && item.assetName.toLowerCase().includes(s))
                );
            }
            records = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        res.json({ success: true, count: records.length, data: records });
    } catch (err) {
        console.error('Error fetching calculate schedules:', err);
        res.status(500).json({ success: false, error: err.message });
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
        broadcastUpdate({ type: 'CREATED', data: resultDoc });

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
        if (isMongoConnected) {
            const Model = getWriteModel(CalculateSchedule);
            await Model.findByIdAndDelete(id);
        } else {
            MEM_DB.calculateSchedules = MEM_DB.calculateSchedules.filter(item => String(item._id) !== String(id));
        }

        // Broadcast deletion event
        broadcastUpdate({ type: 'DELETED', id });

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting calculate schedule:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
