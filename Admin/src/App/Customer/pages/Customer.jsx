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
                        className='flex items-center gap-2 px-3 py-2 bg-baclk hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs cursor-pointer border border-slate-300 transition-all font-bold shadow-xs'
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
                    <tbody className='divide-y divide-baclk font-medium text-slate-800'>
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
                                            <div>
                                                <CopyCell text={item.customerNameEn} className='font-bold text-emerald-700 block' />
                                                <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-[11px] font-semibold' />
                                            </div>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-slate-600 text-[11px]'><CopyCell text={item.idCardNumber || '-'} className='font-mono text-slate-600 text-[11px]' /></td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-medium'><CopyCell text={item.phone || '-'} className='font-mono text-slate-700 font-medium' /></td>
                                    <td className='px-4 py-3'>
                                        <span className='px-2 py-0.5 bg-baclk border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
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
                                                className="w-8 h-8 rounded-xl bg-baclk hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 text-sm transition-all cursor-pointer"
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
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
                    <div className="bg-white border border-gray-200 rounded-[26px] w-full max-w-4xl shadow-[0_18px_45px_rgba(0,0,0,0.20)] max-h-[92vh] overflow-y-auto">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-[26px] z-10">

                            <div className="flex items-center gap-4">
                                <img
                                    src={
                                        selectedCustomer.customerPhoto ||
                                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                    }
                                    alt="avatar"
                                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500"
                                />

                                <div>
                                    <h3 className="text-base font-black text-gray-900 tracking-wide flex items-center gap-2">
                                        <span className="text-gray-900">
                                            {selectedCustomer.customerNameEn}
                                        </span>

                                        <span className="text-xs text-emerald-600 font-khmer font-normal">
                                            ({selectedCustomer.customerNameKh})
                                        </span>
                                    </h3>

                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Activated
                                        </span>

                                        <span className="text-[10px] text-gray-500 font-bold">
                                            Contract: {selectedCustomer.contractId}
                                        </span>

                                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            {selectedCustomer.brand || 'Device'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Header Actions */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 flex-wrap">

                                    {/* Excel */}
                                    <button
                                        onClick={() => {
                                            const c = selectedCustomer;

                                            const excelData = [{
                                                'Name EN': c.customerNameEn,
                                                'Name KH': c.customerNameKh,
                                                'ID Card': c.idCardNumber,
                                                'DOB': c.dob,
                                                'Gender': c.gender,
                                                'Phone': c.phone,
                                                'Relative Phone': c.relativePhone,
                                                'Current Address': c.currentAddress,
                                                'Facebook': c.facebookName,
                                                'Telegram': c.telegramName,
                                                'Model': c.model,
                                                'Serial': c.serialNumber,
                                                'IMEI1': c.imei1,
                                                'IMEI2': c.imei2,
                                                'MEID': c.meid || '',
                                                'Color': c.color,
                                                'Version': c.version,
                                                'Total ($)': c.amount || c.totalAmount,
                                                'Monthly ($)': c.monthlyPayment,
                                                'Interest': c.interest,
                                                'Duration': c.duration,
                                            }];

                                            exportToExcel(
                                                excelData,
                                                `Customer_${c.customerNameEn}`
                                            );
                                        }}
                                        className="
                                group flex items-center gap-2
                                px-3 py-1
                                cursor-pointer
                                rounded-xl
                                text-[11px] font-semibold
                                text-gray-700
                                bg-white
                                border border-gray-200
                                shadow-sm
                                hover:border-emerald-400
                                hover:bg-emerald-50
                                hover:text-emerald-700
                                active:scale-95
                                transition-all duration-200
                            "
                                    >
                                        <span className="
                                w-6 h-6
                                rounded-lg
                                bg-emerald-50
                                flex items-center justify-center
                                group-hover:bg-emerald-100
                            ">
                                            <FaFileExcel className="text-emerald-600 text-sm" />
                                        </span>

                                        <span>Excel</span>
                                    </button>

                                    {/* PDF */}
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

                                            exportToPDF(
                                                `Customer: ${c.customerNameEn}`,
                                                cols,
                                                rows
                                            );
                                        }}
                                        className="
                                group flex items-center gap-2
                                px-3 py-1
                                cursor-pointer
                                rounded-xl
                                text-[11px] font-semibold
                                text-gray-700
                                bg-white
                                border border-gray-200
                                shadow-sm
                                hover:border-red-300
                                hover:bg-red-50
                                hover:text-red-600
                                active:scale-95
                                transition-all duration-200
                            "
                                    >
                                        <span className="
                                w-6 h-6
                                rounded-lg
                                bg-red-50
                                flex items-center justify-center
                                group-hover:bg-red-100
                            ">
                                            <MdPictureAsPdf className="text-red-500 text-sm" />
                                        </span>

                                        <span>PDF</span>
                                    </button>

                                    {/* QR Profile */}
                                    <button
                                        onClick={() => handleOpenQrModal(selectedCustomer)}
                                        className="
                                group flex items-center gap-2
                                px-3 py-1
                                cursor-pointer
                                rounded-xl
                                text-[11px] font-semibold
                                text-gray-700
                                bg-white
                                border border-gray-200
                                shadow-sm
                                hover:border-emerald-400
                                hover:bg-emerald-50
                                hover:text-emerald-700
                                active:scale-95
                                transition-all duration-200
                            "
                                    >
                                        <span className="
                                w-6 h-6
                                rounded-lg
                                bg-emerald-50
                                flex items-center justify-center
                                group-hover:bg-emerald-100
                            ">
                                            <FaQrcode className="text-emerald-600 text-sm" />
                                        </span>

                                        <span>QR Profile</span>
                                    </button>
                                </div>

                                {/* Close */}
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="
                            w-8 h-8
                            rounded-xl
                            bg-gray-100
                            hover:bg-red-50
                            border border-gray-200
                            flex items-center justify-center
                            text-gray-500
                            hover:text-red-600
                            text-sm font-bold
                            cursor-pointer
                            transition-colors
                        "
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4 text-xs">

                            {/* 3D Interactive ID Card Viewer */}
                            <div className="rounded-[22px]">
                                <IDCard3DViewer customer={selectedCustomer} />
                            </div>

                            {/* ================= CUSTOMER INFORMATION ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-4 shadow-sm">

                                <h4 className="
                        text-[11px]
                        font-bold
                        text-gray-900
                        uppercase
                        tracking-[0.14em]
                        mb-3
                        flex items-center gap-2
                    ">
                                    Customer Personal Information
                                </h4>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">

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
                                        <div
                                            key={label}
                                            className="
                                    p-2.5
                                    rounded-xl
                                    border border-gray-200
                                    bg-gray-50
                                    hover:bg-emerald-50/40
                                    hover:border-emerald-200
                                    transition-colors
                                "
                                        >
                                            <span className="
                                    text-gray-500
                                    block
                                    text-[10px]
                                    font-bold
                                    uppercase
                                    tracking-[0.08em]
                                    mb-1
                                ">
                                                {label}
                                            </span>

                                            <span className="
                                    font-semibold
                                    text-gray-900
                                    break-words
                                    leading-relaxed
                                ">
                                                {value}
                                            </span>
                                        </div>
                                    ))}

                                </div>
                            </div>

                            {/* ================= DEVICE DETAILS ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-4 shadow-sm">

                                <h4 className="
                        text-[11px]
                        font-bold
                        text-gray-900
                        uppercase
                        tracking-[0.14em]
                        mb-3
                    ">
                                    Device Hardware Information
                                </h4>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">

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

                                        <div
                                            key={label}
                                            className="
                                    p-2.5
                                    rounded-xl
                                    border border-gray-200
                                    bg-gray-50
                                    hover:bg-emerald-50/40
                                    hover:border-emerald-200
                                    transition-colors
                                "
                                        >
                                            <span className="
                                    text-gray-500
                                    block
                                    text-[10px]
                                    font-bold
                                    uppercase
                                    tracking-[0.08em]
                                    mb-1
                                ">
                                                {label}
                                            </span>

                                            <span
                                                className={`
                                        font-semibold
                                        ${label === 'MEID'
                                                        ? 'text-gray-900 font-mono'
                                                        : label.includes('IMEI') || label.includes('Serial')
                                                            ? 'text-gray-900 font-mono'
                                                            : 'text-gray-900'
                                                    }
                                    `}
                                            >
                                                {value}
                                            </span>
                                        </div>

                                    ))}

                                </div>
                            </div>

                            {/* ================= DEVICE PROBLEM ================= */}
                            {selectedCustomer.deviceProblem && (
                                <div className="
                        rounded-[20px]
                        border border-amber-200
                        bg-amber-50
                        p-4
                        shadow-sm
                    ">

                                    <h4 className="
                            text-[11px]
                            font-bold
                            text-amber-800
                            uppercase
                            tracking-[0.14em]
                            mb-2
                        ">
                                        Device Problem
                                    </h4>

                                    <div className="
                            p-3
                            bg-white
                            border border-amber-200
                            rounded-xl
                            text-xs
                            text-gray-700
                            font-medium
                            leading-relaxed
                            whitespace-pre-wrap
                        ">
                                        {selectedCustomer.deviceProblem}
                                    </div>
                                </div>
                            )}

                            {/* ================= LOAN TERMS ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-4 shadow-sm">

                                <h4 className="
                        text-[11px]
                        font-bold
                        text-gray-900
                        uppercase
                        tracking-[0.14em]
                        mb-3
                    ">
                                    Loan & Financial Agreement
                                </h4>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">

                                    {[
                                        ['Loan Date (កាលបរិច្ឆេទ)', selectedCustomer.inputDate || '-'],
                                        ['Total Loan Amount', `$${totalLoan.toLocaleString()}`],
                                        ['Monthly Installment', `$${selectedCustomer.monthlyPayment}/mo`],
                                        ['Interest Rate', selectedCustomer.interest || '-'],
                                        ['Duration', selectedCustomer.duration || '-'],
                                    ].map(([label, value]) => (

                                        <div
                                            key={label}
                                            className="
                                    p-2.5
                                    rounded-xl
                                    border border-gray-200
                                    bg-gray-50
                                    hover:bg-emerald-50
                                    hover:border-emerald-200
                                    transition-colors
                                "
                                        >
                                            <span className="
                                    text-gray-500
                                    block
                                    text-[10px]
                                    font-bold
                                    uppercase
                                    tracking-[0.08em]
                                    mb-1
                                ">
                                                {label}
                                            </span>

                                            <span className="font-bold text-gray-900 font-mono">
                                                {value}
                                            </span>
                                        </div>

                                    ))}

                                </div>
                            </div>

                            {/* ================= PAYMENT HISTORY ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-4 shadow-sm">

                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="
                            text-[11px]
                            font-bold
                            text-gray-900
                            uppercase
                            tracking-[0.14em]
                        ">
                                        Complete Payment History
                                    </h4>
                                </div>

                                {/* Financial Summary */}
                                <div className="
                        p-3
                        bg-gray-50
                        border border-gray-200
                        rounded-2xl
                    ">

                                    <div className="grid grid-cols-3 gap-3 mb-2 text-center">

                                        <div className="p-2 bg-white border border-gray-200 rounded-xl">
                                            <span className="text-gray-500 text-[10px] block">
                                                Total Loan
                                            </span>

                                            <span className="text-gray-900 font-mono font-bold text-sm">
                                                ${totalLoan.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="p-2 bg-white border border-gray-200 rounded-xl">
                                            <span className="text-gray-500 text-[10px] block">
                                                Total Paid So Far
                                            </span>

                                            <span className="text-emerald-600 font-mono font-bold text-sm">
                                                ${totalPaidSum.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="p-2 bg-white border border-gray-200 rounded-xl">
                                            <span className="text-gray-500 text-[10px] block">
                                                Remaining Balance
                                            </span>

                                            <span className="text-orange-600 font-mono font-bold text-sm">
                                                ${remainingBalance.toLocaleString()}
                                            </span>
                                        </div>

                                    </div>

                                    {/* Progress */}
                                    <div className="
                            w-full
                            bg-gray-200
                            rounded-full
                            h-2
                            overflow-hidden
                        ">
                                        <div
                                            className="
                                    bg-emerald-500
                                    h-full
                                    transition-all duration-500
                                "
                                            style={{
                                                width: `${repaymentPct}%`
                                            }}
                                        />
                                    </div>

                                    <div className="
                            flex justify-between
                            text-[10px]
                            text-gray-500
                            mt-1
                        ">
                                        <span>
                                            Repayment Progress:
                                            <strong className="text-emerald-600 ml-1">
                                                {repaymentPct}%
                                            </strong>
                                        </span>

                                        <span>
                                            {totalPaidSum >= totalLoan && totalLoan > 0
                                                ? '🎉 Fully Paid'
                                                : `Remaining: $${remainingBalance.toLocaleString()}`
                                            }
                                        </span>
                                    </div>
                                </div>

                                <br />

                                {/* Payment Table */}
                                <div className="
                        overflow-x-auto
                        rounded-xl
                        border border-gray-200
                        bg-white
                        max-h-56
                        overflow-y-auto
                    ">

                                    <table className="w-full text-left text-xs">

                                        <thead className="
                                bg-gray-50
                                text-gray-500
                                uppercase
                                text-[10px]
                                border-b border-gray-200
                                sticky top-0
                            ">
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

                                        <tbody className="divide-y divide-gray-100 text-gray-700">

                                            {loadingPayments ? (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        className="text-center py-4 text-gray-400 italic"
                                                    >
                                                        Loading payment transactions...
                                                    </td>
                                                </tr>
                                            ) : customerPayments.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        className="text-center py-4 text-gray-400 italic"
                                                    >
                                                        No payment records recorded yet for this customer.
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerPayments.map((p, pIdx) => (

                                                    <tr
                                                        key={p._id || pIdx}
                                                        className="hover:bg-emerald-50 transition-colors"
                                                    >
                                                        <td className="px-3 py-2 text-center text-gray-400 font-mono">
                                                            {pIdx + 1}
                                                        </td>

                                                        <td className="px-3 py-2 font-mono text-gray-600">
                                                            {p.paymentDate ||
                                                                p.createdAt?.split('T')[0] ||
                                                                '—'}
                                                        </td>

                                                        <td className="
                                                px-3 py-2
                                                font-mono
                                                font-bold
                                                text-emerald-600
                                            ">
                                                            ${Number(p.amount || 0).toLocaleString()}
                                                        </td>

                                                        <td className="px-3 py-2 font-medium text-gray-600">
                                                            {p.month ||
                                                                p.cycle ||
                                                                `Installment #${pIdx + 1}`}
                                                        </td>

                                                        <td className="px-3 py-2 text-gray-500">
                                                            {p.paidBy || p.cashier || 'System'}
                                                        </td>

                                                        <td className="
                                                px-3 py-2
                                                text-gray-500
                                                truncate
                                                max-w-[120px]
                                            ">
                                                            {p.paymentMethod ||
                                                                p.note ||
                                                                'Cash / ABA'}
                                                        </td>

                                                        <td className="px-3 py-2 text-center">
                                                            <span className="
                                                    px-2
                                                    py-0.5
                                                    bg-emerald-50
                                                    text-emerald-700
                                                    border border-emerald-200
                                                    rounded-full
                                                    text-[9px]
                                                    font-bold
                                                ">
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

                            {/* ================= SECURITY LOCK ================= */}
                            <div className="
                    rounded-2xl
                    bg-white
                    border border-gray-200
                    p-4
                    shadow-sm
                ">

                                <div className="flex items-center justify-between mb-4">

                                    <div>
                                        <h4 className="
                                text-xs
                                font-bold
                                text-gray-900
                                uppercase
                                tracking-wider
                            ">
                                            Security Lock Status
                                        </h4>

                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            Device security overview
                                        </p>
                                    </div>

                                </div>

                                <div className="grid grid-cols-2 gap-3">

                                    {/* Phone Lock */}
                                    <div className="
                            group
                            p-3
                            rounded-xl
                            bg-gray-50
                            border border-gray-200
                            hover:border-emerald-300
                            hover:bg-emerald-50
                            transition-all duration-200
                        ">

                                        <div className="flex items-center justify-between gap-2">

                                            <div className="flex items-center gap-2 min-w-0">

                                                <div className="
                                        w-7 h-7
                                        rounded-lg
                                        bg-white
                                        border border-gray-200
                                        flex items-center justify-center
                                    ">
                                                    <svg
                                                        className="w-3.5 h-3.5 text-gray-600"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <rect
                                                            x="6"
                                                            y="3"
                                                            width="12"
                                                            height="18"
                                                            rx="2"
                                                        />

                                                        <path
                                                            strokeLinecap="round"
                                                            d="M10 18h4"
                                                        />
                                                    </svg>
                                                </div>

                                                <span className="
                                        text-[11px]
                                        font-semibold
                                        text-gray-700
                                        truncate
                                    ">
                                                    Phone Lock
                                                </span>

                                            </div>

                                            <span
                                                className={`
                                        shrink-0
                                        px-2.5 py-1
                                        rounded-full
                                        text-[9px]
                                        font-bold
                                        border
                                        ${selectedCustomer.lockPhoneStatus === 'Locked'
                                                        ? 'bg-red-50 text-red-600 border-red-200'
                                                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                    }
                                    `}
                                            >
                                                {selectedCustomer.lockPhoneStatus || 'Unlocked'}
                                            </span>

                                        </div>
                                    </div>

                                    {/* Wallpaper Lock */}
                                    <div className="
                            group
                            p-3
                            rounded-xl
                            bg-gray-50
                            border border-gray-200
                            hover:border-emerald-300
                            hover:bg-emerald-50
                            transition-all duration-200
                        ">

                                        <div className="flex items-center justify-between gap-2">

                                            <div className="flex items-center gap-2 min-w-0">

                                                <div className="
                                        w-7 h-7
                                        rounded-lg
                                        bg-white
                                        border border-gray-200
                                        flex items-center justify-center
                                    ">
                                                    <svg
                                                        className="w-3.5 h-3.5 text-gray-600"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M4 7h16M4 7l2-3h12l2 3M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7"
                                                        />

                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M9 12h6"
                                                        />
                                                    </svg>
                                                </div>

                                                <span className="
                                        text-[11px]
                                        font-semibold
                                        text-gray-700
                                        truncate
                                    ">
                                                    Wallpaper Lock
                                                </span>

                                            </div>

                                            <span
                                                className={`
                                        shrink-0
                                        px-2.5 py-1
                                        rounded-full
                                        text-[9px]
                                        font-bold
                                        border
                                        ${selectedCustomer.lockWallpaperStatus === 'Locked'
                                                        ? 'bg-gray-100 text-gray-700 border-gray-300'
                                                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                    }
                                    `}
                                            >
                                                {selectedCustomer.lockWallpaperStatus || 'Unlocked'}
                                            </span>

                                        </div>
                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Customer Profile QR Code Modal */}
            {qrCustomer && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[999999] p-4">

                    <div className="
            bg-white
            border border-gray-200
            rounded-[26px]
            w-full max-w-sm
            shadow-[0_18px_45px_rgba(0,0,0,0.25)]
            overflow-hidden
            p-6
            text-center
            space-y-4
        ">

                        {/* Header */}
                        <div className="
                flex items-center justify-between
                border-b border-gray-200
                pb-3
            ">
                            <div className="
                    flex items-center gap-2
                    text-gray-900
                    font-bold
                    text-xs
                    uppercase
                    tracking-[0.14em]
                ">
                                <FaQrcode className="text-base text-emerald-600" />

                                <span>
                                    Customer Profile QR
                                </span>
                            </div>

                            <button
                                onClick={() => setQrCustomer(null)}
                                className="
                        w-7 h-7
                        rounded-xl
                        bg-gray-100
                        hover:bg-red-50
                        border border-gray-200
                        text-gray-500
                        hover:text-red-600
                        text-xs
                        font-bold
                        cursor-pointer
                        transition-colors
                    "
                            >
                                ✕
                            </button>
                        </div>


                        {/* Customer Summary */}
                        <div className="
                flex items-center gap-3
                bg-gray-50
                p-3
                rounded-2xl
                border border-gray-200
                text-left
            ">
                            <img
                                src={
                                    qrCustomer.customerPhoto ||
                                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                }
                                alt="avatar"
                                className="
                        w-12 h-12
                        rounded-xl
                        object-cover
                        border border-gray-200
                    "
                            />

                            <div className="min-w-0">
                                <h4 className="
                        text-xs
                        font-bold
                        text-gray-900
                        truncate
                    ">
                                    {qrCustomer.customerNameEn}
                                </h4>

                                <p className="
                        text-[11px]
                        text-emerald-600
                        font-khmer
                        truncate
                    ">
                                    {qrCustomer.customerNameKh}
                                </p>

                                <p className="
                        text-[10px]
                        text-gray-500
                        font-mono
                        truncate
                    ">
                                    Contract: {qrCustomer.contractId}
                                </p>
                            </div>
                        </div>


                        {/* QR Code */}
                        <div className="
                bg-white
                p-4
                rounded-2xl
                border-4
                border-emerald-100
                inline-block
                mx-auto
                shadow-sm
            ">
                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    alt="Customer QR Code"
                                    className="w-48 h-48 mx-auto"
                                />
                            ) : qrError ? (
                                <div className="
                        w-48 h-48
                        flex items-center justify-center
                        text-red-500
                        text-xs
                        font-semibold
                        text-center
                        p-4
                    ">
                                    {qrError}
                                </div>
                            ) : (
                                <div className="
                        w-48 h-48
                        flex items-center justify-center
                        text-gray-500
                        text-xs
                        font-semibold
                        animate-pulse
                    ">
                                    {qrLoading
                                        ? 'Generating QR Code...'
                                        : 'QR code unavailable'
                                    }
                                </div>
                            )}
                        </div>


                        {/* Description */}
                        <p className="
                text-[11px]
                text-gray-500
                leading-relaxed
                font-khmer
            ">
                            ស្កែន QR Code នេះជាមួយទូរស័ព្ទដៃ
                            ដើម្បីមើល
                            <strong className="text-emerald-600">
                                {' '}ព័ត៌មានលម្អិតទាំងអស់របស់ភ្ញៀវ
                            </strong>
                            {' '}(Personal Info, Device, Financial Terms & Security Status)
                        </p>


                        {/* Actions */}
                        <div className="pt-2 flex gap-2">

                            {/* Open Profile */}
                            <button
                                onClick={() => window.open(qrInfoPageUrl, '_blank')}
                                disabled={!qrInfoPageUrl}
                                className="
                        flex-1
                        py-2.5
                        bg-emerald-600
                        hover:bg-emerald-700
                        disabled:bg-gray-200
                        disabled:text-gray-400
                        disabled:cursor-not-allowed
                        text-white
                        rounded-xl
                        text-xs
                        font-bold
                        cursor-pointer
                        transition-all
                        shadow-sm
                    "
                            >
                                Open Profile Link ↗
                            </button>

                            {/* Close */}
                            <button
                                onClick={() => setQrCustomer(null)}
                                className="
                        px-4
                        py-2.5
                        bg-gray-100
                        hover:bg-red-50
                        border border-gray-200
                        hover:border-red-200
                        text-gray-600
                        hover:text-red-600
                        cursor-pointer
                        rounded-xl
                        text-xs
                        font-bold
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

export default Customer;