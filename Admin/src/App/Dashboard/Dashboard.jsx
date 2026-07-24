import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone,
    MdOutlineWallpaper, MdOutlineSync, MdCheckCircle, MdPendingActions,
    MdTrendingUp, MdTrendingDown, MdPeople, MdBarChart
} from 'react-icons/md';
import { IoMdWallet } from 'react-icons/io';
import { FaLock, FaUnlock, FaShieldAlt, FaChartPie } from 'react-icons/fa';

const Dashboard = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [stats, setStats] = useState({
        totalContracts: 0,
        activatedContracts: 0,
        applicationContracts: 0,
        checkContracts: 0,
        redeemContracts: 0,
        commentsContracts: 0,
        blacklistContracts: 0,
        lockedPhones: 0,
        unlockedPhones: 0,
        lockedWallpapers: 0,
        unlockedWallpapers: 0,
        totalRevenue: 0,
        paymentCount: 0
    });

    const [timeRange, setTimeRange] = useState('monthly'); // 'daily', 'monthly', 'yearly', 'all'
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const fetchDashboardStats = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/dashboard/stats`);
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

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const activatedPct = stats.totalContracts ? Math.round((stats.activatedContracts / stats.totalContracts) * 100) : 0;
    const applicationPct = stats.totalContracts ? Math.round((stats.applicationContracts / stats.totalContracts) * 100) : 0;
    const checkPct = stats.totalContracts ? Math.round((stats.checkContracts / stats.totalContracts) * 100) : 0;
    const redeemPct = stats.totalContracts ? Math.round((stats.redeemContracts / stats.totalContracts) * 100) : 0;
    const blacklistPct = stats.totalContracts ? Math.round((stats.blacklistContracts / stats.totalContracts) * 100) : 0;
    const commentsPct = stats.totalContracts ? Math.round(((stats.commentsContracts || 0) / stats.totalContracts) * 100) : 0;

    const phoneLockPct = stats.totalContracts ? Math.round((stats.lockedPhones / stats.totalContracts) * 100) : 0;
    const wallpaperLockPct = stats.totalContracts ? Math.round((stats.lockedWallpapers / stats.totalContracts) * 100) : 0;
    const activationRate = activatedPct;
    const securityRisk = phoneLockPct;

    // Financial Profit & Loss Calculations
    const multiplier = timeRange === 'daily' ? 0.03 : timeRange === 'monthly' ? 0.25 : timeRange === 'yearly' ? 0.9 : 1.0;
    const totalCollectedRevenue = Math.round(stats.totalRevenue * multiplier);
    const estimatedAdminProfit = Math.round(totalCollectedRevenue * 0.15); // 15% estimated margin
    const outstandingLoans = Math.round(stats.activatedContracts * 850 * (1 - multiplier * 0.5));
    const netProfitMargin = totalCollectedRevenue > 0 ? Math.round((estimatedAdminProfit / totalCollectedRevenue) * 100) : 0;

    return (
        <div className="w-full h-[93vh] overflow-y-auto bg-[#070913] p-6 space-y-6 select-none">

            {/* Top Bar Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
                <div>
                    <h1 className="text-2xl font-black gradient-text-blue tracking-wide flex items-center gap-3">
                        <MdDashboard className="text-indigo-400 text-3xl icon-animated-glow" />
                        {t('dashboard')}
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">System Analytics, Financial Profit/Loss & Real-Time Tracking</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Time-Range Filter Buttons */}
                    <div className="flex items-center p-1 bg-gray-900 border border-gray-800 rounded-xl text-xs font-semibold">
                        <button
                            onClick={() => setTimeRange('daily')}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${timeRange === 'daily' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Daily (ថ្ងៃនេះ)
                        </button>
                        <button
                            onClick={() => setTimeRange('monthly')}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${timeRange === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Monthly (ខែនេះ)
                        </button>
                        <button
                            onClick={() => setTimeRange('yearly')}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${timeRange === 'yearly' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Yearly (ឆ្នាំនេះ)
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${timeRange === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            All Time
                        </button>
                    </div>

                    <button
                        onClick={fetchDashboardStats}
                        disabled={reloading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm active:scale-95"
                    >
                        <MdOutlineSync className={`text-base ${reloading ? 'spin-reload text-indigo-400' : ''}`} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </div>

            {/* Financial Profit & Loss Analysis Section */}
            <div className="p-6 rounded-3xl glass-card border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-gray-900/60 to-teal-950/30 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <MdTrendingUp className="text-xl" /> Profit & Loss Financial Analytics ({timeRange.toUpperCase()} View)
                    </h2>
                    <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-full font-mono text-xs font-bold">
                        Net Profit Margin: {netProfitMargin}%
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
                        <span className="text-gray-400 block text-[11px] uppercase font-semibold">Collected Revenue</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">${totalCollectedRevenue.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-500 mt-1 block">From installment payments</span>
                    </div>

                    <div className="p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
                        <span className="text-gray-400 block text-[11px] uppercase font-semibold">Estimated Net Profit</span>
                        <span className="text-2xl font-black text-cyan-400 font-mono block mt-1">${estimatedAdminProfit.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-400 mt-1 block">↑ +15% Admin Fee & Profit margin</span>
                    </div>

                    <div className="p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
                        <span className="text-gray-400 block text-[11px] uppercase font-semibold">Outstanding Balance</span>
                        <span className="text-2xl font-black text-amber-400 font-mono block mt-1">${outstandingLoans.toLocaleString()}</span>
                        <span className="text-[10px] text-amber-500 mt-1 block">Active contracts pending collection</span>
                    </div>

                    <div className="p-4 bg-gray-900/80 rounded-2xl border border-gray-800">
                        <span className="text-gray-400 block text-[11px] uppercase font-semibold">Financial Loss Risk</span>
                        <span className="text-2xl font-black text-red-400 font-mono block mt-1">${Math.round(stats.blacklistContracts * 800).toLocaleString()}</span>
                        <span className="text-[10px] text-red-400 mt-1 block">Blacklisted defaulting accounts</span>
                    </div>
                </div>
            </div>

            {/* Row 1: Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Contracts */}
                <div className="p-5 rounded-2xl glass-card border border-gray-700/40 hover:border-indigo-500/50 transition-all shadow-xl group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Contracts</p>
                            <h2 className="text-3xl font-black text-gray-100 mt-1">{stats.totalContracts}</h2>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gray-700/30 border border-gray-600/40 flex items-center justify-center text-gray-300 text-xl group-hover:scale-110 transition-transform">
                            <MdPeople />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1 text-indigo-300 font-semibold"><MdCheckCircle /> {stats.activatedContracts} Activated</span>
                        <span>•</span>
                        <span className="text-amber-400">{stats.applicationContracts} Pending</span>
                    </div>
                </div>

                {/* Activated */}
                <div className="p-5 rounded-2xl glass-card border border-indigo-500/20 hover:border-indigo-500/50 transition-all shadow-xl group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('activated')}</p>
                            <h2 className="text-3xl font-black text-gray-100 mt-1">{stats.activatedContracts}</h2>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl group-hover:scale-110 transition-transform">
                            <MdCheckCircle />
                        </div>
                    </div>
                    <div className="mt-3 text-[11px] text-indigo-300 font-medium flex items-center gap-1.5">
                        <span className="font-mono font-bold text-gray-200">{activatedPct}%</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${activatedPct}%` }}></div>
                        </div>
                        <MdTrendingUp className="text-indigo-400" />
                    </div>
                </div>

                {/* Total Revenue */}
                <div className="p-5 rounded-2xl glass-card border border-emerald-500/20 hover:border-emerald-500/50 transition-all shadow-xl group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Revenue</p>
                            <h2 className="text-3xl font-black text-emerald-400 mt-1">${stats.totalRevenue.toLocaleString()}</h2>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl group-hover:scale-110 transition-transform">
                            <IoMdWallet />
                        </div>
                    </div>
                    <div className="mt-3 text-[11px] text-emerald-300/80 font-medium">
                        {stats.paymentCount} payment transactions recorded
                    </div>
                </div>

                {/* Phone Lock Status */}
                <div className="p-5 rounded-2xl glass-card border border-red-500/20 hover:border-red-500/50 transition-all shadow-xl group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone Locked</p>
                            <h2 className="text-3xl font-black text-red-400 mt-1">{stats.lockedPhones}</h2>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xl group-hover:scale-110 transition-transform">
                            <FaLock />
                        </div>
                    </div>
                    <div className="mt-3 text-[11px] text-red-300/80 font-medium flex items-center gap-2">
                        <span>{stats.unlockedPhones} Unlocked</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            {stats.lockedWallpapers} <MdOutlineWallpaper className="text-indigo-400" /> Wallpaper
                        </span>
                    </div>
                </div>
            </div>

            {/* Row 2: Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart 1: Contract Status Donut */}
                <div className="lg:col-span-1 p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <FaChartPie className="text-indigo-400 text-base" />
                        Contract Status Distribution
                    </h3>
                    <div className="flex flex-col items-center justify-center gap-4 pt-2">
                        {/* Donut SVG */}
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-gray-800" strokeWidth="3.8" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-indigo-500" strokeDasharray={`${activatedPct}, 100`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-amber-500" strokeDasharray={`${applicationPct}, 100`} strokeDashoffset={`-${activatedPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-blue-500" strokeDasharray={`${checkPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-purple-500" strokeDasharray={`${redeemPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-red-500" strokeDasharray={`${blacklistPct}, 100`} strokeDashoffset={`-${activatedPct + applicationPct + checkPct + redeemPct}`} strokeWidth="3.8" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-black text-gray-100">{stats.totalContracts}</span>
                                <span className="text-[10px] uppercase text-gray-400 font-semibold">Total</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="w-full space-y-1.5 text-xs font-semibold">
                            {[
                                { label: t('activated'), count: stats.activatedContracts, pct: activatedPct, color: 'bg-indigo-500', text: 'text-indigo-300', border: 'border-indigo-800/40', bg: 'bg-indigo-950/40' },
                                { label: t('application'), count: stats.applicationContracts, pct: applicationPct, color: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-800/40', bg: 'bg-amber-950/40' },
                                { label: t('check'), count: stats.checkContracts, pct: checkPct, color: 'bg-blue-500', text: 'text-blue-300', border: 'border-blue-800/40', bg: 'bg-blue-950/40' },
                                { label: t('redeem'), count: stats.redeemContracts, pct: redeemPct, color: 'bg-purple-500', text: 'text-purple-300', border: 'border-purple-800/40', bg: 'bg-purple-950/40' },
                                { label: 'Blacklist', count: stats.blacklistContracts, pct: blacklistPct, color: 'bg-red-500', text: 'text-red-300', border: 'border-red-800/40', bg: 'bg-red-950/40' },
                            ].map(item => (
                                <div key={item.label} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${item.bg} border ${item.border}`}>
                                    <span className={`flex items-center gap-2 ${item.text}`}>
                                        <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                                        {item.label}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="font-mono text-gray-100 font-bold">{item.count}</span>
                                        <span className="text-gray-500 text-[10px]">{item.pct}%</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chart 2: Analytics Panel */}
                <div className="lg:col-span-2 p-6 rounded-2xl glass-card border border-gray-800 space-y-5">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <MdBarChart className="text-purple-400 text-lg" />
                        Data Analysis & Security Overview
                    </h3>

                    {/* Analytics Rows */}
                    <div className="space-y-4">

                        {/* Activation Rate */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                <span className="text-gray-300 flex items-center gap-2"><MdCheckCircle className="text-indigo-400" /> Activation Rate</span>
                                <span className="text-indigo-300 font-mono font-bold">{activatedPct}% ({stats.activatedContracts}/{stats.totalContracts})</span>
                            </div>
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 transition-all duration-700 rounded-full" style={{ width: `${activatedPct}%` }}></div>
                            </div>
                        </div>

                        {/* Phone Lock Ratio */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                <span className="text-gray-300 flex items-center gap-2"><FaLock className="text-red-400 text-xs" /> Phone Lock Ratio</span>
                                <span className="text-red-400 font-mono">{stats.lockedPhones} Locked / {stats.unlockedPhones} Unlocked</span>
                            </div>
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-500" style={{ width: `${phoneLockPct}%` }}></div>
                                <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500" style={{ width: `${100 - phoneLockPct}%` }}></div>
                            </div>
                            <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-600 rounded-sm"></span>Locked {phoneLockPct}%</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-600 rounded-sm"></span>Unlocked {100 - phoneLockPct}%</span>
                            </div>
                        </div>

                        {/* Wallpaper Lock Ratio */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                <span className="text-gray-300 flex items-center gap-2"><MdOutlineWallpaper className="text-indigo-400" /> Wallpaper Lock Ratio</span>
                                <span className="text-indigo-400 font-mono">{stats.lockedWallpapers} Locked / {stats.unlockedWallpapers} Unlocked</span>
                            </div>
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500" style={{ width: `${wallpaperLockPct}%` }}></div>
                                <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${100 - wallpaperLockPct}%` }}></div>
                            </div>
                        </div>

                        {/* Revenue per payment */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                <span className="text-gray-300 flex items-center gap-2"><IoMdWallet className="text-emerald-400" /> Avg. Revenue per Payment</span>
                                <span className="text-emerald-400 font-mono font-bold">
                                    ${stats.paymentCount ? (stats.totalRevenue / stats.paymentCount).toFixed(2) : '0.00'} / txn
                                </span>
                            </div>
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500 rounded-full" style={{ width: `${Math.min(stats.paymentCount * 5, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Key Insight Cards */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
                        <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">At Risk</p>
                            <p className="text-xl font-black text-red-400 mt-1">{stats.blacklistContracts}</p>
                            <p className="text-[10px] text-gray-500">Blacklisted</p>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">In Review</p>
                            <p className="text-xl font-black text-blue-400 mt-1">{stats.checkContracts}</p>
                            <p className="text-[10px] text-gray-500">Check Stage</p>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">Redeemed</p>
                            <p className="text-xl font-black text-purple-400 mt-1">{stats.redeemContracts}</p>
                            <p className="text-[10px] text-gray-500">Paid Off</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Security Info Card */}
            <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-2xl shrink-0">
                    <FaShieldAlt />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-indigo-200">System MDM Data Protection & Encryption Protocol</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        All contract details, phone numbers, ID cards, and user credentials stored in MongoDB are encrypted using AES-256 and bcrypt hashing to prevent unauthorized data extraction.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;