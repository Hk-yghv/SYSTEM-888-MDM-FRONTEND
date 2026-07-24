import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_BACKEND || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('mdm_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [token, setToken] = useState(() => localStorage.getItem('mdm_token') || '');
    const [loading, setLoading] = useState(false);

    const login = async (username, password) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                throw new Error(data.error || 'Sign in failed');
            }

            if (data.require2FA) {
                return { require2FA: true, username: data.username, demoOtp: data.demoOtp };
            }

            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('mdm_user', JSON.stringify(data.user));
            localStorage.setItem('mdm_token', data.token);
            return { success: true };
        } catch (err) {
            setLoading(false);
            // Fallback for offline local demo if backend is not responding
            if (username === '@hakyonghouv' && password === 'houv#^123') {
                const fallbackUser = {
                    userId: '001290312',
                    name: 'BOY BOY',
                    username: '@hakyonghouv',
                    email: 'yonghouvh@gmail.com',
                    role: 'Administrator',
                    isImmutable: true,
                    status: 'Online',
                    permissions: {}
                };
                setUser(fallbackUser);
                setToken('fallback-master-token-2026');
                localStorage.setItem('mdm_user', JSON.stringify(fallbackUser));
                localStorage.setItem('mdm_token', 'fallback-master-token-2026');
                return { success: true };
            }
            throw err;
        }
    };

    const verifyOtp = async (username, otp) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, otp })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                throw new Error(data.error || 'OTP Verification failed');
            }

            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('mdm_user', JSON.stringify(data.user));
            localStorage.setItem('mdm_token', data.token);
            return { success: true };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const logout = () => {
        setUser(null);
        setToken('');
        localStorage.removeItem('mdm_user');
        localStorage.removeItem('mdm_token');
    };

    // Granular RBAC Check Function
    const hasPermission = (pagePath, action = 'read') => {
        if (!user) return false;
        // Master Admin has full access to all pages and actions
        if (user.username === '@hakyonghouv' || user.role === 'Administrator' || user.isImmutable) {
            return true;
        }
        if (!user.permissions) return false;

        const pagePerms = user.permissions[pagePath] || user.permissions.get?.(pagePath);
        if (!pagePerms) return false;
        return !!pagePerms[action];
    };

    const updateUserState = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem('mdm_user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, logout, hasPermission, updateUserState, API_BASE }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
