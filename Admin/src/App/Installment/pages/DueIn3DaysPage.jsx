import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import CopyCell from '../../../components/CopyCell';
import { MdOutlineSync, MdSearch, MdPictureAsPdf, MdQrCode2 } from 'react-icons/md';
import { FaFileExcel, FaDollarSign, FaClock } from 'react-icons/fa';
import { AiOutlineMenu } from 'react-icons/ai';
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
    const isDays = duration.includes('day') || duration.includes('d');
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

// Filter: dueDate is within today+1 .. today+3
const isDueIn3Days = (displayRow) => {
    if (!displayRow?.dueDate) return false;
    if (['Paid', 'PayOff', 'Settled'].includes(displayRow.status)) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(`${displayRow.dueDate}T00:00:00`); due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due - today) / 86400000);
    return diffDays >= 1 && diffDays <= 3;
};

const getDaysRemaining = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`); due.setHours(0, 0, 0, 0);
    return Math.floor((due - today) / 86400000);
};

const statusBadgeClass = (status) => {
    if (status === 'Paid') return 'bg-emerald-50 border-emerald-300 text-emerald-700';
    if (status === 'PayOff') return 'bg-indigo-50 border-indigo-300 text-indigo-700';
    if (status === 'Settled') return 'bg-slate-50 border-slate-300 text-slate-500';
    return 'bg-sky-50 border-sky-300 text-sky-700';
};
const statusTextClass = (status) => {
    if (status === 'Paid') return 'text-emerald-600';
    if (status === 'PayOff') return 'text-indigo-600';
    if (status === 'Settled') return 'text-slate-400';
    return 'text-sky-700';
};

const ActionDropdownPortal = ({ item, pos, onClose, onOpenSchedule, onSelectMonth, onOpenQrModal }) => {
    const schedule = item?.repaymentSchedule || [];
    const activeIdx = getActiveRowIdx(schedule);
    const dropdownWidth = 240;
    const left = Math.max(8, Math.min(pos.left, window.innerWidth - dropdownWidth - 8));
    return ReactDOM.createPortal(
        <div data-action-menu-root="true"
            style={{ position: 'fixed', top: pos.bottom + 4, left, width: dropdownWidth, zIndex: 999999 }}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Repayment Actions</div>
            <button onClick={() => { onOpenQrModal(item); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors">
                <MdQrCode2 className="text-emerald-600 text-base flex-shrink-0" /><span>QR Code Payment</span>
            </button>
            <button onClick={() => { const idx = activeIdx === -1 ? schedule.length - 1 : Math.max(0, activeIdx); onOpenSchedule(item, idx); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 rounded-[6px] flex items-center gap-2 cursor-pointer transition-colors">
                <FaDollarSign className="text-sky-500 text-sm flex-shrink-0" /><span>Repayment Schedule ($)</span>
            </button>
            {schedule.length > 0 && (
                <div className="border-l-2 border-sky-200 ml-4 pl-2 space-y-0.5">
                    {schedule.map((row, mIdx) => {
                        const autoActiveIdx = activeIdx === -1 ? schedule.length - 1 : activeIdx;
                        const isCurrent = mIdx === autoActiveIdx;
                        return (
                            <button key={mIdx} onClick={() => { onSelectMonth(item, mIdx); onClose(); }}
                                className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${isCurrent ? 'bg-sky-100 text-sky-800 border border-sky-300' : `hover:bg-slate-50 ${statusTextClass(row.status)}`}`}>
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

