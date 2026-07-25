import mongoose from 'mongoose';

const controlSystemSchema = new mongoose.Schema({
    key: { type: String, required: true },
    brand: { type: String, default: '' },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

// Compound index to allow brand-specific keys
controlSystemSchema.index({ key: 1, brand: 1 }, { unique: true });

export default mongoose.model('ControlSystem', controlSystemSchema);

