import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaUsers, FaCheckCircle, FaLock, FaImage, FaMoneyBillWave, FaExchangeAlt } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

import { useLocation } from 'react-router-dom';

const LIMIT = 10;

const Report = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();
    const location = useLocation();

    const getCategoryFromPath = (path) => {
        if (path.includes('activated')) return 'activated';
        if (path.includes('redeem')) return 'redeem';
        if (path.includes('lock-phone')) return 'lock_device';
        if (path.includes('set-wallpaper')) return 'set_wallpaper';
        if (path.includes('installment')) return 'installment';
        return 'all_customers';
    };

    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeCategory, setActiveCategory] = useState(getCategoryFromPath(location.pathname));

    useEffect(() => {
        setActiveCategory(getCategoryFromPath(location.pathname));
    }, [location.pathname]);

    const fetchReportData = useCallback(async (cat = activeCategory, pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const brandParams = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: pg,
                limit: LIMIT
            });
            if (search) brandParams.set('search', search);

            let endpoint = '';
            if (cat === 'all_customers') {
                endpoint = `${API_BASE}/contracts?${brandParams.toString()}`;
            } else if (cat === 'activated') {
                brandParams.set('status', 'Activated');
                endpoint = `${API_BASE}/contracts?${brandParams.toString()}`;
            } else if (cat === 'redeem') {
                brandParams.set('status', 'Redeem');
                endpoint = `${API_BASE}/contracts?${brandParams.toString()}`;
            } else if (cat === 'lock_device') {
                brandParams.set('action', 'Locked');
                endpoint = `${API_BASE}/phonelogs?${brandParams.toString()}`;
            } else if (cat === 'set_wallpaper') {
                brandParams.set('action', 'Locked');
                endpoint = `${API_BASE}/wallpaperlogs?${brandParams.toString()}`;
            } else if (cat === 'installment') {
                endpoint = `${API_BASE}/payments?${brandParams.toString()}`;
            }

            if (endpoint) {
                const res = await fetch(endpoint);
                if (res.ok) {
                    const result = await res.json();
                    setDataList(result.data || []);
                    setTotal(result.total || result.data?.length || 0);
                }
            }
        } catch (err) {
            console.error('Fetch report data error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE, activeCategory, page, searchTerm, user]);

    useEffect(() => {
        fetchReportData(activeCategory, page, searchTerm);
    }, [activeCategory, page]);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        setPage(1);
    };

    // Excel Export
    const handleExportExcel = () => {
        const exported = dataList.map((item, idx) => ({
            'No': idx + 1,
            'Category': activeCategory.toUpperCase(),
            'Customer Name': item.customerNameEn || item.customerName || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Brand': item.brand || user?.brand || 'SYSTEM',
            'Amount ($)': item.amount || item.monthlyPayment || 0,
            'Status': item.status || item.lockPhoneStatus || 'Completed',
            'Date': item.inputDate || item.date || item.paidDate || ''
        }));
        exportToExcel(exported, `System_${activeCategory}_Report`);
    };

    // Dynamic Brand PDF Export
    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', cell: (r) => r.customerNameEn || r.customerName || '-' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', cell: (r) => r.brand || user?.brand || 'SYSTEM' },
            { header: 'Status / Action', cell: (r) => r.status || r.lockPhoneStatus || r.action || 'Completed' },
            { header: 'Date', cell: (r) => r.inputDate || r.date || r.paidDate || '-' }
        ];

        const reportTitle = `${activeCategory.replace('_', ' ').toUpperCase()} REPORT`;
        exportToPDF(reportTitle, columns, dataList, user?.brand || '');
    };

    // Calculate Summary Stats
    const totalAmount = dataList.reduce((sum, item) => sum + (Number(item.amount) || Number(item.monthlyPayment) || 0), 0);

    return (
        <div className='w-full min-h-screen bg-[#f4f6f8] p-4 select-none space-y-4'>
            
            {/* Header Controls */}
            <header className='p-4 w-full border border-slate-200 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-2xl bg-indigo-600 border border-indigo-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-600/30'>
                        <MdOutlineBarChart />
                    </div>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM MDM'} Report Center
                        </h1>
                        <p className='text-xs text-indigo-700 font-bold font-khmer'>
                            គ្រប់គ្រង និងទាញយករាយការណ៍សង្ខេប Analytics PDF & Excel
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Export Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>Export PDF</span>
                    </button>
                    <button
                        onClick={() => fetchReportData(activeCategory, page, searchTerm)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </header>

            {/* Report Category Selection Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                    { id: 'all_customers', label: 'All Customer', icon: FaUsers },
                    { id: 'activated', label: 'Activated Contracts', icon: FaCheckCircle },
                    { id: 'redeem', label: 'Redeem Contracts', icon: FaExchangeAlt },
                    { id: 'lock_device', label: 'Lock Device History', icon: FaLock },
                    { id: 'set_wallpaper', label: 'Set Wallpaper History', icon: FaImage },
                    { id: 'installment', label: 'Installment Payments', icon: FaMoneyBillWave }
                ].map(cat => {
                    const Icon = cat.icon;
                    const isSel = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryChange(cat.id)}
                            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                isSel
                                    ? 'bg-indigo-600 text-white shadow-md border border-indigo-500'
                                    : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
                            }`}
                        >
                            <Icon size={14} className={isSel ? 'text-white' : 'text-indigo-600'} />
                            <span>{cat.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* 3 Main View Tabs (Dashboard Analytics, Detailed Info, Summary Info) */}
            <div className="flex items-center border-b border-slate-200 bg-white rounded-t-2xl px-3 pt-2 gap-2 shadow-xs">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'dashboard'
                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <MdPieChart size={16} />
                    <span>1. Dashboard (ក្រាប/វិភាគទិន្នន័យ)</span>
                </button>

                <button
                    onClick={() => setActiveTab('detail')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'detail'
                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <MdTableChart size={16} />
                    <span>2. ព័ត៌មានលម្អិត (Detailed Data)</span>
                </button>

                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'summary'
                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <MdOutlineBarChart size={16} />
                    <span>3. ព័ត៌មានសង្ខេប (Summary Table)</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    {/* Key Metrics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Total Records ({activeCategory})</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{total}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
                                {total}
                            </div>
                        </div>

                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Total Financial Amount</p>
                                <h3 className="text-2xl font-black text-emerald-600 mt-1">${totalAmount.toLocaleString()}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                                $
                            </div>
                        </div>

                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Target Brand Domain</p>
                                <h3 className="text-xl font-black text-purple-700 mt-1">{user?.brand || 'GLOBAL ALL'}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold">
                                BRAND
                            </div>
                        </div>
                    </div>

                    {/* Analytics Graph Visual Container */}
                    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MdPieChart className="text-indigo-600 text-lg" />
                            <span>Visual Distribution Graph ({activeCategory.replace('_', ' ').toUpperCase()})</span>
                        </h3>

                        {/* High Performance Responsive SVG Bar Chart */}
                        <div className="h-64 w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-end justify-around gap-4">
                            {dataList.slice(0, 8).map((item, idx) => {
                                const heightPercent = Math.min(100, Math.max(20, ((idx + 1) * 15)));
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <span className="text-[10px] font-bold text-slate-600 font-mono">
                                            {item.model || item.customerNameEn || `#${idx + 1}`}
                                        </span>
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-xl transition-all hover:brightness-110 shadow-md"
                                        ></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Detailed Information Table */}
            {activeTab === 'detail' && (
                <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                    <table className='w-full text-left text-xs whitespace-nowrap'>
                        <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-3 text-center'>No</th>
                                <th className='px-4 py-3'>Customer Name</th>
                                <th className='px-4 py-3'>Model</th>
                                <th className='px-4 py-3'>Serial Number</th>
                                <th className='px-4 py-3'>Brand</th>
                                <th className='px-4 py-3 text-center'>Status / Action</th>
                                <th className='px-4 py-3'>Date</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-indigo-600 font-semibold">Loading Report Data...</td></tr>
                            ) : dataList.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500 italic">No records found for category {activeCategory}.</td></tr>
                            ) : (
                                dataList.map((item, idx) => (
                                    <tr key={item._id || idx} className='hover:bg-indigo-50/40 transition-colors'>
                                        <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                        <td className='px-4 py-3 font-bold text-slate-900'>
                                            <CopyCell text={item.customerNameEn || item.customerName || '-'} className='font-bold text-slate-900' />
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-800'><CopyCell text={item.model || '-'} className='font-semibold text-slate-800' /></td>
                                        <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'><CopyCell text={item.serialNumber || '-'} className='font-mono text-emerald-700 font-semibold' /></td>
                                        <td className='px-4 py-3'>
                                            <span className='px-2.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                                {item.brand || user?.brand || 'SYSTEM'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-center font-bold text-indigo-700'>
                                            {item.status || item.lockPhoneStatus || item.action || 'Completed'}
                                        </td>
                                        <td className='px-4 py-3 font-mono text-slate-600'>
                                            {item.inputDate || item.date || item.paidDate || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 3: Summary Information Table */}
            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md p-4 space-y-4'>
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                        ព័ត៌មានសង្ខេបតាម Brand និង Category (Summary Aggregated Table)
                    </h3>
                    <table className='w-full text-left text-xs'>
                        <thead className='bg-slate-100 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-3'>Brand Domain</th>
                                <th className='px-4 py-3'>Report Category</th>
                                <th className='px-4 py-3 text-center'>Total Count</th>
                                <th className='px-4 py-3 text-center'>Total Financial Value</th>
                                <th className='px-4 py-3 text-center'>System Status</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            <tr className='hover:bg-indigo-50/40 transition-colors'>
                                <td className='px-4 py-3 font-bold text-indigo-700'>{user?.brand || '888MDM'}</td>
                                <td className='px-4 py-3 font-semibold text-slate-800'>{activeCategory.replace('_', ' ').toUpperCase()}</td>
                                <td className='px-4 py-3 text-center font-mono font-bold text-slate-900'>{total} Records</td>
                                <td className='px-4 py-3 text-center font-mono font-bold text-emerald-700'>${totalAmount.toLocaleString()}</td>
                                <td className='px-4 py-3 text-center'>
                                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px]">
                                        ✓ VERIFIED ACTIVE
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'detail' && (
                <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />
            )}
        </div>
    );
};

export default Report;
