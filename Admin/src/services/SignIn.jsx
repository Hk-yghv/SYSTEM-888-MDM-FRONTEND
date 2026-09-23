import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FaLock, FaUser, FaKey, FaShieldAlt, FaTelegramPlane, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import { MdOutlineDashboard } from 'react-icons/md';
import { getFirstAllowedRoute } from '../utils/permissionUtils';
import { setSecureItem } from '../utils/secureStorage';

const SignIn = () => {
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

    const { login, verifyOtp } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

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

    const handleSignIn = async (e) => {
        e.preventDefault();
        if (cooldownSec > 0) return; // blocked
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

            // Parse rate limit response
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
        <div className="w-full h-screen bg-[#070913] flex items-center justify-center relative overflow-hidden select-none p-4">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md bg-[#0f1426]/90 border border-gray-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">

                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 icon-animated-glow">
                        <MdOutlineDashboard className="text-3xl text-white" />
                    </div>
                    <h1 className="text-2xl font-black gradient-text-blue tracking-wide">SYSTEM MDM</h1>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Mobile Device Management Control Portal</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mb-5 p-3 rounded-xl border text-xs font-semibold text-center flex items-start gap-2 ${isBlocked ? 'bg-amber-950/60 border-amber-700/80 text-amber-300' : 'bg-red-950/60 border-red-800/80 text-red-300'}`}>
                        {isBlocked ? <FaClock className="text-amber-400 text-sm flex-shrink-0 mt-0.5" /> : <FaExclamationTriangle className="text-red-400 text-sm flex-shrink-0 mt-0.5" />}
                        <span>{error}</span>
                    </div>
                )}

                {/* Cooldown Timer Banner */}
                {isBlocked && (
                    <div className="mb-5 p-4 rounded-2xl bg-amber-950/50 border border-amber-700/60 text-center">
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

                {!require2FA ? (
                    <form onSubmit={handleSignIn} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-2">{t('username')}</label>
                            <div className="relative flex items-center">
                                <FaUser className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username (e.g. @hakyonghouv)"
                                    disabled={isBlocked}
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-sm text-gray-100 placeholder-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-2">{t('password')}</label>
                            <div className="relative flex items-center">
                                <FaLock className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    disabled={isBlocked}
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-sm text-gray-100 placeholder-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
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
                ) : (
                    /* 2FA OTP Form */
                    <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in duration-300">
                        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 text-center">
                            <FaTelegramPlane className="text-3xl text-indigo-400 mx-auto mb-2 animate-bounce" />
                            <h3 className="text-sm font-bold text-gray-100">{t('telegram2FA')}</h3>
                            <p className="text-xs text-gray-300 mt-1">
                                An OTP code was dispatched to Telegram. Check your Telegram app.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-2">Password តង់ទី២ (2FA Second Password)</label>
                            <div className="relative flex items-center">
                                <FaLock className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="password"
                                    required
                                    value={secondPassword}
                                    onChange={(e) => setSecondPassword(e.target.value)}
                                    placeholder="Enter 2FA Password"
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-sm text-gray-100 placeholder-gray-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-2">{t('otpCode')}</label>
                            <div className="relative flex items-center">
                                <FaKey className="absolute left-4 text-indigo-400 text-sm" />
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Enter 6-digit OTP"
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-center tracking-widest text-lg font-mono text-indigo-300 placeholder-gray-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all transform active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2"
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

                <div className="mt-8 text-center border-t border-gray-800/80 pt-4">
                    <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">SYSTEM MDM &bull; Encrypted &amp; Secured</p>
                </div>
            </div>
        </div>
    );
};

export default SignIn;