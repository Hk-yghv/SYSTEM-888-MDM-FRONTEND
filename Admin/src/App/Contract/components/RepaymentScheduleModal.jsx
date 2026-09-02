import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FaDollarSign, FaLock, FaCalendarAlt, FaCheckCircle, FaSave, FaEdit, FaUndo } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';

const RepaymentScheduleModal = ({ open, setOpen, contract, mode = 'view_edit', defaultMonthIdx = null, onSaved }) => {
    const { API_BASE1, user } = useAuth();

    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator'
    );

    const [rows, setRows] = useState([]);
    const [latePenaltyRules, setLatePenaltyRules] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [activeDropdownIdx, setActiveDropdownIdx] = useState(null);
    const rowRefs = useRef([]);

    const computeLatePenalty = (row, rules = []) => {
        if (!row || !row.dueDate) return Number(row?.penalty || 0) || 0;
        if (row.status === 'Paid' || row.status === 'PayOff' || row.status === 'Settled') return Number(row.penalty || 0) || 0;

        const due = new Date(`${row.dueDate}T00:00:00`);
        if (Number.isNaN(due.getTime())) return Number(row.penalty || 0) || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((today - due) / 86400000));
        if (diffDays <= 0) return 0;

        const relevantRules = (Array.isArray(rules) ? rules : []).filter(rule => {
            const ruleBrand = String(rule?.brand || '').trim();
            const selectedBrand = String(contract?.brand || user?.brand || '').trim();
            return !ruleBrand || ruleBrand === selectedBrand;
        });

        if (relevantRules.length === 0) return 0;

        const applicable = relevantRules.filter(rule => diffDays >= Number(rule.afterDays || 0));
        if (applicable.length === 0) return 0;

        const bestRule = applicable.reduce((winner, rule) => {
            const ruleAmount = Number(rule.penaltyPerDay || rule.amount || rule.penalty || 0);
            if (!winner || Number(rule.afterDays || 0) > Number(winner.afterDays || 0)) return { ...rule, ruleAmount };
            return winner;
        }, null);

        return diffDays * Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
    };

    useEffect(() => {
        const fetchLatePenaltySetting = async () => {
            const brand = contract?.brand || user?.brand || '';
            try {
                const res = await fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`);
                if (res.ok) {
                    const data = await res.json();
                    const rules = Array.isArray(data?.late_penalty_rules) ? data.late_penalty_rules : [];
                    setLatePenaltyRules(rules);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch late penalty config:', err);
            }
            setLatePenaltyRules([]);
        };

        fetchLatePenaltySetting();
    }, [API_BASE1, contract?.brand, user?.brand]);

    // Parse duration string (e.g. "15 Days" -> { isDays: true, count: 15 }, "3 Months" -> { isDays: false, count: 3 })
    const parseDuration = (durationStr) => {
        if (!durationStr) return { isDays: false, count: 3 };
        const str = String(durationStr).toLowerCase().trim();
        const matched = str.match(/\d+/);
        const count = matched ? Math.max(1, parseInt(matched[0], 10)) : 3;

        const isDays = str.includes('day') || str.includes('ថ្ងៃ') || str.includes('d');
        return { isDays, count };
    };

    // Helper to generate default schedule rows
    const generateDefaultRows = (ctr) => {
        const { isDays, count } = parseDuration(ctr?.duration);
        const totalLoan = Number(ctr?.amount) || Number(ctr?.totalAmount) || 0;
        const startDate = ctr?.inputDate ? new Date(ctr.inputDate) : new Date();

        if (isDays) {
            // For DAYS (e.g. 15 Days): generate ONLY 1 ROW with due date N days later!
            const d = new Date(startDate);
            d.setDate(d.getDate() + count);
            const dateStr = d.toISOString().split('T')[0];

            return [{
                monthIndex: 1,
                labelName: `${count} ថ្ងៃ (${count} Days)`,
                dueDate: dateStr,
                loanAmount: totalLoan,
                penalty: 0,
                scheduledAmount: totalLoan,
                totalAmount: totalLoan,
                paidAmount: 0,
                comment: '',
                paidDate: '',
                status: 'Pending'
            }];
        } else {
            // For MONTHS (e.g. 3 Months): generate count rows (1 row per month)
            const monthlyBase = Number(ctr?.monthlyPayment) || (totalLoan / count);
            const generated = [];
            for (let i = 0; i < count; i++) {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i + 1);
                const dateStr = d.toISOString().split('T')[0];

                generated.push({
                    monthIndex: i + 1,
                    labelName: `ខែទី ${i + 1} (Month ${i + 1})`,
                    dueDate: dateStr,
                    loanAmount: totalLoan,
                    penalty: 0,
                    scheduledAmount: Math.round(monthlyBase),
                    totalAmount: Math.round(monthlyBase),
                    paidAmount: 0,
                    comment: '',
                    paidDate: '',
                    status: 'Pending'
                });
            }
            return generated;
        }
    };

    useEffect(() => {
        if (!open || !contract) return;

        const baseRows = Array.isArray(contract.repaymentSchedule) && contract.repaymentSchedule.length > 0
            ? contract.repaymentSchedule
            : generateDefaultRows(contract);

        const generatedRows = generateDefaultRows(contract);
        const normalizedRows = baseRows.map((row, index) => {
            const rowWithDueDate = row.dueDate
                ? row
                : { ...row, dueDate: generatedRows[index]?.dueDate || '' };
            const autoPenalty = computeLatePenalty(rowWithDueDate, latePenaltyRules);
            const scheduledAmount = Number(row.scheduledAmount || 0);
            const total = Number(row.totalAmount || 0) || scheduledAmount + Number(row.penalty || 0);
            return {
                ...rowWithDueDate,
                penalty: autoPenalty > 0 ? autoPenalty : Number(row.penalty || 0),
                totalAmount: autoPenalty > 0 ? scheduledAmount + autoPenalty : total
            };
        });

        setRows(normalizedRows);
        setActiveDropdownIdx(null);

        if (defaultMonthIdx !== null && defaultMonthIdx >= 0) {
            setTimeout(() => {
                const el = rowRefs.current[defaultMonthIdx];
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    }, [open, contract, defaultMonthIdx, latePenaltyRules]);

    if (!open || !contract) return null;

    const isReadOnly = mode === 'read_only';
    const isSetupActivate = mode === 'setup_activate';

    // Find the first unpaid/non-payoff row index (active row for Dollar dropdown)
    const payOffTriggeredIdx = rows.findIndex(r => r.status === 'PayOff');
    const firstPendingIdx = rows.findIndex(r => r.status === 'Pending' || r.status === 'Saved');
    const activeRowIdx = payOffTriggeredIdx !== -1 ? -1 : (firstPendingIdx !== -1 ? firstPendingIdx : -1);

    const handleRowChange = (idx, field, val) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[idx], [field]: val };

            if (field === 'dueDate') {
                const autoPenalty = computeLatePenalty({ ...row, dueDate: val }, latePenaltyRules);
                row.penalty = autoPenalty;
            }

            if (field === 'penalty' || field === 'scheduledAmount' || field === 'dueDate') {
                const penaltyNum = Number(field === 'penalty' ? val : row.penalty) || 0;
                const schedNum = Number(field === 'scheduledAmount' ? val : row.scheduledAmount) || 0;
                row.totalAmount = penaltyNum + schedNum;
            }

            updated[idx] = row;
            return updated;
        });
    };

    const handleSaveRowDraft = (idx) => {
        setRows(prev => {
            const updated = [...prev];
            if (updated[idx].status === 'Pending') {
                updated[idx].status = 'Saved';
            }
            return updated;
        });
        setActiveDropdownIdx(null);
    };

    const handleMarkPaid = (idx) => {
        const todayStr = new Date().toISOString().split('T')[0];
        setRows(prev => {
            const updated = [...prev];
            const current = updated[idx];
            const paidVal = Number(current.paidAmount) || Number(current.totalAmount) || 0;

            updated[idx] = {
                ...current,
                paidAmount: paidVal,
                paidDate: current.paidDate || todayStr,
                status: 'Paid'
            };
            return updated;
        });
        setActiveDropdownIdx(null);
    };

    const handleMarkPayOff = (idx) => {
        const todayStr = new Date().toISOString().split('T')[0];
        setRows(prev => {
            const updated = prev.map((r, i) => {
                if (i === idx) {
                    const paidVal = Number(r.paidAmount) || Number(r.totalAmount) || 0;
                    return {
                        ...r,
                        paidAmount: paidVal,
                        paidDate: r.paidDate || todayStr,
                        status: 'PayOff'
                    };
                }
                if (i > idx) {
                    return {
                        ...r,
                        status: 'Settled'
                    };
                }
                return r;
            });
            return updated;
        });
        setActiveDropdownIdx(null);
    };

    const handleRevertRow = (idx) => {
        if (!isMasterAdmin) return;
        setRows(prev => {
            const updated = prev.map((r, i) => {
                if (i >= idx) {
                    return {
                        ...r,
                        status: 'Pending',
                        paidDate: r.status === 'Paid' || r.status === 'PayOff' ? '' : r.paidDate
                    };
                }
                return r;
            });
            return updated;
        });
        setActiveDropdownIdx(null);
    };

    const applyLatePenaltyToAllRows = () => {
        setRows(prev => prev.map(row => {
            const penalty = computeLatePenalty(row, latePenaltyRules);
            const scheduled = Number(row.scheduledAmount || 0);
            return {
                ...row,
                penalty,
                totalAmount: scheduled + penalty
            };
        }));
    };

    const handleSaveSchedule = async (newContractStatus = null) => {
        setSubmitting(true);
        try {
            const targetStatus = newContractStatus || contract.status;
            const res = await fetch(`${API_BASE1}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repaymentSchedule: rows,
                    status: targetStatus,
                    modifiedByAdmin: isMasterAdmin
                })
            });

            if (res.ok) {
                setOpen(false);
                if (onSaved) onSaved();
            } else {
                alert('រក្សាទុកតារាងមិនបានសម្រេច (Failed to save schedule)');
            }
        } catch (err) {
            console.error('Save repayment schedule error:', err);
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4 select-none">
            <div className="bg-[#fff] border border-indigo-500/40 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-xs">

                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-800 bg-[#fff] flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                                <span>តារាងព័ត៌មានបង់ប្រាក់កម្ចី</span>
                                <span className="px-2.5 py-0.5 text-indigo-300 border border-indigo-700/60 rounded-full text-[10px] font-bold">
                                    {contract.contractId}
                                </span>
                                {isMasterAdmin && (
                                    <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-600/60 rounded-full text-[9px] font-bold uppercase">
                                        Master Admin Privilege
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-gray-400">
                                ភ្ញៀវ៖ <span className="text-emerald-500 font-bold">{contract.customerNameKh || contract.customerNameEn}</span> |
                                ស្នើ៖ <span className="text-amber-300 font-bold">{contract.duration || '12 Months'}</span> |
                                ប្រាក់កម្ចីសរុប៖ <span className="text-emerald-400 font-mono font-bold">${Number(contract.amount || 0).toLocaleString()}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={applyLatePenaltyToAllRows}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                            Auto Penalty
                        </button>
                        <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold cursor-pointer transition-all flex items-center justify-center">
                            <MdClose size={18} />
                        </button>
                    </div>
                </div>

                {/* Schedule Table Container */}
                <div className="flex-1 overflow-x-auto overflow-y-auto p-4 pb-32 min-h-[350px] space-y-3">
                    {isSetupActivate && (
                        <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-600/40 text-indigo-200 text-xs font-medium flex items-center gap-2">
                            <FaCalendarAlt className="text-indigo-400 text-base flex-shrink-0" />
                            <span className='text-black'>
                                សូមពិនិត្យ និងបញ្ចូលកាលបរិច្ឆេទថ្ងៃខែត្រូវបង់ត្រឡប់ និងទឹកប្រាក់សម្រាប់ខែនីមួយៗខាងក្រោមឱ្យបានគ្រប់គ្រាន់ រួចចុចប៊ូតុង <strong>"រក្សាទុក & Activate Contract"</strong> ដើម្បីដំណើរការ!
                            </span>
                        </div>
                    )}

                    <table className="w-full text-left text-xs whitespace-nowrap border border-gray-800 rounded-xln">
                        <thead className="text-gray-300 uppercase tracking-wider border-b border-gray-800">
                            <tr>
                                <th className="px-3 py-2.5 text-center">ខែ/ថ្ងៃ</th>
                                <th className="px-3 py-2.5">ថ្ងៃខែត្រូវបង់</th>
                                <th className="px-3 py-2.5 font-mono text-emerald-400">Total loan amount</th>
                                <th className="px-3 py-2.5 text-amber-400 font-bold">ពិន័យ</th>
                                <th className="px-3 py-2.5 text-sky-400 font-bold">ត្រូវបង់សរុប</th>
                                <th className="px-3 py-2.5 text-emerald-300 font-extrabold">Total</th>
                                <th className="px-3 py-2.5 text-emerald-400">ភ្ញៀវបានបង់</th>
                                <th className="px-3 py-2.5">Comment (Note)</th>
                                <th className="px-3 py-2.5 text-purple-300">កាលបរិច្ឆេទបានបង់</th>
                                {!isReadOnly && <th className="px-3 py-2.5 text-center">Action ($)</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60 font-medium">
                            {rows.map((row, idx) => {
                                const isLocked = (!isMasterAdmin && (row.status === 'Paid' || row.status === 'PayOff' || row.status === 'Settled')) || isReadOnly;
                                const isCurrentActive = idx === activeRowIdx && !isReadOnly;
                                const isLastMonth = idx === rows.length - 1;

                                return (
                                    <tr
                                        key={idx}
                                        ref={el => rowRefs.current[idx] = el}
                                        className={`transition-colors ${row.status === 'Paid' ? 'bg-emerald-950/20' : row.status === 'PayOff' ? 'bg-indigo-950/30' : isCurrentActive ? 'bg-amber-950/30 border-l-4 border-amber-500' : idx === defaultMonthIdx ? 'bg-indigo-950/20 border-l-4 border-indigo-400' : 'hover:bg-gray-900/50'}`}>
                                        <td className="px-3 py-2 text-center font-bold text-white font-mono">
                                            {row.labelName || `Month ${row.monthIndex}`}
                                        </td>

                                        {/* Due Date */}
                                        <td className="px-3 py-2 font-mono">
                                            {isLocked ? (
                                                <span className="font-bold text-gray-200">{row.dueDate || '—'}</span>
                                            ) : (
                                                <input
                                                    type="date"
                                                    value={row.dueDate || ''}
                                                    onChange={(e) => handleRowChange(idx, 'dueDate', e.target.value)}
                                                    className="px-2 py-1 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg text-gray-100 text-xs outline-none font-mono"
                                                />
                                            )}
                                        </td>

                                        {/* Total Loan Amount */}
                                        <td className="px-3 py-2 font-mono font-bold text-emerald-400">
                                            ${Number(row.loanAmount || 0).toLocaleString()}
                                        </td>

                                        {/* Penalty */}
                                        <td className="px-3 py-2 font-mono">
                                            {isLocked ? (
                                                <span className="font-bold text-amber-400">${Number(row.penalty || 0).toLocaleString()}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={row.penalty}
                                                    onChange={(e) => handleRowChange(idx, 'penalty', e.target.value)}
                                                    className="w-20 px-2 py-1 bg-gray-900 border border-gray-700 focus:border-amber-500 rounded-lg text-amber-300 font-bold font-mono text-xs outline-none"
                                                    placeholder="0"
                                                />
                                            )}
                                        </td>

                                        {/* Scheduled Monthly Due */}
                                        <td className="px-3 py-2 font-mono">
                                            {isLocked ? (
                                                <span className="font-bold text-sky-300">${Number(row.scheduledAmount || 0).toLocaleString()}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={row.scheduledAmount}
                                                    onChange={(e) => handleRowChange(idx, 'scheduledAmount', e.target.value)}
                                                    className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 focus:border-sky-500 rounded-lg text-sky-300 font-bold font-mono text-xs outline-none"
                                                    placeholder="0"
                                                />
                                            )}
                                        </td>

                                        {/* Total (Penalty + Scheduled) */}
                                        <td className="px-3 py-2 font-mono font-extrabold text-emerald-300">
                                            ${(Number(row.penalty || 0) + Number(row.scheduledAmount || 0)).toLocaleString()}
                                        </td>

                                        {/* Paid Amount */}
                                        <td className="px-3 py-2 font-mono">
                                            {isLocked ? (
                                                <span className="font-bold text-emerald-400">${Number(row.paidAmount || 0).toLocaleString()}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={row.paidAmount}
                                                    onChange={(e) => handleRowChange(idx, 'paidAmount', e.target.value)}
                                                    className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded-lg text-emerald-400 font-bold font-mono text-xs outline-none"
                                                    placeholder="0"
                                                />
                                            )}
                                        </td>

                                        {/* Comment */}
                                        <td className="px-3 py-2">
                                            {isLocked ? (
                                                <span className="text-gray-300 italic text-[11px]">{row.comment || '—'}</span>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={row.comment || ''}
                                                    onChange={(e) => handleRowChange(idx, 'comment', e.target.value)}
                                                    placeholder="Note/comment..."
                                                    className="w-36 px-2 py-1 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg text-gray-100 text-xs outline-none"
                                                />
                                            )}
                                        </td>

                                        {/* Paid Date */}
                                        <td className="px-3 py-2 font-mono">
                                            {isReadOnly ? (
                                                <span className="font-bold text-purple-300">{row.paidDate || '—'}</span>
                                            ) : (
                                                <input
                                                    type="date"
                                                    value={row.paidDate || ''}
                                                    onChange={(e) => handleRowChange(idx, 'paidDate', e.target.value)}
                                                    className="px-2 py-1 bg-gray-900 border border-gray-700 focus:border-purple-500 rounded-lg text-purple-300 font-bold font-mono text-xs outline-none"
                                                />
                                            )}
                                        </td>

                                        {/* Action ($ Dropdown) */}
                                        {!isReadOnly && (
                                            <td className={`px-3 py-2 text-center relative ${activeDropdownIdx === idx ? 'z-[999]' : ''}`}>
                                                {row.status === 'Settled' ? (
                                                    <span className="text-gray-600 italic text-[10px]">Settled</span>
                                                ) : isCurrentActive || isMasterAdmin ? (
                                                    <div className="relative inline-block text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveDropdownIdx(activeDropdownIdx === idx ? null : idx)}
                                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-transform hover:scale-110 cursor-pointer ${row.status === 'Paid' ? 'bg-emerald-600 text-white' : row.status === 'PayOff' ? 'bg-indigo-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-gray-950'}`}
                                                        >
                                                            <FaDollarSign />
                                                        </button>

                                                        {activeDropdownIdx === idx && (
                                                            <div className={`absolute right-0 ${idx === rows.length - 1 && rows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'} w-36 bg-gray-900 border border-indigo-500/80 rounded-xl shadow-2xl z-[99999] overflow-hidden animate-in zoom-in-95 duration-100`}>
                                                                <div className="px-2.5 py-1 bg-indigo-950/80 border-b border-indigo-800 text-[9px] font-bold text-indigo-300 uppercase">
                                                                    Payment Options
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveRowDraft(idx)}
                                                                    className="w-full px-3 py-1.5 text-left text-xs font-bold text-emerald-500 hover:bg-gray-200 flex items-center gap-1.5 cursor-pointer"
                                                                >
                                                                    <FaSave size={11} /> Save
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => { handleRowChange(idx, 'status', 'Pending'); setActiveDropdownIdx(null); }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs font-bold text-sky-300 hover:bg-gray-200 flex items-center gap-1.5 cursor-pointer"
                                                                >
                                                                    <FaEdit size={11} /> Edit
                                                                </button>

                                                                {!isLastMonth && row.status !== 'PayOff' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMarkPaid(idx)}
                                                                        className="w-full px-3 py-1.5 text-left text-xs font-bold text-amber-300 hover:bg-gray-200 flex items-center gap-1.5 cursor-pointer border-t border-gray-800"
                                                                    >
                                                                        <FaCheckCircle size={11} /> Paid
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMarkPayOff(idx)}
                                                                    className="w-full px-3 py-1.5 text-left text-xs font-bold text-indigo-300 hover:bg-gray-200 flex items-center gap-1.5 cursor-pointer border-t border-gray-800"
                                                                >
                                                                    <FaLock size={11} /> Pay Off
                                                                </button>

                                                                {isMasterAdmin && (row.status === 'Paid' || row.status === 'PayOff') && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRevertRow(idx)}
                                                                        className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-400 hover:bg-red-950/60 flex items-center gap-1.5 cursor-pointer border-t border-gray-800"
                                                                    >
                                                                        <FaUndo size={11} /> Revert / Unlock
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 text-[10px]">—</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-3 border-t border-gray-800 bg-[#0f1426] flex items-center justify-end gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
                    >
                        បិទ (Close)
                    </button>

                    {!isReadOnly && (
                        <button
                            type="button"
                            onClick={() => handleSaveSchedule(isSetupActivate ? 'Activated' : null)}
                            disabled={submitting}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                            <FaSave size={14} />
                            <span>
                                {submitting
                                    ? 'កំពុងរក្សាទុក...'
                                    : isSetupActivate
                                        ? 'រក្សាទុក & Activate Contract'
                                        : 'រក្សាទុកការប្រែប្រួល (Save Schedule)'}
                            </span>
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default RepaymentScheduleModal;
