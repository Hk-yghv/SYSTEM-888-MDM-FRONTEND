import mongoose from 'mongoose';

const supportCommentSchema = new mongoose.Schema({
    senderUsername: { type: String, default: 'Anonymous', trim: true },
    senderName: { type: String, default: '', trim: true },
    senderRole: { type: String, default: 'Staff', trim: true },
    senderBrand: { type: String, default: '', trim: true },
    pageContext: { type: String, default: 'General', trim: true },
    subject: { type: String, default: 'General Comment', trim: true },
    message: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: '', trim: true },
    status: { type: String, enum: ['Pending', 'Read', 'Resolved'], default: 'Pending' },
    adminReply: { type: String, default: '', trim: true },
    repliedBy: { type: String, default: '' },
    repliedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('SupportComment', supportCommentSchema);
