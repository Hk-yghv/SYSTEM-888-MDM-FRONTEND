import mongoose from 'mongoose';

const wallpaperLogSchema = new mongoose.Schema({
    logId: { type: String, required: true, unique: true },
    contractId: { type: String, required: true },
    customerName: { type: String, required: true },
    model: { type: String, required: true },
    serialNumber: { type: String, required: true },
    action: { type: String, enum: ['Locked', 'Unlocked'], required: true },
    performedBy: { type: String, default: 'Administrator' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    reason: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('WallpaperLog', wallpaperLogSchema);
