import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    contractId: { type: String, required: true },
    customerName: { type: String, required: true },
    photo: { type: String, default: '' },
    serialNumber: { type: String, required: true },
    model: { type: String, required: true },
    paidDate: { type: String, required: true },
    paidBy: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    brand: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
