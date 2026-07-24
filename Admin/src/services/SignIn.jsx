import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FaLock, FaUser, FaKey, FaShieldAlt, FaTelegramPlane } from 'react-icons/fa';
import { MdOutlineDashboard } from 'react-icons/md';

const SignIn = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [require2FA, setRequire2FA] = useState(false);
    const [demoOtpCode, setDemoOtpCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, verifyOtp } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await login(username, password);
            setLoading(false);

            if (res.require2FA) {
                setRequire2FA(true);
                setDemoOtpCode(res.demoOtp || '');
            } else if (res.success) {
                navigate('/dashboard');
            }
        } catch (err) {
            setLoading(false);
            setError(err.message || 'Sign in failed. Check credentials.');
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await verifyOtp(username, otp);
            setLoading(false);
            if (res.success) {
                navigate('/dashboard');
            }
        } catch (err) {
            setLoading(false);
            setError(err.message || 'OTP verification failed');
        }
    };

    const fillMasterAdmin = () => {
        setUsername('@hakyonghouv');
        setPassword('houv#^123');
    };

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

                {error && (
                    <div className="mb-6 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-semibold text-center animate-shake">
                        {error}
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
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-sm text-gray-100 placeholder-gray-500 transition-all"
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
                                    className="w-full h-12 pl-11 pr-4 bg-gray-900/80 border border-gray-700/80 focus:border-indigo-500 rounded-xl text-sm text-gray-100 placeholder-gray-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <FaShieldAlt />
                                    <span>{t('signIn')}</span>
                                </>
                            )}
                        </button>

                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={fillMasterAdmin}
                                className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer font-mono"
                            >
                                Quick Fill Master Admin (@hakyonghouv)
                            </button>
                        </div>
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
                            {demoOtpCode && (
                                <div className="mt-3 p-2 bg-indigo-900/60 border border-indigo-700 rounded-lg text-xs font-mono text-indigo-200">
                                    Demo OTP Code: <span className="font-bold text-white tracking-widest text-sm">{demoOtpCode}</span>
                                </div>
                            )}
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
                    <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">SYSTEM MDM &bull; Encrypted & Secured</p>
                </div>
            </div>
        </div>
    );
};

export default SignIn;