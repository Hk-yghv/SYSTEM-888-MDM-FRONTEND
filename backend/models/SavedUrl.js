import mongoose from 'mongoose';

const savedUrlSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    visibility: { type: String, enum: ['Public', 'Private'], default: 'Public' },
    description: { type: String, default: '', trim: true },
    tags: { type: [String], default: [] },
    brand: { type: String, default: '' },
    createdBy: { type: String, default: 'Administrator' },
    clicks: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('SavedUrl', savedUrlSchema);
