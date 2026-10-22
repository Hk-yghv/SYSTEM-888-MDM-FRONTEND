import mongoose from 'mongoose';

const cashTransactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true },
    type: { type: String, enum: ['cash_out', 'cash_in', 'penalty'], required: true },
    date: { type: String, required: true, default: () => new Date().toISOString().split('T')[0] },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, enum: ['USD', 'KHR'], default: 'USD' },
    paymentMethod: { type: String, enum: ['Cash', 'Bank'], default: 'Cash' },
    amountUSD: { type: Number, required: true, default: 0 },
    category: { type: String, default: 'General' },
    description: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    photoUrls: { type: [String], default: [] },
    performedBy: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' },
    contractOR: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('CashTransaction', cashTransactionSchema);
