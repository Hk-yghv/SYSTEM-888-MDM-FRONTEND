import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
    FaTelegramPlane, FaClipboardList, FaSync, FaSearch,
    FaTimes, FaCalendarAlt, FaChartBar, FaSpinner,
    FaCheckCircle, FaLock
} from 'react-icons/fa';
import { MdOutlineTableChart } from 'react-icons/md';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (s) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
};

const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// ─── component ───────────────────────────────────────────────────────────────
const ReportAuditTelegram = () => {
    const { API_BASE } = useAuth();

    const [days, setDays] = useState(7);
    const [searchDate, setSearchDate] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastFetched, setLastFetched] = useState(null);

    const todayStr = useMemo(() => getTodayStr(), []);

    // ── fetch ────────────────────────────────────────────────────────────────
    const fetchReport = useCallback(async (numDays) => {
        setLoading(true);
        setError('');
        try {
            const base = API_BASE || '';
            const res = await fetch(`${base}/telegram-audit/report?days=${numDays}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Server error');
            setData(json);
            setLastFetched(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        fetchReport(days);
    }, [fetchReport, days]);

    // ── derived ──────────────────────────────────────────────────────────────
    const dates = useMemo(() => data?.dates || [], [data]);
    const report = useMemo(() => data?.report || {}, [data]);
    const allStatusKeys = useMemo(() => data?.allStatusKeys || [], [data]);
    const allActivityKeys = useMemo(() => data?.allActivityKeys || [], [data]);
    const allNoteKeys = useMemo(() => data?.allNoteKeys || [], [data]);

    // filtered dates
    const filteredDates = useMemo(() => {
        if (!searchDate.trim()) return dates;
        const q = searchDate.trim().toLowerCase();
        return dates.filter(d => d.includes(q) || fmtDate(d).includes(q));
    }, [dates, searchDate]);

    // column totals (bottom row)
    const colTotals = useMemo(() => {
        const tot = {
            totalAudited: 0,
            status: {},
            activity: {},
            note: {},
        };
        for (const d of filteredDates) {
            const e = report[d];
            if (!e) continue;
            tot.totalAudited += e.totalAudited || 0;
            for (const k of allStatusKeys) {
                tot.status[k] = (tot.status[k] || 0) + (e.statusAccountBreakdown?.[k] || 0);
            }
            for (const k of allActivityKeys) {
                tot.activity[k] = (tot.activity[k] || 0) + (e.accountActivityBreakdown?.[k] || 0);
            }
            for (const k of allNoteKeys) {
                tot.note[k] = (tot.note[k] || 0) + (e.noteAuditBreakdown?.[k] || 0);
            }
        }
        return tot;
    }, [filteredDates, report, allStatusKeys, allActivityKeys, allNoteKeys]);

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-slate-50 min-h-screen font-sans">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-[5px] border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-[5px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <MdOutlineTableChart size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                Report Audit Telegram
                            </h1>
                            <span className="px-2 py-0.5 rounded-[5px] text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                                <FaTelegramPlane />Pivot
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            របាយការណ៍សវនកម្ម Telegram បូករួមតាមថ្ងៃ
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Days Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-[5px] border border-slate-300">
                        <FaCalendarAlt className="text-blue-600 text-sm" />
                        <span className="text-xs font-bold text-slate-600">ថ្ងៃ:</span>
                        <select
                            value={days}
                            onChange={e => setDays(Number(e.target.value))}
                            className="text-xs font-bold text-slate-800 bg-transparent border-0 focus:outline-none cursor-pointer"
                        >
                            <option value={7}>7 ថ្ងៃចុងក្រោយ</option>
                            <option value={14}>14 ថ្ងៃចុងក្រោយ</option>
                            <option value={30}>30 ថ្ងៃចុងក្រោយ</option>
                        </select>
                    </div>

                    {/* Search date */}
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="text"
                            placeholder="ស្វែងរកថ្ងៃ..."
                            value={searchDate}
                            onChange={e => setSearchDate(e.target.value)}
                            className="pl-8 pr-8 py-1.5 text-xs font-medium rounded-[5px] border border-slate-200 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-44"
                        />
                        {searchDate && (
                            <button onClick={() => setSearchDate('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <FaTimes size={11} />
                            </button>
                        )}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchReport(days)}
                        disabled={loading}
                        title="ផ្ទុកឡើងវិញ"
                        className="p-2.5 rounded-[5px] bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs cursor-pointer transition-colors"
                    >
                        <FaSync className={`text-sm ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-[5px] border border-slate-200 shadow-2xs">
                    <p className="text-xs font-bold text-slate-500">ចំនួនថ្ងៃបង្ហាញ</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{filteredDates.length}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-emerald-200 shadow-2xs bg-emerald-50/25">
                    <p className="text-xs font-bold text-emerald-600">Total Audited (filter)</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">{colTotals.totalAudited}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-blue-200 shadow-2xs bg-blue-50/25">
                    <p className="text-xs font-bold text-blue-600">Status Account (ប្រភេទ)</p>
                    <p className="text-xl font-black text-blue-700 mt-1">{allStatusKeys.length}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-violet-200 shadow-2xs bg-violet-50/25">
                    <p className="text-xs font-bold text-violet-600">Activity / Note (ប្រភេទ)</p>
                    <p className="text-xl font-black text-violet-700 mt-1">{allActivityKeys.length + allNoteKeys.length}</p>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-rose-50 border border-rose-300 text-rose-700 px-4 py-3 rounded-[5px] text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* ── Table ── */}
            <div className="bg-white rounded-[5px] border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                        <FaSpinner className="animate-spin text-3xl text-blue-500" />
                        <span className="text-sm font-medium">កំពុងទាញទិន្នន័យ...</span>
                    </div>
                ) : filteredDates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                        <FaChartBar className="text-4xl" />
                        <span className="text-sm font-medium">មិនមានទិន្នន័យ</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse min-w-max">
                            <thead>
                                {/* ── Section Header Row ── */}
                                <tr>
                                    {/* Date sticky */}
                                    <th
                                        rowSpan={2}
                                        className="sticky left-0 z-20 px-3 py-2.5 bg-slate-800 text-white font-black text-center border border-slate-700 min-w-[110px] whitespace-nowrap"
                                    >
                                        ថ្ងៃខែឆ្នាំ
                                    </th>
                                    {/* Total Status Audit */}
                                    <th
                                        rowSpan={2}
                                        className="px-3 py-2.5 bg-emerald-600 text-white font-black text-center border border-emerald-700 min-w-[90px] whitespace-nowrap"
                                    >
                                        Total<br />Status Audit
                                    </th>
                                    {/* Status Account section */}
                                    {allStatusKeys.length > 0 && (
                                        <th
                                            colSpan={allStatusKeys.length}
                                            className="px-3 py-2 bg-blue-600 text-white font-black text-center border border-blue-700 whitespace-nowrap"
                                        >
                                            Status Account
                                        </th>
                                    )}
                                    {/* Account Activity section */}
                                    {allActivityKeys.length > 0 && (
                                        <th
                                            colSpan={allActivityKeys.length}
                                            className="px-3 py-2 bg-violet-600 text-white font-black text-center border border-violet-700 whitespace-nowrap"
                                        >
                                            Account Activity
                                        </th>
                                    )}
                                    {/* Note Audit section */}
                                    {allNoteKeys.length > 0 && (
                                        <th
                                            colSpan={allNoteKeys.length}
                                            className="px-3 py-2 bg-amber-500 text-white font-black text-center border border-amber-600 whitespace-nowrap"
                                        >
                                            Note Audit
                                        </th>
                                    )}
                                </tr>
                                {/* ── Sub-column Header Row ── */}
                                <tr>
                                    {/* Status Account keys */}
                                    {allStatusKeys.map(k => (
                                        <th key={`sh-${k}`} className="px-2.5 py-2 bg-blue-50 text-blue-800 font-bold text-center border border-blue-200 whitespace-nowrap max-w-[130px]">
                                            <span className="block truncate" title={k}>{k}</span>
                                        </th>
                                    ))}
                                    {/* Activity keys */}
                                    {allActivityKeys.map(k => (
                                        <th key={`ah-${k}`} className="px-2.5 py-2 bg-violet-50 text-violet-800 font-bold text-center border border-violet-200 whitespace-nowrap max-w-[130px]">
                                            <span className="block truncate" title={k}>{k}</span>
                                        </th>
                                    ))}
                                    {/* Note keys */}
                                    {allNoteKeys.map(k => (
                                        <th key={`nh-${k}`} className="px-2.5 py-2 bg-amber-50 text-amber-800 font-bold text-center border border-amber-200 whitespace-nowrap max-w-[130px]">
                                            <span className="block truncate" title={k}>{k}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {filteredDates.map((d, idx) => {
                                    const e = report[d] || {};
                                    const isToday = d === todayStr;
                                    const rowBg = isToday
                                        ? 'bg-blue-50/60'
                                        : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

                                    return (
                                        <tr key={d} className={`${rowBg} hover:bg-blue-50/40 transition-colors`}>
                                            {/* Date cell (sticky) */}
                                            <td className="sticky left-0 z-10 px-3 py-2.5 border border-slate-200 font-bold text-slate-700 bg-inherit whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    {e.isSubmitted ? (
                                                        <FaLock className="text-rose-400 text-[10px] shrink-0" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                                    )}
                                                    <span className={isToday ? 'text-blue-700 font-extrabold' : ''}>
                                                        {fmtDate(d)}
                                                    </span>
                                                    {isToday && (
                                                        <span className="text-[9px] font-bold px-1 py-0.5 bg-blue-500 text-white rounded">Today</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Total Audited */}
                                            <td className="px-3 py-2.5 border border-emerald-100 text-center font-black text-emerald-700 bg-emerald-50/30">
                                                {e.totalAudited || 0}
                                            </td>

                                            {/* Status Account breakdown */}
                                            {allStatusKeys.map(k => {
                                                const v = e.statusAccountBreakdown?.[k] || 0;
                                                return (
                                                    <td key={`s-${d}-${k}`} className="px-2.5 py-2.5 border border-blue-100 text-center">
                                                        {v > 0 ? (
                                                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                                                                {v}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Account Activity breakdown */}
                                            {allActivityKeys.map(k => {
                                                const v = e.accountActivityBreakdown?.[k] || 0;
                                                return (
                                                    <td key={`a-${d}-${k}`} className="px-2.5 py-2.5 border border-violet-100 text-center">
                                                        {v > 0 ? (
                                                            <span className="inline-block px-2 py-0.5 rounded bg-violet-100 text-violet-800 font-bold text-[11px]">
                                                                {v}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Note Audit breakdown */}
                                            {allNoteKeys.map(k => {
                                                const v = e.noteAuditBreakdown?.[k] || 0;
                                                return (
                                                    <td key={`n-${d}-${k}`} className="px-2.5 py-2.5 border border-amber-100 text-center">
                                                        {v > 0 ? (
                                                            <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                                                                {v}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {/* ── Total Row (bottom) ── */}
                                <tr className="bg-slate-800 text-white font-black">
                                    <td className="sticky left-0 z-10 px-3 py-3 border border-slate-600 bg-slate-800 whitespace-nowrap text-sm">
                                        សរុប (Total)
                                    </td>
                                    {/* Total audited sum */}
                                    <td className="px-3 py-3 border border-emerald-500 text-center text-emerald-300 text-sm">
                                        {colTotals.totalAudited}
                                    </td>
                                    {/* Status totals */}
                                    {allStatusKeys.map(k => (
                                        <td key={`ts-${k}`} className="px-2.5 py-3 border border-blue-500 text-center text-blue-200 text-sm">
                                            {colTotals.status[k] || 0}
                                        </td>
                                    ))}
                                    {/* Activity totals */}
                                    {allActivityKeys.map(k => (
                                        <td key={`ta-${k}`} className="px-2.5 py-3 border border-violet-500 text-center text-violet-200 text-sm">
                                            {colTotals.activity[k] || 0}
                                        </td>
                                    ))}
                                    {/* Note totals */}
                                    {allNoteKeys.map(k => (
                                        <td key={`tn-${k}`} className="px-2.5 py-3 border border-amber-400 text-center text-amber-200 text-sm">
                                            {colTotals.note[k] || 0}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Last fetched */}
            {lastFetched && !loading && (
                <p className="text-[11px] text-slate-400 text-right font-medium">
                    ទាញទិន្នន័យចុងក្រោយ: {lastFetched.toLocaleTimeString()}
                </p>
            )}
        </div>
    );
};

export default ReportAuditTelegram;
