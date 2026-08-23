import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaUserCircle, FaGlobe, FaSignOutAlt, FaUserCog, FaShieldAlt, FaRobot } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

const Header = ({ onOpenAI }) => {
    const [accountOpen, setAccountOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const { t, lang, changeLanguage, LANGUAGES } = useLanguage();
    const { user, logout, API_BASE } = useAuth();
    const navigate = useNavigate();

    // Outstanding Balance State
    const [balance, setBalance] = useState({ totalLoanAmount: 0, totalRevenue: 0, outstandingBalance: 0 });

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

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 5000);
        return () => clearInterval(interval);
    }, [API_BASE, user]);

    const handleLogout = () => {
        logout();
        setAccountOpen(false);
        navigate('/signin');
    };

    const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
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
                {/* AI Assistant */}
                <button
                    onClick={onOpenAI}
                    className='flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm shadow-indigo-600/25 transition-all cursor-pointer border border-indigo-500'
                    title='Open MDM AI Assistant'
                >
                    <FaRobot className='text-sm' />
                    <span className='hidden sm:inline'>MDM AI</span>
                    <HiSparkles className='text-amber-300 text-sm' />
                </button>

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
    );
};

export default Header;