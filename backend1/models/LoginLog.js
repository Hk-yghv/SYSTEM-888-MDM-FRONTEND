import mongoose from 'mongoose';

const loginLogSchema = new mongoose.Schema({
    userId: { type: String, default: '' },
    username: { type: String, required: true },
    name: { type: String, default: 'Unknown User' },
    role: { type: String, default: 'Guest' },
    brand: { type: String, default: 'SYSTEM' },
    ip: { type: String, default: '127.0.0.1' },
    deviceInfo: { type: String, default: 'Web Browser' },
    status: { type: String, enum: ['Success', 'Failed'], default: 'Success' },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('LoginLog', loginLogSchema);
