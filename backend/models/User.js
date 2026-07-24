import mongoose from 'mongoose';
import { encryptText, decryptText } from '../utils/cryptoUtil.js';

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'User' },
    isImmutable: { type: Boolean, default: false },
    status: { type: String, enum: ['Online', 'Offline'], default: 'Offline' },
    telegramId: { type: String, default: '' },
    twoFactorEnabled: { type: Boolean, default: false },
    lastOtp: { type: String, default: '' },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: '127.0.0.1' },
        deviceInfo: { type: String, default: 'Web Browser' }
    }],
    permissions: {
        type: Map,
        of: {
            read: { type: Boolean, default: true },
            edit: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        default: {}
    }
}, { timestamps: true });

// Encrypt email and telegramId before saving
userSchema.pre('save', function (next) {
    if (this.isModified('email') && this.email && !this.email.includes(':')) {
        this.email = encryptText(this.email);
    }
    if (this.isModified('telegramId') && this.telegramId && !this.telegramId.includes(':')) {
        this.telegramId = encryptText(this.telegramId);
    }
    next();
});

// Decrypt on retrieval
userSchema.post('find', function (docs) {
    if (Array.isArray(docs)) {
        docs.forEach(doc => {
            if (doc.email) doc.email = decryptText(doc.email);
            if (doc.telegramId) doc.telegramId = decryptText(doc.telegramId);
        });
    }
});

userSchema.post('findOne', function (doc) {
    if (doc) {
        if (doc.email) doc.email = decryptText(doc.email);
        if (doc.telegramId) doc.telegramId = decryptText(doc.telegramId);
    }
});

export default mongoose.model('User', userSchema);
