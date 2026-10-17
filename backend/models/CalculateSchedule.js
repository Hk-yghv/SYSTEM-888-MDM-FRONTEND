import mongoose from 'mongoose';

const calculateScheduleSchema = new mongoose.Schema({
    contractNumber: { type: String, default: '' },
    customerName: { type: String, default: '' },
    assetName: { type: String, default: '' },
    assetType: { type: String, default: '' },
    startDate: { type: String, required: true },
    principal: { type: Number, required: true },
    ratePercent: { type: Number, required: true },
    months: { type: Number, required: true },
    monthlyInterest: { type: Number, default: 0 },
    totalInterest: { type: Number, default: 0 },
    schedule: { type: Array, default: [] },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('CalculateSchedule', calculateScheduleSchema);
