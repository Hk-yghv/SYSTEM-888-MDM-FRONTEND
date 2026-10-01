import mongoose from 'mongoose';

// Sub-schema: Individual message within a chat
const messageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    messageId: { type: Number },
    sender: { type: String, enum: ['me', 'them'], default: 'them' },
    senderName: { type: String, default: '' },
    text: { type: String, default: '' },
    mediaType: { type: String, default: null }, // photo, voice, audio, video, document, sticker
    mediaFileId: { type: String, default: null },
    mediaUrl: { type: String, default: null },
    mediaFileName: { type: String, default: null },
    mediaFileSize: { type: Number, default: null },
    mediaDuration: { type: Number, default: null },
    mediaMimeType: { type: String, default: null },
    time: { type: String, default: '' },
    status: { type: String, default: 'read' }, // sending, delivered, read
    rawDate: { type: Number, default: null }
}, { _id: false });

// Sub-schema: A single Telegram chat conversation
const chatSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, default: '' },
    type: { type: String, default: 'personal' }, // personal, group, channel, bot
    username: { type: String, default: '' },
    unreadCount: { type: Number, default: 0 },
    color: { type: String, default: '#0284c7' },
    messages: { type: [messageSchema], default: [] }
}, { _id: false });

// Main schema: One Telegram Bot Account per entry (scoped to a system user)
const telegramAccountSchema = new mongoose.Schema({
    // System user who owns this bot account
    ownerUsername: { type: String, required: true, index: true },

    // Client-side account ID (for stable UI references)
    clientId: { type: String, required: true },

    // Bot configuration
    name: { type: String, default: 'Telegram Bot' },
    botToken: { type: String, required: true },
    username: { type: String, default: '' },
    color: { type: String, default: '#0284c7' },
    botInfo: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Polling state
    lastUpdateId: { type: Number, default: 0 },

    // Conversations
    chats: { type: [chatSchema], default: [] }
}, { timestamps: true });

// Compound unique index: one (ownerUsername, clientId) pair per document
telegramAccountSchema.index({ ownerUsername: 1, clientId: 1 }, { unique: true });

export default mongoose.model('TelegramAccount', telegramAccountSchema);
