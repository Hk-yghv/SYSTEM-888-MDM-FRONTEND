import { useLanguage } from '../../../context/LanguageContext';
import React, { useState } from 'react';
import { FaPlusCircle, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

/**
 * FollowUp4SubmitModal
 * Dynamic Prop-driven Modal for Creating / Editing Follow Up Submit records.
 * All dropdown options (sources, contact types, statuses, asset types) are received via props from Control System.
 */
const FollowUp4SubmitModal = ({
    isOpen,
    onClose,
    editingItem,
    formData,
    setFormData,
    onSubmit,
    submitting = false,
    droplists = {
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'],
        contactTypes: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'],
        statuses: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'],
        assetTypes: ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other']
    },
    isMasterAdmin = false,
    brandsList = ['888MDM', 'ECloud']
}) => {
    const { t } = useLanguage();
    const [isModelOptionsOpen, setIsModelOptionsOpen] = useState(false);
    if (!isOpen) return null;

    const sources = droplists.sources && droplists.sources.length > 0
        ? droplists.sources
        : ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'];

    const contactTypes = droplists.contactTypes && droplists.contactTypes.length > 0
        ? droplists.contactTypes
        : ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'];

    const statuses = droplists.statuses && droplists.statuses.length > 0
        ? droplists.statuses
        : ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'];

    const assetTypes = droplists.assetTypes && droplists.assetTypes.length > 0
        ? droplists.assetTypes
        : ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'];

    const modelOptions = Array.isArray(droplists.models)
        ? droplists.models.filter(model => typeof model === 'string' && model.trim())
        : [];
    const filteredModelOptions = modelOptions.filter(model =>
        model.toLowerCase().includes((formData.model || '').trim().toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/60 sticky top-0 z-10">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                        {editingItem ? <FaEdit className="text-emerald-400" /> : <FaPlusCircle className="text-emerald-400" />}
                        <span>{editingItem ? [t('editFollowUpSubmit')]: 'បង្កើត FOLLOW UP SUBMIT ថ្មី'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    {/* Brand selection for master admin */}
                    {isMasterAdmin && (
                        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/80 mb-2">
                            <label className="block text-xs font-semibold text-emerald-400 mb-1">BRAND (Master Admin)</label>
                            <select
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-bold"
                            >
                                {brandsList.map((b, i) => (
                                    <option key={i} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">ថ្ងៃខែឆ្នាំ *</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">NAME</label>
                            <input
                                type="text"
                                placeholder="បញ្ចូលឈ្មោះ"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">USER NAME</label>
                            <input
                                type="text"
                                placeholder="Username"
                                value={formData.userName}
                                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">PHONE NUMBER</label>
                            <input
                                type="text"
                                placeholder="លេខទូរស័ព្ទ"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">NAME TELEGRAM</label>
                            <input
                                type="text"
                                placeholder="ឈ្មោះ Telegram"
                                value={formData.nameTelegram}
                                onChange={(e) => setFormData({ ...formData, nameTelegram: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">PG/TL From</label>
                            <select
                                value={formData.fromSource}
                                onChange={(e) => setFormData({ ...formData, fromSource: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="">-- ជ្រើសរើសប្រភព --</option>
                                {sources.map((s, i) => (
                                    <option key={i} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Name PG/TL From</label>
                            <input
                                type="text"
                                placeholder="NAME PG/TL មកពី"
                                value={formData.namePgTlFrom}
                                onChange={(e) => setFormData({ ...formData, namePgTlFrom: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">PG/TL Contact</label>
                            <select
                                value={formData.contactType}
                                onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="">-- ជ្រើសរើសប្រភេទទំនាក់ទំនង --</option>
                                {contactTypes.map((c, i) => (
                                    <option key={i} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Name PG/TL Contact</label>
                            <input
                                type="text"
                                placeholder="NAME PG/TL ទាក់ទង"
                                value={formData.namePgTlContact}
                                onChange={(e) => setFormData({ ...formData, namePgTlContact: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">វាយតម្លៃ</label>
                            <input
                                type="text"
                                placeholder="តម្លៃវាយតម្លៃ (ឧទាហរណ៍៖ $500)"
                                value={formData.appraisal}
                                onChange={(e) => setFormData({ ...formData, appraisal: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono text-amber-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">បានស្នើ</label>
                            <input
                                type="text"
                                placeholder="ចំនួនស្នើ (ឧទាហរណ៍៖ $400)"
                                value={formData.requested}
                                onChange={(e) => setFormData({ ...formData, requested: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono text-emerald-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('collateral')}</label>
                            <div className="flex gap-1.5">
                                <select
                                    value={formData.assetType}
                                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                                    className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    <option value="">-- ជ្រើសរើស ឬ វាយបញ្ចូល --</option>
                                    {assetTypes.map((a, i) => (
                                        <option key={i} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">MODEL</label>
                            <div className="relative">
                                <div className="flex">
                                    <input
                                        type="text"
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={isModelOptionsOpen}
                                        aria-controls="follow-up-model-options"
                                        placeholder="ម៉ូឌែលទូរស័ព្ទ/ឧបករណ៍"
                                        value={formData.model}
                                        onFocus={() => setIsModelOptionsOpen(true)}
                                        onBlur={() => setIsModelOptionsOpen(false)}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded-l border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        aria-label="Show model options"
                                        aria-expanded={isModelOptionsOpen}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setIsModelOptionsOpen(open => !open)}
                                        className="px-3 bg-slate-900 text-black text-xs border border-l-0 border-slate-700 rounded-r hover:text-white"
                                    >
                                        ▼
                                    </button>
                                </div>
                                {isModelOptionsOpen && (
                                    <div
                                        id="follow-up-model-options"
                                        role="listbox"
                                        className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-900 shadow-xl"
                                    >
                                        {filteredModelOptions.length > 0 ? filteredModelOptions.map((model, index) => (
                                            <button
                                                key={`${model}-${index}`}
                                                type="button"
                                                role="option"
                                                aria-selected={formData.model === model}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setFormData({ ...formData, model });
                                                    setIsModelOptionsOpen(false);
                                                }}
                                                className="block w-full px-3 py-2 text-left text-xs text-black hover:bg-slate-200"
                                            >
                                                {model}
                                            </button>
                                        )) : (
                                            <div className="px-3 py-2 text-xs text-slate-400">
                                                គ្មានម៉ូឌែលត្រូវគ្នា — អាចវាយបញ្ចូលម៉ូឌែលថ្មីបាន
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('status')}</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer font-bold text-amber-400"
                            >
                                {statuses.map((st, i) => (
                                    <option key={i} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">{t('description')}</label>
                        <textarea
                            rows="3"
                            placeholder="ការបរិយាយបន្ថែម..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-900 text-slate-100 text-xs p-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                            បោះបង់
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <FaSave />
                            <span>{submitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FollowUp4SubmitModal;
