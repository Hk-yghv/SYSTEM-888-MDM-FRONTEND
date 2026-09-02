import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaTimes, FaPhone, FaExclamationTriangle, FaCalendarCheck, FaSync, FaSearch, FaLock, FaUnlock, FaShieldAlt, FaCheckDouble, FaExternalLinkAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CopyCell from './CopyCell';

const PaymentAlertDrawer = ({ isOpen, onClose, alertCount, setAlertCount }) => {
    const { user, API_BASE1, API_BASE } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overdue'); // Default to overdue list
    const [loading, setLoading] = useState(false);
    const [dueTodayList, setDueTodayList] = useState([]);
    const [dueIn3DaysList, setDueIn3DaysList] = useState([]);
    const [overdue3DaysList, setOverdue3DaysList] = useState([]);
    const [overdue7DaysList, setOverdue7DaysList] = useState([]);
    const [overdueList, setOverdueList] = useState([]);
    const [summary, setSummary] = useState({ dueTodayCount: 0, dueIn3DaysCount: 0, overdue3DaysCount: 0, overdue7DaysCount: 0, overdueCount: 0, totalAlerts: 0 });
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

    const getItemKey = (item) => {
        const stableId = item?.contractId || item?._id || item?.customerNameEn || item?.phone || item?.serialNumber || item?.dueDate || 'unknown';
        return String(stableId).trim();
    };

    const updateUnreadCount = useCallback((dueList, dueIn3DaysList, overdue3DaysList, overdue7DaysList, overdueList, seenKeys) => {
        const allItems = [...dueList, ...dueIn3DaysList, ...overdue3DaysList, ...overdue7DaysList, ...overdueList];
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
                const due3List = data.dueIn3DaysList || [];
                const overdue3List = data.overdue3DaysList || [];
                const overdue7List = data.overdue7DaysList || [];
                const ovList = data.overdueList || [];
                setDueTodayList(dueList);
                setDueIn3DaysList(due3List);
                setOverdue3DaysList(overdue3List);
                setOverdue7DaysList(overdue7List);
                setOverdueList(ovList);
                const sum = data.summary || {
                    dueTodayCount: dueList.length,
                    dueIn3DaysCount: due3List.length,
                    overdue3DaysCount: overdue3List.length,
                    overdue7DaysCount: overdue7List.length,
                    overdueCount: ovList.length,
                    totalAlerts: dueList.length + due3List.length + overdue3List.length + overdue7List.length + ovList.length
                };
                setSummary(sum);

                // Auto switch tab if needed
                if (ovList.length > 0) {
                    setActiveTab('overdue');
                } else if (dueList.length > 0) {
                    setActiveTab('dueToday');
                } else if (due3List.length > 0) {
                    setActiveTab('dueIn3Days');
                } else if (overdue3List.length > 0) {
                    setActiveTab('overdue3Days');
                } else if (overdue7List.length > 0) {
                    setActiveTab('overdue7Days');
                }

                updateUnreadCount(dueList, due3List, overdue3List, overdue7List, ovList, seenAlertKeys);
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
        const allItems = [...dueTodayList, ...dueIn3DaysList, ...overdue3DaysList, ...overdue7DaysList, ...overdueList];
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
        updateUnreadCount(dueTodayList, dueIn3DaysList, overdue3DaysList, overdue7DaysList, overdueList, newSeen);
    };

    if (!isOpen) return null;

    const userBrandName = user?.brand || 'ទូទាំងប្រព័ន្ធ (All Brands)';

    // Filter helper
    const handleCustomerNavigation = (item) => {
        const queryName = item?.customerNameEn || item?.customerNameKh || '';
        const route = activeTab === 'overdue'
            ? '/installment/overdue'
            : activeTab === 'dueToday'
                ? '/installment/due-today'
                : activeTab === 'dueIn3Days'
                    ? '/installment/due-in-3-days'
                    : activeTab === 'overdue3Days'
                        ? '/installment/overdue-3-days'
                        : activeTab === 'overdue7Days'
                            ? '/installment/overdue-7-days'
                            : '/installment/overdue';
        const target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        handleMarkSingleAsRead(item);
        onClose();
        navigate(target);
    };

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
    const filteredDueIn3DaysList = filterItems(dueIn3DaysList);
    const filteredOverdue3DaysList = filterItems(overdue3DaysList);
    const filteredOverdue7DaysList = filterItems(overdue7DaysList);
    const filteredOverdueList = filterItems(overdueList);

    const unreadCountDue = dueTodayList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountDueIn3Days = dueIn3DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue3Days = overdue3DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue7Days = overdue7DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue = overdueList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;

    return (
        <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 select-none">
            <div className="w-[92vw] max-w-7xl text-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-300">
                {/* Header (Clean Light Theme) */}
                <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-lg font-black tracking-wide text-slate-900 flex items-center gap-2 font-khmer">
                                {t('paymentDueAlerts')}
                            </h2>
                            <p className="text-xs text-slate-600 font-bold mt-2">
                                {t('brandLabel')}: <strong className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{userBrandName}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMarkAllAsRead}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer text-xs flex items-center gap-1.5 font-bold shadow-sm"
                            title={t('markAllRead')}
                        >
                            <FaCheckDouble className="text-xs" />
                            <span>{t('markAllRead')}</span>
                        </button>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1 font-bold border border-slate-300"
                            title={t('refresh')}
                        >
                            <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{t('refresh')}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer text-sm border border-slate-300"
                            title={t('close')}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* Summary Counters & Filter Bar */}
                <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <button
                            onClick={() => setActiveTab('overdue')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'overdue'
                                ? 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaExclamationTriangle className={activeTab === 'overdue' ? 'text-white' : 'text-rose-600'} />
                            <span>{t('overdueCustomers')} ({summary.overdueCount})</span>
                            {unreadCountOverdue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                    {unreadCountOverdue} {t('newBadge')}
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
                            <span>{t('dueToday')} ({summary.dueTodayCount})</span>
                            {unreadCountDue > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-black">
                                    {unreadCountDue} {t('newBadge')}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('dueIn3Days')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'dueIn3Days'
                                ? 'bg-sky-600 text-white border-sky-700 shadow-md shadow-sky-600/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaCalendarCheck className={activeTab === 'dueIn3Days' ? 'text-white' : 'text-sky-600'} />
                            <span>{t('dueIn3Days')} ({summary.dueIn3DaysCount})</span>
                            {unreadCountDueIn3Days > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                    {unreadCountDueIn3Days} {t('newBadge')}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('overdue3Days')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'overdue3Days'
                                ? 'bg-orange-600 text-white border-orange-700 shadow-md shadow-orange-600/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaExclamationTriangle className={activeTab === 'overdue3Days' ? 'text-white' : 'text-orange-600'} />
                            <span>{t('overdue3Days')} ({summary.overdue3DaysCount})</span>
                            {unreadCountOverdue3Days > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                    {unreadCountOverdue3Days} {t('newBadge')}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('overdue7Days')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${activeTab === 'overdue7Days'
                                ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-600/25'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                        >
                            <FaExclamationTriangle className={activeTab === 'overdue7Days' ? 'text-white' : 'text-violet-600'} />
                            <span>{t('overdue7Days')} ({summary.overdue7DaysCount})</span>
                            {unreadCountOverdue7Days > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                    {unreadCountOverdue7Days} {t('newBadge')}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Search box */}
                    <div className="relative w-full sm:w-72">
                        <FaSearch className="absolute left-3 top-2.5 text-slate-400 text-xs" />
                        <input
                            type="text"
                            placeholder={t('searchCustomerPhoneSerial')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                        />
                    </div>
                </div>

                {/* Main Content Area (High Contrast Text & Clean Panels) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
                            <FaSync className="animate-spin text-3xl text-amber-500" />
                            <p className="text-xs font-bold">{t('loadingAlertData')}</p>
                        </div>
                    ) : activeTab === 'overdue' ? (
                        /* Section 1: Overdue List (High Contrast Clear Table) */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaExclamationTriangle className="text-rose-600" /> {t('overdueCustomers')} ({filteredOverdueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">{t('overdueCustomers')}</span>
                            </div>

                            {filteredOverdueList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">{t('noOverdueCustomers')}</p>
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
                                                                    {t('newBadge')}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-[10px] font-bold">
                                                                    {t('seenBadge')}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3.5 py-3 font-black text-slate-900 whitespace-nowrap text-sm">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="flex items-center gap-1.5 text-left hover:text-rose-600 transition-colors cursor-pointer group"
                                                                title="ចូលទៅ Overdue Page"
                                                            >
                                                                <span>{item.customerNameKh || item.customerNameEn}</span>
                                                                <FaExternalLinkAlt className="text-[9px] text-rose-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                                                            </button>
                                                        </td>
                                                        <td className="px-3.5 py-3 whitespace-nowrap font-mono text-indigo-700 font-bold">
                                                            <CopyCell text={item.phone} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" />
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
                                                                {item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}
                                                            </span>
                                                        </td>
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                            {item.lockPhoneStatus === 'Locked' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                                                    <FaLock /> {t('locked')}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                                                    <FaUnlock /> {t('unlocked')}
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
                    ) : activeTab === 'dueToday' ? (
                        /* Section 2: Due Today List */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaCalendarCheck className="text-amber-600" /> {t('dueToday')} ({filteredDueList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">{t('dueToday')}</span>
                            </div>

                            {filteredDueList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">{t('noDueTodayCustomers')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {filteredDueList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-5 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${isUnread ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                                                    {t('newBadge')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-[15px] font-black text-slate-900">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="flex items-center gap-1.5 hover:text-amber-700 transition-colors cursor-pointer group text-left"
                                                                title={t('dueToday')}
                                                            >
                                                                <span>{item.customerNameKh || item.customerNameEn}</span>
                                                                <FaExternalLinkAlt className="text-[9px] text-amber-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                                                            </button>
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

                                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2 font-semibold text-slate-800">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('modelLabel')}:</span>
                                                        <span className="font-black text-slate-900 text-right">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('serialNumberLabel')}:</span>
                                                        <code className="text-slate-900 font-mono text-[12px] font-bold text-right">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('dueDateLabel')}:</span>
                                                        <span className="font-black text-amber-700 font-mono text-right">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200 font-black text-[15px]">
                                                        <span className="text-slate-700">{t('monthlyPaymentLabel')}:</span>
                                                        <span className="text-emerald-700 font-mono">${Number(item.monthlyPayment).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[12px] pt-1">
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-400" /> {t('contractIdLabel')}: <code className="text-slate-800 font-bold">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-colors shadow-xs"
                                                        >
                                                            <FaPhone className="text-[10px]" /> {t('callNow')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'dueIn3Days' ? (
                        /* Section 3: Due In 3 Days List */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaCalendarCheck className="text-sky-600" /> {t('dueIn3Days')} ({filteredDueIn3DaysList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">{t('dueIn3Days')}</span>
                            </div>

                            {filteredDueIn3DaysList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">{t('noDueIn3DaysCustomers')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {filteredDueIn3DaysList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-5 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${isUnread ? 'border-sky-400 ring-2 ring-sky-400/20' : 'border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                                                    {t('newBadge')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-[15px] font-black text-slate-900">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="flex items-center gap-1.5 hover:text-sky-700 transition-colors cursor-pointer group text-left"
                                                                title={t('dueIn3Days')}
                                                            >
                                                                <span>{item.customerNameKh || item.customerNameEn}</span>
                                                                <FaExternalLinkAlt className="text-[9px] text-sky-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                                                            </button>
                                                        </h4>
                                                        <p className="text-xs text-indigo-700 font-mono font-bold mt-0.5 flex items-center gap-1">
                                                            <FaPhone className="text-[10px]" />
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-300 text-[10px] font-black">
                                                        {item.brand}
                                                    </span>
                                                </div>

                                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2 font-semibold text-slate-800">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('modelLabel')}:</span>
                                                        <span className="font-black text-slate-900 text-right">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('serialNumberLabel')}:</span>
                                                        <code className="text-slate-900 font-mono text-[12px] font-bold text-right">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('dueDateLabel')}:</span>
                                                        <span className="font-black text-sky-700 font-mono text-right">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200 font-black text-[15px]">
                                                        <span className="text-slate-700">{t('monthlyPaymentLabel')}:</span>
                                                        <span className="text-emerald-700 font-mono">${Number(item.monthlyPayment).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[12px] pt-1">
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-400" /> {t('contractIdLabel')}: <code className="text-slate-800 font-bold">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-colors shadow-xs"
                                                        >
                                                            <FaPhone className="text-[10px]" /> {t('callNow')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'overdue3Days' ? (
                        /* Section 4: Overdue 3 Days List */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaExclamationTriangle className="text-orange-600" /> {t('overdue3Days')} ({filteredOverdue3DaysList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">{t('overdue3Days')}</span>
                            </div>

                            {filteredOverdue3DaysList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">{t('noOverdue3DaysCustomers')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {filteredOverdue3DaysList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-5 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${isUnread ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                                                    {t('newBadge')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-[15px] font-black text-slate-900">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="flex items-center gap-1.5 hover:text-orange-700 transition-colors cursor-pointer group text-left"
                                                                title={t('overdueCustomers')}
                                                            >
                                                                <span>{item.customerNameKh || item.customerNameEn}</span>
                                                                <FaExternalLinkAlt className="text-[9px] text-orange-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                                                            </button>
                                                        </h4>
                                                        <p className="text-xs text-indigo-700 font-mono font-bold mt-0.5 flex items-center gap-1">
                                                            <FaPhone className="text-[10px]" />
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-300 text-[10px] font-black">
                                                        {item.brand}
                                                    </span>
                                                </div>

                                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2 font-semibold text-slate-800">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('modelLabel')}:</span>
                                                        <span className="font-black text-slate-900 text-right">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('serialNumberLabel')}:</span>
                                                        <code className="text-slate-900 font-mono text-[12px] font-bold text-right">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('dueDateLabel')}:</span>
                                                        <span className="font-black text-orange-700 font-mono text-right">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200 font-black text-[15px]">
                                                        <span className="text-slate-700">{t('overdueCustomers')}:</span>
                                                        <span className="text-orange-700 font-mono">{item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[12px] pt-1">
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-400" /> {t('contractIdLabel')}: <code className="text-slate-800 font-bold">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-colors shadow-xs"
                                                        >
                                                            <FaPhone className="text-[10px]" /> {t('callNow')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Section 5: Overdue 7 Days List */
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-black text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaExclamationTriangle className="text-violet-600" /> {t('overdue7Days')} ({filteredOverdue7DaysList.length})
                                </h3>
                                <span className="text-[11px] text-slate-600 font-bold">{t('overdue7Days')}</span>
                            </div>

                            {filteredOverdue7DaysList.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white shadow-xs">
                                    <p className="text-slate-600 text-xs font-bold">{t('noOverdue7DaysCustomers')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {filteredOverdue7DaysList.map((item, idx) => {
                                        const isUnread = !seenAlertKeys.has(getItemKey(item));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleMarkSingleAsRead(item)}
                                                className={`p-5 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${isUnread ? 'border-violet-400 ring-2 ring-violet-400/20' : 'border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isUnread && (
                                                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                                                    {t('newBadge')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-[15px] font-black text-slate-900">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="flex items-center gap-1.5 hover:text-violet-700 transition-colors cursor-pointer group text-left"
                                                                title={t('overdue7Days')}
                                                            >
                                                                <span>{item.customerNameKh || item.customerNameEn}</span>
                                                                <FaExternalLinkAlt className="text-[9px] text-violet-400 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                                                            </button>
                                                        </h4>
                                                        <p className="text-xs text-indigo-700 font-mono font-bold mt-0.5 flex items-center gap-1">
                                                            <FaPhone className="text-[10px]" />
                                                            <CopyCell value={item.phone} label={item.phone} />
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-300 text-[10px] font-black">
                                                        {item.brand}
                                                    </span>
                                                </div>

                                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2 font-semibold text-slate-800">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('modelLabel')}:</span>
                                                        <span className="font-black text-slate-900 text-right">{item.model}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('serialNumberLabel')}:</span>
                                                        <code className="text-slate-900 font-mono text-[12px] font-bold text-right">{item.serialNumber}</code>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600">{t('dueDateLabel')}:</span>
                                                        <span className="font-black text-violet-700 font-mono text-right">{item.dueDate}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200 font-black text-[15px]">
                                                        <span className="text-slate-700">{t('overdueCustomers')}:</span>
                                                        <span className="text-violet-700 font-mono">{item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[12px] pt-1">
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <FaShieldAlt className="text-slate-400" /> {t('contractIdLabel')}: <code className="text-slate-800 font-bold">{item.contractId}</code>
                                                    </span>
                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition-colors shadow-xs"
                                                        >
                                                            <FaPhone className="text-[10px]" /> {t('callNow')}
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

                {/* Footer (Clean Light Panel) */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold shadow-xs">
                    <span>{t('paymentDueAlerts')}: <strong className="text-slate-900">{summary.totalAlerts}</strong> ({unreadCountDue + unreadCountDueIn3Days + unreadCountOverdue3Days + unreadCountOverdue7Days + unreadCountOverdue} {t('newBadge')})</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer transition-colors border border-slate-300"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentAlertDrawer;
