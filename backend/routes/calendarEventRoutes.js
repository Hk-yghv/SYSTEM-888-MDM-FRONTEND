import express from 'express';
import jwt from 'jsonwebtoken';
import CalendarEvent from '../models/CalendarEvent.js';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();

if (!Array.isArray(MEM_DB.calendarEvents)) MEM_DB.calendarEvents = [];

const getRequestIdentity = async (req) => {
    let username = req.user?.username;
    if (!username) {
        const token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : '';
        if (!token) return null;
        try {
            username = jwt.verify(token, process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy').username;
        } catch {
            return null;
        }
    }
    if (!username) return null;
    const users = isMongoConnected
        ? await queryAllDBs(User, (Model) => Model.find({ username }).limit(1))
        : MEM_DB.users.filter((user) => user.username === username);
    const user = users[0];
    if (!user) return null;
    return {
        username: user.username,
        userBrand: String(user.brand || '').trim(),
        userRole: user.role || '',
        isImmutable: Boolean(user.isImmutable),
        permissions: user.permissions instanceof Map
            ? user.permissions.get('/calendar') || {}
            : user.permissions?.['/calendar'] || {}
    };
};

const isMasterAdmin = (identity) => (
    identity.username === '@hakyonghouv' ||
    identity.username === 'hakyonghouv' ||
    identity.isImmutable ||
    identity.userRole === 'Administrator' ||
    identity.userRole === 'Admin'
);

const hasCalendarPermission = (identity, action) => (
    isMasterAdmin(identity) || identity.permissions[action] === true
);

const serializeEvent = (event) => event?.toObject ? event.toObject() : { ...event };

const canManageEvent = (event, identity) => (
    event.visibility === 'private'
        ? event.createdBy === identity.username
        : isMasterAdmin(identity) || Boolean(identity.userBrand && event.brand === identity.userBrand)
);

const normalizeEventInput = (body) => ({
    date: String(body.date || '').trim(),
    title: String(body.title || '').trim(),
    note: String(body.note || '').trim(),
    type: ['event', 'holiday', 'note'].includes(body.type) ? body.type : 'event',
    visibility: body.visibility === 'private' ? 'private' : 'public'
});

const validateEvent = ({ date, title, note }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return 'A valid date is required.';
    }
    if (!title || title.length > 120) return 'Title is required and must be 120 characters or fewer.';
    if (note.length > 2000) return 'Note must be 2000 characters or fewer.';
    return '';
};

const findEvent = async (id) => {
    if (isMongoConnected) {
        const events = await queryAllDBs(CalendarEvent, (Model) => Model.find({ _id: id }).limit(1));
        return events[0] || null;
    }
    return MEM_DB.calendarEvents.find((event) => event._id === id) || null;
};

router.get('/', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasCalendarPermission(identity, 'read')) return res.status(403).json({ error: 'Calendar read permission required.' });
        const master = isMasterAdmin(identity);
        const { startDate = '', endDate = '', brand = '' } = req.query;
        const filter = {};

        if (master) {
            if (brand && brand !== 'ALL') filter.brand = brand;
            filter.$or = [
                { visibility: { $ne: 'private' } },
                { visibility: 'private', createdBy: identity.username }
            ];
        } else {
            filter.$or = [
                { brand: identity.userBrand || '', visibility: { $ne: 'private' } },
                { brand: '', visibility: { $ne: 'private' } },
                { brand: identity.userBrand || '', visibility: 'private', createdBy: identity.username },
                { brand: '', visibility: 'private', createdBy: identity.username }
            ];
        }
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        const events = isMongoConnected
            ? await queryAllDBs(CalendarEvent, (Model) => Model.find(filter).sort({ date: 1 }))
            : MEM_DB.calendarEvents.filter((event) => {
                const brandMatches = master
                    ? (!brand || brand === 'ALL' || event.brand === brand)
                    : event.brand === (identity.userBrand || '') || event.brand === '';
                const visibilityMatches = event.visibility !== 'private' || event.createdBy === identity.username;
                return brandMatches && visibilityMatches && (!startDate || event.date >= startDate) && (!endDate || event.date <= endDate);
            });

        res.json({ data: events.map(serializeEvent) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasCalendarPermission(identity, 'create')) return res.status(403).json({ error: 'Calendar create permission required.' });
        const input = normalizeEventInput(req.body);
        const validationError = validateEvent(input);
        if (validationError) return res.status(400).json({ error: validationError });

        const eventData = {
            ...input,
            brand: isMasterAdmin(identity) ? String(req.body.brand || '').trim() : identity.userBrand,
            createdBy: identity.username,
            updatedBy: identity.username
        };

        let event;
        if (isMongoConnected) {
            const EventWrite = getWriteModel(CalendarEvent) || CalendarEvent;
            event = await EventWrite.create(eventData);
        } else {
            event = { ...eventData, _id: `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date(), updatedAt: new Date() };
            MEM_DB.calendarEvents.push(event);
        }
        res.status(201).json({ data: serializeEvent(event) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasCalendarPermission(identity, 'edit')) return res.status(403).json({ error: 'Calendar edit permission required.' });
        const existing = await findEvent(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Calendar event not found.' });
        if (!canManageEvent(existing, identity)) return res.status(403).json({ error: 'You cannot edit this event.' });

        const input = normalizeEventInput(req.body);
        const validationError = validateEvent(input);
        if (validationError) return res.status(400).json({ error: validationError });

        let event;
        if (isMongoConnected) {
            const EventWrite = getWriteModel(CalendarEvent) || CalendarEvent;
            event = await EventWrite.findByIdAndUpdate(req.params.id, {
                ...input,
                ...(isMasterAdmin(identity) && req.body.brand !== undefined ? { brand: String(req.body.brand).trim() } : {}),
                updatedBy: identity.username
            }, { new: true, runValidators: true });
        } else {
            event = MEM_DB.calendarEvents.find((entry) => entry._id === req.params.id);
            Object.assign(event, input, { updatedBy: identity.username, updatedAt: new Date() });
            if (isMasterAdmin(identity) && req.body.brand !== undefined) event.brand = String(req.body.brand).trim();
        }
        res.json({ data: serializeEvent(event) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const identity = await getRequestIdentity(req);
        if (!identity) return res.status(401).json({ error: 'Authenticated user not found.' });
        if (!hasCalendarPermission(identity, 'delete')) return res.status(403).json({ error: 'Calendar delete permission required.' });
        const existing = await findEvent(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Calendar event not found.' });
        if (!canManageEvent(existing, identity)) return res.status(403).json({ error: 'You cannot delete this event.' });

        if (isMongoConnected) {
            const EventWrite = getWriteModel(CalendarEvent) || CalendarEvent;
            await EventWrite.findByIdAndDelete(req.params.id);
        } else {
            MEM_DB.calendarEvents = MEM_DB.calendarEvents.filter((event) => event._id !== req.params.id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;