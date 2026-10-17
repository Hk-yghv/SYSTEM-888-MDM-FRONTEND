import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaBell, FaBars, FaTimes, FaTelegramPlane, FaWallet, FaArrowUp, FaDownload } from 'react-icons/fa';
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
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isIosInstall, setIsIosInstall] = useState(false);

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIosInstall(Boolean(isIos && !isStandalone));

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setInstallPrompt(event);
        };
        const handleAppInstalled = () => {
            setInstallPrompt(null);
            setIsIosInstall(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallApp = async () => {
        if (!installPrompt) {
            window.alert('ដើម្បីដំឡើងលើ iPhone/iPad សូមចុច Share ក្នុង Safari រួចជ្រើស “Add to Home Screen”។');
            return;
        }

        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
    };

    const formatMoney = (val) => {
        const num = Number(val) || 0;
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

    useEffect(() => {
        if (alertCount > 0) {
            setPulseAlert(true);
            const timer = setTimeout(() => setPulseAlert(false), 600);
            return () => clearTimeout(timer);
        }
    }, [alertCount]);

    const brandName = (!user || user.isImmutable || user.username === '@hakyonghouv' || !user.brand)
        ? 'SYSTEM MDM'
        : `SYSTEM ${user.brand.toUpperCase()}`;

    return (
        <header
            className='w-full h-[60px] flex items-center justify-between px-3 md:px-5 border-b z-40 select-none bg-white'
            style={{ borderColor: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
            {/* LEFT: Toggle + Brand */}
            <div className='flex items-center gap-3 min-w-0'>
                {/* Hamburger Button */}
                <button
                    type='button'
                    onClick={onToggleSidebar}
                    className='flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95 hover:bg-emerald-50 border'
                    style={{
                        background: isSidebarOpen ? '#ecfdf5' : '#f8fafc',
                        borderColor: isSidebarOpen ? '#6ee7b7' : '#e2e8f0'
                    }}
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    title={isSidebarOpen ? 'បិទ Menu' : 'បើក Menu'}
                >
                    <div className='relative w-5 h-5 flex items-center justify-center'>
                        <FaBars className={`absolute text-slate-600 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`} />
                        <FaTimes className={`absolute text-rose-500 transition-all duration-300 transform ${isSidebarOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`} />
                    </div>
                </button>

                {/* Brand Logo */}
                <Link to={getFirstAllowedRoute(user, hasPermission)} className='flex items-center gap-2.5 group flex-shrink-0'>
                    <div
                        className='w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 shadow-sm'
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                        <span className='text-white font-black text-xs tracking-tight'>
                            {brandName.charAt(0)}
                        </span>
                    </div>
                    <div className='hidden sm:block'>
                        <h1 className='text-sm font-black tracking-widest leading-none text-slate-800 group-hover:text-emerald-700 transition-colors'>
                            {brandName}
                        </h1>
                        <p className='text-[9px] text-slate-400 font-semibold tracking-[0.15em] uppercase leading-none mt-0.5'>Management System</p>
                    </div>
                </Link>

                {/* Financial Summary Widgets */}
                {hasPermission('/dashboard', 'read') && (
                    <div className='hidden xl:flex items-center gap-1.5 pl-4 ml-1 border-l border-slate-200'>
                        {/* Total Loan */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default border border-slate-200 bg-slate-50'
                            title='ឥណទានបញ្ចេញសរុប'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center bg-indigo-100'>
                                <MdAttachMoney className='text-indigo-600' size={12} />
                            </div>
                            <div>
                                <p className='text-[8px] text-slate-400 uppercase tracking-wider leading-none'>{t('totalLoanDisbursed') || 'Loan'}</p>
                                <p className='text-xs font-black text-slate-800 leading-tight font-mono'>{formatMoney(balance.totalLoanAmount)}</p>
                            </div>
                        </div>

                        {/* Total Revenue */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default border border-emerald-200 bg-emerald-50'
                            title='ប្រាក់ប្រមូលបានសរុប'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center bg-emerald-200'>
                                <FaArrowUp className='text-emerald-700' size={9} />
                            </div>
                            <div>
                                <p className='text-[8px] text-emerald-600 uppercase tracking-wider leading-none'>{t('totalRevenueCollected') || 'Revenue'}</p>
                                <p className='text-xs font-black text-emerald-800 leading-tight font-mono'>{formatMoney(balance.totalRevenue)}</p>
                            </div>
                        </div>

                        {/* Repayment Expected */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default border border-violet-200 bg-violet-50'
                            title='ប្រាក់ត្រូវប្រមូលមកវិញ'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center bg-violet-200'>
                                <MdOutlineTrendingUp className='text-violet-700' size={12} />
                            </div>
                            <div>
                                <p className='text-[8px] text-violet-600 uppercase tracking-wider leading-none'>{t('totalRepaymentDue') || 'Repayment'}</p>
                                <p className='text-xs font-black text-violet-800 leading-tight font-mono'>{formatMoney(balance.totalRepaymentExpected)}</p>
                            </div>
                        </div>

                        {/* Outstanding */}
                        <div
                            className='flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-default border border-amber-200 bg-amber-50'
                            title='ប្រាក់នៅសល់មិនទាន់ប្រមូល'
                        >
                            <div className='w-5 h-5 rounded-md flex items-center justify-center bg-amber-200'>
                                <FaWallet className='text-amber-700' size={9} />
                            </div>
                            <div>
                                <p className='text-[8px] text-amber-600 uppercase tracking-wider leading-none'>{t('outstandingReceivables') || 'Outstanding'}</p>
                                <p className='text-xs font-black text-amber-800 leading-tight font-mono'>{formatMoney(balance.outstandingBalance)}</p>
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
                        className='relative flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95 border'
                        style={{
                            background: alertCount > 0 ? '#fff1f2' : '#f8fafc',
                            borderColor: alertCount > 0 ? '#fca5a5' : '#e2e8f0',
                        }}
                        title={t('paymentDueAlerts')}
                    >
                        <FaBell className={`text-sm ${alertCount > 0 ? 'text-rose-500' : 'text-slate-500'} ${pulseAlert ? 'animate-bounce' : ''}`} />
                        {alertCount > 0 && (
                            <span className='absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-md border-2 border-white flex items-center justify-center min-w-[17px] h-[17px]'>
                                {alertCount > 99 ? '99+' : alertCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Telegram Button */}
                {hasPermission('/telegram', 'read') && (
                    <Link
                        to='/telegram'
                        className='relative flex items-center justify-center w-9 h-9 rounded-[8px] transition-all duration-200 cursor-pointer active:scale-95 border'
                        style={{
                            background: location.pathname === '/telegram' ? '#e0f2fe' : '#f8fafc',
                            borderColor: location.pathname === '/telegram' ? '#7dd3fc' : '#e2e8f0',
                        }}
                        title={t('telegram') || 'Telegram Web'}
                        aria-label='Telegram Web'
                    >
                        <FaTelegramPlane className={`text-sm ${location.pathname === '/telegram' ? 'text-sky-500' : 'text-slate-500'}`} />
                    </Link>
                )}

                {(installPrompt || isIosInstall) && (
                    <button
                        type='button'
                        onClick={handleInstallApp}
                        className='flex items-center gap-1.5 h-9 px-2.5 rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-bold'
                        title='Install SYSTEM MDM'
                    >
                        <FaDownload size={12} />
                        <span className='hidden sm:inline'>Install App</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;