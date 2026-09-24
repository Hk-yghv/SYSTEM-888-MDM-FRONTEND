import SystemAuditLog from '../models/SystemAuditLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';
import { appendToGoogleSheet } from '../utils/reporting.js';
import { recordSystemAudit } from '../utils/auditLogger.js';
import fs from 'fs';
import path from 'path';

let lastArchivalStatus = {
    lastRunTime: null,
    archivedCount: 0,
    status: 'idle',
    error: null
};

export const formatLogRow = (l) => {
    const timeStr = new Date(l.timestamp || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    let payloadStr = '';
    try {
        if (l.payload) {
            if (l.payload.deletedData || l.payload.deletedRecord || l.payload.previousData) {
                const delData = l.payload.deletedData || l.payload.deletedRecord || l.payload.previousData;
                payloadStr = `[DELETED DATA]: ${JSON.stringify(delData)}`;
            } else if (l.payload.diff && Array.isArray(l.payload.diff)) {
                payloadStr = `[DIFF]: ${l.payload.diff.map(d => `${d.field}: ${d.oldValue} -> ${d.newValue}`).join('; ')}`;
            } else {
                payloadStr = JSON.stringify(l.payload);
            }
        }
    } catch {
        payloadStr = String(l.payload);
    }

    return [
        l.eventId || '-',
        timeStr,
        l.category || 'System',
        l.level || 'Information',
        l.action || 'GENERAL',
        l.taskCategory || '-',
        l.username || 'System',
        l.name || '',
        l.role || 'Staff',
        l.brand || 'Global',
        l.ip || '127.0.0.1',
        l.deviceInfo || 'Windows PC',
        l.path || '-',
        l.contractId || l.customerId || '-',
        l.description || '',
        payloadStr.slice(0, 1500)
    ];
};

/**
 * Real-time direct export for deleted data & critical events to Google Sheet 2
 */
export const exportDeletedLogToGoogleSheet = async (logEntry) => {
    try {
        const sheetId = process.env.GOOGLE_SHEET_SYSTEM_LOGS_ID || process.env.GOOGLE_SHEET_DELETE_HISTORY_ID || process.env.GOOGLE_SHEET_ID;
        const webhookUrl = process.env.GOOGLE_SHEET_SYSTEM_LOGS_WEBHOOK_URL || process.env.GOOGLE_SHEET_DELETE_HISTORY_WEBHOOK_URL || process.env.GOOGLE_SHEET_WEBHOOK_URL;
        const svc = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

        if (!webhookUrl && (!svc || !sheetId)) {
            return { skipped: true };
        }

        const row = formatLogRow(logEntry);

        if (webhookUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'append',
                        sheetId,
                        rows: [row],
                        row,
                        type: 'system_logs_delete_history'
                    }),
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    console.log(`[LogArchival] Real-time deleted record ${logEntry.eventId || logEntry.action} saved to Google Sheet 2.`);
                    return { success: true, via: 'webhook_realtime' };
                }
            } catch (wErr) {
                console.warn('[LogArchival] Real-time Webhook append error:', wErr.message);
            }
        }

        if (svc && sheetId) {
            return await appendToGoogleSheet(svc, sheetId, [row]);
        }
    } catch (err) {
        console.error('[LogArchival] exportDeletedLogToGoogleSheet error:', err.message);
    }
};

/**
 * Archive system audit logs older than specified days (default: 7 days)
 * 1. Exports them to Google Sheets
 * 2. Writes a local CSV safety backup
 * 3. Removes the archived logs from MongoDB and in-memory cache
 */
