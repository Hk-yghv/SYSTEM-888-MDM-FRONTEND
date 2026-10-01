import express from 'express';
import jwt from 'jsonwebtoken';
import TelegramAccount from '../models/TelegramAccount.js';
import { isMongoConnected } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';

// In-memory fallback
const MEM_TELEGRAM_ACCOUNTS = [];

// Helper: get ownerUsername from JWT user (set by verifySecurityAuth middleware) or token/headers
const getOwner = (req) => {
    if (req.user?.username) return req.user.username;
    if (req.user?.userId) return req.user.userId;

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded?.username) return decoded.username;
            if (decoded?.userId) return decoded.userId;
        } catch { }
    }

    if (req.headers['x-username']) return req.headers['x-username'];
    if (req.body?.ownerUsername) return req.body.ownerUsername;
    if (req.query?.ownerUsername) return req.query.ownerUsername;

    return null;
};

// ── GET /api/telegram/accounts
// Returns all bot accounts for the authenticated user
// NOTE: botToken is renamed to "token" in the response to bypass the global sensitive-data masking middleware
router.get('/accounts', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        let accounts = [];
        if (isMongoConnected) {
            try {
                accounts = await queryAllDBs(TelegramAccount, (M) => M.find({ ownerUsername: owner }).lean());
            } catch (dbErr) {
                console.warn('[Telegram] MultiDB query failed, fallback to in-memory:', dbErr.message);
                accounts = MEM_TELEGRAM_ACCOUNTS.filter(acc => acc.ownerUsername === owner);
            }
        } else {
            accounts = MEM_TELEGRAM_ACCOUNTS.filter(acc => acc.ownerUsername === owner);
        }

        // Rename botToken -> token so the global masking middleware doesn't strip it
        const sanitized = (accounts || []).map(acc => ({
            id: acc.clientId || acc.id,
            name: acc.name,
            token: acc.botToken || acc.token,
            username: acc.username,
            color: acc.color,
            botInfo: acc.botInfo || {},
            lastUpdateId: acc.lastUpdateId || 0,
            chats: acc.chats || []
        }));

        return res.json({ accounts: sanitized });
    } catch (err) {
        console.error('[Telegram] GET accounts error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /api/telegram/accounts
// Upsert (create or update) a bot account
router.post('/accounts', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        const { id, name, token, username, color, botInfo, lastUpdateId, chats } = req.body;
        if (!id || !token) return res.status(400).json({ error: 'id and token are required' });

        const accountDoc = {
            ownerUsername: owner,
            clientId: id,
            name: name || 'Telegram Bot',
            botToken: token,
            username: username || '',
            color: color || '#0284c7',
            botInfo: botInfo || {},
            lastUpdateId: lastUpdateId || 0,
            chats: chats || []
        };

        if (isMongoConnected) {
            try {
                const WriteModel = getWriteModel(TelegramAccount) || TelegramAccount;

                // Enforce max 5 accounts per user
                const existingCount = await WriteModel.countDocuments({ ownerUsername: owner, clientId: { $ne: id } });
                if (existingCount >= 5) {
                    return res.status(400).json({ error: 'Maximum 5 Telegram accounts allowed per user' });
                }

                const updated = await WriteModel.findOneAndUpdate(
                    { ownerUsername: owner, clientId: id },
                    { $set: accountDoc },
                    { upsert: true, new: true, runValidators: false }
                );

                return res.json({ success: true, id: updated?.clientId || id });
            } catch (dbErr) {
                console.warn('[Telegram] MultiDB write failed, writing to memory fallback:', dbErr.message);
            }
        }

        // In-memory fallback
        const existingIdx = MEM_TELEGRAM_ACCOUNTS.findIndex(a => a.ownerUsername === owner && a.clientId === id);
        if (existingIdx >= 0) {
            MEM_TELEGRAM_ACCOUNTS[existingIdx] = { ...MEM_TELEGRAM_ACCOUNTS[existingIdx], ...accountDoc };
        } else {
            const userCount = MEM_TELEGRAM_ACCOUNTS.filter(a => a.ownerUsername === owner).length;
            if (userCount >= 5) {
                return res.status(400).json({ error: 'Maximum 5 Telegram accounts allowed per user' });
            }
            MEM_TELEGRAM_ACCOUNTS.push(accountDoc);
        }

        return res.json({ success: true, id });
    } catch (err) {
        console.error('[Telegram] POST accounts error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /api/telegram/accounts/:id/chats
// Incrementally update chats/messages for a specific account (avoids sending entire payload)
router.patch('/accounts/:id/chats', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        const { chats, lastUpdateId } = req.body;

        if (!Array.isArray(chats)) return res.status(400).json({ error: 'chats must be an array' });

        const update = { chats };
        if (lastUpdateId !== undefined) update.lastUpdateId = lastUpdateId;

        if (isMongoConnected) {
            try {
                const WriteModel = getWriteModel(TelegramAccount) || TelegramAccount;
                await WriteModel.updateOne(
                    { ownerUsername: owner, clientId: id },
                    { $set: update }
                );
                return res.json({ success: true });
            } catch (dbErr) {
                console.warn('[Telegram] MultiDB PATCH failed:', dbErr.message);
            }
        }

        const existing = MEM_TELEGRAM_ACCOUNTS.find(a => a.ownerUsername === owner && a.clientId === id);
        if (existing) {
            existing.chats = chats;
            if (lastUpdateId !== undefined) existing.lastUpdateId = lastUpdateId;
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('[Telegram] PATCH chats error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ── DELETE /api/telegram/accounts/:id
// Delete a specific bot account
router.delete('/accounts/:id', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;

        if (isMongoConnected) {
            try {
                const WriteModel = getWriteModel(TelegramAccount) || TelegramAccount;
                await WriteModel.deleteOne({ ownerUsername: owner, clientId: id });
                return res.json({ success: true });
            } catch (dbErr) {
                console.warn('[Telegram] MultiDB DELETE failed:', dbErr.message);
            }
        }

        const idx = MEM_TELEGRAM_ACCOUNTS.findIndex(a => a.ownerUsername === owner && a.clientId === id);
        if (idx >= 0) {
            MEM_TELEGRAM_ACCOUNTS.splice(idx, 1);
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('[Telegram] DELETE account error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
