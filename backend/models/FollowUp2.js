import mongoose from 'mongoose';

const followUp2Schema = new mongoose.Schema({
    followUpId: { type: String, required: true },
    customerName: { type: String, required: true }, // ឈ្មោះអតិថិជន
    source: { type: String, default: 'Facebook' }, // តាមរយៈ (Facebook, Telegram, TikTok, Walk-in, Call)
    phone: { type: String, default: '' }, // Tel
    requestedAmount: { type: Number, default: 0 }, // ចំនួនស្នើបញ្ចាំ
    collateralType: { type: String, default: '' }, // ប្រភេទទ្រព្យបញ្ចាំ
    model: { type: String, default: '' }, // Model ម៉ូឌែលឧបករណ៍
    responder: { type: String, default: '' }, // អ្នកឆ្លើយតបឆាត
    date: { type: String, required: true, default: () => new Date().toISOString().split('T')[0] }, // កាលបរិច្ឆេទឆ្នាំ
    valuationRange: { type: String, default: '' }, // វាយតម្លៃបានចន្លោះណាដល់ណា
    status: { type: String, default: 'ជោគជ័យ' }, // ជោគជ័យ ឬ បរាជ័យ
    reason: { type: String, default: '' }, // មូលហេតុ
    images: { type: [String], default: [] }, // រូបភាពឯកសារ/ទ្រព្យបញ្ចាំច្រើនសន្លឹក
    brand: { type: String, default: '' },
    subBrand: { type: String, default: '' },
    createdBy: { type: String, default: 'Staff' },
    notes: { type: String, default: '' }
}, { timestamps: true });

followUp2Schema.index({ brand: 1, date: -1 });

export default mongoose.model('FollowUp2', followUp2Schema);
