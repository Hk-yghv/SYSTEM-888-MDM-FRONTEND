import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const collectLoginHistory = async () => {
    const result = [];
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const users = await User.find().select('username userId loginHistory');
            users.forEach(u => {
                if (Array.isArray(u.loginHistory) && u.loginHistory.length) {
                    result.push({ username: u.username, userId: u.userId, history: u.loginHistory.map(h => ({ timestamp: h.timestamp, ip: h.ip, deviceInfo: h.deviceInfo })) });
                }
            });
        } else {
            // When DB not connected, nothing to collect here
        }
    } catch (err) {
        console.error('collectLoginHistory error:', err.message);
    }
    return result;
};

const formatReportText = (collected) => {
    const lines = [];
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    lines.push(`SYSTEM MDM — Login History Report (${now})`);
    lines.push('===========================================');
    collected.forEach(user => {
        lines.push(`User: ${user.username} (${user.userId})`);
        user.history.forEach(h => {
            const ts = new Date(h.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
            lines.push(` - ${ts} | IP: ${h.ip} | Device: ${h.deviceInfo}`);
        });
        lines.push('');
    });
    if (collected.length === 0) lines.push('No login history found.');
    return lines.join('\n');
};

const writeTempReportFile = async (text) => {
    const dir = path.join(process.cwd(), 'tmp');
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    } catch (e) {}
    const filename = `login-history-${Date.now()}.txt`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, text, 'utf8');
    return filepath;
};

const sendToTelegramWithRetry = async (bot, chatId, filePath, caption = '') => {
    if (!bot) throw new Error('Telegram bot instance not provided');
    let attempt = 0;
    const delays = [2000, 5000, 10000];
    while (attempt < 3) {
        try {
            attempt++;
            const stream = fs.createReadStream(filePath);
            await bot.sendDocument(chatId, stream, { caption });
            return { success: true, attempts: attempt };
        } catch (err) {
            console.error(`Telegram send attempt ${attempt} failed:`, err.message);
            if (attempt >= 3) throw err;
            const delay = delays[attempt - 1] || 2000;
            await new Promise(r => setTimeout(r, delay));
        }
    }
};

const appendToGoogleSheet = async (serviceAccountJsonOrPath, sheetId, rows) => {
    try {
        if (!rows || !rows.length) return { skipped: true, message: 'No rows to append' };

        // 1. Check if Webhook URL is defined in process.env
        const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheetId, rows })
                });
                if (response.ok) {
                    console.log('Appended rows to Google Sheet via Webhook successfully.');
                    return { success: true, via: 'webhook' };
                }
            } catch (webErr) {
                console.error('Google Sheet Webhook send error:', webErr.message);
            }
        }

        // 2. Local CSV Backup (Guarantees data is never lost)
        try {
            const dir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const csvPath = path.join(dir, 'login-history-backup.csv');
            const csvLines = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
            fs.appendFileSync(csvPath, csvLines, 'utf8');
        } catch (e) { }

        // 3. Google API via Service Account
        if (!serviceAccountJsonOrPath || !sheetId) return { skipped: true };

        let credentialsObj = null;
        if (typeof serviceAccountJsonOrPath === 'string') {
            try {
                if (fs.existsSync(serviceAccountJsonOrPath)) {
                    const raw = fs.readFileSync(serviceAccountJsonOrPath, 'utf8');
                    credentialsObj = JSON.parse(raw);
                } else if (serviceAccountJsonOrPath.startsWith('{')) {
                    credentialsObj = JSON.parse(serviceAccountJsonOrPath);
                }
            } catch (e) {
                console.error('Failed to parse service account JSON:', e.message);
                return { success: false, error: e.message };
            }
        } else {
            credentialsObj = serviceAccountJsonOrPath;
        }

        if (!credentialsObj) return { skipped: true };

        const { google } = await import('googleapis');
        const auth = new google.auth.GoogleAuth({ credentials: credentialsObj, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const resource = { values: rows };
        await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'Sheet1!A1', valueInputOption: 'RAW', resource });
        return { success: true, via: 'google_api' };
    } catch (err) {
        console.error('appendToGoogleSheet error:', err.message);
        return { success: false, error: err.message };
    }
};

const cleanupLoginHistory = async () => {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            await User.updateMany({}, { $set: { loginHistory: [] } });
            return { success: true };
        }
        return { skipped: true };
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
