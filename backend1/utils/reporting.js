import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import { queryAllDBs, getWriteModel, isAnyDBConnected } from '../config/multiDB.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ==================== collectLoginHistory ====================
const collectLoginHistory = async () => {
    const result = [];
    try {
        if (!isAnyDBConnected()) {
            console.warn('collectLoginHistory: No MongoDB connected (multiDB), skipping.');
            return result;
        }
        // Use queryAllDBs — same pattern as historyRoutes.js to work with multi-DB
        const users = await queryAllDBs(User, (M) => M.find({}).select('username userId loginHistory'));
        console.log(`collectLoginHistory: Found ${users.length} users across all DBs`);
        users.forEach(u => {
            if (Array.isArray(u.loginHistory) && u.loginHistory.length) {
                result.push({
                    username: u.username,
                    userId: u.userId,
                    history: u.loginHistory.map(h => ({
                        timestamp: h.timestamp,
                        ip: h.ip || 'N/A',
                        deviceInfo: h.deviceInfo || 'Unknown',
                        status: h.status || 'Success'
                    }))
                });
            }
        });
        console.log(`collectLoginHistory: Collected history for ${result.length} users with login records`);
    } catch (err) {
        console.error('collectLoginHistory error:', err.message);
    }
    return result;
};

// ==================== formatReportText ====================
const formatReportText = (collected) => {
    const lines = [];
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    lines.push(`SYSTEM MDM — Login History Report (${now})`);
    lines.push('===========================================');

    if (collected.length === 0) {
        lines.push('No login history found.');
    } else {
        collected.forEach(user => {
            lines.push(`User: ${user.username} (${user.userId || '-'})`);
            user.history.forEach(h => {
                const ts = new Date(h.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
                const st = h.status || 'Success';
                lines.push(` - ${ts} | Status: ${st} | IP: ${h.ip} | Device: ${h.deviceInfo}`);
            });
            lines.push('');
        });
        const total = collected.reduce((s, u) => s + u.history.length, 0);
        lines.push(`--- Total Users: ${collected.length} | Total Entries: ${total} ---`);
    }
    return lines.join('\n');
};

// ==================== writeTempReportFile ====================
const writeTempReportFile = async (text) => {
    const dir = path.join(process.cwd(), 'tmp');
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.error('writeTempReportFile mkdir error:', e.message);
    }
    const filename = `login-history-${Date.now()}.txt`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, text, 'utf8');
    const stat = fs.statSync(filepath);
    console.log(`writeTempReportFile: Written ${stat.size} bytes → ${filepath}`);
    return filepath;
};

