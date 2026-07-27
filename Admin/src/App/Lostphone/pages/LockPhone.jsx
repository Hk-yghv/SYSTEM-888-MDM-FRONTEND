import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaLock, FaFileExcel } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

const LIMIT = 10;

const LockPhone = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchLockLogs = useCallback(async (pg = page) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ action: 'Locked', page: pg, limit: LIMIT });
            if (user?.brand && user?.role !== 'Administrator') {
                params.append('userBrand', user.brand);
                params.append('userRole', user.role);
            }
            const res = await fetch(`${API_BASE}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch phone lock logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE, user, page]);

    useEffect(() => { fetchLockLogs(page); }, [page]);

    const handleExportExcel = () => {
        const data = logs.map((item, idx) => ({
            'No': idx + 1,
            'Locked Date': item.date || '',
            'Time': item.time || '',
            'Customer Name': item.customerName || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Brand': item.brand || '',
            'User Name': item.userName || item.performedBy || '',
            'Reason': item.reason || '',
            'Display Text': item.displayText || '',
            'Hotline Phone': item.phoneNumber || ''
        }));
        exportToExcel(data, 'Phone_Lock_Audit_Logs');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date & Time', cell: (r) => `${r.date} ${r.time}` },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'User Name', accessor: 'userName' },
            { header: 'Reason', accessor: 'reason' },
        ];
        exportToPDF('Phone Lock Audit History Report', columns, logs);
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4'>
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xl'>
                        <FaLock />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100 flex items-center gap-2'>
                            {t('lockPhone')} Audit History Log
                        </h1>
                        <p className='text-xs text-red-400 font-semibold'>
                            {total} records — Date, Time, Reason, Display Text, Hotline, User Name
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-2 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'>
                        <FaFileExcel /><span>Excel</span>
                    </button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'>
                        <MdPictureAsPdf className="text-sm" /><span>PDF</span>
                    </button>
                    <button onClick={() => fetchLockLogs(page)} disabled={reloading} className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Locked Date & Time</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>User Name</th>
                            <th className='px-4 py-3'>Reason</th>
                            <th className='px-4 py-3'>Display Text</th>
                            <th className='px-4 py-3'>Hotline Phone</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200 h-[70dvh]'>
                        {loading ? (
                            <tr><td colSpan={10} className="text-center py-10 text-indigo-400">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-8 text-gray-500 italic">No phone locking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-red-300 font-bold'>
                                        {item.date} <span className="text-gray-400 font-normal">at {item.time}</span>
                                    </td>
                                    <td className='px-4 py-3 font-bold text-gray-100'>{item.customerName}</td>
                                    <td className='px-4 py-3 font-semibold text-gray-300'>{item.model}</td>
                                    <td className='px-4 py-3 font-mono text-indigo-300'>{item.serialNumber}</td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 text-indigo-300 rounded-full font-bold text-[10px]">{item.brand}</span> : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className='px-4 py-3 text-purple-300 font-semibold'>{item.userName || item.performedBy || '-'}</td>
                                    <td className='px-4 py-3 text-gray-400 text-[11px]'>{item.reason}</td>
                                    <td className='px-4 py-3 text-amber-300 font-khmer text-[11px] max-w-[200px] truncate' title={item.displayText}>
                                        {item.displayText || 'ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ'}
                                    </td>
                                    <td className='px-4 py-3 font-mono text-emerald-400 font-bold'>{item.phoneNumber || '-'}</td>
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

export default LockPhone;