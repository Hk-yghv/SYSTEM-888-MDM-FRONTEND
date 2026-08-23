import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import dns from 'dns';

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

const app = express();
app.disable('x-powered-by');

// CORS Hardening
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-System-API-Key', 'x-system-api-key', 'X-Request-Timestamp', 'x-request-timestamp'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 5000;

// Initialize Telegram Bot if token provided
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        setSecurityTelegramBot(bot);
        console.log('Telegram Bot initialized successfully & Security Notifier connected');
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

// ── Mount Modular Routes (Backend Primary: Auth, Users, Control, Dashboard) ──
app.use('/api/auth', createAuthRoutes(bot));
app.use('/api/users', userRoutes);
app.use('/api/controlsystem', controlRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
