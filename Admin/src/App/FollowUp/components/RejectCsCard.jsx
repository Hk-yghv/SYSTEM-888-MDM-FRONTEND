import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { FaBan, FaRegCalendarAlt, FaSave, FaExclamationTriangle } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

/**
 * RejectCsCard
 * Prop-driven Component for REJECT CS counts entry.
 * All reason items are received dynamically via `reasons` Prop from the database / Control System.
 */
const RejectCsCard = ({
    date,
    setDate,
    brand,
    reasons = [],
    counts = {},
    setCounts,
    onSave,
    saving = false,
    loading = false
}) => {
    const { t } = useLanguage();

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

    return (
        <div className="max-w-3xl mx-auto bg-slate-800/90 border border-slate-700/80 p-6 rounded-[5px] shadow-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
                <div>
                    <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                        <FaBan /> <span>{t('rejectCs')}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        {t('enterDailyRejectCounts')} <span className="text-emerald-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded">{brand || '888MDM'}</span>
                    </p>
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-[5px] border border-slate-700 shadow-inner">
                    <FaRegCalendarAlt className="text-slate-400 text-sm" />
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-transparent text-sm text-slate-100 outline-none cursor-pointer font-mono font-bold"
                    />
                </div>
            </div>

            {/* Total summary badge */}
            <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/40 p-2 rounded-[5px] mb-4 text-xs">
                <span className="text-amber-300 font-semibold">{t('dailyTotal')} REJECT CS ({date}):</span>
                <span className="text-amber-400 font-mono font-bold text-base bg-amber-900/60 px-3 py-0.5 rounded-lg">
                    {totalCount} {t('cases')}
                </span>
            </div>

            {/* Dynamic Reasons Input List (Fetched from Control System Database) */}
            {loading ? (
                <div className="text-center py-10 text-slate-400">
                    <MdOutlineSync className="animate-spin inline-block text-3xl mb-2 text-amber-400" />
                    <p className="text-xs font-semibold">{t('loading')}</p>
                </div>
            ) : reasons.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-900/40 rounded-[5px] border border-dashed border-slate-700 p-2">
                    <FaExclamationTriangle className="text-amber-400 text-2xl mx-auto mb-2" />
                    <p className="text-xs font-semibold">{t('noRejectCsReasonsConfigured')}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{t('rejectCsReasonsDroplistSetupInstructions')}</p>
                </div>
            ) : (
                <div className="space-y-2.5 mb-6">
                    {reasons.map((reason, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-900 p-2 rounded-[5px] border border-slate-700/60 hover:border-slate-600 transition-all shadow-xs"
                        >
                            <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono">
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
                                    value={counts[reason] !== undefined ? counts[reason] : 0}
                                    onChange={(e) => handleCountChange(reason, e.target.value)}
                                    className="w-20 bg-slate-800 text-center text-amber-400 font-bold text-sm px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 font-mono"
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

            {/* Save Button */}
            <button
                onClick={onSave}
                disabled={saving || loading || reasons.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm py-1 rounded-[5px] transition-all shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? <MdOutlineSync className="animate-spin text-lg" /> : <FaSave size={15} />}
                <span>{saving ? t('saving') : t('saveRejectCsData')}</span>
            </button>
        </div>
    );
};

export default RejectCsCard;
