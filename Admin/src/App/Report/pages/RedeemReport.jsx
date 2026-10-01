import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaDollarSign, FaMoneyBillWave, FaLock, FaImage, FaUndoAlt } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import LineChart from '../../../components/LineChart';

const LIMIT = 10;

const RedeemReport = () => {
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
                status: 'Redeem',
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
            console.error('Fetch redeem report error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, page, searchTerm, user]);

    const fetchFullData = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                status: 'Redeem',
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
            console.error('Fetch full redeem report error:', err);
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
                status: 'Redeem',
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
            console.error('Fetch redeem report for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Redeemed', accessor: 'totalRedeem' },
                { header: 'Total Redeemed Value ($)', cell: (r) => `$${(r.totalLoanValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
            ];
            const excelData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToExcel('Redeem Contracts — Summary Table', summaryColumns, excelData, user?.brand || '');
        }

        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer (EN)', accessor: 'customerNameEn' },
            { header: 'Customer (KH)', accessor: 'customerNameKh' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Status', cell: () => 'Redeem' }
        ];
        exportToExcel('Redeem Contracts Report', columns, allData, user?.brand || '');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        if (activeTab === 'summary') {
            const summaryColumns = [
                { header: 'No', cell: (r, idx) => r.isTotalRow ? 'TOTAL' : idx + 1 },
                { header: 'Brand Domain', accessor: 'brand' },
                { header: 'Total Redeemed', accessor: 'totalRedeem' },
                { header: 'Total Redeemed Value ($)', cell: (r) => `$${(r.totalLoanValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
            ];
            const pdfData = [...summaryBreakdown.rows, summaryBreakdown.grandTotal];
            return exportToPDF('Redeem Contracts — Summary Table', summaryColumns, pdfData, user?.brand || '', pdfOrientation);
        }
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerNameEn' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Status', cell: () => 'Redeem' }
        ];
        exportToPDF('Redeem Contracts Report', columns, allData, user?.brand || '', pdfOrientation);
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
                    totalRedeem: 0,
                    totalLoanValue: 0
                };
            }
            const bObj = brandMap[b];
            bObj.totalRedeem += 1;
            bObj.totalLoanValue += Number(c.amount || c.totalAmount || 0);
        });

        const rows = Object.values(brandMap);

        const grandTotal = rows.reduce((acc, r) => ({
            brand: 'SUMMARY TOTAL',
            isTotalRow: true,
            totalRedeem: acc.totalRedeem + r.totalRedeem,
            totalLoanValue: acc.totalLoanValue + r.totalLoanValue
        }), {
            brand: 'SUMMARY TOTAL',
            isTotalRow: true,
            totalRedeem: 0,
            totalLoanValue: 0
        });

        return { rows, grandTotal };
    }, [allContracts, dataList, user]);

    // KPI Cards calculation
    const kpi = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const totalRedeem = sourceContracts.length;
        const totalLoanValue = sourceContracts.reduce((sum, c) => sum + (Number(c.amount || c.totalAmount) || 0), 0);

        return { totalRedeem, totalLoanValue };
    }, [allContracts, dataList]);

    // Trend line chart data
    const chartTrendData = useMemo(() => {
        const sourceContracts = allContracts.length > 0 ? allContracts : dataList;
        const map = {};
        sourceContracts.forEach(c => {
            const dateStr = (c.inputDate || c.createdAt || c.date || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, redeemCount: 0, loanValue: 0 };
            map[dateStr].redeemCount += 1;
            map[dateStr].loanValue += Number(c.amount || c.totalAmount || 0);
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [allContracts, dataList]);

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('redeemReport')}
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
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdPieChart size={16} /><span>1. {t('dashboardAnalytics')}</span>
                </button>
                <button onClick={() => setActiveTab('detail')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'detail' ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdTableChart size={16} /><span>2. {t('detailedInfo')}</span>
                </button>
                <button onClick={() => setActiveTab('summary')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'summary' ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdOutlineBarChart size={16} /><span>3. {t('summaryTable')}</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xl font-bold">
                                <FaUndoAlt />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Redeemed Devices</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{kpi.totalRedeem.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[5px] bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xl font-bold">
                                <FaDollarSign />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Redeemed Loan Value ($)</p>
                                <h3 className="text-2xl font-black text-blue-700 mt-0.5">${kpi.totalLoanValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart Component */}
                    <LineChart
                        title={t('redeemTrendChart')}
                        subtitle="បង្ហាញពីការកើនឡើងចំនួន Redeem និងតម្លៃឥណទានប្រចាំថ្ងៃ/ខែ"
                        data={chartTrendData}
                        series={[
                            { key: 'redeemCount', label: 'Redeem', color: '#f59e0b', isCurrency: false },
                            { key: 'loanValue', label: 'តម្លៃឥណទាន ($)', color: '#3b82f6', isCurrency: true }
                        ]}
                    />

                    <div className="p-5 bg-white rounded-[5px] border border-slate-200 shadow-xs space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MdPieChart className="text-amber-600 text-lg" />
                            <span>{t('redeemedByBrand')}</span>
                        </h3>
                        <div className="h-56 w-full bg-slate-50 rounded-[5px] p-2 border border-slate-200 flex items-end justify-around gap-4">
                            {summaryBreakdown.rows.map((r) => {
                                const maxVal = Math.max(...summaryBreakdown.rows.map(x => x.totalRedeem), 1);
                                const pct = Math.min(100, Math.max(15, (r.totalRedeem / maxVal) * 100));
                                return (
                                    <div key={r.brand} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{r.brand} ({r.totalRedeem})</span>
                                        <div style={{ height: `${pct}%` }} className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-[5px] shadow-md transition-all"></div>
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
                                <th className='px-4 py-1'>Brand</th>
                                <th className='px-4 py-1 text-center'>Status</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-amber-600 font-semibold">Loading...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No redeem contracts found.</td></tr>
                            ) : (
                                dataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-amber-50/40 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                        <td className='px-4 py-1 font-bold text-slate-900'><CopyCell text={item.customerNameEn || '-'} className='font-bold text-slate-900' /></td>
                                        <td className='px-4 py-1 font-semibold text-slate-800'><CopyCell text={item.model || '-'} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber || '-'} className='font-mono text-emerald-700 font-semibold' /></td>
                                        <td className='px-4 py-1'><span className='px-2.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>{item.brand || user?.brand || 'SYSTEM'}</span></td>
                                        <td className='px-4 py-1 text-center font-bold text-amber-700'>Redeem</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 3: Summary Table */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 bg-white shadow-md p-2 space-y-4'>
                    <div className="border-b border-slate-200 pb-2">
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <MdTableChart className="text-amber-600 text-xl" />
                            <span>{t('summaryTable')}</span>
                        </h3>
                    </div>
                    <div className='w-full overflow-x-auto rounded-[5px] border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-amber-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-1 text-center'>No</th>
                                    <th className='px-3.5 py-1'>Brand Domain</th>
                                    <th className='px-3.5 py-1 text-center'>Total Redeemed Count</th>
                                    <th className='px-3.5 py-1 text-right'>Total Redeemed Loan Value ($)</th>
                                    <th className='px-3.5 py-1 text-center'>Status</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200 font-semibold text-slate-800'>
                                {summaryBreakdown.rows.map((row, idx) => (
                                    <tr key={row.brand} className="hover:bg-amber-50/50 transition-colors">
                                        <td className="px-3.5 py-1 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                        <td className="px-3.5 py-1 font-black text-amber-900">
                                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-bold">
                                                {row.brand}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-1 text-center font-bold text-slate-900">{row.totalRedeem.toLocaleString()}</td>
                                        <td className="px-3.5 py-1 text-right font-mono font-bold text-blue-700">${row.totalLoanValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-1 text-center font-bold text-amber-700">Redeem</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-amber-100/80 border-t-2 border-amber-400 font-black text-amber-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-amber-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.totalRedeem.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-blue-900 font-black">${summaryBreakdown.grandTotal.totalLoanValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-center font-black text-amber-950">Redeem</td>
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

export default RedeemReport;
