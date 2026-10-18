import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaRegCalendarAlt,
    FaListUl, FaChartPie, FaCheckCircle,
    FaTimesCircle, FaQuestionCircle, FaFilter,
    FaFileDownload, FaBuilding, FaComments,
    FaCommentSlash
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdOutlineRateReview, MdOutlineAssignment } from 'react-icons/md';
import { exportToExcel, exportToPDF, exportMultiSheetExcel, exportFollowUp1PDF } from '../../../utils/exportUtils';
import ExportDropdown from '../../../components/ExportDropdown';
import Pagination from '../../../components/Pagination';
import DateRangeDropdown from '../../../components/DateRangeDropdown';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';

const LIMIT = 15;

const FollowUp1 = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Summary state
    const [summary, setSummary] = useState({
        totalRecords: 0,
        totalMessages: 0,
        totalNoResponse: 0,
        totalRequested: 0,
        totalReview: 0,
        totalFailed: 0,
        totalSuccess: 0,
        successRate: 0
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);
    const [filterDate, setFilterDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);

    // Form modal state (Create & Edit)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        message: '',
        totalMessages: '',
        noResponse: 0,
        requested: 0,
        review: 0,
        failed: 0,
        success: 0,
        reason: '',
        brand: user?.brand || 'MDM',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'
    const [exportOrientation, setExportOrientation] = useState('landscape'); // 'portrait' | 'landscape'
    const [exportScope, setExportScope] = useState('month'); // 'today' | 'week' | 'month' | 'custom' | 'all'
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Fetch Brands for Admin dropdown
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const brandCat = data.droplists?.find(d => d.category === 'Brands');
                    if (brandCat && Array.isArray(brandCat.items) && brandCat.items.length > 0) {
                        setBrandsList(brandCat.items.map(b => typeof b === 'string' ? b : b.name || String(b)));
                    }
                }
            } catch (err) {
                console.error('Fetch brands error:', err);
            }
        };
        fetchBrands();
    }, [API_BASE]);

    // Fetch Follow-up records
    const fetchData = useCallback(async (pg = page, search = searchTerm, sDate = startDate, eDate = endDate, fDate = filterDate, brd = selectedBrand) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: pg,
                limit: LIMIT
            });

            if (search) params.append('search', search);
            if (fDate) params.append('date', fDate);
            if (sDate) params.append('startDate', sDate);
            if (eDate) params.append('endDate', eDate);
            if (brd) params.append('brand', brd);

            const res = await fetch(`${API_BASE}/follow-up?${params.toString()}`);
            if (res.ok) {
                const jsonRes = await res.json();
                setDataList(jsonRes.data || []);
                setTotal(jsonRes.total || 0);
                if (jsonRes.summary) {
                    setSummary(jsonRes.summary);
                }
            }
        } catch (err) {
            console.error('Fetch follow-up error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 300);
        }
    }, [API_BASE, page, searchTerm, startDate, endDate, filterDate, selectedBrand, user]);

    useEffect(() => {
        fetchData(page);
    }, [fetchData, page]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData(1, searchTerm, startDate, endDate, filterDate, selectedBrand);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedSearchRecord(null);
        setFilterDate('');
        setStartDate('');
        setEndDate('');
        setSelectedBrand('');
        setPage(1);
        fetchData(1, '', '', '', '', '');
    };

    // Status helper checkers for Follow Up 2
    const isSuccessStatus = (st) => {
        const s = (st || '').trim().toLowerCase();
        return s === 'ជោគជ័យ' || s === 'success';
    };
    const isFailedStatus = (st) => {
        const s = (st || '').trim().toLowerCase();
        return s === 'បរាជ័យ' || s === 'failed';
    };
    const isReviewStatus = (st) => {
        const s = (st || '').trim().toLowerCase();
        return s === 'review' || s === 'ពិនិត្យ' || s === 'កំពុងពិនិត្យ' || s === 'រង់ចាំពិនិត្យ' || s === 'in review' || s === 'pending review';
    };

    // State for Follow Up 2 auto-fetch
    const [fetchingFu2, setFetchingFu2] = useState(false);
    const [fu2StatsFound, setFu2StatsFound] = useState(null);

    // Fetch stats from Follow Up 2 for a specific date and brand
    const fetchFu2DataForDate = async (targetDate, targetBrand) => {
        if (!targetDate) return;
        setFetchingFu2(true);
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                date: targetDate,
                fetchAll: 'true'
            });
            if (targetBrand && targetBrand !== 'ALL' && targetBrand !== 'All') {
                params.append('brand', targetBrand);
            }

            let res = await fetch(`${API_BASE}/follow-up-2?${params.toString()}`);
            let jsonRes = res.ok ? await res.json() : null;

            // Fallback: If 0 records found with targetBrand, try fetching all for date in case brand wasn't assigned
            if ((!jsonRes?.data || jsonRes.data.length === 0) && targetBrand && targetBrand !== 'ALL') {
                const fallbackParams = new URLSearchParams({
                    userRole: user?.role || '',
                    username: user?.username || '',
                    isImmutable: user?.isImmutable ? 'true' : 'false',
                    date: targetDate,
                    fetchAll: 'true'
                });
                const fbRes = await fetch(`${API_BASE}/follow-up-2?${fallbackParams.toString()}`);
                if (fbRes.ok) {
                    const fbJson = await fbRes.json();
                    if (fbJson.data && fbJson.data.length > 0) {
                        jsonRes = fbJson;
                    }
                }
            }

            if (jsonRes) {
                const records = jsonRes.data || [];
                const totalReq = records.length || jsonRes.summary?.totalRecords || 0;
                const totalSucc = records.filter(r => isSuccessStatus(r.status)).length || jsonRes.summary?.totalSuccess || 0;
                const totalFail = records.filter(r => isFailedStatus(r.status)).length || jsonRes.summary?.totalFailed || 0;
                const totalRev = records.filter(r => isReviewStatus(r.status)).length || jsonRes.summary?.totalReview || 0;

                // Collect unique reasons from all records (top to bottom, deduplicated)
                const reasonsList = [];
                records.forEach(r => {
                    if (r.reason && typeof r.reason === 'string') {
                        const lines = r.reason.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                        lines.forEach(line => {
                            if (!reasonsList.includes(line)) {
                                reasonsList.push(line);
                            }
                        });
                    }
                });
                const reasonText = reasonsList.join('\n');

                setFormData(prev => {
                    const currentTotal = Number(prev.totalMessages) || 0;
                    const autoNoResp = currentTotal > 0 ? Math.max(0, currentTotal - totalReq) : (prev.noResponse || 0);

                    return {
                        ...prev,
                        requested: totalReq,
                        success: totalSucc,
                        failed: totalFail,
                        review: totalRev,
                        // Do NOT auto-fill message or totalMessages
                        noResponse: autoNoResp,
                        ...((reasonText && (!prev.reason || !editingItem)) ? { reason: reasonText } : {})
                    };
                });

                setFu2StatsFound({
                    date: targetDate,
                    total: totalReq,
                    success: totalSucc,
                    failed: totalFail,
                    review: totalRev,
                    hasData: records.length > 0
                });
            }
        } catch (err) {
            console.error('Fetch FollowUp2 stats error:', err);
        } finally {
            setFetchingFu2(false);
        }
    };

    // Form Handlers
    const handleOpenCreate = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const initialBrand = user?.brand || 'MDM';
        setEditingItem(null);
        setFu2StatsFound(null);
        setFormData({
            date: todayStr,
            message: '',
            totalMessages: '',
            noResponse: 0,
            requested: 0,
            review: 0,
            failed: 0,
            success: 0,
            reason: '',
            brand: initialBrand,
            notes: ''
        });
        setIsFormOpen(true);
        // Automatically fetch and populate data from Follow Up 2
        fetchFu2DataForDate(todayStr, initialBrand);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setFu2StatsFound(null);
        const itemDate = item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0];
        const itemBrand = item.brand || user?.brand || 'MDM';
        setFormData({
            date: itemDate,
            message: item.message !== undefined ? item.message : '',
            totalMessages: item.totalMessages !== undefined ? item.totalMessages : (item.requested || 0),
            noResponse: item.noResponse !== undefined ? item.noResponse : 0,
            requested: item.requested !== undefined ? item.requested : 0,
            review: item.review !== undefined ? item.review : 0,
            failed: item.failed !== undefined ? item.failed : 0,
            success: item.success !== undefined ? item.success : 0,
            reason: item.reason || '',
            brand: itemBrand,
            notes: item.notes || ''
        });
        setIsFormOpen(true);
    };

    // Numeric change helper with auto calculation of noResponse
    const handleNumericChange = (field, val) => {
        const numVal = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
        setFormData(prev => {
            const next = {
                ...prev,
                [field]: numVal
            };
            if (field === 'totalMessages' || field === 'requested') {
                const tot = field === 'totalMessages' ? (Number(numVal) || 0) : (Number(prev.totalMessages) || 0);
                const req = field === 'requested' ? (Number(numVal) || 0) : (Number(prev.requested) || 0);
                next.noResponse = Math.max(0, tot - req);
            }
            return next;
        });
    };

    // Inquiry Message change helper
    const handleMessageChange = (val) => {
        setFormData(prev => ({
            ...prev,
            message: val
        }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.date) {
            alert(t('selectDateAlert'));
            return;
        }
        if (formData.message === '' || formData.message === null || formData.message === undefined || isNaN(Number(formData.message))) {
            alert(t('enterMsgSent'));
            return;
        }

        setSubmitting(true);
        try {
            const url = editingItem
                ? `${API_BASE}/follow-up/${editingItem._id}`
                : `${API_BASE}/follow-up`;
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                totalMessages: Number(formData.totalMessages) || 0,
                noResponse: Number(formData.noResponse) || 0,
                requested: Number(formData.requested) || 0,
                review: Number(formData.review) || 0,
                failed: Number(formData.failed) || 0,
                success: Number(formData.success) || 0,
                brand: formData.brand || user?.brand || 'MDM',
                username: user?.username || ''
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsFormOpen(false);
                setEditingItem(null);
                fetchData(page);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.message || t('errorSavingFollowUpRecord'));
            }
        } catch (err) {
            console.error('Save follow up error:', err);
            alert(t('networkErrorSavingFollowUp'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`${t('confirmDeleteFollowUpEntryForDate')} ${item.date?.split('T')[0]}?`)) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/follow-up/${item._id}?username=${encodeURIComponent(user?.username || '')}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData(page);
            } else {
                alert(t('failedToDeleteRecord'));
            }
        } catch (err) {
            console.error('Delete follow up error:', err);
        }
    };

    // Open Export Props Modal
    const handleOpenExportModal = (format = 'excel', orientation = 'landscape') => {
        setExportFormat(format);
        setExportOrientation(orientation);
        const todayStr = new Date().toISOString().split('T')[0];
        setExportStartDate(todayStr);
        setExportEndDate(todayStr);
        setIsExportModalOpen(true);
    };

    // Calculate dates helper for Export Scope
    const getDateRangeForScope = (scope) => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (scope === 'today') {
            return { start: todayStr, end: todayStr, label: t('today') };
        } else if (scope === 'week') {
            const d = new Date(now);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            return {
                start: monday.toISOString().split('T')[0],
                end: sunday.toISOString().split('T')[0],
                label: t('thisWeek')
            };
        } else if (scope === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: firstDay.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0],
                label: t('thisMonth')
            };
        } else if (scope === 'custom') {
            return {
                start: exportStartDate || todayStr,
                end: exportEndDate || todayStr,
                label: `Custom: ${exportStartDate || todayStr} to ${exportEndDate || todayStr}`
            };
        }
        return { start: '', end: '', label: t('allTime') };
    };

    // Execute Export from Modal
    const handleConfirmExport = async () => {
        setIsExporting(true);
        try {
            const range = getDateRangeForScope(exportScope);
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                limit: 10000
            });

            if (range.start) params.append('startDate', range.start);
            if (range.end) params.append('endDate', range.end);
            if (selectedBrand) params.append('brand', selectedBrand);

            const res = await fetch(`${API_BASE}/follow-up?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch export data');
            const resJson = await res.json();
            const items = resJson.data || [];

            if (items.length === 0) {
                alert(t('noFollowUpDataInSelectedDateRange'));
                setIsExporting(false);
                return;
            }

            // Calculate Totals for the Export
            const totalMsg = items.reduce((sum, it) => sum + (Number(it.totalMessages) || 0), 0);
            const totalNoResp = items.reduce((sum, it) => sum + (Number(it.noResponse) || 0), 0);
            const totalReq = items.reduce((sum, it) => sum + (Number(it.requested) || 0), 0);
            const totalRev = items.reduce((sum, it) => sum + (Number(it.review) || 0), 0);
            const totalFail = items.reduce((sum, it) => sum + (Number(it.failed) || 0), 0);
            const totalSucc = items.reduce((sum, it) => sum + (Number(it.success) || 0), 0);
            const overallRate = totalReq > 0 ? ((totalSucc / totalReq) * 100).toFixed(1) : '0.0';

            const exportSummaryObj = {
                totalRecords: items.length,
                totalMessages: totalMsg,
                totalNoResponse: totalNoResp,
                totalRequested: totalReq,
                totalReview: totalRev,
                totalFailed: totalFail,
                totalSuccess: totalSucc,
                successRate: overallRate
            };

            // Define Export Table Columns
            const exportColumns = [
                { header: '#', accessor: (row, idx) => row.isTotalRow ? '' : String(idx + 1) },
                { header: t('date'), accessor: (row) => row.isTotalRow ? t('total') : (row.date ? row.date.split('T')[0] : '') },
                { header: t('inquiredMessages'), accessor: (row) => row.isTotalRow ? `Total Records: ${items.length}` : (row.message || '') },
                { header: t('totalMessages'), accessor: (row) => String(row.totalMessages !== undefined ? row.totalMessages : 0) },
                { header: t('noResponse'), accessor: (row) => String(row.noResponse !== undefined ? row.noResponse : 0) },
                { header: t('requested'), accessor: (row) => String(row.requested !== undefined ? row.requested : 0) },
                { header: t('inReview'), accessor: (row) => String(row.review !== undefined ? row.review : 0) },
                { header: t('failed'), accessor: (row) => String(row.failed !== undefined ? row.failed : 0) },
                { header: t('success'), accessor: (row) => String(row.success !== undefined ? row.success : 0) },
                { header: 'Success Rate (%)', accessor: (row) => `${row.successRate || 0}%` },
                { header: t('note'), accessor: (row) => row.reason || '' },
                { header: 'Brand', accessor: (row) => row.brand || '' },
                { header: 'Created By', accessor: (row) => row.createdBy || '' }
            ];

            // Summary Sheet Columns & Rows for Sheet 2
            const summarySheetColumns = [
                { header: '#', accessor: 'no' },
                { header: t('description'), accessor: 'metric' },
                { header: t('totalRecords'), accessor: 'count' },
                { header: t('ratePercent'), accessor: 'rate' },
                { header: t('description'), accessor: 'desc' }
            ];

            const summarySheetRows = [
                { no: '1', metric: t('totalRecords'), count: String(items.length), rate: '100%', desc: t('allExportedRowsDescription') },
                { no: '2', metric: t('inquiredMessages'), count: String(totalMsg), rate: '100%', desc: t('totalCustomerInquiryMessagesDescription') },
                { no: '3', metric: t('noResponse'), count: String(totalNoResp), rate: `${totalMsg > 0 ? ((totalNoResp / totalMsg) * 100).toFixed(1) : 0}%`, desc: t('customerNoResponseDescription') },
                { no: '4', metric: t('requested'), count: String(totalReq), rate: `${totalMsg > 0 ? ((totalReq / totalMsg) * 100).toFixed(1) : 0}%`, desc: t('customerRequestedCollateralDescription') },
                { no: '5', metric: t('inReview'), count: String(totalRev), rate: `${totalReq > 0 ? ((totalRev / totalReq) * 100).toFixed(1) : 0}%`, desc: t('customerInReviewDescription') },
                { no: '6', metric: t('failed'), count: String(totalFail), rate: `${totalReq > 0 ? ((totalFail / totalReq) * 100).toFixed(1) : 0}%`, desc: t('customerFailedDescription') },
                { no: '7', metric: t('success'), count: String(totalSucc), rate: `${overallRate}%`, desc: t('customerSuccessRateDescription'), isTotalRow: true }
            ];

            // Append Total Summary Row at the bottom of Sheet 1
            const dataWithSummaryRow = [
                ...items,
                {
                    isTotalRow: true,
                    isGrandTotal: true,
                    date: t('grandTotal'),
                    message: `Total Count: ${items.length}`,
                    totalMessages: totalMsg,
                    noResponse: totalNoResp,
                    requested: totalReq,
                    review: totalRev,
                    failed: totalFail,
                    success: totalSucc,
                    successRate: overallRate,
                    reason: 'Summary Totals',
                    brand: '',
                    createdBy: ''
                }
            ];

            const title = `Follow_Up_1_Report_${exportScope}_${range.start || 'all'}_to_${range.end || 'all'}`;

            if (exportFormat === 'excel') {
                // Multi-Sheet Export: Sheet 1 = Details, Sheet 2 = Summary Table
                exportMultiSheetExcel(title, [
                    {
                        name: 'Follow Up 1 Details',
                        title: `Follow Up 1 Detailed Records (${range.label})`,
                        columns: exportColumns,
                        data: dataWithSummaryRow
                    },
                    {
                        name: 'Summary Totals',
                        title: `Follow Up 1 Executive Summary Totals (${range.label})`,
                        columns: summarySheetColumns,
                        data: summarySheetRows
                    }
                ], user?.brand || 'SYSTEM');
            } else {
                // Multi-Page Print-Ready PDF: Page 1 = Details, Page 2 = Executive Summary
                exportFollowUp1PDF(title, exportColumns, dataWithSummaryRow, exportSummaryObj, range.label, user?.brand || 'SYSTEM', exportOrientation);
            }

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert(`${t('exportFailed')}: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-2 md:p-2 space-y-6 max-w-full overflow-x-hidden">
            {/* Header / Title Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--app-card,#ffffff)] p-5 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs">
                <div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>{t('followUp1')}</span>
                        </h1>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {hasPermission('/follow-up/follow-up-1', 'export') && (
                        <ExportDropdown
                            onExportExcel={() => handleOpenExportModal('excel')}
                            onExportPDF={(orientation) => handleOpenExportModal('pdf', orientation)}
                            excelLabel={t('exportExcel')}
                            pdfLabel={t('exportPDF')}
                        />
                    )}

                    {hasPermission('/follow-up/follow-up-1', 'create') && (
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95 ml-auto md:ml-0"
                        >
                            <FaPlusCircle size={15} />
                            <span>{t('createEntry')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Total Records */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalRecords')}</span>
                        <FaListUl className="text-slate-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[var(--app-text,#0f172a)]">
                        {summary.totalRecords.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">{t('totalEntries')}</span>
                </div>

                {/* Total Messages */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalMessages')}</span>
                        <FaComments className="text-blue-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-blue-600 dark:text-blue-400">
                        {(summary.totalMessages || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-blue-600/80 mt-1 font-medium">{t('totalMessages')}</span>
                </div>

                {/* No Response */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('noResponse')}</span>
                        <FaCommentSlash className="text-slate-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-600 dark:text-slate-400">
                        {(summary.totalNoResponse || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">{t('noResponse')}</span>
                </div>

                {/* Total Requested */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalRequested')}</span>
                        <FaQuestionCircle className="text-amber-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                        {summary.totalRequested.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-amber-600/80 mt-1 font-medium">{t('totalRequested')}</span>
                </div>

                {/* Review */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('inReview')}</span>
                        <MdOutlineRateReview className="text-indigo-500" size={15} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {(summary.totalReview || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-indigo-600/80 mt-1 font-medium">{t('inReview')}</span>
                </div>

                {/* Total Failed */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalFailed')}</span>
                        <FaTimesCircle className="text-rose-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
                        {summary.totalFailed.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-rose-600/80 mt-1 font-medium">{t('totalFailed')}</span>
                </div>

                {/* Total Success & Rate */}
                <div className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalSuccess')}</span>
                        <FaCheckCircle className="text-emerald-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
                        <span>{summary.totalSuccess.toLocaleString()}</span>
                        <span className="text-[10px] font-semibold text-sky-600">({summary.successRate}%)</span>
                    </div>
                    <span className="text-[10px] text-emerald-600/80 mt-1 font-medium">{t('successRate')}</span>
                </div>
            </div>

            {/* Filter Controls */}
            <form onSubmit={handleSearchSubmit} className="bg-[var(--app-card,#ffffff)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <DatabaseSearchInput
                    apiBase={API_BASE}
                    endpoint="/follow-up"
                    params={{
                        userBrand: user?.brand || '',
                        userRole: user?.role || '',
                        username: user?.username || '',
                        isImmutable: user?.isImmutable ? 'true' : 'false',
                        ...(filterDate ? { date: filterDate } : {}),
                        ...(startDate ? { startDate } : {}),
                        ...(endDate ? { endDate } : {}),
                        ...(selectedBrand ? { brand: selectedBrand } : {})
                    }}
                    value={searchTerm}
                    placeholder={t('searchFollowUp1Placeholder')}
                    onChange={(value) => {
                        setSearchTerm(value);
                        setSelectedSearchRecord(null);
                        setPage(1);
                    }}
                    onSelect={(record) => {
                        setSelectedSearchRecord(record);
                        setSearchTerm(record.message || record.reason || record.brand || record.createdBy || '');
                        setPage(1);
                    }}
                    getLabel={(record) => record.message || record.reason || record.brand || record.createdBy || ''}
                    getDescription={(record) => [record.date, record.brand, record.createdBy, record.reason].filter(Boolean).join(' · ')}
                    className="relative flex-1 min-w-[200px]"
                />

                <DateRangeDropdown
                    from={startDate || filterDate}
                    to={endDate || filterDate}
                    onApplyRange={(from, to) => {
                        setFilterDate('');
                        setStartDate(from);
                        setEndDate(to);
                    }}
                    onClear={() => setFilterDate('')}
                />

                {/* Brand Filter (if Master Admin) */}
                {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                    <div className="flex items-center gap-1.5 min-w-[130px]">
                        <FaBuilding className="text-slate-400" size={13} />
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="">{t('allBrandsShort')}</option>
                            {brandsList.map((b, idx) => (
                                <option key={idx} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Action Submit */}
                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                        <FaFilter size={12} />
                        <span>{t('filter')}</span>
                    </button>
                    {(searchTerm || filterDate || startDate || endDate || selectedBrand) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                            {t('clear')}
                        </button>
                    )}
                </div>
            </form>

            {/* Main Data Table */}
            <div className="bg-[var(--app-card,#ffffff)] rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-[var(--app-border,#e2e8f0)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--app-text,#0f172a)]">{t('followUp1Records')}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            {total.toLocaleString()} Records
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ExportDropdown
                            onExportExcel={() => handleOpenExportModal('excel')}
                            onExportPDF={(orientation) => handleOpenExportModal('pdf', orientation)}
                            excelLabel="Export Excel"
                            pdfLabel="Export PDF"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--app-bg,#f8fafc)] border-b border-[var(--app-border,#e2e8f0)] text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted,#64748b)]">
                                <th className="py-1 px-3 w-10 text-center">#</th>
                                <th className="py-1 px-3 min-w-[95px]">{t('date')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('totalMessages')}</th>
                                <th className="py-1 px-4 min-w-[120px]">{t('inquiredMessages')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[65px]">{t('brand')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('noResponse')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('requested')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('inReview')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('failed')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('success')}</th>
                                <th className="py-1 px-2.5 text-center min-w-[75px]">{t('ratePercent')}</th>
                                <th className="py-1 px-4 min-w-[150px]">{t('reason')}</th>
                                <th className="py-1 px-3 text-center min-w-[85px]">{t('actionLabel')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--app-border,#e2e8f0)] text-xs font-medium text-[var(--app-text,#0f172a)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <MdOutlineSync size={24} className="animate-spin text-emerald-600" />
                                            <span>{t('fetchingData')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (selectedSearchRecord ? [selectedSearchRecord] : dataList).length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400 font-normal">
                                        {t('noFollowUp1RecordsCreateEntry')}
                                    </td>
                                </tr>
                            ) : (
                                (selectedSearchRecord ? [selectedSearchRecord] : dataList).map((item, index) => {
                                        const totalMsg = Number(item.totalMessages) || 0;
                                        const noResp = Number(item.noResponse) || 0;
                                        const req = Number(item.requested) || 0;
                                        const rev = Number(item.review) || 0;
                                        const fail = Number(item.failed) || 0;
                                        const succ = Number(item.success) || 0;
                                        const rate = req > 0 ? ((succ / req) * 100).toFixed(1) : '0.0';

                                        return (
                                            <tr key={item._id || index} className="hover:bg-slate-500/5 transition-colors">
                                                <td className="py-1 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                    {(page - 1) * LIMIT + index + 1}
                                                </td>
                                                <td className="py-1 px-3 font-semibold whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                        <FaRegCalendarAlt className="text-emerald-500 text-[11px]" />
                                                        {item.date ? item.date.split('T')[0] : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                                        {totalMsg.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-4 font-bold text-center font-mono text-[var(--app-text,#0f172a)]">
                                                    {item.message || '0'}
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        {item.brand || 'MDM'}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold">
                                                        {noResp.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                                        {req.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                                                        {rev.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                                                        {fail.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                                        {succ.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2.5 text-center font-bold text-sky-600">
                                                    {rate}%
                                                </td>
                                                <td className="py-1 px-4 text-slate-600 dark:text-slate-400">
                                                    <p className="line-clamp-3 whitespace-pre-line text-xs" title={item.reason}>
                                                        {item.reason || '-'}
                                                    </p>
                                                </td>
                                                <td className="py-1 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {hasPermission('/follow-up/follow-up-1', 'edit') && (
                                                            <button
                                                                onClick={() => handleOpenEdit(item)}
                                                                className="p-2 text-amber-600 hover:bg-amber-500/15 rounded-md transition-all cursor-pointer"
                                                                title={t('edit')}
                                                            >
                                                                <FaEdit size={14} />
                                                            </button>
                                                        )}
                                                        {hasPermission('/follow-up/follow-up-1', 'delete') && (
                                                            <button
                                                                onClick={() => handleDelete(item)}
                                                                className="p-2 text-rose-600 hover:bg-rose-500/15 rounded-md transition-all cursor-pointer"
                                                                title={t('delete')}
                                                            >
                                                                <FaTrashAlt size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>

                        {/* Summary Total Sticky/Footer Row */}
                        {!selectedSearchRecord && dataList.length > 0 && (
                            <tfoot>
                                <tr className="bg-emerald-500/10 dark:bg-emerald-950/40 border-t-2 border-emerald-500/30 text-xs font-bold text-[var(--app-text,#0f172a)]">
                                    <td colSpan="2" className="py-3.5 px-4 text-left font-bold text-emerald-800 dark:text-emerald-300">
                                        <span className="uppercase tracking-wider">{t('grandTotal')}:</span>
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-blue-700 dark:text-blue-300 text-xs">
                                        {(summary.totalMessages || 0).toLocaleString()}
                                    </td>
                                    <td className='py-3.5 px-2.5 text-center font-extrabold text-slate-700 dark:text-slate-300 text-xs'>{(summary.totalMessageInquiry || 0).toLocaleString()}</td>
                                    <td></td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-slate-700 dark:text-slate-300 text-xs">
                                        {(summary.totalNoResponse || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-amber-700 dark:text-amber-300 text-xs">
                                        {summary.totalRequested.toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-indigo-700 dark:text-indigo-300 text-xs">
                                        {(summary.totalReview || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-rose-700 dark:text-rose-300 text-xs">
                                        {summary.totalFailed.toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">
                                        {summary.totalSuccess.toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-2.5 text-center font-extrabold text-sky-700 dark:text-sky-300 text-xs">
                                        {summary.successRate}%
                                    </td>
                                    <td colSpan="1" className="py-3.5 px-4 text-right text-xs text-slate-500 font-semibold">
                                        Total Records: {total}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Pagination */}
                {!selectedSearchRecord && <div className="p-2 border-t border-[var(--app-border,#e2e8f0)] flex items-center justify-between">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)]">
                        {t('page')} {page} {t('auditOf')} {Math.ceil(total / LIMIT) || 1} ({t('total')} {total} {t('records')})
                    </span>
                    <Pagination
                        currentPage={page}
                        totalItems={total}
                        limit={LIMIT}
                        onPageChange={(p) => setPage(p)}
                    />
                </div>}
            </div>

            {/* Create / Edit Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-lg rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <MdOutlineAssignment className="text-emerald-600" size={20} />
                                <span>{editingItem ? t('editFollowUp1') : `${t('create')} ${t('followUp1')}`}</span>
                            </h2>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-2 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            {/* Follow Up 2 Sync Banner */}
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-[5px] flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                                    <MdOutlineSync className={`text-emerald-600 text-base shrink-0 ${fetchingFu2 ? 'animate-spin' : ''}`} />
                                    <span>
                                        {fetchingFu2
                                            ? [t('fetchingData')]: fu2StatsFound?.hasData
                                                ? `${t('followUp2DataFor')} ${formData.date}: ${t('requested')} (${fu2StatsFound.total}), ${t('success')} (${fu2StatsFound.success}), ${t('failed')} (${fu2StatsFound.failed}), ${t('inReview')} (${fu2StatsFound.review})`
                                                : `${t('followUp2DataForDate')} ${formData.date}: 0 ${t('records')}`}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    disabled={fetchingFu2}
                                    onClick={() => fetchFu2DataForDate(formData.date, formData.brand)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shrink-0 transition-all cursor-pointer disabled:opacity-50"
                                    title={t('refreshFollowUp2Data')}
                                >
                                    {t('refresh')}
                                </button>
                            </div>

                            {/* Date Field */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    {t('date')} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        setFormData(prev => ({ ...prev, date: newDate }));
                                        fetchFu2DataForDate(newDate, formData.brand);
                                    }}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                            </div>

                            {/* Inquiry Message (Number of messages sent) */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    {t('inquiredMessages')} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder={t('enterInquiredMessageCount')}
                                    value={formData.message}
                                    onChange={(e) => handleMessageChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-bold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono"
                                />
                            </div>

                            {/* {t('totalMessages')} - directly below Message សាកសួរ */}
                            <div>
                                <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                                    {t('totalMessages')}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder={t('enterTotalMessages')}
                                    value={formData.totalMessages}
                                    onChange={(e) => handleNumericChange('totalMessages', e.target.value)}
                                    className="w-full px-3 py-2 bg-blue-500/5 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                                />
                            </div>

                            {/* Row 1: បានស្នើរ, មិនឆ្លើយតប */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center justify-between">
                                        <span>{t('requested')}</span>
                                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded">{t('followUp2')}</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.requested}
                                        onChange={(e) => handleNumericChange('requested', e.target.value)}
                                        className="w-full px-3 py-2 bg-amber-500/5 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
                                        {t('noResponse')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.noResponse}
                                        onChange={(e) => handleNumericChange('noResponse', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-500/5 border border-slate-500/30 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
                                    />
                                </div>
                            </div>

                            {/* Row 2: {t('inReview')} */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-cyan-700 dark:text-cyan-400 mb-1 flex items-center justify-between">
                                        <span>{t('inReview')}</span>
                                        <span className="text-[10px] font-medium text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded">{t('followUp2')}</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.review}
                                        onChange={(e) => handleNumericChange('review', e.target.value)}
                                        className="w-full px-3 py-2 bg-cyan-500/5 border border-cyan-500/30 rounded-lg text-xs font-bold text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                                    />
                                </div>
                            </div>

                            {/* Row 3: ជោគជ័យ, បរាជ័យ */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center justify-between">
                                        <span>{t('success')}</span>
                                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded">{t('followUp2')}</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.success}
                                        onChange={(e) => handleNumericChange('success', e.target.value)}
                                        className="w-full px-3 py-2 bg-emerald-500/5 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-1 flex items-center justify-between">
                                        <span>{t('failed')}</span>
                                        <span className="text-[10px] font-medium text-rose-600 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.2 rounded">{t('followUp2')}</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.failed}
                                        onChange={(e) => handleNumericChange('failed', e.target.value)}
                                        className="w-full px-3 py-2 bg-rose-500/5 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    {t('note')}
                                </label>
                                <textarea
                                    rows="4"
                                    placeholder={t('failureReasonNotesPlaceholder')}
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 whitespace-pre-wrap leading-relaxed"
                                />
                            </div>

                            {/* Brand Selection (if Admin) */}
                            {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        {t('brand')}
                                    </label>
                                    <select
                                        value={formData.brand}
                                        onChange={(e) => {
                                            const newBrand = e.target.value;
                                            setFormData(prev => ({ ...prev, brand: newBrand }));
                                            fetchFu2DataForDate(formData.date, newBrand);
                                        }}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-bold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    >
                                        {brandsList.map((b, idx) => (
                                            <option key={idx} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--app-border,#e2e8f0)]">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {submitting && <MdOutlineSync className="animate-spin" size={14} />}
                                    <span>{t('save')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Range Props Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-md rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <FaFileDownload className="text-emerald-600" size={18} />
                                <span>{t('timeRangeScope')}</span>
                            </h2>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-2 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-5">
                            {/* Format Selector */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    {t('exportFormat')}
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('excel')}
                                        className={`p-2 rounded-[5px] border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'excel'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-emerald-500/10'
                                            }`}
                                    >
                                        <FaFileExcel size={18} />
                                        <span>{t('exportExcel')} (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('pdf')}
                                        className={`p-2 rounded-[5px] border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'pdf'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-rose-500/10'
                                            }`}
                                    >
                                        <MdPictureAsPdf size={19} />
                                        <span>{t('exportPDF')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scope Radio / Buttons */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    {t('timeRangeScope')}
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setExportScope('today')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'today'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        📅 {t('byDay')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('week')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'week'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        🗓️ {t('byWeek')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('month')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'month'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        📆 {t('byMonth')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('custom')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'custom'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        ⚙️ {t('customRange')}
                                    </button>
                                </div>
                            </div>

                            {/* Custom Date Range Picker */}
                            {exportScope === 'custom' && (
                                <div className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-[5px] space-y-3 animate-in fade-in duration-200">
                                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        {t('selectDateRange')}:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">{t('from')}:</span>
                                            <input
                                                type="date"
                                                value={exportStartDate}
                                                onChange={(e) => setExportStartDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-[var(--app-card,#ffffff)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">{t('to')}:</span>
                                            <input
                                                type="date"
                                                value={exportEndDate}
                                                onChange={(e) => setExportEndDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-[var(--app-card,#ffffff)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-[5px] text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                                    <FaCheckCircle size={13} />
                                    <span>{t('summaryTable')}</span>
                                </p>
                                <p className="text-[11px] leading-relaxed">
                                    {t('followUp1ExportTotalsExplanation')}
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExport}
                                disabled={isExporting}
                                className={`px-5 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 ${exportFormat === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                            >
                                {isExporting ? (
                                    <>
                                        <MdOutlineSync className="animate-spin" size={15} />
                                        <span>{t('exporting')}</span>
                                    </>
                                ) : (
                                    <>
                                        <FaFileDownload size={14} />
                                        <span>{t('downloadReport')} ({exportFormat.toUpperCase()})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp1;
