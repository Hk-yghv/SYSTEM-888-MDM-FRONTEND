import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdComment, MdInfo, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import CreateApplication from '../components/CreateApplication';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const Comments = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [reloading, setReloading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [selectedInfo, setSelectedInfo] = useState(null);

    const fetchCommentsContracts = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/contracts?status=Comments`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data);
            }
        } catch (err) {
            console.error('Fetch comments error:', err);
        } finally {
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchCommentsContracts();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this record?')) return;
        try {
            const res = await fetch(`${API_BASE}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCommentsContracts();
        } catch (err) { }
    };

    const handleExportExcel = () => {
        const data = contracts.map((c, idx) => ({
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

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Comment Note', accessor: 'notes' },
        ];
        exportToPDF('Comments Directory', columns, contracts);
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4 relative'>
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div>
                    <h1 className='text-lg font-bold text-cyan-400 flex items-center gap-2'>
                        <MdComment className="text-xl" />
                        <span>{t('comments')} List</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-normal">
                            {contracts.length} Records with Comments
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'
                    >
                        <FaFileExcel />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'
                    >
                        <MdPictureAsPdf className="text-sm" />
                        <span>PDF</span>
                    </button>
                    <button
                        onClick={fetchCommentsContracts}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('inputDate')}</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>Comment Note</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500 italic">No contracts with comments found in MongoDB.</td>
                            </tr>
                        ) : (
                            contracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-gray-400'>{item.inputDate}</td>
                                    <td className='px-4 py-3 font-bold text-gray-100'>
                                        {item.customerNameEn} <span className="text-indigo-400 font-khmer text-xs">({item.customerNameKh})</span>
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-gray-300'>{item.model}</td>
                                    <td className='px-4 py-3 text-cyan-300 font-sans max-w-[260px] truncate' title={item.notes}>
                                        💡 {item.notes || 'No comment provided'}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-700 rounded-full font-bold text-[10px] uppercase'>Comments</span>
                                    </td>
                                    <td className="px-4 py-3 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)} className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-300">
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-44 bg-[#141a30] border border-gray-700 rounded-2xl shadow-2xl z-50 p-1 space-y-1">
                                                    <button onClick={() => { setSelectedInfo(item); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-950/50 rounded-xl flex items-center gap-2">
                                                        <MdInfo /> Details
                                                    </button>
                                                    <button onClick={() => { setEditData(item); setOpenEditModal(true); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-950/50 rounded-xl flex items-center gap-2">
                                                        <MdEdit /> Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(item._id)} className="w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/50 rounded-xl flex items-center gap-2">
                                                        <MdDelete /> Delete
                                                    </button>
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
                                <p className="text-gray-100 bg-gray-950 p-3 rounded-xl border border-gray-800 font-sans leading-relaxed">{selectedInfo.notes || 'No notes'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-cyan-600 text-white font-bold text-xs rounded-xl">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <CreateApplication open={openEditModal} setOpen={setOpenEditModal} editData={editData} onSaved={fetchCommentsContracts} />
        </div>
    );
};

export default Comments;