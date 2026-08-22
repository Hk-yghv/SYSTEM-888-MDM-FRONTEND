import React, { useState } from 'react';
import { FaUser, FaLock, FaBuilding, FaArrowLeft, FaSignInAlt, FaExclamationTriangle, FaQrcode } from 'react-icons/fa';

const Login = ({ API_BASE, selectedBrand, onChangeBrand, onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('សូមបញ្ចូល Username និង Password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            setLoading(false);

            if (!res.ok) {
                setError(data.error || data.message || 'ការចូលប្រព័ន្ធបរាជ័យ សូមពិនិត្យមើល Username / Password');
                return;
            }

            const authenticatedUser = {
                ...data.user,
                brand: selectedBrand || data.user?.brand || 'Main System'
            };

            onLoginSuccess(authenticatedUser, data.token);
        } catch (err) {
            setLoading(false);
            console.error('Auth Error:', err);
            setError('មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ សូមពិនិត្យមើលអុីនធឺណិត');
        }
    };

    return (
        <div className="min-h-screen bg-[#070913] flex flex-col justify-between p-6 select-none relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Top Navigation */}
            <div className="flex items-center justify-between z-10 pt-2">
                <button
                    onClick={onChangeBrand}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-indigo-300 hover:text-white cursor-pointer shadow-md"
                >
                    <FaArrowLeft />
                    <span>ជ្រើសរើស Brand ឡើងវិញ ({selectedBrand})</span>
                </button>
            </div>

            {/* Main Form Box */}
            <div className="w-full max-w-sm mx-auto space-y-6 z-10 my-auto">
                <div className="text-center space-y-2">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-900/90 border border-indigo-500/40 p-2.5 flex items-center justify-center shadow-2xl">
                        <img src="/mdm_logo.svg" alt="MDM Logo" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 font-khmer">
                        ចូលប្រព័ន្ធ SYSTEM MDM
                    </h2>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/80 border border-indigo-700/70 rounded-full text-xs font-bold text-indigo-300">
                        <FaBuilding className="text-indigo-400" />
                        <span>Brand: {selectedBrand}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-2xl backdrop-blur-md">
                    {error && (
                        <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs font-khmer font-semibold flex items-center gap-2">
                            <FaExclamationTriangle className="text-red-400 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-400 font-khmer">Username / ឈ្មោះគណនី</label>
                        <div className="relative">
                            <FaUser className="absolute left-3.5 top-3.5 text-slate-500 text-xs" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="@username"
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-400 font-khmer">Password / ពាក្យសម្ងាត់</label>
                        <div className="relative">
                            <FaLock className="absolute left-3.5 top-3.5 text-slate-500 text-xs" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white outline-none"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                        <FaSignInAlt />
                        <span>{loading ? 'កំពុងចូលប្រព័ន្ធ...' : 'Sign In'}</span>
                    </button>
                </form>
            </div>

            {/* Clean Footer (No Raw API URLs) */}
            <div className="text-center text-[11px] text-slate-500 font-khmer z-10">
                SYSTEM MDM Mobile Application &bull; Secured Connection
            </div>
        </div>
    );
};

export default Login;
