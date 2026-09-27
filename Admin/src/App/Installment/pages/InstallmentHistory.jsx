import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import RepaymentScheduleModal from '../../Contract/components/RepaymentScheduleModal';
import QrPaymentModal from '../components/QrPaymentModal';
import { FaDollarSign, FaFileExcel, FaImage, FaTimes } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdQrCode2 } from 'react-icons/md';

const PAGE_SIZE = 25;
const FETCH_LIMIT = 100000;
const PAID_STATUSES = ['Paid', 'PayOff'];

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const addMonths = (date, months) => {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
};

const getRowWithDueDate = (row, contract) => {
    if (!row || row.dueDate || !contract?.inputDate) return row;
    const duration = String(contract.duration || '').toLowerCase();
    const matched = duration.match(/\d+/);
    const count = matched ? Math.max(1, Number(matched[0])) : 1;
    const dueDate = new Date(`${contract.inputDate}T00:00:00`);
    if (duration.includes('day') || duration.includes('ថ្ងៃ') || duration.includes('d')) {
        dueDate.setDate(dueDate.getDate() + count);
    } else {
        dueDate.setMonth(dueDate.getMonth() + Number(row.monthIndex || 1));
    }
    return { ...row, dueDate: formatLocalDate(dueDate) };
};

const getPenalty = (row, contract, rules, today) => {
    if (!row?.dueDate || PAID_STATUSES.includes(row.status) || row.status === 'Settled') {
        return Number(row?.penalty || 0) || 0;
    }
    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return Number(row.penalty || 0) || 0;
    const todayDate = new Date(`${today}T00:00:00`);
    const lateDays = Math.max(0, Math.floor((todayDate - dueDate) / 86400000));
    if (lateDays <= 0) return 0;

    const brand = String(contract?.brand || '').trim();
    const applicableRules = rules
        .filter(rule => !String(rule?.brand || '').trim() || String(rule.brand).trim() === brand)
        .filter(rule => lateDays >= Number(rule.afterDays || 0));
    if (!applicableRules.length) return Number(row.penalty || 0) || 0;

    const bestRule = applicableRules.reduce((winner, rule) => (
        !winner || Number(rule.afterDays || 0) > Number(winner.afterDays || 0) ? rule : winner
    ), null);
    const perDay = Number(bestRule?.penaltyPerDay || bestRule?.amount || bestRule?.penalty || 0);
    return lateDays * perDay;
};

const getImages = (row) => [...new Set([
    ...(Array.isArray(row.paymentImages) ? row.paymentImages : []),
    ...(Array.isArray(row.images) ? row.images : [])
].filter(Boolean))];

