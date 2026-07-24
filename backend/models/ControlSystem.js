import mongoose from 'mongoose';

const controlSystemSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    // e.g. 'droplists', 'call_phone_display', 'roles',
    // 'lockphone_display_text', 'lockphone_phone_number', 'lockphone_user_template'
    value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

export default mongoose.model('ControlSystem', controlSystemSchema);
