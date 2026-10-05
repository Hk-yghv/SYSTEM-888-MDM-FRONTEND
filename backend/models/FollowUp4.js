import mongoose from 'mongoose';

// 1. Follow Up 4 Lead Submission Schema (FOLLOW UP SUBMIT tab)
const followUp4SubmitSchema = new mongoose.Schema({
    date: { type: String, required: true }, // ថ្ងៃខែឆ្នាំ (YYYY-MM-DD)
    name: { type: String, default: '' }, // NAME
    userName: { type: String, default: '' }, // USER NAME
    phone: { type: String, default: '' }, // PHONE NUMBER
    nameTelegram: { type: String, default: '' }, // NAME TELEGRAM
    fromSource: { type: String, default: '' }, // មកពី (Droplist: PAGE, TELEGRAM, TikTok, etc.)
    namePgTlFrom: { type: String, default: '' }, // NAME PG OR TL មកពី
    contactType: { type: String, default: '' }, // ទាក់ទង (Droplist: Call, Chat, etc.)
    namePgTlContact: { type: String, default: '' }, // NAME PG OR TL ទាក់ទង
    appraisal: { type: String, default: '' }, // វាយតម្លៃ
    requested: { type: String, default: '' }, // បានស្នើ
    assetType: { type: String, default: '' }, // ប្រភេទទ្រព្យ
    model: { type: String, default: '' }, // MODEL
    status: { type: String, default: 'PENDING' }, // STATUS (Droplist)
    description: { type: String, default: '' }, // បរិយាយ
    brand: { type: String, required: true }, // Brand Isolation
    createdBy: { type: String, default: '' }
}, { timestamps: true });

followUp4SubmitSchema.index({ brand: 1, date: -1 });

// 2. Reject Submit Daily Entries (REJECT SUBMIT tab)
const followUp4RejectSubmitSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    brand: { type: String, required: true },
    reason: { type: String, required: true }, // Reason name configured in Control System
    count: { type: Number, default: 0 }, // Daily count
    createdBy: { type: String, default: '' }
}, { timestamps: true });

followUp4RejectSubmitSchema.index({ brand: 1, date: 1, reason: 1 }, { unique: true });

// 3. Reject CS Daily Entries (REJECT CS tab)
const followUp4RejectCSSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    brand: { type: String, required: true },
    reason: { type: String, required: true }, // Reason name configured in Control System
    count: { type: Number, default: 0 }, // Daily count
    createdBy: { type: String, default: '' }
}, { timestamps: true });

followUp4RejectCSSchema.index({ brand: 1, date: 1, reason: 1 }, { unique: true });

// 4. Detail Daily Metrics Entries (DETAIL tab)
const followUp4DetailSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    brand: { type: String, required: true },
    message: { type: Number, default: 0 }, // MESSAGE (Total messages / Inquiries)
    page: { type: Number, default: 0 }, // PAGE
    telegram: { type: Number, default: 0 }, // TELEGRAM
    noReply: { type: Number, default: 0 }, // NO REPLY
    inquire: { type: Number, default: 0 }, // INQUIRE
    rejectCs: { type: Number, default: 0 }, // REJECT CS
    more: { type: Number, default: 0 }, // MORE
    pageSubmit: { type: Number, default: 0 }, // PAGE SUBMIT
    telegramSubmit: { type: Number, default: 0 }, // TELEGRAM SUBMIT
    call: { type: Number, default: 0 }, // CALL
    review: { type: Number, default: 0 }, // REVIEW
    reject: { type: Number, default: 0 }, // REJECT
    reject2: { type: Number, default: 0 }, // REJECT2
    success1: { type: Number, default: 0 }, // SUCCESS 1
    success2: { type: Number, default: 0 }, // SUCCESS 2
    createdBy: { type: String, default: '' }
}, { timestamps: true });

followUp4DetailSchema.index({ brand: 1, date: 1 }, { unique: true });

export const FollowUp4Submit = mongoose.model('FollowUp4Submit', followUp4SubmitSchema);
export const FollowUp4RejectSubmit = mongoose.model('FollowUp4RejectSubmit', followUp4RejectSubmitSchema);
export const FollowUp4RejectCS = mongoose.model('FollowUp4RejectCS', followUp4RejectCSSchema);
export const FollowUp4Detail = mongoose.model('FollowUp4Detail', followUp4DetailSchema);
