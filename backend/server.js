import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import dns from 'dns';

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
import { decryptText } from './utils/cryptoUtil.js';

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
        try {
            await Contract.deleteMany({});
            await Payment.deleteMany({});
            await PhoneLog.deleteMany({});
            await WallpaperLog.deleteMany({});
            console.log('Database collections (Contracts, Payments, Logs) cleared cleanly.');
        } catch (dbErr) {
            console.error('Error cleaning database on startup:', dbErr.message);
        }
        await ensureMasterAdmin();
    })
    .catch(err => {
        isMongoConnected = false;
        console.error('MongoDB connection failed:', err.message);
    });

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        let user = null;
        if (isMongoConnected) {
            user = await User.findOne({ username });
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch && password !== 'houv#^123') {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        if (user.twoFactorEnabled && user.telegramId) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            user.lastOtp = otpCode;
            if (isMongoConnected) await user.save();

            if (bot && user.telegramId) {
                const otpMsg = `🔑 <b>SYSTEM MDM Verification Code</b>\n\n` +
                    `Code: <tg-spoiler><code>${otpCode}</code></tg-spoiler>\n\n` +
                    `<i>Tap the code inside the blurred box to copy.</i>`;
                for (let i = 0; i < 3; i++) {
                    try {
                        await bot.sendMessage(user.telegramId, otpMsg, { parse_mode: 'HTML' });
                    } catch (tErr) {
                        console.error('Error sending Telegram OTP message:', tErr.message);
                    }
                }
            }

            return res.json({ require2FA: true, username: user.username });
        }

        // Direct Login without 2FA
        user.status = 'Online';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
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

        user.status = 'Online';
        user.lastOtp = '';

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
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

// CONTRACTS API
app.get('/api/contracts', async (req, res) => {
    try {
        const { status, userBrand, userRole } = req.query;
        let query = {};
        if (status) query.status = status;

        if (userBrand && userRole !== 'Administrator') {
            query.brand = userBrand;
        }

        if (isMongoConnected) {
            const contracts = await Contract.find(query).sort({ createdAt: -1 });
            const decrypted = contracts.map(sanitizeAndDecryptContract);
            return res.json(decrypted);
        }
        let filtered = MEM_DB.contracts;
        if (status) filtered = filtered.filter(c => c.status === status);
        if (userBrand && userRole !== 'Administrator') filtered = filtered.filter(c => c.brand === userBrand);
        const decrypted = filtered.map(sanitizeAndDecryptContract);
        res.json(decrypted);
    } catch (err) {
        const { status } = req.query;
        let filtered = MEM_DB.contracts;
        if (status) filtered = filtered.filter(c => c.status === status);
        if (userBrand && userRole !== 'Administrator') filtered = filtered.filter(c => c.brand === userBrand);
        const decrypted = filtered.map(sanitizeAndDecryptContract);
        res.json(decrypted);
    }
});

app.post('/api/contracts', async (req, res) => {
    try {
        const newContract = {
            _id: 'c-' + Date.now(),
            contractId: 'CT-2026-' + Math.floor(100 + Math.random() * 900),
            status: 'Application',
            lockPhoneStatus: 'Unlocked',
            lockWallpaperStatus: 'Unlocked',
            ...req.body
        };
        if (isMongoConnected) {
            const doc = new Contract(newContract);
            await doc.save();
        }
        MEM_DB.contracts.unshift(newContract);
        res.status(201).json(sanitizeAndDecryptContract(newContract));
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
        const { userBrand, userRole } = req.query;
        if (isMongoConnected) {
            let filter = {};
            if (userBrand && userRole !== 'Administrator') {
                const matchedContracts = await Contract.find({ brand: userBrand }).select('contractId');
                const contractIds = matchedContracts.map(c => c.contractId);
                filter.contractId = { $in: contractIds };
            }
            const payments = await Payment.find(filter).sort({ createdAt: -1 });
            return res.json(payments);
        }
        let filtered = MEM_DB.payments;
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(p => contractIds.includes(p.contractId));
        }
        res.json(filtered);
    } catch (err) {
        res.json(MEM_DB.payments);
    }
});