// ==================== sendToTelegramWithRetry ====================
const sendToTelegramWithRetry = async (bot, chatId, filePath, caption = '') => {
    if (!bot) throw new Error('Telegram bot instance not provided');

    // Validate file exists and has content before sending
    if (!fs.existsSync(filePath)) {
        throw new Error(`Report file not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        throw new Error('Report file is empty — aborting Telegram send');
    }
    console.log(`sendToTelegramWithRetry: Sending file ${filePath} (${stat.size} bytes) to chat ${chatId}`);

    let attempt = 0;
    const delays = [2000, 5000, 10000];
    while (attempt < 3) {
        try {
            attempt++;
            // Create a fresh stream for each attempt
            const stream = fs.createReadStream(filePath);
            await bot.sendDocument(chatId, stream, { caption });
            console.log(`sendToTelegramWithRetry: Success on attempt ${attempt}`);
            return { success: true, attempts: attempt };
        } catch (err) {
            console.error(`Telegram send attempt ${attempt} failed:`, err.message);
            if (attempt >= 3) throw err;
            const delay = delays[attempt - 1] || 2000;
            await new Promise(r => setTimeout(r, delay));
        }
    }
};

// ==================== appendToGoogleSheet ====================
const appendToGoogleSheet = async (serviceAccountJsonOrPath, sheetId, rows) => {
    try {
        if (!rows || !rows.length) {
            console.log('appendToGoogleSheet: No rows to append, skipping.');
            return { skipped: true, message: 'No rows to append' };
        }
        console.log(`appendToGoogleSheet: Attempting to append ${rows.length} rows to sheet ${sheetId}`);

        // Step 1: Local CSV Backup — always run first so data is never lost
        try {
            const dir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const csvPath = path.join(dir, 'login-history-backup.csv');
            // Add header if file doesn't exist yet
            if (!fs.existsSync(csvPath)) {
                fs.writeFileSync(csvPath, '"Username","UserID","Timestamp","Status","IP","Device"\n', 'utf8');
            }
            const csvLines = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
            fs.appendFileSync(csvPath, csvLines, 'utf8');
            console.log(`appendToGoogleSheet: CSV backup saved at ${csvPath}`);
        } catch (e) {
            console.error('appendToGoogleSheet: CSV backup error:', e.message);
        }

        // Step 2: Google Sheet via Webhook URL
        const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                console.log('appendToGoogleSheet: Sending to Webhook:', webhookUrl);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheetId, rows }),
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const resText = await response.text();
                console.log(`appendToGoogleSheet: Webhook response ${response.status}:`, resText);
                if (response.ok) {
                    return { success: true, via: 'webhook' };
                }
                console.warn('appendToGoogleSheet: Webhook returned non-OK, falling back to Google API...');
            } catch (webErr) {
                console.error('appendToGoogleSheet: Webhook error:', webErr.message, '— falling back to Google API...');
            }
        }

        // Step 3: Fallback — Google API via Service Account
        if (!serviceAccountJsonOrPath || !sheetId) {
            console.warn('appendToGoogleSheet: No service account or sheetId configured, skipping Google API.');
            return { skipped: true };
        }

        let credentialsObj = null;
        if (typeof serviceAccountJsonOrPath === 'string') {
            try {
                if (fs.existsSync(serviceAccountJsonOrPath)) {
                    const raw = fs.readFileSync(serviceAccountJsonOrPath, 'utf8');
                    credentialsObj = JSON.parse(raw);
                    console.log('appendToGoogleSheet: Loaded service account from file.');
                } else if (serviceAccountJsonOrPath.trim().startsWith('{')) {
                    credentialsObj = JSON.parse(serviceAccountJsonOrPath);
                    console.log('appendToGoogleSheet: Loaded service account from JSON string.');
                } else {
                    console.error('appendToGoogleSheet: Service account file not found at:', serviceAccountJsonOrPath);
                }
            } catch (e) {
                console.error('appendToGoogleSheet: Failed to parse service account JSON:', e.message);
                return { success: false, error: e.message };
            }
        } else {
            credentialsObj = serviceAccountJsonOrPath;
        }

        if (!credentialsObj) {
            console.warn('appendToGoogleSheet: credentialsObj is null, cannot use Google API.');
            return { skipped: true };
        }

        const { google } = await import('googleapis');
        const auth = new google.auth.GoogleAuth({
            credentials: credentialsObj,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            resource: { values: rows }
        });
        console.log('appendToGoogleSheet: Appended via Google API successfully.');
        return { success: true, via: 'google_api' };

    } catch (err) {
        console.error('appendToGoogleSheet error:', err.message);
        return { success: false, error: err.message };
    }
};

// ==================== cleanupLoginHistory ====================
const cleanupLoginHistory = async () => {
    try {
        if (!isAnyDBConnected()) {
            console.warn('cleanupLoginHistory: No MongoDB connected (multiDB), skipping.');
            return { skipped: true };
        }
        // Use getWriteModel — writes to active DB (DB1 → DB2 → DB3 fallback)
        const UserWrite = getWriteModel(User) || User;
        const res = await UserWrite.updateMany({}, { $set: { loginHistory: [] } });
        console.log(`cleanupLoginHistory: Cleared loginHistory for ${res.modifiedCount} users.`);
        return { success: true, modifiedCount: res.modifiedCount };
    } catch (err) {
        console.error('cleanupLoginHistory error:', err.message);
        return { success: false, error: err.message };
    }
};

export {
    collectLoginHistory,
    formatReportText,
    writeTempReportFile,
    sendToTelegramWithRetry,
    appendToGoogleSheet,
    cleanupLoginHistory,
    SEVEN_DAYS_MS
};
