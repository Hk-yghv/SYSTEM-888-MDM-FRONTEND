import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKhmerHolidays, toKhmerLunarDate } from 'khmer-chhankitek-calendar';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { MdChevronLeft, MdChevronRight, MdDeleteOutline, MdEdit, MdEvent } from 'react-icons/md';
import { FaPlus } from 'react-icons/fa';

const PAID_STATUSES = new Set(['paid', 'payoff', 'settled']);

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
    const { API_BASE1, user, hasPermission } = useAuth();
    const { lang, t } = useLanguage();
    const navigate = useNavigate();
    const calendarLocale = {
        km: 'km-KH',
        en: 'en-US',
        ja: 'ja-JP',
        th: 'th-TH',
        vi: 'vi-VN',
        zh: 'zh-CN',
        ko: 'ko-KR',
        ru: 'ru-RU',
        la: 'lo-LA'
    }[lang] || 'km-KH';
    const weekdays = useMemo(() => {
        const firstSunday = new Date(2024, 0, 7);
        return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(calendarLocale, { weekday: 'short' })
            .format(new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + index)));
    }, [calendarLocale]);
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
            const requestHeaders = {};
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
                                if (!response.ok) throw new Error(t('calendarLoadPaymentsFailed', lang === 'km' ? 'មិនអាចទាញយកកាលវិភាគបង់ប្រាក់បានទេ' : 'Unable to load the payment schedule.'));
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
                        if (!response.ok) throw new Error(`${t('calendarLoadEventsFailed', lang === 'km' ? 'មិនអាចទាញយក event និង note បានទេ' : 'Unable to load events and notes.')} (HTTP ${response.status})`);
                        const result = await response.json();
                        return Array.isArray(result.data) ? result.data : [];
                    })()
                ]);
                if (!cancelled) {
                    setContracts(contractResult);
                    setEvents(eventResult);
                }
            } catch (error) {
                if (!cancelled) setLoadError(error.message || t('calendarLoadError', lang === 'km' ? 'មានបញ្ហាក្នុងការទាញទិន្នន័យ' : 'There was a problem loading data.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadCalendar();
        return () => { cancelled = true; };
    }, [API_BASE1, user, visibleStart, visibleEnd]);

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
        const holidayRows = [...years].flatMap((year) => getKhmerHolidays(year));
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || t('calendarSaveFailed', lang === 'km' ? 'មិនអាចរក្សាទុកបានទេ' : 'Unable to save.'));
            setEvents((current) => editingId
                ? current.map((item) => item._id === editingId ? result.data : item)
                : [...current, result.data]);
            setSelectedDate(form.date);
            if (form.date < visibleStart || form.date > visibleEnd) setVisibleMonth(dateFromKey(form.date));
            setFormOpen(false);
            setEditingId('');
        } catch (error) {
            setFormError(error.message || t('calendarSaveError', lang === 'km' ? 'មានបញ្ហាក្នុងការរក្សាទុក' : 'There was a problem saving.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId) => {
        if (!window.confirm(t('calendarConfirmDelete', lang === 'km' ? 'តើអ្នកចង់លុបកំណត់ត្រានេះមែនទេ?' : 'Are you sure you want to delete this entry?'))) return;
        try {
            const response = await fetch(`${API_BASE1}/calendar-events/${encodeURIComponent(eventId)}`, {
                method: 'DELETE',
                headers: {}
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || t('calendarDeleteFailed', lang === 'km' ? 'មិនអាចលុបបានទេ' : 'Unable to delete.'));
            setEvents((current) => current.filter((item) => item._id !== eventId));
        } catch (error) {
            setLoadError(error.message || t('calendarDeleteError', lang === 'km' ? 'មានបញ្ហាក្នុងការលុប' : 'There was a problem deleting the entry.'));
        }
    };

    const monthTitle = new Intl.DateTimeFormat(calendarLocale, { month: 'long', year: 'numeric' }).format(visibleMonth);
    const eventLabels = {
        event: t('calendarEvent'),
        holiday: t('calendarHolidayType'),
        note: t('note')
    };

    return (
        <main className="min-h-full bg-[var(--app-bg,#f4f6f8)] p-2 sm:p-2 space-y-4">
            <header className="flex flex-col gap-4 border-b border-[var(--app-border,#dbe3e8)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="mt-1 text-2xl font-bold text-[var(--app-text,#102a2a)]">{monthTitle}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => moveMonth(-1)} aria-label={t('calendarPreviousMonth')} className="h-9 w-9 flex items-center justify-center border border-[var(--app-border,#cbd5e1)] bg-white text-slate-700 hover:bg-emerald-50">
                        <MdChevronLeft size={21} />
                    </button>
                    <button type="button" onClick={() => moveMonth(1)} aria-label={t('calendarNextMonth')} className="h-9 w-9 flex items-center justify-center border border-[var(--app-border,#cbd5e1)] bg-white text-slate-700 hover:bg-emerald-50">
                        <MdChevronRight size={21} />
                    </button>
                    <button type="button" onClick={() => { const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toDateKey(now)); }} className="h-9 border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800">
                        {t('today')}
                    </button>
                </div>
            </header>

            {loadError && <div role="alert" className="flex items-center justify-between border-l-4 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <span>{loadError}</span><button type="button" onClick={() => setLoadError('')} aria-label={t('close')} className="px-2 font-bold">×</button>
            </div>}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section aria-label={t('calendarMonthly')} className="min-w-0 border border-[var(--app-border,#dbe3e8)] bg-[var(--app-card,#fff)]">
                    <div className="grid grid-cols-7 border-b border-[var(--app-border,#dbe3e8)] bg-white text-center text-[10px] font-bold text-black sm:text-xs">
                        {weekdays.map((day) => <div key={day} className="py-2.5">{day}</div>)}
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
                                    aria-label={`${dateKey}${dueCount ? `, ${dueCount} ${t('calendarDue')}` : ''}`}
                                    aria-pressed={isSelected}
                                    className={`relative min-h-[82px] border-b border-r border-[var(--app-border,#e2e8f0)] p-2 text-left transition-colors sm:min-h-[104px] sm:p-2 ${isSelected ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-600' : 'hover:bg-slate-50'} ${!inMonth ? 'bg-slate-50/70' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <span className={`flex h-6 min-w-6 items-center justify-center text-xs font-bold ${isToday ? 'bg-emerald-700 text-white' : dayHolidays.length ? 'text-rose-700' : inMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {date.getDate()}
                                        </span>
                                        {lunar && <span className="max-w-[52px] truncate text-[9px] text-slate-500 sm:max-w-[78px]">{lunar.moonDayKhmer}{lunar.moonStatus}</span>}
                                    </div>
                                    {lunar && <p className="mt-0.5 truncate text-[9px] leading-4 text-slate-500">{lunar.khmerMonth}</p>}
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {dueCount > 0 && <span className="inline-flex items-center gap-1 bg-sky-100 px-1 py-0.5 text-[9px] font-bold text-sky-800"><span className="h-1.5 w-1.5 bg-sky-600" />{dueCount} {t('calendarDue')}</span>}
                                        {(dayHolidays.length > 0 || lunar?.isSilDay) && <span className="h-1.5 w-1.5 bg-rose-500" title={dayHolidays[0]?.nameKm || t('calendarObservance')} />}
                                        {dayEvents.length > 0 && <span className="h-1.5 w-1.5 bg-amber-500" title={`${dayEvents.length} ${t('calendarEvent')}`} />}
                                    </div>
                                    {dayHolidays[0] && <p className="mt-1 hidden truncate text-[9px] font-semibold text-rose-700 sm:block">{dayHolidays[0].nameKm}{dayHolidays.length > 1 ? ` +${dayHolidays.length - 1}` : ''}</p>}
                                    {dueCount > 0 && <p className="hidden truncate text-[9px] font-semibold text-sky-700 sm:block">{t('calendarCustomerDue')}</p>}
                                </button>
                            );
                        })}
                    </div>
                    <footer className="flex flex-wrap gap-x-4 gap-y-2 px-3 py-2.5 text-[10px] text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-sky-600" />{t('calendarDue')}</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-rose-500" />{t('calendarHoliday')}</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-amber-500" />{t('calendarEventsAndNotes')}</span>
                        {loading && <span className="ml-auto text-emerald-700">{t('loading')}</span>}
                    </footer>
                </section>

                <aside className="min-w-0 border-t-2 border-emerald-800 bg-[var(--app-card,#fff)] p-2 xl:border-t-0 xl:border-l-2">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                            <p className="text-xs font-bold uppercase text-emerald-700">{t('calendarSelectedDate')}</p>
                            <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedDateInfo?.gregorianDateText || selectedDate}</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{selectedDateInfo?.lunarDateText || t('calendarNoLunarData')}</p>
                        </div>
                        {canCreate && <button type="button" onClick={startNewEvent} title={t('calendarAddEvent')} className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-700 text-white hover:bg-emerald-800">
                            <FaPlus size={13} />
                        </button>}
                    </div>

                    {selectedDateInfo?.isSilDay && <div className="mt-3 border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{selectedDateInfo.observanceText || t('calendarObservance')}</div>}

                    <div className="mt-4 space-y-4">
                        <section>
                            <h3 className="flex items-center justify-between text-xs font-bold text-sky-800"><span>{t('calendarDueCustomers')}</span><span>{selectedDueItems.length}</span></h3>
                            {selectedDueItems.length === 0 ? <p className="mt-2 text-xs text-slate-500">{t('calendarNoDueToday')}</p> : (
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
                            <h3 className="text-xs font-bold text-rose-800">{t('calendarNationalHolidays')}</h3>
                            {selectedHolidays.length === 0 ? <p className="mt-2 text-xs text-slate-500">{t('calendarNoNationalHoliday')}</p> : (
                                <ul className="mt-2 space-y-1.5">
                                    {selectedHolidays.map((holiday, index) => <li key={`${holiday.date}-${holiday.nameEn}-${index}`} className="border-l-2 border-rose-400 pl-2.5 text-xs font-semibold text-rose-800">{holiday.nameKm}<span className="mt-0.5 block text-[10px] font-normal text-slate-500">{holiday.nameEn}</span></li>)}
                                </ul>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xs font-bold text-amber-800">{t('calendarEventsAndNotes')}</h3>
                            {selectedEvents.length === 0 ? <p className="mt-2 text-xs text-slate-500">{t('calendarNoEventsOrNotes')}</p> : (
                                <ul className="mt-2 divide-y divide-slate-200">
                                    {selectedEvents.map((event) => <li key={event._id} className="py-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[9px] font-bold uppercase text-amber-700">{eventLabels[event.type] || eventLabels.event} · {t(event.visibility === 'private' ? 'private' : 'public')}{event.brand ? ` · ${event.brand}` : ''}</span>
                                                <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{event.title}</p>
                                                {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{event.note}</p>}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                {canEdit && <button type="button" onClick={() => startEditEvent(event)} title={t('edit')} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-amber-50 hover:text-amber-800"><MdEdit size={15} /></button>}
                                                {canDelete && <button type="button" onClick={() => handleDeleteEvent(event._id)} title={t('delete')} className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-700"><MdDeleteOutline size={17} /></button>}
                                            </div>
                                        </div>
                                    </li>)}
                                </ul>
                            )}
                        </section>
                    </div>

                    {formOpen && <form onSubmit={handleSaveEvent} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">{editingId ? t('calendarEditInfo') : t('calendarAddInfo')}</h3>
                            <button type="button" onClick={() => { setFormOpen(false); setEditingId(''); }} className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">{t('close')}</button>
                        </div>
                        <label className="block text-xs font-semibold text-slate-700">{t('date')}
                            <input required type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">{t('type')}
                            <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600">
                                <option value="note">{t('note')}</option><option value="event">{t('calendarEvent')}</option><option value="holiday">{t('calendarHolidayType')}</option>
                            </select>
                        </label>
                        <fieldset className="space-y-1.5">
                            <legend className="text-xs font-semibold text-slate-700">{t('calendarNoteVisibility')}</legend>
                            <div className="grid grid-cols-2 border border-slate-300 bg-slate-100 p-0.5" role="group" aria-label={t('calendarNoteVisibility')}>
                                {[
                                    { value: 'public', label: t('public') },
                                    { value: 'private', label: t('private') }
                                ].map((option) => (
                                    <label key={option.value} className={`cursor-pointer px-3 py-2 text-center text-xs font-bold ${form.visibility === option.value ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                                        <input type="radio" name="calendar-visibility" value={option.value} checked={form.visibility === option.value} onChange={() => setForm((current) => ({ ...current, visibility: option.value }))} className="sr-only" />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        <label className="block text-xs font-semibold text-slate-700">{t('calendarTitle')}
                            <input required maxLength={120} value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder={t('calendarTitlePlaceholder')} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">{t('calendarAdditionalInfo')}
                            <textarea maxLength={2000} rows={3} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder={t('calendarNotePlaceholder')} className="mt-1 w-full resize-y border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>
                        {isMaster && <label className="block text-xs font-semibold text-slate-700">{t('brand')} ({t('calendarGeneralInfo')})
                            <input maxLength={80} value={form.brand} onChange={(e) => setForm((current) => ({ ...current, brand: e.target.value }))} placeholder={t('allBrands')} className="mt-1 w-full border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600" />
                        </label>}
                        {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
                        <button type="submit" disabled={saving || (editingId ? !canEdit : !canCreate)} className="w-full bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? t('saving') : t('save')}
                        </button>
                    </form>}
                </aside>
            </div>
        </main>
    );
};

export default KhmerCalendarPage;