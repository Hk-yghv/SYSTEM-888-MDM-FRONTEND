import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu, AiOutlinePlus } from "react-icons/ai";
import { MdOutlineSync, MdCheckCircle, MdInfo, MdEdit, MdDelete, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import CopyCell from '../../../components/CopyCell';
import CreateApplication from '../components/CreateApplication';
import Pagination from '../../../components/Pagination';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const Application = () => {
    const { t } = useLanguage();
    const { API_BASE, hasPermission } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const itemsPerPage = 10;

    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [infoData, setInfoData] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);

    const fetchApplications = useCallback(async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ status: 'Application', page: pg, limit: itemsPerPage });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch applications error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE, currentPage, searchTerm]);

    useEffect(() => { fetchApplications(currentPage, searchTerm); }, [currentPage]);
    useEffect(() => { fetchApplications(1, searchTerm); setCurrentPage(1); }, [searchTerm]);

    const handleOpenCreate = () => {
        setEditData(null);
        setOpenCreateModal(true);
        setOpenMenuId(null);
    };

    const handleOpenEdit = (item) => {
        setEditData(item);
        setOpenCreateModal(true);
        setOpenMenuId(null);
    };

    const handleActivateContract = async (contractId) => {
        try {
            const contract = contracts.find(c => c._id === contractId || c.contractId === contractId);
            if (!contract) return;

            const res = await fetch(`${API_BASE}/contracts/${contract._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Activated' })
            });

            if (res.ok) {
                alert(`Contract ${contract.contractId} has been successfully Activated! Data will now populate to Customer, Device, and Payment History pages.`);
                fetchApplications();
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Activate contract error:', err);
        }
    };

    const handleDeleteContract = async (id) => {
        if (!window.confirm('Are you sure you want to delete this application contract?')) return;
        try {
            const res = await fetch(`${API_BASE}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchApplications();
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleExportExcel = () => {
        const data = contracts.map((c, idx) => ({
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
            'Status': c.status || 'Application',
        }));
        exportToExcel(data, 'Application_Contracts');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Monthly ($)', cell: (r) => `$${r.monthlyPayment}` },
        ];
        exportToPDF('Application Contracts Directory', columns, contracts);
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4 relative'>
            {/* Header */}
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div>
                    <h1 className='text-lg font-bold text-indigo-400 flex items-center gap-2'>
                        <span>{t('application')} List</span>
                        <span className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-full font-normal">
                            Unactivated Contracts
                        </span>
                    </h1>
                </div>
                <div className='flex items-center gap-3'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>
                    {hasPermission('/contract/application', 'create') && (
                        <button
                            onClick={handleOpenCreate}
                            className='flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all'
                        >
                            <AiOutlinePlus size={16} />
                            <p>{t('create')}</p>
                        </button>
                    )}
                    <button
                        onClick={() => fetchApplications(currentPage, searchTerm)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Application List Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-170px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('inputDate')}</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">
                                    No pending applications found. Click "Create" to add a new application.
                                </td>
                            </tr>
                        ) : (
                            contracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-medium'>{item.inputDate}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <CopyCell text={item.customerNameEn} className='font-bold text-slate-900' />
                                            {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                            {item.modifiedByAdmin && (
                                                <span className='px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-full font-bold text-[9px] uppercase shadow-2xs' title={`Last modified by ${item.lastModifiedBy || 'Administrator'}`}>
                                                    ⚡ Modified by Admin
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-3 py-1 bg-amber-50 border border-amber-300 text-amber-800 rounded-full font-bold text-[10px] uppercase'>
                                            Application
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3'>
                                        <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                            {item.brand || '—'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-slate-600 font-medium'><CopyCell text={item.serialNumber || 'Pending'} className='font-mono text-slate-600 font-medium' /></td>
                                    <td className="px-4 py-3 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)}
                                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs"
                                            >
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-[99999] p-1.5 space-y-1 animate-in fade-in duration-150">
                                                    <button
                                                        onClick={() => { setInfoData(item); setOpenMenuId(null); }}
                                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdInfo className="text-indigo-600 text-sm" />
                                                        <span>{t('information')}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleActivateContract(item._id)}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdCheckCircle className="text-emerald-600 text-sm" />
                                                        <span>Set to Activated</span>
                                                    </button>
                                                    {(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL) && (
                                                        <button
                                                            onClick={() => window.open(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL, '_blank')}
                                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <span>Open Mosyle</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdEdit className="text-amber-600 text-sm" />
                                                        <span>{t('edit')}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteContract(item._id)}
                                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdDelete className="text-red-600 text-sm" />
                                                        <span>{t('delete')}</span>
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

            {/* Pagination controls */}
            <Pagination
                currentPage={currentPage}
                totalItems={total}
                itemsPerPage={itemsPerPage}
                onPageChange={(pg) => setCurrentPage(pg)}
            />

            {/* Create & Edit Modal */}
            <CreateApplication
                open={openCreateModal}
                setOpen={setOpenCreateModal}
                editData={editData}
                onSaved={fetchApplications}
            />

            {/* Information Detail Modal */}
            {infoData && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                                <MdInfo className="text-indigo-400 text-xl" />
                                Detailed Application Contract Information
                            </h3>
                            <button onClick={() => setInfoData(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>

                        {/* Customer Info */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-indigo-300 uppercase">Customer Information</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Name EN</span><span className="font-bold text-gray-100">{infoData.customerNameEn}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Name KH</span><span className="font-bold text-indigo-400 font-khmer">{infoData.customerNameKh}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">ID Number</span><span className="font-mono text-gray-200">{infoData.idCardNumber || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Phone</span><span className="font-mono text-gray-200">{infoData.phone || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Relative Phone</span><span className="font-mono text-gray-200">{infoData.relativePhone || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Current Address</span><span className="text-gray-200">{infoData.currentAddress || '-'}</span></div>
                            </div>
                        </div>

                        {/* Device Info */}
                        <div className="space-y-2 pt-2 border-t border-gray-800">
                            <h4 className="text-xs font-bold text-purple-300 uppercase">Device Details</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Model</span><span className="font-bold text-gray-100">{infoData.model}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Serial Number</span><span className="font-mono font-bold text-indigo-300">{infoData.serialNumber}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">IMEI 1</span><span className="font-mono text-gray-300">{infoData.imei1 || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Color / Ver</span><span className="text-gray-300">{infoData.color || '-'} / {infoData.version || '-'}</span></div>
                            </div>
                        </div>

                        {/* Loan Info */}
                        <div className="space-y-2 pt-2 border-t border-gray-800">
                            <h4 className="text-xs font-bold text-emerald-300 uppercase">Loan & Financial Details</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Total Loan Amount</span><span className="font-mono font-bold text-emerald-400">${infoData.amount || infoData.totalAmount || 0}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Monthly Installment</span><span className="font-mono font-bold text-emerald-400">${infoData.monthlyPayment}/mo</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Interest / Duration</span><span className="text-gray-300">{infoData.interest || '14%'} &bull; {infoData.duration || '12 Mo'}</span></div>
                            </div>
                        </div>

                        <div className="text-right pt-2">
                            <button onClick={() => setInfoData(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Application;
