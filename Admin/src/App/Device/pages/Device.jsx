import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlinePhoneIphone, MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { FaMobileAlt, FaLock, FaUnlock, FaFileExcel } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import Device3DPointers from '../../../components/Device3DPointers';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import { formatIMEI } from '../../../utils/imeiFormatter';

const LIMIT = 10;

const Device = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    const [devices, setDevices] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [brandFilter, setBrandFilter] = useState(''); // Admin only brand filter
    const [brandsList, setBrandsList] = useState([]);

    // Fetch brands list for admin filter
    const fetchBrandsList = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat?.items) setBrandsList(brandCat.items);
            }
        } catch { }
    };

    const fetchDevices = async (p = 1, search = '', brand = brandFilter) => {
        setReloading(true);
        try {
            const queryParams = new URLSearchParams({
                status: 'Activated',
                page: p,
                limit: LIMIT,
                ...(search && { search })
            });

            if (user?.role === 'Administrator') {
                // Admin can filter by selected brand or see all
                if (brand) queryParams.append('brand', brand);
            } else if (user?.brand) {
                // Non-admin: always filter by own brand
                queryParams.append('brand', user.brand);
            }

            const res = await fetch(`${API_BASE1}/contracts?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const contractList = data.data || data.contracts || [];
                setDevices(contractList);
                setTotal(data.total || contractList.length);
            }
        } catch (err) {
            console.error('Fetch devices error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchDevices(page, searchTerm, brandFilter); }, [page]);
    useEffect(() => { fetchDevices(1, searchTerm, brandFilter); setPage(1); }, [searchTerm]);
    useEffect(() => { fetchDevices(1, searchTerm, brandFilter); setPage(1); }, [brandFilter]);

    // Fetch brands list from ControlSystem for admin brand filter
    useEffect(() => {
        if (user?.role !== 'Administrator') return;
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const brandCat = data.droplists?.find(d => d.category === 'Brands');
                    if (brandCat?.items) setBrandsList(brandCat.items);
                }
            } catch { }
        };
        go();
    }, [user?.role, API_BASE]);

    const filteredDevices = devices;

    const fetchAllForExport = async () => {
        try {
            const queryParams = new URLSearchParams({
                status: 'Activated',
                page: 1,
                limit: 999999,
                ...(searchTerm && { search: searchTerm })
            });
            if (user?.role === 'Administrator') {
                if (brandFilter) queryParams.append('brand', brandFilter);
            } else if (user?.brand) {
                queryParams.append('brand', user.brand);
            }
            const res = await fetch(`${API_BASE1}/contracts?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || data.contracts || [];
            }
        } catch (err) {
            console.error('Fetch all devices for export error:', err);
        }
        return devices;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((d, idx) => ({
            'No': idx + 1,
            'Model': d.model || '',
            'Version / OS': d.version || '',
            'Serial Number': d.serialNumber || '',
            'IMEI 1': formatIMEI(d.imei1),
            'IMEI 2': formatIMEI(d.imei2),
            'MEID': d.meid || '',
            'Color': d.color || '',
            'Customer Name': d.customerNameEn || '',
            'Phone Lock Status': d.lockPhoneStatus || 'Unlocked',
            'Wallpaper Lock Status': d.lockWallpaperStatus || 'Unlocked'
        }));
        exportToExcel(data, 'Device_Inventory_Report');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Model', accessor: 'model' },
            { header: 'Version', accessor: 'version' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'IMEI 1', cell: (d) => formatIMEI(d.imei1) },
            { header: 'Customer', accessor: 'customerNameEn' },
            { header: 'Phone Lock', accessor: 'lockPhoneStatus' },
            { header: 'Wallpaper Lock', accessor: 'lockWallpaperStatus' }
        ];
        exportToPDF('Device Inventory Report', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('device')}
                        </h1>
                        <p className='text-xs text-purple-700 font-bold'>
                            {total} Registered Activated Devices
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3 flex-wrap'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Brand Filter Dropdown — Administrator only */}
                    {user?.role === 'Administrator' && (
                        <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="px-3 py-2 bg-white border border-purple-300 rounded-[5px] text-xs text-purple-900 font-semibold focus:border-purple-500 outline-none shadow-xs cursor-pointer"
                        >
                            <option value="">All Brands</option>
                            {brandsList.map((b, i) => (
                                <option key={i} value={b}>🏷️ {b}</option>
                            ))}
                        </select>
                    )}

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search')}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-48 font-medium outline-none shadow-xs"
                    />

                    <button
                        onClick={() => fetchDevices(page, searchTerm, brandFilter)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-260px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>Version / OS</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3'>IMEI 1</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3 text-center'>Phone Lock Status</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredDevices.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-8 text-slate-500 italic font-medium">
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
                                    <td className='px-4 py-3'>
                                        <span className='px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-bold text-[10px]'>
                                            {item.version || '—'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                            {item.brand || '—'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'>{item.serialNumber}</td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-bold whitespace-nowrap'>{formatIMEI(item.imei1)}</td>
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
                                        <button
                                            onClick={() => setSelectedDevice(item)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer"
                                        >
                                            <FaMobileAlt />
                                            <span>Info</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />

            {selectedDevice && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="dark-modal bg-[#0b0f1e] border border-indigo-500/40 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 text-lg">
                                    <FaMobileAlt />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                        <span>{selectedDevice.model}</span>
                                        <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-700/60 rounded-full text-[10px] font-bold">
                                            {selectedDevice.brand || 'Device'}
                                        </span>
                                    </h3>
                                    <p className="text-[11px] text-gray-400 font-mono">Serial: {selectedDevice.serialNumber}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDevice(null)}
                                className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm font-bold cursor-pointer transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        <div>
                            <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> Hardware Specifications
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">Model Name</span>
                                    <span className="font-bold text-gray-100 truncate block">{selectedDevice.model}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">Version / OS</span>
                                    <span className="font-bold text-indigo-300 truncate block">{selectedDevice.version || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">Serial Number</span>
                                    <span className="font-mono font-bold text-emerald-300 truncate block">{selectedDevice.serialNumber}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">IMEI 1</span>
                                    <span className="font-mono font-bold text-sky-400 truncate block">{formatIMEI(selectedDevice.imei1)}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">IMEI 2</span>
                                    <span className="font-mono font-bold text-sky-300 truncate block">{formatIMEI(selectedDevice.imei2)}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">MEID</span>
                                    <span className="font-mono font-bold text-pink-400 truncate block">{selectedDevice.meid || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">Color</span>
                                    <span className="font-bold text-gray-200 truncate block">{selectedDevice.color || '—'}</span>
                                </div>
                                <div className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                    <span className="text-gray-400 block text-[10px]">Brand</span>
                                    <span className="font-bold text-purple-300 truncate block">{selectedDevice.brand || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-[#151928] rounded-2xl border border-gray-700">
                                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Linked Customer</h4>
                                <p className="font-bold text-white">{selectedDevice.customerNameEn || '—'} <span className="text-indigo-300 font-khmer text-xs font-normal">({selectedDevice.customerNameKh || '—'})</span></p>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">Phone: {selectedDevice.phone || '—'}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Contract ID: {selectedDevice.contractId || '—'}</p>
                            </div>
                            <div className="p-3 bg-[#151928] rounded-2xl border border-gray-700">
                                <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Security Lock Status</h4>
                                <div className="flex gap-2">
                                    <div className="flex-1 p-2.5 bg-[#0b0f1e] rounded-xl border border-gray-700 text-center">
                                        <span className="text-[9px] text-gray-400 block mb-0.5">Phone Lock</span>
                                        <span className={`text-xs font-bold ${selectedDevice.lockPhoneStatus === 'Locked' ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {selectedDevice.lockPhoneStatus || 'Unlocked'}
                                        </span>
                                    </div>
                                    <div className="flex-1 p-2.5 bg-[#0b0f1e] rounded-xl border border-gray-700 text-center">
                                        <span className="text-[9px] text-gray-400 block mb-0.5">Wallpaper</span>
                                        <span className={`text-xs font-bold ${selectedDevice.lockWallpaperStatus === 'Locked' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                            {selectedDevice.lockWallpaperStatus || 'Unlocked'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Device Problem */}
                        <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-2xl">
                            <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                ⚠️ {t('deviceProblem') || 'Device Problem / Notes'}
                            </h4>
                            <p className="text-xs text-amber-200 font-medium leading-relaxed whitespace-pre-wrap">
                                {selectedDevice.deviceProblem || selectedDevice.device_problem || '— គ្មានបញ្ហាឧបករណ៍ (No recorded device problem)'}
                            </p>
                        </div>

                        {/* Interactive 3D Model with Feature Lines */}

                        <div className="bg-[#070913] p-4 rounded-2xl border border-indigo-500/30">
                            <Device3DPointers device={selectedDevice} />
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-gray-800">
                            <button onClick={() => setSelectedDevice(null)} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-black-200 font-bold text-xs rounded-xl cursor-pointer transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Device;