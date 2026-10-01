import React, { useState, useEffect } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import CopyCell from '../../../components/CopyCell';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdInfo, MdCheckCircle, MdSearch, MdSwapHoriz, MdComment, MdPictureAsPdf, MdOutlineWallpaper } from "react-icons/md";
import { FaLock, FaFileExcel, FaHistory, FaCalendarAlt } from "react-icons/fa";
import CustomModal from '../../../components/CustomModal';
import Pagination from '../../../components/Pagination';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import ContractActivityHistoryModal from '../components/ContractActivityHistoryModal';

const Activated = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, API_BASE2, hasPermission, user } = useAuth();
    const navigate = useNavigate();

    const [activatedContracts, setActivatedContracts] = useState([]);
    const [calcSchedules, setCalcSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const itemsPerPage = 10;

    const [openMenuId, setOpenMenuId] = useState(null);
    const [selectedInfo, setSelectedInfo] = useState(null);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [editData, setEditData] = useState(null);
    const [openEditModal, setOpenEditModal] = useState(false);

    // Comment Modal State
    const [selectedCommentItem, setSelectedCommentItem] = useState(null);
    const [commentInput, setCommentInput] = useState('');

    // UI Custom Modal alert state
    const [uiModal, setUiModal] = useState({ open: false, title: '', message: '', type: 'info' });

    // Helper functions for 3-way matching (Name, Principal, Loan Date)
    const normalizeStr = (str) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const normalizeNum = (val) => {
        if (val === undefined || val === null || val === '') return null;
        const clean = String(val).replace(/[^0-9.-]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? null : Math.round(num * 100) / 100;
    };

    const normalizeDateStr = (dateVal) => {
        if (!dateVal) return '';
        const clean = String(dateVal).trim().split('T')[0].split(' ')[0];
        const dmy = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (dmy) {
            return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        }
        const ymd = clean.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
        if (ymd) {
            return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
        }
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        return clean.toLowerCase();
    };

    // Fetch saved calculation schedules to link matching records
    const fetchCalcSchedules = React.useCallback(async () => {
        try {
            const brand = user?.brand || '';
            const username = user?.username || '';
            const role = user?.role || '';
            const isImmutable = user?.isImmutable ? 'true' : 'false';
            const base = API_BASE || API_BASE1 || '';
            const url = `${base}/calculate-schedules?userBrand=${encodeURIComponent(brand)}&username=${encodeURIComponent(username)}&userRole=${encodeURIComponent(role)}&isImmutable=${isImmutable}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setCalcSchedules(data.data);
                }
            }
        } catch (err) {
            console.error('Fetch calculate schedules error in Activated:', err);
        }
    }, [API_BASE, API_BASE1, user]);

    useEffect(() => {
        fetchCalcSchedules();
    }, [fetchCalcSchedules]);

    const fetchActivatedContracts = React.useCallback(async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        fetchCalcSchedules(); // Synchronize calculate schedules so bidirectional scan is always up-to-date
        try {
            const pageToFetch = typeof pg === 'number' ? pg : 1;
            const params = new URLSearchParams({
                status: 'Activated',
                page: pageToFetch,
                limit: itemsPerPage,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setActivatedContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch activated contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, itemsPerPage, searchTerm]);

    useEffect(() => {
        fetchActivatedContracts(currentPage, searchTerm);
    }, [currentPage]);

    useEffect(() => {
        setCurrentPage(1);
        fetchActivatedContracts(1, searchTerm);
    }, [searchTerm]);

    const filteredContracts = activatedContracts; // server already filters+paginates

    const [redeemItem, setRedeemItem] = useState(null);
    const [redeemDateInput, setRedeemDateInput] = useState(new Date().toISOString().split('T')[0]);

    const handleChangeStatus = async (item, targetStatus) => {
        if (!window.confirm(`តើអ្នកពិតជាប្រាកដថាចង់ផ្លាស់ប្តូរស្ថានភាពកុងត្រារបស់ "${item.customerNameEn || item.customerNameKh}" ទៅជា ${targetStatus} មែនទេ?`)) return;
        if (targetStatus === 'Redeem') {
            if (item.lockPhoneStatus === 'Locked' || item.lockWallpaperStatus === 'Locked') {
                const isPhoneLocked = item.lockPhoneStatus === 'Locked';
                const isWallpaperLocked = item.lockWallpaperStatus === 'Locked';
                let lockReason = '';
                if (isPhoneLocked && isWallpaperLocked) lockReason = 'ឧបករណ៍នេះកំពុងជាប់ចាក់សោរទាំង Lock Phone និង Lock Wallpaper';
                else if (isPhoneLocked) lockReason = 'ឧបករណ៍នេះកំពុងជាប់ចាក់សោរ Lock Phone';
                else lockReason = 'ឧបករណ៍នេះកំពុងជាប់ចាក់សោរ Lock Wallpaper';

                setUiModal({
                    open: true,
                    title: t('warning'),
                    message: `${lockReason}! សូមធ្វើការដោះសោរ (Unlock) ឧបករណ៍នេះជាមុនសិន ទើបប្រព័ន្ធអនុញ្ញាតឱ្យផ្លាស់ប្តូរទៅកាន់ Redeem បាន។`,
                    type: 'warning'
                });
                setOpenMenuId(null);
                return;
            }
            setRedeemItem(item);
            setRedeemDateInput(new Date().toISOString().split('T')[0]);
            setOpenMenuId(null);
            return;
        }
        try {
            const res = await fetch(`${API_BASE1}/contracts/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus })
            });
            if (res.ok) {
                setUiModal({
                    open: true,
                    title: 'Status Updated',
                    message: `Contract "${item.customerNameEn}" status successfully changed to ${targetStatus}!`,
                    type: 'success'
                });
                fetchActivatedContracts();
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Change status error:', err);
        }
    };

    const handleConfirmRedeem = async (e) => {
        e.preventDefault();
        if (!redeemItem) return;
        if (!window.confirm(`តើអ្នកពិតជាប្រាកដថាចង់បញ្ជាក់ការ Redeem សម្រាប់ "${redeemItem.customerNameEn}" មែនទេ?`)) return;
        try {
            const res = await fetch(`${API_BASE1}/contracts/${redeemItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Redeem',
                    redeemDate: redeemDateInput,
                    inputDate: redeemDateInput
                })
            });
            if (res.ok) {
                setUiModal({
                    open: true,
                    title: 'Redeem Successful',
                    message: `Contract for "${redeemItem.customerNameEn}" moved to Redeem page on date ${redeemDateInput}!`,
                    type: 'success'
                });
                setRedeemItem(null);
                fetchActivatedContracts();
            }
        } catch (err) {
            console.error('Confirm redeem error:', err);
        }
    };

    const handleQuickDeviceAction = async (item, actionType) => {
        if (!window.confirm(`តើអ្នកពិតជាប្រាកដថាចង់បញ្ជូនសកម្មភាព [ ${actionType} ] លើឧបករណ៍របស់ "${item.customerNameEn || item.customerNameKh}" មែនទេ?`)) return;
        try {
            const res = await fetch(`${API_BASE2}/history/device-actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: item.contractId,
                    actionType,
                    status: 'Pending',
                    performedBy: 'Administrator',
                    reason: `${actionType} initiated from Activated Contracts page`
                })
            });
            if (res.ok) {
                setUiModal({
                    open: true,
                    title: `${actionType} Initiated`,
                    message: `${actionType} recorded in Activated Device Action History with status Pending! Click Done in History page once complete.`,
                    type: 'success'
                });
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Quick action error:', err);
        }
    };

    const handleSaveComment = async (e) => {
        e.preventDefault();
        if (!selectedCommentItem) return;

        try {
            const res = await fetch(`${API_BASE1}/contracts/${selectedCommentItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes: commentInput
                })
            });

            if (res.ok) {
                setUiModal({
                    open: true,
                    title: 'Comment Saved',
                    message: `Comment added for "${selectedCommentItem.customerNameEn}". The contract remains Activated and is also visible in Comments.`,
                    type: 'success'
                });
                setSelectedCommentItem(null);
                setCommentInput('');
                fetchActivatedContracts();
            }
        } catch (err) {
            console.error('Save comment error:', err);
        }
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all for export error:', err);
        }
        return activatedContracts;
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
            'Status': c.status || 'Activated',
        }));
        exportToExcel(data, 'Activated_Contracts');
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
        exportToPDF('Activated Contracts Directory', columns, allData, user?.brand || '', orientation);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4 relative'>

            {/* UI Custom Modal Popup */}
            <CustomModal
                open={uiModal.open}
                title={uiModal.title}
                message={uiModal.message}
                type={uiModal.type}
                onConfirm={() => setUiModal({ ...uiModal, open: false })}
            />

            {/* Redeem Date Selection Modal */}
            {redeemItem && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[999999] p-2">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                <MdSwapHoriz className="text-purple-600 text-lg" />
                                ជ្រើសរើស{t('redeem')} {t('date')}
                            </h3>
                            <button onClick={() => setRedeemItem(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
                        </div>

                        <form onSubmit={handleConfirmRedeem} className="space-y-4">
                            <div className="p-1 bg-purple-50 border border-purple-200 rounded-[5px] text-xs space-y-1">
                                <p className="font-bold text-purple-900">អតិថិជន៖ {redeemItem.customerNameEn} ({redeemItem.customerNameKh})</p>
                                <p className="text-purple-700 font-mono">ម៉ូឌែល/Serial: {redeemItem.model} • {redeemItem.serialNumber}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    {t('redeem')} {t('date')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={redeemDateInput}
                                    onChange={(e) => setRedeemDateInput(e.target.value)}
                                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-[5px] text-slate-900 font-mono font-bold text-sm focus:outline-emerald-500"
                                />
                                <p className="text-[11px] text-slate-500 mt-1 italic">
                                    * បំពេញអូតូថ្ងៃបច្ចុប្បន្ន។ អ្នកអាចប្តូរដាក់ថ្ងៃផ្សេងៗបានតាមតម្រូវការ។
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRedeemItem(null)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-[5px] text-xs font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-purple-600 text-white rounded-[5px] text-xs font-bold hover:bg-purple-700 shadow-md shadow-purple-600/30 cursor-pointer flex items-center gap-1.5"
                                >
                                    <MdSwapHoriz size={16} /> Submit Redeem
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className='p-1 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-indigo-400 flex items-center gap-2'>
                        <span>{t('activated')}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                            {filteredContracts.length} Records
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Search name, model, serial..."
                            className="pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-52 outline-none font-medium shadow-xs"
                        />
                    </div>

                    {/* Export to Excel & PDF */}
                    {hasPermission('/contract/activated', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}

                </div>
            </header>

            {/* Table */}
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
                            <th className='px-4 py-1'>Brand</th>
                            <th className='px-4 py-1'>{t('serialNumber')}</th>
                            <th className='px-4 py-1 text-center'>Monthly</th>
                            <th className='px-4 py-1 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {filteredContracts.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-8 text-slate-500 italic font-medium">
                                    {searchTerm ? `No results found for "${searchTerm}"` : 'No activated contracts yet. Activate contracts in Application page first.'}
                                </td>
                            </tr>
                        ) : (
                            filteredContracts.map((item, idx) => {
                                const canOpenMosyle = !!(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL);
                                const canOpenFb = hasPermission('/contract/activated', 'openFacebook') && !!item.urlFb;
                                const canHistory = hasPermission('/contract/activated', 'history');
                                const canComment = hasPermission('/contract/activated', 'comment');
                                const canLock = hasPermission('/contract/activated', 'lockDevice');
                                const canWallpaper = hasPermission('/contract/activated', 'setWallpaper');
                                const canCheck = hasPermission('/contract/activated', 'check');
                                const canBlacklist = hasPermission('/contract/activated', 'blacklist');
                                const matchingCalcSchedule = calcSchedules.find(s => {
                                    // 1. Match Customer Name (Khmer or English)
                                    const sName = normalizeStr(s.customerName);
                                    if (!sName) return false;
                                    const itemKh = normalizeStr(item.customerNameKh);
                                    const itemEn = normalizeStr(item.customerNameEn);
                                    const isNameMatch = (
                                        (itemKh && (sName === itemKh || sName.includes(itemKh) || itemKh.includes(sName))) ||
                                        (itemEn && (sName === itemEn || sName.includes(itemEn) || itemEn.includes(sName)))
                                    );
                                    if (!isNameMatch) return false;

                                    // 2. Match Principal / Loan Amount (ប្រាក់ដើម)
                                    const sPrincipal = normalizeNum(s.principal);
                                    const itemPrincipal = normalizeNum(item.amount ?? item.totalAmount);
                                    if (sPrincipal === null || itemPrincipal === null || sPrincipal !== itemPrincipal) {
                                        return false;
                                    }

                                    // 3. Match Loan Date / Start Date (ថ្ងៃខែដាក់កម្ចី)
                                    const sDate = normalizeDateStr(s.startDate);
                                    const itemDate = normalizeDateStr(item.inputDate);
                                    if (!sDate || !itemDate || sDate !== itemDate) {
                                        return false;
                                    }

                                    return true;
                                });
                                const hasAnyAction = canOpenMosyle || canOpenFb || canHistory || canComment || canLock || canWallpaper || canCheck || canBlacklist || !!matchingCalcSchedule;

                                return (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-slate-700 font-medium'>{item.inputDate}</td>
                                    <td className='px-4 py-1'>
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                                <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs block font-semibold' />
                                            </div>
                                        </div>
                                    </td>
                                    <td className='px-4 py-1 text-center'>
                                        <span className='px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px] uppercase'>
                                            Activated
                                        </span>
                                    </td>
                                    <td className='px-4 py-1 text-center font-mono text-indigo-700 font-bold'>
                                        <CopyCell text={item.contractIid || '—'} className='font-mono font-bold text-indigo-700' />
                                    </td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1'>
                                        <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                            {item.brand || '—'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-1 font-mono text-slate-600 font-medium'><CopyCell text={item.serialNumber} className='font-mono text-slate-600 font-medium' /></td>
                                    <td className='px-4 py-1 text-center font-mono font-bold text-emerald-700'>${item.monthlyPayment}/mo</td>
                                    <td className="px-4 py-1 text-center relative">
                                        <div className="flex items-center justify-center gap-2">
                                            {hasAnyAction ? (
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)}
                                                        className="w-8 h-8 rounded-[5px] bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-2xs"
                                                    >
                                                        <AiOutlineMenu size={16} />
                                                    </button>

                                                    {openMenuId === item._id && (
                                                        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-[5px] shadow-xl z-[99999] p-1.5 space-y-1 animate-in fade-in duration-150">
                                                            {matchingCalcSchedule && (
                                                                <button
                                                                    onClick={() => {
                                                                        navigate(`/calculate/schedule-2?customerName=${encodeURIComponent(matchingCalcSchedule.customerName || item.customerNameKh || '')}&id=${matchingCalcSchedule._id}`);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 rounded-[5px] flex items-center gap-2 cursor-pointer transition-colors"
                                                                >
                                                                    <FaCalendarAlt className="text-emerald-600 text-sm" />
                                                                    <span>Payment Schedule</span>
                                                                </button>
                                                            )}
                                                            {canOpenMosyle && (
                                                                <button
                                                                    onClick={() => window.open(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL, '_blank')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <span>Open Mosyle</span>
                                                                </button>
                                                            )}
                                                            {canOpenFb && (
                                                                <button
                                                                    onClick={() => window.open(item.urlFb, '_blank')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <span>Open Facebook</span>
                                                                </button>
                                                            )}

                                                            {canHistory && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedHistoryItem(item);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <FaHistory className="text-indigo-600 text-sm" />
                                                                    <span>{t('history')}</span>
                                                                </button>
                                                            )}

                                                            {canComment && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCommentItem(item);
                                                                        setCommentInput(item.notes || '');
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <MdComment className="text-cyan-600 text-base" />
                                                                    <span>Comment</span>
                                                                </button>
                                                            )}
                                                            {canLock && (
                                                                <button
                                                                    onClick={() => handleQuickDeviceAction(item, 'Lock Phone')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <FaLock className="text-red-600 text-sm" />
                                                                    <span>Lock Device</span>
                                                                </button>
                                                            )}
                                                            {canWallpaper && (
                                                                <button
                                                                    onClick={() => handleQuickDeviceAction(item, 'Set Wallpaper')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <MdOutlineWallpaper className="text-amber-600 text-sm" />
                                                                    <span>Set Wallpaper</span>
                                                                </button>
                                                            )}
                                                            {canCheck && (
                                                                <button
                                                                    onClick={() => handleChangeStatus(item, 'Check')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <MdSwapHoriz className="text-blue-600 text-base" />
                                                                    <span>Check</span>
                                                                </button>
                                                            )}
                                                            {canBlacklist && (
                                                                <button
                                                                    onClick={() => handleChangeStatus(item, 'Blacklist')}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 rounded-[5px] flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <MdSwapHoriz className="text-red-600 text-base" />
                                                                    <span>Blacklist</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-mono text-[11px]">—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })
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

            {/* Comment Input Modal */}
            {selectedCommentItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-2">
                    <form onSubmit={handleSaveComment} className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                                <MdComment className="text-lg" /> Add Comment Note
                            </h3>
                            <button type="button" onClick={() => setSelectedCommentItem(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>

                        <div className="p-1 bg-gray-900/60 rounded-[5px] border border-gray-800 text-xs">
                            <p className="text-gray-400">Customer: <span className="text-gray-100 font-bold">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="text-gray-400">Model: <span className="text-gray-200 font-semibold">{selectedCommentItem.model}</span></p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Enter Comment Note</label>
                            <textarea
                                required
                                rows={4}
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                placeholder="Type comment or notes about this contract..."
                                className="w-full p-1 bg-gray-900 border border-gray-700 rounded-[5px] text-xs text-gray-100 outline-none focus:border-cyan-500 font-sans"
                            ></textarea>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedCommentItem(null)}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-[5px] text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-cyan-600/30"
                            >
                                Submit Comment
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Information Modal */}
            {selectedInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                                <MdInfo className="text-indigo-400 text-xl" />
                                Activated Contract Details
                            </h3>
                            <button onClick={() => setSelectedInfo(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold cursor-pointer">✕</button>
                        </div>

                        <div className="flex items-center gap-4 p-2 rounded-[5px] bg-gray-900/60 border border-gray-800">
                            <div className='flex gap-3 justify-center items-center'>
                                <h4 className="text-base font-bold text-gray-100">{selectedInfo.customerNameEn}</h4>
                                <p className="text-sm text-indigo-400 font-khmer">{selectedInfo.customerNameKh}</p>
                                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                    Activated
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-indigo-300 uppercase">Customer Info</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 bg-gray-900/60 rounded-[5px] border border-gray-800"><span className="text-gray-400 block text-[10px]">Contract ID</span><span className="font-mono text-gray-200 font-bold">{selectedInfo.contractId}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-[5px] border border-gray-800"><span className="text-gray-400 block text-[10px]">ID Card</span><span className="font-mono text-gray-200">{selectedInfo.idCardNumber || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-[5px] border border-gray-800"><span className="text-gray-400 block text-[10px]">Phone</span><span className="font-mono text-gray-200">{selectedInfo.phone || '-'}</span></div>
                            </div>
                        </div>

                        <div className="text-right pt-2">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-[5px] cursor-pointer">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Activity History Modal */}
            {selectedHistoryItem && (
                <ContractActivityHistoryModal
                    contract={selectedHistoryItem}
                    onClose={() => setSelectedHistoryItem(null)}
                />
            )}

        </div>
    );
};

export default Activated;