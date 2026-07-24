import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import json from "../../routes/Routes.json";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

import { MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineReportProblem } from "react-icons/md";
import { IoMdArrowDropdown, IoIosContact, IoIosSettings, IoMdWallet } from "react-icons/io";
import { FaShieldAlt, FaSlidersH, FaUserCircle } from "react-icons/fa";

const Left = () => {
    const [openMenu, setOpenMenu] = useState("");
    const { t } = useLanguage();
    const { hasPermission } = useAuth();
    const location = useLocation();

    const toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? "" : menu);
    };

    const isActive = (path) => location.pathname === path;

    return (
        <div className="w-[260px] h-[93vh] border-r border-gray-800/80 bg-[#0a0d1a]/80 p-3 flex flex-col gap-2 select-none overflow-y-auto backdrop-blur-sm">

            {/* Dashboard */}
            {hasPermission('/dashboard', 'read') && (
                <Link
                    to={json.dashboard}
                    className={`w-full h-[44px] flex items-center gap-3 px-3 rounded-xl text-sm font-semibold transition-all glass-nav-item ${isActive(json.dashboard) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/50" : "bg-gray-800/40 text-gray-300 border border-gray-800"}`}
                >
                    <MdDashboard size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    {t('dashboard')}
                </Link>
            )}

            {/* Customer */}
            {hasPermission('/customer', 'read') && (
                <Link
                    to={json.customer}
                    className={`w-full h-[44px] flex items-center gap-3 px-3 rounded-xl text-sm font-semibold transition-all glass-nav-item ${isActive(json.customer) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/50" : "bg-gray-800/40 text-gray-300 border border-gray-800"}`}
                >
                    <IoIosContact size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    {t('customer')}
                </Link>
            )}

            {/* Device */}
            {hasPermission('/device', 'read') && (
                <Link
                    to={json.device}
                    className={`w-full h-[44px] flex items-center gap-3 px-3 rounded-xl text-sm font-semibold transition-all glass-nav-item ${isActive(json.device) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/50" : "bg-gray-800/40 text-gray-300 border border-gray-800"}`}
                >
                    <MdOutlinePhoneIphone size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    {t('device')}
                </Link>
            )}

            {/* Contract */}
            <div>
                <div
                    onClick={() => toggleMenu("contract")}
                    className="w-full h-[44px] flex items-center justify-between px-3 bg-gray-800/40 hover:bg-indigo-600/20 text-gray-300 border border-gray-800 hover:border-indigo-500/40 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                >
                    <p className="flex items-center gap-3">
                        <MdOutlineContactPhone size={20} className="text-indigo-400" />
                        {t('contract')}
                    </p>
                    <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-400 ${openMenu === "contract" ? "rotate-180" : ""}`} />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openMenu === "contract" ? "max-h-[300px] mt-2 space-y-1" : "max-h-0"}`}>
                    {hasPermission(json.contract.application, 'read') && (
                        <Link to={json.contract.application} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.application) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('application')}</Link>
                    )}
                    {hasPermission(json.contract.activated, 'read') && (
                        <Link to={json.contract.activated} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.activated) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('activated')}</Link>
                    )}
                    {hasPermission(json.contract.check, 'read') && (
                        <Link to={json.contract.check} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.check) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('check')}</Link>
                    )}
                    {hasPermission(json.contract.redeem, 'read') && (
                        <Link to={json.contract.redeem} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.redeem) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('redeem')}</Link>
                    )}
                    {hasPermission(json.contract.comments, 'read') && (
                        <Link to={json.contract.comments} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.comments) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('comments')}</Link>
                    )}
                    {hasPermission(json.contract.blacklist, 'read') && (
                        <Link to={json.contract.blacklist} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.contract.blacklist) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('blacklist')}</Link>
                    )}
                </div>
            </div>

            {/* Installment */}
            <div>
                <div
                    onClick={() => toggleMenu("installment")}
                    className="w-full h-[44px] flex items-center justify-between px-3 bg-gray-800/40 hover:bg-indigo-600/20 text-gray-300 border border-gray-800 hover:border-indigo-500/40 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                >
                    <p className="flex items-center gap-3">
                        <IoMdWallet size={20} className="text-indigo-400" />
                        {t('installment')}
                    </p>
                    <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-400 ${openMenu === "installment" ? "rotate-180" : ""}`} />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openMenu === "installment" ? "max-h-[100px] mt-2 space-y-1" : "max-h-0"}`}>
                    {hasPermission(json.installment.paymentHistory, 'read') && (
                        <Link to={json.installment.paymentHistory} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.installment.paymentHistory) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('paymentHistory')}</Link>
                    )}
                </div>
            </div>

            {/* Lost Phone */}
            <div>
                <div
                    onClick={() => toggleMenu("lostphone")}
                    className="w-full h-[44px] flex items-center justify-between px-3 bg-gray-800/40 hover:bg-indigo-600/20 text-gray-300 border border-gray-800 hover:border-indigo-500/40 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                >
                    <p className="flex items-center gap-3">
                        <MdOutlinePhoneIphone size={20} className="text-indigo-400" />
                        {t('lostPhone')}
                    </p>
                    <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-400 ${openMenu === "lostphone" ? "rotate-180" : ""}`} />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openMenu === "lostphone" ? "max-h-[200px] mt-2 space-y-1" : "max-h-0"}`}>
                    {hasPermission(json.lostphone.actionLockphone, 'read') && (
                        <Link to={json.lostphone.actionLockphone} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.lostphone.actionLockphone) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('actions')}</Link>
                    )}
                    {hasPermission(json.lostphone.lockPhone, 'read') && (
                        <Link to={json.lostphone.lockPhone} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.lostphone.lockPhone) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('lockPhone')}</Link>
                    )}
                    {hasPermission(json.lostphone.unlockPhone, 'read') && (
                        <Link to={json.lostphone.unlockPhone} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.lostphone.unlockPhone) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('unlockPhone')}</Link>
                    )}
                </div>
            </div>

            {/* Wallpaper */}
            <div>
                <div
                    onClick={() => toggleMenu("wallpaper")}
                    className="w-full h-[44px] flex items-center justify-between px-3 bg-gray-800/40 hover:bg-indigo-600/20 text-gray-300 border border-gray-800 hover:border-indigo-500/40 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                >
                    <p className="flex items-center gap-3">
                        <MdOutlineWallpaper size={20} className="text-indigo-400" />
                        {t('wallpaper')}
                    </p>
                    <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-400 ${openMenu === "wallpaper" ? "rotate-180" : ""}`} />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openMenu === "wallpaper" ? "max-h-[200px] mt-2 space-y-1" : "max-h-0"}`}>
                    {hasPermission(json.wallpaper.actionWallpaper, 'read') && (
                        <Link to={json.wallpaper.actionWallpaper} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.wallpaper.actionWallpaper) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('actions')}</Link>
                    )}
                    {hasPermission(json.wallpaper.lockWallpaper, 'read') && (
                        <Link to={json.wallpaper.lockWallpaper} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.wallpaper.lockWallpaper) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('lockWallpaper')}</Link>
                    )}
                    {hasPermission(json.wallpaper.unlockWallpaper, 'read') && (
                        <Link to={json.wallpaper.unlockWallpaper} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.wallpaper.unlockWallpaper) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('unlockWallpaper')}</Link>
                    )}
                </div>
            </div>

            {/* Setting */}
            <div>
                <div
                    onClick={() => toggleMenu("setting")}
                    className="w-full h-[44px] flex items-center justify-between px-3 bg-gray-800/40 hover:bg-indigo-600/20 text-gray-300 border border-gray-800 hover:border-indigo-500/40 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                >
                    <p className="flex items-center gap-3">
                        <IoIosSettings size={20} className="text-indigo-400" />
                        {t('settings')}
                    </p>
                    <IoMdArrowDropdown size={20} className={`transition-transform duration-300 text-indigo-400 ${openMenu === "setting" ? "rotate-180" : ""}`} />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openMenu === "setting" ? "max-h-[200px] mt-2 space-y-1" : "max-h-0"}`}>
                    {hasPermission('/settings/all-account', 'read') && (
                        <Link to="/settings/all-account" className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive('/settings/all-account') ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('allAccount')}</Link>
                    )}
                    {hasPermission(json.settings.controlSystem, 'read') && (
                        <Link to={json.settings.controlSystem} className={`block px-3 py-2 ml-4 text-xs font-medium rounded-lg transition-all ${isActive(json.settings.controlSystem) ? "bg-indigo-600/40 text-indigo-200 border border-indigo-500/50" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"}`}>{t('controlSystem')}</Link>
                    )}
                </div>
            </div>

        </div>
    );
};

export default Left;