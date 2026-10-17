import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosContact } from 'react-icons/io';
import { MdOutlineSync, MdInfo, MdPictureAsPdf, MdTableChart, MdQrCode2 } from 'react-icons/md';
import { FaFileExcel, FaQrcode, FaFileImage } from 'react-icons/fa';
import ImageGalleryModal from '../../../components/ImageGalleryModal';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import IDCard3DViewer from '../../../components/IDCard3DViewer';
import { formatIMEI } from '../../../utils/imeiFormatter';
import ContractSearchInput from '../../../components/ContractSearchInput';


const Customer = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user, hasPermission } = useAuth();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedContractId, setSelectedContractId] = useState('');
    const [locatedIndex, setLocatedIndex] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
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
    const [exportingCustomerPdfId, setExportingCustomerPdfId] = useState(null);

    // Action droplist & Photo Gallery modal states
    const [openMenuId, setOpenMenuId] = useState(null);
    const [photoGalleryCustomer, setPhotoGalleryCustomer] = useState(null);
    const [photoGalleryIndex, setPhotoGalleryIndex] = useState(0);

    // Close action menu on window click
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleDirectExportPdf = async (customer) => {
        if (!customer || exportingCustomerPdfId) return;
        const cid = customer._id || customer.contractId;
        setExportingCustomerPdfId(cid);
        try {
            const res = await fetch(`${API_BASE1}/contracts/${cid}/pdf`);
            if (!res.ok) throw new Error(`Status: ${res.status}`);

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            const safeName = (customer.customerNameEn || customer.customerNameKh || 'Customer').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const safeId = (customer.contractId || customer.serialNumber || 'Contract').replace(/[^a-zA-Z0-9_\-]/g, '_');
            link.download = `Report_${safeId}_${safeName}.pdf`;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(link);
            }, 300);
        } catch (err) {
            console.error('Direct customer PDF export error:', err);
            alert('Download Failed: ' + err.message);
        } finally {
            setExportingCustomerPdfId(null);
        }
    };

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

    const fetchCustomers = useCallback(async (pg = currentPage, search = searchTerm, contractId = selectedContractId) => {
        setReloading(true);
        try {
            const pageToFetch = typeof pg === 'number' ? pg : 1;
            const params = new URLSearchParams({
                status: 'Activated',
                page: pageToFetch,
                limit: itemsPerPage,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (contractId) params.set('locateId', contractId);
            else if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.data || []);
                setTotal(data.total || 0);
                if (contractId) {
                    setLocatedIndex(data.locateIndex >= 0 ? data.locateIndex : null);
                    setCurrentPage(data.page || pageToFetch);
                } else {
                    setLocatedIndex(null);
                }
            }
        } catch (err) {
            console.error('Fetch customers error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, itemsPerPage, searchTerm, selectedContractId]);

    useEffect(() => {
        fetchCustomers(currentPage, searchTerm, selectedContractId);
    }, [currentPage, fetchCustomers, searchTerm, selectedContractId]);

    const filteredCustomers = selectedContractId
        ? customers.filter(customer => String(customer._id) === selectedContractId || customer.contractId === selectedContractId)
        : customers;

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
            if (selectedContractId) params.set('contractId', selectedContractId);
            else if (searchTerm) params.set('search', searchTerm);
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
            'Input Date': c.inputDate || '',
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
            'Status': c.status || 'Activated',
        }));
        exportToExcel(excelData, 'MDM_Customer_List');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Input Date', accessor: 'inputDate' },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'ID Card', accessor: 'idCardNumber' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'IMEI 1', cell: (c) => formatIMEI(c.imei1) },
            { header: 'Total ($)', accessor: 'amount' },
            { header: 'Status', accessor: 'status' },
        ];
        exportToPDF('Customer Master Report', columns, allData, user?.brand || '', orientation);
    };

    // Derived payment totals for selected customer
    const totalLoan = Number(selectedCustomer?.amount || selectedCustomer?.totalAmount || 0);
    const totalPaidSum = customerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const remainingBalance = Math.max(0, totalLoan - totalPaidSum);
    const repaymentPct = totalLoan > 0 ? Math.min(100, Math.round((totalPaidSum / totalLoan) * 100)) : 0;

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>

            {/* Header */}
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900'>{t('customer')}</h1>
                    </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    {/* Search */}
                    <div className="relative">
                        <ContractSearchInput
                            value={searchInput}
                            apiBase={API_BASE1}
                            user={user}
                            status="Activated"
                            placeholder="Search name, phone, model..."
                            onChange={(value) => {
                                setSearchInput(value);
                                setSearchTerm(value);
                                setSelectedContractId('');
                                setLocatedIndex(null);
                                setCurrentPage(1);
                            }}
                            onSelect={(contract) => {
                                setSearchInput(contract.customerNameEn || contract.customerNameKh || contract.contractId || '');
                                setSearchTerm('');
                                setSelectedContractId(String(contract.contractId || contract._id || ''));
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    {/* Export to Excel & PDF */}
                    {hasPermission('/customer', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}

                </div>
            </header>

            {/* Customer Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>ថ្ងៃដាក់បញ្ចាំ</th>
                            <th className='px-4 py-1'>Customer</th>
                            <th className='px-4 py-1'>ID Card</th>
                            <th className='px-4 py-1'>Phone</th>
                            <th className='px-4 py-1'>Brand</th>
                            <th className='px-4 py-1'>Device Model</th>
                            <th className='px-4 py-1'>Serial No.</th>
                            <th className='px-4 py-1 text-center'>Monthly</th>
                            <th className='px-4 py-1 text-center'>Status</th>
                            <th className='px-4 py-1 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="text-center py-8 text-slate-500 italic font-medium">
                                    {searchTerm || selectedContractId ? `No results for "${searchInput}"` : 'No active customers found.'}
                                </td>
                            </tr>
                        ) : (
                            filteredCustomers.map((item, idx) => {
                                const canSeePhoto = hasPermission('/customer', 'seePhoto');
                                const canDetail = hasPermission('/customer', 'detail');
                                const canQrcode = hasPermission('/customer', 'qrcode');
                                const canExport = hasPermission('/customer', 'export');
                                const hasAnyAction = canSeePhoto || canDetail || canQrcode || canExport;

                                return (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{selectedContractId && locatedIndex !== null ? locatedIndex + 1 : (currentPage - 1) * itemsPerPage + idx + 1}</td>
                                        <td className='px-4 py-1 whitespace-nowrap font-mono text-slate-700'><CopyCell text={item.inputDate || '-'} className='font-mono text-slate-700' /></td>
                                        <td className='px-4 py-1'>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <CopyCell text={item.customerNameEn} className='font-bold text-emerald-700 block' />
                                                    <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-[11px] font-semibold' />
                                                </div>
                                            </div>
                                        </td>
                                        <td className='px-4 py-1 font-mono text-slate-600 text-[11px]'><CopyCell text={item.idCardNumber || '-'} className='font-mono text-slate-600 text-[11px]' /></td>
                                        <td className='px-4 py-1 font-mono text-slate-700 font-medium'><CopyCell text={item.phone || '-'} className='font-mono text-slate-700 font-medium' /></td>
                                        <td className='px-4 py-1'>
                                            <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                                {item.brand || '—'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-1 font-mono text-emerald-700 font-semibold text-[11px]'><CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-semibold text-[11px]' /></td>
                                        <td className='px-4 py-1 text-center font-mono font-bold text-emerald-700'>${item.monthlyPayment}/mo</td>
                                        <td className='px-4 py-1 text-center'>
                                            <span className='px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px] uppercase'>Activated</span>
                                        </td>
                                        <td className='px-4 py-1 text-center'>
                                            {hasAnyAction ? (
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === (item._id || item.contractId) ? null : (item._id || item.contractId));
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                                    >
                                                        <span>Actions</span>
                                                        <span className="text-[9px]">▼</span>
                                                    </button>

                                                    {openMenuId === (item._id || item.contractId) && (
                                                        <div
                                                            className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-[5px] shadow-xl z-50 py-1 text-xs text-left animate-in fade-in zoom-in-95 duration-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {/* See Photo */}
                                                            {canSeePhoto && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPhotoGalleryCustomer(item);
                                                                        setPhotoGalleryIndex(0);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                                                                >
                                                                    <FaFileImage className="text-emerald-600" />
                                                                    <span>{t('seePhoto')}</span>
                                                                </button>
                                                            )}

                                                            {/* Details Info */}
                                                            {canDetail && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedCustomer(item);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                                                                >
                                                                    <MdInfo className="text-slate-500" />
                                                                    <span>{t('details')}</span>
                                                                </button>
                                                            )}

                                                            {/* QR Code Profile */}
                                                            {canQrcode && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleOpenQrModal(item);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                                                                >
                                                                    <FaQrcode className="text-indigo-600" />
                                                                    <span>QR Code</span>
                                                                </button>
                                                            )}

                                                            {/* Export PDF */}
                                                            {canExport && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleDirectExportPdf(item);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    disabled={exportingCustomerPdfId === (item._id || item.contractId)}
                                                                    className="w-full px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                                                                >
                                                                    <MdPictureAsPdf className="text-red-600" />
                                                                    <span>{exportingCustomerPdfId === (item._id || item.contractId) ? 'Exporting...' : 'Export PDF'}</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-mono text-[11px]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination controls */}
            <Pagination
                currentPage={currentPage}
                totalItems={total}
                itemsPerPage={itemsPerPage}
                onPageChange={(pg) => {
                    if (selectedContractId) {
                        setSelectedContractId('');
                        setSearchInput('');
                        setLocatedIndex(null);
                    }
                    setCurrentPage(pg);
                }}
            />

            {/* Full Customer Detail Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[99999] p-2">
                    <div className="bg-white border border-gray-200 rounded-[20px] w-full max-w-5xl h-full max-h-full shadow-2xl overflow-y-auto flex flex-col">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-[20px] z-10 flex-shrink-0">

                            <div>
                                <h3 className="text-base font-black text-gray-900 tracking-wide flex items-center gap-2">
                                    <CopyCell text={selectedCustomer.customerNameEn} className="text-gray-900 font-bold" />
                                    <CopyCell text={selectedCustomer.customerNameKh ? `(${selectedCustomer.customerNameKh})` : ''} copyValue={selectedCustomer.customerNameKh} className="text-xs text-emerald-600 font-khmer font-normal" />
                                </h3>

                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Activated
                                    </span>

                                    <span className="text-[10px] text-gray-500 font-bold">
                                        Contract: <CopyCell text={selectedCustomer.contractIid || selectedCustomer.contractId} className="text-gray-700 font-mono" />
                                    </span>

                                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <CopyCell text={selectedCustomer.brand || 'Device'} className="text-emerald-700 font-bold" />
                                    </span>
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
                                rounded-[5px]
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
                                        onClick={() => handleDirectExportPdf(selectedCustomer)}
                                        disabled={exportingCustomerPdfId === (selectedCustomer._id || selectedCustomer.contractId)}
                                        className="
                                group flex items-center gap-2
                                px-3 py-1
                                cursor-pointer
                                rounded-[5px]
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
                                            <MdPictureAsPdf className={`text-red-500 text-sm ${exportingCustomerPdfId === (selectedCustomer._id || selectedCustomer.contractId) ? 'animate-pulse' : ''}`} />
                                        </span>

                                        <span>{exportingCustomerPdfId === (selectedCustomer._id || selectedCustomer.contractId) ? 'Downloading...' : 'PDF Dossier'}</span>
                                    </button>

                                    {/* QR Profile */}
                                    <button
                                        onClick={() => handleOpenQrModal(selectedCustomer)}
                                        className="
                                group flex items-center gap-2
                                px-3 py-1
                                cursor-pointer
                                rounded-[5px]
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
                            rounded-[5px]
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
                            <div className="rounded-[20px] bg-white border border-gray-200 p-2 shadow-sm">

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
                                    rounded-[5px]
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

                                            <CopyCell
                                                text={value}
                                                className="
                                    font-semibold
                                    text-gray-900
                                    break-words
                                    leading-relaxed
                                "
                                            />
                                        </div>
                                    ))}

                                </div>
                            </div>

                            {/* ================= DEVICE DETAILS ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-2 shadow-sm">

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
                                        ['IMEI 1', formatIMEI(selectedCustomer.imei1), selectedCustomer.imei1],
                                        ['IMEI 2', formatIMEI(selectedCustomer.imei2), selectedCustomer.imei2],
                                        ['MEID', selectedCustomer.meid || '-'],
                                        ['Color', selectedCustomer.color || '-'],
                                        ['Storage / Version', `${selectedCustomer.capacity || '-'} / ${selectedCustomer.version || '-'}`],
                                    ].map(([label, value, rawVal]) => (

                                        <div
                                            key={label}
                                            className="
                                    p-2.5
                                    rounded-[5px]
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

                                            <CopyCell
                                                text={value}
                                                copyValue={rawVal || value}
                                                className={`
                                        font-semibold
                                        ${label === 'MEID'
                                                        ? 'text-gray-900 font-mono'
                                                        : label.includes('IMEI') || label.includes('Serial')
                                                            ? 'text-gray-900 font-mono'
                                                            : 'text-gray-900'
                                                    }
                                    `}
                                            />
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
                        p-2
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
                            p-2
                            bg-white
                            border border-amber-200
                            rounded-[5px]
                            text-xs
                            text-gray-700
                            font-medium
                            leading-relaxed
                            whitespace-pre-wrap
                        ">
                                        <CopyCell text={selectedCustomer.deviceProblem} className="text-gray-700 font-medium" />
                                    </div>
                                </div>
                            )}

                            {/* ================= LOAN TERMS ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-2 shadow-sm">

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
                                        [t('inputDate'), selectedCustomer.inputDate || '-'],
                                        ['Total Loan Amount', `$${totalLoan.toLocaleString()}`, totalLoan],
                                        ['Monthly Installment', `$${selectedCustomer.monthlyPayment}/mo`, selectedCustomer.monthlyPayment],
                                        ['Interest Rate', selectedCustomer.interest || '-'],
                                        ['Duration', selectedCustomer.duration || '-'],
                                    ].map(([label, value, rawVal]) => (

                                        <div
                                            key={label}
                                            className="
                                    p-2.5
                                    rounded-[5px]
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

                                            <CopyCell text={value} copyValue={rawVal || value} className="font-bold text-gray-900 font-mono" />
                                        </div>

                                    ))}

                                </div>
                            </div>

                            {/* ================= PAYMENT HISTORY ================= */}
                            <div className="rounded-[20px] bg-white border border-gray-200 p-2 shadow-sm">

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
                        p-2
                        bg-gray-50
                        border border-gray-200
                        rounded-[5px]
                    ">

                                    <div className="grid grid-cols-3 gap-3 mb-2 text-center">

                                        <div className="p-2 bg-white border border-gray-200 rounded-[5px]">
                                            <span className="text-gray-500 text-[10px] block">
                                                Total Loan
                                            </span>

                                            <CopyCell text={`$${totalLoan.toLocaleString()}`} copyValue={totalLoan} className="text-gray-900 font-mono font-bold text-sm" />
                                        </div>

                                        <div className="p-2 bg-white border border-gray-200 rounded-[5px]">
                                            <span className="text-gray-500 text-[10px] block">
                                                Total Paid So Far
                                            </span>

                                            <CopyCell text={`$${totalPaidSum.toLocaleString()}`} copyValue={totalPaidSum} className="text-emerald-600 font-mono font-bold text-sm" />
                                        </div>

                                        <div className="p-2 bg-white border border-gray-200 rounded-[5px]">
                                            <span className="text-gray-500 text-[10px] block">
                                                Remaining Balance
                                            </span>

                                            <CopyCell text={`$${remainingBalance.toLocaleString()}`} copyValue={remainingBalance} className="text-orange-600 font-mono font-bold text-sm" />
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
                        rounded-[5px]
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
                    rounded-[5px]
                    bg-white
                    border border-gray-200
                    p-2
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
                            p-2
                            rounded-[5px]
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
                            p-2
                            rounded-[5px]
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[999999] p-2">

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
                        rounded-[5px]
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
                bg-gray-50
                p-2
                rounded-[5px]
                border border-gray-200
                text-left
            ">
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
                p-2
                rounded-[5px]
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
                        p-2
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
                        rounded-[5px]
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
                        rounded-[5px]
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

            {/* Photo Gallery Modal for "See Photo" */}
            {photoGalleryCustomer && (() => {
                const photosList = (Array.isArray(photoGalleryCustomer.photos) && photoGalleryCustomer.photos.length > 0)
                    ? photoGalleryCustomer.photos
                    : (Array.isArray(photoGalleryCustomer.evidencePhotos) && photoGalleryCustomer.evidencePhotos.length > 0)
                        ? photoGalleryCustomer.evidencePhotos
                        : [photoGalleryCustomer.googleDrivePhotoUrl, photoGalleryCustomer.customerPhoto].filter(Boolean);
                const closeGallery = () => setPhotoGalleryCustomer(null);

                if (photosList.length > 0) {
                    const customerName = `${photoGalleryCustomer.customerNameEn || ''}${photoGalleryCustomer.customerNameKh ? ` (${photoGalleryCustomer.customerNameKh})` : ''}`;
                    const contractId = photoGalleryCustomer.contractIid || photoGalleryCustomer.contractId || '';
                    return (
                        <ImageGalleryModal
                            images={photosList}
                            index={photoGalleryIndex}
                            onIndexChange={setPhotoGalleryIndex}
                            onClose={closeGallery}
                            title={t('evidencePhotos')}
                            subtitle={`${customerName}${contractId ? ` · Contract: ${contractId}` : ''}`}
                        />
                    );
                }

                return (
                    <div className="fixed inset-0 z-[100000000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={closeGallery}>
                        <div role="dialog" aria-modal="true" className="max-w-[84vw] rounded-[5px] border border-slate-700 bg-slate-900 p-6 text-center text-slate-300 shadow-2xl" onClick={event => event.stopPropagation()}>
                            <FaFileImage className="mx-auto text-4xl text-slate-500" />
                            <p className="mt-3 text-xs font-semibold">គ្មានរូបភាពភស្តុតាងដែលបានភ្ជាប់សម្រាប់អតិថិជននេះទេ</p>
                            <p className="mt-1 text-[11px] text-slate-400">No evidence photos attached for this application.</p>
                            <button type="button" onClick={closeGallery} className="mt-4 rounded-[5px] bg-slate-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer hover:bg-slate-600 transition-colors">Close</button>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};

export default Customer;