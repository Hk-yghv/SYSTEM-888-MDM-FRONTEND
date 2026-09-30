import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaDollarSign, FaMoneyBillWave, FaExchangeAlt, FaLock, FaImage } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import LineChart from '../../../components/LineChart';

const LIMIT = 10;

const AllCustomersReport = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
    const [allPayments, setAllPayments] = useState([]);
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
            console.error('Fetch all customers report error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, page, searchTerm, user]);

    // Fetch full data for Dashboard Analytics & Brand Summary Table
    const fetchFullData = useCallback(async () => {
        try {
            const contractParams = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            const paymentParams = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });

            const [cRes, pRes] = await Promise.all([
                fetch(`${API_BASE1}/contracts?${contractParams.toString()}`),
                fetch(`${API_BASE1}/payments?${paymentParams.toString()}`)
            ]);

            if (cRes.ok) {
                const cData = await cRes.json();
                setAllContracts(cData.data || []);
            }
            if (pRes.ok) {
                const pData = await pRes.json();
                setAllPayments(pData.data || []);
            }
        } catch (err) {
            console.error('Fetch full report summary error:', err);
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
            console.error('Fetch all customers report for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Customers', accessor: 'totalCustomers' },
                { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Total Paid ($)', cell: (r) => `$${(r.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Remaining ($)', cell: (r) => `$${(r.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Activated', accessor: 'activatedCount' },
                { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
                { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
            ];
            const excelData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToExcel('All Customers — Summary Table', summaryColumns, excelData, user?.brand || '');
        }

        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer (EN)', accessor: 'customerNameEn' },
            { header: 'Customer (KH)', accessor: 'customerNameKh' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Phone Lock', accessor: 'lockPhoneStatus' },
            { header: 'Wallpaper Lock', accessor: 'lockWallpaperStatus' },
            { header: 'Status', accessor: 'status' }
        ];
        exportToExcel('All Customers Report', columns, allData, user?.brand || '');
    };

    const handleExportPDF = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Customers', accessor: 'totalCustomers' },
                { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Total Paid ($)', cell: (r) => `$${(r.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Remaining ($)', cell: (r) => `$${(r.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { header: 'Activated', accessor: 'activatedCount' },
                { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
                { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
            ];
            const pdfData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToPDF('All Customers — Summary Table', summaryColumns, pdfData, user?.brand || '', pdfOrientation);
        }
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer (EN)', accessor: 'customerNameEn' },
            { header: 'Customer (KH)', accessor: 'customerNameKh' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Phone Lock', accessor: 'lockPhoneStatus' },
            { header: 'Status', accessor: 'status' }
        ];
        exportToPDF('All Customers Report', columns, allData, user?.brand || '', pdfOrientation);
    };

    // Calculate Brand Breakdown & Financial Totals for Summary Table
    const summaryBreakdown = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const brandMap = {};

        sourceContracts.forEach(c => {
            const b = c.brand || user?.brand || 'SYSTEM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalCustomers: 0,
                    totalLoan: 0,
                    totalPaid: 0,
                    remainingBalance: 0,
                    activatedCount: 0,
                    applicationCount: 0,
                    checkCount: 0,
                    redeemCount: 0,
                    blacklistCount: 0,
                    lockedPhoneCount: 0,
                    lockedWallpaperCount: 0
                };
            }
            const bObj = brandMap[b];
            bObj.totalCustomers += 1;
            bObj.totalLoan += Number(c.amount || c.totalAmount || 0);
            if (c.status === 'Activated') bObj.activatedCount += 1;
            if (c.status === 'Application') bObj.applicationCount += 1;
            if (c.status === 'Check') bObj.checkCount += 1;
            if (c.status === 'Redeem') bObj.redeemCount += 1;
            if (c.status === 'Blacklist') bObj.blacklistCount += 1;
            if (c.lockPhoneStatus === 'Locked') bObj.lockedPhoneCount += 1;
            if (c.lockWallpaperStatus === 'Locked') bObj.lockedWallpaperCount += 1;
        });

        // Add payments to brandMap
        allPayments.forEach(p => {
            const b = p.brand || user?.brand || 'SYSTEM';
            if (brandMap[b]) {
                brandMap[b].totalPaid += Number(p.amount || 0);
            }
        });

        const rows = Object.values(brandMap).map(b => ({
            ...b,
            remainingBalance: Math.max(0, b.totalLoan - b.totalPaid)
        }));

        const grandTotal = rows.reduce((acc, r) => ({
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalCustomers: acc.totalCustomers + r.totalCustomers,
            totalLoan: acc.totalLoan + r.totalLoan,
            totalPaid: acc.totalPaid + r.totalPaid,
            remainingBalance: acc.remainingBalance + r.remainingBalance,
            activatedCount: acc.activatedCount + r.activatedCount,
            applicationCount: acc.applicationCount + r.applicationCount,
            checkCount: acc.checkCount + r.checkCount,
            redeemCount: acc.redeemCount + r.redeemCount,
            blacklistCount: acc.blacklistCount + r.blacklistCount,
            lockedPhoneCount: acc.lockedPhoneCount + r.lockedPhoneCount,
            lockedWallpaperCount: acc.lockedWallpaperCount + r.lockedWallpaperCount
        }), {
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalCustomers: 0,
            totalLoan: 0,
            totalPaid: 0,
            remainingBalance: 0,
            activatedCount: 0,
            applicationCount: 0,
            checkCount: 0,
            redeemCount: 0,
            blacklistCount: 0,
            lockedPhoneCount: 0,
            lockedWallpaperCount: 0
        });

        return { rows, grandTotal };
    }, [allContracts, allPayments, dataList, user]);

    // Financial KPI Totals for Cards
    const kpi = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const totalCustomers = sourceContracts.length;
        const totalLoan = sourceContracts.reduce((sum, c) => sum + (Number(c.amount || c.totalAmount) || 0), 0);
        const totalPaid = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const remainingBalance = Math.max(0, totalLoan - totalPaid);
        const lockedPhone = sourceContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
        const lockedWallpaper = sourceContracts.filter(c => c.lockWallpaperStatus === 'Locked').length;

        return {
            totalCustomers,
            totalLoan,
            totalPaid,
            remainingBalance,
            lockedPhone,
            lockedWallpaper
        };
    }, [allContracts, allPayments, dataList]);

    // Trend line chart data
    const chartTrendData = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const map = {};
        sourceContracts.forEach(c => {
            const dateStr = (c.inputDate || c.createdAt || c.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, customerCount: 0, loanAmount: 0, paidAmount: 0 };
            map[dateStr].customerCount += 1;
            map[dateStr].loanAmount += Number(c.amount || c.totalAmount || 0);
        });
        allPayments.forEach(p => {
            const dateStr = (p.paidDate || p.paymentDate || p.createdAt || p.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, customerCount: 0, loanAmount: 0, paidAmount: 0 };
            map[dateStr].paidAmount += Number(p.amount || 0);
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [allContracts, dataList, allPayments]);

    const paymentsByContract = useMemo(() => {
        const grouped = new Map();
        allPayments.forEach(payment => {
            const payments = grouped.get(payment.contractId) || [];
            payments.push(payment);
            grouped.set(payment.contractId, payments);
        });
        return grouped;
    }, [allPayments]);

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-4 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('allCustomerReport')}
                        </h1>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    {hasPermission('/report/all-customers', 'export') && (
                        <>
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

                        </>
                    )}
                </div>
            </header>

            {/* Sub-Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-white rounded-t-[5px] px-3 pt-2 gap-2 shadow-xs">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdPieChart size={16} /><span>1. {t('dashboardAnalytics')}</span>
                </button>
                <button onClick={() => setActiveTab('detail')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'detail' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdTableChart size={16} /><span>2. {t('detailedInfo')}</span>
                </button>
                <button onClick={() => setActiveTab('summary')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'summary' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdOutlineBarChart size={16} /><span>3. {t('summaryTable')}</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics & Graphs */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-lg font-bold">
                                <FaUsers />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Customers</p>
                                <h3 className="text-lg font-black text-slate-900 mt-0.5">{kpi.totalCustomers.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-lg font-bold">
                                <FaDollarSign />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Loan ($)</p>
                                <h3 className="text-lg font-black text-blue-700 mt-0.5">${kpi.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg font-bold">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Received ($)</p>
                                <h3 className="text-lg font-black text-emerald-700 mt-0.5">${kpi.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg font-bold">
                                <FaExchangeAlt />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Remaining Balance ($)</p>
                                <h3 className="text-lg font-black text-amber-700 mt-0.5">${kpi.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-lg font-bold">
                                <FaLock />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lock Phone</p>
                                <h3 className="text-lg font-black text-rose-700 mt-0.5">{kpi.lockedPhone.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-lg font-bold">
                                <FaImage />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lock Wallpaper</p>
                                <h3 className="text-lg font-black text-purple-700 mt-0.5">{kpi.lockedWallpaper.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart Component */}
                    <LineChart
                        title="ក្រាបខ្សែនិន្នាការអតិថិជន & ទឹកប្រាក់សរុប (Customer & Financial Line Chart)"
                        subtitle="បង្ហាញពីកំណើនចំនួនអតិថិជន ទឹកប្រាក់ឥណទាន និងទឹកប្រាក់ទទួលបានប្រចាំថ្ងៃ/ខែ"
                        data={chartTrendData}
                        series={[
                            { key: 'customerCount', label: 'ចំនួនអតិថិជន (Customers)', color: '#6366f1', isCurrency: false },
                            { key: 'loanAmount', label: 'ទឹកប្រាក់ឥណទាន ($)', color: '#3b82f6', isCurrency: true },
                            { key: 'paidAmount', label: 'ទឹកប្រាក់ទទួលបាន ($)', color: '#10b981', isCurrency: true }
                        ]}
                    />

                    {/* Interactive Visual Graph & Brand Distribution Bars */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-5 bg-white rounded-[5px] border border-slate-200 shadow-xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <MdPieChart className="text-indigo-600 text-lg" />
                                <span>Brand Distribution Overview (ក្រាបបែងចែកតាម Brand)</span>
                            </h3>
                            <div className="h-56 w-full bg-slate-50 rounded-[5px] p-4 border border-slate-200 flex items-end justify-around gap-4">
                                {summaryBreakdown.rows.map((r, idx) => {
                                    const maxVal = Math.max(...summaryBreakdown.rows.map(x => x.totalCustomers), 1);
                                    const pct = Math.min(100, Math.max(15, (r.totalCustomers / maxVal) * 100));
                                    return (
                                        <div key={r.brand} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{r.brand} ({r.totalCustomers})</span>
                                            <div style={{ height: `${pct}%` }} className="w-full bg-gradient-to-t from-indigo-700 to-indigo-500 rounded-t-[5px] shadow-md transition-all"></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Financial Volume Meter */}
                        <div className="p-5 bg-white rounded-[5px] border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <MdOutlineBarChart className="text-emerald-600 text-lg" />
                                <span>Financial Collections & Loan Volume Meter</span>
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-blue-800">Total Loan Portfolio Value:</span>
                                        <span className="text-blue-900">${kpi.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="w-full h-3.5 bg-blue-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full w-full"></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-emerald-800">Collected Revenue (Billed & Paid):</span>
                                        <span className="text-emerald-900">${kpi.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="w-full h-3.5 bg-emerald-100 rounded-full overflow-hidden">
                                        <div style={{ width: `${kpi.totalLoan > 0 ? Math.min(100, Math.round((kpi.totalPaid / kpi.totalLoan) * 100)) : 0}%` }} className="h-full bg-emerald-600 rounded-full transition-all"></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-amber-800">Outstanding Balance:</span>
                                        <span className="text-amber-900">${kpi.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="w-full h-3.5 bg-amber-100 rounded-full overflow-hidden">
                                        <div style={{ width: `${kpi.totalLoan > 0 ? Math.min(100, Math.round((kpi.remainingBalance / kpi.totalLoan) * 100)) : 0}%` }} className="h-full bg-amber-600 rounded-full transition-all"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Detailed Customer Information */}
            {activeTab === 'detail' && (
                <div className='w-full h-[calc(100vh-350px)] overflow-auto pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                    <table className='w-full min-w-max text-left text-xs'>
                        <thead className='sticky top-0 z-10 bg-slate-800 text-white uppercase tracking-wide'>
                            <tr>
                                {['No', 'Contract ID', 'Contract IID', 'Name (EN)', 'Name (KH)', 'ID Card', 'Date of Birth', 'Gender', 'Birth Address', 'Current Address', 'Phone', 'Relative Phone', 'Facebook Name', 'Telegram Name', 'Facebook URL', 'Mosyle URL', 'Model', 'Brand', 'Serial Number', 'IMEI 1', 'IMEI 2', 'MEID', 'Color', 'Version', 'Capacity', 'Device Problem', 'Principal Amount', 'Interest', 'Interest Type', 'Admin Fee', 'Duration', 'Total Receivable', 'Total Penalty', 'Total Received', 'Remaining Balance', 'Monthly Payment', 'Last Payment Date', 'Input Date', 'Redeem Date', 'Status', 'Phone Lock', 'Wallpaper Lock', 'Customer Photo', 'Google Drive Photos', 'Photos / Evidence', 'Created At', 'Updated At', 'Notes', 'Last Modified By', 'Payment / Schedule Details'].map(label => (
                                    <th key={label} className='whitespace-nowrap border-b border-slate-600 px-3 py-1 text-left text-[10px]'>{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={50} className="py-10 text-center font-semibold text-indigo-600">Loading...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={50} className="py-8 text-center italic text-slate-500">No customers found.</td></tr>
                            ) : dataList.map((item, idx) => {
                                const customerPayments = (paymentsByContract.get(item.contractId) || [])
                                    .slice()
                                    .sort((a, b) => String(b.paidDate || b.createdAt || '').localeCompare(String(a.paidDate || a.createdAt || '')));
                                const totalReceived = customerPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
                                const totalPenalty = customerPayments.reduce((sum, payment) => sum + (Number(payment.penalty) || 0), 0);
                                const totalReceivable = Number(item.totalAmount) || Number(item.amount) || 0;
                                const remainingBalance = Math.max(0, totalReceivable + totalPenalty - totalReceived);
                                const value = (entry) => entry === undefined || entry === null || entry === '' ? '-' : entry;
                                const money = (amount) => `$${(Number(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                const link = (url, label = 'Open') => url
                                    ? <a href={url} title={url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{label}</a>
                                    : '-';
                                const cell = (content, className = '') => <td className={`max-w-99999999 px-3 py-2 align-top ${className}`}>{content}</td>;
                                const photoLinks = [...(item.photos || []), ...(item.evidencePhotos || [])].filter(Boolean);

                                return (
                                    <tr key={item._id || item.contractId || idx} className="hover:bg-indigo-50/50">
                                        {cell((page - 1) * LIMIT + idx + 1, 'text-center font-mono')}
                                        {cell(value(item.contractId), 'font-mono')}
                                        {cell(value(item.contractIid), 'font-mono')}
                                        {cell(value(item.customerNameEn), 'font-bold text-slate-900')}
                                        {cell(value(item.customerNameKh), 'font-khmer')}
                                        {cell(value(item.idCardNumber), 'font-mono')}
                                        {cell(value(item.dob))}
                                        {cell(value(item.gender))}
                                        {cell(value(item.birthAddress), 'whitespace-normal min-w-40')}
                                        {cell(value(item.currentAddress), 'whitespace-normal min-w-40')}
                                        {cell(value(item.phone), 'font-mono')}
                                        {cell(value(item.relativePhone), 'font-mono')}
                                        {cell(value(item.facebookName))}
                                        {cell(value(item.telegramName))}
                                        {cell(link(item.urlFb || item.url_fb))}
                                        {cell(link(item.mosyleUrl || item.mosyle_url || item.mosyleURL || item.urlMosyle))}
                                        {cell(value(item.model))}
                                        {cell(value(item.brand || user?.brand || 'SYSTEM'))}
                                        {cell(value(item.serialNumber), 'font-mono')}
                                        {cell(value(item.imei1), 'font-mono')}
                                        {cell(value(item.imei2), 'font-mono')}
                                        {cell(value(item.meid), 'font-mono')}
                                        {cell(value(item.color))}
                                        {cell(value(item.version))}
                                        {cell(value(item.capacity))}
                                        {cell(value(item.deviceProblem), 'whitespace-normal min-w-32')}
                                        {cell(money(item.amount), 'text-right font-mono')}
                                        {cell(value(item.interest))}
                                        {cell(value(item.interestType))}
                                        {cell(money(item.adminFee), 'text-right font-mono')}
                                        {cell(value(item.duration))}
                                        {cell(money(totalReceivable), 'text-right font-mono font-bold text-blue-700')}
                                        {cell(money(totalPenalty), 'text-right font-mono font-bold text-rose-700')}
                                        {cell(money(totalReceived), 'text-right font-mono font-bold text-emerald-700')}
                                        {cell(money(remainingBalance), 'text-right font-mono font-bold text-amber-700')}
                                        {cell(money(item.monthlyPayment), 'text-right font-mono')}
                                        {cell(value(customerPayments[0]?.paidDate || customerPayments[0]?.createdAt?.slice(0, 10)))}
                                        {cell(value(item.inputDate))}
                                        {cell(value(item.redeemDate))}
                                        {cell(value(item.status), 'font-bold')}
                                        {cell(value(item.lockPhoneStatus || 'Unlocked'))}
                                        {cell(value(item.lockWallpaperStatus || 'Unlocked'))}
                                        {cell(link(item.customerPhoto))}
                                        {cell(link(item.googleDrivePhotoUrl))}
                                        {cell(photoLinks.length ? <div className="flex gap-2">{photoLinks.map((url, photoIndex) => <span key={`${url}-${photoIndex}`}>{link(url, String(photoIndex + 1))}</span>)}</div> : '-')}
                                        {cell(value(item.createdAt ? new Date(item.createdAt).toLocaleString() : ''))}
                                        {cell(value(item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''))}
                                        {cell(value(item.notes), 'whitespace-normal min-w-40')}
                                        {cell(value(item.lastModifiedBy))}
                                        {cell(
                                            <div className="min-w-48 space-y-2">
                                                {customerPayments.length > 0 && (
                                                    <details>
                                                        <summary className="cursor-pointer whitespace-nowrap font-bold text-indigo-700">Payments ({customerPayments.length})</summary>
                                                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto whitespace-normal">
                                                            {customerPayments.map((payment, paymentIndex) => <p key={payment._id || payment.paymentId || paymentIndex} className="border-b border-slate-100 pb-1">{payment.paidDate || '-'} · {money(payment.amount)} · Penalty {money(payment.penalty)} · {payment.paymentType || payment.paidBy || '-'}</p>)}
                                                        </div>
                                                    </details>
                                                )}
                                                {item.repaymentSchedule?.length > 0 && (
                                                    <details>
                                                        <summary className="cursor-pointer whitespace-nowrap font-bold text-indigo-700">Schedule ({item.repaymentSchedule.length})</summary>
                                                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto whitespace-normal">
                                                            {item.repaymentSchedule.map((row, scheduleIndex) => <p key={row._id || scheduleIndex} className="border-b border-slate-100 pb-1">{row.monthLabel || row.month || scheduleIndex + 1} · {row.dueDate || '-'} · Due {money(row.scheduledAmount)} · Paid {money(row.paidAmount)} · Penalty {money(row.penalty)} · {row.status || '-'}</p>)}
                                                        </div>
                                                    </details>
                                                )}
                                                {!customerPayments.length && !item.repaymentSchedule?.length && '-'}
                                            </div>,
                                            'whitespace-normal'
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 3: Summary Breakdown Table (Like Report All) */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 bg-white shadow-md p-4 space-y-4'>
                    <div className="border-b border-slate-200 pb-2">
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-indigo-600 text-xl" />
                            <span>តារាងសរុបអតិថិជន និងទឹកប្រាក់តាម Brand (All Customers Master Summary Table)</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            ព័ត៌មានសរុបអតិថិជន ទឹកប្រាក់កម្ចី ទឹកប្រាក់បានបង់ ទឹកប្រាក់នៅសល់ និងចំនួនឧបករណ៍ចាក់សោរ
                        </p>
                    </div>

                    <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-indigo-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-1 text-center'>No</th>
                                    <th className='px-3.5 py-1'>Brand Domain</th>
                                    <th className='px-3.5 py-1 text-center'>Total Customers</th>
                                    <th className='px-3.5 py-1 text-right'>Total Loan ($)</th>
                                    <th className='px-3.5 py-1 text-right text-emerald-200'>Total Paid ($)</th>
                                    <th className='px-3.5 py-1 text-right text-amber-200'>Remaining ($)</th>
                                    <th className='px-3.5 py-1 text-center'>Activated</th>
                                    <th className='px-3.5 py-1 text-center text-rose-200'>Lock Phone</th>
                                    <th className='px-3.5 py-1 text-center text-purple-200'>Lock Wallpaper</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                                {summaryBreakdown.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-3.5 py-1 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                        <td className="px-3.5 py-1 font-black text-indigo-900">
                                            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-1 text-center font-bold text-slate-900">{row.totalCustomers.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-right font-mono font-bold text-blue-700">${row.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-1 text-right font-mono font-bold text-emerald-700">${row.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-1 text-right font-mono font-bold text-amber-700">${row.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-emerald-800">{row.activatedCount}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-rose-700 bg-rose-50/50">{row.lockedPhoneCount}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-purple-700 bg-purple-50/50">{row.lockedWallpaperCount}</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-indigo-100/80 border-t-2 border-indigo-400 font-black text-indigo-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-indigo-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.totalCustomers.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-blue-900 font-black">${summaryBreakdown.grandTotal.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-emerald-900 font-black">${summaryBreakdown.grandTotal.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-amber-900 font-black">${summaryBreakdown.grandTotal.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-center text-emerald-950 font-black">{summaryBreakdown.grandTotal.activatedCount}</td>
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

export default AllCustomersReport;