export const archiveAndCleanupSystemLogs = async (retentionDays = 7, triggeredBy = 'Scheduler') => {
    try {
        lastArchivalStatus.status = 'running';
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        console.log(`[LogArchival] Checking logs older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})...`);

        let oldLogs = [];

        if (isMongoConnected) {
            const results = await queryAllDBs(SystemAuditLog, (M) =>
                M.find({ timestamp: { $lt: cutoffDate } }).sort({ timestamp: 1 })
            );
            // Deduplicate across multi-DBs
            const map = new Map();
            results.forEach(l => map.set(l._id ? l._id.toString() : l.eventId, l));
            oldLogs = Array.from(map.values());
        } else {
            oldLogs = (MEM_DB.systemAuditLogs || []).filter(l => new Date(l.timestamp) < cutoffDate);
        }

        if (!oldLogs || oldLogs.length === 0) {
            console.log(`[LogArchival] No system logs older than ${retentionDays} days found to archive.`);
            lastArchivalStatus = {
                lastRunTime: new Date(),
                archivedCount: 0,
                status: 'success',
                error: null
            };
            return { success: true, count: 0, message: `No system logs older than ${retentionDays} days found.` };
        }

        console.log(`[LogArchival] Found ${oldLogs.length} logs older than ${retentionDays} days. Preparing Google Sheet sync...`);

        // Format rows for Google Sheet
        const rows = oldLogs.map(l => formatLogRow(l));

        // 1. Local Safety CSV Backup
        try {
            const dir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const dateStr = new Date().toISOString().slice(0, 10);
            const csvPath = path.join(dir, `system-logs-archive-7days-${dateStr}.csv`);
            if (!fs.existsSync(csvPath)) {
                fs.writeFileSync(csvPath, '"EventID","Timestamp","Category","Level","Action","TaskCategory","Username","Name","Role","Brand","IP","Device","Path","ContractID","Description","Payload"\n', 'utf8');
            }
            const csvLines = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
            fs.appendFileSync(csvPath, csvLines, 'utf8');
            console.log(`[LogArchival] Safety CSV backup saved at: ${csvPath}`);
        } catch (csvErr) {
            console.warn('[LogArchival] CSV safety backup warning:', csvErr.message);
        }

        // 2. Google Sheet Export for Sheet 2 (Data History Delete & System Logs)
        const sheetId = process.env.GOOGLE_SHEET_SYSTEM_LOGS_ID || process.env.GOOGLE_SHEET_DELETE_HISTORY_ID || process.env.GOOGLE_SHEET_ID;
        const webhookUrl = process.env.GOOGLE_SHEET_SYSTEM_LOGS_WEBHOOK_URL || process.env.GOOGLE_SHEET_DELETE_HISTORY_WEBHOOK_URL || process.env.GOOGLE_SHEET_WEBHOOK_URL;
        const svc = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

        let sheetResult = null;

        // Try direct Webhook first if configured for Sheet 2
        if (webhookUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'append',
                        sheetId,
                        rows,
                        type: 'system_logs_delete_history'
                    }),
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const resText = await response.text();
                if (response.ok) {
                    sheetResult = { success: true, via: 'webhook_sheet2' };
                } else {
                    console.warn('[LogArchival] Webhook returned status:', response.status, resText);
                }
            } catch (wErr) {
                console.warn('[LogArchival] Webhook append failed, trying Google API fallback...', wErr.message);
            }
        }

        // Fallback to Google API Service Account if Webhook wasn't used or failed
        if (!sheetResult && svc && sheetId) {
            sheetResult = await appendToGoogleSheet(svc, sheetId, rows);
        }
        console.log('[LogArchival] Google Sheet 2 (Data History Delete) append result:', sheetResult);

        // 3. Purge the archived logs from Database
        let deletedMongoCount = 0;
        if (isMongoConnected) {
            const deleteRes = await queryAllDBs(SystemAuditLog, async (BoundM) => {
                const res = await BoundM.deleteMany({ timestamp: { $lt: cutoffDate } });
                return res?.deletedCount || 0;
            });
            deletedMongoCount = Math.max(...deleteRes, 0);
        }

        // Clean from MEM_DB
        const beforeMem = (MEM_DB.systemAuditLogs || []).length;
        MEM_DB.systemAuditLogs = (MEM_DB.systemAuditLogs || []).filter(l => new Date(l.timestamp) >= cutoffDate);
        const memDeleted = beforeMem - MEM_DB.systemAuditLogs.length;

        console.log(`[LogArchival] Purged ${oldLogs.length} logs older than ${retentionDays} days (Mongo: ${deletedMongoCount}, Memory: ${memDeleted}).`);

        // Record an audit log about this operation
        await recordSystemAudit({
            category: 'System',
            level: 'Information',
            action: 'SYSTEM_LOGS_7DAYS_ARCHIVED',
            taskCategory: 'Log Maintenance',
            description: `Archived ${oldLogs.length} system logs (> ${retentionDays} days old) to Google Sheet & deleted from database. Triggered by ${triggeredBy}.`,
            username: triggeredBy === 'Scheduler' ? 'AutoScheduler' : triggeredBy,
            payload: {
                archivedCount: oldLogs.length,
                retentionDays,
                cutoffDate: cutoffDate.toISOString(),
                sheetId,
                googleSheetSync: sheetResult?.success ? 'Success' : 'CSV Fallback'
            }
        });

        lastArchivalStatus = {
            lastRunTime: new Date(),
            archivedCount: oldLogs.length,
            status: 'success',
            error: null
        };

        return {
            success: true,
            count: oldLogs.length,
            message: `Successfully archived and purged ${oldLogs.length} system logs older than ${retentionDays} days to Google Sheet.`,
            googleSheet: sheetResult
        };
    } catch (err) {
        console.error('[LogArchival] Error in archiveAndCleanupSystemLogs:', err);
        lastArchivalStatus = {
            lastRunTime: new Date(),
            archivedCount: 0,
            status: 'error',
            error: err.message
        };
        return { success: false, error: err.message };
    }
};

