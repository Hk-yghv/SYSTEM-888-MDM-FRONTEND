import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineWallpaper, MdOutlineSync, MdSearch } from 'react-icons/md';
import { FaLock, FaUnlock } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 10;

const Actions = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchContracts = async (pg = page) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);

            if (res.ok) {
                const result = await res.json();
                setContracts(Array.isArray(result.data) ? result.data : []);
                setTotal(result.total || 0);
            }
        } catch (err) {
            console.error('Fetch wallpaper action contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchContracts(page);
    }, [page]);

    const filteredContracts = contracts.filter(c => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (c.customerNameEn && c.customerNameEn.toLowerCase().includes(term)) ||
            (c.customerNameKh && c.customerNameKh.toLowerCase().includes(term)) ||
            (c.model && c.model.toLowerCase().includes(term)) ||
            (c.serialNumber && c.serialNumber.toLowerCase().includes(term)) ||
            (c.phone && c.phone.toLowerCase().includes(term)) ||
            (c.contractId && c.contractId.toLowerCase().includes(term))
        );
    });

    const handleToggleWallpaper = async (contract, newStatus) => {
        const actionLabel = newStatus === 'Locked' || newStatus === 'LockWallpaper' ? t('lockWallpaper') : t('unlockWallpaper');
        if (!window.confirm(t('confirmAction') + ` (${actionLabel})`)) return;

        setTogglingId(contract._id);
        try {
            const res = await fetch(`${API_BASE2}/wallpaper/toggle-lock`, {
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
                await fetchContracts(page);
            }
        } catch (err) {
            console.error('Toggle wallpaper error:', err);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            Wallpaper
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search customer, model, serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-[5px] text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition-all w-64 shadow-2xs"
                        />
                    </div>
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('serialNumber')}</th>
                            <th className='px-4 py-1 text-center'>Current Wallpaper Status</th>
                            <th className='px-4 py-1 text-center'>Toggle Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredContracts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-500 italic font-medium">
                                    No devices found.
                                </td>
                            </tr>
                        ) : (
                            filteredContracts.map((item, idx) => {
                                const isLocked = item.lockWallpaperStatus === 'Locked';
                                return (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                        <td className='px-4 py-1 font-bold text-slate-900'>
                                            <CopyCell text={item.customerNameEn} className="font-bold text-slate-900 block" />
                                            {item.customerNameKh && <CopyCell text={item.customerNameKh} className="text-emerald-700 font-khmer text-xs font-semibold" />}
                                        </td>
                                        <td className='px-4 py-1 font-semibold text-slate-800'>
                                            <CopyCell text={item.model} className="font-semibold text-slate-800" />
                                        </td>
                                        <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'>
                                            <CopyCell text={item.serialNumber} className="font-mono text-emerald-700 font-semibold" />
                                        </td>
                                        <td className='px-4 py-1 text-center'>
                                            <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase inline-flex items-center gap-1.5 ${isLocked ? 'bg-purple-50 border border-purple-300 text-purple-700' : 'bg-blue-50 border border-blue-300 text-blue-700'}`}>
                                                {isLocked ? <FaLock size={10} /> : <FaUnlock size={10} />}
                                                {item.lockWallpaperStatus || 'Unlocked'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-1 text-center'>
                                            {hasPermission('/wallpaper/actions', 'edit') || hasPermission('/wallpaper/actions', 'create') ? (
                                                isLocked ? (
                                                    <button
                                                        onClick={() => handleToggleWallpaper(item, 'Unlocked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                    >
                                                        <FaUnlock size={11} />
                                                        <span>Set to Unlock Wallpaper</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleWallpaper(item, 'Locked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                    >
                                                        <FaLock size={11} />
                                                        <span>Set to Lock Wallpaper</span>
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-slate-400 font-semibold text-xs italic">Read Only</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />
        </div>
    );
};

export default Actions;