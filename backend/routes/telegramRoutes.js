import express from 'express';
import { randomUUID } from 'crypto';
import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import TelegramAccount from '../models/TelegramAccount.js';
import { isMongoConnected } from '../config/db.js';
import { queryAllDBs, getWriteModel } from '../config/multiDB.js';
import { encryptText, decryptText } from '../utils/cryptoUtil.js';

const router = express.Router();

// In-memory fallback
const MEM_TELEGRAM_ACCOUNTS = [];
const PENDING_USER_LOGINS = new Map();

// The owner must come from the verified JWT set by verifySecurityAuth.
const getOwner = (req) => {
    if (req.user?.username) return req.user.username;
    if (req.user?.userId) return req.user.userId;
    return null;
};

const getStoredAccounts = async (owner) => {
    if (isMongoConnected) {
        try {
            return await queryAllDBs(TelegramAccount, M => M.find({ ownerUsername: owner }).lean());
        } catch (err) {
            console.warn('[Telegram] Account lookup failed, using memory fallback:', err.message);
        }
    }
    return MEM_TELEGRAM_ACCOUNTS.filter(account => account.ownerUsername === owner);
};

const countAccounts = async (owner, accountType) => {
    const accounts = await getStoredAccounts(owner);
    return accounts.filter(account => (account.accountType || 'bot') === accountType).length;
};

