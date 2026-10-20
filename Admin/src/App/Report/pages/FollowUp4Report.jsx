import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { FaCalendarAlt, FaCopy, FaFileAlt, FaSyncAlt } from 'react-icons/fa';
import ExportDropdown from '../../../components/ExportDropdown';
import CopyCell from '../../../components/CopyCell';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const dateToInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateKey = (record) => String(record.date || '').split('T')[0];
const getCount = (value) => {
    const count = Number(value);
    return Number.isFinite(count) ? count : 0;
};
const getFormattedDate = (date) => {
    const [year, month, day] = date.split('-');
    return year && month && day ? `${day}/${month}/${year}` : date;
};
const getReportLabel = (t, key, fallback) => String(t(key, fallback)).replace(/^follow up\s+/i, '');

const detailFields = [
    ['message', 'MESSAGE'],
    ['page', 'PAGE'],
    ['telegram', 'TG'],
    ['noReply', 'NOREPLY'],
    ['inquire', 'INQUIRE'],
    ['rejectCs', 'REJECT CS'],
    ['more', 'MORE'],
    ['pageSubmit', 'PAGE SUBMIT'],
    ['telegramSubmit', 'TG SUBMIT'],
    ['call', 'CALL'],
    ['review', 'REVIEW'],
    ['reject', 'REJECT 1'],
    ['reject2', 'REJECT 2'],
    ['success1', 'SUCCESS 1'],
    ['success2', 'SUCCESS 2']
];

const detailTableFields = [
    ...detailFields.slice(0, 10),
    ['totalSubmit', 'TOTAL SUBMIT'],
    ...detailFields.slice(10, 13),
    ['totalReject', 'TOTAL'],
    ...detailFields.slice(13),
    ['totalSuccess', 'TOTAL SUCCESS']
];

const getDetailValue = (row, field) => {
    if (field === 'totalSubmit') return getCount(row.pageSubmit) + getCount(row.telegramSubmit) + getCount(row.call);
    if (field === 'totalReject') return getCount(row.reject) + getCount(row.reject2);
    if (field === 'totalSuccess') return getCount(row.success1) + getCount(row.success2);
    return getCount(row[field]);
};

const getDailyReportText = (date, detail, rejectSubmitRows, t, lang) => {
    const totalSubmit = getCount(detail.pageSubmit) + getCount(detail.telegramSubmit) + getCount(detail.call);
    const totalReject = getCount(detail.reject) + getCount(detail.reject2);
    const totalSuccess = getCount(detail.success1) + getCount(detail.success2);
    const reasons = rejectSubmitRows
        .filter((row) => getDateKey(row) === date && getCount(row.count) > 0)
        .reduce((names, row) => {
            if (!names.includes(row.reason)) names.push(row.reason);
            return names;
        }, []);

    return [
        getFormattedDate(date),
        `${getReportLabel(t, 'followUpTotalMessages', lang === 'km' ? 'សារសរុប' : 'Total messages')} ${getCount(detail.message)}`,
        `${getReportLabel(t, 'followUpNoReply', lang === 'km' ? 'មិនឆ្លើយតប' : 'No reply')} ${getCount(detail.noReply)}`,
        `${getReportLabel(t, 'followUpReplied', lang === 'km' ? 'ឆ្លើយតប' : 'Replied')} ${Math.max(0, getCount(detail.message) - getCount(detail.noReply))}`,
        `${getReportLabel(t, 'followUpInquiries', lang === 'km' ? 'សាកសួរ' : 'Inquiries')} ${getCount(detail.inquire)}`,
        `${getReportLabel(t, 'followUpSubmitted', lang === 'km' ? 'ដាក់ស្នើ' : 'Submitted')} ${totalSubmit}`,
        `${getReportLabel(t, 'followUpReview', lang === 'km' ? 'ពិនិត្យ' : 'Review')} ${getCount(detail.review)}`,
        `${getReportLabel(t, 'followUpRejected', lang === 'km' ? 'បរាជ័យ' : 'Rejected')} ${totalReject}`,
        `${getReportLabel(t, 'followUpSuccessful', lang === 'km' ? 'ជោគជ័យ' : 'Successful')} ${totalSuccess}`,
        ...reasons.map((reason) => `- ${reason}`)
    ].join('\n');
};

