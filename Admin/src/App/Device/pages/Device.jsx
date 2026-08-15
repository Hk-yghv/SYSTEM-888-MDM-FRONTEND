import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlinePhoneIphone, MdOutlineSync, MdPictureAsPdf } from "react-icons/md";
import { FaMobileAlt, FaLock, FaUnlock, FaFileExcel } from "react-icons/fa";
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

const Device = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 10;

    const fetchDevices = async (pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ status: 'Activated', page: pg, limit: LIMIT });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setDevices(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch devices error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchDevices(page, searchTerm); }, [page]);
    useEffect(() => { fetchDevices(1, searchTerm); setPage(1); }, [searchTerm]);

    const filteredDevices = devices; // server already filters+paginates

    const handleExportExcel = () => {
        const data = filteredDevices.map((d, idx) => ({
            'No': idx + 1,
            'Model': d.model || '',
            'Serial Number': d.serialNumber || '',
            'IMEI 1': d.imei1 || '',
            'IMEI 2': d.imei2 || '',
            'Color': d.color || '',
            'Customer Name': d.customerNameEn || '',
            'Phone Lock Status': d.lockPhoneStatus || 'Unlocked',
            'Wallpaper Lock Status': d.lockWallpaperStatus || 'Unlocked'
        }));
        exportToExcel(data, 'Device_Inventory_Report');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'IMEI 1', accessor: 'imei1' },
            { header: 'Customer', accessor: 'customerNameEn' },
            { header: 'Phone Lock', accessor: 'lockPhoneStatus' },
            { header: 'Wallpaper Lock', accessor: 'lockWallpaperStatus' }
        ];
        exportToPDF('Device Inventory Report', columns, filteredDevices);
    };

    return (
        <div className='w-full min-h-screen bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 text-xl'>
                        <MdOutlinePhoneIphone />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('device')} Inventory Management
                        </h1>
                        <p className='text-xs text-purple-700 font-bold'>
                            {devices.length} Registered Activated Devices
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search')}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-48 font-medium outline-none shadow-xs"
                    />

                    <button
                        onClick={fetchDevices}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Device Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-180px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3'>IMEI 1</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3 text-center'>Phone Lock Status</th>
                            <th className='px-4 py-3 text-center'>Wallpaper Status</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredDevices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-slate-500 italic font-medium">
                                    No devices linked to activated contracts.
                                </td>
                            </tr>
                        ) : (
                            filteredDevices.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-bold text-slate-900 flex items-center gap-2'>
                                        <FaMobileAlt className="text-emerald-600 text-sm" />
                                        {item.model}
                                    </td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'>{item.serialNumber}</td>
                                    <td className='px-4 py-3 font-mono text-slate-600'>{item.imei1 || '354890123456789'}</td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'>
                                        {item.customerNameEn} <span className="text-emerald-700 font-khmer text-xs font-semibold">({item.customerNameKh})</span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 w-24 mx-auto ${item.lockPhoneStatus === 'Locked' ? 'bg-red-50 border border-red-300 text-red-700' : 'bg-emerald-50 border border-emerald-300 text-emerald-800'}`}>
                                            {item.lockPhoneStatus === 'Locked' ? <FaLock size={10} /> : <FaUnlock size={10} />}
                                            {item.lockPhoneStatus || 'Unlocked'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 w-24 mx-auto ${item.lockWallpaperStatus === 'Locked' ? 'bg-purple-50 border border-purple-300 text-purple-700' : 'bg-blue-50 border border-blue-300 text-blue-700'}`}>
                                            {item.lockWallpaperStatus || 'Unlocked'}
                                        </span>
                                    </td>
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

export default Device;