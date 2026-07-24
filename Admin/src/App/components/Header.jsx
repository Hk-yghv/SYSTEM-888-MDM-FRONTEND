import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

import { FaUserCircle, FaGlobe, FaSignOutAlt, FaUserCog, FaShieldAlt } from 'react-icons/fa';

const Header = () => {
    const [accountOpen, setAccountOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    const { t, lang, changeLanguage, LANGUAGES } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        setAccountOpen(false);
        navigate('/signin');
    };

    const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
        <>
            <header className='w-full h-[7vh] flex items-center justify-between px-6 bg-[#0c0f1d]/90 border-b border-gray-800/80 backdrop-blur-md z-40 select-none shadow-md'>
                <div className='flex items-center gap-3'>
                    <Link to="/dashboard" className='flex items-center gap-2'>
                        <h1 className="text-xl font-black tracking-wider gradient-text-blue">
                            SYSTEM MDM
                        </h1>
                    </Link>
                </div>

                <div className='flex items-center gap-4'>
                    {/* Multi-Language Selector */}
                    <div className='relative'>
                        <button
                            onClick={() => { setLangOpen(!langOpen); setAccountOpen(false); }}
                            className='flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800/70 border border-gray-700/60 hover:border-indigo-500/50 transition-all text-xs font-semibold cursor-pointer shadow-sm hover:bg-gray-800'
                        >
                            <span className='text-base'>{currentLangObj.flag}</span>
                            <span className='hidden sm:inline text-gray-200'>{currentLangObj.label}</span>
                            <FaGlobe className='text-indigo-400 text-xs ml-1' />
                        </button>

                        {langOpen && (
                            <div className='absolute top-[5vh] right-0 bg-[#121629] border border-gray-700/80 rounded-2xl p-2 w-[220px] shadow-2xl z-50 animate-in fade-in duration-200'>
                                <p className='text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider border-b border-gray-800/80 mb-1'>
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
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${lang === l.code ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40' : 'hover:bg-gray-800/70 text-gray-300'}`}
                                        >
                                            <span className='flex items-center gap-2.5'>
                                                <span className='text-base'>{l.flag}</span>
                                                {l.label}
                                            </span>
                                            {lang === l.code && <span className='w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping'></span>}
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
                            className='flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-full bg-gray-800/60 border border-gray-700/60 hover:border-indigo-500/60 transition-all cursor-pointer shadow-sm hover:bg-gray-800'
                        >
                            <div className='w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 shadow-inner'>
                                <div className='w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden'>
                                    <FaUserCircle className='w-full h-full text-indigo-300 p-0.5' />
                                </div>
                            </div>
                            <div className='text-left hidden md:block'>
                                <p className='text-xs font-bold text-gray-100 leading-tight'>{user ? user.name : 'BOY BOY'}</p>
                                <p className='text-[10px] text-indigo-400 font-medium leading-none'>{user ? user.username : '@hakyonghouv'}</p>
                            </div>
                        </div>

                        {/* Account Menu */}
                        {accountOpen && (
                            <div className='absolute top-[5vh] right-0 bg-[#121629] border border-gray-700/80 w-[220px] p-2 rounded-2xl shadow-2xl z-50 animate-in fade-in duration-200'>
                                <div className='p-3 border-b border-gray-800/80 mb-1 bg-gray-900/40 rounded-xl'>
                                    <p className='text-xs font-bold text-gray-200'>{user?.name || 'BOY BOY'}</p>
                                    <p className='text-[11px] text-indigo-400 font-mono mt-0.5'>{user?.email || 'yonghouvh@gmail.com'}</p>
                                    <span className='inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 mt-1.5 border border-indigo-700/50'>
                                        {user?.role || 'Administrator'}
                                    </span>
                                </div>

                                <Link
                                    to="/profile"
                                    onClick={() => setAccountOpen(false)}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-indigo-600/20 text-gray-300 hover:text-indigo-300 rounded-xl transition-all cursor-pointer text-xs font-medium'
                                >
                                    <FaUserCog className='text-base text-indigo-400' />
                                    <p>{t('profile')}</p>
                                </Link>

                                <Link
                                    to="/settings/all-account"
                                    onClick={() => setAccountOpen(false)}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-indigo-600/20 text-gray-300 hover:text-indigo-300 rounded-xl transition-all cursor-pointer text-xs font-medium'
                                >
                                    <FaShieldAlt className='text-base text-indigo-400' />
                                    <p>{t('allAccount')}</p>
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className='w-full h-[40px] flex items-center gap-3 px-3 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer text-xs font-semibold mt-1 border-t border-gray-800/60 pt-2'
                                >
                                    <FaSignOutAlt className='text-base text-red-400' />
                                    <p>{t('logout')}</p>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;