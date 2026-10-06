import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import { MEM_DB } from '../config/db.js';
import { queryAllDBs, isAnyDBConnected } from '../config/multiDB.js';
import { installTelegramSendRetry } from './telegramSendRetry.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Universal Auto-Retry Helper Function
export const withAutoRetry = async (fn, options = {}) => {
    const retries = options.retries || 3;
    const initialDelay = options.delayMs || 2000;
    const label = options.label || 'Operation';

    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastErr = err;
            console.warn(`[AutoRetry] ${label} failed on attempt ${attempt}/${retries}: ${err.message}`);
            if (attempt < retries) {
                const waitMs = initialDelay * Math.pow(2, attempt - 1);
                console.log(`[AutoRetry] Retrying ${label} in ${waitMs}ms...`);
                await new Promise(r => setTimeout(r, waitMs));
            }
        }
    }
    throw lastErr;
};

// ==================== collectLoginHistory ====================
const collectLoginHistory = async () => {
    const result = [];
    const userMap = new Map();

    try {
        if (isAnyDBConnected()) {
            // 1. Collect from User.loginHistory across all DBs
            const users = await queryAllDBs(User, (M) => M.find({}).select('username userId loginHistory'));
            users.forEach(u => {
                if (u.username && Array.isArray(u.loginHistory) && u.loginHistory.length) {
                    if (!userMap.has(u.username)) {
                        userMap.set(u.username, { username: u.username, userId: u.userId || '-', history: [] });
                    }
                    const target = userMap.get(u.username);
                    u.loginHistory.forEach(h => {
                        target.history.push({
                            timestamp: h.timestamp || new Date(),
                            ip: h.ip || 'N/A',
                            deviceInfo: h.deviceInfo || 'Unknown',
                            status: h.status || 'Success'
                        });
                    });
                }
            });

            // 2. Collect from LoginLog collection across all DBs
            const logs = await queryAllDBs(LoginLog, (M) => M.find({}).sort({ timestamp: -1 }));
            logs.forEach(l => {
                const uname = l.username || 'System/Guest';
                if (!userMap.has(uname)) {
                    userMap.set(uname, { username: uname, userId: l.userId || '-', history: [] });
                }
                const target = userMap.get(uname);
                target.history.push({
                    timestamp: l.timestamp || l.createdAt || new Date(),
                    ip: l.ip || 'N/A',
                    deviceInfo: l.deviceInfo || 'Unknown',
                    status: l.status || 'Success'
                });
            });
        }

        // 3. Fallback / add MEM_DB users
        if (MEM_DB && Array.isArray(MEM_DB.users)) {
            MEM_DB.users.forEach(u => {
                if (u.username && Array.isArray(u.loginHistory) && u.loginHistory.length) {
                    if (!userMap.has(u.username)) {
                        userMap.set(u.username, { username: u.username, userId: u.userId || '-', history: [] });
                    }
                    const target = userMap.get(u.username);
                    u.loginHistory.forEach(h => {
                        target.history.push({
                            timestamp: h.timestamp || new Date(),
                            ip: h.ip || 'N/A',
                            deviceInfo: h.deviceInfo || 'Unknown',
                            status: h.status || 'Success'
                        });
                    });
                }
            });
        }

        userMap.forEach(v => result.push(v));
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
    let botInstance = bot;
    if (!botInstance && process.env.TELEGRAM_BOT_TOKEN) {
        try {
            botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
            installTelegramSendRetry(botInstance);
        } catch (e) {
            console.error('Failed to create fallback TelegramBot instance:', e.message);
        }
    }

    if (!botInstance) throw new Error('Telegram bot instance not configured in system or .env');

    if (!fs.existsSync(filePath)) {
        throw new Error(`Report file not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        throw new Error('Report file is empty — aborting Telegram send');
    }
    console.log(`sendToTelegramWithRetry: Sending file ${filePath} (${stat.size} bytes) to chat ${chatId}`);

    installTelegramSendRetry(botInstance);
    const stream = fs.createReadStream(filePath);
    await botInstance.sendDocument(chatId, stream, { caption });
    return { success: true };
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
            if (!fs.existsSync(csvPath)) {
                fs.writeFileSync(csvPath, '"Username","UserID","Timestamp","Status","IP","Device"\n', 'utf8');
            }
            const csvLines = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
            fs.appendFileSync(csvPath, csvLines, 'utf8');
            console.log(`appendToGoogleSheet: CSV backup saved at ${csvPath}`);
        } catch (e) {
            console.error('appendToGoogleSheet: CSV backup error:', e.message);
        }

        // Step 2: Google Sheet via Webhook URL (with automatic retry)
        const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                return await withAutoRetry(async (attempt) => {
                    console.log(`appendToGoogleSheet: Sending to Webhook (Attempt ${attempt}/3):`, webhookUrl);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);
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
                        return { success: true, via: 'webhook', attempts: attempt };
                    }
                    throw new Error(`Webhook returned status ${response.status}: ${resText}`);
                }, { retries: 3, delayMs: 2500, label: 'Google Sheet Webhook Append' });
            } catch (webErr) {
                console.error('appendToGoogleSheet: Webhook retries failed, trying Google API fallback...', webErr.message);
            }
        }

        // Step 3: Fallback — Google API via Service Account (with automatic retry)
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
                } else if (serviceAccountJsonOrPath.trim().startsWith('{')) {
                    credentialsObj = JSON.parse(serviceAccountJsonOrPath);
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

        return await withAutoRetry(async (attempt) => {
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
            console.log(`appendToGoogleSheet: Appended via Google API successfully on attempt ${attempt}.`);
            return { success: true, via: 'google_api', attempts: attempt };
        }, { retries: 3, delayMs: 3000, label: 'Google Sheet API Append' });

    } catch (err) {
        console.error('appendToGoogleSheet error:', err.message);
        return { success: false, error: err.message };
    }
};

// ==================== cleanupLoginHistory ====================
const cleanupLoginHistory = async () => {
    try {
        let clearedUsersCount = 0;
        let clearedLogsCount = 0;

        if (isAnyDBConnected()) {
            // 1. Clear loginHistory on all User documents across ALL DBs
            await queryAllDBs(User, async (BoundM) => {
                const res = await BoundM.updateMany({}, { $set: { loginHistory: [] } }).catch(() => ({ modifiedCount: 0 }));
                clearedUsersCount += res.modifiedCount || 0;
                return [];
            });

            // 2. Delete all LoginLog records across ALL DBs
            await queryAllDBs(LoginLog, async (BoundM) => {
                const res = await BoundM.deleteMany({}).catch(() => ({ deletedCount: 0 }));
                clearedLogsCount += res.deletedCount || 0;
                return [];
            });
        }

        // 3. Clear MEM_DB users login history
        if (MEM_DB && Array.isArray(MEM_DB.users)) {
            MEM_DB.users.forEach(u => {
                u.loginHistory = [];
            });
        }

        console.log(`cleanupLoginHistory: Cleared loginHistory for ${clearedUsersCount} users and purged ${clearedLogsCount} LoginLog records.`);
        return { success: true, clearedUsersCount, clearedLogsCount };
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
