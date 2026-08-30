import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    MdDashboard, MdOutlineSync, MdCheckCircle,
    MdTrendingUp, MdPeople, MdBarChart, MdClose,
    MdDateRange, MdFilterList, MdInfo
} from 'react-icons/md';
import { IoMdWallet } from 'react-icons/io';
import { FaLock, FaChartPie, FaLayerGroup, FaHistory, FaChartLine, FaChartBar, FaSearch } from 'react-icons/fa';
import LineChart from '../../components/LineChart';

const Dashboard = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    // ── Master Admin Check ──
    const isMasterAdmin = useMemo(() => {
        return user?.username === '@hakyonghouv' || user?.username === 'hakyonghouv' || user?.role === 'Administrator' || user?.isImmutable;
    }, [user]);

    // ── State Management ──
    const [stats, setStats] = useState({
        totalContracts: 0, activatedContracts: 0, applicationContracts: 0,
        checkContracts: 0, redeemContracts: 0, commentsContracts: 0,
        blacklistContracts: 0, lockedPhones: 0, unlockedPhones: 0,
        lockedWallpapers: 0, unlockedWallpapers: 0, totalRevenue: 0, paymentCount: 0,
        totalLoanAmount: 0, totalCustomerReceived: 0, totalBorrowers: 0, outstandingBalance: 0
    });

    const [timeRange, setTimeRange] = useState('monthly'); // 'daily', 'monthly', 'yearly', 'all'
    const [brandFilter, setBrandFilter] = useState('');
    const [brandsList, setBrandsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    // Active Brand Filter Scope
    const activeUserBrand = useMemo(() => {
        if (!isMasterAdmin && user?.brand) return user.brand;
        return brandFilter;
    }, [isMasterAdmin, user, brandFilter]);

    // Audit & Activity State
    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [rawContracts, setRawContracts] = useState([]);
    const [rawPayments, setRawPayments] = useState([]);
    const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [activityTypeFilter, setActivityTypeFilter] = useState('All');
    const [allActivities, setAllActivities] = useState([]);

    // Modals
    const [sessionModal, setSessionModal] = useState(false);
    const [recentSessions, setRecentSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [detailModal, setDetailModal] = useState({ open: false, title: '', items: [] });
    const [detailSearch, setDetailSearch] = useState('');

    // ── API Fetchers ──
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
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');

            const res = await fetch(`${API_BASE}/dashboard/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');
            params.set('limit', '999999');

            const [cRes, pRes] = await Promise.all([
                fetch(`${API_BASE1}/contracts?${params.toString()}`),
                fetch(`${API_BASE1}/payments?${params.toString()}`)
            ]);

            const toDate = (raw) => {
                if (!raw) return todayStr;
                const s = String(raw);
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                const d = new Date(s);
                if (!isNaN(d)) return d.toISOString().split('T')[0];
                return todayStr;
            };

            const logs = [];
            if (cRes.ok) {
                const cData = await cRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                setRawContracts(contracts);
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
                setRawPayments(payments);
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
            console.error('Failed to fetch audit logs:', err);
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
                    if (!isMasterAdmin && u.username !== user?.username) return;
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

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        fetchDashboardStats();
        fetchAuditLogs();
    }, [activeUserBrand]);

    const handleOpenSessions = () => { setSessionModal(true); fetchRecentSessions(); };

    // ── Computed Filtered Data ──
    const filteredAuditLogs = useMemo(() => {
        return allActivities.filter(act => {
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

    // Percentage Calculations
    const activatedPct = stats.totalContracts ? Math.round((stats.activatedContracts / stats.totalContracts) * 100) : 0;
    const applicationPct = stats.totalContracts ? Math.round((stats.applicationContracts / stats.totalContracts) * 100) : 0;
    const checkPct = stats.totalContracts ? Math.round((stats.checkContracts / stats.totalContracts) * 100) : 0;
    const redeemPct = stats.totalContracts ? Math.round((stats.redeemContracts / stats.totalContracts) * 100) : 0;
    const blacklistPct = stats.totalContracts ? Math.round((stats.blacklistContracts / stats.totalContracts) * 100) : 0;
    const phoneLockPct = stats.totalContracts ? Math.round((stats.lockedPhones / stats.totalContracts) * 100) : 0;
    const wallpaperLockPct = stats.totalContracts ? Math.round((stats.lockedWallpapers / stats.totalContracts) * 100) : 0;

    // Financial Metrics
    const customerReceivedAmt = stats.totalCustomerReceived || 0;
    const loanOutAmt = stats.totalLoanAmount || 0;
    const weCollectedAmt = stats.totalRevenue || 0;
    const totalBorrowers = stats.totalBorrowers || stats.totalContracts || 0;
    const netProfitLoss = weCollectedAmt - customerReceivedAmt;
    const outstandingBal = stats.outstandingBalance || 0;
    const profitPct = customerReceivedAmt > 0 ? ((netProfitLoss / customerReceivedAmt) * 100).toFixed(1) : '0.0';
    const collectionPct = customerReceivedAmt > 0 ? Math.round((weCollectedAmt / customerReceivedAmt) * 100) : 0;
    const isProfit = netProfitLoss >= 0;

    // Bar Chart Comparative Data
    const barChartData = useMemo(() => {
        const filteredContracts = rawContracts;
        const filteredPayments = rawPayments;

        const toDateStr = (raw) => {
            if (!raw) return todayStr;
            const s = String(raw);
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            const d = new Date(s);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
            return todayStr;
        };

        if (timeRange === 'daily') {
            const daysMap = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const key = d.toISOString().split('T')[0];
                const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
                daysMap[key] = { label, dateKey: key, revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 };
            }

            filteredContracts.forEach(c => {
                const dKey = toDateStr(c.inputDate || c.createdAt);
                if (daysMap[dKey]) {
                    if (c.status === 'Activated') {
                        daysMap[dKey].entry += 1;
                        daysMap[dKey].loan += (Number(c.amount) || 0);
                        daysMap[dKey].customerReceived += (Number(c.monthlyPayment) || 0);
                    } else if (c.status === 'Redeem') {
                        daysMap[dKey].exit += 1;
                    }
                }
            });

            filteredPayments.forEach(p => {
                const dKey = toDateStr(p.paidDate || p.paymentDate || p.createdAt);
                if (daysMap[dKey]) {
                    daysMap[dKey].revenue += (Number(p.amount) || 0);
                }
            });

            return Object.values(daysMap).map(d => ({
                ...d,
                profit: d.revenue - d.customerReceived
            }));

        } else if (timeRange === 'monthly') {
            const monthMap = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                monthMap[mKey] = { label, monthKey: mKey, revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 };
            }

            filteredContracts.forEach(c => {
                const dKey = toDateStr(c.inputDate || c.createdAt).slice(0, 7);
                if (monthMap[dKey]) {
                    if (c.status === 'Activated') {
                        monthMap[dKey].entry += 1;
                        monthMap[dKey].loan += (Number(c.amount) || 0);
                        monthMap[dKey].customerReceived += (Number(c.monthlyPayment) || 0);
                    } else if (c.status === 'Redeem') {
                        monthMap[dKey].exit += 1;
                    }
                }
            });

            filteredPayments.forEach(p => {
                const dKey = toDateStr(p.paidDate || p.paymentDate || p.createdAt).slice(0, 7);
                if (monthMap[dKey]) {
                    monthMap[dKey].revenue += (Number(p.amount) || 0);
                }
            });

            return Object.values(monthMap).map(m => ({
                ...m,
                profit: m.revenue - m.customerReceived
            }));

        } else if (timeRange === 'yearly') {
            const yearMap = {};
            const curYear = new Date().getFullYear();
            [curYear - 2, curYear - 1, curYear].forEach(yr => {
                const yKey = String(yr);
                yearMap[yKey] = { label: yKey, yearKey: yKey, revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 };
            });

            filteredContracts.forEach(c => {
                const yKey = toDateStr(c.inputDate || c.createdAt).slice(0, 4);
                if (yearMap[yKey]) {
                    if (c.status === 'Activated') {
                        yearMap[yKey].entry += 1;
                        yearMap[yKey].loan += (Number(c.amount) || 0);
                        yearMap[yKey].customerReceived += (Number(c.monthlyPayment) || 0);
                    } else if (c.status === 'Redeem') {
                        yearMap[yKey].exit += 1;
                    }
                }
            });

            filteredPayments.forEach(p => {
                const yKey = toDateStr(p.paidDate || p.paymentDate || p.createdAt).slice(0, 4);
                if (yearMap[yKey]) {
                    yearMap[yKey].revenue += (Number(p.amount) || 0);
                }
            });

            return Object.values(yearMap).map(y => ({
                ...y,
                profit: y.revenue - y.customerReceived
            }));

        } else {
            const yearMap = {};
            filteredContracts.forEach(c => {
                const yKey = toDateStr(c.inputDate || c.createdAt).slice(0, 4);
                if (!yearMap[yKey]) {
                    yearMap[yKey] = { label: yKey, yearKey: yKey, revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 };
                }
                if (c.status === 'Activated') {
                    yearMap[yKey].entry += 1;
                    yearMap[yKey].loan += (Number(c.amount) || 0);
                    yearMap[yKey].customerReceived += (Number(c.monthlyPayment) || 0);
                } else if (c.status === 'Redeem') {
                    yearMap[yKey].exit += 1;
                }
            });

            filteredPayments.forEach(p => {
                const yKey = toDateStr(p.paidDate || p.paymentDate || p.createdAt).slice(0, 4);
                if (!yearMap[yKey]) {
                    yearMap[yKey] = { label: yKey, yearKey: yKey, revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 };
                }
                yearMap[yKey].revenue += (Number(p.amount) || 0);
            });

            const sortedYears = Object.keys(yearMap).sort();
            if (sortedYears.length === 0) {
                return [{ label: 'All Time', dateKey: 'all', revenue: 0, loan: 0, customerReceived: 0, profit: 0, entry: 0, exit: 0 }];
            }

            return sortedYears.map(y => ({
                ...yearMap[y],
                profit: yearMap[y].revenue - yearMap[y].customerReceived
            }));
        }
    }, [timeRange, rawContracts, rawPayments, todayStr]);

    // Summary Breakdown Table Data
    const summaryTableData = useMemo(() => {
        const brandMap = {};

        rawContracts.forEach(c => {
            const b = c.brand || 'General / MDM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalContracts: 0,
                    activatedCount: 0,
                    loanDisbursed: 0,
                    monthlyCollectionEst: 0,
                    phoneLocked: 0,
                    wallpaperLocked: 0,
                    revenueCollected: 0
                };
            }
            brandMap[b].totalContracts += 1;
            if (c.status === 'Activated') {
                brandMap[b].activatedCount += 1;
                brandMap[b].loanDisbursed += (Number(c.amount) || 0);
                brandMap[b].monthlyCollectionEst += (Number(c.monthlyPayment) || 0);
            }
            if (c.lockPhoneStatus === 'Locked') brandMap[b].phoneLocked += 1;
            if (c.lockWallpaperStatus === 'Locked') brandMap[b].wallpaperLocked += 1;
        });

        const cBrandLookup = {};
        rawContracts.forEach(c => { if (c.contractId) cBrandLookup[c.contractId] = c.brand || 'General / MDM'; });

        rawPayments.forEach(p => {
            const b = p.brand || cBrandLookup[p.contractId] || 'General / MDM';
            if (brandMap[b]) {
                brandMap[b].revenueCollected += (Number(p.amount) || 0);
            }
        });

        return Object.values(brandMap);
    }, [rawContracts, rawPayments]);

    const modalFilteredItems = useMemo(() => {
        if (!detailSearch.trim()) return detailModal.items;
        const q = detailSearch.toLowerCase();
        return detailModal.items.filter(i =>
            i.customerName?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q) ||
            i.serialNumber?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q)
        );
    }, [detailModal.items, detailSearch]);

    return (
        <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 select-none font-sans text-slate-900">

            {/* ── 1. Top Executive Header Bar ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl font-bold border border-emerald-500/20">
                            <MdDashboard />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                {t('dashboard')}
                            </h1>
                            <p className="text-xs text-slate-600 font-semibold">Executive Analytics • Financial Intelligence &amp; System Health</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Brand Scope Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700">
                        <FaLayerGroup className="text-emerald-600 text-xs" />
                        {isMasterAdmin && brandsList.length > 0 ? (
                            <select
                                value={brandFilter}
                                onChange={e => setBrandFilter(e.target.value)}
                                className="bg-transparent text-slate-900 font-bold outline-none cursor-pointer pr-1"
                            >
                                <option value="">🌐 All Brands</option>
                                {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        ) : (
                            <span className="text-emerald-700 font-bold font-mono">
                                🏢 {user?.brand || 'Default Brand'}
                            </span>
                        )}
                    </div>

                    {/* Period Filter Buttons */}
                    <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold">
                        {[
                            ['daily', t('daily')],
                            ['monthly', t('monthly')],
                            ['yearly', t('yearly')],
                            ['all', t('allTime')]
                        ].map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setTimeRange(val)}
                                className={`px-3 py-1.5 rounded-xl cursor-pointer font-bold transition-all ${timeRange === val
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Sessions & Reload */}
                    <button
                        onClick={handleOpenSessions}
                        className="flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-2xl text-xs font-bold cursor-pointer transition-all shadow-2xs"
                    >
                        <FaHistory className="text-xs" /> <span>Sessions</span>
                    </button>
                    <button
                        onClick={fetchDashboardStats}
                        disabled={reloading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                    >
                        <MdOutlineSync className={`text-base ${reloading ? 'spin-reload text-emerald-400' : ''}`} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </div>

            {/* ── 2. Executive Financial Scorecard (4 Hero KPI Cards) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Loan Disbursed */}
                <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3 relative overflow-hidden group hover:border-blue-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('totalLoanDisbursed')}</span>
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform">
                            <IoMdWallet />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black font-mono text-slate-900">${loanOutAmt.toLocaleString()}</div>
                        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{t('totalLoanDisbursed')}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                        <span>{t('totalBorrowers')}: <strong className="text-slate-900 font-mono">{totalBorrowers}</strong></span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold rounded-full border border-blue-200">LOAN</span>
                    </div>
                </div>

                {/* Card 2: Revenue Collected */}
                <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3 relative overflow-hidden group hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('totalRevenueCollected')}</span>
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform">
                            <MdTrendingUp />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black font-mono text-emerald-600">${weCollectedAmt.toLocaleString()}</div>
                        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{t('totalRevenueCollected')} ({collectionPct}%)</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                        <span>{t('totalTransactions')}: <strong className="text-slate-900 font-mono">{stats.paymentCount}</strong></span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono font-bold rounded-full border border-emerald-200">{collectionPct}%</span>
                    </div>
                </div>

                {/* Card 3: Net Profit / Loss */}
                <div className={`p-6 bg-white border rounded-3xl shadow-xs space-y-3 relative overflow-hidden group transition-all ${isProfit ? 'hover:border-teal-300' : 'hover:border-rose-300'}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('netProfitLoss')}</span>
                        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform ${isProfit ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            <MdBarChart />
                        </div>
                    </div>
                    <div>
                        <div className={`text-2xl font-black font-mono ${isProfit ? 'text-teal-600' : 'text-rose-600'}`}>
                            {isProfit ? '+' : '-'}${Math.abs(netProfitLoss).toLocaleString()}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{t('marginRatio')}: {profitPct}%</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                        <span>{t('status')}: <strong className={isProfit ? 'text-teal-700 font-bold' : 'text-rose-700 font-bold'}>{isProfit ? 'Net Profit' : 'Net Loss'}</strong></span>
                        <span className={`px-2 py-0.5 font-mono font-bold rounded-full border ${isProfit ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isProfit ? '▲' : '▼'} {profitPct}%
                        </span>
                    </div>
                </div>

                {/* Card 4: Outstanding Balance */}
                <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3 relative overflow-hidden group hover:border-amber-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('outstandingReceivables')}</span>
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform">
                            <FaLock />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black font-mono text-amber-600">${outstandingBal.toLocaleString()}</div>
                        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{t('outstandingReceivables')}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                        <span>{t('phoneLockCol')}: <strong className="text-rose-600 font-mono">{stats.lockedPhones}</strong></span>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-mono font-bold rounded-full border border-amber-200">Active</span>
                    </div>
                </div>
            </div>

            {/* ── 3. Dual Main Charts: Interactive Bar Chart & Donut Distribution ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bar Chart (Left 2 Columns) */}
                <div className="lg:col-span-2 p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <FaChartBar className="text-emerald-600 text-lg" />
                                {t('barChartTitle')} ({timeRange.toUpperCase()})
                            </h2>
                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                                {t('barChartSubtitle')}
                            </p>
                        </div>

                        {/* Chart Legend */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                            <span className="flex items-center gap-1.5 text-emerald-700">
                                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> {t('revenueCollectedLegend')}
                            </span>
                            <span className="flex items-center gap-1.5 text-blue-700">
                                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span> {t('loanDisbursedLegend')}
                            </span>
                            <span className="flex items-center gap-1.5 text-indigo-700">
                                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span> {t('activatedEntryLegend')}
                            </span>
                        </div>
                    </div>

                    {/* Chart Container with Left Y-Axis & Horizontal Gridlines */}
                    {(() => {
                        const maxBarVal = Math.max(...barChartData.map(b => Math.max(b.revenue, b.loan, 1)));
                        const yTicks = [1, 0.75, 0.5, 0.25, 0].map(ratio => Math.round(maxBarVal * ratio));

                        return (
                            <div className="flex items-stretch gap-3">
                                {/* Left Y-Axis Numbers */}
                                <div className="flex flex-col justify-between items-end pb-7 text-[10px] font-mono text-slate-500 font-bold select-none w-14 shrink-0">
                                    {yTicks.map((val, i) => (
                                        <span key={i}>
                                            ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                        </span>
                                    ))}
                                </div>

                                {/* Main Chart Area */}
                                <div className="flex-1 relative bg-slate-50/60 rounded-2xl p-4 border border-slate-100 min-h-[300px] flex flex-col justify-between">
                                    {/* Horizontal Gridlines */}
                                    <div className="absolute inset-x-4 inset-y-4 flex flex-col justify-between pointer-events-none pb-7">
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <div key={i} className="w-full border-t border-dashed border-slate-200" />
                                        ))}
                                    </div>

                                    {/* Bars Columns */}
                                    <div className="h-64 w-full flex items-end justify-around gap-3 pt-4 pb-7 overflow-x-auto relative z-10">
                                        {barChartData.map((item, idx) => {
                                            const revPct = Math.min(100, Math.round((item.revenue / maxBarVal) * 100));
                                            const loanPct = Math.min(100, Math.round((item.loan / maxBarVal) * 100));
                                            return (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative cursor-pointer">
                                                    {/* Rich Hover Tooltip */}
                                                    <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col bg-slate-900 text-white text-[11px] p-3.5 rounded-2xl shadow-2xl z-30 min-w-[210px] pointer-events-none transition-all border border-slate-700 space-y-1">
                                                        <div className="font-bold border-b border-slate-700 pb-1 text-emerald-400 font-mono text-xs flex justify-between items-center">
                                                            <span>{item.label}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase font-sans">{timeRange}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-emerald-300 font-mono text-[11px]">
                                                            <span>🟢 Revenue Collected:</span>
                                                            <span className="font-bold">${item.revenue.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-blue-300 font-mono text-[11px]">
                                                            <span>🔵 Loan Disbursed:</span>
                                                            <span className="font-bold">${item.loan.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-indigo-300 font-mono text-[11px]">
                                                            <span>👤 Activated Entry:</span>
                                                            <span className="font-bold">{item.entry} នាក់</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-purple-300 font-mono text-[11px]">
                                                            <span>🔄 Exit Customers:</span>
                                                            <span className="font-bold">{item.exit} នាក់</span>
                                                        </div>
                                                    </div>

                                                    {/* Amount Badge */}
                                                    {item.revenue > 0 && (
                                                        <span className="text-[9px] font-bold font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shadow-2xs">
                                                            ${item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(1)}k` : item.revenue}
                                                        </span>
                                                    )}

                                                    {/* Bars */}
                                                    <div className="w-full flex items-end justify-center gap-1.5 h-[75%]">
                                                        <div
                                                            style={{ height: `${Math.max(8, revPct)}%` }}
                                                            className="w-full max-w-[14px] bg-emerald-500 rounded-t-md transition-all group-hover:scale-105 group-hover:bg-emerald-400 shadow-2xs"
                                                        />
                                                        <div
                                                            style={{ height: `${Math.max(8, loanPct)}%` }}
                                                            className="w-full max-w-[14px] bg-blue-500 rounded-t-md transition-all group-hover:scale-105 group-hover:bg-blue-400 shadow-2xs"
                                                        />
                                                    </div>

                                                    {/* X-Axis Label */}
                                                    <span className="absolute bottom-0 text-[10px] font-bold text-slate-700 font-mono truncate max-w-full">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Donut Chart (Right 1 Column) */}
                <div className="lg:col-span-1 p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h3 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                            <FaChartPie className="text-purple-600 text-lg" />
                            សមាមាត្រកិច្ចសន្យា (Status Donut)
                        </h3>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-4 pt-1">
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100" strokeWidth="3.8" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-emerald-500" strokeDasharray={`${activatedPct}, 100`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-amber-500" strokeDasharray={`${applicationPct}, 100`} strokeDashoffset={`-${activatedPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-sky-500" strokeDasharray={`${checkPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-purple-500" strokeDasharray={`${redeemPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-rose-500" strokeDasharray={`${blacklistPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct + redeemPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalContracts}</span>
                                <span className="text-[10px] uppercase text-slate-600 font-bold">Total</span>
                            </div>
                        </div>

                        <div className="w-full space-y-1.5 text-xs font-bold">
                            {[
                                { label: t('activated'), count: stats.activatedContracts, pct: activatedPct, color: 'bg-emerald-500', text: 'text-emerald-800', bg: 'bg-emerald-50/70 border-emerald-200' },
                                { label: t('application'), count: stats.applicationContracts, pct: applicationPct, color: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50/70 border-amber-200' },
                                { label: t('check'), count: stats.checkContracts, pct: checkPct, color: 'bg-sky-500', text: 'text-sky-800', bg: 'bg-sky-50/70 border-sky-200' },
                                { label: t('redeem'), count: stats.redeemContracts, pct: redeemPct, color: 'bg-purple-500', text: 'text-purple-800', bg: 'bg-purple-50/70 border-purple-200' },
                                { label: 'Blacklist', count: stats.blacklistContracts, pct: blacklistPct, color: 'bg-rose-500', text: 'text-rose-800', bg: 'bg-rose-50/70 border-rose-200' },
                            ].map(item => (
                                <div key={item.label} className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${item.bg}`}>
                                    <span className={`flex items-center gap-2 ${item.text}`}>
                                        <span className={`w-2 h-2 rounded-full ${item.color}`}></span>{item.label}
                                    </span>
                                    <span className="font-mono text-slate-900 font-bold">{item.count} <span className="text-slate-600 text-[10px]">({item.pct}%)</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4. Operational & Security Health Status ── */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
                <h3 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                    <MdBarChart className="text-emerald-600 text-lg" />
                    សុវត្ថិភាពឧបករណ៍ &amp; ស្ថានភាពគ្រប់គ្រង (Security &amp; MDM Control Ratio)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                    {/* Phone Lock Status */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-slate-700">Phone Remote Lock Ratio</span>
                            <span className="text-rose-600 font-mono">{stats.lockedPhones} Locked / {stats.unlockedPhones} Unlocked</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                            <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${phoneLockPct}%` }} />
                            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${100 - phoneLockPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                            <span className="text-rose-600 font-bold">Locked ({phoneLockPct}%)</span>
                            <span className="text-emerald-600 font-bold">Unlocked ({100 - phoneLockPct}%)</span>
                        </div>
                    </div>

                    {/* Wallpaper Lock Status */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-slate-700">Lockscreen Wallpaper Control</span>
                            <span className="text-purple-600 font-mono">{stats.lockedWallpapers} Active</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div className="h-full bg-purple-500 transition-all duration-500 rounded-full" style={{ width: `${wallpaperLockPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                            <span className="text-purple-600 font-bold">Wallpaper Enforced ({wallpaperLockPct}%)</span>
                            <span>{stats.unlockedWallpapers} Standard</span>
                        </div>
                    </div>

                    {/* Avg Transaction Value */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-slate-700">Average Collection / Transaction</span>
                            <span className="text-emerald-600 font-mono font-bold">${stats.paymentCount ? (stats.totalRevenue / stats.paymentCount).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${Math.min(stats.paymentCount * 4, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                            <span>{stats.paymentCount} Completed Payments</span>
                            <span className="text-emerald-600 font-bold">Per Txn Avg</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 5. Trend Line Chart (Revenue & Loan Trend) ── */}
            <LineChart
                title="ក្រាបខ្សែនិន្នាការហិរញ្ញវត្ថុ (Financial Trend Line Chart)"
                subtitle="បង្ហាញពីការប្រែប្រួលទឹកប្រាក់ប្រមូល ឥណទាន និងចំនួន Activated តាមពេលវេលា"
                data={barChartData.map(d => ({ label: d.label, revenue: d.revenue, loan: d.loan, entry: d.entry, exit: d.exit }))}
                series={[
                    { key: 'revenue', label: 'ប្រាក់ប្រមូលបាន ($)', color: '#10b981', isCurrency: true },
                    { key: 'loan', label: 'ឥណទានចេញ ($)', color: '#3b82f6', isCurrency: true },
                    { key: 'entry', label: 'Activated (នាក់)', color: '#a855f7', isCurrency: false },
                    { key: 'exit', label: 'Redeem (នាក់)', color: '#f43f5e', isCurrency: false }
                ]}
                timeFilterOptions={['7d', '30d', 'monthly', 'all']}
                defaultFilter={timeRange === 'daily' ? '7d' : timeRange === 'monthly' ? 'monthly' : 'all'}
                height={300}
            />

            {/* ── 5. Custom Date Audit & Interactive Activity Analytics ── */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                            <MdDateRange className="text-emerald-600 text-xl" />
                            <span>សកម្មភាព និងការត្រួតពិនិត្យ (Custom Date Audit Log)</span>
                        </h2>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">ជ្រើសរើសចន្លោះកាលបរិច្ឆេទដើម្បីពិនិត្យសកម្មភាពលម្អិត</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700">
                            <span className="text-slate-600 font-semibold">ពី:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer text-slate-800" />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700">
                            <span className="text-slate-600 font-semibold">ដល់:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer text-slate-800" />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700">
                            <MdFilterList className="text-emerald-600" />
                            <select value={activityTypeFilter} onChange={e => setActivityTypeFilter(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer text-slate-800">
                                <option value="All">All Activities</option>
                                <option value="Activated">Activated</option>
                                <option value="Application">Application</option>
                                <option value="Check">Check</option>
                                <option value="Lock Device">Lock Device</option>
                                <option value="Wallpaper Lock">Wallpaper Lock</option>
                                <option value="Payment">Payment</option>
                            </select>
                        </div>
                        <button onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer">Today</button>
                        <button onClick={() => { setStartDate(thirtyDaysAgoStr); setEndDate(todayStr); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer">30 Days</button>
                    </div>
                </div>

                {/* 3 Visual Mini Audit Charts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Bar breakdown with Y-Axis + Gridlines + Hover Tooltip */}
                    <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <FaChartBar className="text-emerald-600" /> តាមប្រភេទ (Bar)
                            </h4>
                            <span className="text-[10px] text-slate-600 font-bold">ចុចលើសសរ</span>
                        </div>
                        {(() => {
                            const maxMiniBar = Math.max(...Object.values(typeDistribution), 1);
                            const miniTicks = [1, 0.66, 0.33, 0].map(r => Math.round(maxMiniBar * r));
                            return (
                                <div className="flex items-stretch gap-2">
                                    {/* Y-Axis */}
                                    <div className="flex flex-col justify-between items-end pb-5 text-[9px] font-mono text-slate-500 font-bold select-none w-6 shrink-0">
                                        {miniTicks.map((v, i) => <span key={i}>{v}</span>)}
                                    </div>
                                    {/* Chart body */}
                                    <div className="flex-1 relative">
                                        {/* Horizontal gridlines */}
                                        <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-5">
                                            {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-slate-200" />)}
                                        </div>
                                        {/* Bars */}
                                        <div className="h-36 flex items-end justify-around gap-1 pb-5 relative z-10">
                                            {Object.entries(typeDistribution).map(([cat, count]) => {
                                                const heightPct = Math.round((count / maxMiniBar) * 100);
                                                return (
                                                    <div key={cat} onClick={() => handleChartPointClick('Bar Chart', cat)} className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer group relative" title={`Click: ${cat}`}>
                                                        {/* Hover Tooltip */}
                                                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl z-30 min-w-[110px] pointer-events-none border border-slate-700 space-y-0.5">
                                                            <span className="font-bold text-emerald-400 border-b border-slate-700 pb-1 mb-1">{cat}</span>
                                                            <span className="text-slate-200 font-mono">Count: <strong className="text-white">{count}</strong></span>
                                                        </div>
                                                        <span className="text-[9px] font-mono font-bold text-slate-800">{count}</span>
                                                        <div className="w-full max-w-[20px] bg-slate-200 rounded-t-md overflow-hidden flex-1 flex items-end">
                                                            <div className="w-full bg-emerald-500 group-hover:bg-emerald-400 transition-all rounded-t-md" style={{ height: `${Math.max(heightPct, 6)}%` }} />
                                                        </div>
                                                        {/* X-Axis Label */}
                                                        <span className="absolute bottom-0 text-[8px] font-bold text-slate-600 truncate w-full text-center">{cat.slice(0, 6)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Line Trend with Y-Axis + Gridlines + Hover Tooltip */}
                    <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <FaChartLine className="text-sky-600" /> តាមកាលបរិច្ឆេទ (Line)
                            </h4>
                            <span className="text-[10px] text-slate-600 font-bold">ចុចលើ Point</span>
                        </div>
                        {trendData.length === 0 ? (
                            <div className="h-36 flex items-center justify-center text-slate-600 text-xs italic">No activity trend</div>
                        ) : (() => {
                            const maxLineVal = Math.max(...trendData.map(x => x.count), 1);
                            const lineTicks = [1, 0.66, 0.33, 0].map(r => Math.round(maxLineVal * r));
                            return (
                                <div className="flex items-stretch gap-2">
                                    {/* Y-Axis */}
                                    <div className="flex flex-col justify-between items-end pb-5 text-[9px] font-mono text-slate-500 font-bold select-none w-6 shrink-0">
                                        {lineTicks.map((v, i) => <span key={i}>{v}</span>)}
                                    </div>
                                    {/* Chart body */}
                                    <div className="flex-1 relative">
                                        {/* Horizontal gridlines */}
                                        <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-5">
                                            {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-slate-200" />)}
                                        </div>
                                        {/* SVG Connecting Line */}
                                        <div className="relative h-36">
                                            {trendData.length > 1 && (
                                                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                                    {/* Fill area under line */}
                                                    <defs>
                                                        <linearGradient id="lineGradFill" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.18" />
                                                            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                                                        </linearGradient>
                                                    </defs>
                                                    <polygon
                                                        fill="url(#lineGradFill)"
                                                        points={
                                                            [
                                                                ...trendData.map((d, i) => {
                                                                    const x = (i / (trendData.length - 1)) * 88 + 6;
                                                                    const y = 78 - (d.count / maxLineVal) * 62;
                                                                    return `${x}%,${y}%`;
                                                                }),
                                                                `94%,95%`,
                                                                `6%,95%`
                                                            ].join(' ')
                                                        }
                                                    />
                                                    <polyline
                                                        fill="none"
                                                        stroke="#0284c7"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        points={trendData.map((d, i) => {
                                                            const x = (i / (trendData.length - 1)) * 88 + 6;
                                                            const y = 78 - (d.count / maxLineVal) * 62;
                                                            return `${x}%,${y}%`;
                                                        }).join(' ')}
                                                    />
                                                </svg>
                                            )}
                                            {/* Interactive Points */}
                                            <div className={`absolute inset-0 flex items-end ${trendData.length === 1 ? 'justify-center' : 'justify-between'} px-2 pb-5`}>
                                                {trendData.map(d => (
                                                    <div key={d.date} onClick={() => handleChartPointClick('Date Trend', d.date, true)} className="relative z-10 flex flex-col items-center cursor-pointer group">
                                                        {/* Hover Tooltip */}
                                                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl z-30 min-w-[130px] pointer-events-none border border-slate-700 space-y-0.5">
                                                            <span className="font-bold text-sky-400 border-b border-slate-700 pb-1 mb-1 font-mono">{d.date}</span>
                                                            <span className="text-slate-200">Activities: <strong className="text-white font-mono">{d.count}</strong></span>
                                                            <span className="text-[9px] text-sky-300 font-semibold mt-0.5">ចុចដើម្បីមើលលម្អិត →</span>
                                                        </div>
                                                        <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1 rounded mb-1 shadow-2xs group-hover:scale-110 transition-transform">{d.count}</span>
                                                        <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-sky-600 group-hover:bg-sky-600 group-hover:scale-125 transition-all shadow-xs" />
                                                        {/* X-Axis Label */}
                                                        <span className="text-[8px] font-mono text-slate-600 font-bold mt-1">{d.date.slice(5)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Donut distribution */}
                    <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                                <FaChartPie className="text-purple-600" /> សមាមាត្រ (Pie)
                            </h4>
                            <span className="text-[10px] text-slate-600 font-bold">ចុចលើ Legend</span>
                        </div>
                        <div className="h-40 flex items-center justify-center gap-3">
                            <div className="relative w-24 h-24 shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-200" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    {Object.entries(typeDistribution).map(([cat, count], idx) => {
                                        const total = filteredAuditLogs.length || 1;
                                        const pct = Math.round((count / total) * 100);
                                        const colors = ['#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6'];
                                        return (
                                            <circle key={cat} onClick={() => handleChartPointClick('Pie Segment', cat)}
                                                r="15.9155" cx="18" cy="18" fill="none"
                                                stroke={colors[idx % colors.length]} strokeWidth="4"
                                                strokeDasharray={`${pct}, 100`}
                                                className="cursor-pointer hover:opacity-80 transition-opacity" />
                                        );
                                    })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-slate-900 text-xs">
                                    {filteredAuditLogs.length}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1 text-[10px] font-bold overflow-y-auto max-h-32 pr-1">
                                {Object.entries(typeDistribution).map(([cat, count], idx) => {
                                    const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-purple-500', 'bg-rose-500', 'bg-teal-500'];
                                    return (
                                        <div key={cat} onClick={() => handleChartPointClick('Pie Category', cat)} className="flex items-center justify-between p-1 rounded hover:bg-slate-200/50 cursor-pointer transition-colors">
                                            <span className="flex items-center gap-1.5 text-slate-800">
                                                <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />{cat}
                                            </span>
                                            <span className="font-mono text-slate-900">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 6. Executive Brand Summary Table (តារាងសរុបព័ត៌មានតាមសាខា) ── */}
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                            <FaLayerGroup className="text-emerald-600 text-lg" />
                            <span>{t('brandSummaryTitle')}</span>
                        </h2>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-mono text-xs font-bold shrink-0">
                        {summaryTableData.length} Brand Domain{summaryTableData.length > 1 ? 's' : ''}
                    </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                            <tr>
                                <th className="px-4 py-3 text-center">#</th>
                                <th className="px-4 py-3">{t('branchName')}</th>
                                <th className="px-4 py-3 text-center">{t('totalContractsCol')}</th>
                                <th className="px-4 py-3 text-center">{t('activatedCol')}</th>
                                <th className="px-4 py-3 text-right">{t('loanDisbursedCol')}</th>
                                <th className="px-4 py-3 text-right">{t('monthlyEstCol')}</th>
                                <th className="px-4 py-3 text-right">{t('revenueCol')}</th>
                                <th className="px-4 py-3 text-right">{t('outstandingCol')}</th>
                                <th className="px-4 py-3 text-center">{t('phoneLockCol')}</th>
                                <th className="px-4 py-3 text-center">{t('wallpaperLockCol')}</th>
                                <th className="px-4 py-3 text-center">{t('status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                            {summaryTableData.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-slate-600 italic">
                                        No brand data available
                                    </td>
                                </tr>
                            ) : (
                                summaryTableData.map((row, idx) => {
                                    const netBal = Math.max(row.loanDisbursed - row.revenueCollected, 0);
                                    const isProf = row.revenueCollected >= row.monthlyCollectionEst && row.revenueCollected > 0;
                                    return (
                                        <tr key={row.brand} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-4 py-3 text-center font-mono text-slate-600 font-bold">{idx + 1}</td>
                                            <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                {row.brand}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-800 font-mono">{row.totalContracts}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold rounded-full text-[11px]">
                                                    {row.activatedCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">${row.loanDisbursed.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">${row.monthlyCollectionEst.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">${row.revenueCollected.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">${netBal.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 font-mono font-bold rounded-full text-[11px] ${row.phoneLocked > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {row.phoneLocked} Locked
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 font-mono font-bold rounded-full text-[11px] ${row.wallpaperLocked > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {row.wallpaperLocked} WP
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${isProf ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    {isProf ? 'Healthy' : 'Active Loan'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {/* Grand Total Row */}
                        {summaryTableData.length > 0 && (
                            <tfoot className="bg-slate-900 text-white font-bold font-mono text-xs border-t-2 border-slate-700">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 uppercase tracking-wider text-emerald-400 font-black font-sans">
                                        {t('grandTotal')}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-black text-amber-300">
                                        {summaryTableData.reduce((s, r) => s + r.totalContracts, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-black text-emerald-400">
                                        {summaryTableData.reduce((s, r) => s + r.activatedCount, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-blue-300">
                                        ${summaryTableData.reduce((s, r) => s + r.loanDisbursed, 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-slate-300">
                                        ${summaryTableData.reduce((s, r) => s + r.monthlyCollectionEst, 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-300">
                                        ${summaryTableData.reduce((s, r) => s + r.revenueCollected, 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-rose-300">
                                        ${Math.max(summaryTableData.reduce((s, r) => s + r.loanDisbursed - r.revenueCollected, 0), 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-black text-rose-400">
                                        {summaryTableData.reduce((s, r) => s + r.phoneLocked, 0)} Locked
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-black text-purple-300">
                                        {summaryTableData.reduce((s, r) => s + r.wallpaperLocked, 0)} WP
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-black text-emerald-400">
                                        ✓ SYSTEM
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ── Recent Sessions Modal ── */}
            {sessionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4" onClick={() => setSessionModal(false)}>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <FaHistory className="text-purple-600" /> Recent Login Sessions
                            </h3>
                            <button onClick={() => setSessionModal(false)} className="text-slate-400 hover:text-slate-800 text-lg cursor-pointer"><MdClose /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-2 pr-1 text-xs">
                            {sessionsLoading ? (
                                <div className="flex items-center justify-center py-10 text-emerald-600 text-sm gap-2 font-bold">
                                    <MdOutlineSync className="spin-reload text-xl" /> Loading sessions...
                                </div>
                            ) : recentSessions.length === 0 ? (
                                <p className="text-slate-600 italic text-center py-8">No login sessions recorded yet.</p>
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
                                        <p className="text-slate-600 text-[10px] font-mono mt-0.5">
                                            🕐 {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' })}
                                        </p>
                                        <p className="text-slate-600 text-[10px] mt-0.5">📍 {log.ip || '127.0.0.1'} • 🖥 {log.deviceInfo || 'Web Browser'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="shrink-0 text-right pt-2 border-t border-slate-100">
                            <button onClick={() => setSessionModal(false)} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Chart Detail Modal ── */}
            {detailModal.open && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4" onClick={() => setDetailModal({ open: false, title: '', items: [] })}>
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <MdInfo className="text-emerald-600 text-lg" /> {detailModal.title}
                                </h3>
                                <p className="text-xs text-slate-600 font-semibold mt-0.5">ព័ត៌មានលម្អិតសម្រាប់ប្រភេទដែលបានជ្រើស</p>
                            </div>
                            <button onClick={() => setDetailModal({ open: false, title: '', items: [] })} className="text-slate-400 hover:text-slate-800 text-xl font-bold cursor-pointer"><MdClose /></button>
                        </div>
                        <div className="relative shrink-0">
                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                            <input type="text" value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                                placeholder="Search customer, model, serial..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky top-0 font-bold">
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
                                        <tr><td colSpan={8} className="text-center py-8 text-slate-600 italic">No records found.</td></tr>
                                    ) : modalFilteredItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/40 transition-colors">
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
                        <div className="shrink-0 text-right pt-2 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setDetailModal({ open: false, title: '', items: [] })}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all">
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
