import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaFileExcel, FaFileDownload, FaFilter, FaTimes,
    FaComments, FaDollarSign, FaListUl, FaCheckCircle,
    FaTimesCircle, FaClock, FaTags, FaLayerGroup, FaCalendarAlt
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdOutlineRateReview, MdOutlineBarChart, MdTableChart } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';

const FollowUpReport = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    const [fu2List, setFu2List] = useState([]);
    const [fu3List, setFu3List] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    // Filters
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);
    const [filterDate, setFilterDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [datePreset, setDatePreset] = useState('thisMonth'); // 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'all' | 'custom'

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'
    const [exportScope, setExportScope] = useState('month'); // 'today' | 'week' | 'month' | 'all' | 'custom'
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Permission check helper
    const checkPermission = (action) => {
        return (
            hasPermission('/report/follow-up', action) ||
            hasPermission('/follow-up/report', action) ||
            hasPermission('/follow-up/follow-up-2', action) ||
            hasPermission('/follow-up/follow-up-3', action) ||
            hasPermission('/report/all', action)
        );
    };

    // Fetch Brands list
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

    // Apply preset date ranges
    const applyDatePreset = useCallback((preset) => {
        setDatePreset(preset);
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (preset === 'today') {
            setFilterDate(todayStr);
            setStartDate('');
            setEndDate('');
        } else if (preset === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(now.getDate() - 1);
            const yestStr = yest.toISOString().split('T')[0];
            setFilterDate(yestStr);
            setStartDate('');
            setEndDate('');
        } else if (preset === 'thisWeek') {
            setFilterDate('');
            const day = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            setStartDate(startOfWeek.toISOString().split('T')[0]);
            setEndDate(todayStr);
        } else if (preset === 'thisMonth') {
            setFilterDate('');
            setStartDate(`${y}-${m}-01`);
            setEndDate(todayStr);
        } else if (preset === 'all') {
            setFilterDate('');
            setStartDate('');
            setEndDate('');
        }
    }, []);

    // Set default preset on initial mount (This Month)
    useEffect(() => {
        applyDatePreset('thisMonth');
    }, [applyDatePreset]);

    // Fetch Data from both FollowUp 2 & FollowUp 3 (Sen Sok)
    const fetchReportData = useCallback(async (isManualReload = false) => {
        if (isManualReload) setReloading(true);
        else setLoading(true);

        try {
            const baseParams = {
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                fetchAll: 'true',
                limit: 10000
            };

            if (selectedBrand) baseParams.brand = selectedBrand;
            if (filterDate) baseParams.date = filterDate;
            if (startDate) baseParams.startDate = startDate;
            if (endDate) baseParams.endDate = endDate;

            const fu2Params = new URLSearchParams(baseParams);
            const fu3Params = new URLSearchParams(baseParams);

            const [fu2Res, fu3Res] = await Promise.all([
                fetch(`${API_BASE}/follow-up-2?${fu2Params.toString()}`).catch(err => {
                    console.warn('FU2 fetch error:', err);
                    return null;
                }),
                fetch(`${API_BASE}/follow-up-3?${fu3Params.toString()}`).catch(() => {
                    return fetch(`${API_BASE}/follow-up-sen-sok?${fu3Params.toString()}`);
                }).catch(err => {
                    console.warn('FU3 fetch error:', err);
                    return null;
                })
            ]);

            let loadedFu2 = [];
            if (fu2Res && fu2Res.ok) {
                const fu2Data = await fu2Res.json();
                loadedFu2 = fu2Data.data || [];
            }

            let loadedFu3 = [];
            if (fu3Res && fu3Res.ok) {
                const fu3Data = await fu3Res.json();
                loadedFu3 = fu3Data.data || [];
            }

            setFu2List(loadedFu2);
            setFu3List(loadedFu3);
        } catch (err) {
            console.error('Fetch follow up report error:', err);
        } finally {
            setLoading(false);
            setReloading(false);
        }
    }, [API_BASE, user, selectedBrand, filterDate, startDate, endDate]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // Dynamic unique Descriptions extracted from Follow Up 3 dataset
    const uniqueFu3Descriptions = useMemo(() => {
        const descSet = new Set();
        fu3List.forEach(item => {
            const desc = (item.description || item.notes || '').trim();
            if (desc) {
                descSet.add(desc);
            }
        });
        return Array.from(descSet).sort();
    }, [fu3List]);

    // Filter datasets by search term if provided
    const filteredFu2 = useMemo(() => {
        if (!searchTerm.trim()) return fu2List;
        const term = searchTerm.toLowerCase();
        return fu2List.filter(item =>
            (item.customerName && item.customerName.toLowerCase().includes(term)) ||
            (item.phone && item.phone.toLowerCase().includes(term)) ||
            (item.date && item.date.toLowerCase().includes(term)) ||
            (item.collateralType && item.collateralType.toLowerCase().includes(term)) ||
            (item.model && item.model.toLowerCase().includes(term)) ||
            (item.responder && item.responder.toLowerCase().includes(term)) ||
            (item.status && item.status.toLowerCase().includes(term))
        );
    }, [fu2List, searchTerm]);

    const filteredFu3 = useMemo(() => {
        if (!searchTerm.trim()) return fu3List;
        const term = searchTerm.toLowerCase();
        return fu3List.filter(item =>
            (item.customerName && item.customerName.toLowerCase().includes(term)) ||
            (item.phone && item.phone.toLowerCase().includes(term)) ||
            (item.date && item.date.toLowerCase().includes(term)) ||
            (item.location && item.location.toLowerCase().includes(term)) ||
            (item.description && item.description.toLowerCase().includes(term)) ||
            (item.notes && item.notes.toLowerCase().includes(term)) ||
            (item.responder && item.responder.toLowerCase().includes(term)) ||
            (item.username && item.username.toLowerCase().includes(term))
        );
    }, [fu3List, searchTerm]);

    // Aggregate by Date for the report table
    const dailyReportData = useMemo(() => {
        const dateMap = new Map();

        // 1. Group Follow Up 2 by date
        filteredFu2.forEach(item => {
            const d = item.date ? item.date.split('T')[0] : 'N/A';
            if (!dateMap.has(d)) {
                dateMap.set(d, {
                    date: d,
                    fu2: {
                        total: 0,
                        success: 0,
                        failed: 0,
                        review: 0,
                        amount: 0
                    },
                    fu3: {
                        total: 0,
                        amount: 0,
                        descCounts: {}
                    }
                });
            }
            const record = dateMap.get(d);
            record.fu2.total += 1;
            record.fu2.amount += Number(item.requestedAmount) || 0;

            const st = (item.status || '').trim();
            if (st === 'ជោគជ័យ' || st === 'Success' || st === 'ជោគជ័យ ') {
                record.fu2.success += 1;
            } else if (st === 'បរាជ័យ' || st === 'Failed' || st === 'បរាជ័យ ') {
                record.fu2.failed += 1;
            } else if (
                st === 'Review' || st === 'review' ||
                st === 'ពិនិត្យ' || st === 'កំពុងពិនិត្យ' || st === 'រង់ចាំពិនិត្យ'
            ) {
                record.fu2.review += 1;
            }
        });

        // 2. Group Follow Up 3 by date
        filteredFu3.forEach(item => {
            const d = item.date ? item.date.split('T')[0] : 'N/A';
            if (!dateMap.has(d)) {
                dateMap.set(d, {
                    date: d,
                    fu2: {
                        total: 0,
                        success: 0,
                        failed: 0,
                        review: 0,
                        amount: 0
                    },
                    fu3: {
                        total: 0,
                        amount: 0,
                        descCounts: {}
                    }
                });
            }
            const record = dateMap.get(d);
            record.fu3.total += 1;
            record.fu3.amount += Number(item.requestedAmount) || 0;

            const desc = (item.description || item.notes || '').trim() || '(គ្មានបរិយាយ)';
            record.fu3.descCounts[desc] = (record.fu3.descCounts[desc] || 0) + 1;
        });

        // Sort rows by date descending
        const rows = Array.from(dateMap.values()).sort((a, b) => {
            if (a.date === 'N/A') return 1;
            if (b.date === 'N/A') return -1;
            return b.date.localeCompare(a.date);
        });

        return rows;
    }, [filteredFu2, filteredFu3]);

    // Grand Totals Summary across all aggregated rows
    const grandSummary = useMemo(() => {
        let fu2TotalCount = 0;
        let fu2SuccessCount = 0;
        let fu2FailedCount = 0;
        let fu2ReviewCount = 0;
        let fu2TotalAmount = 0;

        let fu3TotalCount = 0;
        let fu3TotalAmount = 0;
        const fu3DescTotals = {};

        dailyReportData.forEach(row => {
            fu2TotalCount += row.fu2.total;
            fu2SuccessCount += row.fu2.success;
            fu2FailedCount += row.fu2.failed;
            fu2ReviewCount += row.fu2.review;
            fu2TotalAmount += row.fu2.amount;

            fu3TotalCount += row.fu3.total;
            fu3TotalAmount += row.fu3.amount;

            Object.entries(row.fu3.descCounts).forEach(([desc, count]) => {
                fu3DescTotals[desc] = (fu3DescTotals[desc] || 0) + count;
            });
        });

        const fu2SuccessRate = fu2TotalCount > 0 ? ((fu2SuccessCount / fu2TotalCount) * 100).toFixed(1) : '0.0';
        const combinedLeads = fu2TotalCount + fu3TotalCount;
        const combinedAmount = fu2TotalAmount + fu3TotalAmount;

        return {
            fu2TotalCount,
            fu2SuccessCount,
            fu2FailedCount,
            fu2ReviewCount,
            fu2TotalAmount,
            fu2SuccessRate,
            fu3TotalCount,
            fu3TotalAmount,
            fu3DescTotals,
            combinedLeads,
            combinedAmount
        };
    }, [dailyReportData]);

    // Export Functionality (Excel & PDF)
    const handleExecuteExport = () => {
        setIsExporting(true);
        try {
            if (dailyReportData.length === 0) {
                alert('គ្មានទិន្នន័យសម្រាប់ Export ទេ (No data found to export)');
                setIsExporting(false);
                return;
            }

            // Construct table columns definition
            const columns = [
                { header: '#', accessor: (r, idx) => (r.isGrandTotal ? '★' : String(idx + 1)) },
                { header: 'កាលបរិច្ឆេទ (Date)', accessor: (r) => r.date },
                // Follow Up 2 Section
                { header: 'FU2 សរុប', accessor: (r) => Number(r.fu2?.total || 0).toLocaleString() },
                { header: 'FU2 ជោគជ័យ', accessor: (r) => Number(r.fu2?.success || 0).toLocaleString() },
                { header: 'FU2 បរាជ័យ', accessor: (r) => Number(r.fu2?.failed || 0).toLocaleString() },
                { header: 'FU2 Review', accessor: (r) => Number(r.fu2?.review || 0).toLocaleString() },
                { header: 'FU2 ស្នើបញ្ចាំ ($)', accessor: (r) => `$${Number(r.fu2?.amount || 0).toLocaleString()}` },
                // Follow Up 3 Descriptions Dynamic
                ...uniqueFu3Descriptions.map(desc => ({
                    header: `FU3: ${desc}`,
                    accessor: (r) => Number(r.fu3?.descCounts?.[desc] || (r.isGrandTotal ? r.fu3DescTotals?.[desc] || 0 : 0)).toLocaleString()
                })),
                { header: 'FU3 សរុប Leads', accessor: (r) => Number(r.fu3?.total || 0).toLocaleString() },
                { header: 'FU3 ស្នើបញ្ចាំ ($)', accessor: (r) => `$${Number(r.fu3?.amount || 0).toLocaleString()}` },
                // Combined Totals
                { header: 'សរុប Leads រួម', accessor: (r) => Number((r.fu2?.total || 0) + (r.fu3?.total || 0)).toLocaleString() },
                { header: 'សរុបទឹកប្រាក់រួម ($)', accessor: (r) => `$${Number((r.fu2?.amount || 0) + (r.fu3?.amount || 0)).toLocaleString()}` }
            ];

            // Grand Total row
            const grandTotalRow = {
                isGrandTotal: true,
                date: 'សរុបរួម (GRAND TOTAL)',
                fu2: {
                    total: grandSummary.fu2TotalCount,
                    success: grandSummary.fu2SuccessCount,
                    failed: grandSummary.fu2FailedCount,
                    review: grandSummary.fu2ReviewCount,
                    amount: grandSummary.fu2TotalAmount
                },
                fu3: {
                    total: grandSummary.fu3TotalCount,
                    amount: grandSummary.fu3TotalAmount,
                    descCounts: grandSummary.fu3DescTotals
                },
                fu3DescTotals: grandSummary.fu3DescTotals
            };

            const dataWithSummary = [...dailyReportData, grandTotalRow];
            const title = `Follow_Up_Report_${new Date().toISOString().split('T')[0]}`;

            if (exportFormat === 'excel') {
                exportToExcel(title, columns, dataWithSummary, selectedBrand || user?.brand || 'SYSTEM');
            } else {
                exportToPDF(title, columns, dataWithSummary, selectedBrand || user?.brand || 'SYSTEM', 'landscape');
            }

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-3 sm:p-6 space-y-6 max-w-[1700px] mx-auto min-h-screen">
            {/* Header Title & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                        <MdOutlineBarChart size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {t('followUpReport') || 'របាយការណ៍ Follow Up'}
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Follow Up 2 & 3 Aggregation
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            របាយការណ៍បូកសរុប និងរាប់ទិន្នន័យតាមកាលបរិច្ឆេទសម្រាប់ Follow Up 2 និង Follow Up 3
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                    {/* Reload Button */}
                    <button
                        onClick={() => fetchReportData(true)}
                        disabled={reloading || loading}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                        title="Reload Data"
                    >
                        <MdOutlineSync className={`text-base ${reloading ? 'animate-spin text-emerald-600' : ''}`} />
                        <span className="hidden sm:inline">{t('reload') || 'ទាញយកឡើងវិញ'}</span>
                    </button>

                    {/* Export Button */}
                    {checkPermission('export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
                        >
                            <FaFileDownload className="text-sm" />
                            <span>{t('export') || 'Export'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Metric Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Combined Total Leads */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                សរុប Leads ទាំង ២ (Combined Leads)
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                                {Number(grandSummary.combinedLeads).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                FU2: {grandSummary.fu2TotalCount} | FU3: {grandSummary.fu3TotalCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaListUl />
                        </div>
                    </div>
                </div>

                {/* Follow Up 2 Summary */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Follow Up 2 (ជោគជ័យ / អត្រា)
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                                {Number(grandSummary.fu2SuccessCount).toLocaleString()}
                                <span className="text-sm font-bold text-slate-500 ml-2">
                                    ({grandSummary.fu2SuccessRate}%)
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                បរាជ័យ: {grandSummary.fu2FailedCount} | Review: {grandSummary.fu2ReviewCount}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaCheckCircle />
                        </div>
                    </div>
                </div>

                {/* Follow Up 3 Summary */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Follow Up 3 (តាមបរិយាយ)
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-teal-600 mt-1">
                                {Number(grandSummary.fu3TotalCount).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px]" title={uniqueFu3Descriptions.join(', ')}>
                                {uniqueFu3Descriptions.length > 0 ? `${uniqueFu3Descriptions.length} បរិយាយខុសៗគ្នា` : 'គ្មានបរិយាយ'}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaTags />
                        </div>
                    </div>
                </div>

                {/* Combined Pawn Request Amount ($) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                ទឹកប្រាក់ស្នើសុំសរុប ($)
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                                ${Number(grandSummary.combinedAmount).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                FU2: ${Number(grandSummary.fu2TotalAmount).toLocaleString()} | FU3: ${Number(grandSummary.fu3TotalAmount).toLocaleString()}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaDollarSign />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Date Presets Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                {/* Date Presets Button Group */}
                <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                        <FaCalendarAlt className="text-slate-400" />
                        ចន្លោះពេល៖
                    </span>
                    {[
                        { key: 'today', label: 'ថ្ងៃនេះ (Today)' },
                        { key: 'yesterday', label: 'ម្សិលមិញ (Yesterday)' },
                        { key: 'thisWeek', label: 'សប្តាហ៍នេះ (This Week)' },
                        { key: 'thisMonth', label: 'ខែនេះ (This Month)' },
                        { key: 'all', label: 'ទាំងអស់ (All Time)' }
                    ].map(p => (
                        <button
                            key={p.key}
                            onClick={() => applyDatePreset(p.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${datePreset === p.key
                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Custom Filters Row */}
                <div className="flex flex-col lg:flex-row items-center gap-3 pt-2 border-t border-slate-100">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="ស្វែងរកតាម កាលបរិច្ឆេទ, ឈ្មោះ, លេខទូរស័ព្ទ, បរិយាយ, ស្ថានភាព..."
                            className="w-full pl-4 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm text-slate-700 bg-slate-50/50 hover:bg-white transition"
                        />
                    </div>

                    {/* Single Date */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => {
                                setFilterDate(e.target.value);
                                setStartDate('');
                                setEndDate('');
                                setDatePreset('custom');
                            }}
                            className="w-full lg:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="Filter by Specific Date"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setFilterDate('');
                                setDatePreset('custom');
                            }}
                            placeholder="ពីថ្ងៃ"
                            className="w-full lg:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="Start Date"
                        />
                        <span className="text-slate-400 text-xs font-bold">ដល់</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setFilterDate('');
                                setDatePreset('custom');
                            }}
                            placeholder="ដល់ថ្ងៃ"
                            className="w-full lg:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="End Date"
                        />
                    </div>

                    {/* Brand Selector for Admin */}
                    {(user?.role === 'Administrator' || user?.role === 'Admin' || user?.isImmutable) && (
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full lg:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                        >
                            <option value="">គ្រប់ Brand ទាំងអស់</option>
                            {brandsList.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    )}

                    {/* Filter Action Buttons */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <button
                            onClick={() => fetchReportData(false)}
                            className="flex-1 lg:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                            <FaFilter className="text-xs" />
                            <span>ស្វែងរក</span>
                        </button>

                        {(searchTerm || filterDate || startDate || endDate || selectedBrand) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedBrand('');
                                    applyDatePreset('thisMonth');
                                }}
                                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs sm:text-sm font-bold transition cursor-pointer"
                                title="Clear Filters"
                            >
                                <FaTimes />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Report Table Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <MdTableChart className="text-emerald-600" />
                            តារាងរបាយការណ៍បូកសរុបប្រចាំថ្ងៃ (Daily Grouped Breakdown)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            រាប់ទិន្នន័យតាមថ្ងៃ ញែកចេញជាផ្នែក Follow Up 2 និង Follow Up 3 (តាមបរិយាយ)
                        </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg">
                        សរុប {dailyReportData.length} ថ្ងៃ
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            {/* Group Level 1 Header */}
                            <tr className="bg-slate-100/90 text-xs font-black text-slate-700 border-b border-slate-200">
                                <th rowSpan={2} className="py-3 px-3 text-center border-r border-slate-200 w-12">#</th>
                                <th rowSpan={2} className="py-3 px-4 border-r border-slate-200 min-w-[130px]">
                                    កាលបរិច្ឆេទ (Date)
                                </th>
                                {/* FU2 Main Group */}
                                <th colSpan={5} className="py-2.5 px-4 text-center bg-indigo-50/80 text-indigo-900 border-r border-indigo-200 font-black">
                                    <span className="flex items-center justify-center gap-1.5">
                                        <FaComments className="text-indigo-600" />
                                        ផ្នែក FOLLOW UP 2 (បញ្ចាំ & ឆ្លើយតបឆាត)
                                    </span>
                                </th>
                                {/* FU3 Main Group */}
                                <th colSpan={uniqueFu3Descriptions.length + 2} className="py-2.5 px-4 text-center bg-teal-50/80 text-teal-900 border-r border-teal-200 font-black">
                                    <span className="flex items-center justify-center gap-1.5">
                                        <FaTags className="text-teal-600" />
                                        ផ្នែក FOLLOW UP 3 (រាប់តាមបរិយាយ)
                                    </span>
                                </th>
                                {/* Combined Daily Total */}
                                <th colSpan={2} className="py-2.5 px-4 text-center bg-emerald-50/80 text-emerald-900 font-black">
                                    <span className="flex items-center justify-center gap-1.5">
                                        <FaLayerGroup className="text-emerald-600" />
                                        សរុបរួមប្រចាំថ្ងៃ
                                    </span>
                                </th>
                            </tr>

                            {/* Sub-Columns Level 2 Header */}
                            <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                                {/* FU2 Sub Columns */}
                                <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-indigo-900">សរុប</th>
                                <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-emerald-700">ជោគជ័យ</th>
                                <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-rose-700">បរាជ័យ</th>
                                <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-amber-700">Review</th>
                                <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-indigo-900 border-r border-indigo-200">ស្នើបញ្ចាំ ($)</th>

                                {/* FU3 Dynamic Descriptions Sub Columns */}
                                {uniqueFu3Descriptions.map((desc, i) => (
                                    <th key={`desc-col-${i}`} className="py-2.5 px-3 text-right bg-teal-50/40 text-teal-900 min-w-[100px]" title={desc}>
                                        {desc}
                                    </th>
                                ))}
                                <th className="py-2.5 px-3 text-right bg-teal-50/50 text-teal-900 font-black">សរុប FU3</th>
                                <th className="py-2.5 px-3 text-right bg-teal-50/50 text-teal-900 font-black border-r border-teal-200">ស្នើបញ្ចាំ ($)</th>

                                {/* Combined Sub Columns */}
                                <th className="py-2.5 px-3 text-right bg-emerald-50/40 text-emerald-900 font-black">សរុប Leads</th>
                                <th className="py-2.5 px-3 text-right bg-emerald-50/40 text-emerald-900 font-black">ទឹកប្រាក់រួម ($)</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={uniqueFu3Descriptions.length + 11} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-semibold text-xs">កំពុងរៀបចំ និងបូកសរុបរបាយការណ៍...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : dailyReportData.length === 0 ? (
                                <tr>
                                    <td colSpan={uniqueFu3Descriptions.length + 11} className="py-12 text-center text-slate-400 font-medium">
                                        មិនមានទិន្នន័យ Follow Up សម្រាប់ចន្លោះកាលបរិច្ឆេទនេះទេ
                                    </td>
                                </tr>
                            ) : (
                                dailyReportData.map((row, index) => {
                                    const combinedDailyLeads = (row.fu2?.total || 0) + (row.fu3?.total || 0);
                                    const combinedDailyAmount = (row.fu2?.amount || 0) + (row.fu3?.amount || 0);

                                    return (
                                        <tr
                                            key={row.date}
                                            className="hover:bg-slate-50/80 transition-colors"
                                        >
                                            {/* Index */}
                                            <td className="py-3 px-3 text-center text-slate-400 font-semibold border-r border-slate-100">
                                                {index + 1}
                                            </td>

                                            {/* Date */}
                                            <td className="py-3 px-4 font-bold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                                                    {row.date}
                                                </span>
                                            </td>

                                            {/* Follow Up 2 Values */}
                                            <td className="py-3 px-3 text-right font-bold text-indigo-900 bg-indigo-50/10">
                                                {row.fu2.total > 0 ? Number(row.fu2.total).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-emerald-600 bg-indigo-50/10">
                                                {row.fu2.success > 0 ? Number(row.fu2.success).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-rose-600 bg-indigo-50/10">
                                                {row.fu2.failed > 0 ? Number(row.fu2.failed).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-amber-600 bg-indigo-50/10">
                                                {row.fu2.review > 0 ? Number(row.fu2.review).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-slate-800 bg-indigo-50/10 border-r border-indigo-100 whitespace-nowrap">
                                                {row.fu2.amount > 0 ? `$${Number(row.fu2.amount).toLocaleString()}` : '—'}
                                            </td>

                                            {/* Follow Up 3 Descriptions Breakdown */}
                                            {uniqueFu3Descriptions.map((desc, i) => {
                                                const cnt = row.fu3.descCounts[desc] || 0;
                                                return (
                                                    <td key={`desc-val-${i}`} className="py-3 px-3 text-right font-semibold text-slate-700 bg-teal-50/10">
                                                        {cnt > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold">
                                                                {cnt}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* FU3 Total & Amount */}
                                            <td className="py-3 px-3 text-right font-black text-teal-900 bg-teal-50/20">
                                                {row.fu3.total > 0 ? Number(row.fu3.total).toLocaleString() : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-slate-800 bg-teal-50/20 border-r border-teal-100 whitespace-nowrap">
                                                {row.fu3.amount > 0 ? `$${Number(row.fu3.amount).toLocaleString()}` : '—'}
                                            </td>

                                            {/* Combined Daily Totals */}
                                            <td className="py-3 px-3 text-right font-black text-emerald-900 bg-emerald-50/20">
                                                {Number(combinedDailyLeads).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-emerald-700 bg-emerald-50/20 whitespace-nowrap">
                                                ${Number(combinedDailyAmount).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Grand Totals Footer */}
                        {dailyReportData.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                    <td className="py-3.5 px-3 text-center text-amber-400">★</td>
                                    <td className="py-3.5 px-4 font-black tracking-wider text-amber-400 whitespace-nowrap">
                                        សរុបរួម (GRAND TOTAL)
                                    </td>

                                    {/* FU2 Grand Totals */}
                                    <td className="py-3.5 px-3 text-right text-indigo-200">
                                        {Number(grandSummary.fu2TotalCount).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-emerald-400">
                                        {Number(grandSummary.fu2SuccessCount).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-rose-400">
                                        {Number(grandSummary.fu2FailedCount).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-amber-400">
                                        {Number(grandSummary.fu2ReviewCount).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-indigo-300 border-r border-slate-700 whitespace-nowrap">
                                        ${Number(grandSummary.fu2TotalAmount).toLocaleString()}
                                    </td>

                                    {/* FU3 Descriptions Grand Totals */}
                                    {uniqueFu3Descriptions.map((desc, i) => (
                                        <td key={`desc-grand-${i}`} className="py-3.5 px-3 text-right text-teal-200">
                                            {Number(grandSummary.fu3DescTotals[desc] || 0).toLocaleString()}
                                        </td>
                                    ))}

                                    {/* FU3 Grand Total & Amount */}
                                    <td className="py-3.5 px-3 text-right text-teal-300 font-black">
                                        {Number(grandSummary.fu3TotalCount).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-teal-300 font-black border-r border-slate-700 whitespace-nowrap">
                                        ${Number(grandSummary.fu3TotalAmount).toLocaleString()}
                                    </td>

                                    {/* Combined Grand Totals */}
                                    <td className="py-3.5 px-3 text-right text-emerald-400 font-black">
                                        {Number(grandSummary.combinedLeads).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-3 text-right text-amber-400 font-black whitespace-nowrap">
                                        ${Number(grandSummary.combinedAmount).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                                    <FaFileDownload />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Export Report Follow Up</h3>
                                    <p className="text-xs text-slate-500">ជ្រើសរើសទម្រង់ និងចន្លោះទិន្នន័យ</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Format Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600">ទម្រង់ឯកសារ (Export Format)</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('excel')}
                                    className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${exportFormat === 'excel'
                                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-sm'
                                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <FaFileExcel className="text-emerald-600 text-base" />
                                    <span>Microsoft Excel (.xls)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('pdf')}
                                    className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition cursor-pointer ${exportFormat === 'pdf'
                                        ? 'border-rose-500 bg-rose-50/60 text-rose-700 shadow-sm'
                                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <MdPictureAsPdf className="text-rose-600 text-lg" />
                                    <span>PDF Document</span>
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                            >
                                បោះបង់ (Cancel)
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteExport}
                                disabled={isExporting}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                            >
                                {isExporting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>កំពុង Export...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaFileDownload />
                                        <span>ទាញយក (Download)</span>
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

export default FollowUpReport;