/**
 * Get current 7-day archival status and count of logs pending archival
 */
export const getArchivalStatus = async (retentionDays = 7) => {
    try {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        let pendingCount = 0;
        let totalCount = 0;

        if (isMongoConnected) {
            const pendingResults = await queryAllDBs(SystemAuditLog, (M) => M.countDocuments({ timestamp: { $lt: cutoffDate } }));
            const totalResults = await queryAllDBs(SystemAuditLog, (M) => M.countDocuments({}));
            pendingCount = Math.max(...pendingResults, 0);
            totalCount = Math.max(...totalResults, 0);
        } else {
            const mem = MEM_DB.systemAuditLogs || [];
            totalCount = mem.length;
            pendingCount = mem.filter(l => new Date(l.timestamp) < cutoffDate).length;
        }

        return {
            retentionDays,
            cutoffDate: cutoffDate.toISOString(),
            pendingCount,
            totalCount,
            lastStatus: lastArchivalStatus
        };
    } catch (err) {
        return { error: err.message, pendingCount: 0, totalCount: 0 };
    }
};

/**
 * Read archived system logs directly from Google Sheets (or fallback safety CSV)
 * Strictly does NOT query the local MongoDB / MEM_DB
 */
export const readSystemLogsFromGoogleSheet = async ({
    startDate,
    endDate,
    search,
    category,
    level,
    brand,
    username,
    page = 1,
    limit = 100
} = {}) => {
    try {
        const sheetId = process.env.GOOGLE_SHEET_SYSTEM_LOGS_ID || process.env.GOOGLE_SHEET_DELETE_HISTORY_ID || process.env.GOOGLE_SHEET_ID;
        const webhookUrl = process.env.GOOGLE_SHEET_SYSTEM_LOGS_WEBHOOK_URL || process.env.GOOGLE_SHEET_DELETE_HISTORY_WEBHOOK_URL || process.env.GOOGLE_SHEET_WEBHOOK_URL;
        const svc = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

        let rawRows = [];
        let sourceUsed = 'Google Sheet Webhook';

        // 1. Try reading via Webhook URL (Fastest & most direct)
        if (webhookUrl) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);
                const queryUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'action=read';
                const response = await fetch(queryUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const resData = await response.json();
                    if (resData && Array.isArray(resData.rows) && resData.rows.length > 0) {
                        rawRows = resData.rows;
                    } else if (Array.isArray(resData) && resData.length > 0) {
                        rawRows = resData;
                    }
                }
            } catch (wErr) {
                console.warn('[LogArchival] Webhook GET read error, trying Google API fallback...', wErr.message);
            }
        }

        // 2. Try Google Sheet API via Service Account if Webhook didn't return rows
        let credentialsObj = null;
        if ((!rawRows || rawRows.length === 0) && svc) {
            sourceUsed = 'Google Sheet API';
            try {
                if (typeof svc === 'string') {
                    if (fs.existsSync(svc)) {
                        credentialsObj = JSON.parse(fs.readFileSync(svc, 'utf8'));
                    } else if (svc.trim().startsWith('{')) {
                        credentialsObj = JSON.parse(svc);
                    }
                } else {
                    credentialsObj = svc;
                }
            } catch (e) {
                console.warn('[LogArchival] Failed to parse credentials for reading Google Sheet:', e.message);
            }
        }

        if (credentialsObj && sheetId) {
            try {
                const { google } = await import('googleapis');
                const auth = new google.auth.GoogleAuth({
                    credentials: credentialsObj,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
                });
                const client = await auth.getClient();
                const sheets = google.sheets({ version: 'v4', auth: client });

                // Try SystemLogs tab first, fallback to Sheet1
                let res = null;
                try {
                    res = await sheets.spreadsheets.values.get({
                        spreadsheetId: sheetId,
                        range: 'SystemLogs!A1:P10000'
                    });
                } catch {
                    res = await sheets.spreadsheets.values.get({
                        spreadsheetId: sheetId,
                        range: 'Sheet1!A1:P10000'
                    });
                }

                if (res.data && Array.isArray(res.data.values) && res.data.values.length > 0) {
                    rawRows = res.data.values;
                }
            } catch (sheetErr) {
                console.warn('[LogArchival] Google Sheets API read error, falling back to local CSV backup:', sheetErr.message);
            }
        }

        // 2. Fallback to Local Archived CSV backups if Sheet API didn't return rows
        if (!rawRows || rawRows.length === 0) {
            sourceUsed = 'Local CSV Archive Backup';
            try {
                const dir = path.join(process.cwd(), 'tmp');
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir).filter(f => f.startsWith('system-logs-archive-') && f.endsWith('.csv'));
                    files.sort().reverse(); // newest first
                    for (const f of files) {
                        const content = fs.readFileSync(path.join(dir, f), 'utf8');
                        const lines = content.split('\n').filter(Boolean);
                        // skip header
                        for (let i = 1; i < lines.length; i++) {
                            // Simple CSV row parser (respecting quotes)
                            const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                            if (match) {
                                const row = match.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
                                rawRows.push(row);
                            }
                        }
                    }
                }
            } catch (csvErr) {
                console.warn('[LogArchival] CSV fallback read error:', csvErr.message);
            }
        }

        // Parse Rows into structured SystemAuditLog objects
        let logs = [];
        rawRows.forEach((r, idx) => {
            // [eventId, timestamp, category, level, action, taskCategory, username, name, role, brand, ip, deviceInfo, path, contractId, description, payload]
            if (!r || r.length < 5) return;
            if (r[0] === 'EventID' || r[0] === 'Event ID') return; // skip header row

            const eventId = r[0] || `EVT-GS-${idx + 1}`;
            const timeStr = r[1] || '';
            const cat = r[2] || 'System';
            const lvl = r[3] || 'Information';
            const act = r[4] || 'GENERAL';
            const task = r[5] || 'Archived';
            const usr = r[6] || 'System';
            const nm = r[7] || '';
            const rl = r[8] || 'Staff';
            const br = r[9] || 'Global';
            const ip = r[10] || '127.0.0.1';
            const dev = r[11] || 'Windows Client';
            const pth = r[12] || '';
            const ref = r[13] || '';
            const desc = r[14] || '';
            const rawPayload = r[15] || '';

            let payloadObj = {};
            if (rawPayload) {
                if (rawPayload.startsWith('[DELETED DATA]: ')) {
                    try {
                        payloadObj.deletedData = JSON.parse(rawPayload.replace('[DELETED DATA]: ', ''));
                    } catch {
                        payloadObj.deletedData = rawPayload.replace('[DELETED DATA]: ', '');
                    }
                } else if (rawPayload.startsWith('[DIFF]: ')) {
                    payloadObj.diff = rawPayload.replace('[DIFF]: ', '');
                } else {
                    try {
                        payloadObj = JSON.parse(rawPayload);
                    } catch {
                        payloadObj = { raw: rawPayload };
                    }
                }
            }

            logs.push({
                _id: `gs-${idx}-${eventId}`,
                eventId,
                timestamp: timeStr ? new Date(timeStr) : new Date(),
                timestampDisplay: timeStr,
                category: cat,
                level: lvl,
                action: act,
                taskCategory: task,
                username: usr,
                name: nm,
                role: rl,
                brand: br,
                ip,
                deviceInfo: dev,
                path: pth,
                contractId: ref,
                description: desc,
                payload: payloadObj,
                isGoogleSheetArchive: true
            });
        });

        // Filter logs
        if (category && category !== 'All') {
            logs = logs.filter(l => l.category.toLowerCase() === category.toLowerCase());
        }
        if (level && level !== 'All') {
            logs = logs.filter(l => l.level.toLowerCase() === level.toLowerCase());
        }
        if (brand) {
            logs = logs.filter(l => (l.brand || '').toLowerCase() === brand.toLowerCase());
        }
        if (username) {
            const cleanUser = username.replace(/^@/, '').toLowerCase();
            logs = logs.filter(l => (l.username || '').replace(/^@/, '').toLowerCase() === cleanUser);
        }
        if (startDate) {
            const sDate = new Date(startDate).getTime();
            logs = logs.filter(l => new Date(l.timestamp).getTime() >= sDate);
        }
        if (endDate) {
            const eDate = new Date(endDate);
            eDate.setHours(23, 59, 59, 999);
            const eTime = eDate.getTime();
            logs = logs.filter(l => new Date(l.timestamp).getTime() <= eTime);
        }
        if (search) {
            const s = search.toLowerCase();
            logs = logs.filter(l =>
                (l.description || '').toLowerCase().includes(s) ||
                (l.username || '').toLowerCase().includes(s) ||
                (l.action || '').toLowerCase().includes(s) ||
                (l.eventId || '').toLowerCase().includes(s) ||
                (l.contractId || '').toLowerCase().includes(s)
            );
        }

        const total = logs.length;
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;
        const paginated = logs.slice(skip, skip + take);

        return {
            success: true,
            data: paginated,
            total,
            page: parseInt(page),
            limit: take,
            source: sourceUsed,
            sheetId
        };
    } catch (err) {
        console.error('[LogArchival] readSystemLogsFromGoogleSheet error:', err.message);
        return { success: false, error: err.message, data: [], total: 0 };
    }
};

