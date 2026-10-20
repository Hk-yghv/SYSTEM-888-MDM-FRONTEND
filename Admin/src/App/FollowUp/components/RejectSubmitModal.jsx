import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { FaBan, FaRegCalendarAlt, FaSave, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

/**
 * RejectSubmitModal
 * Modal popup displayed in the center of the screen ("Prop" dialog)
 * for entering REJECT SUBMIT counts.
 * Reasons are dynamically received via props from Control System.
 */
const RejectSubmitModal = ({
    isOpen,
    onClose,
    date,
    setDate,
    brand,
    reasons = [],
    counts = {},
    setCounts,
    onSave,
    saving = false,
    submitList = [],
    submitLoading = false,
    submitError = '',
    onLoadSubmitList
}) => {
    const { t } = useLanguage();

    const [showFollowUpTable, setShowFollowUpTable] = React.useState(false);

    const handleCountChange = (reason, value) => {
        const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
        setCounts(prev => ({
            ...prev,
            [reason]: val
        }));
    };

    const handleIncrement = (reason) => {
        setCounts(prev => ({
            ...prev,
            [reason]: (Number(prev[reason]) || 0) + 1
        }));
    };

    const handleDecrement = (reason) => {
        setCounts(prev => ({
            ...prev,
            [reason]: Math.max(0, (Number(prev[reason]) || 0) - 1)
        }));
    };

    const totalCount = Object.values(counts).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

    const followUpRows = React.useMemo(() => {
        const targetDate = (date || '').trim();
        if (!targetDate) return [];

        return (submitList || []).filter(item =>
            item &&
            item.date === targetDate &&
            (item.status || '').trim().toUpperCase() === 'REJECT'
        );
    }, [submitList, date]);

    if (!isOpen) return null;

    return (
        <div className="fixed  z-9999 inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/80">
                    <div>
                        <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                            <FaBan /> <span>{t('enterRejectSubmitData')}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Brand: <span className="text-emerald-400 font-bold">{brand || '888MDM'}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {/* Date Selector & Total summary */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-[5px] border border-slate-700">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <FaRegCalendarAlt className="text-rose-400 text-sm" />
                                <span className="text-xs font-semibold text-slate-300">{t('date')}:</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        const nextDate = e.target.value;
                                        setDate(nextDate);
                                        if (showFollowUpTable) onLoadSubmitList?.(nextDate);
                                    }}
                                    className="bg-slate-800 text-sm text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 outline-none cursor-pointer font-mono font-bold"
                                />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextOpen = !showFollowUpTable;
                                        setShowFollowUpTable(nextOpen);
                                        if (nextOpen) onLoadSubmitList?.(date);
                                    }}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-[11px] font-bold px-3 py-2 rounded-[5px] transition-all cursor-pointer"
                                >
                                    {t('followUp')}
                                </button>
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 mr-2">{t('dailyTotal')}:</span>
                                    <span className="text-rose-400 font-mono font-bold text-base bg-rose-950/60 border border-rose-800/40 px-3 py-1 rounded-lg">
                                        {totalCount} {t('cases')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {showFollowUpTable && (
                            <div className="sticky top-0 z-20 bg-slate-900/95 border border-slate-700 rounded-[5px] overflow-hidden shadow-xl">
                                <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-800/95">
                                    <span className="text-[11px] font-bold text-emerald-400">FOLLOW UP SUBMIT - REJECT - {date}</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowFollowUpTable(false)}
                                        className="text-slate-400 hover:text-white text-xs cursor-pointer"
                                    >
                                        {t('close')}
                                    </button>
                                </div>
                                <div className="max-h-72 overflow-auto">
                                    {submitLoading ? (
                                        <div className="text-center py-6 text-xs text-slate-400">{t('loading')}</div>
                                    ) : submitError ? (
                                        <div className="text-center py-6 text-xs text-rose-300">{submitError}</div>
                                    ) : followUpRows.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-slate-400 px-3">
                                            {t('noRejectedFollowUpSubmitForDate')} {date}
                                        </div>
                                    ) : (
                                        <table className="w-max min-w-full text-left text-[11px] text-slate-200">
                                            <thead className="bg-slate-950/80 text-slate-400 uppercase">
                                                <tr>
                                                    <th className="py-1.5 px-2 text-center">#</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('date')}</th>
                                                    <th className="py-1.5 px-2">{t('customerName')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('username')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('phone')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('telegramName')}</th>
                                                    <th className="py-1.5 px-2">{t('source')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('pgTlSourceName')}</th>
                                                    <th className="py-1.5 px-2">{t('contactType')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('pgTlContactName')}</th>
                                                    <th className="py-1.5 px-2">{t('evaluation')}</th>
                                                    <th className="py-1.5 px-2">{t('requested')}</th>
                                                    <th className="py-1.5 px-2 whitespace-nowrap">{t('collateral')}</th>
                                                    <th className="py-1.5 px-2">{t('model')}</th>
                                                    <th className="py-1.5 px-2">{t('status')}</th>
                                                    <th className="py-1.5 px-2">{t('description')}</th>
                                                    <th className="py-1.5 px-2 text-center">{t('actionLabel')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60">
                                                {followUpRows.map((item, idx) => (
                                                    <tr key={item._id || idx} className="hover:bg-slate-800/60">
                                                        <td className="py-1.5 px-2 text-center text-slate-400">{idx + 1}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-mono text-emerald-300">{item.date || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-medium text-slate-100">{item.name || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.userName || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-mono text-cyan-300">{item.phone || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap text-sky-400">{item.nameTelegram || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.fromSource || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.namePgTlFrom || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.contactType || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.namePgTlContact || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-mono text-amber-300">{item.appraisal || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-mono text-emerald-300">{item.requested || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap">{item.assetType || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-mono">{item.model || '-'}</td>
                                                        <td className="py-1.5 px-2 whitespace-nowrap font-bold">{item.status || 'PENDING'}</td>
                                                        <td className="py-1.5 px-2 min-w-40">{item.description || '-'}</td>
                                                        <td className="py-1.5 px-2 text-center text-slate-500">-</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Reason List */}
                    {reasons.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 bg-slate-900/40 rounded-[5px] border border-dashed border-slate-700 p-2">
                            <FaExclamationTriangle className="text-amber-400 text-2xl mx-auto mb-2" />
                            <p className="text-xs font-semibold">{t('noRejectSubmitReasonsConfigured')}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{t('rejectSubmitReasonsSetupInstructions')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <p className="text-xs font-semibold text-slate-400 mb-1">
                                {t('enterReasonCounts')}
                            </p>
                            {reasons.map((reason, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-900 p-2 rounded-[5px] border border-slate-700/70 hover:border-slate-600 transition-all shadow-xs"
                                >
                                    <span className="text-xs font-semibold text-black flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-slate-800 text-black flex items-center justify-center text-[10px] font-mono">
                                            {idx + 1}
                                        </span>
                                        {reason}
                                    </span>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleDecrement(reason)}
                                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors cursor-pointer"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={counts[reason] ?? ''}
                                            onChange={(e) => handleCountChange(reason, e.target.value)}
                                            className="w-20 bg-slate-800 text-center text-rose-400 font-bold text-sm px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleIncrement(reason)}
                                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors cursor-pointer"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 p-2 border-t border-slate-700 bg-slate-900/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-[5px] transition-all cursor-pointer"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || reasons.length === 0}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-[5px] transition-all shadow-lg shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <MdOutlineSync className="animate-spin text-sm" /> : <FaSave />}
                        <span>{saving ? t('saving') : t('saveData')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RejectSubmitModal;
