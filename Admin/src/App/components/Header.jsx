import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaBell, FaBars, FaTimes, FaTelegramPlane, FaChartLine, FaWallet, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { MdOutlineTrendingUp, MdAttachMoney } from 'react-icons/md';
import { getFirstAllowedRoute, hasAnyAlertPermission } from '../../utils/permissionUtils';

const Header = ({ onOpenAlerts, alertCount = 0, isSidebarOpen = false, onToggleSidebar, onHideHeader }) => {
    const { t } = useLanguage();
    const { user, API_BASE, API_BASE1, hasPermission } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [balance, setBalance] = useState({
        totalLoanAmount: 0,
        totalRevenue: 0,
        totalRepaymentExpected: 0,
        outstandingBalance: 0
    });
    const [pulseAlert, setPulseAlert] = useState(false);

    const formatMoney = (val) => {
        const num = Number(val) || 0;
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const fetchBalance = async () => {
        if (!hasPermission('/dashboard', 'read')) return;
        try {
            const params = new URLSearchParams();
            if (user?.brand && user?.role !== 'Administrator') params.set('userBrand', user.brand);
            if (user?.role) params.set('userRole', user.role);
            if (user?.username) params.set('username', user.username);
            if (user?.isImmutable) params.set('isImmutable', 'true');

            const contractParams = new URLSearchParams(params);
            contractParams.set('limit', '999999');

            const [statsRes, contractsRes] = await Promise.all([
                fetch(`${API_BASE}/dashboard/stats?${params.toString()}`),
                fetch(`${API_BASE1}/contracts?${contractParams.toString()}`)
            ]);

            let data = {};
            if (statsRes.ok) data = await statsRes.json();

            let totalCustomerPaid = 0;
            let totalExpected = 0;

            if (contractsRes.ok) {
                const cData = await contractsRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                contracts.forEach(c => {
                    if (Array.isArray(c.repaymentSchedule)) {
                        c.repaymentSchedule.forEach(row => {
                            totalCustomerPaid += Number(row.paidAmount || 0);
                            totalExpected += (Number(row.scheduledAmount || 0) + Number(row.penalty || 0));
                        });
                    }
                });
            }

            const resolvedExpected = totalExpected || data.totalRepaymentExpected || 0;
            const resolvedOutstanding = Math.max(resolvedExpected - totalCustomerPaid, 0);

            setBalance({
                totalLoanAmount: data.totalLoanAmount || 0,
                totalRevenue: data.totalRevenue || 0,
                totalRepaymentExpected: resolvedExpected,
                outstandingBalance: resolvedOutstanding
            });
        } catch { }
    };

    useEffect(() => {
        if (hasPermission('/dashboard', 'read')) {
            fetchBalance();
            const interval = setInterval(fetchBalance, 30000);
            return () => clearInterval(interval);
        }
    }, [API_BASE, user, hasPermission]);

    // Pulse animation on alert count change
    useEffect(() => {
        if (alertCount > 0) {
            setPulseAlert(true);
            const t = setTimeout(() => setPulseAlert(false), 600);
            return () => clearTimeout(t);
        }
    }, [alertCount]);

    const brandName = (!user || user.isImmutable || user.username === '@hakyonghouv' || !user.brand)
        ? 'SYSTEM MDM'
        : `SYSTEM ${user.brand.toUpperCase()}`;

    return (
        <header
            className='w-full h-[60px] flex items-center justify-between px-3 md:px-5 border-b z-40 select-none'
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #134e4a 100%)',
                borderColor: 'rgba(52,211,153,0.15)',
                boxShadow: '0 1px 0 rgba(52,211,153,0.08), 0 4px 24px rgba(0,0,0,0.3)'
            }}
        >
            {/* LEFT: Toggle + Brand */}
            <div className='flex items-center gap-3 min-w-0'>
                {/* Hamburger Button */}
                <button
                    type='button'
                    onClick={onToggleSidebar}
                    className='flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95 group'
                    style={{
                        background: isSidebarOpen
                            ? 'rgba(52,211,153,0.18)'
                            : 'rgba(255,255,255,0.07)',
                        border: isSidebarOpen
                            ? '1px solid rgba(52,211,153,0.4)'
                            : '1px solid rgba(255,255,255,0.1)',
                        boxShadow: isSidebarOpen ? '0 0 12px rgba(52,211,153,0.2)' : 'none'
                    }}
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    title={isSidebarOpen ? 'បិទ Menu' : 'បើក Menu'}
                >
                    <div className='relative w-5 h-5 flex items-center justify-center'>
                        <FaBars className={`absolute text-emerald-400 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`} />
                        <FaTimes className={`absolute text-rose-400 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`} />
                    </div>
                </button>

                {/* Brand Logo */}
                <Link to={getFirstAllowedRoute(user, hasPermission)} className='flex items-center gap-2.5 group flex-shrink-0'>
                    <div
                        className='w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0'
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: '0 0 16px rgba(16,185,129,0.35)'
                        }}
                    >
                        <span className='text-white font-black text-xs tracking-tight'>
                            {brandName.charAt(0)}
                        </span>
                    </div>
                    <div className='hidden sm:block'>
                        <h1
                            className='text-sm font-black tracking-widest leading-none'
                            style={{
                                background: 'linear-gradient(90deg, #34d399, #a7f3d0)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}
                        >
                            {brandName}
                        </h1>
                        <p className='text-[9px] text-slate-400 font-semibold tracking-[0.15em] uppercase leading-none mt-0.5'>Management System</p>
                    </div>
                </Link>

                {/* Financial Summary Widgets */}
                {hasPermission('/dashboard', 'read') && (
                    <div className='hidden xl:flex items-center gap-1.5 pl-4 ml-1 border-l' style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        {/* Total Loan */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default'
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                            title='ឥណទានបញ្ចេញសរុប'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center' style={{ background: 'rgba(99,102,241,0.25)' }}>
                                <MdAttachMoney className='text-indigo-300' size={12} />
                            </div>
                            <div>
                                <p className='text-[8px] text-slate-400 uppercase tracking-wider leading-none'>{t('totalLoanDisbursed') || 'Loan'}</p>
                                <p className='text-xs font-black text-white leading-tight font-mono'>{formatMoney(balance.totalLoanAmount)}</p>
                            </div>
                        </div>

                        {/* Total Revenue */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default'
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                            title='ប្រាក់ប្រមូលបានសរុប'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center' style={{ background: 'rgba(16,185,129,0.25)' }}>
                                <FaArrowUp className='text-emerald-300' size={9} />
                            </div>
                            <div>
                                <p className='text-[8px] text-emerald-400 uppercase tracking-wider leading-none'>{t('totalRevenueCollected') || 'Revenue'}</p>
                                <p className='text-xs font-black text-emerald-300 leading-tight font-mono'>{formatMoney(balance.totalRevenue)}</p>
                            </div>
                        </div>

                        {/* Repayment Expected */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default'
                            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                            title='ប្រាក់ត្រូវប្រមូលមកវិញ'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center' style={{ background: 'rgba(139,92,246,0.25)' }}>
                                <MdOutlineTrendingUp className='text-violet-300' size={12} />
                            </div>
                            <div>
                                <p className='text-[8px] text-violet-400 uppercase tracking-wider leading-none'>{t('totalRepaymentDue') || 'Repayment'}</p>
                                <p className='text-xs font-black text-violet-300 leading-tight font-mono'>{formatMoney(balance.totalRepaymentExpected)}</p>
                            </div>
                        </div>

                        {/* Outstanding */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default'
                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                            title='ប្រាក់នៅសល់មិនទាន់ប្រមូល'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center' style={{ background: 'rgba(245,158,11,0.25)' }}>
                                <FaWallet className='text-amber-300' size={9} />
                            </div>
                            <div>
                                <p className='text-[8px] text-amber-400 uppercase tracking-wider leading-none'>{t('outstandingReceivables') || 'Outstanding'}</p>
                                <p className='text-xs font-black text-amber-300 leading-tight font-mono'>{formatMoney(balance.outstandingBalance)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT: Action Buttons */}
            <div className='flex items-center gap-2 flex-shrink-0'>

                {/* Alert Button */}
                {hasAnyAlertPermission(user, hasPermission) && (
                    <button
                        type='button'
                        onClick={onOpenAlerts}
                        className='relative flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95'
                        style={{
                            background: alertCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                            border: alertCount > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: alertCount > 0 ? '0 0 16px rgba(239,68,68,0.2)' : 'none'
                        }}
                        title={t('paymentDueAlerts')}
                    >
                        <FaBell
                            className={`text-sm ${alertCount > 0 ? 'text-rose-400' : 'text-slate-400'} ${pulseAlert ? 'animate-bounce' : ''}`}
                        />
                        {alertCount > 0 && (
                            <span className='absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-lg shadow-rose-500/40 border border-[#0f172a] flex items-center justify-center min-w-[17px] h-[17px] animate-pulse'>
                                {alertCount > 99 ? '99+' : alertCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Telegram Button */}
                {hasPermission('/telegram', 'read') && (
                    <Link
                        to='/telegram'
                        className='relative flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95'
                        style={{
                            background: location.pathname === '/telegram'
                                ? 'rgba(14,165,233,0.2)'
                                : 'rgba(255,255,255,0.07)',
                            border: location.pathname === '/telegram'
                                ? '1px solid rgba(14,165,233,0.4)'
                                : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: location.pathname === '/telegram' ? '0 0 16px rgba(14,165,233,0.2)' : 'none'
                        }}
                        title={t('telegram') || 'Telegram Web'}
                        aria-label='Telegram Web'
                    >
                        <FaTelegramPlane className={`text-sm ${location.pathname === '/telegram' ? 'text-sky-400' : 'text-slate-400'}`} />
                    </Link>
                )}

                {/* Live Status Dot */}
                <div className='hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px]'
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
                >
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]'></span>
                    <span className='text-[10px] text-emerald-400 font-bold tracking-wide hidden lg:block'>LIVE</span>
                </div>
            </div>
        </header>
    );
};

export default Header;