import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaChartPie, FaCheckCircle,
    FaTimesCircle, FaDollarSign, FaFilter,
    FaFileDownload, FaBuilding, FaUserTie,
    FaPhoneAlt, FaCoins, FaTags, FaComments,
    FaImage, FaCamera, FaChevronLeft, FaChevronRight,
    FaTimes
} from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf, MdOutlineRateReview, MdOutlineAssignment, MdCall, MdCloudUpload } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

const LIMIT = 15;

const SOURCE_OPTIONS = ['Facebook', 'Telegram', 'TikTok', 'Phone Call', 'Walk-in', 'Instagram', 'Other'];
const COLLATERAL_OPTIONS = ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'];

const FollowUp2 = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Summary state
    const [summary, setSummary] = useState({
        totalRecords: 0,
        totalRequestedAmount: 0,
        totalSuccess: 0,
        totalFailed: 0,
        totalReview: 0,
        successRate: 0
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);
    const [modelsList, setModelsList] = useState([]);

    // Form modal state (Create & Edit)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        customerName: '',
        source: 'Facebook',
        phone: '',
        requestedAmount: '',
        collateralType: 'ទូរស័ព្ទ (Smart Phone)',
        model: '',
        responder: user?.name || user?.username || '',
        date: new Date().toISOString().split('T')[0],
        valuationRange: '',
        status: 'ជោគជ័យ',
        reason: '',
        images: [],
        brand: user?.brand || 'MDM',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);

    // Lightbox / Image Viewer Modal
    const [previewImages, setPreviewImages] = useState([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Selected images state (Pending upload until Submit)
    // Structure: [{ id, type: 'url' | 'file', preview: string, file?: File, url?: string }]
    const [selectedImages, setSelectedImages] = useState([]);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf'
    const [exportScope, setExportScope] = useState('month'); // 'today' | 'week' | 'month' | 'custom' | 'all'
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

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

    // Fetch Models from Control System for dropdown
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const targetBrand = formData.brand || user?.brand || '';
                const res = await fetch(`${API_BASE}/controlsystem?brand=${targetBrand}`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d =>
                        d.category === 'Device Models' ||
                        d.category === 'Devices' ||
                        d.category === 'Models'
                    );
                    if (cat && Array.isArray(cat.items) && cat.items.length > 0) {
                        setModelsList(cat.items.map(m => typeof m === 'string' ? m : m.name || String(m)));
                        return;
                    }
                }

                // Fallback to global models
                const gRes = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (gRes.ok) {
                    const gData = await gRes.json();
                    const gCat = gData.droplists?.find(d =>
                        d.category === 'Device Models' ||
                        d.category === 'Devices' ||
                        d.category === 'Models'
                    );
                    if (gCat && Array.isArray(gCat.items)) {
                        setModelsList(gCat.items.map(m => typeof m === 'string' ? m : m.name || String(m)));
                    }
                }
            } catch (err) {
                console.error('Fetch models error:', err);
            }
        };
        fetchModels();
    }, [API_BASE, formData.brand, user?.brand]);

    // Fetch Follow-up 2 records
    const fetchData = useCallback(async (pg = page, search = searchTerm, sDate = startDate, eDate = endDate, fDate = filterDate, stat = filterStatus, brd = selectedBrand) => {
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

            if (search) params.append('search', search);
            if (fDate) params.append('date', fDate);
            if (sDate) params.append('startDate', sDate);
            if (eDate) params.append('endDate', eDate);
            if (stat) params.append('status', stat);
            if (brd) params.append('brand', brd);

            const res = await fetch(`${API_BASE}/follow-up-2?${params.toString()}`);
            if (res.ok) {
                const jsonRes = await res.json();
                setDataList(jsonRes.data || []);
                setTotal(jsonRes.total || 0);
                if (jsonRes.summary) {
                    setSummary(jsonRes.summary);
                }
            }
        } catch (err) {
            console.error('Fetch follow-up 2 error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 300);
        }
    }, [API_BASE, page, searchTerm, startDate, endDate, filterDate, filterStatus, selectedBrand, user]);

    useEffect(() => {
        fetchData(page);
    }, [fetchData, page]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData(1, searchTerm, startDate, endDate, filterDate, filterStatus, selectedBrand);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterDate('');
        setStartDate('');
        setEndDate('');
        setFilterStatus('');
        setSelectedBrand('');
        setPage(1);
        fetchData(1, '', '', '', '', '', '');
    };

    // Store selected files locally for instant preview without network upload
    const handleMultipleImageSelection = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files || files.length === 0) return;

        const newItems = files.map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            type: 'file',
            preview: URL.createObjectURL(file),
            file
        }));

        setSelectedImages(prev => [...prev, ...newItems]);
        e.target.value = ''; // Reset input to allow selecting the same file again if needed
    };

    const handleRemoveSelectedImage = (indexToRemove) => {
        setSelectedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // Open Lightbox Viewer
    const handleOpenImageViewer = (imagesList, startIndex = 0) => {
        if (!imagesList || imagesList.length === 0) return;
        setPreviewImages(imagesList);
        setPreviewIndex(startIndex);
        setIsPreviewOpen(true);
    };

    // Form Handlers
    const handleOpenCreate = () => {
        setEditingItem(null);
        setSelectedImages([]);
        setFormData({
            customerName: '',
            source: 'Facebook',
            phone: '',
            requestedAmount: '',
            collateralType: 'ទូរស័ព្ទ (Smart Phone)',
            model: '',
            responder: user?.name || user?.username || '',
            date: new Date().toISOString().split('T')[0],
            valuationRange: '',
            status: 'ជោគជ័យ',
            reason: '',
            images: [],
            brand: user?.brand || 'MDM',
            notes: ''
        });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        const existingImgs = Array.isArray(item.images) ? item.images : (item.images ? [item.images] : []);
        setSelectedImages(existingImgs.map(url => ({
            id: url,
            type: 'url',
            preview: url,
            url
        })));
        setFormData({
            customerName: item.customerName || '',
            source: item.source || 'Facebook',
            phone: item.phone || '',
            requestedAmount: item.requestedAmount !== undefined ? item.requestedAmount : '',
            collateralType: item.collateralType || 'ទូរស័ព្ទ (Smart Phone)',
            model: item.model || '',
            responder: item.responder || user?.name || user?.username || '',
            date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
            valuationRange: item.valuationRange || '',
            status: item.status || 'ជោគជ័យ',
            reason: item.reason || '',
            images: existingImgs,
            brand: item.brand || user?.brand || 'MDM',
            notes: item.notes || ''
        });
        setIsFormOpen(true);
    };

    // Upload pending local files to Cloudinary on Submit
    const uploadImagesToCloudinary = async (items) => {
        const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD || 'demo';
        const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.VITE_CLOUDINARY_PRESET || 'ml_default';

        const finalUrls = [];

        for (const item of items) {
            if (item.type === 'url' && item.url) {
                finalUrls.push(item.url);
            } else if (item.type === 'file' && item.file) {
                try {
                    const bodyData = new FormData();
                    bodyData.append('file', item.file);
                    bodyData.append('upload_preset', CLOUDINARY_PRESET);

                    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
                        method: 'POST',
                        body: bodyData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        finalUrls.push(data.secure_url);
                    } else {
                        // Fallback to Base64
                        const b64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(item.file);
                        });
                        finalUrls.push(b64);
                    }
                } catch (err) {
                    console.warn('Cloudinary upload error, using fallback:', err);
                    const b64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(item.file);
                    });
                    finalUrls.push(b64);
                }
            }
        }

        return finalUrls;
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerName.trim()) {
            alert('Please enter Customer Name (សូមបញ្ចូល ឈ្មោះអតិថិជន)');
            return;
        }

        setSubmitting(true);
        setUploadingImages(true);
        try {
            // Upload local images to Cloudinary now on submit
            const uploadedUrls = await uploadImagesToCloudinary(selectedImages);

            const url = editingItem
                ? `${API_BASE}/follow-up-2/${editingItem._id}`
                : `${API_BASE}/follow-up-2`;
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                requestedAmount: Number(formData.requestedAmount) || 0,
                images: uploadedUrls,
                brand: formData.brand || user?.brand || 'MDM',
                createdBy: user?.name || user?.username || 'Staff',
                username: user?.username || ''
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsFormOpen(false);
                setEditingItem(null);
                setSelectedImages([]);
                fetchData(page);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.message || 'Error saving follow-up 2 record');
            }
        } catch (err) {
            console.error('Save follow up 2 error:', err);
            alert('Network error while saving follow-up 2');
        } finally {
            setSubmitting(false);
            setUploadingImages(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`Are you sure you want to delete entry for customer: ${item.customerName}?`)) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/follow-up-2/${item._id}?username=${encodeURIComponent(user?.username || '')}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData(page);
            } else {
                alert('Failed to delete record');
            }
        } catch (err) {
            console.error('Delete follow up 2 error:', err);
        }
    };

    // Group records by date for daily subtotal rendering & grand total calculation
    const groupedDateList = useMemo(() => {
        if (!dataList || dataList.length === 0) return [];

        const map = new Map();

        dataList.forEach(item => {
            const d = item.date ? item.date.split('T')[0] : 'N/A';

            if (!map.has(d)) {
                map.set(d, []);
            }

            map.get(d).push(item);
        });

        const result = [];

        map.forEach((items, dateKey) => {
            const dayTotalAmount = items.reduce(
                (s, it) => s + (Number(it.requestedAmount) || 0),
                0
            );

            const daySuccess = items.filter(
                it => it.status === 'ជោគជ័យ' || it.status === 'Success'
            ).length;

            const dayFailed = items.filter(
                it => it.status === 'បរាជ័យ' || it.status === 'Failed'
            ).length;

            // ✅ Review
            const dayReview = items.filter(
                item =>
                    item.status === 'Review' ||
                    item.status === 'review' ||
                    item.status === 'ពិនិត្យ' ||
                    item.status === 'កំពុងពិនិត្យ'
            ).length;

            const dayRate =
                items.length > 0
                    ? ((daySuccess / items.length) * 100).toFixed(1)
                    : '0.0';

            result.push({
                date: dateKey,
                items,
                summary: {
                    count: items.length,
                    totalAmount: dayTotalAmount,
                    success: daySuccess,
                    failed: dayFailed,
                    review: dayReview,

                    successRate: dayRate
                }
            });
        });

        return result;
    }, [dataList]);

    // Open Export Props Modal
    const handleOpenExportModal = (format = 'excel') => {
        setExportFormat(format);
        const todayStr = new Date().toISOString().split('T')[0];
        setExportStartDate(todayStr);
        setExportEndDate(todayStr);
        setIsExportModalOpen(true);
    };

    // Calculate dates helper for Export Scope
    const getDateRangeForScope = (scope) => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (scope === 'today') {
            return { start: todayStr, end: todayStr, label: 'Today (ថ្ងៃនេះ)' };
        } else if (scope === 'week') {
            const d = new Date(now);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            return {
                start: monday.toISOString().split('T')[0],
                end: sunday.toISOString().split('T')[0],
                label: 'This Week (សប្តាហ៍នេះ)'
            };
        } else if (scope === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: firstDay.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0],
                label: 'This Month (ខែនេះ)'
            };
        } else if (scope === 'custom') {
            return {
                start: exportStartDate || todayStr,
                end: exportEndDate || todayStr,
                label: `Custom: ${exportStartDate || todayStr} to ${exportEndDate || todayStr}`
            };
        }
        return { start: '', end: '', label: 'All Time (ទាំងអស់)' };
    };

    // Execute Export from Modal
    const handleConfirmExport = async () => {
        setIsExporting(true);
        try {
            const range = getDateRangeForScope(exportScope);
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                fetchAll: 'true',
                limit: 10000
            });

            if (range.start) params.append('startDate', range.start);
            if (range.end) params.append('endDate', range.end);
            if (filterStatus) params.append('status', filterStatus);
            if (selectedBrand) params.append('brand', selectedBrand);

            const res = await fetch(`${API_BASE}/follow-up-2?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch export data');
            const resJson = await res.json();
            const items = resJson.data || [];

            if (items.length === 0) {
                alert('No follow up 2 data found in the selected date range to export.');
                setIsExporting(false);
                return;
            }

            // Calculate Grand Totals for the Export
            const totalAmount = items.reduce((sum, it) => sum + (Number(it.requestedAmount) || 0), 0);
            const totalSucc = items.filter(it => it.status === 'ជោគជ័យ' || it.status === 'Success').length;
            const totalFail = items.filter(it => it.status === 'បរាជ័យ' || it.status === 'Failed').length;
            const overallRate = items.length > 0 ? ((totalSucc / items.length) * 100).toFixed(1) : '0.0';

            // Define Export Table Columns
            const exportColumns = [
                { header: '#', accessor: (row, idx) => (row.isGrandTotal ? '★' : row.isDailyTotal ? '—' : String(idx + 1)) },
                { header: 'Customer Name (ឈ្មោះអតិថិជន)', accessor: (row) => row.customerName || '' },
                { header: 'Source (តាមរយៈ)', accessor: (row) => row.source || '' },
                { header: 'Tel (លេខទូរស័ព្ទ)', accessor: (row) => row.phone || '' },
                {
                    header: 'ចំនួនស្នើបញ្ចាំ ($)',
                    accessor: (row) => row.requestedAmount !== undefined && row.requestedAmount !== ''
                        ? `$${Number(row.requestedAmount || 0).toLocaleString()}`
                        : ''
                },
                { header: 'ប្រភេទទ្រព្យបញ្ចាំ', accessor: (row) => row.collateralType || '' },
                { header: 'Model (ម៉ូឌែល)', accessor: (row) => row.model || '' },
                { header: 'អ្នកឆ្លើយតបឆាត', accessor: (row) => row.responder || '' },
                { header: 'កាលបរិច្ឆេទឆ្នាំ', accessor: (row) => row.date ? row.date.split('T')[0] : '' },
                { header: 'វាយតម្លៃបានចន្លោះណាដល់ណា', accessor: (row) => row.valuationRange || '' },
                { header: 'រូបភាព (Photos)', accessor: (row) => (row.isTotalRow ? '' : `${(row.images || []).length} រូប`) },
                { header: 'ស្ថានភាព (Status)', accessor: (row) => row.status || '' },
                { header: 'មូលហេតុ (Reason)', accessor: (row) => row.reason || '' },
                { header: 'Brand', accessor: (row) => row.brand || '' }
            ];

            // Build structured export data with Daily Subtotals and Grand Total
            const exportDataWithTotals = [];
            const exportGroupedMap = new Map();

            items.forEach(it => {
                const dStr = it.date ? it.date.split('T')[0] : 'N/A';
                if (!exportGroupedMap.has(dStr)) exportGroupedMap.set(dStr, []);
                exportGroupedMap.get(dStr).push(it);
            });

            exportGroupedMap.forEach((dayItems, dStr) => {
                // Add day items
                dayItems.forEach(it => exportDataWithTotals.push(it));

                // Add daily subtotal row
                const dAmount = dayItems.reduce((sum, it) => sum + (Number(it.requestedAmount) || 0), 0);
                const dSucc = dayItems.filter(it => it.status === 'ជោគជ័យ' || it.status === 'Success').length;
                const dFail = dayItems.filter(it => it.status === 'បរាជ័យ' || it.status === 'Failed').length;
                const dRate = dayItems.length > 0 ? ((dSucc / dayItems.length) * 100).toFixed(1) : '0.0';

                exportDataWithTotals.push({
                    isTotalRow: true,
                    isDailyTotal: true,
                    customerName: `សរុបប្រចាំថ្ងៃ (${dStr})`,
                    source: `ចំនួន: ${dayItems.length} នាក់`,
                    phone: '',
                    requestedAmount: dAmount,
                    collateralType: '',
                    responder: '',
                    date: dStr,
                    valuationRange: `Success: ${dRate}%`,
                    images: [],
                    status: `ជោគជ័យ: ${dSucc} | បរាជ័យ: ${dFail}`,
                    reason: `Subtotal for ${dStr}`,
                    brand: ''
                });
            });

            // Append Grand Total Row at the bottom
            exportDataWithTotals.push({
                isTotalRow: true,
                isGrandTotal: true,
                customerName: 'សរុបទាំងអស់ (GRAND TOTAL)',
                source: `សរុប: ${items.length} នាក់`,
                phone: '',
                requestedAmount: totalAmount,
                collateralType: '',
                responder: '',
                date: '',
                valuationRange: `Success Rate: ${overallRate}%`,
                images: [],
                status: `ជោគជ័យ: ${totalSucc} | បរាជ័យ: ${totalFail}`,
                reason: 'Grand Summary Totals',
                brand: ''
            });

            const title = `Follow_Up_2_Report_${exportScope}_${range.start || 'all'}_to_${range.end || 'all'}`;

            if (exportFormat === 'excel') {
                exportToExcel(title, exportColumns, exportDataWithTotals, user?.brand || 'SYSTEM');
            } else {
                exportToPDF(title, exportColumns, exportDataWithTotals, user?.brand || 'SYSTEM', 'landscape');
            }

            // Log export event to audit logs
            try {
                fetch(`${API_BASE}/audit-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventType: exportFormat === 'excel' ? 'FOLLOW_UP_2_EXPORT_EXCEL' : 'FOLLOW_UP_2_EXPORT_PDF',
                        action: `Exported Follow-Up 2 (${exportFormat.toUpperCase()}) - ${items.length} records [${range.label}]`,
                        username: user?.username || 'SYSTEM',
                        brand: user?.brand || 'SYSTEM',
                        ip: '127.0.0.1',
                        payload: {
                            format: exportFormat,
                            scope: exportScope,
                            recordCount: items.length,
                            dateRange: range,
                            totalAmount,
                            successCount: totalSucc,
                            failedCount: totalFail,
                            successRate: overallRate
                        }
                    })
                }).catch(() => { });
            } catch (auditErr) {
                console.warn('Audit log trigger error:', auditErr);
            }

            setIsExportModalOpen(false);
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
            {/* Header / Title Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--app-card,#ffffff)] p-5 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                        <FaUserTie size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>Follow up 2</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 font-semibold">
                                {t('followUp2') || 'Follow up 2'}
                            </span>
                        </h1>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <button
                        onClick={() => fetchData(page)}
                        disabled={reloading}
                        className="px-3 py-2 bg-[var(--app-card,#ffffff)] hover:bg-[var(--app-border,#f1f5f9)] text-[var(--app-text,#334155)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                        <MdOutlineSync size={16} className={reloading ? "animate-spin text-indigo-600" : ""} />
                        <span>{t('reload') || 'Reload'}</span>
                    </button>

                    {hasPermission('/follow-up/follow-up-2', 'export') && (
                        <>
                            <button
                                onClick={() => handleOpenExportModal('excel')}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
                            >
                                <FaFileExcel size={15} />
                                <span>{t('exportExcel') || 'Export Excel'}</span>
                            </button>

                            <button
                                onClick={() => handleOpenExportModal('pdf')}
                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
                            >
                                <MdPictureAsPdf size={16} />
                                <span>{t('exportPDF') || 'Export PDF'}</span>
                            </button>
                        </>
                    )}

                    {hasPermission('/follow-up/follow-up-2', 'create') && (
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95 ml-auto md:ml-0"
                        >
                            <FaPlusCircle size={15} />
                            <span>{t('create') || 'Create Entry'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* Total Records */}
                <div className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>កំណត់ត្រាសរុប</span>
                        <FaListUl className="text-indigo-500" size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[var(--app-text,#0f172a)]">
                        {summary.totalRecords.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-indigo-600 mt-1 font-medium">Total Inquiries</span>
                </div>

                {/* Total Loan / Pawn Requested */}
                <div className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('requestedAmount') || 'សរុបស្នើបញ្ចាំ'}</span>
                        <FaDollarSign className="text-amber-500" size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                        ${(summary.totalRequestedAmount || 0).toLocaleString()}
                    </div>
                    <span className="text-[11px] text-amber-600/80 mt-1 font-medium">Requested Amount</span>
                </div>

                {/* Total Success */}
                <div className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalSuccess') || 'សរុបជោគជ័យ'}</span>
                        <FaCheckCircle className="text-emerald-500" size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {summary.totalSuccess.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-emerald-600/80 mt-1 font-medium">Successful Pawns</span>
                </div>

                {/* Total Failed */}
                <div className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('totalFailed') || 'សរុបបរាជ័យ'}</span>
                        <FaTimesCircle className="text-rose-500" size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {summary.totalFailed.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-rose-600/80 mt-1 font-medium">Failed / Cancelled</span>
                </div>

                {/* Success Rate */}
                <div className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between text-[var(--app-text-muted,#64748b)] text-xs font-semibold">
                        <span>{t('successRate') || 'អត្រាជោគជ័យ'}</span>
                        <FaChartPie className="text-sky-500" size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-sky-600 dark:text-sky-400">
                        {summary.successRate}%
                    </div>
                    <span className="text-[11px] text-sky-600/80 mt-1 font-medium">Conversion Rate</span>
                </div>
            </div>

            {/* Filter Controls */}
            <form onSubmit={handleSearchSubmit} className="bg-[var(--app-card,#ffffff)] p-4 rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                        type="text"
                        placeholder="ស្វែងរកតាម ឈ្មោះ, Tel, អ្នកឆ្លើយតប, ទ្រព្យ, មូលហេតុ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                </div>

                {/* Specific Date Filter */}
                <div className="flex items-center gap-1.5 min-w-[140px]">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">កាលបរិច្ឆេទ:</span>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => { setFilterDate(e.target.value); setStartDate(''); setEndDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                </div>

                {/* Date Range Filters */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">ពី:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setFilterDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <span className="text-xs text-[var(--app-text-muted,#64748b)] font-semibold whitespace-nowrap">ដល់:</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setFilterDate(''); }}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 min-w-[120px]">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                        <option value="">ស្ថានភាពទាំងអស់</option>
                        <option value="ជោគជ័យ">ជោគជ័យ</option>
                        <option value="Review">Review (ពិនិត្យ / រង់ចាំពិនិត្យ)</option>
                        <option value="បរាជ័យ">បរាជ័យ</option>
                    </select>
                </div>

                {/* Brand Filter (if Master Admin) */}
                {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                    <div className="flex items-center gap-1.5 min-w-[130px]">
                        <FaBuilding className="text-slate-400" size={13} />
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-2.5 py-1.5 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        >
                            <option value="">{t('allBranches') || 'All Brands'}</option>
                            {brandsList.map((b, idx) => (
                                <option key={idx} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Action Submit */}
                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                        <FaFilter size={12} />
                        <span>{t('filterAuditLogs') || 'Filter'}</span>
                    </button>
                    {(searchTerm || filterDate || startDate || endDate || filterStatus || selectedBrand) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                            សម្អាត
                        </button>
                    )}
                </div>
            </form>

            {/* Main Data Table */}
            <div className="bg-[var(--app-card,#ffffff)] rounded-xl border border-[var(--app-border,#e2e8f0)] shadow-xs overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-[var(--app-border,#e2e8f0)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--app-text,#0f172a)]">បញ្ជីកំណត់ត្រា Follow up 2</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            {total.toLocaleString()} Records
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleOpenExportModal('excel')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Export Excel"
                        >
                            <FaFileExcel size={13} />
                            <span>Export Excel</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOpenExportModal('pdf')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Export PDF"
                        >
                            <MdPictureAsPdf size={14} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-auto h-[calc(100vh-250px)]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--app-bg,#f8fafc)] border-b border-[var(--app-border,#e2e8f0)] text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted,#64748b)]">
                                <th className="py-3 px-3 w-10 text-center">#</th>
                                <th className="py-3 px-4 min-w-[130px]">ឈ្មោះអតិថិជន</th>
                                <th className="py-3 px-3 min-w-[90px]">តាមរយៈ</th>
                                <th className="py-3 px-3 min-w-[100px]">Tel</th>
                                <th className="py-3 px-3 text-right min-w-[100px]">ចំនួនស្នើបញ្ចាំ</th>
                                <th className="py-3 px-3 min-w-[120px]">ប្រភេទទ្រព្យ</th>
                                <th className="py-3 px-3 min-w-[110px]">Model</th>
                                <th className="py-3 px-3 min-w-[90px] text-center">រូបភាព</th>
                                <th className="py-3 px-3 min-w-[110px]">អ្នកឆ្លើយតប</th>
                                <th className="py-3 px-3 min-w-[95px]">កាលបរិច្ឆេទ</th>
                                <th className="py-3 px-3 min-w-[120px]">វាយតម្លៃបាន</th>
                                <th className="py-3 px-3 text-center min-w-[90px]">ស្ថានភាព</th>
                                <th className="py-3 px-4 min-w-[130px]">មូលហេតុ</th>
                                <th className="py-3 px-3 text-center min-w-[80px]">សកម្មភាព</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--app-border,#e2e8f0)] text-xs font-medium text-[var(--app-text,#0f172a)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <MdOutlineSync size={24} className="animate-spin text-indigo-600" />
                                            <span>កំពុងទាញយកទិន្នន័យ Follow up 2...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : dataList.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="py-12 text-center text-slate-400 font-normal">
                                        មិនមានទិន្នន័យ Follow up 2 នៅឡើយទេ! សូមចុចប៊ូតុង "Create Entry" ដើម្បីបញ្ចូលទិន្នន័យថ្មី។
                                    </td>
                                </tr>
                            ) : (
                                (() => {
                                    let runningIndex = (page - 1) * LIMIT;
                                    return groupedDateList.map((group, groupIdx) => (
                                        <React.Fragment key={group.date || groupIdx}>
                                            {group.items.map((item, itemIdx) => {
                                                runningIndex++;
                                                const isSuccess =
                                                    item.status === 'ជោគជ័យ' ||
                                                    item.status === 'Success';

                                                const isReview =
                                                    item.status === 'Review' ||
                                                    item.status === 'review' ||
                                                    item.status === 'ពិនិត្យ' ||
                                                    item.status === 'កំពុងពិនិត្យ';
                                                const amount = Number(item.requestedAmount) || 0;
                                                const imgList = Array.isArray(item.images) ? item.images : (item.images ? [item.images] : []);

                                                return (
                                                    <tr key={item._id || itemIdx} className="hover:bg-slate-500/5 transition-colors">
                                                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                            {runningIndex}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                            {item.customerName || '-'}
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                                {item.source || 'Facebook'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                            {item.phone ? (
                                                                <a href={`tel:${item.phone}`} className="hover:text-emerald-600 flex items-center gap-1">
                                                                    <FaPhoneAlt size={10} className="text-emerald-500" />
                                                                    <span>{item.phone}</span>
                                                                </a>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-extrabold text-amber-600 dark:text-amber-400">
                                                            ${amount.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                                                            {item.collateralType || '-'}
                                                        </td>
                                                        <td className="py-3 px-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                            {item.model || '-'}
                                                        </td>
                                                        {/* Photo thumbnail cell */}
                                                        <td className="py-3 px-3 text-center">
                                                            {imgList.length > 0 ? (
                                                                <div
                                                                    onClick={() => handleOpenImageViewer(imgList, 0)}
                                                                    className="inline-flex items-center gap-1.5 cursor-pointer group p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                                                    title="ចុចដើម្បីមើលរូបភាពធំ"
                                                                >
                                                                    <div className="w-8 h-8 rounded-md overflow-hidden border border-indigo-400 shadow-2xs relative flex-shrink-0 bg-slate-100">
                                                                        <img
                                                                            src={imgList[0]}
                                                                            alt="Collateral"
                                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                                                        />
                                                                        {imgList.length > 1 && (
                                                                            <span className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[9px] font-bold px-1">
                                                                                +{imgList.length - 1}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                                        {imgList.length} រូប
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-[11px]">គ្មាន</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                            {item.responder || '-'}
                                                        </td>
                                                        <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                            {item.date ? item.date.split('T')[0] : 'N/A'}
                                                        </td>
                                                        <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-medium">
                                                            {item.valuationRange || '-'}
                                                        </td>
                                                        <td className="py-3 px-3 text-center whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${isSuccess
                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                                                : isReview
                                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                                                }`}>
                                                                {isSuccess ? (
                                                                    <FaCheckCircle size={10} />
                                                                ) : isReview ? (
                                                                    <MdOutlineRateReview size={12} />
                                                                ) : (
                                                                    <FaTimesCircle size={10} />
                                                                )}
                                                                <span>{item.status || 'ជោគជ័យ'}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                            <p className="line-clamp-2" title={item.reason}>
                                                                {item.reason || '-'}
                                                            </p>
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                {hasPermission('/follow-up/follow-up-2', 'edit') && (
                                                                    <button
                                                                        onClick={() => handleOpenEdit(item)}
                                                                        className="p-1.5 text-amber-600 hover:bg-amber-500/15 rounded-md transition-all cursor-pointer"
                                                                        title="កែប្រែ"
                                                                    >
                                                                        <FaEdit size={14} />
                                                                    </button>
                                                                )}
                                                                {hasPermission('/follow-up/follow-up-2', 'delete') && (
                                                                    <button
                                                                        onClick={() => handleDelete(item)}
                                                                        className="p-1.5 text-rose-600 hover:bg-rose-500/15 rounded-md transition-all cursor-pointer"
                                                                        title="លុប"
                                                                    >
                                                                        <FaTrashAlt size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Total តាមថ្ងៃ (Daily Subtotal Row) */}
                                            <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-[var(--app-border,#e2e8f0)] text-xs font-semibold">
                                                <td colSpan="4" className="py-2.5 px-4 text-slate-500">
                                                    សរុបប្រចាំថ្ងៃ ({group.date})
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                                                    ${(group.summary.totalAmount || 0).toLocaleString()}
                                                </td>
                                                <td
                                                    colSpan="9"
                                                    className="py-2.5 px-3 text-right text-[11px] font-bold text-slate-700 dark:text-slate-300"
                                                >
                                                    ជោគជ័យ:{' '}
                                                    <span className="text-emerald-600 font-extrabold">
                                                        {group.summary.success}
                                                    </span>
                                                    {' '} &bull; {' '}
                                                    បរាជ័យ:{' '}
                                                    <span className="text-rose-600 font-extrabold">
                                                        {group.summary.failed}
                                                    </span>
                                                    {' '} &bull; {' '}
                                                    Review:{' '}
                                                    <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                                                        {group.summary.review || 0}
                                                    </span>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ));
                                })()
                            )}
                        </tbody>

                        {/* Summary Total Sticky/Footer Row */}
                        {dataList.length > 0 && (
                            <tfoot>
                                <tr className="bg-indigo-500/10 dark:bg-indigo-950/40 border-t-2 border-indigo-500/30 text-xs font-bold text-[var(--app-text,#0f172a)]">

                                    <td
                                        colSpan="4"
                                        className="py-3.5 px-4 text-left font-bold text-indigo-800 dark:text-indigo-300"
                                    >
                                        <span className="uppercase tracking-wider">
                                            សរុបទាំងអស់ (Overall Totals):
                                        </span>
                                    </td>

                                    <td className="py-3.5 px-3 text-right font-extrabold text-amber-700 dark:text-amber-300 text-sm">
                                        ${(summary.totalRequestedAmount || 0).toLocaleString()}
                                    </td>

                                    <td
                                        colSpan="6"
                                        className="py-3.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300"
                                    >
                                        ជោគជ័យ:{' '}
                                        <span className="text-emerald-600 font-bold">
                                            {summary.totalSuccess}
                                        </span>

                                        {' '} &bull; {' '}

                                        បរាជ័យ:{' '}
                                        <span className="text-rose-600 font-bold">
                                            {summary.totalFailed}
                                        </span>

                                        {' '} &bull; {' '}

                                        Review:{' '}
                                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                                            {summary.totalReview || 0}
                                        </span>
                                    </td>

                                    <td className="py-3.5 px-3 text-center font-extrabold text-sky-700 dark:text-sky-300 text-sm">
                                        {summary.successRate}%
                                    </td>

                                    <td
                                        colSpan="2"
                                        className="py-3.5 px-4 text-right text-xs text-slate-500 font-semibold"
                                    >
                                        Total Records: {total}
                                    </td>

                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-[var(--app-border,#e2e8f0)] flex items-center justify-between">
                    <span className="text-xs text-[var(--app-text-muted,#64748b)]">
                        បង្ហាញទំព័រ {page} នៃ {Math.ceil(total / LIMIT) || 1} (សរុប {total} កំណត់ត្រា)
                    </span>
                    <Pagination
                        currentPage={page}
                        totalItems={total}
                        limit={LIMIT}
                        onPageChange={(p) => setPage(p)}
                    />
                </div>
            </div>

            {/* Create / Edit Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-500000 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-xl rounded-2xl border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <FaUserTie className="text-indigo-600" size={20} />
                                <span>{editingItem ? 'កែប្រែទិន្នន័យ Follow up 2' : 'បញ្ចូលទិន្នន័យ Follow up 2 ថ្មី'}</span>
                            </h2>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Row 1: ឈ្មោះអតិថិជន & តាមរយៈ */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        ឈ្មោះអតិថិជន <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="បញ្ចូលឈ្មោះអតិថិជន..."
                                        value={formData.customerName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        តាមរយៈ (Source / Channel)
                                    </label>
                                    <input
                                        type="text"
                                        list="sourceList"
                                        placeholder="ឧ. Facebook, Telegram, Walk-in..."
                                        value={formData.source}
                                        onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                    <datalist id="sourceList">
                                        {SOURCE_OPTIONS.map((s, idx) => (
                                            <option key={idx} value={s} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Row 2: Tel & ចំនួនស្នើបញ្ចាំ */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        Tel (លេខទូរស័ព្ទ)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="012 345 678..."
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                                        ចំនួនស្នើបញ្ចាំ ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={formData.requestedAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, requestedAmount: e.target.value }))}
                                        className="w-full px-3 py-2 bg-amber-500/5 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>
                            </div>

                            {/* Row 3: ប្រភេទទ្រព្យបញ្ចាំ & Model ឧបករណ៍ */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        ប្រភេទទ្រព្យបញ្ចាំ
                                    </label>
                                    <input
                                        type="text"
                                        list="collateralList"
                                        placeholder="ឧ. iPhone 15 Pro Max, Click 160..."
                                        value={formData.collateralType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, collateralType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                    <datalist id="collateralList">
                                        {COLLATERAL_OPTIONS.map((c, idx) => (
                                            <option key={idx} value={c} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5 flex items-center justify-between">
                                        <span>Model (ម៉ូឌែលឧបករណ៍)</span>
                                        <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">Control System</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="modelsDatalistOptions"
                                        placeholder="ជ្រើសរើស ឬ វាយបញ្ចូល Model..."
                                        value={formData.model}
                                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                    <datalist id="modelsDatalistOptions">
                                        {modelsList.map((m, idx) => (
                                            <option key={idx} value={m} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Row 4: អ្នកឆ្លើយតបឆាត & វាយតម្លៃបានចន្លោះណាដល់ណា */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        អ្នកឆ្លើយតបឆាត (Responder)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ឈ្មោះបុគ្គលិកឆ្លើយតប..."
                                        value={formData.responder}
                                        onChange={(e) => setFormData(prev => ({ ...prev, responder: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        វាយតម្លៃបានចន្លោះណាដល់ណា
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ឧ. $300 - $450"
                                        value={formData.valuationRange}
                                        onChange={(e) => setFormData(prev => ({ ...prev, valuationRange: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                            </div>

                            {/* Row 5: កាលបរិច្ឆេទឆ្នាំ */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    កាលបរិច្ឆេទឆ្នាំ (Date) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>

                            {/* Multiple Images Upload Box */}
                            <div className="p-3.5 bg-slate-500/5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700/60 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-[var(--app-text,#334155)] flex items-center gap-1.5">
                                        <FaCamera className="text-indigo-600" size={14} />
                                        <span>បញ្ចូលរូបភាពទ្រព្យ/ឯកសារ (អាចជ្រើសរើសបានច្រើនសន្លឹក)</span>
                                    </label>
                                    <span className="text-[11px] font-semibold text-slate-400">
                                        {selectedImages.length} រូបភាព
                                    </span>
                                </div>

                                {/* Custom Upload Button */}
                                <div>
                                    <label className="flex items-center justify-center gap-2 p-3 bg-[var(--app-card,#ffffff)] hover:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-700 rounded-xl cursor-pointer transition-all text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                        <MdCloudUpload size={18} />
                                        <span>ចុចទីនេះដើម្បីជ្រើសរើសរូបភាព (អាចជ្រើសរើសបានច្រើនសន្លឹក)</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleMultipleImageSelection}
                                            className="hidden"
                                            disabled={submitting}
                                        />
                                    </label>
                                </div>

                                {/* Thumbnails Grid */}
                                {selectedImages && selectedImages.length > 0 && (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 pt-2">
                                        {selectedImages.map((imgItem, imgIdx) => (
                                            <div key={imgItem.id || imgIdx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 shadow-2xs">
                                                <img
                                                    src={imgItem.preview}
                                                    alt={`Uploaded ${imgIdx}`}
                                                    className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-200"
                                                    onClick={() => handleOpenImageViewer(selectedImages.map(it => it.preview), imgIdx)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSelectedImage(imgIdx)}
                                                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                                                    title="លុបរូបភាពនេះ"
                                                >
                                                    <FaTimes size={10} />
                                                </button>
                                                {imgItem.type === 'file' && (
                                                    <span className="absolute bottom-1 left-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded shadow-xs">
                                                        New
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Row 5: ស្ថានភាពជោគជ័យឬបរាជ័យ */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    ស្ថានភាព (ជោគជ័យ ឬ បរាជ័យ)
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'ជោគជ័យ' }))}
                                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${formData.status === 'ជោគជ័យ'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)]'
                                            }`}
                                    >
                                        <FaCheckCircle size={15} />
                                        <span>ជោគជ័យ (Success)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData(prev => ({
                                                ...prev,
                                                status: 'Review'
                                            }))
                                        }
                                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${formData.status === 'Review'
                                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)]'
                                            }`}
                                    >
                                        <MdOutlineRateReview size={17} />
                                        <span>Review</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'បរាជ័យ' }))}
                                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${formData.status === 'បរាជ័យ'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)]'
                                            }`}
                                    >
                                        <FaTimesCircle size={15} />
                                        <span>បរាជ័យ (Failed)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                    មូលហេតុ (Reason / Note)
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="បញ្ចូលមូលហេតុ ឬចំណាំផ្សេងៗ..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-medium text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>

                            {/* Brand Selection (if Admin) */}
                            {(!user?.brand || user?.role === 'Administrator' || user?.isImmutable) && (
                                <div>
                                    <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-1.5">
                                        Brand
                                    </label>
                                    <select
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--app-bg,#f8fafc)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-bold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    >
                                        {brandsList.map((b, idx) => (
                                            <option key={idx} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--app-border,#e2e8f0)]">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || uploadingImages}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {(submitting || uploadingImages) && <MdOutlineSync className="animate-spin" size={14} />}
                                    <span>
                                        {uploadingImages ? 'កំពុង Upload រូបភាព...' : (submitting ? 'កំពុងរក្សាទុក...' : (t('submit') || 'Save'))}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Photo Lightbox / Preview Modal */}
            {isPreviewOpen && previewImages.length > 0 && (
                <div className="fixed inset-0 z-5000 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200" >
                    <button
                        onClick={() => setIsPreviewOpen(false)}
                        className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-50"
                        title="Close"
                    >
                        <FaTimes size={20} />
                    </button>

                    <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center">
                        <img
                            src={previewImages[previewIndex]}
                            alt="Preview Full"
                            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/20"
                        />

                        {/* Navigation Arrows if multiple photos */}
                        {previewImages.length > 1 && (
                            <>
                                <button
                                    onClick={() => setPreviewIndex(prev => (prev > 0 ? prev - 1 : previewImages.length - 1))}
                                    className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer border border-white/20 shadow-lg"
                                    title="Previous"
                                >
                                    <FaChevronLeft size={18} />
                                </button>
                                <button
                                    onClick={() => setPreviewIndex(prev => (prev < previewImages.length - 1 ? prev + 1 : 0))}
                                    className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer border border-white/20 shadow-lg"
                                    title="Next"
                                >
                                    <FaChevronRight size={18} />
                                </button>
                            </>
                        )}

                        {/* Counter & Thumbnails Bar */}
                        <div className="mt-4 flex items-center gap-2 overflow-x-auto p-1 bg-black/40 rounded-xl">
                            {previewImages.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    alt={`Thumb ${idx}`}
                                    onClick={() => setPreviewIndex(idx)}
                                    className={`w-12 h-12 object-cover rounded-lg cursor-pointer border-2 transition-all ${previewIndex === idx ? 'border-indigo-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Export Range Props Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-5000 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-[var(--app-card,#ffffff)] w-full max-w-md rounded-2xl border border-[var(--app-border,#e2e8f0)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <FaFileDownload className="text-indigo-600" size={18} />
                                <span>{t('exportScope') || 'ជ្រើសរើសចន្លោះកាលបរិច្ឆេទ Export'}</span>
                            </h2>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-5">
                            {/* Format Selector */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    ទម្រង់ File (Export Format)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('excel')}
                                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'excel'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-emerald-500/10'
                                            }`}
                                    >
                                        <FaFileExcel size={18} />
                                        <span>Excel (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportFormat('pdf')}
                                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${exportFormat === 'pdf'
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-rose-500/10'
                                            }`}
                                    >
                                        <MdPictureAsPdf size={19} />
                                        <span>PDF Report</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scope Radio / Buttons */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--app-text,#334155)] mb-2">
                                    ចន្លោះពេលចង់ Export (Time Range Scope)
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setExportScope('today')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'today'
                                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        📅 {t('byDay') || 'ជាថ្ងៃ (ថ្ងៃនេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('week')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'week'
                                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        🗓️ {t('byWeek') || 'ជាអាទិត្យ (សប្តាហ៍នេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('month')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'month'
                                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        📆 {t('byMonth') || 'ជាខែ (ខែនេះ)'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExportScope('custom')}
                                        className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${exportScope === 'custom'
                                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                            : 'bg-[var(--app-bg,#f8fafc)] border-[var(--app-border,#cbd5e1)] text-[var(--app-text,#334155)] hover:bg-slate-100'
                                            }`}
                                    >
                                        ⚙️ {t('customRange') || 'Custom Range'}
                                    </button>
                                </div>
                            </div>

                            {/* Custom Date Range Picker */}
                            {exportScope === 'custom' && (
                                <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-in fade-in duration-200">
                                    <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                                        ជ្រើសរើសពីថ្ងៃណា ដល់ថ្ងៃណា:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">ពីថ្ងៃ (From):</span>
                                            <input
                                                type="date"
                                                value={exportStartDate}
                                                onChange={(e) => setExportStartDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-[var(--app-card,#ffffff)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[11px] font-semibold text-slate-500 mb-1">ដល់ថ្ងៃ (To):</span>
                                            <input
                                                type="date"
                                                value={exportEndDate}
                                                onChange={(e) => setExportEndDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-[var(--app-card,#ffffff)] border border-[var(--app-border,#cbd5e1)] rounded-lg text-xs font-semibold text-[var(--app-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
                                    <FaCheckCircle size={13} />
                                    <span>របាយការណ៍រួមបញ្ចូលសរុប (Total Row Included)</span>
                                </p>
                                <p className="text-[11px] leading-relaxed">
                                    នៅពេល Export ប្រព័ន្ធនឹងគណនាសរុប (ចំនួនស្នើបញ្ចាំសរុប, ចំនួនជោគជ័យ, ចំនួនបរាជ័យ, Success Rate) នៅពីខាងក្រោមតារាងដោយស្វ័យប្រវត្តិ។
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--app-border,#e2e8f0)] bg-slate-50 dark:bg-slate-800/50">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExport}
                                disabled={isExporting}
                                className={`px-5 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 ${exportFormat === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                            >
                                {isExporting ? (
                                    <>
                                        <MdOutlineSync className="animate-spin" size={15} />
                                        <span>កំពុង Export...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaFileDownload size={14} />
                                        <span>ទាញយករបាយការណ៍ ({exportFormat.toUpperCase()})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp2;
