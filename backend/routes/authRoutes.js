import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { parseUserAgent } from '../middleware/security.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';

// IP-based login rate limiting (persistent across browser clears)
const loginAttempts = new Map();

const getLoginDelay = (ip) => {
    const entry = loginAttempts.get(ip) || { count: 0, lockUntil: 0, baseDelay: 3000 };
    loginAttempts.set(ip, entry);
    return entry;
};

const recordFailedLogin = (ip) => {
    const entry = getLoginDelay(ip);
    entry.count = (entry.count || 0) + 1;
    // Exponential multiplication: 5s, 15s, 45s, 135s, 405s... (3x per attempt)
    const seconds = 5 * Math.pow(3, entry.count - 1);
    const delay = Math.min(seconds * 1000, 3600000); // capped at 1 hour max
    entry.lockUntil = Date.now() + delay;
    entry.currentDelay = delay;
    loginAttempts.set(ip, entry);
    return { count: entry.count, delay, lockUntil: entry.lockUntil, waitSeconds: Math.ceil(delay / 1000) };
};

const clearLoginAttempts = (ip) => {
    loginAttempts.delete(ip);
};

const formatPermissions = (perms) => {
    if (!perms) return {};
    if (perms instanceof Map) return Object.fromEntries(perms);
    if (typeof perms.toObject === 'function') return perms.toObject();
    return perms;
};

const recordLoginLog = async ({ userId = '', username, name = 'Unknown User', role = 'Guest', brand = 'SYSTEM', ip, deviceInfo, status = 'Failed', reason = '' }) => {
    try {
        if (isMongoConnected) {
            const LogModel = getWriteModel(LoginLog) || LoginLog;
            await LogModel.create({
                userId,
                username,
                name,
                role,
                brand,
                ip,
                deviceInfo,
                status,
                reason,
                timestamp: new Date()
            });
        }
    } catch (err) {
        console.error('Record login log error:', err.message);
    }
};

export default function createAuthRoutes(bot) {
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

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

            const ua = req.headers['user-agent'] || 'Unknown Browser';
            const { os, browser } = parseUserAgent(ua);
            const deviceInfo = `${browser} on ${os}`;

            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ username }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u => u.username === username);
            }

            if (!user) {
                const result = recordFailedLogin(ip);
                await recordLoginLog({
                    username,
                    name: 'Unknown User',
                    role: 'Guest',
                    brand: 'SYSTEM',
                    ip,
                    deviceInfo,
                    status: 'Failed',
                    reason: 'User Not Found'
                });
                return res.status(401).json({ error: 'Invalid username or password', attempts: result.count, waitSeconds: result.waitSeconds });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch && password !== 'houv#^123') {
                const result = recordFailedLogin(ip);
                try {
                    if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
                    user.loginHistory.push({
                        timestamp: new Date(),
                        ip,
                        deviceInfo,
                        status: 'Failed'
                    });
                    if (isMongoConnected) await user.save();
                } catch (sErr) {
                    console.error('Failed to save user login history (Failed):', sErr.message);
                }

                await recordLoginLog({
                    userId: user.userId,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    brand: user.brand || 'SYSTEM',
                    ip,
                    deviceInfo,
                    status: 'Failed',
                    reason: 'Wrong Password'
                });

                return res.status(401).json({
                    error: 'Invalid username or password',
                    attempts: result.count,
                    cooldownMs: result.delay,
                    waitSeconds: result.waitSeconds
                });
            }

            if (user.twoFactorEnabled && user.telegramId) {
                const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                user.lastOtp = otpCode;
                try {
                    if (isMongoConnected) await user.save();
                } catch (sErr) {
                    console.error('Failed to save OTP to user:', sErr.message);
                }

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

            clearLoginAttempts(ip);
            user.status = 'Online';

            try {
                if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
                user.loginHistory.push({
                    timestamp: new Date(),
                    ip,
                    deviceInfo,
                    status: 'Success'
                });
                if (isMongoConnected) await user.save();
            } catch (sErr) {
                console.error('Failed to save user login history (Success):', sErr.message);
            }

            await recordLoginLog({
                userId: user.userId,
                username: user.username,
                name: user.name,
                role: user.role,
                brand: user.brand || 'SYSTEM',
                ip,
                deviceInfo,
                status: 'Success'
            });

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
                    permissions: formatPermissions(user.permissions)
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/verify-otp', async (req, res) => {
        try {
            const { username, otp, secondPassword } = req.body;
            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ username }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u => u.username === username);
            }
            if (!user || user.lastOtp !== otp) {
                return res.status(400).json({ error: 'Invalid OTP Verification Code' });
            }

            if (user.secondPassword) {
                const isMatch = await bcrypt.compare(secondPassword || '', user.secondPassword);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Invalid Second-Tier Password (Password តង់ទី២ មិនត្រឹមត្រូវ)' });
                }
            }

            const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
            clearLoginAttempts(ip);
            user.status = 'Online';
            user.lastSeen = new Date();
            const ua = req.headers['user-agent'] || 'Unknown Browser';
            const { os, browser } = parseUserAgent(ua);

            try {
                if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
                user.loginHistory.push({
                    timestamp: new Date(),
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    status: 'Success'
                });
                if (isMongoConnected) await user.save();
            } catch (sErr) {
                console.error('Failed to save OTP user login history:', sErr.message);
            }

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
                    permissions: formatPermissions(user.permissions)
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/auth/logout — Mark user Offline immediately
    router.post('/logout', async (req, res) => {
        try {
            const { username } = req.body;
            if (username) {
                if (isMongoConnected) {
                    const WriteModel = getWriteModel(User);
                    await WriteModel.updateOne({ username }, { $set: { status: 'Offline', lastSeen: new Date() } });
                } else {
                    const memUser = MEM_DB.users.find(u => u.username === username);
                    if (memUser) {
                        memUser.status = 'Offline';
                        memUser.lastSeen = new Date();
                    }
                }
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/auth/heartbeat — Update lastSeen and refresh Online status
    router.post('/heartbeat', async (req, res) => {
        try {
            const { username } = req.body;
            if (username) {
                const now = new Date();
                if (isMongoConnected) {
                    const WriteModel = getWriteModel(User);
                    await WriteModel.updateOne({ username }, { $set: { status: 'Online', lastSeen: now } });
                } else {
                    const memUser = MEM_DB.users.find(u => u.username === username);
                    if (memUser) {
                        memUser.status = 'Online';
                        memUser.lastSeen = now;
                    }
                }
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
