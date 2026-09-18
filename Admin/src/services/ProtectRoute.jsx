import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FaLock } from 'react-icons/fa';
import { getFirstAllowedRoute } from '../utils/permissionUtils';

const ProtectRoute = ({ children, pagePath }) => {
    const { token, user, hasPermission } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();

    if (!token || !user) {
        return <Navigate to="/signin" replace />;
    }

    const currentPath = pagePath || location.pathname;

    // Check RBAC permission for reading this page
    if (!hasPermission(currentPath, 'read')) {
        // If the user does not have permission for the dashboard, auto-redirect to their first allowed page
        if (currentPath === '/dashboard') {
            const firstRoute = getFirstAllowedRoute(user, hasPermission);
            if (firstRoute && firstRoute !== '/dashboard') {
                return <Navigate to={firstRoute} replace />;
            }
        }

        return (
            <div className="w-full h-[93vh] flex flex-col items-center justify-center bg-[#070913] p-6 text-center select-none">
                <div className="w-20 h-20 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400 text-3xl mb-4 shadow-xl animate-pulse">
                    <FaLock />
                </div>
                <h2 className="text-xl font-bold text-gray-100">{t('accessDenied')}</h2>
                <p className="text-xs text-gray-400 max-w-md mt-2">
                    {t('accessDeniedMsg')} ({user.username})
                </p>
            </div>
        );
    }

    return children;
};

export default ProtectRoute;