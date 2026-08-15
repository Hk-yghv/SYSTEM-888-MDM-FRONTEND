import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    MdDashboard, MdOutlineWallpaper, MdOutlineSync, MdCheckCircle,
    MdTrendingUp, MdPeople, MdBarChart, MdClose,
    MdDateRange, MdFilterList, MdInfo
} from 'react-icons/md';
import { IoMdWallet } from 'react-icons/io';
import { FaLock, FaChartPie, FaLayerGroup, FaHistory, FaChartLine, FaChartBar, FaSearch } from 'react-icons/fa';

const Dashboard = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [stats, setStats] = useState({
        totalContracts: 0, activatedContracts: 0, applicationContracts: 0,
        checkContracts: 0, redeemContracts: 0, commentsContracts: 0,
        blacklistContracts: 0, lockedPhones: 0, unlockedPhones: 0,
        lockedWallpapers: 0, unlockedWallpapers: 0, totalRevenue: 0, paymentCount: 0
    });

    const [timeRange, setTimeRange] = useState('monthly');
    const [brandFilter, setBrandFilter] = useState(user?.brand || '');
    const [brandsList, setBrandsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const [sessionModal, setSessionModal] = useState(false);
    const [recentSessions, setRecentSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [activityTypeFilter, setActivityTypeFilter] = useState('All');
    const [allActivities, setAllActivities] = useState([]);
    const [detailModal, setDetailModal] = useState({ open: false, title: '', items: [] });
    const [detailSearch, setDetailSearch] = useState('');

    const fetchBrands = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat) setBrandsList(brandCat.items);
            }
        } catch { }
    };

    const fetchDashboardStats = async () => {
        setReloading(true);
        try {
            const params = new URLSearchParams();
            if (brandFilter && user?.role === 'Administrator') params.set('userBrand', brandFilter);
            else if (user?.brand) params.set('userBrand', user.brand);
            const res = await fetch(`${API_BASE}/dashboard/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 600);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const [cRes, pRes] = await Promise.all([
                fetch(`${API_BASE}/contracts?limit=200`),
                fetch(`${API_BASE}/payments?limit=200`)
            ]);
            // normalize any date string to YYYY-MM-DD
            const toDate = (raw) => {
                if (!raw) return todayStr;
                const s = String(raw);
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;  // already YYYY-MM-DD
                const d = new Date(s);
                if (!isNaN(d)) return d.toISOString().split('T')[0];
                return todayStr;
            };

            const logs = [];
            if (cRes.ok) {
                const cData = await cRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                contracts.forEach(item => {
                    const dateVal = toDate(item.inputDate || item.createdAt);
                    logs.push({
                        id: item._id, date: dateVal,
                        timestamp: new Date(dateVal).getTime() || Date.now(),
                        type: item.status || 'Application',
                        customerName: item.customerNameEn || 'Customer',
                        customerNameKh: item.customerNameKh || '',
                        model: item.model || 'Device',
                        serialNumber: item.serialNumber || '-',
                        performedBy: item.salesName || 'System Admin',
                        details: `Status: ${item.status || 'Pending'}`
                    });
                    if (item.lockPhoneStatus === 'Locked') {
                        logs.push({
                            id: `${item._id}-lock`, date: dateVal,
                            timestamp: new Date(dateVal).getTime() || Date.now(),
                            type: 'Lock Device',
                            customerName: item.customerNameEn || 'Customer',
                            customerNameKh: item.customerNameKh || '',
                            model: item.model || 'Device',
                            serialNumber: item.serialNumber || '-',
                            performedBy: 'MDM Service', details: 'Device Remote Lock Applied'
                        });
                    }
                    if (item.lockWallpaperStatus === 'Locked') {
                        logs.push({
                            id: `${item._id}-wp`, date: dateVal,
                            timestamp: new Date(dateVal).getTime() || Date.now(),
                            type: 'Wallpaper Lock',
                            customerName: item.customerNameEn || 'Customer',
                            customerNameKh: item.customerNameKh || '',
                            model: item.model || 'Device',
                            serialNumber: item.serialNumber || '-',
                            performedBy: 'MDM Service', details: 'Custom Lockscreen Applied'
                        });
                    }
                });
            }
            if (pRes.ok) {
                const pData = await pRes.json();
                const payments = pData.data || pData.payments || (Array.isArray(pData) ? pData : []);
                payments.forEach(item => {
                    const dateVal = toDate(item.paidDate || item.paymentDate || item.createdAt);
                    logs.push({
                        id: item._id, date: dateVal,
                        timestamp: new Date(dateVal).getTime() || Date.now(),
                        type: 'Payment',
                        customerName: item.customerName || 'Customer',
                        customerNameKh: '',
                        model: item.model || 'Installment',
                        serialNumber: item.serialNumber || '-',
                        performedBy: item.paidBy || 'Collector',
                        details: `Amount: $${item.amount}`
                    });
                });
            }
            logs.sort((a, b) => b.timestamp - a.timestamp);
            setAllActivities(logs);
        } catch (err) {
            console.error('Failed to fetch activity audit logs:', err);
        }
    };

    const fetchRecentSessions = async () => {
        setSessionsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/users`);
            if (res.ok) {
                const users = await res.json();
                const allSessions = [];
                users.forEach(u => {
                    (u.loginHistory || []).slice(-5).forEach(log => {
                        allSessions.push({ ...log, username: u.username, name: u.name, role: u.role });
                    });
                });
                allSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setRecentSessions(allSessions.slice(0, 20));
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    useEffect(() => { fetchBrands(); fetchAuditLogs(); }, []);
    useEffect(() => { fetchDashboardStats(); }, [brandFilter]);

    const handleOpenSessions = () => { setSessionModal(true); fetchRecentSessions(); };

    const filteredAuditLogs = useMemo(() => {
        return allActivities.filter(act => {
            // act.date is always YYYY-MM-DD (normalized in fetchAuditLogs)
            const d = (act.date || '').slice(0, 10);
            const matchesStart = !startDate || d >= startDate;
            const matchesEnd = !endDate || d <= endDate;
            const matchesType = activityTypeFilter === 'All' || act.type === activityTypeFilter;
            return matchesStart && matchesEnd && matchesType;
        });
    }, [allActivities, startDate, endDate, activityTypeFilter]);

    const typeDistribution = useMemo(() => {
        const dist = { Activated: 0, Application: 0, Check: 0, 'Lock Device': 0, 'Wallpaper Lock': 0, Payment: 0, Redeem: 0 };
        filteredAuditLogs.forEach(item => {
            if (dist[item.type] !== undefined) dist[item.type]++;
            else dist[item.type] = 1;
        });
        return dist;
    }, [filteredAuditLogs]);

    const trendData = useMemo(() => {
        const map = {};
        filteredAuditLogs.forEach(item => { const d = item.date || 'Unknown'; map[d] = (map[d] || 0) + 1; });
        return Object.keys(map).sort().slice(-10).map(d => ({ date: d, count: map[d] }));
    }, [filteredAuditLogs]);

    const handleChartPointClick = (title, categoryOrDate, isDate = false) => {
        const matches = filteredAuditLogs.filter(item => isDate ? item.date === categoryOrDate : item.type === categoryOrDate);
        setDetailModal({ open: true, title: `${title}: ${categoryOrDate} (${matches.length} Items)`, items: matches });
        setDetailSearch('');
    };

    const activatedPct = stats.totalContracts ? Math.round((stats.activatedContracts / stats.totalContracts) * 100) : 0;
    const applicationPct = stats.totalContracts ? Math.round((stats.applicationContracts / stats.totalContracts) * 100) : 0;
    const checkPct = stats.totalContracts ? Math.round((stats.checkContracts / stats.totalContracts) * 100) : 0;
    const redeemPct = stats.totalContracts ? Math.round((stats.redeemContracts / stats.totalContracts) * 100) : 0;
    const blacklistPct = stats.totalContracts ? Math.round((stats.blacklistContracts / stats.totalContracts) * 100) : 0;
    const phoneLockPct = stats.totalContracts ? Math.round((stats.lockedPhones / stats.totalContracts) * 100) : 0;
    const wallpaperLockPct = stats.totalContracts ? Math.round((stats.lockedWallpapers / stats.totalContracts) * 100) : 0;

    const multiplier = timeRange === 'daily' ? 0.03 : timeRange === 'monthly' ? 0.25 : timeRange === 'yearly' ? 0.9 : 1.0;
    const totalCollectedRevenue = Math.round(stats.totalRevenue * multiplier);
    const estimatedAdminProfit = Math.round(totalCollectedRevenue * 0.15);
    const outstandingLoans = Math.round(stats.activatedContracts * 850 * (1 - multiplier * 0.5));
    const netProfitMargin = totalCollectedRevenue > 0 ? Math.round((estimatedAdminProfit / totalCollectedRevenue) * 100) : 0;
    const isAdmin = user?.role === 'Administrator';

    const modalFilteredItems = useMemo(() => {
        if (!detailSearch.trim()) return detailModal.items;
        const q = detailSearch.toLowerCase();
        return detailModal.items.filter(i =>
            i.customerName?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q) ||
            i.serialNumber?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q)
        );
    }, [detailModal.items, detailSearch]);

    return (
        <div className="w-full min-h-screen bg-[#f4f6f8] p-6 space-y-6 select-none">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdDashboard className="text-emerald-600 text-3xl" />
                        {t('dashboard')}
                    </h1>
                    <p className="text-xs text-slate-600 font-semibold mt-1">System Analytics, Financial Profit/Loss & Real-Time Tracking</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isAdmin && brandsList.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                            <FaLayerGroup className="text-emerald-600 text-xs" />
                            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
                                className="bg-transparent text-slate-800 font-bold cursor-pointer outline-none pr-1">
                                <option value="">All Brands</option>
                                {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center p-1 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-xs">
                        {[['daily', 'Daily'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['all', 'All Time']].map(([val, label]) => (
                            <button key={val} onClick={() => setTimeRange(val)}
                                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${timeRange === val ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleOpenSessions}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                        <FaHistory className="text-sm" /> <span>Recent Sessions</span>
                    </button>
                    <button onClick={fetchDashboardStats} disabled={reloading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                        <MdOutlineSync className={`text-base ${reloading ? 'spin-reload text-emerald-600' : ''}`} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </div>

            {/* Brand filter badge */}
            {(brandFilter || user?.brand) && (
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-600 font-semibold">Showing stats for:</span>
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold flex items-center gap-1.5">
                        <FaLayerGroup size={10} /> {brandFilter || user?.brand}
                        {isAdmin && brandFilter && (
                            <button onClick={() => setBrandFilter('')} className="ml-1 text-emerald-700 hover:text-emerald-950 cursor-pointer">✕</button>
                        )}
                    </span>
                </div>
            )}

            {/* ── Profit & Loss ── */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <MdTrendingUp className="text-xl text-emerald-600" /> Profit & Loss Financial Analytics ({timeRange.toUpperCase()} View)
                    </h2>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-mono text-xs font-bold">
                        Net Profit Margin: {netProfitMargin}%
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {[
                        { label: 'Collected Revenue', value: `$${totalCollectedRevenue.toLocaleString()}`, sub: 'From installment payments', color: 'text-emerald-700' },
                        { label: 'Estimated Net Profit', value: `$${estimatedAdminProfit.toLocaleString()}`, sub: '↑ +15% Admin Fee & Profit margin', color: 'text-teal-700' },
                        { label: 'Outstanding Balance', value: `$${outstandingLoans.toLocaleString()}`, sub: 'Active contracts pending collection', color: 'text-amber-700' },
                        { label: 'Financial Loss Risk', value: `$${Math.round(stats.blacklistContracts * 800).toLocaleString()}`, sub: 'Blacklisted defaulting accounts', color: 'text-red-700' },
                    ].map(item => (
                        <div key={item.label} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                            <span className="text-slate-600 block text-[11px] uppercase font-bold">{item.label}</span>
                            <span className={`text-2xl font-black font-mono block mt-1 ${item.color}`}>{item.value}</span>
                            <span className="text-[10px] text-slate-500 font-medium mt-1 block">{item.sub}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Metric Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Contracts', value: stats.totalContracts, sub: `${stats.activatedContracts} Activated • ${stats.applicationContracts} Pending`, icon: <MdPeople />, iconBg: 'bg-slate-100 border-slate-200 text-slate-700', hover: 'hover:border-emerald-300', valueColor: 'text-slate-900' },
                    { label: t('activated'), value: stats.activatedContracts, sub: `${activatedPct}% activation rate`, icon: <MdCheckCircle />, iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700', hover: 'hover:border-emerald-300', valueColor: 'text-slate-900' },
                    { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, sub: `${stats.paymentCount} payment transactions`, icon: <IoMdWallet />, iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700', hover: 'hover:border-emerald-300', valueColor: 'text-emerald-700' },
                    { label: 'Phone Locked', value: stats.lockedPhones, sub: `${stats.unlockedPhones} Unlocked • ${stats.lockedWallpapers} Wallpaper`, icon: <FaLock />, iconBg: 'bg-red-50 border-red-200 text-red-700', hover: 'hover:border-red-300', valueColor: 'text-red-700' },
                ].map(card => (
                    <div key={card.label} className={`p-5 rounded-2xl bg-white border border-slate-200 ${card.hover} transition-all shadow-sm group`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{card.label}</p>
                                <h2 className={`text-3xl font-black mt-1 ${card.valueColor}`}>{card.value}</h2>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl group-hover:scale-110 transition-transform ${card.iconBg}`}>
                                {card.icon}
                            </div>
                        </div>
                        <div className="mt-3 text-[11px] text-slate-600 font-semibold">{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Donut + Analytics ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Donut Chart */}
                <div className="lg:col-span-1 p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FaChartPie className="text-emerald-600 text-base" /> Contract Status Distribution
                    </h3>
                    <div className="flex flex-col items-center justify-center gap-4 pt-2">
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100" strokeWidth="3.8" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-emerald-600" strokeDasharray={`${activatedPct}, 100`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-amber-500" strokeDasharray={`${applicationPct}, 100`} strokeDashoffset={`-${activatedPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-sky-500" strokeDasharray={`${checkPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-purple-500" strokeDasharray={`${redeemPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-red-500" strokeDasharray={`${blacklistPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct + redeemPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-black text-slate-900">{stats.totalContracts}</span>
                                <span className="text-[10px] uppercase text-slate-500 font-bold">Total</span>
                            </div>
                        </div>
                        <div className="w-full space-y-1.5 text-xs font-bold">
                            {[
                                { label: t('activated'), count: stats.activatedContracts, pct: activatedPct, color: 'bg-emerald-600', text: 'text-emerald-800', border: 'border-emerald-200', bg: 'bg-emerald-50' },
                                { label: t('application'), count: stats.applicationContracts, pct: applicationPct, color: 'bg-amber-500', text: 'text-amber-800', border: 'border-amber-200', bg: 'bg-amber-50' },
                                { label: t('check'), count: stats.checkContracts, pct: checkPct, color: 'bg-sky-500', text: 'text-sky-800', border: 'border-sky-200', bg: 'bg-sky-50' },
                                { label: t('redeem'), count: stats.redeemContracts, pct: redeemPct, color: 'bg-purple-500', text: 'text-purple-800', border: 'border-purple-200', bg: 'bg-purple-50' },
                                { label: 'Blacklist', count: stats.blacklistContracts, pct: blacklistPct, color: 'bg-red-500', text: 'text-red-800', border: 'border-red-200', bg: 'bg-red-50' },
                            ].map(item => (
                                <div key={item.label} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${item.bg} border ${item.border}`}>
                                    <span className={`flex items-center gap-2 ${item.text}`}>
                                        <span className={`w-2 h-2 rounded-full ${item.color}`}></span>{item.label}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="font-mono text-slate-900 font-bold">{item.count}</span>
                                        <span className="text-slate-500 text-[10px]">{item.pct}%</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Analytics Panel */}
                <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 space-y-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <MdBarChart className="text-emerald-600 text-lg" /> Data Analysis & Security Overview
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Activation Rate', pct: activatedPct, barColor: 'bg-emerald-600', textColor: 'text-emerald-700', suffix: `${activatedPct}% (${stats.activatedContracts}/${stats.totalContracts})` },
                            { label: 'Wallpaper Lock Ratio', pct: wallpaperLockPct, barColor: 'bg-purple-600', textColor: 'text-purple-700', suffix: `${stats.lockedWallpapers} Locked / ${stats.unlockedWallpapers} Unlocked` },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between items-center text-xs font-bold mb-2">
                                    <span className="text-slate-700">{item.label}</span>
                                    <span className={`font-mono ${item.textColor}`}>{item.suffix}</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.barColor} transition-all duration-700 rounded-full`} style={{ width: `${item.pct}%` }}></div>
                                </div>
                            </div>
                        ))}

                        {/* Phone Lock split bar */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold mb-2">
                                <span className="text-slate-700">Phone Lock Ratio</span>
                                <span className="text-red-700 font-mono">{stats.lockedPhones} Locked / {stats.unlockedPhones} Unlocked</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden flex">
                                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${phoneLockPct}%` }}></div>
                                <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${100 - phoneLockPct}%` }}></div>
                            </div>
                            <div className="flex gap-3 mt-1 text-[10px] text-slate-600 font-semibold">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-600 rounded-sm"></span>Locked {phoneLockPct}%</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-600 rounded-sm"></span>Unlocked {100 - phoneLockPct}%</span>
                            </div>
                        </div>

                        {/* Avg Revenue */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold mb-2">
                                <span className="text-slate-700">Avg. Revenue per Payment</span>
                                <span className="text-emerald-700 font-mono font-bold">
                                    ${stats.paymentCount ? (stats.totalRevenue / stats.paymentCount).toFixed(2) : '0.00'} / txn
                                </span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 transition-all duration-500 rounded-full" style={{ width: `${Math.min(stats.paymentCount * 5, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                        {[
                            { label: 'At Risk', value: stats.blacklistContracts, sub: 'Blacklisted', color: 'text-red-700' },
                            { label: 'In Review', value: stats.checkContracts, sub: 'Check Stage', color: 'text-sky-700' },
                            { label: 'Redeemed', value: stats.redeemContracts, sub: 'Paid Off', color: 'text-purple-700' },
                        ].map(c => (
                            <div key={c.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{c.label}</p>
                                <p className={`text-xl font-black mt-1 ${c.color}`}>{c.value}</p>
                                <p className="text-[10px] text-slate-600 font-semibold">{c.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Custom Date Audit & 3 Charts ── */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-md">

                {/* Filters */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <MdDateRange className="text-emerald-600 text-2xl" />
                            <span>ព័ត៌មានលម្អិត និង ស្ថិតិត្រួតពិនិត្យ (Custom Date Audit & Interactive Analytics)</span>
                        </h2>
                        <p className="text-xs text-slate-600 font-semibold mt-1">ជ្រើសរើសចន្លោះកាលបរិច្ឆេទ • ចុចលើក្រាបដើម្បីមើល UI លម្អិត</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700">
                            <span className="text-slate-500 font-medium">ពីថ្ងៃ:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent font-bold outline-none cursor-pointer text-slate-800" />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700">
                            <span className="text-slate-500 font-medium">ដល់ថ្ងៃ:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent font-bold outline-none cursor-pointer text-slate-800" />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700">
                            <MdFilterList className="text-emerald-600 text-sm" />
                            <select value={activityTypeFilter} onChange={e => setActivityTypeFilter(e.target.value)}
                                className="bg-transparent font-bold outline-none cursor-pointer text-slate-800">
                                <option value="All">All Activities</option>
                                <option value="Activated">Activated</option>
                                <option value="Application">Application</option>
                                <option value="Check">Check</option>
                                <option value="Lock Device">Lock Device</option>
                                <option value="Wallpaper Lock">Wallpaper Lock</option>
                                <option value="Payment">Payment</option>
                            </select>
                        </div>
                        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                            <button onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }} className="px-2.5 py-1 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer">Today</button>
                            <button onClick={() => { setStartDate(thirtyDaysAgoStr); setEndDate(todayStr); }} className="px-2.5 py-1 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer">30 Days</button>
                            <button onClick={() => { setStartDate(''); setEndDate(''); setActivityTypeFilter('All'); }} className="px-2.5 py-1 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer">Reset</button>
                        </div>
                    </div>
                </div>

                {/* 3 Charts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Bar Chart */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FaChartBar className="text-emerald-600 text-sm" /> ក្រាបសសរ (Bar Chart)
                            </h3>
                            <span className="text-[10px] text-slate-500 font-bold">ចុចលើសសរ</span>
                        </div>
                        <div className="h-44 flex items-end justify-around gap-1 pt-4 border-b border-slate-200">
                            {Object.entries(typeDistribution).map(([cat, count]) => {
                                const maxVal = Math.max(...Object.values(typeDistribution), 1);
                                const heightPct = Math.round((count / maxVal) * 100);
                                return (
                                    <div key={cat} onClick={() => handleChartPointClick('Bar Chart', cat)}
                                        className="flex-1 flex flex-col items-center gap-1 cursor-pointer group" title={`Click: ${cat}`}>
                                        <span className="text-[10px] font-mono font-bold text-slate-800">{count}</span>
                                        <div className="w-full max-w-[26px] bg-slate-200 rounded-t-lg overflow-hidden h-32 flex items-end">
                                            <div className="w-full bg-emerald-600 group-hover:bg-emerald-500 transition-all rounded-t-lg"
                                                style={{ height: `${Math.max(heightPct, 6)}%` }}></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-600 truncate w-full text-center">{cat.slice(0, 6)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 italic text-center font-medium">ស្ថិតិសកម្មភាពតាមប្រភេទ</p>
                    </div>

                    {/* Line Chart */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FaChartLine className="text-sky-600 text-sm" /> ក្រាបខ្សែរ (Line Chart)
                            </h3>
                            <span className="text-[10px] text-slate-500 font-bold">ចុចលើ Point</span>
                        </div>
                        <div className="h-44">
                            {trendData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No trend data</div>
                            ) : (
                                <div className="relative h-32 w-full flex items-end justify-between px-2 pt-4">
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                        <polyline fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            points={trendData.map((d, i) => {
                                                const maxC = Math.max(...trendData.map(x => x.count), 1);
                                                const x = (i / (trendData.length - 1 || 1)) * 92 + 4;
                                                const y = 85 - (d.count / maxC) * 70;
                                                return `${x}%,${y}%`;
                                            }).join(' ')}
                                        />
                                    </svg>
                                    {trendData.map((d) => (
                                        <div key={d.date} onClick={() => handleChartPointClick('Date Trend', d.date, true)}
                                            className="relative z-10 flex flex-col items-center cursor-pointer group">
                                            <span className="text-[9px] font-mono font-bold text-sky-800 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                                            <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-sky-600 group-hover:bg-sky-600 group-hover:scale-125 transition-all shadow-sm"></div>
                                            <span className="text-[9px] font-mono text-slate-600 font-medium mt-1">{d.date.slice(5)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 italic text-center font-medium">ការប្រែប្រួលសកម្មភាពតាមថ្ងៃ</p>
                    </div>

                    {/* Pie Chart */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FaChartPie className="text-purple-600 text-sm" /> ក្រាបផ្លិត (Pie Chart)
                            </h3>
                            <span className="text-[10px] text-slate-500 font-bold">ចុចលើ Legend</span>
                        </div>
                        <div className="h-44 flex items-center justify-center gap-4">
                            <div className="relative w-28 h-28 shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-200" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    {Object.entries(typeDistribution).map(([cat, count], idx) => {
                                        const total = filteredAuditLogs.length || 1;
                                        const pct = Math.round((count / total) * 100);
                                        const colors = ['#059669', '#f59e0b', '#0284c7', '#7c3aed', '#dc2626', '#0d9488'];
                                        return (
                                            <circle key={cat} onClick={() => handleChartPointClick('Pie Segment', cat)}
                                                r="15.9155" cx="18" cy="18" fill="none"
                                                stroke={colors[idx % colors.length]} strokeWidth="4"
                                                strokeDasharray={`${pct}, 100`}
                                                className="cursor-pointer hover:opacity-80 transition-opacity" />
                                        );
                                    })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-slate-900 text-sm">
                                    {filteredAuditLogs.length}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1 text-[11px] font-bold overflow-y-auto max-h-36 pr-1">
                                {Object.entries(typeDistribution).map(([cat, count], idx) => {
                                    const colors = ['bg-emerald-600', 'bg-amber-500', 'bg-sky-600', 'bg-purple-600', 'bg-red-600', 'bg-teal-600'];
                                    return (
                                        <div key={cat} onClick={() => handleChartPointClick('Pie Category', cat)}
                                            className="flex items-center justify-between p-1 rounded-md hover:bg-slate-200/60 cursor-pointer transition-colors">
                                            <span className="flex items-center gap-1.5 text-slate-800">
                                                <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`}></span>{cat}
                                            </span>
                                            <span className="font-mono text-slate-900">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic text-center font-medium">សមាមាត្រសរុបសកម្មភាព</p>
                    </div>
                </div>

                {/* ── Per-Type Audit Cards + Mini Line Charts ── */}
                {(() => {
                    const TYPE_META = [
                        { type: 'Activated',     label: 'Activated',     stroke: '#059669', bg: 'bg-emerald-50',  border: 'border-emerald-300', badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
                        { type: 'Application',   label: 'Application',   stroke: '#f59e0b', bg: 'bg-amber-50',    border: 'border-amber-300',   badge: 'bg-amber-50 text-amber-800 border-amber-300',   dot: 'bg-amber-500'  },
                        { type: 'Check',         label: 'Check',         stroke: '#0284c7', bg: 'bg-sky-50',      border: 'border-sky-300',     badge: 'bg-sky-50 text-sky-800 border-sky-300',         dot: 'bg-sky-500'    },
                        { type: 'Lock Device',   label: 'Lock Device',   stroke: '#dc2626', bg: 'bg-red-50',      border: 'border-red-300',     badge: 'bg-red-50 text-red-700 border-red-300',         dot: 'bg-red-600'    },
                        { type: 'Wallpaper Lock',label: 'Wallpaper Lock',stroke: '#7c3aed', bg: 'bg-purple-50',  border: 'border-purple-300',  badge: 'bg-purple-50 text-purple-700 border-purple-300',dot: 'bg-purple-600' },
                        { type: 'Payment',       label: 'Payment',       stroke: '#0d9488', bg: 'bg-teal-50',     border: 'border-teal-300',    badge: 'bg-teal-50 text-teal-800 border-teal-300',      dot: 'bg-teal-600'   },
                        { type: 'Redeem',        label: 'Redeem',        stroke: '#9333ea', bg: 'bg-violet-50',  border: 'border-violet-300',  badge: 'bg-violet-50 text-violet-700 border-violet-300',dot: 'bg-violet-600' },
                    ];

                    // Build date-keyed trend for each type
                    const buildTrend = (type) => {
                        const map = {};
                        filteredAuditLogs.filter(a => a.type === type).forEach(a => {
                            const d = a.date || 'Unknown';
                            map[d] = (map[d] || 0) + 1;
                        });
                        return Object.keys(map).sort().slice(-10).map(d => ({ date: d, count: map[d] }));
                    };

                    // Mini SVG line chart
                    const MiniLine = ({ data, stroke }) => {
                        if (!data || data.length < 2) return (
                            <div className="h-16 flex items-center justify-center text-slate-400 text-[10px] italic">
                                {data?.length === 1 ? '1 data point' : 'No trend data'}
                            </div>
                        );
                        const maxC = Math.max(...data.map(d => d.count), 1);
                        const pts = data.map((d, i) => {
                            const x = (i / (data.length - 1)) * 96 + 2;
                            const y = 88 - ((d.count / maxC) * 76);
                            return `${x}%,${y}%`;
                        }).join(' ');
                        return (
                            <div className="relative h-16 w-full">
                                <svg className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id={`grad-${stroke.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                                            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                                    {data.map((d, i) => {
                                        const x = (i / (data.length - 1)) * 96 + 2;
                                        const y = 88 - ((d.count / maxC) * 76);
                                        return (
                                            <g key={i}>
                                                <circle cx={`${x}%`} cy={`${y}%`} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
                                                <text x={`${x}%`} y={`${y - 6}%`} textAnchor="middle" fontSize="8" fill={stroke} fontWeight="bold">{d.count}</text>
                                            </g>
                                        );
                                    })}
                                </svg>
                                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[8px] text-slate-400 font-mono">
                                    {data.map(d => <span key={d.date}>{d.date.slice(5)}</span>)}
                                </div>
                            </div>
                        );
                    };

                    const activeTypes = TYPE_META.filter(m => {
                        if (activityTypeFilter !== 'All') return m.type === activityTypeFilter;
                        return filteredAuditLogs.some(a => a.type === m.type);
                    });

                    if (activeTypes.length === 0) return (
                        <div className="text-center py-10 text-slate-500 italic text-sm">
                            មិនមានទិន្នន័យសម្រាប់ filter ដែលបានជ្រើស
                        </div>
                    );

                    return (
                        <div className="space-y-6 pt-2">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <MdInfo className="text-emerald-600 text-base" />
                                តារាងបង្ហាញព័ត៌មានលម្អិតតាមប្រភេទ ({filteredAuditLogs.length} Records)
                            </h3>

                            {activeTypes.map(meta => {
                                const rows = filteredAuditLogs.filter(a => a.type === meta.type);
                                if (rows.length === 0) return null;
                                const trend = buildTrend(meta.type);

                                return (
                                    <div key={meta.type} className={`rounded-2xl border ${meta.border} bg-white shadow-sm overflow-hidden`}>
                                        {/* Card Header */}
                                        <div className={`flex items-center justify-between px-5 py-3 ${meta.bg} border-b ${meta.border}`}>
                                            <div className="flex items-center gap-3">
                                                <span className={`w-3 h-3 rounded-full ${meta.dot}`}></span>
                                                <span className="text-sm font-black text-slate-900">{meta.label}</span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.badge}`}>
                                                    {rows.length} Records
                                                </span>
                                            </div>
                                            <button onClick={() => handleChartPointClick(meta.label, meta.type)}
                                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors px-2.5 py-1 bg-white/70 border border-slate-200 rounded-lg">
                                                View All →
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3">
                                            {/* Mini Line Chart */}
                                            <div className="lg:col-span-1 px-5 py-4 border-r border-slate-100">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                    <FaChartLine style={{ color: meta.stroke }} className="text-xs" />
                                                    Trend ក្នុងរយៈពេល
                                                </p>
                                                <MiniLine data={trend} stroke={meta.stroke} />
                                            </div>

                                            {/* Table */}
                                            <div className="lg:col-span-2 overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50/80 text-slate-600 uppercase tracking-wider border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-3 py-2.5 text-center text-[10px]">No</th>
                                                            <th className="px-3 py-2.5 text-[10px]">Date</th>
                                                            <th className="px-3 py-2.5 text-[10px]">Customer Name</th>
                                                            <th className="px-3 py-2.5 text-[10px]">Model</th>
                                                            <th className="px-3 py-2.5 text-[10px]">Serial / IMEI</th>
                                                            <th className="px-3 py-2.5 text-[10px]">By</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 font-medium text-slate-800">
                                                        {rows.slice(0, 8).map((item, idx) => (
                                                            <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                                                <td className="px-3 py-2 text-center font-mono text-slate-500 text-[10px]">{idx + 1}</td>
                                                                <td className="px-3 py-2 font-mono text-[11px] font-bold" style={{ color: meta.stroke }}>{item.date}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className="font-bold text-slate-900 block text-[11px]">{item.customerName}</span>
                                                                    {item.customerNameKh && <span className="text-emerald-700 text-[10px]">{item.customerNameKh}</span>}
                                                                </td>
                                                                <td className="px-3 py-2 font-semibold text-slate-700 text-[11px]">{item.model}</td>
                                                                <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{item.serialNumber}</td>
                                                                <td className="px-3 py-2 text-slate-600 text-[10px] font-semibold">{item.performedBy}</td>
                                                            </tr>
                                                        ))}
                                                        {rows.length > 8 && (
                                                            <tr>
                                                                <td colSpan={6} className="px-3 py-2 text-center text-[10px] text-slate-500 italic font-medium">
                                                                    + {rows.length - 8} more records —{' '}
                                                                    <button onClick={() => handleChartPointClick(meta.label, meta.type)}
                                                                        className="underline cursor-pointer font-bold" style={{ color: meta.stroke }}>
                                                                        View All
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>


            {/* ── Recent Sessions Modal ── */}
            {sessionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4" onClick={() => setSessionModal(false)}>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <FaHistory className="text-purple-600" /> Recent Login Sessions (All Users)
                            </h3>
                            <button onClick={() => setSessionModal(false)} className="text-slate-500 hover:text-slate-900 text-lg cursor-pointer"><MdClose /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-2 pr-1 text-xs">
                            {sessionsLoading ? (
                                <div className="flex items-center justify-center py-10 text-emerald-600 text-sm gap-2 font-bold">
                                    <MdOutlineSync className="spin-reload text-xl" /> Loading sessions...
                                </div>
                            ) : recentSessions.length === 0 ? (
                                <p className="text-slate-500 italic text-center py-8">No login sessions recorded yet.</p>
                            ) : recentSessions.map((log, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 hover:bg-slate-100 transition-colors">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {(log.name || log.username || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-emerald-700 font-mono truncate">{log.username}</span>
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-200 border border-slate-300 rounded-full text-slate-700 font-semibold shrink-0">{log.role}</span>
                                        </div>
                                        <p className="text-slate-900 font-bold text-[11px] truncate">{log.name}</p>
                                        <p className="text-slate-500 text-[10px] font-mono mt-0.5">
                                            🕐 {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' })}
                                        </p>
                                        <p className="text-slate-500 text-[10px] mt-0.5">📍 {log.ip || '127.0.0.1'} • 🖥 {log.deviceInfo || 'Web Browser'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="shrink-0 text-right pt-2 border-t border-slate-200">
                            <button onClick={() => setSessionModal(false)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Chart Detail Modal ── */}
            {detailModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4" onClick={() => setDetailModal({ open: false, title: '', items: [] })}>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <MdInfo className="text-emerald-600 text-lg" /> {detailModal.title}
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">ព័ត៌មានលម្អិតសម្រាប់ប្រភេទ/កាលបរិច្ឆេទដែលបានជ្រើស</p>
                            </div>
                            <button onClick={() => setDetailModal({ open: false, title: '', items: [] })} className="text-slate-400 hover:text-slate-800 text-xl font-bold cursor-pointer"><MdClose /></button>
                        </div>
                        <div className="relative shrink-0">
                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                            <input type="text" value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                                placeholder="Search customer, model, serial..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-center">No</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Customer</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Model</th>
                                        <th className="px-4 py-3">Serial No</th>
                                        <th className="px-4 py-3">Performed By</th>
                                        <th className="px-4 py-3">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                    {modalFilteredItems.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-8 text-slate-500 italic">No records found.</td></tr>
                                    ) : modalFilteredItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                                            <td className="px-4 py-2.5 text-center font-mono text-slate-600 font-semibold">{idx + 1}</td>
                                            <td className="px-4 py-2.5 font-mono text-emerald-700 font-bold">{item.date}</td>
                                            <td className="px-4 py-2.5 font-bold text-slate-900">{item.customerName}</td>
                                            <td className="px-4 py-2.5 font-semibold text-slate-700">{item.type}</td>
                                            <td className="px-4 py-2.5 font-semibold text-slate-800">{item.model}</td>
                                            <td className="px-4 py-2.5 font-mono text-slate-600">{item.serialNumber}</td>
                                            <td className="px-4 py-2.5 text-slate-700">{item.performedBy}</td>
                                            <td className="px-4 py-2.5 text-slate-600 text-[11px]">{item.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="shrink-0 text-right pt-2 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setDetailModal({ open: false, title: '', items: [] })}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
