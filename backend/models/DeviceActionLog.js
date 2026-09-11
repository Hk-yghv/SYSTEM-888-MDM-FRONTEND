import mongoose from 'mongoose';

const deviceActionLogSchema = new mongoose.Schema({
    logId: { type: String, required: true, unique: true },
    contractId: { type: String, required: true },
    customerName: { type: String, required: true },
    model: { type: String, required: true },
    serialNumber: { type: String, required: true },

    actionType: {
        type: String,
        enum: ['Lock Phone', 'Unlock Phone', 'Lock Wallpaper', 'Unlock Wallpaper', 'Set Wallpaper'],
        required: true
    },

    status: {
        type: String,
        enum: ['Pending', 'Success', 'Rejected'],
        default: 'Pending'
    },

    performedBy: { type: String, default: 'Administrator' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    reason: { type: String, default: '' },
    brand: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('DeviceActionLog', deviceActionLogSchema);
