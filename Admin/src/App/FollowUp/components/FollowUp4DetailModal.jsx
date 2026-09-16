import React from 'react';
import { FaCalculator, FaRegCalendarAlt, FaSave, FaTimes } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

/**
 * FollowUp4DetailModal
 * Modal popup displayed in the center of the screen ("Prop" dialog)
 * for entering DETAIL metrics.
 */
const FollowUp4DetailModal = ({
    isOpen,
    onClose,
    date,
    setDate,
    brand,
    metrics = {},
    setMetrics,
    onSave,
    saving = false,
    calculatedFormulas = {}
}) => {
    if (!isOpen) return null;

    const handleMetricChange = (field, value) => {
        const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
        setMetrics(prev => ({
            ...prev,
            [field]: val
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/80">
                    <div>
                        <h3 className="text-base font-bold text-sky-400 flex items-center gap-2">
                            <FaCalculator /> <span>បញ្ចូលទិន្នន័យ DETAIL METRICS</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Brand: <span className="text-emerald-400 font-bold">{brand || '888MDM'}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Date Selector & Live Auto-Formulas Overview */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <FaRegCalendarAlt className="text-sky-400 text-sm" />
                            <span className="text-xs font-semibold text-slate-300">កាលបរិច្ឆេទ៖</span>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-slate-800 text-sm text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 outline-none cursor-pointer font-mono font-bold"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 font-mono">
                                <span className="text-slate-400">Total Submits: </span>
                                <span className="text-emerald-400 font-bold">{calculatedFormulas.totalSubmits || 0}</span>
                            </div>
                            <div className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 font-mono">
                                <span className="text-slate-400">Total Success: </span>
                                <span className="text-teal-400 font-bold">{calculatedFormulas.totalSuccess || 0}</span>
                            </div>
                            <div className="bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-700/60 font-mono">
                                <span className="text-emerald-300">Conv Rate: </span>
                                <span className="text-emerald-400 font-bold">{calculatedFormulas.conversionRate || '0.0%'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Input Fields Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">PAGE (FB Page)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.page !== undefined ? metrics.page : 0}
                                onChange={(e) => handleMetricChange('page', e.target.value)}
                                className="w-full bg-slate-800 text-right text-cyan-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">TELEGRAM (Tg)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.telegram !== undefined ? metrics.telegram : 0}
                                onChange={(e) => handleMetricChange('telegram', e.target.value)}
                                className="w-full bg-slate-800 text-right text-sky-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-sky-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">NO REPLY (មិនតប)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.noReply !== undefined ? metrics.noReply : 0}
                                onChange={(e) => handleMetricChange('noReply', e.target.value)}
                                className="w-full bg-slate-800 text-right text-slate-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-slate-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">INQUIRE (សួរនាំ)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.inquire !== undefined ? metrics.inquire : 0}
                                onChange={(e) => handleMetricChange('inquire', e.target.value)}
                                className="w-full bg-slate-800 text-right text-amber-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">REJECT CS</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.rejectCs !== undefined ? metrics.rejectCs : 0}
                                onChange={(e) => handleMetricChange('rejectCs', e.target.value)}
                                className="w-full bg-slate-800 text-right text-rose-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">MORE (ផ្សេងៗ)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.more !== undefined ? metrics.more : 0}
                                onChange={(e) => handleMetricChange('more', e.target.value)}
                                className="w-full bg-slate-800 text-right text-indigo-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">PAGE SUBMIT</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.pageSubmit !== undefined ? metrics.pageSubmit : 0}
                                onChange={(e) => handleMetricChange('pageSubmit', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">TELEGRAM SUBMIT</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.telegramSubmit !== undefined ? metrics.telegramSubmit : 0}
                                onChange={(e) => handleMetricChange('telegramSubmit', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">REVIEW</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.review !== undefined ? metrics.review : 0}
                                onChange={(e) => handleMetricChange('review', e.target.value)}
                                className="w-full bg-slate-800 text-right text-amber-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">REJECT</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.reject !== undefined ? metrics.reject : 0}
                                onChange={(e) => handleMetricChange('reject', e.target.value)}
                                className="w-full bg-slate-800 text-right text-rose-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">SUCCESS 1</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.success1 !== undefined ? metrics.success1 : 0}
                                onChange={(e) => handleMetricChange('success1', e.target.value)}
                                className="w-full bg-slate-800 text-right text-teal-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">SUCCESS 2</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.success2 !== undefined ? metrics.success2 : 0}
                                onChange={(e) => handleMetricChange('success2', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-900/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                        បោះបង់
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <MdOutlineSync className="animate-spin text-sm" /> : <FaSave />}
                        <span>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ DETAIL'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FollowUp4DetailModal;
