import express from 'express';
import { TelegramAuditContact, TelegramAuditLog, TelegramAuditSubmission } from '../models/TelegramAudit.js';
import ControlSystem from '../models/ControlSystem.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel, dbInstances } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';
import { resolveUserIsolation, applyIsolationFilter, filterInMemoryRecords } from '../utils/brandIsolation.js';
import { backfillTelegramAuditSubBrand } from '../utils/telegramAuditSubBrand.js';

const router = express.Router();

if (!MEM_DB.telegramAuditContacts) MEM_DB.telegramAuditContacts = [];
if (!MEM_DB.telegramAuditLogs) MEM_DB.telegramAuditLogs = [];
if (!MEM_DB.telegramAuditSubmissions) MEM_DB.telegramAuditSubmissions = [];

const resolveSubBrand = async (brand, requestedSubBrand = '') => {
    const explicitSubBrand = String(requestedSubBrand || '').trim();
    if (explicitSubBrand) return explicitSubBrand;
    if (!brand) return '';

    let brandSubBrands = MEM_DB.controlSystem?.brand_subbrands || {};
    if (isMongoConnected) {
        const config = await queryAllDBs(ControlSystem, M =>
            M.findOne({
                key: 'brand_subbrands',
                $or: [{ brand: '' }, { brand: 'Global' }, { brand: { $exists: false } }, { brand: null }]
            }).lean()
        );
        const doc = Array.isArray(config) ? config.find(Boolean) : config;
        if (doc?.value) brandSubBrands = doc.value;
    }

    if (brandSubBrands instanceof Map) {
        brandSubBrands = Object.fromEntries(brandSubBrands);
    }
    const subBrands = brandSubBrands?.[brand];
    return Array.isArray(subBrands) ? String(subBrands[0] || '').trim() : '';
};

const getTodayDateStr = () => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Phnom_Penh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
};

const getCurrentAuditRound = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Phnom_Penh',
        hour: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date());
    const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
    return hour >= 12 ? 'PM' : 'AM';
};

const matchesAuditRound = (submission, round) =>
    submission.auditRound === round || (round === 'AM' && !submission.auditRound);

