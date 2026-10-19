import mongoose from 'mongoose';

// 1. Persistent Contact Profile per Contract
const telegramAuditContactSchema = new mongoose.Schema({
    contractId: { type: String, required: true, index: true },
    contractIid: { type: String, default: '', index: true },
    customerName: { type: String, default: '' },
    contactName: { type: String, default: '' },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

// 2. Daily Audit Log per Contract per Date
const telegramAuditLogSchema = new mongoose.Schema({
    contractId: { type: String, required: true, index: true },
    contractIid: { type: String, default: '' },
    customerName: { type: String, default: '' },
    auditDate: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    auditDateTime: { type: String, default: '' },
    statusAccount: { type: String, default: '', index: true },
    accountActivity: { type: String, default: '' },
    noteAudit: { type: String, default: '' },
    statusAccount2: { type: String, default: '', index: true },
    accountActivity2: { type: String, default: '' },
    noteAudit2: { type: String, default: '' },
    auditDate2: { type: String, default: '' },
    auditDateTime2: { type: String, default: '' },
    auditedBy: { type: String, default: 'Staff' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

// 3. Daily Submission Tracker
const telegramAuditSubmissionSchema = new mongoose.Schema({
    auditDate: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    auditRound: { type: String, default: 'AM', enum: ['AM', 'PM'] },
    isSubmitted: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

export const TelegramAuditContact = mongoose.model('TelegramAuditContact', telegramAuditContactSchema);
export const TelegramAuditLog = mongoose.model('TelegramAuditLog', telegramAuditLogSchema);
export const TelegramAuditSubmission = mongoose.model('TelegramAuditSubmission', telegramAuditSubmissionSchema);

export default TelegramAuditLog;
