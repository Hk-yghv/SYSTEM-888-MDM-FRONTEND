import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKhmerHolidays, toKhmerLunarDate } from 'khmer-chhankitek-calendar';
import { useAuth } from '../../context/AuthContext';
import { MdChevronLeft, MdChevronRight, MdDeleteOutline, MdEdit, MdEvent, MdRefresh } from 'react-icons/md';
import { FaPlus } from 'react-icons/fa';
import KHMER_CALENDAR_EVENTS_2026 from './khmerCalendarEvents2026';

const WEEKDAYS = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const MONTH_NAMES = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const ANNUAL_OBSERVANCES = [
    { month: '09', day: '08', nameKm: 'ទិវាអក្ខរកម្មអន្តរជាតិ', nameEn: 'International Literacy Day' },
    { month: '09', day: '16', nameKm: 'ទិវាអូហ្សូនបរិស្ថានអន្តរជាតិ', nameEn: 'International Day for the Preservation of the Ozone Layer' },
    { month: '09', day: '17', nameKm: 'តំបន់ប្រាសាទកោះកេរចុះក្នុងបញ្ជីបេតិកភណ្ឌពិភពលោក UNESCO', nameEn: 'Koh Ker inscribed on the UNESCO World Heritage List' },
    { month: '09', day: '21', nameKm: 'ទិវាសន្តិភាពអន្តរជាតិ', nameEn: 'International Day of Peace' }
];
const PAID_STATUSES = new Set(['paid', 'payoff', 'settled']);
const EVENT_LABELS = { event: 'កម្មវិធី', holiday: 'ថ្ងៃបុណ្យ', note: 'កំណត់ចំណាំ' };

