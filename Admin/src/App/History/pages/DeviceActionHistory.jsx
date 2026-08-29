import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaLock, FaUnlock, FaFileExcel, FaSearch, FaCheckCircle, FaClock, FaPlus, FaMobileAlt } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdOutlineWallpaper } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';


const LIMIT = 10;

const DeviceActionHistory = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    // Modal state for triggering new device action
    const [openActionModal, setOpenActionModal] = useState(false);
    const [activatedContracts, setActivatedContracts] = useState([]);
    const [selectedContractId, setSelectedContractId] = useState('');
    const [actionType, setActionType] = useState('Lock Phone');
    const [actionStatus, setActionStatus] = useState('Pending');
    const [reasonInput, setReasonInput] = useState('');
    const [submittingAction, setSubmittingAction] = useState(false);
    const [markingDoneId, setMarkingDoneId] = useState(null);

    const fetchDeviceActionLogs = useCallback(async (pg = page, search = searchTerm, st = statusFilter, act = actionFilter) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.append('search', search);
            if (st) params.append('status', st);
            if (act) params.append('actionType', act);

            const res = await fetch(`${API_BASE2}/history/device-actions?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch device action logs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, page, searchTerm, statusFilter, actionFilter, user]);

    // Fetch activated contracts list for modal select dropdown
    const fetchActivatedContracts = async () => {
        try {
            const res = await fetch(`${API_BASE1}/contracts?status=Activated`);
            if (res.ok) {
                const data = await res.json();
                setActivatedContracts(data.data || []);
                if (data.data && data.data.length > 0) {
                    setSelectedContractId(data.data[0].contractId);
                }
            }
        } catch (err) {
            console.error('Fetch activated contracts error:', err);
        }
    };

    useEffect(() => {
        fetchDeviceActionLogs(page, searchTerm, statusFilter, actionFilter);
    }, [page]);

    useEffect(() => {
        setPage(1);
        fetchDeviceActionLogs(1, searchTerm, statusFilter, actionFilter);
    }, [searchTerm, statusFilter, actionFilter]);

    useEffect(() => {
        fetchActivatedContracts();
    }, []);

    const handleCreateActionLog = async (e) => {
        e.preventDefault();
        if (!selectedContractId) return;

        setSubmittingAction(true);
        try {
            const res = await fetch(`${API_BASE2}/history/device-actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: selectedContractId,
                    actionType,
                    status: actionStatus,
                    performedBy: user?.name || user?.username || 'Administrator',
                    reason: reasonInput || `${actionType} requested on Activated device`
                })
            });

            if (res.ok) {
                setOpenActionModal(false);
                setReasonInput('');
                fetchDeviceActionLogs(1, searchTerm, statusFilter, actionFilter);
            }
        } catch (err) {
            console.error('Create action log error:', err);
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleMarkDone = async (item) => {
        setMarkingDoneId(item._id || item.logId);
        try {
            const targetId = item._id || item.logId;
            const res = await fetch(`${API_BASE2}/history/device-actions/${targetId}/done`, {
                method: 'PUT'
            });
            if (res.ok) {
                fetchDeviceActionLogs(page, searchTerm, statusFilter, actionFilter);
            }
        } catch (err) {
            console.error('Mark done error:', err);
        } finally {
            setMarkingDoneId(null);
        }
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
            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter) params.append('status', statusFilter);
            if (actionFilter) params.append('actionType', actionFilter);

            const res = await fetch(`${API_BASE2}/history/device-actions?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all device action logs for export error:', err);
        }
        return logs;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((item, idx) => ({
            'No': idx + 1,
            'Date': item.date || '',
            'Time': item.time || '',
            'Customer Name': item.customerName || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Action Type': item.actionType || '',
            'Status': item.status || 'Pending',
            'Performed By': item.performedBy || '',
            'Reason': item.reason || ''
        }));
        exportToExcel(data, 'Device_Action_History');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date & Time', cell: (r) => `${r.date} ${r.time}` },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Action', accessor: 'actionType' },
            { header: 'Status', accessor: 'status' },
            { header: 'User', accessor: 'performedBy' }
        ];
        exportToPDF('Activated Device History Audit Report', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 text-xl'>
                        <FaMobileAlt />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('deviceHistory')}
                        </h1>
                        <p className='text-xs text-amber-700 font-bold'>
                            {total} records — Track Lock Phone, Unlock Phone & Set Wallpaper actions with Pending/Success status
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => { fetchActivatedContracts(); setOpenActionModal(true); }}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/20'
                    >
                        <FaPlus size={12} />
                        <span>{t('create')} / ដាក់ Lock ឬ Wallpaper</span>
                    </button>
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>Excel</span>
                    </button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>PDF</span>
                    </button>
                    <button onClick={() => fetchDeviceActionLogs(page)} disabled={reloading} className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs'>
                <div className='relative flex-1 min-w-[240px]'>
                    <FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs' />
                    <input
                        type='text'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search')}
                        className='w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 bg-slate-50'
                    />
                </div>

                <div className='flex items-center gap-3 flex-wrap'>
                    <div className='flex items-center gap-2'>
                        <label className='text-xs font-bold text-slate-600'>Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer'
                        >
                            <option value=''>All Status</option>
                            <option value='Pending'>Pending (រង់ចាំ)</option>
                            <option value='Success'>Success (ជោគជ័យ)</option>
                        </select>
                    </div>

                    <div className='flex items-center gap-2'>
                        <label className='text-xs font-bold text-slate-600'>Action:</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className='px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer'
                        >
                            <option value=''>All Actions</option>
                            <option value='Lock Phone'>Lock Phone</option>
                            <option value='Unlock Phone'>Unlock Phone</option>
                            <option value='Set Wallpaper'>Set Wallpaper</option>
                            <option value='Lock Wallpaper'>Lock Wallpaper</option>
                            <option value='Unlock Wallpaper'>Unlock Wallpaper</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 font-semibold'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Date & Time</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3 font-mono'>{t('serialNumber')}</th>
                            <th className='px-4 py-3 text-center'>Action Type</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                            <th className='px-4 py-3'>Performed By</th>
                            <th className='px-4 py-3 text-center'>Complete Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="text-center py-10 text-slate-400">Loading device action logs...</td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-10 text-slate-500 italic font-medium">
                                    No device history records found for Activated devices.
                                </td>
                            </tr>
                        ) : (
                            logs.map((item, idx) => {
                                const isPending = item.status === 'Pending';
                                const isLock = item.actionType?.includes('Lock Phone');
                                const isWallpaper = item.actionType?.includes('Wallpaper');

                                return (
                                    <tr key={item._id || item.logId || idx} className='hover:bg-amber-50/40 transition-colors'>
                                        <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>
                                            {(page - 1) * LIMIT + idx + 1}
                                        </td>
                                        <td className='px-4 py-3 text-slate-600 font-mono text-[11px] whitespace-nowrap'>
                                            <CopyCell text={`${item.date} ${item.time}`} className='font-mono text-[11px] text-slate-600' />
                                        </td>
                                        <td className='px-4 py-3 font-bold text-slate-900'>
                                            <CopyCell text={item.customerName} className='font-bold text-slate-900' />
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'>
                                            <CopyCell text={item.model} className='font-semibold text-slate-800' />
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                                {item.brand || '—'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 font-mono text-emerald-700 font-bold'>
                                            <CopyCell text={item.serialNumber} className='font-mono text-emerald-700 font-bold' />
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border ${isLock ? 'bg-red-50 text-red-700 border-red-200' :
                                                isWallpaper ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                }`}>
                                                {isLock ? <FaLock size={10} /> : isWallpaper ? <MdOutlineWallpaper size={12} /> : <FaUnlock size={10} />}
                                                {item.actionType}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            {isPending ? (
                                                <span className='px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 border border-amber-300 text-amber-900 inline-flex items-center gap-1 animate-pulse'>
                                                    <FaClock size={10} />
                                                    {t('pending')}
                                                </span>
                                            ) : (
                                                <span className='px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 border border-emerald-300 text-emerald-800 inline-flex items-center gap-1'>
                                                    <FaCheckCircle size={10} />
                                                    {t('success')}
                                                </span>
                                            )}
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-700'>
                                            <CopyCell text={item.performedBy || 'Administrator'} className='font-semibold text-slate-700' />
                                        </td>
                                        <td className='px-4 py-3 text-center whitespace-nowrap'>
                                            {isPending ? (
                                                hasPermission('/history/device-history', 'edit') ? (
                                                    <button
                                                        onClick={() => handleMarkDone(item)}
                                                        disabled={markingDoneId === (item._id || item.logId)}
                                                        className='px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 inline-flex items-center gap-1 cursor-pointer transition-all'
                                                    >
                                                        <FaCheckCircle size={12} />
                                                        <span>{t('done')} (រួចរាល់)</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-amber-700 font-semibold text-xs italic">Pending (Read Only)</span>
                                                )
                                            ) : (
                                                <span className='text-xs text-emerald-700 font-bold flex items-center justify-center gap-1'>
                                                    <FaCheckCircle /> Completed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal for Creating New Action History */}
            {openActionModal && (
                <div className='fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none'>
                    <div className='bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200'>
                        <div className='p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between'>
                            <h2 className='text-base font-bold flex items-center gap-2'>
                                <FaMobileAlt />
                                Create Device Action (Lock / Wallpaper)
                            </h2>
                            <button
                                onClick={() => setOpenActionModal(false)}
                                className='w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors'
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateActionLog} className='p-5 space-y-4 text-xs'>
                            <div>
                                <label className='block font-bold text-slate-700 mb-1'>Select Activated Device / Contract</label>
                                {activatedContracts.length === 0 ? (
                                    <p className='text-amber-700 italic font-semibold'>No activated contracts available.</p>
                                ) : (
                                    <select
                                        value={selectedContractId}
                                        onChange={(e) => setSelectedContractId(e.target.value)}
                                        className='w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:border-amber-500'
                                    >
                                        {activatedContracts.map((c) => (
                                            <option key={c._id || c.contractId} value={c.contractId}>
                                                {c.customerNameEn} ({c.model} - S/N: {c.serialNumber})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>Action Type</label>
                                    <select
                                        value={actionType}
                                        onChange={(e) => setActionType(e.target.value)}
                                        className='w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:border-amber-500'
                                    >
                                        <option value='Lock Phone'>Lock Phone (ចាក់សោទូរស័ព្ទ)</option>
                                        <option value='Unlock Phone'>Unlock Phone (ដោះសោទូរស័ព្ទ)</option>
                                        <option value='Set Wallpaper'>Set Wallpaper (ដាក់ Wallpaper)</option>
                                        <option value='Lock Wallpaper'>Lock Wallpaper (លាក់ Wallpaper)</option>
                                        <option value='Unlock Wallpaper'>Unlock Wallpaper (បើក Wallpaper)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>Initial Status</label>
                                    <select
                                        value={actionStatus}
                                        onChange={(e) => setActionStatus(e.target.value)}
                                        className='w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:border-amber-500'
                                    >
                                        <option value='Pending'>Pending (រង់ចាំអ្នកចុច Done)</option>
                                        <option value='Success'>Success (ជោគជ័យភ្លាមៗ)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className='block font-bold text-slate-700 mb-1'>Reason / Description</label>
                                <input
                                    type='text'
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    placeholder='E.g. Lock device due to overdue payment'
                                    className='w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-amber-500 bg-slate-50'
                                />
                            </div>

                            <div className='pt-3 flex items-center justify-end gap-2 border-t border-slate-100'>
                                <button
                                    type='button'
                                    onClick={() => setOpenActionModal(false)}
                                    className='px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer'
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type='submit'
                                    disabled={submittingAction || !selectedContractId}
                                    className='px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer'
                                >
                                    {submittingAction ? 'Saving...' : 'Record History'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Pagination */}
            <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={LIMIT}
                onPageChange={setPage}
            />
        </div>
    );
};

export default DeviceActionHistory;
