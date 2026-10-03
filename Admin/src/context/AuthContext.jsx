import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FaBan } from 'react-icons/fa';
import { smartFetch, getActiveApiBase, API_POOL } from '../utils/smartFetch';
import { getSecureItem, setSecureItem, clearSecureAuth } from '../utils/secureStorage';

const AuthContext = createContext();

// Production requests go through Vercel's same-origin proxy; local development uses the backend directly.
const API_BASE = import.meta.env.DEV
    ? (import.meta.env.VITE_API_BACKEND || 'http://localhost:5000/api')
    : '/api';
const API_BASE1 = import.meta.env.DEV ? (import.meta.env.VITE_API_BACKEND1 || API_BASE) : API_BASE;
const API_BASE2 = import.meta.env.DEV ? (import.meta.env.VITE_API_BACKEND2 || API_BASE) : API_BASE;
const TEN_MINUTES_MS = 10 * 60 * 1000;


export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        // Restore session auth without deleting the persisted token unexpectedly.
        return getSecureItem('mdm_user', true);
    });

    const [token, setToken] = useState(() => getSecureItem('mdm_token') || '');
    const [loading, setLoading] = useState(false);
    const [isBackendRecovering, setIsBackendRecovering] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const pollingRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    const logout = useCallback(() => {
        if (user?.username) {
            const currentToken = getSecureItem('mdm_token');
            fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
                },
                body: JSON.stringify({ username: user.username })
            }).catch(() => { });
        }
        setUser(null);
        setToken('');
        setIsBackendRecovering(false);
        clearSecureAuth();
    }, [user?.username]);

    // Send periodic heartbeat to keep online status fresh & sendBeacon on unload
    useEffect(() => {
        if (!user?.username || !token) return;

        let isActive = true;
        const postHeartbeat = () => fetch(`${API_BASE}/auth/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username: user.username })
        });

        const sendHeartbeat = async () => {
            if (Date.now() - lastActivityRef.current >= TEN_MINUTES_MS) {
                logout();
                return;
            }

            try {
                const response = await postHeartbeat();
                if (response.ok || !isActive) return;
            } catch {
                if (!isActive) return;
            }

            setIsBackendRecovering(true);
            try {
                const healthResponse = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
                if (healthResponse.ok && isActive) {
                    const retryResponse = await postHeartbeat();
                    if (retryResponse.ok || !isActive) {
                        setIsBackendRecovering(false);
                        return;
                    }
                }
            } catch {
                // The backend is still unreachable; clear the stale session below.
            }

            if (isActive) logout();
        };

        void sendHeartbeat();
        const hbInterval = setInterval(() => { void sendHeartbeat(); }, TEN_MINUTES_MS);

        const handleUnload = () => {
            if (user?.username) {
                // sendBeacon doesn't support custom headers, use keepalive fetch instead
                fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ username: user.username }),
                    keepalive: true
                }).catch(() => { });
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('pagehide', handleUnload);

        return () => {
            isActive = false;
            clearInterval(hbInterval);
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('pagehide', handleUnload);
        };
    }, [user?.username, token, logout]);

    // ── 10 Minute Inactivity Auto Logout
    useEffect(() => {
        if (!user || !token) return;

        const INACTIVITY_TIMEOUT = TEN_MINUTES_MS;

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
            if (Date.now() - lastActivityRef.current >= TEN_MINUTES_MS) return;

            try {
                const res = await fetch(`${API_BASE}/users/status-check?username=${encodeURIComponent(user.username)}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
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
        pollingRef.current = setInterval(poll, TEN_MINUTES_MS);

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
            setSecureItem('mdm_user', data.user);
            setSecureItem('mdm_token', data.token);
            return { success: true, user: data.user, deviceInfo: data.deviceInfo };
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
            setSecureItem('mdm_user', data.user);
            setSecureItem('mdm_token', data.token);
            return { success: true, user: data.user, deviceInfo: data.deviceInfo };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const loginWithAuthData = (data) => {
        if (!data || !data.user || !data.token) {
            throw new Error('Invalid authentication response');
        }
        setUser(data.user);
        setToken(data.token);
        setSecureItem('mdm_user', data.user);
        setSecureItem('mdm_token', data.token);
        return { success: true, user: data.user, deviceInfo: data.deviceInfo };
    };

    // Granular RBAC Check Function — Strict Deny-by-Default
    const hasPermission = (pagePath, action = 'read') => {
        if (!user) return false;
        // Master Admin (@hakyonghouv or isImmutable) has full access to all pages and actions
        if (user.username === '@hakyonghouv' || user.isImmutable) {
            return true;
        }
        // Profile and Phone App pages are accessible to any authenticated user
        if (pagePath === '/profile' || pagePath === '/settings/phone-app') return true;

        if (!user.permissions) return false;

        const pagePerms = user.permissions[pagePath] || (user.permissions instanceof Map ? user.permissions.get(pagePath) : user.permissions.get?.(pagePath));
        if (!pagePerms) return false; // Strict RBAC: Deny if not specifically granted
        return !!pagePerms[action];
    };

    const updateUserState = (updatedUser) => {
        setUser(updatedUser);
        setSecureItem('mdm_user', updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, loginWithAuthData, logout, hasPermission, updateUserState, API_BASE, API_BASE1, API_BASE2, smartFetch, getActiveApiBase, API_POOL }}>
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

                        <div className="w-full bg-gray-900/80 border border-red-800/50 rounded-[5px] p-2 text-xs text-gray-400 space-y-1">
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
                            Signing out automatically...
                        </p>
                    </div>
                </div>
            )}

            {isBackendRecovering && (
                <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md" role="status" aria-live="polite">
                    <div className="flex flex-col items-center gap-5 px-6 text-center">
                        <div className="h-12 w-12 rounded-full border-4 border-cyan-900 border-t-cyan-400 animate-spin" />
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-gray-100">កំពុងភ្ជាប់ទៅ Backend</h2>
                            <p className="text-sm text-gray-400">កំពុងដាស់សេវា និងព្យាយាមភ្ជាប់ឡើងវិញ...</p>
                        </div>
                    </div>
                </div>
            )}

            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
