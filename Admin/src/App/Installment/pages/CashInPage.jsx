import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaPlus, FaTrashAlt,
    FaEdit, FaRegCalendarAlt, FaDollarSign,
    FaMoneyBillWave, FaListUl, FaChartBar, FaImage
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdPieChart, MdTableChart } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import DateRangeDropdown from '../../../components/DateRangeDropdown';
import LineChart from '../../../components/LineChart';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import ImageGalleryModal from '../../../components/ImageGalleryModal';
import { storeImageFiles } from '../../../utils/mediaUtils';
import ImageStorageSelect from '../../../components/ImageStorageSelect';
import InstallmentSubBrandFilter, {
    addInstallmentSubBrandParams,
    useInstallmentSubBrand
} from '../components/InstallmentSubBrandFilter';

const LIMIT = 10;
const getPhotoUrls = (item) => [...new Set([
    ...(Array.isArray(item?.photoUrls) ? item.photoUrls : []),
    ...(item?.photoUrl ? [item.photoUrl] : [])
].filter(Boolean))];

const CashInPage = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';
    const { availableSubBrands, selectedSubBrand, setSelectedSubBrand } = useInstallmentSubBrand(user);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [kpi, setKpi] = useState({ totalUSD: 0, totalKHR: 0, grandTotalUSD: 0, count: 0 });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pdfOrientation, setPdfOrientation] = useState('portrait');
    const [allDataForChart, setAllDataForChart] = useState([]);

    // Form state (Create & Edit)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        currency: 'USD',
        category: 'General Income',
        description: '',
        subBrand: selectedSubBrand !== 'All' ? selectedSubBrand : (user?.subBrands?.[0] || ''),
        contractOR: '',
        photoUrls: []
    });
    const [subBrandOptions, setSubBrandOptions] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageStorageType, setImageStorageType] = useState('cloudinary');
    const [selectedImages, setSelectedImages] = useState([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const visibleDataList = selectedRecord ? [selectedRecord] : dataList;

    useEffect(() => {
        const accountSubBrands = Array.isArray(user?.subBrands)
            ? [...new Set(user.subBrands.map(value => String(value || '').trim()).filter(Boolean))]
            : [];
        if (accountSubBrands.length > 0) {
            setSubBrandOptions(accountSubBrands);
            return;
        }

        let active = true;
        const fetchSubBrands = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (!res.ok) throw new Error(`Failed to fetch subbrands: ${res.status}`);
                const data = await res.json();
                const brandSubBrands = data.brand_subbrands || {};
                const options = user?.brand
                    ? brandSubBrands[user.brand] || []
                    : Object.values(brandSubBrands).flat();
                if (active) setSubBrandOptions([...new Set(options.map(value => String(value || '').trim()).filter(Boolean))]);
            } catch (err) {
                console.error('Fetch cash-in subbrands error:', err);
                if (active) setSubBrandOptions([]);
            }
        };
        fetchSubBrands();
        return () => { active = false; };
    }, [API_BASE, user?.brand, user?.subBrands]);

    useEffect(() => {
        if (!isFormOpen || editingItem || formData.subBrand || subBrandOptions.length === 0) return;
        setFormData(prev => ({ ...prev, subBrand: subBrandOptions[0] }));
    }, [isFormOpen, editingItem, formData.subBrand, subBrandOptions]);

    useEffect(() => {
        if (!isFormOpen || !formData.subBrand || (editingItem && formData.contractOR)) {
            return;
        }

        let active = true;
        const fetchContractORPreview = async () => {
            try {
                const params = new URLSearchParams({ type: 'cash_in', subBrand: formData.subBrand });
                const res = await fetch(`${API_BASE}/cash-transactions/contract-or/next?${params.toString()}`);
                if (!res.ok) {
                    const result = await res.json();
                    throw new Error(result.error || `Failed to preview Contract.OR: ${res.status}`);
                }
                const result = await res.json();
                if (active) {
                    setFormData(prev => prev.contractOR ? prev : { ...prev, contractOR: result.contractOR || '' });
                }
            } catch (err) {
                console.error('Preview cash-in Contract.OR error:', err);
            }
        };
        fetchContractORPreview();
        return () => { active = false; };
    }, [API_BASE, isFormOpen, editingItem, formData.subBrand]);

    const openCreateForm = () => {
        setEditingItem(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: '',
            currency: 'USD',
            category: 'General Income',
            description: '',
            subBrand: selectedSubBrand !== 'All' ? selectedSubBrand : (user?.subBrands?.[0] || ''),
            contractOR: '',
            photoUrls: []
        });
        setIsFormOpen(true);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingImage(true);
        try {
            const uploadedUrls = await storeImageFiles(files, imageStorageType, API_BASE);
            setFormData(prev => ({ ...prev, photoUrls: [...prev.photoUrls, ...uploadedUrls] }));
        } catch (err) {
            console.error('Image upload error:', err);
            alert(`Image upload failed: ${err.message}`);
        } finally {
            e.target.value = '';
            setUploadingImage(false);
        }
    };

    const fetchData = useCallback(async (pg = page, search = searchTerm, sDate = startDate, eDate = endDate) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                type: 'cash_in',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: pg,
                limit: LIMIT
            });
            addInstallmentSubBrandParams(params, user, selectedSubBrand);
            if (search) params.set('search', search);
            if (sDate) params.set('startDate', sDate);
            if (eDate) params.set('endDate', eDate);

            const res = await fetch(`${API_BASE}/cash-transactions?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setDataList(result.data || []);
                setTotal(result.total || 0);
                if (result.kpi) setKpi(result.kpi);
                // Fetch full data for chart (no pagination)
                try {
                    const chartParams = new URLSearchParams({ type: 'cash_in', userBrand: user?.brand || '', userRole: user?.role || '', username: user?.username || '', isImmutable: user?.isImmutable ? 'true' : 'false', page: 1, limit: 999999 });
                    addInstallmentSubBrandParams(chartParams, user, selectedSubBrand);
                    const chartRes = await fetch(`${API_BASE}/cash-transactions?${chartParams.toString()}`);
                    if (chartRes.ok) { const cr = await chartRes.json(); setAllDataForChart(cr.data || []); }
                } catch { }
            }
        } catch (err) {
            console.error('Fetch Cash In error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE, page, searchTerm, startDate, endDate, user, selectedSubBrand]);

    useEffect(() => {
        if (selectedRecord) return;
        fetchData(page, searchTerm, startDate, endDate);
    }, [page, fetchData, searchTerm, startDate, endDate, selectedRecord]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert(t('enterValidAmount'));
            return;
        }
        if (!editingItem && !formData.subBrand) {
            alert('Please select a subbrand to generate Contract.OR.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                type: 'cash_in',
                date: formData.date,
                amount: Number(formData.amount),
                currency: formData.currency,
                category: formData.category,
                description: formData.description,
                photoUrl: formData.photoUrls[0] || '',
                photoUrls: formData.photoUrls,
                subBrand: formData.subBrand,
                contractOR: formData.contractOR,
                performedBy: user?.name || user?.username || 'Admin',
                brand: user?.brand || 'SYSTEM'
            };

            const url = editingItem
                ? `${API_BASE}/cash-transactions/${editingItem._id || editingItem.transactionId}`
                : `${API_BASE}/cash-transactions`;
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsFormOpen(false);
                setEditingItem(null);
                setFormData({
                    date: new Date().toISOString().split('T')[0],
                    amount: '',
                    currency: 'USD',
                    category: 'General Income',
                    description: '',
                    subBrand: selectedSubBrand !== 'All' ? selectedSubBrand : (user?.subBrands?.[0] || ''),
                    contractOR: '',
                    photoUrls: []
                });
                fetchData(1, searchTerm, startDate, endDate);
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to save record.');
            }
        } catch (err) {
            alert('Error saving record: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        const existingPhotos = getPhotoUrls(item);
        setFormData({
            date: item.date || new Date().toISOString().split('T')[0],
            amount: item.amount || '',
            currency: item.currency || 'USD',
            category: item.category || 'General Income',
            description: item.description || '',
            subBrand: item.subBrand || '',
            contractOR: item.contractOR || '',
            photoUrls: existingPhotos
        });
        setIsFormOpen(true);

    };

    const handleDelete = async (item) => {
        if (!window.confirm(t('confirmDelete'))) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/cash-transactions/${item._id || item.transactionId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData(page, searchTerm, startDate, endDate);
            } else {
                alert('Failed to delete record.');
            }
        } catch (err) {
            alert('Delete error: ' + err.message);
        }
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                type: 'cash_in',
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                page: 1,
                limit: 999999
            });
            addInstallmentSubBrandParams(params, user, selectedSubBrand);
            if (searchTerm) params.set('search', searchTerm);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const res = await fetch(`${API_BASE}/cash-transactions?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                return result.data || [];
            }
        } catch (err) {
            console.error('Fetch cash in for export error:', err);
        }
        return dataList;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => allData.length - idx },
            { header: 'Date', accessor: 'date' },
            { header: 'Contract.OR', accessor: 'contractOR' },
            { header: 'Category', accessor: 'category' },
            { header: t('amount'), cell: (r) => r.currency === 'KHR' ? `${r.amount?.toLocaleString()} ៛` : `$${r.amount?.toLocaleString()}` },
            { header: 'Amount USD Est.', cell: (r) => `$${(r.amountUSD || 0).toFixed(2)}` },
            { header: 'Description', accessor: 'description' },
            { header: 'Performed By', accessor: 'performedBy' }
        ];
        exportToExcel(t('cashIn') + ' Report', columns, allData, user?.brand || '');
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => allData.length - idx },
            { header: 'Date', accessor: 'date' },
            { header: 'Contract.OR', accessor: 'contractOR' },
            { header: 'Category', accessor: 'category' },
            { header: t('amount'), cell: (r) => r.currency === 'KHR' ? `${r.amount?.toLocaleString()} ៛` : `$${r.amount?.toLocaleString()}` },
            { header: 'Description', accessor: 'description' },
            { header: 'Performed By', accessor: 'performedBy' }
        ];
        exportToPDF(t('cashIn') + ' Report', columns, allData, user?.brand || '', pdfOrientation);
    };

    // Trend data for chart (group by date)
    const chartTrendData = useMemo(() => {
        const source = allDataForChart.length > 0 ? allDataForChart : dataList;
        const map = {};
        source.forEach(item => {
            const dateStr = (item.date || item.createdAt || '').slice(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = { label: dateStr, count: 0, totalUSD: 0 };
            map[dateStr].count += 1;
            const usd = item.currency === 'KHR' ? (Number(item.amount) || 0) / 4100 : (Number(item.amount) || 0);
            map[dateStr].totalUSD += usd;
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    }, [allDataForChart, dataList]);

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            {/* Header */}
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-xl font-black text-slate-900 flex items-center gap-2 tracking-wide'>
                            {t('cashIn')} ({total})
                        </h1>
                    </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <InstallmentSubBrandFilter availableSubBrands={availableSubBrands} selectedSubBrand={selectedSubBrand} onChange={setSelectedSubBrand} t={t} />
                    <button onClick={openCreateForm} className='flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/20'>
                        <FaPlus className="text-xs" /><span>{t('createCashIn')}</span>
                    </button>
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

            {/* Sub-Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-white rounded-t-[5px] px-3 pt-2 gap-2 shadow-xs">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdPieChart size={16} /><span>1. {t('dashboardAnalytics')}</span>
                </button>
                <button onClick={() => setActiveTab('detail')} className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'detail' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-[5px]' : 'border-transparent text-slate-500'}`}>
                    <MdTableChart size={16} /><span>2. {t('detailedInfo')}</span>
                </button>
            </div>

            {/* Tab 1: Dashboard Analytics */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg">
                                <FaDollarSign />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('totalUsdIncome')}</p>
                                <h3 className="text-lg font-black text-emerald-700 mt-0.5">${kpi.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg font-bold">
                                ៛
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('totalKhrIncome')}</p>
                                <h3 className="text-lg font-black text-amber-700 mt-0.5">{kpi.totalKHR.toLocaleString()} ៛</h3>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-lg">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('totalEstimatedUsd')}</p>
                                <h3 className="text-lg font-black text-indigo-700 mt-0.5">${kpi.grandTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-lg">
                                <FaListUl />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('totalIncomeEntries')}</p>
                                <h3 className="text-lg font-black text-slate-900 mt-0.5">{kpi.count.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Line Chart - Cash In Trend */}
                    <LineChart
                        title={t('cashInTrend')}
                        subtitle={t('cashInTrendSub')}
                        data={chartTrendData}
                        series={[
                            { key: 'count', label: t('cashInTransactionCount'), color: '#10b981', isCurrency: false },
                            { key: 'totalUSD', label: `${t('total')} ($)`, color: '#3b82f6', isCurrency: true }
                        ]}
                    />
                </div>
            )}

            {/* Tab 2: Detail Table & Filter & Form Modal */}
            {activeTab === 'detail' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="p-2 bg-white rounded-[5px] border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <DatabaseSearchInput
                                apiBase={API_BASE}
                                endpoint="cash-transactions"
                                params={{
                                    type: 'cash_in',
                                    userBrand: user?.brand || '',
                                    userRole: user?.role || '',
                                    username: user?.username || '',
                                    isImmutable: user?.isImmutable ? 'true' : 'false',
                                    ...(startDate ? { startDate } : {}),
                                    ...(endDate ? { endDate } : {})
                                }}
                                value={searchTerm}
                                placeholder={t('searchPlaceholder')}
                                className="w-52 sm:w-64"
                                onChange={(value) => {
                                    setSelectedRecord(null);
                                    setSearchTerm(value);
                                    setPage(1);
                                }}
                                onSelect={(record) => {
                                    setSelectedRecord(record);
                                    setLoading(false);
                                    setSearchTerm(record.description || record.category || record.transactionId || record._id || '');
                                    setDataList([record]);
                                    setTotal(1);
                                    setPage(1);
                                }}
                                getLabel={(record) => record.contractOR || record.description || record.category || record.transactionId || record._id}
                                getDescription={(record) => [record.contractOR, record.category, record.date, record.amount && `${record.currency || 'USD'} ${record.amount}`, record.performedBy].filter(Boolean).join(' · ')}
                            />
                            <DateRangeDropdown
                                from={startDate}
                                to={endDate}
                                onApplyRange={(from, to) => { setSelectedRecord(null); setStartDate(from); setEndDate(to); }}
                            />
                        </div>

                        <button onClick={() => setIsFormOpen(true)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[5px] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5">
                            <FaPlus /> <span>{t('createCashIn')}</span>
                        </button>
                    </div>

                    {/* Data Table */}
                    <div className='w-full overflow-x-auto h-[calc(100vh-360px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                        <table className='w-full text-left text-xs whitespace-nowrap'>
                            <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 font-bold'>
                                <tr>
                                    <th className='px-4 py-1 text-center'>{t('no')}</th>
                                    <th className='px-4 py-1'>{t('date')}</th>
                                    <th className='px-4 py-1'>Contract.OR</th>
                                    <th className='px-4 py-1'>{t('category')}</th>
                                    <th className='px-4 py-1 text-right'>{t('amount')}</th>
                                    <th className='px-4 py-1'>{t('description')}</th>
                                    <th className='px-4 py-1 text-center'>{t('receiptPhoto')}</th>
                                    <th className='px-4 py-1'>{t('performedBy')}</th>
                                    <th className='px-4 py-1 text-center'>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                                {loading ? (
                                    <tr><td colSpan={9} className="text-center py-10 text-emerald-600 font-semibold">{t('loading')}</td></tr>
                                ) : visibleDataList.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-8 text-slate-500 italic">{t('noData')}</td></tr>
                                ) : (
                                    visibleDataList.map((item, idx) => (
                                        <tr key={item._id || item.transactionId || idx} className='hover:bg-emerald-50/40 transition-colors'>
                                            <td className='px-4 py-1 text-center font-mono font-bold text-slate-500'>{total - ((page - 1) * LIMIT + idx)}</td>
                                            <td className='px-4 py-1 font-mono font-bold text-slate-900'>{item.date || '-'}</td>
                                            <td className='px-4 py-1 font-mono font-bold text-indigo-700'>{item.contractOR || '-'}</td>
                                            <td className='px-4 py-1 font-bold text-slate-900'>
                                                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold">
                                                    {item.category || 'General'}
                                                </span>
                                            </td>
                                            <td className='px-4 py-1 text-right font-mono font-black text-emerald-700'>
                                                {item.currency === 'KHR' ? `${(item.amount || 0).toLocaleString()} ៛` : `$${(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                            </td>
                                            <td className='px-4 py-1 font-medium text-slate-700 max-w-xs truncate'>{item.description || '-'}</td>
                                            <td className='px-4 py-1 text-center'>
                                                {getPhotoUrls(item).length > 0 ? (
                                                    <button onClick={() => { setSelectedImages(getPhotoUrls(item)); setSelectedImageIndex(0); }} className="text-indigo-600 hover:text-indigo-800 underline font-bold flex items-center justify-center gap-1 mx-auto">
                                                        <FaImage /> <span>View{getPhotoUrls(item).length > 1 ? ` (${getPhotoUrls(item).length})` : ''}</span>
                                                    </button>
                                                ) : <span className="text-slate-400 italic">{t('dashboardNoImage')}</span>}
                                            </td>
                                            <td className='px-4 py-1 font-bold text-slate-800'>{item.performedBy || '-'}</td>
                                            <td className='px-4 py-1 text-center'>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEdit(item)} title={t('edit')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => handleDelete(item)} title={t('delete')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                        <FaTrashAlt />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!selectedRecord && <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />}
                </div>
            )}

            {/* Create & Edit Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 z-999999 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2">
                    <div className="bg-white rounded-[5px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-2 bg-emerald-600 text-white flex items-center justify-between">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <FaPlusCircle /> <span>{editingItem ? [t('edit')]: t('createCashIn')}</span>
                            </h3>
                            <button onClick={() => { setIsFormOpen(false); setEditingItem(null); }} className="text-white hover:text-slate-200 font-bold text-lg cursor-pointer">&times;</button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-5 space-y-3.5 text-xs font-semibold text-slate-700">
                            <div>
                                <label className="block text-slate-700 font-bold mb-1">{t('date')}</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-medium focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-700 font-bold mb-1">Subbrand</label>
                                    <select
                                        value={formData.subBrand}
                                        disabled={Boolean(editingItem?.subBrand)}
                                        required={!editingItem || !editingItem.subBrand}
                                        onChange={(e) => setFormData({ ...formData, subBrand: e.target.value, contractOR: '' })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-medium focus:outline-none focus:border-emerald-500 disabled:opacity-70"
                                    >
                                        <option value="">Select Subbrand</option>
                                        {subBrandOptions.map(subBrand => <option key={subBrand} value={subBrand}>{subBrand}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-700 font-bold mb-1">Contract.OR</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.contractOR}
                                        onChange={(e) => setFormData({ ...formData, contractOR: e.target.value })}
                                        placeholder="Auto-generated"
                                        className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-[5px] font-mono font-bold text-indigo-700"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="block text-slate-700 font-bold mb-1">{t('amount')}</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-bold text-emerald-700 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-700 font-bold mb-1">{t('currency')}</label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="USD">$ USD</option>
                                        <option value="KHR">៛ KHR</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-700 font-bold mb-1">{t('category')}</label>
                                <input
                                    type="text"
                                    placeholder={t('cashInCategoryPlaceholder')}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-medium focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-700 font-bold mb-1">{t('description')}</label>
                                <textarea
                                    rows="2"
                                    placeholder={t('cashInDescriptionPlaceholder')}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-medium focus:outline-none focus:border-emerald-500"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-slate-700 font-bold mb-1">{t('receiptPhoto')}</label>
                                <div className="space-y-2">
                                    <ImageStorageSelect value={imageStorageType} onChange={setImageStorageType} disabled={uploadingImage} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-[5px] file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                    {uploadingImage && <p className="text-[11px] text-emerald-600 font-bold animate-pulse">🔄 {t('uploadingImage')}</p>}
                                    <textarea
                                        rows="2"
                                        placeholder={t('imageUrlsOnePerLine')}
                                        value={formData.photoUrls.join('\n')}
                                        onChange={(e) => setFormData({ ...formData, photoUrls: [...new Set(e.target.value.split(/\r?\n/).map(url => url.trim()).filter(Boolean))] })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[5px] font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                                    />
                                    {formData.photoUrls.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {formData.photoUrls.map((url, index) => (
                                                <div key={`${url}-${index}`} className="relative">
                                                    <img src={url} alt={`Receipt ${index + 1}`} className="h-12 w-12 rounded-lg border border-slate-300 object-cover shadow-xs" />
                                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, photoUrls: prev.photoUrls.filter((_, imageIndex) => imageIndex !== index) }))} aria-label={`Remove image ${index + 1}`} className="absolute -right-1 -top-1 rounded-full bg-white p-1 text-rose-600 shadow">
                                                        <FaTrashAlt size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            <span className="text-[10px] text-emerald-700 font-bold">{formData.photoUrls.length} {t('imagesUploaded')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => { setIsFormOpen(false); setEditingItem(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-[5px] cursor-pointer">
                                    {t('cancel')}
                                </button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[5px] cursor-pointer shadow-md shadow-emerald-600/20">
                                    {submitting ? 'Saving...' : t('submit')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImages.length > 0 && (
                <ImageGalleryModal
                    images={selectedImages}
                    index={selectedImageIndex}
                    onIndexChange={setSelectedImageIndex}
                    onClose={() => setSelectedImages([])}
                    title={t('receiptPhoto')}
                />
            )}
        </div>
    );
};

export default CashInPage;
