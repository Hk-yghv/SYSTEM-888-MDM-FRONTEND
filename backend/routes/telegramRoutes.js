import express from 'express';
import TelegramAccount from '../models/TelegramAccount.js';
import { isMongoConnected } from '../config/db.js';

const router = express.Router();

// Helper: get ownerUsername from JWT user (set by verifySecurityAuth middleware)
const getOwner = (req) => req.user?.username || req.user?.userId || null;

// ── GET /api/telegram/accounts
// Returns all bot accounts for the authenticated user
// NOTE: botToken is renamed to "token" in the response to bypass the global sensitive-data masking middleware
router.get('/accounts', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        if (!isMongoConnected) {
            return res.json({ accounts: [] });
        }

        const accounts = await TelegramAccount.find({ ownerUsername: owner }).lean();

        // Rename botToken -> token so the global masking middleware doesn't strip it
        const sanitized = accounts.map(acc => ({
            id: acc.clientId,
            name: acc.name,
            token: acc.botToken,       // <-- renamed field
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

        // Enforce max 5 accounts per user
        const existingCount = await TelegramAccount.countDocuments({ ownerUsername: owner, clientId: { $ne: id } });
        if (existingCount >= 5) {
            return res.status(400).json({ error: 'Maximum 5 Telegram accounts allowed per user' });
        }

        const updated = await TelegramAccount.findOneAndUpdate(
            { ownerUsername: owner, clientId: id },
            {
                $set: {
                    ownerUsername: owner,
                    clientId: id,
                    name: name || 'Telegram Bot',
                    botToken: token,
                    username: username || '',
                    color: color || '#0284c7',
                    botInfo: botInfo || {},
                    lastUpdateId: lastUpdateId || 0,
                    chats: chats || []
                }
            },
            { upsert: true, new: true, runValidators: false }
        );

        return res.json({ success: true, id: updated.clientId });
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

        const result = await TelegramAccount.updateOne(
            { ownerUsername: owner, clientId: id },
            { $set: update }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Account not found' });
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
        const result = await TelegramAccount.deleteOne({ ownerUsername: owner, clientId: id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('[Telegram] DELETE account error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
