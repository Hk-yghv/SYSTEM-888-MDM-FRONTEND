import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaBell, FaBars, FaTimes } from 'react-icons/fa';
import { getFirstAllowedRoute, hasAnyAlertPermission } from '../../utils/permissionUtils';

const Header = ({ onOpenAlerts, alertCount = 0, isSidebarOpen = false, onToggleSidebar }) => {
    const { t } = useLanguage();
    const { user, API_BASE, API_BASE1, hasPermission } = useAuth();
    const navigate = useNavigate();

    // Financial summary state
    const [balance, setBalance] = useState({
        totalLoanAmount: 0,
        totalRevenue: 0,
        totalRepaymentExpected: 0,
        outstandingBalance: 0
    });

    const formatMoney = (val) => {
        const num = Number(val) || 0;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fetchBalance = async () => {
        if (!hasPermission('/dashboard', 'read')) return;
        try {
            const params = new URLSearchParams();
            if (user?.brand && user?.role !== 'Administrator') params.set('userBrand', user.brand);
            if (user?.role) params.set('userRole', user.role);
            if (user?.username) params.set('username', user.username);
            if (user?.isImmutable) params.set('isImmutable', 'true');

            // Fetch stats and raw contracts in parallel (same as Dashboard does)
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

    return (
        <header
            className='w-full h-[7vh] flex items-center justify-between px-3 md:px-6 border-b z-40 select-none shadow-sm transition-colors backdrop-blur-md'
            style={{
                backgroundColor: 'var(--app-header, rgba(255, 255, 255, 0.9))',
                borderColor: 'var(--app-border, rgba(226, 232, 240, 0.8))'
            }}
        >
            <div className='flex items-center gap-3 md:gap-4 min-w-0'>
                <button
                    type='button'
                    onClick={onToggleSidebar}
                    className='flex-shrink-0 flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-[8px] bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer active:scale-95 group'
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    title={isSidebarOpen ? 'បិទ Menu (Close Menu)' : 'បើក Menu (Open Menu)'}
                >
                    <div className='relative w-4 h-4 md:w-5 md:h-5 flex items-center justify-center'>
                        <FaBars className={`absolute text-emerald-700 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`} />
                        <FaTimes className={`absolute text-rose-500 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`} />
                    </div>
                </button>
                <Link to={getFirstAllowedRoute(user, hasPermission)} className='flex items-center gap-2.5 group'>
                    <h1 className="text-base md:text-xl font-extrabold tracking-wider text-emerald-700 hover:text-emerald-800 transition-colors whitespace-nowrap">
                        {(!user || user.isImmutable || user.username === '@hakyonghouv' || !user.brand)
                            ? 'SYSTEM'
                            : `SYSTEM ${user.brand.toUpperCase()}`}
                    </h1>
                </Link>

                {/* Financial Summary Widget — only show if user has read permission for /dashboard */}
                {hasPermission('/dashboard', 'read') && (
                    <div className='hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200'>
                        {/* ឥណទានបញ្ចេញសរុប */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-slate-50 border border-slate-200/80'>
                            <span className='text-[9px] font-bold text-slate-500 uppercase tracking-wider'>{t('totalLoanDisbursed')}</span>
                            <span className='text-xs font-black text-slate-700 font-mono leading-tight'>${formatMoney(balance.totalLoanAmount)}</span>
                        </div>
                        {/* ប្រាក់ប្រមូលបានសរុប */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-emerald-50 border border-emerald-200/80'>
                            <span className='text-[9px] font-bold text-emerald-600 uppercase tracking-wider'>{t('totalRevenueCollected')}</span>
                            <span className='text-xs font-black text-emerald-700 font-mono leading-tight'>${formatMoney(balance.totalRevenue)}</span>
                        </div>
                        {/* ប្រាក់ត្រូវប្រមូលមកវិញ */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-purple-50 border border-purple-200/80'>
                            <span className='text-[9px] font-bold text-purple-600 uppercase tracking-wider'>{t('totalRepaymentDue')}</span>
                            <span className='text-xs font-black text-purple-700 font-mono leading-tight'>${formatMoney(balance.totalRepaymentExpected)}</span>
                        </div>
                        {/* ប្រាក់នៅសល់មិនទាន់ប្រមូល */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-amber-50 border border-amber-200/80'>
                            <span className='text-[9px] font-bold text-amber-600 uppercase tracking-wider'>{t('outstandingReceivables')}</span>
                            <span className='text-xs font-black text-amber-700 font-mono leading-tight'>${formatMoney(balance.outstandingBalance)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className='flex items-center gap-1.5 md:gap-3 flex-shrink-0'>
                {/* Payment Alerts Button — only show if user has permission to at least one alert page */}
                {hasAnyAlertPermission(user, hasPermission) && (
                    <button
                        onClick={onOpenAlerts}
                        className='relative flex items-center justify-center gap-2 w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-3 rounded-[5px] bg-gray-100 hover:bg-gray-200 text-slate-950 text-xs font-black shadow-md shadow-gray-200 transition-all cursor-pointer border border-gray-300'
                        title={t('paymentDueAlerts')}
                    >
                        <FaBell className='text-sm animate-pulse text-slate-950' />
                        {alertCount > 0 && (
                            <span className='absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-md shadow-rose-600/40 border border-white flex items-center justify-center min-w-[18px]'>
                                {alertCount}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;