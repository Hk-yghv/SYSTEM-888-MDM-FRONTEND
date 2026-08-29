import express from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import PhoneLog from '../models/PhoneLog.js';
import WallpaperLog from '../models/WallpaperLog.js';
import DeviceActionLog from '../models/DeviceActionLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';
import {
    collectLoginHistory,
    formatReportText,
    writeTempReportFile,
    sendToTelegramWithRetry,
    appendToGoogleSheet,
    cleanupLoginHistory
} from '../utils/reporting.js';

const router = express.Router();

// Schedule tracker for Telegram Bot Login History Reports
const REPORT_SCHEDULE_FILE = path.join(process.cwd(), 'tmp', 'report-schedule.json');
const SCHEDULE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const saveReportSchedule = (nextTime) => {
    try {
        const dir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(REPORT_SCHEDULE_FILE, JSON.stringify({
            lastReportSent: Date.now(),
            nextReportTime: nextTime
        }), 'utf8');
    } catch (e) {
        console.error('Failed to save report schedule:', e.message);
    }
};

const getNextReportTime = () => {
    try {
        if (fs.existsSync(REPORT_SCHEDULE_FILE)) {
            const data = JSON.parse(fs.readFileSync(REPORT_SCHEDULE_FILE, 'utf8'));
            if (data.nextReportTime && data.nextReportTime > Date.now()) {
                return data.nextReportTime;
            }
        }
    } catch (e) {}

    const defaultNext = Date.now() + SCHEDULE_INTERVAL_MS;
    saveReportSchedule(defaultNext);
    return defaultNext;
};

let nextReportTargetTime = getNextReportTime();
let isExecutingReport = false; // Atomic execution lock to prevent sending duplicate report files

