import mongoose from 'mongoose';

const deviceAuditProfileSchema = new mongoose.Schema({
    contractId: { type: String, required: true, index: true },
    contractIid: { type: String, default: '', index: true },
    customerName: { type: String, default: '' },
    contactName: { type: String, default: '' },
    username: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

const deviceAuditLogSchema = new mongoose.Schema({
    contractId: { type: String, required: true, index: true },
    contractIid: { type: String, default: '' },
    customerName: { type: String, default: '' },
    auditDate: { type: String, required: true, index: true },
    auditDateTime: { type: String, default: '' },
    deviceStatus: { type: String, default: '', index: true },
    accountActivity: { type: String, default: '' },
    noteAudit: { type: String, default: '' },
    deviceStatus2: { type: String, default: '', index: true },
    accountActivity2: { type: String, default: '' },
    noteAudit2: { type: String, default: '' },
    auditDate2: { type: String, default: '' },
    auditDateTime2: { type: String, default: '' },
    auditedBy: { type: String, default: 'Staff' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

const deviceAuditSubmissionSchema = new mongoose.Schema({
    auditDate: { type: String, required: true, index: true },
    auditRound: { type: String, default: 'AM', enum: ['AM', 'PM'] },
    isSubmitted: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: String, default: '' },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' }
}, { timestamps: true });

export const DeviceAuditContact = mongoose.model('DeviceAuditContact', deviceAuditProfileSchema);
export const DeviceAuditLog = mongoose.model('DeviceAuditLog', deviceAuditLogSchema);
export const DeviceAuditSubmission = mongoose.model('DeviceAuditSubmission', deviceAuditSubmissionSchema);

