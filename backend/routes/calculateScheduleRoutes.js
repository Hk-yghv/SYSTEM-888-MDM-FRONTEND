import express from 'express';
import CalculateSchedule from '../models/CalculateSchedule.js';
import ControlSystem from '../models/ControlSystem.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';
import { resolveUserIsolation, applyIsolationFilter, filterInMemoryRecords } from '../utils/brandIsolation.js';

const router = express.Router();

if (!MEM_DB.calculateSchedules) {
    MEM_DB.calculateSchedules = [];
}

const sseClients = new Set();
const migratedLegacyScheduleBrands = new Set();
const legacyScheduleMigrations = new Map();

const getFirstSubBrandForBrand = async (brand) => {
    let config = null;
    if (isMongoConnected) {
        const results = await queryAllDBs(ControlSystem, M => M.findOne({
            key: 'brand_subbrands',
            $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }]
        }).select('value'));
        config = Array.isArray(results) ? results.find(Boolean) : results;
    }

    const brandSubBrands = config?.value || MEM_DB.controlSystem?.brand_subbrands ||
        MEM_DB.controlSystems?.find(item => item.key === 'brand_subbrands' && !item.brand)?.value || {};
    let subBrands = brandSubBrands instanceof Map
        ? brandSubBrands.get(brand)
        : brandSubBrands[brand];
    if (typeof subBrands === 'string') subBrands = [subBrands];
    return Array.isArray(subBrands)
        ? subBrands.find(subBrand => typeof subBrand === 'string' && subBrand.trim())?.trim() || ''
        : '';
};

const backfillLegacySchedules = async (brand) => {
    if (!brand || migratedLegacyScheduleBrands.has(brand)) return;
    const pendingMigration = legacyScheduleMigrations.get(brand);
    if (pendingMigration) {
        await pendingMigration;
        return;
    }

    const migration = (async () => {
        const firstSubBrand = await getFirstSubBrandForBrand(brand);
        if (!firstSubBrand) return;

        if (isMongoConnected) {
            await queryAllDBs(CalculateSchedule, async M => {
                const unassignedFilter = {
                    brand: { $regex: new RegExp(`^${brand.trim()}$`, 'i') },
                    $or: [{ subBrand: { $exists: false } }, { subBrand: '' }, { subBrand: null }]
                };
                if (await M.exists(unassignedFilter)) {
                    await M.updateMany(unassignedFilter, { $set: { subBrand: firstSubBrand } });
                }
                return [];
            });
        }

        if (Array.isArray(MEM_DB.calculateSchedules)) {
            MEM_DB.calculateSchedules.forEach(record => {
                if (
                    String(record.brand || '').trim().toLowerCase() === brand.trim().toLowerCase() &&
                    !String(record.subBrand || '').trim()
                ) {
                    record.subBrand = firstSubBrand;
                }
            });
        }
        migratedLegacyScheduleBrands.add(brand);
    })();

    legacyScheduleMigrations.set(brand, migration);
    try {
        await migration;
    } finally {
        legacyScheduleMigrations.delete(brand);
    }
};

export const broadcastCalculateUpdate = (eventData) => {
    try {
        const payload = `data: ${JSON.stringify(eventData)}\n\n`;
        for (const client of sseClients) {
            try {
                client.res.write(payload);
            } catch (e) {
                sseClients.delete(client);
            }
        }
    } catch (err) {
        console.error('[broadcastCalculateUpdate] Error:', err);
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

        const { search = '' } = req.query;
        const isolation = await resolveUserIsolation(req);
        await backfillLegacySchedules(isolation.brand);

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
                // Enforce Brand and Sub-Brand isolation in MongoDB query
                applyIsolationFilter(query, isolation);
                return await M.find(query).sort({ createdAt: -1 }).lean();
            });
        } else {
            let list = filterInMemoryRecords([...MEM_DB.calculateSchedules], isolation);
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

        // Secondary safety in-memory filter
        if (!isolation.isMasterAdmin && records.length > 0) {
            records = filterInMemoryRecords(records, isolation);
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
        const isolation = await resolveUserIsolation(req);
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
            brand = isolation.brand || '',
            subBrand = req.body.subBrand || (isolation.allowedSubBrands[0] || ''),
            createdBy = isolation.username || '',
            notes = ''
        } = req.body;

        if (!startDate || principal <= 0) {
            return res.status(400).json({ success: false, error: 'Start date and principal amount are required.' });
        }

        const effectiveBrand = (!isolation.isMasterAdmin && isolation.brand) ? isolation.brand : brand;
        const effectiveSubBrand = !isolation.isMasterAdmin && isolation.allowedSubBrands.length > 0
            ? isolation.allowedSubBrands[0]
            : subBrand;

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
            brand: effectiveBrand,
            subBrand: effectiveSubBrand,
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
