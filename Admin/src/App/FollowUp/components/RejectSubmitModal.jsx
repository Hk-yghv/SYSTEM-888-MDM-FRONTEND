import React from 'react';
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
    submitList = []
}) => {
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

        return (submitList || []).filter(item => {
            if (!item || item.date !== targetDate) return false;
            if (!brand) return true;
            return item.brand === brand || !item.brand;
        });
    }, [submitList, date, brand]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/80">
                    <div>
                        <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                            <FaBan /> <span>បញ្ចូលទិន្នន័យ REJECT SUBMIT</span>
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
                                <span className="text-xs font-semibold text-slate-300">កាលបរិច្ឆេទ៖</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-slate-800 text-sm text-slate-100 px-3 py-1.5 rounded-lg border border-slate-600 outline-none cursor-pointer font-mono font-bold"
                                />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowFollowUpTable(prev => !prev)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-[11px] font-bold px-3 py-2 rounded-[5px] transition-all cursor-pointer"
                                >
                                    FOLLOW UP
                                </button>
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 mr-2">សរុបប្រចាំថ្ងៃ៖</span>
                                    <span className="text-rose-400 font-mono font-bold text-base bg-rose-950/60 border border-rose-800/40 px-3 py-1 rounded-lg">
                                        {totalCount} ករណី
                                    </span>
                                </div>
                            </div>
                        </div>

                        {showFollowUpTable && (
                            <div className="bg-slate-900/90 border border-slate-700 rounded-[5px] overflow-hidden shadow-xl">
                                <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-800/80">
                                    <span className="text-[11px] font-bold text-emerald-400">FOLLOW UP SUBMIT - {date}</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowFollowUpTable(false)}
                                        className="text-slate-400 hover:text-white text-xs cursor-pointer"
                                    >
                                        បិទ
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {followUpRows.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-slate-400 px-3">
                                            គ្មានข้อมูล FOLLOW UP SUBMIT សម្រាប់ {date}
                                        </div>
                                    ) : (
                                        <table className="w-full text-left text-[11px] text-slate-200">
                                            <thead className="bg-slate-950/80 text-slate-400 uppercase">
                                                <tr>
                                                    <th className="py-1.5 px-2">Name</th>
                                                    <th className="py-1.5 px-2">Phone</th>
                                                    <th className="py-1.5 px-2">Model</th>
                                                    <th className="py-1.5 px-2">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60">
                                                {followUpRows.map((item, idx) => (
                                                    <tr key={item._id || idx} className="hover:bg-slate-800/60">
                                                        <td className="py-1.5 px-2 font-medium text-slate-100">{item.name || item.userName || 'N/A'}</td>
                                                        <td className="py-1.5 px-2 font-mono text-slate-300">{item.phone || '-'}</td>
                                                        <td className="py-1.5 px-2 font-mono text-slate-300">{item.model || '-'}</td>
                                                        <td className="py-1.5 px-2">
                                                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-900/70 text-emerald-300 text-[10px] font-bold">
                                                                {item.status || 'PENDING'}
                                                            </span>
                                                        </td>
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
                            <p className="text-xs font-semibold">មិនទាន់មានបញ្ជីមូលហេតុ REJECT SUBMIT នៅក្នុង Control System នៅឡើយទេ</p>
                            <p className="text-[11px] text-slate-500 mt-1">សូមចូលទៅកាន់ Settings &gt; Control System &gt; &quot;Reject Submit Reasons&quot; ដើម្បីបន្ថែម</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <p className="text-xs font-semibold text-slate-400 mb-1">
                                បញ្ចូលចំនួនតាមមូលហេតុនីមួយៗ៖
                            </p>
                            {reasons.map((reason, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-900 p-2 rounded-[5px] border border-slate-700/70 hover:border-slate-600 transition-all shadow-xs"
                                >
                                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
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
                        បោះបង់
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || reasons.length === 0}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-[5px] transition-all shadow-lg shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <MdOutlineSync className="animate-spin text-sm" /> : <FaSave />}
                        <span>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RejectSubmitModal;
