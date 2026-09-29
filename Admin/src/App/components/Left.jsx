import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import json from "../../routes/Routes.json";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

import { MdDashboard, MdOutlineContactPhone, MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineBarChart, MdCalculate } from "react-icons/md";
import { IoMdArrowDropdown, IoIosContact, IoIosSettings, IoMdWallet } from "react-icons/io";
import { FaHistory, FaClipboardCheck, FaMoneyBillWave, FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";

// ─── Flyout Popup (rendered directly in body via Portal to avoid clipping) ───
const FlyoutMenu = ({ title, icon, items = [], triggerRef, onClose }) => {
    const menuRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 74 });

    useEffect(() => {
        const updateCoords = () => {
            if (triggerRef?.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const estHeight = Math.min(items.length * 42 + 56, window.innerHeight * 0.85);
                let top = rect.top;
                if (top + estHeight > window.innerHeight - 16) {
                    top = Math.max(12, window.innerHeight - estHeight - 16);
                }
                setCoords({
                    top: Math.round(top),
                    left: Math.round(rect.right + 10),
                });
            }
        };

        updateCoords();
        window.addEventListener("resize", updateCoords);
        window.addEventListener("scroll", updateCoords, true);
        return () => {
            window.removeEventListener("resize", updateCoords);
            window.removeEventListener("scroll", updateCoords, true);
        };
    }, [triggerRef, items]);

    useEffect(() => {
        const handleClick = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                triggerRef?.current && !triggerRef.current.contains(e.target)
            ) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };

        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
            window.addEventListener("keydown", handleKeyDown);
        }, 20);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClick);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, triggerRef]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[99999] min-w-[210px] max-w-[290px] rounded-2xl p-2 flex flex-col gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl border select-none max-h-[85vh] overflow-y-auto"
            style={{
                top: coords.top,
                left: coords.left,
                backgroundColor: "var(--app-sidebar, rgba(248, 250, 252, 0.98))",
                borderColor: "var(--app-border, rgba(16, 185, 129, 0.3))",
                boxShadow: "0 20px 45px -10px rgba(0,0,0,0.3), 0 0 20px rgba(16, 185, 129, 0.15)",
                animation: "flyoutPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
        >
            <style>{`
                @keyframes flyoutPop {
                    0% {
                        opacity: 0;
                        transform: translateX(-12px) scale(0.92);
                    }
                    70% {
                        opacity: 1;
                        transform: translateX(2px) scale(1.02);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
            `}</style>

            {/* Header with Category Title & Badge */}
            {title && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--app-border,rgba(226,232,240,0.7))] mb-1 bg-emerald-500/5 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                        {icon && <span className="text-emerald-600 flex-shrink-0 text-lg">{icon}</span>}
                        <span className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-400 truncate">
                            {title}
                        </span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/25">
                        {items.length}
                    </span>
                </div>
            )}

            {/* Sub-menu Items */}
            <div className="flex flex-col gap-1">
                {items.map((item, i) => (
                    <Link
                        key={i}
                        to={item.to}
                        onClick={onClose}
                        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border
                            ${item.active
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 font-bold"
                                : "text-[var(--app-text,#0f172a)] border-transparent hover:bg-emerald-500/15 hover:border-emerald-300/40 hover:translate-x-1"
                            }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full transition-all duration-200 ${item.active ? "bg-white scale-125" : "bg-emerald-500/50 group-hover:bg-emerald-600 group-hover:scale-125"}`} />
                            <span className="truncate">{item.label}</span>
                        </div>
                        {item.active && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        )}
                    </Link>
                ))}
            </div>
        </div>,
        document.body
    );
};

// ─── Main Left Sidebar ──────────────────────────────────────────────────────
const Left = ({ isOpen = false, onClose, collapsed = false, onToggleCollapse }) => {
    const [openMenu, setOpenMenu] = useState("");
    const [flyout, setFlyout] = useState(null); // { menuKey, items, ref }
    const { t } = useLanguage();
    const { hasPermission } = useAuth();
    const location = useLocation();

    const toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? "" : menu);
    };

    const isActive = (path) => location.pathname === path;

    // Close flyout when route changes
    useEffect(() => { setFlyout(null); }, [location.pathname]);

    // ── Style helpers ──────────────────────────────────────────────────────
    const navItemClass = (path) =>
        `group relative w-full flex-shrink-0 flex items-center rounded-[5px] text-sm font-semibold overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] active:translate-y-[1px] glass-nav-item
        ${collapsed ? "h-[44px] justify-center px-0" : "h-[44px] gap-3 px-3"}
        ${isActive(path)
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border border-emerald-500"
            : "bg-[var(--app-card,rgba(255,255,255,0.4))] text-[var(--app-text,#0f172a)] hover:bg-emerald-500/15 border border-[var(--app-border,rgba(226,232,240,0.6))] shadow-2xs backdrop-blur-md"
        }`;

    const subItemClass = (path) =>
        `group relative flex items-center gap-2 flex-shrink-0 px-3.5 py-2.5 ml-3 text-xs font-bold rounded-[5px] overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md hover:shadow-emerald-500/10 active:scale-[0.98] active:translate-y-[1px] ${isActive(path)
            ? "bg-emerald-600 text-white shadow-xs border border-emerald-500"
            : "bg-[var(--app-card,rgba(255,255,255,0.3))] text-[var(--app-text,#0f172a)] hover:bg-emerald-500/15 border border-[var(--app-border,rgba(226,232,240,0.6))] backdrop-blur-md"
        }`;

    const dropdownHeaderBaseClass = () =>
        `sidebar-dropdown-header group relative w-full flex-shrink-0 flex items-center bg-[var(--app-card,rgba(255,255,255,0.4))] hover:bg-emerald-500/15 text-[var(--app-text,#0f172a)] border border-[var(--app-border,rgba(226,232,240,0.6))] rounded-[5px] cursor-pointer text-sm font-semibold overflow-hidden transition-all duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:scale-[1.005] hover:shadow-md hover:shadow-emerald-500/10 active:scale-[0.99] active:translate-y-[1px] shadow-2xs backdrop-blur-md
        ${collapsed ? "h-[44px] justify-center px-0" : "h-[44px] justify-between px-3"}`;

    // Handle collapsed flyout toggle
    const handleFlyoutToggle = (menuKey, items, ref) => {
        if (flyout?.menuKey === menuKey) {
            setFlyout(null);
        } else {
            setFlyout({ menuKey, items, ref });
        }
    };

    // ─── Simple NavLink ────────────────────────────────────────────────────
    const NavItem = ({ to, icon, label }) => (
        <Link to={to} className={navItemClass(to)} title={collapsed ? label : undefined}>
            <span className="flex-shrink-0">{icon}</span>
            {!collapsed && <span className="sidebar-label truncate">{label}</span>}
        </Link>
    );

    // ─── Dropdown group ────────────────────────────────────────────────────
    const DropdownGroup = ({ menuKey, icon, label, items, children }) => {
        const btnRef = useRef(null);
        const isFlyoutOpen = flyout?.menuKey === menuKey;
        const isExpandOpen = openMenu === menuKey;

        if (collapsed) {
            return (
                <div className="flex-shrink-0 relative">
                    <button
                        ref={btnRef}
                        type="button"
                        title={label}
                        onClick={() => handleFlyoutToggle(menuKey, items, btnRef)}
                        className={`${dropdownHeaderBaseClass()} ${isFlyoutOpen ? "bg-emerald-500/20 border-emerald-400" : ""}`}
                    >
                        <span className="text-emerald-600 flex-shrink-0">{icon}</span>
                    </button>
                    {isFlyoutOpen && (
                        <FlyoutMenu
                            title={label}
                            icon={icon}
                            items={flyout.items}
                            triggerRef={flyout.ref}
                            onClose={() => setFlyout(null)}
                        />
                    )}
                </div>
            );
        }

        return (
            <div className="flex-shrink-0">
                <div onClick={() => toggleMenu(menuKey)} className={dropdownHeaderBaseClass()}>
                    <p className="flex items-center gap-3">
                        <span className="text-emerald-600 flex-shrink-0">{icon}</span>
                        <span className="sidebar-label truncate">{label}</span>
                    </p>
                    <IoMdArrowDropdown
                        size={20}
                        className={`transition-transform duration-300 text-emerald-600 flex-shrink-0 ${isExpandOpen ? "rotate-180" : "rotate-0"}`}
                    />
                </div>
                <div
                    className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        isExpandOpen
                            ? "grid-rows-[1fr] opacity-100 mt-1.5"
                            : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                    }`}
                >
                    <div className="overflow-hidden space-y-1">
                        {children}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            onClick={(event) => {
                if (event.target.closest('a')) onClose?.();
            }}
            className={`app-sidebar h-full min-h-0 flex-shrink-0 border-r p-2.5 flex flex-col gap-2 select-none overflow-y-auto backdrop-blur-md transition-all duration-300 mobile-sidebar ${isOpen ? 'mobile-sidebar-open' : ''} ${collapsed ? 'w-[64px]' : 'w-[260px]'}`}
            style={{
                backgroundColor: 'var(--app-sidebar, rgba(248, 250, 252, 0.9))',
                borderColor: 'var(--app-border, rgba(226, 232, 240, 0.8))'
            }}
        >
            {/* Dashboard */}
            {hasPermission('/dashboard', 'read') && (
                <NavItem
                    to={json.dashboard}
                    icon={<MdDashboard size={20} className={isActive(json.dashboard) ? "text-white" : "text-emerald-600"} />}
                    label={t('dashboard')}
                />
            )}

            {/* Customer */}
            {hasPermission('/customer', 'read') && (
                <NavItem
                    to={json.customer}
                    icon={<IoIosContact size={20} className={isActive(json.customer) ? "text-white" : "text-emerald-600"} />}
                    label={t('customer')}
                />
            )}

            {/* Device */}
            {hasPermission('/device', 'read') && (
                <NavItem
                    to={json.device}
                    icon={<MdOutlinePhoneIphone size={20} className={isActive(json.device) ? "text-white" : "text-emerald-600"} />}
                    label={t('device')}
                />
            )}

            {/* Contract */}
            {(hasPermission(json.contract.application, 'read') ||
                hasPermission(json.contract.activated, 'read') ||
                hasPermission(json.contract.check, 'read') ||
                hasPermission(json.contract.redeem, 'read') ||
                hasPermission(json.contract.comments, 'read') ||
                hasPermission(json.contract.blacklist, 'read')) && (
                    <DropdownGroup
                        menuKey="contract"
                        icon={<MdOutlineContactPhone size={20} />}
                        label={t('contract')}
                        items={[
                            hasPermission(json.contract.application, 'read') && { to: json.contract.application, label: t('application'), active: isActive(json.contract.application) },
                            hasPermission(json.contract.activated, 'read') && { to: json.contract.activated, label: t('activated'), active: isActive(json.contract.activated) },
                            hasPermission(json.contract.check, 'read') && { to: json.contract.check, label: t('check'), active: isActive(json.contract.check) },
                            hasPermission(json.contract.redeem, 'read') && { to: json.contract.redeem, label: t('redeem'), active: isActive(json.contract.redeem) },
                            hasPermission(json.contract.comments, 'read') && { to: json.contract.comments, label: t('comments'), active: isActive(json.contract.comments) },
                            hasPermission(json.contract.blacklist, 'read') && { to: json.contract.blacklist, label: t('blacklist'), active: isActive(json.contract.blacklist) },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.contract.application, 'read') && (<Link to={json.contract.application} className={subItemClass(json.contract.application)}>{t('application')}</Link>)}
                        {hasPermission(json.contract.activated, 'read') && (<Link to={json.contract.activated} className={subItemClass(json.contract.activated)}>{t('activated')}</Link>)}
                        {hasPermission(json.contract.check, 'read') && (<Link to={json.contract.check} className={subItemClass(json.contract.check)}>{t('check')}</Link>)}
                        {hasPermission(json.contract.redeem, 'read') && (<Link to={json.contract.redeem} className={subItemClass(json.contract.redeem)}>{t('redeem')}</Link>)}
                        {hasPermission(json.contract.comments, 'read') && (<Link to={json.contract.comments} className={subItemClass(json.contract.comments)}>{t('comments')}</Link>)}
                        {hasPermission(json.contract.blacklist, 'read') && (<Link to={json.contract.blacklist} className={subItemClass(json.contract.blacklist)}>{t('blacklist')}</Link>)}
                    </DropdownGroup>
                )}

            {/* Calendar */}
            {hasPermission(json.calendar || '/calendar', 'read') && (
                <NavItem
                    to={json.calendar || '/calendar'}
                    icon={<FaCalendarAlt size={18} className={isActive(json.calendar || '/calendar') ? "text-white" : "text-emerald-600"} />}
                    label="ប្រតិទិនខ្មែរ"
                />
            )}

            {/* Calculate */}
            {(hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') ||
                hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read')) && (
                    <DropdownGroup
                        menuKey="calculate"
                        icon={<MdCalculate size={20} />}
                        label={t('calculate')}
                        items={[
                            hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') && { to: json.calculate?.calculateSchedule1 || '/calculate/schedule-1', label: t('calculateSchedule1') || 'Schedule 1', active: isActive(json.calculate?.calculateSchedule1 || '/calculate/schedule-1') },
                            hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read') && { to: json.calculate?.calculateSchedule2 || '/calculate/schedule-2', label: t('Calculate Schedule 2') || 'Schedule 2', active: isActive(json.calculate?.calculateSchedule2 || '/calculate/schedule-2') },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.calculate?.calculateSchedule1 || '/calculate/schedule-1', 'read') && (
                            <Link to={json.calculate?.calculateSchedule1 || '/calculate/schedule-1'} className={subItemClass(json.calculate?.calculateSchedule1 || '/calculate/schedule-1')}>
                                {t('calculateSchedule1') || 'Schedule 1 — គណនាការប្រាក់'}
                            </Link>
                        )}
                        {hasPermission(json.calculate?.calculateSchedule2 || '/calculate/schedule-2', 'read') && (
                            <Link to={json.calculate?.calculateSchedule2 || '/calculate/schedule-2'} className={subItemClass(json.calculate?.calculateSchedule2 || '/calculate/schedule-2')}>
                                {t('Calculate Schedule 2') || 'Schedule 2 — កាលវិភាគបញ្ចាំ'}
                            </Link>
                        )}
                    </DropdownGroup>
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
                    <DropdownGroup
                        menuKey="installment"
                        icon={<IoMdWallet size={20} />}
                        label={t('installment')}
                        items={[
                            hasPermission(json.installment.installmentPage, 'read') && { to: json.installment.installmentPage, label: t('installment'), active: isActive(json.installment.installmentPage) },
                            hasPermission(json.installment.installmentPad, 'read') && { to: json.installment.installmentPad, label: 'Installment Pad', active: isActive(json.installment.installmentPad) },
                            hasPermission(json.installment.installmentHistory, 'read') && { to: json.installment.installmentHistory, label: 'Installment History', active: isActive(json.installment.installmentHistory) },
                            hasPermission(json.installment.overdue, 'read') && { to: json.installment.overdue, label: t('overdueCustomers'), active: isActive(json.installment.overdue) },
                            hasPermission(json.installment.dueToday, 'read') && { to: json.installment.dueToday, label: t('dueToday'), active: isActive(json.installment.dueToday) },
                            hasPermission(json.installment.unpaidYesterday, 'read') && { to: json.installment.unpaidYesterday, label: t('unpaidYesterday'), active: isActive(json.installment.unpaidYesterday) },
                            hasPermission(json.installment.dueIn3Days, 'read') && { to: json.installment.dueIn3Days, label: t('dueIn3Days'), active: isActive(json.installment.dueIn3Days) },
                            hasPermission(json.installment.overdue3Days, 'read') && { to: json.installment.overdue3Days, label: t('overdue3Days'), active: isActive(json.installment.overdue3Days) },
                            hasPermission(json.installment.overdue7Days, 'read') && { to: json.installment.overdue7Days, label: t('overdue7Days'), active: isActive(json.installment.overdue7Days) },
                            hasPermission(json.installment.paymentHistory, 'read') && { to: json.installment.paymentHistory, label: t('paymentHistory'), active: isActive(json.installment.paymentHistory) },
                            hasPermission(json.installment.cashOut, 'read') && { to: json.installment.cashOut, label: t('cashOut'), active: isActive(json.installment.cashOut) },
                            hasPermission(json.installment.cashIn, 'read') && { to: json.installment.cashIn, label: t('cashIn'), active: isActive(json.installment.cashIn) },
                            hasPermission(json.installment.penalty, 'read') && { to: json.installment.penalty, label: t('penalty'), active: isActive(json.installment.penalty) },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.installment.installmentPage, 'read') && (<Link to={json.installment.installmentPage} className={subItemClass(json.installment.installmentPage)}>{t('installment')}</Link>)}
                        {hasPermission(json.installment.installmentPad, 'read') && (<Link to={json.installment.installmentPad} className={subItemClass(json.installment.installmentPad)}>Installment Pad</Link>)}
                        {hasPermission(json.installment.installmentHistory, 'read') && (<Link to={json.installment.installmentHistory} className={subItemClass(json.installment.installmentHistory)}>Installment History</Link>)}
                        {hasPermission(json.installment.overdue, 'read') && (<Link to={json.installment.overdue} className={subItemClass(json.installment.overdue)}>{t('overdueCustomers')}</Link>)}
                        {hasPermission(json.installment.dueToday, 'read') && (<Link to={json.installment.dueToday} className={subItemClass(json.installment.dueToday)}>{t('dueToday')}</Link>)}
                        {hasPermission(json.installment.unpaidYesterday, 'read') && (<Link to={json.installment.unpaidYesterday} className={subItemClass(json.installment.unpaidYesterday)}>{t('unpaidYesterday')}</Link>)}
                        {hasPermission(json.installment.dueIn3Days, 'read') && (<Link to={json.installment.dueIn3Days} className={subItemClass(json.installment.dueIn3Days)}>{t('dueIn3Days')}</Link>)}
                        {hasPermission(json.installment.overdue3Days, 'read') && (<Link to={json.installment.overdue3Days} className={subItemClass(json.installment.overdue3Days)}>{t('overdue3Days')}</Link>)}
                        {hasPermission(json.installment.overdue7Days, 'read') && (<Link to={json.installment.overdue7Days} className={subItemClass(json.installment.overdue7Days)}>{t('overdue7Days')}</Link>)}
                        {hasPermission(json.installment.paymentHistory, 'read') && (<Link to={json.installment.paymentHistory} className={subItemClass(json.installment.paymentHistory)}>{t('paymentHistory')}</Link>)}
                        {hasPermission(json.installment.cashOut, 'read') && (<Link to={json.installment.cashOut} className={subItemClass(json.installment.cashOut)}>{t('cashOut')}</Link>)}
                        {hasPermission(json.installment.cashIn, 'read') && (<Link to={json.installment.cashIn} className={subItemClass(json.installment.cashIn)}>{t('cashIn')}</Link>)}
                        {hasPermission(json.installment.penalty, 'read') && (<Link to={json.installment.penalty} className={subItemClass(json.installment.penalty)}>{t('penalty')}</Link>)}
                    </DropdownGroup>
                )}

            {/* Lost Phone */}
            {(hasPermission(json.lostphone.actionLockphone, 'read') ||
                hasPermission(json.lostphone.lockPhone, 'read') ||
                hasPermission(json.lostphone.unlockPhone, 'read')) && (
                    <DropdownGroup
                        menuKey="lostphone"
                        icon={<MdOutlinePhoneIphone size={20} />}
                        label={t('lostPhone')}
                        items={[
                            hasPermission(json.lostphone.actionLockphone, 'read') && { to: json.lostphone.actionLockphone, label: t('actions'), active: isActive(json.lostphone.actionLockphone) },
                            hasPermission(json.lostphone.lockPhone, 'read') && { to: json.lostphone.lockPhone, label: t('lockPhone'), active: isActive(json.lostphone.lockPhone) },
                            hasPermission(json.lostphone.unlockPhone, 'read') && { to: json.lostphone.unlockPhone, label: t('unlockPhone'), active: isActive(json.lostphone.unlockPhone) },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.lostphone.actionLockphone, 'read') && (<Link to={json.lostphone.actionLockphone} className={subItemClass(json.lostphone.actionLockphone)}>{t('actions')}</Link>)}
                        {hasPermission(json.lostphone.lockPhone, 'read') && (<Link to={json.lostphone.lockPhone} className={subItemClass(json.lostphone.lockPhone)}>{t('lockPhone')}</Link>)}
                        {hasPermission(json.lostphone.unlockPhone, 'read') && (<Link to={json.lostphone.unlockPhone} className={subItemClass(json.lostphone.unlockPhone)}>{t('unlockPhone')}</Link>)}
                    </DropdownGroup>
                )}

            {/* Wallpaper */}
            {(hasPermission(json.wallpaper.actionWallpaper, 'read') ||
                hasPermission(json.wallpaper.lockWallpaper, 'read') ||
                hasPermission(json.wallpaper.unlockWallpaper, 'read')) && (
                    <DropdownGroup
                        menuKey="wallpaper"
                        icon={<MdOutlineWallpaper size={20} />}
                        label={t('wallpaper')}
                        items={[
                            hasPermission(json.wallpaper.actionWallpaper, 'read') && { to: json.wallpaper.actionWallpaper, label: t('actions'), active: isActive(json.wallpaper.actionWallpaper) },
                            hasPermission(json.wallpaper.lockWallpaper, 'read') && { to: json.wallpaper.lockWallpaper, label: t('lockWallpaper'), active: isActive(json.wallpaper.lockWallpaper) },
                            hasPermission(json.wallpaper.unlockWallpaper, 'read') && { to: json.wallpaper.unlockWallpaper, label: t('unlockWallpaper'), active: isActive(json.wallpaper.unlockWallpaper) },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.wallpaper.actionWallpaper, 'read') && (<Link to={json.wallpaper.actionWallpaper} className={subItemClass(json.wallpaper.actionWallpaper)}>{t('actions')}</Link>)}
                        {hasPermission(json.wallpaper.lockWallpaper, 'read') && (<Link to={json.wallpaper.lockWallpaper} className={subItemClass(json.wallpaper.lockWallpaper)}>{t('lockWallpaper')}</Link>)}
                        {hasPermission(json.wallpaper.unlockWallpaper, 'read') && (<Link to={json.wallpaper.unlockWallpaper} className={subItemClass(json.wallpaper.unlockWallpaper)}>{t('unlockWallpaper')}</Link>)}
                    </DropdownGroup>
                )}

            {/* Report */}
            {(hasPermission(json.report.allCustomers, 'read') ||
                hasPermission(json.report.reportAll, 'read') ||
                hasPermission(json.report.activated, 'read') ||
                hasPermission(json.report.redeem, 'read') ||
                hasPermission(json.report.lockPhone, 'read') ||
                hasPermission(json.report.setWallpaper, 'read') ||
                hasPermission(json.report.installment, 'read') ||
                hasPermission(json.report?.followUpReport || '/report/follow-up', 'read')) && (
                    <DropdownGroup
                        menuKey="report"
                        icon={<MdOutlineBarChart size={20} />}
                        label={t('report')}
                        items={[
                            hasPermission(json.report.allCustomers, 'read') && { to: json.report.allCustomers, label: t('allCustomerReport'), active: isActive(json.report.allCustomers) },
                            hasPermission(json.report.reportAll, 'read') && { to: json.report.reportAll, label: t('reportAll'), active: isActive(json.report.reportAll) },
                            hasPermission(json.report.activated, 'read') && { to: json.report.activated, label: t('activatedReport'), active: isActive(json.report.activated) },
                            hasPermission(json.report.redeem, 'read') && { to: json.report.redeem, label: t('redeemReport'), active: isActive(json.report.redeem) },
                            hasPermission(json.report.lockPhone, 'read') && { to: json.report.lockPhone, label: t('lockPhoneReport'), active: isActive(json.report.lockPhone) },
                            hasPermission(json.report.setWallpaper, 'read') && { to: json.report.setWallpaper, label: t('setWallpaperReport'), active: isActive(json.report.setWallpaper) },
                            hasPermission(json.report.installment, 'read') && { to: json.report.installment, label: t('installmentReport'), active: isActive(json.report.installment) },
                            (hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') || hasPermission('/follow-up/report', 'read')) && { to: json.report?.followUpReport || '/report/follow-up', label: t('followUpReport') || 'Follow Up Report', active: isActive(json.report?.followUpReport || '/report/follow-up') },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.report.allCustomers, 'read') && (<Link to={json.report.allCustomers} className={subItemClass(json.report.allCustomers)}>{t('allCustomerReport')}</Link>)}
                        {hasPermission(json.report.reportAll, 'read') && (<Link to={json.report.reportAll} className={subItemClass(json.report.reportAll)}>{t('reportAll')}</Link>)}
                        {hasPermission(json.report.activated, 'read') && (<Link to={json.report.activated} className={subItemClass(json.report.activated)}>{t('activatedReport')}</Link>)}
                        {hasPermission(json.report.redeem, 'read') && (<Link to={json.report.redeem} className={subItemClass(json.report.redeem)}>{t('redeemReport')}</Link>)}
                        {hasPermission(json.report.lockPhone, 'read') && (<Link to={json.report.lockPhone} className={subItemClass(json.report.lockPhone)}>{t('lockPhoneReport')}</Link>)}
                        {hasPermission(json.report.setWallpaper, 'read') && (<Link to={json.report.setWallpaper} className={subItemClass(json.report.setWallpaper)}>{t('setWallpaperReport')}</Link>)}
                        {hasPermission(json.report.installment, 'read') && (<Link to={json.report.installment} className={subItemClass(json.report.installment)}>{t('installmentReport')}</Link>)}
                        {(hasPermission(json.report?.followUpReport || '/report/follow-up', 'read') || hasPermission('/follow-up/report', 'read')) && (
                            <Link to={json.report?.followUpReport || '/report/follow-up'} className={subItemClass(json.report?.followUpReport || '/report/follow-up')}>{t('followUpReport') || 'Follow Up Report'}</Link>
                        )}
                    </DropdownGroup>
                )}

            {/* History */}
            {(hasPermission(json.history?.loginHistory || '/history/login-history', 'read') ||
                hasPermission(json.history?.deviceHistory || '/history/device-history', 'read')) && (
                    <DropdownGroup
                        menuKey="history"
                        icon={<FaHistory size={18} />}
                        label={t('history')}
                        items={[
                            hasPermission(json.history?.loginHistory || '/history/login-history', 'read') && { to: json.history?.loginHistory || '/history/login-history', label: t('loginHistory'), active: isActive(json.history?.loginHistory || '/history/login-history') },
                            hasPermission(json.history?.deviceHistory || '/history/device-history', 'read') && { to: json.history?.deviceHistory || '/history/device-history', label: t('deviceHistory'), active: isActive(json.history?.deviceHistory || '/history/device-history') },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.history?.loginHistory || '/history/login-history', 'read') && (<Link to={json.history?.loginHistory || '/history/login-history'} className={subItemClass(json.history?.loginHistory || '/history/login-history')}>{t('loginHistory')}</Link>)}
                        {hasPermission(json.history?.deviceHistory || '/history/device-history', 'read') && (<Link to={json.history?.deviceHistory || '/history/device-history'} className={subItemClass(json.history?.deviceHistory || '/history/device-history')}>{t('deviceHistory')}</Link>)}
                    </DropdownGroup>
                )}

            {/* Follow Up */}
            {(hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') ||
                hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') ||
                hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') ||
                hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') ||
                hasPermission('/follow-up/sen-sok', 'read') ||
                hasPermission(json.followUp?.followUpReport || '/report/follow-up', 'read')) && (
                    <DropdownGroup
                        menuKey="followUp"
                        icon={<FaClipboardCheck size={18} />}
                        label={t('followUp') || 'Follow up'}
                        items={[
                            hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') && { to: json.followUp?.followUp1 || '/follow-up/follow-up-1', label: t('followUp1') || 'Follow up 1', active: isActive(json.followUp?.followUp1 || '/follow-up/follow-up-1') },
                            hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') && { to: json.followUp?.followUp2 || '/follow-up/follow-up-2', label: t('followUp2') || 'Follow up 2', active: isActive(json.followUp?.followUp2 || '/follow-up/follow-up-2') },
                            (hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') || hasPermission('/follow-up/sen-sok', 'read')) && { to: json.followUp?.followUp3 || '/follow-up/follow-up-3', label: t('followUp3') || 'Follow up 3', active: isActive(json.followUp?.followUp3 || '/follow-up/follow-up-3') },
                            hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') && { to: json.followUp?.followUp4 || '/follow-up/follow-up-4', label: t('followUp4') || 'Follow up 4', active: isActive(json.followUp?.followUp4 || '/follow-up/follow-up-4') },
                        ].filter(Boolean)}
                    >
                        {hasPermission(json.followUp?.followUp1 || '/follow-up/follow-up-1', 'read') && (<Link to={json.followUp?.followUp1 || '/follow-up/follow-up-1'} className={subItemClass(json.followUp?.followUp1 || '/follow-up/follow-up-1')}>{t('followUp1') || 'Follow up 1'}</Link>)}
                        {hasPermission(json.followUp?.followUp2 || '/follow-up/follow-up-2', 'read') && (<Link to={json.followUp?.followUp2 || '/follow-up/follow-up-2'} className={subItemClass(json.followUp?.followUp2 || '/follow-up/follow-up-2')}>{t('followUp2') || 'Follow up 2'}</Link>)}
                        {(hasPermission(json.followUp?.followUp3 || '/follow-up/follow-up-3', 'read') || hasPermission('/follow-up/sen-sok', 'read')) && (<Link to={json.followUp?.followUp3 || '/follow-up/follow-up-3'} className={subItemClass(json.followUp?.followUp3 || '/follow-up/follow-up-3')}>{t('followUp3') || 'Follow up 3'}</Link>)}
                        {hasPermission(json.followUp?.followUp4 || '/follow-up/follow-up-4', 'read') && (<Link to={json.followUp?.followUp4 || '/follow-up/follow-up-4'} className={subItemClass(json.followUp?.followUp4 || '/follow-up/follow-up-4')}>{t('followUp4') || 'Follow up 4'}</Link>)}
                    </DropdownGroup>
                )}

            {/* Salary */}
            {hasPermission(json.salary || '/salary', 'read') && (
                <NavItem
                    to={json.salary || '/salary'}
                    icon={<FaMoneyBillWave size={19} className={isActive(json.salary || '/salary') ? "text-white" : "text-emerald-600"} />}
                    label={t('salary') || 'Salary'}
                />
            )}

            {/* Settings */}
            {(hasPermission('/settings/all-account', 'read') ||
                hasPermission(json.settings.controlSystem, 'read') ||
                hasPermission(json.settings.systemLogs, 'read')) && (
                    <DropdownGroup
                        menuKey="setting"
                        icon={<IoIosSettings size={20} />}
                        label={t('settings')}
                        items={[
                            hasPermission('/settings/all-account', 'read') && { to: '/settings/all-account', label: t('allAccount'), active: isActive('/settings/all-account') },
                            hasPermission(json.settings.controlSystem, 'read') && { to: json.settings.controlSystem, label: t('controlSystem'), active: isActive(json.settings.controlSystem) },
                            hasPermission(json.settings.systemLogs, 'read') && { to: json.settings.systemLogs, label: t('systemLogs'), active: isActive(json.settings.systemLogs) },
                        ].filter(Boolean)}
                    >
                        {hasPermission('/settings/all-account', 'read') && (<Link to="/settings/all-account" className={subItemClass('/settings/all-account')}>{t('allAccount')}</Link>)}
                        {hasPermission(json.settings.controlSystem, 'read') && (<Link to={json.settings.controlSystem} className={subItemClass(json.settings.controlSystem)}>{t('controlSystem')}</Link>)}
                        {hasPermission(json.settings.systemLogs, 'read') && (<Link to={json.settings.systemLogs} className={subItemClass(json.settings.systemLogs)}>{t('systemLogs')}</Link>)}
                    </DropdownGroup>
                )}

            {/* ── Collapse/Expand Toggle Button (Fixed Pin/Lock) ── */}
            <div className="mt-auto pt-2.5 border-t border-[var(--app-border,rgba(226,232,240,0.6))] flex items-center justify-center">
                <button
                    onClick={onToggleCollapse}
                    type="button"
                    title={collapsed ? "ពង្រីក Menu (Expand)" : "បង្រួម Menu (Collapse)"}
                    className={`group relative flex items-center justify-center rounded-lg transition-all duration-200 border border-[var(--app-border,rgba(226,232,240,0.7))] bg-[var(--app-card,rgba(255,255,255,0.45))] hover:bg-emerald-500/15 hover:border-emerald-500/40 text-[var(--app-text,#0f172a)] hover:text-emerald-600 backdrop-blur-xl shadow-xs hover:shadow-md hover:shadow-emerald-500/10 active:scale-95
                    ${collapsed ? "w-10 h-10" : "w-full h-[38px] px-3 gap-2.5"}`}
                >
                    {collapsed ? (
                        <FaChevronRight size={14} className="text-emerald-600 transition-transform duration-200 group-hover:translate-x-0.5" />
                    ) : (
                        <>
                            <FaChevronLeft size={13} className="text-emerald-600 transition-transform duration-200 group-hover:-translate-x-0.5" />
                            <span className="text-xs font-bold tracking-wide">បង្រួម Menu</span>
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default Left;