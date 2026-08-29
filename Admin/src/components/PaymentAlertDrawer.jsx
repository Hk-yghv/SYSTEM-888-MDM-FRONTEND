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

                // Auto switch tab if needed
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
        } catch { }
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
        <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 select-none">
            <div className="w-full max-w-5xl bg-[#f8fafc] text-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-300">
                {/* ── Header (Clean Light Theme) ── */}
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 text-xl shadow-xs">
                            <FaBell className="animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-wide text-slate-900 flex items-center gap-2 font-khmer">
                                ជូនដំណឹងបង់ប្រាក់ (Payment Due Alerts)
                            </h2>
                            <p className="text-xs text-slate-600 font-bold mt-2">
                                ម៉ាកសកម្ម (Brand): <strong className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{userBrandName}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMarkAllAsRead}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer text-xs flex items-center gap-1.5 font-bold shadow-sm"
                            title="សញ្ញាសម្គាល់បានមើលទាំងអស់"
                        >
                            <FaCheckDouble className="text-xs" />
                            <span>មើលរួចទាំងអស់</span>
                        </button>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1 font-bold border border-slate-300"
                            title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ"
                        >
                            <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer text-sm border border-slate-300"
                            title="បិទ"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* ── Summary Counters & Filter Bar ── */}
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('overdue')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'overdue'
                                ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaExclamationTriangle className={activeTab === 'overdue' ? 'text-white' : 'text-rose-600'} />
                            <span>លើសថ្ងៃបង់ប្រាក់ ({summary.overdueCount})</span>
                            {unreadCountOverdue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                    {unreadCountOverdue} ថ្មី
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('dueToday')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'dueToday'
                                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md shadow-amber-500/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaCalendarCheck className={activeTab === 'dueToday' ? 'text-slate-950' : 'text-amber-600'} />
                            <span>ដល់ថ្ងៃបង់ប្រាក់ ({summary.dueTodayCount})</span>
                            {unreadCountDue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-black">
                                    {unreadCountDue} ថ្មី
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Search box */}
                    <div className="relative w-full sm:w-72">
                        <FaSearch className="absolute left-3 top-2.5 text-slate-400 text-xs" />
                        <input
                            type="text"
                            placeholder="ស្វែងរកឈ្មោះ, លេខទូរស័ព្ទ, Serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                        />
                    </div>
                </div>

                {/* ── Main Content Area (High Contrast Text & Clean Panels) ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8fafc]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
                            <FaSync className="animate-spin text-3xl text-amber-500" />
                            <p className="text-xs font-bold">កំពុងទាញយកទិន្នន័យជូនដំណឹងបង់ប្រាក់...</p>
                        </div>
                    ) : activeTab === 'overdue' ? (
                        /* ── Section 1: Overdue List (High Contrast Clear Table) ── */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaExclamationTriangle className="text-rose-600" /> តារាងអតិថិជនលើសថ្ងៃបង់ប្រាក់ (OVERDUE CUSTOMERS TABLE - {filteredOverdueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">បង្ហាញគ្រប់អតិថិជនដែលយឺតយ៉ាវ (លើសថ្ងៃ/ខែ)</span>
                            </div>

                            {filteredOverdueList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">✨ មិនមានអតិថិជនយឺតយ៉ាវ ឬលើសថ្ងៃបង់ប្រាក់ឡើយ!</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-md">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100 text-slate-900 border-b border-slate-300 font-black uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="px-3.5 py-3.5 text-center">ល.រ</th>
                                                <th className="px-3.5 py-3.5 text-center">ស្ថានភាព ALERT</th>
                                                <th className="px-3.5 py-3.5">ឈ្មោះអតិថិជន</th>
                                                <th className="px-3.5 py-3.5">លេខទូរស័ព្ទ</th>
                                                <th className="px-3.5 py-3.5">ម៉ាក (BRAND)</th>
                                                <th className="px-3.5 py-3.5">ម៉ូឌែល / SERIAL</th>
                                                <th className="px-3.5 py-3.5 text-center">ថ្ងៃត្រូវបង់</th>
                                                <th className="px-3.5 py-3.5 text-center">រយៈពេលលើសថ្ងៃ</th>
                                                <th className="px-3.5 py-3.5 text-center">LOCK STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 font-semibold">
                                            {filteredOverdueList.map((item, idx) => {
                                                const isUnread = !seenAlertKeys.has(getItemKey(item));
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleMarkSingleAsRead(item)}
                                                        className={`transition-colors cursor-pointer ${isUnread ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50 text-slate-900'
                                                            }`}
                                                    >
                                                        <td className="px-3.5 py-3 text-center font-bold text-slate-700">{idx + 1}</td>
                                                        <td className="px-3.5 py-3 whitespace-nowrap text-center">
                                                            {isUnread ? (
                                                                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs animate-pulse border border-rose-500">
                                                                    🔴 មិនទាន់មើល (NEW)
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-[10px] font-bold">
                                                                    ✓ មើលរួច
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3.5 py-3 font-black text-slate-900 whitespace-nowrap text-sm">
                                                            {item.customerNameKh || item.customerNameEn}
                                                        </td>
                                                        <td className="px-3.5 py-3 whitespace-nowrap font-mono text-indigo-700 font-bold">
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </td>
                                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-black text-[11px]">
                                                                {item.brand}
                                                            </span>
                                                        </td>
                                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                                            <div className="text-slate-900 font-black">{item.model}</div>
                                                            <div className="text-[11px] text-slate-500 font-mono font-medium">{item.serialNumber}</div>
                                                        </td>
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap text-slate-800 font-bold font-mono">
                                                            {item.dueDate}
                                                        </td>
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black shadow-xs">
                                                                ⚠️ {item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}
                                                            </span>
                                                        </td>
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                            {item.lockPhoneStatus === 'Locked' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                                                    <FaLock /> Locked
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
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
                        /* ── Section 2: Due Today / Upcoming List (High Contrast Light Cards) ── */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaCalendarCheck className="text-amber-600" /> បញ្ជីអតិថិជនដល់ថ្ងៃបង់ប្រាក់ ({filteredDueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">បង្ហាញជា Card ព័ត៌មានលម្អិត</span>
                            </div>

                            {filteredDueList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">🎉 មិនមានអតិថិជនត្រូវបង់ប្រាក់ក្នុងថ្ងៃនេះទេ!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {filteredDueList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer ${isUnread ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                                                    🔴 មិនទាន់មើល (NEW)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                                                            {item.customerNameKh || item.customerNameEn}
                                                        </h4>
                                                        <p className="text-xs text-indigo-700 font-mono font-bold mt-0.5 flex items-center gap-1">
                                                            <FaPhone className="text-[10px]" />
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black">
                                                        {item.brand}
                                                    </span>
                                                </div>

                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 font-semibold text-slate-800">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">ម៉ូឌែលទូរស័ព្ទ:</span>
                                                        <span className="font-black text-slate-900">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Serial Number:</span>
                                                        <code className="text-slate-900 font-mono text-[11px] font-bold">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">ថ្ងៃត្រូវបង់ប្រាក់:</span>
                                                        <span className="font-black text-amber-700 font-mono">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-sm">
                                                        <span className="text-slate-700">ប្រាក់ត្រូវបង់រាល់ខែ:</span>
                                                        <span className="text-emerald-700 font-mono">${Number(item.monthlyPayment).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] pt-1">
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-400" /> Contract ID: <code className="text-slate-800 font-bold">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-colors shadow-xs"
                                                        >
                                                            <FaPhone className="text-[10px]" /> Call Now
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

                {/* ── Footer (Clean Light Panel) ── */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold shadow-xs">
                    <span>សរុបការជូនដំណឹង: <strong className="text-slate-900">{summary.totalAlerts}</strong> ករណី ({unreadCountDue + unreadCountOverdue} មិនទាន់មើល)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer transition-colors border border-slate-300"
                    >
                        បិទ (Close)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentAlertDrawer;
