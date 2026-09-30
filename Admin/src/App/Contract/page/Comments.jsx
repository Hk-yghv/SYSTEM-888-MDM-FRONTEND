import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdComment, MdInfo, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import CreateApplication from '../components/CreateApplication';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const Comments = () => {
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
    const [selectedInfo, setSelectedInfo] = useState(null);

    const fetchCommentsContracts = async (pg = page) => {
        setReloading(true);
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Comments&page=${pg}&limit=${LIMIT}${brandParam}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch comments error:', err);
        } finally {
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchCommentsContracts(page); }, [page]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this record?')) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCommentsContracts();
        } catch (err) { }
    };

    const fetchAllForExport = async () => {
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Comments&page=1&limit=999999${brandParam}`);
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
            'Input Date': c.inputDate || '',
            'Status': c.status || 'Comments',
        }));
        exportToExcel(data, 'Comments_Contracts');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Comment Note', accessor: 'notes' },
        ];
        exportToPDF('Comments Directory', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4 relative'>
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex items-center justify-between shadow-xs'>
                <div>
                    <h1 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                        <span>{t('comments')}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-300 font-bold">
                            {total} Records with Comments
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {hasPermission('/contract/comments', 'export') && (
                        <>
                            <button
                                onClick={handleExportExcel}
                                className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'
                            >
                                <FaFileExcel className="text-emerald-600 text-sm" />
                                <span>Excel</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'
                            >
                                <MdPictureAsPdf className="text-red-600 text-sm" />
                                <span>PDF</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={fetchCommentsContracts}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('inputDate')}</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>Comment Note</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                            <th className='px-4 py-3 text-center'>Contract</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">No contracts with comments found.</td>
                            </tr>
                        ) : (
                            contracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-medium'>{item.inputDate}</td>
                                    <td className='px-4 py-3'>
                                        <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                        {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 text-teal-800 font-sans font-medium max-w-[260px] truncate' title={item.notes}>
                                        💡 {item.notes || 'No comment provided'}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-3 py-1 bg-teal-50 text-teal-800 border border-teal-300 rounded-full font-bold text-[10px] uppercase'>Comments</span>
                                    </td>
                                    <td className='px-4 py-3 text-center font-mono text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-mono font-bold text-indigo-700' />
                                    </td>
                                    <td className="px-4 py-3 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs">
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-[99999] p-1.5 space-y-1 animate-in fade-in duration-150">
                                                    {hasPermission('/contract/comments', 'information') && (
                                                        <button onClick={() => { setSelectedInfo(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2">
                                                            <MdInfo className="text-indigo-600" /> Details
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/comments', 'edit') && (
                                                        <button onClick={() => { setEditData(item); setOpenEditModal(true); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2">
                                                            <MdEdit className="text-amber-600" /> Edit
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

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />

            {/* Information Detail Modal */}
            {selectedInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                                <MdComment /> Contract Comment Details
                            </h3>
                            <button onClick={() => setSelectedInfo(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>
                        <div className="p-4 bg-gray-900/80 rounded-2xl border border-cyan-500/30 space-y-2 text-xs">
                            <p className="text-gray-400">Customer: <span className="text-gray-100 font-bold">{selectedInfo.customerNameEn}</span></p>
                            <p className="text-gray-400">Device Model: <span className="text-gray-200 font-semibold">{selectedInfo.model}</span></p>
                            <p className="text-gray-400">Serial Number: <span className="text-indigo-300 font-mono">{selectedInfo.serialNumber}</span></p>
                            <div className="pt-2 border-t border-gray-800">
                                <span className="text-cyan-400 font-bold block mb-1">Comment Note:</span>
                                <p className="text-white bg-gray-950 p-3 rounded-[5px] border border-gray-800 font-sans leading-relaxed">{selectedInfo.notes || 'No notes'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-cyan-600 text-white font-bold text-xs rounded-[5px]">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />

            <CreateApplication open={openEditModal} setOpen={setOpenEditModal} editData={editData} onSaved={fetchCommentsContracts} />
        </div>
    );
};

export default Comments;

