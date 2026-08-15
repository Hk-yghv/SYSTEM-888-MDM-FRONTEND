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
import {
    sanitizeMiddleware,
    rateLimiterMiddleware,
    securityHeadersMiddleware,
    verifySecurityAuth
} from './middleware/security.js';

import createAuthRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import controlRoutes from './routes/controlRoutes.js';
import lostphoneRoutes from './routes/lostphoneRoutes.js';
import wallpaperRoutes from './routes/wallpaperRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import historyRoutes, { createHistoryRoutes } from './routes/historyRoutes.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/system_mdm';

// Initialize Telegram Bot if token provided
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        console.log('Telegram Bot initialized successfully');
    } catch (err) {
        console.error('Telegram Bot init error:', err.message);
    }
}

// ── Security & Sanitization Middlewares ──
app.use(sanitizeMiddleware);
app.use(rateLimiterMiddleware);
app.use(securityHeadersMiddleware);
app.use(verifySecurityAuth);

// ── Health Check ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Mount Modular Routes ──
app.use('/api/auth', createAuthRoutes(bot));
app.use('/api/users', userRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api', paymentRoutes);
app.use('/', paymentRoutes);
app.use('/api/controlsystem', controlRoutes);
app.use('/api', lostphoneRoutes);
app.use('/api', wallpaperRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/history', createHistoryRoutes(bot));

// ── Connect Database & Start Server ──
connectDB(MONGO_URI).then(() => {
    app.listen(PORT, () => {
        console.log(`SYSTEM MDM Backend server active on port ${PORT}`);
    });
});