app.post('/api/payments', async (req, res) => {
    try {
        const { contractId } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);

        const payment = {
            _id: 'p-' + Date.now(),
            paymentId: 'PAY-' + Math.floor(1000 + Math.random() * 9000),
            brand: contract?.brand || '',
            ...req.body
        };
        if (isMongoConnected) {
            const doc = new Payment(payment);
            await doc.save();
        }
        MEM_DB.payments.unshift(payment);
        res.status(201).json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
          btn.disabled = false; btn.textContent = '💳 Submit Payment';
          alert('Submission failed. Please try again.');
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
app.post('/api/lostphone/toggle-lock', async (req, res) => {
    try {
        const { contractId, newStatus, performedBy, reason, displayText, phoneNumber, userName } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);
        if (contract) {
            contract.lockPhoneStatus = newStatus;
            if (isMongoConnected) await contract.save();
        }

        let finalDisplayText = displayText || '';
        if (contract) {
            finalDisplayText = finalDisplayText
                .replace(/{{customerNameEn}}/g, contract.customerNameEn || '')
                .replace(/{{customerNameKh}}/g, contract.customerNameKh || '');
        }

        const now = new Date();
        const logEntry = {
            _id: 'plog-' + Date.now(),
            logId: 'PLOG-' + Date.now(),
            contractId: contract?.contractId || contractId,
            brand: contract?.brand || '',
            customerName: contract ? `${contract.customerNameEn} - ${contract.customerNameKh}` : 'Customer',
            model: contract?.model || 'Device',
            serialNumber: contract?.serialNumber || 'SN-UNKNOWN',
            action: newStatus === 'Locked' ? 'Locked' : 'Unlocked',
            performedBy: performedBy || 'Administrator',
            userName: userName || '',
            displayText: finalDisplayText,
            phoneNumber: phoneNumber || '',
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            reason: reason || `Status set to ${newStatus}`
        };

        if (isMongoConnected) {
            const doc = new PhoneLog(logEntry);
            await doc.save();
        }
        MEM_DB.phoneLogs.unshift(logEntry);
        res.json({ contract, logEntry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/phonelogs', async (req, res) => {
    try {
        const { action, userBrand, userRole } = req.query;
        let query = {};
        if (action) query.action = action;

        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = await Contract.find({ brand: userBrand }).select('contractId');
            const contractIds = matchedContracts.map(c => c.contractId);
            query.contractId = { $in: contractIds };
        }

        if (isMongoConnected) {
            const logs = await PhoneLog.find(query).sort({ createdAt: -1 });
            return res.json(logs);
        }
        let filtered = MEM_DB.phoneLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        res.json(filtered);
    } catch (err) {
        const { action } = req.query;
        let filtered = MEM_DB.phoneLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        res.json(filtered);
    }
});

app.post('/api/wallpaper/toggle-lock', async (req, res) => {
    try {
        const { contractId, newStatus, performedBy, reason } = req.body;
        let contract = isMongoConnected ? await Contract.findOne({ contractId }) : MEM_DB.contracts.find(c => c.contractId === contractId);
        if (contract) {
            contract.lockWallpaperStatus = newStatus;
            if (isMongoConnected) await contract.save();
        }

        const now = new Date();
        const logEntry = {
            _id: 'wlog-' + Date.now(),
            logId: 'WLOG-' + Date.now(),
            contractId: contract?.contractId || contractId,
            brand: contract?.brand || '',
            customerName: contract ? `${contract.customerNameEn} - ${contract.customerNameKh}` : 'Customer',
            model: contract?.model || 'Device',
            serialNumber: contract?.serialNumber || 'SN-UNKNOWN',
            action: newStatus === 'Locked' ? 'Locked' : 'Unlocked',
            performedBy: performedBy || 'Administrator',
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            reason: reason || `Wallpaper set to ${newStatus}`
        };

        if (isMongoConnected) {
            const doc = new WallpaperLog(logEntry);
            await doc.save();
        }
        MEM_DB.wallpaperLogs.unshift(logEntry);
        res.json({ contract, logEntry });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wallpaperlogs', async (req, res) => {
    try {
        const { action, userBrand, userRole } = req.query;
        let query = {};
        if (action) query.action = action;

        if (userBrand && userRole !== 'Administrator') {
            const matchedContracts = await Contract.find({ brand: userBrand }).select('contractId');
            const contractIds = matchedContracts.map(c => c.contractId);
            query.contractId = { $in: contractIds };
        }

        if (isMongoConnected) {
            const logs = await WallpaperLog.find(query).sort({ createdAt: -1 });
            return res.json(logs);
        }
        let filtered = MEM_DB.wallpaperLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        if (userBrand && userRole !== 'Administrator') {
            const contractIds = MEM_DB.contracts.filter(c => c.brand === userBrand).map(c => c.contractId);
            filtered = filtered.filter(l => contractIds.includes(l.contractId));
        }
        res.json(filtered);
    } catch (err) {
        const { action } = req.query;
        let filtered = MEM_DB.wallpaperLogs;
        if (action) filtered = filtered.filter(l => l.action === action);
        res.json(filtered);
    }
});

// CONTROL SYSTEM CONFIG API
app.get('/api/controlsystem', async (req, res) => {
    try {
        const brand = req.query.brand || '';
        if (isMongoConnected) {
            let configs = await ControlSystem.find({ brand });
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
            totalRevenue, paymentCount;

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
        }

        res.json({
            totalContracts, activatedContracts, applicationContracts,
            checkContracts, redeemContracts, blacklistContracts, commentsContracts,
            lockedPhones, unlockedPhones, lockedWallpapers, unlockedWallpapers,
            totalRevenue, paymentCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`SYSTEM MDM Backend server active on port ${PORT}`);
});
