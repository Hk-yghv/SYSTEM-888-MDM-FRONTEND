import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    MdDashboard,
    MdOutlineSync,
    MdTrendingUp,
    MdAccountBalanceWallet,
    MdLock
} from 'react-icons/md';
import {
    FaCoins,
    FaBuilding,
    FaLock,
    FaUnlock
} from 'react-icons/fa';
import LineChart from '../../components/LineChart';
import { getAutomaticPenalty, getRowWithDueDate } from '../../utils/repaymentUtils';

const Dashboard = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    // ── Number & Currency Formatting (Strict 2 Decimals Everywhere) ──
    const formatMoney = (val) => {
        const num = Number(val) || 0;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatPercent = (val) => {
        const num = Number(val) || 0;
        return num.toFixed(2);
    };

    // ── Master Admin Check ──
    const isMasterAdmin = useMemo(() => {
        return user?.username === '@hakyonghouv' || user?.username === 'hakyonghouv' || user?.role === 'Administrator' || user?.isImmutable;
    }, [user]);

    // ── Core Stats State ──
    const [stats, setStats] = useState({
        totalContracts: 0,
        activatedContracts: 0,
        applicationContracts: 0,
        checkContracts: 0,
        redeemContracts: 0,
        blacklistContracts: 0,
        commentsContracts: 0,
        lockedPhones: 0,
        unlockedPhones: 0,
        lockedWallpapers: 0,
        unlockedWallpapers: 0,
        totalRevenue: 0,
        paymentCount: 0,
        totalLoanAmount: 0,
        totalCustomerReceived: 0,
        totalBorrowers: 0,
        outstandingBalance: 0,
        totalRepaymentExpected: 0,
        totalScheduledRepayment: 0,
        totalPenaltyRepayment: 0
    });

    const [brandFilter, setBrandFilter] = useState('');
    const [brandsList, setBrandsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [rawContracts, setRawContracts] = useState([]);
    const [rawPayments, setRawPayments] = useState([]);
    const [penaltyRulesByBrand, setPenaltyRulesByBrand] = useState({});

    // Active Brand Filter Scope
    const activeUserBrand = useMemo(() => {
        if (!isMasterAdmin && user?.brand) return user.brand;
        return brandFilter;
    }, [isMasterAdmin, user, brandFilter]);

    // ── API Fetchers ──
    const fetchBrands = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat) setBrandsList(brandCat.items || []);
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
            setTimeout(() => setReloading(false), 300);
        }
    };

    const fetchRawData = async () => {
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

            if (cRes.ok) {
                const cData = await cRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                setRawContracts(contracts);

                const brands = [...new Set(['', ...contracts.map(contract => String(contract.brand || '').trim())])];
                const ruleEntries = await Promise.all(brands.map(async brand => {
                    try {
                        const configRes = await fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`);
                        if (!configRes.ok) return [brand, []];
                        const config = await configRes.json();
                        return [brand, Array.isArray(config?.late_penalty_rules) ? config.late_penalty_rules : []];
                    } catch {
                        return [brand, []];
                    }
                }));
                setPenaltyRulesByBrand(Object.fromEntries(ruleEntries));
            }
            if (pRes.ok) {
                const pData = await pRes.json();
                const payments = pData.data || pData.payments || (Array.isArray(pData) ? pData : []);
                setRawPayments(payments);
            }
        } catch (err) {
            console.error('Failed to fetch raw data:', err);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        fetchDashboardStats();
        fetchRawData();
    }, [activeUserBrand]);

    // ── Key Computed Metrics ──
    const totalCount = stats.totalContracts || 1;
    const activatedPct = ((stats.activatedContracts / totalCount) * 100).toFixed(2);
    const applicationPct = ((stats.applicationContracts / totalCount) * 100).toFixed(2);
    const checkPct = ((stats.checkContracts / totalCount) * 100).toFixed(2);
    const redeemPct = ((stats.redeemContracts / totalCount) * 100).toFixed(2);
    const blacklistPct = ((stats.blacklistContracts / totalCount) * 100).toFixed(2);
    const phoneLockPct = ((stats.lockedPhones / totalCount) * 100).toFixed(2);
    const wallpaperLockPct = ((stats.lockedWallpapers / totalCount) * 100).toFixed(2);

    const loanOutAmt = stats.totalLoanAmount || 0;
    const weCollectedAmt = stats.totalRevenue || 0;
    const customerReceivedAmt = stats.totalCustomerReceived || 0;
    const collectionPct = customerReceivedAmt > 0 ? ((weCollectedAmt / customerReceivedAmt) * 100).toFixed(2) : '0.00';

    // ── Total Customer Paid: sum of paidAmount from all repaymentSchedule rows ──
    const totalCustomerPaid = useMemo(() => {
        let total = 0;
        rawContracts.forEach(c => {
            if (Array.isArray(c.repaymentSchedule)) {
                c.repaymentSchedule.forEach(row => {
                    total += Number(row.paidAmount || 0);
                });
            }
        });
        return total;
    }, [rawContracts]);

    // Lock Device & Other fees = totalRevenue - customerPaid
    const lockDeviceAmt = Math.max(weCollectedAmt - totalCustomerPaid, 0);

    // ── Contract Total Interest Helper ──
    const calculateContractTotalInterest = (c) => {
        if (c.totalInterest && !isNaN(Number(c.totalInterest)) && Number(c.totalInterest) > 0) {
            return Number(c.totalInterest);
        }
        const durationStr = String(c.duration || '').toLowerCase();
        const matched = durationStr.match(/\d+/);
        const count = matched ? parseInt(matched[0], 10) : 1;
        const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ');
        const months = isDays ? Math.max(1, Math.ceil(count / 30)) : Math.max(1, count);

        if (c.monthlyInterest && !isNaN(Number(c.monthlyInterest)) && Number(c.monthlyInterest) > 0) {
            return Number(c.monthlyInterest) * months;
        }

        const interestStr = String(c.interest || c.interestType || '').trim();
        const principal = Number(c.amount || c.loanAmount || 0);

        if (interestStr.includes('%')) {
            const rate = parseFloat(interestStr.replace(/[^0-9.]/g, '')) || 0;
            const monthlyInterestUSD = principal * (rate / 100);
            return monthlyInterestUSD * months;
        }

        const numericInterest = parseFloat(interestStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(numericInterest) && numericInterest > 0) {
            return numericInterest * months;
        }

        if (Array.isArray(c.repaymentSchedule) && c.repaymentSchedule.length > 0) {
            const sumSchedInterest = c.repaymentSchedule.reduce((s, row) => s + (Number(row.interest || row.interestAmount || 0)), 0);
            if (sumSchedInterest > 0) return sumSchedInterest;
        }

        const monthly = Number(c.monthlyPayment) || 0;
        if (monthly > 0 && principal > 0) {
            const totalPay = isDays ? monthly : (monthly * months);
            if (totalPay > principal) {
                return totalPay - principal;
            }
        }

        return 0;
    };

    // ── Repayment Calculations ──
    const repaymentMetrics = useMemo(() => {
        let totalExpected = 0;
        let totalScheduled = 0;
        let totalPenalty = 0;
        let totalInterest = 0;

        if (rawContracts.length > 0) {
            rawContracts.forEach(c => {
                totalInterest += calculateContractTotalInterest(c);

                if (Array.isArray(c.repaymentSchedule) && c.repaymentSchedule.length > 0) {
                    c.repaymentSchedule.forEach(row => {
                        const scheduled = Number(row.scheduledAmount) || Number(row.amount) || Number(c.monthlyPayment) || 0;
                        const brand = String(c.brand || '').trim();
                        const rules = penaltyRulesByBrand[brand] || penaltyRulesByBrand[''] || [];
                        const penaltyRow = getRowWithDueDate(row, c);
                        const penalty = getAutomaticPenalty(penaltyRow, c, rules);
                        totalScheduled += scheduled;
                        totalPenalty += penalty;
                        totalExpected += (scheduled + penalty);
                    });
                } else {
                    const durationStr = String(c.duration || '').toLowerCase();
                    const matched = durationStr.match(/\d+/);
                    const count = matched ? parseInt(matched[0], 10) : 1;
                    const isDays = durationStr.includes('day') || durationStr.includes('ថ្ងៃ');
                    const monthly = Number(c.monthlyPayment) || 0;
                    const scheduled = isDays
                        ? (monthly || Number(c.amount) || 0)
                        : (monthly > 0 ? (monthly * count) : (Number(c.amount) || 0));
                    totalScheduled += scheduled;
                    totalExpected += scheduled;
                }
            });
        } else {
            totalExpected = stats.totalRepaymentExpected || 0;
            totalScheduled = stats.totalScheduledRepayment || 0;
            totalPenalty = stats.totalPenaltyRepayment || 0;
            totalInterest = stats.totalInterest || 0;
        }

        return {
            totalExpected: totalExpected || stats.totalRepaymentExpected || 0,
            totalScheduled: totalScheduled || stats.totalScheduledRepayment || 0,
            totalPenalty: totalPenalty || stats.totalPenaltyRepayment || 0,
            totalInterest: totalInterest || stats.totalInterest || 0
        };
    }, [rawContracts, stats, penaltyRulesByBrand]);

    // ── Chart Trend Data (Identical format to /report/all-customers LineChart) ──
    const chartTrendData = useMemo(() => {
        const map = {};
        rawContracts.forEach(c => {
            const dateStr = (c.inputDate || c.createdAt || c.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, revenue: 0, loan: 0, customerCount: 0 };
            if (c.status === 'Activated') {
                map[dateStr].customerCount += 1;
                map[dateStr].loan += Number(c.amount || c.totalAmount || 0);
            }
        });
        rawPayments.forEach(p => {
            const dateStr = (p.paidDate || p.paymentDate || p.createdAt || p.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, revenue: 0, loan: 0, customerCount: 0 };
            map[dateStr].revenue += Number(p.amount || 0);
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [rawContracts, rawPayments]);

    // ── All Comprehensive Data Aggregated Per Brand ──
    const summaryTableData = useMemo(() => {
        const brandMap = {};

        rawContracts.forEach(c => {
            const b = c.brand || 'General / MDM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalContracts: 0,
                    applicationCount: 0,
                    checkCount: 0,
                    activatedCount: 0,
                    redeemCount: 0,
                    blacklistCount: 0,
                    commentsCount: 0,
                    loanDisbursed: 0,
                    monthlyCollectionEst: 0,
                    revenueCollected: 0,
                    phoneLocked: 0,
                    phoneUnlocked: 0,
                    wallpaperLocked: 0,
                    wallpaperUnlocked: 0
                };
            }
            brandMap[b].totalContracts += 1;

            if (c.status === 'Application') brandMap[b].applicationCount += 1;
            else if (c.status === 'Check') brandMap[b].checkCount += 1;
            else if (c.status === 'Activated') {
                brandMap[b].activatedCount += 1;
                brandMap[b].loanDisbursed += (Number(c.amount) || 0);
                brandMap[b].monthlyCollectionEst += (Number(c.monthlyPayment) || 0);
            }
            else if (c.status === 'Redeem') brandMap[b].redeemCount += 1;
            else if (c.status === 'Blacklist') brandMap[b].blacklistCount += 1;
            else if (c.status === 'Comments') brandMap[b].commentsCount += 1;

            if (c.lockPhoneStatus === 'Locked') brandMap[b].phoneLocked += 1;
            else brandMap[b].phoneUnlocked += 1;

            if (c.lockWallpaperStatus === 'Locked') brandMap[b].wallpaperLocked += 1;
            else brandMap[b].wallpaperUnlocked += 1;
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

    return (
        <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-slate-900 antialiased select-none bg-slate-100/60">

            {/* ═══════════════════════════════════════════════════════════
                1. REFINED FINANCIAL CONTROL BAR (HIGH CONTRAST HEADER)
            ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                {/* Left: Brand Identity & Title */}
                <div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                                {t('dashboard')}
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Right: Controls & High-Visibility Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Brand Scope Selector */}
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 border-2 border-slate-300 rounded-[5px] text-xs font-black text-slate-900">
                        <FaBuilding className="text-slate-700 text-sm" />
                        {isMasterAdmin && brandsList.length > 0 ? (
                            <select
                                value={brandFilter}
                                onChange={e => setBrandFilter(e.target.value)}
                                className="bg-transparent text-slate-950 font-black outline-none cursor-pointer pr-1"
                            >
                                <option value="">{t('allBrands')}</option>
                                {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        ) : (
                            <span className="text-slate-950 font-black font-mono">
                                {user?.brand || 'Default Brand'}
                            </span>
                        )}
                    </div>

                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                2. FOUR RAZOR-SHARP KPI METRIC CARDS (2 DECIMALS STRICT)
            ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Metric 1: Total Loan Disbursed */}
                <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 shadow-xs hover:border-blue-500 transition-all">
                    <div className="flex items-center justify-between text-slate-700">
                        <span className="text-xs font-black tracking-wide uppercase text-slate-800">{t('totalLoanDisbursed')}</span>
                        <div className="w-9 h-9 rounded-[5px] bg-blue-100 text-blue-800 border-2 border-blue-300 flex items-center justify-center text-lg font-black">
                            <MdAccountBalanceWallet />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-950">
                            ${formatMoney(loanOutAmt)}
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t-2 border-slate-200 text-slate-800 font-bold">
                            <span>អតិថិជន: <strong className="text-slate-950 font-mono font-black">{stats.totalBorrowers || stats.totalContracts}</strong> នាក់</span>
                            <span className="font-mono text-blue-900 font-black text-[11px] bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">DISBURSED</span>
                        </div>
                    </div>
                </div>

                {/* Metric 2: Revenue Collected */}
                <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 shadow-xs hover:border-emerald-500 transition-all">
                    <div className="flex items-center justify-between text-slate-700">
                        <span className="text-xs font-black tracking-wide uppercase text-slate-800">{t('totalRevenueCollected')}</span>
                        <div className="w-9 h-9 rounded-[5px] bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center text-lg font-black">
                            <MdTrendingUp />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-700">
                            ${formatMoney(weCollectedAmt)}
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t-2 border-slate-200 text-slate-800 font-bold">
                            <span>ប្រតិបត្តិការ: <strong className="text-slate-950 font-mono font-black">{stats.paymentCount}</strong></span>
                            <span className="font-mono text-emerald-950 font-black text-[11px] bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">+{collectionPct}%</span>
                        </div>
                    </div>
                </div>

                {/* Metric 3: Total Repayment Expected */}
                <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 shadow-xs hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between text-slate-700">
                        <span className="text-xs font-black tracking-wide uppercase text-slate-800">{t('totalRepaymentDue')}</span>
                        <div className="w-9 h-9 rounded-[5px] bg-purple-100 text-purple-800 border-2 border-purple-300 flex items-center justify-center text-lg font-black">
                            <FaCoins />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-purple-900">
                            ${formatMoney(repaymentMetrics.totalExpected)}
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t-2 border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-800 font-bold">
                                <span>ពិន័យ: <strong className="text-rose-700 font-mono font-black">${formatMoney(repaymentMetrics.totalPenalty)}</strong></span>
                                <span className="font-mono text-purple-950 font-black text-[11px] bg-purple-100 px-2 py-0.5 rounded-md border border-purple-300">SCHEDULED</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-800 font-bold pt-1 border-t border-slate-100">
                                <span>ការប្រាក់សរុប:</span>
                                <span className="font-mono text-emerald-700 font-black">${formatMoney(repaymentMetrics.totalInterest)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metric 4: Outstanding Balance */}
                <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 shadow-xs hover:border-amber-500 transition-all">
                    <div className="flex items-center justify-between text-slate-700">
                        <span className="text-xs font-black tracking-wide uppercase text-slate-800">{t('outstandingReceivables')}</span>
                        <div className="w-9 h-9 rounded-[5px] bg-amber-100 text-amber-800 border-2 border-amber-300 flex items-center justify-center text-lg font-black">
                            <MdLock />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-800">
                            ${formatMoney(Math.max(repaymentMetrics.totalExpected - totalCustomerPaid, 0))}
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t-2 border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span>ភ្ញៀវបានបង់:</span>
                                <span className="font-mono text-emerald-700 font-black">${formatMoney(totalCustomerPaid)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                <span>Lock Device & Other:</span>
                                <span className="font-mono text-rose-600 font-black">${formatMoney(lockDeviceAmt)}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ═══════════════════════════════════════════════════════════
                3. ALL CUSTOMERS STYLE LINE CHART & STATUS OVERVIEW
            ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left 2 Cols: Exact Reusable LineChart (from /report/all-customers) */}
                <div className="lg:col-span-2">
                    <LineChart
                        title="ក្រាបខ្សែនិន្នាការហិរញ្ញវត្ថុ & អតិថិជន"
                        subtitle="បង្ហាញពីកំណើនទឹកប្រាក់ប្រមូលបាន ឥណទានបញ្ចេញ និងចំនួនអតិថិជន Activated ប្រចាំថ្ងៃ/ខែ"
                        data={chartTrendData}
                        series={[
                            { key: 'revenue', label: 'ប្រាក់ប្រមូលបាន', color: '#10b981', isCurrency: true },
                            { key: 'loan', label: 'ឥណទានបញ្ចេញ', color: '#3b82f6', isCurrency: true },
                            { key: 'customerCount', label: 'ចំនួនអតិថិជន', color: '#8b5cf6', isCurrency: false }
                        ]}
                        timeFilterOptions={['7d', '30d', 'monthly', 'all']}
                        defaultFilter="monthly"
                        height={320}
                    />
                </div>

                {/* Right 1 Col: Contract & Security Overview */}
                <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
                            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                                ស្ថានភាពកិច្ចសន្យា & MDM
                            </h3>
                            <span className="text-xs font-mono font-black px-2.5 py-1 bg-slate-900 text-white rounded-md">
                                {stats.totalContracts} សរុប
                            </span>
                        </div>

                        {/* Status Breakdown List */}
                        <div className="space-y-2 mt-3 text-xs">
                            {[
                                { label: t('activated'), count: stats.activatedContracts, pct: activatedPct, color: 'text-emerald-950 bg-emerald-100 border-2 border-emerald-400' },
                                { label: t('application'), count: stats.applicationContracts, pct: applicationPct, color: 'text-amber-950 bg-amber-100 border-2 border-amber-400' },
                                { label: t('check'), count: stats.checkContracts, pct: checkPct, color: 'text-sky-950 bg-sky-100 border-2 border-sky-400' },
                                { label: t('redeem'), count: stats.redeemContracts, pct: redeemPct, color: 'text-purple-950 bg-purple-100 border-2 border-purple-400' },
                                { label: t('blacklist'), count: stats.blacklistContracts, pct: blacklistPct, color: 'text-rose-950 bg-rose-100 border-2 border-rose-400' },
                            ].map(item => (
                                <div key={item.label} className={`px-3.5 py-2 rounded-[5px] ${item.color} flex items-center justify-between font-black`}>
                                    <span>{item.label}</span>
                                    <span className="font-mono text-slate-950 text-sm">
                                        {item.count} <span className="text-xs text-slate-700 font-bold">({item.pct}%)</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Remote Lock Security Status */}
                    <div className="pt-3 border-t-2 border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-black text-slate-900">
                            <span>Phone Remote Lock Ratio</span>
                            <span className="font-mono text-rose-700 font-black">{stats.lockedPhones} Locked</span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-200 rounded-md overflow-hidden flex border-2 border-slate-300">
                            <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${phoneLockPct}%` }} />
                            <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${100 - parseFloat(phoneLockPct)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono font-black">
                            <span className="text-rose-700 flex items-center gap-1"><FaLock className="text-[10px]" /> {phoneLockPct}% Locked</span>
                            <span className="text-emerald-700 flex items-center gap-1"><FaUnlock className="text-[10px]" /> {formatPercent(100 - parseFloat(phoneLockPct))}% Unlocked</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* ═══════════════════════════════════════════════════════════
                4. FULL COMPREHENSIVE BRAND PERFORMANCE BREAKDOWN TABLE
            ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white border-2 border-slate-300 rounded-[5px] p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-slate-200">
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide flex items-center gap-2">
                            <FaBuilding className="text-slate-800" />
                            <span>{t('brandSummaryTitle')}</span>
                        </h2>
                        <p className="text-xs text-slate-700 font-bold mt-0.5">
                            បង្ហាញព័ត៌មានកិច្ចសន្យា ស្ថានភាព Report ទឹកប្រាក់ប្រមូល និងស្ថានភាព Lock គ្រប់សាខា
                        </p>
                    </div>
                    <span className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-mono font-black self-start sm:self-auto">
                        {summaryTableData.length} Brands
                    </span>
                </div>

                <div className="overflow-x-auto rounded-[5px] border-2 border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950 text-white uppercase tracking-wider text-[11px] font-black">
                            <tr>
                                <th className="px-3 py-1 text-center w-10">#</th>
                                <th className="px-3 py-1">{t('brand')}</th>
                                <th className="px-3 py-1 text-center">សរុប</th>
                                <th className="px-3 py-1 text-center">App</th>
                                <th className="px-3 py-1 text-center">Check</th>
                                <th className="px-3 py-1 text-center">Activated</th>
                                <th className="px-3 py-1 text-center">Redeem</th>
                                <th className="px-3 py-1 text-center">Blacklist</th>
                                <th className="px-3 py-1 text-right">ឥណទាន ($)</th>
                                <th className="px-3 py-1 text-right">ប្រចាំខែ ($)</th>
                                <th className="px-3 py-1 text-right">ប្រមូលបាន ($)</th>
                                <th className="px-3 py-1 text-right">នៅសល់ ($)</th>
                                <th className="px-3 py-1 text-center">Lock Phone</th>
                                <th className="px-3 py-1 text-center">Lock WP</th>
                                <th className="px-3 py-1 text-center">ស្ថានភាព</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-200 font-black text-slate-900">
                            {summaryTableData.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="text-center py-8 text-slate-700 italic font-bold text-sm">
                                        មិនមានទិន្នន័យសាខានៅឡើយទេ
                                    </td>
                                </tr>
                            ) : (
                                summaryTableData.map((row, idx) => {
                                    const netBal = Math.max(row.monthlyCollectionEst - row.revenueCollected, 0);
                                    const isHealthy = row.revenueCollected >= row.monthlyCollectionEst && row.revenueCollected > 0;
                                    return (
                                        <tr key={row.brand} className="hover:bg-slate-100/90 transition-colors">
                                            <td className="px-3 py-1 text-center font-mono text-slate-600 font-bold">{idx + 1}</td>
                                            <td className="px-3 py-1 font-black text-slate-950 flex items-center gap-1.5 whitespace-nowrap">
                                                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shadow-2xs shrink-0" />
                                                <span>{row.brand}</span>
                                            </td>
                                            <td className="px-3 py-1 text-center font-mono font-black text-slate-950">{row.totalContracts}</td>
                                            <td className="px-3 py-1 text-center font-mono text-amber-800">{row.applicationCount}</td>
                                            <td className="px-3 py-1 text-center font-mono text-sky-800">{row.checkCount}</td>
                                            <td className="px-3 py-1 text-center font-mono font-black text-emerald-800 bg-emerald-50/50">{row.activatedCount}</td>
                                            <td className="px-3 py-1 text-center font-mono text-purple-800">{row.redeemCount}</td>
                                            <td className="px-3 py-1 text-center font-mono text-rose-800">{row.blacklistCount}</td>
                                            <td className="px-3 py-1 text-right font-mono font-black text-blue-900">${formatMoney(row.loanDisbursed)}</td>
                                            <td className="px-3 py-1 text-right font-mono font-bold text-slate-800">${formatMoney(row.monthlyCollectionEst)}</td>
                                            <td className="px-3 py-1 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">${formatMoney(row.revenueCollected)}</td>
                                            <td className="px-3 py-1 text-right font-mono font-black text-rose-700">${formatMoney(netBal)}</td>
                                            <td className="px-3 py-1 text-center font-mono font-black text-rose-700">
                                                {row.phoneLocked > 0 ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300">{row.phoneLocked} L</span>
                                                ) : '0'}
                                            </td>
                                            <td className="px-3 py-1 text-center font-mono font-black text-purple-700">
                                                {row.wallpaperLocked > 0 ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-300">{row.wallpaperLocked} WP</span>
                                                ) : '0'}
                                            </td>
                                            <td className="px-3 py-1 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border-2 ${isHealthy ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-amber-100 text-amber-950 border-amber-400'}`}>
                                                    {isHealthy ? 'Healthy' : 'Active'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {/* Grand Total Footer */}
                        {summaryTableData.length > 0 && (
                            <tfoot className="bg-slate-950 text-white font-black font-mono text-xs border-t-2 border-slate-800">
                                <tr>
                                    <td colSpan={2} className="px-3 py-3.5 uppercase tracking-wider text-emerald-400 font-black font-sans text-xs">
                                        {t('grandTotal')}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono font-black text-amber-300">
                                        {summaryTableData.reduce((s, r) => s + r.totalContracts, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono text-amber-200">
                                        {summaryTableData.reduce((s, r) => s + r.applicationCount, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono text-sky-200">
                                        {summaryTableData.reduce((s, r) => s + r.checkCount, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono font-black text-emerald-400">
                                        {summaryTableData.reduce((s, r) => s + r.activatedCount, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono text-purple-300">
                                        {summaryTableData.reduce((s, r) => s + r.redeemCount, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono text-rose-300">
                                        {summaryTableData.reduce((s, r) => s + r.blacklistCount, 0)}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-mono font-black text-blue-300">
                                        ${formatMoney(summaryTableData.reduce((s, r) => s + r.loanDisbursed, 0))}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-mono text-slate-300">
                                        ${formatMoney(summaryTableData.reduce((s, r) => s + r.monthlyCollectionEst, 0))}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-mono font-black text-emerald-300">
                                        ${formatMoney(summaryTableData.reduce((s, r) => s + r.revenueCollected, 0))}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-mono font-black text-rose-300">
                                        ${formatMoney(Math.max(summaryTableData.reduce((s, r) => s + r.monthlyCollectionEst - r.revenueCollected, 0), 0))}
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono font-black text-rose-400">
                                        {summaryTableData.reduce((s, r) => s + r.phoneLocked, 0)} L
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono font-black text-purple-300">
                                        {summaryTableData.reduce((s, r) => s + r.wallpaperLocked, 0)} WP
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono font-black text-emerald-400 font-sans">
                                        ✓ SYSTEM
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
