import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaDollarSign, FaMoneyBillWave, FaLock, FaImage, FaCheckCircle } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import LineChart from '../../../components/LineChart';

const LIMIT = 10;

const ActivatedReport = () => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
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
                status: 'Activated',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: pg,
                limit: LIMIT
            });
            if (search) params.set('search', search);

            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setDataList(result.data || []);
                setTotal(result.total || 0);
            }
        } catch (err) {
            console.error('Fetch activated report error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, page, searchTerm, user]);

    const fetchFullData = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setAllContracts(result.data || []);
            }
        } catch (err) {
            console.error('Fetch full activated report error:', err);
        }
    }, [API_BASE1, user]);

    useEffect(() => {
        fetchData(page, searchTerm);
        fetchFullData();
    }, [page, fetchData, fetchFullData]);

    const fetchAllForExport = async () => {
        if (allContracts.length > 0) return allContracts;
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                return result.data || [];
            }
        } catch (err) {
            console.error('Fetch activated report for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Activated', accessor: 'totalActivated' },
                { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Est. Monthly ($)', cell: (r) => `$${(r.totalMonthly || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
                { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
            ];
            const excelData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToExcel('Activated Contracts — Summary Table', summaryColumns, excelData, user?.brand || '');
        }

        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer (EN)', accessor: 'customerNameEn' },
            { header: 'Customer (KH)', accessor: 'customerNameKh' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Status', cell: () => 'Activated' }
        ];
        exportToExcel('Activated Contracts Report', columns, allData, user?.brand || '');
    };

    const handleExportPDF = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Activated', accessor: 'totalActivated' },
                { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Est. Monthly ($)', cell: (r) => `$${(r.totalMonthly || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
                { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
            ];
            const pdfData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToPDF('Activated Contracts — Summary Table', summaryColumns, pdfData, user?.brand || '', pdfOrientation);
        }
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer (EN)', accessor: 'customerNameEn' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Status', cell: () => 'Activated' }
        ];
        exportToPDF('Activated Contracts Report', columns, allData, user?.brand || '', pdfOrientation);
    };

    // Calculate Brand Summary Grouping
    const summaryBreakdown = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const brandMap = {};

        sourceContracts.forEach(c => {
            const b = c.brand || user?.brand || 'SYSTEM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalActivated: 0,
                    totalLoan: 0,
                    totalMonthly: 0,
                    lockedPhoneCount: 0,
                    lockedWallpaperCount: 0
                };
            }
            const bObj = brandMap[b];
            bObj.totalActivated += 1;
            bObj.totalLoan += Number(c.amount || c.totalAmount || 0);
            bObj.totalMonthly += Number(c.monthlyPayment || 0);
            if (c.lockPhoneStatus === 'Locked') bObj.lockedPhoneCount += 1;
            if (c.lockWallpaperStatus === 'Locked') bObj.lockedWallpaperCount += 1;
        });

        const rows = Object.values(brandMap);

        const grandTotal = rows.reduce((acc, r) => ({
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalActivated: acc.totalActivated + r.totalActivated,
            totalLoan: acc.totalLoan + r.totalLoan,
            totalMonthly: acc.totalMonthly + r.totalMonthly,
            lockedPhoneCount: acc.lockedPhoneCount + r.lockedPhoneCount,
            lockedWallpaperCount: acc.lockedWallpaperCount + r.lockedWallpaperCount
        }), {
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalActivated: 0,
            totalLoan: 0,
            totalMonthly: 0,
            lockedPhoneCount: 0,
            lockedWallpaperCount: 0
        });

        return { rows, grandTotal };
    }, [allContracts, dataList, user]);

    // KPI Cards calculation
    const kpi = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const totalActivated = sourceContracts.length;
        const totalLoan = sourceContracts.reduce((sum, c) => sum + (Number(c.amount || c.totalAmount) || 0), 0);
        const totalMonthly = sourceContracts.reduce((sum, c) => sum + (Number(c.monthlyPayment) || 0), 0);
        const lockedPhone = sourceContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
        const lockedWallpaper = sourceContracts.filter(c => c.lockWallpaperStatus === 'Locked').length;

        return { totalActivated, totalLoan, totalMonthly, lockedPhone, lockedWallpaper };
    }, [allContracts, dataList]);

    // Trend line chart data
    const chartTrendData = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const map = {};
        sourceContracts.forEach(c => {
            const dateStr = (c.inputDate || c.createdAt || c.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, activatedCount: 0, loanAmount: 0, monthlyAmount: 0 };
            map[dateStr].activatedCount += 1;
            map[dateStr].loanAmount += Number(c.amount || c.totalAmount || 0);
            map[dateStr].monthlyAmount += Number(c.monthlyPayment || 0);
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [allContracts, dataList]);

    return (
        <div className='w-full p-4 select-none space-y-4'>
            <header className='p-4 w-full border border-slate-200 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('activatedReport')}
                        </h1>
                        <p className='text-xs text-emerald-700 font-bold'>
                            {t('activatedReport')} ({total})
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>{t('exportExcel')}</span>
                    </button>
                    {/* PDF Orientation Toggle */}
                    <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                        <button onClick={() => setPdfOrientation('portrait')} title="Portrait (បញ្ឈរ)"
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${pdfOrientation === 'portrait' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>📄</span><span className="hidden sm:inline">Portrait</span>
                        </button>
                        <button onClick={() => setPdfOrientation('landscape')} title="Landscape (ផ្តេក)"
                            className={`px-2.5 py-2 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border-l border-slate-300 ${pdfOrientation === 'landscape' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            <span>🖼</span><span className="hidden sm:inline">Landscape</span>
                        </button>
                    </div>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>{activeTab === 'summary' ? 'PDF (Summary)' : t('exportPDF')}</span>
                    </button>
                    <button onClick={() => { fetchData(page, searchTerm); fetchFullData(); }} disabled={reloading} className='flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} /><span>{t('reload')}</span>
                    </button>
                </div>
            </header>

            <div className="flex items-center border-b border-slate-200 bg-white rounded-t-2xl px-3 pt-2 gap-2 shadow-xs">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl' : 'border-transparent text-slate-500'}`}>
                    <MdPieChart size={16} /><span>1. {t('dashboardAnalytics')}</span>
                </button>
                <button onClick={() => setActiveTab('detail')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'detail' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl' : 'border-transparent text-slate-500'}`}>
                    <MdTableChart size={16} /><span>2. {t('detailedInfo')}</span>
                </button>
                <button onClick={() => setActiveTab('summary')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'summary' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl' : 'border-transparent text-slate-500'}`}>
                    <MdOutlineBarChart size={16} /><span>3. {t('summaryTable')}</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg font-bold">
                                <FaCheckCircle />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Activated Devices</p>
                                <h3 className="text-lg font-black text-slate-900 mt-0.5">{kpi.totalActivated.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-lg font-bold">
                                <FaDollarSign />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Loan Portfolio</p>
                                <h3 className="text-lg font-black text-blue-700 mt-0.5">${kpi.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-lg font-bold">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Est. Monthly Collection</p>
                                <h3 className="text-lg font-black text-indigo-700 mt-0.5">${kpi.totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-lg font-bold">
                                <FaLock />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Locked Devices</p>
                                <h3 className="text-lg font-black text-rose-700 mt-0.5">{kpi.lockedPhone.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-lg font-bold">
                                <FaImage />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Set Wallpaper</p>
                                <h3 className="text-lg font-black text-purple-700 mt-0.5">{kpi.lockedWallpaper.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart Component */}
                    <LineChart
                        title="ក្រាបខ្សែនិន្នាការ Activated (Activated Trend Line Chart)"
                        subtitle="បង្ហាញពីការកើនឡើងចំនួន Activated ទឹកប្រាក់ឥណទាន និងប្រចាំខែ"
                        data={chartTrendData}
                        series={[
                            { key: 'activatedCount', label: 'Activated (ចំនួន)', color: '#10b981', isCurrency: false },
                            { key: 'loanAmount', label: 'ទឹកប្រាក់ឥណទាន ($)', color: '#3b82f6', isCurrency: true },
                            { key: 'monthlyAmount', label: 'ប្រចាំខែ ($)', color: '#a855f7', isCurrency: true }
                        ]}
                    />

                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MdPieChart className="text-emerald-600 text-lg" />
                            <span>Activated Devices by Brand (ក្រាបឧបករណ៍ដំណើរការតាម Brand)</span>
                        </h3>
                        <div className="h-56 w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-end justify-around gap-4">
                            {summaryBreakdown.rows.map((r) => {
                                const maxVal = Math.max(...summaryBreakdown.rows.map(x => x.totalActivated), 1);
                                const pct = Math.min(100, Math.max(15, (r.totalActivated / maxVal) * 100));
                                return (
                                    <div key={r.brand} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{r.brand} ({r.totalActivated})</span>
                                        <div style={{ height: `${pct}%` }} className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl shadow-md transition-all"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Detailed Info */}
            {activeTab === 'detail' && (
                <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-3 text-center'>No</th>
                                <th className='px-4 py-3'>Customer</th>
                                <th className='px-4 py-3'>Model</th>
                                <th className='px-4 py-3'>Serial Number</th>
                                <th className='px-4 py-3'>Brand</th>
                                <th className='px-4 py-3 text-center'>Status</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No activated contracts found.</td></tr>
                            ) : (
                                dataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/40 transition-colors'>
                                        <td className='px-4 py-3 text-center font-mono font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                        <td className='px-4 py-3 font-bold text-slate-900'><CopyCell text={item.customerNameEn || '-'} className='font-bold text-slate-900' /></td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model || '-'} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber || '-'} className='font-mono text-emerald-700 font-semibold' /></td>
                                        <td className='px-4 py-3'><span className='px-2.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>{item.brand || user?.brand || 'SYSTEM'}</span></td>
                                        <td className='px-4 py-3 text-center font-bold text-emerald-700'>Activated</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 3: Summary Table */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md p-4 space-y-4'>
                    <div className="border-b border-slate-200 pb-2">
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-emerald-600 text-xl" />
                            <span>តារាងសរុបកិច្ចសន្យាដំណើរការតាម Brand (Activated Contracts Master Summary Table)</span>
                        </h3>
                    </div>
                    <div className='w-full overflow-x-auto rounded-xl border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-emerald-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-3 text-center'>No</th>
                                    <th className='px-3.5 py-3'>Brand Domain</th>
                                    <th className='px-3.5 py-3 text-center'>Activated Count</th>
                                    <th className='px-3.5 py-3 text-right'>Active Loan Value ($)</th>
                                    <th className='px-3.5 py-3 text-right text-emerald-200'>Est. Monthly Collection ($)</th>
                                    <th className='px-3.5 py-3 text-center text-rose-200'>Lock Phone</th>
                                    <th className='px-3.5 py-3 text-center text-purple-200'>Lock Wallpaper</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                                {summaryBreakdown.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-emerald-50/50 transition-colors">
                                        <td className="px-3.5 py-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                        <td className="px-3.5 py-3 font-black text-emerald-900">
                                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-3 text-center font-bold text-slate-900">{row.totalActivated.toLocaleString()}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-blue-700">${row.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-700">${row.totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-rose-700 bg-rose-50/50">{row.lockedPhoneCount}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-purple-700 bg-purple-50/50">{row.lockedWallpaperCount}</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-emerald-100/80 border-t-2 border-emerald-400 font-black text-emerald-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-emerald-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.totalActivated.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-blue-900 font-black">${summaryBreakdown.grandTotal.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-emerald-900 font-black">${summaryBreakdown.grandTotal.totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-center text-rose-900 font-black bg-rose-100">{summaryBreakdown.grandTotal.lockedPhoneCount}</td>
                                    <td className="px-3.5 py-3.5 text-center text-purple-900 font-black bg-purple-100">{summaryBreakdown.grandTotal.lockedWallpaperCount}</td>
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

export default ActivatedReport;
