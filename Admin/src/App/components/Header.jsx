import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaUserCircle, FaGlobe, FaSignOutAlt, FaUserCog, FaBell, FaExpand, FaCompress, FaBars, FaTimes } from 'react-icons/fa';
import { getFirstAllowedRoute, hasAnyAlertPermission } from '../../utils/permissionUtils';

const Header = ({ onOpenAlerts, alertCount = 0, isSidebarOpen = false, onToggleSidebar }) => {
    const [accountOpen, setAccountOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const { t, lang, changeLanguage, LANGUAGES } = useLanguage();
    const { user, logout, API_BASE, API_BASE1, hasPermission } = useAuth();
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

    const handleLogout = () => {
        logout();
        setAccountOpen(false);
        navigate('/signin');
    };

    const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];


    // set full screen
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (error) {
            
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    return (
        <header
            className='w-full h-[7vh] flex items-center justify-between px-3 md:px-6 border-b z-40 select-none transition-all backdrop-blur-xl'
            style={{
                backgroundColor: 'var(--app-header, rgba(255, 255, 255, 0.95))',
                borderColor: 'var(--app-border, rgba(226, 232, 240, 0.8))',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02)'
            }}
        >
            <div className='flex items-center gap-3 md:gap-5 min-w-0'>
                <button
                    type='button'
                    onClick={onToggleSidebar}
                    className='md:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-xs transition-all cursor-pointer'
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    title={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                >
                    {isSidebarOpen ? <FaTimes className='text-sm' /> : <FaBars className='text-sm' />}
                </button>
                <Link to={getFirstAllowedRoute(user, hasPermission)} className='flex items-center gap-2.5 group'>
                    <div className='w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 font-black text-sm tracking-tighter'>
                        M
                    </div>
                    <div className='flex flex-col'>
                        <h1 className="text-sm md:text-base font-extrabold tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors whitespace-nowrap">
                            {(!user || user.isImmutable || user.username === '@hakyonghouv' || !user.brand)
                                ? 'SYSTEM MDM'
                                : `SYSTEM ${user.brand.toUpperCase()}`}
                        </h1>
                        <span className="text-[10px] text-slate-600 font-medium -mt-0.5 tracking-wider hidden sm:block">ENTERPRISE CONSOLE</span>
                    </div>
                </Link>

                {/* Financial Summary Widget — only show if user has read permission for /dashboard */}
                {hasPermission('/dashboard', 'read') && (
                    <div className='hidden xl:flex items-center gap-2 pl-4 border-l border-slate-200/80'>
                        {/* ឥណទានបញ្ចេញសរុប */}
                        <div className='flex flex-col items-start px-3 py-1 rounded-xl bg-slate-50/90 border border-slate-200/90 hover:border-slate-300 transition-all'>
                            <span className='text-[9px] font-bold text-slate-600 uppercase tracking-wider'>ឥណទានបញ្ចេញ</span>
                            <span className='text-xs font-extrabold text-slate-800 font-mono leading-tight'>${formatMoney(balance.totalLoanAmount)}</span>
                        </div>
                        {/* ប្រាក់ប្រមូលបានសរុប */}
                        <div className='flex flex-col items-start px-3 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/80 hover:border-emerald-300 transition-all'>
                            <span className='text-[9px] font-bold text-emerald-700 uppercase tracking-wider'>ប្រាក់ប្រមូលបាន</span>
                            <span className='text-xs font-extrabold text-emerald-700 font-mono leading-tight'>${formatMoney(balance.totalRevenue)}</span>
                        </div>
                        {/* ប្រាក់ត្រូវប្រមូលមកវិញ */}
                        <div className='flex flex-col items-start px-3 py-1 rounded-xl bg-purple-50/80 border border-purple-200/80 hover:border-purple-300 transition-all'>
                            <span className='text-[9px] font-bold text-purple-700 uppercase tracking-wider'>ត្រូវប្រមូលមកវិញ</span>
                            <span className='text-xs font-extrabold text-purple-700 font-mono leading-tight'>${formatMoney(balance.totalRepaymentExpected)}</span>
                        </div>
                        {/* ប្រាក់នៅសល់មិនទាន់ប្រមូល */}
                        <div className='flex flex-col items-start px-3 py-1 rounded-xl bg-amber-50/80 border border-amber-200/80 hover:border-amber-300 transition-all'>
                            <span className='text-[9px] font-bold text-amber-700 uppercase tracking-wider'>នៅសល់មិនទាន់ប្រមូល</span>
                            <span className='text-xs font-extrabold text-amber-700 font-mono leading-tight'>${formatMoney(balance.outstandingBalance)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className='flex items-center gap-2 md:gap-3 flex-shrink-0'>
                {/* Payment Alerts Button — only show if user has permission to at least one alert page */}
                {hasAnyAlertPermission(user, hasPermission) && (
                    <button
                        onClick={onOpenAlerts}
                        className='relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs hover:border-emerald-400/50 transition-all cursor-pointer'
                        title='ការជូនដំណឹងបង់ប្រាក់ (Payment Due Alerts)'
                    >
                        <FaBell className='text-sm text-slate-600' />
                        {alertCount > 0 && (
                            <span className='absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-sm shadow-rose-500/40 border-2 border-white flex items-center justify-center min-w-[17px]'>
                                {alertCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className='hidden md:flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs hover:border-emerald-400/50 transition-all cursor-pointer'
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? (
                        <FaCompress className='text-xs' />
                    ) : (
                        <FaExpand className='text-xs' />
                    )}
                </button>

                {/* Multi-Language Selector */}
                <div className='relative'>
                    <button
                        onClick={() => { setLangOpen(!langOpen); setAccountOpen(false); }}
                        className='flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 transition-all text-xs font-semibold cursor-pointer shadow-xs hover:bg-slate-100'
                    >
                        <span className='text-sm'>{currentLangObj.flag}</span>
                        <span className='hidden sm:inline text-slate-700 font-medium'>{currentLangObj.label}</span>
                        <FaGlobe className='text-emerald-600 text-xs ml-0.5' />
                    </button>

                    {langOpen && (
                        <div className='absolute top-[120%] right-0 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-2 w-[220px] shadow-2xl z-50 animate-in fade-in duration-150'>
                            <p className='text-[10px] font-bold text-slate-600 px-3 py-1 uppercase tracking-wider border-b border-slate-100 mb-1'>
                                Select Language / ជ្រើសរើសភាសា
                            </p>
                            <div className='max-h-[300px] overflow-y-auto space-y-1 pr-1'>
                                {LANGUAGES.map((l) => (
                                    <button
                                        key={l.code}
                                        onClick={() => {
                                            changeLanguage(l.code);
                                            setLangOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${lang === l.code ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <span className='flex items-center gap-2.5'>
                                            <span className='text-base'>{l.flag}</span>
                                            {l.label}
                                        </span>
                                        {lang === l.code && <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Account User Badge */}
                <div className='relative'>
                    <div
                        onClick={() => { setAccountOpen(!accountOpen); setLangOpen(false); }}
                        className='flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 transition-all cursor-pointer shadow-xs hover:bg-slate-100'
                    >
                        <div className='w-7 h-7 rounded-lg bg-emerald-600 p-0.5 shadow-xs flex items-center justify-center text-white'>
                            <FaUserCircle className='w-full h-full text-white' />
                        </div>
                        <div className='text-left hidden md:block'>
                            <p className='text-xs font-bold text-slate-800 leading-tight'>{user ? user.name : 'BOY BOY'}</p>
                            <p className='text-[9px] text-emerald-700 font-medium leading-none'>{user ? user.username : '@hakyonghouv'}</p>
                        </div>
                    </div>

                    {/* Account Menu */}
                    {accountOpen && (
                        <div className='absolute top-[120%] right-0 bg-white/95 backdrop-blur-xl border border-slate-200/90 w-[230px] p-2 rounded-2xl shadow-2xl z-[999999] animate-in fade-in duration-150'>
                            <div className='p-3 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl'>
                                <p className='text-xs font-bold text-slate-800'>{user?.name || 'BOY BOY'}</p>
                                <p className='text-[10px] text-emerald-700 font-mono mt-0.5'>{user?.email || 'yonghouvh@gmail.com'}</p>
                                <span className='inline-block text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 mt-1.5 border border-emerald-200/70'>
                                    {user?.role || 'Administrator'}
                                </span>
                            </div>

                            <Link
                                to="/profile"
                                onClick={() => setAccountOpen(false)}
                                className='w-full h-[38px] flex items-center gap-2.5 px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl transition-all cursor-pointer text-xs font-medium'
                            >
                                <FaUserCog className='text-sm text-emerald-600' />
                                <p>{t('profile')}</p>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className='w-full h-[38px] flex items-center gap-2.5 px-3 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-xl transition-all cursor-pointer text-xs font-semibold mt-1 border-t border-slate-100 pt-2'
                            >
                                <FaSignOutAlt className='text-sm text-rose-500' />
                                <p>{t('logout')}</p>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;