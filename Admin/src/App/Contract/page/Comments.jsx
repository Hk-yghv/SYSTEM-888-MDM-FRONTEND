import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdComment, MdInfo, MdDateRange } from "react-icons/md";
import { FaHistory, FaPlus } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import { getCambodiaDateInputValue, getKhmerCurrentDateString, hasActiveCommentToday } from '../../../utils/khmerDateUtils';

const Comments = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [contracts, setContracts] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 10;
    const [openMenuId, setOpenMenuId] = useState(null);
    const [selectedInfo, setSelectedInfo] = useState(null);
    const [selectedCommentItem, setSelectedCommentItem] = useState(null);
    const [commentInput, setCommentInput] = useState('');
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [commentSaving, setCommentSaving] = useState(false);
    const [isDateAppended, setIsDateAppended] = useState(false);
    const [commentExpiryMode, setCommentExpiryMode] = useState('1day');
    const [commentExpiryDate, setCommentExpiryDate] = useState('');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);
    const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);

    const isMasterAdmin = user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        ['administrator', 'admin'].includes(String(user?.role || '').toLowerCase());

    const fetchCommentsContracts = async (pg = page, search = searchTerm) => {
        try {
            const params = new URLSearchParams({
                status: 'Comments',
                page: String(pg),
                limit: String(LIMIT),
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
            });
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch comments error:', err);
        }
    };

    useEffect(() => { fetchCommentsContracts(page, searchTerm); }, [page, searchTerm, API_BASE1, user]);

    useEffect(() => {
        const commentId = searchParams.get('addComment');
        if (!commentId || !contracts.length) return;
        const contract = contracts.find(item => String(item._id) === commentId || item.contractId === commentId);
        if (!contract) return;
        setSelectedCommentItem(contract);
        setCommentInput('');
        setIsAddingComment(true);
        setIsDateAppended(false);
        setCommentExpiryMode('1day');
        setCommentExpiryDate('');
        setEditingHistoryEntry(null);
        setSelectedHistoryItem(null);
        setSearchParams(current => {
            const next = new URLSearchParams(current);
            next.delete('addComment');
            return next;
        }, { replace: true });
    }, [contracts, searchParams, setSearchParams]);

    const formatCommentDate = (dateValue, fallback = '') => {
        if (!dateValue) return fallback || '—';
        const date = new Date(dateValue);
        return Number.isNaN(date.getTime()) ? String(dateValue) : date.toLocaleString();
    };

    const handleAppendDate = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const dateText = getKhmerCurrentDateString();
        setCommentInput(prev => {
            const trimmed = (prev || '').trim();
            if (!trimmed) return dateText;
            if (trimmed.endsWith(dateText)) return trimmed;
            return `${trimmed} ${dateText}`;
        });
        setIsDateAppended(true);
    };

    const openCommentEditor = (contract, append = false) => {
        setSelectedCommentItem(contract);
        const activeToday = hasActiveCommentToday(contract);
        const isCreating = append || !activeToday;
        setCommentInput(isCreating ? '' : (contract.notes || ''));
        setIsAddingComment(isCreating);
        setEditingHistoryEntry(null);
        setIsDateAppended(!isCreating);
        const expiryMode = isCreating
            ? '1day'
            : (['1day', 'date', 'never'].includes(contract.commentExpiryMode) ? contract.commentExpiryMode : '1day');
        setCommentExpiryMode(expiryMode);
        setCommentExpiryDate(expiryMode === 'date' && contract.commentExpiresAt
            ? getCambodiaDateInputValue(contract.commentExpiresAt)
            : '');
    };

    const handleSaveComment = async (event) => {
        event.preventDefault();
        if (!selectedCommentItem) return;
        setCommentSaving(true);
        try {
            const isHistoryEdit = Boolean(editingHistoryEntry);
            if (!isHistoryEdit && commentExpiryMode === 'date' && !commentExpiryDate) {
                throw new Error(t('commentExpiryDateRequired'));
            }
            const url = isHistoryEdit
                ? `${API_BASE1}/contracts/${selectedCommentItem._id}/comment-history/${editingHistoryEntry._id}`
                : `${API_BASE1}/contracts/${selectedCommentItem._id}`;
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isHistoryEdit
                    ? { comment: commentInput }
                    : {
                        notes: commentInput,
                        lastModifiedBy: user?.username || 'Staff',
                        appendComment: isAddingComment,
                        commentExpiryMode,
                        commentExpiryDate: commentExpiryMode === 'date' ? commentExpiryDate : undefined
                    })
            });
            if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                throw new Error(result.error || `Failed to save comment (${res.status})`);
            }
            const updated = await res.json();
            if (selectedHistoryItem) setSelectedHistoryItem(updated);
            setSelectedCommentItem(null);
            setEditingHistoryEntry(null);
            setIsAddingComment(false);
            setIsDateAppended(false);
            setCommentInput('');
            await fetchCommentsContracts(page, searchTerm);
        } catch (err) {
            console.error('Save contract comment error:', err);
            window.alert(err.message || t('saveCommentFailed'));
        } finally {
            setCommentSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('confirmDelete'))) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCommentsContracts();
        } catch (err) { }
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                status: 'Comments',
                page: '1',
                limit: '999999',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
            });
            if (searchTerm.trim()) params.set('search', searchTerm.trim());
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all comments for export error:', err);
        }
        return contracts;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((c, idx) => ({
            'No': idx + 1,
            'Name (EN)': c.customerNameEn || '',
            'Name (KH)': c.customerNameKh || '',
            'Phone': c.phone || '',
            'Device Model': c.model || '',
            'Serial Number': c.serialNumber || '',
            'Comment Note': hasActiveCommentToday(c) ? c.notes : 'No comment provided',
            'Comment Date': hasActiveCommentToday(c) ? formatCommentDate(c.commentDate, c.inputDate || '') : '—',
            'Status': c.status || 'Comments',
        }));
        exportToExcel(data, 'Comments_Contracts');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Comment Note', cell: (contract) => hasActiveCommentToday(contract) ? contract.notes : 'No comment provided' },
            { header: 'Comment Date', cell: (contract) => hasActiveCommentToday(contract) ? formatCommentDate(contract.commentDate, contract.inputDate || '') : '—' },
        ];
        exportToPDF('Comments Directory', columns, allData, user?.brand || '', orientation);
    };

    const visibleContracts = selectedSearchRecord ? [selectedSearchRecord] : contracts;
    const commentHistoryEntries = selectedHistoryItem
        ? [
            ...(Array.isArray(selectedHistoryItem.commentHistory) ? selectedHistoryItem.commentHistory : []),
            ...(selectedHistoryItem.notes?.trim()
                ? [{
                    _id: 'latest-comment',
                    comment: selectedHistoryItem.notes,
                    commentedAt: selectedHistoryItem.commentDate,
                    editedBy: selectedHistoryItem.lastModifiedBy,
                    isCurrent: hasActiveCommentToday(selectedHistoryItem)
                }]
                : [])
        ]
        : [];

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4 relative'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div>
                    <h1 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                        <span>{t('comments')}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-300 font-bold">
                            {total} Records with Comments
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <DatabaseSearchInput
                        apiBase={API_BASE1}
                        endpoint="/contracts"
                        params={{
                            status: 'Comments',
                            userBrand: user?.brand || '',
                            userRole: user?.role || '',
                            username: user?.username || '',
                            isImmutable: user?.isImmutable ? 'true' : 'false',
                            userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
                        }}
                        value={searchTerm}
                        placeholder={t('searchCustomer')}
                        onChange={(value) => {
                            setSelectedSearchRecord(null);
                            setPage(1);
                            setSearchTerm(value);
                            setSearchParams(current => {
                                const next = new URLSearchParams(current);
                                if (value.trim()) next.set('search', value);
                                else next.delete('search');
                                return next;
                            }, { replace: true });
                        }}
                        onSelect={(record) => {
                            setSelectedSearchRecord(record);
                            setPage(1);
                        }}
                        className="w-44"
                    />
                    {hasPermission('/contract/comments', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-1 text-center'>{t('no')}</th>
                            <th className='px-4 py-1'>{t('commentDate')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('commentNote')}</th>
                            <th className='px-4 py-1 text-center'>{t('status')}</th>
                            <th className='px-4 py-1 text-center'>{t('contract')}</th>
                            <th className='px-4 py-1 text-center'>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {visibleContracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">{t('noContractsWithComments')}</td>
                            </tr>
                        ) : (
                            visibleContracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-khmer text-slate-600 font-semibold'>{total - ((selectedSearchRecord ? 0 : (page - 1) * LIMIT) + idx)}</td>
                                    <td className='px-4 py-1 font-khmer text-slate-700 font-medium whitespace-nowrap'>
                                        {hasActiveCommentToday(item)
                                            ? formatCommentDate(item.commentDate, formatCommentDate(item.updatedAt, item.inputDate))
                                            : '—'}
                                    </td>
                                    <td className='px-4 py-1'>
                                        <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                        {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 text-teal-800 font-khmer max-w-[260px] truncate' title={hasActiveCommentToday(item) ? item.notes : ''}>
                                        {hasActiveCommentToday(item) ? item.notes : <span className="text-slate-400 italic font-normal">{t('noCommentProvided')}</span>}
                                    </td>
                                    <td className='px-4 py-1 text-center'>
                                        <span className='px-3 py-1 bg-teal-50 text-teal-800 border border-teal-300 rounded-full font-bold text-[10px] uppercase'>{t('comments')}</span>
                                    </td>
                                    <td className='px-4 py-1 text-center font-khmer text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-khmer font-bold text-indigo-700' />
                                    </td>
                                    <td className="px-4 py-1 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs">
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-[5px] shadow-xl z-[99999] p-2 space-y-1 animate-in fade-in duration-150">
                                                    {hasPermission('/contract/comments', 'information') && (
                                                        <button onClick={() => { setSelectedInfo(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2">
                                                            <MdInfo className="text-indigo-600" /> {t('details')}
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/comments', 'edit') && (
                                                        <button onClick={() => { openCommentEditor(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2">
                                                            <MdEdit className="text-amber-600" /> {hasActiveCommentToday(item) ? 'Edit Latest Comment' : 'Add Comment'}
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setSelectedHistoryItem(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2">
                                                        <FaHistory className="text-indigo-600" /> View Comment History
                                                    </button>
                                                    {hasPermission('/contract/comments', 'edit') && (
                                                        <button onClick={() => { openCommentEditor(item, true); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-[5px] flex items-center gap-2">
                                                            <FaPlus className="text-teal-600" /> Add Comment
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/comments', 'delete') && (
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

            {selectedHistoryItem && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-3">
                    <section className="w-full max-w-3xl overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <div>
                                <h2 className="flex items-center gap-2 text-sm font-black text-indigo-800">
                                    <FaHistory /> Comment History
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedHistoryItem.customerNameEn} · {selectedHistoryItem.model}
                                </p>
                            </div>
                            <button onClick={() => setSelectedHistoryItem(null)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('close')}>×</button>
                        </header>
                        <div className="max-h-[60vh] overflow-auto p-4">
                            {commentHistoryEntries.length === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-500">{t('noPreviousComments')}</p>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 uppercase text-slate-600">
                                        <tr>
                                            <th className="whitespace-nowrap px-3 py-2">{t('commentDate')}</th>
                                            <th className="px-3 py-2">{t('commentLabel')}</th>
                                            {isMasterAdmin && <th className="px-3 py-2 text-center">{t('actionLabel')}</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {commentHistoryEntries.map((entry, index) => (
                                            <tr key={entry._id || index}>
                                                <td className="whitespace-nowrap px-3 py-2 font-khmer text-slate-600">
                                                    {formatCommentDate(entry.commentedAt, entry.isCurrent ? formatCommentDate(selectedHistoryItem.updatedAt, selectedHistoryItem.inputDate) : '')}
                                                </td>
                                                <td className="whitespace-pre-wrap px-3 py-2 text-slate-800">
                                                    {entry.isCurrent && <span className="mr-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-700">{t('latest')}</span>}
                                                    {entry.comment || '—'}
                                                </td>
                                                {isMasterAdmin && (
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            onClick={() => {
                                                                if (entry.isCurrent) {
                                                                    openCommentEditor(selectedHistoryItem);
                                                                } else {
                                                                    setSelectedCommentItem(selectedHistoryItem);
                                                                    setEditingHistoryEntry(entry);
                                                                    setIsAddingComment(false);
                                                                    setCommentInput(entry.comment || '');
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-[5px] bg-amber-50 px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                                                        >
                                                            <MdEdit /> {t('edit')}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <footer className="flex justify-between border-t border-slate-200 px-4 py-3">
                            {hasPermission('/contract/comments', 'edit') ? (
                                <button
                                    onClick={() => openCommentEditor(selectedHistoryItem, true)}
                                    className="inline-flex items-center gap-2 rounded-[5px] bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
                                >
                                    <FaPlus /> Add Comment
                                </button>
                            ) : <span />}
                            <button onClick={() => setSelectedHistoryItem(null)} className="rounded-[5px] bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300">{t('close')}</button>
                        </footer>
                    </section>
                </div>
            )}

            {selectedCommentItem && (
                <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/75 p-3">
                    <div className="w-full max-w-lg space-y-4 rounded-[5px] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-700 pb-3">
                            <h2 className="flex items-center gap-2 text-sm font-black text-teal-300">
                                <MdComment />
                                {editingHistoryEntry ? 'Edit Archived Comment' : (selectedCommentItem.notes && commentInput === selectedCommentItem.notes ? 'Edit Latest Comment' : 'Add Comment')}
                            </h2>
                            <button
                                type="button"
                                onClick={() => { setSelectedCommentItem(null); setEditingHistoryEntry(null); setIsAddingComment(false); }}
                                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
                                aria-label={t('close')}
                            >×</button>
                        </header>
                        <div className="rounded-[5px] border border-slate-700 bg-slate-800/70 p-3 text-xs text-slate-300">
                            <p>{t('customer')}: <span className="font-bold text-black">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="mt-1">{t('model')}: <span className="font-semibold text-black">{selectedCommentItem.model}</span></p>
                        </div>
                        <label className="block text-xs font-semibold text-slate-300">
                            {t('commentLabel')} <span className="font-normal text-slate-500">({t('optional')})</span>
                            <textarea
                                rows={5}
                                value={commentInput}
                                onChange={(event) => {
                                    setCommentInput(event.target.value);
                                    if (isAddingComment && !event.target.value.includes('ថ្ងៃទី')) {
                                        setIsDateAppended(false);
                                    }
                                }}
                                placeholder={t('writeCommentPlaceholder')}
                                className="mt-2 w-full rounded-[5px] border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-teal-500"
                            />
                        </label>
                        {!editingHistoryEntry && (
                            <label className="block text-xs font-semibold text-slate-300">
                                {t('commentExpiry')}
                                <select
                                    value={commentExpiryMode}
                                    onChange={(event) => setCommentExpiryMode(event.target.value)}
                                    className="mt-2 w-full rounded-[5px] border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-teal-500"
                                >
                                    <option value="1day">{t('commentExpiresInOneDay')}</option>
                                    <option value="date">{t('commentExpiresOnDate')}</option>
                                    <option value="never">{t('commentDoesNotExpire')}</option>
                                </select>
                                {commentExpiryMode === 'date' && (
                                    <input
                                        type="date"
                                        value={commentExpiryDate}
                                        min={getCambodiaDateInputValue()}
                                        onChange={(event) => setCommentExpiryDate(event.target.value)}
                                        className="mt-2 w-full rounded-[5px] border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-teal-500"
                                        required
                                    />
                                )}
                            </label>
                        )}
                        <footer className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setSelectedCommentItem(null); setEditingHistoryEntry(null); setIsAddingComment(false); setIsDateAppended(false); }}
                                className="rounded-[5px] bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-600"
                            >{t('cancel')}</button>
                            {!isDateAppended ? (
                                <button
                                    key="btn-input-date"
                                    type="button"
                                    onClick={handleAppendDate}
                                    className="inline-flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer shadow-md transition-all"
                                >
                                    <MdDateRange className="text-base" />
                                    {t('inputDate')}
                                </button>
                            ) : (
                                <button
                                    key="btn-save-comment"
                                    type="button"
                                    onClick={handleSaveComment}
                                    disabled={commentSaving || (!editingHistoryEntry && commentExpiryMode === 'date' && !commentExpiryDate)}
                                    className="inline-flex items-center gap-2 rounded-[5px] bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-60 cursor-pointer shadow-md transition-all"
                                >
                                    {commentSaving ? <MdOutlineSync className="animate-spin" /> : <MdEdit />}
                                    {t('save')}
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}

            {/* Information Detail Modal */}
            {selectedInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                                <MdComment /> {t('contractCommentDetails')}
                            </h3>
                            <button onClick={() => setSelectedInfo(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>
                        <div className="p-2 bg-gray-900/80 rounded-[5px] border border-cyan-500/30 space-y-2 text-xs">
                            <p className="text-gray-400">{t('customer')}: <span className="text-gray-100 font-bold">{selectedInfo.customerNameEn}</span></p>
                            <p className="text-gray-400">{t('deviceModel')}: <span className="text-gray-200 font-semibold">{selectedInfo.model}</span></p>
                            <p className="text-gray-400">{t('serialNumber')}: <span className="text-indigo-300 font-khmer">{selectedInfo.serialNumber}</span></p>
                            <div className="pt-2 border-t border-gray-800">
                                <span className="text-cyan-400 font-bold block mb-1">{t('commentNote')}:</span>
                                <p className="text-white bg-gray-950 p-2 rounded-[5px] border border-gray-800 font-sans leading-relaxed">{hasActiveCommentToday(selectedInfo) ? selectedInfo.notes : t('noCommentProvided')}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-cyan-600 text-white font-bold text-xs rounded-[5px]">{t('close')}</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Comments;
