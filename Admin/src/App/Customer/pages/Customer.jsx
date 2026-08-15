import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosContact } from 'react-icons/io';
import { MdOutlineSync, MdSearch, MdInfo, MdPictureAsPdf, MdTableChart, MdQrCode2, MdClose } from 'react-icons/md';
import { FaFileExcel, FaQrcode } from 'react-icons/fa';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

const Customer = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const itemsPerPage = 10;

    // Customer QR Modal state
    const [qrCustomer, setQrCustomer] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [qrInfoPageUrl, setQrInfoPageUrl] = useState('');

    const fetchCustomers = async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ status: 'Activated', page: pg, limit: itemsPerPage });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch customers error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchCustomers(currentPage, searchTerm); }, [currentPage]);
    useEffect(() => { fetchCustomers(1, searchTerm); setCurrentPage(1); }, [searchTerm]);

    const filteredCustomers = customers; // server already filters+paginates

    const handleOpenQrModal = async (customer) => {
        setQrCustomer(customer);
        try {
            const res = await fetch(`${API_BASE}/contracts/customer-qr-payload/${customer.contractId}`);
            if (res.ok) {
                const data = await res.json();
                setQrDataUrl(data.qrDataUrl);
                setQrInfoPageUrl(data.infoPageUrl);
            }
        } catch (err) {
            console.error('Fetch Customer QR payload error:', err);
        }
    };

    const handleExportExcel = () => {
        const excelData = filteredCustomers.map((c, idx) => ({
            'No': idx + 1,
            'Name (EN)': c.customerNameEn || '',
            'Name (KH)': c.customerNameKh || '',
            'ID Card': c.idCardNumber || '',
            'DOB': c.dob || '',
            'Gender': c.gender || '',
            'Phone': c.phone || '',
            'Relative Phone': c.relativePhone || '',
            'Current Address': c.currentAddress || '',
            'Facebook': c.facebookName || '',
            'Telegram': c.telegramName || '',
            'Device Model': c.model || '',
            'Serial Number': c.serialNumber || '',
            'IMEI 1': c.imei1 || '',
            'IMEI 2': c.imei2 || '',
            'Color': c.color || '',
            'Total Amount ($)': c.amount || c.totalAmount || 0,
            'Monthly Installment ($)': c.monthlyPayment || 0,
            'Interest': c.interest || '',
            'Duration': c.duration || '',
            'Input Date': c.inputDate || '',
            'Status': c.status || 'Activated',
        }));
        exportToExcel(excelData, 'MDM_Customer_List');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'ID Card', accessor: 'idCardNumber' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Monthly ($)', cell: (r) => `$${r.monthlyPayment}` },
            { header: 'Status', accessor: 'status' },
        ];
        exportToPDF('Customer Profile Directory', columns, filteredCustomers);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>

            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xl'>
                        <IoIosContact />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900'>{t('customer')} Profile Directory</h1>
                        <p className='text-xs text-emerald-700 font-bold'>{filteredCustomers.length} Active Customers</p>
                    </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    {/* Search */}
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search name, phone, model..."
                            className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-52 outline-none font-medium shadow-xs"
                        />
                    </div>

                    {/* Export to Excel */}
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs cursor-pointer border border-emerald-300 transition-all font-bold shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>

                    {/* Export to PDF */}
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 rounded-xl text-xs cursor-pointer border border-red-300 transition-all font-bold shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Reload */}
                    <button
                        onClick={fetchCustomers}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs cursor-pointer border border-slate-300 transition-all font-bold shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Customer Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-180px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Customer</th>
                            <th className='px-4 py-3'>ID Card</th>
                            <th className='px-4 py-3'>Phone</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>Device Model</th>
                            <th className='px-4 py-3'>Serial No.</th>
                            <th className='px-4 py-3 text-center'>Monthly</th>
                            <th className='px-4 py-3 text-center'>Status</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-8 text-slate-500 italic font-medium">
                                    {searchTerm ? `No results for "${searchTerm}"` : 'No active customers found.'}
                                </td>
                            </tr>
                        ) : (
                            filteredCustomers.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={item.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                                alt="avatar"
                                                className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                            />
                                            <div>
                                                <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                                <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-[11px] font-semibold' />
                                            </div>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-slate-600 text-[11px]'><CopyCell text={item.idCardNumber || '-'} className='font-mono text-slate-600 text-[11px]' /></td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-medium'><CopyCell text={item.phone || '-'} className='font-mono text-slate-700 font-medium' /></td>
                                    <td className='px-4 py-3'>
                                        <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                            {item.brand || '—'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold text-[11px]'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold text-[11px]' /></td>
                                    <td className='px-4 py-3 text-center font-mono font-bold text-emerald-700'>${item.monthlyPayment}/mo</td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px] uppercase'>Activated</span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <div className="flex items-center justify-center gap-1.5">
                                            {/* Details Info Button */}
                                            <button
                                                onClick={() => setSelectedCustomer(item)}
                                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 text-sm transition-all cursor-pointer"
                                                title="View Full Details"
                                            >
                                                <MdInfo />
                                            </button>
                                            {/* QR Code Profile Button */}
                                            <button
                                                onClick={() => handleOpenQrModal(item)}
                                                className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 text-sm transition-all cursor-pointer"
                                                title="Scan Customer QR Profile"
                                            >
                                                <FaQrcode />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination controls */}
            <Pagination
                currentPage={currentPage}
                totalItems={total}
                itemsPerPage={itemsPerPage}
                onPageChange={(pg) => setCurrentPage(pg)}
            />

            {/* Full Customer Detail Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-gray-700 rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#0b0f1e] rounded-t-3xl z-10">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedCustomer.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                    alt="avatar"
                                    className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/40"
                                />
                                <div>
                                    <h3 className="text-lg font-black text-white tracking-wide">{selectedCustomer.customerNameEn}</h3>
                                    <p className="text-sm text-indigo-400 font-khmer">{selectedCustomer.customerNameKh}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">✓ Activated</span>
                                        <span className="text-[10px] text-gray-500 font-mono">ID: {selectedCustomer.contractId}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Export buttons in modal */}
                                <button
                                    onClick={() => {
                                        const d = [selectedCustomer];
                                        const excelData = d.map(c => ({
                                            'Name EN': c.customerNameEn, 'Name KH': c.customerNameKh,
                                            'ID Card': c.idCardNumber, 'DOB': c.dob, 'Gender': c.gender,
                                            'Phone': c.phone, 'Relative Phone': c.relativePhone,
                                            'Current Address': c.currentAddress, 'Facebook': c.facebookName,
                                            'Telegram': c.telegramName, 'Model': c.model,
                                            'Serial': c.serialNumber, 'IMEI1': c.imei1, 'IMEI2': c.imei2,
                                            'Color': c.color, 'Version': c.version,
                                            'Total ($)': c.amount || c.totalAmount, 'Monthly ($)': c.monthlyPayment,
                                            'Interest': c.interest, 'Duration': c.duration,
                                        }));
                                        exportToExcel(excelData, `Customer_${c.customerNameEn}`);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 rounded-xl text-[11px] cursor-pointer border border-emerald-700/60 font-semibold"
                                >
                                    <FaFileExcel /> Excel
                                </button>
                                <button
                                    onClick={() => {
                                        const c = selectedCustomer;
                                        const cols = [
                                            { header: 'Field', accessor: 'field' },
                                            { header: 'Value', accessor: 'value' }
                                        ];
                                        const rows = [
                                            { field: 'Name EN', value: c.customerNameEn },
                                            { field: 'Name KH', value: c.customerNameKh },
                                            { field: 'ID Card', value: c.idCardNumber || '-' },
                                            { field: 'DOB', value: c.dob || '-' },
                                            { field: 'Phone', value: c.phone || '-' },
                                            { field: 'Relative Phone', value: c.relativePhone || '-' },
                                            { field: 'Current Address', value: c.currentAddress || '-' },
                                            { field: 'Device Model', value: c.model },
                                            { field: 'Serial Number', value: c.serialNumber },
                                            { field: 'IMEI1', value: c.imei1 || '-' },
                                            { field: 'Total Amount', value: `$${c.amount || c.totalAmount || 0}` },
                                            { field: 'Monthly Installment', value: `$${c.monthlyPayment}/mo` },
                                            { field: 'Interest', value: c.interest || '-' },
                                            { field: 'Duration', value: c.duration || '-' },
                                        ];
                                        exportToPDF(`Customer: ${c.customerNameEn}`, cols, rows);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 rounded-xl text-[11px] cursor-pointer border border-red-700/60 font-semibold"
                                >
                                    <MdPictureAsPdf /> PDF
                                </button>
                                <button
                                    onClick={() => handleOpenQrModal(selectedCustomer)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 rounded-xl text-[11px] cursor-pointer border border-indigo-700/60 font-semibold"
                                >
                                    <FaQrcode /> QR Profile
                                </button>
                                <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 text-sm font-bold cursor-pointer">✕</button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 text-xs">
                            {/* Customer Information */}
                            <div>
                                <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> Customer Information
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        ['Name English', selectedCustomer.customerNameEn],
                                        ['Name Khmer', selectedCustomer.customerNameKh],
                                        ['ID Card Number', selectedCustomer.idCardNumber || '-'],
                                        ['Date of Birth', selectedCustomer.dob || '-'],
                                        ['Gender', selectedCustomer.gender || '-'],
                                        ['Birth Address', selectedCustomer.birthAddress || '-'],
                                        ['Current Address', selectedCustomer.currentAddress || '-'],
                                        ['Phone Number', selectedCustomer.phone || '-'],
                                        ['Relative Phone', selectedCustomer.relativePhone || '-'],
                                        ['Facebook Name', selectedCustomer.facebookName || '-'],
                                        ['Telegram Name', selectedCustomer.telegramName || '-'],
                                        ['Facebook URL', selectedCustomer.urlFb || '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <span className="text-gray-400 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className="font-semibold text-gray-100 break-words">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Device Details */}
                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> Device Information
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        ['Device Model', selectedCustomer.model],
                                        ['Serial Number', selectedCustomer.serialNumber],
                                        ['IMEI 1', selectedCustomer.imei1 || '-'],
                                        ['IMEI 2', selectedCustomer.imei2 || '-'],
                                        ['Color', selectedCustomer.color || '-'],
                                        ['Version', selectedCustomer.version || '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <span className="text-gray-400 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className="font-semibold text-gray-100 font-mono">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Loan Details */}
                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Loan & Financial Terms
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {[
                                        ['Loan Date (កាលបរិច្ឆេទដាក់ស្នើ)', selectedCustomer.inputDate || '-'],
                                        ['Total Amount', `$${selectedCustomer.amount || selectedCustomer.totalAmount || 0}`],
                                        ['Monthly Installment', `$${selectedCustomer.monthlyPayment}/mo`],
                                        ['Interest Rate', selectedCustomer.interest || '-'],
                                        ['Duration', selectedCustomer.duration || '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <span className="text-gray-400 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className="font-bold text-emerald-400 font-mono">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Lock Status */}
                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span> Security Lock Status
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-gray-400 text-[10px] font-semibold">Phone Lock</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedCustomer.lockPhoneStatus === 'Locked' ? 'bg-red-950 text-red-300 border border-red-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}`}>
                                            {selectedCustomer.lockPhoneStatus || 'Unlocked'}
                                        </span>
                                    </div>
                                    <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-gray-400 text-[10px] font-semibold">Wallpaper Lock</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedCustomer.lockWallpaperStatus === 'Locked' ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}`}>
                                            {selectedCustomer.lockWallpaperStatus || 'Unlocked'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Profile QR Code Modal */}
            {qrCustomer && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#0b0f1e] border border-indigo-500/40 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                                <FaQrcode className="text-base" />
                                <span>Customer Profile QR</span>
                            </div>
                            <button onClick={() => setQrCustomer(null)} className="w-7 h-7 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold cursor-pointer">✕</button>
                        </div>

                        {/* Customer Summary */}
                        <div className="flex items-center gap-3 bg-gray-900/80 p-3 rounded-2xl border border-gray-800 text-left">
                            <img
                                src={qrCustomer.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                alt="avatar"
                                className="w-12 h-12 rounded-xl object-cover border border-indigo-500/50"
                            />
                            <div>
                                <h4 className="text-xs font-bold text-gray-100">{qrCustomer.customerNameEn}</h4>
                                <p className="text-[11px] text-indigo-300 font-khmer">{qrCustomer.customerNameKh}</p>
                                <p className="text-[10px] text-gray-500 font-mono">Contract: {qrCustomer.contractId}</p>
                            </div>
                        </div>

                        {/* QR Code Display */}
                        <div className="bg-white p-4 rounded-2xl border-4 border-indigo-500/20 inline-block mx-auto shadow-inner">
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="Customer QR Code" className="w-48 h-48 mx-auto" />
                            ) : (
                                <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-xs font-semibold animate-pulse">
                                    Generating QR Code...
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-gray-400 leading-relaxed font-khmer">
                            📱 ស្កែន QR Code នេះជាមួយទូរស័ព្ទដៃដើម្បីមើល **ព័ត៌មានលម្អិតទាំងអស់របស់ភ្ញៀវ** (Personal Info, Device, Financial terms & Security status)
                        </p>

                        <div className="pt-2 flex gap-2">
                            <button
                                onClick={() => window.open(qrInfoPageUrl, '_blank')}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                            >
                                Open Profile Link ↗
                            </button>
                            <button
                                onClick={() => setQrCustomer(null)}
                                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all"
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

export default Customer;