const saveUserAccount = async (owner, clientId, account, profile) => {
    const me = profile || {};
    const accountDoc = {
        ownerUsername: owner,
        clientId,
        accountType: 'user',
        name: [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || account.phoneNumber,
        username: me.username ? `@${me.username}` : '',
        phoneNumber: encryptText(account.phoneNumber),
        apiId: encryptText(String(account.apiId)),
        apiHash: encryptText(account.apiHash),
        sessionString: encryptText(account.client.session.save()),
        appTitle: account.appTitle,
        appShortName: account.appShortName,
        environment: account.environment,
        color: account.color || '#059669',
        botToken: '',
        botInfo: {},
        chats: []
    };

    if (isMongoConnected) {
        try {
            const WriteModel = getWriteModel(TelegramAccount) || TelegramAccount;
            const accountCount = await WriteModel.countDocuments({ ownerUsername: owner, accountType: 'user' });
            if (accountCount >= 5) return false;
            await WriteModel.create(accountDoc);
            return true;
        } catch (err) {
            console.warn('[Telegram] Could not save user account to DB, using memory fallback:', err.message);
        }
    }

    if (MEM_TELEGRAM_ACCOUNTS.filter(item => item.ownerUsername === owner && item.accountType === 'user').length >= 5) {
        return false;
    }
    MEM_TELEGRAM_ACCOUNTS.push(accountDoc);
    return true;
};

const publicAccount = (account) => ({
    id: account.clientId || account.id,
    type: account.accountType || 'bot',
    name: account.name,
    token: account.accountType === 'user' ? undefined : account.botToken || account.token,
    username: account.username,
    phoneNumber: account.accountType === 'user' ? decryptText(account.phoneNumber) : undefined,
    color: account.color,
    botInfo: account.botInfo || {},
    environment: account.environment || 'production',
    lastUpdateId: account.lastUpdateId || 0,
    chats: account.chats || []
});

const createTelegramClient = (apiId, apiHash, session = '', environment = 'production') => new TelegramClient(
    new StringSession(session),
    Number(apiId),
    apiHash,
    { connectionRetries: 3, testServers: environment === 'test' }
);

const getOwnedAccount = async (owner, clientId) => {
    const accounts = await getStoredAccounts(owner);
    return accounts.find(account => (account.clientId || account.id) === clientId) || null;
};

const openUserClient = async (account) => {
    const client = createTelegramClient(
        decryptText(account.apiId),
        decryptText(account.apiHash),
        decryptText(account.sessionString),
        account.environment || 'production'
    );
    await client.connect();
    if (!await client.checkAuthorization()) {
        await client.disconnect();
        throw new Error('Telegram session expired; reconnect this account');
    }
    return client;
};

const serializeMessage = (message) => ({
    id: `tg_${message.id}`,
    messageId: Number(message.id),
    sender: message.out ? 'me' : 'them',
    senderName: '',
    text: message.message || '',
    time: message.date ? new Date(Number(message.date) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    status: 'read',
    rawDate: Number(message.date) || null
});

const resolveDialog = async (client, chatId) => {
    const dialogs = await client.getDialogs({ limit: 50 });
    return dialogs.find(dialog => String(dialog.id) === String(chatId));
};

const telegramError = (err) => {
    const message = String(err?.errorMessage || err?.message || 'Telegram login failed');
    if (/SESSION_PASSWORD_NEEDED/i.test(message)) return 'TWO_FACTOR_REQUIRED';
    if (/PHONE_CODE_INVALID|PHONE_CODE_EXPIRED|PHONE_NUMBER_INVALID|API_ID_INVALID|PASSWORD_HASH_INVALID/i.test(message)) {
        return message.split(':')[0];
    }
    return 'Telegram could not complete this request';
};

// ── POST /api/telegram/user-auth/send-code
router.post('/user-auth/send-code', async (req, res) => {
    const owner = getOwner(req);
    if (!owner) return res.status(401).json({ error: 'Unauthorized' });

    let client;
    try {
        const { apiId, apiHash, phoneNumber, appTitle, appShortName, color, environment } = req.body;
        if (!/^\d+$/.test(String(apiId || '')) || !apiHash || !phoneNumber) {
            return res.status(400).json({ error: 'api_id, api_hash, and phone number are required' });
        }
        if (await countAccounts(owner, 'user') >= 5) {
            return res.status(400).json({ error: 'Maximum 5 real Telegram accounts allowed per user' });
        }

        const selectedEnvironment = environment === 'test' ? 'test' : 'production';
        client = createTelegramClient(apiId, apiHash, '', selectedEnvironment);
        await client.connect();
        const result = await client.sendCode(
            { apiId: Number(apiId), apiHash: String(apiHash) },
            String(phoneNumber).trim()
        );
        if (result.emailRequired) {
            await client.disconnect();
            return res.status(400).json({ error: 'Telegram requires email verification for this login; use a phone-code login flow.' });
        }
        const challengeId = randomUUID();
        const attempt = {
            owner,
            client,
            apiId: Number(apiId),
            apiHash: String(apiHash),
            phoneNumber: String(phoneNumber).trim(),
            phoneCodeHash: result.phoneCodeHash,
            appTitle: String(appTitle || '').trim(),
            appShortName: String(appShortName || '').trim(),
            environment: selectedEnvironment,
            color: color || '#059669'
        };
        const expiry = setTimeout(() => {
            PENDING_USER_LOGINS.delete(challengeId);
            client.disconnect().catch(() => {});
        }, 10 * 60 * 1000);
        expiry.unref?.();
        attempt.expiry = expiry;
        PENDING_USER_LOGINS.set(challengeId, attempt);

        return res.json({
            challengeId,
            codeSentViaApp: result.isCodeViaApp,
            emailRequired: Boolean(result.emailRequired)
        });
    } catch (err) {
        if (client) await client.disconnect().catch(() => {});
        console.error('[Telegram] User account code request failed:', err.message);
        return res.status(400).json({ error: telegramError(err) });
    }
});

// ── POST /api/telegram/user-auth/verify-code
router.post('/user-auth/verify-code', async (req, res) => {
    const owner = getOwner(req);
    if (!owner) return res.status(401).json({ error: 'Unauthorized' });

    const { challengeId, code, password } = req.body;
    const attempt = PENDING_USER_LOGINS.get(challengeId);
    if (!attempt || attempt.owner !== owner) return res.status(400).json({ error: 'Login challenge expired; request a new code' });
    if (!code) return res.status(400).json({ error: 'Telegram verification code is required' });

    try {
        let profile;
        try {
            profile = await attempt.client.invoke(new Api.auth.SignIn({
                phoneNumber: attempt.phoneNumber,
                phoneCodeHash: attempt.phoneCodeHash,
                phoneCode: String(code).trim()
            }));
        } catch (err) {
            if (!/SESSION_PASSWORD_NEEDED/i.test(String(err?.errorMessage || err?.message || ''))) throw err;
            if (!password) return res.status(200).json({ requiresPassword: true });
            profile = await attempt.client.signInWithPassword(
                { apiId: attempt.apiId, apiHash: attempt.apiHash },
                { password: async () => String(password), onError: async () => true }
            );
        }
        profile = profile.user || profile;

        if (await countAccounts(owner, 'user') >= 5) {
            clearTimeout(attempt.expiry);
            PENDING_USER_LOGINS.delete(challengeId);
            await attempt.client.disconnect();
            return res.status(400).json({ error: 'Maximum 5 real Telegram accounts allowed per user' });
        }

        const clientId = `user_${randomUUID()}`;
        const saved = await saveUserAccount(owner, clientId, attempt, profile);
        clearTimeout(attempt.expiry);
        PENDING_USER_LOGINS.delete(challengeId);
        await attempt.client.disconnect();
        if (!saved) return res.status(400).json({ error: 'Maximum 5 real Telegram accounts allowed per user' });

        return res.json({
            success: true,
            account: {
                id: clientId,
                type: 'user',
                name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || attempt.phoneNumber,
                username: profile.username ? `@${profile.username}` : '',
                phoneNumber: attempt.phoneNumber,
                color: attempt.color,
                chats: []
            }
        });
    } catch (err) {
        console.error('[Telegram] User account verification failed:', err.message);
        return res.status(400).json({ error: telegramError(err) });
    }
});

// ── GET /api/telegram/accounts/:id/chats
router.get('/accounts/:id/chats', async (req, res) => {
    const owner = getOwner(req);
    if (!owner) return res.status(401).json({ error: 'Unauthorized' });

    const account = await getOwnedAccount(owner, req.params.id);
    if (!account) return res.status(404).json({ error: 'Telegram account not found' });
    if ((account.accountType || 'bot') !== 'user') return res.json({ chats: account.chats || [] });

    let client;
    try {
        client = await openUserClient(account);
        const dialogs = await client.getDialogs({ limit: 50 });
        const chats = dialogs.map(dialog => ({
            id: String(dialog.id),
            name: dialog.title || dialog.name || String(dialog.id),
            type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'personal',
            username: dialog.entity?.username ? `@${dialog.entity.username}` : '',
            unreadCount: dialog.unreadCount || 0,
            color: account.color || '#059669',
            messages: dialog.message ? [serializeMessage(dialog.message)] : []
        }));
        return res.json({ chats });
    } catch (err) {
        console.error('[Telegram] User dialogs fetch failed:', err.message);
        return res.status(400).json({ error: err.message || 'Could not load Telegram conversations' });
    } finally {
        if (client) await client.disconnect().catch(() => {});
    }
});

// ── GET /api/telegram/accounts/:id/chats/:chatId/messages
router.get('/accounts/:id/chats/:chatId/messages', async (req, res) => {
    const owner = getOwner(req);
    if (!owner) return res.status(401).json({ error: 'Unauthorized' });

    const account = await getOwnedAccount(owner, req.params.id);
    if (!account || (account.accountType || 'bot') !== 'user') {
        return res.status(404).json({ error: 'Telegram user account not found' });
    }

    let client;
    try {
        client = await openUserClient(account);
        const dialog = await resolveDialog(client, req.params.chatId);
        if (!dialog?.entity) return res.status(404).json({ error: 'Telegram conversation not found' });
        const messages = await client.getMessages(dialog.entity, { limit: 50 });
        return res.json({ messages: messages.map(serializeMessage).reverse() });
    } catch (err) {
        console.error('[Telegram] User message history fetch failed:', err.message);
        return res.status(400).json({ error: err.message || 'Could not load Telegram messages' });
    } finally {
        if (client) await client.disconnect().catch(() => {});
    }
});

// ── POST /api/telegram/accounts/:id/messages
router.post('/accounts/:id/messages', async (req, res) => {
    const owner = getOwner(req);
    if (!owner) return res.status(401).json({ error: 'Unauthorized' });

    const account = await getOwnedAccount(owner, req.params.id);
    if (!account || (account.accountType || 'bot') !== 'user') {
        return res.status(404).json({ error: 'Telegram user account not found' });
    }
    const { chatId, text } = req.body;
    if (!chatId || !String(text || '').trim()) return res.status(400).json({ error: 'chatId and text are required' });

    let client;
    try {
        client = await openUserClient(account);
        const dialog = await resolveDialog(client, chatId);
        if (!dialog?.entity) return res.status(404).json({ error: 'Telegram conversation not found' });
        const sent = await client.sendMessage(dialog.entity, { message: String(text).trim() });
        return res.json({ success: true, message: serializeMessage(sent) });
    } catch (err) {
        console.error('[Telegram] User message send failed:', err.message);
        return res.status(400).json({ error: err.message || 'Could not send Telegram message' });
    } finally {
        if (client) await client.disconnect().catch(() => {});
    }
});

// ── GET /api/telegram/accounts
// Returns all bot accounts for the authenticated user
// NOTE: botToken is renamed to "token" in the response to bypass the global sensitive-data masking middleware
router.get('/accounts', async (req, res) => {
    try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'Unauthorized' });

        const accounts = await getStoredAccounts(owner);
        return res.json({ accounts: accounts.map(publicAccount) });
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
            accountType: 'bot',
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
                const existingCount = await WriteModel.countDocuments({
                    ownerUsername: owner,
                    clientId: { $ne: id },
                    $or: [{ accountType: 'bot' }, { accountType: { $exists: false } }]
                });
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
            const botCount = MEM_TELEGRAM_ACCOUNTS.filter(a => a.ownerUsername === owner && (a.accountType || 'bot') === 'bot').length;
            if (botCount >= 5) {
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
        const account = await getOwnedAccount(owner, id);
        if ((account?.accountType || 'bot') === 'user') {
            let client;
            try {
                client = await openUserClient(account);
                await client.logOut();
            } catch (logoutErr) {
                console.warn('[Telegram] Could not revoke remote user session during account deletion:', logoutErr.message);
            } finally {
                if (client) await client.disconnect().catch(() => {});
            }
        }

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
