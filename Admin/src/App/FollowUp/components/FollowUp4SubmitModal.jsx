import { useLanguage } from '../../../context/LanguageContext';
import React, { useRef, useState } from 'react';
import { FaPlusCircle, FaEdit, FaSave, FaTimes, FaPlus, FaSpinner } from 'react-icons/fa';

const SuggestionField = ({ id, value, onChange, options = [], placeholder, textarea = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [opensAbove, setOpensAbove] = useState(false);
    const fieldRef = useRef(null);
    const normalizedValue = value || '';
    const suggestions = [...new Set(options.filter(option => typeof option === 'string').map(option => option.trim()).filter(Boolean))]
        .filter(option => option.toLowerCase().includes(normalizedValue.trim().toLowerCase()));

    const openOptions = () => {
        const rect = fieldRef.current?.getBoundingClientRect();
        const modalRect = fieldRef.current?.closest('.follow-up-modal-scroll')?.getBoundingClientRect();
        if (rect) {
            const below = Math.min(window.innerHeight, modalRect?.bottom ?? window.innerHeight) - rect.bottom;
            const above = rect.top - Math.max(0, modalRect?.top ?? 0);
            setOpensAbove(below < 190 && above > below);
        }
        setIsOpen(true);
    };

    const Field = textarea ? 'textarea' : 'input';
    return (
        <div className="relative" ref={fieldRef}>
            <Field
                type={textarea ? undefined : 'text'}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls={`${id}-options`}
                rows={textarea ? 3 : undefined}
                placeholder={placeholder}
                value={normalizedValue}
                onFocus={openOptions}
                onClick={openOptions}
                onChange={(event) => {
                    onChange(event.target.value);
                    openOptions();
                }}
                onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') setIsOpen(false);
                }}
                className={`w-full bg-slate-200 text-black text-xs ${textarea ? 'p-2' : 'px-3 py-2'} rounded border border-slate-700 outline-none focus:border-emerald-500`}
            />
            {isOpen && (
                <div
                    id={`${id}-options`}
                    role="listbox"
                    className={`absolute z-30 w-full max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-900 shadow-xl ${opensAbove ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                >
                    {suggestions.length ? suggestions.map((option, index) => (
                        <button
                            key={`${option}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={normalizedValue === option}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-xs text-black hover:bg-slate-200"
                        >
                            {option}
                        </button>
                    )) : (
                        <div className="px-3 py-2 text-xs text-slate-400">
                            {t('noMatchingOptionsEnterNewValue')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

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
    onCreateStatus,
    droplists = {
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'],
        contactTypes: ['Telegram', 'Page', 'Call', 'Walk-in', 'Other'],
        statuses: [],
        assetTypes: ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'],
        pgTlNames: [],
        descriptions: []
    },
    isMasterAdmin = false,
    brandsList = ['888MDM', 'ECloud']
}) => {
    const { t } = useLanguage();
    const [isModelOptionsOpen, setIsModelOptionsOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [creatingStatus, setCreatingStatus] = useState(false);
    const [statusError, setStatusError] = useState('');
    if (!isOpen) return null;

    const sources = droplists.sources && droplists.sources.length > 0
        ? droplists.sources
        : ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'];

    const contactTypes = droplists.contactTypes && droplists.contactTypes.length > 0
        ? droplists.contactTypes
        : ['Telegram', 'Page', 'Call', 'Walk-in', 'Other'];

    const statuses = Array.isArray(droplists.statuses) ? droplists.statuses : [];

    const assetTypes = droplists.assetTypes && droplists.assetTypes.length > 0
        ? droplists.assetTypes
        : ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'];

    const modelOptions = Array.isArray(droplists.models)
        ? droplists.models.filter(model => typeof model === 'string' && model.trim())
        : [];
    const filteredModelOptions = modelOptions.filter(model =>
        model.toLowerCase().includes((formData.model || '').trim().toLowerCase())
    );
    const handleCreateStatus = async () => {
        const status = newStatus.trim();
        if (!status || !onCreateStatus) return;
        setCreatingStatus(true);
        setStatusError('');
        try {
            await onCreateStatus(status);
            setNewStatus('');
        } catch (error) {
            setStatusError(error.message || t('failedToSave'));
        } finally {
            setCreatingStatus(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 z-9999">
            <div className="follow-up-modal-scroll bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/60 sticky top-0 z-10">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                        {editingItem ? <FaEdit className="text-emerald-400" /> : <FaPlusCircle className="text-emerald-400" />}
                        <span>{editingItem ? t('editFollowUpSubmit') : t('createFollowUpSubmit')}</span>
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
                            <label className="block text-xs font-semibold text-emerald-400 mb-1">{t('brand')} (Master Admin)</label>
                            <select
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-bold"
                            >
                                {brandsList.map((b, i) => (
                                    <option key={i} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('date')} *</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('customerName')}</label>
                            <input
                                type="text"
                                placeholder={t('customerName')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('username')}</label>
                            <input
                                type="text"
                                placeholder={t('username')}
                                value={formData.userName}
                                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('phone')}</label>
                            <input
                                type="text"
                                placeholder={t('phone')}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('telegramName')}</label>
                            <input
                                type="text"
                                placeholder={t('telegramName')}
                                value={formData.nameTelegram}
                                onChange={(e) => setFormData({ ...formData, nameTelegram: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('source')}</label>
                            <select
                                value={formData.fromSource}
                                onChange={(e) => setFormData({ ...formData, fromSource: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="">{t('selectSource')}</option>
                                {sources.map((s, i) => (
                                    <option key={i} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('pgTlSourceName')}</label>
                            <SuggestionField
                                id="follow-up-pg-tl-from"
                                placeholder={t('pgTlSourceName')}
                                value={formData.namePgTlFrom}
                                options={droplists.pgTlNames}
                                onChange={(namePgTlFrom) => setFormData({ ...formData, namePgTlFrom })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('pgTlContact')}</label>
                            <select
                                value={formData.contactType}
                                onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="">{t('selectContactType')}</option>
                                {contactTypes.map((c, i) => (
                                    <option key={i} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('pgTlContactName')}</label>
                            <SuggestionField
                                id="follow-up-pg-tl-contact"
                                placeholder={t('pgTlContactName')}
                                value={formData.namePgTlContact}
                                options={droplists.pgTlNames}
                                onChange={(namePgTlContact) => setFormData({ ...formData, namePgTlContact })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('evaluation')}</label>
                            <input
                                type="text"
                                placeholder={t('evaluationAmountPlaceholder')}
                                value={formData.appraisal}
                                onChange={(e) => setFormData({ ...formData, appraisal: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-mono text-amber-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('requested')}</label>
                            <input
                                type="text"
                                placeholder={t('requestedAmountPlaceholder')}
                                value={formData.requested}
                                onChange={(e) => setFormData({ ...formData, requested: e.target.value })}
                                className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 font-mono text-emerald-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('collateral')}</label>
                            <div className="flex gap-1.5">
                                <select
                                    value={formData.assetType}
                                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                                    className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    <option value="">{t('selectOrType')}</option>
                                    {assetTypes.map((a, i) => (
                                        <option key={i} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('model')}</label>
                            <div className="relative">
                                <div className="flex">
                                    <input
                                        type="text"
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={isModelOptionsOpen}
                                        aria-controls="follow-up-model-options"
                                        placeholder={t('model')}
                                        value={formData.model}
                                        onFocus={() => setIsModelOptionsOpen(true)}
                                        onBlur={() => setIsModelOptionsOpen(false)}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full bg-slate-200 text-black text-xs px-3 py-2 rounded-l border border-slate-600 outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        aria-label={t('showModelOptions')}
                                        aria-expanded={isModelOptionsOpen}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setIsModelOptionsOpen(open => !open)}
                                        className="px-3 bg-slate-200 text-black text-xs border border-l-0 border-slate-600 rounded-r hover:text-white"
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
                                                {t('noMatchingModelsEnterNewModel')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-black mb-1">{t('status')}</label>
                            <div className="flex gap-2">
                                <select
                                    required
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="min-w-0 flex-1 bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 cursor-pointer font-bold"
                                >
                                    <option value="">{statuses.length ? t('selectOrType') : t('createStatus')}</option>
                                    {statuses.map((st, i) => (
                                        <option key={`${st}-${i}`} value={st}>{st}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newStatus}
                                    onChange={(event) => setNewStatus(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleCreateStatus();
                                        }
                                    }}
                                    placeholder={t('createStatus')}
                                    className="min-w-0 flex-1 bg-slate-200 text-black text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateStatus}
                                    disabled={!newStatus.trim() || creatingStatus}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creatingStatus ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                                    {t('createStatus')}
                                </button>
                            </div>
                            {statusError && <p className="mt-1 text-xs text-rose-600">{statusError}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-black mb-1">{t('description')}</label>
                        <SuggestionField
                            id="follow-up-description"
                            textarea
                            placeholder={t('additionalDescription')}
                            value={formData.description}
                            options={droplists.descriptions}
                            onChange={(description) => setFormData({ ...formData, description })}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <FaSave />
                            <span>{submitting ? t('saving') : t('save')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FollowUp4SubmitModal;
