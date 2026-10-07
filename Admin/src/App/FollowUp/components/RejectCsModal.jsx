import React from 'react';
import { FaBan, FaRegCalendarAlt, FaSave, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

/**
 * RejectCsModal
 * Modal popup displayed in the center of the screen ("Prop" dialog)
 * for entering REJECT CS counts.
 * Reasons are dynamically received via props from Control System.
 */
const RejectCsModal = ({
    isOpen,
    onClose,
    date,
    setDate,
    brand,
    reasons = [],
    counts = {},
    setCounts,
    onSave,
    saving = false
}) => {
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/80">
                    <div>
                        <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                            <FaBan /> <span>បញ្ចូលទិន្នន័យ REJECT CS</span>
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
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-[5px] border border-slate-700">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <FaRegCalendarAlt className="text-amber-400 text-sm" />
                            <span className="text-xs font-semibold text-slate-300">កាលបរិច្ឆេទ៖</span>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-slate-800 text-sm text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 outline-none cursor-pointer font-mono font-bold"
                            />
                        </div>

                        <div className="text-right w-full sm:w-auto">
                            <span className="text-xs text-slate-400 mr-2">សរុបប្រចាំថ្ងៃ៖</span>
                            <span className="text-amber-400 font-mono font-bold text-base bg-amber-950/60 border border-amber-800/40 px-3 py-1 rounded-lg">
                                {totalCount} ករណី
                            </span>
                        </div>
                    </div>

                    {/* Dynamic Reason List */}
                    {reasons.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 bg-slate-900/40 rounded-[5px] border border-dashed border-slate-700 p-2">
                            <FaExclamationTriangle className="text-amber-400 text-2xl mx-auto mb-2" />
                            <p className="text-xs font-semibold">មិនទាន់មានបញ្ជីមូលហេតុ REJECT CS នៅក្នុង Control System នៅឡើយទេ</p>
                            <p className="text-[11px] text-slate-500 mt-1">សូមចូលទៅកាន់ Settings &gt; Control System &gt; &quot;Reject CS Reasons&quot; ដើម្បីបន្ថែម</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <p className="text-xs font-semibold text-slate-400 mb-1">
                                បញ្ចូលចំនួនតាមមូលហេតុនីមួយៗ (ទាញចេញពី Control System)៖
                            </p>
                            {reasons.map((reason, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-900 p-2 rounded-[5px] border border-slate-700/70 hover:border-slate-600 transition-all shadow-xs"
                                >
                                    <span className="text-xs font-semibold text-black flex items-center gap-2">
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
                                            placeholder="0"
                                            value={counts[reason] ?? ''}
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
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 p-2 border-t border-slate-700 bg-slate-900/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-[5px] transition-all cursor-pointer"
                    >
                        បោះបង់
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || reasons.length === 0}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-5 py-2.5 rounded-[5px] transition-all shadow-lg shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <MdOutlineSync className="animate-spin text-sm" /> : <FaSave />}
                        <span>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RejectCsModal;
