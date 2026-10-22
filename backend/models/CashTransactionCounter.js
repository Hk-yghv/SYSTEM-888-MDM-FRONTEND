import mongoose from 'mongoose';

const cashTransactionCounterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    sequence: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export default mongoose.model('CashTransactionCounter', cashTransactionCounterSchema);
