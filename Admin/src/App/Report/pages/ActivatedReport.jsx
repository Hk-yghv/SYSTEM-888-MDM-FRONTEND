import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineBarChart, MdPictureAsPdf, MdOutlineSync, MdTableChart, MdPieChart } from 'react-icons/md';
import { FaFileExcel, FaCheckCircle } from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 10;

const ActivatedReport = () => {
    const { t } = useLanguage();
    const { API_BASE1, user } = useAuth();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

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

    useEffect(() => {
        fetchData(page, searchTerm);
    }, [page]);

    const fetchAllForExport = async () => {
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
            console.error('Fetch all for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const exported = allData.map((item, idx) => ({
            'No': idx + 1,
            'Customer Name': item.customerNameEn || '',
            'Model': item.model || '',
            'Serial Number': item.serialNumber || '',
            'Brand': item.brand || user?.brand || 'SYSTEM',
            'Monthly Payment ($)': item.monthlyPayment || 0,
            'Status': 'Activated'
        }));
        exportToExcel(exported, 'Activated_Contracts_Report');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Customer', accessor: 'customerNameEn' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Brand', accessor: 'brand' },
            { header: 'Status', cell: () => 'Activated' }
        ];
        exportToPDF('Activated Contracts Report', columns, allData, user?.brand || '');
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            <header className='p-4 w-full border border-slate-200 bg-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-2xl bg-emerald-600 border border-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-600/30'>
                        <FaCheckCircle />
                    </div>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM MDM'} — {t('activatedReport')}
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
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>{t('exportPDF')}</span>
                    </button>
                    <button onClick={() => fetchData(page, searchTerm)} disabled={reloading} className='flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
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

            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                            <p className="text-xs text-slate-500 font-bold uppercase">Total Activated Devices</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{total}</h3>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                            <p className="text-xs text-slate-500 font-bold uppercase">Brand Scope</p>
                            <h3 className="text-xl font-black text-emerald-600 mt-1">{user?.brand || 'GLOBAL ALL'}</h3>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'detail' && (
                <div className='w-full overflow-x-auto h-[calc(100vh-350px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
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

            {activeTab === 'summary' && (
                <div className='w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md p-4 space-y-4'>
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Activated Contracts Summary Table</h3>
                    <table className='w-full text-left text-xs'>
                        <thead className='bg-slate-100 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                            <tr>
                                <th className='px-4 py-3'>Brand Domain</th>
                                <th className='px-4 py-3 text-center'>Total Active Contracts</th>
                                <th className='px-4 py-3 text-center'>System Status</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                            <tr>
                                <td className='px-4 py-3 font-bold text-emerald-700'>{user?.brand || '888MDM'}</td>
                                <td className='px-4 py-3 text-center font-mono font-bold text-slate-900'>{total} Devices</td>
                                <td className='px-4 py-3 text-center'><span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px]">✓ ACTIVE</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'detail' && <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />}
        </div>
    );
};

export default ActivatedReport;
