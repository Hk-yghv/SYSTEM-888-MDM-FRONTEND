import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { FaBan } from 'react-icons/fa';
import { smartFetch, getActiveApiBase, API_POOL, invalidateApiCache } from '../utils/smartFetch';
import { clearSecureAuth } from '../utils/secureStorage';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/authToken';
import { CONTROL_SYSTEM_PATH, CONTROL_SYSTEM_SECTIONS } from '../utils/controlSystemPermissions';

const AuthContext = createContext();

export const getDynamicApiBase = () => {
    const configuredApiBase = import.meta.env.VITE_API_BACKEND;
    if (configuredApiBase) return configuredApiBase.replace(/\/+$/, '');
    if (import.meta.env.DEV) return 'http://localhost:5000/api';
    // Production fallback — only used if VITE_API_BACKEND is not set in Vercel env vars
    return '/api';
};

const API_BASE = getDynamicApiBase();
// Always use VITE_API_BACKEND1/2 if set (works in both DEV and PROD for multi-server failover)
const API_BASE1 = import.meta.env.VITE_API_BACKEND1
    ? import.meta.env.VITE_API_BACKEND1.replace(/\/+$/, '')
    : API_BASE;
const API_BASE2 = import.meta.env.VITE_API_BACKEND2
    ? import.meta.env.VITE_API_BACKEND2.replace(/\/+$/, '')
    : API_BASE;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const LOCATION_CHECK_INTERVAL_MS = 15 * 1000;
const LOCATION_WINDOW_MS = 15 * 60 * 1000;

const getCurrentLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
        resolve(null);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy
        }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_CHECK_INTERVAL_MS }
    );
});

const AccessDeadlineNotice = ({ deadlineAt, onExpire }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!deadlineAt) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [deadlineAt]);

    useEffect(() => {
        const deadline = new Date(deadlineAt).getTime();
        if (deadlineAt && Number.isFinite(deadline) && now >= deadline) onExpire();
    }, [deadlineAt, now, onExpire]);

    if (!deadlineAt) return null;
    const deadline = new Date(deadlineAt).getTime();
    const remainingMs = deadline - now;
    if (!Number.isFinite(deadline) || remainingMs > LOCATION_WINDOW_MS || remainingMs <= 0) return null;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return (
        <div className="fixed right-4 top-4 z-[10001] max-w-sm rounded-xl border border-amber-400/60 bg-amber-950/95 px-4 py-3 text-amber-100 shadow-2xl" role="alert" aria-live="assertive">
            <p className="text-xs font-bold">ពេលប្រើប្រាស់ជិតផុតកំណត់</p>
            <p className="mt-1 text-[11px]">ប្រព័ន្ធនឹង logout ស្វ័យប្រវត្តិក្នុង</p>
            <p className="mt-1 text-lg font-black tabular-nums">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</p>
        </div>
    );
};


