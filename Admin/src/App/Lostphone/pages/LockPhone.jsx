import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaLock, FaFileExcel } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';


const LIMIT = 10;

const LockPhone = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE2, user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [defaultDisplayText, setDefaultDisplayText] = useState('ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់');

    useEffect(() => {
        const fetchControlConfig = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=${user?.brand || ''}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.lockPhoneNotice) {
                        setDefaultDisplayText(data.lockPhoneNotice);
                    }
                }
            } catch (err) {
                console.error('Fetch control config error:', err);
            }
        };
        fetchControlConfig();
    }, [API_BASE, user]);

    const fetchLockLogs = useCallback(async (pg = page) => {
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
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
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
    }, [API_BASE2, user, page]);

    useEffect(() => { fetchLockLogs(page); }, [page]);

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
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all lock logs for export error:', err);
        }
        return logs;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((item, idx) => ({
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

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Last Lock', cell: (r) => r.lastLockTime || `${r.date} ${r.time}` },
            { header: 'Performed By', accessor: 'performedBy' },
            { header: 'Reason', accessor: 'reason' }
        ];
        exportToPDF('Lock Phone Audit Logs', columns, allData, user?.brand || '');
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 text-xl'>
                        <FaLock />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('lockPhone')} Audit History Log
                        </h1>
                        <p className='text-xs text-red-700 font-bold'>
                            {total} records — Date, Time, Last Lock, Reason, Display Text, Hotline, User Name
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>Excel</span>
                    </button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>PDF</span>
                    </button>
                    <button onClick={() => fetchLockLogs(page)} disabled={reloading} className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs whitespace-nowrap'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Locked Date & Time</th>
                            <th className='px-4 py-3 text-center bg-red-50 text-red-800 font-bold'>Last Lock</th>
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
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800 whitespace-nowrap'>
                        {loading ? (
                            <tr><td colSpan={11} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={11} className="text-center py-8 text-slate-500 italic font-medium">No phone locking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-red-50/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-red-700 font-bold'>
                                        <CopyCell text={`${item.date} at ${item.time}`} className='font-mono text-red-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-3 text-center font-mono text-red-600 font-bold bg-red-50/50 rounded-lg'>
                                        <CopyCell text={item.lastLockTime || `${item.date} ${item.time}`} className='font-mono text-red-600 font-bold' />
                                    </td>
                                    <td className='px-4 py-3 font-bold text-slate-900'><CopyCell text={item.customerName} className='font-bold text-slate-900' /></td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold' /></td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span> : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className='px-4 py-3 text-purple-700 font-semibold'><CopyCell text={item.userName || item.performedBy || ''} className='text-purple-700 font-semibold' /></td>
                                    <td className='px-4 py-3 text-slate-600 text-[11px] font-medium'><CopyCell text={item.reason} className='text-slate-600 text-[11px] font-medium' /></td>
                                    <td className='px-4 py-3 text-amber-700 font-khmer text-[11px] max-w-[250px] truncate' title={item.displayText || defaultDisplayText.replace(/\{\{customerName\}\}/g, item.customerName || '')}>
                                        <CopyCell text={item.displayText || defaultDisplayText.replace(/\{\{customerName\}\}/g, item.customerName || '')} className='text-amber-700 font-khmer text-[11px]' />
                                    </td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-bold'><CopyCell text={item.phoneNumber || ''} className='font-mono text-emerald-700 font-bold' /></td>
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