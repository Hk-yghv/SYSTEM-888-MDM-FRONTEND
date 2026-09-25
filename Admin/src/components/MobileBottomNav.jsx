import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdAdd, MdDashboard, MdMoreHoriz, MdOutlinePhoneIphone } from 'react-icons/md';
import { IoIosContact } from 'react-icons/io';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import json from '../routes/Routes.json';

const MobileBottomNav = ({ onOpenMenu }) => {
    const location = useLocation();
    const { t } = useLanguage();
    const { hasPermission } = useAuth();

    const items = [
        { path: json.dashboard, label: t('dashboard'), icon: MdDashboard, permission: '/dashboard' },
        { path: json.customer, label: t('customer'), icon: IoIosContact, permission: '/customer' },
        { path: json.device, label: t('device'), icon: MdOutlinePhoneIphone, permission: '/device' }
    ].filter((item) => hasPermission(item.permission, 'read'));

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="mobile-bottom-nav md:hidden" aria-label="Mobile navigation">
            <div className="mobile-bottom-nav-links">
                {items.slice(0, 2).map(({ path, label, icon: Icon }) => (
                    <Link key={path} to={path} className={`mobile-bottom-nav-item ${isActive(path) ? 'mobile-bottom-nav-item-active' : ''}`}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                    </Link>
                ))}

                {hasPermission(json.contract.application, 'read') && (
                    <Link to={json.contract.application} className="mobile-create-action" aria-label={t('application')} title={t('application')}>
                        <MdAdd aria-hidden="true" />
                    </Link>
                )}

                {items.slice(2).map(({ path, label, icon: Icon }) => (
                    <Link key={path} to={path} className={`mobile-bottom-nav-item ${isActive(path) ? 'mobile-bottom-nav-item-active' : ''}`}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                    </Link>
                ))}

                <button type="button" onClick={onOpenMenu} className="mobile-bottom-nav-item" aria-label="More navigation" title="More navigation">
                    <MdMoreHoriz aria-hidden="true" />
                    <span>{t('more') || 'More'}</span>
                </button>
            </div>
        </nav>
    );
};

export default MobileBottomNav;