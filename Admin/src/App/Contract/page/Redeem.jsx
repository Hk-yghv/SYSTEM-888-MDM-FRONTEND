import React, { useState, useEffect } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdPictureAsPdf, MdSwapHoriz, MdComment, MdDateRange } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import CreateApplication from '../components/CreateApplication';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

import RepaymentScheduleModal from '../components/RepaymentScheduleModal';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import { getKhmerCurrentDateString } from '../../../utils/khmerDateUtils';

const Redeem = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 10;
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);
    const [selectedCommentItem, setSelectedCommentItem] = useState(null);
    const [commentInput, setCommentInput] = useState('');
    const [commentSaving, setCommentSaving] = useState(false);
    const [commentFeedback, setCommentFeedback] = useState(null);

    // Repayment Schedule Modal State
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleModalContract, setScheduleModalContract] = useState(null);

    const fetchRedeemContracts = async (pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Redeem&page=${pg}&limit=${LIMIT}${brandParam}${searchParam}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch redeem error:', err);
        } finally {
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchRedeemContracts(page, searchTerm); }, [page, searchTerm, API_BASE1, user]);

    const handleRestoreToActivated = async (item) => {
        if (!window.confirm(t('contractMoveToActivatedConfirm').replace('{customer}', item.customerNameEn))) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Activated' })
            });
            if (res.ok) {
                fetchRedeemContracts();
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Restore to Activated error:', err);
        }
    };

    const handleSaveComment = async (event) => {
        event.preventDefault();
        if (!selectedCommentItem || !commentInput.trim()) return;

        setCommentSaving(true);
        setCommentFeedback(null);
        try {
            const response = await fetch(`${API_BASE1}/contracts/${selectedCommentItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redeemComment: commentInput.trim(),
                    lastModifiedBy: user?.username || 'Staff'
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || result.message || t('saveCommentFailed'));
            }

            if (selectedSearchRecord?._id === selectedCommentItem._id && result?._id) {
                setSelectedSearchRecord(result);
            }
            setSelectedCommentItem(null);
            setCommentInput('');
            setCommentFeedback({ type: 'success', text: t('commentSaved') });
            fetchRedeemContracts();
        } catch (error) {
            setCommentFeedback({ type: 'error', text: error.message || t('saveCommentFailed') });
        } finally {
            setCommentSaving(false);
        }
    };

    const handleAppendCommentDate = () => {
        const dateText = getKhmerCurrentDateString();
        setCommentInput((current) => {
            const trimmed = current.trim();
            return trimmed.endsWith(dateText) ? trimmed : [trimmed, dateText].filter(Boolean).join(' ');
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('redeemDeleteConfirm'))) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) fetchRedeemContracts();
        } catch (err) { }
    };

    const fetchAllForExport = async () => {
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const searchParam = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Redeem&page=1&limit=999999${brandParam}${searchParam}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all redeem for export error:', err);
        }
        return contracts;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((c, idx) => ({
            'No': idx + 1,
            'Name (EN)': c.customerNameEn || '',
            'Name (KH)': c.customerNameKh || '',
            'ID Card': c.idCardNumber || '',
            'DOB': c.dob || '',
            'Gender': c.gender || '',
            'Phone': c.phone || '',
            'Device Model': c.model || '',
            'Serial Number': c.serialNumber || '',
            'Total Amount ($)': c.amount || c.totalAmount || 0,
            'Monthly ($)': c.monthlyPayment || 0,
            'Input Date': c.inputDate || '',
            'Status': c.status || 'Redeem',
        }));
        exportToExcel(data, 'Redeem_Contracts');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Monthly ($)', cell: (r) => `$${r.monthlyPayment}` },
        ];
        exportToPDF('Redeem Contracts Directory', columns, allData, user?.brand || '', orientation);
    };

    const visibleContracts = selectedSearchRecord ? [selectedSearchRecord] : contracts;

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4 relative'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div>
                    <h1 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                        <span>{t('redeem')}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <DatabaseSearchInput
                        apiBase={API_BASE1}
                        endpoint="/contracts"
                        params={{
                            status: 'Redeem',
                            ...(user?.brand ? {
                                userBrand: user.brand,
                                userRole: user?.role || '',
                                username: user?.username || '',
                                isImmutable: user?.isImmutable ? 'true' : 'false'
                            } : {})
                        }}
                        value={searchTerm}
                        placeholder={t('searchCustomerModelSerial')}
                        onChange={(value) => {
                            setSelectedSearchRecord(null);
                            setPage(1);
                            setSearchTerm(value);
                        }}
                        onSelect={(record) => {
                            setSelectedSearchRecord(record);
                            setPage(1);
                        }}
                        className="w-64"
                    />
                    {hasPermission('/contract/redeem', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}
                </div>
            </header>

            {commentFeedback && (
                <div
                    role="status"
                    className={`rounded-md border px-3 py-2 text-sm ${
                        commentFeedback.type === 'error'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                >
                    {commentFeedback.text}
                </div>
            )}

            <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>{t('no')}</th>
                            <th className='px-4 py-1'>{t('redeem')} {t('date')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1 text-center'>{t('status')}</th>
                            <th className='px-4 py-1 text-center'>{t('contract')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('commentLabel')}</th>
                            <th className='px-4 py-1 text-center'>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {visibleContracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">{t('noRedeemContracts')}</td>
                            </tr>
                        ) : (
                            visibleContracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{total - ((selectedSearchRecord ? 0 : (page - 1) * LIMIT) + idx)}</td>
                                    <td className='px-4 py-1 font-mono text-purple-700 font-bold'>
                                        <CopyCell text={item.redeemDate || item.inputDate || ''} className='font-mono text-purple-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-1'>
                                        <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                        {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                    </td>
                                    <td className='px-4 py-1 text-center'>
                                        <span className='px-3 py-1 bg-purple-50 text-purple-800 border border-purple-300 rounded-full font-bold text-[10px] uppercase'>{t('redeem')}</span>
                                    </td>
                                    <td className='px-4 py-1 text-center font-mono text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-mono font-bold text-indigo-700' />
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 text-slate-600'>
                                        <p
                                            className='line-clamp-2 max-w-[260px] whitespace-pre-wrap break-words'
                                            title={item.redeemComment || item.notes || ''}
                                        >
                                            {item.redeemComment?.trim() || item.notes?.trim() || '—'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-1 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs">
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-[5px] shadow-xl z-[99999] p-2 space-y-1 animate-in fade-in duration-150">
                                                    <button
                                                        onClick={() => { setScheduleModalContract(item); setScheduleModalOpen(true); setOpenMenuId(null); }}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <FaFileExcel className="text-indigo-600 text-sm" /> View Schedule ($)
                                                    </button>
                                                    {hasPermission('/contract/redeem', 'comment') && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCommentItem(item);
                                                                setCommentInput(item.redeemComment || item.notes || '');
                                                                setCommentFeedback(null);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50 rounded-[5px] flex items-center gap-2"
                                                        >
                                                            <MdComment className="text-cyan-600 text-base" />
                                                            {item.redeemComment?.trim() || item.notes?.trim() ? t('edit') : t('comments')}
                                                        </button>
                                                    )}
                                                    {(user?.isImmutable || user?.username === '@hakyonghouv') && (
                                                        <button
                                                            onClick={() => handleRestoreToActivated(item)}
                                                            className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <MdSwapHoriz className="text-emerald-600 text-base" />
                                                            <span>{t('moveToActivated')}</span>
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/redeem', 'edit') && (
                                                        <button onClick={() => { setEditData(item); setOpenEditModal(true); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2">
                                                            <MdEdit className="text-amber-600" /> {t('edit')}
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/redeem', 'delete') && (
                                                        <button onClick={() => handleDelete(item._id)} className="w-full text-left px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-[5px] flex items-center gap-2">
                                                            <MdDelete className="text-red-600" /> {t('delete')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={selectedSearchRecord ? 1 : total} itemsPerPage={LIMIT} onPageChange={setPage} />

            <CreateApplication open={openEditModal} setOpen={setOpenEditModal} editData={editData} onSaved={fetchRedeemContracts} />

            <RepaymentScheduleModal
                open={scheduleModalOpen}
                setOpen={setScheduleModalOpen}
                contract={scheduleModalContract}
                mode="read_only"
            />

            {selectedCommentItem && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
                    <form onSubmit={handleSaveComment} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                                <MdComment className="text-cyan-600" />
                                {selectedCommentItem.redeemComment?.trim() || selectedCommentItem.notes?.trim()
                                    ? t('edit')
                                    : t('activatedAddCommentNote')}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setSelectedCommentItem(null)}
                                disabled={commentSaving}
                                aria-label={t('cancel')}
                                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            >
                                ×
                            </button>
                        </div>

                        <div className="rounded-md bg-slate-50 p-3 text-xs">
                            <p className="text-slate-500">{t('customerName')}: <span className="font-bold text-slate-800">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="mt-1 text-slate-500">{t('model')}: <span className="font-semibold text-slate-700">{selectedCommentItem.model}</span></p>
                        </div>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('activatedEnterCommentNote')}</span>
                            <textarea
                                autoFocus
                                required
                                rows={4}
                                maxLength={3000}
                                value={commentInput}
                                onChange={(event) => setCommentInput(event.target.value)}
                                placeholder={t('activatedCommentPlaceholder')}
                                className="w-full rounded-md border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                            />
                        </label>

                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleAppendCommentDate}
                                disabled={commentSaving}
                                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <MdDateRange />
                                {t('inputCommentDate')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCommentItem(null)}
                                disabled={commentSaving}
                                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={commentSaving || !commentInput.trim()}
                                className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {commentSaving && <MdOutlineSync className="animate-spin" />}
                                {t('save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Redeem;
