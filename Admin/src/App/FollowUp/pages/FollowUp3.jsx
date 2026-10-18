import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import DateRangeDropdown from '../../../components/DateRangeDropdown';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaRegCalendarAlt,
    FaListUl, FaDollarSign, FaFilter,
    FaFileDownload, FaBuilding, FaUserTie,
    FaPhoneAlt, FaMapMarkerAlt, FaExternalLinkAlt,
    FaTag, FaCommentDots, FaGlobe, FaTimes,
    FaComments, FaBolt, FaCheckCircle
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 15;

const FollowUp3 = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Dynamic droplists collected from database
    const [dbDroplists, setDbDroplists] = useState({
        locations: [],
        sources: [],
        collateralTypes: [],
        responders: [],
        usernames: [],
        customerNames: []
    });

    // Summary state
    const [summary, setSummary] = useState({
        totalRecords: 0,
        totalRequestedAmount: 0
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);
    const [filterDate, setFilterDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);

    // Form modal state (Create & Edit)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        customerName: '',
        phone: '',
        location: '',
        source: '',
        requestedAmount: '',
        collateralType: '',
        description: '',
        link: '',
        username: '',
        responder: '',
        brand: user?.brand || 'MDM'
    });
    const [submitting, setSubmitting] = useState(false);

    // Auto-fill match detection state
    const [detectedMatch, setDetectedMatch] = useState(null);
    const [isSearchingMatch, setIsSearchingMatch] = useState(false);

    // Delete modal state
    const [deleteModalItem, setDeleteModalItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'
    const [exportScope, setExportScope] = useState('month'); // 'today' | 'week' | 'month' | 'custom' | 'all'
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const checkPermission = (action) => {
        return hasPermission('/follow-up/follow-up-3', action) || hasPermission('/follow-up/sen-sok', action);
    };

    // Fetch Brands for Admin dropdown
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const brandCat = data.droplists?.find(d => d.category === 'Brands');
                    if (brandCat && Array.isArray(brandCat.items) && brandCat.items.length > 0) {
                        setBrandsList(brandCat.items.map(b => typeof b === 'string' ? b : b.name || String(b)));
                    }
                }
            } catch (err) {
                console.error('Fetch brands error:', err);
            }
        };
        fetchBrands();
    }, [API_BASE]);

    // Fetch dynamic droplist suggestions from server
    const fetchDroplists = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/follow-up-3/droplists`).catch(() => fetch(`${API_BASE}/follow-up-sen-sok/droplists`));
            if (res && res.ok) {
                const data = await res.json();
                setDbDroplists({
                    locations: data.locations || [],
                    sources: data.sources || [],
                    collateralTypes: data.collateralTypes || [],
                    responders: data.responders || [],
                    usernames: data.usernames || [],
                    customerNames: data.customerNames || []
                });
            }
        } catch (err) {
            console.error('Fetch droplists error:', err);
        }
    }, [API_BASE]);

    useEffect(() => {
        fetchDroplists();
    }, [fetchDroplists]);

    // Merge DB droplists with current table data
    const dynamicSuggestions = useMemo(() => {
        const locationsSet = new Set([...dbDroplists.locations]);
        const sourcesSet = new Set([...dbDroplists.sources]);
        const collateralsSet = new Set([...dbDroplists.collateralTypes]);
        const respondersSet = new Set([...dbDroplists.responders]);
        const usernamesSet = new Set([...dbDroplists.usernames]);
        const customerNamesSet = new Set([...dbDroplists.customerNames]);

        dataList.forEach(item => {
            if (item.location?.trim()) locationsSet.add(item.location.trim());
            if (item.source?.trim()) sourcesSet.add(item.source.trim());
            if (item.collateralType?.trim()) collateralsSet.add(item.collateralType.trim());
            if (item.responder?.trim()) respondersSet.add(item.responder.trim());
            if (item.username?.trim()) usernamesSet.add(item.username.trim());
            if (item.customerName?.trim()) customerNamesSet.add(item.customerName.trim());
        });

        return {
            locations: Array.from(locationsSet).filter(Boolean),
            sources: Array.from(sourcesSet).filter(Boolean),
            collateralTypes: Array.from(collateralsSet).filter(Boolean),
            responders: Array.from(respondersSet).filter(Boolean),
            usernames: Array.from(usernamesSet).filter(Boolean),
            customerNames: Array.from(customerNamesSet).filter(Boolean)
        };
    }, [dbDroplists, dataList]);

    // Fetch Follow Up 3 data
    const fetchData = useCallback(async (targetPage = 1, isManualReload = false) => {
        if (isManualReload) setReloading(true);
        else setLoading(true);

        try {
            const params = new URLSearchParams({
                page: targetPage,
                limit: LIMIT,
                username: user?.username || '',
                userRole: user?.role || '',
                userBrand: user?.brand || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });

            if (searchTerm.trim()) params.append('search', searchTerm.trim());
            if (filterDate) params.append('date', filterDate);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (selectedBrand) params.append('brand', selectedBrand);

            let res = await fetch(`${API_BASE}/follow-up-3?${params.toString()}`);
            if (!res.ok) {
                res = await fetch(`${API_BASE}/follow-up-sen-sok?${params.toString()}`);
            }
            if (!res.ok) throw new Error('Failed to fetch data');
            const resJson = await res.json();

            setDataList(resJson.data || []);
            setTotal(resJson.total || 0);
            setPage(resJson.page || targetPage);
            if (resJson.summary) {
                setSummary(resJson.summary);
            }
        } catch (err) {
            console.error('Fetch follow up 3 data error:', err);
        } finally {
            setLoading(false);
            setReloading(false);
        }
    }, [API_BASE, user, searchTerm, filterDate, startDate, endDate, selectedBrand]);

    useEffect(() => {
        fetchData(1);
    }, [fetchData]);

    const handlePageChange = (newPage) => {
        fetchData(newPage);
    };

    // Open Create Modal - All fields empty by default
    const handleOpenCreate = () => {
        setEditingItem(null);
        setDetectedMatch(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            customerName: '',
            phone: '',
            location: '',
            source: '',
            requestedAmount: '',
            collateralType: '',
            description: '',
            link: '',
            username: '',
            responder: '',
            brand: user?.brand || 'MDM'
        });
        setIsFormOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setDetectedMatch(null);
        setFormData({
            date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
            customerName: item.customerName || '',
            phone: item.phone || '',
            location: item.location || '',
            source: item.source || '',
            requestedAmount: item.requestedAmount !== undefined && item.requestedAmount !== '' ? item.requestedAmount : '',
            collateralType: item.collateralType || '',
            description: item.description || '',
            link: item.link || '',
            username: item.username || '',
            responder: item.responder || '',
            brand: item.brand || user?.brand || 'MDM'
        });
        setIsFormOpen(true);
    };

    // Real-time live auto-detection search
    const checkForExistingMatch = useCallback(async (queryName, queryPhone) => {
        const cleanName = queryName ? queryName.trim().toLowerCase() : '';
        const cleanPhone = queryPhone ? queryPhone.trim().replace(/\D/g, '') : '';

        if (!cleanName && !cleanPhone) {
            setDetectedMatch(null);
            return;
        }

        // 1. Check local loaded records first
        const localMatch = dataList.find(item => {
            if (editingItem && (item._id === editingItem._id || item.followUpId === editingItem.followUpId)) return false;
            const itemPhoneClean = (item.phone || '').replace(/\D/g, '');
            const itemNameClean = (item.customerName || '').trim().toLowerCase();

            if (cleanPhone && cleanPhone.length >= 7 && itemPhoneClean.includes(cleanPhone)) return true;
            if (cleanName && cleanName.length >= 2 && itemNameClean === cleanName) return true;
            return false;
        });

        if (localMatch) {
            setDetectedMatch(localMatch);
            return;
        }

        // 2. Fetch from backend search API
        const searchTerm = cleanPhone.length >= 7 ? cleanPhone : (cleanName.length >= 2 ? cleanName : '');
        if (!searchTerm) {
            setDetectedMatch(null);
            return;
        }

        setIsSearchingMatch(true);
        try {
            const res = await fetch(`${API_BASE}/follow-up-3?search=${encodeURIComponent(searchTerm)}&limit=5`)
                .catch(() => fetch(`${API_BASE}/follow-up-sen-sok?search=${encodeURIComponent(searchTerm)}&limit=5`));
            if (res && res.ok) {
                const resJson = await res.json();
                const matches = resJson.data || [];
                const found = matches.find(m => !editingItem || (m._id !== editingItem._id && m.followUpId !== editingItem.followUpId));
                setDetectedMatch(found || null);
            }
        } catch {
            // Ignore search error
        } finally {
            setIsSearchingMatch(false);
        }
    }, [API_BASE, dataList, editingItem]);

    // Handle input change and trigger auto-match check
    const handleFieldChange = (field, value) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);

        if (field === 'customerName' || field === 'phone') {
            checkForExistingMatch(
                field === 'customerName' ? value : formData.customerName,
                field === 'phone' ? value : formData.phone
            );
        }
    };

    // Auto-fill form from detected match
    const handleAutoFill = (matchRecord) => {
        if (!matchRecord) return;
        setFormData(prev => ({
            ...prev,
            customerName: matchRecord.customerName || prev.customerName,
            phone: matchRecord.phone || prev.phone,
            location: matchRecord.location || prev.location,
            source: matchRecord.source || prev.source,
            requestedAmount: matchRecord.requestedAmount !== undefined && matchRecord.requestedAmount !== '' ? matchRecord.requestedAmount : prev.requestedAmount,
            collateralType: matchRecord.collateralType || prev.collateralType,
            description: matchRecord.description || prev.description,
            link: matchRecord.link || prev.link,
            username: matchRecord.username || prev.username,
            responder: matchRecord.responder || prev.responder,
            brand: matchRecord.brand || prev.brand
        }));
        setDetectedMatch(null);
    };

    // Handle Form Submit (Create / Edit)
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.customerName.trim()) {
            alert(t('customerName'));
            return;
        }

        setSubmitting(true);
        try {
            const url = editingItem
                ? `${API_BASE}/follow-up-3/${editingItem._id || editingItem.followUpId}?username=${encodeURIComponent(user?.username || '')}`
                : `${API_BASE}/follow-up-3`;
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                requestedAmount: Number(formData.requestedAmount) || 0
            };

            let res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok && url.includes('/follow-up-3')) {
                const fallbackUrl = editingItem
                    ? `${API_BASE}/follow-up-sen-sok/${editingItem._id || editingItem.followUpId}?username=${encodeURIComponent(user?.username || '')}`
                    : `${API_BASE}/follow-up-sen-sok`;
                res = await fetch(fallbackUrl, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to save record');
            }

            setIsFormOpen(false);
            fetchData(page);
            fetchDroplists();
        } catch (err) {
            console.error('Submit form error:', err);
            alert(`${t('error')}: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Delete Record
    const confirmDelete = async () => {
        if (!deleteModalItem) return;
        setDeleting(true);
        try {
            let res = await fetch(`${API_BASE}/follow-up-3/${deleteModalItem._id || deleteModalItem.followUpId}?username=${encodeURIComponent(user?.username || '')}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                res = await fetch(`${API_BASE}/follow-up-sen-sok/${deleteModalItem._id || deleteModalItem.followUpId}?username=${encodeURIComponent(user?.username || '')}`, {
                    method: 'DELETE'
                });
            }
            if (!res.ok) throw new Error('Failed to delete');
            setDeleteModalItem(null);
            fetchData(page);
            fetchDroplists();
        } catch (err) {
            console.error('Delete record error:', err);
            alert(`${t('errorDeletingRecord')}: ${err.message}`);
        } finally {
            setDeleting(false);
        }
    };

    // Calculate Date Range helper for Export
    const calculateExportRange = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (exportScope === 'today') {
            return { start: todayStr, end: todayStr, label: `Today (${todayStr})` };
        } else if (exportScope === 'week') {
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            const startStr = startOfWeek.toISOString().split('T')[0];
            return { start: startStr, end: todayStr, label: `This Week (${startStr} to ${todayStr})` };
        } else if (exportScope === 'month') {
            const startStr = `${y}-${m}-01`;
            return { start: startStr, end: todayStr, label: `This Month (${startStr} to ${todayStr})` };
        } else if (exportScope === 'custom') {
            return {
                start: exportStartDate || '',
                end: exportEndDate || '',
                label: `Custom (${exportStartDate || 'Start'} to ${exportEndDate || 'End'})`
            };
        }
        return { start: '', end: '', label: 'All Records' };
    };

    // Execute Export
    const handleExecuteExport = async () => {
        setIsExporting(true);
        try {
            const range = calculateExportRange();
            const params = new URLSearchParams({
                username: user?.username || '',
                userRole: user?.role || '',
                userBrand: user?.brand || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                fetchAll: 'true',
                limit: 10000
            });

            if (range.start) params.append('startDate', range.start);
            if (range.end) params.append('endDate', range.end);
            if (selectedBrand) params.append('brand', selectedBrand);

            let res = await fetch(`${API_BASE}/follow-up-3?${params.toString()}`);
            if (!res.ok) res = await fetch(`${API_BASE}/follow-up-sen-sok?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch export data');
            const resJson = await res.json();
            const items = resJson.data || [];

            if (items.length === 0) {
                alert(t('noFollowUp3DataInSelectedDateRange'));
                setIsExporting(false);
                return;
            }

            const totalAmount = items.reduce((sum, it) => sum + (Number(it.requestedAmount) || 0), 0);

            const exportColumns = [
                { header: '#', accessor: (row, idx) => (row.isGrandTotal ? '★' : String(idx + 1)) },
                { header: t('date'), accessor: (row) => row.date ? row.date.split('T')[0] : '' },
                { header: t('customerName'), accessor: (row) => row.customerName || '' },
                { header: t('phone'), accessor: (row) => row.phone || '' },
                { header: t('location'), accessor: (row) => row.location || '' },
                { header: t('source'), accessor: (row) => row.source || '' },
                {
                    header: `${t('requestedAmount')} ($)`,
                    accessor: (row) => row.requestedAmount !== undefined && row.requestedAmount !== ''
                        ? `$${Number(row.requestedAmount || 0).toLocaleString()}`
                        : ''
                },
                { header: t('collateral'), accessor: (row) => row.collateralType || '' },
                { header: t('description'), accessor: (row) => row.description || '' },
                { header: 'Link', accessor: (row) => row.link || '' },
                { header: t('responder'), accessor: (row) => row.responder || '' },
                { header: 'Username (Staff)', accessor: (row) => row.username || '' },
                { header: 'Brand', accessor: (row) => row.brand || '' }
            ];

            const summaryRow = {
                isGrandTotal: true,
                date: t('grandTotal'),
                customerName: `${t('total')} ${items.length} ${t('people')}`,
                phone: '',
                location: '',
                source: '',
                requestedAmount: totalAmount,
                collateralType: '',
                description: '',
                link: '',
                responder: '',
                username: '',
                brand: ''
            };

            const dataWithSummary = [...items, summaryRow];
            const title = `Follow_Up_3_Report_${new Date().toISOString().split('T')[0]}`;

            if (exportFormat === 'excel') {
                exportToExcel(title, exportColumns, dataWithSummary);
            } else {
                exportToPDF(title, exportColumns, dataWithSummary, user?.brand || '', orientation);
            }

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert(`${t('exportFailed')}: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-2 sm:p-2 space-y-6 max-w-[1600px] mx-auto min-h-screen">
            {/* HTML Datalists for Dynamic Droplists */}
            <datalist id="fu3-location-list">
                {dynamicSuggestions.locations.map((item, i) => (
                    <option key={`loc-${i}`} value={item} />
                ))}
            </datalist>

            <datalist id="fu3-source-list">
                {dynamicSuggestions.sources.map((item, i) => (
                    <option key={`src-${i}`} value={item} />
                ))}
            </datalist>

            <datalist id="fu3-collateral-list">
                {dynamicSuggestions.collateralTypes.map((item, i) => (
                    <option key={`col-${i}`} value={item} />
                ))}
            </datalist>

            <datalist id="fu3-responder-list">
                {dynamicSuggestions.responders.map((item, i) => (
                    <option key={`resp-${i}`} value={item} />
                ))}
            </datalist>

            <datalist id="fu3-username-list">
                {dynamicSuggestions.usernames.map((item, i) => (
                    <option key={`user-${i}`} value={item} />
                ))}
            </datalist>

            <datalist id="fu3-customer-list">
                {dynamicSuggestions.customerNames.map((item, i) => (
                    <option key={`cust-${i}`} value={item} />
                ))}
            </datalist>

            {/* Header Title & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-[5px] border border-slate-100 shadow-sm">
                <div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {t('followUp3')}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                    {/* Export Button */}
                    {checkPermission('export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="px-3.5 py-2 rounded-[5px] border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
                        >
                            <FaFileDownload className="text-sm" />
                            <span>{t('export')}</span>
                        </button>
                    )}

                    {/* Create Button */}
                    {checkPermission('create') && (
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-md shadow-emerald-600/25 cursor-pointer"
                        >
                            <FaPlusCircle className="text-sm" />
                            <span>{t('create')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Metric Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total Leads / Records */}
                <div className="bg-white p-5 rounded-[5px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {t('totalRecords')}
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                                {Number(summary.totalRecords || 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">{t('customersFollowedUp')}</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaListUl />
                        </div>
                    </div>
                </div>

                {/* Total Requested Pawn Amount */}
                <div className="bg-white p-5 rounded-[5px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {t('totalRequestedAmount')}
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                                ${Number(summary.totalRequestedAmount || 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">{t('totalRequestedAmountDescription')}</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-teal-50 text-teal-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaDollarSign />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-2 sm:p-2 rounded-[5px] border border-slate-100 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                    {/* Search Input */}
                    <DatabaseSearchInput
                        apiBase={API_BASE}
                        endpoint="/follow-up-3"
                        params={{
                            username: user?.username || '',
                            userRole: user?.role || '',
                            userBrand: user?.brand || '',
                            isImmutable: user?.isImmutable ? 'true' : 'false',
                            ...(filterDate ? { date: filterDate } : {}),
                            ...(startDate ? { startDate } : {}),
                            ...(endDate ? { endDate } : {}),
                            ...(selectedBrand ? { brand: selectedBrand } : {})
                        }}
                        value={searchTerm}
                        placeholder={t('searchFollowUp3Placeholder')}
                        onChange={(value) => {
                            setSearchTerm(value);
                            setSelectedSearchRecord(null);
                            setPage(1);
                        }}
                        onSelect={(record) => {
                            setSelectedSearchRecord(record);
                            setSearchTerm(record.customerName || record.phone || record.location || '');
                            setPage(1);
                        }}
                        getLabel={(record) => record.customerName || record.phone || record.location || ''}
                        getDescription={(record) => [record.phone, record.date, record.location, record.responder, record.username].filter(Boolean).join(' · ')}
                        className="relative flex-1 w-full"
                    />

                    <DateRangeDropdown
                        from={startDate || filterDate}
                        to={endDate || filterDate}
                        onApplyRange={(from, to) => {
                            setFilterDate('');
                            setStartDate(from);
                            setEndDate(to);
                        }}
                        onClear={() => setFilterDate('')}
                    />

                    {/* Brand Selector for Admin */}
                    {(user?.role === 'Administrator' || user?.role === 'Admin' || user?.isImmutable) && (
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full lg:w-auto px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                        >
                            <option value="">{t('allBrandsShort')}</option>
                            {brandsList.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    )}

                    {/* Filter Action Buttons */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <button
                            onClick={() => fetchData(1)}
                            className="flex-1 lg:flex-none px-4 py-2.5 rounded-[5px] bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                            <FaFilter className="text-xs" />
                            <span>{t('search')}</span>
                        </button>

                        {(searchTerm || filterDate || startDate || endDate || selectedBrand) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedSearchRecord(null);
                                    setPage(1);
                                    setFilterDate('');
                                    setStartDate('');
                                    setEndDate('');
                                    setSelectedBrand('');
                                }}
                                className="px-3 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs sm:text-sm font-bold transition cursor-pointer"
                                title={t('clear')}
                            >
                                <FaTimes />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-[5px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-wider">
                                <th className="py-3.5 px-4 text-center w-12">#</th>
                                <th className="py-3.5 px-4">{t('date')}</th>
                                <th className="py-3.5 px-4">{t('customerName')}</th>
                                <th className="py-3.5 px-4">{t('phone')}</th>
                                <th className="py-3.5 px-4">{t('location')}</th>
                                <th className="py-3.5 px-4">{t('source')}</th>
                                <th className="py-3.5 px-4 text-right">{t('requestedAmount')}</th>
                                <th className="py-3.5 px-4">{t('collateral')}</th>
                                <th className="py-3.5 px-4 min-w-[150px]">{t('description')}</th>
                                <th className="py-3.5 px-4 text-center">{t('link')}</th>
                                <th className="py-3.5 px-4">{t('responder')}</th>
                                <th className="py-3.5 px-4">{t('username')}</th>
                                <th className="py-3.5 px-4 text-center">{t('actionLabel')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="13" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-semibold text-xs">{t('loading')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (selectedSearchRecord ? [selectedSearchRecord] : dataList).length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="py-12 text-center text-slate-400 font-semibold text-xs">
                                        {t('noData')}
                                    </td>
                                </tr>
                            ) : (
                                (selectedSearchRecord ? [selectedSearchRecord] : dataList).map((item, idx) => {
                                    const rowNum = (page - 1) * LIMIT + idx + 1;
                                    return (
                                        <tr key={item._id || item.followUpId || idx} className="hover:bg-slate-50/70 transition">
                                            {/* Index */}
                                            <td className="py-1 px-4 text-center font-bold text-slate-400 text-xs">
                                                {rowNum}
                                            </td>

                                            {/* Date */}
                                            <td className="py-1 px-4 font-semibold text-slate-700 whitespace-nowrap">
                                                {item.date ? item.date.split('T')[0] : '—'}
                                            </td>

                                            {/* Customer Name */}
                                            <td className="py-1 px-4 font-bold text-slate-800 whitespace-nowrap">
                                                <CopyCell text={item.customerName || '—'}>
                                                    <span className="hover:text-emerald-600 transition">{item.customerName || '—'}</span>
                                                </CopyCell>
                                            </td>

                                            {/* Phone */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                {item.phone ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline flex items-center gap-1"
                                                        >
                                                            <FaPhoneAlt className="text-[10px] text-emerald-500" />
                                                            {item.phone}
                                                        </a>
                                                        <CopyCell text={item.phone} />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Location */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                {item.location ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                                                        <FaMapMarkerAlt className="text-[10px]" />
                                                        {item.location}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Source */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                {item.source ? (
                                                    <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                                                        {item.source}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Requested Amount */}
                                            <td className="py-1 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                                {item.requestedAmount !== undefined && item.requestedAmount !== ''
                                                    ? `$${Number(item.requestedAmount || 0).toLocaleString()}`
                                                    : '—'}
                                            </td>

                                            {/* Collateral Type */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">
                                                    {item.collateralType || '—'}
                                                </span>
                                            </td>

                                            {/* Description */}
                                            <td className="py-1 px-4 text-slate-600 max-w-xs break-words text-xs">
                                                {item.description ? (
                                                    <p className="line-clamp-2" title={item.description}>
                                                        {item.description}
                                                    </p>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Link */}
                                            <td className="py-1 px-4 text-center whitespace-nowrap">
                                                {item.link ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <a
                                                            href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition inline-flex items-center gap-1 text-xs font-bold"
                                                            title={item.link}
                                                        >
                                                            <FaExternalLinkAlt className="text-xs" />
                                                            <span>{t('openLink')}</span>
                                                        </a>
                                                        <CopyCell text={item.link} />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Responder (អ្នកឆ្លើយតប) */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                {item.responder ? (
                                                    <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-lg font-bold text-xs">
                                                        <FaComments className="text-indigo-500 text-[11px]" />
                                                        {item.responder}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Username */}
                                            <td className="py-1 px-4 whitespace-nowrap">
                                                {item.username ? (
                                                    <span className="inline-flex items-center gap-1 text-slate-700 font-semibold text-xs">
                                                        <FaUserTie className="text-slate-400 text-[11px]" />
                                                        {item.username}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-1 px-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {checkPermission('edit') && (
                                                        <button
                                                            onClick={() => handleOpenEdit(item)}
                                                            className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition cursor-pointer"
                                                            title={t('edit')}
                                                        >
                                                            <FaEdit className="text-xs" />
                                                        </button>
                                                    )}
                                                    {checkPermission('delete') && (
                                                        <button
                                                            onClick={() => setDeleteModalItem(item)}
                                                            className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                                            title={t('delete')}
                                                        >
                                                            <FaTrashAlt className="text-xs" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!selectedSearchRecord && !loading && total > 0 && (
                    <div className="p-2 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-medium">
                            {t('showing')} <span className="font-bold text-slate-800">{Math.min((page - 1) * LIMIT + 1, total)}</span> - <span className="font-bold text-slate-800">{Math.min(page * LIMIT, total)}</span> {t('auditOf')} <span className="font-bold text-slate-800">{total}</span>
                        </p>
                        <Pagination
                            currentPage={page}
                            totalItems={total}
                            itemsPerPage={LIMIT}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>

            {/* Create & Edit Modal (With flexible droplists / datalists & Auto-Fill Detection) */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-2 overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 sm:p-2 space-y-5 my-8 animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[5px] bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                                    <FaMapMarkerAlt />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">
                                        {editingItem ? t('editFollowUp3') : `${t('create')} ${t('followUp3')}`}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {t('freeTextOrChooseFromDroplist')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* ⚡ Auto-Fill Notification Banner when previous match detected */}
                        {detectedMatch && (
                            <div className="p-2 rounded-[5px] bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                        <FaBolt />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-emerald-900">
                                            {t('existingCustomerRecordFound')}: {detectedMatch.customerName} {detectedMatch.phone ? `(${detectedMatch.phone})` : ''}
                                        </p>
                                        <p className="text-[11px] text-emerald-700 font-medium">
                                            {t('location')}: {detectedMatch.location || '—'} | {t('source')}: {detectedMatch.source || '—'} | {t('collateral')}: {detectedMatch.collateralType || '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleAutoFill(detectedMatch)}
                                        className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <FaCheckCircle className="text-xs" />
                                        <span>{t('autoFill')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDetectedMatch(null)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                        title={t('close')}
                                    >
                                        <FaTimes className="text-xs" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Modal Form */}
                        <form onSubmit={handleSubmitForm} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaRegCalendarAlt className="text-slate-400" />
                                        <span>{t('date')} <span className="text-rose-500">*</span></span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => handleFieldChange('date', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700"
                                    />
                                </div>

                                {/* Customer Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaUserTie className="text-slate-400" />
                                        <span>{t('customerName')} <span className="text-rose-500">*</span></span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        list="fu3-customer-list"
                                        placeholder={t('enterCustomerName')}
                                        value={formData.customerName}
                                        onChange={(e) => handleFieldChange('customerName', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaPhoneAlt className="text-slate-400" />
                                        <span>{t('phone')}</span>
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder={t('phone')}
                                        value={formData.phone}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700"
                                    />
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaMapMarkerAlt className="text-slate-400" />
                                        <span>{t('location')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-location-list"
                                        placeholder={t('typeOrSelectLocation')}
                                        value={formData.location}
                                        onChange={(e) => handleFieldChange('location', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Source */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaGlobe className="text-slate-400" />
                                        <span>{t('source')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-source-list"
                                        placeholder={t('sourceExamplesPlaceholder')}
                                        value={formData.source}
                                        onChange={(e) => handleFieldChange('source', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Requested Amount */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaDollarSign className="text-slate-400" />
                                        <span>{t('requestedAmount')} ($)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder={t('amountExample')}
                                        value={formData.requestedAmount}
                                        onChange={(e) => handleFieldChange('requestedAmount', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-bold text-emerald-700"
                                    />
                                </div>

                                {/* Collateral Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaTag className="text-slate-400" />
                                        <span>{t('collateral')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-collateral-list"
                                        placeholder={t('collateralTypesPlaceholder')}
                                        value={formData.collateralType}
                                        onChange={(e) => handleFieldChange('collateralType', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Responder (អ្នកឆ្លើយតប) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaComments className="text-indigo-500" />
                                        <span>{t('responder')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-responder-list"
                                        placeholder={t('responderNamePlaceholder')}
                                        value={formData.responder}
                                        onChange={(e) => handleFieldChange('responder', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Username */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaUserTie className="text-slate-400" />
                                        <span>{t('username')}</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-username-list"
                                        placeholder={t('staffUsernamePlaceholder')}
                                        value={formData.username}
                                        onChange={(e) => handleFieldChange('username', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>
                            </div>

                            {/* Link */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaExternalLinkAlt className="text-slate-400" />
                                    <span>{t('linkUrlLabel')}</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('linkUrlPlaceholder')}
                                    value={formData.link}
                                    onChange={(e) => handleFieldChange('link', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm text-slate-700"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaCommentDots className="text-slate-400" />
                                    <span>{t('description')}</span>
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder={t('additionalDescriptionOrNotes')}
                                    value={formData.description}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm text-slate-700"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-5 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs sm:text-sm transition cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm transition shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? t('saving') : (editingItem ? t('edit') : t('create'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-[5px] bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto">
                            <FaTrashAlt />
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-lg font-black text-slate-800">{t('confirmDeleteData')}</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {t('deleteIrreversibleForCustomer')}{' '}
                                <strong className="text-slate-800">{deleteModalItem.customerName}</strong>
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalItem(null)}
                                className="flex-1 px-4 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-[5px] bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow-md shadow-rose-600/25 cursor-pointer disabled:opacity-50"
                            >
                                {deleting ? t('deleting') : t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <FaFileDownload className="text-emerald-600" />
                                <span>{t('export')}</span>
                            </h3>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center transition cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Format Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                                {t('exportFormat')}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('excel')}
                                    className={`p-2 rounded-[5px] border flex items-center justify-center gap-2 font-black text-xs transition cursor-pointer ${
                                        exportFormat === 'excel'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <FaFileExcel className="text-emerald-600 text-base" />
                                    <span>{t('exportExcel')} (.xlsx)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('pdf')}
                                    className={`p-2 rounded-[5px] border flex items-center justify-center gap-2 font-black text-xs transition cursor-pointer ${
                                        exportFormat === 'pdf'
                                            ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <MdPictureAsPdf className="text-rose-600 text-base" />
                                    <span>{t('exportPDF')} (.pdf)</span>
                                </button>
                            </div>
                        </div>

                        {/* Scope Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                                {t('timeRangeScope')}
                            </label>
                            <select
                                value={exportScope}
                                onChange={(e) => setExportScope(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="month">{t('thisMonth')}</option>
                                <option value="week">{t('thisWeek')}</option>
                                <option value="today">{t('today')}</option>
                                <option value="all">{t('allTime')}</option>
                                <option value="custom">{t('customRange')}</option>
                            </select>
                        </div>

                        {/* Custom Date Inputs */}
                        {exportScope === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('fromDate')}</label>
                                    <input
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-[5px] border border-slate-200 text-xs text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('toDate')}</label>
                                    <input
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-[5px] border border-slate-200 text-xs text-slate-700"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Export Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={isExporting}
                                onClick={handleExecuteExport}
                                className="px-5 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <FaFileDownload className="text-xs" />
                                <span>{isExporting ? [t('exporting')]: t('exportNow')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp3;
