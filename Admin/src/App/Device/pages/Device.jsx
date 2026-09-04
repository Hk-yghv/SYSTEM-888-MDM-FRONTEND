import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlinePhoneIphone, MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { FaMobileAlt, FaLock, FaUnlock, FaFileExcel } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import Device3DPointers from '../../../components/Device3DPointers';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import { formatIMEI } from '../../../utils/imeiFormatter';
import CopyCell from '../../../components/CopyCell';

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
                                        <CopyCell text={item.model} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" />
                                    </td>
                                    <td className='px-4 py-3'>
                                        <CopyCell text={item.version || '—'} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" />
                                    </td>
                                    <td className='px-4 py-3'>
                                        {item.brand || '—'}
                                    </td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" /></td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-bold whitespace-nowrap'><CopyCell text={item.imei1} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" /></td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'>
                                        <CopyCell text={item.customerNameEn} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" /> <span className="text-emerald-700 font-khmer text-xs font-semibold"><CopyCell text={item.customerNameKh} className="text-slate-900 hover:text-emerald-600 cursor-pointer font-semibold" /></span>
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
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">

                    <div className="
            bg-white
            rounded-3xl
            w-full max-w-2xl
            border border-gray-200
            shadow-[0_20px_60px_rgba(0,0,0,0.15)]
            overflow-hidden
            max-h-[90vh]
            overflow-y-auto
        ">

                        {/* ================= HEADER ================= */}
                        <div className="px-6 py-5 border-b border-gray-100 bg-white">

                            <div className="flex items-center justify-between gap-4">

                                <div className="flex items-center gap-3 min-w-0">

                                    <div className="
                            w-11 h-11
                            rounded-2xl
                            bg-gray-100
                            border border-gray-200
                            flex items-center justify-center
                            text-gray-700
                            text-lg
                        ">
                                        <FaMobileAlt />
                                    </div>

                                    <div className="min-w-0">

                                        <div className="flex items-center gap-2 flex-wrap">

                                            <h3 className="
                                    text-base
                                    font-bold
                                    text-gray-900
                                ">
                                                <CopyCell text={selectedDevice.model} className="text-base font-bold text-gray-900" />
                                            </h3>

                                            <span className="
                                    px-2 py-0.5
                                    rounded-md
                                    bg-gray-100
                                    border border-gray-200
                                    text-gray-600
                                    text-[9px]
                                    font-bold
                                    uppercase
                                ">
                                                <CopyCell text={selectedDevice.brand || 'Device'} className="text-gray-700 font-bold" />
                                            </span>

                                        </div>

                                        <p className="
                                text-[10px]
                                text-gray-400
                                font-mono
                                mt-1
                                truncate
                            ">
                                            Serial: <CopyCell text={selectedDevice.serialNumber} className="text-gray-600 font-mono font-bold" />
                                        </p>

                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedDevice(null)}
                                    className="
                            w-8 h-8
                            rounded-xl
                            bg-gray-100
                            hover:bg-gray-200
                            text-gray-400
                            hover:text-gray-700
                            flex items-center justify-center
                            text-sm
                            font-bold
                            cursor-pointer
                            transition-all
                        "
                                >
                                    ✕
                                </button>

                            </div>
                        </div>


                        {/* ================= CONTENT ================= */}
                        <div className="p-6 space-y-5">


                            {/* ================= HARDWARE ================= */}
                            <section>

                                <div className="flex items-center gap-2 mb-3">

                                    <h4 className="
                            text-[11px]
                            font-bold
                            text-gray-800
                            uppercase
                            tracking-[0.12em]
                        ">
                                        Hardware Specifications
                                    </h4>

                                    <div className="flex-1 h-px bg-gray-100"></div>

                                </div>


                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">

                                    {/* Model */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            Model Name
                                        </span>

                                        <CopyCell text={selectedDevice.model} className="text-[11px] font-bold text-gray-900 truncate block" />
                                    </div>


                                    {/* Version */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            Version / OS
                                        </span>

                                        <CopyCell text={selectedDevice.version || '—'} className="text-[11px] font-bold text-violet-600 truncate block" />
                                    </div>


                                    {/* Serial */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            Serial Number
                                        </span>

                                        <CopyCell text={selectedDevice.serialNumber} className="text-[10px] font-mono font-bold text-emerald-600 truncate block" />
                                    </div>


                                    {/* IMEI 1 */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            IMEI 1
                                        </span>

                                        <CopyCell text={formatIMEI(selectedDevice.imei1)} copyValue={selectedDevice.imei1} className="text-[10px] font-mono font-bold text-sky-600 truncate block" />
                                    </div>


                                    {/* IMEI 2 */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            IMEI 2
                                        </span>

                                        <CopyCell text={formatIMEI(selectedDevice.imei2)} copyValue={selectedDevice.imei2} className="text-[10px] font-mono font-bold text-sky-600 truncate block" />
                                    </div>


                                    {/* MEID */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            MEID
                                        </span>

                                        <CopyCell text={selectedDevice.meid || '—'} className="text-[10px] font-mono font-bold text-fuchsia-600 truncate block" />
                                    </div>


                                    {/* Color */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            Color
                                        </span>

                                        <CopyCell text={selectedDevice.color || '—'} className="text-[11px] font-bold text-gray-800 truncate block" />
                                    </div>


                                    {/* Brand */}
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                        <span className="text-[9px] text-gray-400 block mb-1">
                                            Brand
                                        </span>

                                        <CopyCell text={selectedDevice.brand || '—'} className="text-[11px] font-bold text-indigo-600 truncate block" />
                                    </div>

                                </div>
                            </section>


                            {/* ================= CUSTOMER + SECURITY ================= */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


                                {/* Customer */}
                                <div className="
                        p-4
                        bg-white
                        rounded-2xl
                        border border-gray-200
                    ">

                                    <div className="flex items-center gap-2 mb-3">

                                        <span className="
                                w-7 h-7
                                rounded-lg
                                bg-gray-100
                                flex items-center justify-center
                                text-gray-600
                                text-xs
                            ">
                                            👤
                                        </span>

                                        <h4 className="
                                text-[10px]
                                font-bold
                                text-gray-700
                                uppercase
                                tracking-wider
                            ">
                                            Linked Customer
                                        </h4>

                                    </div>

                                    <p className="text-sm font-bold text-gray-900">

                                        <CopyCell text={selectedDevice.customerNameEn || '—'} className="text-gray-900 font-bold" />

                                        {selectedDevice.customerNameKh && (
                                            <CopyCell text={`(${selectedDevice.customerNameKh})`} copyValue={selectedDevice.customerNameKh} className="text-violet-600 font-khmer text-xs font-normal ml-1" />
                                        )}

                                    </p>

                                    <p className="text-[10px] text-gray-500 font-mono mt-2">
                                        Phone:
                                        <CopyCell text={selectedDevice.phone || '—'} className="text-gray-700 ml-1 font-mono font-bold" />
                                    </p>

                                    <p className="text-[10px] text-gray-400 font-mono mt-1">
                                        Contract ID:
                                        <CopyCell text={selectedDevice.contractIid || selectedDevice.contractId || '—'} className="text-gray-600 ml-1 font-mono font-bold" />
                                    </p>

                                </div>


                                {/* Security */}
                                <div className="
                        p-4
                        bg-white
                        rounded-2xl
                        border border-gray-200
                    ">

                                    <div className="flex items-center gap-2 mb-3">

                                        <span className="
                                w-7 h-7
                                rounded-lg
                                bg-gray-100
                                flex items-center justify-center
                                text-gray-600
                                text-xs
                            ">
                                            🔒
                                        </span>

                                        <h4 className="
                                text-[10px]
                                font-bold
                                text-gray-700
                                uppercase
                                tracking-wider
                            ">
                                            Security Lock Status
                                        </h4>

                                    </div>


                                    <div className="flex gap-2">

                                        {/* Phone Lock */}
                                        <div className="
                                flex-1
                                p-2.5
                                bg-white
                                rounded-xl
                                border border-gray-200
                            ">

                                            <span className="
                                    text-[9px]
                                    text-gray-400
                                    block
                                    mb-1
                                ">
                                                Phone Lock
                                            </span>

                                            <span className={`
                                    inline-flex
                                    px-2
                                    py-0.5
                                    rounded-full
                                    text-[9px]
                                    font-bold
                                    border
                                    ${selectedDevice.lockPhoneStatus === 'Locked'
                                                    ? 'bg-red-50 text-red-600 border-red-200'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                }
                                `}>
                                                {selectedDevice.lockPhoneStatus || 'Unlocked'}
                                            </span>

                                        </div>


                                        {/* Wallpaper */}
                                        <div className="
                                flex-1
                                p-2.5
                                bg-white
                                rounded-xl
                                border border-gray-200
                            ">

                                            <span className="
                                    text-[9px]
                                    text-gray-400
                                    block
                                    mb-1
                                ">
                                                Wallpaper
                                            </span>

                                            <span className={`
                                    inline-flex
                                    px-2
                                    py-0.5
                                    rounded-full
                                    text-[9px]
                                    font-bold
                                    border
                                    ${selectedDevice.lockWallpaperStatus === 'Locked'
                                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                }
                                `}>
                                                {selectedDevice.lockWallpaperStatus || 'Unlocked'}
                                            </span>

                                        </div>

                                    </div>
                                </div>

                            </div>


                            {/* ================= DEVICE PROBLEM ================= */}
                            <div className="
                    p-4
                    bg-white
                    border border-amber-200
                    rounded-2xl
                ">

                                <div className="flex items-center gap-2 mb-2">

                                    <span className="
                            w-7 h-7
                            rounded-lg
                            bg-amber-50
                            border border-amber-100
                            flex items-center justify-center
                            text-amber-600
                            text-xs
                        ">
                                        ⚠
                                    </span>

                                    <h4 className="
                            text-[10px]
                            font-bold
                            text-amber-700
                            uppercase
                            tracking-wider
                        ">
                                        {t('deviceProblem') || 'Device Problem / Notes'}
                                    </h4>

                                </div>

                                <p className="
                        text-xs
                        text-gray-700
                        font-medium
                        leading-relaxed
                        whitespace-pre-wrap
                    ">
                                    <CopyCell
                                        text={selectedDevice.deviceProblem || selectedDevice.device_problem || '— គ្មានបញ្ហាឧបករណ៍ (No recorded device problem)'}
                                        className="text-gray-700 font-medium"
                                    />
                                </p>

                            </div>


                            {/* ================= 3D DEVICE ================= */}
                            <div className="
                    bg-white
                    p-4
                    rounded-2xl
                    border border-gray-200
                ">

                                <div className="flex items-center gap-2 mb-3">

                                    <span className="
                            w-7 h-7
                            rounded-lg
                            bg-gray-100
                            flex items-center justify-center
                            text-gray-600
                        ">
                                        📱
                                    </span>

                                    <h4 className="
                            text-[10px]
                            font-bold
                            text-gray-700
                            uppercase
                            tracking-wider
                        ">
                                        Device Visualization
                                    </h4>

                                </div>

                                <Device3DPointers device={selectedDevice} />

                            </div>

                        </div>


                        {/* ================= FOOTER ================= */}
                        <div className="
                px-6 py-4
                border-t border-gray-100
                bg-white
                flex justify-end
            ">

                            <button
                                onClick={() => setSelectedDevice(null)}
                                className="
                        px-5 py-2
                        rounded-xl
                        bg-gray-900
                        hover:bg-gray-800
                        text-white
                        text-xs
                        font-bold
                        cursor-pointer
                        active:scale-95
                        transition-all
                    "
                            >
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