import React, { useState, useEffect, useCallback } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
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

    const [subBrandFilter, setSubBrandFilter] = useState('');

    const fetchUnlockLogs = useCallback(async (pg = page, sb = subBrandFilter) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                action: 'Unlocked',
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
            });
            if (sb && sb !== 'All') {
                params.append('subBrand', sb);
            }
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
    }, [API_BASE2, user, page, subBrandFilter]);

    useEffect(() => { fetchUnlockLogs(page, subBrandFilter); }, [page, subBrandFilter]);

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                action: 'Unlocked',
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
            });
            if (subBrandFilter && subBrandFilter !== 'All') {
                params.append('subBrand', subBrandFilter);
            }
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

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date & Time', cell: (r) => `${r.date} ${r.time}` },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'User Name', accessor: 'userName' },
            { header: 'Reason', accessor: 'reason' },
        ];
        exportToPDF('Phone Unlock Audit History Report', columns, allData, user?.brand || '', orientation);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900'>{t('unlockPhone')}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Sub-Brand Filter Dropdown */}
                    {Array.isArray(user?.subBrands) && user.subBrands.length > 1 && (
                        <select
                            value={subBrandFilter}
                            onChange={(e) => {
                                setPage(1);
                                setSubBrandFilter(e.target.value);
                            }}
                            className="px-3 py-1.5 bg-white border border-indigo-300 rounded-[5px] text-xs text-indigo-900 font-semibold focus:border-indigo-500 outline-none shadow-xs cursor-pointer"
                        >
                            <option value="">All Sub Brands</option>
                            {user.subBrands.map((sb, i) => (
                                <option key={i} value={sb}>🏢 {sb}</option>
                            ))}
                        </select>
                    )}

                    {hasPermission('/lost-phone/unlock-phone', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs whitespace-nowrap'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>Unlocked Date &amp; Time</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('serialNumber')}</th>
                            <th className='px-4 py-1'>Brand</th>
                            <th className='px-4 py-1'>Sub Brand</th>
                            <th className='px-4 py-1'>User Name</th>
                            <th className='px-4 py-1'>Reason</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800 whitespace-nowrap'>
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-8 text-slate-500 italic font-medium">No phone unlocking activity recorded yet.</td></tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-emerald-700 font-bold'>
                                        <CopyCell text={`${item.date} at ${item.time}`} className='font-mono text-emerald-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-1 font-bold text-slate-900'><CopyCell text={item.customerName} className='font-bold text-slate-900' /></td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold' /></td>
                                    <td className='px-4 py-1'>
                                        {item.brand ? <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span> : <span className="text-slate-400">-</span>}
                                    </td>
                                    <td className='px-4 py-1'>
                                        {item.subBrand ? <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-bold text-[10px]">{item.subBrand}</span> : <span className="text-slate-400">—</span>}
                                    </td>
                                    <td className='px-4 py-1 text-purple-700 font-semibold'><CopyCell text={item.userName || item.performedBy || ''} className='text-purple-700 font-semibold' /></td>
                                    <td className='px-4 py-1 text-slate-600 text-[11px] font-medium'><CopyCell text={item.reason} className='text-slate-600 text-[11px] font-medium' /></td>
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