import React, { useState } from 'react';
import { FaUser, FaLock, FaBuilding, FaArrowLeft, FaSignInAlt, FaExclamationTriangle, FaCog, FaServer, FaCheckCircle } from 'react-icons/fa';

const Login = ({ API_BASE, selectedBrand, onChangeBrand, onLoginSuccess, onUpdateApiUrl }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Server Config Modal State
    const [showConfig, setShowConfig] = useState(false);
    const [customUrl, setCustomUrl] = useState(API_BASE);

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
            setError(`មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធ (${API_BASE}) បានទេ! សូមពិនិត្យមើលអុីនធឺណិត ឬចុចប៊ូតុង ⚙️ កែប្រែ Server IP/URL`);
        }
    };

    const handleSaveServerUrl = () => {
        if (onUpdateApiUrl) {
            onUpdateApiUrl(customUrl);
        }
        setShowConfig(false);
        setError('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#070913] to-[#04060c] flex flex-col justify-between p-6 select-none relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Top Navigation */}
            <div className="flex items-center justify-between z-10 pt-2">
                <button
                    onClick={onChangeBrand}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-indigo-300 hover:text-white cursor-pointer shadow-md transition-all hover:border-indigo-500/50"
                >
                    <FaArrowLeft />
                    <span className="font-khmer">ជ្រើសរើស Brand ឡើងវិញ ({selectedBrand})</span>
                </button>

                <button
                    onClick={() => setShowConfig(true)}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-indigo-400 cursor-pointer shadow-md transition-all"
                    title="Server URL Settings"
                >
                    <FaCog className="text-sm" />
                </button>
            </div>

            {/* Main Form Box */}
            <div className="w-full max-w-sm mx-auto space-y-6 z-10 my-auto">
                <div className="text-center space-y-3">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-900/90 border border-indigo-500/40 p-3 flex items-center justify-center shadow-2xl shadow-indigo-500/20 backdrop-blur-xl">
                        <img src="/mdm_logo.svg" alt="MDM Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-100 font-khmer">
                            ចូលប្រព័ន្ធ SYSTEM MDM
                        </h2>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/80 border border-indigo-700/70 rounded-full text-xs font-bold text-indigo-300">
                            <FaBuilding className="text-indigo-400" />
                            <span>Brand: {selectedBrand}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4.5 bg-slate-900/80 border border-slate-800/80 p-6 rounded-3xl shadow-2xl backdrop-blur-md">
                    {error && (
                        <div className="p-3.5 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl text-xs font-khmer font-semibold space-y-2 shadow-lg text-left">
                            <div className="flex items-center gap-2">
                                <FaExclamationTriangle className="text-red-400 text-base flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowConfig(true)}
                                className="w-full py-1.5 bg-red-900 hover:bg-red-800 text-white rounded-xl text-[11px] font-bold font-khmer flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <FaCog /> ⚙️ ចុចកែប្រែ Server IP / URL ទីនេះ
                            </button>
                        </div>
                    )}

                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-slate-300 font-khmer">Username / ឈ្មោះគណនី</label>
                        <div className="relative">
                            <FaUser className="absolute left-3.5 top-3.5 text-indigo-400 text-xs" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="@username"
                                className="w-full pl-9 pr-3.5 py-3 bg-slate-950/90 border border-slate-700/80 focus:border-indigo-500 rounded-2xl text-xs text-white outline-none font-semibold transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-slate-300 font-khmer">Password / ពាក្យសម្ងាត់</label>
                        <div className="relative">
                            <FaLock className="absolute left-3.5 top-3.5 text-indigo-400 text-xs" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-3.5 py-3 bg-slate-950/90 border border-slate-700/80 focus:border-indigo-500 rounded-2xl text-xs text-white outline-none font-semibold transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-2xl text-xs shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                        <FaSignInAlt className="text-base" />
                        <span className="font-khmer text-sm">{loading ? 'កំពុងចូលប្រព័ន្ធ...' : 'Sign In to System'}</span>
                    </button>
                </form>
            </div>

            {/* Server Settings Modal */}
            {showConfig && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-indigo-500/50 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-left">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                            <h3 className="text-xs font-bold text-indigo-400 font-khmer flex items-center gap-2">
                                <FaServer /> កែប្រែ Server Backend API URL
                            </h3>
                            <button onClick={() => setShowConfig(false)} className="text-gray-400 text-xs font-bold">✕</button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <label className="text-slate-300 font-bold block font-khmer">
                                Server URL / IP Address:
                            </label>
                            <input
                                type="text"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder="https://system-mdm.onrender.com/api"
                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs outline-none focus:border-indigo-500"
                            />
                            <p className="text-[10px] text-slate-400 font-khmer">
                                ឧទាហរណ៍ ៖ <code className="text-indigo-400">https://system-mdm.onrender.com/api</code> ឬ <code className="text-emerald-400">http://192.168.1.100:5000/api</code>
                            </p>
                        </div>

                        <div className="space-y-2 pt-1">
                            <button
                                onClick={handleSaveServerUrl}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs font-khmer flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <FaCheckCircle /> <span>រក្សាទុក Server URL ថ្មី</span>
                            </button>

                            <button
                                onClick={() => {
                                    setCustomUrl('https://system-mdm.onrender.com/api');
                                    onUpdateApiUrl('https://system-mdm.onrender.com/api');
                                    setShowConfig(false);
                                }}
                                className="w-full py-2 bg-slate-800 text-slate-300 rounded-xl text-[11px] font-bold font-khmer cursor-pointer"
                            >
                                🔄 ប្រើប្រាស់ Online Production Server (Default)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clean Footer */}
            <div className="text-center text-[10px] text-slate-500 font-khmer z-10">
                SYSTEM MDM Mobile Application &bull; Secured System Authentication
            </div>
        </div>
    );
};

export default Login;
