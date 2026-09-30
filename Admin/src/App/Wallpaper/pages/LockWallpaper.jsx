import React, { useState, useEffect, useCallback } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineSync, MdOutlineWallpaper, MdPictureAsPdf } from 'react-icons/md';
import { FaFileExcel } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';


const LIMIT = 10;

const LockWallpaper = () => {
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
                action: 'Locked',
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
            console.error('Fetch wallpaper lock logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, user, page]);

    useEffect(() => { fetchLogs(page); }, [page]);

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                action: 'Locked',
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE2}/wallpaperlogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all wallpaper lock logs for export error:', err);
        }
        return logs;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((l, idx) => ({
            'No': idx + 1,
            'Locked Date & Time': `${l.date} ${l.time}`,
            'Last Set': l.lastSetTime || `${l.date} ${l.time}`,
            'Customer Name': l.customerName || '',
            'Model': l.model || '',
            'Serial Number': l.serialNumber || '',
            'Brand': l.brand || '',
            'Performed By': l.performedBy || ''
        }));
        exportToExcel(data, 'Lock_Wallpaper_Audit_Logs');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Last Set', cell: (r) => r.lastSetTime || `${r.date} ${r.time}` },
            { header: 'Performed By', accessor: 'performedBy' }
        ];
        exportToPDF('Lock Wallpaper Audit Logs', columns, allData, user?.brand || '');
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900'>{t('lockWallpaper')}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>Locked Date & Time</th>
                            <th className='px-4 py-1 text-center bg-purple-50 text-purple-800 font-bold'>Last Set</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('serialNumber')}</th>
                            <th className='px-4 py-1'>Brand</th>
                            <th className='px-4 py-1'>Performed By</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">No wallpaper locking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-purple-50/40 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-purple-700 font-bold'>
                                        <CopyCell text={`${item.date} at ${item.time}`} className='font-mono text-purple-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-1 text-center font-mono text-purple-700 font-bold bg-purple-50/50 rounded-lg'>
                                        <CopyCell text={item.lastSetTime || `${item.date} ${item.time}`} className='font-mono text-purple-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-1 font-bold text-slate-900'><CopyCell text={item.customerName} className='font-bold text-slate-900' /></td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold' /></td>
                                    <td className='px-4 py-1'>
                                        {item.brand ? <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span> : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className='px-4 py-1 text-slate-700 font-semibold'><CopyCell text={item.performedBy} className='text-slate-700 font-semibold' /></td>
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

export default LockWallpaper;