import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import json from "../../routes/Routes.json";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

import { MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineBarChart, MdCalculate } from "react-icons/md";
import { IoMdArrowDropdown, IoIosContact, IoIosSettings, IoMdWallet } from "react-icons/io";
import { FaHistory, FaClipboardCheck, FaMoneyBillWave, FaCalendarAlt, FaUserCircle, FaUserCog, FaSignOutAlt, FaChevronUp, FaGlobe, FaExpand, FaCompress, FaEyeSlash, FaEye, FaTelegramPlane } from "react-icons/fa";

const Left = ({ isOpen = false, onClose, onHideHeader, isHeaderOpen = true, onToggleHeader }) => {
    const [openMenu, setOpenMenu] = useState("");
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
        setOpenMenu(openMenu === menu ? "" : menu);
    };

    const isActive = (path) => location.pathname === path;

    const navItemClass = (path) =>
        `group relative w-full h-[44px] flex-shrink-0 flex items-center gap-3 px-3 rounded-[6px] text-sm font-semibold overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md hover:shadow-emerald-500/10 active:scale-[0.98] active:translate-y-[1px] ${isActive(path)
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border border-emerald-500"
            : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 shadow-2xs"
        }`;

    const subItemClass = (path) =>
        `group relative flex items-center gap-2 flex-shrink-0 px-3.5 py-2.5 ml-3 text-xs font-bold rounded-[6px] overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-sm hover:shadow-emerald-500/10 active:scale-[0.98] active:translate-y-[1px] ${isActive(path)
            ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
            : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200"
        }`;

    const dropdownHeaderClass = (menuName) =>
        `group relative w-full h-[44px] flex-shrink-0 flex items-center justify-between px-3 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-[6px] cursor-pointer text-sm font-semibold overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.005] hover:shadow-sm hover:shadow-emerald-500/10 active:scale-[0.99] active:translate-y-[1px] shadow-2xs`;

    return (
        <aside
            onClick={(event) => {
                if (event.target.closest('a')) {
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onClose?.();
                    }
                }
            }}
            className={`h-full min-h-0 flex-shrink-0 border-r flex flex-col justify-between select-none bg-white transition-all duration-300 ease-in-out mobile-sidebar ${
                isOpen
                    ? 'w-[260px] opacity-100 p-2 mobile-sidebar-open'
                    : 'w-0 !p-0 !border-r-0 opacity-0 overflow-hidden pointer-events-none'
            }`}
            style={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0'
            }}
        >
            {/* Top Scrollable Navigation Section */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar flex flex-col">
                {/* Dashboard */}
                {hasPermission('/dashboard', 'read') && (
                <Link to={json.dashboard} className={navItemClass(json.dashboard)}>
                    <MdDashboard size={20} className={isActive(json.dashboard) ? "text-white" : "text-emerald-600"} />
                    {t('dashboard')}
                </Link>
            )}

            {/* Customer */}
            {hasPermission('/customer', 'read') && (
                <Link to={json.customer} className={navItemClass(json.customer)}>
                    <IoIosContact size={20} className={isActive(json.customer) ? "text-white" : "text-emerald-600"} />
                    {t('customer')}
                </Link>
            )}

            {/* Device */}
            {hasPermission('/device', 'read') && (
                <Link to={json.device} className={navItemClass(json.device)}>
                    <MdOutlinePhoneIphone size={20} className={isActive(json.device) ? "text-white" : "text-emerald-600"} />
                    {t('device')}
                </Link>
            )}

            {/* Contract */}
            {(hasPermission(json.contract.application, 'read') ||
                hasPermission(json.contract.activated, 'read') ||
                hasPermission(json.contract.check, 'read') ||
                hasPermission(json.contract.redeem, 'read') ||
                hasPermission(json.contract.comments, 'read') ||
                hasPermission(json.contract.blacklist, 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("contract")} className={dropdownHeaderClass("contract")}>
                            <p className="flex items-center gap-3">
                                <MdOutlineContactPhone size={20} className="text-emerald-600" />
                                {t('contract')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "contract" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "contract" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.contract.application, 'read') && (
                                <Link to={json.contract.application} className={subItemClass(json.contract.application)}>{t('application')}</Link>
                            )}
                            {hasPermission(json.contract.activated, 'read') && (
                                <Link to={json.contract.activated} className={subItemClass(json.contract.activated)}>{t('activated')}</Link>
                            )}
                            {hasPermission(json.contract.check, 'read') && (
                                <Link to={json.contract.check} className={subItemClass(json.contract.check)}>{t('check')}</Link>
                            )}
                            {hasPermission(json.contract.redeem, 'read') && (
                                <Link to={json.contract.redeem} className={subItemClass(json.contract.redeem)}>{t('redeem')}</Link>
                            )}
                            {hasPermission(json.contract.comments, 'read') && (
                                <Link to={json.contract.comments} className={subItemClass(json.contract.comments)}>{t('comments')}</Link>
                            )}
                            {hasPermission(json.contract.blacklist, 'read') && (
                                <Link to={json.contract.blacklist} className={subItemClass(json.contract.blacklist)}>{t('blacklist')}</Link>
                            )}
                        </div>
                    </div>
                )}

            {hasPermission(json.calendar || '/calendar', 'read') && (
                <Link to={json.calendar || '/calendar'} className={navItemClass(json.calendar || '/calendar')}>
                    <FaCalendarAlt size={18} className={isActive(json.calendar || '/calendar') ? "text-white" : "text-emerald-600"} />
                    {t('khmerCalendar')}
                </Link>
            )}

            {/* Calculate */}
            {(hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') ||
                hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("calculate")} className={dropdownHeaderClass("calculate")}>
                            <p className="flex items-center gap-3">
                                <MdCalculate size={20} className="text-emerald-600" />
                                {t('calculate')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "calculate" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "calculate" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') && (
                                <Link to={json.calculate?.calculateSchedule1 || '/calculate/schedule-1'} className={subItemClass(json.calculate?.calculateSchedule1 || '/calculate/schedule-1')}>
                                    {t('calculateSchedule1')}
                                </Link>
                            )}
                            {hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read') && (
                                <Link to={json.calculate?.calculateSchedule2 || '/calculate/schedule-2'} className={subItemClass(json.calculate?.calculateSchedule2 || '/calculate/schedule-2')}>
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
                        <div onClick={() => toggleMenu("installment")} className={dropdownHeaderClass("installment")}>
                            <p className="flex items-center gap-3">
                                <IoMdWallet size={20} className="text-emerald-600" />
                                {t('installment')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "installment" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "installment" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.installment.installmentPage, 'read') && (
                                <Link to={json.installment.installmentPage} className={subItemClass(json.installment.installmentPage)}>{t('installment')}</Link>
                            )}
                            {hasPermission(json.installment.installmentPad, 'read') && (
                                <Link to={json.installment.installmentPad} className={subItemClass(json.installment.installmentPad)}>{t('installmentPad')}</Link>
                            )}
                            {hasPermission(json.installment.installmentHistory, 'read') && (
                                <Link to={json.installment.installmentHistory} className={subItemClass(json.installment.installmentHistory)}>{t('installmentHistory')}</Link>
                            )}
                            {hasPermission(json.installment.overdue, 'read') && (
                                <Link to={json.installment.overdue} className={subItemClass(json.installment.overdue)}>{t('overdueCustomers')}</Link>
                            )}
                            {hasPermission(json.installment.dueToday, 'read') && (
                                <Link to={json.installment.dueToday} className={subItemClass(json.installment.dueToday)}>{t('dueToday')}</Link>
                            )}
                            {hasPermission(json.installment.unpaidYesterday, 'read') && (
                                <Link to={json.installment.unpaidYesterday} className={subItemClass(json.installment.unpaidYesterday)}>{t('unpaidYesterday')}</Link>
                            )}
                            {hasPermission(json.installment.dueIn3Days, 'read') && (
                                <Link to={json.installment.dueIn3Days} className={subItemClass(json.installment.dueIn3Days)}>{t('dueIn3Days')}</Link>
                            )}
                            {hasPermission(json.installment.overdue3Days, 'read') && (
                                <Link to={json.installment.overdue3Days} className={subItemClass(json.installment.overdue3Days)}>{t('overdue3Days')}</Link>
                            )}
                            {hasPermission(json.installment.overdue7Days, 'read') && (
                                <Link to={json.installment.overdue7Days} className={subItemClass(json.installment.overdue7Days)}>{t('overdue7Days')}</Link>
                            )}
                            {hasPermission(json.installment.paymentHistory, 'read') && (
                                <Link to={json.installment.paymentHistory} className={subItemClass(json.installment.paymentHistory)}>{t('paymentHistory')}</Link>
                            )}
                            {hasPermission(json.installment.cashOut, 'read') && (
                                <Link to={json.installment.cashOut} className={subItemClass(json.installment.cashOut)}>{t('cashOut')}</Link>
                            )}
                            {hasPermission(json.installment.cashIn, 'read') && (
                                <Link to={json.installment.cashIn} className={subItemClass(json.installment.cashIn)}>{t('cashIn')}</Link>
                            )}
                            {hasPermission(json.installment.penalty, 'read') && (
                                <Link to={json.installment.penalty} className={subItemClass(json.installment.penalty)}>{t('penalty')}</Link>
                            )}

                        </div>
                    </div>
                )}

            {/* Lost Phone */}
            {(hasPermission(json.lostphone.actionLockphone, 'read') ||
                hasPermission(json.lostphone.lockPhone, 'read') ||
                hasPermission(json.lostphone.unlockPhone, 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("lostphone")} className={dropdownHeaderClass("lostphone")}>
                            <p className="flex items-center gap-3">
                                <MdOutlinePhoneIphone size={20} className="text-emerald-600" />
                                {t('lostPhone')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "lostphone" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "lostphone" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.lostphone.actionLockphone, 'read') && (
                                <Link to={json.lostphone.actionLockphone} className={subItemClass(json.lostphone.actionLockphone)}>{t('actions')}</Link>
                            )}
                            {hasPermission(json.lostphone.lockPhone, 'read') && (
                                <Link to={json.lostphone.lockPhone} className={subItemClass(json.lostphone.lockPhone)}>{t('lockPhone')}</Link>
                            )}
                            {hasPermission(json.lostphone.unlockPhone, 'read') && (
                                <Link to={json.lostphone.unlockPhone} className={subItemClass(json.lostphone.unlockPhone)}>{t('unlockPhone')}</Link>
                            )}
                        </div>
                    </div>
                )}

            {/* Wallpaper */}
            {(hasPermission(json.wallpaper.actionWallpaper, 'read') ||
                hasPermission(json.wallpaper.lockWallpaper, 'read') ||
                hasPermission(json.wallpaper.unlockWallpaper, 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("wallpaper")} className={dropdownHeaderClass("wallpaper")}>
                            <p className="flex items-center gap-3">
                                <MdOutlineWallpaper size={20} className="text-emerald-600" />
                                {t('wallpaper')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "wallpaper" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "wallpaper" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.wallpaper.actionWallpaper, 'read') && (
                                <Link to={json.wallpaper.actionWallpaper} className={subItemClass(json.wallpaper.actionWallpaper)}>{t('actions')}</Link>
                            )}
                            {hasPermission(json.wallpaper.lockWallpaper, 'read') && (
                                <Link to={json.wallpaper.lockWallpaper} className={subItemClass(json.wallpaper.lockWallpaper)}>{t('lockWallpaper')}</Link>
                            )}
                            {hasPermission(json.wallpaper.unlockWallpaper, 'read') && (
                                <Link to={json.wallpaper.unlockWallpaper} className={subItemClass(json.wallpaper.unlockWallpaper)}>{t('unlockWallpaper')}</Link>
                            )}
                        </div>
                    </div>
                )}

            {/* Report Droplist Menu */}
            {(hasPermission(json.report.allCustomers, 'read') ||
                hasPermission(json.report.reportAll, 'read') ||
                hasPermission(json.report.activated, 'read') ||
                hasPermission(json.report.redeem, 'read') ||
                hasPermission(json.report.lockPhone, 'read') ||
                hasPermission(json.report.setWallpaper, 'read') ||
                hasPermission(json.report.installment, 'read') ||
                hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') ||
                hasPermission(json.report?.followUp4Report || '/report/follow-up-4', 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("report")} className={dropdownHeaderClass("report")}>
                            <p className="flex items-center gap-3">
                                <MdOutlineBarChart size={20} className="text-emerald-600" />
                                <span>{t('report')}</span>
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "report" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "report" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.report.allCustomers, 'read') && (
                                <Link to={json.report.allCustomers} className={subItemClass(json.report.allCustomers)}>{t('allCustomerReport')}</Link>
                            )}
                            {hasPermission(json.report.reportAll, 'read') && (
                                <Link to={json.report.reportAll} className={subItemClass(json.report.reportAll)}>{t('reportAll')}</Link>
                            )}
                            {hasPermission(json.report.activated, 'read') && (
                                <Link to={json.report.activated} className={subItemClass(json.report.activated)}>{t('activatedReport')}</Link>
                            )}
                            {hasPermission(json.report.redeem, 'read') && (
                                <Link to={json.report.redeem} className={subItemClass(json.report.redeem)}>{t('redeemReport')}</Link>
                            )}
                            {hasPermission(json.report.lockPhone, 'read') && (
                                <Link to={json.report.lockPhone} className={subItemClass(json.report.lockPhone)}>{t('lockPhoneReport')}</Link>
                            )}
                            {hasPermission(json.report.setWallpaper, 'read') && (
                                <Link to={json.report.setWallpaper} className={subItemClass(json.report.setWallpaper)}>{t('setWallpaperReport')}</Link>
                            )}
                            {hasPermission(json.report.installment, 'read') && (
                                <Link to={json.report.installment} className={subItemClass(json.report.installment)}>{t('installmentReport')}</Link>
                            )}
                            {(hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') || hasPermission('/follow-up/report', 'read')) && (
                                <Link to={json.report?.followUpReport || '/report/follow-up'} className={subItemClass(json.report?.followUpReport || '/report/follow-up')}>{t('followUpReport') || 'Follow Up Report'}</Link>
                            )}
                            {hasPermission(json.report?.followUp4Report || '/report/follow-up-4', 'read') && (
                                <Link to={json.report?.followUp4Report || '/report/follow-up-4'} className={subItemClass(json.report?.followUp4Report || '/report/follow-up-4')}>{t('followUp4Report') || 'Follow Up 4 Report'}</Link>
                            )}

                        </div>
                    </div>
                )}

            {/* History */}
            {(hasPermission(json.history?.loginHistory || '/history/login-history', 'read') ||
                hasPermission(json.history?.deviceHistory || '/history/device-history', 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("history")} className={dropdownHeaderClass("history")}>
                            <p className="flex items-center gap-3">
                                <FaHistory size={18} className="text-emerald-600" />
                                {t('history')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "history" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "history" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.history?.loginHistory || '/history/login-history', 'read') && (
                                <Link to={json.history?.loginHistory || '/history/login-history'} className={subItemClass(json.history?.loginHistory || '/history/login-history')}>{t('loginHistory')}</Link>
                            )}
                            {hasPermission(json.history?.deviceHistory || '/history/device-history', 'read') && (
                                <Link to={json.history?.deviceHistory || '/history/device-history'} className={subItemClass(json.history?.deviceHistory || '/history/device-history')}>{t('deviceHistory')}</Link>
                            )}
                        </div>
                    </div>
                )}

            {/* Follow up Droplist */}
            {(hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') ||
                hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') ||
                hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') ||
                hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') ||
                hasPermission('/follow-up/sen-sok', 'read') ||
                hasPermission(json.followUp?.followUpReport || '/report/follow-up', 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("followUp")} className={dropdownHeaderClass("followUp")}>
                            <p className="flex items-center gap-3">
                                <FaClipboardCheck size={18} className="text-emerald-600" />
                                <span>{t('followUp') || 'Follow up'}</span>
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "followUp" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "followUp" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') && (
                                <Link to={json.followUp?.followUp1 || '/follow-up/follow-up-1'} className={subItemClass(json.followUp?.followUp1 || '/follow-up/follow-up-1')}>
                                    {t('followUp1') || 'Follow up 1'}
                                </Link>
                            )}
                            {hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') && (
                                <Link to={json.followUp?.followUp2 || '/follow-up/follow-up-2'} className={subItemClass(json.followUp?.followUp2 || '/follow-up/follow-up-2')}>
                                    {t('followUp2') || 'Follow up 2'}
                                </Link>
                            )}
                            {(hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') ||
                                hasPermission('/follow-up/sen-sok', 'read')) && (
                                    <Link to={json.followUp?.followUp3 || '/follow-up/follow-up-3'} className={subItemClass(json.followUp?.followUp3 || '/follow-up/follow-up-3')}>
                                        {t('followUp3') || 'Follow up 3'}
                                    </Link>
                                )}
                            {hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') && (
                                <Link to={json.followUp?.followUp4 || '/follow-up/follow-up-4'} className={subItemClass(json.followUp?.followUp4 || '/follow-up/follow-up-4')}>
                                    {t('followUp4') || 'Follow up 4'}
                                </Link>
                            )}

                        </div>
                    </div>
                )}

            {/* Salary */}
            {hasPermission(json.salary || '/salary', 'read') && (
                <Link to={json.salary || '/salary'} className={navItemClass(json.salary || '/salary')}>
                    <FaMoneyBillWave size={19} className={isActive(json.salary || '/salary') ? "text-white" : "text-emerald-600"} />
                    {t('salary') || 'Salary'}
                </Link>
            )}

            {/* Setting */}
            {(hasPermission('/settings/all-account', 'read') ||
                hasPermission(json.settings.controlSystem, 'read') ||
                hasPermission(json.settings.systemLogs, 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("setting")} className={dropdownHeaderClass("setting")}>
                            <p className="flex items-center gap-3">
                                <IoIosSettings size={20} className="text-emerald-600" />
                                {t('settings')}
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "setting" ? "rotate-180" : ""}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-300 ${openMenu === "setting" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                            {hasPermission('/settings/all-account', 'read') && (
                                <Link to="/settings/all-account" className={subItemClass('/settings/all-account')}>{t('allAccount')}</Link>
                            )}
                            {hasPermission(json.settings.controlSystem, 'read') && (
                                <Link to={json.settings.controlSystem} className={subItemClass(json.settings.controlSystem)}>{t('controlSystem')}</Link>
                            )}
                            {hasPermission(json.settings.systemLogs, 'read') && (
                                <Link to={json.settings.systemLogs} className={subItemClass(json.settings.systemLogs)}>{t('systemLogs')}</Link>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Account User Badge Section */}
            <div id="account-badge-container" className="mt-auto pt-2 border-t border-slate-200 relative flex-shrink-0">
                {/* Account Menu Popover (Opens to the RIGHT side so it does NOT cover menu items) */}
                {accountOpen && (
                    <div
                        className="absolute left-[calc(100%+8px)] bottom-0 w-[240px] bg-white border border-slate-200 rounded-[12px] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] z-[99999] animate-in fade-in slide-in-from-left-2 duration-200 opacity-100"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <div className="p-2.5 border-b border-slate-100 mb-1.5 bg-slate-50 rounded-[8px]" style={{ backgroundColor: '#f8fafc' }}>
                            <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'HAK YONGHOUV'}</p>
                            <p className="text-[11px] text-emerald-600 font-mono mt-0.5 truncate">{user?.email || 'yonghouvh@gmail.com'}</p>
                            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 mt-1.5 border border-emerald-200">
                                {user?.role || 'Administrator'}
                            </span>
                        </div>

                        {/* Profile Button */}
                        <Link
                            to="/profile"
                            onClick={() => setAccountOpen(false)}
                            className="w-full h-[36px] flex items-center gap-2.5 px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[6px] transition-all cursor-pointer text-xs font-medium"
                        >
                            <FaUserCog className="text-sm text-emerald-600" />
                            <span>{t('profile')}</span>
                        </Link>

                        {/* Fullscreen / Zoom Toggle */}
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="w-full h-[36px] flex items-center justify-between px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[6px] transition-all cursor-pointer text-xs font-medium"
                        >
                            <div className="flex items-center gap-2.5">
                                {isFullscreen ? <FaCompress className="text-sm text-emerald-600" /> : <FaExpand className="text-sm text-emerald-600" />}
                                <span>{isFullscreen ? (t('exitFullscreen') || 'Exit Fullscreen') : (t('fullscreen') || 'Fullscreen')}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">F11</span>
                        </button>

                        {/* Language Selector Submenu Toggle (Opens to the RIGHT) */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setLangSubmenuOpen(!langSubmenuOpen)}
                                className={`w-full h-[36px] flex items-center justify-between px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[6px] transition-all cursor-pointer text-xs font-medium ${langSubmenuOpen ? 'bg-emerald-50 text-emerald-700 font-bold' : ''}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <FaGlobe className="text-sm text-emerald-600" />
                                    <span>{t('selectLanguage') || 'ភាសា / Language'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{currentLangObj.flag}</span>
                                    <IoMdArrowDropdown className={`text-slate-400 transition-transform duration-200 ${langSubmenuOpen ? 'rotate-90 text-emerald-600' : '-rotate-90'}`} />
                                </div>
                            </button>

                            {/* Language Flyout Submenu to the RIGHT side */}
                            {langSubmenuOpen && (
                                <div
                                    className="absolute left-[calc(100%+8px)] bottom-0 w-[210px] bg-white border border-slate-200 rounded-[12px] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.18)] z-[100000] animate-in fade-in slide-in-from-left-2 duration-200 max-h-[280px] overflow-y-auto space-y-1 custom-scrollbar opacity-100"
                                    style={{ backgroundColor: '#ffffff' }}
                                >
                                    <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 mb-1">
                                        {t('selectLanguage') || 'ជ្រើសរើសភាសា'}
                                    </p>
                                    {LANGUAGES.map((l) => (
                                        <button
                                            key={l.code}
                                            type="button"
                                            onClick={() => {
                                                changeLanguage(l.code);
                                                setLangSubmenuOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-[6px] transition-all cursor-pointer ${
                                                lang === l.code ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <span className="text-base">{l.flag}</span>
                                                <span>{l.label}</span>
                                            </span>
                                            {lang === l.code && <span className="text-[11px] font-black">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Toggle Header Button (Placed right below language selector) */}
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
                            className="w-full h-[36px] flex items-center justify-between px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[6px] transition-all cursor-pointer text-xs font-medium"
                        >
                            <div className="flex items-center gap-2.5">
                                {isHeaderOpen ? (
                                    <FaEyeSlash className="text-sm text-emerald-600" />
                                ) : (
                                    <FaEye className="text-sm text-emerald-600" />
                                )}
                                <span>{isHeaderOpen ? (t('hideHeader') || 'លាក់ Header') : (t('showHeader') || 'បង្ហាញ Header')}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isHeaderOpen ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isHeaderOpen ? (t('hide') || 'លាក់') : (t('show') || 'បង្ហាញ')}
                            </span>
                        </button>

                        {/* Logout Button */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full h-[36px] flex items-center gap-2.5 px-3 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-[6px] transition-all cursor-pointer text-xs font-semibold mt-1 border-t border-slate-100 pt-1.5"
                        >
                            <FaSignOutAlt className="text-sm text-red-500" />
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                )}

                {/* Account Badge Pill */}
                <div
                    onClick={() => setAccountOpen(!accountOpen)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-[12px] bg-white border border-slate-200 hover:border-emerald-500/60 transition-all cursor-pointer shadow-2xs hover:shadow-md group opacity-100"
                    style={{ backgroundColor: '#ffffff' }}
                    title={user?.name || 'User Account'}
                >
                    <div className="w-8 h-8 rounded-full bg-emerald-600 p-0.5 shadow-xs flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                            <FaUserCircle className="w-full h-full text-emerald-600" />
                        </div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-slate-800 leading-tight truncate">
                            {user?.name || 'HAK YONGHOUV'}{user?.brand ? ` ( ${user.brand.toUpperCase()} )` : ' ( 888MDM )'}
                        </p>
                        <p className="text-[11px] text-emerald-600 font-semibold leading-none mt-0.5 truncate">
                            {user?.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '@houv'}
                        </p>
                    </div>
                    <FaChevronUp className={`text-[10px] text-slate-400 group-hover:text-emerald-600 transition-transform duration-200 flex-shrink-0 ${accountOpen ? 'rotate-90 text-emerald-600' : '-rotate-90'}`} />
                </div>
            </div>
        </aside>
    );
};

export default Left;