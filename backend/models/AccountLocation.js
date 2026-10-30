import mongoose from 'mongoose';

const accountLocationSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true, index: true },
    recordType: { type: String, enum: ['latest', 'history'], default: 'history', index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracyMeters: { type: Number, default: null },
    ip: { type: String, default: '' },
    deviceInfo: { type: String, default: 'Web Browser' },
    timestamp: { type: Date, default: Date.now, index: true },
    lastHistoryAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

accountLocationSchema.index({ userId: 1, timestamp: -1 });
accountLocationSchema.index(
    { userId: 1, recordType: 1 },
    { unique: true, partialFilterExpression: { recordType: 'latest' } }
);

export default mongoose.model('AccountLocation', accountLocationSchema);
