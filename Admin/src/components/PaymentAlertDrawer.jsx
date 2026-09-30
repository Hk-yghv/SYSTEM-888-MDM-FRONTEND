import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaTimes,
    FaPhone,
    FaExclamationTriangle,
    FaCalendarCheck,
    FaSync,
    FaSearch,
    FaLock,
    FaUnlock,
    FaShieldAlt,
    FaCheckDouble,
    FaExternalLinkAlt,
    FaComments,
    FaListAlt,
    FaChevronDown
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CopyCell from './CopyCell';

const PaymentAlertDrawer = ({ isOpen, onClose, alertCount, setAlertCount }) => {
    const { user, API_BASE1, API_BASE2, API_BASE, hasPermission } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overdue'); // 'overdue', 'dueToday', 'dueIn1Day', 'dueIn3Days', 'overdue3Days', 'overdue7Days', 'followUp2Review', 'others'
    const [loading, setLoading] = useState(false);
    const [dueTodayList, setDueTodayList] = useState([]);
    const [dueIn1DayList, setDueIn1DayList] = useState([]);
    const [dueIn3DaysList, setDueIn3DaysList] = useState([]);
    const [overdue3DaysList, setOverdue3DaysList] = useState([]);
    const [overdue7DaysList, setOverdue7DaysList] = useState([]);
    const [overdueList, setOverdueList] = useState([]);
    const [followUp2ReviewList, setFollowUp2ReviewList] = useState([]);
    const [othersRejectedList, setOthersRejectedList] = useState([]);
    const [summary, setSummary] = useState({ dueTodayCount: 0, dueIn1DayCount: 0, dueIn3DaysCount: 0, overdue3DaysCount: 0, overdue7DaysCount: 0, overdueCount: 0, totalAlerts: 0 });
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
        const stableId = item?.logId || item?.contractId || item?._id || item?.customerNameEn || item?.phone || item?.serialNumber || item?.dueDate || 'unknown';
        return String(stableId).trim();
    };

    const updateUnreadCount = useCallback((dueList, due1List, due3List, overdue3DaysList, overdue7DaysList, ovList, fu2ReviewList, othersList, seenKeys) => {
        const allItems = [
            ...(hasPermission('/installment/due-today', 'read') ? dueList : []),
            ...(hasPermission('/installment/schedule', 'read') ? (due1List || []) : []),
            ...(hasPermission('/installment/due-in-3-days', 'read') ? due3List : []),
            ...(hasPermission('/installment/overdue-3-days', 'read') ? overdue3DaysList : []),
            ...(hasPermission('/installment/overdue-7-days', 'read') ? overdue7DaysList : []),
            ...(hasPermission('/installment/overdue', 'read') ? ovList : []),
            ...(hasPermission('/follow-up/follow-up-2', 'read') ? fu2ReviewList : []),
            ...(hasPermission('/history/device-history', 'read') ? (othersList || []) : [])
        ];
        const unreadItems = allItems.filter(item => !seenKeys.has(getItemKey(item)));
        if (setAlertCount) {
            setAlertCount(unreadItems.length);
        }
    }, [hasPermission, setAlertCount]);

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
            let currentOthersList = [];

            // 1. Fetch Rejected Device Actions for "ផ្សេងៗ" category (filtered <= 7 days)
            try {
                const devParams = new URLSearchParams({
                    userBrand: user?.brand || '',
                    username: user?.username || '',
                    userRole: user?.role || '',
                    isImmutable: user?.isImmutable ? 'true' : 'false',
                    status: 'Rejected',
                    page: 1,
                    limit: 200
                });
                const devRes = await fetch(`${API_BASE2}/history/device-actions?${devParams.toString()}`);
                if (devRes.ok) {
                    const devData = await devRes.json();
                    const now = Date.now();
                    // Keep items within 7 days
                    currentOthersList = (devData.data || []).filter(item => {
                        const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : (item.date ? new Date(item.date).getTime() : now);
                        return (now - itemTime) <= (7 * 24 * 60 * 60 * 1000);
                    });
                    setOthersRejectedList(currentOthersList);
                }
            } catch (devErr) {
                console.error('Fetch rejected device actions error:', devErr);
            }

            // 2. Fetch payment alerts
            const res = await fetch(`${baseUrl}/contracts/payment-alerts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const dueList = data.dueTodayList || [];
                const due1List = data.dueIn1DayList || [];
                const due3List = data.dueIn3DaysList || [];
                const overdue3List = data.overdue3DaysList || [];
                const overdue7List = data.overdue7DaysList || [];
                const ovList = data.overdueList || [];

                setDueTodayList(dueList);
                setDueIn1DayList(due1List);
                setDueIn3DaysList(due3List);
                setOverdue3DaysList(overdue3List);
                setOverdue7DaysList(overdue7List);
                setOverdueList(ovList);

                const sum = data.summary || {
                    dueTodayCount: dueList.length,
                    dueIn1DayCount: due1List.length,
                    dueIn3DaysCount: due3List.length,
                    overdue3DaysCount: overdue3List.length,
                    overdue7DaysCount: overdue7List.length,
                    overdueCount: ovList.length,
                    totalAlerts: dueList.length + due1List.length + due3List.length + overdue3List.length + overdue7List.length + ovList.length
                };
                setSummary(sum);

                // 3. Fetch FollowUp2 Review alerts
                try {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];
                    const fu2Params = new URLSearchParams({
                        userBrand: user?.brand || '',
                        userRole: user?.role || '',
                        username: user?.username || '',
                        isImmutable: user?.isImmutable ? 'true' : 'false',
                        status: 'Review',
                        startDate: yesterdayStr,
                        endDate: yesterdayStr,
                        page: 1,
                        limit: 200
                    });
                    const fu2Res = await fetch(`${baseUrl}/follow-up-2?${fu2Params.toString()}`);
                    if (fu2Res.ok) {
                        const fu2Data = await fu2Res.json();
                        const reviewList = (fu2Data.data || []).filter(item =>
                            item.status === 'Review' ||
                            item.status === 'review' ||
                            item.status === 'ពិនិត្យ' ||
                            item.status === 'កំពុងពិនិត្យ'
                        );
                        setFollowUp2ReviewList(reviewList);
                        updateUnreadCount(dueList, due1List, due3List, overdue3List, overdue7List, ovList, reviewList, currentOthersList, seenAlertKeys);
                    } else {
                        updateUnreadCount(dueList, due1List, due3List, overdue3List, overdue7List, ovList, [], currentOthersList, seenAlertKeys);
                    }
                } catch {
                    updateUnreadCount(dueList, due1List, due3List, overdue3List, overdue7List, ovList, [], currentOthersList, seenAlertKeys);
                }
            }
        } catch (err) {
            console.error('Fetch payment alerts error:', err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE, API_BASE1, API_BASE2, user, seenAlertKeys, updateUnreadCount]);

    useEffect(() => {
        fetchAlerts();
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen]);

    const handleMarkAllAsRead = () => {
        const allItems = [...dueTodayList, ...dueIn1DayList, ...dueIn3DaysList, ...overdue3DaysList, ...overdue7DaysList, ...overdueList, ...followUp2ReviewList, ...othersRejectedList];
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
        updateUnreadCount(dueTodayList, dueIn1DayList, dueIn3DaysList, overdue3DaysList, overdue7DaysList, overdueList, followUp2ReviewList, othersRejectedList, newSeen);
    };

    // Filter helper
    const handleCustomerNavigation = (item) => {
        const queryName = item?.customerNameEn || item?.customerNameKh || item?.customerName || item?.phone || '';
        let route = '/installment/overdue';
        let target = '';

        if (activeTab === 'overdue') {
            route = '/installment/overdue';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        } else if (activeTab === 'dueToday') {
            route = '/installment/due-today';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        } else if (activeTab === 'dueIn1Day') {
            route = '/installment/schedule';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}&urgency=dueIn1Day` : `${route}?urgency=dueIn1Day`;
        } else if (activeTab === 'dueIn3Days') {
            route = '/installment/due-in-3-days';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        } else if (activeTab === 'overdue3Days') {
            route = '/installment/overdue-3-days';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        } else if (activeTab === 'overdue7Days') {
            route = '/installment/overdue-7-days';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        } else if (activeTab === 'others') {
            route = '/history/device-history?status=Rejected';
            target = queryName ? `${route}&search=${encodeURIComponent(queryName)}` : route;
        } else {
            route = '/installment/schedule';
            target = queryName ? `${route}?search=${encodeURIComponent(queryName)}` : route;
        }

        handleMarkSingleAsRead(item);
        onClose();
        navigate(target);
    };

    // Navigate to FollowUp2
    const handleFollowUp2Navigation = (item) => {
        handleMarkSingleAsRead(item);
        onClose();
        const customerName = item?.customerName || '';
        if (customerName) {
            navigate(`/follow-up/follow-up-2?search=${encodeURIComponent(customerName)}`);
        } else {
            navigate('/follow-up/follow-up-2');
        }
    };

    const filterItems = (list) => {
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(item =>
            (item.customerNameEn || '').toLowerCase().includes(q) ||
            (item.customerNameKh || '').toLowerCase().includes(q) ||
            (item.customerName || '').toLowerCase().includes(q) ||
            (item.phone || '').toLowerCase().includes(q) ||
            (item.serialNumber || '').toLowerCase().includes(q) ||
            (item.model || '').toLowerCase().includes(q) ||
            (item.contractId || '').toLowerCase().includes(q) ||
            (item.contractIid || '').toLowerCase().includes(q) ||
            (item.reason || '').toLowerCase().includes(q) ||
            (item.actionType || '').toLowerCase().includes(q) ||
            (item.brand || '').toLowerCase().includes(q)
        );
    };

    const unreadCountDue = dueTodayList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountDueIn1Day = dueIn1DayList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountDueIn3Days = dueIn3DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue3Days = overdue3DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue7Days = overdue7DaysList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOverdue = overdueList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountFollowUp2Review = followUp2ReviewList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;
    const unreadCountOthers = othersRejectedList.filter(item => !seenAlertKeys.has(getItemKey(item))).length;

    // Category Droplist Options Config
    const rawAlertCategories = [
        {
            key: 'overdue',
            label: '🔴 ហួសកាលកំណត់ (Overdue Customers)',
            shortLabel: 'Overdue (ហួសកំណត់)',
            count: summary.overdueCount,
            unread: unreadCountOverdue,
            color: 'rose',
            badgeBg: 'bg-rose-500',
            route: '/installment/overdue'
        },
        {
            key: 'dueToday',
            label: '🟡 ដល់ថ្ងៃបង់ថ្ងៃនេះ (Due Today)',
            shortLabel: 'Due Today (ថ្ងៃនេះ)',
            count: summary.dueTodayCount,
            unread: unreadCountDue,
            color: 'amber',
            badgeBg: 'bg-amber-500',
            route: '/installment/due-today'
        },
        {
            key: 'dueIn1Day',
            label: '🟠 សល់ ១ ថ្ងៃត្រូវបង់ (Due in 1 Day)',
            shortLabel: 'Due in 1 Day (សល់ ១ ថ្ងៃ)',
            count: summary.dueIn1DayCount || dueIn1DayList.length,
            unread: unreadCountDueIn1Day,
            color: 'orange',
            badgeBg: 'bg-orange-500',
            route: '/installment/schedule?urgency=dueIn1Day',
            checkRoute: '/installment/schedule'
        },
        {
            key: 'dueIn3Days',
            label: '🔵 ដល់ថ្ងៃក្នុង 3 ថ្ងៃ (Due in 3 Days)',
            shortLabel: 'Due in 3 Days',
            count: summary.dueIn3DaysCount,
            unread: unreadCountDueIn3Days,
            color: 'sky',
            badgeBg: 'bg-sky-500',
            route: '/installment/due-in-3-days'
        },
        {
            key: 'overdue3Days',
            label: '🟠 ហួស 3 ថ្ងៃ (Overdue 3 Days)',
            shortLabel: 'Overdue 3 Days',
            count: summary.overdue3DaysCount,
            unread: unreadCountOverdue3Days,
            color: 'orange',
            badgeBg: 'bg-orange-500',
            route: '/installment/overdue-3-days'
        },
        {
            key: 'overdue7Days',
            label: '🟣 ហួស 7 ថ្ងៃ (Overdue 7 Days)',
            shortLabel: 'Overdue 7 Days',
            count: summary.overdue7DaysCount,
            unread: unreadCountOverdue7Days,
            color: 'violet',
            badgeBg: 'bg-violet-500',
            route: '/installment/overdue-7-days'
        },
        {
            key: 'followUp2Review',
            label: '🟣 Follow-up 2 Review (ម្សិលមិញ)',
            shortLabel: 'Follow-up 2 Review',
            count: followUp2ReviewList.length,
            unread: unreadCountFollowUp2Review,
            color: 'indigo',
            badgeBg: 'bg-indigo-500',
            route: '/follow-up/follow-up-2'
        },
        {
            key: 'others',
            label: '📋 ផ្សេងៗ (ការបដិសេធ / Rejections)',
            shortLabel: 'ផ្សេងៗ (Rejections)',
            count: othersRejectedList.length,
            unread: unreadCountOthers,
            color: 'rose',
            badgeBg: 'bg-rose-500',
            route: '/history/device-history?status=Rejected',
            checkRoute: '/history/device-history'
        }
    ];

    const alertCategories = useMemo(() => {
        return rawAlertCategories.filter(cat => hasPermission(cat.checkRoute || cat.route, 'read'));
    }, [rawAlertCategories, hasPermission]);

    useEffect(() => {
        if (alertCategories.length > 0 && !alertCategories.some(c => c.key === activeTab)) {
            setActiveTab(alertCategories[0].key);
        }
    }, [alertCategories, activeTab]);

    const totalUnreadCount = useMemo(() => {
        return alertCategories.reduce((sum, cat) => sum + (cat.unread || 0), 0);
    }, [alertCategories]);

    const totalAlertCount = useMemo(() => {
        return alertCategories.reduce((sum, cat) => sum + (cat.count || 0), 0);
    }, [alertCategories]);

    const currentCategory = alertCategories.find(c => c.key === activeTab) || alertCategories[0] || {
        key: 'none',
        label: 'គ្មានការជូនដំណឹង',
        count: 0,
        unread: 0,
        route: '/profile'
    };

    // Get active list
    const activeList = useMemo(() => {
        let list = [];
        if (activeTab === 'overdue') list = overdueList;
        else if (activeTab === 'dueToday') list = dueTodayList;
        else if (activeTab === 'dueIn1Day') list = dueIn1DayList;
        else if (activeTab === 'dueIn3Days') list = dueIn3DaysList;
        else if (activeTab === 'overdue3Days') list = overdue3DaysList;
        else if (activeTab === 'overdue7Days') list = overdue7DaysList;
        else if (activeTab === 'followUp2Review') list = followUp2ReviewList;
        else if (activeTab === 'others') list = othersRejectedList;
        return filterItems(list);
    }, [activeTab, overdueList, dueTodayList, dueIn1DayList, dueIn3DaysList, overdue3DaysList, overdue7DaysList, followUp2ReviewList, othersRejectedList, searchTerm]);

    if (!isOpen) return null;

    const userBrandName = user?.brand || 'ទូទាំងប្រព័ន្ធ (All Brands)';

    return (
        <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 select-none">
            <div className="w-[96vw] max-w-7xl bg-white text-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-300">

                {/* ── HEADER ── */}
                <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shadow-md border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[5px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-base relative shadow-inner">
                            <FaBell />
                            {totalUnreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-sm font-bold tracking-wide text-slate-100 flex items-center gap-2 font-khmer">
                                <span className='text-black'>{t('paymentDueAlerts') || 'ការជូនដំណឹងការបង់ប្រាក់ & Follow Up'}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                                    {totalAlertCount} Total
                                </span>
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Brand: <strong className="text-amber-300">{userBrandName}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMarkAllAsRead}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer text-xs flex items-center gap-1.5 font-bold shadow-xs active:scale-95"
                            title={t('markAllRead') || 'សម្គាល់ថាបានអានទាំងអស់'}
                        >
                            <FaCheckDouble className="text-xs" />
                            <span className="hidden sm:inline">{t('markAllRead') || 'អានទាំងអស់'}</span>
                        </button>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer text-xs flex items-center gap-1 font-bold border border-slate-700 active:scale-95"
                            title={t('refresh') || 'ទាញយកឡើងវិញ'}
                        >
                            <FaSync className={`text-xs ${loading ? 'animate-spin text-amber-400' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 transition-colors cursor-pointer text-sm border border-slate-700"
                            title={t('close')}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* ── SPACE-SAVING DROPLIST CATEGORY & FILTER TOOLBAR ── */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">

                    {/* Left: Category Droplist + Active Stat Badge */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1 flex-shrink-0">
                            <FaListAlt className="text-emerald-600" />
                            <span>ប្រភេទ Alert:</span>
                        </span>

                        {/* THE DROPLIST SELECT MENU */}
                        <div className="relative flex-1 max-w-sm">
                            <select
                                value={activeTab}
                                onChange={(e) => setActiveTab(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 bg-white border-2 border-emerald-500/40 hover:border-emerald-500 rounded-[5px] text-xs font-bold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition-all"
                            >
                                {alertCategories.map((cat) => (
                                    <option key={cat.key} value={cat.key}>
                                        {cat.label} ({cat.count}) {cat.unread > 0 ? `• [${cat.unread} NEW]` : ''}
                                    </option>
                                ))}
                            </select>
                            <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs" />
                        </div>

                        {/* Active Category Counter Pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-700">ចំនួន:</span>
                            <span className="font-mono text-xs font-black text-emerald-600">
                                {activeList.length}
                            </span>
                            {currentCategory.unread > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold animate-pulse">
                                    {currentCategory.unread} NEW
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: Quick Search Box & Direct Page Link */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                            <input
                                type="text"
                                placeholder="ស្វែងរកឈ្មោះ, ទូរស័ព្ទ, Serial..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs font-medium"
                            />
                        </div>

                        {/* Direct Page Link Button */}
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate(currentCategory.route);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all shadow-2xs"
                            title="ចូលទៅកាន់ទំព័រពេញលេញ"
                        >
                            <FaExternalLinkAlt className="text-[10px]" />
                            <span className="hidden md:inline">ចូលទំព័រពេញ</span>
                        </button>
                    </div>
                </div>

                {/* ── MAIN CONTENT AREA (DATA TABLE) ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/60">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                            <FaSync className="animate-spin text-3xl text-emerald-600" />
                            <p className="text-xs font-bold">កំពុងទាញយកទិន្នន័យ Alert...</p>
                        </div>
                    ) : alertCategories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                            <FaExclamationTriangle className="text-3xl text-amber-500" />
                            <p className="text-sm font-bold text-slate-700">គ្មានសិទ្ធិចូលមើលការជូនដំណឹង (No Permission for Alerts)</p>
                            <p className="text-xs text-slate-400">គណនីរបស់អ្នកមិនមានសិទ្ធិចូលមើលទំព័រទាក់ទងនឹងការជូនដំណឹងឡើយ។</p>
                        </div>
                    ) : activeTab === 'followUp2Review' ? (
                        /* ── FollowUp2 Review Table ── */
                        <div className="overflow-x-auto rounded-[5px] border border-slate-300 bg-white shadow-md">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-indigo-50 text-indigo-900 border-b border-indigo-200 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-3.5 py-1 text-center">ល.រ</th>
                                        <th className="px-3.5 py-1 text-center">ស្ថានភាព</th>
                                        <th className="px-3.5 py-1">ឈ្មោះអតិថិជន</th>
                                        <th className="px-3.5 py-1">ទូរស័ព្ទ</th>
                                        <th className="px-3.5 py-1">Source</th>
                                        <th className="px-3.5 py-1">Model / ប្រភេទ</th>
                                        <th className="px-3.5 py-1 text-center">កាលបរិច្ឆេទ</th>
                                        <th className="px-3.5 py-1">Brand</th>
                                        <th className="px-3.5 py-1 text-center">ចូលទំព័រ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {activeList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-16 text-center text-slate-400 italic font-semibold">
                                                <FaComments className="text-3xl text-indigo-300 mx-auto mb-2 opacity-50" />
                                                <span>មិនមានទិន្នន័យ Follow-up 2 ដែលត្រូវ Review នៅឡើយទេ</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        activeList.map((item, idx) => {
                                            const isUnread = !seenAlertKeys.has(getItemKey(item));
                                            return (
                                                <tr
                                                    key={item._id || idx}
                                                    onClick={() => handleMarkSingleAsRead(item)}
                                                    className={`transition-colors cursor-pointer ${isUnread ? 'bg-indigo-50/70 hover:bg-indigo-100/70' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        {isUnread ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black animate-pulse shadow-2xs">
                                                                NEW
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">
                                                                Seen
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleFollowUp2Navigation(item); }}
                                                            className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                                                        >
                                                            <span>{item.customerName || '—'}</span>
                                                            <FaExternalLinkAlt className="text-[9px] text-indigo-400 opacity-60" />
                                                        </button>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold whitespace-nowrap">
                                                        {item.phone ? <CopyCell text={item.phone} className="text-slate-900 hover:text-emerald-600" /> : '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600">{item.source || '—'}</td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                        <span className="font-bold text-slate-900">{item.model || '—'}</span>
                                                        {item.collateralType && <span className="block text-[10px] text-slate-400">{item.collateralType}</span>}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap">
                                                        {item.date ? String(item.date).split('T')[0] : '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                                            {item.brand || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleFollowUp2Navigation(item); }}
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                                                        >
                                                            <FaExternalLinkAlt /> ចូល
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'others' ? (
                        /* ── Others (Rejected Device Actions) Table with 7-Day Auto Purge ── */
                        <div className="overflow-x-auto rounded-[5px] border border-rose-200 bg-white shadow-md">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-rose-50 text-rose-900 border-b border-rose-200 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-3.5 py-1 text-center">ល.រ</th>
                                        <th className="px-3.5 py-1 text-center">ស្ថានភាព</th>
                                        <th className="px-3.5 py-1">ឈ្មោះអតិថិជន</th>
                                        <th className="px-3.5 py-1 text-center">ប្រភេទ Action</th>
                                        <th className="px-3.5 py-1">ម៉ូឌែល / Serial</th>
                                        <th className="px-3.5 py-1">មូលហេតុបដិសេធ</th>
                                        <th className="px-3.5 py-1 text-center">កាលបរិច្ឆេទ</th>
                                        <th className="px-3.5 py-1">រៀបចំដោយ</th>
                                        <th className="px-3.5 py-1 text-center">អាយុកាល Alert (៧ថ្ងៃ)</th>
                                        <th className="px-3.5 py-1 text-center">ចូលទំព័រ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {activeList.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="py-16 text-center text-slate-400 italic font-semibold">
                                                <FaExclamationTriangle className="text-3xl text-rose-300 mx-auto mb-2 opacity-50" />
                                                <span>មិនមានទិន្នន័យបដិសេធនៅក្នុង «ផ្សេងៗ» ឡើយ (ស្អាត)</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        activeList.map((item, idx) => {
                                            const isUnread = !seenAlertKeys.has(getItemKey(item));
                                            const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : (item.date ? new Date(item.date).getTime() : Date.now());
                                            const ageDays = Math.floor((Date.now() - itemTime) / (86400000));
                                            const daysRemaining = Math.max(1, 7 - ageDays);

                                            return (
                                                <tr
                                                    key={item._id || item.logId || idx}
                                                    onClick={() => handleMarkSingleAsRead(item)}
                                                    className={`transition-colors cursor-pointer ${isUnread ? 'bg-rose-50/70 hover:bg-rose-100/70' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black shadow-2xs">
                                                            ✕ បដិសេធ
                                                        </span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                            className="flex items-center gap-1.5 hover:text-rose-700 transition-colors text-left cursor-pointer"
                                                        >
                                                            <span>{item.customerName || item.customerNameEn || '—'}</span>
                                                            <FaExternalLinkAlt className="text-[9px] text-rose-400 opacity-60" />
                                                        </button>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                                                            {item.actionType || 'Device Action'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                        <span className="font-bold text-slate-900">{item.model || '—'}</span>
                                                        <span className="block text-[10px] text-slate-500 font-mono">{item.serialNumber}</span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-rose-800 max-w-xs truncate" title={item.reason || ''}>
                                                        <span className="font-semibold text-[11px]">{item.reason || 'បដិសេធដោយ Administrator'}</span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap text-[11px]">
                                                        <div>{item.date || '—'}</div>
                                                        <div className="text-[10px] text-slate-400">{item.time || ''}</div>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700 font-semibold">
                                                        {item.performedBy || 'Admin'}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                                            លុបអូតូក្នុង {daysRemaining} ថ្ងៃ
                                                        </span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                                                        >
                                                            <FaExternalLinkAlt /> ចូល
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* ── Standard Contract Payment Alert Table ── */
                        <div className="overflow-x-auto rounded-[5px] border border-slate-300 bg-white shadow-md">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-3.5 py-1 text-center">ល.រ</th>
                                        <th className="px-3.5 py-1 text-center">Alert Status</th>
                                        <th className="px-3.5 py-1">ឈ្មោះអតិថិជន</th>
                                        <th className="px-3.5 py-1">លេខទូរស័ព្ទ</th>
                                        <th className="px-3.5 py-1">ម៉ាក (Brand)</th>
                                        <th className="px-3.5 py-1">ម៉ូឌែល / Serial</th>
                                        <th className="px-3.5 py-1 text-center">ថ្ងៃត្រូវបង់</th>
                                        <th className="px-3.5 py-1 text-center">ស្ថានភាពលើស/ដល់ថ្ងៃ</th>
                                        <th className="px-3.5 py-1 text-center">Lock Status</th>
                                        <th className="px-3.5 py-1 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {activeList.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="py-16 text-center text-slate-400 italic font-semibold">
                                                <FaCalendarCheck className="text-3xl text-slate-300 mx-auto mb-2 opacity-50" />
                                                <span>មិនមានទិន្នន័យ Alert សម្រាប់ផ្នែកនេះឡើយ</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        activeList.map((item, idx) => {
                                            const isUnread = !seenAlertKeys.has(getItemKey(item));
                                            return (
                                                <tr
                                                    key={item._id || item.contractId || idx}
                                                    onClick={() => handleMarkSingleAsRead(item)}
                                                    className={`transition-colors cursor-pointer ${isUnread
                                                        ? 'bg-amber-50/70 hover:bg-amber-100/70'
                                                        : 'hover:bg-slate-50/80'
                                                        }`}
                                                >
                                                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-500 font-mono">{idx + 1}</td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        {isUnread ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse shadow-2xs">
                                                                NEW
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">
                                                                Seen
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                            className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors text-left cursor-pointer"
                                                        >
                                                            <span>{item.customerNameKh || item.customerNameEn}</span>
                                                            <FaExternalLinkAlt className="text-[9px] text-slate-400 opacity-60" />
                                                        </button>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold whitespace-nowrap">
                                                        <CopyCell text={item.phone || '—'} className="text-slate-900 hover:text-emerald-600" />
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                                            {item.brand || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                        <span className="font-bold text-slate-900">{item.model || '—'}</span>
                                                        <span className="block text-[10px] text-slate-400 font-mono">{item.serialNumber}</span>
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                                                        {item.dueDate || '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        {activeTab === 'overdue' || activeTab === 'overdue3Days' || activeTab === 'overdue7Days' ? (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                                                                {item.overdueText || `លើស ${item.overdueDays} ថ្ងៃ`}
                                                            </span>
                                                        ) : activeTab === 'dueToday' ? (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black">
                                                                ដល់ថ្ងៃថ្ងៃនេះ
                                                            </span>
                                                        ) : activeTab === 'dueIn1Day' ? (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-black">
                                                                សល់ ១ ថ្ងៃត្រូវបង់
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black">
                                                                {item.daysLeft ? `នៅសល់ ${item.daysLeft} ថ្ងៃ` : 'ជិតដល់ថ្ងៃ'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        {item.lockPhoneStatus === 'Locked' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                                                <FaLock size={10} /> Locked
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                                <FaUnlock size={10} /> Normal
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {item.phone && (
                                                                <a
                                                                    href={`tel:${item.phone}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs transition-colors"
                                                                    title="Call Customer"
                                                                >
                                                                    <FaPhone size={10} />
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCustomerNavigation(item); }}
                                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                                            >
                                                                <FaExternalLinkAlt size={9} /> មើល
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── FOOTER ── */}
                <div className="px-5 py-1 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold shadow-xs">
                    <div className="flex items-center gap-2">
                        <span>សរុប Alert: <strong className="text-slate-900">{summary.totalAlerts + followUp2ReviewList.length + othersRejectedList.length}</strong></span>
                        <span>•</span>
                        <span className="text-rose-600">មិនទាន់អាន: <strong>{totalUnreadCount}</strong></span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer transition-colors border border-slate-300"
                    >
                        {t('close') || 'បិទ'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PaymentAlertDrawer;
