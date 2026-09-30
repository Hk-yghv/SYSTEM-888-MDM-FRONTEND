import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineSync, MdOutlineWallpaper } from 'react-icons/md';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';


const LIMIT = 10;

const UnlockWallpaper = () => {
    const { t } = useLanguage();
    const { API_BASE2, user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchLogs = useCallback(async (pg = page) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                action: 'Unlocked',
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE2}/wallpaperlogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch wallpaper unlock logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, user, page]);

    useEffect(() => { fetchLogs(page); }, [page]);

    return (
        <div className='w-full p-4 select-none space-y-3.5'>
            <header className='p-3 w-full border border-slate-200/90 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-2 h-5 rounded-full bg-blue-500' />
                    <div>
                        <h1 className='text-sm md:text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2'>
                            {t('unlockWallpaper')}
                            <span className='px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold'>
                                {total} {t('records') || 'Logs'}
                            </span>
                        </h1>
                    </div>
                </div>
                <button onClick={() => fetchLogs(page)} disabled={reloading} className='flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer border border-slate-200 transition-all shadow-xs'>
                    <MdOutlineSync size={15} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                    <p>{t('reload')}</p>
                </button>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
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
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={7} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic font-medium">No wallpaper unlocking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-blue-700 font-bold'>
                                        <CopyCell text={`${item.date} at ${item.time}`} className='font-mono text-blue-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-3 font-bold text-slate-900'><CopyCell text={item.customerName} className='font-bold text-slate-900' /></td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold' /></td>
                                    <td className='px-4 py-3'>
                                        {item.brand
                                            ? <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span>
                                            : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className='px-4 py-3 text-slate-700 font-semibold'><CopyCell text={item.performedBy} className='text-slate-700 font-semibold' /></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />
        </div>
    );
};

export default UnlockWallpaper;