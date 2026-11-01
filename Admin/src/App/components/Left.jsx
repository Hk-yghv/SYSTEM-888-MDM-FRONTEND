import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import json from "../../routes/Routes.json";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { FOLLOW_UP_NAMES } from "../../utils/followUpNames";

import { MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineBarChart, MdCalculate, MdOutlinePhotoLibrary } from "react-icons/md";
import { IoMdArrowDropdown, IoIosContact, IoIosSettings, IoMdWallet } from "react-icons/io";
import { FaHistory, FaClipboardCheck, FaMoneyBillWave, FaCalendarAlt, FaUserCircle, FaUserCog, FaSignOutAlt, FaChevronRight, FaGlobe, FaExpand, FaCompress, FaEyeSlash, FaEye, FaTelegramPlane, FaBookmark, FaTasks, FaFileAlt, FaChartBar, FaPrint, FaIdCard, FaQuestionCircle, FaHandsHelping, FaShieldAlt, FaMobileAlt, FaMusic, FaBoxes } from "react-icons/fa";


const Left = ({ isOpen = false, onClose, onHideHeader, isHeaderOpen = true, onToggleHeader }) => {
    const [openMenus, setOpenMenus] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_open_menus');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const isMenuOpen = (menu) => !!openMenus[menu];
    const [accountOpen, setAccountOpen] = useState(false);
    const [langSubmenuOpen, setLangSubmenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const { t, lang, changeLanguage, LANGUAGES } = useLanguage();
    const { user, logout, hasPermission } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

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
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!accountOpen) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('#account-badge-container')) {
                setAccountOpen(false);
                setLangSubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [accountOpen]);

    // Note: Automatic menu closing on route change removed per user requirement - menus remain open until toggled by user

    const handleLogout = async () => {
        try {
            await logout();
            setAccountOpen(false);
            navigate('/signin', { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
            navigate('/signin', { replace: true });
        }
    };

    const toggleMenu = (menu) => {
        setOpenMenus((prev) => {
            const next = { ...prev, [menu]: !prev[menu] };
            try { localStorage.setItem('sidebar_open_menus', JSON.stringify(next)); } catch { }
            return next;
        });
    };

    const isActive = (path) => location.pathname === path;

    // Check if Control Support & Help has ANY configured permissions
    const hasControlSupportHelpPermission =
        hasPermission(json.settings?.controlSupportHelp || '/settings/control-support-help', 'read');

    // Check if Help & Support page link should be visible
    const hasHelpSupportPermission = hasPermission(json.helpSupport || '/help-support', 'read');

    // Scroll-driven edge scaling ref & logic
    const scrollContainerRef = useRef(null);
    const rafIdRef = useRef(null);

    const updateScrollScales = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const scrollHeight = container.scrollHeight;
        const maxScroll = Math.max(0, scrollHeight - clientHeight);

        const items = container.querySelectorAll('.sidebar-nav-item');
        if (items.length === 0) return;

        // If cannot scroll or content fully fits, all items remain normal 1.0
        if (maxScroll <= 4) {
            items.forEach((item) => {
                item.style.setProperty('--scroll-scale', '1');
                item.style.setProperty('--scroll-opacity', '1');
            });
            return;
        }

        // Top progress: 0 when at very top (scrollTop === 0), ramps to 1 as user scrolls down by 70px
        // When at the very top, top items DO NOT shrink!
        const topProgress = Math.min(1, Math.max(0, scrollTop / 70));

        // Bottom progress: 0 when at very bottom, ramps to 1 when scrolled 70px above bottom
        // When at the very bottom, bottom items DO NOT shrink!
        const remainingScroll = Math.max(0, maxScroll - scrollTop);
        const bottomProgress = Math.min(1, Math.max(0, remainingScroll / 70));

        const containerRect = container.getBoundingClientRect();
        const edgeThreshold = 85; // px boundary from top/bottom where shrinking occurs

        items.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2 - containerRect.top;

            let shrink = 0;

            // Near top edge (only shrinks if user has scrolled away from top)
            if (itemCenter < edgeThreshold && topProgress > 0) {
                const factor = Math.max(0, itemCenter / edgeThreshold); // 0 at top, 1 at boundary
                shrink = (1 - factor) * topProgress * 0.16; // up to 16% shrink
            }
            // Near bottom edge (only shrinks if there is more content to scroll below)
            else if (itemCenter > clientHeight - edgeThreshold && bottomProgress > 0) {
                const distFromBottom = clientHeight - itemCenter;
                const factor = Math.max(0, distFromBottom / edgeThreshold); // 0 at bottom, 1 at boundary
                shrink = (1 - factor) * bottomProgress * 0.16; // up to 16% shrink
            }

            const scale = (1 - shrink).toFixed(3);
            const opacity = (1 - shrink * 1.4).toFixed(3);

            item.style.setProperty('--scroll-scale', scale);
            item.style.setProperty('--scroll-opacity', opacity);
        });
    }, []);

    const handleScroll = useCallback(() => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(updateScrollScales);
    }, [updateScrollScales]);

    useEffect(() => {
        updateScrollScales();
        window.addEventListener('resize', updateScrollScales);
        return () => {
            window.removeEventListener('resize', updateScrollScales);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [updateScrollScales, openMenus, isOpen]);

    // Nav item classes — light sidebar style with .sidebar-nav-item for hover elevation & scroll scale
    const navItemClass = (path) =>
        `sidebar-nav-item group relative w-full h-[42px] flex-shrink-0 flex items-center gap-3 px-3 rounded-[8px] text-[13px] font-semibold overflow-hidden active:scale-[0.98] ${isActive(path)
            ? "text-white"
            : "text-slate-700 hover:text-slate-900"
        }`;

    const navItemStyle = (path) => isActive(path)
        ? {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: '1px solid #059669',
            boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
        }
        : {
            background: 'transparent',
            border: '1px solid transparent'
        };

    const navItemHoverStyle = {};

    const subItemClass = (path) =>
        `sidebar-nav-item group relative flex items-center gap-2.5 flex-shrink-0 px-3 py-2 ml-2 text-[12px] font-semibold rounded-[7px] overflow-hidden active:scale-[0.98] ${isActive(path)
            ? "text-white"
            : "text-slate-600 hover:text-slate-900"
        }`;

    const subItemStyle = (path) => isActive(path)
        ? {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: '1px solid #059669',
        }
        : {
            background: '#f8fafc',
            border: '1px solid #e2e8f0'
        };

    const dropdownHeaderClass = () =>
        `sidebar-nav-item group relative w-full h-[42px] flex-shrink-0 flex items-center justify-between px-3 text-slate-700 hover:text-slate-900 rounded-[8px] cursor-pointer text-[13px] font-semibold overflow-hidden active:scale-[0.99]`;

    const dropdownHeaderStyle = (menuName) => openMenus[menuName]
        ? {
            background: '#ecfdf5',
            border: '1px solid #a7f3d0'
        }
        : {
            background: '#f8fafc',
            border: '1px solid #e2e8f0'
        };

    // Section label component
    const SectionLabel = ({ label }) => (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {label}
            </p>
        </div>
    );

    return (
        <aside
            onClick={(event) => {
                if (event.target.closest('a')) {
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onClose?.();
                    }
                }
            }}
            className={`h-full min-h-0 flex-shrink-0 flex flex-col justify-between select-none transition-all duration-300 ease-in-out mobile-sidebar ${isOpen
                ? 'w-[256px] opacity-100 p-2 mobile-sidebar-open'
                : 'w-0 !p-0 !border-r-0 opacity-0 overflow-hidden pointer-events-none'
                }`}
            style={{
                background: '#ffffff',
                borderRight: '1px solid #e2e8f0',
                boxShadow: '2px 0 12px rgba(0,0,0,0.06)'
            }}
        >
            {/* Top Scrollable Navigation Section */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1 flex flex-col custom-scrollbar"
            >

                {/* MAIN NAV */}
                {/* Dashboard */}
                {hasPermission('/dashboard', 'read') && (
                    <Link to={json.dashboard} className={navItemClass(json.dashboard)} style={navItemStyle(json.dashboard)}>
                        <MdDashboard size={18} className={isActive(json.dashboard) ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('dashboard')}
                        {isActive(json.dashboard) && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Cash Flow Trader */}
                {hasPermission(json.cashFlowTrader || '/cashflow/monitor', 'read') && (
                    <Link to={json.cashFlowTrader || '/cashflow/monitor'} className={navItemClass(json.cashFlowTrader || '/cashflow/monitor')} style={navItemStyle(json.cashFlowTrader || '/cashflow/monitor')}>
                        <MdOutlineBarChart size={18} className={isActive(json.cashFlowTrader || '/cashflow/monitor') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('cashFlowTrader')}
                        {isActive(json.cashFlowTrader || '/cashflow/monitor') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Customer */}
                {hasPermission('/customer', 'read') && (
                    <Link to={json.customer} className={navItemClass(json.customer)} style={navItemStyle(json.customer)}>
                        <IoIosContact size={18} className={isActive(json.customer) ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('customer')}
                        {isActive(json.customer) && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Device */}
                {(hasPermission('/device', 'read') ||
                    hasPermission(json.deviceEnrolment || '/device/enrolment', 'read') ||
                    hasPermission(json.phoneValuation || '/phone-valuation', 'read')) && (
                    <>
                        {hasPermission('/device', 'read') && (
                            <Link to={json.device} className={navItemClass(json.device)} style={navItemStyle(json.device)}>
                                <MdOutlinePhoneIphone size={18} className={isActive(json.device) ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                                {t('device')}
                                {isActive(json.device) && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                            </Link>
                        )}
                        {hasPermission(json.deviceEnrolment || '/device/enrolment', 'read') && (
                            <Link
                                to={json.deviceEnrolment || "/device/enrolment"}
                                className={subItemClass(json.deviceEnrolment || "/device/enrolment")}
                                style={subItemStyle(json.deviceEnrolment || "/device/enrolment")}
                            >
                                <FaMobileAlt size={13} />
                                {t('deviceEnrolment')}
                                {isActive(json.deviceEnrolment || "/device/enrolment") && <span className="ml-auto w-1 h-4 rounded-full bg-emerald-400 opacity-80" />}
                            </Link>
                        )}
                        {hasPermission(json.phoneValuation || '/phone-valuation', 'read') && (
                            <Link to={json.phoneValuation || '/phone-valuation'} className={subItemClass(json.phoneValuation || '/phone-valuation')} style={subItemStyle(json.phoneValuation || '/phone-valuation')}>
                                <FaMobileAlt size={13} />
                                {t('phoneValuation')}
                                {isActive(json.phoneValuation || '/phone-valuation') && <span className="ml-auto w-1 h-4 rounded-full bg-emerald-400 opacity-80" />}
                            </Link>
                        )}
                    </>
                )}

                {/* Contract */}
                {(hasPermission(json.contract.application, 'read') ||
                    hasPermission(json.contract.activated, 'read') ||
                    hasPermission(json.contract.check, 'read') ||
                    hasPermission(json.contract.redeem, 'read') ||
                    hasPermission(json.contract.comments, 'read') ||
                    hasPermission(json.contract.blacklist, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("contract")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("contract")}>
                                <span className="flex items-center gap-3">
                                    <MdOutlineContactPhone size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('contract')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["contract"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["contract"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.contract.application, 'read') && (
                                    <Link to={json.contract.application} className={subItemClass(json.contract.application)} style={subItemStyle(json.contract.application)}>{t('application')}</Link>
                                )}
                                {hasPermission(json.contract.activated, 'read') && (
                                    <Link to={json.contract.activated} className={subItemClass(json.contract.activated)} style={subItemStyle(json.contract.activated)}>{t('activated')}</Link>
                                )}
                                {hasPermission(json.contract.check, 'read') && (
                                    <Link to={json.contract.check} className={subItemClass(json.contract.check)} style={subItemStyle(json.contract.check)}>{t('check')}</Link>
                                )}
                                {hasPermission(json.contract.redeem, 'read') && (
                                    <Link to={json.contract.redeem} className={subItemClass(json.contract.redeem)} style={subItemStyle(json.contract.redeem)}>{t('redeem')}</Link>
                                )}
                                {hasPermission(json.contract.comments, 'read') && (
                                    <Link to={json.contract.comments} className={subItemClass(json.contract.comments)} style={subItemStyle(json.contract.comments)}>{t('comments')}</Link>
                                )}
                                {hasPermission(json.contract.blacklist, 'read') && (
                                    <Link to={json.contract.blacklist} className={subItemClass(json.contract.blacklist)} style={subItemStyle(json.contract.blacklist)}>{t('blacklist')}</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Calendar */}
                {hasPermission(json.calendar || '/calendar', 'read') && (
                    <Link to={json.calendar || '/calendar'} className={navItemClass(json.calendar || '/calendar')} style={navItemStyle(json.calendar || '/calendar')}>
                        <FaCalendarAlt size={16} className={isActive(json.calendar || '/calendar') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('khmerCalendar')}
                        {isActive(json.calendar || '/calendar') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Calculate */}
                {(hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') ||
                    hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("calculate")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("calculate")}>
                                <span className="flex items-center gap-3">
                                    <MdCalculate size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('calculate')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["calculate"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["calculate"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') && (
                                    <Link to={json.calculate?.calculateSchedule1 || '/calculate/schedule-1'} className={subItemClass(json.calculate?.calculateSchedule1 || '/calculate/schedule-1')} style={subItemStyle(json.calculate?.calculateSchedule1 || '/calculate/schedule-1')}>
                                        {t('calculateSchedule1')}
                                    </Link>
                                )}
                                {hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read') && (
                                    <Link to={json.calculate?.calculateSchedule2 || '/calculate/schedule-2'} className={subItemClass(json.calculate?.calculateSchedule2 || '/calculate/schedule-2')} style={subItemStyle(json.calculate?.calculateSchedule2 || '/calculate/schedule-2')}>
                                        {t('calculateSchedule2')}
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Installment */}
                {(hasPermission(json.installment.installmentPage, 'read') ||
                    hasPermission(json.installment.installmentPad, 'read') ||
                    hasPermission(json.installment.installmentHistory, 'read') ||
                    hasPermission(json.installment.paymentHistory, 'read') ||
                    hasPermission(json.installment.cashOut, 'read') ||
                    hasPermission(json.installment.cashIn, 'read') ||
                    hasPermission(json.installment.penalty, 'read') ||
                    hasPermission(json.installment.overdue, 'read') ||
                    hasPermission(json.installment.dueToday, 'read') ||
                    hasPermission(json.installment.dueIn3Days, 'read') ||
                    hasPermission(json.installment.overdue3Days, 'read') ||
                    hasPermission(json.installment.unpaidYesterday, 'read') ||
                    hasPermission(json.installment.overdue7Days, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("installment")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("installment")}>
                                <span className="flex items-center gap-3">
                                    <IoMdWallet size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('installment')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["installment"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["installment"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.installment.installmentPage, 'read') && (
                                    <Link to={json.installment.installmentPage} className={subItemClass(json.installment.installmentPage)} style={subItemStyle(json.installment.installmentPage)}>{t('installment')}</Link>
                                )}
                                {hasPermission(json.installment.installmentPad, 'read') && (
                                    <Link to={json.installment.installmentPad} className={subItemClass(json.installment.installmentPad)} style={subItemStyle(json.installment.installmentPad)}>{t('installmentPad')}</Link>
                                )}
                                {hasPermission(json.installment.installmentHistory, 'read') && (
                                    <Link to={json.installment.installmentHistory} className={subItemClass(json.installment.installmentHistory)} style={subItemStyle(json.installment.installmentHistory)}>{t('installmentHistory')}</Link>
                                )}
                                {hasPermission(json.installment.overdue, 'read') && (
                                    <Link to={json.installment.overdue} className={subItemClass(json.installment.overdue)} style={subItemStyle(json.installment.overdue)}>{t('overdueCustomers')}</Link>
                                )}
                                {hasPermission(json.installment.dueToday, 'read') && (
                                    <Link to={json.installment.dueToday} className={subItemClass(json.installment.dueToday)} style={subItemStyle(json.installment.dueToday)}>{t('dueToday')}</Link>
                                )}
                                {hasPermission(json.installment.unpaidYesterday, 'read') && (
                                    <Link to={json.installment.unpaidYesterday} className={subItemClass(json.installment.unpaidYesterday)} style={subItemStyle(json.installment.unpaidYesterday)}>{t('unpaidYesterday')}</Link>
                                )}
                                {hasPermission(json.installment.dueIn3Days, 'read') && (
                                    <Link to={json.installment.dueIn3Days} className={subItemClass(json.installment.dueIn3Days)} style={subItemStyle(json.installment.dueIn3Days)}>{t('dueIn3Days')}</Link>
                                )}
                                {hasPermission(json.installment.overdue3Days, 'read') && (
                                    <Link to={json.installment.overdue3Days} className={subItemClass(json.installment.overdue3Days)} style={subItemStyle(json.installment.overdue3Days)}>{t('overdue3Days')}</Link>
                                )}
                                {hasPermission(json.installment.overdue7Days, 'read') && (
                                    <Link to={json.installment.overdue7Days} className={subItemClass(json.installment.overdue7Days)} style={subItemStyle(json.installment.overdue7Days)}>{t('overdue7Days')}</Link>
                                )}
                                {hasPermission(json.installment.paymentHistory, 'read') && (
                                    <Link to={json.installment.paymentHistory} className={subItemClass(json.installment.paymentHistory)} style={subItemStyle(json.installment.paymentHistory)}>{t('paymentHistory')}</Link>
                                )}
                                {hasPermission(json.installment.cashOut, 'read') && (
                                    <Link to={json.installment.cashOut} className={subItemClass(json.installment.cashOut)} style={subItemStyle(json.installment.cashOut)}>{t('cashOut')}</Link>
                                )}
                                {hasPermission(json.installment.cashIn, 'read') && (
                                    <Link to={json.installment.cashIn} className={subItemClass(json.installment.cashIn)} style={subItemStyle(json.installment.cashIn)}>{t('cashIn')}</Link>
                                )}
                                {hasPermission(json.installment.penalty, 'read') && (
                                    <Link to={json.installment.penalty} className={subItemClass(json.installment.penalty)} style={subItemStyle(json.installment.penalty)}>{t('penalty')}</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Lost Phone */}
                {(hasPermission(json.lostphone.actionLockphone, 'read') ||
                    hasPermission(json.lostphone.lockPhone, 'read') ||
                    hasPermission(json.lostphone.unlockPhone, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("lostphone")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("lostphone")}>
                                <span className="flex items-center gap-3">
                                    <MdOutlinePhoneIphone size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('lostPhone')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["lostphone"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["lostphone"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.lostphone.actionLockphone, 'read') && (
                                    <Link to={json.lostphone.actionLockphone} className={subItemClass(json.lostphone.actionLockphone)} style={subItemStyle(json.lostphone.actionLockphone)}>{t('actions')}</Link>
                                )}
                                {hasPermission(json.lostphone.lockPhone, 'read') && (
                                    <Link to={json.lostphone.lockPhone} className={subItemClass(json.lostphone.lockPhone)} style={subItemStyle(json.lostphone.lockPhone)}>{t('lockPhone')}</Link>
                                )}
                                {hasPermission(json.lostphone.unlockPhone, 'read') && (
                                    <Link to={json.lostphone.unlockPhone} className={subItemClass(json.lostphone.unlockPhone)} style={subItemStyle(json.lostphone.unlockPhone)}>{t('unlockPhone')}</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Wallpaper */}
                {(hasPermission(json.wallpaper.actionWallpaper, 'read') ||
                    hasPermission(json.wallpaper.lockWallpaper, 'read') ||
                    hasPermission(json.wallpaper.unlockWallpaper, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("wallpaper")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("wallpaper")}>
                                <span className="flex items-center gap-3">
                                    <MdOutlineWallpaper size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('wallpaper')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["wallpaper"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["wallpaper"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.wallpaper.actionWallpaper, 'read') && (
                                    <Link to={json.wallpaper.actionWallpaper} className={subItemClass(json.wallpaper.actionWallpaper)} style={subItemStyle(json.wallpaper.actionWallpaper)}>{t('actions')}</Link>
                                )}
                                {hasPermission(json.wallpaper.lockWallpaper, 'read') && (
                                    <Link to={json.wallpaper.lockWallpaper} className={subItemClass(json.wallpaper.lockWallpaper)} style={subItemStyle(json.wallpaper.lockWallpaper)}>{t('lockWallpaper')}</Link>
                                )}
                                {hasPermission(json.wallpaper.unlockWallpaper, 'read') && (
                                    <Link to={json.wallpaper.unlockWallpaper} className={subItemClass(json.wallpaper.unlockWallpaper)} style={subItemStyle(json.wallpaper.unlockWallpaper)}>{t('unlockWallpaper')}</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Report */}
                {(hasPermission(json.report.allCustomers, 'read') ||
                   hasPermission(json.report.daily, 'read') ||
                   hasPermission(json.report.reportAll, 'read') ||
                    hasPermission(json.report.activated, 'read') ||
                    hasPermission(json.report.redeem, 'read') ||
                    hasPermission(json.report.lockPhone, 'read') ||
                    hasPermission(json.report.setWallpaper, 'read') ||
                    hasPermission(json.report.installment, 'read') ||
                    hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') ||
                    hasPermission(json.report?.followUp4Report || '/report/follow-up-4', 'read') ||
                    hasPermission(json.report?.reportTelegram || '/audit/telegram/report', 'read') ||
                    [1, 2, 3, 4].some((workspaceId) => hasPermission(`/audit/telegram/report/follow-up-${workspaceId}`, 'read')) ||
                    hasPermission(json.audit?.telegram || '/audit/telegram', 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("report")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("report")}>
                                <span className="flex items-center gap-3">
                                    <MdOutlineBarChart size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    <span>{t('report')}</span>
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["report"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["report"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.report.allCustomers, 'read') && (
                                    <Link to={json.report.allCustomers} className={subItemClass(json.report.allCustomers)} style={subItemStyle(json.report.allCustomers)}>{t('allCustomerReport')}</Link>
                                )}
                                {hasPermission(json.report.daily, 'read') && (
                                    <Link to={json.report.daily} className={subItemClass(json.report.daily)} style={subItemStyle(json.report.daily)}>{t('dailyReport')}</Link>
                                )}
                                {hasPermission(json.report.reportAll, 'read') && (
                                    <Link to={json.report.reportAll} className={subItemClass(json.report.reportAll)} style={subItemStyle(json.report.reportAll)}>{t('reportAll')}</Link>
                                )}
                                {hasPermission(json.report.activated, 'read') && (
                                    <Link to={json.report.activated} className={subItemClass(json.report.activated)} style={subItemStyle(json.report.activated)}>{t('activatedReport')}</Link>
                                )}
                                {hasPermission(json.report.redeem, 'read') && (
                                    <Link to={json.report.redeem} className={subItemClass(json.report.redeem)} style={subItemStyle(json.report.redeem)}>{t('redeemReport')}</Link>
                                )}
                                {hasPermission(json.report.lockPhone, 'read') && (
                                    <Link to={json.report.lockPhone} className={subItemClass(json.report.lockPhone)} style={subItemStyle(json.report.lockPhone)}>{t('lockPhoneReport')}</Link>
                                )}
                                {hasPermission(json.report.setWallpaper, 'read') && (
                                    <Link to={json.report.setWallpaper} className={subItemClass(json.report.setWallpaper)} style={subItemStyle(json.report.setWallpaper)}>{t('setWallpaperReport')}</Link>
                                )}
                                {hasPermission(json.report.installment, 'read') && (
                                    <Link to={json.report.installment} className={subItemClass(json.report.installment)} style={subItemStyle(json.report.installment)}>{t('installmentReport')}</Link>
                                )}
                                {(hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') || hasPermission('/follow-up/report', 'read')) && (
                                    <Link to={json.report?.followUpReport || '/report/follow-up'} className={subItemClass(json.report?.followUpReport || '/report/follow-up')} style={subItemStyle(json.report?.followUpReport || '/report/follow-up')}>{t('followUpReport')}</Link>
                                )}
                                {hasPermission(json.report?.followUp4Report || '/report/follow-up-4', 'read') && (
                                    <Link to={json.report?.followUp4Report || '/report/follow-up-4'} className={subItemClass(json.report?.followUp4Report || '/report/follow-up-4')} style={subItemStyle(json.report?.followUp4Report || '/report/follow-up-4')}>{t('followUp4Report')}</Link>
                                )}
                                {(hasPermission(json.report?.reportTelegram || '/audit/telegram/report', 'read') ||
                                    [1, 2, 3, 4].some((workspaceId) => hasPermission(`/audit/telegram/report/follow-up-${workspaceId}`, 'read')) ||
                                    hasPermission(json.audit?.telegram || '/audit/telegram', 'read')) && (
                                    <Link to={json.report?.reportTelegram || json.audit?.reportTelegram || '/audit/telegram/report'} className={subItemClass(json.report?.reportTelegram || '/audit/telegram/report')} style={subItemStyle(json.report?.reportTelegram || '/audit/telegram/report')}>
                                        {t('reportAuditTelegram')}
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* History */}
                {(hasPermission(json.history?.loginHistory || '/history/login-history', 'read') ||
                    hasPermission(json.history?.deviceHistory || '/history/device-history', 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("history")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("history")}>
                                <span className="flex items-center gap-3">
                                    <FaHistory size={16} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('history')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["history"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["history"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.history?.loginHistory || '/history/login-history', 'read') && (
                                    <Link to={json.history?.loginHistory || '/history/login-history'} className={subItemClass(json.history?.loginHistory || '/history/login-history')} style={subItemStyle(json.history?.loginHistory || '/history/login-history')}>{t('loginHistory')}</Link>
                                )}
                                {hasPermission(json.history?.deviceHistory || '/history/device-history', 'read') && (
                                    <Link to={json.history?.deviceHistory || '/history/device-history'} className={subItemClass(json.history?.deviceHistory || '/history/device-history')} style={subItemStyle(json.history?.deviceHistory || '/history/device-history')}>{t('deviceHistory')}</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Follow Up */}
                {(hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') ||
                    hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') ||
                    hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') ||
                    hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') ||
                    hasPermission('/follow-up/sen-sok', 'read') ||
                    hasPermission(json.followUp?.followUpReport || '/report/follow-up', 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("followUp")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("followUp")}>
                                <span className="flex items-center gap-3">
                                    <FaClipboardCheck size={16} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    <span>{t('followUp')}</span>
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["followUp"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["followUp"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') && (
                                    <Link to={json.followUp?.followUp1 || '/follow-up/follow-up-1'} className={subItemClass(json.followUp?.followUp1 || '/follow-up/follow-up-1')} style={subItemStyle(json.followUp?.followUp1 || '/follow-up/follow-up-1')}>
                                        {FOLLOW_UP_NAMES[1]}
                                    </Link>
                                )}
                                {hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') && (
                                    <Link to={json.followUp?.followUp2 || '/follow-up/follow-up-2'} className={subItemClass(json.followUp?.followUp2 || '/follow-up/follow-up-2')} style={subItemStyle(json.followUp?.followUp2 || '/follow-up/follow-up-2')}>
                                        {FOLLOW_UP_NAMES[2]}
                                    </Link>
                                )}
                                {(hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') ||
                                    hasPermission('/follow-up/sen-sok', 'read')) && (
                                        <Link to={json.followUp?.followUp3 || '/follow-up/follow-up-3'} className={subItemClass(json.followUp?.followUp3 || '/follow-up/follow-up-3')} style={subItemStyle(json.followUp?.followUp3 || '/follow-up/follow-up-3')}>
                                            {FOLLOW_UP_NAMES[3]}
                                        </Link>
                                    )}
                                {hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') && (
                                    <Link to={json.followUp?.followUp4 || '/follow-up/follow-up-4'} className={subItemClass(json.followUp?.followUp4 || '/follow-up/follow-up-4')} style={subItemStyle(json.followUp?.followUp4 || '/follow-up/follow-up-4')}>
                                        {FOLLOW_UP_NAMES[4]}
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Inventory */}
                {(hasPermission(json.inventory.senSok, 'read') ||
                    hasPermission(json.inventory.chbarAmpov, 'read') ||
                    hasPermission(json.inventory.stuengMeanChey, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("inventory")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("inventory")}>
                                <span className="flex items-center gap-3">
                                    <FaBoxes size={16} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    <span>{t('inventory')}</span>
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["inventory"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["inventory"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission(json.inventory.senSok, 'read') && (
                                    <Link to={json.inventory.senSok} className={subItemClass(json.inventory.senSok)} style={subItemStyle(json.inventory.senSok)}>SEN SOK</Link>
                                )}
                                {hasPermission(json.inventory.chbarAmpov, 'read') && (
                                    <Link to={json.inventory.chbarAmpov} className={subItemClass(json.inventory.chbarAmpov)} style={subItemStyle(json.inventory.chbarAmpov)}>CHBAR AMPOV</Link>
                                )}
                                {hasPermission(json.inventory.stuengMeanChey, 'read') && (
                                    <Link to={json.inventory.stuengMeanChey} className={subItemClass(json.inventory.stuengMeanChey)} style={subItemStyle(json.inventory.stuengMeanChey)}>STUENG MEAN CHEY</Link>
                                )}
                            </div>
                        </div>
                    )}

                {/* Salary */}
                {hasPermission(json.salary || '/salary', 'read') && (
                    <Link to={json.salary || '/salary'} className={navItemClass(json.salary || '/salary')} style={navItemStyle(json.salary || '/salary')}>
                        <FaMoneyBillWave size={16} className={isActive(json.salary || '/salary') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('salary')}
                        {isActive(json.salary || '/salary') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* All Picture */}
                {hasPermission(json.allPicture || '/all-picture', 'read') && (
                    <Link to={json.allPicture || '/all-picture'} className={navItemClass(json.allPicture || '/all-picture')} style={navItemStyle(json.allPicture || '/all-picture')}>
                        <MdOutlinePhotoLibrary size={18} className={isActive(json.allPicture || '/all-picture') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('allPicture')}
                        {isActive(json.allPicture || '/all-picture') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Save URL */}
                {hasPermission(json.saveUrl || '/save-url', 'read') && (
                    <Link to={json.saveUrl || '/save-url'} className={navItemClass(json.saveUrl || '/save-url')} style={navItemStyle(json.saveUrl || '/save-url')}>
                        <FaBookmark size={15} className={isActive(json.saveUrl || '/save-url') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('saveUrl')}
                        {isActive(json.saveUrl || '/save-url') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Audit */}
                {(hasPermission(json.audit?.telegram || '/audit/telegram', 'read') ||
                    hasPermission(json.audit?.device || '/audit/device', 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("audit")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("audit")}>
                            <span className="flex items-center gap-3">
                                <FaTasks size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                {t('audit')}
                            </span>
                            <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-500 ${openMenus["audit"] ? "rotate-180 text-emerald-400" : ""}`} />
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ${openMenus["audit"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.audit?.telegram || '/audit/telegram', 'read') && (
                                <Link to={json.audit?.telegram || '/audit/telegram'} className={subItemClass(json.audit?.telegram || '/audit/telegram')} style={subItemStyle(json.audit?.telegram || '/audit/telegram')}>
                                    <FaFileAlt size={12} />
                                    {t('auditTelegram')}
                                </Link>
                            )}
                            {hasPermission(json.audit?.device || '/audit/device', 'read') && (
                                <Link to={json.audit?.device || '/audit/device'} className={subItemClass(json.audit?.device || '/audit/device')} style={subItemStyle(json.audit?.device || '/audit/device')}>
                                    <FaFileAlt size={12} />
                                    {t('auditDevice')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Print */}
                {hasPermission(json.print?.idCard || '/print/id-card', 'read') && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("print")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("print")}>
                            <span className="flex items-center gap-3">
                                <FaPrint size={15} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                <span>{t('print')}</span>
                            </span>
                            <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-500 ${openMenus["print"] ? "rotate-180 text-emerald-400" : ""}`} />
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ${openMenus["print"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.print?.idCard || '/print/id-card', 'read') && (
                                <Link to={json.print?.idCard || '/print/id-card'} className={subItemClass(json.print?.idCard || '/print/id-card')} style={subItemStyle(json.print?.idCard || '/print/id-card')}>
                                    <FaIdCard size={12} />
                                    {t('printIdCard')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Help & Support — only show if user has permission */}
                {hasHelpSupportPermission && (
                    <Link to={json.helpSupport || '/help-support'} className={navItemClass(json.helpSupport || '/help-support')} style={navItemStyle(json.helpSupport || '/help-support')}>
                        <FaQuestionCircle size={16} className={isActive(json.helpSupport || '/help-support') ? "text-white" : "text-emerald-600 group-hover:text-emerald-700 transition-colors"} />
                        {t('helpSupport')}
                        {isActive(json.helpSupport || '/help-support') && <span className="ml-auto w-1 h-5 rounded-full bg-emerald-400 opacity-80" />}
                    </Link>
                )}

                {/* Settings */}
                {(hasPermission('/settings/all-account', 'read') ||
                    hasPermission(json.settings.controlSystem, 'read') ||
                    hasPermission(json.settings.products || '/settings/products', 'read') ||
                    hasControlSupportHelpPermission ||
                    hasPermission(json.settings.systemLogs, 'read')) && (
                        <div className="flex-shrink-0">
                            <div onClick={() => toggleMenu("setting")} className={dropdownHeaderClass()} style={dropdownHeaderStyle("setting")}>
                                <span className="flex items-center gap-3">
                                    <IoIosSettings size={18} className="text-emerald-600 group-hover:text-emerald-700 transition-colors" />
                                    {t('settings')}
                                </span>
                                <IoMdArrowDropdown size={18} className={`transition-transform duration-300 text-slate-400 ${openMenus["setting"] ? "rotate-180 text-emerald-600" : ""}`} />
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${openMenus["setting"] ? "max-h-[1000px] mt-1 space-y-1" : "max-h-0"}`}>
                                {hasPermission('/settings/all-account', 'read') && (
                                    <Link to="/settings/all-account" className={subItemClass('/settings/all-account')} style={subItemStyle('/settings/all-account')}>{t('allAccount')}</Link>
                                )}
                                {hasPermission('/settings/all-account', 'read') && (
                                    <Link to={json.settings.accountMap || '/settings/account-map'} className={subItemClass(json.settings.accountMap || '/settings/account-map')} style={subItemStyle(json.settings.accountMap || '/settings/account-map')}>
                                        Account Map
                                    </Link>
                                )}
                                {hasPermission(json.settings.controlSystem, 'read') && (
                                    <Link to={json.settings.controlSystem} className={subItemClass(json.settings.controlSystem)} style={subItemStyle(json.settings.controlSystem)}>{t('controlSystem')}</Link>
                                )}
                                {hasPermission(json.settings.products || '/settings/products', 'read') && (
                                    <Link to={json.settings.products || '/settings/products'} className={subItemClass(json.settings.products || '/settings/products')} style={subItemStyle(json.settings.products || '/settings/products')}>
                                        <FaMobileAlt size={10} className="opacity-60" />
                                        {t('phoneProducts')}
                                    </Link>
                                )}
                                {/* Control Support & Help — hide completely when no permissions at all */}
                                {hasControlSupportHelpPermission && (
                                    <Link to={json.settings?.controlSupportHelp || '/settings/control-support-help'} className={subItemClass(json.settings?.controlSupportHelp || '/settings/control-support-help')} style={subItemStyle(json.settings?.controlSupportHelp || '/settings/control-support-help')}>
                                        <FaShieldAlt size={10} className="opacity-60" />
                                        {t('controlSupportHelp')}
                                    </Link>
                                )}
                                {hasPermission(json.settings.systemLogs, 'read') && (
                                    <Link to={json.settings.systemLogs} className={subItemClass(json.settings.systemLogs)} style={subItemStyle(json.settings.systemLogs)}>{t('systemLogs')}</Link>
                                )}
                            </div>
                        </div>
                    )}
            </div>

            {/* Bottom Account User Badge Section */}
            <div id="account-badge-container" className="pt-2 flex-shrink-0 relative" style={{ borderTop: '1px solid #e2e8f0' }}>
                {/* Account Menu Popover */}
                {accountOpen && (
                    <div
                        className="absolute left-[calc(100%+8px)] bottom-0 w-[248px] rounded-[14px] p-2.5 z-[99999] animate-in fade-in slide-in-from-left-2 duration-200"
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
                        }}
                    >
                        {/* User Info Card */}
                        <div className="p-3 mb-2 rounded-[10px]" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>
                                    <FaUserCircle className="w-5 h-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'HAK YONGHOUV'}</p>
                                    <p className="text-[10px] text-emerald-600 font-mono mt-0.5 truncate">{user?.email || 'yonghouvh@gmail.com'}</p>
                                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1"
                                        style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
                                        {user?.role || t('admin')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="space-y-0.5">
                            <Link
                                to="/profile"
                                onClick={() => setAccountOpen(false)}
                                className="w-full h-[36px] flex items-center gap-2.5 px-3 rounded-[8px] transition-all cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <FaUserCog className="text-sm text-emerald-600" />
                                <span>{t('profile')}</span>
                            </Link>

                            <Link
                                to={json.music || '/music'}
                                onClick={() => setAccountOpen(false)}
                                className="w-full h-[36px] flex items-center gap-2.5 px-3 rounded-[8px] transition-all cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <FaMusic className="text-sm text-violet-600" />
                                <span>Music</span>
                            </Link>

                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="w-full h-[36px] flex items-center justify-between px-3 rounded-[8px] transition-all cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="flex items-center gap-2.5">
                                    {isFullscreen ? <FaCompress className="text-sm text-emerald-600" /> : <FaExpand className="text-sm text-emerald-600" />}
                                    <span>{isFullscreen ? t('exitFullscreen') : t('fullscreen')}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">F11</span>
                            </button>

                            {/* Language Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setLangSubmenuOpen(!langSubmenuOpen)}
                                    className="w-full h-[36px] flex items-center justify-between px-3 rounded-[8px] transition-all cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900"
                                    style={{ background: langSubmenuOpen ? '#ecfdf5' : 'transparent' }}
                                    onMouseEnter={e => { if (!langSubmenuOpen) e.currentTarget.style.background = '#f1f5f9' }}
                                    onMouseLeave={e => { if (!langSubmenuOpen) e.currentTarget.style.background = 'transparent' }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <FaGlobe className="text-sm text-emerald-600" />
                                        <span>{t('selectLanguage')}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm">{currentLangObj.flag}</span>
                                        <IoMdArrowDropdown className={`text-slate-400 transition-transform duration-200 ${langSubmenuOpen ? 'rotate-90 text-emerald-600' : '-rotate-90'}`} />
                                    </div>
                                </button>

                                {langSubmenuOpen && (
                                    <div
                                        className="absolute left-[calc(100%+8px)] bottom-0 w-[210px] rounded-[14px] p-2 z-[100000] animate-in fade-in slide-in-from-left-2 duration-200 max-h-[280px] overflow-y-auto space-y-0.5 custom-scrollbar"
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 12px 40px rgba(0,0,0,0.12)'
                                        }}
                                    >
                                        <p className="text-[9px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 mb-1">
                                            {t('selectLanguage')}
                                        </p>
                                        {LANGUAGES.map((l) => (
                                            <button
                                                key={l.code}
                                                type="button"
                                                onClick={() => {
                                                    changeLanguage(l.code);
                                                    setLangSubmenuOpen(false);
                                                    setAccountOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-xs transition-all cursor-pointer ${lang === l.code ? 'text-emerald-800 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                                style={{ background: lang === l.code ? '#dcfce7' : 'transparent' }}
                                                onMouseEnter={e => { if (lang !== l.code) e.currentTarget.style.background = '#f1f5f9' }}
                                                onMouseLeave={e => { if (lang !== l.code) e.currentTarget.style.background = 'transparent' }}
                                            >
                                                <span className="flex items-center gap-2.5 font-medium">
                                                    <span className="text-base">{l.flag}</span>
                                                    <span>{l.label}</span>
                                                </span>
                                                {lang === l.code && <span className="text-emerald-600 text-[11px] font-black">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Toggle Header */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (onToggleHeader) {
                                        onToggleHeader();
                                    } else {
                                        onHideHeader?.();
                                    }
                                    setAccountOpen(false);
                                }}
                                className="w-full h-[36px] flex items-center justify-between px-3 rounded-[8px] transition-all cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="flex items-center gap-2.5">
                                    {isHeaderOpen ? (
                                        <FaEyeSlash className="text-sm text-emerald-600" />
                                    ) : (
                                        <FaEye className="text-sm text-emerald-600" />
                                    )}
                                    <span>{isHeaderOpen ? t('hideHeader') : t('showHeader')}</span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                                    background: isHeaderOpen ? '#f1f5f9' : '#dcfce7',
                                    color: isHeaderOpen ? '#64748b' : '#16a34a'
                                }}>
                                    {isHeaderOpen ? t('hide') : t('show')}
                                </span>
                            </button>

                            {/* Logout */}
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full h-[36px] flex items-center gap-2.5 px-3 rounded-[8px] transition-all cursor-pointer text-xs font-semibold text-rose-600 hover:text-rose-700 mt-1"
                                style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <FaSignOutAlt className="text-sm text-rose-500" />
                                <span>{t('logout')}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Account Badge Pill */}
                <div
                    onClick={() => setAccountOpen(!accountOpen)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-[12px] transition-all cursor-pointer group"
                    style={{
                        background: accountOpen ? '#ecfdf5' : '#f8fafc',
                        border: accountOpen ? '1px solid #6ee7b7' : '1px solid #e2e8f0'
                    }}
                    onMouseEnter={e => {
                        if (!accountOpen) {
                            e.currentTarget.style.background = '#f0fdf4';
                            e.currentTarget.style.borderColor = '#a7f3d0';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!accountOpen) {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                    }}
                    title={user?.name || t('userAccount', lang === 'km' ? 'គណនីអ្នកប្រើប្រាស់' : 'User Account')}
                >
                    <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}
                    >
                        <FaUserCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                            {user?.name || 'HAK YONGHOUV'}{user?.brand ? ` (${user.brand.toUpperCase()})` : ' (888MDM)'}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-mono leading-none mt-0.5 truncate">
                            {user?.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '@houv'}
                        </p>
                    </div>
                    <FaChevronRight className={`text-[10px] text-slate-400 transition-transform duration-200 flex-shrink-0 ${accountOpen ? 'rotate-180 text-emerald-600' : 'group-hover:text-emerald-600'}`} />
                </div>
            </div>
        </aside>
    );
};

export default Left;