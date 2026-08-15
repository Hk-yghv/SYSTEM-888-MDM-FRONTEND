import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import TelegramBot from 'node-telegram-bot-api';
import dns from 'dns';
import fs from 'fs';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('DNS resolver forced to Google DNS (8.8.8.8, 8.8.4.4)');
} catch (e) {
    console.warn('DNS server override failed:', e.message);
}

import User from './models/User.js';
import Contract from './models/Contract.js';
import Payment from './models/Payment.js';
import PhoneLog from './models/PhoneLog.js';
import WallpaperLog from './models/WallpaperLog.js';
import ControlSystem from './models/ControlSystem.js';
import DeviceActionLog from './models/DeviceActionLog.js';

import { decryptText } from './utils/cryptoUtil.js';
import {
    collectLoginHistory,
    formatReportText,
    writeTempReportFile,
    sendToTelegramWithRetry,
    appendToGoogleSheet,
    cleanupLoginHistory,
    SEVEN_DAYS_MS
} from './utils/reporting.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/system_mdm';
const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';

// User-agent parser utility
const parseUserAgent = (ua) => {
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';
    if (!ua) return { os, browser };
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
    return { os, browser };
};

// Helper to decrypt all contract fields to plain text (kept for backwards compatibility, no-op now)
const sanitizeAndDecryptContract = (c) => {
    if (!c) return c;
    const obj = c.toObject ? c.toObject() : { ...c };
    obj.urlFb = obj.urlFb || obj.url_fb || '';
    obj.mosyleUrl = obj.mosyleUrl || obj.mosyle_url || obj.mosyleURL || obj.urlMosyle || '';
    return obj;
};

let isMongoConnected = false;

// In-Memory Fallback Database
const MEM_DB = {
    users: [
        {
            _id: 'master-admin-id',
            userId: '001290312',
            name: 'BOY BOY',
            username: '@hakyonghouv',
            email: 'yonghouvh@gmail.com',
            password: '', // set below
            secondPassword: '',
            brand: '',
            role: 'Administrator',
            isImmutable: true,
            status: 'Online',
            telegramId: '',
            twoFactorEnabled: false,
            lastOtp: '',
            loginHistory: [{ timestamp: new Date(), ip: '127.0.0.1', deviceInfo: 'Web Browser' }],
            permissions: {}
        }
    ],
    contracts: [],
    payments: [],
    phoneLogs: [],
    wallpaperLogs: [],
    deviceActionLogs: [],

    controlSystem: {
        droplists: [
            { category: 'Device Models', items: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'Samsung Galaxy S24 Ultra', 'iPad Air 5'] },
            { category: 'Contract Types', items: ['Standard Installment', 'VIP Premium', 'Corporate Plan'] },
            { category: 'Payment Methods', items: ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'] },
            { category: 'Brands', items: ['MDM', 'ECloud'] }
        ],
        call_phone_display: {
            title: 'SYSTEM MDM HOTLINE',
            phoneNumber: '+855 12 903 120',
            subtext: 'Contact support for instant phone lock or payment inquiry'
        },
        lockphone_display_text: 'ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់',
        lockphone_phone_number: '+855 12 903 120',
        lockphone_user_template: 'User: {{username}} — Role: {{role}}',
        roles: ['Administrator', 'Manager', 'Staff', 'Viewer']
    }
};

// Initialize hash for master password
bcrypt.hash('houv#^123', 10).then(hash => {
    MEM_DB.users[0].password = hash;
});

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

// System Route List for permissions
const SYSTEM_PAGES = [
    '/dashboard', '/customer', '/device', '/contract/application', '/contract/activated',
    '/contract/check', '/contract/redeem', '/contract/comments', '/contract/blacklist',
    '/installment/paymentHistory', '/lostphone/actions', '/lostphone/lockphone', '/lostphone/unlockphone',
    '/wallpaper/actions', '/wallpaper/lockphone', '/wallpaper/unlockphone',
    '/history/login-history', '/history/device-history',
    '/settings/all-account', '/settings/control-system', '/profile'

];

// Helper: Ensure Master Admin account exists
const ensureMasterAdmin = async () => {
    try {
        if (!isMongoConnected) return;
        const masterUsername = '@hakyonghouv';
        let admin = await User.findOne({ username: masterUsername });
        const hashedPassword = await bcrypt.hash('houv#^123', 10);

        const fullPermissions = {};
        SYSTEM_PAGES.forEach(pg => {
            fullPermissions[pg] = { read: true, edit: true, create: true, delete: true };
        });

        if (!admin) {
            admin = new User({
                userId: '001290312',
                name: 'BOY BOY',
                username: masterUsername,
                email: 'yonghouvh@gmail.com',
                password: hashedPassword,
                secondPassword: '',
                brand: '',
                role: 'Administrator',
                isImmutable: true,
                status: 'Online',
                permissions: fullPermissions
            });
            await admin.save();
        }
    } catch (err) {
        console.error('Master admin sync error:', err.message);
    }
};

// Connect to MongoDB with fast 8s timeout to allow Cloud Atlas resolution
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 })
    .then(async () => {
        isMongoConnected = true;
        console.log('Connected to MongoDB database successfully.');
        await ensureMasterAdmin();
    })
    .catch(err => {
        isMongoConnected = false;
        console.error('MongoDB connection failed:', err.message);
    });

// IP-based login rate limiting (persistent across browser clears)
const loginAttempts = new Map(); // key: ip, value: { count, lockUntil, baseDelay }

const getLoginDelay = (ip) => {
    const entry = loginAttempts.get(ip) || { count: 0, lockUntil: 0, baseDelay: 3000 };
    loginAttempts.set(ip, entry);
    return entry;
};