export function createHistoryRoutes(bot) {
    const runWeeklyReport = async () => {
        if (isExecutingReport) {
            console.log('[WeeklyReport] Report generation is already running. Skipping duplicate trigger.');
            return {
                success: true,
                sentToTelegram: false,
                sheetExported: false,
                skipped: true,
                message: 'Report send is already in progress.',
                nextReportTime: nextReportTargetTime
            };
        }

        isExecutingReport = true;
        // Lock out future interval triggers immediately by setting target time 7 days into future
        nextReportTargetTime = Date.now() + SCHEDULE_INTERVAL_MS;
        saveReportSchedule(nextReportTargetTime);

        let sentToTelegram = false;
        let telegramError = null;
        let sheetExported = false;

        try {
            const collected = await collectLoginHistory();
            const text = formatReportText(collected);
            const filePath = await writeTempReportFile(text);

            const rows = [];
            collected.forEach(u => {
                u.history.forEach(h => {
                    const timeStr = new Date(h.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
                    rows.push([u.username, u.userId || '-', timeStr, h.status || 'Success', h.ip, h.deviceInfo]);
                });
            });

            if (rows.length > 0) {
                const sheetId = process.env.GOOGLE_SHEET_ID || '1eNVBdA18T_U-sOWfDVjlmoDB59ofUnJI9PjL8H0SHjU';
                const svc = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
                const sheetRes = await appendToGoogleSheet(svc, sheetId, rows);
                if (sheetRes && sheetRes.success) {
                    console.log('Login history appended to Google Sheet.');
                    sheetExported = true;
                }
            }

            const masterChatId = process.env.TELEGRAM_MASTER_CHAT_ID || '5279289278';
            if (masterChatId) {
                try {
                    await sendToTelegramWithRetry(bot, masterChatId, filePath, 'SYSTEM MDM — Login History Report');
                    console.log('Login history report sent to Telegram master admin.');
                    sentToTelegram = true;
                } catch (err) {
                    console.error('Failed to send login report to Telegram:', err.message);
                    telegramError = err.message;
                }
            } else {
                console.log('Master chat id or bot not configured; skipping Telegram send.');
                telegramError = 'Telegram Bot or TELEGRAM_MASTER_CHAT_ID is not configured in .env';
            }

            const cleanRes = await cleanupLoginHistory();
            if (cleanRes && cleanRes.success) console.log('Cleared loginHistory from all user records.');

            return { success: true, sentToTelegram, sheetExported, telegramError, nextReportTime: nextReportTargetTime };
        } catch (err) {
            console.error('runWeeklyReport error:', err.message);
            throw err;
        } finally {
            isExecutingReport = false;
        }
    };

    // Singleton background schedule check (runs once per process)
    if (!global._historyReportIntervalStarted) {
        global._historyReportIntervalStarted = true;
        setInterval(() => {
            if (Date.now() >= nextReportTargetTime && !isExecutingReport) {
                console.log('Report schedule target time reached, triggering auto report...');
                runWeeklyReport().catch(err => console.error(err));
            }
        }, 30 * 1000);
    }

    router.get('/report-schedule', (req, res) => {
        const remainingMs = Math.max(0, nextReportTargetTime - Date.now());
        const totalSec = Math.floor(remainingMs / 1000);
        const days = Math.floor(totalSec / (24 * 3600));
        const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;

        res.json({
            nextReportTime: nextReportTargetTime,
            remainingMs,
            countdown: { days, hours, minutes, seconds }
        });
    });

    router.post('/send-telegram-report', async (req, res) => {
        try {
            const result = await runWeeklyReport();
            res.json({
                success: true,
                message: result.skipped ? 'Report send is already in progress.' : 'Report sent to Telegram bot and login history cleared successfully.',
                sentToTelegram: result.sentToTelegram,
                telegramError: result.telegramError,
                nextReportTime: result.nextReportTime
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/login', async (req, res) => {
        try {
            const { search = '', role = '', status = '', page = 1, limit = 10, userUsername = '', userRole = '' } = req.query;
            let allLogs = [];
            const seenIds = new Set();
            const isMasterAdmin = userRole === 'Administrator' || userUsername === '@hakyonghouv';

            if (isMongoConnected) {
                try {
                    const standaloneLogs = await queryAllDBs(LoginLog, (M) => M.find({}));
                    standaloneLogs.forEach(log => {
                        if (!isMasterAdmin && userUsername && log.username !== userUsername) return;
                        const idStr = log._id?.toString();
                        if (idStr && !seenIds.has(idStr)) {
                            seenIds.add(idStr);
                            allLogs.push({
                                id: idStr,
                                userId: log.userId || '-',
                                username: log.username,
                                name: log.name || 'Unknown User',
                                role: log.role || 'Guest',
                                brand: log.brand || 'SYSTEM',
                                ip: log.ip || '127.0.0.1',
                                deviceInfo: log.deviceInfo || 'Web Browser',
                                timestamp: log.timestamp,
                                status: log.status || 'Success'
                            });
                        }
                    });
                } catch (e) {
                    console.error('Fetch LoginLog error:', e.message);
                }

                try {
                    const users = await queryAllDBs(User, (M) => M.find({}));
                    users.forEach(u => {
                        if (!isMasterAdmin && userUsername && u.username !== userUsername) return;
                        if (Array.isArray(u.loginHistory)) {
                            u.loginHistory.forEach((log, idx) => {
                                const idStr = `u-${u._id}-${idx}`;
                                if (!seenIds.has(idStr)) {
                                    seenIds.add(idStr);
                                    allLogs.push({
                                        id: idStr,
                                        userId: u.userId || '-',
                                        username: u.username,
                                        name: u.name,
                                        role: u.role,
                                        brand: u.brand || 'SYSTEM',
                                        ip: log.ip || '127.0.0.1',
                                        deviceInfo: log.deviceInfo || 'Web Browser',
                                        timestamp: log.timestamp,
                                        status: log.status || 'Success'
                                    });
                                }
                            });
                        }
                    });
                } catch (e) {
                    console.error('Fetch User.loginHistory error:', e.message);
                }
            }

            if (MEM_DB && Array.isArray(MEM_DB.users)) {
                MEM_DB.users.forEach(u => {
                    if (!isMasterAdmin && userUsername && u.username !== userUsername) return;
                    if (Array.isArray(u.loginHistory)) {
                        u.loginHistory.forEach((log, idx) => {
                            const idStr = `mem-${u._id || u.username}-${idx}`;
                            if (!seenIds.has(idStr)) {
                                seenIds.add(idStr);
                                allLogs.push({
                                    id: idStr,
                                    userId: u.userId || '-',
                                    username: u.username,
                                    name: u.name,
                                    role: u.role,
                                    brand: u.brand || 'SYSTEM',
                                    ip: log.ip || '127.0.0.1',
                                    deviceInfo: log.deviceInfo || 'Web Browser',
                                    timestamp: log.timestamp,
                                    status: log.status || 'Success'
                                });
                            }
                        });
                    }
                });
            }

            allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (search) {
                const s = search.toLowerCase();
                allLogs = allLogs.filter(l =>
                    l.username.toLowerCase().includes(s) ||
                    l.name.toLowerCase().includes(s) ||
                    l.ip.toLowerCase().includes(s) ||
                    l.deviceInfo.toLowerCase().includes(s)
                );
            }
            if (role) {
                allLogs = allLogs.filter(l => l.role === role);
            }
            if (status) {
                allLogs = allLogs.filter(l => (l.status || '').toLowerCase() === status.toLowerCase());
            }

            const total = allLogs.length;
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const data = allLogs.slice(skip, skip + parseInt(limit));

            res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

export default router;