/**
 * Background Scheduler: Runs immediately on server startup (after 2s DB stabilization) and every 6 hours
 */
export const startSystemLogArchivalScheduler = () => {
    console.log('[LogArchival] Initializing Automatic 7-Day System Log Archival & Retention Scheduler...');
    
    // 1. Run immediately on server boot (after 2 seconds)
    setTimeout(async () => {
        console.log('[LogArchival] 🚀 Starting immediate boot-time scan to check & archive system logs (>7 days) to Google Sheet...');
        try {
            const result = await archiveAndCleanupSystemLogs(7, 'StartupImmediateScan');
            console.log('[LogArchival] ✅ Boot-time immediate scan finished:', result.message || result);
        } catch (err) {
            console.error('[LogArchival] ❌ Boot-time immediate scan error:', err.message);
        }
    }, 2000);

    // 2. Periodic run every 6 hours (6 * 60 * 60 * 1000 ms)
    setInterval(async () => {
        console.log('[LogArchival] ⏰ Starting 6-hour periodic archival scan to Google Sheet...');
        try {
            const result = await archiveAndCleanupSystemLogs(7, 'CronScheduler');
            console.log('[LogArchival] ✅ 6-hour periodic scan finished:', result.message || result);
        } catch (err) {
            console.error('[LogArchival] ❌ Periodic archival error:', err.message);
        }
    }, 6 * 60 * 60 * 1000);
};
