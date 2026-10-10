import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
    FaTelegramPlane, FaClipboardCheck, FaCalendarAlt, FaSearch, FaSync,
    FaLock, FaCheckCircle, FaExclamationTriangle, FaUserPlus, FaUserEdit,
    FaHistory, FaCopy, FaCheck, FaTimes, FaSpinner, FaFilter, FaArrowRight,
    FaClipboardList, FaEdit
} from 'react-icons/fa';
import { AiOutlineMenu } from 'react-icons/ai';

const formatDateToYMD = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getStatusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (s.includes('active') || s.includes('normal') || s.includes('good')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    }
    if (s.includes('pending') || s.includes('waiting') || s.includes('check')) {
        return 'bg-amber-50 text-amber-700 border-amber-300';
    }
    if (s.includes('suspend') || s.includes('block') || s.includes('restrict') || s.includes('danger')) {
        return 'bg-rose-50 text-rose-700 border-rose-300';
    }
    if (s.includes('not responding') || s.includes('inactive')) {
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-300';
};

const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);
    if (!text) return null;
    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(String(text));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy"}
            className="text-slate-400 hover:text-emerald-600 transition-colors p-1 cursor-pointer"
        >
            {copied ? <FaCheck className="text-emerald-600 text-xs" /> : <FaCopy className="text-xs" />}
        </button>
    );
};

