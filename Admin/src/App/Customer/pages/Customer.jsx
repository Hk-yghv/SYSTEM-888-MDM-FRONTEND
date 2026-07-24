import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosContact } from 'react-icons/io';
import { MdOutlineSync, MdSearch, MdInfo, MdPictureAsPdf, MdTableChart } from 'react-icons/md';
import { FaFileExcel } from 'react-icons/fa';
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
    const itemsPerPage = 10;

    const fetchCustomers = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/contracts?status=Activated`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (err) {
            console.error('Fetch customers error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filteredCustomers = customers.filter(c =>
        (c.customerNameEn || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.customerNameKh || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.idCardNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

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
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4'>

            {/* Header */}
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl'>
                        <IoIosContact />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100'>{t('customer')} Profile Directory</h1>
                        <p className='text-xs text-indigo-400 font-semibold'>{filteredCustomers.length} Active Customers</p>
                    </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    {/* Search */}
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search name, phone, model..."
                            className="pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 focus:border-indigo-500 w-52 outline-none"
                        />
                    </div>

                    {/* Export to Excel */}
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 rounded-xl text-xs cursor-pointer border border-emerald-700/60 transition-all font-semibold'
                    >
                        <FaFileExcel />
                        <span>Excel</span>
                    </button>

                    {/* Export to PDF */}
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-900/60 hover:bg-red-800/80 text-red-300 rounded-xl text-xs cursor-pointer border border-red-700/60 transition-all font-semibold'
                    >
                        <MdPictureAsPdf className="text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Reload */}
                    <button
                        onClick={fetchCustomers}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Customer Table */}
            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Customer</th>
                            <th className='px-4 py-3'>ID Card</th>
                            <th className='px-4 py-3'>Phone</th>
                            <th className='px-4 py-3'>Device Model</th>
                            <th className='px-4 py-3'>Serial No.</th>
                            <th className='px-4 py-3 text-center'>Monthly</th>
                            <th className='px-4 py-3 text-center'>Status</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {filteredCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-8 text-gray-500 italic">
                                    {searchTerm ? `No results for "${searchTerm}"` : 'No active customers found.'}
                                </td>
                            </tr>
                        ) : (
                            filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={item.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                                alt="avatar"
                                                className="w-8 h-8 rounded-full object-cover border border-gray-700"
                                            />
                                            <div>
                                                <span className='font-bold text-gray-100 block'>{item.customerNameEn}</span>
                                                <span className='text-indigo-400 font-khmer text-[11px]'>{item.customerNameKh}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-gray-400 text-[11px]'>{item.idCardNumber || '-'}</td>
                                    <td className='px-4 py-3 font-mono text-gray-300'>{item.phone || '-'}</td>
                                    <td className='px-4 py-3 font-semibold text-gray-200'>{item.model}</td>
                                    <td className='px-4 py-3 font-mono text-indigo-300 text-[11px]'>{item.serialNumber}</td>
                                    <td className='px-4 py-3 text-center font-mono font-bold text-emerald-400'>${item.monthlyPayment}/mo</td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-2.5 py-1 bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 rounded-full font-bold text-[10px] uppercase'>Activated</span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <button
                                            onClick={() => setSelectedCustomer(item)}
                                            className="w-8 h-8 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center text-indigo-300 text-sm transition-all cursor-pointer mx-auto"
                                            title="View Full Details"
                                        >
                                            <MdInfo />
                                        </button>
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
                totalItems={filteredCustomers.length}
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
                                    <h3 className="text-base font-black text-gray-100">{selectedCustomer.customerNameEn}</h3>
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
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
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
        </div>
    );
};

export default Customer;