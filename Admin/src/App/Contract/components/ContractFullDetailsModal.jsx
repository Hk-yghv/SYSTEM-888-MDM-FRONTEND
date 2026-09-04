import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
    FaUser, FaMobileAlt, FaDollarSign, FaCalendarAlt, FaLock,
    FaCheckCircle, FaSave, FaEdit, FaUndo, FaExternalLinkAlt
} from 'react-icons/fa';
import { MdClose, MdSwapHoriz } from 'react-icons/md';
import { formatIMEI } from '../../../utils/imeiFormatter';
import CopyCell from '../../../components/CopyCell';

const ContractFullDetailsModal = ({
    open,
    setOpen,
    contract,
    onSaved,
    onRedeem
}) => {
    const { API_BASE1, user } = useAuth();
    const [activeTab, setActiveTab] = useState('info');

    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator'
    );

    // ── Repayment Schedule State ──
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

        if (open && contract) {
            fetchLatePenaltySetting();
        }
    }, [API_BASE1, contract?.brand, user?.brand, open, contract]);

    const parseDuration = (durationStr) => {
        if (!durationStr) return { isDays: false, count: 3 };
        const str = String(durationStr).toLowerCase().trim();
        const matched = str.match(/\d+/);
        const count = matched ? Math.max(1, parseInt(matched[0], 10)) : 3;
        const isDays = str.includes('day') || str.includes('ថ្ងៃ') || str.includes('d');
        return { isDays, count };
    };

    const generateDefaultRows = (ctr) => {
        const { isDays, count } = parseDuration(ctr?.duration);
        const totalLoan = Number(ctr?.amount) || Number(ctr?.totalAmount) || 0;
        const startDate = ctr?.inputDate ? new Date(ctr.inputDate) : new Date();

        if (isDays) {
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
        setActiveTab('info');
    }, [open, contract, latePenaltyRules]);

    if (!open || !contract) return null;

    const firstPendingIdx = rows.findIndex(r => r.status === 'Pending' || r.status === 'Saved');
    const payOffTriggeredIdx = rows.findIndex(r => r.status === 'PayOff');
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
        setRows(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                paidAmount: 0,
                paidDate: '',
                status: 'Pending'
            };
            return updated;
        });
        setActiveDropdownIdx(null);
    };

    const handleSaveSchedule = async () => {
        setSubmitting(true);
        try {
            const payload = {
                repaymentSchedule: rows
            };
            const res = await fetch(`${API_BASE1}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                if (onSaved) onSaved();
            } else {
                alert('បរាជ័យក្នុងការរក្សាទុក Schedule');
            }
        } catch (err) {
            console.error('Save schedule error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const photoUrl = contract.customerPhoto || contract.googleDrivePhotoUrl || '';
    const totalLoan = Number(contract.amount || contract.totalAmount || 0);
    const totalPaid = rows.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
    const totalScheduled = rows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

    const tabs = [
        { id: 'info', label: 'Information', icon: <FaUser />, color: 'indigo' },
        { id: 'device', label: 'Device', icon: <FaMobileAlt />, color: 'purple' },
        { id: 'loan', label: 'Loan terms', icon: <FaDollarSign />, color: 'amber' },
        { id: 'schedule', label: 'Repayment Schedule ($)', icon: <FaCalendarAlt />, color: 'emerald' },
    ];

    const tabCls = {
        indigo: { active: 'bg-indigo-600 text-white border-indigo-500', inactive: 'text-indigo-400 border-gray-700 hover:bg-indigo-900/40' },
        purple: { active: 'bg-purple-600 text-white border-purple-500', inactive: 'text-purple-400 border-gray-700 hover:bg-purple-900/40' },
        amber: { active: 'bg-amber-600 text-white border-amber-500', inactive: 'text-amber-400 border-gray-700 hover:bg-amber-900/40' },
        emerald: { active: 'bg-emerald-600 text-white border-emerald-500', inactive: 'text-emerald-400 border-gray-700 hover:bg-emerald-900/40' },
    };

    if (!open || !contract) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 select-none animate-in fade-in duration-150">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden grid grid-rows-[auto_auto_minmax(0,1fr)_auto] h-[90vh] text-xs">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                            <span>Contract:</span>
                            <span className="font-mono text-indigo-400 font-bold">{contract.contractIid || contract.contractId || '—'}</span>
                            {contract.contractIid && contract.contractId && (
                                <span className="text-xs font-mono text-amber-300 font-medium">({contract.contractId})</span>
                            )}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 uppercase">
                            {contract.status || 'Activated'}
                        </span>
                        <span className="text-xs text-gray-300 font-semibold hidden md:inline">
                            {contract.customerNameEn} {contract.customerNameKh ? `(${contract.customerNameKh})` : ''}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-[5px] text-xs cursor-pointer transition-all flex items-center gap-1.5"
                        >
                            <MdClose /> បិទ (Close)
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700/60 flex-shrink-0 bg-gray-900 overflow-x-auto select-none">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const c = tabCls[tab.color];
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 border ${isActive ? c.active : c.inactive}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Contents */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-900/50">

                    {/* ════════════ TAB 1: INFORMATION ════════════ */}
                    {activeTab === 'info' && (
                        <div className="space-y-4">
                            {/* Top Overview Banner */}
                            <div className="p-3.5 bg-gray-800/80 border border-gray-700 rounded-xl flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                {photoUrl ? (
                                    <img
                                        src={photoUrl}
                                        alt="Customer"
                                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border-2 border-indigo-500/60 shadow-lg flex-shrink-0"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center text-3xl text-gray-500 flex-shrink-0">
                                        <FaUser />
                                    </div>
                                )}
                                <div className="space-y-1.5 text-center sm:text-left flex-1">
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        <h3 className="text-base font-bold text-gray-100">{contract.customerNameEn || '—'}</h3>
                                        {contract.customerNameKh && (
                                            <h4 className="text-sm font-bold text-indigo-400 font-khmer">{contract.customerNameKh}</h4>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-gray-400">
                                        <span>Brand: <strong className="text-gray-200">{contract.brand || '—'}</strong></span>
                                        <span>•</span>
                                        <span>Date: <strong className="text-amber-300 font-mono">{contract.inputDate || '—'}</strong></span>
                                        <span>•</span>
                                        <span>Phone: <strong className="text-emerald-400 font-mono">{contract.phone || '—'}</strong></span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                        {contract.urlFb && (
                                            <a href={contract.urlFb} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded-[5px] text-xs font-semibold flex items-center gap-1 transition-colors">
                                                <FaExternalLinkAlt size={9} /> Facebook
                                            </a>
                                        )}
                                        {contract.mosyleUrl && (
                                            <a href={contract.mosyleUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-[5px] text-xs font-semibold flex items-center gap-1 transition-colors">
                                                <FaExternalLinkAlt size={9} /> Mosyle
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Customer Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Contract IID (Manual)</span>
                                    <span className="font-mono text-indigo-400 font-bold">{contract.contractIid || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Contract ID (Auto)</span>
                                    <span className="font-mono text-amber-300 font-bold">{contract.contractId || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">ID Card</span>
                                    <span className="font-mono text-gray-100 font-bold">{contract.idCardNumber || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Date of Birth</span>
                                    <span className="font-mono text-gray-200">{contract.dob || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Gender</span>
                                    <span className="text-gray-100 capitalize">{contract.gender || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Phone Number</span>
                                    <span className="font-mono text-emerald-400 font-bold">{contract.phone || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Relative Phone</span>
                                    <span className="font-mono text-gray-300">{contract.relativePhone || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Telegram</span>
                                    <span className="text-sky-400 font-semibold">{contract.telegramName || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Facebook</span>
                                    <span className="text-indigo-300 font-semibold">{contract.facebookName || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700 md:col-span-2">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Current Address</span>
                                    <span className="text-gray-200">{contract.currentAddress || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700 md:col-span-2">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Birth Address</span>
                                    <span className="text-gray-200">{contract.birthAddress || '—'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 2: DEVICE ════════════ */}
                    {activeTab === 'device' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Device Model</span>
                                    <span className="text-purple-300 font-bold">{contract.model || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Brand</span>
                                    <span className="text-gray-100 font-bold">{contract.brand || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700 md:col-span-2">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Serial Number</span>
                                    <span className="font-mono text-cyan-400 font-bold">{contract.serialNumber || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">IMEI 1</span>
                                    <span className="font-mono text-gray-200 font-bold">{formatIMEI(contract.imei1)}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">IMEI 2</span>
                                    <span className="font-mono text-gray-300">{formatIMEI(contract.imei2)}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">MEID</span>
                                    <span className="font-mono text-pink-400 font-semibold">{contract.meid || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">OS Version</span>
                                    <span className="text-indigo-300 font-semibold">{contract.version || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Color</span>
                                    <span className="text-gray-200">{contract.color || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Capacity / Storage</span>
                                    <span className="text-gray-200 font-mono">{contract.capacity || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Phone Lock</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${contract.lockPhoneStatus === 'Locked' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                                        {contract.lockPhoneStatus || 'Unlocked'}
                                    </span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Wallpaper Lock</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${contract.lockWallpaperStatus === 'Locked' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                                        {contract.lockWallpaperStatus || 'Unlocked'}
                                    </span>
                                </div>
                            </div>

                            {contract.deviceProblem && (
                                <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-[5px] text-xs">
                                    <span className="text-amber-400 block text-[10px] font-bold uppercase mb-0.5">Device Problem / Issues</span>
                                    <p className="text-amber-200 font-medium">{contract.deviceProblem}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════ TAB 3: LOAN TERMS ════════════ */}
                    {activeTab === 'loan' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Contract IID (Manual)</span>
                                    <span className="font-mono text-indigo-400 font-bold text-sm">{contract.contractIid || '—'}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Contract ID (Auto)</span>
                                    <span className="font-mono text-amber-300 font-bold text-sm">{contract.contractId || '—'}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Loan Input Date</span>
                                    <span className="font-mono text-amber-300 font-bold">{contract.inputDate || '—'}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Total Loan Amount</span>
                                    <span className="font-mono text-emerald-400 font-bold text-base">${Number(contract.amount || contract.totalAmount || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Customer Received / Monthly</span>
                                    <span className="font-mono text-cyan-400 font-bold text-base">${Number(contract.monthlyPayment || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Interest Rate</span>
                                    <span className="text-gray-100 font-bold">{contract.interest || contract.interestType || '14%'}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Loan Duration</span>
                                    <span className="text-gray-100 font-bold">{contract.duration || '12 Months'}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Admin Fee</span>
                                    <span className="font-mono text-gray-200 font-bold">${Number(contract.adminFee || 0).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-gray-800/80 rounded-[5px] border border-gray-700 md:col-span-2">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-0.5">Payment Summary</span>
                                    <div className="flex items-center gap-3 text-xs mt-1">
                                        <span className="text-gray-300">Paid: <strong className="text-emerald-400 font-mono">${totalPaid.toLocaleString()}</strong></span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-300">Remaining: <strong className="text-amber-400 font-mono">${Math.max(0, totalScheduled - totalPaid).toLocaleString()}</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════ TAB 4: REPAYMENT SCHEDULE ($) ════════════ */}
                    {activeTab === 'schedule' && (
                        <div className="space-y-3">
                            {/* Summary Info Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="p-2.5 bg-gray-800/80 border border-gray-700 rounded-[5px]">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Loan</span>
                                    <span className="text-emerald-400 font-mono font-bold text-sm">${totalLoan.toLocaleString()}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 border border-gray-700 rounded-[5px]">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Scheduled</span>
                                    <span className="text-cyan-400 font-mono font-bold text-sm">${totalScheduled.toLocaleString()}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 border border-gray-700 rounded-[5px]">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Paid</span>
                                    <span className="text-emerald-400 font-mono font-bold text-sm">${totalPaid.toLocaleString()}</span>
                                </div>
                                <div className="p-2.5 bg-gray-800/80 border border-gray-700 rounded-[5px]">
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Remaining</span>
                                    <span className="text-amber-400 font-mono font-bold text-sm">${Math.max(0, totalScheduled - totalPaid).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Repayment Table */}
                            <div className="overflow-x-auto rounded-[5px] border border-gray-700 bg-gray-900 shadow-md">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-800 text-gray-300 border-b border-gray-700 text-[11px] uppercase tracking-wider font-semibold">
                                            <th className="px-3 py-2 text-center">N°</th>
                                            <th className="px-3 py-2">Schedule Month</th>
                                            <th className="px-3 py-2">Due Date</th>
                                            <th className="px-3 py-2 text-right">Scheduled ($)</th>
                                            <th className="px-3 py-2 text-right">Penalty ($)</th>
                                            <th className="px-3 py-2 text-right">Total ($)</th>
                                            <th className="px-3 py-2 text-right">Paid ($)</th>
                                            <th className="px-3 py-2 text-center">Status</th>
                                            <th className="px-3 py-2">Comment</th>
                                            <th className="px-3 py-2 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 text-gray-200">
                                        {rows.map((row, idx) => {
                                            const isLastMonth = idx === rows.length - 1;
                                            const isRowActive = activeRowIdx === idx;

                                            return (
                                                <tr
                                                    key={idx}
                                                    ref={el => rowRefs.current[idx] = el}
                                                    className={`hover:bg-indigo-950/20 transition-colors ${row.status === 'Paid' ? 'bg-emerald-950/15' : row.status === 'PayOff' ? 'bg-indigo-950/25' : row.status === 'Settled' ? 'bg-gray-900/40 opacity-60' : ''}`}
                                                >
                                                    <td className="px-3 py-2 text-center font-mono text-gray-500 font-bold">{idx + 1}</td>
                                                    <td className="px-3 py-2 font-bold text-gray-100 whitespace-nowrap">{row.labelName || `Month ${idx + 1}`}</td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="date"
                                                            value={row.dueDate || ''}
                                                            onChange={e => handleRowChange(idx, 'dueDate', e.target.value)}
                                                            className="px-2 py-1 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-100 font-mono text-xs outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                                                        <input
                                                            type="number"
                                                            value={row.scheduledAmount ?? ''}
                                                            onChange={e => handleRowChange(idx, 'scheduledAmount', e.target.value)}
                                                            className="w-20 px-2 py-1 bg-gray-800/80 border border-gray-700 focus:border-emerald-500 rounded-[5px] text-right font-mono text-emerald-300 text-xs outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-amber-400">
                                                        <input
                                                            type="number"
                                                            value={row.penalty ?? ''}
                                                            onChange={e => handleRowChange(idx, 'penalty', e.target.value)}
                                                            className="w-16 px-2 py-1 bg-gray-800/80 border border-gray-700 focus:border-amber-500 rounded-[5px] text-right font-mono text-amber-300 text-xs outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-cyan-300">
                                                        ${Number(row.totalAmount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                                                        <input
                                                            type="number"
                                                            value={row.paidAmount ?? ''}
                                                            onChange={e => handleRowChange(idx, 'paidAmount', e.target.value)}
                                                            className="w-20 px-2 py-1 bg-gray-800/80 border border-gray-700 focus:border-emerald-500 rounded-[5px] text-right font-mono text-emerald-400 font-bold text-xs outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.status === 'Paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                                                            row.status === 'PayOff' ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' :
                                                                row.status === 'Settled' ? 'bg-gray-800 text-gray-400 border border-gray-700' :
                                                                    row.status === 'Saved' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' :
                                                                        'bg-amber-950 text-amber-300 border border-amber-700'
                                                            }`}>
                                                            {row.status || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.comment || ''}
                                                            onChange={e => handleRowChange(idx, 'comment', e.target.value)}
                                                            placeholder="Note / remark"
                                                            className="w-full min-w-[100px] px-2 py-1 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 rounded-[5px] text-gray-200 text-xs outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center relative">
                                                        {isRowActive || row.status === 'Paid' || row.status === 'PayOff' || row.status === 'Saved' ? (
                                                            <div className="relative inline-block text-left">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveDropdownIdx(activeDropdownIdx === idx ? null : idx)}
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-transform hover:scale-110 cursor-pointer ${row.status === 'Paid' ? 'bg-emerald-600 text-white' :
                                                                        row.status === 'PayOff' ? 'bg-indigo-600 text-white' :
                                                                            'bg-amber-500 hover:bg-amber-400 text-gray-950'
                                                                        }`}
                                                                >
                                                                    <FaDollarSign />
                                                                </button>

                                                                {activeDropdownIdx === idx && (
                                                                    <div className={`absolute right-0 ${idx >= rows.length - 2 && rows.length > 3 ? 'bottom-full mb-1' : 'top-full mt-1'} w-36 bg-gray-900 border border-indigo-500/80 rounded-xl shadow-2xl z-[99999] overflow-hidden animate-in zoom-in-95 duration-100`}>
                                                                        <div className="px-2.5 py-1 bg-indigo-950/80 border-b border-indigo-800 text-[9px] font-bold text-indigo-300 uppercase">
                                                                            Payment Options
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSaveRowDraft(idx)}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-emerald-400 hover:bg-gray-800 flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            <FaSave size={11} /> Save
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { handleRowChange(idx, 'status', 'Pending'); setActiveDropdownIdx(null); }}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-sky-300 hover:bg-gray-800 flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            <FaEdit size={11} /> Edit
                                                                        </button>

                                                                        {!isLastMonth && row.status !== 'PayOff' && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleMarkPaid(idx)}
                                                                                className="w-full px-3 py-1.5 text-left text-xs font-bold text-amber-300 hover:bg-gray-800 flex items-center gap-1.5 cursor-pointer border-t border-gray-800"
                                                                            >
                                                                                <FaCheckCircle size={11} /> Paid
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleMarkPayOff(idx)}
                                                                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-indigo-300 hover:bg-gray-800 flex items-center gap-1.5 cursor-pointer border-t border-gray-800"
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
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                {/* Bottom Footer Buttons */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-700 bg-gray-800 flex-shrink-0">
                    <div className="text-xs text-gray-400">
                        {activeTab === 'schedule' && (
                            <span>Total Rows: <strong className="text-indigo-400 font-mono">{rows.length}</strong></span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Redeem Button - ONLY present when activeTab is schedule */}
                        {activeTab === 'schedule' && onRedeem && (
                            <button
                                type="button"
                                onClick={() => onRedeem(contract)}
                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all"
                            >
                                <MdSwapHoriz size={16} />
                                <span>Redeem</span>
                            </button>
                        )}

                        {/* Save Schedule Button - ONLY present when in schedule tab */}
                        {activeTab === 'schedule' && (
                            <button
                                type="button"
                                onClick={handleSaveSchedule}
                                disabled={submitting}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
                            >
                                <FaSave size={13} />
                                <span>{submitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក Schedule'}</span>
                            </button>
                        )}

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold rounded-[5px] text-xs cursor-pointer transition-all"
                        >
                            បិទ (Close)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContractFullDetailsModal;
