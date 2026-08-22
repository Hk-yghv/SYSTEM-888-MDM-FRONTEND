import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaUserCircle, FaGlobe, FaSignOutAlt, FaUserCog, FaShieldAlt, FaMobileAlt, FaPlug, FaHourglass, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const Header = () => {
    const [accountOpen, setAccountOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const { t, lang, changeLanguage, LANGUAGES } = useLanguage();
    const { user, logout, API_BASE } = useAuth();
    const navigate = useNavigate();

    // Outstanding Balance & Telemetry State
    const [balance, setBalance] = useState({ totalLoanAmount: 0, totalRevenue: 0, outstandingBalance: 0 });
    const [phoneDevice, setPhoneDevice] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchBalance = async () => {
        try {
            const params = user?.brand && user?.role !== 'Administrator' ? `?userBrand=${user.brand}&userRole=${user.role}` : '';
            const res = await fetch(`${API_BASE}/dashboard/stats${params}`);
            if (res.ok) {
                const data = await res.json();
                setBalance({
                    totalLoanAmount: data.totalLoanAmount || 0,
                    totalRevenue: data.totalRevenue || 0,
                    outstandingBalance: data.outstandingBalance || 0
                });
            }
        } catch { }
    };

    const fetchPhoneStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/phone-app/status`);
            if (res.ok) {
                const data = await res.json();
                setPhoneDevice(data.device || null);
            }
        } catch { }
    };

    useEffect(() => {
        fetchBalance();
        fetchPhoneStatus();
        const interval = setInterval(() => {
            fetchBalance();
            fetchPhoneStatus();
        }, 2000); // 2-second real-time check
        return () => clearInterval(interval);
    }, [API_BASE, user]);

    // Handle Approve Connection
    const handleApproveConnect = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/phone-app/approve-connect`, { method: 'POST' });
            if (res.ok) {
                fetchPhoneStatus();
            }
        } catch (err) {
            console.error('Approve error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Reject / Disconnect
    const handleRejectConnect = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/phone-app/disconnect`, { method: 'POST' });
            if (res.ok) {
                fetchPhoneStatus();
            }
        } catch (err) {
            console.error('Reject error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        setAccountOpen(false);
        navigate('/signin');
    };

    const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
        <>
            <header className='w-full h-[7vh] flex items-center justify-between px-6 bg-white/90 border-b border-emerald-500/20 backdrop-blur-md z-40 select-none shadow-sm'>
                <div className='flex items-center gap-4'>
                    <Link to="/dashboard" className='flex items-center gap-2.5 group'>
                        <img src="/mdm_logo.svg" alt="MDM System Logo" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
                        <h1 className="text-xl font-extrabold tracking-wider text-emerald-700 hover:text-emerald-800 transition-colors">
                            {(!user || user.isImmutable || user.username === '@hakyonghouv' || !user.brand) 
                                ? 'SYSTEM' 
                                : `SYSTEM ${user.brand.toUpperCase()}`}
                        </h1>
                    </Link>

                    {/* ─── Device Connection Status Badge ─── */}
                    <Link
                        to="/settings/phone-app"
                        className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                            phoneDevice?.isConnected 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' 
                                : phoneDevice?.isPending
                                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 animate-pulse'
                                : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        }`}
                        title="Click to view Phone App settings"
                    >
                        <span className={`w-2 h-2 rounded-full ${
                            phoneDevice?.isConnected ? 'bg-emerald-500 animate-ping' : phoneDevice?.isPending ? 'bg-amber-500 animate-ping' : 'bg-red-500'
                        }`}></span>
                        <span>
                            {phoneDevice?.isConnected 
                                ? `📱 Device: ${phoneDevice.model || 'Phone'} Connected` 
                                : phoneDevice?.isPending
                                ? `⏳ Requesting Pair: ${phoneDevice.model || 'Phone'}`
                                : '📱 No Device Connected'}
                        </span>
                    </Link>

                    {/* ─── Outstanding Balance Widget ─── */}
                    <div className='hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200'>
                        {/* Loan */}
                        <div className='flex flex-col items-center px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80'>
                            <span className='text-[9px] font-bold text-slate-500 uppercase tracking-wider'>Loan Out</span>
                            <span className='text-sm font-black text-slate-700 font-mono leading-tight'>${balance.totalLoanAmount.toLocaleString()}</span>
                        </div>
                        {/* Collected */}
                        <div className='flex flex-col items-center px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80'>
                            <span className='text-[9px] font-bold text-emerald-600 uppercase tracking-wider'>Collected</span>
                            <span className='text-sm font-black text-emerald-700 font-mono leading-tight'>${balance.totalRevenue.toLocaleString()}</span>
                        </div>
                        {/* Outstanding */}
                        <div className='flex flex-col items-center px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/80'>
                            <span className='text-[9px] font-bold text-amber-600 uppercase tracking-wider'>Outstanding</span>
                            <span className='text-sm font-black text-amber-700 font-mono leading-tight'>${balance.outstandingBalance.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    {/* Multi-Language Selector */}
                    <div className='relative'>
                        <button
                            onClick={() => { setLangOpen(!langOpen); setAccountOpen(false); }}
                            className='flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 hover:border-emerald-500/50 transition-all text-xs font-semibold cursor-pointer shadow-xs hover:bg-slate-200/60'
                        >
                            <span className='text-base'>{currentLangObj.flag}</span>
                            <span className='hidden sm:inline text-slate-700'>{currentLangObj.label}</span>
                            <FaGlobe className='text-emerald-600 text-xs ml-1' />
                        </button>

                        {langOpen && (
                            <div className='absolute top-[5vh] right-0 bg-white border border-slate-200 rounded-2xl p-2 w-[220px] shadow-xl z-50 animate-in fade-in duration-200'>
                                <p className='text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider border-b border-slate-100 mb-1'>
                                    Select Language / ជ្រើសរើសភាសា
                                </p>
                                <div className='max-h-[300px] overflow-y-auto space-y-1 pr-1'>
                                    {LANGUAGES.map((l) => (
                                        <button
                                            key={l.code}
                                            onClick={() => {
                                                changeLanguage(l.code);
                                                setLangOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${lang === l.code ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-300' : 'hover:bg-slate-100 text-slate-700'}`}
                                        >
                                            <span className='flex items-center gap-2.5'>
                                                <span className='text-base'>{l.flag}</span>
                                                {l.label}
                                            </span>
                                            {lang === l.code && <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping'></span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Account User Badge */}
                    <div className='relative'>
                        <div
                            onClick={() => { setAccountOpen(!accountOpen); setLangOpen(false); }}
                            className='flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-full bg-slate-100 border border-slate-200 hover:border-emerald-500/60 transition-all cursor-pointer shadow-xs hover:bg-slate-200/60'
                        >
                            <div className='w-8 h-8 rounded-full bg-emerald-600 p-0.5 shadow-xs'>
                                <div className='w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden'>
                                    <FaUserCircle className='w-full h-full text-emerald-600 p-0.5' />
                                </div>
                            </div>
                            <div className='text-left hidden md:block'>
                                <p className='text-xs font-bold text-slate-800 leading-tight'>{user ? user.name : 'BOY BOY'}</p>
                                <p className='text-[10px] text-emerald-600 font-medium leading-none'>{user ? user.username : '@hakyonghouv'}</p>
                            </div>
                        </div>

                        {/* Account Menu */}
                        {accountOpen && (
                            <div className='absolute top-[5vh] right-0 bg-white border border-slate-200 w-[220px] p-2 rounded-2xl shadow-xl z-50 animate-in fade-in duration-200'>
                                <div className='p-3 border-b border-slate-100 mb-1 bg-slate-50 rounded-xl'>
                                    <p className='text-xs font-bold text-slate-800'>{user?.name || 'BOY BOY'}</p>
                                    <p className='text-[11px] text-emerald-600 font-mono mt-0.5'>{user?.email || 'yonghouvh@gmail.com'}</p>
                                    <span className='inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 mt-1.5 border border-emerald-200'>
                                        {user?.role || 'Administrator'}
                                    </span>
                                </div>

                                <Link
                                    to="/profile"
                                    onClick={() => setAccountOpen(false)}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl transition-all cursor-pointer text-xs font-medium'
                                >
                                    <FaUserCog className='text-base text-emerald-600' />
                                    <p>{t('profile')}</p>
                                </Link>

                                <Link
                                    to="/settings/all-account"
                                    onClick={() => setAccountOpen(false)}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl transition-all cursor-pointer text-xs font-medium'
                                >
                                    <FaShieldAlt className='text-base text-emerald-600' />
                                    <p>{t('allAccount')}</p>
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-xl transition-all cursor-pointer text-xs font-semibold mt-1 border-t border-slate-100 pt-2'
                                >
                                    <FaSignOutAlt className='text-base text-red-500' />
                                    <p>{t('logout')}</p>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ─── GLOBAL SYSTEM POPUP MODAL FOR PENDING DEVICE CONNECTION ─── */}
            {phoneDevice?.isPending && !phoneDevice?.isConnected && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0b0f1e] border-2 border-amber-500 rounded-3xl max-w-md w-full p-6 text-slate-100 space-y-4 shadow-2xl text-center relative overflow-hidden">
                        <div className="w-16 h-16 rounded-full bg-amber-950/80 border border-amber-600 mx-auto flex items-center justify-center text-amber-400 text-3xl shadow-xl animate-bounce">
                            <FaMobileAlt />
                        </div>

                        <div className="space-y-1">
                            <span className="px-3 py-1 bg-amber-950 text-amber-400 border border-amber-700 text-[10px] font-bold uppercase rounded-full tracking-wider font-khmer">
                                🔔 ឧបករណ៍ទូរស័ព្ទស្នើសុំភ្ជាប់ប្រព័ន្ធ!
                            </span>
                            <h3 className="text-lg font-black text-white pt-2 font-khmer">
                                {phoneDevice.model || 'Samsung Galaxy S24 Ultra'}
                            </h3>
                            <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-300 font-mono">
                                <span>Account: {phoneDevice.username || '@houv'}</span>
                                <span>&bull;</span>
                                <span>Brand: {phoneDevice.brand || '888MDM'}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                                Device ID: {phoneDevice.id} &bull; IP: {phoneDevice.ip || '192.168.1.105'}
                            </p>
                            <p className="text-xs text-amber-300 font-khmer pt-1">
                                ទូរស័ព្ទនេះបានផ្ញើសំណើភ្ជាប់មកកាន់ Computer System! តើអ្នកយល់ព្រមអនុញ្ញាតឱ្យភ្ជាប់ដែរឬទេ?
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={handleApproveConnect}
                                disabled={actionLoading}
                                className="py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer font-khmer transition-all"
                            >
                                <FaCheckCircle className="text-base" />
                                <span>{actionLoading ? 'កំពុងភ្ជាប់...' : '✅ យល់ព្រមអនុញ្ញាត (Approve)'}</span>
                            </button>

                            <button
                                onClick={handleRejectConnect}
                                disabled={actionLoading}
                                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer font-khmer transition-all"
                            >
                                <FaTimesCircle className="text-base text-red-400" />
                                <span>{actionLoading ? 'កំពុងបដិសេធ...' : '❌ បដិសេធ (Reject)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;