const formatAuditDateTime = (date = new Date()) => {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(:\d{2})?\s+(AM|PM)$/i.test(date.trim())) {
        return date.trim().replace(/ (am|pm)$/i, (m, p) => ' ' + p.toUpperCase());
    }
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
        const p = Object.fromEntries(
            new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Phnom_Penh',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).formatToParts(d).map(x => [x.type, x.value])
        );
        const ampm = (p.dayPeriod || (d.getHours() >= 12 ? 'PM' : 'AM')).toUpperCase();
        return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${ampm}`;
    } catch {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const strHours = String(hours).padStart(2, '0');
        return `${y}-${m}-${day} ${strHours}:${minutes}:${seconds} ${ampm}`;
    }
};

const resolveAuditDateTime = (item) => {
    if (!item) return '';
    if (item.createdAt) {
        return formatAuditDateTime(item.createdAt);
    }
    if (item.updatedAt) {
        return formatAuditDateTime(item.updatedAt);
    }
    if (item.auditDateTime) {
        return formatAuditDateTime(item.auditDateTime);
    }
    return '';
};

// ── Background Auto-Submit Worker (Runs every 30 seconds) ─────────
// At 23:59:00 -> 00:00:00 or whenever a day has passed, auto-submit past/unsubmitted days
const runAutoSubmitCheck = async () => {
    try {
        const todayStr = getTodayDateStr();
        if (isMongoConnected) {
            const SubmissionModel = getWriteModel(TelegramAuditSubmission);
            const LogModel = getWriteModel(TelegramAuditLog);

            // Find all dates with logs that are before today and not submitted
            const unsubmittedDates = await LogModel.distinct('auditDate', { auditDate: { $lt: todayStr } });
            for (const d of unsubmittedDates) {
                if (d && d < todayStr) {
                    for (const auditRound of ['AM', 'PM']) {
                        await SubmissionModel.findOneAndUpdate(
                            { auditDate: d, auditRound },
                            {
                                $set: {
                                    auditDate: d,
                                    auditRound,
                                    isSubmitted: true,
                                    submittedAt: new Date(),
                                    submittedBy: 'System Auto-Submit (Midnight 11:59PM)'
                                }
                            },
                            { upsert: true, new: true }
                        );
                    }
                }
            }
        } else {
            const unsubmittedDates = [
                ...new Set(
                    MEM_DB.telegramAuditLogs
                        .filter(l => l.auditDate < todayStr)
                        .map(l => l.auditDate)
                )
            ];
            for (const d of unsubmittedDates) {
                for (const auditRound of ['AM', 'PM']) {
                    let sub = MEM_DB.telegramAuditSubmissions.find(
                        s => s.auditDate === d && matchesAuditRound(s, auditRound)
                    );
                    if (sub) {
                        sub.auditRound = auditRound;
                        sub.isSubmitted = true;
                        sub.submittedAt = new Date();
                        sub.submittedBy = 'System Auto-Submit (Midnight 11:59PM)';
                    } else {
                        MEM_DB.telegramAuditSubmissions.push({
                            auditDate: d,
                            auditRound,
                            isSubmitted: true,
                            submittedAt: new Date(),
                            submittedBy: 'System Auto-Submit (Midnight 11:59PM)'
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[telegramAuditRoutes] Auto-submit error:', err);
    }
};

setInterval(runAutoSubmitCheck, 30000);

// ── GET /api/telegram-audit (Fetch Daily State) ────────────────────
router.get('/', async (req, res) => {
    try {
        const { date, brand = '' } = req.query;
        const targetDate = date ? String(date).trim() : getTodayDateStr();
        const todayStr = getTodayDateStr();
        const currentRound = getCurrentAuditRound();
        const isolation = await resolveUserIsolation(req);
        if (!isolation.isMasterAdmin && isolation.brand) {
            const firstSubBrand = await resolveSubBrand(isolation.brand);
            if (firstSubBrand) {
                await backfillTelegramAuditSubBrand(isolation.brand, firstSubBrand);
            }
        }
        const submissionFilter = { auditDate: targetDate };
        const contactFilter = {};
        const logScopeFilter = {};
        if (!isolation.isMasterAdmin) {
            applyIsolationFilter(contactFilter, isolation);
            applyIsolationFilter(logScopeFilter, isolation);
            applyIsolationFilter(submissionFilter, isolation);
        } else if (brand) {
            contactFilter.brand = brand;
            logScopeFilter.brand = brand;
            submissionFilter.brand = brand;
        }
        const auditFilter = { ...logScopeFilter, auditDate: targetDate };

        const auditedDatesRaw = isMongoConnected
            ? await queryAllDBs(TelegramAuditLog, M => M.distinct('auditDate', logScopeFilter))
            : filterInMemoryRecords(MEM_DB.telegramAuditLogs || [], isolation)
                .filter(log => !isolation.isMasterAdmin || !brand || log.brand === brand)
                .map(log => log.auditDate);
        const auditedDates = [...new Set((Array.isArray(auditedDatesRaw) ? auditedDatesRaw : [auditedDatesRaw])
            .filter(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort().reverse();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || targetDate > todayStr) {
            return res.status(400).json({ success: false, error: 'Invalid audit date or future audit dates are not allowed.' });
        }

        let isSubmitted = false;
        let submissionInfo = null;

        // Auto-lock past dates
        if (targetDate < todayStr) {
            isSubmitted = true;
            submissionInfo = {
                auditDate: targetDate,
                isSubmitted: true,
                submittedBy: 'System Auto-Submit (Past Date)',
                submittedAt: new Date()
            };
        }

        let contacts = [];
        let audits = [];
        let distinctStatuses = [];
        const latestAuditMap = {};

        if (isMongoConnected) {
            // Check submission state in DB if not already locked
            if (!isSubmitted) {
                // 1. Direct check on active write model
                try {
                    const WriteSubModel = getWriteModel(TelegramAuditSubmission);
                    if (WriteSubModel) {
                        const roundFilter = currentRound === 'AM'
                            ? { ...submissionFilter, $or: [{ auditRound: 'AM' }, { auditRound: { $exists: false } }] }
                            : { ...submissionFilter, auditRound: currentRound };
                        const direct = await WriteSubModel.findOne(roundFilter).lean();
                        if (direct && direct.isSubmitted) {
                            submissionInfo = direct;
                            isSubmitted = true;
                        }
                    }
                } catch (e) {
                    console.warn('[telegramAuditRoutes] write DB submission check error:', e.message);
                }

                // 2. Query across all DBs with find()
                if (!isSubmitted) {
                    try {
                        const roundFilter = currentRound === 'AM'
                            ? { ...submissionFilter, $or: [{ auditRound: 'AM' }, { auditRound: { $exists: false } }] }
                            : { ...submissionFilter, auditRound: currentRound };
                        const subResults = await queryAllDBs(TelegramAuditSubmission, (M) => M.find(roundFilter).lean());
                        const found = Array.isArray(subResults)
                            ? subResults.find(r => r && r.isSubmitted)
                            : (subResults && subResults.isSubmitted ? subResults : null);
                        if (found) {
                            submissionInfo = found;
                            isSubmitted = true;
                        }
                    } catch (e) {
                        console.warn('[telegramAuditRoutes] queryAllDBs submission check error:', e.message);
                    }
                }
            }

            // 3. Fallback check in memory
            if (!isSubmitted && Array.isArray(MEM_DB.telegramAuditSubmissions)) {
                const memFound = filterInMemoryRecords(
                    MEM_DB.telegramAuditSubmissions.filter(
                        s => s.auditDate === targetDate && matchesAuditRound(s, currentRound)
                    ),
                    isolation
                ).find(s => s.isSubmitted && (!isolation.isMasterAdmin || !brand || s.brand === brand));
                if (memFound) {
                    submissionInfo = memFound;
                    isSubmitted = true;
                }
            }

            // Fetch contacts respecting Brand & Sub-Brand isolation
            contacts = await queryAllDBs(TelegramAuditContact, (M) => M.find(contactFilter).lean());

            // Fetch logs for this targetDate respecting Brand & Sub-Brand isolation
            audits = await queryAllDBs(TelegramAuditLog, (M) => M.find(auditFilter).lean());

            // Get distinct statusAccount options from all past audits across all connected DBs
            const statusSet = new Set();
            for (const instance of dbInstances) {
                if (instance.status !== 'connected' || !instance.conn) continue;
                try {
                    let BoundModel;
                    try {
                        BoundModel = instance.conn.model('TelegramAuditLog');
                    } catch {
                        BoundModel = instance.conn.model('TelegramAuditLog', TelegramAuditLog.schema);
                    }
                    const list = await BoundModel.distinct('statusAccount', {
                        ...logScopeFilter,
                        statusAccount: { $exists: true, $nin: ['', null] }
                    });
                    const secondRoundStatuses = await BoundModel.distinct('statusAccount2', {
                        ...logScopeFilter,
                        statusAccount2: { $exists: true, $nin: ['', null] }
                    });
                    if (Array.isArray(list) && Array.isArray(secondRoundStatuses)) {
                        [...list, ...secondRoundStatuses].forEach(s => {
                            const trimmed = String(s || '').trim();
                            if (trimmed) statusSet.add(trimmed);
                        });
                    }
                } catch (e) {
                    console.warn('[telegramAuditRoutes] distinct status fetch error on', instance.name, e.message);
                }
            }
            distinctStatuses = Array.from(statusSet);

            // Compute latest audit for each contractId across all dates
            const latestLogs = await queryAllDBs(TelegramAuditLog, (M) =>
                M.aggregate([
                    {
                        $match: {
                            ...logScopeFilter,
                            $or: [
                                { statusAccount: { $exists: true, $nin: ['', null] } },
                                { statusAccount2: { $exists: true, $nin: ['', null] } }
                            ]
                        }
                    },
                    { $sort: { auditDate: -1, createdAt: -1 } },
                    {
                        $group: {
                            _id: '$contractId',
                            contractIid: { $first: '$contractIid' },
                            customerName: { $first: '$customerName' },
                            statusAccount: { $first: '$statusAccount' },
                            accountActivity: { $first: '$accountActivity' },
                            noteAudit: { $first: '$noteAudit' },
                            statusAccount2: { $first: '$statusAccount2' },
                            accountActivity2: { $first: '$accountActivity2' },
                            noteAudit2: { $first: '$noteAudit2' },
                            auditDate: { $first: '$auditDate' },
                            auditDateTime: { $first: '$auditDateTime' },
                            auditDate2: { $first: '$auditDate2' },
                            auditDateTime2: { $first: '$auditDateTime2' },
                            createdAt: { $first: '$createdAt' },
                            updatedAt: { $first: '$updatedAt' }
                        }
                    }
                ])
            );
            if (Array.isArray(latestLogs)) {
                for (const item of latestLogs) {
                    if (item._id) {
                        const resolvedDT = resolveAuditDateTime(item);
                        latestAuditMap[String(item._id)] = {
                            statusAccount: item.statusAccount || '',
                            accountActivity: item.accountActivity || '',
                            noteAudit: item.noteAudit || '',
                            statusAccount2: item.statusAccount2 || '',
                            accountActivity2: item.accountActivity2 || '',
                            noteAudit2: item.noteAudit2 || '',
                            auditDate: item.auditDate || '',
                            auditDateTime: resolvedDT || item.auditDateTime || '',
                            auditDate2: item.auditDate2 || '',
                            auditDateTime2: item.auditDateTime2 || ''
                        };
                    }
                }
            }
        } else {
            if (!isSubmitted) {
                submissionInfo = filterInMemoryRecords(
                    MEM_DB.telegramAuditSubmissions.filter(
                        s => s.auditDate === targetDate && matchesAuditRound(s, currentRound)
                    ),
                    isolation
                ).find(s => !isolation.isMasterAdmin || !brand || s.brand === brand) || null;
                if (submissionInfo && submissionInfo.isSubmitted) {
                    isSubmitted = true;
                }
            }

            contacts = filterInMemoryRecords(MEM_DB.telegramAuditContacts || [], isolation)
                .filter(c => isolation.isMasterAdmin && brand ? c.brand === brand : true);
            const scopedLogs = filterInMemoryRecords(MEM_DB.telegramAuditLogs || [], isolation)
                .filter(l => isolation.isMasterAdmin && brand ? l.brand === brand : true);
            audits = scopedLogs.filter(l => l.auditDate === targetDate);
            distinctStatuses = [
                ...new Set(
                    scopedLogs
                        .flatMap(l => [l.statusAccount, l.statusAccount2].map(value => String(value || '').trim()))
                        .filter(Boolean)
                )
            ];

            const sortedMem = [...scopedLogs]
                .filter(l => l.statusAccount || l.statusAccount2)
                .sort((a, b) => (b.auditDate || '').localeCompare(a.auditDate || ''));
            for (const l of sortedMem) {
                if (l.contractId && !latestAuditMap[String(l.contractId)]) {
                    const resolvedDT = resolveAuditDateTime(l);
                    latestAuditMap[String(l.contractId)] = {
                        statusAccount: l.statusAccount || '',
                        accountActivity: l.accountActivity || '',
                        noteAudit: l.noteAudit || '',
                        statusAccount2: l.statusAccount2 || '',
                        accountActivity2: l.accountActivity2 || '',
                        noteAudit2: l.noteAudit2 || '',
                        auditDate: l.auditDate || '',
                        auditDateTime: resolvedDT || l.auditDateTime || '',
                        auditDate2: l.auditDate2 || '',
                        auditDateTime2: l.auditDateTime2 || ''
                    };
                }
            }
        }

        // Map contacts by contractId, contractIid, and customerName for persistent O(1) lookup
        const contactMap = {};
        const contactByName = {};
        for (const c of contacts) {
            if (c.contractId) {
                contactMap[String(c.contractId)] = c;
            }
            if (c.contractIid) {
                contactMap[String(c.contractIid)] = c;
            }
            if (c.customerName) {
                const norm = String(c.customerName).trim().toLowerCase();
                contactByName[norm] = c;
            }
        }

        // Map audits by contractId
        const auditMap = {};
        for (const a of audits) {
            if (a.createdAt || a.updatedAt) {
                a.auditDateTime = resolveAuditDateTime(a);
            }
            if (a.contractId) {
                auditMap[String(a.contractId)] = a;
            }
        }

        res.json({
            success: true,
            date: targetDate,
            isSubmitted,
            submissionInfo,
            contactMap,
            contactByName,
            auditMap,
            latestAuditMap,
            distinctStatuses,
            currentRound,
            auditedDates
        });
    } catch (err) {
        console.error('Error in GET /telegram-audit:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/telegram-audit/contact (Save / Edit Customer Contact) ─
router.post('/contact', async (req, res) => {
    try {
        const {
            contractId,
            contractIid = '',
            customerName = '',
            contactName = '',
            username = '',
            phoneNumber = '',
            brand = '',
            subBrand = '',
            userRole = '',
            requesterUsername = '',
            isImmutable = false
        } = req.body;

        if (!contractId) {
            return res.status(400).json({ success: false, error: 'Contract ID is required.' });
        }

        const isMasterAdmin = (
            requesterUsername === '@hakyonghouv' ||
            requesterUsername === 'hakyonghouv' ||
            isImmutable === true ||
            isImmutable === 'true' ||
            userRole === 'Administrator' ||
            userRole === 'Admin' ||
            userRole === 'SuperAdmin'
        );

        const contactIdentity = {
            $or: [
                { contractId: String(contractId) },
                ...(contractIid ? [{ contractIid: String(contractIid) }] : []),
                ...(customerName ? [{ customerName: String(customerName) }] : [])
            ]
        };

        // Check if this contact already exists in database
        let existing = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(TelegramAuditContact, (M) =>
                M.findOne(contactIdentity).lean()
            );
            existing = Array.isArray(results)
                ? results.find(r => r != null) || null
                : results || null;
        } else {
            existing = (MEM_DB.telegramAuditContacts || []).find(c =>
                String(c.contractId) === String(contractId) ||
                (contractIid && String(c.contractIid) === String(contractIid)) ||
                (customerName && c.customerName === customerName)
            );
        }

        const alreadyHasInfo = Boolean(
            existing && (existing.contactName || existing.username || existing.phoneNumber)
        );

        // Rule: Once contact is added, it is locked. Only Admin ធំ (Super Admin) can edit it!
        if (alreadyHasInfo && !isMasterAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Contact នេះបានរក្សាទុករួចហើយ! មានតែ Admin ធំ (Super Admin) ទេទើបអាចកែប្រែបាន។'
            });
        }

        const trimmedContactName = String(contactName || '').trim();
        const trimmedUsername = String(username || '').trim();
        const trimmedPhone = String(phoneNumber || '').trim();
        const effectiveSubBrand = await resolveSubBrand(brand, subBrand);

        let savedContact = null;
        if (isMongoConnected) {
            const Model = getWriteModel(TelegramAuditContact);
            savedContact = await Model.findOneAndUpdate(
                contactIdentity,
                {
                    $set: {
                        contractId: String(contractId),
                        contractIid: String(contractIid || ''),
                        customerName: String(customerName || ''),
                        contactName: trimmedContactName,
                        username: trimmedUsername,
                        phoneNumber: trimmedPhone,
                        brand: String(brand || ''),
                        subBrand: effectiveSubBrand
                    }
                },
                { upsert: true, new: true }
            );

            // Also keep all records for this customerName synchronized
            if (customerName) {
                await Model.updateMany(
                    { customerName: String(customerName), contractId: { $ne: String(contractId) } },
                    {
                        $set: {
                            contactName: trimmedContactName,
                            username: trimmedUsername,
                            phoneNumber: trimmedPhone
                        }
                    }
                ).catch(() => {});
            }
        } else {
            let found = existing;
            if (found) {
                found.contactName = trimmedContactName;
                found.username = trimmedUsername;
                found.phoneNumber = trimmedPhone;
                found.contractIid = String(contractIid || '');
                found.customerName = String(customerName || '');
                found.brand = String(brand || '');
                found.subBrand = effectiveSubBrand;
                savedContact = found;
            } else {
                savedContact = {
                    _id: 'tc_' + Date.now(),
                    contractId: String(contractId),
                    contractIid: String(contractIid || ''),
                    customerName: String(customerName || ''),
                    contactName: trimmedContactName,
                    username: trimmedUsername,
                    phoneNumber: trimmedPhone,
                    brand: String(brand || ''),
                    subBrand: effectiveSubBrand,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                MEM_DB.telegramAuditContacts.push(savedContact);
            }

            if (customerName) {
                MEM_DB.telegramAuditContacts.forEach(c => {
                    if (c.customerName === customerName && String(c.contractId) !== String(contractId)) {
                        c.contactName = trimmedContactName;
                        c.username = trimmedUsername;
                        c.phoneNumber = trimmedPhone;
                    }
                });
            }
        }

        // Record audit trail
        recordSystemAudit({
            category: 'Audit',
            level: 'Info',
            action: alreadyHasInfo ? 'TELEGRAM_AUDIT_CONTACT_UPDATE' : 'TELEGRAM_AUDIT_CONTACT_ADD',
            taskCategory: 'Audit Telegram',
            description: `${alreadyHasInfo ? 'Edited' : 'Added'} Contact for ${customerName || contractId} (${trimmedUsername || trimmedPhone})`,
            username: requesterUsername || 'User',
            brand: brand || ''
        }).catch(() => {});

        res.json({
            success: true,
            message: alreadyHasInfo ? 'បានកែប្រែ Contact ដោយជោគជ័យ' : 'បានរក្សាទុក Contact ជាប់ជាអចិន្ត្រៃយ៍ដោយជោគជ័យ',
            data: savedContact
        });
    } catch (err) {
        console.error('Error saving telegram audit contact:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/telegram-audit/log (Save / Update Daily Audit) ───────
router.post('/log', async (req, res) => {
    try {
        const {
            contractId,
            contractIid = '',
            customerName = '',
            auditDate,
            statusAccount = '',
            accountActivity = '',
            noteAudit = '',
            auditedBy = 'Staff',
            brand = '',
            subBrand = ''
        } = req.body;

        if (!contractId || !auditDate) {
            return res.status(400).json({ success: false, error: 'Contract ID and Audit Date are required.' });
        }

        if (!String(statusAccount || '').trim()) {
            return res.status(400).json({ success: false, error: 'Status Account is required. សូមបំពេញ Status Account ជាមុនសិន!' });
        }

        const targetDate = String(auditDate).trim();
        const todayStr = getTodayDateStr();
        const auditRound = getCurrentAuditRound();
        const roundSubmissionFilter = auditRound === 'AM'
            ? {
                auditDate: targetDate,
                brand: String(brand || ''),
                $or: [{ auditRound: 'AM' }, { auditRound: { $exists: false } }]
            }
            : { auditDate: targetDate, auditRound, brand: String(brand || '') };

        // Check if day is locked/submitted
        if (targetDate < todayStr) {
            return res.status(400).json({
                success: false,
                error: 'ទិន្នន័យសម្រាប់ថ្ងៃកន្លងផុតទៅត្រូវបាន Auto-Submit រួចហើយ មិនអាចកែប្រែបានទៀតទេ!'
            });
        }
        if (targetDate > todayStr) {
            return res.status(400).json({ success: false, error: 'Future audit dates are not allowed.' });
        }

        let isAlreadySubmitted = false;
        if (isMongoConnected) {
            try {
                const SubModel = getWriteModel(TelegramAuditSubmission);
                if (SubModel) {
                    const existingSub = await SubModel.findOne(roundSubmissionFilter);
                    if (existingSub && existingSub.isSubmitted) {
                        isAlreadySubmitted = true;
                    }
                }
            } catch {}
            if (!isAlreadySubmitted) {
                try {
                    const subResults = await queryAllDBs(TelegramAuditSubmission, (M) => M.find(roundSubmissionFilter).lean());
                    if (Array.isArray(subResults) && subResults.some(r => r && r.isSubmitted)) {
                        isAlreadySubmitted = true;
                    }
                } catch {}
            }
        }
        if (!isAlreadySubmitted && Array.isArray(MEM_DB.telegramAuditSubmissions)) {
            const memSub = MEM_DB.telegramAuditSubmissions.find(
                s => s.auditDate === targetDate && matchesAuditRound(s, auditRound) &&
                    s.brand === String(brand || '') && s.isSubmitted
            );
            if (memSub) isAlreadySubmitted = true;
        }

        if (isAlreadySubmitted) {
            return res.status(400).json({
                success: false,
                error: 'ទិន្នន័យសម្រាប់ថ្ងៃនេះត្រូវបាន Submit និងចាក់សោររួចហើយ មិនអាចកែប្រែបានទៀតទេ!'
            });
        }

        const nowFormatted = formatAuditDateTime();
        const effectiveSubBrand = await resolveSubBrand(brand, subBrand);
        const roundFields = auditRound === 'PM'
            ? {
                statusAccount2: String(statusAccount || '').trim(),
                accountActivity2: String(accountActivity || '').trim(),
                noteAudit2: String(noteAudit || '').trim(),
                auditDate2: targetDate,
                auditDateTime2: nowFormatted
            }
            : {
                statusAccount: String(statusAccount || '').trim(),
                accountActivity: String(accountActivity || '').trim(),
                noteAudit: String(noteAudit || '').trim(),
                auditDateTime: nowFormatted
            };
        let savedLog = null;

        if (isMongoConnected) {
            const LogModel = getWriteModel(TelegramAuditLog);
            savedLog = await LogModel.findOneAndUpdate(
                { contractId: String(contractId), auditDate: targetDate },
                {
                    $set: {
                        contractId: String(contractId),
                        contractIid: String(contractIid || ''),
                        customerName: String(customerName || ''),
                        auditDate: targetDate,
                        ...roundFields,
                        auditedBy: String(auditedBy || 'Staff'),
                        brand: String(brand || ''),
                        subBrand: effectiveSubBrand
                    }
                },
                { upsert: true, new: true }
            );
            if (savedLog && savedLog.toObject) {
                savedLog = savedLog.toObject();
            }
            if (savedLog) {
                savedLog.auditDateTime = nowFormatted;
            }
        } else {
            let found = MEM_DB.telegramAuditLogs.find(
                l => String(l.contractId) === String(contractId) && l.auditDate === targetDate
            );
            if (found) {
                Object.assign(found, roundFields);
                found.auditedBy = String(auditedBy || 'Staff');
                found.contractIid = String(contractIid || '');
                found.customerName = String(customerName || '');
                found.brand = String(brand || '');
                found.subBrand = effectiveSubBrand;
                savedLog = found;
            } else {
                savedLog = {
                    _id: 'tl_' + Date.now(),
                    contractId: String(contractId),
                    contractIid: String(contractIid || ''),
                    customerName: String(customerName || ''),
                    auditDate: targetDate,
                    ...roundFields,
                    auditedBy: String(auditedBy || 'Staff'),
                    brand: String(brand || ''),
                    subBrand: effectiveSubBrand,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                MEM_DB.telegramAuditLogs.push(savedLog);
            }
        }

        // Record audit log silently
        recordSystemAudit({
            category: 'Audit',
            level: 'Info',
            action: 'TELEGRAM_AUDIT_LOG_SAVE',
            taskCategory: 'Audit Telegram',
            description: `Audited customer ${customerName || contractId} (Status: ${statusAccount || 'N/A'}) on ${targetDate}`,
            username: auditedBy,
            brand: brand || ''
        }).catch(() => {});

        res.json({ success: true, message: 'Audited successfully', data: savedLog, auditRound });
    } catch (err) {
        console.error('Error saving telegram audit log:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/telegram-audit/history/:contractId (Activity Log History) 
router.get('/history/:contractId', async (req, res) => {
    try {
        const { contractId } = req.params;
        if (!contractId) {
            return res.status(400).json({ success: false, error: 'Contract ID is required.' });
        }

        let history = [];
        if (isMongoConnected) {
            history = await queryAllDBs(TelegramAuditLog, (M) =>
                M.find({ contractId: String(contractId) }).sort({ auditDate: -1, createdAt: -1 }).lean()
            );
        } else {
            history = (MEM_DB.telegramAuditLogs || [])
                .filter(l => String(l.contractId) === String(contractId))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        // Remove duplicates if any from multiDB query
        const seen = new Set();
        const uniqueHistory = [];
        for (const h of history) {
            const dt = resolveAuditDateTime(h);
            if (dt) h.auditDateTime = dt;
            const key = `${h.contractId}_${h.auditDate}_${h.auditDateTime}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueHistory.push(h);
            }
        }

        res.json({ success: true, data: uniqueHistory });
    } catch (err) {
        console.error('Error fetching audit history:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/telegram-audit/report (Report Audit Telegram - last N days) ─
router.get('/report', async (req, res) => {
    try {
        const { days = 7, brand = '' } = req.query;
        const numDays = Math.max(1, Math.min(90, parseInt(days, 10) || 7));

        // Build last N dates (inclusive of today in Asia/Phnom_Penh)
        const todayStr = getTodayDateStr();
        const [todayY, todayM, todayD] = todayStr.split('-').map(Number);
        const dates = [];
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(todayY, todayM - 1, todayD - i));
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${day}`);
        }

        const startDate = dates[0];
        const endDate = dates[dates.length - 1];

        let logs = [];
        let submissions = [];

        if (isMongoConnected) {
            const query = { auditDate: { $gte: startDate, $lte: endDate } };
            logs = await queryAllDBs(TelegramAuditLog, (M) => M.find(query).lean());
            submissions = await queryAllDBs(TelegramAuditSubmission, (M) =>
                M.find({ auditDate: { $gte: startDate, $lte: endDate } }).lean()
            );
        } else {
            logs = (MEM_DB.telegramAuditLogs || []).filter(l => l.auditDate >= startDate && l.auditDate <= endDate);
            submissions = (MEM_DB.telegramAuditSubmissions || []).filter(s => s.auditDate >= startDate && s.auditDate <= endDate);
        }

        // Deduplicate logs from multiDB
        const seenLogs = new Set();
        const uniqueLogs = [];
        for (const log of logs) {
            const key = `${log.contractId}_${log.auditDate}`;
            if (!seenLogs.has(key)) {
                seenLogs.add(key);
                uniqueLogs.push(log);
            }
        }

        // Submission map by date
        const submissionMap = {};
        for (const s of submissions) {
            if (s.auditDate) submissionMap[s.auditDate] = s;
        }

        // Aggregate per date
        const reportByDate = {};
        for (const dateStr of dates) {
            reportByDate[dateStr] = {
                date: dateStr,
                isSubmitted: Boolean(submissionMap[dateStr]?.isSubmitted || dateStr < getTodayDateStr()),
                totalAudited: 0,
                statusAccountBreakdown: {},   // { statusValue: count }
                accountActivityBreakdown: {}, // { activityValue: count }
                noteAuditBreakdown: {},        // { noteValue: count }
            };
        }

        for (const log of uniqueLogs) {
            const d = log.auditDate;
            if (!reportByDate[d]) continue;
            const entry = reportByDate[d];

            entry.totalAudited++;

            // Status Account
            const sa = String(log.statusAccount || '').trim() || '(គ្មាន)';
            entry.statusAccountBreakdown[sa] = (entry.statusAccountBreakdown[sa] || 0) + 1;

            // Account Activity
            const aa = String(log.accountActivity || '').trim() || '(គ្មាន)';
            entry.accountActivityBreakdown[aa] = (entry.accountActivityBreakdown[aa] || 0) + 1;

            // Note Audit
            const na = String(log.noteAudit || '').trim() || '(គ្មាន)';
            entry.noteAuditBreakdown[na] = (entry.noteAuditBreakdown[na] || 0) + 1;
        }

        // Collect all distinct keys across all dates
        const allStatusKeys = new Set();
        const allActivityKeys = new Set();
        const allNoteKeys = new Set();

        for (const entry of Object.values(reportByDate)) {
            Object.keys(entry.statusAccountBreakdown).forEach(k => allStatusKeys.add(k));
            Object.keys(entry.accountActivityBreakdown).forEach(k => allActivityKeys.add(k));
            Object.keys(entry.noteAuditBreakdown).forEach(k => allNoteKeys.add(k));
        }

        res.json({
            success: true,
            dates,
            report: reportByDate,
            allStatusKeys: Array.from(allStatusKeys),
            allActivityKeys: Array.from(allActivityKeys),
            allNoteKeys: Array.from(allNoteKeys),
        });
    } catch (err) {
        console.error('Error in GET /telegram-audit/report:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/telegram-audit/submit (Manual Daily Submit) ─────────
router.post('/submit', async (req, res) => {
    try {
        const { auditDate, submittedBy = 'Staff', brand = '', subBrand = '' } = req.body;
        const targetDate = auditDate ? String(auditDate).trim() : getTodayDateStr();
        const auditRound = getCurrentAuditRound();
        if (targetDate !== getTodayDateStr()) {
            return res.status(400).json({ success: false, error: 'Only the current date can be submitted manually.' });
        }
        const effectiveSubBrand = await resolveSubBrand(brand, subBrand);
        const submissionIdentity = auditRound === 'AM'
            ? {
                auditDate: targetDate,
                brand: String(brand || ''),
                $or: [{ auditRound: 'AM' }, { auditRound: { $exists: false } }]
            }
            : { auditDate: targetDate, auditRound, brand: String(brand || '') };

        let subDoc = null;
        if (isMongoConnected) {
            // Upsert across all connected DBs to ensure persistent lock everywhere
            for (const instance of dbInstances) {
                if (instance.status !== 'connected' || !instance.conn) continue;
                try {
                    let BoundSubModel;
                    try {
                        BoundSubModel = instance.conn.model('TelegramAuditSubmission');
                    } catch {
                        BoundSubModel = instance.conn.model('TelegramAuditSubmission', TelegramAuditSubmission.schema);
                    }
                    const resDoc = await BoundSubModel.findOneAndUpdate(
                        submissionIdentity,
                        {
                            $set: {
                                auditDate: targetDate,
                                auditRound,
                                isSubmitted: true,
                                submittedAt: new Date(),
                                submittedBy: String(submittedBy || 'Staff'),
                                brand: String(brand || ''),
                                subBrand: effectiveSubBrand
                            }
                        },
                        { upsert: true, new: true }
                    );
                    if (!subDoc) subDoc = resDoc;
                } catch (e) {
                    console.warn('[telegramAuditRoutes] submit upsert error on', instance.name, e.message);
                }
            }
            if (!subDoc) {
                const SubModel = getWriteModel(TelegramAuditSubmission) || TelegramAuditSubmission;
                subDoc = await SubModel.findOneAndUpdate(
                    submissionIdentity,
                    {
                        $set: {
                            auditDate: targetDate,
                            auditRound,
                            isSubmitted: true,
                            submittedAt: new Date(),
                            submittedBy: String(submittedBy || 'Staff'),
                            brand: String(brand || ''),
                            subBrand: effectiveSubBrand
                        }
                    },
                    { upsert: true, new: true }
                );
            }
        }

        // Always keep memory updated as cache/fallback
        let found = MEM_DB.telegramAuditSubmissions.find(
            s => s.auditDate === targetDate && matchesAuditRound(s, auditRound) && s.brand === String(brand || '')
        );
        if (found) {
            found.auditRound = auditRound;
            found.isSubmitted = true;
            found.submittedAt = new Date();
            found.submittedBy = String(submittedBy || 'Staff');
            found.brand = String(brand || '');
            found.subBrand = effectiveSubBrand;
            if (!subDoc) subDoc = found;
        } else {
            const memItem = {
                auditDate: targetDate,
                auditRound,
                isSubmitted: true,
                submittedAt: new Date(),
                submittedBy: String(submittedBy || 'Staff'),
                brand: String(brand || ''),
                subBrand: effectiveSubBrand
            };
            MEM_DB.telegramAuditSubmissions.push(memItem);
            if (!subDoc) subDoc = memItem;
        }

        recordSystemAudit({
            category: 'Audit',
            level: 'Warning',
            action: 'TELEGRAM_AUDIT_SUBMIT_DAILY',
            taskCategory: 'Audit Telegram',
            description: `Daily audit submitted and locked for date ${targetDate} by ${submittedBy}`,
            username: submittedBy,
            brand: brand || ''
        }).catch(() => {});

        res.json({
            success: true,
            auditRound,
            message: `បាន Submit និងចាក់សោរទិន្នន័យសម្រាប់ថ្ងៃ ${targetDate} ដោយជោគជ័យ!`,
            data: subDoc
        });
    } catch (err) {
        console.error('Error submitting daily audit:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
