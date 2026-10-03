import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameKh: { type: String, default: '' },
    joinDate: { type: String, default: '' },
    qrCodePhoto: { type: String, default: '' },
    qrLoginToken: { type: String, default: '' },
    qrLoginExpiresAt: { type: Date, default: null },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    secondPassword: { type: String, default: '' },
    brand: { type: String, default: '' },
    role: { type: String, default: 'User' },
    isImmutable: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    status: { type: String, enum: ['Online', 'Offline'], default: 'Offline' },
    telegramId: { type: String, default: '' },
    twoFactorEnabled: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    lastOtp: { type: String, default: '' },
    otpHistory: [{
        otp: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        usedAt: { type: Date },
        status: { type: String, default: 'Pending' }, // 'Pending', 'Verified', 'Expired'
        ip: { type: String, default: '127.0.0.1' }
    }],
    onlineHistory: [{
        loginTime: { type: Date, default: Date.now },
        lastSeen: { type: Date, default: Date.now },
        logoutTime: { type: Date },
        durationSeconds: { type: Number, default: 0 },
        ip: { type: String, default: '127.0.0.1' },
        deviceInfo: { type: String, default: 'Web Browser' }
    }],
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: '127.0.0.1' },
        deviceInfo: { type: String, default: 'Web Browser' },
        status: { type: String, default: 'Success' }
    }],
    permissions: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

export default mongoose.model('User', userSchema);

