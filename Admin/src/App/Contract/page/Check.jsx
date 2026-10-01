import React, { useState, useEffect } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdEdit, MdDelete, MdCheckCircle, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import CreateApplication from '../components/CreateApplication';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const Check = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [openEditModal, setOpenEditModal] = useState(false);
    const LIMIT = 10;

    const fetchCheckContracts = async (pg = page) => {
        setReloading(true);
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Check&page=${pg}&limit=${LIMIT}${brandParam}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch check contracts error:', err);
        } finally {
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => { fetchCheckContracts(page); }, [page]);

    const handleMoveToActivated = async (item) => {
        if (!window.confirm(`Move contract "${item.customerNameEn}" back to Activated?`)) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Activated' })
            });
            if (res.ok) {
                alert('Contract moved back to Activated successfully.');
                fetchCheckContracts();
                setOpenMenuId(null);
            }
        } catch (err) { }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this contract record?')) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCheckContracts();
        } catch (err) { }
    };

    const fetchAllForExport = async () => {
        try {
            const brandParam = user?.brand ? `&userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}&username=${encodeURIComponent(user?.username || '')}&isImmutable=${user?.isImmutable ? 'true' : 'false'}` : '';
            const res = await fetch(`${API_BASE1}/contracts?status=Check&page=1&limit=999999${brandParam}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all check for export error:', err);
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
            'Status': c.status || 'Check',
        }));
        exportToExcel(data, 'Check_Contracts');
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
        exportToPDF('Check Contracts Directory', columns, allData, user?.brand || '', orientation);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4 relative'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div>
                    <h1 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                        <span>{t('check')}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {hasPermission('/contract/check', 'export') && (
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
                            <th className='px-4 py-1'>{t('inputDate')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1 text-center'>{t('status')}</th>
                            <th className='px-4 py-1 text-center'>Contract</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {contracts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-slate-500 italic font-medium">No check contracts found.</td>
                            </tr>
                        ) : (
                            contracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-slate-700 font-medium'>{item.inputDate}</td>
                                    <td className='px-4 py-1'>
                                        <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                        {item.customerNameKh && <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs font-semibold' />}
                                    </td>
                                    <td className='px-4 py-1 text-center'>
                                        <span className='px-3 py-1 bg-sky-50 text-sky-800 border border-sky-300 rounded-full font-bold text-[10px] uppercase'>Check</span>
                                    </td>
                                    <td className='px-4 py-1 text-center font-mono text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-mono font-bold text-indigo-700' />
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className="px-4 py-1 text-center relative">
                                        <div className="relative inline-block text-left">
                                            <button onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs">
                                                <AiOutlineMenu size={16} />
                                            </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-[5px] shadow-xl z-[99999] p-2 space-y-1 animate-in fade-in duration-150">
                                                    {hasPermission('/contract/check', 'edit') && (
                                                        <button onClick={() => handleMoveToActivated(item)} className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-[5px] flex items-center gap-2 cursor-pointer">
                                                            <MdCheckCircle className="text-emerald-600" /> Move to Activated
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/check', 'edit') && (
                                                        <button onClick={() => { setEditData(item); setOpenEditModal(true); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2">
                                                            <MdEdit className="text-amber-600" /> Edit
                                                        </button>
                                                    )}
                                                    {hasPermission('/contract/check', 'delete') && (
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

            <CreateApplication open={openEditModal} setOpen={setOpenEditModal} editData={editData} onSaved={fetchCheckContracts} />
        </div>
    );
};

export default Check;

