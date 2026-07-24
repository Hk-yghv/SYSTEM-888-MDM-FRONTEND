import mongoose from 'mongoose';
import { encryptText, decryptText } from '../utils/cryptoUtil.js';

const contractSchema = new mongoose.Schema({
    contractId: { type: String, required: true, unique: true },
    inputDate: { type: String, required: true },

    // Customer Information
    customerNameEn: { type: String, required: true },
    customerNameKh: { type: String, required: true },
    idCardNumber: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, default: 'male' },
    birthAddress: { type: String, default: '' },
    currentAddress: { type: String, default: '' },
    phone: { type: String, default: '' },
    relativePhone: { type: String, default: '' },
    facebookName: { type: String, default: '' },
    telegramName: { type: String, default: '' },
    urlFb: { type: String, default: '' },
    customerPhoto: { type: String, default: '' },

    // Device Information
    model: { type: String, required: true },
    serialNumber: { type: String, required: true },
    imei1: { type: String, default: '' },
    imei2: { type: String, default: '' },
    color: { type: String, default: '' },
    version: { type: String, default: '' },

    // Loan Information
    amount: { type: Number, default: 0 },
    interest: { type: String, default: '14%' },
    adminFee: { type: Number, default: 0 },
    duration: { type: String, default: '12 Months' },
    interestType: { type: String, default: '14%' },
    totalAmount: { type: Number, default: 0 },
    monthlyPayment: { type: Number, default: 0 },

    // Status & Locks
    status: {
        type: String,
        enum: ['Application', 'Activated', 'Check', 'Redeem', 'Comments', 'Blacklist'],
        default: 'Application'
    },
    lockPhoneStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    lockWallpaperStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    notes: { type: String, default: '' },
    // Admin tracking
    modifiedByAdmin: { type: Boolean, default: false },
    lastModifiedBy: { type: String, default: '' },
    googleDrivePhotoUrl: { type: String, default: '' }
}, { timestamps: true });

// Encrypt sensitive customer details before saving
contractSchema.pre('save', function (next) {
    if (this.isModified('idCardNumber') && this.idCardNumber && !this.idCardNumber.includes(':')) {
        this.idCardNumber = encryptText(this.idCardNumber);
    }
    if (this.isModified('phone') && this.phone && !this.phone.includes(':')) {
        this.phone = encryptText(this.phone);
    }
    next();
});

contractSchema.post('find', function (docs) {
    if (Array.isArray(docs)) {
        docs.forEach(doc => {
            if (doc.idCardNumber) doc.idCardNumber = decryptText(doc.idCardNumber);
            if (doc.phone) doc.phone = decryptText(doc.phone);
        });
    }
});

contractSchema.post('findOne', function (doc) {
    if (doc) {
        if (doc.idCardNumber) doc.idCardNumber = decryptText(doc.idCardNumber);
        if (doc.phone) doc.phone = decryptText(doc.phone);
    }
});

export default mongoose.model('Contract', contractSchema);
