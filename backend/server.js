import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setDefaultResultOrder('ipv4first');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('DNS resolver forced to Google DNS (8.8.8.8, 8.8.4.4)');
} catch (e) {
    console.warn('DNS server override failed:', e.message);
}

dotenv.config();

import { connectDB } from './config/db.js';
import { getDBStatus } from './config/multiDB.js';
import {
    runFirebaseBackup,
    restoreFromFirebase,
    getFirebaseBackupStatus,
    startFirebaseBackupScheduler
} from './config/firebaseBackup.js';
import {
    securityHeadersMiddleware,
    botFirewallMiddleware,
    pathAndCommandGuardMiddleware,
    antiReplayMiddleware,
    sensitiveDataMaskingMiddleware,
    sanitizeMiddleware,
    rateLimiterMiddleware,
    verifySecurityAuth,
    requireAdminRole,
    setSecurityTelegramBot
} from './middleware/security.js';

import createAuthRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import controlRoutes from './routes/controlRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import phoneAppRoutes from './routes/phoneAppRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import lostphoneRoutes from './routes/lostphoneRoutes.js';
import wallpaperRoutes from './routes/wallpaperRoutes.js';
import historyRoutes, { createHistoryRoutes } from './routes/historyRoutes.js';
import cashTransactionRoutes from './routes/cashTransactionRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import followUp2Routes from './routes/followUp2Routes.js';
import followUpSenSokRoutes from './routes/followUpSenSokRoutes.js';
import followUp4Routes from './routes/followUp4Routes.js';
import {
    followUp1Routes,
    followUp2WorkspaceRoutes,
    followUp3Routes
} from './routes/followUpWorkspaceRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import savedUrlRoutes from './routes/savedUrlRoutes.js';
import supportHelpRoutes from './routes/supportHelpRoutes.js';
import calculateScheduleRoutes from './routes/calculateScheduleRoutes.js';
import calendarEventRoutes from './routes/calendarEventRoutes.js';
import { initTelegramBotService } from './services/telegramBotService.js';
import telegramRoutes from './routes/telegramRoutes.js';
import telegramAuditRoutes from './routes/telegramAuditRoutes.js';
import deviceAuditRoutes from './routes/deviceAuditRoutes.js';
import cashFlowTraderRoutes from './routes/cashFlowTraderRoutes.js';
import { installTelegramSendRetry } from './utils/telegramSendRetry.js';

const app = express();
app.disable('x-powered-by');

// CORS Hardening
const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(origin => origin && origin !== '*')
    : [];
const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-username', 'X-System-API-Key', 'x-system-api-key', 'X-Partner-API-Key', 'x-partner-api-key', 'X-Request-Timestamp', 'x-request-timestamp', 'X-Telegram-Media-Type', 'X-File-Name', 'X-File-Mime-Type', 'Cache-Control', 'cache-control', 'Pragma', 'pragma'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 5000;

// Initialize Telegram Bot if token provided
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        installTelegramSendRetry(bot);
        bot.on('polling_error', (err) => {
            // Log warning without crashing server on transient network glitches
            console.warn('[TelegramBot Polling]:', err.message);
        });
        setSecurityTelegramBot(bot);
        initTelegramBotService(bot);
        console.log('Telegram Bot initialized successfully & Interactive /sys Bot Service connected');
    } catch (err) {
        console.error('Telegram Bot init error:', err.message);
    }
}

// ── Military-Grade Multi-Layer Security Pipeline ──
app.use(securityHeadersMiddleware);
app.use(botFirewallMiddleware);
app.use(pathAndCommandGuardMiddleware);
app.use(antiReplayMiddleware);
app.use(sensitiveDataMaskingMiddleware);
app.use(sanitizeMiddleware);
app.use(rateLimiterMiddleware);
app.use(verifySecurityAuth);

// ── Health Check (Public Endpoint) ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'backend-primary', timestamp: new Date() }));

