import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosContact } from 'react-icons/io';
import { MdOutlineSync, MdSearch, MdInfo, MdPictureAsPdf, MdTableChart, MdQrCode2, MdClose } from 'react-icons/md';
import { FaFileExcel, FaQrcode } from 'react-icons/fa';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import IDCard3DViewer from '../../../components/IDCard3DViewer';
import { formatIMEI } from '../../../utils/imeiFormatter';


const Customer = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

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
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState('');

    // Customer detail payments history state
    const [customerPayments, setCustomerPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);

    useEffect(() => {
        if (!selectedCustomer) {
            setCustomerPayments([]);
            return;
        }
        const loadPayments = async () => {
            setLoadingPayments(true);
            try {
                if (!selectedCustomer.contractId) {
                    setCustomerPayments([]);
                    return;
                }
                const res = await fetch(`${API_BASE1}/payments/contract/${encodeURIComponent(selectedCustomer.contractId)}`);
                if (res.ok) {
                    const data = await res.json();
                    setCustomerPayments(data.data || []);
                }
            } catch (err) {
                console.error('Fetch customer payments error:', err);
            } finally {
                setLoadingPayments(false);
            }
        };
        loadPayments();
    }, [selectedCustomer, API_BASE1]);

    const fetchCustomers = async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                page: pg,
                limit: itemsPerPage,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
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
        setQrDataUrl('');
        setQrInfoPageUrl('');
        setQrError('');
        setQrLoading(true);
        try {
            const res = await fetch(`${API_BASE1}/contracts/customer-qr-payload/${customer.contractId}`);
            if (res.ok) {
                const data = await res.json();
                setQrDataUrl(data.qrDataUrl);
                setQrInfoPageUrl(data.infoPageUrl);
            } else {
                setQrError('Unable to generate customer QR code. Please try again.');
            }
        } catch (err) {
            console.error('Fetch Customer QR payload error:', err);
            setQrError('Unable to connect to the server. Please try again.');
        } finally {
            setQrLoading(false);
        }
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all customers for export error:', err);
        }
        return customers;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const excelData = allData.map((c, idx) => ({
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
            'IMEI 1': formatIMEI(c.imei1),
            'IMEI 2': formatIMEI(c.imei2),
            'MEID': c.meid || '',
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

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'ID Card', accessor: 'idCardNumber' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'IMEI 1', cell: (c) => formatIMEI(c.imei1) },
            { header: 'Total ($)', accessor: 'amount' },
            { header: 'Status', accessor: 'status' },
        ];
        exportToPDF('Customer Master Report', columns, allData);
    };

    // Derived payment totals for selected customer
    const totalLoan = Number(selectedCustomer?.amount || selectedCustomer?.totalAmount || 0);
    const totalPaidSum = customerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const remainingBalance = Math.max(0, totalLoan - totalPaidSum);
    const repaymentPct = totalLoan > 0 ? Math.min(100, Math.round((totalPaidSum / totalLoan) * 100)) : 0;

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>

            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900'>{t('customer')}</h1>
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
                            className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-52 outline-none font-medium shadow-xs"
                        />
                    </div>

                    {/* Export to Excel */}
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-[5px] text-xs cursor-pointer border border-emerald-300 transition-all font-bold shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>

                    {/* Export to PDF */}
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 rounded-[5px] text-xs cursor-pointer border border-red-300 transition-all font-bold shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Reload */}
                    <button
                        onClick={fetchCustomers}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs cursor-pointer border border-slate-300 transition-all font-bold shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Customer Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
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
                                            {/* <img
                                                src={item.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                                alt="avatar"
                                                className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                            /> */}
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
                                                title="View Full Details & Payment History"
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
                    <div className="dark-modal bg-[#0b0f1e] border border-gray-700 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-y-auto">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-[#0b0f1e] rounded-t-3xl z-10">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedCustomer.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                    alt="avatar"
                                    className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/40"
                                />
                                <div>
                                    <h3 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                                        <span>{selectedCustomer.customerNameEn}</span>
                                        <span className="text-xs text-indigo-400 font-khmer font-normal">({selectedCustomer.customerNameKh})</span>
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">✓ Activated</span>
                                        <span className="text-[10px] text-gray-400 font-mono">Contract: {selectedCustomer.contractId}</span>
                                        <span className="text-[10px] text-purple-300 font-bold bg-purple-950 px-2 py-0.5 rounded-full border border-purple-800">{selectedCustomer.brand || 'Device'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const d = [selectedCustomer];
                                        const excelData = d.map(c => ({
                                            'Name EN': c.customerNameEn, 'Name KH': c.customerNameKh,
                                            'ID Card': c.idCardNumber, 'DOB': c.dob, 'Gender': c.gender,
                                            'Phone': c.phone, 'Relative Phone': c.relativePhone,
                                            'Current Address': c.currentAddress, 'Facebook': c.facebookName,
                                            'Telegram': c.telegramName, 'Model': c.model,
                                            'Serial': c.serialNumber, 'IMEI1': c.imei1, 'IMEI2': c.imei2, 'MEID': c.meid || '',
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
                                            { field: 'MEID', value: c.meid || '-' },
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

                        <div className="p-6 space-y-6 text-xs">
                            {/* 3D Interactive ID Card Viewer */}
                            <div className="bg-[#070913] rounded-2xl border border-indigo-500/30">
                                <IDCard3DViewer customer={selectedCustomer} />
                            </div>

                            {/* Section 1: Customer Information */}
                            <div>
                                <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> 👤 Customer Personal Information
                                </h4>
                                <div className="grid grid-cols-2 text-black-600 sm:grid-cols-4 gap-2">
                                    {[
                                        ['Name English', selectedCustomer.customerNameEn],
                                        ['Name Khmer', selectedCustomer.customerNameKh],
                                        ['ID Card Number', selectedCustomer.idCardNumber || '-'],
                                        ['Date of Birth', selectedCustomer.dob || '-'],
                                        ['Gender', selectedCustomer.gender || '-'],
                                        ['Brand', selectedCustomer.brand || '-'],
                                        ['Phone Number', selectedCustomer.phone || '-'],
                                        ['Relative Phone', selectedCustomer.relativePhone || '-'],
                                        ['Birth Address', selectedCustomer.birthAddress || '-'],
                                        ['Current Address', selectedCustomer.currentAddress || '-'],
                                        ['Facebook Name', selectedCustomer.facebookName || '-'],
                                        ['Telegram Name', selectedCustomer.telegramName || '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <span className="text-gray-400 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className="font-semibold text-black-100 break-words">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: Device Details */}
                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span> 📱 Device Hardware Information
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        ['Device Model', selectedCustomer.model],
                                        ['Brand', selectedCustomer.brand || '-'],
                                        ['Serial Number', selectedCustomer.serialNumber],
                                        ['IMEI 1', formatIMEI(selectedCustomer.imei1)],
                                        ['IMEI 2', formatIMEI(selectedCustomer.imei2)],
                                        ['MEID', selectedCustomer.meid || '-'],
                                        ['Color', selectedCustomer.color || '-'],
                                        ['Storage / Version', selectedCustomer.version || '-'],
                                    ].map(([label, value]) => (

                                        <div key={label} className="p-2.5 bg-[#151928] rounded-xl border border-gray-700">
                                            <span className="text-gray-400 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className={`font-semibold ${label === 'MEID' ? 'text-pink-400 font-mono' : label.includes('IMEI') || label.includes('Serial') ? 'text-sky-300 font-mono' : 'text-gray-100'}`}>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Device Problem */}
                            {selectedCustomer.deviceProblem && (
                                <div className="pt-2 border-t border-gray-800">
                                    <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span> 🔧 Device Problem / បញ្ហាឧបករណ៍
                                    </h4>
                                    <div className="p-3 bg-amber-900/15 border border-amber-700/40 rounded-xl text-xs text-amber-300 font-medium leading-relaxed whitespace-pre-wrap">
                                        {selectedCustomer.deviceProblem}
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Loan Terms */}

                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> 💰 Loan & Financial Agreement
                                </h4>
                                <div className="grid grid-cols-2 text-black sm:grid-cols-5 gap-2">
                                    {[
                                        ['Loan Date (កាលបរិច្ឆេទ)', selectedCustomer.inputDate || '-'],
                                        ['Total Loan Amount', `$${totalLoan.toLocaleString()}`],
                                        ['Monthly Installment', `$${selectedCustomer.monthlyPayment}/mo`],
                                        ['Interest Rate', selectedCustomer.interest || '-'],
                                        ['Duration', selectedCustomer.duration || '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <span className="text-black-600 block text-[10px] font-semibold mb-0.5">{label}</span>
                                            <span className="font-bold text-black-100 font-mono">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: Complete Payment History (ប្រវត្តិនៃការបង់ប្រាក់ទាំងអស់) */}
                            <div className="pt-2 border-t border-gray-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span> 💳 Complete Payment History (ប្រវត្តិនៃការបង់ប្រាក់ទាំងអស់)
                                    </h4>
                                    <span className="px-2.5 py-0.5 bg-sky-950 border border-sky-800 text-sky-300 rounded-full text-[10px] font-bold">
                                        {customerPayments.length} Payment Transactions
                                    </span>
                                </div>

                                {/* Financial Summary Bar */}
                                <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-2xl">
                                    <div className="grid grid-cols-3 gap-3 mb-2 text-center">
                                        <div className="p-2 bg-gray-900/80 rounded-xl border border-gray-800">
                                            <span className="text-gray-500 text-[10px] block">Total Loan</span>
                                            <span className="text-black-200 font-mono font-bold text-sm">${totalLoan.toLocaleString()}</span>
                                        </div>
                                        <div className="p-2 bg-gray-900/80 rounded-xl border border-gray-800">
                                            <span className="text-gray-500 text-[10px] block">Total Paid So Far</span>
                                            <span className="text-emerald-400 font-mono font-bold text-sm">${totalPaidSum.toLocaleString()}</span>
                                        </div>
                                        <div className="p-2 bg-gray-900/80 rounded-xl border border-gray-800">
                                            <span className="text-gray-500 text-[10px] block">Remaining Balance</span>
                                            <span className="text-amber-400 font-mono font-bold text-sm">${remainingBalance.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
                                        <div className="bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-500 h-full transition-all duration-500" style={{ width: `${repaymentPct}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                        <span>Repayment Progress: <strong className="text-emerald-400">{repaymentPct}%</strong></span>
                                        <span>{totalPaidSum >= totalLoan && totalLoan > 0 ? '🎉 Fully Paid' : `Remaining: $${remainingBalance.toLocaleString()}`}</span>
                                    </div>
                                </div>

                                {/* Payment List Table */}
                                <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/60 max-h-56 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] border-b border-gray-800 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-center">No</th>
                                                <th className="px-3 py-2">Payment Date</th>
                                                <th className="px-3 py-2">Amount Paid</th>
                                                <th className="px-3 py-2">Month / Cycle</th>
                                                <th className="px-3 py-2">Paid By</th>
                                                <th className="px-3 py-2">Method / Note</th>
                                                <th className="px-3 py-2 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900 text-gray-200">
                                            {loadingPayments ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-4 text-gray-500 italic">
                                                        Loading payment transactions...
                                                    </td>
                                                </tr>
                                            ) : customerPayments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-4 text-gray-500 italic">
                                                        No payment records recorded yet for this customer.
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerPayments.map((p, pIdx) => (
                                                    <tr key={p._id || pIdx} className="hover:bg-sky-900/20 transition-colors">
                                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">{pIdx + 1}</td>
                                                        <td className="px-3 py-2 font-mono text-gray-300">
                                                            {p.paymentDate || p.createdAt?.split('T')[0] || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono font-bold text-emerald-400">
                                                            ${Number(p.amount || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 font-medium text-gray-300">
                                                            {p.month || p.cycle || `Installment #${pIdx + 1}`}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-400">
                                                            {p.paidBy || p.cashier || 'System'}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-400 truncate max-w-[120px]">
                                                            {p.paymentMethod || p.note || 'Cash / ABA'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-full text-[9px] font-bold">
                                                                ✓ Paid
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 5: Security Lock Status */}
                            <div className="pt-2 border-t border-gray-800">
                                <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span> 🛡️ Security Lock Status
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
                    <div className="dark-modal bg-[#0b0f1e] border border-indigo-500/40 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center space-y-4">
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
                            ) : qrError ? (
                                <div className="w-48 h-48 flex items-center justify-center text-red-500 text-xs font-semibold text-center p-4">
                                    {qrError}
                                </div>
                            ) : (
                                <div className="w-48 h-48 flex items-center justify-center text-gray-600 text-xs font-semibold animate-pulse">
                                    {qrLoading ? 'Generating QR Code...' : 'QR code unavailable'}
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-gray-400 leading-relaxed font-khmer">
                            📱 ស្កែន QR Code នេះជាមួយទូរស័ព្ទដៃដើម្បីមើល **ព័ត៌មានលម្អិតទាំងអស់របស់ភ្ញៀវ** (Personal Info, Device, Financial terms & Security status)
                        </p>

                        <div className="pt-2 flex gap-2">
                            <button
                                onClick={() => window.open(qrInfoPageUrl, '_blank')}
                                disabled={!qrInfoPageUrl}
                                className="flex-1 py-2.5 bg-indigo-600 cursor-pointer hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md"
                            >
                                Open Profile Link ↗
                            </button>
                            <button
                                onClick={() => setQrCustomer(null)}
                                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-black-300 cursor-pointer rounded-xl text-xs font-bold transition-all"
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