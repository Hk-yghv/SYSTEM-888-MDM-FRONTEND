import mongoose from 'mongoose';

const phoneProductCatalogSchema = new mongoose.Schema({
    brand: { type: String, default: '', trim: true },
    products: { type: [mongoose.Schema.Types.Mixed], default: [] },
    defects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    updatedBy: { type: String, default: '' }
}, { timestamps: true });

phoneProductCatalogSchema.index({ brand: 1 }, { unique: true });

export default mongoose.model('PhoneProductCatalog', phoneProductCatalogSchema);
