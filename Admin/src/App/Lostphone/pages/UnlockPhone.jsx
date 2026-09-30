import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaUnlock, FaFileExcel } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';


const LIMIT = 10;

const UnlockPhone = () => {
    const { t } = useLanguage();
    const { API_BASE2, user, hasPermission } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchUnlockLogs = useCallback(async (pg = page) => {
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
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch phone unlock logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, user, page]);

    useEffect(() => { fetchUnlockLogs(page); }, [page]);

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                action: 'Unlocked',
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all unlock logs for export error:', err);
        }
        return logs;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((item, idx) => ({
            'No': idx + 1,
            'Unlocked Date': item.date || '',
            'Time': item.time || '',
            'Customer Name': item.customerName || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Brand': item.brand || '',
            'User Name': item.userName || item.performedBy || '',
            'Reason': item.reason || ''
        }));
        exportToExcel(data, 'Phone_Unlock_Audit_Logs');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date & Time', cell: (r) => `${r.date} ${r.time}` },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'User Name', accessor: 'userName' },
            { header: 'Reason', accessor: 'reason' },
        ];
        exportToPDF('Phone Unlock Audit History Report', columns, allData);
    };

    return (
        <div className='w-full p-4 select-none space-y-3.5'>
            <header className='p-3 w-full border border-slate-200/90 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-2 h-5 rounded-full bg-emerald-600' />
                    <div>
                        <h1 className='text-sm md:text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2'>
                            {t('unlockPhone')}
                            <span className='px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold'>
                                {total} {t('records') || 'Logs'}
                            </span>
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasPermission('/lost-phone/unlock-phone', 'export') && (
                        <div className="flex items-center gap-1.5">
                            <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                                <FaFileExcel className="text-emerald-600 text-xs" /><span>Excel</span>
                            </button>
                            <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                                <MdPictureAsPdf className="text-rose-600 text-xs" /><span>PDF</span>
                            </button>
                        </div>
                    )}
                    <button onClick={() => fetchUnlockLogs(page)} disabled={reloading} className='flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer border border-slate-200 transition-all shadow-xs'>
                        <MdOutlineSync size={15} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs table-container'>
                <table className='w-full text-left text-xs whitespace-nowrap'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Unlocked Date & Time</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>User Name</th>
                            <th className='px-4 py-3'>Reason</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800 whitespace-nowrap'>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">No phone unlocking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-bold'>
                                        <CopyCell text={`${item.date} at ${item.time}`} className='font-mono text-emerald-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-3 font-bold text-slate-900'><CopyCell text={item.customerName} className='font-bold text-slate-900' /></td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold' /></td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span> : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className='px-4 py-3 text-purple-700 font-semibold'><CopyCell text={item.userName || item.performedBy || ''} className='text-purple-700 font-semibold' /></td>
                                    <td className='px-4 py-3 text-slate-600 text-[11px] font-medium'><CopyCell text={item.reason} className='text-slate-600 text-[11px] font-medium' /></td>
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

export default UnlockPhone;