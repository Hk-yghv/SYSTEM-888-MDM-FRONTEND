import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import CopyCell from '../../../components/CopyCell';
import { AiOutlineMenu } from 'react-icons/ai';
import { MdOutlineSync, MdSearch, MdPictureAsPdf, MdQrCode2 } from 'react-icons/md';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { FaFileExcel, FaDollarSign } from 'react-icons/fa';
import RepaymentScheduleModal from '../../Contract/components/RepaymentScheduleModal';
import QrPaymentModal from '../components/QrPaymentModal';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

// ──────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500, 1000];

/** Return the index of the first Pending/Saved row (= the "auto" month). */
const getActiveRowIdx = (schedule = []) => {
    const payOffIdx = schedule.findIndex(r => r.status === 'PayOff');
    if (payOffIdx !== -1) return -1;
    const firstPending = schedule.findIndex(r => r.status === 'Pending' || r.status === 'Saved');
    return firstPending;
};

/** Return the row we display in the outer table for this contract. */
const getDisplayRow = (schedule = [], selectedIdx = null) => {
    if (!schedule.length) return null;
    if (selectedIdx !== null && schedule[selectedIdx]) return schedule[selectedIdx];
    const idx = getActiveRowIdx(schedule);
    return idx === -1 ? schedule[schedule.length - 1] : schedule[idx];
};

const getRowWithDueDate = (row, contract) => {
    if (!row || row.dueDate || !contract?.inputDate) return row;
    const duration = String(contract.duration || '').toLowerCase();
    const matched = duration.match(/\d+/);
    const count = matched ? Math.max(1, Number(matched[0])) : 1;
    const isDays = duration.includes('day') || duration.includes('ថ្ងៃ') || duration.includes('d');
    const dueDate = new Date(`${contract.inputDate}T00:00:00`);
    if (isDays) {
        dueDate.setDate(dueDate.getDate() + count);
    } else {
        dueDate.setMonth(dueDate.getMonth() + Number(row.monthIndex || 1));
    }
    return { ...row, dueDate: dueDate.toISOString().split('T')[0] };
};

