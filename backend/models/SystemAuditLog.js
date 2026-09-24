import mongoose from 'mongoose';

const systemAuditLogSchema = new mongoose.Schema({
    eventId: { type: String, required: true }, // e.g., EVT-1001, EVT-4624 (Windows style)
    category: {
        type: String,
        enum: ['Security', 'Navigation', 'Contract', 'Device', 'Financial', 'Settings', 'System', 'UserActivity'],
        default: 'System'
    },
    level: {
        type: String,
        enum: ['Information', 'Warning', 'Error', 'SuccessAudit', 'AuditFailure'],
        default: 'Information'
    },
    action: { type: String, required: true }, // e.g. LOGIN, PAGE_VISIT, CONTRACT_CREATE, LOCK_PHONE
    taskCategory: { type: String, default: 'General' },
    description: { type: String, required: true },
    username: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, default: 'Staff' },
    brand: { type: String, default: '' },
    ip: { type: String, default: '127.0.0.1' },
    deviceInfo: { type: String, default: 'Windows PC' },
    path: { type: String, default: '' },
    contractId: { type: String, default: '' },
    customerId: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// Compound index for high-speed queries by brand, user, category, and date
systemAuditLogSchema.index({ brand: 1, username: 1, category: 1, timestamp: -1 });

export default mongoose.model('SystemAuditLog', systemAuditLogSchema);
