import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { recordSystemAudit } from '../utils/auditLogger.js';
import AccountLocation from '../models/AccountLocation.js';
import { normalizeAccessPolicy } from '../utils/accountAccessPolicy.js';

const router = express.Router();

// GET all users — merged from all 3 DBs
// GET all users — merged from all 3 DBs
const OFFLINE_THRESHOLD_MS = 90 * 1000; // 90 seconds threshold

const formatPermissions = (perms) => {
    if (!perms) return {};
    if (perms instanceof Map) return Object.fromEntries(perms);
    if (typeof perms.toObject === 'function') return perms.toObject();
    return perms;
};

const formatUserStatus = (u) => {
    const rawObj = u.toObject ? u.toObject() : { ...u };
    const lastSeenMs = rawObj.lastSeen ? new Date(rawObj.lastSeen).getTime() : 0;
    const isOnline = lastSeenMs > 0 && (Date.now() - lastSeenMs <= OFFLINE_THRESHOLD_MS) && rawObj.status !== 'Offline';
    rawObj.status = isOnline ? 'Online' : 'Offline';
    rawObj.lastSeen = rawObj.lastSeen || (isOnline ? new Date() : null);
    rawObj.otpHistory = rawObj.otpHistory || [];
    rawObj.onlineHistory = rawObj.onlineHistory || [];
    rawObj.loginHistory = rawObj.loginHistory || [];
    rawObj.permissions = formatPermissions(rawObj.permissions);
    return rawObj;
};

const isAllowedToViewAccountMap = (user) => {
    const permissions = formatPermissions(user?.permissions);
    return Boolean(
        user?.isImmutable ||
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.role === 'Administrator' ||
        permissions?.['/settings/all-account']?.read
    );
};

router.get('/account-map', async (req, res) => {
    try {
        const identity = req.user || {};
        let viewer = null;
        if (isMongoConnected) {
            const viewers = await queryAllDBs(User, (Model) => Model.find({
                userId: identity.userId,
                username: identity.username
            }).select('userId username role isImmutable permissions'));
            viewer = viewers[0] || null;
        } else {
            viewer = MEM_DB.users.find(user =>
                user.userId === identity.userId && user.username === identity.username
            ) || null;
        }
        if (!isAllowedToViewAccountMap(viewer)) {
            return res.status(403).json({ error: 'All Account read permission is required.' });
        }

        let users = [];
        let locations = [];
        let latestLocations = [];
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (isMongoConnected) {
            users = await queryAllDBs(User, (Model) => Model.find()
                .select('userId name nameKh username role brand status lastSeen accessPolicy')
                .sort({ lastSeen: -1 }));
            locations = await queryAllDBs(AccountLocation, (Model) => Model.find({ timestamp: { $gte: cutoff } })
                .where('recordType').equals('history')
                .sort({ timestamp: -1 }));
            latestLocations = await queryAllDBs(AccountLocation, (Model) => Model.find({
                recordType: 'latest',
                expiresAt: { $gt: new Date() }
            }).sort({ timestamp: -1 }));
        } else {
            users = MEM_DB.users;
            locations = (MEM_DB.accountLocations || [])
                .filter(location =>
                    location.recordType === 'history' &&
                    new Date(location.timestamp).getTime() >= cutoff.getTime()
                )
                .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
            latestLocations = (MEM_DB.accountLocations || [])
                .filter(location =>
                    location.recordType === 'latest' &&
                    new Date(location.expiresAt).getTime() > Date.now()
                );
        }

        const locationsByUserId = new Map();
        for (const location of locations) {
            const entries = locationsByUserId.get(location.userId) || [];
            entries.push({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracyMeters: location.accuracyMeters,
                timestamp: location.timestamp,
                ip: location.ip,
                deviceInfo: location.deviceInfo
            });
            locationsByUserId.set(location.userId, entries);
        }
        const latestByUserId = new Map(latestLocations.map(location => [location.userId, {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyMeters: location.accuracyMeters,
            timestamp: location.timestamp,
            ip: location.ip,
            deviceInfo: location.deviceInfo
        }]));

        const result = users.map(user => {
            const userId = user.userId;
            const userLocations = locationsByUserId.get(userId) || [];
            const lastHistoryLocation = userLocations[0] || null;
            const latestLocation = latestByUserId.get(userId);
            const lastLocation = latestLocation &&
                (!lastHistoryLocation || new Date(latestLocation.timestamp).getTime() >= new Date(lastHistoryLocation.timestamp).getTime())
                ? latestLocation
                : lastHistoryLocation;
            const lastSeen = user.lastSeen ? new Date(user.lastSeen) : null;
            const isOnline = Boolean(lastSeen && Date.now() - lastSeen.getTime() <= OFFLINE_THRESHOLD_MS && user.status !== 'Offline');
            return {
                userId,
                name: user.name,
                nameKh: user.nameKh || '',
                username: user.username,
                role: user.role,
                brand: user.brand || '',
                status: isOnline ? 'Online' : 'Offline',
                lastSeen,
                lastLocation,
                locationHistory: userLocations,
                locationRequired: Boolean(user.accessPolicy?.locationRequired)
            };
        });

        return res.json({ accounts: result, locationRetentionDays: 7 });
    } catch (err) {
        console.error('Account map data error:', err);
        return res.status(500).json({ error: 'Unable to load account map data.' });
    }
});

