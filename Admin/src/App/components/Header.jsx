import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaBell, FaBars, FaTimes, FaTelegramPlane, FaWallet, FaArrowUp, FaDownload, FaExternalLinkAlt } from 'react-icons/fa';
import { MdOutlineTrendingUp, MdAttachMoney } from 'react-icons/md';
import { getFirstAllowedRoute, hasAnyAlertPermission } from '../../utils/permissionUtils';

const PWA_INSTALLED_KEY = 'system-mdm-pwa-installed';

const isStandaloneApp = () => (
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
);

const Header = ({ onOpenAlerts, alertCount = 0, isSidebarOpen = false, onToggleSidebar, onHideHeader }) => {
    const { t, lang } = useLanguage();
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
    const [installPrompt, setInstallPrompt] = useState(() => (
        typeof window !== 'undefined' ? (window.deferredPwaPrompt || null) : null
    ));
    const [isIosInstall, setIsIosInstall] = useState(false);
    const [isStandalone, setIsStandalone] = useState(() => (
        typeof window !== 'undefined' && Boolean(isStandaloneApp())
    ));
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            return Boolean(isStandaloneApp() || localStorage.getItem(PWA_INSTALLED_KEY) === 'true');
        } catch {
            return Boolean(isStandaloneApp());
        }
    });

    useEffect(() => {
        const standalone = Boolean(isStandaloneApp());
        setIsStandalone(standalone);

        // Check if pre-captured prompt is in window
        if (window.deferredPwaPrompt && !installPrompt) {
            setInstallPrompt(window.deferredPwaPrompt);
        }

        // Verify if actually installed via getInstalledRelatedApps
        if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
            navigator.getInstalledRelatedApps().then((apps) => {
                if (apps && apps.length > 0) {
                    setIsAppInstalled(true);
                    try { localStorage.setItem(PWA_INSTALLED_KEY, 'true'); } catch {}
                } else if (!standalone) {
                    setIsAppInstalled(false);
                    try { localStorage.removeItem(PWA_INSTALLED_KEY); } catch {}
                }
            }).catch(() => {});
        } else if (standalone) {
            setIsAppInstalled(true);
            try { localStorage.setItem(PWA_INSTALLED_KEY, 'true'); } catch {}
        }

        const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIosInstall(Boolean(isIos && !standalone));

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            window.deferredPwaPrompt = event;
            setInstallPrompt(event);
        };

        const handleAppInstalled = () => {
            setInstallPrompt(null);
            window.deferredPwaPrompt = null;
            setIsIosInstall(false);
            setIsAppInstalled(true);
            setIsStandalone(Boolean(isStandaloneApp()));
            try {
                localStorage.setItem(PWA_INSTALLED_KEY, 'true');
            } catch (error) {
                console.error('Unable to save PWA installation state:', error);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [installPrompt]);

    // Open App in a clean, standalone desktop window without browser bars
    const handleOpenStandaloneWindow = () => {
        setShowInstallGuide(false);
        const winWidth = Math.min(1440, window.screen?.availWidth || 1280);
        const winHeight = Math.min(900, window.screen?.availHeight || 800);
        const left = Math.max(0, Math.round(((window.screen?.availWidth || 1280) - winWidth) / 2));
        const top = Math.max(0, Math.round(((window.screen?.availHeight || 800) - winHeight) / 2));
        window.open(
            window.location.origin,
            'SYSTEM_MDM_PWA_WINDOW',
            `width=${winWidth},height=${winHeight},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
        );
    };

    const handleInstallApp = async () => {
        const activePrompt = installPrompt || (typeof window !== 'undefined' ? window.deferredPwaPrompt : null);

        // Case 1: If browser has 1-click install prompt ready, show native dialog directly!
        if (activePrompt) {
            try {
                await activePrompt.prompt();
                const choice = await activePrompt.userChoice;
                if (choice?.outcome === 'accepted') {
                    setIsAppInstalled(true);
                    try { localStorage.setItem(PWA_INSTALLED_KEY, 'true'); } catch {}
                    setInstallPrompt(null);
                    if (typeof window !== 'undefined') window.deferredPwaPrompt = null;
                }
            } catch (err) {
                console.error('PWA install prompt error:', err);
                setShowInstallGuide(true);
            }
            return;
        }

        // Case 2: If already marked as installed, launching it or showing options
        if (isAppInstalled) {
            handleOpenStandaloneWindow();
            return;
        }

        // Case 3: Browser does not support 1-click prompt (Safari, Firefox, or Chrome URL bar)
        // Show clean Guide Modal with "Open in Window" and browser install instructions!
        setShowInstallGuide(true);
    };

    const handleResetInstallState = () => {
        try {
            localStorage.removeItem(PWA_INSTALLED_KEY);
        } catch {}
        setIsAppInstalled(false);
        setShowInstallGuide(false);
    };

    const formatMoney = (val) => {
        const num = Number(val) || 0;
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const fetchBalance = async () => {
        if (!hasPermission('/dashboard', 'read')) return;
        try {
            const params = new URLSearchParams();
            if (user?.brand) params.set('userBrand', user.brand);
            if (Array.isArray(user?.subBrands) && user.subBrands.length > 0) {
                params.set('userSubBrands', user.subBrands.join(','));
            }
            if (user?.role) params.set('userRole', user.role);
            if (user?.username) params.set('username', user.username);
            if (user?.isImmutable) params.set('isImmutable', 'true');

            const contractParams = new URLSearchParams(params);
            contractParams.set('limit', '999999');

            const [statsRes, contractsRes] = await Promise.all([
                fetch(`${API_BASE}/dashboard/stats?${params.toString()}`),
                fetch(`${API_BASE1}/contracts?${contractParams.toString()}`)
            ]);

            if (!statsRes.ok) {
                throw new Error(`Dashboard stats request failed: HTTP ${statsRes.status}`);
            }
            const data = await statsRes.json();

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
            } else {
                console.error(`Header contracts request failed: HTTP ${contractsRes.status}`);
            }

            const resolvedExpected = totalExpected || data.totalRepaymentExpected || 0;
            const resolvedOutstanding = Math.max(resolvedExpected - totalCustomerPaid, 0);

            setBalance({
                totalLoanAmount: data.totalLoanAmount || 0,
                totalRevenue: data.totalRevenue || 0,
                totalRepaymentExpected: resolvedExpected,
                outstandingBalance: resolvedOutstanding
            });
        } catch (err) {
            console.error('Unable to fetch header financial summary:', err);
        }
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
                    aria-label={isSidebarOpen ? t('headerCloseNavigation', lang === 'km' ? 'បិទម៉ឺនុយរុករក' : 'Close navigation menu') : t('headerOpenNavigation', lang === 'km' ? 'បើកម៉ឺនុយរុករក' : 'Open navigation menu')}
                    title={isSidebarOpen ? t('headerCloseMenu', lang === 'km' ? 'បិទម៉ឺនុយ' : 'Close menu') : t('headerOpenMenu', lang === 'km' ? 'បើកម៉ឺនុយ' : 'Open menu')}
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
                        <p className='text-[9px] text-slate-400 font-semibold tracking-[0.15em] uppercase leading-none mt-0.5'>{t('headerManagementSystem', lang === 'km' ? 'ប្រព័ន្ធគ្រប់គ្រង' : 'Management System')}</p>
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
                        aria-label={t('telegram') || 'Telegram Web'}
                    >
                        <FaTelegramPlane className={`text-sm ${location.pathname === '/telegram' ? 'text-sky-500' : 'text-slate-500'}`} />
                    </Link>
                )}

                {!isStandalone && (
                    <button
                        type='button'
                        onClick={handleInstallApp}
                        className={`flex items-center gap-1.5 h-9 px-2.5 rounded-[8px] border transition-colors cursor-pointer text-xs font-bold ${
                            isAppInstalled
                                ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        title={isAppInstalled ? t('headerOpenInstalledApp', lang === 'km' ? 'បើកកម្មវិធី SYSTEM MDM ដែលបានដំឡើង' : 'Open the installed SYSTEM MDM app') : t('headerInstallApp', lang === 'km' ? 'ដំឡើង SYSTEM MDM' : 'Install SYSTEM MDM')}
                    >
                        {isAppInstalled ? <FaExternalLinkAlt size={12} /> : <FaDownload size={12} />}
                        <span className='hidden sm:inline'>{isAppInstalled ? t('headerOpenApp', lang === 'km' ? 'បើកកម្មវិធី' : 'Open App') : t('headerInstallAppLabel', lang === 'km' ? 'ដំឡើងកម្មវិធី' : 'Install App')}</span>
                    </button>
                )}
            </div>
            {/* Modern, interactive PWA Install & App Launcher Guide Dialog */}
            {showInstallGuide && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-3 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 text-left">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg shadow-inner">
                                    <FaDownload />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">{t('headerSystemMdmApp', lang === 'km' ? 'កម្មវិធី SYSTEM MDM' : 'SYSTEM MDM App')}</h3>
                                    <p className="text-[11px] text-slate-500">{t('headerInstallOrLaunchApp', lang === 'km' ? 'ដំឡើង ឬបើកជាផ្ទាំងកម្មវិធីដាច់ដោយឡែក' : 'Install or launch in a dedicated app window')}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInstallGuide(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Quick 1-Click Action: Open in Dedicated App Window */}
                        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                            <div className="space-y-0.5">
                                <div className="text-xs font-bold text-emerald-950">{t('headerLaunchStandalone', lang === 'km' ? 'បើកជាផ្ទាំងកម្មវិធីដាច់ដោយឡែក' : 'Launch in a standalone app window')}</div>
                                <div className="text-[11px] text-emerald-800 leading-tight">{t('headerStandaloneDescription', lang === 'km' ? 'បើកភ្លាមៗក្នុងផ្ទាំងដាច់ដោយឡែក ដោយគ្មានរបារកម្មវិធីរុករក' : 'Open immediately in a separate window without browser controls')}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenStandaloneWindow}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            >
                                <FaExternalLinkAlt size={11} />
                                <span>{t('headerOpenAsApp', lang === 'km' ? 'បើកជាកម្មវិធី' : 'Open as App')}</span>
                            </button>
                        </div>

                        {/* Step by step browser guides */}
                        <div className="space-y-2 text-xs text-slate-700">
                            <div className="font-bold text-slate-900 text-xs">{t('headerInstallGuideTitle', lang === 'km' ? 'របៀបដំឡើងកម្មវិធីតាមកម្មវិធីរុករក៖' : 'How to install the app from your browser:')}</div>

                            {/* Desktop Chrome / Edge */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                    {t('headerInstallDesktop', lang === 'km' ? 'លើកុំព្យូទ័រ (Google Chrome / Microsoft Edge)៖' : 'On desktop (Google Chrome / Microsoft Edge):')}
                                </div>
                                <p className="text-[11px] text-slate-600 pl-3.5 leading-relaxed">
                                    • {t('headerInstallDesktopStep1', lang === 'km' ? 'នៅខាងស្តាំរបារអាសយដ្ឋាន (URL Bar) ចុចរូបតំណាង [ 💻 Install ] ឬ [ ⊕ ] បន្ទាប់មកចុច Install។' : 'On the right side of the address bar (URL Bar), select [ 💻 Install ] or [ ⊕ ], then select Install.')}<br />
                                    • {t('headerInstallDesktopStep2', lang === 'km' ? 'ឬចុច Menu (⋮) នៅជ្រុងខាងលើស្តាំ > Save and share > Install SYSTEM MDM...' : 'Or select Menu (⋮) in the upper-right corner > Save and share > Install SYSTEM MDM...')}
                                </p>
                            </div>

                            {/* iOS Safari */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                    {t('headerInstallIos', lang === 'km' ? 'លើទូរស័ព្ទ iPhone / iPad (Safari)៖' : 'On iPhone / iPad (Safari):')}
                                </div>
                                <p className="text-[11px] text-slate-600 pl-3.5 leading-relaxed">
                                    • {t('headerInstallIosStep', lang === 'km' ? 'ចុច Share (⎋) នៅរបារខាងក្រោម Safari អូសចុះក្រោម រួចជ្រើសរើស "Add to Home Screen" (➕)។' : 'Tap Share (⎋) at the bottom of Safari, scroll down, then choose "Add to Home Screen" (➕).')}
                                </p>
                            </div>

                            {/* Android Chrome */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                    {t('headerInstallAndroid', lang === 'km' ? 'លើទូរស័ព្ទ Android (Chrome)៖' : 'On Android (Chrome):')}
                                </div>
                                <p className="text-[11px] text-slate-600 pl-3.5 leading-relaxed">
                                    • {t('headerInstallAndroidStep', lang === 'km' ? 'ចុច Menu (⋮) នៅជ្រុងខាងលើស្តាំ រួចជ្រើសរើស "Install app" ឬ "Add to Home screen"។' : 'Tap Menu (⋮) in the upper-right corner, then choose "Install app" or "Add to Home screen".')}
                                </p>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleResetInstallState}
                                className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                                title={t('headerResetInstallStatus', lang === 'km' ? 'កំណត់ស្ថានភាពដំឡើងឡើងវិញ' : 'Reset installation status')}
                            >
                                {t('headerResetStatus', lang === 'km' ? 'កំណត់ឡើងវិញ' : 'Reset Status')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowInstallGuide(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs cursor-pointer transition-all"
                            >
                                យល់ព្រម
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;