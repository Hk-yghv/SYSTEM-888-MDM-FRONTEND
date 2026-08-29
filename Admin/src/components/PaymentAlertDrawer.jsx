import React, { useState, useEffect, useCallback } from 'react';
import { FaBell, FaTimes, FaPhone, FaExclamationTriangle, FaCalendarCheck, FaSync, FaSearch, FaLock, FaUnlock, FaShieldAlt, FaCheckDouble } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import CopyCell from './CopyCell';

const PaymentAlertDrawer = ({ isOpen, onClose, alertCount, setAlertCount }) => {
    const { user, API_BASE1, API_BASE } = useAuth();
    const [activeTab, setActiveTab] = useState('overdue'); // Default to overdue list
    const [loading, setLoading] = useState(false);
    const [dueTodayList, setDueTodayList] = useState([]);
    const [overdueList, setOverdueList] = useState([]);
    const [summary, setSummary] = useState({ dueTodayCount: 0, overdueCount: 0, totalAlerts: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    const storageKey = `mdm_seen_alerts_${user?.username || 'global'}`;
    const [seenAlertKeys, setSeenAlertKeys] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const getItemKey = (item) => `${item.contractId}_${item.dueDate}`;

    const updateUnreadCount = useCallback((dueList, overdueList, seenKeys) => {
        const allItems = [...dueList, ...overdueList];
        const unreadItems = allItems.filter(item => !seenKeys.has(getItemKey(item)));
        if (setAlertCount) {
            setAlertCount(unreadItems.length);
        }
    }, [setAlertCount]);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                username: user?.username || '',
                userRole: user?.role || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });

            const baseUrl = API_BASE1 || API_BASE;
            const res = await fetch(`${baseUrl}/contracts/payment-alerts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const dueList = data.dueTodayList || [];
                const ovList = data.overdueList || [];
                setDueTodayList(dueList);
                setOverdueList(ovList);
                const sum = data.summary || { dueTodayCount: dueList.length, overdueCount: ovList.length, totalAlerts: dueList.length + ovList.length };
                setSummary(sum);

                // Auto switch to overdue if overdue list is populated
                if (ovList.length > 0) {
                    setActiveTab('overdue');
                } else if (dueList.length > 0) {
                    setActiveTab('dueToday');
                }

                updateUnreadCount(dueList, ovList, seenAlertKeys);
            }
        } catch (err) {
            console.error('Fetch payment alerts error:', err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE, API_BASE1, user, seenAlertKeys, updateUnreadCount]);

    // Initial silent poll to populate badge count even when drawer is closed
    useEffect(() => {
        fetchAlerts();
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen]);

    const handleMarkAllAsRead = () => {
        const allItems = [...dueTodayList, ...overdueList];
        const newSeen = new Set(seenAlertKeys);
        allItems.forEach(item => newSeen.add(getItemKey(item)));
        setSeenAlertKeys(newSeen);
        try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(newSeen)));
        } catch (err) {
            console.error('Failed to save seen alerts:', err);
        }
        if (setAlertCount) setAlertCount(0);
    };

    const handleMarkSingleAsRead = (item) => {
        const key = getItemKey(item);
        if (seenAlertKeys.has(key)) return;
        const newSeen = new Set(seenAlertKeys);
        newSeen.add(key);
        setSeenAlertKeys(newSeen);
        try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(newSeen)));
        } catch {}
        updateUnreadCount(dueTodayList, overdueList, newSeen);
    };

    if (!isOpen) return null;

    const userBrandName = user?.brand || 'ទូទាំងប្រព័ន្ធ (All Brands)';

    // Filter helper
    const filterItems = (list) => {
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(item =>
            (item.customerNameEn || '').toLowerCase().includes(q) ||
            (item.customerNameKh || '').toLowerCase().includes(q) ||
            (item.phone || '').toLowerCase().includes(q) ||
            (item.serialNumber || '').toLowerCase().includes(q) ||
            (item.model || '').toLowerCase().includes(q) ||
            (item.contractId || '').toLowerCase().includes(q) ||
            (item.brand || '').toLowerCase().includes(q)
        );
    };

    const filteredDueList = filterItems(dueTodayList);
    const filteredOverdueList = filterItems(overdueList);

    const unreadCountDue = dueTodayList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue = overdueList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;

    return (
        <div className="fixed inset-0 z-[999] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 select-none">
            <div className="w-full max-w-5xl bg-slate-900 text-white h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
                {/* ── Header ── */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg shadow-inner">
                            <FaBell className="animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                                🔔 ជូនដំណឹងបង់ប្រាក់ (Payment Due Alerts)
                            </h2>
                            <p className="text-xs text-amber-400 font-medium">
                                ម៉ាកសកម្ម (Brand): <strong className="text-white underline">{userBrandName}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMarkAllAsRead}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-300 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1.5 font-bold"
                            title="សញ្ញាសម្គាល់បានមើលទាំងអស់"
                        >
                            <FaCheckDouble className="text-xs" />
                            <span>មើលរួចទាំងអស់ (Mark All Read)</span>
                        </button>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                            title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ"
                        >
                            <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer text-sm"
                            title="បិទ"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* ── Summary Counters & Filter Bar ── */}
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('overdue')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'overdue'
                                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 border border-rose-500'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                        >
                            <FaExclamationTriangle className="text-amber-300 animate-pulse" />
                            <span>លើសថ្ងៃបង់ប្រាក់ ({summary.overdueCount})</span>
                            {unreadCountOverdue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-bounce shadow-sm">
                                    {unreadCountOverdue} ថ្មី
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('dueToday')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'dueToday'
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 border border-amber-400'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                        >
                            <FaCalendarCheck />
                            <span>ដល់ថ្ងៃបង់ប្រាក់ ({summary.dueTodayCount})</span>
                            {unreadCountDue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black border border-amber-400">
                                    {unreadCountDue} ថ្មី
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Search box */}
                    <div className="relative w-full sm:w-64">
                        <FaSearch className="absolute left-3 top-2.5 text-slate-500 text-xs" />
                        <input
                            type="text"
                            placeholder="ស្វែងរកឈ្មោះ, លេខទូរស័ព្ទ, Serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                        />
                    </div>
                </div>

                {/* ── Main Content Area ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <FaSync className="animate-spin text-2xl text-amber-500" />
                            <p className="text-xs font-medium">កំពុងទាញយកទិន្នន័យជូនដំណឹងបង់ប្រាក់...</p>
                        </div>
                    ) : activeTab === 'overdue' ? (
                        /* ── Section 1: Overdue List (Detailed Data Table) ── */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaExclamationTriangle /> តារាងអតិថិជនលើសថ្ងៃបង់ប្រាក់ (Overdue Customers Table - {filteredOverdueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-400">បង្ហាញគ្រប់អតិថិជនដែលយឺតយ៉ាវ (លើសថ្ងៃ/ខែ)</span>
                            </div>

                            {filteredOverdueList.length === 0 ? (
                                <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                    <p className="text-slate-400 text-xs font-medium">✨ មិនមានអតិថិជនយឺតយ៉ាវ ឬលើសថ្ងៃបង់ប្រាក់ឡើយ!</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-rose-900/40 bg-slate-950 shadow-xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-rose-950/80 text-rose-200 border-b border-rose-800/60 font-bold uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="px-3 py-3 text-center">ល.រ</th>
                                                <th className="px-3 py-3">ស្ថានភាព Alert</th>
                                                <th className="px-3 py-3">ឈ្មោះអតិថិជន</th>
                                                <th className="px-3 py-3">លេខទូរស័ព្ទ</th>
                                                <th className="px-3 py-3">ម៉ាក (Brand)</th>
                                                <th className="px-3 py-3">ម៉ូឌែល / Serial</th>
                                                <th className="px-3 py-3 text-right">ប្រាក់ត្រូវបង់</th>
                                                <th className="px-3 py-3 text-center">ថ្ងៃត្រូវបង់</th>
                                                <th className="px-3 py-3 text-center">រយៈពេលលើសថ្ងៃ</th>
                                                <th className="px-3 py-3 text-center">Lock Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/80 font-medium">
                                            {filteredOverdueList.map((item, idx) => {
                                                const isUnread = !seenAlertKeys.has(getItemKey(item));
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleMarkSingleAsRead(item)}
                                                        className={`transition-colors cursor-pointer ${
                                                            isUnread ? 'bg-rose-950/40 hover:bg-rose-900/50' : 'hover:bg-slate-900/60 text-slate-300'
                                                        }`}
                                                    >
                                                        <td className="px-3 py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                                                            {isUnread ? (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black border border-rose-400 shadow-sm animate-pulse">
                                                                    🔴 មិនទាន់មើល (NEW)
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                                                                    ✓ មើលរួច
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">
                                                            {item.customerNameKh || item.customerNameEn}
                                                        </td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-amber-300">
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">
                                                                {item.brand}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <div className="text-slate-200 font-bold">{item.model}</div>
                                                            <div className="text-[10px] text-slate-500 font-mono">{item.serialNumber}</div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono font-bold text-emerald-400">
                                                            ${Number(item.monthlyPayment).toFixed(2)}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-300">
                                                            {item.dueDate}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                            <span className="px-2.5 py-1 rounded-full bg-rose-600/20 text-rose-300 border border-rose-500/40 text-xs font-black">
                                                                ⚠️ {item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                            {item.lockPhoneStatus === 'Locked' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                                                    <FaLock /> Locked
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                                                    <FaUnlock /> Unlocked
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Section 2: Due Today / Upcoming List (Cards) ── */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaCalendarCheck /> បញ្ជីអតិថិជនដល់ថ្ងៃបង់ប្រាក់ ({filteredDueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-400">បង្ហាញជា Card ព័ត៌មានលម្អិត</span>
                            </div>

                            {filteredDueList.length === 0 ? (
                                <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                    <p className="text-slate-400 text-xs font-medium">🎉 មិនមានអតិថិជនត្រូវបង់ប្រាក់ក្នុងថ្ងៃនេះទេ!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredDueList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-3.5 bg-slate-950 border rounded-2xl shadow-lg transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                                                    isUnread ? 'border-amber-500/60 ring-1 ring-amber-500/40' : 'border-slate-800 opacity-90'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                                                                    🔴 មិនទាន់មើល (NEW)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                                                            {item.customerNameKh || item.customerNameEn}
                                                        </h4>
                                                        <p className="text-xs text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                                                            <FaPhone className="text-[10px]" />
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </p>
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                                        {item.brand}
                                                    </span>
                                                </div>

                                                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 text-xs space-y-1">
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>ម៉ូឌែលទូរស័ព្ទ:</span>
                                                        <span className="font-bold text-white">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Serial Number:</span>
                                                        <code className="text-indigo-300 font-mono text-[11px]">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>ថ្ងៃត្រូវបង់ប្រាក់:</span>
                                                        <span className="font-bold text-amber-400">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-sm">
                                                        <span className="text-slate-300">ប្រាក់ត្រូវបង់រាល់ខែ:</span>
                                                        <span className="text-emerald-400 font-mono">${Number(item.monthlyPayment).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] pt-1">
                                                    <span className="text-slate-400 flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-500" /> Contract ID: <code className="text-slate-300">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-colors"
                                                        >
                                                            <FaPhone className="text-[9px]" /> Call Now
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>សរុបការជូនដំណឹង: <strong className="text-white">{summary.totalAlerts}</strong> ករណី ({unreadCountDue + unreadCountOverdue} មិនទាន់មើល)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition-colors"
                    >
                        បិទ (Close)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentAlertDrawer;
