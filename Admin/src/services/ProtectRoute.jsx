import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaLock } from 'react-icons/fa';

const ProtectRoute = ({ children, pagePath }) => {
    const { token, user, hasPermission } = useAuth();
    const location = useLocation();

    if (!token || !user) {
        return <Navigate to="/signin" replace />;
    }

    const currentPath = pagePath || location.pathname;

    // Check RBAC permission for reading this page
    if (!hasPermission(currentPath, 'read')) {
        return (
            <div className="w-full h-[93vh] flex flex-col items-center justify-center bg-[#070913] p-6 text-center select-none">
                <div className="w-20 h-20 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400 text-3xl mb-4 shadow-xl animate-pulse">
                    <FaLock />
                </div>
                <h2 className="text-xl font-bold text-gray-100">Access Denied / គ្មានសិទ្ធិចូលប្រើប្រាស់</h2>
                <p className="text-xs text-gray-400 max-w-md mt-2">
                    Your user account ({user.username}) does not have permission to view this page ({currentPath}). Please contact your Administrator.
                </p>
            </div>
        );
    }

    return children;
};

export default ProtectRoute;