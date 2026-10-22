import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaLock, FaMobileAlt, FaUserShield } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import LineChart from '../../../components/LineChart';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';

const LIMIT = 10;

const LockPhoneReport = () => {
    const { t } = useLanguage();
    const { API_BASE2, user } = useAuth();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [pdfOrientation, setPdfOrientation] = useState('portrait');
    const visibleDataList = selectedRecord ? [selectedRecord] : dataList;

    const fetchData = useCallback(async (pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                action: 'Locked',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: pg,
                limit: LIMIT
            });
            if (search) params.set('search', search);

            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setDataList(result.data || []);
                setTotal(result.total || 0);
            }
        } catch (err) {
            console.error('Fetch lock phone report error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, page, searchTerm, user]);

    const fetchFullData = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                action: 'Locked',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setAllLogs(result.data || []);
            }
        } catch (err) {
            console.error('Fetch full lock phone report error:', err);
        }
    }, [API_BASE2, user]);

    useEffect(() => {
        if (selectedRecord) return;
        fetchData(page, searchTerm);
    }, [page, fetchData, searchTerm, selectedRecord]);

    useEffect(() => {
        fetchFullData();
    }, [fetchFullData]);

    const fetchAllForExport = async () => {
        if (allLogs.length > 0) return allLogs;
        try {
            const params = new URLSearchParams({
                action: 'Locked',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`${API_BASE2}/phonelogs?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                return result.data || [];
            }
        } catch (err) {
            console.error('Fetch lock phone report for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: t('no'), cell: (r, idx) => r.isTotalRow ? t('totalLabel') : idx + 1 },
                { header: t('brandDomain'), accessor: 'brand' },
                { header: t('totalLockActions'), accessor: 'totalLockActions' },
                { header: t('uniqueLockedCustomers'), accessor: 'uniqueCustomersCount' }
            ];
            const excelData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToExcel(t('lockPhoneSummaryTable'), summaryColumns, excelData, user?.brand || '');
        }

        const allData = await fetchAllForExport();
        const columns = [
            { header: t('no'), cell: (_, idx) => idx + 1 },
            { header: t('customerName'), accessor: 'customerName' },
            { header: t('model'), accessor: 'model' },
            { header: t('serialNumber'), accessor: 'serialNumber' },
            { header: t('lastLock'), cell: (r) => r.lastLockTime || `${r.date || ''} ${r.time || ''}` },
            { header: t('performedBy'), accessor: 'performedBy' }
        ];
        exportToExcel(t('lockPhoneReportTitle'), columns, allData, user?.brand || '');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: t('no'), cell: (r, idx) => r.isTotalRow ? t('totalLabel') : idx + 1 },
                { header: t('brandDomain'), accessor: 'brand' },
                { header: t('totalLockActions'), accessor: 'totalLockActions' },
                { header: t('uniqueLockedCustomers'), accessor: 'uniqueCustomersCount' }
            ];
            const pdfData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToPDF(t('lockPhoneSummaryTable'), summaryColumns, pdfData, user?.brand || '', pdfOrientation);
        }
        const allData = await fetchAllForExport();
        const columns = [
            { header: t('no'), cell: (_, idx) => idx + 1 },
            { header: t('customerName'), accessor: 'customerName' },
            { header: t('model'), accessor: 'model' },
            { header: t('serialNumber'), accessor: 'serialNumber' },
            { header: t('lastLock'), cell: (r) => r.lastLockTime || `${r.date || ''} ${r.time || ''}` },
            { header: t('performedBy'), accessor: 'performedBy' }
        ];
        exportToPDF(t('lockPhoneReportTitle'), columns, allData, user?.brand || '', pdfOrientation);
    };

    // Calculate Brand Summary Grouping
    const summaryBreakdown = useMemo(() => {
        const sourceLogs = allLogs.length > 0 ? allLogs : dataList;
        const brandMap = {};

        sourceLogs.forEach(l => {
            const b = l.brand || user?.brand || 'SYSTEM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalLockActions: 0,
                    uniqueCustomers: new Set()
                };
            }
            const bObj = brandMap[b];
            bObj.totalLockActions += 1;
            if (l.customerName || l.serialNumber) {
                bObj.uniqueCustomers.add(l.customerName || l.serialNumber);
            }
        });

        const rows = Object.values(brandMap).map(b => ({
            brand: b.brand,
            totalLockActions: b.totalLockActions,
            uniqueCustomersCount: b.uniqueCustomers.size
        }));

        const grandTotal = rows.reduce((acc, r) => ({
            brand: 'SUMMARY TOTAL',
            isTotalRow: true,
            totalLockActions: acc.totalLockActions + r.totalLockActions,
            uniqueCustomersCount: acc.uniqueCustomersCount + r.uniqueCustomersCount
        }), {
            brand: 'SUMMARY TOTAL',
            isTotalRow: true,
            totalLockActions: 0,
            uniqueCustomersCount: 0
        });

        return { rows, grandTotal };
    }, [allLogs, dataList, user]);

    // KPI Cards calculation
    const kpi = useMemo(() => {
        const sourceLogs = allLogs.length > 0 ? allLogs : dataList;
        const totalLockActions = sourceLogs.length;
        const uniqueCustomers = new Set(sourceLogs.map(l => l.customerName || l.serialNumber).filter(Boolean)).size;

        return { totalLockActions, uniqueCustomers };
    }, [allLogs, dataList]);

    // Trend line chart data
    const chartTrendData = useMemo(() => {
        const sourceLogs = allLogs.length > 0 ? allLogs : dataList;
        const map = {};
        sourceLogs.forEach(l => {
            const dateStr = (l.lockedDate || l.actionDate || l.createdAt || l.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, lockCount: 0 };
            map[dateStr].lockCount += 1;
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [allLogs, dataList]);

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('lockPhoneReport')}
                        </h1>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                    {/* PDF Orientation Toggle */}
                    <div className="flex items-center rounded-[5px] border border-slate-300 overflow-hidden shadow-xs">
                        <button onClick={() => setPdfOrientation('portrait')} title={t('portrait')}
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${pdfOrientation === 'portrait' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>📄</span><span className="hidden sm:inline">{t('portrait')}</span>
                        </button>
                        <button onClick={() => setPdfOrientation('landscape')} title={t('landscape')}
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border-l border-slate-300 ${pdfOrientation === 'landscape' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>🖼</span><span className="hidden sm:inline">{t('landscape')}</span>
                        </button>
                    </div>
                    
                </div>
            </header>

            <div className="flex items-center border-b border-slate-200 bg-white rounded-t-[5px] px-3 pt-2 gap-2 shadow-xs">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdPieChart size={16} /><span>1. {t('dashboardAnalytics')}</span>
                </button>
                <button onClick={() => setActiveTab('detail')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'detail' ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdTableChart size={16} /><span>2. {t('detailedInfo')}</span>
                </button>
                <button onClick={() => setActiveTab('summary')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'summary' ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdOutlineBarChart size={16} /><span>3. {t('summaryTable')}</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-xl font-bold">
                                <FaLock />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('totalLockActionsExecuted')}</p>
                                <h3 className="text-2xl font-black text-rose-700 mt-0.5">{kpi.totalLockActions.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl font-bold">
                                <FaUsers />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('uniqueLockedCustomers')}</p>
                                <h3 className="text-2xl font-black text-indigo-700 mt-0.5">{kpi.uniqueCustomers.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart Component */}
                    <LineChart
                        title={t('lockPhoneTrendChart')}
                        subtitle={t('lockPhoneReportTrendDescription')}
                        data={chartTrendData}
                        series={[
                            { key: 'lockCount', label: 'Lock Phone', color: '#f43f5e', isCurrency: false }
                        ]}
                    />

                    <div className="p-5 bg-white rounded-[5px] border border-slate-200 shadow-xs space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MdPieChart className="text-rose-600 text-lg" />
                            <span>{t('lockPhoneByBrand')}</span>
                        </h3>
                        <div className="h-56 w-full bg-slate-50 rounded-[5px] p-2 border border-slate-200 flex items-end justify-around gap-4">
                            {summaryBreakdown.rows.map((r) => {
                                const maxVal = Math.max(...summaryBreakdown.rows.map(x => x.totalLockActions), 1);
                                const pct = Math.min(100, Math.max(15, (r.totalLockActions / maxVal) * 100));
                                return (
                                    <div key={r.brand} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{r.brand} ({r.totalLockActions})</span>
                                        <div style={{ height: `${pct}%` }} className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-[5px] shadow-md transition-all"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Detailed Info */}
            {activeTab === 'detail' && (
                <>
                <div className="rounded-[5px] border border-slate-200 bg-white p-2">
                    <DatabaseSearchInput
                        apiBase={API_BASE2}
                        endpoint="phonelogs"
                        params={{ action: 'Locked', userBrand: user?.brand || '', userRole: user?.role || '', username: user?.username || '', isImmutable: user?.isImmutable ? 'true' : 'false' }}
                        value={searchTerm}
                        placeholder={t('search')}
                        className="w-64"
                        onChange={(value) => { setSelectedRecord(null); setSearchTerm(value); setPage(1); }}
                        onSelect={(record) => {
                            setSelectedRecord(record);
                            setLoading(false);
                            setSearchTerm(record.customerName || record.serialNumber || record._id || '');
                            setDataList([record]);
                            setTotal(1);
                            setPage(1);
                        }}
                        getLabel={(record) => record.customerName || record.serialNumber || record._id}
                        getDescription={(record) => [record.model, record.serialNumber, record.lastLockTime || record.date, record.performedBy].filter(Boolean).join(' · ')}
                    />
                </div>
                <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-1 text-center'>{t('no')}</th>
                                <th className='px-4 py-1'>{t('customerLabel')}</th>
                                <th className='px-4 py-1'>{t('model')}</th>
                                <th className='px-4 py-1'>{t('serialNumber')}</th>
                                <th className='px-4 py-1'>{t('lastLockDateTime')}</th>
                                <th className='px-4 py-1'>{t('performedBy')}</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-rose-600 font-semibold">{t('loading')}</td></tr>
                            ) : visibleDataList.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">{t('noLockPhoneRecords')}</td></tr>
                            ) : (
                                visibleDataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-rose-50/40 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono font-semibold'>{total - ((page - 1) * LIMIT + idx)}</td>
                                        <td className='px-4 py-1 font-bold text-slate-900'><CopyCell text={item.customerName || '-'} className='font-bold text-slate-900' /></td>
                                        <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model || '-'} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber || '-'} className='font-mono text-emerald-700 font-semibold' /></td>
                                        <td className='px-4 py-1 text-slate-600 font-mono'><CopyCell text={item.lastLockTime || `${item.date} ${item.time}`} className='text-slate-600 font-mono' /></td>
                                        <td className='px-4 py-1 font-semibold text-indigo-700'><CopyCell text={item.performedBy || '-'} className='font-semibold text-indigo-700' /></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                </>
            )}

            {/* Tab 3: Summary Table */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 bg-white shadow-md p-2 space-y-4'>
                    <div className="border-b border-slate-200 pb-2">
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-rose-600 text-xl" />
                            <span>{t('summaryTable')}</span>
                        </h3>
                    </div>
                    <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-rose-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-1 text-center'>{t('no')}</th>
                                    <th className='px-3.5 py-1'>{t('brandDomain')}</th>
                                    <th className='px-3.5 py-1 text-center'>{t('totalLockActions')}</th>
                                    <th className='px-3.5 py-1 text-center'>{t('uniqueLockedCustomers')}</th>
                                    <th className='px-3.5 py-1 text-center'>{t('lockStatus')}</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                                {summaryBreakdown.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-rose-50/50 transition-colors">
                                        <td className="px-3.5 py-1 text-center font-mono text-slate-500 font-bold">{summaryBreakdown.rows.length - idx}</td>
                                        <td className="px-3.5 py-1 font-black text-rose-900">
                                            <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-1 text-center font-bold text-rose-700">{row.totalLockActions.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-slate-900">{row.uniqueCustomersCount.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-rose-700">{t('locked')}</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-rose-100/80 border-t-2 border-rose-400 font-black text-rose-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">{t('totalLabel')}</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-rose-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-rose-950 font-black">{summaryBreakdown.grandTotal.totalLockActions.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.uniqueCustomersCount.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-center font-black text-rose-950">{t('locked')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'detail' && !selectedRecord && <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />}
        </div>
    );
};

export default LockPhoneReport;