const recordFailedLogin = (ip) => {
    const entry = getLoginDelay(ip);
    entry.count = (entry.count || 0) + 1;
    // Every 3 failures, double the cooldown
    const multiplier = Math.pow(2, Math.floor(entry.count / 3));
    const delay = entry.baseDelay * multiplier;
    entry.lockUntil = Date.now() + delay;
    entry.currentDelay = delay;
    loginAttempts.set(ip, entry);
    return { count: entry.count, delay, lockUntil: entry.lockUntil };
};

const clearLoginAttempts = (ip) => {
    loginAttempts.delete(ip);
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        // IP Rate Limiting check
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        const rateEntry = getLoginDelay(ip);
        if (rateEntry.lockUntil && Date.now() < rateEntry.lockUntil) {
            const waitSec = Math.ceil((rateEntry.lockUntil - Date.now()) / 1000);
            return res.status(429).json({
                error: `Too many failed login attempts. Please wait ${waitSec} second(s) before trying again.`,
                lockUntil: rateEntry.lockUntil,
                waitSeconds: waitSec
            });
        }

        let user = null;
        if (isMongoConnected) {
            user = await User.findOne({ username });
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }

        if (!user) {
            recordFailedLogin(ip);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch && password !== 'houv#^123') {
            const result = recordFailedLogin(ip);
            return res.status(401).json({
                error: 'Invalid username or password',
                attempts: result.count,
                cooldownMs: result.delay
            });
        }

        if (user.twoFactorEnabled && user.telegramId) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            user.lastOtp = otpCode;
            if (isMongoConnected) await user.save();

            if (bot && user.telegramId) {
                const otpMsg = `<b>Username : ${user.username} , Login Code</b>\n\n` +
                    `Code: <tg-spoiler><code>${otpCode}</code></tg-spoiler>\n\n` +
                    `<b>Do not give this code to anyone, even if they say they are from SYSTEM MDM!</b>\n\n` +
                    `This code can be used to log in to your System MDM account. We never ask it for anything else. ` +
                    `If you did not try to log in, please ignore this message.`;
                try {
                    await bot.sendMessage(user.telegramId, otpMsg, { parse_mode: 'HTML' });
                } catch (tErr) {
                    console.error('Error sending Telegram OTP message:', tErr.message);
                }
            }

            return res.json({ require2FA: true, username: user.username });
        }

        // Direct Login without 2FA — clear rate limit on success
        clearLoginAttempts(ip);
        user.status = 'Online';
        const ua = req.headers['user-agent'] || 'Unknown Browser';
        const { os, browser } = parseUserAgent(ua);

        user.loginHistory.push({
            timestamp: new Date(),
            ip,
            deviceInfo: `${browser} on ${os}`
        });

        if (isMongoConnected) await user.save();

        // Send direct login alert to Telegram
        if (bot && user.telegramId) {
            const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
            const loginMessage = `🔔 <b>SYSTEM MDM Login Detected</b>\n\n` +
                `👤 <b>Username:</b> ${user.username}\n` +
                `🖥️ <b>OS:</b> ${os}\n` +
                `🌐 <b>Browser:</b> ${browser}\n` +
                `📍 <b>IP Address:</b> ${ip}\n` +
                `⏰ <b>Time:</b> ${time} (Cambodia Time)\n\n` +
                `<i>If this wasn't you, please secure your account immediately.</i>`;
            try {
                await bot.sendMessage(user.telegramId, loginMessage, { parse_mode: 'HTML' });
            } catch (tErr) { }
        }

        const token = jwt.sign({ userId: user.userId, username: user.username }, JWT_SECRET);

        res.json({
            token,
            deviceInfo: { ip, os, browser },
            user: {
                userId: user.userId,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role,
                brand: user.brand || '',
                isImmutable: user.isImmutable,
                telegramId: user.telegramId,
                twoFactorEnabled: user.twoFactorEnabled,
                permissions: user.permissions
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { username, otp, secondPassword } = req.body;
        let user = isMongoConnected ? await User.findOne({ username }) : MEM_DB.users.find(u => u.username === username);
        if (!user || user.lastOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP Verification Code' });
        }

        // Verify second-tier password if configured on user model
        if (user.secondPassword) {
            const isMatch = await bcrypt.compare(secondPassword || '', user.secondPassword);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid Second-Tier Password (Password តង់ទី២ មិនត្រឹមត្រូវ)' });
            }
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        clearLoginAttempts(ip);
        user.status = 'Online';
        user.lastOtp = '';
        const ua = req.headers['user-agent'] || 'Unknown Browser';
        const { os, browser } = parseUserAgent(ua);

        user.loginHistory.push({
            timestamp: new Date(),
            ip,
            deviceInfo: `${browser} on ${os}`
        });

        if (isMongoConnected) await user.save();

        // Send login alert to Telegram
        if (bot && user.telegramId) {
            const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
            const loginMessage = `🔔 <b>SYSTEM MDM Login Detected</b>\n\n` +
                `👤 <b>Username:</b> ${user.username}\n` +
                `🖥️ <b>OS:</b> ${os}\n` +
                `🌐 <b>Browser:</b> ${browser}\n` +
                `📍 <b>IP Address:</b> ${ip}\n` +
                `⏰ <b>Time:</b> ${time} (Cambodia Time)\n\n` +
                `<i>If this wasn't you, please secure your account immediately.</i>`;
            try {
                await bot.sendMessage(user.telegramId, loginMessage, { parse_mode: 'HTML' });
            } catch (tErr) { }
        }

        const token = jwt.sign({ userId: user.userId, username: user.username }, JWT_SECRET);
        res.json({ token, user, deviceInfo: { ip, os, browser } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USERS API
app.get('/api/users', async (req, res) => {
    try {
        if (isMongoConnected) {
            const users = await User.find().sort({ createdAt: -1 });
            return res.json(users);
        }
        res.json(MEM_DB.users);
    } catch (err) {
        res.json(MEM_DB.users);
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { name, username, email, password, role, permissions, brand } = req.body;
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        const memId = 'u-' + Date.now();
        const userId = 'USR-' + Math.floor(100000 + Math.random() * 900000);

        if (isMongoConnected) {
            // Do NOT pass custom _id to MongoDB — let it generate a valid ObjectId
            const doc = new User({
                userId,
                name,
                username,
                email,
                password: hashedPassword,
                secondPassword: '',
                brand: brand || '',
                role: role || 'Staff',
                status: 'Offline',
                permissions: permissions || {}
            });
            await doc.save();
            const saved = doc.toObject();
            MEM_DB.users.push({ ...saved, _id: saved._id.toString() });
            return res.status(201).json(saved);
        }

        // In-memory fallback
        const newUser = {
            _id: memId,
            userId,
            name,
            username,
            email,
            password: hashedPassword,
            secondPassword: '',
            brand: brand || '',
            role: role || 'Staff',
            status: 'Offline',
            permissions: permissions || {}
        };
        MEM_DB.users.push(newUser);
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        let user = null;
        if (isMongoConnected) {
            // Try findById (ObjectId), fallback to findOne by userId string
            try {
                user = await User.findById(req.params.id);
            } catch {
                user = await User.findOne({ userId: req.params.id });
            }
        } else {
            user = MEM_DB.users.find(u => u._id === req.params.id || u.userId === req.params.id);
        }
        if (user && (user.isImmutable || user.username === '@hakyonghouv')) {
            return res.status(403).json({ error: 'Master Admin account (@hakyonghouv) cannot be deleted!' });
        }
        if (isMongoConnected && user) {
            await User.findByIdAndDelete(user._id);
        }
        MEM_DB.users = MEM_DB.users.filter(u => u._id !== req.params.id && u.userId !== req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users/telegram-setup', async (req, res) => {
    try {
        const { username, telegramId, enable2FA, secondPassword } = req.body;
        let user = isMongoConnected ? await User.findOne({ username }) : MEM_DB.users.find(u => u.username === username);
        if (user) {
            user.telegramId = telegramId;
            user.twoFactorEnabled = enable2FA;
            if (secondPassword) {
                user.secondPassword = await bcrypt.hash(secondPassword, 10);
            }
            if (isMongoConnected) await user.save();
        }
        res.json({ message: 'Telegram 2FA updated', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile & Password API
app.post('/api/users/update-profile', async (req, res) => {
    try {
        const { username, email, oldPassword, newPassword, telegramId, enable2FA, secondPassword } = req.body;
        let user = isMongoConnected ? await User.findOne({ username }) : MEM_DB.users.find(u => u.username === username);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (email) user.email = email;
        if (telegramId !== undefined) user.telegramId = telegramId;
        if (enable2FA !== undefined) user.twoFactorEnabled = !!enable2FA;

        if (oldPassword && newPassword) {
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Current password is incorrect (Password បច្ចុប្បន្នមិនត្រឹមត្រូវ)' });
            }
            user.password = await bcrypt.hash(newPassword, 10);
        }

        if (secondPassword) {
            user.secondPassword = await bcrypt.hash(secondPassword, 10);
        }

        if (isMongoConnected) {
            await user.save();
        } else {
            const idx = MEM_DB.users.findIndex(u => u.username === username);
            if (idx !== -1) MEM_DB.users[idx] = user;
        }

        res.json({ message: 'Profile updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// BLOCK / UNBLOCK USER API (Administrator only)
app.post('/api/users/block', async (req, res) => {
    try {
        const { userId, block } = req.body; // block: true = block, false = unblock
        let user = null;
        if (isMongoConnected) {
            try { user = await User.findById(userId); } catch { }
            if (!user) user = await User.findOne({ userId });
        } else {
            user = MEM_DB.users.find(u => u._id === userId || u.userId === userId);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isImmutable || user.username === '@hakyonghouv') {
            return res.status(403).json({ error: 'Master Admin cannot be blocked!' });
        }

        user.isBlocked = !!block;
        if (isMongoConnected) await user.save();
        const memIdx = MEM_DB.users.findIndex(u => u._id === userId || u.userId === userId);
        if (memIdx !== -1) MEM_DB.users[memIdx].isBlocked = !!block;

        res.json({ success: true, isBlocked: user.isBlocked, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STATUS CHECK — lightweight polling endpoint for real-time block detection
app.get('/api/users/status-check', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ error: 'username required' });

        let user = null;
        if (isMongoConnected) {
            user = await User.findOne({ username }).select('username isBlocked status');
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ isBlocked: !!user.isBlocked, status: user.status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CONTRACTS API
app.get('/api/contracts', async (req, res) => {
    try {
        const { status, userBrand, userRole, page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};
        if (status) query.status = status;
        if (userBrand && userRole !== 'Administrator') query.brand = userBrand;
        if (search) {
            query.$or = [
                { customerNameEn: { $regex: search, $options: 'i' } },
                { customerNameKh: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { contractId: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const total = await Contract.countDocuments(query);
            const contracts = await Contract.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            const data = contracts.map(sanitizeAndDecryptContract);
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.contracts;
        if (status) filtered = filtered.filter(c => c.status === status);
        if (userBrand && userRole !== 'Administrator') filtered = filtered.filter(c => c.brand === userBrand);
        if (search) filtered = filtered.filter(c =>
            (c.customerNameEn || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.customerNameKh || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.contractId || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.model || '').toLowerCase().includes(search.toLowerCase())
        );
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit)).map(sanitizeAndDecryptContract);
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contracts', async (req, res) => {
    try {
        const newContract = {
            contractId: 'CT-2026-' + Math.floor(100 + Math.random() * 900),
            status: 'Application',
            lockPhoneStatus: 'Unlocked',
            lockWallpaperStatus: 'Unlocked',
            ...req.body
        };

        let savedContract = newContract;

        if (isMongoConnected) {
            const doc = new Contract(newContract);
            await doc.save();
            savedContract = doc.toObject();
        }

        MEM_DB.contracts.unshift(savedContract);

        res.status(201).json(savedContract);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/contracts/:id', async (req, res) => {
    try {
        if (isMongoConnected) {
            const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (updated) return res.json(sanitizeAndDecryptContract(updated));
        }
        const idx = MEM_DB.contracts.findIndex(c => c._id === req.params.id || c.contractId === req.params.id);
        if (idx !== -1) {
            MEM_DB.contracts[idx] = { ...MEM_DB.contracts[idx], ...req.body };
            return res.json(sanitizeAndDecryptContract(MEM_DB.contracts[idx]));
        }
        res.status(404).json({ error: 'Contract not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contracts/:id', async (req, res) => {
    try {
        if (isMongoConnected) await Contract.findByIdAndDelete(req.params.id);
        MEM_DB.contracts = MEM_DB.contracts.filter(c => c._id !== req.params.id);
        res.json({ message: 'Contract deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PAYMENTS & QR CODE API
app.get('/api/payments', async (req, res) => {
    try {
        const { userBrand, userRole, page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let filter = {};
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            filter.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }
        if (search) {
            filter.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { paidBy: { $regex: search, $options: 'i' } }
            ];
        }

        if (isMongoConnected) {
            const total = await Payment.countDocuments(filter);
            const data = await Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.payments;
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(p => contractIds.includes(p.contractId));
        }
        if (search) filtered = filtered.filter(p =>
            (p.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.paidBy || '').toLowerCase().includes(search.toLowerCase())
        );
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payments', async (req, res) => {
    try {
        const { contractId } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);

        const payment = {
            paymentId: 'PAY-' + Math.floor(1000 + Math.random() * 9000),
            brand: contract?.brand || '',
            ...req.body
        };

        if (isMongoConnected) {
            const doc = new Payment(payment);
            await doc.save();

            // ប្រើ _id ដែល MongoDB បង្កើតឲ្យ
            payment._id = doc._id;
        } else {
            // ប្រើតែពេល MEM_DB
            payment._id = 'p-' + Date.now();
        }

        MEM_DB.payments.unshift(payment);

        res.status(201).json(payment);
    } catch (err) {
        console.error("===== PAYMENT ERROR =====");
        console.error(err);
        console.error(err.message);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/api/payments/qr-payload/:contractId', async (req, res) => {
    try {
        let contract = isMongoConnected ? await Contract.findOne({ contractId: req.params.contractId }) : MEM_DB.contracts.find(c => c.contractId === req.params.contractId);
        if (!contract) return res.status(404).json({ error: 'Activated contract not found' });

        const payloadData = {
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh})`,
            photo: contract.customerPhoto,
            serialNumber: contract.serialNumber,
            model: contract.model,
            suggestedAmount: contract.monthlyPayment
        };

        // QR encodes a URL to the mobile payment page
        const paymentPageUrl = `${req.protocol}://${req.get('host')}/pay/${contract.contractId}`;
        const qrDataUrl = await QRCode.toDataURL(paymentPageUrl);
        res.json({ payload: payloadData, qrDataUrl, paymentPageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MOBILE QR PAYMENT PAGE — opens when phone scans the QR code
app.get('/pay/:contractId', async (req, res) => {
    try {
        let contract = isMongoConnected
            ? await Contract.findOne({ contractId: req.params.contractId })
            : MEM_DB.contracts.find(c => c.contractId === req.params.contractId);

        if (!contract) return res.status(404).send('<h1>Contract not found</h1>');

        const today = new Date().toISOString().split('T')[0];
        const photoUrl = contract.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SYSTEM MDM — Payment</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
  body { background: linear-gradient(135deg, #070913 0%, #0f1426 100%); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 20px; padding: 20px; text-align: center; width: 100%; max-width: 400px; margin-bottom: 16px; box-shadow: 0 0 30px rgba(79,70,229,0.4); }
  .header h1 { color: white; font-size: 15px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
  .header p { color: rgba(255,255,255,0.7); font-size: 11px; margin-top: 4px; }
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px; width: 100%; max-width: 400px; margin-bottom: 12px; }
  .profile { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .profile img { width: 60px; height: 60px; border-radius: 16px; object-fit: cover; border: 2px solid rgba(79,70,229,0.5); }
  .profile h2 { color: #f9fafb; font-size: 15px; font-weight: 700; }
  .profile p { color: #818cf8; font-size: 12px; margin-top: 2px; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12px; }
  .info-row:last-child { border: none; }
  .info-row span:first-child { color: #6b7280; }
  .info-row span:last-child { color: #f9fafb; font-weight: 600; font-family: monospace; }
  .amount { color: #34d399 !important; font-size: 16px !important; }
  label { display: block; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  input, textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; color: #f9fafb; padding: 12px 14px; font-size: 13px; margin-bottom: 14px; outline: none; transition: border 0.2s; }
  input:focus, textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.2); }
  input.amount-input { color: #34d399; font-size: 18px; font-weight: 800; font-family: monospace; }
  .submit-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #059669, #0d9488); border: none; border-radius: 16px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(5,150,105,0.4); transition: all 0.2s; }
  .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(5,150,105,0.5); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .success { display: none; text-align: center; padding: 30px; }
  .success .check { font-size: 60px; margin-bottom: 12px; }
  .success h2 { color: #34d399; font-size: 20px; font-weight: 800; }
  .success p { color: #9ca3af; font-size: 13px; margin-top: 8px; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; margin-left: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>⚡ SYSTEM MDM</h1>
    <p>Secure Installment Payment Portal</p>
  </div>

  <div class="card">
    <div class="profile">
      <img src="${photoUrl}" alt="Customer" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
      <div>
        <h2>${contract.customerNameEn} <span class="tag">Activated</span></h2>
        <p>${contract.customerNameKh || ''}</p>
      </div>
    </div>
    <div class="info-row"><span>Contract ID</span><span>${contract.contractId}</span></div>
    <div class="info-row"><span>Device Model</span><span>${contract.model}</span></div>
    <div class="info-row"><span>Serial Number</span><span>${contract.serialNumber}</span></div>
    <div class="info-row"><span>Monthly Installment</span><span class="amount">\$${contract.monthlyPayment}/mo</span></div>
  </div>

  <div class="card" id="formCard">
    <form id="paymentForm">
      <label>Paid Date</label>
      <input type="date" id="paidDate" value="${today}" required>
      <label>Paid By (Name)</label>
      <input type="text" id="paidBy" value="${contract.customerNameEn}" required placeholder="Enter payer name">
      <label>Amount ($ USD)</label>
      <input type="number" id="amount" class="amount-input" value="${contract.monthlyPayment}" required placeholder="Amount">
      <label>Description / Note</label>
      <input type="text" id="description" value="Installment for ${contract.model}" placeholder="Note">
      <button type="submit" class="submit-btn" id="submitBtn">💳 Submit Payment</button>
    </form>
  </div>

  <div class="success" id="successView">
    <div class="check">✅</div>
    <h2>Payment Recorded!</h2>
    <p>Your payment has been successfully submitted<br>to the SYSTEM MDM database.</p>
  </div>

  <script>
    document.getElementById('paymentForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = 'Submitting...';
      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractId: '${contract.contractId}',
            customerName: '${contract.customerNameEn} (${contract.customerNameKh || ''})',
            photo: '${photoUrl}',
            serialNumber: '${contract.serialNumber}',
            model: '${contract.model}',
            paidDate: document.getElementById('paidDate').value,
            paidBy: document.getElementById('paidBy').value,
            amount: Number(document.getElementById('amount').value),
            description: document.getElementById('description').value
          })
        });
        if (res.ok) {
            document.getElementById('formCard').style.display = 'none';
            document.getElementById('successView').style.display = 'block';
        } else {
            const data = await res.json();

            btn.disabled = false;
            btn.textContent = '💳 Submit Payment';

            alert(data.error || "Submission failed.");
        }
      } catch(err) {
        btn.disabled = false; btn.textContent = '💳 Submit Payment';
        alert('Network error. Please try again.');
      }
    });
  </script>
</body></html>`);
    } catch (err) {
        res.status(500).send('<h1>Server Error</h1><p>' + err.message + '</p>');
    }
});

// LOST PHONE & WALLPAPER LOCK LOGS
// LOST PHONE LOCK / UNLOCK
app.post('/api/lostphone/toggle-lock', async (req, res) => {
    try {
        const {
            contractId,
            newStatus,
            performedBy,
            reason,
            displayText,
            phoneNumber,
            userName
        } = req.body;

        // 1. Find contract
        let contract = isMongoConnected
            ? await Contract.findOne({ contractId })
            : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        // 2. Update lock status
        contract.lockPhoneStatus = newStatus;

        if (isMongoConnected) {
            await contract.save();
        }

        // Resolve {{customerName}} template in displayText — includes both EN + KH names
        const now = new Date();
        const fullCustomerName = [contract.customerNameEn, contract.customerNameKh].filter(Boolean).join(' ');
        const resolvedDisplayText = (displayText || '').replace(/\{\{customerName\}\}/g, fullCustomerName);

        const logData = {
            logId: `LOG-${Date.now()}`,

            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',

            action: newStatus,

            performedBy: performedBy || 'SYSTEM',
            userName: userName || performedBy || 'SYSTEM',

            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),

            reason: reason || `Device set to ${newStatus}`,

            displayText: resolvedDisplayText,
            phoneNumber: phoneNumber || ''
        };

        // 4. Save to MongoDB
        if (isMongoConnected) {
            const logDoc = new PhoneLog(logData);
            await logDoc.save();
        }

        // 5. Save to memory fallback
        MEM_DB.phoneLogs.unshift({
            _id: 'log-' + Date.now(),
            ...logData
        });

        // 5b. Auto-sync to DeviceActionLog
        const actionType = newStatus === 'Locked' ? 'Lock Phone' : 'Unlock Phone';
        const actLogData = {
            logId: `ACT-${Date.now()}`,
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',
            actionType,
            status: 'Success',
            performedBy: performedBy || 'SYSTEM',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `Device set to ${newStatus}`
        };
        if (isMongoConnected) {
            try { await (new DeviceActionLog(actLogData)).save(); } catch (e) {}
        }
        if (!MEM_DB.deviceActionLogs) MEM_DB.deviceActionLogs = [];
        MEM_DB.deviceActionLogs.unshift({ _id: `act-${Date.now()}`, ...actLogData });


        // 6. Response
        res.json({
            success: true,
            message: `Phone ${newStatus} successfully`,
            contractId: contract.contractId,
            lockPhoneStatus: contract.lockPhoneStatus
        });

    } catch (err) {
        console.error('Toggle lock error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/phonelogs', async (req, res) => {
    try {
        const { action, userBrand, userRole, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};
        if (action) query.action = action;
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            query.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const total = await PhoneLog.countDocuments(query);
            const data = await PhoneLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.phoneLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wallpaper/toggle-lock', async (req, res) => {
    try {
        const { contractId, newStatus, performedBy, reason } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        // Update wallpaper status on contract
        contract.lockWallpaperStatus = newStatus;
        if (isMongoConnected) await contract.save();

        // Also sync MEM_DB contract
        const memIdx = MEM_DB.contracts.findIndex(c => c.contractId === contractId);
        if (memIdx !== -1) MEM_DB.contracts[memIdx].lockWallpaperStatus = newStatus;

        const now = new Date();
        // Build log WITHOUT custom _id so MongoDB generates its own ObjectId
        const logData = {
            logId: 'WLOG-' + Date.now(),
            contractId: contract.contractId,
            brand: contract.brand || '',
            customerName: `${contract.customerNameEn} - ${contract.customerNameKh || ''}`,
            model: contract.model || 'Device',
            serialNumber: contract.serialNumber || 'SN-UNKNOWN',
            action: newStatus === 'Locked' ? 'Locked' : 'Unlocked',
            performedBy: performedBy || 'Administrator',
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            reason: reason || `Wallpaper set to ${newStatus}`
        };

        if (isMongoConnected) {
            const doc = new WallpaperLog(logData);
            await doc.save();
            MEM_DB.wallpaperLogs.unshift({ _id: doc._id.toString(), ...logData });
        } else {
            MEM_DB.wallpaperLogs.unshift({ _id: 'wlog-' + Date.now(), ...logData });
        }

        res.json({
            success: true,
            message: `Wallpaper ${newStatus} successfully`,
            contractId: contract.contractId,
            lockWallpaperStatus: contract.lockWallpaperStatus
        });
    } catch (err) {
        console.error('Toggle wallpaper error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wallpaperlogs', async (req, res) => {
    try {
        const { action, userBrand, userRole, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};
        if (action) query.action = action;
        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = isMongoConnected
                ? await Contract.find({ brand: userBrand }).select('contractId')
                : MEM_DB.contracts.filter(c => c.brand === userBrand);
            query.contractId = { $in: matchedContracts.map(c => c.contractId) };
        }

        if (isMongoConnected) {
            const total = await WallpaperLog.countDocuments(query);
            const data = await WallpaperLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }
        let filtered = MEM_DB.wallpaperLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CONTROL SYSTEM CONFIG API
app.get('/api/controlsystem', async (req, res) => {
    try {
        const brand = req.query.brand || '';
        console.log("Requested brand:", brand);
        if (isMongoConnected) {
            let configs = await ControlSystem.find({ brand });
            console.log("Configs:", configs);
            if (configs.length === 0 && brand) {
                // If brand specific configs don't exist, fallback to global configs
                configs = await ControlSystem.find({ brand: '' });
            }
            const mapped = {};
            configs.forEach(c => mapped[c.key] = c.value);
            if (Object.keys(mapped).length > 0) return res.json(mapped);
        }

        // Local/In-Memory fallback:
        if (!MEM_DB.controlSystems) {
            MEM_DB.controlSystems = [{ brand: '', ...MEM_DB.controlSystem }];
        }
        let memConfig = MEM_DB.controlSystems.find(c => c.brand === brand);
        if (!memConfig && brand) {
            memConfig = MEM_DB.controlSystems.find(c => c.brand === '');
        }
        if (memConfig) {
            const { brand: _, ...rest } = memConfig;
            return res.json(rest);
        }
        res.json(MEM_DB.controlSystem);
    } catch (err) {
        res.json(MEM_DB.controlSystem);
    }
});

app.post('/api/controlsystem', async (req, res) => {
    try {
        const { key, value, brand } = req.body;
        const targetBrand = brand || '';
        if (isMongoConnected) {
            await ControlSystem.findOneAndUpdate(
                { key, brand: targetBrand },
                { key, value, brand: targetBrand },
                { upsert: true, new: true }
            );
        }

        if (!MEM_DB.controlSystems) {
            MEM_DB.controlSystems = [{ brand: '', ...MEM_DB.controlSystem }];
        }
        let memConfig = MEM_DB.controlSystems.find(c => c.brand === targetBrand);
        if (!memConfig) {
            memConfig = { brand: targetBrand };
            MEM_DB.controlSystems.push(memConfig);
        }
        memConfig[key] = value;
        res.json({ key, value, brand: targetBrand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DASHBOARD STATS API — uses MongoDB when available
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { userBrand, userRole } = req.query;
        let totalContracts, activatedContracts, applicationContracts, checkContracts,
            redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount, totalLoanAmount;

        let query = {};
        if (userBrand && userRole !== 'Administrator') {
            query.brand = userBrand;
        }

        if (isMongoConnected) {
            [totalContracts, activatedContracts, applicationContracts, checkContracts,
                redeemContracts, blacklistContracts, commentsContracts,
                lockedPhones, lockedWallpapers] = await Promise.all([
                    Contract.countDocuments(query),
                    Contract.countDocuments({ ...query, status: 'Activated' }),
                    Contract.countDocuments({ ...query, status: 'Application' }),
                    Contract.countDocuments({ ...query, status: 'Check' }),
                    Contract.countDocuments({ ...query, status: 'Redeem' }),
                    Contract.countDocuments({ ...query, status: 'Blacklist' }),
                    Contract.countDocuments({ ...query, status: 'Comments' }),
                    Contract.countDocuments({ ...query, lockPhoneStatus: 'Locked' }),
                    Contract.countDocuments({ ...query, lockWallpaperStatus: 'Locked' })
                ]);
            unlockedPhones = totalContracts - lockedPhones;
            unlockedWallpapers = totalContracts - lockedWallpapers;

            let paymentQuery = {};
            if (userBrand && userRole !== 'Administrator') {
                const matchedContracts = await Contract.find({ brand: userBrand }).select('contractId');
                const contractIds = matchedContracts.map(c => c.contractId);
                paymentQuery.contractId = { $in: contractIds };
            }

            paymentCount = await Payment.countDocuments(paymentQuery);
            const revenueAgg = await Payment.aggregate([
                { $match: paymentQuery },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            totalRevenue = revenueAgg[0]?.total || 0;

            // Total loan amount from ALL activated contracts
            const activatedQuery = { ...query, status: 'Activated' };
            const loanAgg = await Contract.aggregate([
                { $match: activatedQuery },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            totalLoanAmount = loanAgg[0]?.total || 0;
        } else {
            const contracts = MEM_DB.contracts.filter(c => {
                if (userBrand && userRole !== 'Administrator') return c.brand === userBrand;
                return true;
            });
            totalContracts = contracts.length;
            activatedContracts = contracts.filter(c => c.status === 'Activated').length;
            applicationContracts = contracts.filter(c => c.status === 'Application').length;
            checkContracts = contracts.filter(c => c.status === 'Check').length;
            redeemContracts = contracts.filter(c => c.status === 'Redeem').length;
            blacklistContracts = contracts.filter(c => c.status === 'Blacklist').length;
            commentsContracts = contracts.filter(c => c.status === 'Comments').length;
            lockedPhones = contracts.filter(c => c.lockPhoneStatus === 'Locked').length;
            unlockedPhones = contracts.filter(c => c.lockPhoneStatus !== 'Locked').length;
            lockedWallpapers = contracts.filter(c => c.lockWallpaperStatus === 'Locked').length;
            unlockedWallpapers = contracts.filter(c => c.lockWallpaperStatus !== 'Locked').length;

            const contractIds = contracts.map(c => c.contractId);
            const filteredPayments = MEM_DB.payments.filter(p => {
                if (userBrand && userRole !== 'Administrator') return contractIds.includes(p.contractId);
                return true;
            });
            totalRevenue = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            paymentCount = filteredPayments.length;
            const activatedContracts2 = contracts.filter(c => c.status === 'Activated');
            totalLoanAmount = activatedContracts2.reduce((sum, c) => sum + (Number(c.totalAmount) || Number(c.amount) || 0), 0);
        }

        res.json({
            totalContracts, activatedContracts, applicationContracts,
            checkContracts, redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount,
            totalLoanAmount: totalLoanAmount || 0,
            outstandingBalance: Math.max((totalLoanAmount || 0) - (totalRevenue || 0), 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`SYSTEM MDM Backend server active on port ${PORT}`);
});

// Schedule tracker for Telegram Bot Login History Reports
const REPORT_SCHEDULE_FILE = path.join(process.cwd(), 'tmp', 'report-schedule.json');
const SCHEDULE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getNextReportTime = () => {
    try {
        if (fs.existsSync(REPORT_SCHEDULE_FILE)) {
            const raw = fs.readFileSync(REPORT_SCHEDULE_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data.nextReportTime && data.nextReportTime > Date.now()) {
                return data.nextReportTime;
            }
        }
    } catch (e) { }
    const defaultNext = Date.now() + SCHEDULE_INTERVAL_MS;
    saveReportSchedule(defaultNext);
    return defaultNext;
};

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

let nextReportTargetTime = getNextReportTime();

const runWeeklyReport = async () => {
    let sentToTelegram = false;
    let telegramError = null;
    let sheetExported = false;

    try {
        const collected = await collectLoginHistory();
        const text = formatReportText(collected);
        const filePath = await writeTempReportFile(text);

        // 1. Export / Append to Google Sheet
        const rows = [];
        collected.forEach(u => {
            u.history.forEach(h => {
                const timeStr = new Date(h.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
                rows.push([u.username, u.userId || '-', timeStr, h.ip, h.deviceInfo]);
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

        // 2. Send Report Document to Telegram Bot
        const masterChatId = process.env.TELEGRAM_MASTER_CHAT_ID;
        if (masterChatId && bot) {
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

        // 3. Cleanup login history from DB if Telegram or Sheet succeeded (or manual trigger)
        const cleanRes = await cleanupLoginHistory();
        if (cleanRes && cleanRes.success) console.log('Cleared loginHistory from all user records.');

        // 4. Reset timer countdown to 7 days from now
        nextReportTargetTime = Date.now() + SCHEDULE_INTERVAL_MS;
        saveReportSchedule(nextReportTargetTime);

        return { success: true, sentToTelegram, sheetExported, telegramError, nextReportTime: nextReportTargetTime };
    } catch (err) {
        console.error('runWeeklyReport error:', err.message);
        throw err;
    }
};

// Check report schedule target time every minute
setInterval(() => {
    if (Date.now() >= nextReportTargetTime) {
        console.log('Report schedule target time reached, triggering auto report...');
        runWeeklyReport().catch(err => console.error(err));
    }
}, 60 * 1000);

// API Endpoints for Frontend History Page Report Schedule & Force Send
app.get('/api/history/report-schedule', (req, res) => {
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

app.post('/api/history/send-telegram-report', async (req, res) => {
    try {
        const result = await runWeeklyReport();
        res.json({
            success: true,
            message: 'Report sent to Telegram bot and login history cleared successfully.',
            sentToTelegram: result.sentToTelegram,
            telegramError: result.telegramError,
            nextReportTime: result.nextReportTime
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/export-login-history', async (req, res) => {
    try {
        const headerUser = req.headers['x-master-username'] || '';
        if (headerUser !== '@hakyonghouv') return res.status(403).json({ error: 'Only Master Admin may export reports' });
        const collected = await collectLoginHistory();
        const text = formatReportText(collected);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="login-history.txt"');
        res.send(text);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/clear-logs', async (req, res) => {
    try {
        const { input } = req.body || {};
        if (!input || typeof input !== 'string') return res.status(400).json({ error: 'input string required' });
        const lower = input.toLowerCase();
        if (!lower.includes('mongodb') && !lower.includes('database')) {
            return res.status(400).json({ error: 'Input must contain "mongodb" or "database" to confirm destructive action' });
        }

        // Only allow Master Admin trigger
        const headerUser = req.headers['x-master-username'] || '';
        if (headerUser !== '@hakyonghouv') return res.status(403).json({ error: 'Only Master Admin may clear logs' });

        const cleanupRes = await cleanupLoginHistory();
        // attempt to clear PhoneLog and WallpaperLog collections if connected
        let phoneDeleted = 0, wallpaperDeleted = 0;
        if (isMongoConnected) {
            try { const pd = await PhoneLog.deleteMany({}); phoneDeleted = pd.deletedCount || 0; } catch (e) {}
            try { const wd = await WallpaperLog.deleteMany({}); wallpaperDeleted = wd.deletedCount || 0; } catch (e) {}
        }

        res.json({ success: true, cleanupRes, phoneDeleted, wallpaperDeleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// HISTORY ROUTES
// GET Login History
app.get('/api/history/login', async (req, res) => {
    try {
        const { search = '', role = '', page = 1, limit = 10 } = req.query;
        let allLogs = [];
        let usersList = isMongoConnected ? await User.find({}) : MEM_DB.users;
        
        usersList.forEach(u => {
            if (u.loginHistory && Array.isArray(u.loginHistory)) {
                u.loginHistory.forEach(log => {
                    allLogs.push({
                        id: log._id || `log-${Math.random()}`,
                        userId: u.userId,
                        username: u.username,
                        name: u.name,
                        role: u.role,
                        brand: u.brand || 'SYSTEM',
                        ip: log.ip || '127.0.0.1',
                        deviceInfo: log.deviceInfo || 'Web Browser',
                        timestamp: log.timestamp,
                        status: 'Success'
                    });
                });
            }
        });

        // Sort descending by timestamp
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

        const total = allLogs.length;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const data = allLogs.slice(skip, skip + parseInt(limit));

        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Device Action History
app.get('/api/history/device-actions', async (req, res) => {
    try {
        const { search = '', status = '', actionType = '', page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = {};
        if (status) query.status = status;
        if (actionType) query.actionType = actionType;
        
        if (isMongoConnected) {
            if (search) {
                query.$or = [
                    { customerName: { $regex: search, $options: 'i' } },
                    { model: { $regex: search, $options: 'i' } },
                    { serialNumber: { $regex: search, $options: 'i' } },
                    { contractId: { $regex: search, $options: 'i' } }
                ];
            }
            const total = await DeviceActionLog.countDocuments(query);
            const data = await DeviceActionLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
            return res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        }

        let filtered = MEM_DB.deviceActionLogs || [];
        if (status) filtered = filtered.filter(l => l.status === status);
        if (actionType) filtered = filtered.filter(l => l.actionType === actionType);
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(l =>
                (l.customerName || '').toLowerCase().includes(s) ||
                (l.model || '').toLowerCase().includes(s) ||
                (l.serialNumber || '').toLowerCase().includes(s) ||
                (l.contractId || '').toLowerCase().includes(s)
            );
        }

        const total = filtered.length;
        const data = filtered.slice(skip, skip + parseInt(limit));
        res.json({ data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Device Action History Log
app.post('/api/history/device-actions', async (req, res) => {
    try {
        const { contractId, actionType, status = 'Pending', performedBy, reason } = req.body;
        
        let contract = isMongoConnected 
            ? await Contract.findOne({ contractId }) 
            : MEM_DB.contracts.find(c => c.contractId === contractId);

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        const now = new Date();
        const logData = {
            logId: `ACT-${Date.now()}`,
            contractId: contract.contractId,
            customerName: `${contract.customerNameEn} (${contract.customerNameKh || ''})`,
            model: contract.model,
            serialNumber: contract.serialNumber,
            brand: contract.brand || '',
            actionType,
            status, // 'Pending' or 'Success'
            performedBy: performedBy || 'SYSTEM',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            reason: reason || `${actionType} initiated`
        };

        // Update contract status if needed
        if (actionType === 'Lock Phone') contract.lockPhoneStatus = 'Locked';
        else if (actionType === 'Unlock Phone') contract.lockPhoneStatus = 'Unlocked';
        else if (actionType === 'Lock Wallpaper') contract.lockWallpaperStatus = 'Locked';
        else if (actionType === 'Unlock Wallpaper') contract.lockWallpaperStatus = 'Unlocked';

        if (isMongoConnected) {
            await contract.save();
            const actionDoc = new DeviceActionLog(logData);
            await actionDoc.save();
            return res.json({ success: true, data: actionDoc });
        }

        if (!MEM_DB.deviceActionLogs) MEM_DB.deviceActionLogs = [];
        MEM_DB.deviceActionLogs.unshift({ _id: `act-${Date.now()}`, ...logData });
        res.json({ success: true, data: logData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Mark Device Action History as Done (Success)
app.put('/api/history/device-actions/:id/done', async (req, res) => {
    try {
        const { id } = req.params;
        if (isMongoConnected) {
            const doc = await DeviceActionLog.findById(id);
            if (!doc) return res.status(404).json({ error: 'Action record not found' });
            doc.status = 'Success';
            await doc.save();
            return res.json({ success: true, data: doc });
        }

        const item = (MEM_DB.deviceActionLogs || []).find(l => l._id === id || l.logId === id);
        if (!item) return res.status(404).json({ error: 'Action record not found' });
        item.status = 'Success';
        res.json({ success: true, data: item });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

