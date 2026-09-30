import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdFilterList, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaLock, FaImage, FaMoneyBillWave, FaExchangeAlt, FaDollarSign } from 'react-icons/fa';
import { exportToExcel, exportToPDFLandscape } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';
import LineChart from '../../../components/LineChart';

const ReportAll = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [payments, setPayments] = useState([]);
    const [brandsList, setBrandsList] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Brands list from ControlSystem
    const fetchBrandsList = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat?.items) {
                    setBrandsList(brandCat.items);
                }
            }
        } catch (err) {
            console.error('Fetch brands error:', err);
        }
    }, [API_BASE]);

    // Fetch All Contracts & Payments for Summary Analysis
    const fetchAllData = useCallback(async () => {
        setReloading(true);
        try {
            const contractParams = new URLSearchParams({
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const paymentParams = new URLSearchParams({
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });

            const [contractsRes, paymentsRes] = await Promise.all([
                fetch(`${API_BASE1}/contracts?${contractParams.toString()}`),
                fetch(`${API_BASE1}/payments?${paymentParams.toString()}`)
            ]);

            if (contractsRes.ok) {
                const data = await contractsRes.json();
                setContracts(data.data || []);
            }
            if (paymentsRes.ok) {
                const data = await paymentsRes.json();
                setPayments(data.data || []);
            }
        } catch (err) {
            console.error('Fetch all report data error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, user]);

    useEffect(() => {
        fetchBrandsList();
        fetchAllData();
    }, [fetchBrandsList, fetchAllData]);

    // Filtered raw contracts based on Brand and Search
    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            if (selectedBrand !== 'ALL' && c.brand !== selectedBrand) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (c.customerNameEn && c.customerNameEn.toLowerCase().includes(term)) ||
                    (c.customerNameKh && c.customerNameKh.toLowerCase().includes(term)) ||
                    (c.model && c.model.toLowerCase().includes(term)) ||
                    (c.serialNumber && c.serialNumber.toLowerCase().includes(term)) ||
                    (c.phone && c.phone.toLowerCase().includes(term)) ||
                    (c.contractId && c.contractId.toLowerCase().includes(term))
                );
            }
            return true;
        });
    }, [contracts, selectedBrand, searchTerm]);

    // Filtered raw payments matching selected brand
    const filteredPayments = useMemo(() => {
        if (selectedBrand === 'ALL') return payments;
        const brandContractIds = new Set(
            contracts.filter(c => c.brand === selectedBrand).map(c => c.contractId)
        );
        return payments.filter(p => p.brand === selectedBrand || brandContractIds.has(p.contractId));
    }, [payments, contracts, selectedBrand]);

    // Compute Brand Summary Grouped Table Data
    const brandSummaryData = useMemo(() => {
        // Find all unique brands in dataset or brandsList
        const rawBrands = Array.from(
            new Set([
                ...brandsList,
                ...contracts.map(c => c.brand).filter(Boolean)
            ])
        ).sort();

        const activeBrands = selectedBrand === 'ALL' ? rawBrands : [selectedBrand];

        const rows = activeBrands.map(b => {
            const brandContracts = contracts.filter(c => c.brand === b);
            const brandContractIds = new Set(brandContracts.map(c => c.contractId));
            const brandPayments = payments.filter(p => p.brand === b || brandContractIds.has(p.contractId));

            const totalCustomers = brandContracts.length;
            const totalLoan = brandContracts.reduce((sum, c) => sum + (Number(c.amount || c.totalAmount) || 0), 0);
            const totalPaid = brandPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const remainingBalance = Math.max(0, totalLoan - totalPaid);

            const activatedCount = brandContracts.filter(c => c.status === 'Activated').length;
            const applicationCount = brandContracts.filter(c => c.status === 'Application').length;
            const checkCount = brandContracts.filter(c => c.status === 'Check').length;
            const redeemCount = brandContracts.filter(c => c.status === 'Redeem').length;
            const blacklistCount = brandContracts.filter(c => c.status === 'Blacklist').length;
            const commentsCount = brandContracts.filter(c => c.status === 'Comments' || (c.status === 'Activated' && c.notes)).length;

            const lockedPhoneCount = brandContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
            const lockedWallpaperCount = brandContracts.filter(c => c.lockWallpaperStatus === 'Locked').length;

            return {
                brand: b || 'SYSTEM',
                totalCustomers,
                totalLoan,
                totalPaid,
                remainingBalance,
                activatedCount,
                applicationCount,
                checkCount,
                redeemCount,
                blacklistCount,
                commentsCount,
                lockedPhoneCount,
                lockedWallpaperCount
            };
        }).filter(r => r.totalCustomers > 0 || selectedBrand !== 'ALL');

        // Grand Total Row
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
            commentsCount: acc.commentsCount + r.commentsCount,
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
            commentsCount: 0,
            lockedPhoneCount: 0,
            lockedWallpaperCount: 0
        });

        return { rows, grandTotal };
    }, [contracts, payments, brandsList, selectedBrand]);

    // Overall KPI Totals for Cards
    const kpi = useMemo(() => {
        const totalCustomers = filteredContracts.length;
        const totalLoan = filteredContracts.reduce((sum, c) => sum + (Number(c.amount || c.totalAmount) || 0), 0);
        const totalPaid = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const remainingBalance = Math.max(0, totalLoan - totalPaid);
        const lockedPhone = filteredContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
        const lockedWallpaper = filteredContracts.filter(c => c.lockWallpaperStatus === 'Locked').length;

        return {
            totalCustomers,
            totalLoan,
            totalPaid,
            remainingBalance,
            lockedPhone,
            lockedWallpaper
        };
    }, [filteredContracts, filteredPayments]);

    // Trend line chart data
    const chartTrendData = useMemo(() => {
        const map = {};
        const sourceContracts = contracts.length > 0 ? contracts : filteredContracts;
        sourceContracts.forEach(c => {
            const dateStr = (c.inputDate || c.createdAt || c.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, contractsCount: 0, loanAmount: 0, paidAmount: 0 };
            map[dateStr].contractsCount += 1;
            map[dateStr].loanAmount += Number(c.amount || c.totalAmount || 0);
        });
        filteredPayments.forEach(p => {
            const dateStr = (p.paidDate || p.paymentDate || p.createdAt || p.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, contractsCount: 0, loanAmount: 0, paidAmount: 0 };
            map[dateStr].paidAmount += Number(p.amount || 0);
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [contracts, filteredContracts, filteredPayments]);

    const [pdfOrientation, setPdfOrientation] = useState('landscape');

    // Export to Excel (Styled Spreadsheet)
    const handleExportExcel = () => {
        const columns = [
            { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
            { header: 'Brand Name', accessor: 'brand' },
            { header: 'Customers', accessor: 'totalCustomers' },
            { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Total Paid ($)', cell: (r) => `$${(r.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Remaining ($)', cell: (r) => `$${(r.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Activated', accessor: 'activatedCount' },
            { header: 'Application', accessor: 'applicationCount' },
            { header: 'Check', accessor: 'checkCount' },
            { header: 'Redeem', accessor: 'redeemCount' },
            { header: 'Blacklist', accessor: 'blacklistCount' },
            { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
            { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
        ];
        const exportData = [...brandSummaryData.rows, brandSummaryData.grandTotal];
        exportToExcel('Master Executive Summary Report', columns, exportData, user?.brand || 'GLOBAL ALL');
    };

    // Export to PDF
    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
            { header: 'Brand Name', accessor: 'brand' },
            { header: 'Customers', accessor: 'totalCustomers' },
            { header: 'Total Loan ($)', cell: (r) => `$${(r.totalLoan || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Total Paid ($)', cell: (r) => `$${(r.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Remaining ($)', cell: (r) => `$${(r.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { header: 'Activated', accessor: 'activatedCount' },
            { header: 'App / Check', cell: (r) => `${r.applicationCount || 0} / ${r.checkCount || 0}` },
            { header: 'Redeem / Blacklist', cell: (r) => `${r.redeemCount || 0} / ${r.blacklistCount || 0}` },
            { header: 'Lock Phone', accessor: 'lockedPhoneCount' },
            { header: 'Lock Wallpaper', accessor: 'lockedWallpaperCount' }
        ];

        const pdfData = [...brandSummaryData.rows, brandSummaryData.grandTotal];
        exportToPDF('Master Executive Summary Report (All Brands)', columns, pdfData, user?.brand || 'GLOBAL ALL', pdfOrientation);
    };

    return (
        <div className='w-full p-4 select-none space-y-4'>
            {/* Top Header */}
            <header className='p-4 w-full border border-slate-200 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('reportAll')}
                        </h1>
                    </div>
                </div>

                {/* Filter and Action Controls */}
                <div className='flex items-center gap-2 flex-wrap'>
                    {/* Brand Selector Filter */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900">
                        <MdFilterList size={16} className="text-indigo-600" />
                        <span>Brand Filter:</span>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="bg-white border border-indigo-300 text-indigo-900 text-xs rounded-lg font-bold px-2 py-1 outline-none cursor-pointer hover:border-indigo-500"
                        >
                            <option value="ALL">ALL Brands (គ្រប់ Brand)</option>
                            {brandsList.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    {/* PDF Orientation Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 p-1 rounded-xl text-xs">
                        <button
                            onClick={() => setPdfOrientation('portrait')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${pdfOrientation === 'portrait' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            title="A4 Portrait Page Layout (សន្លឹកបញ្ឈរ)"
                        >
                            📄 បញ្ឈរ (Portrait)
                        </button>
                        <button
                            onClick={() => setPdfOrientation('landscape')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${pdfOrientation === 'landscape' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            title="A4 Landscape Page Layout (សន្លឹកផ្តេក)"
                        >
                            🖼️ ផ្តេក (Landscape)
                        </button>
                    </div>

                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>{t('exportExcel')}</span>
                    </button>

                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-600/20'
                    >
                        <MdPictureAsPdf className="text-white text-sm" />
                        <span>Export PDF ({pdfOrientation === 'landscape' ? 'ផ្តេក' : 'បញ្ឈរ'})</span>
                    </button>

                    <button
                        onClick={fetchAllData}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-600' : ''} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </header>

            {/* KPI Executive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-lg font-bold">
                        <FaUsers />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Customers</p>
                        <h3 className="text-lg font-black text-slate-900 mt-0.5">{kpi.totalCustomers.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-lg font-bold">
                        <FaDollarSign />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Loan ($)</p>
                        <h3 className="text-lg font-black text-blue-700 mt-0.5">${kpi.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg font-bold">
                        <FaMoneyBillWave />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Received ($)</p>
                        <h3 className="text-lg font-black text-emerald-700 mt-0.5">${kpi.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg font-bold">
                        <FaExchangeAlt />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Remaining Balance ($)</p>
                        <h3 className="text-lg font-black text-amber-700 mt-0.5">${kpi.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-lg font-bold">
                        <FaLock />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lock Phone Devices</p>
                        <h3 className="text-lg font-black text-rose-700 mt-0.5">{kpi.lockedPhone.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-lg font-bold">
                        <FaImage />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lock Wallpaper Devices</p>
                        <h3 className="text-lg font-black text-purple-700 mt-0.5">{kpi.lockedWallpaper.toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            {/* Line Chart Component */}
            <LineChart
                title="ក្រាបខ្សែនិន្នាការកិច្ចសន្យា & ទឹកប្រាក់សរុប (Contract & Financial Line Chart)"
                subtitle="បង្ហាញពីការកើនឡើងចំនួនកិច្ចសន្យា ទឹកប្រាក់ឥណទាន និងទឹកប្រាក់ទទួលបានប្រចាំថ្ងៃ/ខែ"
                data={chartTrendData}
                series={[
                    { key: 'contractsCount', label: 'ចំនួនកិច្ចសន្យា (Contracts)', color: '#6366f1', isCurrency: false },
                    { key: 'loanAmount', label: 'ទឹកប្រាក់ឥណទាន ($)', color: '#3b82f6', isCurrency: true },
                    { key: 'paidAmount', label: 'ទឹកប្រាក់ទទួលបាន ($)', color: '#10b981', isCurrency: true }
                ]}
            />

            {/* Main Master Summary Table */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-md p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                    <div>
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-indigo-600 text-xl" />
                            <span>តារាងសរុបព័ត៌មានតាម Brand (Master Brand Summary Breakdown)</span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            ព័ត៌មានសរុបទឹកប្រាក់ ទឹកប្រាក់បានបង់ ទឹកប្រាក់នៅសល់ និងចំនួនឧបករណ៍ចាក់សោរគ្រប់ Brand
                        </p>
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search customer, model, serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-4 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all w-60 shadow-2xs"
                        />
                    </div>
                </div>

                <div className='w-full overflow-x-auto rounded-xl border border-slate-200 table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-indigo-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                            <tr>
                                <th className='px-3.5 py-3 text-center'>No</th>
                                <th className='px-3.5 py-3'>Brand Name</th>
                                <th className='px-3.5 py-3 text-center'>Total Customers</th>
                                <th className='px-3.5 py-3 text-right'>Total Loan ($)</th>
                                <th className='px-3.5 py-3 text-right text-emerald-200'>Total Paid ($)</th>
                                <th className='px-3.5 py-3 text-right text-amber-200'>Remaining ($)</th>
                                <th className='px-3.5 py-3 text-center'>Activated</th>
                                <th className='px-3.5 py-3 text-center'>App / Check</th>
                                <th className='px-3.5 py-3 text-center'>Redeem / Blacklist</th>
                                <th className='px-3.5 py-3 text-center text-rose-200'>Lock Phone</th>
                                <th className='px-3.5 py-3 text-center text-purple-200'>Lock Wallpaper</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-10 text-indigo-600 font-bold">
                                        Loading Master Executive Summary Report...
                                    </td>
                                </tr>
                            ) : brandSummaryData.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-slate-400 italic">
                                        No data records found for selected brand scope.
                                    </td>
                                </tr>
                            ) : (
                                brandSummaryData.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-3.5 py-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                        <td className="px-3.5 py-3 font-black text-indigo-900">
                                            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-3 text-center font-bold text-slate-900">{row.totalCustomers.toLocaleString()}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-blue-700">${row.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-700">${row.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-700">${row.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-emerald-800">{row.activatedCount}</td>
                                        <td className="px-3.5 py-3 text-center font-medium text-slate-600">{row.applicationCount} / {row.checkCount}</td>
                                        <td className="px-3.5 py-3 text-center font-medium text-slate-600">{row.redeemCount} / {row.blacklistCount}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-rose-700 bg-rose-50/50">{row.lockedPhoneCount}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-purple-700 bg-purple-50/50">{row.lockedWallpaperCount}</td>
                                    </tr>
                                ))
                            )}

                            {/* Grand Total Summary Row */}
                            {!loading && brandSummaryData.rows.length > 0 && (
                                <tr className="bg-indigo-100/80 border-t-2 border-indigo-400 font-black text-indigo-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-indigo-950">
                                        {brandSummaryData.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{brandSummaryData.grandTotal.totalCustomers.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-blue-900 font-black">${brandSummaryData.grandTotal.totalLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-emerald-900 font-black">${brandSummaryData.grandTotal.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-amber-900 font-black">${brandSummaryData.grandTotal.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-center text-emerald-950 font-black">{brandSummaryData.grandTotal.activatedCount}</td>
                                    <td className="px-3.5 py-3.5 text-center font-bold text-slate-800">{brandSummaryData.grandTotal.applicationCount} / {brandSummaryData.grandTotal.checkCount}</td>
                                    <td className="px-3.5 py-3.5 text-center font-bold text-slate-800">{brandSummaryData.grandTotal.redeemCount} / {brandSummaryData.grandTotal.blacklistCount}</td>
                                    <td className="px-3.5 py-3.5 text-center text-rose-900 font-black bg-rose-100">{brandSummaryData.grandTotal.lockedPhoneCount}</td>
                                    <td className="px-3.5 py-3.5 text-center text-purple-900 font-black bg-purple-100">{brandSummaryData.grandTotal.lockedWallpaperCount}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportAll;
