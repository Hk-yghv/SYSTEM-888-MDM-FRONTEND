import mongoose from 'mongoose';

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
    mosyleUrl: { type: String, default: '' },
    customerPhoto: { type: String, default: '' },

    // Device Information
    model: { type: String, required: true },
    brand: { type: String, default: '' },
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
    lockPhoneStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    lockWallpaperStatus: { type: String, enum: ['Unlocked', 'Locked'], default: 'Unlocked' },
    notes: { type: String, default: '' },
    // Admin tracking
    modifiedByAdmin: { type: Boolean, default: false },
    lastModifiedBy: { type: String, default: '' },
    googleDrivePhotoUrl: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Contract', contractSchema);

