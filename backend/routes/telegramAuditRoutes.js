import express from 'express';
import { TelegramAuditContact, TelegramAuditLog, TelegramAuditSubmission } from '../models/TelegramAudit.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();

if (!MEM_DB.telegramAuditContacts) MEM_DB.telegramAuditContacts = [];
if (!MEM_DB.telegramAuditLogs) MEM_DB.telegramAuditLogs = [];
if (!MEM_DB.telegramAuditSubmissions) MEM_DB.telegramAuditSubmissions = [];

const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatAuditDateTime = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${y}-${m}-${day} ${strHours}:${minutes}:${seconds} ${ampm}`;
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
                    await SubmissionModel.findOneAndUpdate(
                        { auditDate: d },
                        {
                            $set: {
                                auditDate: d,
                                isSubmitted: true,
                                submittedAt: new Date(),
                                submittedBy: 'System Auto-Submit (Midnight 11:59PM)'
                            }
                        },
                        { upsert: true, new: true }
                    );
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
                let sub = MEM_DB.telegramAuditSubmissions.find(s => s.auditDate === d);
                if (sub) {
                    sub.isSubmitted = true;
                    sub.submittedAt = new Date();
                    sub.submittedBy = 'System Auto-Submit (Midnight 11:59PM)';
                } else {
                    MEM_DB.telegramAuditSubmissions.push({
                        auditDate: d,
                        isSubmitted: true,
                        submittedAt: new Date(),
                        submittedBy: 'System Auto-Submit (Midnight 11:59PM)'
                    });
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

        if (isMongoConnected) {
            // Check submission state in DB if not already locked
            if (!isSubmitted) {
                const subResults = await queryAllDBs(TelegramAuditSubmission, (M) => M.findOne({ auditDate: targetDate }));
                submissionInfo = subResults.find(r => r != null) || null;
                if (submissionInfo && submissionInfo.isSubmitted) {
                    isSubmitted = true;
                }
            }

            // Fetch all contacts
            contacts = await queryAllDBs(TelegramAuditContact, (M) => M.find({}).lean());

            // Fetch logs for this targetDate
            audits = await queryAllDBs(TelegramAuditLog, (M) => M.find({ auditDate: targetDate }).lean());

            // Get distinct statusAccount options from all past audits
            const statusResults = await queryAllDBs(TelegramAuditLog, (M) => M.distinct('statusAccount'));
            const flattenedStatuses = statusResults.flat().filter(Boolean).map(s => String(s).trim());
            distinctStatuses = [...new Set(flattenedStatuses)];
        } else {
            if (!isSubmitted) {
                submissionInfo = MEM_DB.telegramAuditSubmissions.find(s => s.auditDate === targetDate) || null;
                if (submissionInfo && submissionInfo.isSubmitted) {
                    isSubmitted = true;
                }
            }

            contacts = MEM_DB.telegramAuditContacts || [];
            audits = (MEM_DB.telegramAuditLogs || []).filter(l => l.auditDate === targetDate);
            distinctStatuses = [...new Set((MEM_DB.telegramAuditLogs || []).map(l => l.statusAccount).filter(Boolean))];
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
            distinctStatuses
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

        // Check if this contact already exists in database
        let existing = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(TelegramAuditContact, (M) =>
                M.findOne({
                    $or: [
                        { contractId: String(contractId) },
                        ...(contractIid ? [{ contractIid: String(contractIid) }] : []),
                        ...(customerName ? [{ customerName: String(customerName) }] : [])
                    ]
                }).lean()
            );
            existing = results.find(r => r != null) || null;
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

        let savedContact = null;
        if (isMongoConnected) {
            const Model = getWriteModel(TelegramAuditContact);
            savedContact = await Model.findOneAndUpdate(
                { contractId: String(contractId) },
                {
                    $set: {
                        contractId: String(contractId),
                        contractIid: String(contractIid || ''),
                        customerName: String(customerName || ''),
                        contactName: trimmedContactName,
                        username: trimmedUsername,
                        phoneNumber: trimmedPhone,
                        brand: String(brand || '')
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
            let found = MEM_DB.telegramAuditContacts.find(c => String(c.contractId) === String(contractId));
            if (found) {
                found.contactName = trimmedContactName;
                found.username = trimmedUsername;
                found.phoneNumber = trimmedPhone;
                found.contractIid = String(contractIid || '');
                found.customerName = String(customerName || '');
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
            brand = ''
        } = req.body;

        if (!contractId || !auditDate) {
            return res.status(400).json({ success: false, error: 'Contract ID and Audit Date are required.' });
        }

        const targetDate = String(auditDate).trim();
        const todayStr = getTodayDateStr();

        // Check if day is locked/submitted
        if (targetDate < todayStr) {
            return res.status(400).json({
                success: false,
                error: 'ទិន្នន័យសម្រាប់ថ្ងៃកន្លងផុតទៅត្រូវបាន Auto-Submit រួចហើយ មិនអាចកែប្រែបានទៀតទេ!'
            });
        }

        if (isMongoConnected) {
            const SubModel = getWriteModel(TelegramAuditSubmission);
            const existingSub = await SubModel.findOne({ auditDate: targetDate });
            if (existingSub && existingSub.isSubmitted) {
                return res.status(400).json({
                    success: false,
                    error: 'ទិន្នន័យសម្រាប់ថ្ងៃនេះត្រូវបាន Submit រួចហើយ មិនអាចកែប្រែបានទៀតទេ!'
                });
            }
        } else {
            const existingSub = MEM_DB.telegramAuditSubmissions.find(s => s.auditDate === targetDate);
            if (existingSub && existingSub.isSubmitted) {
                return res.status(400).json({
                    success: false,
                    error: 'ទិន្នន័យសម្រាប់ថ្ងៃនេះត្រូវបាន Submit រួចហើយ មិនអាចកែប្រែបានទៀតទេ!'
                });
            }
        }

        const nowFormatted = formatAuditDateTime();
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
                        auditDateTime: nowFormatted,
                        statusAccount: String(statusAccount || '').trim(),
                        accountActivity: String(accountActivity || '').trim(),
                        noteAudit: String(noteAudit || '').trim(),
                        auditedBy: String(auditedBy || 'Staff'),
                        brand: String(brand || '')
                    }
                },
                { upsert: true, new: true }
            );
        } else {
            let found = MEM_DB.telegramAuditLogs.find(
                l => String(l.contractId) === String(contractId) && l.auditDate === targetDate
            );
            if (found) {
                found.statusAccount = String(statusAccount || '').trim();
                found.accountActivity = String(accountActivity || '').trim();
                found.noteAudit = String(noteAudit || '').trim();
                found.auditDateTime = nowFormatted;
                found.auditedBy = String(auditedBy || 'Staff');
                found.contractIid = String(contractIid || '');
                found.customerName = String(customerName || '');
                savedLog = found;
            } else {
                savedLog = {
                    _id: 'tl_' + Date.now(),
                    contractId: String(contractId),
                    contractIid: String(contractIid || ''),
                    customerName: String(customerName || ''),
                    auditDate: targetDate,
                    auditDateTime: nowFormatted,
                    statusAccount: String(statusAccount || '').trim(),
                    accountActivity: String(accountActivity || '').trim(),
                    noteAudit: String(noteAudit || '').trim(),
                    auditedBy: String(auditedBy || 'Staff'),
                    brand: String(brand || ''),
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

        res.json({ success: true, message: 'Audited successfully', data: savedLog });
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

// ── POST /api/telegram-audit/submit (Manual Daily Submit) ─────────
router.post('/submit', async (req, res) => {
    try {
        const { auditDate, submittedBy = 'Staff', brand = '' } = req.body;
        const targetDate = auditDate ? String(auditDate).trim() : getTodayDateStr();

        let subDoc = null;
        if (isMongoConnected) {
            const SubModel = getWriteModel(TelegramAuditSubmission);
            subDoc = await SubModel.findOneAndUpdate(
                { auditDate: targetDate },
                {
                    $set: {
                        auditDate: targetDate,
                        isSubmitted: true,
                        submittedAt: new Date(),
                        submittedBy: String(submittedBy || 'Staff'),
                        brand: String(brand || '')
                    }
                },
                { upsert: true, new: true }
            );
        } else {
            let found = MEM_DB.telegramAuditSubmissions.find(s => s.auditDate === targetDate);
            if (found) {
                found.isSubmitted = true;
                found.submittedAt = new Date();
                found.submittedBy = String(submittedBy || 'Staff');
                subDoc = found;
            } else {
                subDoc = {
                    auditDate: targetDate,
                    isSubmitted: true,
                    submittedAt: new Date(),
                    submittedBy: String(submittedBy || 'Staff'),
                    brand: String(brand || '')
                };
                MEM_DB.telegramAuditSubmissions.push(subDoc);
            }
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
            message: `បាន Submit និងចាក់សោរទិន្នន័យសម្រាប់ថ្ងៃ ${targetDate} ដោយជោគជ័យ!`,
            data: subDoc
        });
    } catch (err) {
        console.error('Error submitting daily audit:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
