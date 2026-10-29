import React, { useState, useEffect, useCallback } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import InstallmentSubBrandFilter, {
    addInstallmentSubBrandParams,
    useInstallmentSubBrand
} from '../components/InstallmentSubBrandFilter';
import { MdOutlineSync, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel, FaImage, FaFilter, FaEdit, FaTrashAlt, FaTimes, FaSave, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import DateRangeDropdown from '../../../components/DateRangeDropdown';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import ImageGalleryModal from '../../../components/ImageGalleryModal';

const LIMIT = 10;
const DEFAULT_PAYMENT_METHODS = ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'];

const PaymentHistory = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();
    const { availableSubBrands, selectedSubBrand, setSelectedSubBrand } = useInstallmentSubBrand(user);

    // Check if the logged-in user is Master Admin / Big Admin
    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin' ||
        hasPermission('/installment/paymentHistory', 'edit')
    );

    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeDateFrom, setActiveDateFrom] = useState('');
    const [activeDateTo, setActiveDateTo] = useState('');

    // Image viewer modal — supports single image or gallery
    const [viewImages, setViewImages] = useState([]);
    const [viewImageIdx, setViewImageIdx] = useState(0);

    // Edit modal states for Master Admin
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
    const [editForm, setEditForm] = useState({
        paidDate: '',
        amount: '',
        customerName: '',
        contractId: '',
        model: '',
        serialNumber: '',
        brand: '',
        paidBy: '',
        description: '',
        receiptImage: ''
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        if (!editModalOpen) return;

        const brand = editingPayment?.brand || user?.brand || '';
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
        fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load payment methods');
                return res.json();
            })
            .then(data => {
                const methods = data?.droplists?.find(item => item.category === 'Payment Methods')?.items;
                if (!Array.isArray(methods)) return;
                const validMethods = methods.filter(method => typeof method === 'string' && method.trim());
                if (validMethods.length > 0) setPaymentMethods(validMethods);
            })
            .catch(err => console.error('Fetch payment methods error:', err));
    }, [API_BASE1, editModalOpen, editingPayment?.brand, user?.brand]);

    const openImageViewer = (images, startIdx = 0) => {
        const arr = Array.isArray(images) ? images.filter(Boolean) : [images].filter(Boolean);
        if (!arr.length) return;
        setViewImages(arr);
        setViewImageIdx(startIdx);
    };
    const closeImageViewer = () => { setViewImages([]); setViewImageIdx(0); };

    const fetchPayments = useCallback(async (pg = 1, search = searchTerm, from = activeDateFrom, to = activeDateTo) => {
        setReloading(true);
        setFetchError('');
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
            addInstallmentSubBrandParams(params, user, selectedSubBrand);
            if (search) params.set('search', search);
            if (from) params.set('dateFrom', from);
            if (to) params.set('dateTo', to);
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || t('paymentHistoryLoadFailed'));
            setPayments(Array.isArray(data.data) ? data.data : []);
            setTotal(Number(data.total) || 0);
        } catch (err) {
            console.error('Fetch payments error:', err);
            setFetchError(err.message || t('paymentHistoryLoadFailed'));
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, activeDateFrom, activeDateTo, searchTerm, t, selectedSubBrand]);

    useEffect(() => {
        if (selectedRecord) return;
        fetchPayments(page, searchTerm, activeDateFrom, activeDateTo);
    }, [page, searchTerm, activeDateFrom, activeDateTo, fetchPayments, selectedRecord]);

    const visiblePayments = selectedRecord ? [selectedRecord] : payments;
    const totalPaid = visiblePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const handleApplyDateFilter = (from = dateFrom, to = dateTo) => {
        setSelectedRecord(null);
        setDateFrom(from);
        setDateTo(to);
        setActiveDateFrom(from);
        setActiveDateTo(to);
        setPage(1);
    };

    const handleClearDateFilter = () => {
        setSelectedRecord(null);
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
            addInstallmentSubBrandParams(params, user, selectedSubBrand);
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

    const handleExportPDF = async (orientation = 'portrait') => {
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
        exportToPDF('Payment History Audit Report', columns, allData, user?.brand || '', orientation);
    };

    // Open Edit Modal for a specific payment
    const openEditModal = (item) => {
        setEditingPayment(item);
        setEditForm({
            paidDate: item.paidDate || new Date().toISOString().split('T')[0],
            amount: item.amount !== undefined ? String(item.amount) : '',
            customerName: item.customerName || '',
            contractId: item.contractId || '',
            model: item.model || '',
            serialNumber: item.serialNumber || '',
            brand: item.brand || '',
            paidBy: item.paidBy || '',
            description: item.description || '',
            receiptImage: item.receiptImage || item.image || item.photo || (item.paymentImages?.[0] || '')
        });
        setEditError('');
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditingPayment(null);
        setEditError('');
    };

    // Submit Edit
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingPayment) return;
        setSavingEdit(true);
        setEditError('');

        try {
            const id = editingPayment._id || editingPayment.paymentId;
            const payload = {
                ...editForm,
                amount: Number(editForm.amount) || 0,
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            };

            const res = await fetch(`${API_BASE1}/payments/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || t('paymentRecordUpdateFailed'));
            }

            const updated = data.payment;
            setPayments(prev => prev.map(p => (
                ((p._id && p._id === updated._id) || (p.paymentId && p.paymentId === updated.paymentId)) ? updated : p
            )));

            if (selectedRecord && ((selectedRecord._id && selectedRecord._id === updated._id) || (selectedRecord.paymentId && selectedRecord.paymentId === updated.paymentId))) {
                setSelectedRecord(updated);
            }

            setActionMessage(t('paymentRecordUpdated').replace('{customer}', updated.customerName));
            setTimeout(() => setActionMessage(''), 4000);
            closeEditModal();
        } catch (err) {
            console.error('Save edit error:', err);
            setEditError(err.message || t('paymentRecordUpdateFailed'));
        } finally {
            setSavingEdit(false);
        }
    };

    // Delete Payment (Master Admin only)
    const handleDeletePayment = async (item) => {
        const id = item._id || item.paymentId;
        if (!id) return;
        const confirmed = window.confirm(
            t('paymentConfirmDelete').replace('{amount}', item.amount).replace('{customer}', item.customerName)
        );
        if (!confirmed) return;

        setDeletingId(id);
        try {
            const res = await fetch(`${API_BASE1}/payments/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userRole: user?.role || '',
                    username: user?.username || '',
                    isImmutable: user?.isImmutable ? 'true' : 'false'
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || t('paymentRecordDeleteFailed'));
            }

            setPayments(prev => prev.filter(p => p._id !== id && p.paymentId !== id));
            if (selectedRecord && (selectedRecord._id === id || selectedRecord.paymentId === id)) {
                setSelectedRecord(null);
            }
            setTotal(prev => Math.max(0, prev - 1));
            setActionMessage(t('paymentRecordDeleted'));
            setTimeout(() => setActionMessage(''), 4000);
        } catch (err) {
            alert(err.message || t('paymentRecordDeleteFailed'));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            {/* Image Viewer Modal — Gallery Support */}
            {viewImages.length > 0 && (
                <ImageGalleryModal
                    images={viewImages}
                    index={viewImageIdx}
                    onIndexChange={setViewImageIdx}
                    onClose={closeImageViewer}
                    title={t('paymentReceipts')}
                />
            )}

            {/* Notification alert banner */}
            {actionMessage && (
                <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                        <FaCheckCircle className="text-emerald-600 text-sm" />
                        <span>{actionMessage}</span>
                    </div>
                    <button type="button" onClick={() => setActionMessage('')} className="text-slate-400 hover:text-slate-600">
                        <FaTimes />
                    </button>
                </div>
            )}

            {/* Header */}
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col gap-3 shadow-xs'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <div>
                            <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                                {t('paymentHistory')}
                                {hasDateFilter && (
                                    <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300'>
                                        {t('filterActive')}
                                    </span>
                                )}
                                {isMasterAdmin && (
                                    <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300'>
                                        {t('paymentAdminEditMode')}
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>

                    <div className='flex items-center gap-3'>
                        <InstallmentSubBrandFilter
                            availableSubBrands={availableSubBrands}
                            selectedSubBrand={selectedSubBrand}
                            onChange={setSelectedSubBrand}
                            t={t}
                        />
                        {hasPermission('/installment/paymentHistory', 'export') && (
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        )}

                        {/* Search */}
                        <DatabaseSearchInput
                            apiBase={API_BASE1}
                            endpoint="payments"
                            params={{
                                userBrand: user?.brand || '',
                                userRole: user?.role || '',
                                username: user?.username || '',
                                isImmutable: user?.isImmutable ? 'true' : 'false',
                                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : '',
                                ...(selectedSubBrand ? { subBrand: selectedSubBrand } : {}),
                                ...(activeDateFrom ? { dateFrom: activeDateFrom } : {}),
                                ...(activeDateTo ? { dateTo: activeDateTo } : {})
                            }}
                            value={searchTerm}
                            placeholder={t('search')}
                            className="w-44"
                            onChange={(value) => {
                                setSelectedRecord(null);
                                setFetchError('');
                                setSearchTerm(value);
                                setPage(1);
                            }}
                            onSelect={(record) => {
                                setFetchError('');
                                setSelectedRecord(record);
                                setLoading(false);
                                setSearchTerm(record.customerName || record.contractId || record.paymentId || record._id || '');
                                setPayments([record]);
                                setTotal(1);
                                setPage(1);
                            }}
                            getLabel={(record) => record.customerName || record.contractId || record.paymentId || record._id}
                            getDescription={(record) => [record.model, record.serialNumber, record.paidDate, record.amount && `$${record.amount}`].filter(Boolean).join(' · ')}
                        />
                    </div>
                </div>

                {/* Date Range Filter Row */}
                <div className='flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100'>
                    <div className='flex items-center gap-1.5 text-xs font-bold text-slate-500'>
                        <FaFilter className='text-slate-400 text-[10px]' />
                        <span>{t('filterByDate')}:</span>
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
                            <th className='px-4 py-1 text-center'>{t('no')}</th>
                            <th className='px-4 py-1'>{t('paidDate')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')} & {t('serialNumber')}</th>
                            <th className='px-4 py-1'>{t('brand')}</th>
                            <th className='px-4 py-1'>{t('paidBy')}</th>
                            <th className='px-4 py-1 text-right'>{t('amount')}</th>
                            <th className='px-4 py-1 text-center'>{t('images')}</th>
                            <th className='px-4 py-1'>{t('description')}</th>
                            {isMasterAdmin && <th className='px-4 py-1 text-center'>{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr>
                                <td colSpan={isMasterAdmin ? 10 : 9} className="text-center py-10 text-emerald-600 font-semibold">
                                    {t('loading')}
                                </td>
                            </tr>
                        ) : fetchError ? (
                            <tr>
                                <td colSpan={isMasterAdmin ? 10 : 9} className="text-center py-8 text-rose-600 font-semibold">
                                    {fetchError}
                                </td>
                            </tr>
                        ) : visiblePayments.length === 0 ? (
                            <tr>
                                <td colSpan={isMasterAdmin ? 10 : 9} className="text-center py-8 text-slate-500 italic font-medium">
                                    {t('noPaymentHistoryRecords')}
                                </td>
                            </tr>
                        ) : (
                            visiblePayments.map((item, idx) => (
                                <tr key={item._id || item.paymentId || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{total - ((page - 1) * LIMIT + idx)}</td>
                                    <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'>{item.paidDate}</td>
                                    <td className='px-4 py-1'>
                                        <div className="flex flex-col">
                                            <span className='font-bold text-slate-900'>{item.customerName}</span>
                                            {item.contractId && (
                                                <span className='text-[10px] text-slate-400 font-mono'>#{item.contractId}</span>
                                            )}
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
                                        ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    {/* Image Column */}
                                    <td className='px-4 py-1 text-center'>
                                        {(() => {
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
                                                    title={t('viewImages')}
                                                >
                                                    <FaImage className='text-emerald-600' />
                                                    <span>{t('view')}{unique.length > 1 ? ` (${unique.length})` : ''}</span>
                                                </button>
                                            );
                                        })()}
                                    </td>
                                    <td className='px-4 py-1 text-slate-600 text-[11px] font-medium'>{item.description || '-'}</td>

                                    {/* Master Admin Actions (Edit & Delete) */}
                                    {isMasterAdmin && (
                                        <td className='px-4 py-1 text-center'>
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[11px] font-bold transition-all shadow-2xs hover:scale-105"
                                                    title={t('editPayment')}
                                                >
                                                    <FaEdit className="text-amber-600" />
                                                    <span>{t('edit')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePayment(item)}
                                                    disabled={deletingId === (item._id || item.paymentId)}
                                                    className="inline-flex items-center p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[11px] font-bold transition-all disabled:opacity-50 hover:scale-105"
                                                    title={t('deletePayment')}
                                                >
                                                    <FaTrashAlt />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                    {/* Grand Total Footer */}
                    {!loading && visiblePayments.length > 0 && (
                        <tfoot>
                            <tr className='bg-emerald-50 border-t-2 border-emerald-300'>
                                <td colSpan={6} className='px-4 py-1 text-right text-xs font-black text-slate-700 uppercase tracking-wider'>
                                    {t('paymentPageTotal').replace('{count}', visiblePayments.length)}
                                </td>
                                <td className='px-4 py-1 text-right font-black text-emerald-800 font-mono text-sm'>
                                    ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td colSpan={isMasterAdmin ? 3 : 2} className='px-4 py-1'></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {!selectedRecord && (
                <Pagination
                    currentPage={page}
                    totalItems={total}
                    itemsPerPage={LIMIT}
                    onPageChange={setPage}
                />
            )}

            {/* MASTER ADMIN EDIT PAYMENT MODAL */}
            {editModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs"
                    onClick={closeEditModal}
                >
                    <div
                        className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 text-white">
                            <div className="flex items-center gap-2">
                                <span className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
                                    <FaEdit size={16} />
                                </span>
                                <div>
                                    <h3 className="text-sm font-bold">{t('editPayment')}</h3>
                                    <p className="text-[11px] text-slate-300">
                                        {t('paymentIdLabel')}: <span className="font-mono text-amber-300">{editingPayment?.paymentId || editingPayment?._id}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveEdit} className="overflow-y-auto p-5 space-y-4 text-xs">
                            {editError && (
                                <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-rose-700">
                                    <FaExclamationCircle className="shrink-0" />
                                    <span>{editError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Paid Date */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('paidDate')} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={editForm.paidDate}
                                        onChange={e => setEditForm(prev => ({ ...prev, paidDate: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('amount')} ($) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required
                                            value={editForm.amount}
                                            onChange={e => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Customer Name */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('customerName')} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.customerName}
                                        onChange={e => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                                        placeholder={t('customerName')}
                                    />
                                </div>

                                {/* Contract ID */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('contract')} ID
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.contractId}
                                        onChange={e => setEditForm(prev => ({ ...prev, contractId: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                                        placeholder={t('contractIdPlaceholder')}
                                    />
                                </div>

                                {/* Model */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('model')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.model}
                                        onChange={e => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                                        placeholder={t('deviceModelPlaceholder')}
                                    />
                                </div>

                                {/* Serial Number / IMEI */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('serialNumber')} / IMEI
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.serialNumber}
                                        onChange={e => setEditForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                                        placeholder={t('serialNumber')}
                                    />
                                </div>

                                {/* Brand */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('brand')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.brand}
                                        onChange={e => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                        placeholder={t('brand')}
                                    />
                                </div>

                                {/* Paid By */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        {t('paidBy')}
                                    </label>
                                    <select
                                        value={editForm.paidBy}
                                        onChange={e => setEditForm(prev => ({ ...prev, paidBy: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    >
                                        {!paymentMethods.includes(editForm.paidBy) && editForm.paidBy && (
                                            <option value={editForm.paidBy}>{editForm.paidBy}</option>
                                        )}
                                        {paymentMethods.map((method, index) => (
                                            <option key={`${method}-${index}`} value={method}>{method}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Receipt Image URL */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    {t('receiptImageUrl')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={editForm.receiptImage}
                                        onChange={e => setEditForm(prev => ({ ...prev, receiptImage: e.target.value }))}
                                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                                        placeholder={t('receiptImageUrlPlaceholder')}
                                    />
                                    {editForm.receiptImage && (
                                        <button
                                            type="button"
                                            onClick={() => openImageViewer(editForm.receiptImage)}
                                            className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold"
                                        >
                                            មើលរូប
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Description / Remarks */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    {t('description')}
                                </label>
                                <textarea
                                    rows="2"
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    placeholder={t('description')}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={closeEditModal}
                                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all"
                                >
                                    {savingEdit ? (
                                        <>
                                            <MdOutlineSync className="animate-spin text-sm" />
                                            <span>{t('saving')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <FaSave />
                                            <span>{t('saveChanges')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentHistory;
