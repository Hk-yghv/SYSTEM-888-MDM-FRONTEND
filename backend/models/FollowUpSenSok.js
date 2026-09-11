import mongoose from 'mongoose';

const followUpSenSokSchema = new mongoose.Schema({
    followUpId: { type: String, required: true },
    date: { type: String, required: true, default: () => new Date().toISOString().split('T')[0] }, // កាលបរិច្ឆេទ (YYYY-MM-DD)
    customerName: { type: String, required: true }, // ឈ្មោះអតិថិជន
    phone: { type: String, default: '' }, // លេខទូរស័ព្ទ
    location: { type: String, default: 'សែនសុខ' }, // ទីតាំង
    source: { type: String, default: 'Facebook' }, // តាមរយៈ (Facebook, Telegram, TikTok, Phone Call, Walk-in, etc.)
    requestedAmount: { type: Number, default: 0 }, // ចំនួនស្នើបញ្ចាំ ($)
    collateralType: { type: String, default: '' }, // ប្រភេទទ្រព្យ
    description: { type: String, default: '' }, // បរិយាយ
    link: { type: String, default: '' }, // link
    username: { type: String, default: 'Staff' }, // username
    responder: { type: String, default: '' }, // អ្នកឆ្លើយតប
    brand: { type: String, default: 'MDM' },
    status: { type: String, default: 'ជោគជ័យ' }, // ស្ថានភាព
    images: { type: [String], default: [] },
    notes: { type: String, default: '' }
}, { timestamps: true });

followUpSenSokSchema.index({ brand: 1, date: -1 });
followUpSenSokSchema.index({ customerName: 1, phone: 1 });

export default mongoose.model('FollowUpSenSok', followUpSenSokSchema);
