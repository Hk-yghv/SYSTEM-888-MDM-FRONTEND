import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineWallpaper, MdOutlineSync } from 'react-icons/md';
import { FaLock, FaUnlock } from 'react-icons/fa';

const Actions = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    const fetchContracts = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/contracts?status=Activated`);

            if (res.ok) {
                const result = await res.json();
                setContracts(Array.isArray(result.data) ? result.data : []);
            }
        } catch (err) {
            console.error('Fetch wallpaper action contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const handleToggleWallpaper = async (contract, newStatus) => {
        setTogglingId(contract._id);
        try {
            const res = await fetch(`${API_BASE}/wallpaper/toggle-lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contract.contractId,
                    newStatus,
                    performedBy: user?.name || 'Administrator',
                    reason: `Wallpaper set to ${newStatus} from Wallpaper Control`
                })
            });

            if (res.ok) {
                await fetchContracts();
            }
        } catch (err) {
            console.error('Toggle wallpaper error:', err);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 text-xl'>
                        <MdOutlineWallpaper />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            Wallpaper Lock Action Control
                        </h1>
                        <p className='text-xs text-purple-700 font-bold'>
                            Toggle wallpaper lock status & auto-log audit history to Lock/Unlock Wallpaper pages
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchContracts}
                    disabled={reloading}
                    className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                >
                    <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                    <p>{t('reload')}</p>
                </button>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-180px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3 text-center'>Current Wallpaper Status</th>
                            <th className='px-4 py-3 text-center'>Toggle Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-500 italic font-medium">
                                    No devices available to control.
                                </td>
                            </tr>
                        ) : (
                            contracts.map((item, idx) => {
                                const isLocked = item.lockWallpaperStatus === 'Locked';
                                return (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                        <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{idx + 1}</td>
                                        <td className='px-4 py-3 font-bold text-slate-900'>
                                            {item.customerNameEn} <span className="text-emerald-700 font-khmer text-xs font-semibold">({item.customerNameKh})</span>
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'>{item.model}</td>
                                        <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'>{item.serialNumber}</td>
                                        <td className='px-4 py-3 text-center'>
                                            <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase inline-flex items-center gap-1.5 ${isLocked ? 'bg-purple-50 border border-purple-300 text-purple-700' : 'bg-blue-50 border border-blue-300 text-blue-700'}`}>
                                                {isLocked ? <FaLock size={10} /> : <FaUnlock size={10} />}
                                                {item.lockWallpaperStatus || 'Unlocked'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            {isLocked ? (
                                                <button
                                                    onClick={() => handleToggleWallpaper(item, 'Unlocked')}
                                                    disabled={togglingId === item._id}
                                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                >
                                                    <FaUnlock size={11} />
                                                    <span>Set to Unlock Wallpaper</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggleWallpaper(item, 'Locked')}
                                                    disabled={togglingId === item._id}
                                                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                >
                                                    <FaLock size={11} />
                                                    <span>Set to Lock Wallpaper</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Actions;