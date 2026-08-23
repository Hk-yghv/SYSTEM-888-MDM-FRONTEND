import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
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
    lastOtp: { type: String, default: '' },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: '127.0.0.1' },
        deviceInfo: { type: String, default: 'Web Browser' },
        status: { type: String, default: 'Success' }
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

export default mongoose.model('User', userSchema);

