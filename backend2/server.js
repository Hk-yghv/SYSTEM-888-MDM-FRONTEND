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
    securityHeadersMiddleware,
    botFirewallMiddleware,
    pathAndCommandGuardMiddleware,
    antiReplayMiddleware,
    sensitiveDataMaskingMiddleware,
    sanitizeMiddleware,
    rateLimiterMiddleware,
    verifySecurityAuth,
    setSecurityTelegramBot
} from './middleware/security.js';

import lostphoneRoutes from './routes/lostphoneRoutes.js';
import wallpaperRoutes from './routes/wallpaperRoutes.js';
import historyRoutes, { createHistoryRoutes } from './routes/historyRoutes.js';

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

const PORT = process.env.PORT || 5002;

// Initialize Telegram Bot if token provided
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        setSecurityTelegramBot(bot);
        console.log('[Backend 2] Telegram Bot initialized successfully & Security Notifier connected');
    } catch (err) {
        console.error('[Backend 2] Telegram Bot init error:', err.message);
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
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'backend2-wallpaper-logs-history', timestamp: new Date() }));

// ── DB Status Endpoint ──
app.get('/api/db-status', (req, res) => res.json({
    databases: getDBStatus(),
    timestamp: new Date()
}));

// ── Mount Modular Routes (Backend 2: Wallpaper, PhoneLogs, History) ──
app.use('/api', lostphoneRoutes);
app.use('/api', wallpaperRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/history', createHistoryRoutes(bot));

app.use((err, req, res, next) => {
    console.error('[Backend 2] Unhandled System Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Security Notice: An unexpected system error occurred. Access attempt logged.'
    });
});

// ── Connect All Databases & Start Server ──
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`SYSTEM MDM Backend 2 (Wallpaper, Device Logs & History) active on port ${PORT} with Ultimate Security Shield`);
    });
});
