import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
    location: {
        type: String,
        enum: ['sen-sok', 'chbar-ampov', 'stueng-mean-chey'],
        required: true,
        index: true
    },
    brand: { type: String, default: '', trim: true, index: true },
    assetName: { type: String, required: true, trim: true, maxlength: 160 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    imageUrl: { type: String, required: true, maxlength: 5000 },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true });

inventoryItemSchema.index({ location: 1, createdAt: -1 });

export default mongoose.model('InventoryItem', inventoryItemSchema);
