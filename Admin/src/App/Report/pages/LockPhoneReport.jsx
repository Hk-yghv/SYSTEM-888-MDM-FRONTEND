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
    const [pdfOrientation, setPdfOrientation] = useState('portrait');

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
        fetchData(page, searchTerm);
        fetchFullData();
    }, [page, fetchData, fetchFullData]);

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
            if (searchTerm) params.set('search', search);
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
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Lock Actions', accessor: 'totalLockActions' },
                { header: 'Unique Locked Customers', accessor: 'uniqueCustomersCount' }
            ];
            const excelData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToExcel('Lock Phone — Summary Table', summaryColumns, excelData, user?.brand || '');
        }

        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Last Lock', cell: (r) => r.lastLockTime || `${r.date || ''} ${r.time || ''}` },
            { header: 'Performed By', accessor: 'performedBy' }
        ];
        exportToExcel('Lock Phone Report', columns, allData, user?.brand || '');
    };

    const handleExportPDF = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Lock Actions', accessor: 'totalLockActions' },
                { header: 'Unique Locked Customers', accessor: 'uniqueCustomersCount' }
            ];
            const pdfData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToPDF('Lock Phone — Summary Table', summaryColumns, pdfData, user?.brand || '', pdfOrientation);
        }
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Last Lock', cell: (r) => r.lastLockTime || `${r.date || ''} ${r.time || ''}` },
            { header: 'Performed By', accessor: 'performedBy' }
        ];
        exportToPDF('Lock Phone Report', columns, allData, user?.brand || '', pdfOrientation);
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
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalLockActions: acc.totalLockActions + r.totalLockActions,
            uniqueCustomersCount: acc.uniqueCustomersCount + r.uniqueCustomersCount
        }), {
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
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
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-4 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
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
                        <button onClick={() => setPdfOrientation('portrait')} title="Portrait (បញ្ឈរ)"
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${pdfOrientation === 'portrait' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>📄</span><span className="hidden sm:inline">Portrait</span>
                        </button>
                        <button onClick={() => setPdfOrientation('landscape')} title="Landscape (ផ្តេក)"
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border-l border-slate-300 ${pdfOrientation === 'landscape' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>🖼</span><span className="hidden sm:inline">Landscape</span>
                        </button>
                    </div>
                    
                    <button onClick={() => { fetchData(page, searchTerm); fetchFullData(); }} disabled={reloading} className='flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-rose-600' : ''} /><span>{t('reload')}</span>
                    </button>
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
                        <div className="p-4 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-xl font-bold">
                                <FaLock />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Lock Actions Executed</p>
                                <h3 className="text-2xl font-black text-rose-700 mt-0.5">{kpi.totalLockActions.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-4 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl font-bold">
                                <FaUsers />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Unique Locked Customers</p>
                                <h3 className="text-2xl font-black text-indigo-700 mt-0.5">{kpi.uniqueCustomers.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart Component */}
                    <LineChart
                        title="ក្រាបខ្សែនិន្នាការចាកសោរថ្ឞទូរសក (Lock Phone Trend Line Chart)"
                        subtitle="បង្ហាញពីការកើនឡើងចំនួនប្រតិបត្តិការចាកសោរថ្ឞទូរសកប្រចាំថ្ងៃ/ខែ"
                        data={chartTrendData}
                        series={[
                            { key: 'lockCount', label: 'Lock Phone (ចំនួន)', color: '#f43f5e', isCurrency: false }
                        ]}
                    />

                    <div className="p-5 bg-white rounded-[5px] border border-slate-200 shadow-xs space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MdPieChart className="text-rose-600 text-lg" />
                            <span>Lock Phone Actions Breakdown by Brand (ក្រាបប្រតិបត្តិការចាកសោរតាម Brand)</span>
                        </h3>
                        <div className="h-56 w-full bg-slate-50 rounded-[5px] p-4 border border-slate-200 flex items-end justify-around gap-4">
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
                <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-1 text-center'>No</th>
                                <th className='px-4 py-1'>Customer</th>
                                <th className='px-4 py-1'>Model</th>
                                <th className='px-4 py-1'>Serial Number</th>
                                <th className='px-4 py-1'>Last Lock Date & Time</th>
                                <th className='px-4 py-1'>Performed By</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-rose-600 font-semibold">Loading...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No lock phone records found.</td></tr>
                            ) : (
                                dataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-rose-50/40 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
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
            )}

            {/* Tab 3: Summary Table */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 bg-white shadow-md p-4 space-y-4'>
                    <div className="border-b border-slate-200 pb-2">
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-rose-600 text-xl" />
                            <span>តារាងសរុបប្រវត្តិចាក់សោរទូរស័ព្ទតាម Brand (Lock Phone Master Summary Table)</span>
                        </h3>
                    </div>
                    <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-rose-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-1 text-center'>No</th>
                                    <th className='px-3.5 py-1'>Brand Domain</th>
                                    <th className='px-3.5 py-1 text-center'>Total Lock Actions</th>
                                    <th className='px-3.5 py-1 text-center'>Unique Locked Customers</th>
                                    <th className='px-3.5 py-1 text-center'>Lock Status</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                                {summaryBreakdown.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-rose-50/50 transition-colors">
                                        <td className="px-3.5 py-1 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                        <td className="px-3.5 py-1 font-black text-rose-900">
                                            <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-1 text-center font-bold text-rose-700">{row.totalLockActions.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-slate-900">{row.uniqueCustomersCount.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-rose-700">Locked</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-rose-100/80 border-t-2 border-rose-400 font-black text-rose-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-rose-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-rose-950 font-black">{summaryBreakdown.grandTotal.totalLockActions.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.uniqueCustomersCount.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-center font-black text-rose-950">Locked</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'detail' && <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />}
        </div>
    );
};

export default LockPhoneReport;
