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
            console.error('Fullscreen error:', error);
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
                    className='md:hidden flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[5px] bg-gray-100 hover:bg-gray-200 text-slate-950 border border-gray-300 shadow-md transition-all cursor-pointer'
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    title={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                >
                    {isSidebarOpen ? <FaTimes className='text-sm' /> : <FaBars className='text-sm' />}
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
                            <span className='text-[9px] font-bold text-slate-500 uppercase tracking-wider'>ឥណទានបញ្ចេញសរុប</span>
                            <span className='text-xs font-black text-slate-700 font-mono leading-tight'>${formatMoney(balance.totalLoanAmount)}</span>
                        </div>
                        {/* ប្រាក់ប្រមូលបានសរុប */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-emerald-50 border border-emerald-200/80'>
                            <span className='text-[9px] font-bold text-emerald-600 uppercase tracking-wider'>ប្រាក់ប្រមូលបានសរុប</span>
                            <span className='text-xs font-black text-emerald-700 font-mono leading-tight'>${formatMoney(balance.totalRevenue)}</span>
                        </div>
                        {/* ប្រាក់ត្រូវប្រមូលមកវិញ */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-purple-50 border border-purple-200/80'>
                            <span className='text-[9px] font-bold text-purple-600 uppercase tracking-wider'>ប្រាក់ត្រូវប្រមូលមកវិញ</span>
                            <span className='text-xs font-black text-purple-700 font-mono leading-tight'>${formatMoney(balance.totalRepaymentExpected)}</span>
                        </div>
                        {/* ប្រាក់នៅសល់មិនទាន់ប្រមូល */}
                        <div className='flex flex-col items-center px-2.5 py-1 rounded-[5px] bg-amber-50 border border-amber-200/80'>
                            <span className='text-[9px] font-bold text-amber-600 uppercase tracking-wider'>ប្រាក់នៅសល់មិនទាន់ប្រមូល</span>
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
                        title='ការជូនដំណឹងបង់ប្រាក់ (Payment Due Alerts)'
                    >
                        <FaBell className='text-sm animate-pulse text-slate-950' />
                        {alertCount > 0 && (
                            <span className='absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-md shadow-rose-600/40 border border-white flex items-center justify-center min-w-[18px]'>
                                {alertCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Fullscreen Button */}
                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className='hidden md:flex items-center justify-center w-10 h-10 rounded-[5px] bg-gray-100 hover:bg-gray-200 text-slate-950 border border-gray-300 shadow-md transition-all cursor-pointer'
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? (
                        <FaCompress className='text-sm' />
                    ) : (
                        <FaExpand className='text-sm' />
                    )}
                </button>

                {/* Multi-Language Selector */}
                <div className='relative'>
                    <button
                        onClick={() => { setLangOpen(!langOpen); setAccountOpen(false); }}
                        className='flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-[5px] bg-slate-100 border border-slate-200 hover:border-emerald-500/50 transition-all text-xs font-semibold cursor-pointer shadow-xs hover:bg-slate-200/60'
                    >
                        <span className='text-base'>{currentLangObj.flag}</span>
                        <span className='hidden sm:inline text-slate-700'>{currentLangObj.label}</span>
                        <FaGlobe className='text-emerald-600 text-xs ml-1' />
                    </button>

                    {langOpen && (
                        <div className='absolute top-[5vh] right-0 bg-white border border-slate-200 rounded-[5px] p-2 w-[220px] shadow-xl z-50 animate-in fade-in duration-200'>
                            <p className='text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider border-b border-slate-100 mb-1'>
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
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-[5px] transition-all cursor-pointer ${lang === l.code ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-300' : 'hover:bg-slate-100 text-slate-700'}`}
                                    >
                                        <span className='flex items-center gap-2.5'>
                                            <span className='text-base'>{l.flag}</span>
                                            {l.label}
                                        </span>
                                        {lang === l.code && <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping'></span>}
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
                        className='flex items-center gap-2.5 pl-1.5 md:pl-2 pr-1.5 md:pr-3 py-1 rounded-[10px] bg-slate-100 border border-slate-200 hover:border-emerald-500/60 transition-all cursor-pointer shadow-xs hover:bg-slate-200/60'
                    >
                        <div className='w-8 h-8 rounded-full bg-emerald-600 p-0.5 shadow-xs'>
                            <div className='w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden'>
                                <FaUserCircle className='w-full h-full text-emerald-600 p-0.5' />
                            </div>
                        </div>
                        <div className='text-left hidden md:block'>
                            <p className='text-xs font-bold text-slate-800 leading-tight'>{user ? user.name : 'BOY BOY'}</p>
                            <p className='text-[10px] text-emerald-600 font-medium leading-none'>{user ? user.username : '@hakyonghouv'}</p>
                        </div>
                    </div>

                    {/* Account Menu */}
                    {accountOpen && (
                        <div className='absolute top-[5vh] right-0 bg-white border border-slate-200 w-[220px] p-2 rounded-[5px] shadow-xl z-999999 animate-in fade-in duration-200'>
                            <div className='p-3 border-b border-slate-100 mb-1 bg-slate-50 rounded-[5px]'>
                                <p className='text-xs font-bold text-slate-800'>{user?.name || 'BOY BOY'}</p>
                                <p className='text-[11px] text-emerald-600 font-mono mt-0.5'>{user?.email || 'yonghouvh@gmail.com'}</p>
                                <span className='inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 mt-1.5 border border-emerald-200'>
                                    {user?.role || 'Administrator'}
                                </span>
                            </div>

                            <Link
                                to="/profile"
                                onClick={() => setAccountOpen(false)}
                                className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[5px] transition-all cursor-pointer text-xs font-medium'
                            >
                                <FaUserCog className='text-base text-emerald-600' />
                                <p>{t('profile')}</p>
                            </Link>


                            <button
                                onClick={handleLogout}
                                className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-[5px] transition-all cursor-pointer text-xs font-semibold mt-1 border-t border-slate-100 pt-2'
                            >
                                <FaSignOutAlt className='text-base text-red-500' />
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