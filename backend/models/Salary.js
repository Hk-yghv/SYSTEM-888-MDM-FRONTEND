import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
    staffName: { type: String, default: '' },
    staffNameKh: { type: String, default: '' }, // ឈ្មោះជាភាសាខ្មែរ
    staffNameEn: { type: String, default: '' }, // ឈ្មោះជាភាសាអង់គ្លេស
    joinDate: { type: String, default: '' }, // Format: YYYY-MM-DD (ថ្ងៃខែឆ្នាំចូលបម្រើការងារ)
    amount: { type: Number, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    month: { type: String, default: '' },   // Format: YYYY-MM
    year: { type: String, default: '' },    // Format: YYYY
    proofPhoto: { type: String, default: '' }, // Evidence / Receipt image URL or Base64
    qrCodePhoto: { type: String, default: '' }, // QR Code image URL or Base64 (រូបភាព QR Code ទទួលប្រាក់)
    category: { type: String, default: 'Basic Salary' }, // 'Basic Salary', 'Bonus', 'Commission', 'Allowance', 'Other'
    paymentMethod: { type: String, default: 'ABA Bank' }, // 'ABA Bank', 'Cash', 'Wing', 'Bank Transfer', 'Other'
    note: { type: String, default: '' },
    brand: { type: String, default: '' },
    createdBy: { type: String, default: 'Administrator' }
}, { timestamps: true });

// Pre-save hook to ensure month and year are indexed correctly from date
salarySchema.pre('save', function (next) {
    if (this.date) {
        const parts = this.date.split('-');
        if (parts.length >= 2) {
            this.year = parts[0];
            this.month = `${parts[0]}-${parts[1]}`;
        }
    }
    next();
});

export default mongoose.model('Salary', salarySchema);