const getAutomaticPenalty = (row, contract, rules = []) => {
    if (!row?.dueDate || ['Paid', 'PayOff', 'Settled'].includes(row.status)) {
        return Number(row?.penalty || 0) || 0;
    }

    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return Number(row.penalty || 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lateDays = Math.max(0, Math.floor((today - dueDate) / 86400000));
    if (lateDays <= 0) return 0;

    const brand = String(contract?.brand || '').trim();
    const applicableRules = rules
        .filter(rule => !String(rule?.brand || '').trim() || String(rule.brand).trim() === brand)
        .filter(rule => lateDays >= Number(rule.afterDays || 0));
    if (applicableRules.length === 0) return Number(row.penalty || 0) || 0;

    const bestRule = applicableRules.reduce((winner, rule) => (
        !winner || Number(rule.afterDays || 0) > Number(winner.afterDays || 0) ? rule : winner
    ), null);
    const perDay = Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
    return lateDays * perDay;
};

const getDisplayValues = (row, contract, rules) => {
    if (!row) return null;
    const rowWithDueDate = getRowWithDueDate(row, contract);
    const penalty = getAutomaticPenalty(rowWithDueDate, contract, rules);
    const scheduledAmount = Number(row.scheduledAmount || 0);
    return { ...rowWithDueDate, penalty, totalAmount: scheduledAmount + penalty };
};

// ─── Status badge colours ──────────────────────────────────────────────────────
const statusBadgeClass = (status) => {
    if (status === 'Paid') return 'bg-emerald-50 border-emerald-300 text-emerald-700';
    if (status === 'PayOff') return 'bg-indigo-50  border-indigo-300  text-indigo-700';
    if (status === 'Settled') return 'bg-slate-50   border-slate-300   text-slate-500';
    return 'bg-amber-50 border-amber-300 text-amber-700';
};
const statusTextClass = (status) => {
    if (status === 'Paid') return 'text-emerald-600';
    if (status === 'PayOff') return 'text-indigo-600';
    if (status === 'Settled') return 'text-slate-400';
    return 'text-amber-700';
};

// ─── Row Urgency Highlight Calculation ─────────────────────────────────────────
const getRowUrgency = (displayRow, isAllDone) => {
    if (isAllDone || ['Paid', 'PayOff', 'Settled'].includes(displayRow?.status)) {
        return {
            type: 'done',
            rowClass: 'bg-emerald-50/20 hover:bg-emerald-50/50 border-l-4 border-l-emerald-500',
            dueBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
            badgeText: '✓ បានបង់ចប់'
        };
    }
    if (!displayRow?.dueDate) {
        return {
            type: 'normal',
            rowClass: 'hover:bg-slate-50',
            dueBadgeClass: 'text-slate-700',
            badgeText: null
        };
    }

    const due = new Date(`${displayRow.dueDate}T00:00:00`);
    if (isNaN(due.getTime())) {
        return {
            type: 'normal',
            rowClass: 'hover:bg-slate-50',
            dueBadgeClass: 'text-slate-700',
            badgeText: null
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        // Overdue (លើសថ្ងៃកំណត់) -> Formatted in months & days (e.g., លើស ១ ខែ ៥ ថ្ងៃ)
        const overdueDays = Math.abs(diffDays);
        let overdueText = '';
        if (overdueDays >= 30) {
            const months = Math.floor(overdueDays / 30);
            const remDays = overdueDays % 30;
            overdueText = remDays > 0 ? `លើស ${months} ខែ ${remDays} ថ្ងៃ` : `លើស ${months} ខែ`;
        } else {
            overdueText = `លើស ${overdueDays} ថ្ងៃ`;
        }

        return {
            type: 'overdue',
            diffDays,
            rowClass: 'bg-red-50/70 hover:bg-red-100/80 border-l-4 border-l-red-600',
            dueBadgeClass: 'bg-red-100 text-red-800 border-red-300 font-black',
            badgeText: `⚠️ ${overdueText}`
        };
    }

    if (diffDays === 0) {
        // Due Today (ដល់ថ្ងៃកំណត់) -> Amber/Yellow border & background highlight
        return {
            type: 'dueToday',
            diffDays,
            rowClass: 'bg-amber-50/70 hover:bg-amber-100/80 border-l-4 border-l-amber-500',
            dueBadgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse',
            badgeText: '⏰ ដល់ថ្ងៃថ្ងៃនេះ'
        };
    }

    if (diffDays === 1) {
        // Remaining 1 day (សល់ពេល ១ ថ្ងៃ) -> Orange border & background highlight
        return {
            type: 'dueIn1Day',
            diffDays,
            rowClass: 'bg-orange-50/60 hover:bg-orange-100/70 border-l-4 border-l-orange-500',
            dueBadgeClass: 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
            badgeText: '⏳ សល់ ១ ថ្ងៃ'
        };
    }

    if (diffDays <= 3) {
        // Remaining 2-3 days (សល់ពេល ៣ ថ្ងៃ) -> Sky/Blue border & background highlight
        return {
            type: 'dueIn3Days',
            diffDays,
            rowClass: 'bg-sky-50/60 hover:bg-sky-100/70 border-l-4 border-l-sky-500',
            dueBadgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-bold',
            badgeText: `📅 សល់ ${diffDays} ថ្ងៃ`
        };
    }

    return {
        type: 'normal',
        diffDays,
        rowClass: 'hover:bg-indigo-50/40',
        dueBadgeClass: 'text-indigo-700 font-semibold',
        badgeText: null
    };
};

// ──────────────────────────────────────────────────────────────────────────────
// Portal dropdown — renders outside DOM tree to escape overflow clipping
// ──────────────────────────────────────────────────────────────────────────────
const ActionDropdownPortal = ({ item, pos, onClose, onOpenSchedule, onSelectMonth, onOpenQrModal }) => {
    const schedule = item?.repaymentSchedule || [];
    const activeIdx = getActiveRowIdx(schedule);

    // Adjust position so dropdown doesn't overflow the viewport
    const dropdownWidth = 240;
    const left = Math.max(8, Math.min(pos.left, window.innerWidth - dropdownWidth - 8));
    const top = pos.bottom + 4;

    return ReactDOM.createPortal(
        <div
            data-action-menu-root="true"
            style={{ position: 'fixed', top, left, width: dropdownWidth, zIndex: 999999 }}
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
        >
            {/* Header label */}
            <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                Repayment Actions
            </div>

            {/* QR Code Payment button */}
            <button
                onClick={() => {
                    onOpenQrModal(item);
                    onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors"
            >
                <MdQrCode2 className="text-emerald-600 text-base flex-shrink-0" />
                <span>QR Code Payment</span>
            </button>

            {/* Auto-open button — opens to the current unpaid month */}
            <button
                onClick={() => {
                    const idx = activeIdx === -1 ? schedule.length - 1 : (activeIdx >= 0 ? activeIdx : 0);
                    onOpenSchedule(item, idx);
                    onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors"
            >
                <FaDollarSign className="text-amber-500 text-sm flex-shrink-0" />
                <span>Repayment Schedule ($)</span>
            </button>

            {/* Month list — always visible, one click per month */}
            {schedule.length > 0 && (
                <div className="border-l-2 border-amber-200 ml-4 pl-2 space-y-0.5">
                    {schedule.map((row, mIdx) => {
                        const autoActiveIdx = activeIdx === -1 ? schedule.length - 1 : activeIdx;
                        const isCurrentMonth = mIdx === autoActiveIdx;
                        return (
                            <button
                                key={mIdx}
                                onClick={() => { onSelectMonth(item, mIdx); onClose(); }}
                                className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-[5px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${isCurrentMonth
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : `hover:bg-slate-50 ${statusTextClass(row.status)}`
                                    }`}
                            >
                                <span>{row.labelName || `Month ${row.monthIndex}`}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadgeClass(row.status)}`}>
                                    {row.status}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>,
        document.body
    );
};

// ──────────────────────────────────────────────────────────────────────────────

const InstallmentPage = () => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [urgencyFilter, setUrgencyFilter] = useState(searchParams.get('urgency') || 'all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(10);
    const [latePenaltyRules, setLatePenaltyRules] = useState([]);

    // Sync search param from URL when URL changes
    useEffect(() => {
        const q = searchParams.get('search');
        if (q !== null && q !== searchTerm) {
            setSearchTerm(q);
            setCurrentPage(1);
        }
        const u = searchParams.get('urgency');
        if (u !== null && u !== urgencyFilter) {
            setUrgencyFilter(u);
            setCurrentPage(1);
        }
    }, [searchParams]);

    // Dropdown state — { id: string|null, pos: { left, bottom } }
    const [openMenu, setOpenMenu] = useState({ id: null, pos: { left: 0, bottom: 0 } });

    // RepaymentScheduleModal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleModalContract, setScheduleModalContract] = useState(null);
    const [scheduleModalMonthIdx, setScheduleModalMonthIdx] = useState(null);
    const [selectedMonthByContract, setSelectedMonthByContract] = useState({});

    // QR Payment state
    const [selectedQrContract, setSelectedQrContract] = useState(null);

    // ── Close menu on outside click ───────────────────────────────────────────
    useEffect(() => {
        if (!openMenu.id) return;
        const handler = (event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[data-action-menu-root]')) {
                return;
            }
            setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } });
        };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [openMenu.id]);

    useEffect(() => {
        const brand = user?.brand || '';
        fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => setLatePenaltyRules(Array.isArray(data?.late_penalty_rules) ? data.late_penalty_rules : []))
            .catch(err => console.error('Fetch installment penalty rules error:', err));
    }, [API_BASE1, user?.brand]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchContracts = useCallback(async (pg = 1, search = searchTerm, lim = limit, from = dateFrom, to = dateTo) => {
        setReloading(true);
        try {
            const pageToFetch = typeof pg === 'number' ? pg : 1;
            const params = new URLSearchParams({
                status: 'Activated',
                page: pageToFetch,
                limit: lim,
                requireSchedule: 'true',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
            });
            if (search) params.set('search', search);
            if (from) params.set('dateFrom', from);
            if (to) params.set('dateTo', to);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch installment contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user, limit, dateFrom, dateTo, searchTerm]);

    useEffect(() => {
        fetchContracts(currentPage, searchTerm, limit, dateFrom, dateTo);
    }, [currentPage, limit, dateFrom, dateTo]);

    useEffect(() => {
        setCurrentPage(1);
        fetchContracts(1, searchTerm, limit, dateFrom, dateTo);
    }, [searchTerm]);

    // ── Visible Contracts after Urgency Droplist Filter ──────────────────────
    const visibleContracts = useMemo(() => {
        if (urgencyFilter === 'all') return contracts;
        return contracts.filter((item, idx) => {
            const schedule = item.repaymentSchedule || [];
            const itemId = item._id || item.contractId || String(idx);
            const displayRow = getDisplayValues(getDisplayRow(schedule, selectedMonthByContract[itemId] ?? null), item, latePenaltyRules);
            const activeIdx = getActiveRowIdx(schedule);
            const isAllDone = activeIdx === -1;
            const urgency = getRowUrgency(displayRow, isAllDone);
            return urgency.type === urgencyFilter;
        });
    }, [contracts, urgencyFilter, selectedMonthByContract, latePenaltyRules]);

    // ── Computed totals (visible page) ────────────────────────────────────────
    const totals = useMemo(() => {
        let loanAmount = 0, penalty = 0, scheduled = 0, totalSum = 0, paid = 0;
        visibleContracts.forEach(c => {
            const contractId = c._id || c.contractId;
            const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[contractId] ?? null), c, latePenaltyRules);
            if (!row) return;
            loanAmount += Number(row.loanAmount || c.amount || 0);
            penalty += Number(row.penalty || 0);
            scheduled += Number(row.scheduledAmount || 0);
            totalSum += Number(row.penalty || 0) + Number(row.scheduledAmount || 0);
            paid += Number(row.paidAmount || 0);
        });
        return { loanAmount, penalty, scheduled, total: totalSum, paid };
    }, [visibleContracts, latePenaltyRules, selectedMonthByContract]);

    // ── Pagination ────────────────────────────────────────────────────────────
    const totalPages = Math.ceil(total / limit) || 1;
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, total);

    const getPageNumbers = () => {
        const pages = [], maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    // ── Action menu open ──────────────────────────────────────────────────────
    const handleOpenMenu = (e, itemId) => {
        e.stopPropagation(); // prevent the window click handler from firing
        if (openMenu.id === itemId) {
            setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } });
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setOpenMenu({
            id: itemId,
            pos: { left: rect.right - 240, bottom: rect.bottom }
        });
    };

    // ── RepaymentScheduleModal helpers ────────────────────────────────────────
    const openScheduleForMonth = (contract, monthIdx) => {
        setScheduleModalContract(contract);
        setScheduleModalMonthIdx(monthIdx);
        setScheduleModalOpen(true);
    };

    const selectMonthForOuterRow = (contract, monthIdx) => {
        const contractId = contract._id || contract.contractId;
        setSelectedMonthByContract(prev => ({ ...prev, [contractId]: monthIdx }));
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        const data = visibleContracts.map((c, i) => {
            const row = getDisplayRow(c.repaymentSchedule || []);
            return {
                'No': i + 1,
                'Loan Date': c.inputDate || '',
                'Customer Name': `${c.customerNameEn} (${c.customerNameKh})`,
                'Brand': c.brand || '',
                'Model': c.model || '',
                'ថ្ងៃខែត្រូវបង់': row?.dueDate || '',
                'Total Loan Amount ($)': row?.loanAmount || 0,
                'ពិន័យ': row?.penalty || 0,
                'ត្រូវបង់សរុប': row?.scheduledAmount || 0,
                'Total': (Number(row?.penalty || 0) + Number(row?.scheduledAmount || 0)),
                'ភ្ញៀវបានបង់': row?.paidAmount || 0,
                'Comment': row?.comment || '',
                'កាលបរិច្ឆេទបានបង់': row?.paidDate || '',
            };
        });
        exportToExcel(data, 'Installment_Schedule');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, i) => i + 1 },
            { header: 'Customer', accessor: 'customerNameEn' },
            { header: 'Model', accessor: 'model' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Loan Date', accessor: 'inputDate' },
        ];
        exportToPDF('Installment Schedule', columns, visibleContracts);
    };

    // ── Get the contract object for the currently-open menu ───────────────────
    const openMenuContract = openMenu.id
        ? contracts.find(c => (c._id || c.contractId) === openMenu.id) || null
        : null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4 relative'>

            {/* ── RepaymentScheduleModal ─────────────────────────────────── */}
            <RepaymentScheduleModal
                open={scheduleModalOpen}
                setOpen={setScheduleModalOpen}
                contract={scheduleModalContract}
                mode="view_edit"
                defaultMonthIdx={scheduleModalMonthIdx}
                onSaved={() => fetchContracts(currentPage, searchTerm, limit)}
            />

            {/* ── QrPaymentModal ─────────────────────────────────────────── */}
            <QrPaymentModal
                open={Boolean(selectedQrContract)}
                contract={selectedQrContract}
                onClose={() => setSelectedQrContract(null)}
                onSaved={() => fetchContracts(currentPage, searchTerm, limit, dateFrom, dateTo)}
            />

            {/* ── Portal dropdown ────────────────────────────────────────── */}
            {openMenu.id && openMenuContract && (
                <ActionDropdownPortal
                    item={openMenuContract}
                    pos={openMenu.pos}
                    onClose={() => setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } })}
                    onOpenSchedule={openScheduleForMonth}
                    onSelectMonth={selectMonthForOuterRow}
                    onOpenQrModal={(c) => setSelectedQrContract(c)}
                />
            )}

            {/* ── Header ────────────────────────────────────────────────── */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-indigo-400 flex items-center gap-2 flex-wrap'>
                        <span>Installment</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                            {visibleContracts.length} Records
                        </span>
                        {user?.brand && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                                {user.brand}
                            </span>
                        )}
                    </h1>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Compact Space-Saving Urgency Filter Droplist */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={urgencyFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                setUrgencyFilter(val);
                                const newParams = new URLSearchParams(searchParams);
                                if (val === 'all') newParams.delete('urgency');
                                else newParams.set('urgency', val);
                                setSearchParams(newParams);
                            }}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                        >
                            <option value="all">ទាំងអស់ (All Status)</option>
                            <option value="overdue">🔴 លើសកំណត់ (Overdue)</option>
                            <option value="dueToday">🟡 ដល់ថ្ងៃបង់ (Due Today)</option>
                            <option value="dueIn1Day">🟠 សល់ពេល ១ ថ្ងៃ (Due 1 Day)</option>
                            <option value="dueIn3Days">🔵 សល់ពេល ៣ ថ្ងៃ (Due 3 Days)</option>
                            <option value="done">🟢 បង់រួចរាល់ (Paid Off)</option>
                        </select>
                    </div>

                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchTerm(val);
                                setCurrentPage(1);
                                const newParams = new URLSearchParams(searchParams);
                                if (!val) newParams.delete('search');
                                else newParams.set('search', val);
                                setSearchParams(newParams);
                            }}
                            placeholder="Search name, model, serial..."
                            className="pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-48 sm:w-52 outline-none font-medium shadow-xs"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                            className="h-8 px-2 bg-white border border-slate-300 rounded-[5px] text-[11px] text-slate-700 outline-none focus:border-emerald-500"
                        />
                        <span className="text-slate-500 text-[10px] font-bold uppercase">To</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                            className="h-8 px-2 bg-white border border-slate-300 rounded-[5px] text-[11px] text-slate-700 outline-none focus:border-emerald-500"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                type="button"
                                onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[5px] text-[10px] font-bold cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <button onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>Excel</span>
                    </button>
                    <button onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>PDF</span>
                    </button>
                    <button
                        onClick={() => fetchContracts(currentPage, searchTerm, limit)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className='w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-md'
                style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Loan Date</th>
                            <th className='px-4 py-3'>Customer Name</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>Model</th>
                            <th className='px-4 py-3'>ថ្ងៃខែត្រូវបង់</th>
                            <th className='px-4 py-3 text-right font-mono text-emerald-700'>Total Loan Amount</th>
                            <th className='px-4 py-3 text-right text-amber-600'>ពិន័យ</th>
                            <th className='px-4 py-3 text-right text-sky-600'>ត្រូវបង់</th>
                            <th className='px-4 py-3 text-right text-emerald-600 font-extrabold'>Total</th>
                            <th className='px-4 py-3 text-right text-emerald-700'>ភ្ញៀវបានបង់</th>
                            <th className='px-4 py-3'>Comment</th>
                            <th className='px-4 py-3 text-purple-600'>កាលបរិច្ឆេទបានបង់</th>
                            <th className='px-4 py-3 text-center'>Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={14} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : visibleContracts.length === 0 ? (
                            <tr><td colSpan={14} className="text-center py-8 text-slate-500 italic font-medium">
                                {searchTerm ? `No results found for "${searchTerm}"` : 'No installment records found matching this filter.'}
                            </td></tr>
                        ) : (
                            visibleContracts.map((item, idx) => {
                                const schedule = item.repaymentSchedule || [];
                                const itemId = item._id || item.contractId || String(idx);
                                const displayRow = getDisplayValues(getDisplayRow(schedule, selectedMonthByContract[itemId] ?? null), item, latePenaltyRules);
                                const activeIdx = getActiveRowIdx(schedule);
                                const isAllDone = activeIdx === -1;
                                const menuKey = itemId;
                                const urgency = getRowUrgency(displayRow, isAllDone);

                                return (
                                    <tr key={menuKey}
                                        className={`transition-colors ${urgency.rowClass}`}>

                                        <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>
                                            {(currentPage - 1) * limit + idx + 1}
                                        </td>
                                        <td className='px-4 py-3 font-mono text-slate-700'>{item.inputDate || '—'}</td>
                                        <td className='px-4 py-3'>
                                            <CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' />
                                            <CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs block font-semibold' />
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                                {item.brand || '—'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'>
                                            <CopyCell text={item.model} className='font-semibold text-slate-800' />
                                        </td>

                                        {/* ថ្ងៃខែត្រូវបង់ */}
                                        <td className='px-4 py-3 font-mono text-slate-700 whitespace-nowrap'>
                                            {displayRow?.dueDate ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{displayRow.dueDate}</span>
                                                    {urgency.badgeText && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] border inline-flex items-center gap-1 ${urgency.dueBadgeClass}`}>
                                                            {urgency.badgeText}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '—'}
                                        </td>

                                        {/* Total Loan Amount */}
                                        <td className='px-4 py-3 text-right font-mono font-bold text-emerald-700'>
                                            ${Number(displayRow?.loanAmount || item.amount || 0).toLocaleString()}
                                        </td>

                                        {/* ពិន័យ */}
                                        <td className='px-4 py-3 text-right font-mono text-amber-600 font-bold'>
                                            ${Number(displayRow?.penalty || 0).toLocaleString()}
                                        </td>

                                        {/* ត្រូវបង់សរុប */}
                                        <td className='px-4 py-3 text-right font-mono text-sky-700 font-bold'>
                                            ${Number(displayRow?.scheduledAmount || 0).toLocaleString()}
                                        </td>

                                        {/* Total */}
                                        <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-600'>
                                            ${(Number(displayRow?.penalty || 0) + Number(displayRow?.scheduledAmount || 0)).toLocaleString()}
                                        </td>

                                        {/* ភ្ញៀវបានបង់ */}
                                        <td className='px-4 py-3 text-right font-mono font-bold text-emerald-700'>
                                            ${Number(displayRow?.paidAmount || 0).toLocaleString()}
                                        </td>

                                        {/* Comment */}
                                        <td className='px-4 py-3 text-slate-500 italic text-[11px] max-w-[140px] truncate'>
                                            {displayRow?.comment || '—'}
                                        </td>

                                        {/* កាលបរិច្ឆេទបានបង់ */}
                                        <td className='px-4 py-3 font-mono text-purple-600 font-bold'>
                                            {displayRow?.paidDate || '—'}
                                        </td>

                                        {/* Action — opens portal dropdown */}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={(e) => handleOpenMenu(e, menuKey)}
                                                className={`w-8 h-8 rounded-[5px] border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${openMenu.id === menuKey
                                                    ? 'bg-amber-100 border-amber-400 text-amber-700'
                                                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                                                    }`}
                                            >
                                                <AiOutlineMenu size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* ── Summary Footer ──────────────────────────────────── */}
                    {!loading && contracts.length > 0 && (
                        <tfoot className='border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-emerald-50/40'>
                            <tr>
                                <td colSpan={6} className='px-4 py-3 text-center text-xs font-extrabold text-slate-600 uppercase tracking-wide'>
                                    សរុប ({contracts.length} records)
                                </td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-700 text-sm border-l border-slate-200'>
                                    ${totals.loanAmount.toLocaleString()}
                                </td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-amber-600 text-sm'>
                                    ${totals.penalty.toLocaleString()}
                                </td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-sky-700 text-sm'>
                                    ${totals.scheduled.toLocaleString()}
                                </td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-600 text-sm'>
                                    ${totals.total.toLocaleString()}
                                </td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-700 text-sm'>
                                    ${totals.paid.toLocaleString()}
                                </td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* ── Pagination with page-size selector ────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs shadow-xs">
                {/* Left: showing info + items-per-page */}
                <div className="flex items-center gap-3 text-slate-500">
                    <span>
                        Showing{' '}
                        <span className="font-bold text-indigo-500">{contracts.length > 0 ? startItem : 0}</span>
                        {' – '}
                        <span className="font-bold text-indigo-500">{endItem}</span>
                        {' of '}
                        <span className="font-bold text-slate-700">{total}</span>
                        {' records'}
                    </span>

                    <label className="flex items-center gap-1.5 text-slate-500">
                        <span className="font-medium">Show:</span>
                        <select
                            value={limit}
                            onChange={e => setLimit(Number(e.target.value))}
                            className="h-7 px-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            {PAGE_SIZE_OPTIONS.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* Right: page buttons (only if more than 1 page) */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-xl font-bold border border-gray-700 transition-all cursor-pointer">«</button>
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                            className="flex items-center px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer">
                            <MdChevronLeft size={16} /></button>

                        {getPageNumbers().map(pg => (
                            <button key={pg} onClick={() => setCurrentPage(pg)}
                                className={`w-8 h-8 rounded-xl font-bold border transition-all cursor-pointer ${pg === currentPage
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                                {pg}
                            </button>
                        ))}

                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                            className="flex items-center px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer">
                            <MdChevronRight size={16} /></button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-xl font-bold border border-gray-700 transition-all cursor-pointer">»</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstallmentPage;