// GET all users — merged from all 3 DBs with real-time status evaluation
router.get('/', async (req, res) => {
    try {
        let rawUsers = [];
        if (isMongoConnected) {
            rawUsers = await queryAllDBs(User, (M) => M.find().sort({ createdAt: -1 }));
        } else {
            rawUsers = MEM_DB.users;
        }

        const userMap = new Map();
        rawUsers.forEach(u => {
            const formatted = formatUserStatus(u);
            const existing = userMap.get(formatted.username);
            const curLastSeenMs = formatted.lastSeen ? new Date(formatted.lastSeen).getTime() : 0;
            const exLastSeenMs = existing?.lastSeen ? new Date(existing.lastSeen).getTime() : 0;

            if (!existing || (formatted.status === 'Online' && existing.status !== 'Online') || curLastSeenMs > exLastSeenMs) {
                userMap.set(formatted.username, formatted);
            }
        });

        res.json(Array.from(userMap.values()));
    } catch (err) {
        const evaluated = (MEM_DB.users || []).map(formatUserStatus);
        res.json(evaluated);
    }
});

// STATUS CHECK — lightweight polling endpoint (search across all DBs)
router.get('/status-check', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ error: 'username required' });

        let user = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(User, (M) => M.find({ username }).select('username isBlocked status'));
            user = results[0] || null;
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ isBlocked: !!user.isBlocked, status: user.status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE user — write to active DB
router.post('/', async (req, res) => {
    try {
        const { name, username, email, password, role, permissions, brand, subBrands, accessPolicy } = req.body;
        const isSalary = role && role.toLowerCase() === 'salary';
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        const memId = 'u-' + Date.now();
        const userId = 'USR-' + Math.floor(100000 + Math.random() * 900000);

        let finalBrand = isSalary ? '' : (brand || '');
        let finalSubBrands = isSalary ? [] : (Array.isArray(subBrands) ? subBrands : []);
        let finalPermissions = permissions || {};
        if (isSalary && (!permissions || Object.keys(permissions).length === 0)) {
            finalPermissions = {
                '/salary': { read: true, create: true, edit: true, delete: true, export: true }
            };
        }

        if (isMongoConnected) {
            const UserWrite = getWriteModel(User) || User;
            const doc = new UserWrite({
                userId,
                name,
                username,
                email,
                password: hashedPassword,
                secondPassword: '',
                brand: finalBrand,
                subBrands: finalSubBrands,
                role: role || 'Staff',
                status: 'Offline',
                permissions: finalPermissions,
                accessPolicy: normalizeAccessPolicy(accessPolicy),
                accessPolicyVersion: 1
            });
            await doc.save();
            const saved = doc.toObject();
            MEM_DB.users.push({ ...saved, _id: saved._id.toString() });
            return res.status(201).json(saved);
        }

        const newUser = {
            _id: memId,
            userId,
            name,
            username,
            email,
            password: hashedPassword,
            secondPassword: '',
            brand: finalBrand,
            subBrands: finalSubBrands,
            role: role || 'Staff',
            status: 'Offline',
            permissions: finalPermissions,
            accessPolicy: normalizeAccessPolicy(accessPolicy),
            accessPolicyVersion: 1
        };
        MEM_DB.users.push(newUser);
        res.status(201).json(newUser);
    } catch (err) {
        if (err.code === 'INVALID_ACCESS_POLICY') return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// UPDATE user — search all DBs, write to the DB that has it
router.put('/:id', async (req, res) => {
    try {
        const { name, username, email, password, role, brand, subBrands, permissions, accessPolicy } = req.body;
        let user = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(User, (M) => {
                try { return M.findById(req.params.id).then(r => r ? [r] : []); } catch { return []; }
            });
            user = results[0];
            if (!user) {
                const r2 = await queryAllDBs(User, (M) => M.find({ userId: req.params.id }));
                user = r2[0] || null;
            }
        } else {
            user = MEM_DB.users.find(u => u._id === req.params.id || u.userId === req.params.id);
        }
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isImmutable || user.username === '@hakyonghouv') {
            return res.status(403).json({ error: 'Master Admin account (@hakyonghouv) is protected and CANNOT be edited!' });
        }

        const normalizedAccessPolicy = accessPolicy !== undefined
            ? normalizeAccessPolicy(accessPolicy)
            : undefined;
        const isSalary = (role && role.toLowerCase() === 'salary') || (!role && user.role && user.role.toLowerCase() === 'salary');

        if (name) user.name = name;
        if (username) user.username = username;
        if (email) user.email = email;
        if (role) user.role = role;
        if (isSalary) {
            user.brand = '';
            user.subBrands = [];
        } else {
            if (brand !== undefined) user.brand = brand;
            if (subBrands !== undefined) user.subBrands = Array.isArray(subBrands) ? subBrands : [];
        }
        if (permissions !== undefined) {
            user.permissions = permissions;
            if (typeof user.markModified === 'function') {
                user.markModified('permissions');
            }
        }
        if (accessPolicy !== undefined) {
            user.accessPolicy = normalizedAccessPolicy;
            user.accessPolicyVersion = (user.accessPolicyVersion || 0) + 1;
            if (typeof user.markModified === 'function') user.markModified('accessPolicy');
        }
        if (password && password.trim() !== '') {
            user.password = await bcrypt.hash(password, 10);
        }

        // If user is updated, mark live syncStatus as Pending until client receives it
        user.permissionPending = true;
        user.syncStatus = 'Pending';
        user.syncComment = 'កំពុងរង់ចាំគណនីទទួលយកសិទ្ធិថ្មី...';
        if (typeof user.markModified === 'function') {
            user.markModified('syncStatus');
            user.markModified('syncComment');
        }

        if (isMongoConnected) {
            await user.save();
        }

        // Also update in MEM_DB
        const memIdx = MEM_DB.users.findIndex(u => u._id === req.params.id || u.userId === req.params.id);
        if (memIdx !== -1) {
            MEM_DB.users[memIdx] = {
                ...MEM_DB.users[memIdx],
                ...user.toObject ? user.toObject() : user,
                syncStatus: 'Pending',
                permissionPending: true
            };
        }

        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        if (err.code === 'INVALID_ACCESS_POLICY') return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ACK-SYNC — Acknowledge that user client received new permissions
router.post('/ack-sync', async (req, res) => {
    try {
        const { username, userId } = req.body;
        if (!username && !userId) return res.status(400).json({ error: 'Missing username or userId' });

        let users = [];
        if (isMongoConnected) {
            users = await queryAllDBs(User, (M) => M.find(username ? { username } : { userId }));
        } else {
            const memoryUser = MEM_DB.users.find(u => u.username === username || u.userId === userId);
            if (memoryUser) users = [memoryUser];
        }

        for (const u of users) {
            u.permissionPending = false;
            u.syncStatus = 'Success';
            u.syncComment = 'បានទទួលការកំណត់សិទ្ធិថ្មីជោគជ័យ';
            if (isMongoConnected) await u.save();
        }

        const memUser = MEM_DB.users.find(u => u.username === username || u.userId === userId);
        if (memUser) {
            memUser.permissionPending = false;
            memUser.syncStatus = 'Success';
            memUser.syncComment = 'បានទទួលការកំណត់សិទ្ធិថ្មីជោគជ័យ';
        }

        res.json({ success: true, message: 'Sync acknowledged successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE user — remove from all DBs that have it
router.delete('/:id', async (req, res) => {
    try {
        let user = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(User, (M) => {
                try { return M.findById(req.params.id).then(r => r ? [r] : []); } catch { return []; }
            });
            user = results[0];
            if (!user) {
                const r2 = await queryAllDBs(User, (M) => M.find({ userId: req.params.id }));
                user = r2[0] || null;
            }
        } else {
            user = MEM_DB.users.find(u => u._id === req.params.id || u.userId === req.params.id);
        }
        if (user && (user.isImmutable || user.username === '@hakyonghouv')) {
            return res.status(403).json({ error: 'Master Admin account (@hakyonghouv) cannot be deleted!' });
        }
        if (isMongoConnected && user) {
            // Delete from all DBs that have this document
            await Promise.allSettled(
                [User].map(async (M) => {
                    await queryAllDBs(M, async (BoundM) => {
                        await BoundM.findByIdAndDelete(user._id).catch(() => {});
                        return [];
                    });
                })
            );
        }
        MEM_DB.users = MEM_DB.users.filter(u => u._id !== req.params.id && u.userId !== req.params.id);

        // Record audit log with snapshot of deleted user
        recordSystemAudit({
            category: 'Security',
            level: 'Warning',
            action: 'USER_ACCOUNT_DELETE',
            taskCategory: 'Account Deletion',
            description: `Deleted user account: ${user?.username || req.params.id} (Role: ${user?.role || 'Staff'}, Brand: ${user?.brand || 'All'})`,
            username: req.user?.username || req.query?.operator || 'Admin',
            name: req.user?.name || '',
            role: req.user?.role || 'Admin',
            brand: user?.brand || '',
            payload: {
                deletedData: user ? {
                    _id: user._id,
                    userId: user.userId,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    brand: user.brand,
                    phone: user.phone,
                    telegramId: user.telegramId,
                    permissions: user.permissions
                } : { id: req.params.id }
            }
        }).catch(() => {});

        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TELEGRAM SETUP — search all DBs
router.post('/telegram-setup', async (req, res) => {
    try {
        const { username, telegramId, enable2FA, secondPassword } = req.body;
        let user = null;
        if (isMongoConnected) {
            const r = await queryAllDBs(User, (M) => M.find({ username }));
            user = r[0] || null;
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }
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

// UPDATE PROFILE — search all DBs
router.post('/update-profile', async (req, res) => {
    try {
        const { username, email, oldPassword, newPassword, telegramId, enable2FA, secondPassword } = req.body;
        let user = null;
        if (isMongoConnected) {
            const r = await queryAllDBs(User, (M) => M.find({ username }));
            user = r[0] || null;
        } else {
            user = MEM_DB.users.find(u => u.username === username);
        }
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

// BLOCK / UNBLOCK USER — search across all DBs
router.post('/block', async (req, res) => {
    try {
        const { userId, block } = req.body;
        let user = null;
        if (isMongoConnected) {
            const results = await queryAllDBs(User, (M) => {
                try { return M.findById(userId).then(r => r ? [r] : []); } catch { return []; }
            });
            user = results[0];
            if (!user) {
                const r2 = await queryAllDBs(User, (M) => M.find({ userId }));
                user = r2[0] || null;
            }
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

export default router;