export const AuthProvider = ({ children }) => {
    const authOperationRef = useRef(0);
    const [user, setUser] = useState(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem('mdm_user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });
    const [authInitialized, setAuthInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isBackendRecovering, setIsBackendRecovering] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const saveUser = useCallback((newUser) => {
        setUser(newUser);
        try {
            if (newUser) {
                localStorage.setItem('mdm_user', JSON.stringify(newUser));
            } else {
                localStorage.removeItem('mdm_user');
            }
        } catch { }
    }, []);

    const logout = useCallback(() => {
        authOperationRef.current += 1;
        const token = getAuthToken();
        fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({})
        }).catch(() => { });
        saveUser(null);
        invalidateApiCache();
        setIsBackendRecovering(false);
        clearSecureAuth();
        clearAuthToken();
    }, [saveUser]);

    useEffect(() => {
        let isActive = true;
        const operationAtStart = authOperationRef.current;
        const restoreSession = async () => {
            try {
                const token = getAuthToken();
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${API_BASE}/auth/session`, {
                    credentials: 'include',
                    headers,
                    cache: 'no-store'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.token) setAuthToken(data.token);
                    if (isActive && operationAtStart === authOperationRef.current && data.user) {
                        saveUser(data.user);
                    }
                } else if (response.status === 423 && isActive && operationAtStart === authOperationRef.current) {
                    setIsBlocked(true);
                    window.setTimeout(() => {
                        logout();
                        setIsBlocked(false);
                    }, 4000);
                } else if (response.status === 401 && token) {
                    clearAuthToken();
                    saveUser(null);
                }
            } catch (error) {
                // Server reboot or network offline: keep user so reload never logs out
            } finally {
                if (isActive) setAuthInitialized(true);
            }
        };
        void restoreSession();
        return () => { isActive = false; };
    }, [logout, saveUser]);

    // Keep the authenticated session alive and recover from temporary backend outages.
    useEffect(() => {
        if (!user?.username) return;

        let isActive = true;
        let heartbeatInFlight = false;
        const pendingRequests = new Set();
        const request = async (url, options = {}) => {
            const controller = new AbortController();
            pendingRequests.add(controller);
            const timeoutId = window.setTimeout(() => controller.abort(), 10000);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } finally {
                window.clearTimeout(timeoutId);
                pendingRequests.delete(controller);
            }
        };
        const waitBeforeRetry = () => new Promise((resolve) => window.setTimeout(resolve, 10000));

        const sendHeartbeat = async () => {
            if (heartbeatInFlight || !isActive) return;
            heartbeatInFlight = true;
            let recovering = false;

            try {
                while (isActive) {
                    try {
                        const token = getAuthToken();
                        const location = user.accessPolicy?.locationRequired
                            ? await getCurrentLocation()
                            : undefined;
                        const response = await request(API_BASE + '/auth/heartbeat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            credentials: 'include',
                            body: JSON.stringify({ username: user.username, location }),
                            cache: 'no-store'
                        });

                        if (response.ok) {
                            if (recovering && isActive) setIsBackendRecovering(false);
                            try {
                                const hbData = await response.json();
                                if (hbData.hasUpdatedPermissions && isActive) {
                                    updateUserState(prev => ({
                                        ...prev,
                                        permissions: hbData.permissions !== undefined ? hbData.permissions : prev?.permissions,
                                        role: hbData.role || prev?.role,
                                        brand: hbData.brand !== undefined ? hbData.brand : prev?.brand,
                                        accessPolicy: hbData.accessPolicy || prev?.accessPolicy,
                                        accessPolicyVersion: hbData.accessPolicyVersion || prev?.accessPolicyVersion
                                    }));
                                }
                            } catch (e) { /* ignore json parse */ }
                            return;
                        }
                        if (response.status === 423) {
                            if (isActive) {
                                setIsBlocked(true);
                                window.setTimeout(() => {
                                    logout();
                                    setIsBlocked(false);
                                }, 4000);
                            }
                            return;
                        }
                        if (response.status === 401 || response.status === 403) {
                            if (isActive) logout();
                            return;
                        }

                        recovering = true;
                        if (isActive) setIsBackendRecovering(true);
                    } catch (error) {
                        if (!isActive) return;
                        if (error.name !== 'AbortError') {
                            console.error('Session heartbeat failed; retrying backend connection:', error);
                        }
                        recovering = true;
                        setIsBackendRecovering(true);
                    }

                    while (isActive) {
                        try {
                            const healthResponse = await request(API_BASE + '/health', { cache: 'no-store' });
                            if (healthResponse.ok) break;
                        } catch (error) {
                            if (!isActive) return;
                            if (error.name !== 'AbortError') {
                                console.error('Backend health check failed; retrying:', error);
                            }
                        }
                        await waitBeforeRetry();
                    }
                    if (isActive) await waitBeforeRetry();
                }
            } finally {
                heartbeatInFlight = false;
            }
        };

        void sendHeartbeat();
        const heartbeatInterval = window.setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_INTERVAL_MS);
        const handleVisibilityChange = () => {
            if (!document.hidden) void sendHeartbeat();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isActive = false;
            pendingRequests.forEach((controller) => controller.abort());
            window.clearInterval(heartbeatInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.username, user?.accessPolicy?.locationRequired, user?.accessPolicyVersion, logout]);

    const login = async (username, password, location) => {
        authOperationRef.current += 1;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password, location })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                const err = new Error(data.error || 'Sign in failed');
                err.attempts = data.attempts;
                err.cooldownMs = data.cooldownMs;
                err.waitSeconds = data.waitSeconds;
                err.lockUntil = data.lockUntil;
                err.code = data.code;
                throw err;
            }

            if (data.require2FA) {
                return {
                    require2FA: true,
                    username: data.username,
                    locationRequired: Boolean(data.locationRequired)
                };
            }

            if (data.token) setAuthToken(data.token);
            saveUser(data.user);
            invalidateApiCache();
            return { success: true, user: data.user, deviceInfo: data.deviceInfo };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const verifyOtp = async (username, otp, secondPassword, location) => {
        authOperationRef.current += 1;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, otp, secondPassword, location })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                const error = new Error(data.error || 'OTP Verification failed');
                error.code = data.code;
                throw error;
            }

            if (data.token) setAuthToken(data.token);
            saveUser(data.user);
            invalidateApiCache();
            return { success: true, user: data.user, deviceInfo: data.deviceInfo };
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const loginWithAuthData = (data) => {
        authOperationRef.current += 1;
        if (!data || !data.user) {
            throw new Error('Invalid authentication response');
        }
        if (data.token) setAuthToken(data.token);
        saveUser(data.user);
        invalidateApiCache();
        return { success: true, user: data.user, deviceInfo: data.deviceInfo };
    };

    // Granular RBAC Check Function — Strict Deny-by-Default
    const hasPermission = (pagePath, action = 'read') => {
        if (typeof pagePath !== 'string' || !pagePath) return false;
        if (!user) return false;
        // Master Admin (@hakyonghouv, isImmutable, or Administrator) has full access
        if (user.username === '@hakyonghouv' || user.username === 'hakyonghouv' || user.isImmutable || user.role === 'Administrator') {
            return true;
        }
        // Profile and Phone App pages are accessible to any authenticated user
        if (pagePath === '/profile' || pagePath === '/settings/phone-app') return true;

        if (!user.permissions) return false;

        const getPagePermissions = (path) => user.permissions[path] ||
            (user.permissions instanceof Map ? user.permissions.get(path) : user.permissions.get?.(path));
        let pagePerms = getPagePermissions(pagePath);

        // Fallback for /audit/telegram/report if not explicitly configured: inherit from /audit/telegram
        if (!pagePerms && pagePath === '/audit/telegram/report') {
            pagePerms = getPagePermissions('/audit/telegram');
        }

        if (pagePath === CONTROL_SYSTEM_PATH && action === 'read') {
            return !!pagePerms?.read || CONTROL_SYSTEM_SECTIONS.some(section => {
                const permissions = getPagePermissions(section.path);
                return permissions?.read || permissions?.edit || permissions?.delete;
            });
        }

        if (pagePath.startsWith(`${CONTROL_SYSTEM_PATH}/`)) {
            const sectionPerms = pagePerms;
            const parentPerms = getPagePermissions(CONTROL_SYSTEM_PATH);
            if (sectionPerms) {
                if (action === 'read' && (sectionPerms.read || sectionPerms.edit || sectionPerms.delete)) return true;
                return !!sectionPerms[action];
            }
            if (action === 'read') return !!(parentPerms?.read || parentPerms?.edit || parentPerms?.delete);
            return !!parentPerms?.[action] || (action === 'delete' && !!parentPerms?.edit);
        }

        if (!pagePerms) return false; // Strict RBAC: Deny if not specifically granted
        return !!pagePerms[action];
    };

    const updateUserState = (updatedUser) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, authInitialized, loading, login, verifyOtp, loginWithAuthData, logout, hasPermission, updateUserState, API_BASE, API_BASE1, API_BASE2, smartFetch, getActiveApiBase, API_POOL }}>
            {/* Fullscreen Blocked Modal — shown immediately when admin blocks the user */}
            {isBlocked && (
                <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none animate-fade-in">
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
                <div className="fixed inset-0 z-10000 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md" role="status" aria-live="polite">
                    <div className="flex flex-col items-center gap-5 px-6 text-center">
                        <div className="h-12 w-12 rounded-full border-4 border-cyan-900 border-t-cyan-400 animate-spin" />
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-gray-100">កំពុងភ្ជាប់ទៅ Backend</h2>
                            <p className="text-sm text-gray-400">កំពុងដាស់សេវា និងព្យាយាមភ្ជាប់ឡើងវិញ...</p>
                        </div>
                    </div>
                </div>
            )}

            <AccessDeadlineNotice deadlineAt={user?.accessDeadlineAt} onExpire={logout} />
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
