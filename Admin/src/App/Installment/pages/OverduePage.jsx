import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import CopyCell from '../../../components/CopyCell';
import { MdOutlineSync, MdSearch, MdPictureAsPdf, MdQrCode2, } from 'react-icons/md';
import { AiOutlineMenu } from 'react-icons/ai';
import { FaFileExcel, FaDollarSign, FaExclamationTriangle } from 'react-icons/fa';
import RepaymentScheduleModal from '../../Contract/components/RepaymentScheduleModal';
import QrPaymentModal from '../components/QrPaymentModal';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const getActiveRowIdx = (schedule = []) => {
    const payOffIdx = schedule.findIndex(r => r.status === 'PayOff');
    if (payOffIdx !== -1) return -1;
    return schedule.findIndex(r => r.status === 'Pending' || r.status === 'Saved');
};

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
    if (isDays) dueDate.setDate(dueDate.getDate() + count);
    else dueDate.setMonth(dueDate.getMonth() + Number(row.monthIndex || 1));
    return { ...row, dueDate: dueDate.toISOString().split('T')[0] };
};

const getAutomaticPenalty = (row, contract, rules = []) => {
    if (!row?.dueDate || ['Paid', 'PayOff', 'Settled'].includes(row.status)) return Number(row?.penalty || 0) || 0;
    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return Number(row.penalty || 0) || 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lateDays = Math.max(0, Math.floor((today - dueDate) / 86400000));
    if (lateDays <= 0) return 0;
    const brand = String(contract?.brand || '').trim();
    const applicableRules = rules
        .filter(rule => !String(rule?.brand || '').trim() || String(rule.brand).trim() === brand)
        .filter(rule => lateDays >= Number(rule.afterDays || 0));
    if (applicableRules.length === 0) return Number(row.penalty || 0) || 0;
    const bestRule = applicableRules.reduce((w, rule) => (!w || Number(rule.afterDays || 0) > Number(w.afterDays || 0) ? rule : w), null);
    return lateDays * Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
};

const getDisplayValues = (row, contract, rules) => {
    if (!row) return null;
    const rowWithDueDate = getRowWithDueDate(row, contract);
    const penalty = getAutomaticPenalty(rowWithDueDate, contract, rules);
    return { ...rowWithDueDate, penalty, totalAmount: Number(row.scheduledAmount || 0) + penalty };
};

const isOverdue = (displayRow) => {
    if (!displayRow?.dueDate) return false;
    if (['Paid', 'PayOff', 'Settled'].includes(displayRow.status)) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(`${displayRow.dueDate}T00:00:00`) < today;
};

const getLateDays = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - new Date(`${dueDate}T00:00:00`)) / 86400000));
};

const formatLateDays = (days) => {
    const count = Number(days || 0);
    if (!Number.isFinite(count) || count <= 0) return '0d';
    const months = Math.floor(count / 30);
    const remainder = count % 30;
    if (months && remainder) return `${months} month ${remainder}d`;
    if (months) return `${months} month`;
    return `${count}d`;
};

const statusBadgeClass = (status) => {
    if (status === 'Paid') return 'bg-emerald-50 border-emerald-300 text-emerald-700';
    if (status === 'PayOff') return 'bg-indigo-50 border-indigo-300 text-indigo-700';
    if (status === 'Settled') return 'bg-slate-50 border-slate-300 text-slate-500';
    return 'bg-red-50 border-red-300 text-red-700';
};
const statusTextClass = (status) => {
    if (status === 'Paid') return 'text-emerald-600';
    if (status === 'PayOff') return 'text-indigo-600';
    if (status === 'Settled') return 'text-slate-400';
    return 'text-red-700';
};