const DueIn3DaysPage = () => {
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
        } catch (err) { console.error('Fetch due-in-3days contracts error:', err); }
        finally { setLoading(false); setTimeout(() => setReloading(false), 500); }
    }, [API_BASE1, user, searchTerm]);

    useEffect(() => { fetchContracts(searchTerm); }, [searchTerm, fetchContracts]);

    const dueIn3DaysContracts = useMemo(() => contracts.filter(c => {
        const id = c._id || c.contractId;
        const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[id] ?? null), c, latePenaltyRules);
        return isDueIn3Days(row);
    }), [contracts, latePenaltyRules, selectedMonthByContract]);

    const totals = useMemo(() => {
        let loanAmount = 0, penalty = 0, scheduled = 0, totalSum = 0, paid = 0;
        dueIn3DaysContracts.forEach(c => {
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
    }, [dueIn3DaysContracts, latePenaltyRules, selectedMonthByContract]);



    const handleOpenMenu = (e, itemId) => {
        e.stopPropagation();
        if (openMenu.id === itemId) { setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } }); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        setOpenMenu({ id: itemId, pos: { left: rect.right - 240, bottom: rect.bottom } });
    };

    const openScheduleForMonth = (contract, monthIdx) => { setScheduleModalContract(contract); setScheduleModalMonthIdx(monthIdx); setScheduleModalOpen(true); };
    const selectMonthForOuterRow = (contract, monthIdx) => { const id = contract._id || contract.contractId; setSelectedMonthByContract(prev => ({ ...prev, [id]: monthIdx })); };

    const handleExportExcel = () => {
        const data = dueIn3DaysContracts.map((c, i) => {
            const id = c._id || c.contractId;
            const row = getDisplayValues(getDisplayRow(c.repaymentSchedule || [], selectedMonthByContract[id] ?? null), c, latePenaltyRules);
            const daysLeft = getDaysRemaining(row?.dueDate);
            return { 'No': i + 1, 'Loan Date': c.inputDate || '', 'Customer Name': `${c.customerNameEn} (${c.customerNameKh})`, 'Brand': c.brand || '', 'Model': c.model || '', 'Due Date': row?.dueDate || '', 'Days Remaining': daysLeft, 'Total Loan Amount ($)': row?.loanAmount || 0, 'Penalty': row?.penalty || 0, 'Scheduled Amount': row?.scheduledAmount || 0, 'Total': (Number(row?.penalty || 0) + Number(row?.scheduledAmount || 0)), 'Paid Amount': row?.paidAmount || 0, 'Comment': row?.comment || '', 'Paid Date': row?.paidDate || '' };
        });
        exportToExcel(data, 'Due_In_3Days_Customers');
    };

    const handleExportPDF = () => exportToPDF('Due In 3 Days Customers', [{ header: 'No', cell: (_, i) => i + 1 }, { header: 'Customer', accessor: 'customerNameEn' }, { header: 'Model', accessor: 'model' }, { header: 'Brand', accessor: 'brand' }, { header: 'Loan Date', accessor: 'inputDate' }], dueIn3DaysContracts);

    const openMenuContract = openMenu.id ? contracts.find(c => (c._id || c.contractId) === openMenu.id) || null : null;

    return (
        <div className='w-full p-4 select-none space-y-4 relative'>
            <RepaymentScheduleModal open={scheduleModalOpen} setOpen={setScheduleModalOpen} contract={scheduleModalContract} mode="view_edit" defaultMonthIdx={scheduleModalMonthIdx} onSaved={() => fetchContracts(searchTerm)} />
            <QrPaymentModal open={Boolean(selectedQrContract)} contract={selectedQrContract} onClose={() => setSelectedQrContract(null)} onSaved={() => fetchContracts(searchTerm)} />
            {openMenu.id && openMenuContract && (
                <ActionDropdownPortal item={openMenuContract} pos={openMenu.pos} onClose={() => setOpenMenu({ id: null, pos: { left: 0, bottom: 0 } })} onOpenSchedule={openScheduleForMonth} onSelectMonth={selectMonthForOuterRow} onOpenQrModal={(c) => setSelectedQrContract(c)} />
            )}

            <header className='p-3 w-full border border-sky-200 bg-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-sky-600 flex items-center gap-2 flex-wrap'>
                        <FaClock className="text-sky-500" size={18} />
                        <span>Due In 3 Days</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-950 text-sky-300 border border-sky-800 font-normal">{dueIn3DaysContracts.length} Records</span>
                        {user?.brand && <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">{user.brand}</span>}
                    </h1>
                    <p className="text-[11px] text-sky-400 mt-0.5 font-medium">Customers whose payment is due within the next 3 days</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, model, serial..." className="pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 w-52 outline-none font-medium shadow-xs" />
                    </div>
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'><FaFileExcel className="text-emerald-600 text-sm" /><span>Excel</span></button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'><MdPictureAsPdf className="text-sky-600 text-sm" /><span>PDF</span></button>
                    <button onClick={() => fetchContracts(searchTerm)} disabled={reloading} className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'><MdOutlineSync size={16} className={reloading ? 'spin-reload text-sky-600' : ''} /><p>{t('reload')}</p></button>
                </div>
            </header>

            <div className='w-full overflow-auto rounded-xl border border-sky-100 bg-white shadow-md' style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-sky-50 text-sky-800 uppercase tracking-wider border-b border-sky-100 sticky top-0 z-10'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>Loan Date</th>
                            <th className='px-4 py-3'>Customer Name</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>Model</th>
                            <th className='px-4 py-3'>Due Date</th>
                            <th className='px-4 py-3 text-center'>Days Left</th>
                            <th className='px-4 py-3 text-right font-mono text-emerald-700'>Total Loan Amount</th>
                            <th className='px-4 py-3 text-right text-amber-600'>Penalty</th>
                            <th className='px-4 py-3 text-right text-sky-600'>Scheduled Amount</th>
                            <th className='px-4 py-3 text-right text-emerald-600 font-extrabold'>Total</th>
                            <th className='px-4 py-3 text-right text-emerald-700'>Paid Amount</th>
                            <th className='px-4 py-3'>Comment</th>
                            <th className='px-4 py-3 text-purple-600'>Paid Date</th>
                            <th className='px-4 py-3 text-center'>Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-sky-50 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={15} className="text-center py-10 text-sky-500 font-semibold">Loading...</td></tr>
                        ) : dueIn3DaysContracts.length === 0 ? (
                            <tr><td colSpan={15} className="text-center py-8 text-slate-500 italic font-medium">{searchTerm ? `No results for "${searchTerm}"` : 'No customers with payments due in the next 3 days.'}</td></tr>
                        ) : dueIn3DaysContracts.map((item, idx) => {
                            const id = item._id || item.contractId || String(idx);
                            const displayRow = getDisplayValues(getDisplayRow(item.repaymentSchedule || [], selectedMonthByContract[id] ?? null), item, latePenaltyRules);
                            const daysLeft = getDaysRemaining(displayRow?.dueDate);
                            const urgencyColor = daysLeft === 1 ? 'bg-red-100 border-red-300 text-red-700' : daysLeft === 2 ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-sky-100 border-sky-300 text-sky-700';
                            return (
                                <tr key={id} className="hover:bg-sky-50/40 transition-colors">
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-slate-700'>{item.inputDate || '—'}</td>
                                    <td className='px-4 py-3'><CopyCell text={item.customerNameEn} className='font-bold text-slate-900 block' /><CopyCell text={item.customerNameKh} className='text-emerald-700 font-khmer text-xs block font-semibold' /></td>
                                    <td className='px-4 py-3'><span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>{item.brand || '—'}</span></td>
                                    <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model} className='font-semibold text-slate-800' /></td>
                                    <td className='px-4 py-3 font-mono'>{displayRow?.dueDate ? <span className="font-bold text-sky-700">{displayRow.dueDate}</span> : '—'}</td>
                                    <td className='px-4 py-3 text-center'><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-extrabold text-[11px] ${urgencyColor}`}><FaClock size={9} />{daysLeft}d left</span></td>
                                    <td className='px-4 py-3 text-right font-mono font-bold text-emerald-700'>${Number(displayRow?.loanAmount || item.amount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-3 text-right font-mono text-amber-600 font-bold'>${Number(displayRow?.penalty || 0).toLocaleString()}</td>
                                    <td className='px-4 py-3 text-right font-mono text-sky-700 font-bold'>${Number(displayRow?.scheduledAmount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-600'>${(Number(displayRow?.penalty || 0) + Number(displayRow?.scheduledAmount || 0)).toLocaleString()}</td>
                                    <td className='px-4 py-3 text-right font-mono font-bold text-emerald-700'>${Number(displayRow?.paidAmount || 0).toLocaleString()}</td>
                                    <td className='px-4 py-3 text-slate-500 italic text-[11px] max-w-[140px] truncate'>{displayRow?.comment || '—'}</td>
                                    <td className='px-4 py-3 font-mono text-purple-600 font-bold'>{displayRow?.paidDate || '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={(e) => handleOpenMenu(e, id)} className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${openMenu.id === id ? 'bg-sky-100 border-sky-400 text-sky-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}><AiOutlineMenu size={16} /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {!loading && dueIn3DaysContracts.length > 0 && (
                        <tfoot className='border-t-2 border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50/40'>
                            <tr>
                                <td colSpan={7} className='px-4 py-3 text-center text-xs font-extrabold text-sky-700 uppercase tracking-wide'>Total Due In 3 Days ({dueIn3DaysContracts.length} records)</td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-700 text-sm border-l border-sky-100'>${totals.loanAmount.toLocaleString()}</td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-amber-600 text-sm'>${totals.penalty.toLocaleString()}</td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-sky-700 text-sm'>${totals.scheduled.toLocaleString()}</td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-600 text-sm'>${totals.total.toLocaleString()}</td>
                                <td className='px-4 py-3 text-right font-mono font-extrabold text-emerald-700 text-sm'>${totals.paid.toLocaleString()}</td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

        </div>
    );
};

export default DueIn3DaysPage;

