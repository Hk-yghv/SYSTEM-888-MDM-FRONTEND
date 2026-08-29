import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaMoneyBillWave, FaDollarSign, FaUsers, FaWallet } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 10;

const InstallmentReport = () => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [allPayments, setAllPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

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

            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setDataList(result.data || []);
                setTotal(result.total || 0);
            }
        } catch (err) {
            console.error('Fetch installment report error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE1, page, searchTerm, user]);

    const fetchFullData = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setAllPayments(result.data || []);
            }
        } catch (err) {
            console.error('Fetch full installment report error:', err);
        }
    }, [API_BASE1, user]);

    useEffect(() => {
        fetchData(page, searchTerm);
        fetchFullData();
    }, [page, fetchData, fetchFullData]);

    const fetchAllForExport = async () => {
        if (allPayments.length > 0) return allPayments;
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
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                return result.data || [];
            }
        } catch (err) {
            console.error('Fetch all installment report for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const exported = allData.map((item, idx) => ({
            'No': idx + 1,
            'Customer Name': item.customerName || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Paid Amount ($)': item.amount || 0,
            'Payment Method': item.paymentMethod || '',
            'Paid By': item.paidBy || '',
            'Paid Date': item.paidDate || ''
        }));
        exportToExcel(exported, 'Installment_Payments_Report');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Paid Amount ($)', cell: (r) => `$${r.amount || 0}` },
            { header: 'Paid Date', accessor: 'paidDate' }
        ];
        exportToPDF('Installment Payment Report', columns, allData, user?.brand || '');
    };

    // Calculate brand-level summary from full payment data
    const summaryBreakdown = useMemo(() => {
        const source = allPayments.length > 0 ? allPayments : dataList;
        const brandMap = {};

        source.forEach(p => {
            const b = p.brand || user?.brand || 'SYSTEM';
            if (!brandMap[b]) {
                brandMap[b] = {
                    brand: b,
                    totalTransactions: 0,
                    totalCollected: 0,
                    uniqueCustomers: new Set()
                };
            }
            brandMap[b].totalTransactions += 1;
            brandMap[b].totalCollected += Number(p.amount || 0);
            if (p.customerName || p.serialNumber) {
                brandMap[b].uniqueCustomers.add(p.customerName || p.serialNumber);
            }
        });

        const rows = Object.values(brandMap).map(b => ({
            brand: b.brand,
            totalTransactions: b.totalTransactions,
            totalCollected: b.totalCollected,
            uniqueCustomersCount: b.uniqueCustomers.size
        }));

        const grandTotal = rows.reduce((acc, r) => ({
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalTransactions: acc.totalTransactions + r.totalTransactions,
            totalCollected: acc.totalCollected + r.totalCollected,
            uniqueCustomersCount: acc.uniqueCustomersCount + r.uniqueCustomersCount
        }), {
            brand: 'SUMMARY TOTAL (គ្រប់ Brand)',
            isTotalRow: true,
            totalTransactions: 0,
            totalCollected: 0,
            uniqueCustomersCount: 0
        });

        return { rows, grandTotal };
    }, [allPayments, dataList, user]);

    // KPI
    const kpi = useMemo(() => {
        const source = allPayments.length > 0 ? allPayments : dataList;
        const totalTransactions = source.length;
        const totalCollected = source.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const avgPayment = totalTransactions > 0 ? totalCollected / totalTransactions : 0;
        const uniqueCustomers = new Set(source.map(p => p.customerName || p.serialNumber).filter(Boolean)).size;
        return { totalTransactions, totalCollected, avgPayment, uniqueCustomers };
    }, [allPayments, dataList]);

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-4 w-full border border-slate-200 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-2xl bg-emerald-600 border border-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-600/30'>
                        <FaMoneyBillWave />
                    </div>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM MDM'} — {t('installmentReport')}
                        </h1>
                        <p className='text-xs text-emerald-700 font-bold'>
                            {t('installmentReport')} ({total})
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>{t('exportExcel')}</span>
                    </button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>{t('exportPDF')}</span>
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
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg">
                                <FaWallet />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Transactions</p>
                                <h3 className="text-lg font-black text-slate-900 mt-0.5">{kpi.totalTransactions.toLocaleString()}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-lg">
                                <FaDollarSign />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Revenue Collected ($)</p>
                                <h3 className="text-lg font-black text-blue-700 mt-0.5">${kpi.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-lg">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Payment per Tx ($)</p>
                                <h3 className="text-lg font-black text-indigo-700 mt-0.5">${kpi.avgPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg">
                                <FaUsers />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unique Paying Customers</p>
                                <h3 className="text-lg font-black text-amber-700 mt-0.5">{kpi.uniqueCustomers.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart & Revenue Meter */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <MdPieChart className="text-emerald-600 text-lg" />
                                <span>Payment Volume by Brand (ក្រាបទឹកប្រាក់ប្រមូលបានតាម Brand)</span>
                            </h3>
                            <div className="h-56 w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-end justify-around gap-4">
                                {summaryBreakdown.rows.map((r) => {
                                    const maxVal = Math.max(...summaryBreakdown.rows.map(x => x.totalCollected), 1);
                                    const pct = Math.min(100, Math.max(15, (r.totalCollected / maxVal) * 100));
                                    return (
                                        <div key={r.brand} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{r.brand}</span>
                                            <span className="text-[9px] text-emerald-700 font-bold">${r.totalCollected.toFixed(0)}</span>
                                            <div style={{ height: `${pct}%` }} className="w-full bg-gradient-to-t from-emerald-700 to-emerald-400 rounded-t-xl shadow-md transition-all"></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Revenue meter by brand */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <MdOutlineBarChart className="text-blue-600 text-lg" />
                                <span>Revenue Collection Progress per Brand</span>
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-52">
                                {summaryBreakdown.rows.map(r => {
                                    const grandTotal = summaryBreakdown.grandTotal.totalCollected;
                                    const pct = grandTotal > 0 ? Math.round((r.totalCollected / grandTotal) * 100) : 0;
                                    return (
                                        <div key={r.brand}>
                                            <div className="flex justify-between text-xs font-bold mb-1">
                                                <span className="text-slate-700">{r.brand} ({r.totalTransactions} tx)</span>
                                                <span className="text-emerald-800">${r.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pct}%)</span>
                                            </div>
                                            <div className="w-full h-3 bg-emerald-100 rounded-full overflow-hidden">
                                                <div style={{ width: `${pct}%` }} className="h-full bg-emerald-600 rounded-full transition-all"></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Detailed Info */}
            {activeTab === 'detail' && (
                <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-3 text-center'>No</th>
                                <th className='px-4 py-3'>Customer</th>
                                <th className='px-4 py-3'>Model</th>
                                <th className='px-4 py-3'>Serial Number</th>
                                <th className='px-4 py-3 text-center'>Paid Amount</th>
                                <th className='px-4 py-3'>Method</th>
                                <th className='px-4 py-3'>Paid Date</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic">No payment transaction records found.</td></tr>
                            ) : (
                                dataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/40 transition-colors'>
                                        <td className='px-4 py-3 text-center font-mono font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                        <td className='px-4 py-3 font-bold text-slate-900'><CopyCell text={item.customerName || '-'} className='font-bold text-slate-900' /></td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model || '-'} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber || '-'} className='font-mono text-emerald-700 font-semibold' /></td>
                                        <td className='px-4 py-3 text-center font-mono font-black text-emerald-700'>${item.amount || 0}</td>
                                        <td className='px-4 py-3 font-semibold text-slate-700'>{item.paymentMethod || 'Cash'}</td>
                                        <td className='px-4 py-3 font-mono text-slate-600'>{item.paidDate || '-'}</td>
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
                            <span>តារាងសរុបការបង់ប្រាក់រំលស់តាម Brand (Installment Payment Master Summary Table)</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">ចំនួន Transaction ទឹកប្រាក់ប្រមូលបាន និងចំនួនអតិថិជនអ្នកបង់ប្រាក់</p>
                    </div>
                    <div className='w-full overflow-x-auto rounded-xl border border-slate-200 table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-emerald-900 text-white uppercase tracking-wider font-bold text-[11px]'>
                                <tr>
                                    <th className='px-3.5 py-3 text-center'>No</th>
                                    <th className='px-3.5 py-3'>Brand Domain</th>
                                    <th className='px-3.5 py-3 text-center'>Total Transactions</th>
                                    <th className='px-3.5 py-3 text-right text-emerald-200'>Total Revenue Collected ($)</th>
                                    <th className='px-3.5 py-3 text-center'>Unique Paying Customers</th>
                                    <th className='px-3.5 py-3 text-right'>Avg Payment ($)</th>
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
                                        <td className="px-3.5 py-3 text-center font-bold text-slate-900">{row.totalTransactions.toLocaleString()}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-700">${row.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-3.5 py-3 text-center font-bold text-slate-900">{row.uniqueCustomersCount.toLocaleString()}</td>
                                        <td className="px-3.5 py-3 text-right font-mono font-bold text-indigo-700">
                                            ${row.totalTransactions > 0 ? (row.totalCollected / row.totalTransactions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                        </td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-emerald-100/80 border-t-2 border-emerald-400 font-black text-emerald-950">
                                    <td className="px-3.5 py-3.5 text-center font-mono font-black">TOTAL</td>
                                    <td className="px-3.5 py-3.5 uppercase tracking-wide font-black text-emerald-950">
                                        {summaryBreakdown.grandTotal.brand}
                                    </td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.totalTransactions.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-emerald-900 font-black">${summaryBreakdown.grandTotal.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-3.5 py-3.5 text-center text-slate-900 font-black">{summaryBreakdown.grandTotal.uniqueCustomersCount.toLocaleString()}</td>
                                    <td className="px-3.5 py-3.5 text-right font-mono text-indigo-900 font-black">
                                        ${summaryBreakdown.grandTotal.totalTransactions > 0 ? (summaryBreakdown.grandTotal.totalCollected / summaryBreakdown.grandTotal.totalTransactions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                    </td>
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

export default InstallmentReport;