// ── DB Status & Firebase Backup Info (Protected Endpoint) ──
app.get('/api/db-status', (req, res) => res.json({
    databases: getDBStatus(),
    firebaseBackup: getFirebaseBackupStatus(),
    timestamp: new Date()
}));

// ── Manual Firebase Backup Trigger Endpoint (Protected Admin-Only Endpoint) ──
app.all(['/api/db-status/backup-firebase', '/api/backup-firebase'], requireAdminRole, async (req, res) => {
    try {
        const result = await runFirebaseBackup();
        res.json({
            message: result.success ? 'Firebase database backup completed successfully!' : 'Firebase backup failed or missing configuration.',
            result,
            firebaseStatus: getFirebaseBackupStatus()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Restore MongoDB from Firebase Backup (Protected Admin-Only Endpoint) ──
app.all(['/api/db-status/restore-firebase', '/api/restore-firebase', '/api/controlsystem/restore-firebase'], requireAdminRole, async (req, res) => {
    try {
        const result = await restoreFromFirebase();
        res.json({
            message: 'Firebase database backup restored successfully into MongoDB!',
            result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Mount All Routes (Unified Multi-API Backend Cluster) ──
app.use('/api/auth', createAuthRoutes(bot));
app.use('/api/users', userRoutes);
app.use('/api/controlsystem', controlRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/phone-app', phoneAppRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/contracts', contractRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', paymentRoutes);
app.use('/payments', paymentRoutes);
app.use('/pay', paymentRoutes);
app.use('/api', lostphoneRoutes);
app.use('/api', wallpaperRoutes);
app.use('/api/history', createHistoryRoutes(bot));
app.use('/api', cashTransactionRoutes);
app.use('/api/follow-up', followUpRoutes);
app.use('/api/follow-up-1', followUp1Routes);
app.use('/api/follow-up-2', followUp2WorkspaceRoutes);
app.use('/api/follow-up-2', followUp2Routes);
app.use('/api/followup2', followUp2Routes);
app.use('/api/follow-up-3', followUp3Routes);
app.use('/api/followup-3', followUp3Routes);
app.use('/api/follow-up-4', followUp4Routes);
app.use('/api/followup-4', followUp4Routes);
app.use('/api/followup3', followUpSenSokRoutes);
app.use('/api/follow-up-sen-sok', followUpSenSokRoutes);
app.use('/api/followup-sensok', followUpSenSokRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/salary', salaryRoutes);
app.use('/api/saved-urls', savedUrlRoutes);
app.use('/saved-urls', savedUrlRoutes);
app.use('/api/support-help', supportHelpRoutes);
app.use('/support-help', supportHelpRoutes);
app.use('/api/calculate-schedules', calculateScheduleRoutes);
app.use('/calculate-schedules', calculateScheduleRoutes);
app.use('/api/calendar-events', calendarEventRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/telegram-audit', telegramAuditRoutes);
app.use('/api/device-audit', deviceAuditRoutes);
app.use('/telegram-audit', telegramAuditRoutes);
app.use('/api/cashflow-trader', cashFlowTraderRoutes);
app.use('/cashflow-trader', cashFlowTraderRoutes);

// ── Interactive HTML Partner API Documentation Route ──
const docsHtmlPath = path.resolve(__dirname, '../docs/index.html');
app.get(['/docs', '/api-docs', '/api/docs'], (req, res) => {
    res.sendFile(docsHtmlPath);
});

app.use((err, req, res, next) => {
    console.error('Unhandled System Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Security Notice: An unexpected system error occurred. Access attempt logged.'
    });
});

// ── Connect All Databases & Start Server ──
connectDB().then(() => {
    startFirebaseBackupScheduler();
    app.listen(PORT, () => {
        console.log(`SYSTEM MDM Backend Server 0 (Auth/Users/Control/Dashboard) active on port ${PORT} with Ultimate Security Shield`);
    });
});