const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const dateFromKey = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const getScheduleDueDate = (contract, row, rowIndex) => {
    if (row?.dueDate) return String(row.dueDate).slice(0, 10);
    if (!contract?.inputDate) return '';
    const dueDate = new Date(`${String(contract.inputDate).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return '';
    const duration = String(contract.duration || '').toLowerCase();
    const count = Number(String(duration.match(/\d+/)?.[0] || row?.monthIndex || rowIndex + 1));
    if (duration.includes('day') || duration.includes('ថ្ងៃ') || duration.includes('d')) {
        dueDate.setDate(dueDate.getDate() + count);
    } else {
        dueDate.setMonth(dueDate.getMonth() + Number(row?.monthIndex || rowIndex + 1));
    }
    return toDateKey(dueDate);
};

const getIdentityParams = (user) => ({
    userBrand: user?.brand || '',
    userRole: user?.role || '',
    username: user?.username || '',
    isImmutable: user?.isImmutable ? 'true' : 'false'
});

const KhmerCalendarPage = () => {
    const { API_BASE1, user, token, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
    const [contracts, setContracts] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [formError, setFormError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState({ date: toDateKey(new Date()), title: '', note: '', type: 'note', visibility: 'public', brand: user?.brand || '' });

    const isMaster = user?.isImmutable || user?.username === '@hakyonghouv' || user?.username === 'hakyonghouv' || user?.role === 'Administrator';
    const canCreate = hasPermission('/calendar', 'create');
    const canEdit = hasPermission('/calendar', 'edit');
    const canDelete = hasPermission('/calendar', 'delete');
    const canOpenInstallmentPad = hasPermission('/installment/pad', 'read');

    const calendarDates = useMemo(() => {
        const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
        const gridStart = new Date(firstDay);
        gridStart.setDate(firstDay.getDate() - firstDay.getDay());
        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + index);
            return date;
        });
    }, [visibleMonth]);

    const visibleStart = toDateKey(calendarDates[0]);
    const visibleEnd = toDateKey(calendarDates[calendarDates.length - 1]);

    useEffect(() => {
        let cancelled = false;
        const loadCalendar = async () => {
            setLoading(true);
            setLoadError('');
            const identity = getIdentityParams(user);
            const requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};
            const eventParams = new URLSearchParams({ startDate: visibleStart, endDate: visibleEnd });
            try {
                const [contractResult, eventResult] = await Promise.all([
                    (async () => {
                        const allContracts = [];
                        for (const status of ['Activated', 'Redeem']) {
                            let page = 1;
                            let totalPages = 1;
                            do {
                                const params = new URLSearchParams({
                                    ...identity,
                                    status,
                                    page: String(page),
                                    limit: '1000',
                                    requireSchedule: 'true'
                                });
                                const response = await fetch(`${API_BASE1}/contracts?${params}`, { headers: requestHeaders });
                                if (!response.ok) throw new Error('មិនអាចទាញយកកាលវិភាគបង់ប្រាក់បានទេ');
                                const result = await response.json();
                                allContracts.push(...(Array.isArray(result.data) ? result.data : []));
                                totalPages = Number(result.totalPages || 1);
                                page += 1;
                            } while (page <= totalPages);
                        }
                        return allContracts;
                    })(),
                    (async () => {
                        const response = await fetch(`${API_BASE1}/calendar-events?${eventParams}`, { headers: requestHeaders });
                        if (!response.ok) throw new Error(`មិនអាចទាញយក event និង note បានទេ (HTTP ${response.status})`);
                        const result = await response.json();
                        return Array.isArray(result.data) ? result.data : [];
                    })()
                ]);
                if (!cancelled) {
                    setContracts(contractResult);
                    setEvents(eventResult);
                }
            } catch (error) {
                if (!cancelled) setLoadError(error.message || 'មានបញ្ហាក្នុងការទាញទិន្នន័យ');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadCalendar();
        return () => { cancelled = true; };
    }, [API_BASE1, user, token, visibleStart, visibleEnd, refreshKey]);

    const dueByDate = useMemo(() => {
        const grouped = new Map();
        contracts.forEach((contract) => {
            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];
            schedule.forEach((row, index) => {
                if (PAID_STATUSES.has(String(row?.status || '').toLowerCase()) || row?.status === 'Settled') return;
                const date = getScheduleDueDate(contract, row, index);
                if (!date || date < visibleStart || date > visibleEnd) return;
                const scheduledAmount = Number(row?.scheduledAmount || row?.amount || contract.monthlyPayment || 0);
                const paidAmount = Number(row?.paidAmount || 0);
                const unpaidAmount = Math.max(0, scheduledAmount - paidAmount);
                if (scheduledAmount > 0 && unpaidAmount === 0) return;
                const items = grouped.get(date) || [];
                items.push({
                    id: `${contract._id || contract.contractId || contract.customerNameEn}-${index}`,
                    contractId: contract.contractId || contract.contractIid || '',
                    customerNameEn: contract.customerNameEn || contract.customerNameKh || 'មិនមានឈ្មោះ',
                    customerNameKh: contract.customerNameKh || '',
                    phone: contract.phoneNumber || contract.phone || '',
                    model: contract.model || '',
                    brand: contract.brand || '',
                    amount: unpaidAmount,
                    status: row?.status || 'Pending',
                    month: row.labelName || `ខែទី ${row.monthIndex || index + 1}`
                });
                grouped.set(date, items);
            });
        });
        return grouped;
    }, [contracts, visibleStart, visibleEnd]);

    const holidaysByDate = useMemo(() => {
        const years = new Set(calendarDates.map((date) => date.getFullYear()));
        const holidayRows = [...years].flatMap((year) => {
            if (year === 2026) {
                return KHMER_CALENDAR_EVENTS_2026.map(([date, title]) => {
                    const separatorIndex = title.indexOf(' (');
                    return {
                        date,
                        nameKm: separatorIndex < 0 ? title : title.slice(0, separatorIndex),
                        nameEn: separatorIndex < 0 ? '' : title.slice(separatorIndex + 2, -1)
                    };
                });
            }
            return [
                ...getKhmerHolidays(year),
                ...ANNUAL_OBSERVANCES.map((observance) => ({
                    ...observance,
                    date: `${year}-${observance.month}-${observance.day}`
                }))
            ];
        });
        return holidayRows.reduce((grouped, holiday) => {
            const holidays = grouped.get(holiday.date) || [];
            holidays.push(holiday);
            grouped.set(holiday.date, holidays);
            return grouped;
        }, new Map());
    }, [calendarDates]);

    const eventsByDate = useMemo(() => events.reduce((grouped, event) => {
        const items = grouped.get(event.date) || [];
        items.push(event);
        grouped.set(event.date, items);
        return grouped;
    }, new Map()), [events]);

    const selectedDateInfo = useMemo(() => {
        try {
            return toKhmerLunarDate(selectedDate);
        } catch {
            return null;
        }
    }, [selectedDate]);

    const selectedDueItems = dueByDate.get(selectedDate) || [];
    const selectedHolidays = holidaysByDate.get(selectedDate) || [];
    const selectedEvents = eventsByDate.get(selectedDate) || [];
    const todayKey = toDateKey(new Date());

    const moveMonth = (amount) => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    };

    const handleSelectDate = (date) => {
        setSelectedDate(toDateKey(date));
        if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
            setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
        if (!formOpen) setForm((current) => ({ ...current, date: toDateKey(date) }));
    };

    const startNewEvent = () => {
        setEditingId('');
        setFormError('');
        setForm({ date: selectedDate, title: '', note: '', type: 'note', visibility: 'public', brand: user?.brand || '' });
        setFormOpen(true);
    };

    const startEditEvent = (event) => {
        setEditingId(event._id);
        setFormError('');
        setForm({ date: event.date, title: event.title, note: event.note || '', type: event.type, visibility: event.visibility || 'public', brand: event.brand || '' });
        setFormOpen(true);
    };

    const handleSaveEvent = async (event) => {
        event.preventDefault();
        setSaving(true);
        setFormError('');
        const body = {
            ...form,
            brand: isMaster ? form.brand : user?.brand || ''
        };
        try {
            const response = await fetch(`${API_BASE1}/calendar-events${editingId ? `/${encodeURIComponent(editingId)}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'មិនអាចរក្សាទុកបានទេ');
            setEvents((current) => editingId
                ? current.map((item) => item._id === editingId ? result.data : item)
                : [...current, result.data]);
            setSelectedDate(form.date);
            if (form.date < visibleStart || form.date > visibleEnd) setVisibleMonth(dateFromKey(form.date));
            setFormOpen(false);
            setEditingId('');
        } catch (error) {
            setFormError(error.message || 'មានបញ្ហាក្នុងការរក្សាទុក');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId) => {
        if (!window.confirm('តើអ្នកចង់លុបកំណត់ត្រានេះមែនទេ?')) return;
        try {
            const response = await fetch(`${API_BASE1}/calendar-events/${encodeURIComponent(eventId)}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'មិនអាចលុបបានទេ');
            setEvents((current) => current.filter((item) => item._id !== eventId));
        } catch (error) {
            setLoadError(error.message || 'មានបញ្ហាក្នុងការលុប');
        }
    };

    const monthTitle = `${MONTH_NAMES[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;

    return (
        <main className="min-h-full bg-[var(--app-bg,#f4f6f8)] p-3 sm:p-5 space-y-4">
            <header className="flex flex-col gap-4 border-b border-[var(--app-border,#dbe3e8)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700">
                        <MdEvent size={16} />
                        <span>ប្រតិទិនខ្មែរ</span>
                    </div>
                    <h1 className="mt-1 text-2xl font-bold text-[var(--app-text,#102a2a)]">{monthTitle}</h1>
                    {selectedDateInfo && <p className="mt-1 text-sm text-[var(--app-text-muted,#64748b)]">{selectedDateInfo.lunarDateText}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => moveMonth(-1)} aria-label="ខែមុន" className="h-9 w-9 flex items-center justify-center border border-[var(--app-border,#cbd5e1)] bg-white text-slate-700 hover:bg-emerald-50">
                        <MdChevronLeft size={21} />
                    </button>
                    <button type="button" onClick={() => moveMonth(1)} aria-label="ខែបន្ទាប់" className="h-9 w-9 flex items-center justify-center border border-[var(--app-border,#cbd5e1)] bg-white text-slate-700 hover:bg-emerald-50">
                        <MdChevronRight size={21} />
                    </button>
                    <button type="button" onClick={() => { const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toDateKey(now)); }} className="h-9 border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800">
                        ថ្ងៃនេះ
                    </button>
                    <button type="button" onClick={() => setRefreshKey((key) => key + 1)} title="ផ្ទុកទិន្នន័យឡើងវិញ" className="h-9 w-9 flex items-center justify-center border border-[var(--app-border,#cbd5e1)] bg-white text-slate-700 hover:bg-emerald-50">
                        <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {loadError && <div role="alert" className="flex items-center justify-between border-l-4 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <span>{loadError}</span><button type="button" onClick={() => setLoadError('')} aria-label="បិទ" className="px-2 font-bold">×</button>
            </div>}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section aria-label="ប្រតិទិនប្រចាំខែ" className="min-w-0 border border-[var(--app-border,#dbe3e8)] bg-[var(--app-card,#fff)]">
                    <div className="grid grid-cols-7 border-b border-[var(--app-border,#dbe3e8)] bg-white text-center text-[10px] font-bold text-black sm:text-xs">
                        {WEEKDAYS.map((day) => <div key={day} className="py-2.5">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7">
                        {calendarDates.map((date) => {
                            const dateKey = toDateKey(date);
                            let lunar = null;
                            try { lunar = toKhmerLunarDate(dateKey); } catch { /* date is outside supported range */ }
                            const dayHolidays = holidaysByDate.get(dateKey) || [];
                            const dayEvents = eventsByDate.get(dateKey) || [];
                            const dueCount = dueByDate.get(dateKey)?.length || 0;
                            const inMonth = date.getMonth() === visibleMonth.getMonth();
                            const isSelected = selectedDate === dateKey;
                            const isToday = todayKey === dateKey;
                            return (
                                <button
                                    key={dateKey}
                                    type="button"
                                    onClick={() => handleSelectDate(date)}
                                    aria-label={`${dateKey}${dueCount ? `, ${dueCount} due` : ''}`}
                                    aria-pressed={isSelected}
                                    className={`relative min-h-[82px] border-b border-r border-[var(--app-border,#e2e8f0)] p-1.5 text-left transition-colors sm:min-h-[104px] sm:p-2 ${isSelected ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-600' : 'hover:bg-slate-50'} ${!inMonth ? 'bg-slate-50/70' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <span className={`flex h-6 min-w-6 items-center justify-center text-xs font-bold ${isToday ? 'bg-emerald-700 text-white' : dayHolidays.length ? 'text-rose-700' : inMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {date.getDate()}
                                        </span>
                                        {lunar && <span className="max-w-[52px] truncate text-[9px] text-slate-500 sm:max-w-[78px]">{lunar.moonDayKhmer}{lunar.moonStatus}</span>}
                                    </div>
                                    {lunar && <p className="mt-0.5 truncate text-[9px] leading-4 text-slate-500">{lunar.khmerMonth}</p>}
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {dueCount > 0 && <span className="inline-flex items-center gap-1 bg-sky-100 px-1 py-0.5 text-[9px] font-bold text-sky-800"><span className="h-1.5 w-1.5 bg-sky-600" />{dueCount} បង់</span>}
                                        {(dayHolidays.length > 0 || lunar?.isSilDay) && <span className="h-1.5 w-1.5 bg-rose-500" title={dayHolidays[0]?.nameKm || 'ថ្ងៃសីល'} />}
                                        {dayEvents.length > 0 && <span className="h-1.5 w-1.5 bg-amber-500" title={`${dayEvents.length} event`} />}
                                    </div>
                                    {dayHolidays[0] && <p className="mt-1 hidden truncate text-[9px] font-semibold text-rose-700 sm:block">{dayHolidays[0].nameKm}{dayHolidays.length > 1 ? ` +${dayHolidays.length - 1}` : ''}</p>}
                                    {dueCount > 0 && <p className="hidden truncate text-[9px] font-semibold text-sky-700 sm:block">អតិថិជនត្រូវបង់</p>}
                                </button>
                            );
                        })}
                    </div>
                    <footer className="flex flex-wrap gap-x-4 gap-y-2 px-3 py-2.5 text-[10px] text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-sky-600" />ថ្ងៃត្រូវបង់</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-rose-500" />បុណ្យ / ថ្ងៃសីល</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-amber-500" />កម្មវិធី / Note</span>
                        {loading && <span className="ml-auto text-emerald-700">កំពុងទាញទិន្នន័យ…</span>}
                    </footer>
                </section>

                <aside className="min-w-0 border-t-2 border-emerald-800 bg-[var(--app-card,#fff)] p-4 xl:border-t-0 xl:border-l-2">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                            <p className="text-xs font-bold uppercase text-emerald-700">ថ្ងៃដែលបានជ្រើស</p>
                            <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedDateInfo?.gregorianDateText || selectedDate}</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{selectedDateInfo?.lunarDateText || 'មិនមានទិន្នន័យចន្ទគតិ'}</p>
                        </div>
                        {canCreate && <button type="button" onClick={startNewEvent} title="បន្ថែមកម្មវិធី ឬកំណត់ចំណាំ" className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-700 text-white hover:bg-emerald-800">
                            <FaPlus size={13} />
                        </button>}
                    </div>

                    {selectedDateInfo?.isSilDay && <div className="mt-3 border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{selectedDateInfo.observanceText || 'ថ្ងៃសីល'}</div>}

                    <div className="mt-4 space-y-4">
                        <section>
                            <h3 className="flex items-center justify-between text-xs font-bold text-sky-800"><span>ភ្ញៀវត្រូវបង់</span><span>{selectedDueItems.length}</span></h3>
                            {selectedDueItems.length === 0 ? <p className="mt-2 text-xs text-slate-500">គ្មានភ្ញៀវត្រូវបង់នៅថ្ងៃនេះ</p> : (
                                <ul className="mt-2 divide-y divide-slate-200">
                                    {selectedDueItems.map((item) => <li key={item.id} className="py-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                {canOpenInstallmentPad ? (
                                                    <button type="button" onClick={() => {
                                                        const params = new URLSearchParams({ search: item.customerNameEn || item.customerNameKh });
                                                        navigate(`/installment/pad?${params.toString()}`);
                                                    }} className="block max-w-full text-left text-xs font-bold text-slate-900 hover:text-emerald-700 hover:underline">
                                                        <span className="block truncate">{item.customerNameEn}</span>
                                                        {item.customerNameKh && item.customerNameKh !== item.customerNameEn && <span className="mt-0.5 block truncate text-emerald-800">{item.customerNameKh}</span>}
                                                    </button>
                                                ) : <>
                                                    <p className="truncate text-xs font-bold text-slate-900">{item.customerNameEn}</p>
                                                    {item.customerNameKh && item.customerNameKh !== item.customerNameEn && <p className="mt-0.5 truncate text-xs text-emerald-800">{item.customerNameKh}</p>}
                                                </>}
                                                <p className="mt-1 text-[10px] text-slate-500">{[item.contractId, item.brand, item.model, item.month].filter(Boolean).join(' · ')}</p>
                                            </div>
                                            <span className="shrink-0 text-xs font-bold text-sky-800">${item.amount.toLocaleString()}</span>
                                        </div>
                                    </li>)}
                                </ul>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xs font-bold text-rose-800">ថ្ងៃបុណ្យជាតិ និងថ្ងៃសំខាន់</h3>
                            {selectedHolidays.length === 0 ? <p className="mt-2 text-xs text-slate-500">មិនមានថ្ងៃបុណ្យជាតិក្នុងថ្ងៃនេះទេ</p> : (
                                <ul className="mt-2 space-y-1.5">
                                    {selectedHolidays.map((holiday, index) => <li key={`${holiday.date}-${holiday.nameEn}-${index}`} className="border-l-2 border-rose-400 pl-2.5 text-xs font-semibold text-rose-800">{holiday.nameKm}<span className="mt-0.5 block text-[10px] font-normal text-slate-500">{holiday.nameEn}</span></li>)}
                                </ul>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xs font-bold text-amber-800">កម្មវិធី និងកំណត់ចំណាំ</h3>
                            {selectedEvents.length === 0 ? <p className="mt-2 text-xs text-slate-500">មិនទាន់មានកម្មវិធី ឬ Note</p> : (
                                <ul className="mt-2 divide-y divide-slate-200">
                                    {selectedEvents.map((event) => <li key={event._id} className="py-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[9px] font-bold uppercase text-amber-700">{EVENT_LABELS[event.type] || EVENT_LABELS.event} · {event.visibility === 'private' ? 'Private' : 'Public'}{event.brand ? ` · ${event.brand}` : ''}</span>
                                                <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{event.title}</p>
                                                {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{event.note}</p>}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                {canEdit && <button type="button" onClick={() => startEditEvent(event)} title="កែប្រែ" className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-amber-50 hover:text-amber-800"><MdEdit size={15} /></button>}
                                                {canDelete && <button type="button" onClick={() => handleDeleteEvent(event._id)} title="លុប" className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-700"><MdDeleteOutline size={17} /></button>}
                                            </div>
                                        </div>
                                    </li>)}
                                </ul>
                            )}
                        </section>
                    </div>

                    {formOpen && <form onSubmit={handleSaveEvent} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">{editingId ? 'កែប្រែព័ត៌មាន' : 'បន្ថែមព័ត៌មាន'}</h3>
                            <button type="button" onClick={() => { setFormOpen(false); setEditingId(''); }} className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">បិទ</button>
                        </div>
                        <label className="block text-xs font-semibold text-slate-700">កាលបរិច្ឆេទ
                            <input required type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">ប្រភេទ
                            <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600">
                                <option value="note">កំណត់ចំណាំ</option><option value="event">កម្មវិធី</option><option value="holiday">ថ្ងៃបុណ្យ</option>
                            </select>
                        </label>
                        <fieldset className="space-y-1.5">
                            <legend className="text-xs font-semibold text-slate-700">បង្ហាញចំណាំជា</legend>
                            <div className="grid grid-cols-2 border border-slate-300 bg-slate-100 p-0.5" role="group" aria-label="Note visibility">
                                {[
                                    { value: 'public', label: 'Public' },
                                    { value: 'private', label: 'Private' }
                                ].map((option) => (
                                    <label key={option.value} className={`cursor-pointer px-3 py-2 text-center text-xs font-bold ${form.visibility === option.value ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                                        <input type="radio" name="calendar-visibility" value={option.value} checked={form.visibility === option.value} onChange={() => setForm((current) => ({ ...current, visibility: option.value }))} className="sr-only" />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        <label className="block text-xs font-semibold text-slate-700">ចំណងជើង
                            <input required maxLength={120} value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="បញ្ចូលចំណងជើង" className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">ព័ត៌មានបន្ថែម
                            <textarea maxLength={2000} rows={3} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="សរសេរ Note..." className="mt-1 w-full resize-y border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        {isMaster && <label className="block text-xs font-semibold text-slate-700">Brand (ទទេទុកជាព័ត៌មានទូទៅ)
                            <input maxLength={80} value={form.brand} onChange={(e) => setForm((current) => ({ ...current, brand: e.target.value }))} placeholder="គ្រប់ Brand" className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>}
                        {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
                        <button type="submit" disabled={saving || (editingId ? !canEdit : !canCreate)} className="w-full bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? 'កំពុងរក្សាទុក…' : 'រក្សាទុក'}
                        </button>
                    </form>}
                </aside>
            </div>
        </main>
    );
};

export default KhmerCalendarPage;