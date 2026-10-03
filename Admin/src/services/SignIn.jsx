import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
    FaLock,
    FaUser,
    FaKey,
    FaShieldAlt,
    FaTelegramPlane,
    FaExclamationTriangle,
    FaClock,
    FaQrcode,
    FaUpload,
    FaSync,
    FaCheckCircle
} from 'react-icons/fa';
import { MdOutlineDashboard } from 'react-icons/md';
import { getFirstAllowedRoute } from '../utils/permissionUtils';
import { setSecureItem } from '../utils/secureStorage';
import jsQR from 'jsqr';

const SignIn = () => {
    // Mode: 'password' | 'qrcode'
    const [loginMode, setLoginMode] = useState('password');

    // Username & Password State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [secondPassword, setSecondPassword] = useState('');
    const [require2FA, setRequire2FA] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Rate limit countdown state
    const [cooldownSec, setCooldownSec] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const cooldownRef = useRef(null);

    // ── QR Scanner Camera & File State ──
    const [qrStream, setQrStream] = useState(null);
    const [qrScanning, setQrScanning] = useState(false);
    const qrVideoRef = useRef(null);
    const qrAnimationRef = useRef(null);
    const fileInputRef = useRef(null);

    // ── Server Wakeup & Health Verification State ──
    const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'waking' | 'awake'
    const [serverElapsedSec, setServerElapsedSec] = useState(0);
    const [pingAttempts, setPingAttempts] = useState(0);
    const wakeTimerRef = useRef(null);
    const pingAbortRef = useRef(null);

    const { login, verifyOtp, loginWithAuthData, API_BASE } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // Ping Backend Server on startup to wake up free sleeping cloud instance
    const checkServerHealth = useCallback(async () => {
        let isAwake = false;
        let attempt = 0;

        const doPing = async () => {
            attempt++;
            setPingAttempts(attempt);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`${API_BASE}/health`, {
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    isAwake = true;
                    setServerStatus('awake');
                    return true;
                }
            } catch (err) {
                // Server might be sleeping (cold start)
                setServerStatus('waking');
            }
            return false;
        };

        const initialOk = await doPing();
        if (initialOk) return;

        // If not awake immediately, start polling every 2.5s until server wakes up
        const intervalId = setInterval(async () => {
            if (isAwake) {
                clearInterval(intervalId);
                return;
            }
            const ok = await doPing();
            if (ok) {
                clearInterval(intervalId);
            }
        }, 2500);

        return () => clearInterval(intervalId);
    }, [API_BASE]);

    // Timer counting elapsed seconds during server wake up
    useEffect(() => {
        let timer = null;
        if (serverStatus === 'waking' || serverStatus === 'checking') {
            timer = setInterval(() => {
                setServerElapsedSec(s => s + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [serverStatus]);

    // Run health check on initial load
    useEffect(() => {
        const cleanup = checkServerHealth();
        return () => {
            if (typeof cleanup === 'function') cleanup();
        };
    }, [checkServerHealth]);

    // Countdown timer
    useEffect(() => {
        if (cooldownSec > 0) {
            cooldownRef.current = setTimeout(() => setCooldownSec(s => s - 1), 1000);
        }
        return () => clearTimeout(cooldownRef.current);
    }, [cooldownSec]);

    const startCooldown = (seconds) => {
        setCooldownSec(seconds);
    };

    // Stop any active camera streams
    const stopAllStreams = useCallback(() => {
        if (qrAnimationRef.current) {
            cancelAnimationFrame(qrAnimationRef.current);
            qrAnimationRef.current = null;
        }
        if (qrStream) {
            qrStream.getTracks().forEach(t => t.stop());
            setQrStream(null);
        }
        setQrScanning(false);
    }, [qrStream]);

    // Handle tab change
    const handleSwitchMode = (mode) => {
        stopAllStreams();
        setError('');
        setLoginMode(mode);
    };

    // Cleanup streams on unmount
    useEffect(() => {
        return () => {
            stopAllStreams();
        };
    }, [stopAllStreams]);

    // ── 1. Username / Password Login ──
    const handleSignIn = async (e) => {
        e.preventDefault();
        if (cooldownSec > 0) return;
        setError('');
        setLoading(true);

        try {
            const res = await login(username, password);
            setLoading(false);

            if (res.require2FA) {
                setRequire2FA(true);
                setAttempts(0);
                setCooldownSec(0);
            } else if (res.success) {
                setAttempts(0);
                setCooldownSec(0);
                if (res.deviceInfo) {
                    setSecureItem('recent_login_device', res.deviceInfo);
                    setSecureItem('show_login_toast', 'true');
                }
                const targetRoute = getFirstAllowedRoute(res.user);
                navigate(targetRoute);
            }
        } catch (err) {
            setLoading(false);
            const msg = err.message || 'Sign in failed. Check credentials.';

            if (err.waitSeconds) {
                startCooldown(err.waitSeconds);
                setError(`🔒 Too many failed attempts. Please wait ${err.waitSeconds}s.`);
            } else if (err.cooldownMs) {
                const secs = Math.ceil(err.cooldownMs / 1000);
                startCooldown(secs);
                const newAttempts = err.attempts || attempts + 1;
                setAttempts(newAttempts);
                setError(`❌ Wrong password. Cooling down for ${secs}s (Attempt ${newAttempts})`);
            } else {
                setAttempts(a => a + 1);
                setError(msg);
            }
        }
    };

    // ── 2. QR Code Login ──
    const executeQrLogin = async (rawPayload) => {
        if (!rawPayload) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/auth/qr-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrPayload: rawPayload })
            });
            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                throw new Error(data.error || 'QR Code login failed');
            }

            stopAllStreams();
            if (data.require2FA) {
                setUsername(data.username);
                setOtp('');
                setSecondPassword('');
                setRequire2FA(true);
                return;
            }

            const authResult = loginWithAuthData(data);
            if (authResult.deviceInfo) {
                setSecureItem('recent_login_device', authResult.deviceInfo);
                setSecureItem('show_login_toast', 'true');
            }
            const targetRoute = getFirstAllowedRoute(authResult.user);
            navigate(targetRoute);
        } catch (err) {
            setLoading(false);
            setError(err.message || 'QR Code invalid or expired (QR Code មិនត្រឹមត្រូវ)');
        }
    };

    // Start Live QR Scanner from Camera
    const startQrCamera = async () => {
        setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            setQrStream(stream);
            setQrScanning(true);

            if (qrVideoRef.current) {
                qrVideoRef.current.srcObject = stream;
                qrVideoRef.current.setAttribute('playsinline', 'true');
                qrVideoRef.current.play();
                requestAnimationFrame(scanQrFrame);
            }
        } catch (err) {
            setError('មិនអាចបើកកាមេរ៉ាស្កេន QR Code បានទេ សូមអនុញ្ញាត Camera Permission ឬជ្រើសរើស Upload រូបភាព');
        }
    };

    // Realtime QR Frame Scanner Loop
    const scanQrFrame = () => {
        if (!qrVideoRef.current || qrVideoRef.current.readyState !== qrVideoRef.current.HAVE_ENOUGH_DATA) {
            qrAnimationRef.current = requestAnimationFrame(scanQrFrame);
            return;
        }

        const video = qrVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
            // Found QR Code!
            executeQrLogin(code.data);
        } else {
            qrAnimationRef.current = requestAnimationFrame(scanQrFrame);
        }
    };

    // Handle Uploading QR Code Image file
    const handleQrImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.width, img.height);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code && code.data) {
                    executeQrLogin(code.data);
                } else {
                    setLoading(false);
                    setError('មិនអាចស្គាល់ QR Code ក្នុងរូបភាពនេះបានទេ សូមពិនិត្យមើលរូបភាពឡើងវិញ');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ── 3. 2FA Telegram OTP Verification ──
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await verifyOtp(username, otp, secondPassword);
            setLoading(false);
            if (res.success) {
                if (res.deviceInfo) {
                    setSecureItem('recent_login_device', res.deviceInfo);
                    setSecureItem('show_login_toast', 'true');
                }
                const targetRoute = getFirstAllowedRoute(res.user);
                navigate(targetRoute);
            }
        } catch (err) {
            setLoading(false);
            setError(err.message || 'OTP verification failed');
        }
    };

    const isBlocked = cooldownSec > 0;

    return (
        <div className="w-full min-h-screen bg-[#070913] flex items-center justify-center relative overflow-hidden select-none p-4">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* ═══════════ SERVER WAKEUP LOADING SCREEN ═══════════ */}
            {serverStatus !== 'awake' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#070913]/98 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-6 text-center max-w-xs px-6">

                        {/* Animated Logo with pulse rings */}
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                            <div className="absolute inset-[-8px] rounded-full border border-indigo-500/20 animate-pulse"></div>
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-600/40 icon-animated-glow relative z-10">
                                <MdOutlineDashboard className="text-4xl text-white" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-xl font-black gradient-text-blue tracking-wide">SYSTEM MDM</h1>
                            <p className="text-[11px] text-gray-400 font-medium">Mobile Device Management</p>
                        </div>

                        {/* Status Banner */}
                        <div className="w-full p-4 rounded-2xl bg-gray-900/90 border border-gray-800 space-y-3">
                            {serverStatus === 'checking' ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-indigo-300">កំពុងភ្ជាប់ទៅ Server...</p>
                                        <p className="text-[10px] text-gray-400">Connecting to backend server</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-amber-300">🌙 Server កំពុង Wake Up...</p>
                                        <p className="text-[10px] text-gray-400">Free server is starting (please wait)</p>
                                    </div>
                                </div>
                            )}

                            {/* Progress dots */}
                            <div className="flex items-center justify-center gap-1.5 pt-1">
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                                        style={{ animationDelay: `${i * 0.15}s`, animation: 'pulse 1.2s ease-in-out infinite' }}
                                    ></div>
                                ))}
                            </div>

                            {/* Elapsed time & ping counter */}
                            <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[10px] font-mono">
                                <span className="text-gray-500">⏱ {serverElapsedSec}s elapsed</span>
                                <span className="text-gray-500">📡 Ping #{pingAttempts}</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            ប្រព័ន្ធ Backend ប្រើ Free Server ដែលអាច Sleep។<br />
                            សូមមេត្តារង់ចាំ ១–៣០ វិនាទី ដើម្បី Wake Up ។
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full max-w-md bg-[#0f1426]/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-5">

                {/* Logo & Header */}
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3 icon-animated-glow">
                        <MdOutlineDashboard className="text-3xl text-white" />
                    </div>
                    <h1 className="text-2xl font-black gradient-text-blue tracking-wide">SYSTEM MDM</h1>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Mobile Device Management Control Portal</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`p-3 rounded-[8px] border text-xs font-semibold text-center flex items-start gap-2 animate-shake ${isBlocked ? 'bg-amber-950/60 border-amber-700/80 text-amber-300' : 'bg-red-950/60 border-red-800/80 text-red-300'}`}>
                        {isBlocked ? <FaClock className="text-amber-400 text-sm flex-shrink-0 mt-0.5" /> : <FaExclamationTriangle className="text-red-400 text-sm flex-shrink-0 mt-0.5" />}
                        <span className="flex-1 text-left">{error}</span>
                    </div>
                )}

                {/* Cooldown Timer Banner */}
                {isBlocked && (
                    <div className="p-3 rounded-[8px] bg-amber-950/50 border border-amber-700/60 text-center">
                        <p className="text-amber-400 font-bold text-sm mb-1 flex items-center justify-center gap-2">
                            <FaClock className="animate-pulse" />
                            Login Locked — IP Cooldown Active
                        </p>
                        <p className="text-4xl font-black font-mono text-amber-300 tabular-nums">{cooldownSec}s</p>
                        <p className="text-xs text-amber-500/80 mt-1">
                            {attempts >= 6 ? `⚠ High risk — cooldown doubles every 3 attempts` : `After cooldown, you may try again`}
                        </p>
                    </div>
                )}

                {/* ═══════════════════ LOGIN METHOD SELECTOR TABS ═══════════════════ */}
                {!require2FA && (
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-900/90 rounded-xl border border-gray-800 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => handleSwitchMode('password')}
                            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${loginMode === 'password'
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <FaLock className="text-xs" />
                            <span>Password</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                handleSwitchMode('qrcode');
                                setTimeout(startQrCamera, 100);
                            }}
                            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${loginMode === 'qrcode'
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <FaQrcode className="text-xs" />
                            <span>QR Code</span>
                        </button>

                    </div>
                )}

                {/* ═══════════════════ TAB 1: PASSWORD LOGIN ═══════════════════ */}
                {loginMode === 'password' && !require2FA && (
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('username')}</label>
                            <div className="relative flex items-center">
                                <FaUser className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username (e.g. @hakyonghouv)"
                                    disabled={isBlocked}
                                    className="w-full h-11 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-[6px] text-sm text-gray-100 placeholder-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('password')}</label>
                            <div className="relative flex items-center">
                                <FaLock className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    disabled={isBlocked}
                                    className="w-full h-11 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-[6px] text-sm text-gray-100 placeholder-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {attempts > 0 && !isBlocked && (
                            <p className="text-[11px] text-amber-400 font-semibold text-center flex items-center justify-center gap-1">
                                <FaExclamationTriangle size={10} />
                                Failed attempt #{attempts} — Cooldown multiplies every 3 wrong tries
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || isBlocked}
                            className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-[6px] shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : isBlocked ? (
                                <>
                                    <FaClock />
                                    <span>Wait {cooldownSec}s...</span>
                                </>
                            ) : (
                                <>
                                    <FaShieldAlt />
                                    <span>{t('signIn')}</span>
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* ═══════════════════ TAB 2: QR CODE SCANNER (CAMERA + UPLOAD IMAGE) ═══════════════════ */}
                {loginMode === 'qrcode' && !require2FA && (
                    <div className="space-y-4">
                        {/* Live Camera Scanner Box */}
                        <div className="relative w-full aspect-[4/3] bg-black/90 rounded-2xl overflow-hidden border-2 border-dashed border-cyan-500/50 flex flex-col items-center justify-center">
                            <video
                                ref={qrVideoRef}
                                className="w-full h-full object-cover"
                            />
                            {/* Target QR Frame Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-48 h-48 border-2 border-cyan-400/90 rounded-xl relative">
                                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-300"></div>
                                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-300"></div>
                                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-300"></div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-300"></div>
                                    {/* Scanning Line Animation */}
                                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse absolute top-1/2"></div>
                                </div>
                            </div>
                            <p className="absolute bottom-2 text-[10px] text-cyan-200 bg-black/70 px-3 py-1 rounded-full backdrop-blur-sm">
                                ដាក់ QR Code ឱ្យចំក្នុងប្រអប់កាមេរ៉ា (Point camera at QR Code)
                            </p>
                        </div>

                        {/* Camera Action Buttons & Upload Image File */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={startQrCamera}
                                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-[6px] text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <FaSync /> បើកកាមេរ៉ាឡើងវិញ
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-[6px] text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <FaUpload /> ដាក់រូប QR ចូល (Upload)
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleQrImageUpload}
                                className="hidden"
                            />
                        </div>

                        {loading && (
                            <div className="p-2.5 rounded-[6px] bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold text-center flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>កំពុងផ្ទៀងផ្ទាត់ QR Code...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ 2FA TELEGRAM OTP FORM ═══════════════════ */}
                {require2FA && (
                    <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-300">
                        <div className="p-3 rounded-[8px] bg-indigo-950/40 border border-indigo-800/60 text-center">
                            <FaTelegramPlane className="text-3xl text-indigo-400 mx-auto mb-2 animate-bounce" />
                            <h3 className="text-sm font-bold text-gray-100">{t('telegram2FA')}</h3>
                            <p className="text-xs text-gray-300 mt-1">
                                An OTP code was dispatched to Telegram. Check your Telegram app.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('secondPassword2FA')}</label>
                            <div className="relative flex items-center">
                                <FaLock className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="password"
                                    required
                                    value={secondPassword}
                                    onChange={(e) => setSecondPassword(e.target.value)}
                                    placeholder="Enter 2FA Password"
                                    className="w-full h-11 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-[6px] text-sm text-gray-100 placeholder-gray-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('otpCode')}</label>
                            <div className="relative flex items-center">
                                <FaKey className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Enter 6-digit OTP"
                                    className="w-full h-11 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-[6px] text-center tracking-widest text-lg font-mono text-indigo-300 placeholder-gray-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-[6px] shadow-lg shadow-purple-600/30 transition-all transform active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span>{t('verify')}</span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setRequire2FA(false)}
                            className="w-full text-center text-xs text-gray-400 hover:text-gray-200 underline cursor-pointer"
                        >
                            Back to Sign In
                        </button>
                    </form>
                )}

                <div className="text-center border-t border-gray-800/80 pt-3">
                    <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">SYSTEM MDM &bull; Encrypted &amp; Secured</p>
                </div>
            </div>
        </div>
    );
};

export default SignIn;