import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';

const router = express.Router();

// GET all users
router.get('/', async (req, res) => {
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

// STATUS CHECK — lightweight polling endpoint
router.get('/status-check', async (req, res) => {
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

// CREATE user
router.post('/', async (req, res) => {
    try {
        const { name, username, email, password, role, permissions, brand } = req.body;
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        const memId = 'u-' + Date.now();
        const userId = 'USR-' + Math.floor(100000 + Math.random() * 900000);

        if (isMongoConnected) {
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

// UPDATE user
router.put('/:id', async (req, res) => {
    try {
        const { name, username, email, password, role, brand, permissions } = req.body;
        let user = null;
        if (isMongoConnected) {
            try {
                user = await User.findById(req.params.id);
            } catch {
                user = await User.findOne({ userId: req.params.id });
            }
        } else {
            user = MEM_DB.users.find(u => u._id === req.params.id || u.userId === req.params.id);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.isImmutable || user.username === '@hakyonghouv') {
            return res.status(403).json({ error: 'Master Admin account (@hakyonghouv) is protected and CANNOT be edited!' });
        }

        if (name) user.name = name;
        if (username) user.username = username;
        if (email) user.email = email;
        if (role) user.role = role;
        if (brand !== undefined) user.brand = brand;
        if (permissions) user.permissions = permissions;
        if (password && password.trim() !== '') {
            user.password = await bcrypt.hash(password, 10);
        }

        if (isMongoConnected) {
            await user.save();
        }
        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE user
router.delete('/:id', async (req, res) => {
    try {
        let user = null;
        if (isMongoConnected) {
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

// TELEGRAM SETUP
router.post('/telegram-setup', async (req, res) => {
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

// UPDATE PROFILE
router.post('/update-profile', async (req, res) => {
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

// BLOCK / UNBLOCK USER
router.post('/block', async (req, res) => {
    try {
        const { userId, block } = req.body;
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

export default router;