const InstallmentHistory = () => {
    const { API_BASE1, user, hasPermission } = useAuth();
    const isMasterAdmin = user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin';

    const [contracts, setContracts] = useState([]);
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [search, setSearch] = useState('');
    const [period, setPeriod] = useState('Today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [page, setPage] = useState(1);
    const [reloadVersion, setReloadVersion] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [penaltyRules, setPenaltyRules] = useState([]);
    const [viewImages, setViewImages] = useState([]);
    const [viewImageIndex, setViewImageIndex] = useState(0);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleModalContract, setScheduleModalContract] = useState(null);
    const [scheduleModalMonthIndex, setScheduleModalMonthIndex] = useState(null);
    const [selectedQrContract, setSelectedQrContract] = useState(null);

    useEffect(() => {
        if (!isMasterAdmin) return;
        let cancelled = false;
        fetch(`${API_BASE1}/controlsystem?brand=`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (cancelled) return;
                const category = data?.droplists?.find(item => item.category === 'Brands');
                setBrands(Array.isArray(category?.items)
                    ? category.items.map(item => typeof item === 'string' ? item : item.name).filter(Boolean)
                    : []);
            })
            .catch(err => console.error('Failed to load installment brands:', err));
        return () => { cancelled = true; };
    }, [API_BASE1, isMasterAdmin]);

    useEffect(() => {
        let cancelled = false;
        const brand = isMasterAdmin ? selectedBrand : (user?.brand || '');
        fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!cancelled) setPenaltyRules(Array.isArray(data?.late_penalty_rules) ? data.late_penalty_rules : []);
            })
            .catch(err => console.error('Failed to load installment penalty rules:', err));
        return () => { cancelled = true; };
    }, [API_BASE1, isMasterAdmin, selectedBrand, user?.brand]);

    useEffect(() => {
        let cancelled = false;
        const loadContracts = async () => {
            setLoading(true);
            setReloading(true);
            const commonParams = new URLSearchParams({
                page: '1',
                limit: String(FETCH_LIMIT),
                requireSchedule: 'true',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (isMasterAdmin && selectedBrand) commonParams.set('brand', selectedBrand);

            try {
                const responses = await Promise.all(['Activated', 'Redeem'].map(status => {
                    const params = new URLSearchParams(commonParams);
                    params.set('status', status);
                    return fetch(`${API_BASE1}/contracts?${params.toString()}`);
                }));
                const payloads = await Promise.all(responses.map(res => res.ok ? res.json() : { data: [] }));
                if (cancelled) return;

                const uniqueContracts = new Map();
                payloads.flatMap(payload => payload.data || []).forEach(contract => {
                    uniqueContracts.set(String(contract._id || contract.contractId), contract);
                });
                setContracts([...uniqueContracts.values()]);
            } catch (err) {
                console.error('Failed to load installment history:', err);
                if (!cancelled) setContracts([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setReloading(false);
                }
            }
        };

        loadContracts();
        return () => { cancelled = true; };
    }, [API_BASE1, isMasterAdmin, selectedBrand, user, reloadVersion]);

    const today = formatLocalDate(new Date());
    const dateRange = useMemo(() => {
        if (period === 'Custom') return { from: customFrom, to: customTo };
        const start = new Date(`${today}T00:00:00`);
        if (period === '7 days') return { from: today, to: formatLocalDate(addDays(start, 6)) };
        if (period === '1 month') return { from: today, to: formatLocalDate(addMonths(start, 1)) };
        if (period === '3 months') return { from: today, to: formatLocalDate(addMonths(start, 3)) };
        return { from: today, to: today };
    }, [period, customFrom, customTo, today]);

    const scheduleRows = useMemo(() => contracts.flatMap(contract => {
        const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];
        return schedule.flatMap((rawRow, index) => {
            if (rawRow.status === 'Settled') return [];
            const row = getRowWithDueDate(rawRow, contract);
            if (!row?.dueDate) return [];
            if (dateRange.from && row.dueDate < dateRange.from) return [];
            if (dateRange.to && row.dueDate > dateRange.to) return [];
            if (selectedBrand && contract.brand !== selectedBrand) return [];

            const penalty = getPenalty(row, contract, penaltyRules, today);
            const scheduledAmount = Number(row.scheduledAmount || 0);
            const paidAmount = Number(row.paidAmount || 0);
            const totalDue = scheduledAmount + penalty;
            const isPaid = PAID_STATUSES.includes(row.status) || (totalDue > 0 && paidAmount >= totalDue);
            const unpaidAmount = isPaid ? 0 : Math.max(0, totalDue - paidAmount);
            const dueTimestamp = new Date(`${row.dueDate}T00:00:00`).getTime();
            const todayTimestamp = new Date(`${today}T00:00:00`).getTime();
            const daysUntilDue = Math.round((dueTimestamp - todayTimestamp) / 86400000);
            const type = contract.status === 'Redeem' && row.status === 'PayOff'
                ? 'Redeem'
                : row.status === 'PayOff' ? 'Payoff' : 'Pad';

            return [{
                ...row,
                _id: `${contract._id || contract.contractId}-${row.monthIndex || index + 1}`,
                contractId: contract.contractId || '',
                contract,
                scheduleIndex: index,
                customerName: contract.customerNameEn || contract.customerNameKh || 'Customer',
                customerNameKh: contract.customerNameKh || '',
                brand: contract.brand || '',
                model: contract.model || '',
                serialNumber: contract.serialNumber || '',
                loanDate: contract.inputDate || '',
                penalty,
                scheduledAmount,
                paidAmount,
                totalDue,
                unpaidAmount,
                isPaid,
                daysUntilDue,
                type
            }];
        });
    }), [contracts, dateRange, selectedBrand, penaltyRules, today]);

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        return scheduleRows
            .filter(row => !query || [row.customerName, row.customerNameKh, row.contractId, row.model,
                row.serialNumber, row.brand, row.labelName, row.monthLabel]
                .some(value => String(value || '').toLowerCase().includes(query)))
            .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.customerName.localeCompare(right.customerName));
    }, [scheduleRows, search]);

    useEffect(() => { setPage(1); }, [search, period, customFrom, customTo, selectedBrand]);

    const customerCount = new Set(filteredRows.map(row => row.contractId)).size;
    const paidTotal = filteredRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const penaltyTotal = filteredRows.reduce((sum, row) => sum + row.penalty, 0);
    const unpaidTotal = filteredRows.reduce((sum, row) => sum + row.unpaidAmount, 0);
    const unpaidCount = filteredRows.filter(row => row.unpaidAmount > 0).length;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const exportRows = filteredRows.map((row, index) => ({
        No: index + 1,
        'Loan Date': row.loanDate,
        'Customer Name': `${row.customerName} ${row.customerNameKh}`.trim(),
        'Contract ID': row.contractId,
        Brand: row.brand,
        Model: row.model,
        'Serial Number': row.serialNumber,
        Installment: row.labelName || row.monthLabel || `Month ${row.monthIndex || ''}`,
        'Due Date': row.dueDate,
        'Days Until Due': row.isPaid ? 'Paid' : row.daysUntilDue,
        'Scheduled Amount': row.scheduledAmount,
        Penalty: row.penalty,
        'Paid Amount': row.paidAmount,
        'Unpaid Amount': row.unpaidAmount,
        Status: row.isPaid ? 'Paid' : row.daysUntilDue < 0 ? 'Overdue' : row.daysUntilDue === 0 ? 'Due Today' : 'Upcoming',
        Type: row.type
    }));

    const exportExcel = () => exportToExcel(exportRows, 'Installment_History');
    const exportPdf = () => exportToPDF('Installment History', [
        { header: 'Due Date', accessor: 'Due Date' },
        { header: 'Customer', accessor: 'Customer Name' },
        { header: 'Brand', accessor: 'Brand' },
        { header: 'Installment', accessor: 'Installment' },
        { header: 'Due', cell: row => `$${Number(row['Scheduled Amount'] || 0).toLocaleString()}` },
        { header: 'Penalty', cell: row => `$${Number(row.Penalty || 0).toLocaleString()}` },
        { header: 'Paid', cell: row => `$${Number(row['Paid Amount'] || 0).toLocaleString()}` },
        { header: 'Unpaid', cell: row => `$${Number(row['Unpaid Amount'] || 0).toLocaleString()}` },
        { header: 'Status', accessor: 'Status' }
    ], exportRows);

    const openImageGallery = (row) => {
        const images = getImages(row);
        if (!images.length) return;
        setViewImages(images);
        setViewImageIndex(0);
    };

    const openScheduleForRow = (row) => {
        setScheduleModalContract(row.contract);
        setScheduleModalMonthIndex(row.scheduleIndex);
        setScheduleModalOpen(true);
    };

    const refreshContracts = () => setReloadVersion(value => value + 1);

    const presetOptions = ['Today', '7 days', '1 month', '3 months', 'Custom'];

    return (
        <div className="w-full space-y-4 bg-[#f4f6f8] p-4">
            <RepaymentScheduleModal
                open={scheduleModalOpen}
                setOpen={setScheduleModalOpen}
                contract={scheduleModalContract}
                mode="view_edit"
                defaultMonthIdx={scheduleModalMonthIndex}
                onSaved={refreshContracts}
            />
            <QrPaymentModal
                open={Boolean(selectedQrContract)}
                contract={selectedQrContract}
                onClose={() => setSelectedQrContract(null)}
                onSaved={refreshContracts}
            />
            {viewImages.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setViewImages([])}>
                    <div className="relative max-h-full max-w-4xl" onClick={event => event.stopPropagation()}>
                        <button onClick={() => setViewImages([])} className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-2 text-slate-700" aria-label="Close image viewer"><FaTimes /></button>
                        {viewImages.length > 1 && viewImageIndex > 0 && <button onClick={() => setViewImageIndex(index => index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-white/90 px-3 py-2">Previous</button>}
                        <img src={viewImages[viewImageIndex]} alt="Payment proof" className="max-h-[85vh] max-w-full object-contain" />
                        {viewImages.length > 1 && viewImageIndex < viewImages.length - 1 && <button onClick={() => setViewImageIndex(index => index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-white/90 px-3 py-2">Next</button>}
                    </div>
                </div>
            )}

            <header className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Installment History</h1>
                        <p className="text-xs text-slate-500">កាលវិភាគបង់ប្រាក់តាមថ្ងៃកំណត់</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {hasPermission('/installment/history', 'export') && <>
                            <button onClick={exportExcel} className="flex items-center gap-2 rounded-[5px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><FaFileExcel /> Excel</button>
                            <button onClick={exportPdf} className="flex items-center gap-2 rounded-[5px] border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800"><MdPictureAsPdf /> PDF</button>
                        </>}
                        <button onClick={() => setReloadVersion(value => value + 1)} disabled={reloading} className="flex items-center gap-2 rounded-[5px] border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                            <MdOutlineSync className={reloading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <div className="border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-emerald-800">ភ្ញៀវសរុប</div>
                        <div className="text-lg font-black text-slate-900">{customerCount.toLocaleString()}</div>
                    </div>
                    <div className="border-l-4 border-sky-500 bg-sky-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-sky-800">បានបង់សរុប</div>
                        <div className="text-lg font-black text-slate-900">${paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-amber-800">ពិន័យសរុប</div>
                        <div className="text-lg font-black text-slate-900">${penaltyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="border-l-4 border-rose-500 bg-rose-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-rose-800">មិនទាន់បានបង់ · {unpaidCount} installments</div>
                        <div className="text-lg font-black text-slate-900">${unpaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                    <div>
                        <div className="mb-1 text-[10px] font-bold text-slate-500">Due period</div>
                        <div className="inline-flex flex-wrap rounded-[5px] border border-slate-300 bg-slate-100 p-0.5" role="group" aria-label="Due period">
                            {presetOptions.map(option => (
                                <button key={option} onClick={() => setPeriod(option)} className={`rounded-[4px] px-3 py-2 text-xs font-semibold ${period === option ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white'}`}>
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                    {period === 'Custom' && <>
                        <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">From<input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className="h-9 rounded-[5px] border border-slate-300 px-2 text-xs font-mono text-slate-800" /></label>
                        <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">To<input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className="h-9 rounded-[5px] border border-slate-300 px-2 text-xs font-mono text-slate-800" /></label>
                    </>}
                    <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                        Search
                        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Customer, contract, serial..." className="h-9 w-56 rounded-[5px] border border-slate-300 px-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500" />
                    </label>
                    {isMasterAdmin && <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                        Brand
                        <select value={selectedBrand} onChange={event => setSelectedBrand(event.target.value)} className="h-9 min-w-40 rounded-[5px] border border-slate-300 bg-white px-2 text-xs text-slate-800">
                            <option value="">All brands</option>
                            {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                    </label>}
                    <div className="ml-auto self-center text-[11px] font-mono text-slate-500">{dateRange.from || 'Any date'} → {dateRange.to || 'Any date'}</div>
                </div>
            </header>

            <div className="max-h-[calc(100vh-390px)] min-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                <table className="w-full min-w-[1450px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-700">
                        <tr>
                            <th className="px-3 py-3 text-center">No.</th>
                            <th className="px-3 py-3">Loan date</th>
                            <th className="px-3 py-3">Customer / Contract</th>
                            <th className="px-3 py-3">Brand</th>
                            <th className="px-3 py-3">Model / Serial</th>
                            <th className="px-3 py-3">Installment</th>
                            <th className="px-3 py-3">Due date</th>
                            <th className="px-3 py-3">Due status</th>
                            <th className="px-3 py-3 text-right">Amount due</th>
                            <th className="px-3 py-3 text-right">Penalty</th>
                            <th className="px-3 py-3 text-right">Paid</th>
                            <th className="px-3 py-3 text-right">Unpaid</th>
                            <th className="px-3 py-3 text-center">Image</th>
                            <th className="px-3 py-3">Pad / Payoff / Redeem</th>
                            <th className="px-3 py-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <tr><td colSpan={15} className="py-12 text-center font-semibold text-emerald-700">Loading installment schedule...</td></tr>
                            : visibleRows.length === 0 ? <tr><td colSpan={15} className="py-12 text-center italic text-slate-500">No installments due in this period.</td></tr>
                                : visibleRows.map((row, index) => {
                                    const images = getImages(row);
                                    const statusText = row.isPaid ? 'បានបង់រួច'
                                        : row.daysUntilDue < 0 ? `ហួស ${Math.abs(row.daysUntilDue)} ថ្ងៃ`
                                            : row.daysUntilDue === 0 ? 'ដល់ថ្ងៃបង់'
                                                : `នៅសល់ ${row.daysUntilDue} ថ្ងៃ`;
                                    const statusClass = row.isPaid ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                        : row.daysUntilDue < 0 ? 'border-rose-300 bg-rose-50 text-rose-800'
                                            : row.daysUntilDue === 0 ? 'border-amber-300 bg-amber-50 text-amber-900'
                                                : 'border-sky-300 bg-sky-50 text-sky-800';
                                    const typeClass = row.type === 'Redeem' ? 'border-amber-300 bg-amber-50 text-amber-800'
                                        : row.type === 'Payoff' ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                                            : 'border-emerald-300 bg-emerald-50 text-emerald-800';
                                    return <tr key={row._id} className={row.isPaid ? 'bg-emerald-50/20' : row.daysUntilDue < 0 ? 'bg-rose-50/30' : row.daysUntilDue === 0 ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                                        <td className="px-3 py-3 text-center font-mono text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                        <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{row.loanDate || '—'}</td>
                                        <td className="px-3 py-3"><div className="font-bold text-slate-900">{row.customerName}</div><div className="font-mono text-[10px] text-slate-500">{row.contractId}</div></td>
                                        <td className="px-3 py-3">{row.brand || '—'}</td>
                                        <td className="px-3 py-3"><div className="font-semibold text-slate-800">{row.model || '—'}</div><div className="font-mono text-[10px] text-slate-500">{row.serialNumber || '—'}</div></td>
                                        <td className="px-3 py-3 font-semibold text-slate-700">{row.labelName || row.monthLabel || `Month ${row.monthIndex || ''}`}</td>
                                        <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-slate-900">{row.dueDate}</td>
                                        <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-[4px] border px-2 py-1 font-bold ${statusClass}`}>{statusText}</span></td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-slate-700">${row.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-amber-700">${row.penalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-bold text-emerald-700">${row.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-bold text-rose-700">${row.unpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3 py-3 text-center">{images.length ? <button onClick={() => openImageGallery(row)} className="inline-flex items-center gap-1 rounded-[5px] border border-sky-300 bg-sky-50 px-2 py-1 font-bold text-sky-800"><FaImage /> View{images.length > 1 ? ` (${images.length})` : ''}</button> : <span className="text-slate-300">—</span>}</td>
                                        <td className="px-3 py-3"><span className={`inline-flex rounded-[4px] border px-2 py-1 font-bold ${typeClass}`}>{row.type}</span></td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => openScheduleForRow(row)} title="Open Pad, Payoff, or Redeem actions" className="inline-flex items-center gap-1 rounded-[5px] border border-emerald-300 bg-emerald-50 px-2 py-1 font-bold text-emerald-800">
                                                    <FaDollarSign /> Pay / Redeem
                                                </button>
                                                <button onClick={() => setSelectedQrContract(row.contract)} title="Open QR payment" className="inline-flex items-center gap-1 rounded-[5px] border border-sky-300 bg-sky-50 px-2 py-1 font-bold text-sky-800">
                                                    <MdQrCode2 /> QR
                                                </button>
                                            </div>
                                        </td>
                                    </tr>;
                                })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <span>{filteredRows.length.toLocaleString()} installments · {dateRange.from || 'Any date'} → {dateRange.to || 'Any date'}</span>
                <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
                    <span>Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="rounded border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
                </div>
            </div>
        </div>
    );
};

export default InstallmentHistory;