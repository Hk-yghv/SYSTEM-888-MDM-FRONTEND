import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FaBan } from 'react-icons/fa';

const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_BACKEND || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        // Clean up legacy localStorage auth to enforce session-only auth
        localStorage.removeItem('mdm_user');
        localStorage.removeItem('mdm_token');
        const saved = sessionStorage.getItem('mdm_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [token, setToken] = useState(() => sessionStorage.getItem('mdm_token') || '');
    const [loading, setLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const pollingRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    const logout = useCallback(() => {
        setUser(null);
        setToken('');
        sessionStorage.removeItem('mdm_user');
        sessionStorage.removeItem('mdm_token');
        localStorage.removeItem('mdm_user');
        localStorage.removeItem('mdm_token');
    }, []);

    // ── 15-Minute Inactivity Auto Logout ──
    useEffect(() => {
        if (!user || !token) return;

        const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in ms

        const resetActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Events to detect user activity
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        activityEvents.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

        const checkInactivity = () => {
            if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT) {
                logout();
            }
        };

        // Interval check every 10 seconds
        const intervalId = setInterval(checkInactivity, 10000);

        // Check when tab becomes visible again
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkInactivity();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            activityEvents.forEach(evt => window.removeEventListener(evt, resetActivity));
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, token, logout]);

    // Real-time block status polling — every 10 seconds
    useEffect(() => {
        if (!user || !token) {
            clearInterval(pollingRef.current);
            return;
        }

        // Skip polling for Master Admin (they can never be blocked)
        if (user.isImmutable || user.username === '@hakyonghouv') return;

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/users/status-check?username=${encodeURIComponent(user.username)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.isBlocked) {
                        setIsBlocked(true);
                        // Wait 3s to show the modal then force logout
                        setTimeout(() => {
                            logout();
                            setIsBlocked(false);
                        }, 4000);
                    }
                }
            } catch {
                // Network error — silently ignore, will retry next interval
            }
        };

        poll(); // immediate first check
        pollingRef.current = setInterval(poll, 10000); // every 10s

        return () => clearInterval(pollingRef.current);
    }, [user, token, logout]);

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
                const err = new Error(data.error || 'Sign in failed');
                err.attempts = data.attempts;
                err.cooldownMs = data.cooldownMs;
                err.waitSeconds = data.waitSeconds;
                err.lockUntil = data.lockUntil;
                throw err;
            }

            if (data.require2FA) {
                return { require2FA: true, username: data.username };
            }

            setUser(data.user);
            setToken(data.token);
            sessionStorage.setItem('mdm_user', JSON.stringify(data.user));
            sessionStorage.setItem('mdm_token', data.token);
            return { success: true, deviceInfo: data.deviceInfo };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const verifyOtp = async (username, otp, secondPassword) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, otp, secondPassword })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                throw new Error(data.error || 'OTP Verification failed');
            }

            setUser(data.user);
            setToken(data.token);
            sessionStorage.setItem('mdm_user', JSON.stringify(data.user));
            sessionStorage.setItem('mdm_token', data.token);
            return { success: true, deviceInfo: data.deviceInfo };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    // Granular RBAC Check Function
    const hasPermission = (pagePath, action = 'read') => {
        if (!user) return false;
        // Profile page is always accessible to any logged-in user
        if (pagePath === '/profile') return true;
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
        sessionStorage.setItem('mdm_user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, logout, hasPermission, updateUserState, API_BASE }}>
            {/* Fullscreen Blocked Modal — shown immediately when admin blocks the user */}
            {isBlocked && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none animate-fade-in">
                    <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
                        {/* Pulsing red lock icon */}
                        <div className="w-24 h-24 rounded-full bg-red-950/80 border-2 border-red-700 flex items-center justify-center text-red-400 text-4xl shadow-2xl shadow-red-900/50 animate-pulse">
                            <FaBan />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-black text-red-400 tracking-wide">
                                គណនីត្រូវបានបិទ
                            </h1>
                            <p className="text-sm font-bold text-gray-200">Account Has Been Blocked</p>
                            <p className="text-xs text-gray-400 leading-relaxed mt-2">
                                គណនីរបស់អ្នក <span className="text-red-300 font-bold font-mono">{user?.username}</span> ត្រូវបាន Administrator បិទ។<br />
                                សូមទំនាក់ទំនង Administrator ដើម្បីស្នើសំណើ Unblock។
                            </p>
                        </div>

                        <div className="w-full bg-gray-900/80 border border-red-800/50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
                            <p className="flex justify-between">
                                <span className="text-gray-500">Username</span>
                                <span className="text-red-300 font-mono font-bold">{user?.username}</span>
                            </p>
                            <p className="flex justify-between">
                                <span className="text-gray-500">Role</span>
                                <span className="text-gray-300 font-semibold">{user?.role}</span>
                            </p>
                            <p className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <span className="text-red-400 font-bold uppercase">Blocked</span>
                            </p>
                        </div>

                        <p className="text-[11px] text-gray-600 animate-pulse">
                            កំពុងបិទ session... Signing out automatically...
                        </p>
                    </div>
                </div>
            )}

            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
