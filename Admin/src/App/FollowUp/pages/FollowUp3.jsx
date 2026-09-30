import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaDollarSign, FaFilter,
    FaFileDownload, FaBuilding, FaUserTie,
    FaPhoneAlt, FaMapMarkerAlt, FaExternalLinkAlt,
    FaTag, FaCommentDots, FaGlobe, FaTimes,
    FaComments, FaBolt, FaCheckCircle
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
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
            alert('សូមបញ្ចូលឈ្មោះអតិថិជន (Customer Name)');
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
            alert(`Error: ${err.message}`);
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
            alert(`Error deleting record: ${err.message}`);
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
                alert('No follow up 3 data found in the selected date range to export.');
                setIsExporting(false);
                return;
            }

            const totalAmount = items.reduce((sum, it) => sum + (Number(it.requestedAmount) || 0), 0);

            const exportColumns = [
                { header: '#', accessor: (row, idx) => (row.isGrandTotal ? '★' : String(idx + 1)) },
                { header: 'កាលបរិច្ឆេទ (Date)', accessor: (row) => row.date ? row.date.split('T')[0] : '' },
                { header: 'ឈ្មោះអតិថិជន (Customer Name)', accessor: (row) => row.customerName || '' },
                { header: 'លេខទូរស័ព្ទ (Phone)', accessor: (row) => row.phone || '' },
                { header: 'ទីតាំង (Location)', accessor: (row) => row.location || '' },
                { header: 'តាមរយៈ (Source)', accessor: (row) => row.source || '' },
                {
                    header: 'ចំនួនស្នើបញ្ចាំ ($)',
                    accessor: (row) => row.requestedAmount !== undefined && row.requestedAmount !== ''
                        ? `$${Number(row.requestedAmount || 0).toLocaleString()}`
                        : ''
                },
                { header: 'ប្រភេទទ្រព្យ (Collateral)', accessor: (row) => row.collateralType || '' },
                { header: 'បរិយាយ (Description)', accessor: (row) => row.description || '' },
                { header: 'Link', accessor: (row) => row.link || '' },
                { header: 'អ្នកឆ្លើយតប (Responder)', accessor: (row) => row.responder || '' },
                { header: 'Username (Staff)', accessor: (row) => row.username || '' },
                { header: 'Brand', accessor: (row) => row.brand || '' }
            ];

            const summaryRow = {
                isGrandTotal: true,
                date: 'សរុបរួម (GRAND TOTAL)',
                customerName: `សរុប ${items.length} នាក់`,
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
                exportToPDF(title, exportColumns, dataWithSummary);
            }

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-3 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
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
                            {t('followUp3') || 'Follow up 3'}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                    {/* Reload Button */}
                    <button
                        onClick={() => { fetchData(page, true); fetchDroplists(); }}
                        disabled={reloading || loading}
                        className="px-3.5 py-2 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                        title="Reload Data"
                    >
                        <MdOutlineSync className={`text-base ${reloading ? 'animate-spin text-emerald-600' : ''}`} />
                        <span className="hidden sm:inline">{t('reload') || 'ទាញយកឡើងវិញ'}</span>
                    </button>

                    {/* Export Button */}
                    {checkPermission('export') && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="px-3.5 py-2 rounded-[5px] border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
                        >
                            <FaFileDownload className="text-sm" />
                            <span>{t('export') || 'Export'}</span>
                        </button>
                    )}

                    {/* Create Button */}
                    {checkPermission('create') && (
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-md shadow-emerald-600/25 cursor-pointer"
                        >
                            <FaPlusCircle className="text-sm" />
                            <span>{t('create') || 'បង្កើតថ្មី'}</span>
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
                                {t('totalRecords') || 'ចំនួនទិន្នន័យសរុប (Total Leads)'}
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                                {Number(summary.totalRecords || 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">អតិថិជនបានតាមដាន</p>
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
                                {t('totalRequestedAmount') || 'ចំនួនស្នើបញ្ចាំសរុប ($)'}
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                                ${Number(summary.totalRequestedAmount || 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">ទឹកប្រាក់ស្នើសុំសរុប</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-teal-50 text-teal-600 flex items-center justify-center text-xl group-hover:scale-110 transition">
                            <FaDollarSign />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-[5px] border border-slate-100 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                            placeholder="ស្វែងរកតាម ឈ្មោះ, លេខទូរស័ព្ទ, ទីតាំង, អ្នកឆ្លើយតប, Username, បរិយាយ..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm text-slate-700 bg-slate-50/50 hover:bg-white transition"
                        />
                    </div>

                    {/* Single Date */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => {
                                setFilterDate(e.target.value);
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="w-full lg:w-auto px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="Filter by Specific Date"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setFilterDate('');
                            }}
                            placeholder="ពីថ្ងៃ"
                            className="w-full lg:w-auto px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="Start Date"
                        />
                        <span className="text-slate-400 text-xs font-bold">ដល់</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setFilterDate('');
                            }}
                            placeholder="ដល់ថ្ងៃ"
                            className="w-full lg:w-auto px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                            title="End Date"
                        />
                    </div>

                    {/* Brand Selector for Admin */}
                    {(user?.role === 'Administrator' || user?.role === 'Admin' || user?.isImmutable) && (
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full lg:w-auto px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                        >
                            <option value="">គ្រប់ Brand ទាំងអស់</option>
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
                            <span>ស្វែងរក</span>
                        </button>

                        {(searchTerm || filterDate || startDate || endDate || selectedBrand) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterDate('');
                                    setStartDate('');
                                    setEndDate('');
                                    setSelectedBrand('');
                                }}
                                className="px-3 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs sm:text-sm font-bold transition cursor-pointer"
                                title="Clear Filters"
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
                                <th className="py-3.5 px-4">កាលបរិច្ឆេទ</th>
                                <th className="py-3.5 px-4">ឈ្មោះអតិថិជន</th>
                                <th className="py-3.5 px-4">លេខទូរស័ព្ទ</th>
                                <th className="py-3.5 px-4">ទីតាំង</th>
                                <th className="py-3.5 px-4">តាមរយៈ</th>
                                <th className="py-3.5 px-4 text-right">ចំនួនស្នើបញ្ចាំ</th>
                                <th className="py-3.5 px-4">ប្រភេទទ្រព្យ</th>
                                <th className="py-3.5 px-4 min-w-[150px]">បរិយាយ</th>
                                <th className="py-3.5 px-4 text-center">Link</th>
                                <th className="py-3.5 px-4">អ្នកឆ្លើយតប</th>
                                <th className="py-3.5 px-4">Username</th>
                                <th className="py-3.5 px-4 text-center">សកម្មភាព</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="13" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-semibold text-xs">កំពុងទាញយកទិន្នន័យ...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : dataList.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="py-12 text-center text-slate-400 font-semibold text-xs">
                                        មិនមានទិន្នន័យ Follow Up 3 នៅក្នុងប្រព័ន្ធឡើយ
                                    </td>
                                </tr>
                            ) : (
                                dataList.map((item, idx) => {
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
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition inline-flex items-center gap-1 text-xs font-bold"
                                                            title={item.link}
                                                        >
                                                            <FaExternalLinkAlt className="text-xs" />
                                                            <span>បើក Link</span>
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
                                                            className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition cursor-pointer"
                                                            title="Edit"
                                                        >
                                                            <FaEdit className="text-xs" />
                                                        </button>
                                                    )}
                                                    {checkPermission('delete') && (
                                                        <button
                                                            onClick={() => setDeleteModalItem(item)}
                                                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                                            title="Delete"
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
                {!loading && total > 0 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-medium">
                            បង្ហាញ <span className="font-bold text-slate-800">{Math.min((page - 1) * LIMIT + 1, total)}</span> - <span className="font-bold text-slate-800">{Math.min(page * LIMIT, total)}</span> នៃ <span className="font-bold text-slate-800">{total}</span>
                        </p>
                        <Pagination
                            currentPage={page}
                            totalPages={Math.ceil(total / LIMIT)}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>

            {/* Create & Edit Modal (With flexible droplists / datalists & Auto-Fill Detection) */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 my-8 animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[5px] bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                                    <FaMapMarkerAlt />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">
                                        {editingItem ? 'កែប្រែទិន្នន័យ Follow Up 3' : 'បង្កើត Follow Up 3 ថ្មី'}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        អាចវាយបញ្ចូលដោយសេរី ឬជ្រើសរើសពី Droplist
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
                            <div className="p-3.5 rounded-[5px] bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                        <FaBolt />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-emerald-900">
                                            រកឃើញទិន្នន័យអតិថិជនធ្លាប់បញ្ចូលពីមុន៖ {detectedMatch.customerName} {detectedMatch.phone ? `(${detectedMatch.phone})` : ''}
                                        </p>
                                        <p className="text-[11px] text-emerald-700 font-medium">
                                            ទីតាំង: {detectedMatch.location || '—'} | តាមរយៈ: {detectedMatch.source || '—'} | ប្រភេទទ្រព្យ: {detectedMatch.collateralType || '—'}
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
                                        <span>បំពេញស្វ័យប្រវត្តិ (Auto-fill)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDetectedMatch(null)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                        title="Dismiss"
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
                                        <span>កាលបរិច្ឆេទ <span className="text-rose-500">*</span></span>
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
                                        <span>ឈ្មោះអតិថិជន <span className="text-rose-500">*</span></span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        list="fu3-customer-list"
                                        placeholder="បញ្ចូលឈ្មោះអតិថិជន..."
                                        value={formData.customerName}
                                        onChange={(e) => handleFieldChange('customerName', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaPhoneAlt className="text-slate-400" />
                                        <span>លេខទូរស័ព្ទ</span>
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="012 345 678"
                                        value={formData.phone}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700"
                                    />
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaMapMarkerAlt className="text-slate-400" />
                                        <span>ទីតាំង</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-location-list"
                                        placeholder="វាយបញ្ចូល ឬជ្រើសរើសទីតាំង..."
                                        value={formData.location}
                                        onChange={(e) => handleFieldChange('location', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Source */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaGlobe className="text-slate-400" />
                                        <span>តាមរយៈ (Source)</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-source-list"
                                        placeholder="Facebook, Telegram, Walk-in..."
                                        value={formData.source}
                                        onChange={(e) => handleFieldChange('source', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Requested Amount */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaDollarSign className="text-slate-400" />
                                        <span>ចំនួនស្នើបញ្ចាំ ($)</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="ឧទាហរណ៍: 500"
                                        value={formData.requestedAmount}
                                        onChange={(e) => handleFieldChange('requestedAmount', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-bold text-emerald-700"
                                    />
                                </div>

                                {/* Collateral Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaTag className="text-slate-400" />
                                        <span>ប្រភេទទ្រព្យ</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-collateral-list"
                                        placeholder="ទូរស័ព្ទ, ម៉ូតូ, ឡាន, ប្លង់ដី..."
                                        value={formData.collateralType}
                                        onChange={(e) => handleFieldChange('collateralType', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Responder (អ្នកឆ្លើយតប) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaComments className="text-indigo-500" />
                                        <span>អ្នកឆ្លើយតប</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-responder-list"
                                        placeholder="ឈ្មោះអ្នកឆ្លើយតប..."
                                        value={formData.responder}
                                        onChange={(e) => handleFieldChange('responder', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-semibold text-slate-700 bg-white"
                                    />
                                </div>

                                {/* Username */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <FaUserTie className="text-slate-400" />
                                        <span>Username (អ្នកបញ្ចូល/Staff)</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="fu3-username-list"
                                        placeholder="Staff Username..."
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
                                    <span>Link (Facebook/Telegram/Chat Post URL)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://facebook.com/..."
                                    value={formData.link}
                                    onChange={(e) => handleFieldChange('link', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm text-slate-700"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaCommentDots className="text-slate-400" />
                                    <span>បរិយាយ (Description / Remarks)</span>
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="បញ្ចូលការបរិយាយបន្ថែម ឬចំណាំ..."
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
                                    {t('cancel') || 'បោះបង់'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm transition shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'កំពុងរក្សាទុក...' : (editingItem ? 'កែប្រែទិន្នន័យ' : 'បង្កើតទិន្នន័យ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-[5px] bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto">
                            <FaTrashAlt />
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-lg font-black text-slate-800">តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                ការលុបនេះនឹងមិនអាចយកត្រឡប់មកវិញបានឡើយ សម្រាប់អតិថិជន{' '}
                                <strong className="text-slate-800">{deleteModalItem.customerName}</strong>
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalItem(null)}
                                className="flex-1 px-4 py-2.5 rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer"
                            >
                                {t('cancel') || 'បោះបង់'}
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-[5px] bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow-md shadow-rose-600/25 cursor-pointer disabled:opacity-50"
                            >
                                {deleting ? 'កំពុងលុប...' : (t('delete') || 'លុបចេញ')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <FaFileDownload className="text-emerald-600" />
                                <span>{t('export') || 'Export Follow Up 3'}</span>
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
                                ទម្រង់ឯកសារ (Format)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('excel')}
                                    className={`p-3 rounded-[5px] border flex items-center justify-center gap-2 font-black text-xs transition cursor-pointer ${
                                        exportFormat === 'excel'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <FaFileExcel className="text-emerald-600 text-base" />
                                    <span>Excel (.xlsx)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('pdf')}
                                    className={`p-3 rounded-[5px] border flex items-center justify-center gap-2 font-black text-xs transition cursor-pointer ${
                                        exportFormat === 'pdf'
                                            ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <MdPictureAsPdf className="text-rose-600 text-base" />
                                    <span>PDF (.pdf)</span>
                                </button>
                            </div>
                        </div>

                        {/* Scope Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                                ចន្លោះកាលបរិច្ឆេទ (Scope)
                            </label>
                            <select
                                value={exportScope}
                                onChange={(e) => setExportScope(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-[5px] border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="month">ខែនេះ (This Month)</option>
                                <option value="week">សប្តាហ៍នេះ (This Week)</option>
                                <option value="today">ថ្ងៃនេះ (Today)</option>
                                <option value="all">ទាំងអស់ (All Records)</option>
                                <option value="custom">កំណត់តាមចិត្ត (Custom Range)</option>
                            </select>
                        </div>

                        {/* Custom Date Inputs */}
                        {exportScope === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ពីថ្ងៃ</label>
                                    <input
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-[5px] border border-slate-200 text-xs text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ដល់ថ្ងៃ</label>
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
                                {t('cancel') || 'បោះបង់'}
                            </button>
                            <button
                                type="button"
                                disabled={isExporting}
                                onClick={handleExecuteExport}
                                className="px-5 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <FaFileDownload className="text-xs" />
                                <span>{isExporting ? 'កំពុងទាញយក...' : 'Export ឥឡូវនេះ'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp3;
