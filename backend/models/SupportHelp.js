import mongoose from 'mongoose';

const supportHelpSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    text: { type: String, default: '', trim: true },
    page: { type: String, default: 'General', trim: true },
    pages: { type: [String], default: [] },
    photos: { type: [String], default: [] },
    videoUrl: { type: String, default: '', trim: true },
    facebookUrl: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: 'Administrator' }
}, { timestamps: true });

export default mongoose.model('SupportHelp', supportHelpSchema);