const FollowUp4Report = () => {
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const { t, lang } = useLanguage();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';
    const today = useMemo(() => dateToInputValue(new Date()), []);
    const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);
    const [startDate, setStartDate] = useState(monthStart);
    const [endDate, setEndDate] = useState(today);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brands, setBrands] = useState([]);
    const [detailRows, setDetailRows] = useState([]);
    const [rejectCsRows, setRejectCsRows] = useState([]);
    const [rejectSubmitRows, setRejectSubmitRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeReport, setActiveReport] = useState(null);
    const [activeReportView, setActiveReportView] = useState('text');
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState('');

    const isMasterAdmin = user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        ['administrator', 'admin'].includes(String(user?.role || '').toLowerCase());

    useEffect(() => {
        if (!isMasterAdmin) return;
        let cancelled = false;
        const fetchBrands = async () => {
            try {
                const response = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (!response.ok) throw new Error(`Failed to load brands (${response.status})`);
                const result = await response.json();
                const brandCategory = result.droplists?.find((item) => item.category?.toLowerCase() === 'brands');
                if (!cancelled && Array.isArray(brandCategory?.items)) {
                    setBrands(brandCategory.items.map((brand) =>
                        typeof brand === 'string' ? brand : brand.name || String(brand)
                    ));
                }
            } catch (fetchError) {
                console.error('Fetch Follow Up 4 report brands error:', fetchError);
            }
        };
        fetchBrands();
        return () => { cancelled = true; };
    }, [API_BASE, isMasterAdmin]);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (selectedBrand) params.set('brand', selectedBrand);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            const query = params.toString();

            const endpoints = ['detail', 'reject-cs', 'reject-submit'];
            const responses = await Promise.all(endpoints.map((endpoint) =>
                fetch(`${API_BASE}/follow-up-4/${endpoint}?${query}`)
            ));
            const failedResponse = responses.find((response) => !response.ok);
            if (failedResponse) {
                throw new Error(`Failed to load report data (${failedResponse.status})`);
            }
            const results = await Promise.all(responses.map((response) => response.json()));
            setDetailRows(results[0].data || []);
            setRejectCsRows(results[1].data || []);
            setRejectSubmitRows(results[2].data || []);
        } catch (fetchError) {
            console.error('Fetch Follow Up 4 report error:', fetchError);
            setError(fetchError.message || 'Failed to load report data');
            setDetailRows([]);
            setRejectCsRows([]);
            setRejectSubmitRows([]);
        } finally {
            setLoading(false);
        }
    }, [API_BASE, endDate, selectedBrand, startDate, user]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const reportRows = useMemo(() => {
        const byDate = new Map();
        const getOrCreate = (date) => {
            if (!byDate.has(date)) {
                const empty = Object.fromEntries(detailFields.map(([field]) => [field, 0]));
                byDate.set(date, { date, ...empty });
            }
            return byDate.get(date);
        };

        detailRows.forEach((record) => {
            const date = getDateKey(record);
            if (!date) return;
            const daily = getOrCreate(date);
            detailFields.forEach(([field]) => {
                if (field === 'message' && (record.message === undefined || record.message === null)) {
                    daily.message += getCount(record.page) + getCount(record.telegram) + getCount(record.call);
                } else {
                    daily[field] += getCount(record[field]);
                }
            });
        });
        rejectCsRows.concat(rejectSubmitRows).forEach((record) => {
            const date = getDateKey(record);
            if (date) getOrCreate(date);
        });

        return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [detailRows, rejectCsRows, rejectSubmitRows]);

    const detailTotals = useMemo(() => {
        const totals = Object.fromEntries(detailFields.map(([field]) => [field, 0]));
        reportRows.forEach((row) => {
            detailFields.forEach(([field]) => { totals[field] += getCount(row[field]); });
        });
        return {
            ...totals,
            totalSubmit: totals.pageSubmit + totals.telegramSubmit + totals.call,
            totalReject: totals.reject + totals.reject2,
            totalSuccess: totals.success1 + totals.success2
        };
    }, [reportRows]);

    const getGroupedRejectRows = useCallback((rows) => {
        const reasonSet = new Set();
        const groups = new Map();
        rows.forEach((record) => {
            const date = getDateKey(record);
            if (!date) return;
            const reason = record.reason || '';
            reasonSet.add(reason);
            if (!groups.has(date)) groups.set(date, { date, total: 0, reasons: {} });
            const group = groups.get(date);
            group.reasons[reason] = (group.reasons[reason] || 0) + getCount(record.count);
            group.total += getCount(record.count);
        });
        const groupRows = Array.from(groups.values())
            .filter((group) => group.total > 0)
            .sort((a, b) => b.date.localeCompare(a.date));
        const reasonTotals = Object.fromEntries(Array.from(reasonSet, (reason) => [reason, 0]));
        groupRows.forEach((group) => {
            Object.entries(group.reasons).forEach(([reason, count]) => {
                reasonTotals[reason] += count;
            });
        });
        return { reasons: Array.from(reasonSet), rows: groupRows, total: groupRows.reduce((sum, row) => sum + row.total, 0), reasonTotals };
    }, []);

    const groupedRejectCs = useMemo(() => getGroupedRejectRows(rejectCsRows), [getGroupedRejectRows, rejectCsRows]);
    const groupedRejectSubmit = useMemo(() => getGroupedRejectRows(rejectSubmitRows), [getGroupedRejectRows, rejectSubmitRows]);

    const openDailyReport = (row) => {
        setCopied(false);
        setCopyError('');
        setActiveReportView('text');
        setActiveReport({
            title: `${t('dailyReport') || 'របាយការណ៍ប្រចាំថ្ងៃ'} - ${getFormattedDate(row.date)}`,
            text: getDailyReportText(row.date, row, rejectSubmitRows, t, lang)
        });
    };

    const openTotalReport = () => {
        const reportDate = startDate && endDate
            ? `${getFormattedDate(startDate)} - ${getFormattedDate(endDate)}`
            : (startDate ? `${t('from', lang === 'km' ? 'ចាប់ពី' : 'From')} ${getFormattedDate(startDate)}` : (endDate ? `${t('to', lang === 'km' ? 'ដល់' : 'To')} ${getFormattedDate(endDate)}` : t('all', lang === 'km' ? 'សរុបទាំងអស់' : 'All dates')));
        const reasons = groupedRejectSubmit.reasons
            .filter((reason) => groupedRejectSubmit.reasonTotals[reason] > 0);
        const totalReportText = [
            reportDate,
            `${getReportLabel(t, 'followUpTotalMessages', lang === 'km' ? 'សារសរុប' : 'Total messages')} ${detailTotals.message}`,
            `${getReportLabel(t, 'followUpNoReply', lang === 'km' ? 'មិនឆ្លើយតប' : 'No reply')} ${detailTotals.noReply}`,
            `${getReportLabel(t, 'followUpReplied', lang === 'km' ? 'ឆ្លើយតប' : 'Replied')} ${Math.max(0, detailTotals.message - detailTotals.noReply)}`,
            `${getReportLabel(t, 'followUpInquiries', lang === 'km' ? 'សាកសួរ' : 'Inquiries')} ${detailTotals.inquire}`,
            `${getReportLabel(t, 'followUpSubmitted', lang === 'km' ? 'ដាក់ស្នើ' : 'Submitted')} ${detailTotals.totalSubmit}`,
            `${getReportLabel(t, 'followUpReview', lang === 'km' ? 'ពិនិត្យ' : 'Review')} ${detailTotals.review}`,
            `${getReportLabel(t, 'followUpRejected', lang === 'km' ? 'បរាជ័យ' : 'Rejected')} ${detailTotals.totalReject}`,
            `${getReportLabel(t, 'followUpSuccessful', lang === 'km' ? 'ជោគជ័យ' : 'Successful')} ${detailTotals.totalSuccess}`,
            ...reasons.map((reason) => `- ${reason}`)
        ].join('\n');
        const rows = [
            { label: t('dateRange', lang === 'km' ? 'ចន្លោះកាលបរិច្ឆេទ' : 'Date range'), value: reportDate },
            { label: getReportLabel(t, 'followUpTotalMessages', lang === 'km' ? 'សារសរុប' : 'Total messages'), value: detailTotals.message },
            { label: getReportLabel(t, 'followUpNoReply', lang === 'km' ? 'មិនឆ្លើយតប' : 'No reply'), value: detailTotals.noReply },
            { label: getReportLabel(t, 'followUpReplied', lang === 'km' ? 'ឆ្លើយតប' : 'Replied'), value: Math.max(0, detailTotals.message - detailTotals.noReply) },
            { label: getReportLabel(t, 'followUpInquiries', lang === 'km' ? 'សាកសួរ' : 'Inquiries'), value: detailTotals.inquire },
            { label: getReportLabel(t, 'followUpSubmitted', lang === 'km' ? 'ដាក់ស្នើ' : 'Submitted'), value: detailTotals.totalSubmit },
            { label: getReportLabel(t, 'followUpReview', lang === 'km' ? 'ពិនិត្យ' : 'Review'), value: detailTotals.review },
            { label: getReportLabel(t, 'followUpRejected', lang === 'km' ? 'បរាជ័យ' : 'Rejected'), value: detailTotals.totalReject },
            { label: getReportLabel(t, 'followUpSuccessful', lang === 'km' ? 'ជោគជ័យ' : 'Successful'), value: detailTotals.totalSuccess },
            ...reasons.map((reason) => ({ label: reason, value: groupedRejectSubmit.reasonTotals[reason] || 0 }))
        ];
        const numericTotal = rows.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0);
        const tableRows = [
            ...rows,
            ...Array.from({ length: 4 }, (_, index) => ({ label: '', value: '', spacer: true, id: `spacer-${index}` })),
            { label: 'TOTAL COUNTS', value: numericTotal, isGrandTotal: true }
        ];
        setCopied(false);
        setCopyError('');
        setActiveReport({ title: t('followUp4TotalReport') || 'Follow Up 4 Total Report', text: totalReportText, rows: tableRows });
        setActiveReportView('text');
    };

    const totalReportColumns = [
        { header: 'No', cell: (row, index) => row.spacer || row.isGrandTotal ? '' : index + 1 },
        { header: 'Description', accessor: 'label' },
        { header: 'Value', accessor: 'value' }
    ];

    const exportTotalReportExcel = () => {
        if (!activeReport?.rows) return;
        exportToExcel(activeReport.title, totalReportColumns, activeReport.rows, selectedBrand || user?.brand || '');
    };

    const exportTotalReportPdf = (orientation = 'portrait') => {
        if (!activeReport?.rows) return;
        exportToPDF(activeReport.title, totalReportColumns, activeReport.rows, selectedBrand || user?.brand || '', orientation);
    };

    const copyReport = async () => {
        try {
            await navigator.clipboard.writeText(activeReport.text);
            setCopied(true);
            setCopyError('');
            window.setTimeout(() => setCopied(false), 1500);
        } catch (clipboardError) {
            console.error('Copy Follow Up 4 report error:', clipboardError);
            setCopyError(t('copyFailed') || 'Copy failed. Please copy the report text manually.');
        }
    };

    const permissionToView = hasPermission('/report/follow-up-4', 'read');

    if (!permissionToView) {
        return (
            <div className="m-3 rounded-[5px] border border-rose-200 bg-white p-6 text-center font-semibold text-rose-600">
                {t('accessDenied') || 'Access Denied'}
            </div>
        );
    }

    const renderRejectTable = (title, table, accent) => (
        <section className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h2 className={`text-sm font-black ${accent}`}>{title}</h2>
                <span className="text-xs font-semibold text-slate-500">{table.rows.length} {t('days', lang === 'km' ? 'ថ្ងៃ' : 'days')}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">{t('date')}</th>
                            <th className="px-3 py-2.5 text-center">{t('total')}</th>
                            {table.reasons.map((reason) => (
                                <th key={reason} className="whitespace-nowrap px-3 py-2.5 text-center">{reason}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={table.reasons.length + 2} className="px-3 py-8 text-center text-slate-400">{t('loading', lang === 'km' ? 'កំពុងទាញយកទិន្នន័យ...' : 'Loading data...')}</td></tr>
                        ) : table.rows.length === 0 ? (
                            <tr><td colSpan={table.reasons.length + 2} className="px-3 py-8 text-center text-slate-400">{t('noData', lang === 'km' ? 'មិនមានទិន្នន័យ' : 'No data')}</td></tr>
                        ) : table.rows.map((row) => (
                            <tr key={row.date} className="hover:bg-slate-50">
                                <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-slate-700">{getFormattedDate(row.date)}</td>
                                <td className="px-3 py-2 text-center font-black text-slate-800">{row.total}</td>
                                {table.reasons.map((reason) => (
                                    <td key={reason} className="px-3 py-2 text-center font-mono text-slate-600">{row.reasons[reason] || 0}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    {table.rows.length > 0 && (
                        <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-700">
                            <tr>
                                <td className="px-3 py-2.5">{t('total') || 'សរុប'}</td>
                                <td className="px-3 py-2.5 text-center">{table.total}</td>
                                {table.reasons.map((reason) => (
                                    <td key={reason} className="px-3 py-2.5 text-center">{table.reasonTotals[reason] || 0}</td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </section>
    );

    return (
        <main className="mx-auto max-w-[1800px] space-y-5 p-2 sm:p-3">
            <header className="flex flex-col justify-between gap-4 rounded-[5px] border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-800">
                        <FaFileAlt className="text-emerald-600" />
                        {t('followUp4Report') || 'Follow Up 4 Report'}
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-[5px] border border-slate-200 bg-slate-50 px-3 py-2">
                        <FaCalendarAlt className="text-emerald-600" />
                        <input aria-label={t('startDate')} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[130px] bg-transparent text-xs text-slate-700 outline-none" />
                        <span className="text-xs text-slate-400">-</span>
                        <input aria-label={t('endDate')} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-[130px] bg-transparent text-xs text-slate-700 outline-none" />
                    </div>
                    {isMasterAdmin && (
                        <select aria-label={t('brand')} value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)} className="rounded-[5px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none">
                            <option value="">{t('allBrands')}</option>
                            {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                    )}
                    <button onClick={openTotalReport} disabled={!reportRows.length || loading} className="flex items-center gap-2 rounded-[5px] bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <FaFileAlt />
                        {t('viewTotalReport') || 'មើល Report សរុប'}
                    </button>
                    <button onClick={fetchReportData} disabled={loading} aria-label={t('refresh') || 'Refresh'} className="rounded-[5px] border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {error && <div role="alert" className="rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

            <section className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h2 className="text-sm font-black text-sky-700">{t('detail', lang === 'km' ? 'លម្អិត' : 'DETAIL')}</h2>
                    <span className="text-xs font-semibold text-slate-500">{reportRows.length} {t('days', lang === 'km' ? 'ថ្ងៃ' : 'days')}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-xs">
                        <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                            <tr>
                                <th className="whitespace-nowrap px-3 py-2.5 text-left">{t('date')}</th>
                                {detailTableFields.map(([field, label]) => (
                                    <th key={field} className="whitespace-nowrap px-2 py-2.5 text-center">{t(field, label)}</th>
                                ))}
                                <th className="whitespace-nowrap px-3 py-2.5 text-center">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={detailTableFields.length + 2} className="px-3 py-10 text-center text-slate-400">{t('loading', lang === 'km' ? 'កំពុងទាញយកទិន្នន័យ...' : 'Loading data...')}</td></tr>
                            ) : reportRows.length === 0 ? (
                                <tr><td colSpan={detailTableFields.length + 2} className="px-3 py-10 text-center text-slate-400">{t('noDataForDateRange', lang === 'km' ? 'មិនមានទិន្នន័យសម្រាប់ចន្លោះកាលបរិច្ឆេទនេះទេ' : 'No data for this date range')}</td></tr>
                            ) : reportRows.map((row) => (
                                <tr key={row.date} className="hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-slate-700">{getFormattedDate(row.date)}</td>
                                    {detailTableFields.map(([field]) => (
                                        <td key={field} className={`px-2 py-2 text-center font-mono ${['totalSubmit', 'totalReject', 'totalSuccess'].includes(field) ? 'font-black' : 'text-slate-600'}`}>
                                            {getDetailValue(row, field)}
                                        </td>
                                    ))}
                                    <td className="px-3 py-2 text-center">
                                        <button onClick={() => openDailyReport(row)} className="whitespace-nowrap rounded-[5px] bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700">
                                            មើល Report
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {reportRows.length > 0 && (
                            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-700">
                                <tr>
                                    <td className="whitespace-nowrap px-3 py-2.5">{t('total') || 'សរុប'}</td>
                                    {detailTableFields.map(([field]) => (
                                        <td key={field} className="px-2 py-2.5 text-center">{detailTotals[field]}</td>
                                    ))}
                                    <td className="px-3 py-2.5 text-center">-</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </section>

            {renderRejectTable('REJECT CS', groupedRejectCs, 'text-amber-700')}
            {renderRejectTable('REJECT SUBMIT', groupedRejectSubmit, 'text-rose-700')}

            {activeReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={activeReport.title}>
                    <div className={`w-full ${activeReport.rows ? 'max-w-3xl' : 'max-w-lg'} overflow-hidden rounded-[5px] bg-white shadow-2xl`}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <h2 className="font-black text-slate-800">{activeReport.title}</h2>
                            <button onClick={() => setActiveReport(null)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('close')}>×</button>
                        </div>
                        {activeReport.rows && (
                            <nav className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
                                <div className="flex gap-2">
                                    <button onClick={() => setActiveReportView('text')} className={`rounded-[5px] px-3 py-1.5 text-xs font-bold ${activeReportView === 'text' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t('textReport', 'Text Report')}</button>
                                    <button onClick={() => setActiveReportView('table')} className={`rounded-[5px] px-3 py-1.5 text-xs font-bold ${activeReportView === 'table' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t('summaryTable')}</button>
                                </div>
                                {activeReportView === 'table' && <ExportDropdown onExportExcel={exportTotalReportExcel} onExportPDF={exportTotalReportPdf} />}
                            </nav>
                        )}
                        {activeReport.rows && activeReportView === 'table' ? (
                            <div className="max-h-[65vh] overflow-auto p-4">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                                            <th className="border border-slate-200 px-3 py-2 text-center">{t('no')}</th>
                                            <th className="border border-slate-200 px-3 py-2">{t('description')}</th>
                                            <th className="border border-slate-200 px-3 py-2 text-right">{t('value', 'Value')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeReport.rows.map((row, index) => (
                                            <tr key={row.id || row.label || index} className={row.isGrandTotal ? 'border-t-2 border-emerald-600 bg-emerald-50 font-black text-emerald-900' : 'even:bg-slate-50'}>
                                                <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{row.spacer || row.isGrandTotal ? '' : index + 1}</td>
                                                <td className="border border-slate-200 px-3 py-2"><CopyCell text={row.label} className="text-slate-800" /></td>
                                                <td className="border border-slate-200 px-3 py-2 text-right font-mono"><CopyCell text={row.value === '' ? '' : String(row.value)} className="text-slate-800" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-7 text-slate-800">{activeReport.text}</pre>
                        )}
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                            {activeReportView === 'text' ? (
                                <>
                                    {copyError ? <p role="alert" className="text-xs text-rose-600">{copyError}</p> : <span />}
                                    <button onClick={copyReport} className="flex items-center gap-2 rounded-[5px] bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                                        <FaCopy /> {copied ? (t('copied') || 'បាន Copy') : (t('copyText') || 'Copy Text')}
                                    </button>
                                </>
                            ) : <button onClick={() => setActiveReport(null)} className="ml-auto rounded-[5px] bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300">{t('close')}</button>}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default FollowUp4Report;
