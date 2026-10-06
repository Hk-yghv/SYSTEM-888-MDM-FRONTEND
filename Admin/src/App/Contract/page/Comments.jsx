import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdComment, MdInfo } from "react-icons/md";
import { FaHistory, FaPlus } from 'react-icons/fa';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';

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
                isImmutable: user?.isImmutable ? 'true' : 'false'
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

    const openCommentEditor = (contract, append = false) => {
        setSelectedCommentItem(contract);
        setCommentInput(append ? '' : (contract.notes || ''));
        setIsAddingComment(append);
        setEditingHistoryEntry(null);
    };

    const handleSaveComment = async (event) => {
        event.preventDefault();
        if (!selectedCommentItem) return;
        setCommentSaving(true);
        try {
            const isHistoryEdit = Boolean(editingHistoryEntry);
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
                        appendComment: isAddingComment
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
            setCommentInput('');
            await fetchCommentsContracts(page, searchTerm);
        } catch (err) {
            console.error('Save contract comment error:', err);
            window.alert(err.message || 'Failed to save comment');
        } finally {
            setCommentSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this record?')) return;
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
                isImmutable: user?.isImmutable ? 'true' : 'false'
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
            'Comment Note': c.notes || '',
            'Comment Date': formatCommentDate(c.commentDate, c.inputDate || ''),
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
            { header: 'Comment Note', accessor: 'notes' },
            { header: 'Comment Date', cell: (contract) => formatCommentDate(contract.commentDate, contract.inputDate || '') },
        ];
        exportToPDF('Comments Directory', columns, allData, user?.brand || '', orientation);
    };

    const visibleContracts = selectedSearchRecord ? [selectedSearchRecord] : contracts;

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
                            isImmutable: user?.isImmutable ? 'true' : 'false'
                        }}
                        value={searchTerm}
                        placeholder="Search customer..."
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
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>Comment Date</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>Comment Note</th>
                            <th className='px-4 py-1 text-center'>{t('status')}</th>
                            <th className='px-4 py-1 text-center'>Contract</th>
                            <th className='px-4 py-1 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {visibleContracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">No contracts with comments found.</td>
                            </tr>
                        ) : (
                            visibleContracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(selectedSearchRecord ? 0 : (page - 1) * LIMIT) + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-slate-700 font-medium whitespace-nowrap'>
                                        {formatCommentDate(item.commentDate, formatCommentDate(item.updatedAt, item.inputDate))}
                                    </td>
                                    <td className='px-4 py-1'>
                                        <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                        {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 text-teal-800 font-sans font-medium max-w-[260px] truncate' title={item.notes}>
                                        💡 {item.notes || 'No comment provided'}
                                    </td>
                                    <td className='px-4 py-1 text-center'>
                                        <span className='px-3 py-1 bg-teal-50 text-teal-800 border border-teal-300 rounded-full font-bold text-[10px] uppercase'>Comments</span>
                                    </td>
                                    <td className='px-4 py-1 text-center font-mono text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-mono font-bold text-indigo-700' />
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
                                                            <MdInfo className="text-indigo-600" /> Details
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/comments', 'edit') && (
                                                        <button onClick={() => { openCommentEditor(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2">
                                                            <MdEdit className="text-amber-600" /> Edit Latest Comment
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
                                                            <MdDelete className="text-red-600" /> Delete
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
                            <button onClick={() => setSelectedHistoryItem(null)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">×</button>
                        </header>
                        <div className="max-h-[60vh] overflow-auto p-4">
                            {(selectedHistoryItem.commentHistory || []).length === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-500">No previous comments.</p>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 uppercase text-slate-600">
                                        <tr>
                                            <th className="whitespace-nowrap px-3 py-2">Comment Date</th>
                                            <th className="px-3 py-2">Comment</th>
                                            {isMasterAdmin && <th className="px-3 py-2 text-center">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedHistoryItem.commentHistory.map((entry, index) => (
                                            <tr key={entry._id || index}>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">
                                                    {formatCommentDate(entry.commentedAt)}
                                                </td>
                                                <td className="whitespace-pre-wrap px-3 py-2 text-slate-800">{entry.comment || '—'}</td>
                                                {isMasterAdmin && (
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCommentItem(selectedHistoryItem);
                                                                setEditingHistoryEntry(entry);
                                                                setCommentInput(entry.comment || '');
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-[5px] bg-amber-50 px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                                                        >
                                                            <MdEdit /> Edit
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
                            <button onClick={() => setSelectedHistoryItem(null)} className="rounded-[5px] bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300">Close</button>
                        </footer>
                    </section>
                </div>
            )}

            {selectedCommentItem && (
                <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/75 p-3">
                    <form onSubmit={handleSaveComment} className="w-full max-w-lg space-y-4 rounded-[5px] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-700 pb-3">
                            <h2 className="flex items-center gap-2 text-sm font-black text-teal-300">
                                <MdComment />
                                {editingHistoryEntry ? 'Edit Archived Comment' : (selectedCommentItem.notes && commentInput === selectedCommentItem.notes ? 'Edit Latest Comment' : 'Add Comment')}
                            </h2>
                            <button
                                type="button"
                                onClick={() => { setSelectedCommentItem(null); setEditingHistoryEntry(null); setIsAddingComment(false); }}
                                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
                                aria-label="Close"
                            >×</button>
                        </header>
                        <div className="rounded-[5px] border border-slate-700 bg-slate-800/70 p-3 text-xs text-slate-300">
                            <p>Customer: <span className="font-bold text-white">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="mt-1">Model: <span className="font-semibold text-white">{selectedCommentItem.model}</span></p>
                        </div>
                        <label className="block text-xs font-semibold text-slate-300">
                            Comment <span className="font-normal text-slate-500">(optional)</span>
                            <textarea
                                rows={5}
                                value={commentInput}
                                onChange={(event) => setCommentInput(event.target.value)}
                                placeholder="Write a comment or leave blank..."
                                className="mt-2 w-full rounded-[5px] border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-teal-500"
                            />
                        </label>
                        <footer className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setSelectedCommentItem(null); setEditingHistoryEntry(null); setIsAddingComment(false); }}
                                className="rounded-[5px] bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-600"
                            >Cancel</button>
                            <button
                                type="submit"
                                disabled={commentSaving}
                                className="inline-flex items-center gap-2 rounded-[5px] bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-60"
                            >
                                {commentSaving ? <MdOutlineSync className="animate-spin" /> : <MdEdit />}
                                Save
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            {/* Information Detail Modal */}
            {selectedInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                                <MdComment /> Contract Comment Details
                            </h3>
                            <button onClick={() => setSelectedInfo(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>
                        <div className="p-2 bg-gray-900/80 rounded-[5px] border border-cyan-500/30 space-y-2 text-xs">
                            <p className="text-gray-400">Customer: <span className="text-gray-100 font-bold">{selectedInfo.customerNameEn}</span></p>
                            <p className="text-gray-400">Device Model: <span className="text-gray-200 font-semibold">{selectedInfo.model}</span></p>
                            <p className="text-gray-400">Serial Number: <span className="text-indigo-300 font-mono">{selectedInfo.serialNumber}</span></p>
                            <div className="pt-2 border-t border-gray-800">
                                <span className="text-cyan-400 font-bold block mb-1">Comment Note:</span>
                                <p className="text-white bg-gray-950 p-2 rounded-[5px] border border-gray-800 font-sans leading-relaxed">{selectedInfo.notes || 'No notes'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-cyan-600 text-white font-bold text-xs rounded-[5px]">Close</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Comments;
