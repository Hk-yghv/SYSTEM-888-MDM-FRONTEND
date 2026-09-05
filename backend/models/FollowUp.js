import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
    followUpId: { type: String, required: true },
    date: { type: String, required: true, default: () => new Date().toISOString().split('T')[0] },
    message: { type: String, required: true },
    totalMessages: { type: Number, default: 0 },
    noResponse: { type: Number, default: 0 },
    requested: { type: Number, default: 0 },
    review: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    contractCreated: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    brand: { type: String, default: '' },
    createdBy: { type: String, default: 'Staff' },
    notes: { type: String, default: '' }
}, { timestamps: true });

followUpSchema.index({ brand: 1, date: -1 });

export default mongoose.model('FollowUp', followUpSchema);