const ActionDropdownPortal = ({ item, pos, onClose, onOpenSchedule, onSelectMonth, onOpenQrModal }) => {
    const schedule = item?.repaymentSchedule || [];
    const activeIdx = getActiveRowIdx(schedule);
    const dropdownWidth = 240;
    const left = Math.max(8, Math.min(pos.left, window.innerWidth - dropdownWidth - 8));
    return ReactDOM.createPortal(
        <div data-action-menu-root="true"
            style={{ position: 'fixed', top: pos.bottom + 4, left, width: dropdownWidth, zIndex: 999999 }}
            className="bg-white border border-slate-200 rounded-[5px] shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('repaymentActions')}</div>
            <button onClick={() => { onOpenQrModal(item); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors">
                <MdQrCode2 className="text-emerald-600 text-base flex-shrink-0" /><span>{t('qrCodePayment')}</span>
            </button>
            <button onClick={() => { const idx = activeIdx === -1 ? schedule.length - 1 : Math.max(0, activeIdx); onOpenSchedule(item, idx); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors">
                <FaDollarSign className="text-red-500 text-sm flex-shrink-0" /><span>{t('repaymentScheduleAmount')}</span>
            </button>
            {schedule.length > 0 && (
                <div className="border-l-2 border-red-200 ml-4 pl-2 space-y-0.5">
                    {schedule.map((row, mIdx) => {
                        const autoActiveIdx = activeIdx === -1 ? schedule.length - 1 : activeIdx;
                        const isCurrent = mIdx === autoActiveIdx;
                        return (
                            <button key={mIdx} onClick={() => { onSelectMonth(item, mIdx); onClose(); }}
                                className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-[5px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${isCurrent ? 'bg-red-100 text-red-800 border border-red-300' : `hover:bg-slate-50 ${statusTextClass(row.status)}`}`}>
                                <span>{row.labelName || `Month ${row.monthIndex}`}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadgeClass(row.status)}`}>{row.status}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>,
        document.body
    );
};

const OverduePage = () => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [latePenaltyRules, setLatePenaltyRules] = useState([]);
    const [openMenu, setOpenMenu] = useState({ id: null, pos: { left: 0, bottom: 0 } });
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleModalContract, setScheduleModalContract] = useState(null);
    const [scheduleModalMonthIdx, setScheduleModalMonthIdx] = useState(null);
    const [selectedMonthByContract, setSelectedMonthByContract] = useState({});
    const [selectedQrContract, setSelectedQrContract] = useState(null);

    useEffect(() => {
        if (!openMenu.id) return;
        const handler = (e) => { if (!(e.target instanceof Element && e.target.closest('[data-action-menu-root]'))) setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } }); };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [openMenu.id]);

    useEffect(() => {
        fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(user?.brand || '')}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => setLatePenaltyRules(Array.isArray(data?.late_penalty_rules) ? data.late_penalty_rules : []))
            .catch(() => { });
    }, [API_BASE1, user?.brand]);

    useEffect(() => {
        const nextSearch = searchParams.get('search') || '';
        setSearchTerm(prev => (prev === nextSearch ? prev : nextSearch));
    }, [searchParams]);

    useEffect(() => {
        const nextSearch = searchTerm.trim();
        if (nextSearch) {
            setSearchParams({ search: nextSearch }, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [searchTerm, setSearchParams]);

    const fetchContracts = useCallback(async (search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ status: 'Activated', page: 1, limit: 10000, requireSchedule: 'true', userBrand: user?.brand || '', userRole: user?.role || '', username: user?.username || '', isImmutable: user?.isImmutable ? 'true' : 'false' });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) { const data = await res.json(); setContracts(data.data || []); }
        } catch (err) { console.error('Fetch overdue contracts error:', err); }
        finally { setLoading(false); setTimeout(() => setReloading(false), 500); }
    }, [API_BASE1, user, searchTerm]);

    useEffect(() => { fetchContracts(searchTerm); }, [searchTerm, fetchContracts]);

    const overdueContracts = useMemo(() => contracts.filter(c => {
        const id = c._id || c.contractId;
        const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[id] ?? null), c, latePenaltyRules);
        return isOverdue(row);
    }), [contracts, latePenaltyRules, selectedMonthByContract]);

    const totals = useMemo(() => {
        let loanAmount = 0, penalty = 0, scheduled = 0, totalSum = 0, paid = 0;
        overdueContracts.forEach(c => {
            const id = c._id || c.contractId;
            const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[id] ?? null), c, latePenaltyRules);
            if (!row) return;
            loanAmount += Number(row.loanAmount || c.amount || 0);
            penalty += Number(row.penalty || 0);
            scheduled += Number(row.scheduledAmount || 0);
            totalSum += Number(row.penalty || 0) + Number(row.scheduledAmount || 0);
            paid += Number(row.paidAmount || 0);
        });
        return { loanAmount, penalty, scheduled, total: totalSum, paid };
    }, [overdueContracts, latePenaltyRules, selectedMonthByContract]);


    const handleOpenMenu = (e, itemId) => {
        e.stopPropagation();
        if (openMenu.id === itemId) { setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } }); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        setOpenMenu({ id: itemId, pos: { left: rect.right - 240, bottom: rect.bottom } });
    };

    const openScheduleForMonth = (contract, monthIdx) => { setScheduleModalContract(contract); setScheduleModalMonthIdx(monthIdx); setScheduleModalOpen(true); };
    const selectMonthForOuterRow = (contract, monthIdx) => { const id = contract._id || contract.contractId; setSelectedMonthByContract(prev => ({ ...prev, [id]: monthIdx })); };

    const handleExportExcel = () => {
        const data = overdueContracts.map((c, i) => {
            const id = c._id || c.contractId;
            const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[id] ?? null), c, latePenaltyRules);
            return { 'No': i + 1, 'Loan Date': c.inputDate || '', 'Customer Name': `${c.customerNameEn} (${c.customerNameKh})`, 'Brand': c.brand || '', 'Model': c.model || '', 'Due Date': row?.dueDate || '', 'Late Days': getLateDays(row?.dueDate), 'Total Loan Amount ($)': row?.loanAmount || 0, 'Penalty': row?.penalty || 0, 'Scheduled Amount': row?.scheduledAmount || 0, 'Total': (Number(row?.penalty || 0) + Number(row?.scheduledAmount || 0)), 'Paid Amount': row?.paidAmount || 0, 'Comment': row?.comment || '', 'Paid Date': row?.paidDate || '' };
        });
        exportToExcel(data, 'Overdue_Customers');
    };

    const handleExportPDF = (orientation = 'portrait') => exportToPDF('Overdue Customers', [{ header: 'No', cell: (_, i, orientation) => i + 1 }, { header: 'Customer', accessor: 'customerNameEn' }, { header: 'Model', accessor: 'model' }, { header: 'Brand', accessor: 'brand' }, { header: 'Loan Date', accessor: 'inputDate' }], overdueContracts);

    const openMenuContract = openMenu.id ? contracts.find(c => (c._id || c.contractId) === openMenu.id) || null : null;

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4 relative'>
            <RepaymentScheduleModal open={scheduleModalOpen} setOpen={setScheduleModalOpen} contract={scheduleModalContract} mode="view_edit" defaultMonthIdx={scheduleModalMonthIdx} onSaved={() => fetchContracts(searchTerm)} />
            <QrPaymentModal open={Boolean(selectedQrContract)} contract={selectedQrContract} onClose={() => setSelectedQrContract(null)} onSaved={() => fetchContracts(searchTerm)} />
            {openMenu.id && openMenuContract && (
                <ActionDropdownPortal item={openMenuContract} pos={openMenu.pos} onClose={() => setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } })} onOpenSchedule={openScheduleForMonth} onSelectMonth={selectMonthForOuterRow} onOpenQrModal={(c) => setSelectedQrContract(c)} />
            )}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className='p-2 w-full border border-red-200 bg-white rounded-[5px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-red-500 flex items-center gap-2 flex-wrap'>
                        <span>{t('overdueCustomers')}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-950 text-red-300 border border-red-800 font-normal">{overdueContracts.length} Records</span>
                        {user?.brand && <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">{user.brand}</span>}
                    </h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('activatedSearchPlaceholder')} className="pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 w-52 outline-none font-medium shadow-xs" />
                    </div>
                    <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                </div>
            </header>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className='w-full overflow-auto rounded-[5px] border border-red-100 bg-white shadow-md' style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-red-50 text-red-800 uppercase tracking-wider border-b border-red-100 sticky top-0 z-10'>
                        <tr>
                            <th className='px-4 py-1 text-center'>{t('no')}</th>
                            <th className='px-4 py-1'>{t('inputDate')}</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('brand')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('dueDateLabel')}</th>
                            <th className='px-4 py-1 text-center'>{t('lateDays')}</th>
                            <th className='px-4 py-1 text-right font-mono text-emerald-700'>{t('customerTotalLoanAmount')}</th>
                            <th className='px-4 py-1 text-right text-amber-600'>{t('penalty')}</th>
                            <th className='px-4 py-1 text-right text-sky-600'>{t('scheduledAmountLabel')}</th>
                            <th className='px-4 py-1 text-right text-emerald-600 font-extrabold'>{t('total')}</th>
                            <th className='px-4 py-1 text-right text-emerald-700'>{t('paidAmountLabel')}</th>
                            <th className='px-4 py-1'>{t('commentLabel')}</th>
                            <th className='px-4 py-1 text-purple-600'>{t('paidDate')}</th>
                            <th className='px-4 py-1 text-center'>{t('actionLabel')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-red-50 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={15} className="text-center py-10 text-red-500 font-semibold">{t('loading')}</td></tr>
                        ) : overdueContracts.length === 0 ? (
                            <tr><td colSpan={15} className="text-center py-8 text-slate-500 italic font-medium">{searchTerm ? `No overdue results for "${searchTerm}"` : 'No overdue customers found. All payments are up to date!'}</td></tr>
                        ) : overdueContracts.map((item, idx) => {
                            const id = item._id || item.contractId || String(idx);
                            const displayRow = getDisplayValues(getDisplayRow(item.repaymentSchedule || [], selectedMonthByContract[id] ?? null), item, latePenaltyRules);
                            const lateDays = getLateDays(displayRow?.dueDate);
                            return (
                                <tr key={id} className="hover:bg-red-50/40 transition-colors bg-red-50/10">
                                    <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{idx + 1}</td>
                                    <td className='px-4 py-1 font-mono text-slate-700'>{item.inputDate || '—'}</td>
                                    <td className='px-4 py-1'><CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' /><CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs block font-semibold' /></td>
                                    <td className='px-4 py-1'><span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>{item.brand || '—'}</span></td>
                                    <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-1 font-mono'>{displayRow?.dueDate ? <span className="font-bold text-red-600">{displayRow.dueDate}</span> : '—'}</td>
                                    <td className='px-4 py-1 text-center'><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-700 font-extrabold text-[11px]"><FaExclamationTriangle size={9} />{formatLateDays(lateDays)} late</span></td>
                                    <td className='px-4 py-1 text-right font-mono font-bold text-emerald-700'>${Number(displayRow?.loanAmount || item.amount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-1 text-right font-mono text-amber-600 font-bold'>${Number(displayRow?.penalty || 0).toLocaleString()}</td>
                                    <td className='px-4 py-1 text-right font-mono text-sky-700 font-bold'>${Number(displayRow?.scheduledAmount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-1 text-right font-mono font-extrabold text-emerald-600'>${(Number(displayRow?.penalty || 0) + Number(displayRow?.scheduledAmount || 0)).toLocaleString()}</td>
                                    <td className='px-4 py-1 text-right font-mono font-bold text-emerald-700'>${Number(displayRow?.paidAmount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-1 text-slate-500 italic text-[11px] max-w-[140px] truncate'>{displayRow?.comment || '—'}</td>
                                    <td className='px-4 py-1 font-mono text-purple-600 font-bold'>{displayRow?.paidDate || '—'}</td>
                                    <td className="px-4 py-1 text-center">
                                        <button onClick={(e) => handleOpenMenu(e, id)} className={`w-8 h-8 rounded-[5px] border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${openMenu.id === id ? 'bg-red-100 border-red-400 text-red-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}><AiOutlineMenu size={16} /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {!loading && overdueContracts.length > 0 && (
                        <tfoot className='border-t-2 border-red-200 bg-gradient-to-r from-red-50 to-rose-50/40'>
                            <tr>
                                <td colSpan={7} />
                                <td className='px-4 py-1 text-right font-mono font-extrabold text-emerald-700 text-sm border-l border-red-100'>${totals.loanAmount.toLocaleString()}</td>
                                <td className='px-4 py-1 text-right font-mono font-extrabold text-amber-600 text-sm'>${totals.penalty.toLocaleString()}</td>
                                <td className='px-4 py-1 text-right font-mono font-extrabold text-sky-700 text-sm'>${totals.scheduled.toLocaleString()}</td>
                                <td className='px-4 py-1 text-right font-mono font-extrabold text-emerald-600 text-sm'>${totals.total.toLocaleString()}</td>
                                <td className='px-4 py-1 text-right font-mono font-extrabold text-emerald-700 text-sm'>${totals.paid.toLocaleString()}</td>
                                <td colSpan={3} className='px-4 py-1 text-center text-xs font-extrabold text-red-700 uppercase tracking-wide'>Total Overdue ({overdueContracts.length} records)</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>


        </div>
    );
};

export default OverduePage;

