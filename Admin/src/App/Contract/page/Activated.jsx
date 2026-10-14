import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import CopyCell from '../../../components/CopyCell';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdInfo, MdCheckCircle, MdSwapHoriz, MdComment, MdPictureAsPdf, MdOutlineWallpaper, MdDateRange } from "react-icons/md";
import { FaLock, FaFileExcel, FaHistory, FaCalendarAlt, FaUsers, FaClock, FaFilter, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
import CustomModal from '../../../components/CustomModal';
import Pagination from '../../../components/Pagination';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import ContractActivityHistoryModal from '../components/ContractActivityHistoryModal';
import ContractSearchInput from '../../../components/ContractSearchInput';
import { getKhmerCurrentDateString } from '../../../utils/khmerDateUtils';

const Activated = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, API_BASE2, hasPermission, user } = useAuth();
    const navigate = useNavigate();

    const [activatedContracts, setActivatedContracts] = useState([]);
    const [calcSchedules, setCalcSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedContractId, setSelectedContractId] = useState('');
    const [locatedIndex, setLocatedIndex] = useState(null);
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
    const [isDateAppended, setIsDateAppended] = useState(false);

    // UI Custom Modal alert state
    const [uiModal, setUiModal] = useState({ open: false, title: '', message: '', type: 'info' });

    // Full Activated contracts list for overall statistics across whole database
    const [allActivatedList, setAllActivatedList] = useState([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryExpanded, setSummaryExpanded] = useState(true);
    const [selectedDurationFilter, setSelectedDurationFilter] = useState(null);
    const [selectedMonthFilter, setSelectedMonthFilter] = useState(null);

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

    // Khmer Month dictionary for accurate calendar parsing
    const KHMER_MONTH_NAMES = {
        '01': 'មករា',
        '02': 'កុម្ភៈ',
        '03': 'មីនា',
        '04': 'មេសា',
        '05': 'ឧសភា',
        '06': 'មិថុនា',
        '07': 'កក្កដា',
        '08': 'សីហា',
        '09': 'កញ្ញា',
        '10': 'តុលា',
        '11': 'វិច្ឆិកា',
        '12': 'ធ្នូ',
    };

    const parseMonthKey = useCallback((dateVal) => {
        if (!dateVal) return null;
        const clean = String(dateVal).trim().split('T')[0].split(' ')[0];
        const ymd = clean.match(/^(\d{4})[-\/](\d{1,2})/);
        if (ymd) {
            const m = String(ymd[2]).padStart(2, '0');
            const y = ymd[1];
            return {
                key: `${y}-${m}`,
                year: y,
                month: m,
                labelKh: `ខែ ${m}/${y} (${KHMER_MONTH_NAMES[m] || m})`,
                labelEn: `${m}/${y}`
            };
        }
        const dmy = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dmy) {
            const m = String(dmy[2]).padStart(2, '0');
            const y = dmy[3];
            return {
                key: `${y}-${m}`,
                year: y,
                month: m,
                labelKh: `ខែ ${m}/${y} (${KHMER_MONTH_NAMES[m] || m})`,
                labelEn: `${m}/${y}`
            };
        }
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
            const y = String(d.getFullYear());
            const m = String(d.getMonth() + 1).padStart(2, '0');
            return {
                key: `${y}-${m}`,
                year: y,
                month: m,
                labelKh: `ខែ ${m}/${y} (${KHMER_MONTH_NAMES[m] || m})`,
                labelEn: `${m}/${y}`
            };
        }
        return null;
    }, []);

    const parseDurationKey = useCallback((durationVal) => {
        if (!durationVal) return { key: 'unspecified', num: 9999, labelKh: 'មិនបានបញ្ជាក់', labelEn: 'Unspecified' };
        const str = String(durationVal).trim().toLowerCase();
        const matched = str.match(/\d+/);
        if (!matched) return { key: 'other', num: 9998, labelKh: 'ផ្សេងៗ', labelEn: 'Other' };
        const num = parseInt(matched[0], 10);
        return {
            key: `${num}_months`,
            num,
            labelKh: `${num} ខែ`,
            labelEn: `${num} Mo`
        };
    }, []);

    // Fetch saved calculation schedules to link matching records
    const fetchCalcSchedules = useCallback(async () => {
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

    // Fetch entire activated list for accurate summary metrics
    const fetchFullActivated = useCallback(async () => {
        setSummaryLoading(true);
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
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAllActivatedList(data.data || []);
            }
        } catch (err) {
            console.error('Fetch full activated for summary error:', err);
        } finally {
            setSummaryLoading(false);
        }
    }, [API_BASE1, user]);

    useEffect(() => {
        fetchFullActivated();
    }, [fetchFullActivated]);

    const fetchActivatedContracts = useCallback(async (pg = currentPage, search = searchTerm, contractId = selectedContractId) => {
        setReloading(true);
        fetchCalcSchedules();
        fetchFullActivated();
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
            if (contractId) params.set('locateId', contractId);
            else if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setActivatedContracts(data.data || []);
                setTotal(data.total || 0);
                if (contractId) {
                    setLocatedIndex(data.locateIndex >= 0 ? data.locateIndex : null);
                    setCurrentPage(data.page || pageToFetch);
                } else {
                    setLocatedIndex(null);
                }
            }
        } catch (err) {
            console.error('Fetch activated contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, itemsPerPage, searchTerm, selectedContractId, fetchCalcSchedules, fetchFullActivated]);

    useEffect(() => {
        fetchActivatedContracts(currentPage, searchTerm, selectedContractId);
    }, [currentPage, fetchActivatedContracts, searchTerm, selectedContractId]);

    // Computed Summary Data by Loan Duration and Calendar Month
    const summaryData = useMemo(() => {
        const grandTotalCount = allActivatedList.length;
        let grandTotalAmount = 0;
        let grandTotalMonthly = 0;

        const durationMap = {};
        const monthMap = {};

        allActivatedList.forEach(c => {
            const amt = Number(c.amount || c.totalAmount || 0);
            const monthly = Number(c.monthlyPayment || 0);
            grandTotalAmount += amt;
            grandTotalMonthly += monthly;

            // 1. Group by Loan Duration (រយៈពេលកម្ចី)
            const dObj = parseDurationKey(c.duration);
            if (!durationMap[dObj.key]) {
                durationMap[dObj.key] = {
                    key: dObj.key,
                    num: dObj.num,
                    labelKh: dObj.labelKh,
                    labelEn: dObj.labelEn,
                    count: 0,
                    totalAmount: 0,
                    totalMonthly: 0
                };
            }
            durationMap[dObj.key].count += 1;
            durationMap[dObj.key].totalAmount += amt;
            durationMap[dObj.key].totalMonthly += monthly;

            // 2. Group by Submission Month (ខែប្រតិទិនដែលបានដាក់ស្នើ)
            const mDate = c.inputDate || (c.createdAt ? String(c.createdAt).split('T')[0] : '');
            const mObj = parseMonthKey(mDate);
            const mKey = mObj ? mObj.key : 'unknown';
            if (!monthMap[mKey]) {
                monthMap[mKey] = {
                    key: mKey,
                    labelKh: mObj ? mObj.labelKh : 'គ្មានកាលបរិច្ឆេទ',
                    labelEn: mObj ? mObj.labelEn : 'No Date',
                    year: mObj ? mObj.year : '0000',
                    month: mObj ? mObj.month : '00',
                    count: 0,
                    totalAmount: 0,
                    totalMonthly: 0
                };
            }
            monthMap[mKey].count += 1;
            monthMap[mKey].totalAmount += amt;
            monthMap[mKey].totalMonthly += monthly;
        });

        const durationList = Object.values(durationMap).sort((a, b) => a.num - b.num);
        const monthList = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key));

        return {
            grandTotalCount,
            grandTotalAmount,
            grandTotalMonthly,
            durationList,
            monthList
        };
    }, [allActivatedList, parseDurationKey, parseMonthKey]);

    const isSummaryFilterActive = Boolean(selectedDurationFilter || selectedMonthFilter);

    const handleToggleDurationFilter = (durationKey) => {
        setSelectedDurationFilter(prev => prev === durationKey ? null : durationKey);
        setCurrentPage(1);
    };

    const handleToggleMonthFilter = (monthKey) => {
        setSelectedMonthFilter(prev => prev === monthKey ? null : monthKey);
        setCurrentPage(1);
    };

    const handleClearSummaryFilters = () => {
        setSelectedDurationFilter(null);
        setSelectedMonthFilter(null);
        setCurrentPage(1);
    };

    // Client-side filtered list when user clicks on a duration or month badge
    const activeFilteredContracts = useMemo(() => {
        if (!isSummaryFilterActive) return [];
        let list = allActivatedList;
        if (selectedDurationFilter) {
            list = list.filter(c => parseDurationKey(c.duration).key === selectedDurationFilter);
        }
        if (selectedMonthFilter) {
            list = list.filter(c => {
                const mDate = c.inputDate || (c.createdAt ? String(c.createdAt).split('T')[0] : '');
                const mObj = parseMonthKey(mDate);
                return (mObj ? mObj.key : 'unknown') === selectedMonthFilter;
            });
        }
        if (selectedContractId) {
            list = list.filter(contract => String(contract._id) === selectedContractId || contract.contractId === selectedContractId);
        } else if (searchTerm) {
            const s = searchTerm.toLowerCase();
            list = list.filter(c =>
                (c.customerNameEn && c.customerNameEn.toLowerCase().includes(s)) ||
                (c.customerNameKh && c.customerNameKh.toLowerCase().includes(s)) ||
                (c.phone && c.phone.includes(s)) ||
                (c.serialNumber && c.serialNumber.toLowerCase().includes(s)) ||
                (c.model && c.model.toLowerCase().includes(s)) ||
                (c.contractId && c.contractId.toLowerCase().includes(s))
            );
        }
        return list;
    }, [isSummaryFilterActive, allActivatedList, selectedDurationFilter, selectedMonthFilter, selectedContractId, searchTerm, parseDurationKey, parseMonthKey]);

    // Final list of contracts to display in table
    const displayedContracts = useMemo(() => {
        if (isSummaryFilterActive) {
            const start = (currentPage - 1) * itemsPerPage;
            return activeFilteredContracts.slice(start, start + itemsPerPage);
        }
        return selectedContractId
            ? activatedContracts.filter(contract => String(contract._id) === selectedContractId || contract.contractId === selectedContractId)
            : activatedContracts;
    }, [isSummaryFilterActive, activeFilteredContracts, currentPage, itemsPerPage, selectedContractId, activatedContracts]);

    const displayedTotal = isSummaryFilterActive ? activeFilteredContracts.length : total;

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

    const handleAppendDate = () => {
        const dateText = getKhmerCurrentDateString();
        setCommentInput(prev => {
            const trimmed = (prev || '').trim();
            if (!trimmed) return dateText;
            if (trimmed.endsWith(dateText)) return trimmed;
            return `${trimmed} ${dateText}`;
        });
        setIsDateAppended(true);
    };

    const handleSaveComment = async (e) => {
        e.preventDefault();
        if (!selectedCommentItem) return;

        try {
            const res = await fetch(`${API_BASE1}/contracts/${selectedCommentItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes: commentInput,
                    lastModifiedBy: user?.username || 'Staff'
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
                setIsDateAppended(false);
                fetchActivatedContracts();
            }
        } catch (err) {
            console.error('Save comment error:', err);
        }
    };

    const fetchAllForExport = async () => {
        if (isSummaryFilterActive) {
            return activeFilteredContracts;
        }
        if (allActivatedList.length > 0 && !searchTerm && !selectedContractId) {
            return allActivatedList;
        }
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
            if (selectedContractId) params.set('contractId', selectedContractId);
            else if (searchTerm) params.set('search', searchTerm);
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
            'Input Date': c.inputDate || '',
            'Name (EN)': c.customerNameEn || '',
            'Name (KH)': c.customerNameKh || '',
            'ID Card': c.idCardNumber || '',
            'DOB': c.dob || '',
            'Gender': c.gender || '',
            'Phone': c.phone || '',
            'Device Model': c.model || '',
            'Serial Number': c.serialNumber || '',
            'Duration': c.duration || '',
            'Total Amount ($)': c.amount || c.totalAmount || 0,
            'Monthly ($)': c.monthlyPayment || 0,
            'Phone Lock Status': c.lockPhoneStatus || 'Unlocked',
            'Wallpaper Lock Status': c.lockWallpaperStatus || 'Unlocked',
            'Status': c.status || 'Activated',
        }));
        exportToExcel(data, 'Activated_Contracts');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Input Date', accessor: 'inputDate' },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Monthly ($)', cell: (r) => `$${r.monthlyPayment}` },
            { header: 'Phone Lock Status', accessor: 'lockPhoneStatus' },
            { header: 'Wallpaper Lock Status', accessor: 'lockWallpaperStatus' },
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
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded-[5px] text-xs space-y-1">
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
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-indigo-400 flex items-center gap-2'>
                        <span>{t('activated')}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                            {displayedTotal} Records
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <ContractSearchInput
                            value={searchInput}
                            apiBase={API_BASE1}
                            user={user}
                            status="Activated"
                            placeholder="Search name, model, serial..."
                            onChange={(value) => {
                                setSearchInput(value);
                                setSearchTerm(value);
                                setSelectedContractId('');
                                setLocatedIndex(null);
                                setCurrentPage(1);
                            }}
                            onSelect={(contract) => {
                                setSearchInput(contract.customerNameEn || contract.customerNameKh || contract.contractId || '');
                                setSearchTerm('');
                                setSelectedContractId(String(contract.contractId || contract._id || ''));
                                setCurrentPage(1);
                            }}
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

            {/* Applications Summary Dashboard (By Duration & Calendar Month) */}
            <div className="w-full bg-white border border-slate-200 rounded-[5px] p-3 shadow-xs space-y-3">
                {/* Summary Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                            <FaUsers size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <span>ស្ថិតិសរុបភ្ញៀវដាក់ស្នើ (Applications Breakdown)</span>
                                {summaryLoading && (
                                    <MdOutlineSync className="animate-spin text-emerald-600 text-sm" />
                                )}
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">
                                សរុបភ្ញៀវតាមរយៈពេលកម្ចីប៉ុន្មានខែ (Duration) និងតាមខែប្រតិទិនដែលបានដាក់ស្នើ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Grand Total Counters */}
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-[5px]">
                            <span className="text-[11px] text-emerald-800 font-bold">ភ្ញៀវសរុប៖</span>
                            <span className="text-xs font-black text-emerald-700 font-mono">{summaryData.grandTotalCount.toLocaleString()} នាក់</span>
                        </div>
                        {summaryData.grandTotalAmount > 0 && (
                            <div className="hidden md:flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-[5px]">
                                <span className="text-[11px] text-blue-800 font-bold">កម្ចីសរុប៖</span>
                                <span className="text-xs font-black text-blue-700 font-mono">${summaryData.grandTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        )}

                        {/* Toggle Collapse/Expand Button */}
                        <button
                            type="button"
                            onClick={() => setSummaryExpanded(!summaryExpanded)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[5px] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title={summaryExpanded ? "បង្រួម" : "ពង្រីក"}
                        >
                            {summaryExpanded ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                            <span className="text-[11px]">{summaryExpanded ? 'បង្រួម' : 'ពង្រីក'}</span>
                        </button>
                    </div>
                </div>

                {summaryExpanded && (
                    <div className="space-y-3 pt-0.5">
                        {/* 2-Column Grid: 1. By Duration, 2. By Month */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Column 1: By Loan Duration */}
                            <div className="bg-slate-50/70 border border-slate-200 rounded-[5px] p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <FaClock className="text-indigo-600 text-xs" />
                                        <span className="text-xs font-bold text-slate-800">
                                            ១. សរុបតាមរយៈពេលកម្ចី (By Loan Duration)
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500 font-medium">
                                        {summaryData.durationList.length} ប្រភេទ
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {summaryData.durationList.length === 0 ? (
                                        <span className="text-xs text-slate-400 italic">មិនទាន់មានទិន្នន័យ</span>
                                    ) : (
                                        summaryData.durationList.map((d) => {
                                            const isSelected = selectedDurationFilter === d.key;
                                            const pct = summaryData.grandTotalCount > 0
                                                ? Math.round((d.count / summaryData.grandTotalCount) * 100)
                                                : 0;
                                            return (
                                                <button
                                                    key={d.key}
                                                    type="button"
                                                    onClick={() => handleToggleDurationFilter(d.key)}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] border text-xs transition-all cursor-pointer shadow-2xs ${
                                                        isSelected
                                                            ? 'bg-indigo-600 border-indigo-700 text-white font-bold ring-2 ring-indigo-300'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                                                    }`}
                                                    title={`ចុចដើម្បីច្រោះមើលភ្ញៀវដាក់ស្នើ ${d.labelKh}`}
                                                >
                                                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                                        {d.labelKh}
                                                        <span className={`ml-1 text-[10px] font-normal opacity-80 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                            ({d.labelEn})
                                                        </span>
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-black ${
                                                            isSelected
                                                                ? 'bg-indigo-800 text-white'
                                                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                        }`}>
                                                            {d.count} នាក់
                                                        </span>
                                                        <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Column 2: By Submission Month */}
                            <div className="bg-slate-50/70 border border-slate-200 rounded-[5px] p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <FaCalendarAlt className="text-emerald-600 text-xs" />
                                        <span className="text-xs font-bold text-slate-800">
                                            ២. សរុបតាមខែដាក់ស្នើ (By Submission Month)
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500 font-medium">
                                        {summaryData.monthList.length} ខែ
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                                    {summaryData.monthList.length === 0 ? (
                                        <span className="text-xs text-slate-400 italic">មិនទាន់មានទិន្នន័យ</span>
                                    ) : (
                                        summaryData.monthList.map((m) => {
                                            const isSelected = selectedMonthFilter === m.key;
                                            const pct = summaryData.grandTotalCount > 0
                                                ? Math.round((m.count / summaryData.grandTotalCount) * 100)
                                                : 0;
                                            return (
                                                <button
                                                    key={m.key}
                                                    type="button"
                                                    onClick={() => handleToggleMonthFilter(m.key)}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] border text-xs transition-all cursor-pointer shadow-2xs ${
                                                        isSelected
                                                            ? 'bg-emerald-600 border-emerald-700 text-white font-bold ring-2 ring-emerald-300'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                                                    }`}
                                                    title={`ចុចដើម្បីច្រោះមើលភ្ញៀវដាក់ស្នើក្នុង ${m.labelKh}`}
                                                >
                                                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                                        {m.labelKh}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-black ${
                                                            isSelected
                                                                ? 'bg-emerald-800 text-white'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {m.count} នាក់
                                                        </span>
                                                        <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Active Filter Notification Banner */}
                        {(selectedDurationFilter || selectedMonthFilter) && (
                            <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-[5px] text-xs animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-amber-900 flex items-center gap-1">
                                        <FaFilter className="text-amber-600 text-xs" /> កំពុងច្រោះទិន្នន័យ៖
                                    </span>
                                    {selectedDurationFilter && (
                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold border border-indigo-200 text-[11px]">
                                            រយៈពេល៖ {summaryData.durationList.find(d => d.key === selectedDurationFilter)?.labelKh || selectedDurationFilter}
                                        </span>
                                    )}
                                    {selectedMonthFilter && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold border border-emerald-200 text-[11px]">
                                            ខែដាក់ស្នើ៖ {summaryData.monthList.find(m => m.key === selectedMonthFilter)?.labelKh || selectedMonthFilter}
                                        </span>
                                    )}
                                    <span className="text-slate-600 font-medium">
                                        (បង្ហាញ {activeFilteredContracts.length} នាក់)
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleClearSummaryFilters}
                                    className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-300 text-amber-900 rounded-[5px] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                    <FaTimes size={10} /> បង្ហាញទាំងអស់ (Clear)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className='w-full overflow-x-auto min-h-[400px] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
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
                            <th className='px-4 py-1 text-center'>Device Status</th>
                            <th className='px-4 py-1 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {displayedContracts.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="text-center py-8 text-slate-500 italic font-medium">
                                    {searchTerm || selectedContractId ? `No results found for "${searchInput}"` : isSummaryFilterActive ? 'រកមិនឃើញទិន្នន័យដែលត្រូវនឹងតម្រងដែលបានជ្រើសរើសឡើយ' : 'No activated contracts yet. Activate contracts in Application page first.'}
                                </td>
                            </tr>
                        ) : (
                            displayedContracts.map((item, idx) => {
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
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{selectedContractId && locatedIndex !== null ? locatedIndex + 1 : (currentPage - 1) * itemsPerPage + idx + 1}</td>
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
                                    <td className='px-4 py-1 text-center font-mono font-bold text-emerald-700'>
                                        <div>${item.monthlyPayment}/mo</div>
                                        {item.duration && (
                                            <span className='px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-sans font-semibold inline-block mt-0.5'>
                                                {item.duration}
                                            </span>
                                        )}
                                    </td>
                                    <td className='px-4 py-1 text-center whitespace-nowrap'>
                                        <span className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.lockPhoneStatus === 'Locked' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                                            Phone {item.lockPhoneStatus || 'Unlocked'}
                                        </span>
                                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.lockWallpaperStatus === 'Locked' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                                            Wallpaper {item.lockWallpaperStatus || 'Unlocked'}
                                        </span>
                                    </td>
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
                                                        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-[5px] shadow-xl z-[99999] p-2 space-y-1 animate-in fade-in duration-150">
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
                                                                        if (item.notes || item.commentHistory?.length) {
                                                                            const customerName = item.customerNameEn || item.customerNameKh || '';
                                                                            navigate(`/contract/comments?search=${encodeURIComponent(customerName)}&addComment=${encodeURIComponent(item._id)}`);
                                                                        } else {
                                                                            setSelectedCommentItem(item);
                                                                            setCommentInput('');
                                                                            setIsDateAppended(false);
                                                                        }
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
                totalItems={displayedTotal}
                itemsPerPage={itemsPerPage}
                onPageChange={(pg) => {
                    if (selectedContractId) {
                        setSelectedContractId('');
                        setSearchInput('');
                        setLocatedIndex(null);
                    }
                    setCurrentPage(pg);
                }}
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

                        <div className="p-2 bg-gray-900/60 rounded-[5px] border border-gray-800 text-xs">
                            <p className="text-gray-400">Customer: <span className="text-gray-100 font-bold">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="text-gray-400">Model: <span className="text-gray-200 font-semibold">{selectedCommentItem.model}</span></p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Enter Comment Note <span className="font-normal text-gray-500">(optional)</span></label>
                            <textarea
                                rows={4}
                                value={commentInput}
                                onChange={(e) => {
                                    setCommentInput(e.target.value);
                                    if (!e.target.value.includes('ថ្ងៃទី')) {
                                        setIsDateAppended(false);
                                    }
                                }}
                                placeholder="Type comment or leave blank..."
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-[5px] text-xs text-gray-100 outline-none focus:border-cyan-500 font-sans"
                            ></textarea>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => { setSelectedCommentItem(null); setIsDateAppended(false); }}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-[5px] text-xs font-bold"
                            >
                                Cancel
                            </button>
                            {!isDateAppended ? (
                                <button
                                    type="button"
                                    onClick={handleAppendDate}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <MdDateRange className="text-sm" />
                                    Input date
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 cursor-pointer"
                                >
                                    Save
                                </button>
                            )}
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