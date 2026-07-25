import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaUnlock } from 'react-icons/fa';
import { MdOutlineSync, MdOutlineWallpaper } from 'react-icons/md';

const UnlockWallpaper = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const fetchLogs = async () => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ action: 'Unlocked' });
            if (user?.brand && user?.role !== 'Administrator') {
                params.append('userBrand', user.brand);
                params.append('userRole', user.role);
            }
            const res = await fetch(`${API_BASE}/wallpaperlogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error('Fetch wallpaper unlock logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4'>
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xl'>
                        <MdOutlineWallpaper />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100 flex items-center gap-2'>
                            {t('unlockWallpaper')} Audit History Log
                        </h1>
                        <p className='text-xs text-blue-400 font-semibold'>
                            Automated records of wallpapers set to Unlock
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchLogs}
                    disabled={reloading}
                    className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                >
                    <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                    <p>{t('reload')}</p>
                </button>
            </header>

            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Unlocked Date & Time</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>Performed By</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-500 italic">
                                    No wallpaper unlocking activity recorded yet.
                                </td>
                            </tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-blue-300 font-bold'>
                                        {item.date} <span className="text-gray-400 font-normal">at {item.time}</span>
                                    </td>
                                    <td className='px-4 py-3 font-bold text-gray-100'>{item.customerName}</td>
                                    <td className='px-4 py-3 font-semibold text-gray-300'>{item.model}</td>
                                    <td className='px-4 py-3 font-mono text-indigo-300'>{item.serialNumber}</td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? (
                                            <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 text-indigo-300 rounded-full font-bold text-[10px]">{item.brand}</span>
                                        ) : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className='px-4 py-3 text-gray-300 font-semibold'>{item.performedBy}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UnlockWallpaper;