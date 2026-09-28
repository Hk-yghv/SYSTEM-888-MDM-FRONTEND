import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema({
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    note: { type: String, default: '', maxlength: 2000 },
    type: { type: String, enum: ['event', 'holiday', 'note'], default: 'event' },
    brand: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' }
}, { timestamps: true });

calendarEventSchema.index({ brand: 1, date: 1 });

export default mongoose.model('CalendarEvent', calendarEventSchema);