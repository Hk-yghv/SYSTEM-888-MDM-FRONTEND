import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaChartPie, FaCheckCircle,
    FaTimesCircle, FaQuestionCircle, FaFilter,
    FaFileDownload, FaBuilding, FaComments,
    FaCommentSlash
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdOutlineRateReview, MdOutlineAssignment } from 'react-icons/md';
import { exportToExcel, exportToPDF, exportMultiSheetExcel, exportFollowUp1PDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

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
        totalMessages: 0,
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
        setFilterDate('');
        setStartDate('');
        setEndDate('');
        setSelectedBrand('');
        setPage(1);
        fetchData(1, '', '', '', '', '');
    };

    // Form Handlers
    const handleOpenCreate = () => {
        setEditingItem(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            message: '',
            totalMessages: 0,
            noResponse: 0,
            requested: 0,
            review: 0,
            failed: 0,
            success: 0,
            reason: '',
            brand: user?.brand || 'MDM',
            notes: ''
        });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setFormData({
            date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
            message: item.message || '',
            totalMessages: item.totalMessages !== undefined ? item.totalMessages : (item.requested || 0),
            noResponse: item.noResponse !== undefined ? item.noResponse : 0,
            requested: item.requested !== undefined ? item.requested : 0,
            review: item.review !== undefined ? item.review : 0,
            failed: item.failed !== undefined ? item.failed : 0,
            success: item.success !== undefined ? item.success : 0,
            reason: item.reason || '',
            brand: item.brand || user?.brand || 'MDM',
            notes: item.notes || ''
        });
        setIsFormOpen(true);
    };

    // Auto calculate helper on change
    const handleNumericChange = (field, val) => {
        const numVal = Math.max(0, parseInt(val, 10) || 0);
        setFormData(prev => {
            const next = { ...prev, [field]: numVal };

            if (field === 'totalMessages' || field === 'requested') {
                const totalM = field === 'totalMessages' ? numVal : (Number(prev.totalMessages) || 0);
                const req = field === 'requested' ? numVal : (Number(prev.requested) || 0);
                // មិនឆ្លើយតប = Message - សាកសួរ/បានស្នើរ (auto-calculate)
                next.noResponse = Math.max(0, totalM - req);
            }

            if (field === 'requested' || field === 'success' || field === 'review') {
                const req = field === 'requested' ? numVal : (Number(prev.requested) || 0);
                const succ = field === 'success' ? numVal : (Number(prev.success) || 0);
                const rev = field === 'review' ? numVal : (Number(prev.review) || 0);
                // បរាជ័យ = បានស្នើរ - ជោគជ័យ - Review (auto-calculate)
                next.failed = Math.max(0, req - succ - rev);
            }

            return next;
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.date) {
            alert('Please select a date (សូមជ្រើសរើសកាលបរិច្ឆេទ)');
            return;
        }
        if (formData.message === '' || formData.message === null || formData.message === undefined || isNaN(Number(formData.message))) {
            alert('Please enter the number of messages sent (សូមបញ្ចូលចំនួន Message សាកសួរ)');
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
                alert(errData.message || 'Error saving follow-up record');
            }
        } catch (err) {
            console.error('Save follow up error:', err);
            alert('Network error while saving follow-up');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`Are you sure you want to delete this follow up entry for date: ${item.date?.split('T')[0]}?`)) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/follow-up/${item._id}?username=${encodeURIComponent(user?.username || '')}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData(page);
            } else {
                alert('Failed to delete record');
            }
        } catch (err) {
            console.error('Delete follow up error:', err);
        }
    };

    // Open Export Props Modal
    const handleOpenExportModal = (format = 'excel') => {
        setExportFormat(format);
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
            return { start: todayStr, end: todayStr, label: 'Today (ថ្ងៃនេះ)' };
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
                label: 'This Week (សប្តាហ៍នេះ)'
            };
        } else if (scope === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: firstDay.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0],
                label: 'This Month (ខែនេះ)'
            };
        } else if (scope === 'custom') {
            return {
                start: exportStartDate || todayStr,
                end: exportEndDate || todayStr,
                label: `Custom: ${exportStartDate || todayStr} to ${exportEndDate || todayStr}`
            };
        }
        return { start: '', end: '', label: 'All Time (ទាំងអស់)' };
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
                alert('No follow up data found in the selected date range to export.');
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
                { header: 'Date (កាលបរិច្ឆេទ)', accessor: (row) => row.isTotalRow ? 'TOTAL / សរុប' : (row.date ? row.date.split('T')[0] : '') },
                { header: 'Message (សាកសួរ)', accessor: (row) => row.isTotalRow ? `Total Records: ${items.length}` : (row.message || '') },
                { header: 'Message សរុប', accessor: (row) => String(row.totalMessages !== undefined ? row.totalMessages : 0) },
                { header: 'មិនឆ្លើយតប', accessor: (row) => String(row.noResponse !== undefined ? row.noResponse : 0) },
                { header: 'Requested (បានស្នើរ)', accessor: (row) => String(row.requested !== undefined ? row.requested : 0) },
                { header: 'Review (ពិនិត្យ)', accessor: (row) => String(row.review !== undefined ? row.review : 0) },
                { header: 'Failed (បរាជ័យ)', accessor: (row) => String(row.failed !== undefined ? row.failed : 0) },
                { header: 'Success (ជោគជ័យ)', accessor: (row) => String(row.success !== undefined ? row.success : 0) },
                { header: 'Success Rate (%)', accessor: (row) => `${row.successRate || 0}%` },
                { header: 'Reason (មូលហេតុ)', accessor: (row) => row.reason || '' },
                { header: 'Brand', accessor: (row) => row.brand || '' },
                { header: 'Created By', accessor: (row) => row.createdBy || '' }
            ];

            // Summary Sheet Columns & Rows for Sheet 2
            const summarySheetColumns = [
                { header: '#', accessor: 'no' },
                { header: 'សូចនាករ (KPI Metric)', accessor: 'metric' },
                { header: 'ចំនួនសរុប (Total Count)', accessor: 'count' },
                { header: 'ភាគរយ / អត្រា (%)', accessor: 'rate' },
                { header: 'ការពិពណ៌នា (Description)', accessor: 'desc' }
            ];

            const summarySheetRows = [
                { no: '1', metric: 'កំណត់ត្រាសរុប (Total Entries)', count: String(items.length), rate: '100%', desc: 'ចំនួនជួរទិន្នន័យដែលបាន Export ទាំងអស់' },
                { no: '2', metric: 'Message សាកសួរ សរុប (Total Messages)', count: String(totalMsg), rate: '100%', desc: 'ចំនួនសារឆាតសាកសួរទៅកាន់អតិថិជនសរុប' },
                { no: '3', metric: 'មិនឆ្លើយតប (No Response)', count: String(totalNoResp), rate: `${totalMsg > 0 ? ((totalNoResp / totalMsg) * 100).toFixed(1) : 0}%`, desc: 'អតិថិជនមិនបានឆ្លើយតបសារ' },
                { no: '4', metric: 'បានស្នើរ (Requested Loans)', count: String(totalReq), rate: `${totalMsg > 0 ? ((totalReq / totalMsg) * 100).toFixed(1) : 0}%`, desc: 'អតិថិជនបានឆ្លើយតប និងស្នើសុំបញ្ចាំ' },
                { no: '5', metric: 'កំពុងពិនិត្យ (In Review)', count: String(totalRev), rate: `${totalReq > 0 ? ((totalRev / totalReq) * 100).toFixed(1) : 0}%`, desc: 'អតិថិជនស្ថិតក្នុងដំណាក់កាលពិនិត្យឯកសារ/វាយតម្លៃ' },
                { no: '6', metric: 'បរាជ័យ (Failed)', count: String(totalFail), rate: `${totalReq > 0 ? ((totalFail / totalReq) * 100).toFixed(1) : 0}%`, desc: 'អតិថិជនមិនត្រូវតាមលក្ខខណ្ឌ ឬបដិសេធ' },
                { no: '7', metric: 'ជោគជ័យ (Success)', count: String(totalSucc), rate: `${overallRate}%`, desc: 'អតិថិជនជោគជ័យក្នុងការស្នើបញ្ចាំ (Success Rate)', isTotalRow: true }
            ];

            // Append Total Summary Row at the bottom of Sheet 1
            const dataWithSummaryRow = [
                ...items,
                {
                    isTotalRow: true,
                    isGrandTotal: true,
                    date: 'TOTAL / សរុប',
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
                exportFollowUp1PDF(title, exportColumns, dataWithSummaryRow, exportSummaryObj, range.label, user?.brand || 'SYSTEM');
            }

            // Record System Audit Log for Export Activity
            fetch(`${API_BASE}/audit-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: 'Contract',
                    level: 'Information',
                    action: 'FOLLOW_UP_1_EXPORT',
                    taskCategory: 'Follow Up 1',
                    description: `Exported Follow-Up 1 report (${exportFormat.toUpperCase()}) for range: ${range.label || 'All'} (${items.length} records)`,
                    username: user?.username || 'Staff',
                    name: user?.name || '',
                    role: user?.role || 'Staff',
                    brand: user?.brand || '',
                    path: '/follow-up/follow-up-1',
                    payload: { format: exportFormat, scope: exportScope, count: items.length, range }
                })
            }).catch(() => { });

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
            {/* Header / Title Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--app-card,#ffffff)] p-5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                        <MdOutlineAssignment size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>Follow up 1</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">
                                {t('followUp1') || 'Follow up 1'}
                            </span>
                        </h1>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <button
                        onClick={() => fetchData(page)}
                        disabled={reloading}
                        className="px-3 py-2 bg-[var(--app-card,#ffffff)] hover:bg-[var(--app-border,#f1f5f9)] text-[var(--app-text,#334155)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                        <MdOutlineSync size={16} className={reloading ? "animate-spin text-emerald-600" : ""} />
                        <span>{t('reload') || 'Reload'}</span>
                    </button>

                    {hasPermission('/follow-up/follow-up-1', 'export') && (
                        <>
                            <button
                                onClick={() => handleOpenExportModal('excel')}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
                            >
                                <FaFileExcel size={15} />
                                <span>{t('exportExcel') || 'Export Excel'}</span>
                            </button>

                            <button
                                onClick={() => handleOpenExportModal('pdf')}
                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
                            >
                                <MdPictureAsPdf size={16} />
                                <span>{t('exportPDF') || 'Export PDF'}</span>
                            </button>
                        </>
                    )}

                    {hasPermission('/follow-up/follow-up-1', 'create') && (
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95 ml-auto md:ml-0"
                        >
                            <FaPlusCircle size={15} />
                            <span>{t('create') || 'Create Entry'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Total Records */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>កំណត់ត្រាសរុប</span>
                        <FaListUl className="text-slate-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-[var(--app-text,#0f172a)]">
                        {summary.totalRecords.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">Total Entries</span>
                </div>

                {/* Total Messages */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalMessages') || 'Message សរុប'}</span>
                        <FaComments className="text-blue-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-blue-600 dark:text-blue-400">
                        {(summary.totalMessages || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-blue-600/80 mt-1 font-medium">Total Messages</span>
                </div>

                {/* No Response */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('noResponse') || 'មិនឆ្លើយតប'}</span>
                        <FaCommentSlash className="text-slate-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-600 dark:text-slate-400">
                        {(summary.totalNoResponse || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">No Response</span>
                </div>

                {/* Total Requested */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalRequested') || 'សរុបបានស្នើរ'}</span>
                        <FaQuestionCircle className="text-amber-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                        {summary.totalRequested.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-amber-600/80 mt-1 font-medium">Total Requested</span>
                </div>

                {/* Review */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>កំពុងពិនិត្យ</span>
                        <MdOutlineRateReview className="text-indigo-500" size={15} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {(summary.totalReview || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-indigo-600/80 mt-1 font-medium">In Review</span>
                </div>

                {/* Total Failed */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalFailed') || 'សរុបបរាជ័យ'}</span>
                        <FaTimesCircle className="text-rose-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
                        {summary.totalFailed.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-rose-600/80 mt-1 font-medium">Total Failed</span>
                </div>

                {/* Total Success & Rate */}
                <div className="bg-[var(--app-card,#ffffff)] p-3.5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalSuccess') || 'សរុបជោគជ័យ'}</span>
                        <FaCheckCircle className="text-emerald-500" size={13} />
                    </div>
                    <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
                        <span>{summary.totalSuccess.toLocaleString()}</span>
                        <span className="text-[10px] font-semibold text-sky-600">({summary.successRate}%)</span>
                    </div>
                    <span className="text-[10px] text-emerald-600/80 mt-1 font-medium">Success Rate</span>
                </div>
            </div>

            {/* Filter Controls */}
            <form onSubmit={handleSearchSubmit} className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                        type="text"
                        placeholder="ស្វែងរកតាម Message, មូលហេតុ, Brand ឬ Created By..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                </div>

                {/* Specific Date Filter */}
                <div className="flex items-center gap-1.5 min-w-[150px]">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">កាលបរិច្ឆេទ:</span>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => { setFilterDate(e.target.value); setStartDate(''); setEndDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                </div>

                {/* Date Range Filters */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">ពី:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setFilterDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">ដល់:</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setFilterDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                </div>

                {/* Brand Filter (if Master Admin) */}
                {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                    <div className="flex items-center gap-1.5 min-w-[130px]">
                        <FaBuilding className="text-slate-400" size={13} />
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="">{t('allBranches') || 'All Brands'}</option>
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
                        <span>{t('filterAuditLogs') || 'Filter'}</span>
                    </button>
                    {(searchTerm || filterDate || startDate || endDate || selectedBrand) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                            សម្អាត
                        </button>
                    )}
                </div>
            </form>

            {/* Main Data Table */}
            <div className="bg-[var(--app-card,#ffffff)] rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-[var(--app-border,#e2e8f0)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--app-text,#0f172a)]">បញ្ជីកំណត់ត្រា Follow up 1</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            {total.toLocaleString()} Records
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleOpenExportModal('excel')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Export Excel (2 Sheets)"
                        >
                            <FaFileExcel size={13} />
                            <span>Export Excel</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOpenExportModal('pdf')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Export PDF (Multi-Page)"
                        >
                            <MdPictureAsPdf size={14} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--app-bg,#f8fafc)] border-b border-[var(--app-border,#e2e8f0)] text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted,#64748b)]">
                                <th className="py-3 px-3 w-10 text-center">#</th>
                                <th className="py-3 px-3 min-w-[95px]">កាលបរិច្ឆេទ</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">Message សរុប</th>
                                <th className="py-3 px-4 min-w-[120px]">Message សាកសួរ</th>
                                <th className="py-3 px-2.5 text-center min-w-[65px]">Brand</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">មិនឆ្លើយតប</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">បានស្នើរ</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">Review</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">បរាជ័យ</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">ជោគជ័យ</th>
                                <th className="py-3 px-2.5 text-center min-w-[75px]">អត្រា %</th>
                                <th className="py-3 px-4 min-w-[150px]">មូលហេតុ</th>
                                <th className="py-3 px-3 text-center min-w-[85px]">សកម្មភាព</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--app-border,#e2e8f0)] text-xs font-medium text-[var(--app-text,#0f172a)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <MdOutlineSync size={24} className="animate-spin text-emerald-600" />
                                            <span>កំពុងទាញយកទិន្នន័យ Follow up...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : dataList.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400 font-normal">
                                        មិនមានទិន្នន័យ Follow up នៅឡើយទេ! សូមចុចប៊ូតុង "Create Entry" ដើម្បីបញ្ចូលទិន្នន័យថ្មី។
                                    </td>
                                </tr>
                            ) : (
                                dataList.map((item, index) => {
                                        const totalMsg = Number(item.totalMessages) || 0;
                                        const noResp = Number(item.noResponse) || 0;
                                        const req = Number(item.requested) || 0;
                                        const rev = Number(item.review) || 0;
                                        const fail = Number(item.failed) || 0;
                                        const succ = Number(item.success) || 0;
                                        const rate = req > 0 ? ((succ / req) * 100).toFixed(1) : '0.0';

                                        return (
                                            <tr key={item._id || index} className="hover:bg-slate-500/5 transition-colors">
                                                <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                    {(page - 1) * LIMIT + index + 1}
                                                </td>
                                                <td className="py-3 px-3 font-semibold whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                        <FaRegCalendarAlt className="text-emerald-500 text-[11px]" />
                                                        {item.date ? item.date.split('T')[0] : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                                        {totalMsg.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-bold text-center font-mono text-[var(--app-text,#0f172a)]">
                                                    {item.message || '0'}
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        {item.brand || 'MDM'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold">
                                                        {noResp.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                                        {req.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                                                        {rev.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                                                        {fail.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                                        {succ.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2.5 text-center font-bold text-sky-600">
                                                    {rate}%
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                    <p className="line-clamp-2" title={item.reason}>
                                                        {item.reason || '-'}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {hasPermission('/follow-up/follow-up-1', 'edit') && (
                                                            <button
                                                                onClick={() => handleOpenEdit(item)}
                                                                className="p-1.5 text-amber-600 hover:bg-amber-500/15 rounded-md transition-all cursor-pointer"
                                                                title="កែប្រែ"
                                                            >
                                                                <FaEdit size={14} />
                                                            </button>
                                                        )}
                                                        {hasPermission('/follow-up/follow-up-1', 'delete') && (
                                                            <button
                                                                onClick={() => handleDelete(item)}
                                                                className="p-1.5 text-rose-600 hover:bg-rose-500/15 rounded-md transition-all cursor-pointer"
                                                                title="លុប"
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
                        {dataList.length > 0 && (
                            <tfoot>
                                <tr className="bg-emerald-500/10 dark:bg-emerald-950/40 border-t-2 border-emerald-500/30 text-xs font-bold text-[var(--app-text,#0f172a)]">
                                    <td colSpan="2" className="py-3.5 px-4 text-left font-bold text-emerald-800 dark:text-emerald-300">
                                        <span className="uppercase tracking-wider">សរុបទាំងអស់:</span>
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
                <div className="p-4 border-t border-[var(--app-border,#e2e8f0)] flex items-center justify-between">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)]">
                        បង្ហាញទំព័រ {page} នៃ {Math.ceil(total / LIMIT) || 1} (សរុប {total} កំណត់ត្រា)
                    </span>
                    <Pagination
                        currentPage={page}
                        totalItems={total}
                        limit={LIMIT}
                        onPageChange={(p) => setPage(p)}
                    />
                </div>
            </div>

            {/* Create / Edit Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-lg rounded-2xl border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <MdOutlineAssignment className="text-emerald-600" size={20} />
                                <span>{editingItem ? 'កែប្រែទិន្នន័យ Follow up 1' : 'បញ្ចូលទិន្នន័យ Follow up 1 ថ្មី'}</span>
                            </h2>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            {/* Date Field */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    កាលបរិច្ឆេទ (Date) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                            </div>

                            {/* Inquiry Message (Number of messages sent) */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    Message សាកសួរ (ចំនួនដែលបានស្នើ) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder="បញ្ចូលចំនួន Message ដែលបានសាកសួរ..."
                                    value={formData.message}
                                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-bold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono"
                                />
                            </div>

                            {/* Message សរុប - directly below Message សាកសួរ */}
                            <div>
                                <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                                    Message សរុប
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.totalMessages}
                                    onChange={(e) => handleNumericChange('totalMessages', e.target.value)}
                                    className="w-full px-3 py-2 bg-blue-500/5 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>

                            {/* Row 1: បានស្នើរ, មិនឆ្លើយតប */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                                        បានស្នើរ
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
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1 flex items-center justify-between">
                                        <span>មិនឆ្លើយតប</span>
                                        <span className="text-[10px] font-normal text-slate-400">(Auto)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.noResponse}
                                        onChange={(e) => setFormData(prev => ({ ...prev, noResponse: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                                        className="w-full px-3 py-2 bg-slate-500/5 border border-slate-500/30 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
                                        title="Message សរុប - បានស្នើរ (អាចកែបាន)"
                                    />
                                </div>
                            </div>

                            {/* Row 2: កំពុងពិនិត្យ (Review) */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-cyan-700 dark:text-cyan-400 mb-1">
                                        កំពុងពិនិត្យ (Review)
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
                                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                        ជោគជ័យ
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
                                        <span>បរាជ័យ</span>
                                        <span className="text-[10px] font-normal text-rose-400">(Auto)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.failed}
                                        onChange={(e) => setFormData(prev => ({ ...prev, failed: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                                        className="w-full px-3 py-2 bg-rose-500/5 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                        title="បានស្នើរ - ជោគជ័យ - Review (អាចកែបាន)"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    មូលហេតុ (Reason / Feedback)
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="បញ្ចូលមូលហេតុបរាជ័យ ឬកំណត់ហេតុផ្សេងៗ..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                            </div>

                            {/* Brand Selection (if Admin) */}
                            {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        Brand
                                    </label>
                                    <select
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
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
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {submitting && <MdOutlineSync className="animate-spin" size={14} />}
                                    <span>{t('submit') || 'Save'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Range Props Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-md rounded-2xl border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <FaFileDownload className="text-emerald-600" size={18} />
                                <span>{t('exportScope') || 'ជ្រើសរើសចន្លោះកាលបរិច្ឆេទ Export'}</span>
                            </h2>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-5">
                            {/* Format Selector */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    ទម្រង់ File (Export Format)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('excel')}
                                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'excel'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-emerald-500/10'
                                            }`}
                                    >
                                        <FaFileExcel size={18} />
                                        <span>Excel (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('pdf')}
                                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'pdf'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-rose-500/10'
                                            }`}
                                    >
                                        <MdPictureAsPdf size={19} />
                                        <span>PDF Report</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scope Radio / Buttons */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    ចន្លោះពេលចង់ Export (Time Range Scope)
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
                                        📅 {t('byDay') || 'ជាថ្ងៃ (ថ្ងៃនេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('week')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'week'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        🗓️ {t('byWeek') || 'ជាអាទិត្យ (សប្តាហ៍នេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('month')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'month'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        📆 {t('byMonth') || 'ជាខែ (ខែនេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('custom')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'custom'
                                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        ⚙️ {t('customRange') || 'Custom Range'}
                                    </button>
                                </div>
                            </div>

                            {/* Custom Date Range Picker */}
                            {exportScope === 'custom' && (
                                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3 animate-in fade-in duration-200">
                                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        ជ្រើសរើសពីថ្ងៃណា ដល់ថ្ងៃណា:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">ពីថ្ងៃ (From):</span>
                                            <input
                                                type="date"
                                                value={exportStartDate}
                                                onChange={(e) => setExportStartDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-[var(--app-card,#ffffff)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">ដល់ថ្ងៃ (To):</span>
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
                            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                                    <FaCheckCircle size={13} />
                                    <span>របាយការណ៍រួមបញ្ចូលសរុប (Total Row Included)</span>
                                </p>
                                <p className="text-[11px] leading-relaxed">
                                    នៅពេល Export ប្រព័ន្ធនឹងគណនាសរុប (Total Messages, No Response, Requested, Failed, Success, Success Rate) នៅពីខាងក្រោមតារាងដោយស្វ័យប្រវត្តិ។
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
                                {t('cancel') || 'Cancel'}
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
                                        <span>កំពុង Export...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaFileDownload size={14} />
                                        <span>ទាញយករបាយការណ៍ ({exportFormat.toUpperCase()})</span>
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
