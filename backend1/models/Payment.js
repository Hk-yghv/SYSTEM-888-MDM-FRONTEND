import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true },
    contractId: { type: String, required: true },
    customerName: { type: String, default: 'Customer' },
    photo: { type: String, default: '' },
    serialNumber: { type: String, default: 'N/A' },
    model: { type: String, default: 'Device' },
    paidDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
    paidBy: { type: String, default: 'QR Mobile Payment' },
    amount: { type: Number, required: true, default: 0 },
    description: { type: String, default: '' },
    brand: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
