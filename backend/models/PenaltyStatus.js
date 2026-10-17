import mongoose from 'mongoose';

const penaltyStatusSchema = new mongoose.Schema({
    status: { type: String, required: true, trim: true, unique: true },
    createdBy: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('PenaltyStatus', penaltyStatusSchema);
