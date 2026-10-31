import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
    contractId: { type: String, required: true, unique: true },
    contractIid: { type: String, default: '' },
    inputDate: { type: String, required: true },

    // Customer Information
    customerNameEn: { type: String, required: true },
    customerNameKh: { type: String, required: true },
    customerId: { type: String, default: '', index: true },
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
    mosyleUrl: { type: String, default: '' },
    customerPhoto: { type: String, default: '' },
    photos: { type: [String], default: [] },
    evidencePhotos: { type: [String], default: [] },

    // Device Information
    model: { type: String, required: true },
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' },
    serialNumber: { type: String, required: true },
    imei1: { type: String, default: '' },
    imei2: { type: String, default: '' },
    meid: { type: String, default: '' },
    color: { type: String, default: '' },
    version: { type: String, default: '' },
    deviceProblem: { type: String, default: '' },
    capacity: { type: String, default: '' },
    repaymentSchedule: { type: Array, default: [] },

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
    redeemDate: { type: String, default: '' },
    redeemComment: { type: String, default: '', maxlength: 3000 },
    lockPhoneStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    lockWallpaperStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    notes: { type: String, default: '' },
    commentDate: { type: Date, default: null },
    commentHistory: [{
        comment: { type: String, default: '' },
        commentedAt: { type: Date, default: Date.now },
        editedBy: { type: String, default: '' }
    }],
    activatedDescriptionStatus: { type: String, default: '' },
    activatedDescriptionHistory: [{
        status: { type: String, required: true },
        description: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, default: '' }
    }],
    // Admin tracking & Edit History
    modifiedByAdmin: { type: Boolean, default: false },
    lastModifiedBy: { type: String, default: '' },
    googleDrivePhotoUrl: { type: String, default: '' },
    editHistory: [{
        timestamp: { type: Date, default: Date.now },
        editedBy: { type: String, default: 'Staff' },
        reason: { type: String, default: 'Updated contract details' },
        changedFields: [{ type: String }],
        previousData: { type: mongoose.Schema.Types.Mixed }
    }]
}, { timestamps: true });

export default mongoose.model('Contract', contractSchema);