const AuditTelegram = () => {
    const { user, API_BASE, API_BASE1 } = useAuth();
    const { t } = useLanguage();

    const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
    const [selectedDate, setSelectedDate] = useState(todayStr);

    // Data States
    const [contracts, setContracts] = useState([]);
    const [contactMap, setContactMap] = useState({});
    const [auditMap, setAuditMap] = useState({});
    const [distinctStatuses, setDistinctStatuses] = useState([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionInfo, setSubmissionInfo] = useState(null);

    // UI & Loading States
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [openMenuId, setOpenMenuId] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Audit Modal State
    const [auditModalItem, setAuditModalItem] = useState(null);
    const [auditForm, setAuditForm] = useState({
        statusAccount: '',
        customStatus: '',
        isCustomStatus: false,
        accountActivity: '',
        noteAudit: ''
    });
    const [savingAudit, setSavingAudit] = useState(false);

    // Contact Modal State (Add / Edit)
    const [contactModalItem, setContactModalItem] = useState(null);
    const [contactForm, setContactForm] = useState({
        contactName: '',
        username: '',
        phoneNumber: ''
    });
    const [savingContact, setSavingContact] = useState(false);

    // Activity Log History Modal State
    const [historyModalItem, setHistoryModalItem] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Confirmation Modals
    const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
    const [submittingDaily, setSubmittingDaily] = useState(false);
    const [jumpConfirmModal, setJumpConfirmModal] = useState(null);

    // ─── Real recorded statuses only from database/table (NO hardcoded values) ──
    const availableStatuses = useMemo(() => {
        const set = new Set();
        (distinctStatuses || []).forEach(s => s && set.add(String(s).trim()));
        Object.values(auditMap || {}).forEach(a => a?.statusAccount && set.add(String(a.statusAccount).trim()));
        return Array.from(set).filter(Boolean);
    }, [distinctStatuses, auditMap]);

    // ─── Fetch Contracts (from Activate) ───────────────────────────
    const fetchContracts = useCallback(async () => {
        try {
            const base = API_BASE1 || API_BASE || '';
            const params = new URLSearchParams({
                status: 'Activated',
                page: 1,
                limit: 500,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${base}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                setContracts(list);
            }
        } catch (err) {
            console.error('Error fetching contracts in AuditTelegram:', err);
        }
    }, [API_BASE, API_BASE1, user]);

    // ─── Fetch Daily Audit State ────────────────────────────────────
    const fetchAuditState = useCallback(async (targetDate = selectedDate) => {
        setReloading(true);
        try {
            const base = API_BASE || '';
            const res = await fetch(`${base}/telegram-audit?date=${encodeURIComponent(targetDate)}&brand=${encodeURIComponent(user?.brand || '')}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setContactMap(data.contactMap || {});
                    setAuditMap(data.auditMap || {});
                    setIsSubmitted(Boolean(data.isSubmitted));
                    setSubmissionInfo(data.submissionInfo || null);
                    if (Array.isArray(data.distinctStatuses)) {
                        setDistinctStatuses(data.distinctStatuses);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching audit state:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 400);
        }
    }, [API_BASE, selectedDate, user?.brand]);

    // Initial Load & on selectedDate Change
    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    useEffect(() => {
        fetchAuditState(selectedDate);
    }, [fetchAuditState, selectedDate]);

    // Close open menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.row-action-menu-container')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Filtered Table Rows ─────────────────────────────────────────
    const filteredRows = useMemo(() => {
        return contracts.map(contract => {
            const cId = String(contract._id);
            const contact = contactMap[cId] || {};
            const audit = auditMap[cId] || {};

            const customerName = contract.customerNameKh || contract.customerNameEn || contract.customerName || '—';
            const contractIid = contract.contractIid || contract.contractIdCustom || contract.contractId || contract._id || '—';
            const amount = contract.amount ?? contract.totalAmount ?? contract.phonePrice ?? contract.principal ?? 0;

            const contactName = contact.contactName || '';
            const username = contact.username || '';
            const phoneNumber = contact.phoneNumber || '';

            const statusAccount = audit.statusAccount || '';
            const accountActivity = audit.accountActivity || '';
            const noteAudit = audit.noteAudit || '';
            const auditDateTime = audit.auditDateTime || '';

            const hasContactInfo = Boolean(contactName || username || phoneNumber);
            const isAudited = Boolean(statusAccount || accountActivity || noteAudit);

            return {
                ...contract,
                rawContractId: cId,
                customerName,
                contractIid,
                amount,
                contactName,
                username,
                phoneNumber,
                statusAccount,
                accountActivity,
                noteAudit,
                auditDateTime,
                hasContactInfo,
                isAudited
            };
        }).filter(item => {
            // Search filter
            if (searchTerm.trim()) {
                const s = searchTerm.trim().toLowerCase();
                const matchSearch =
                    String(item.customerName).toLowerCase().includes(s) ||
                    String(item.contractIid).toLowerCase().includes(s) ||
                    String(item.contactName).toLowerCase().includes(s) ||
                    String(item.username).toLowerCase().includes(s) ||
                    String(item.phoneNumber).toLowerCase().includes(s) ||
                    String(item.statusAccount).toLowerCase().includes(s) ||
                    String(item.accountActivity).toLowerCase().includes(s) ||
                    String(item.noteAudit).toLowerCase().includes(s);
                if (!matchSearch) return false;
            }

            // Status filter
            if (statusFilter !== 'All') {
                if (statusFilter === 'Audited' && !item.isAudited) return false;
                if (statusFilter === 'Pending' && item.isAudited) return false;
                if (statusFilter !== 'Audited' && statusFilter !== 'Pending' && item.statusAccount !== statusFilter) return false;
            }

            return true;
        });
    }, [contracts, contactMap, auditMap, searchTerm, statusFilter]);

    // Pagination slice
    const totalItems = filteredRows.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRows.slice(start, start + itemsPerPage);
    }, [filteredRows, currentPage, itemsPerPage]);

    // Counters
    const auditedCount = useMemo(() => filteredRows.filter(r => r.isAudited).length, [filteredRows]);
    const pendingCount = totalItems - auditedCount;

    // ─── Open Audit Modal ────────────────────────────────────────────
    const handleOpenAuditModal = (row) => {
        if (isSubmitted) {
            alert('ទិន្នន័យសម្រាប់ថ្ងៃនេះត្រូវបាន Submit និងចាក់សោររួចហើយ មិនអាចកែប្រែបានទៀតទេ!');
            return;
        }
        setAuditModalItem(row);
        const currentStatus = row.statusAccount || '';
        const existsInSuggestions = availableStatuses.includes(currentStatus);

        const hasOptions = availableStatuses.length > 0;
        setAuditForm({
            statusAccount: existsInSuggestions || !currentStatus ? currentStatus : '__CUSTOM__',
            customStatus: existsInSuggestions ? '' : currentStatus,
            isCustomStatus: Boolean(!hasOptions || (currentStatus && !existsInSuggestions)),
            accountActivity: row.accountActivity || '',
            noteAudit: row.noteAudit || ''
        });
    };

    // ─── Save Audit Record ───────────────────────────────────────────
    const handleSaveAudit = async (e) => {
        e?.preventDefault();
        if (!auditModalItem) return;

        let finalStatus = auditForm.isCustomStatus ? auditForm.customStatus.trim() : auditForm.statusAccount.trim();
        if (finalStatus === '__CUSTOM__') {
            finalStatus = auditForm.customStatus.trim();
        }

        setSavingAudit(true);
        try {
            const base = API_BASE || '';
            const payload = {
                contractId: auditModalItem.rawContractId,
                contractIid: auditModalItem.contractIid,
                customerName: auditModalItem.customerName,
                auditDate: selectedDate,
                statusAccount: finalStatus,
                accountActivity: auditForm.accountActivity.trim(),
                noteAudit: auditForm.noteAudit.trim(),
                auditedBy: user?.username || user?.name || 'Staff',
                brand: user?.brand || auditModalItem.brand || ''
            };

            const res = await fetch(`${base}/telegram-audit/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAuditMap(prev => ({
                    ...prev,
                    [auditModalItem.rawContractId]: data.data
                }));
                if (finalStatus && !distinctStatuses.includes(finalStatus)) {
                    setDistinctStatuses(prev => [...prev, finalStatus]);
                }
                setAuditModalItem(null);
            } else {
                alert('បរាជ័យក្នុងការរក្សាទុក Audit: ' + (data.error || 'Server Error'));
            }
        } catch (err) {
            console.error('Error saving audit log:', err);
            alert('មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!');
        } finally {
            setSavingAudit(false);
        }
    };

    // ─── Open Contact Modal (Add / Edit) ─────────────────────────────
    const handleOpenContactModal = (row) => {
        setOpenMenuId(null);
        setContactModalItem(row);
        setContactForm({
            contactName: row.contactName || '',
            username: row.username || '',
            phoneNumber: row.phoneNumber || ''
        });
    };

    // ─── Save Contact Info ───────────────────────────────────────────
    const handleSaveContact = async (e) => {
        e?.preventDefault();
        if (!contactModalItem) return;

        setSavingContact(true);
        try {
            const base = API_BASE || '';
            const payload = {
                contractId: contactModalItem.rawContractId,
                contractIid: contactModalItem.contractIid,
                customerName: contactModalItem.customerName,
                contactName: contactForm.contactName.trim(),
                username: contactForm.username.trim(),
                phoneNumber: contactForm.phoneNumber.trim(),
                brand: user?.brand || contactModalItem.brand || ''
            };

            const res = await fetch(`${base}/telegram-audit/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setContactMap(prev => ({
                    ...prev,
                    [contactModalItem.rawContractId]: data.data
                }));
                setContactModalItem(null);
            } else {
                alert('បរាជ័យក្នុងការរក្សាទុក Contact: ' + (data.error || 'Server error'));
            }
        } catch (err) {
            console.error('Error saving contact:', err);
            alert('មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!');
        } finally {
            setSavingContact(false);
        }
    };

    // ─── Open History Modal ──────────────────────────────────────────
    const handleOpenHistoryModal = async (row) => {
        setOpenMenuId(null);
        setHistoryModalItem(row);
        setLoadingHistory(true);
        setHistoryLogs([]);

        try {
            const base = API_BASE || '';
            const res = await fetch(`${base}/telegram-audit/history/${encodeURIComponent(row.rawContractId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setHistoryLogs(data.data);
                }
            }
        } catch (err) {
            console.error('Error fetching audit history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // ─── Handle Jump to Date from History Card ───────────────────────
    const handleHistoryCardClick = (logItem) => {
        if (!logItem.auditDate) return;
        setJumpConfirmModal({
            targetDate: logItem.auditDate,
            customerName: historyModalItem?.customerName || logItem.customerName || 'អតិថិជននេះ'
        });
    };

    const confirmJumpToDate = () => {
        if (!jumpConfirmModal) return;
        const { targetDate, customerName } = jumpConfirmModal;
        setHistoryModalItem(null);
        setJumpConfirmModal(null);
        setSelectedDate(targetDate);
        setSearchTerm(customerName);
    };

    // ─── Daily Submit ────────────────────────────────────────────────
    const handleConfirmDailySubmit = async () => {
        setSubmittingDaily(true);
        try {
            const base = API_BASE || '';
            const res = await fetch(`${base}/telegram-audit/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auditDate: selectedDate,
                    submittedBy: user?.username || user?.name || 'Staff',
                    brand: user?.brand || ''
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setIsSubmitted(true);
                setSubmissionInfo(data.data);
                setConfirmSubmitModal(false);
                alert(data.message || `បាន Submit និងចាក់សោរទិន្នន័យសម្រាប់ថ្ងៃ ${selectedDate} ដោយជោគជ័យ!`);
                fetchAuditState(selectedDate);
            } else {
                alert('បរាជ័យក្នុងការ Submit: ' + (data.error || 'Server error'));
            }
        } catch (err) {
            console.error('Error submitting daily audit:', err);
            alert('មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!');
        } finally {
            setSubmittingDaily(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-slate-50 min-h-screen font-sans">
            {/* Header & Page Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-[5px] border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-[5px] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                        <FaClipboardList size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Audit Telegram</h1>
                            <span className="px-2 py-0.5 rounded-[5px] text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Activate Sync
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            គ្រប់គ្រង និងតាមដានសវនកម្មគណនី Telegram ប្រចាំថ្ងៃរបស់អតិថិជន
                        </p>
                    </div>
                </div>

                {/* Date Search & Status & Daily Submit Button */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Date Picker (Auto defaults to Today) */}
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-[5px] border border-slate-300">
                        <FaCalendarAlt className="text-emerald-600 text-sm" />
                        <span className="text-xs font-bold text-slate-600">ថ្ងៃ Audit:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="text-xs font-bold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
                        />
                        {selectedDate !== todayStr && (
                            <button
                                onClick={() => setSelectedDate(todayStr)}
                                className="ml-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-[5px] transition-colors"
                            >
                                ថ្ងៃនេះ
                            </button>
                        )}
                    </div>

                    {/* Status Badge */}
                    {isSubmitted ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold shadow-2xs">
                            <FaLock size={12} />
                            <span>បាន Submit រួចរាល់ (Locked)</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>កំពុងដំណើរការ (Editable)</span>
                        </div>
                    )}

                    {/* Submit Daily Audit Button */}
                    <button
                        onClick={() => setConfirmSubmitModal(true)}
                        disabled={isSubmitted || submittingDaily}
                        className={`flex items-center gap-2 px-4 py-2 rounded-[5px] text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer ${
                            isSubmitted
                                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20 active:scale-95'
                        }`}
                    >
                        {submittingDaily ? (
                            <FaSpinner className="animate-spin text-sm" />
                        ) : (
                            <FaCheckCircle className="text-sm" />
                        )}
                        <span>{isSubmitted ? 'បាន Submit រួចហើយ' : 'Submit Daily Audit'}</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={() => fetchAuditState(selectedDate)}
                        disabled={reloading}
                        title="Reload"
                        className="p-2.5 rounded-[5px] bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs cursor-pointer transition-colors"
                    >
                        <FaSync className={`text-sm ${reloading ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-[5px] border border-slate-200 shadow-2xs">
                    <p className="text-xs font-bold text-slate-500">អតិថិជនសរុប (Activate)</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{totalItems}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-blue-200 shadow-2xs bg-blue-50/25">
                    <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50"></span>
                        បាន Audit (បន្ទាត់ខៀវ)
                    </p>
                    <p className="text-xl font-black text-blue-700 mt-1">{auditedCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-rose-200 shadow-2xs bg-rose-50/25">
                    <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50"></span>
                        នៅសល់មិនទាន់ Audit (បន្ទាត់ក្រហម)
                    </p>
                    <p className="text-xl font-black text-rose-700 mt-1">{pendingCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-[5px] border border-slate-200 shadow-2xs">
                    <p className="text-xs font-bold text-slate-500">ស្ថានភាពថ្ងៃ {selectedDate}</p>
                    <p className="text-sm font-bold mt-1.5">
                        {isSubmitted ? (
                            <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                <FaLock size={12} /> Locked (11:59PM)
                            </span>
                        ) : (
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Open for Audit
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Table Filter Controls */}
            <div className="bg-white p-3 rounded-[5px] border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search Input */}
                    <div className="relative min-w-[260px] flex-1 max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="text"
                            placeholder="ស្វែងរកឈ្មោះ, Contract iid, Username, លេខទូរស័ព្ទ..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-[5px] border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <FaTimes size={12} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter: Only show recorded statuses from the table/database */}
                    <div className="flex items-center gap-1.5">
                        <FaFilter className="text-slate-400 text-xs" />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-[5px] px-2.5 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                            <option value="All">ស្ថានភាពទាំងអស់ (All)</option>
                            <option value="Audited">🔵 បាន Audit រួចរាល់ (បន្ទាត់ខៀវ)</option>
                            <option value="Pending">🔴 នៅសល់មិនទាន់ Audit (បន្ទាត់ក្រហម)</option>
                            {availableStatuses.map(st => (
                                <option key={st} value={st}>{st}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Items Per Page */}
                <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                    <span>បង្ហាញ:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-[5px] px-2 py-1.5 font-bold text-slate-700 cursor-pointer"
                    >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Main Data Table */}
            <div className="bg-white rounded-[5px] border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto p-2">
                    <table className="w-full text-left border-separate border-spacing-y-1.5 border-spacing-x-0 text-xs">
                        <thead>
                            <tr className="text-slate-700 font-black tracking-wider uppercase text-[11px]">
                                <th className="px-3.5 py-3 text-center w-12 bg-slate-100/90 border-b border-slate-200 first:rounded-l-[5px]">#</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">ឈ្មោះអតិថិជន</th>
                                <th className="px-3.5 py-3 text-center bg-slate-100/90 border-b border-slate-200">Contract iid</th>
                                <th className="px-3.5 py-3 text-right bg-slate-100/90 border-b border-slate-200">Amount</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">Contact Name</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">Username</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">Phone number</th>
                                <th className="px-3.5 py-3 text-center bg-slate-100/90 border-b border-slate-200 whitespace-nowrap">Status Audit</th>
                                <th className="px-3.5 py-3 text-center bg-slate-100/90 border-b border-slate-200">Status Account</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">Account Activity</th>
                                <th className="px-3.5 py-3 bg-slate-100/90 border-b border-slate-200">Note Audit</th>
                                <th className="px-3.5 py-3 text-center bg-slate-100/90 border-b border-slate-200">ថ្ងៃ Audit</th>
                                <th className="px-3.5 py-3 text-center w-28 bg-slate-100/90 border-b border-slate-200 last:rounded-r-[5px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-12 text-center text-slate-400 font-medium">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <FaSpinner className="animate-spin text-2xl text-emerald-600" />
                                                <span>កំពុងទាញយកទិន្នន័យពី Activate...</span>
                                            </div>
                                        ) : (
                                            'មិនមានទិន្នន័យអតិថិជនត្រូវបានរកឃើញឡើយ'
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                paginatedRows.map((row, idx) => {
                                    const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;
                                    const isRowMenuOpen = openMenuId === row.rawContractId;
                                    const rowBorderColor = row.isAudited ? 'border-blue-500' : 'border-rose-400';
                                    const rowBgColor = row.isAudited ? 'bg-blue-50/20 hover:bg-blue-50/45' : 'bg-rose-50/15 hover:bg-rose-50/40';
                                    const rowCellClass = `py-2.5 border-y-2 ${rowBorderColor} first:border-l-2 first:rounded-l-[5px] last:border-r-2 last:rounded-r-[5px] transition-colors`;

                                    return (
                                        <tr
                                            key={row.rawContractId}
                                            className={`${rowBgColor} transition-colors group`}
                                        >
                                            {/* No. with Status Indicator Dot */}
                                            <td className={`px-3.5 ${rowCellClass} text-center font-mono font-bold`}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span
                                                        className={`w-2 h-2 rounded-full ${
                                                            row.isAudited
                                                                ? 'bg-blue-500 shadow-xs shadow-blue-500/50'
                                                                : 'bg-rose-500 shadow-xs shadow-rose-500/50 animate-pulse'
                                                        }`}
                                                        title={row.isAudited ? 'បាន Audit រួចរាល់ (បន្ទាត់ខៀវ)' : 'នៅសល់មិនទាន់ Audit (បន្ទាត់ក្រហម)'}
                                                    ></span>
                                                    <span className={row.isAudited ? 'text-blue-900 font-black' : 'text-rose-900 font-bold'}>{rowNum}</span>
                                                </div>
                                            </td>

                                            {/* Customer Name */}
                                            <td className={`px-3.5 ${rowCellClass}`}>
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <span>{row.customerName}</span>
                                                    <CopyButton text={row.customerName} />
                                                </div>
                                            </td>

                                            {/* Contract iid */}
                                            <td className={`px-3.5 ${rowCellClass} text-center font-mono font-bold text-indigo-700`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span>{row.contractIid}</span>
                                                    <CopyButton text={row.contractIid} />
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className={`px-3.5 ${rowCellClass} text-right font-mono font-bold text-emerald-700`}>
                                                ${Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>

                                            {/* Contact Name Customer */}
                                            <td className={`px-3.5 ${rowCellClass} text-slate-700 font-medium`}>
                                                {row.contactName ? (
                                                    <span className="font-semibold">{row.contactName}</span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Username */}
                                            <td className={`px-3.5 ${rowCellClass} text-slate-700 font-mono`}>
                                                {row.username ? (
                                                    <span className="text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-[5px] border border-sky-200">
                                                        {row.username.startsWith('@') ? row.username : `@${row.username}`}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Phone number */}
                                            <td className={`px-3.5 ${rowCellClass} text-slate-700 font-mono`}>
                                                {row.phoneNumber ? (
                                                    <span className="font-bold">{row.phoneNumber}</span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Status Audit (Auto by System) */}
                                            <td className={`px-3.5 ${rowCellClass} text-center whitespace-nowrap`}>
                                                {row.isAudited ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[5px] text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-300 shadow-2xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                                        <span>បាន Audit</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[5px] text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                        <span>មិនទាន់ Audit</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status Account (Manual Input) */}
                                            <td className={`px-3.5 ${rowCellClass} text-center`}>
                                                {row.statusAccount ? (
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-[5px] text-[11px] font-bold border ${getStatusBadgeClass(row.statusAccount)}`}>
                                                        {row.statusAccount}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-[11px] font-medium">—</span>
                                                )}
                                            </td>

                                            {/* Account Activity */}
                                            <td className={`px-3.5 ${rowCellClass} text-slate-600 max-w-xs truncate`} title={row.accountActivity}>
                                                {row.accountActivity || <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* Note Audit */}
                                            <td className={`px-3.5 ${rowCellClass} text-slate-600 max-w-xs truncate`} title={row.noteAudit}>
                                                {row.noteAudit || <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* Audit Date / Time */}
                                            <td className={`px-3.5 ${rowCellClass} text-center font-mono text-[11px] text-slate-600 whitespace-nowrap`}>
                                                {row.auditDateTime ? (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-[5px] font-bold text-slate-700 border border-slate-200">
                                                        {row.auditDateTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Action Column */}
                                            <td className={`px-3.5 ${rowCellClass} text-center relative`}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* Audit Button (Icon in front of Menu) */}
                                                    <button
                                                        onClick={() => handleOpenAuditModal(row)}
                                                        disabled={isSubmitted}
                                                        title={isSubmitted ? "Locked (Submitted)" : "Audit ទិន្នន័យ"}
                                                        className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                                                            isSubmitted
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : row.isAudited
                                                                    ? 'bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 hover:border-blue-600'
                                                                    : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600'
                                                        }`}
                                                    >
                                                        <FaEdit size={14} />
                                                    </button>

                                                    {/* Action Menu (Droplist) */}
                                                    <div className="relative row-action-menu-container">
                                                        <button
                                                             onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuId(isRowMenuOpen ? null : row.rawContractId);
                                                            }}
                                                            title="Menu"
                                                            className="w-8 h-8 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                                                        >
                                                            <AiOutlineMenu size={14} />
                                                        </button>

                                                        {/* Droplist Menu Popup */}
                                                        {isRowMenuOpen && (
                                                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-[5px] shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in duration-150">
                                                                {/* Activity Log */}
                                                                <button
                                                                    onClick={() => handleOpenHistoryModal(row)}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-[5px] flex items-center gap-2 cursor-pointer transition-colors"
                                                                >
                                                                    <FaHistory className="text-emerald-600" />
                                                                    <span>Activity log</span>
                                                                </button>

                                                                {/* Add Contact (Only if contact info is empty) */}
                                                                {!row.hasContactInfo ? (
                                                                    <button
                                                                        onClick={() => handleOpenContactModal(row)}
                                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-[5px] flex items-center gap-2 cursor-pointer transition-colors"
                                                                    >
                                                                        <FaUserPlus className="text-indigo-600" />
                                                                        <span>Add Contact</span>
                                                                    </button>
                                                                ) : (
                                                                    /* Edit Contact (Shown once info is entered) */
                                                                    <button
                                                                        onClick={() => handleOpenContactModal(row)}
                                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:text-amber-700 hover:bg-amber-50 rounded-[5px] flex items-center gap-2 cursor-pointer transition-colors"
                                                                    >
                                                                        <FaUserEdit className="text-amber-600" />
                                                                        <span>Edit Contact</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalItems > 0 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-semibold">
                        <div>
                            បង្ហាញពី <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> ដល់{' '}
                            <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> នៃ{' '}
                            <span className="font-bold text-slate-900">{totalItems}</span> ជួរ
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-[5px] border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
                            >
                                ថយក្រោយ
                            </button>
                            <span className="px-3 py-1.5 font-bold text-slate-800">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-[5px] border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
                            >
                                បន្ទាប់
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* AUDIT MODAL (Edit Status Account, Account Activity, Note)     */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {auditModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <FaEdit size={18} />
                                <div>
                                    <h3 className="font-black text-sm tracking-tight">Audit Telegram Account</h3>
                                    <p className="text-[11px] text-emerald-100 font-medium">កាលបរិច្ឆេទ: {selectedDate}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAuditModalItem(null)}
                                className="text-white/80 hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Customer Information Preview */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
                            <div>
                                <span className="text-slate-500">ឈ្មោះអតិថិជន: </span>
                                <span className="font-black text-slate-800">{auditModalItem.customerName}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Contract iid: </span>
                                <span className="font-mono font-bold text-indigo-700">{auditModalItem.contractIid}</span>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveAudit} className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Status Account: ONLY shows previously recorded statuses from DB (no auto defaults) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Status Account <span className="text-rose-500">*</span>
                                </label>

                                {availableStatuses.length > 0 ? (
                                    <>
                                        <select
                                            value={auditForm.isCustomStatus ? '__CUSTOM__' : auditForm.statusAccount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '__CUSTOM__') {
                                                    setAuditForm(prev => ({ ...prev, isCustomStatus: true, statusAccount: '__CUSTOM__' }));
                                                } else {
                                                    setAuditForm(prev => ({ ...prev, isCustomStatus: false, statusAccount: val }));
                                                }
                                            }}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-[5px] px-3 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                        >
                                            <option value="">-- ជ្រើសរើស Status Account --</option>
                                            {availableStatuses.map(st => (
                                                <option key={st} value={st}>{st}</option>
                                            ))}
                                            <option value="__CUSTOM__">✏️ + បញ្ចូលស្ថានភាពថ្មី (Custom Status)</option>
                                        </select>

                                        {auditForm.isCustomStatus && (
                                            <div className="mt-2">
                                                <input
                                                    type="text"
                                                    placeholder="បញ្ចូល Status Account ថ្មី..."
                                                    value={auditForm.customStatus}
                                                    onChange={(e) => setAuditForm(prev => ({ ...prev, customStatus: e.target.value }))}
                                                    required
                                                    autoFocus
                                                    className="w-full text-xs font-bold text-slate-800 bg-emerald-50/50 border border-emerald-300 rounded-[5px] px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* If no statuses entered before, directly show input to type */
                                    <input
                                        type="text"
                                        placeholder="បញ្ចូល Status Account..."
                                        value={auditForm.customStatus || auditForm.statusAccount}
                                        onChange={(e) => setAuditForm(prev => ({
                                            ...prev,
                                            isCustomStatus: true,
                                            customStatus: e.target.value,
                                            statusAccount: e.target.value
                                        }))}
                                        required
                                        autoFocus
                                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-[5px] px-3 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    />
                                )}
                            </div>

                            {/* Account Activity */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Account Activity (សកម្មភាពគណនី)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="បញ្ចូលសកម្មភាពគណនី Telegram..."
                                    value={auditForm.accountActivity}
                                    onChange={(e) => setAuditForm(prev => ({ ...prev, accountActivity: e.target.value }))}
                                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-[5px] p-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Note Audit */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Note Audit (កំណត់សម្គាល់)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="កំណត់សម្គាល់បន្ថែមពីសវនកម្ម..."
                                    value={auditForm.noteAudit}
                                    onChange={(e) => setAuditForm(prev => ({ ...prev, noteAudit: e.target.value }))}
                                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-[5px] p-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setAuditModalItem(null)}
                                    className="px-4 py-2 rounded-[5px] text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAudit}
                                    className="px-5 py-2 rounded-[5px] text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                >
                                    {savingAudit ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
                                    <span>Audit</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* CONTACT MODAL (Add Contact / Edit Contact)                    */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {contactModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-sky-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                {contactModalItem.hasContactInfo ? <FaUserEdit size={16} /> : <FaUserPlus size={16} />}
                                <div>
                                    <h3 className="font-black text-sm tracking-tight">
                                        {contactModalItem.hasContactInfo ? 'Edit Contact Info' : 'Add Contact Info'}
                                    </h3>
                                    <p className="text-[11px] text-sky-100 font-medium">{contactModalItem.customerName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setContactModalItem(null)}
                                className="text-white/80 hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveContact} className="p-5 space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Contact Name Customer
                                </label>
                                <input
                                    type="text"
                                    placeholder="បញ្ចូលឈ្មោះអ្នកទំនាក់ទំនង..."
                                    value={contactForm.contactName}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, contactName: e.target.value }))}
                                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-[5px] px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Username (Telegram)
                                </label>
                                <input
                                    type="text"
                                    placeholder="@username..."
                                    value={contactForm.username}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, username: e.target.value }))}
                                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-[5px] px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Phone number
                                </label>
                                <input
                                    type="text"
                                    placeholder="012 345 678..."
                                    value={contactForm.phoneNumber}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-[5px] px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setContactModalItem(null)}
                                    className="px-4 py-2 rounded-[5px] text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingContact}
                                    className="px-5 py-2 rounded-[5px] text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                >
                                    {savingContact ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
                                    <span>រក្សាទុក Contact</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* ACTIVITY LOG MODAL (History Cards)                           */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {historyModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <FaHistory size={18} className="text-emerald-400" />
                                <div>
                                    <h3 className="font-black text-sm tracking-tight">Activity Log History</h3>
                                    <p className="text-[11px] text-slate-300 font-medium">
                                        {historyModalItem.customerName} ({historyModalItem.contractIid})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setHistoryModalItem(null)}
                                className="text-white/80 hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Instruction info */}
                        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                            <span>💡 ចុចលើជួរកាតណាមួយ ដើម្បីស្វែងរកឈ្មោះ និងនាំទៅកាន់ថ្ងៃ Audit នោះ</span>
                            <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-[5px] border border-emerald-300">
                                {historyLogs.length} Records
                            </span>
                        </div>

                        {/* History Cards Container */}
                        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50">
                            {loadingHistory ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <FaSpinner className="animate-spin text-2xl text-emerald-600" />
                                    <span className="text-xs font-semibold">កំពុងទាញយកប្រវត្តិ Activity log...</span>
                                </div>
                            ) : historyLogs.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                    មិនទាន់មានប្រវត្តិ Audit សម្រាប់អតិថិជននេះពីមុនមកទេ
                                </div>
                            ) : (
                                historyLogs.map((log, index) => (
                                    <div
                                        key={log._id || index}
                                        onClick={() => handleHistoryCardClick(log)}
                                        className="group bg-white p-3.5 rounded-[5px] border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all duration-200 cursor-pointer relative"
                                    >
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <FaCalendarAlt className="text-emerald-600 text-xs" />
                                                <span className="font-mono font-black text-slate-800 text-xs">
                                                    {log.auditDate}
                                                </span>
                                                {log.auditDateTime && (
                                                    <span className="text-[11px] font-mono text-slate-400">
                                                        ({log.auditDateTime})
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {log.statusAccount && (
                                                    <span className={`px-2 py-0.5 rounded-[5px] text-[10px] font-bold border ${getStatusBadgeClass(log.statusAccount)}`}>
                                                        {log.statusAccount}
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                    ទៅកាន់ថ្ងៃនេះ <FaArrowRight size={10} />
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                            <div>
                                                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                                                    Account Activity:
                                                </span>
                                                <p className="text-slate-700 font-medium bg-slate-50 p-2 rounded-[5px] border border-slate-100">
                                                    {log.accountActivity || '—'}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                                                    Note Audit:
                                                </span>
                                                <p className="text-slate-700 font-medium bg-slate-50 p-2 rounded-[5px] border border-slate-100">
                                                    {log.noteAudit || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {log.auditedBy && (
                                            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                                                <span>Audited by: <strong className="text-slate-600">{log.auditedBy}</strong></span>
                                                {log.contractIid && <span>IID: {log.contractIid}</span>}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 bg-white border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setHistoryModalItem(null)}
                                className="px-5 py-1.5 rounded-[5px] text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                បិទ (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* JUMP TO DATE CONFIRMATION MODAL                               */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {jumpConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="w-11 h-11 rounded-[5px] bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                            <FaCalendarAlt size={20} />
                        </div>
                        <div className="text-center space-y-1">
                            <h4 className="text-base font-black text-slate-800">បញ្ជាក់ការផ្លាស់ប្តូរកាលបរិច្ឆេទ</h4>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                តើអ្នកចង់ទៅកាន់កាលបរិច្ឆេទ Audit <strong>{jumpConfirmModal.targetDate}</strong> របស់អតិថិជន{' '}
                                <strong>"{jumpConfirmModal.customerName}"</strong> មែនទេ?
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={() => setJumpConfirmModal(null)}
                                className="px-5 py-2 rounded-[5px] text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={confirmJumpToDate}
                                className="px-6 py-2 rounded-[5px] text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                                យល់ព្រមទៅកាន់ថ្ងៃនេះ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* SUBMIT DAILY CONFIRMATION MODAL                               */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {confirmSubmitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="w-11 h-11 rounded-[5px] bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                            <FaExclamationTriangle size={20} />
                        </div>
                        <div className="text-center space-y-2">
                            <h4 className="text-base font-black text-slate-800">
                                បញ្ជាក់ការ Submit Daily Audit
                            </h4>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                តើអ្នកពិតជាចង់ Submit ទិន្នន័យ Audit សម្រាប់ថ្ងៃ{' '}
                                <strong className="text-rose-600 font-black">{selectedDate}</strong> មែនទេ?
                            </p>
                            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-[5px] border border-amber-200 font-bold">
                                ⚠️ បន្ទាប់ពី Submit រួច ទិន្នន័យសម្រាប់ថ្ងៃនេះនឹងត្រូវបានចាក់សោរ (Locked) ហើយអ្នកនឹងមិនអាចកែប្រែបានទៀតទេ!
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={() => setConfirmSubmitModal(false)}
                                disabled={submittingDaily}
                                className="px-5 py-2 rounded-[5px] text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={handleConfirmDailySubmit}
                                disabled={submittingDaily}
                                className="px-6 py-2 rounded-[5px] text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2"
                            >
                                {submittingDaily ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck className="text-sm" />}
                                <span>យល់ព្រម Submit & Lock</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTelegram;
