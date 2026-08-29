import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import json from "../../routes/Routes.json";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

import { MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineBarChart } from "react-icons/md";
import { IoMdArrowDropdown, IoIosContact, IoIosSettings, IoMdWallet } from "react-icons/io";
import { FaHistory } from "react-icons/fa";


const Left = () => {
    const [openMenu, setOpenMenu] = useState("");
    const { t } = useLanguage();
    const { hasPermission } = useAuth();
    const location = useLocation();

    const toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? "" : menu);
    };

    const isActive = (path) => location.pathname === path;

    const navItemClass = (path) =>
        `w-full h-[44px] flex-shrink-0 flex items-center gap-3 px-3 rounded-[5px] text-sm font-semibold transition-all glass-nav-item ${isActive(path)
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border border-emerald-500"
            : "bg-white text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-700 border border-slate-200/80 shadow-2xs"
        }`;

    const subItemClass = (path) =>
        `flex items-center gap-2 flex-shrink-0 px-3.5 py-2.5 ml-3 text-xs font-bold rounded-[5px] transition-all ${isActive(path)
            ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
            : "text-slate-700 bg-white/80 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/70"
        }`;

    const dropdownHeaderClass = (menuName) =>
        `w-full h-[44px] flex-shrink-0 flex items-center justify-between px-3 bg-white hover:bg-emerald-50/70 text-slate-700 border border-slate-200/80 hover:border-emerald-300 rounded-[5px] cursor-pointer text-sm font-semibold transition-all shadow-2xs`;

    return (
        <div className="w-[260px] h-full min-h-0 flex-shrink-0 border-r border-slate-200 bg-slate-50/90 p-3 flex flex-col gap-2 select-none overflow-y-auto backdrop-blur-sm">

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

            {/* Report Droplist Menu */}
            {(hasPermission(json.report.allCustomers, 'read') ||
                hasPermission(json.report.reportAll, 'read') ||
                hasPermission(json.report.activated, 'read') ||
                hasPermission(json.report.redeem, 'read') ||
                hasPermission(json.report.lockPhone, 'read') ||
                hasPermission(json.report.setWallpaper, 'read') ||
                hasPermission(json.report.installment, 'read')) && (
                    <div className="flex-shrink-0">
                        <div onClick={() => toggleMenu("report")} className={dropdownHeaderClass("report")}>
                            <p className="flex items-center gap-3">
                                <MdOutlineBarChart size={20} className="text-indigo-600" />
                                <span>{t('report')}</span>
                            </p>
                            <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-600 ${openMenu === "report" ? "rotate-180" : ""}`} />
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
                        </div>
                    </div>
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

            {/* Installment */}
            {hasPermission(json.installment.paymentHistory, 'read') && (
                <div className="flex-shrink-0">
                    <div onClick={() => toggleMenu("installment")} className={dropdownHeaderClass("installment")}>
                        <p className="flex items-center gap-3">
                            <IoMdWallet size={20} className="text-emerald-600" />
                            {t('installment')}
                        </p>
                        <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-emerald-600 ${openMenu === "installment" ? "rotate-180" : ""}`} />
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ${openMenu === "installment" ? "max-h-[1000px] mt-1.5 space-y-1" : "max-h-0"}`}>
                        {hasPermission(json.installment.paymentHistory, 'read') && (
                            <Link to={json.installment.paymentHistory} className={subItemClass(json.installment.paymentHistory)}>{t('paymentHistory')}</Link>
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

            {/* Setting */}
            {(hasPermission('/settings/all-account', 'read') ||
                hasPermission(json.settings.controlSystem, 'read') ||
                hasPermission('/settings/phone-app', 'read')) && (
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
                        </div>
                    </div>
                )}

        </div>
    );
};

export default Left;