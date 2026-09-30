import React, { useState, useEffect, useCallback } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineSync, MdPictureAsPdf, MdChevronLeft, MdChevronRight } from "react-icons/md";
import { FaFileExcel, FaImage, FaTimes, FaFilter } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import DateRangeDropdown from '../../../components/DateRangeDropdown';

const LIMIT = 10;

const PaymentHistory = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();

    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeDateFrom, setActiveDateFrom] = useState('');
    const [activeDateTo, setActiveDateTo] = useState('');

    // Image viewer modal — supports single image or gallery
    const [viewImages, setViewImages] = useState([]);  // array of image URLs
    const [viewImageIdx, setViewImageIdx] = useState(0); // current index

    const openImageViewer = (images, startIdx = 0) => {
        const arr = Array.isArray(images) ? images.filter(Boolean) : [images].filter(Boolean);
        if (!arr.length) return;
        setViewImages(arr);
        setViewImageIdx(startIdx);
    };
    const closeImageViewer = () => { setViewImages([]); setViewImageIdx(0); };

    const fetchPayments = useCallback(async (pg = 1, search = searchTerm, from = activeDateFrom, to = activeDateTo) => {
        setReloading(true);
        try {
            const pageToFetch = typeof pg === 'number' ? pg : 1;
            const params = new URLSearchParams({
                page: pageToFetch,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.set('search', search);
            if (from) params.set('dateFrom', from);
            if (to) params.set('dateTo', to);
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch payments error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, activeDateFrom, activeDateTo]);

    useEffect(() => { fetchPayments(page, searchTerm, activeDateFrom, activeDateTo); }, [page]);
    useEffect(() => { setPage(1); fetchPayments(1, searchTerm, activeDateFrom, activeDateTo); }, [searchTerm, activeDateFrom, activeDateTo]);

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchTerm(searchInput);
        setPage(1);
    };

    const handleApplyDateFilter = (from = dateFrom, to = dateTo) => {
        setDateFrom(from);
        setDateTo(to);
        setActiveDateFrom(from);
        setActiveDateTo(to);
        setPage(1);
    };

    const handleClearDateFilter = () => {
        setDateFrom('');
        setDateTo('');
        setActiveDateFrom('');
        setActiveDateTo('');
        setPage(1);
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (searchTerm) params.set('search', searchTerm);
            if (activeDateFrom) params.set('dateFrom', activeDateFrom);
            if (activeDateTo) params.set('dateTo', activeDateTo);
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all payments for export error:', err);
        }
        return payments;
    };

    const hasDateFilter = activeDateFrom || activeDateTo;

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((p, idx) => ({
            'No': idx + 1,
            'Payment ID': p.paymentId || '',
            'Contract ID': p.contractId || '',
            'Customer Name': p.customerName || '',
            'Model': p.model || '',
            'Serial Number': p.serialNumber || '',
            'Brand': p.brand || '',
            'Paid Date': p.paidDate || '',
            'Paid By': p.paidBy || '',
            'Amount ($)': p.amount || 0,
            'Description': p.description || ''
        }));
        exportToExcel(data, 'Payment_History_Report');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Payment ID', accessor: 'paymentId' },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Paid Date', accessor: 'paidDate' },
            { header: 'Paid By', accessor: 'paidBy' },
            { header: 'Amount ($)', cell: (r) => `$${r.amount}` }
        ];
        exportToPDF('Payment History Audit Report', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            {/* Image Viewer Modal — Gallery Support */}
            {viewImages.length > 0 && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm'
                    onClick={closeImageViewer}
                >
                    <div
                        className='relative bg-white rounded-[5px] shadow-2xl max-w-2xl w-full mx-4 overflow-hidden'
                        onClick={e => e.stopPropagation()}
                    >
                        <div className='flex items-center justify-between px-4 py-1 border-b border-slate-200 bg-slate-50'>
                            <span className='text-sm font-bold text-slate-700 flex items-center gap-2'>
                                <FaImage className='text-emerald-600' />
                                រូបភាពការបង់ប្រាក់
                                {viewImages.length > 1 && (
                                    <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300'>
                                        {viewImageIdx + 1} / {viewImages.length}
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={closeImageViewer}
                                className='p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-red-600 transition-colors cursor-pointer'
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className='relative p-4 flex items-center justify-center bg-slate-100 min-h-[300px]'>
                            {/* Prev button */}
                            {viewImages.length > 1 && viewImageIdx > 0 && (
                                <button
                                    onClick={() => setViewImageIdx(i => i - 1)}
                                    className='absolute left-2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md text-slate-700 hover:text-emerald-600 transition-all cursor-pointer z-10'
                                >
                                    <MdChevronLeft size={22} />
                                </button>
                            )}
                            <img
                                key={viewImageIdx}
                                src={viewImages[viewImageIdx]}
                                alt='payment receipt'
                                className='max-w-full max-h-[500px] object-contain rounded-lg shadow-md'
                            />
                            {/* Next button */}
                            {viewImages.length > 1 && viewImageIdx < viewImages.length - 1 && (
                                <button
                                    onClick={() => setViewImageIdx(i => i + 1)}
                                    className='absolute right-2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md text-slate-700 hover:text-emerald-600 transition-all cursor-pointer z-10'
                                >
                                    <MdChevronRight size={22} />
                                </button>
                            )}
                        </div>
                        {/* Thumbnail strip for multiple images */}
                        {viewImages.length > 1 && (
                            <div className='flex gap-2 px-4 py-1 bg-slate-50 border-t border-slate-200 overflow-x-auto'>
                                {viewImages.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setViewImageIdx(i)}
                                        className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                            i === viewImageIdx
                                                ? 'border-emerald-500 shadow-md'
                                                : 'border-slate-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <img src={img} alt={`thumb-${i}`} className='w-full h-full object-cover' />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col gap-3 shadow-xs'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <div>
                            <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                                {t('paymentHistory')}
                                {hasDateFilter && (
                                    <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300'>
                                        Filter Active
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>

                <div className='flex items-center gap-3'>
                    {hasPermission('/installment/payment-history', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex items-center gap-1">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('search')}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-44 font-medium outline-none shadow-xs"
                        />
                        <button type="submit" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs">
                            Go
                        </button>
                        {searchTerm && (
                            <button type="button" onClick={() => { setSearchTerm(''); setSearchInput(''); }} className="px-2 py-1.5 text-slate-400 hover:text-red-600 text-xs cursor-pointer font-bold">✕</button>
                        )}
                    </form>

                </div>
                </div>

                {/* Date Range Filter Row */}
                <div className='flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100'>
                    <div className='flex items-center gap-1.5 text-xs font-bold text-slate-500'>
                        <FaFilter className='text-slate-400 text-[10px]' />
                        <span>Filter ថ្ងៃ:</span>
                    </div>
                    <DateRangeDropdown
                        from={dateFrom}
                        to={dateTo}
                        onApplyRange={handleApplyDateFilter}
                        onClear={handleClearDateFilter}
                    />
                    {hasDateFilter && (
                        <span className='text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-[4px]'>
                            {activeDateFrom || '...'} → {activeDateTo || '...'}
                        </span>
                    )}
                </div>
            </header>

            {/* Payment History Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-310px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>{t('paidDate')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')} & Serial</th>
                            <th className='px-4 py-1'>Brand</th>
                            <th className='px-4 py-1'>{t('paidBy')}</th>
                            <th className='px-4 py-1 text-right'>{t('amount')}</th>
                            <th className='px-4 py-1 text-center'>រូបភាព</th>
                            <th className='px-4 py-1'>{t('description')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-8 text-slate-500 italic font-medium">
                                    No payment history records found.
                                </td>
                            </tr>
                        ) : (
                            payments.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'>{item.paidDate}</td>
                                    <td className='px-4 py-1'>
                                        <div className="flex items-center gap-2.5">
                                            {/* {item.photo ? (
                                                <img src={item.photo} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[10px] font-bold text-emerald-700">PAY</div>
                                            )} */}
                                            <span className='font-bold text-slate-900'>{item.customerName}</span>
                                        </div>
                                    </td>
                                    <td className='px-4 py-1'>
                                        <span className='text-slate-900 font-semibold block'>{item.model}</span>
                                        <span className='text-slate-500 font-mono text-[11px] block'>{item.serialNumber}</span>
                                    </td>
                                    <td className='px-4 py-1'>
                                        {item.brand ? (
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span>
                                        ) : <span className="text-slate-400 text-[10px]">-</span>}
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-700'>{item.paidBy}</td>
                                    <td className='px-4 py-1 text-right font-bold text-emerald-700 font-mono text-sm'>
                                        ${Number(item.amount).toLocaleString()}
                                    </td>
                                    {/* Image Column */}
                                    <td className='px-4 py-1 text-center'>
                                        {(() => {
                                            // Gather all image sources: paymentImages array + single fields
                                            const imgs = [
                                                ...(Array.isArray(item.paymentImages) ? item.paymentImages : []),
                                                item.image,
                                                item.photo,
                                                item.receiptImage
                                            ].filter(Boolean);
                                            const unique = [...new Set(imgs)];
                                            if (unique.length === 0) return <span className='text-slate-300 text-[10px]'>—</span>;
                                            return (
                                                <button
                                                    onClick={() => openImageViewer(unique, 0)}
                                                    className='inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all'
                                                    title='មើលរូបភាព'
                                                >
                                                    <FaImage className='text-emerald-600' />
                                                    <span>មើល{unique.length > 1 ? ` (${unique.length})` : ''}</span>
                                                </button>
                                            );
                                        })()}
                                    </td>
                                    <td className='px-4 py-1 text-slate-600 text-[11px] font-medium'>{item.description || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {/* Grand Total Footer */}
                    {!loading && payments.length > 0 && (
                        <tfoot>
                            <tr className='bg-emerald-50 border-t-2 border-emerald-300'>
                                <td colSpan={6} className='px-4 py-1 text-right text-xs font-black text-slate-700 uppercase tracking-wider'>
                                    សរុបទំព័រនេះ ({payments.length} records):
                                </td>
                                <td className='px-4 py-1 text-right font-black text-emerald-800 font-mono text-sm'>
                                    ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td colSpan={2} className='px-4 py-1'></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={LIMIT}
                onPageChange={setPage}
            />
        </div>
    );
};

export default PaymentHistory;
