import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlus,
    FaFileExcel,
    FaFilePdf,
    FaSync,
    FaDollarSign,
    FaCalendarCheck,
    FaCalendarAlt,
    FaReceipt,
    FaEye,
    FaEdit,
    FaTrash,
    FaTimes,
    FaSearch,
    FaFilter,
    FaCloudUploadAlt,
    FaUserTie,
    FaMoneyBillWave,
    FaSave,
    FaCheckCircle,
    FaLock
} from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import SalaryBarChart from '../../../components/SalaryBarChart';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const KHMER_DAYS = ['ថ្ងៃអាទិត្យ', 'ថ្ងៃចន្ទ', 'ថ្ងៃអង្គារ', 'ថ្ងៃពុធ', 'ថ្ងៃព្រហស្បតិ៍', 'ថ្ងៃសុក្រ', 'ថ្ងៃសៅរ៍'];
const KHMER_MONTH_NAMES = [
    'មករា (Jan)', 'កុម្ភៈ (Feb)', 'មីនា (Mar)', 'មេសា (Apr)', 'ឧសភា (May)', 'មិថុនា (Jun)',
    'កក្កដា (Jul)', 'សីហា (Aug)', 'កញ្ញា (Sep)', 'តុលា (Oct)', 'វិច្ឆិកា (Nov)', 'ធ្នូ (Dec)'
];

const getKhmerDateDetails = (dateStr) => {
    if (!dateStr) return { dayName: '—', day: '—', monthName: '—', month: '—', year: '—', formatted: 'មិនទាន់កំណត់' };
    const parts = dateStr.split('-');
    if (parts.length < 3) return { dayName: '—', day: '—', monthName: '—', month: '—', year: '—', formatted: dateStr };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const dayName = KHMER_DAYS[dateObj.getDay()] || 'ថ្ងៃ';
    const monthName = KHMER_MONTH_NAMES[m - 1] ? KHMER_MONTH_NAMES[m - 1].split(' ')[0] : `ខែ ${m}`;
    return {
        dayName,
        day: d,
        monthName,
        month: m,
        year: y,
        formatted: `${dayName} ទី ${d} ខែ${monthName} ឆ្នាំ ${y}`
    };
};

const SalaryPage = () => {
    const { t } = useLanguage();
    const { API_BASE, hasPermission, user } = useAuth();

    const [salaries, setSalaries] = useState([]);
    const [stats, setStats] = useState({ grandTotal: 0, currentMonthTotal: 0, totalRecords: 0, monthlyStats: [] });
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const itemsPerPage = 10;

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modals
    const [openModal, setOpenModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Global Saved Join Date (ថ្ងៃខែឆ្នាំចូលបម្រើការងារ - កំណត់នៅខាងលើគេ រួចចុច Save)
    const [savedJoinDate, setSavedJoinDate] = useState(() => localStorage.getItem('salary_saved_join_date') || '');
    const [tempDay, setTempDay] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) {
            const parts = saved.split('-');
            if (parts[2]) return parseInt(parts[2], 10);
        }
        return new Date().getDate();
    });
    const [tempMonth, setTempMonth] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) {
            const parts = saved.split('-');
            if (parts[1]) return parseInt(parts[1], 10);
        }
        return new Date().getMonth() + 1;
    });
    const [tempYear, setTempYear] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) {
            const parts = saved.split('-');
            if (parts[0]) return parseInt(parts[0], 10);
        }
        return new Date().getFullYear();
    });
    const [isEditingDate, setIsEditingDate] = useState(() => !localStorage.getItem('salary_saved_join_date'));

    const computeTempDateString = (y, m, d) => {
        const yy = String(y);
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const handleSaveDate = () => {
        const dateStr = computeTempDateString(tempYear, tempMonth, tempDay);
        setSavedJoinDate(dateStr);
        localStorage.setItem('salary_saved_join_date', dateStr);
        setIsEditingDate(false);
    };

    const handleEditDate = () => {
        if (savedJoinDate) {
            const parts = savedJoinDate.split('-');
            if (parts.length >= 3) {
                setTempYear(parseInt(parts[0], 10));
                setTempMonth(parseInt(parts[1], 10));
                setTempDay(parseInt(parts[2], 10));
            }
        }
        setIsEditingDate(true);
    };

    const handleClearDate = () => {
        setSavedJoinDate('');
        localStorage.removeItem('salary_saved_join_date');
        setIsEditingDate(true);
    };

    // Form State
    const initialForm = {
        staffNameKh: '',
        staffNameEn: '',
        joinDate: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Basic Salary',
        paymentMethod: 'ABA Bank',
        proofPhoto: '',
        note: '',
        brand: user?.brand || ''
    };
    const [formData, setFormData] = useState(initialForm);
    const photoFileRef = useRef(null);

    // Fetch Stats
    const fetchStats = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE}/salary/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Fetch salary stats error:', err);
        }
    }, [API_BASE, user]);

    // Fetch List
    const fetchSalaries = useCallback(async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        try {
            const pageToFetch = typeof pg === 'number' ? pg : 1;
            const params = new URLSearchParams({
                page: pageToFetch,
                limit: itemsPerPage,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.set('search', search);
            if (selectedMonth) params.set('month', selectedMonth);
            if (selectedPaymentMethod) params.set('paymentMethod', selectedPaymentMethod);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const res = await fetch(`${API_BASE}/salary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setSalaries(data.data || []);
                setTotal(data.total || 0);
                setTotalAmount(data.totalAmount || 0);
            }
        } catch (err) {
            console.error('Fetch salary error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 400);
        }
    }, [API_BASE, itemsPerPage, selectedMonth, selectedPaymentMethod, startDate, endDate, user]);

    useEffect(() => {
        fetchSalaries(currentPage, searchTerm);
        fetchStats();
    }, [currentPage, selectedMonth, selectedPaymentMethod, startDate, endDate]);

    useEffect(() => {
        setCurrentPage(1);
        fetchSalaries(1, searchTerm);
    }, [searchTerm]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchSalaries(1, searchTerm);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedMonth('');
        setSelectedPaymentMethod('');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        if (!savedJoinDate) {
            alert('សូមជ្រើសរើស និងចុច "រក្សាទុក (Save Date)" ថ្ងៃខែឆ្នាំចូលបម្រើការងារនៅខាងលើជាមុនសិន!');
            return;
        }
        setEditingItem(null);
        setFormData({
            ...initialForm,
            joinDate: savedJoinDate,
            brand: user?.brand || '',
            date: new Date().toISOString().split('T')[0]
        });
        setOpenModal(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setFormData({
            staffNameKh: item.staffNameKh || '',
            staffNameEn: item.staffNameEn || item.staffName || '',
            joinDate: item.joinDate || savedJoinDate || '',
            amount: item.amount || '',
            date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
            category: item.category || 'Basic Salary',
            paymentMethod: item.paymentMethod || 'ABA Bank',
            proofPhoto: item.proofPhoto || '',
            note: item.note || '',
            brand: item.brand || user?.brand || ''
        });
        setOpenModal(true);
    };

    // Delete Record
    const handleDelete = async (id) => {
        if (!window.confirm('តើអ្នកប្រាកដជាចង់លុបកំណត់ត្រាប្រាក់ខែនេះមែនទេ? (Are you sure you want to delete this salary entry?)')) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/salary/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSalaries(currentPage);
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.error || 'លុបមិនបានជោគជ័យ');
            }
        } catch (err) {
            console.error('Delete salary error:', err);
        }
    };

    // Upload Evidence / Proof Photo
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoUploading(true);
        try {
            const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD || 'demo';
            const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.VITE_CLOUDINARY_PRESET || 'ml_default';
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', CLOUDINARY_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
                method: 'POST',
                body: fd
            });
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({ ...prev, proofPhoto: data.secure_url }));
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, proofPhoto: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        } catch (err) {
            console.error('Photo upload error:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, proofPhoto: reader.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setPhotoUploading(false);
            if (photoFileRef.current) photoFileRef.current.value = '';
        }
    };

    // Save or Update Salary Record
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert('សូមបញ្ចូលចំនួនទឹកប្រាក់ខែឱ្យបានត្រឹមត្រូវ!');
            return;
        }
        if (!formData.date) {
            alert('សូមជ្រើសរើសកាលបរិច្ឆេទ!');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                staffName: formData.staffNameEn || formData.staffNameKh || '',
                joinDate: formData.joinDate || savedJoinDate || '',
                amount: Number(formData.amount),
                createdBy: user?.username || 'Administrator'
            };

            const url = editingItem
                ? `${API_BASE}/salary/${editingItem._id || editingItem.id}`
                : `${API_BASE}/salary`;
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setOpenModal(false);
                setFormData(initialForm);
                setEditingItem(null);
                fetchSalaries(currentPage);
                fetchStats();
            } else {
                const errData = await res.json();
                alert(errData.error || 'បរាជ័យក្នុងការរក្សាទុកទិន្នន័យប្រាក់ខែ');
            }
        } catch (err) {
            console.error('Submit salary error:', err);
            alert('Server error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Export Handlers
    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                page: 1,
                limit: 99999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (searchTerm) params.set('search', searchTerm);
            if (selectedMonth) params.set('month', selectedMonth);
            if (selectedPaymentMethod) params.set('paymentMethod', selectedPaymentMethod);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const res = await fetch(`${API_BASE}/salary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Export fetch error:', err);
        }
        return salaries;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((item, idx) => ({
            'No': idx + 1,
            'Date (កាលបរិច្ឆេទ)': item.date || '',
            'Staff Name (ឈ្មោះបុគ្គលិក)': item.staffName || '',
            'Join Date (ថ្ងៃខែឆ្នាំចូលបម្រើការងារ)': item.joinDate || '',
            'Amount ($) (ចំនួនទឹកប្រាក់)': item.amount || 0,
            'Category (ប្រភេទ)': item.category || 'Basic Salary',
            'Payment Method (វិធីសាស្ត្រទូទាត់)': item.paymentMethod || 'ABA Bank',
            'Notes (កំណត់ចំណាំ)': item.note || '',
            'Created By (បញ្ចូលដោយ)': item.createdBy || ''
        }));
        exportToExcel(data, 'Salary_Report_MDM');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date', accessor: 'date' },
            { header: 'Staff Name', accessor: 'staffName' },
            { header: 'Join Date', accessor: 'joinDate' },
            { header: 'Amount ($)', cell: (r) => `$${Number(r.amount || 0).toLocaleString()}` },
            { header: 'Method', accessor: 'paymentMethod' },
            { header: 'Category', accessor: 'category' },
            { header: 'Note', accessor: 'note' }
        ];
        exportToPDF('Salary Management Report (របាយការណ៍ប្រាក់ខែ)', columns, allData);
    };

    return (
        <div className="w-full bg-[var(--app-bg,#f4f6f8)] p-4 select-none space-y-4 relative min-h-screen">
            {/* Header Bar */}
            <header className="p-3 w-full border border-[var(--app-border,#e2e8f0)] bg-[var(--app-card,white)] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-600/30">
                        <FaMoneyBillWave />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>គ្រប់គ្រងប្រាក់ខែ (Salary Management)</span>
                        </h1>
                        <p className="text-xs text-slate-500">តាមដាន បញ្ចូល និងគ្រប់គ្រងទិន្នន័យប្រាក់ខែបុគ្គលិកទាំងអស់</p>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {hasPermission('/salary', 'export') && (
                        <>
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs"
                            >
                                <FaFileExcel className="text-emerald-600 text-sm" />
                                <span>Excel</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs"
                            >
                                <FaFilePdf className="text-red-600 text-sm" />
                                <span>PDF</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => { fetchSalaries(currentPage); fetchStats(); }}
                        disabled={reloading}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-[5px] text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs"
                    >
                        <FaSync className={reloading ? 'animate-spin text-emerald-600' : ''} />
                        <span>{t('reload')}</span>
                    </button>
                </div>
            </header>

            {/* Top Employment Date Configuration Card (តារាងកំណត់ថ្ងៃខែឆ្នាំចូលបម្រើការងារ) */}
            {savedJoinDate && !isEditingDate ? (
                /* Saved State Card */
                <div className="p-4 w-full border border-emerald-300/80 dark:border-emerald-700/60 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-cyan-950/30 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex flex-col items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">
                                {getKhmerDateDetails(savedJoinDate).dayName}
                            </span>
                            <span className="text-xl font-black font-mono leading-none mt-0.5">
                                {getKhmerDateDetails(savedJoinDate).day}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                    ថ្ងៃខែឆ្នាំចូលបម្រើការងារ (Date of Joining)
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200">
                                    <FaCheckCircle className="text-emerald-600 dark:text-emerald-400" />
                                    <span>បានរក្សាទុក (Saved & Active)</span>
                                </span>
                            </div>
                            {/* Formatted Date Display */}
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2 flex-wrap font-mono">
                                <span className="text-emerald-700 dark:text-emerald-300">{getKhmerDateDetails(savedJoinDate).formatted}</span>
                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                    ({savedJoinDate})
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                        <button
                            type="button"
                            onClick={handleEditDate}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                        >
                            <FaEdit />
                            <span>កែប្រែថ្ងៃខែ</span>
                        </button>

                        {hasPermission('/salary', 'create') && (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/30 transition-all active:scale-95 animate-in fade-in"
                            >
                                <FaPlus />
                                <span>បញ្ចូលប្រាក់ខែ (Create Salary)</span>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Edit & Setup State Card */
                <div className="p-4 w-full border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 dark:from-amber-950/30 dark:via-slate-900/60 dark:to-orange-950/20 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30 shrink-0">
                            <FaCalendarAlt />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                                    ជ្រើសរើសថ្ងៃខែឆ្នាំចូលបម្រើការងារ (Select Date of Joining) <span className="text-rose-500">*</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 animate-pulse">
                                    សូមជ្រើសថ្ងៃខែ រួចចុច Save
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                ជ្រើសរើស ថ្ងៃ ទី ខែ ឆ្នាំ រួចចុច <strong>"រក្សាទុក (Save)"</strong> ទើបប៊ូតុងបង្កើតប្រាក់ខែបង្ហាញឡើង!
                            </p>
                            {/* Live Preview */}
                            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 font-mono mt-1">
                                មើលសាកល្បង៖ {getKhmerDateDetails(computeTempDateString(tempYear, tempMonth, tempDay)).formatted}
                            </div>
                        </div>
                    </div>

                    {/* Dropdowns for Day, Month, Year + Direct Date input */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Day Select */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600 shadow-xs">
                            <span className="text-[11px] font-bold text-slate-500">ទី:</span>
                            <select
                                value={tempDay}
                                onChange={(e) => setTempDay(parseInt(e.target.value, 10))}
                                className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                    <option key={d} value={d} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                                        {String(d).padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Month Select */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600 shadow-xs">
                            <span className="text-[11px] font-bold text-slate-500">ខែ:</span>
                            <select
                                value={tempMonth}
                                onChange={(e) => setTempMonth(parseInt(e.target.value, 10))}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                {KHMER_MONTH_NAMES.map((m, idx) => (
                                    <option key={idx + 1} value={idx + 1} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Year Select */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600 shadow-xs">
                            <span className="text-[11px] font-bold text-slate-500">ឆ្នាំ:</span>
                            <select
                                value={tempYear}
                                onChange={(e) => setTempYear(parseInt(e.target.value, 10))}
                                className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                {Array.from({ length: 16 }, (_, i) => 2020 + i).map(y => (
                                    <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Calendar Picker Sync */}
                        <div className="flex items-center bg-white dark:bg-slate-800 px-2 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600 shadow-xs" title="ឬជ្រើសពី Calendar">
                            <input
                                type="date"
                                value={computeTempDateString(tempYear, tempMonth, tempDay)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        const parts = val.split('-');
                                        if (parts.length >= 3) {
                                            setTempYear(parseInt(parts[0], 10));
                                            setTempMonth(parseInt(parts[1], 10));
                                            setTempDay(parseInt(parts[2], 10));
                                        }
                                    }
                                }}
                                className="bg-transparent text-xs font-mono font-bold text-emerald-600 outline-none cursor-pointer"
                            />
                        </div>

                        {/* Save Button */}
                        <button
                            type="button"
                            onClick={handleSaveDate}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                        >
                            <FaSave />
                            <span>រក្សាទុក (Save)</span>
                        </button>

                        {savedJoinDate && (
                            <button
                                type="button"
                                onClick={() => setIsEditingDate(false)}
                                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                            >
                                បោះបង់
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Grand Total */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">សរុបប្រាក់ខែទាំងអស់ (Grand Total)</p>
                        <h3 className="text-xl font-black text-emerald-600 font-mono mt-1">
                            ${Number(stats.grandTotal || totalAmount || 0).toLocaleString()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">ទូទាំងប្រព័ន្ធ ({stats.totalRecords || total} កំណត់ត្រា)</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl">
                        <FaDollarSign />
                    </div>
                </div>

                {/* This Month */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ប្រាក់ខែខែនេះ (This Month)</p>
                        <h3 className="text-xl font-black text-cyan-600 font-mono mt-1">
                            ${Number(stats.currentMonthTotal || 0).toLocaleString()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date().toISOString().slice(0, 7)}</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center text-xl">
                        <FaCalendarCheck />
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ចំនួនកំណត់ត្រាសរុប (Total Records)</p>
                        <h3 className="text-xl font-black text-indigo-600 font-mono mt-1">
                            {stats.totalRecords || total}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">ទិន្នន័យបានបញ្ចូល</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-xl">
                        <FaUserTie />
                    </div>
                </div>

                {/* Monthly Average */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">មធ្យមភាគប្រចាំខែ (Avg / Month)</p>
                        <h3 className="text-xl font-black text-amber-600 font-mono mt-1">
                            ${(() => {
                                const mCount = (stats.monthlyStats && stats.monthlyStats.length) || 1;
                                const avg = (stats.grandTotal || 0) / mCount;
                                return Math.round(avg).toLocaleString();
                            })()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">គណនាតាមខែដែលមានទិន្នន័យ</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl">
                        <FaReceipt />
                    </div>
                </div>
            </div>

            {/* Monthly Bar Chart (ក្រាបសសរ) */}
            <SalaryBarChart
                data={stats.monthlyStats || []}
                grandTotal={stats.grandTotal || 0}
                title="ក្រាបសសរបង្ហាញប្រាក់ខែតាមខែនីមួយៗ (Monthly Salary Bar Chart)"
                subtitle="ក្រាបស្ថិតិសរុបប្រាក់ខែប្រចាំខែដើម្បីពិនិត្យនិន្នាការនៃការចំណាយ"
            />

            {/* Filter & Search Bar */}
            <div className="bg-[var(--app-card,white)] p-3 rounded-2xl border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-wrap items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="ស្វែងរកតាមឈ្មោះបុគ្គលិក, កំណត់ចំណាំ, ឬប្រភេទ..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
                    >
                        ស្វែងរក
                    </button>
                </form>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Month Picker */}
                    <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-semibold text-[11px]">ខែ:</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
                            className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-[var(--app-text,#0f172a)]"
                        />
                    </div>

                    {/* Method Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-semibold text-[11px]">វិធីសាស្ត្រ:</span>
                        <select
                            value={selectedPaymentMethod}
                            onChange={(e) => { setSelectedPaymentMethod(e.target.value); setCurrentPage(1); }}
                            className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-[var(--app-text,#0f172a)]"
                        >
                            <option value="">ទាំងអស់ (All Methods)</option>
                            <option value="ABA Bank">ABA Bank</option>
                            <option value="Wing">Wing</option>
                            <option value="ACLEDA">ACLEDA</option>
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                    </div>

                    {(searchTerm || selectedMonth || selectedPaymentMethod || startDate || endDate) && (
                        <button
                            onClick={handleResetFilters}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all cursor-pointer"
                        >
                            សម្អាត Filter
                        </button>
                    )}
                </div>
            </div>

            {/* Salary Data Table */}
            <div className="w-full overflow-x-auto rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-card,white)] shadow-md table-container">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-[var(--app-border,#e2e8f0)]">
                        <tr>
                            <th className="px-4 py-3 text-center">No</th>
                            <th className="px-4 py-3">កាលបរិច្ឆេទ (Date)</th>
                            <th className="px-4 py-3">ឈ្មោះខ្មែរ</th>
                            <th className="px-4 py-3">ឈ្មោះអង់គ្លេស</th>
                            <th className="px-4 py-3">ថ្ងៃចូលការ</th>
                            <th className="px-4 py-3 text-right">ចំនួនទឹកប្រាក់ (Amount)</th>
                            <th className="px-4 py-3 text-center">វិធីសាស្ត្រទូទាត់</th>
                            <th className="px-4 py-3">ប្រភេទ (Category)</th>
                            <th className="px-4 py-3 text-center">រូបភាពភស្តុតាង (Proof)</th>
                            <th className="px-4 py-3">កំណត់ចំណាំ (Note)</th>
                            <th className="px-4 py-3">បញ្ចូលដោយ</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-[var(--app-text,#0f172a)]">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="text-center py-10 text-slate-400 italic">
                                    កំពុងទាញយកទិន្នន័យប្រាក់ខែ...
                                </td>
                            </tr>
                        ) : salaries.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-12 text-slate-400 italic">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FaReceipt className="text-3xl opacity-30 text-slate-400" />
                                        <span>មិនមានទិន្នន័យប្រាក់ខែនៅឡើយទេ។ {savedJoinDate && 'សូមចុចប៊ូតុង "បញ្ចូលប្រាក់ខែ" ដើម្បីបង្កើតថ្មី!'}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            salaries.map((item, idx) => (
                                <tr key={item._id || item.id || idx} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
                                    <td className="px-4 py-3 text-center font-mono text-slate-500 font-semibold">
                                        {(currentPage - 1) * itemsPerPage + idx + 1}
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {item.date}
                                    </td>
                                    <td className="px-4 py-3">
                                        <CopyCell text={item.staffNameKh || '—'} className="font-bold text-[var(--app-text,#0f172a)] text-emerald-700" />
                                    </td>
                                    <td className="px-4 py-3">
                                        <CopyCell text={item.staffNameEn || item.staffName || '—'} className="font-bold text-[var(--app-text,#0f172a)]" />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                        {item.joinDate || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 text-sm">
                                        ${Number(item.amount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                            {item.paymentMethod || 'ABA Bank'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            {item.category || 'Basic Salary'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {item.proofPhoto ? (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewImage(item.proofPhoto)}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-[5px] text-[10px] font-bold cursor-pointer transition-all shadow-2xs"
                                                title="មើលរូបភាពភស្តុតាង"
                                            >
                                                <FaEye />
                                                <span>មើលរូប</span>
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 text-[10px] italic">គ្មានរូប</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-600 dark:text-slate-400" title={item.note || ''}>
                                        {item.note || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                                        {item.createdBy || 'Administrator'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {hasPermission('/salary', 'edit') && (
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                                    title="កែប្រែ (Edit)"
                                                >
                                                    <FaEdit size={13} />
                                                </button>
                                            )}
                                            {hasPermission('/salary', 'delete') && (
                                                <button
                                                    onClick={() => handleDelete(item._id || item.id)}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                                    title="លុប (Delete)"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {total > itemsPerPage && (
                    <div className="p-3 border-t border-[var(--app-border,#e2e8f0)] flex items-center justify-between">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={total}
                            itemsPerPage={itemsPerPage}
                            onPageChange={(p) => setCurrentPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* Create & Edit Modal */}
            {openModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150">
                    <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-border,#e2e8f0)] bg-emerald-600 text-white">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <FaMoneyBillWave />
                                <span>{editingItem ? 'កែប្រែកំណត់ត្រាប្រាក់ខែ (Edit Salary)' : 'បញ្ចូលប្រាក់ខែថ្មី (Create Salary Entry)'}</span>
                            </h3>
                            <button
                                onClick={() => setOpenModal(false)}
                                className="text-white/80 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Amount */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        ចំនួនទឹកប្រាក់ ($) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <FaDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold" />
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            placeholder="e.g. 500"
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-emerald-600 font-mono font-bold text-sm outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        កាលបរិច្ឆេទបើក (Date) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Staff Name Khmer */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        ឈ្មោះខ្មែរ (Khmer Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.staffNameKh}
                                        onChange={(e) => setFormData({ ...formData, staffNameKh: e.target.value })}
                                        placeholder="ឧ. ហាគីយ៉ុងហូ..."
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    />
                                </div>

                                {/* Staff Name English */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        ឈ្មោះអង់គ្លេស (English Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.staffNameEn}
                                        onChange={(e) => setFormData({ ...formData, staffNameEn: e.target.value })}
                                        placeholder="e.g. Ha Kyonghov..."
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Join Date */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        ថ្ងៃខែចូលបម្រើការងារ (Join Date)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        ប្រភេទប្រាក់ខែ (Category)
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    >
                                        <option value="Basic Salary">Basic Salary (ប្រាក់ខែគោល)</option>
                                        <option value="Bonus">Bonus (ប្រាក់លើកទឹកចិត្ត)</option>
                                        <option value="Commission">Commission (កម្រៃជើងសារ)</option>
                                        <option value="Allowance">Allowance (ប្រាក់ឧបត្ថម្ភ)</option>
                                        <option value="Other">Other (ផ្សេងៗ)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Payment Method */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        វិធីសាស្ត្រទូទាត់ (Payment Method)
                                    </label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    >
                                        <option value="ABA Bank">ABA Bank</option>
                                        <option value="Wing">Wing</option>
                                        <option value="ACLEDA">ACLEDA</option>
                                        <option value="Cash">Cash (សាច់ប្រាក់សុទ្ធ)</option>
                                        <option value="Bank Transfer">Bank Transfer (ផ្ទេរប្រាក់)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {/* Brand */}
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Brand / សាខា
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        placeholder="e.g. MDM / ECloud"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                    />
                                </div>
                            </div>

                            {/* Evidence / Proof Photo Upload */}
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    រូបភាពភស្តុតាង / វិក្កយបត្រ (Evidence & Receipt Photo)
                                </label>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={formData.proofPhoto}
                                            onChange={(e) => setFormData({ ...formData, proofPhoto: e.target.value })}
                                            placeholder="បញ្ចូល URL រូបភាព ឬ ចុចប៊ូតុង Upload..."
                                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => photoFileRef.current?.click()}
                                            disabled={photoUploading}
                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-all disabled:opacity-50"
                                        >
                                            <FaCloudUploadAlt />
                                            <span>{photoUploading ? 'Uploading...' : 'Upload'}</span>
                                        </button>
                                        <input
                                            ref={photoFileRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                    </div>

                                    {/* Preview Box */}
                                    {formData.proofPhoto && (
                                        <div className="relative inline-block border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden p-1 bg-slate-50 dark:bg-slate-800">
                                            <img
                                                src={formData.proofPhoto}
                                                alt="Receipt Preview"
                                                className="w-24 h-24 object-cover rounded-lg"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, proofPhoto: '' })}
                                                className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full text-[9px] hover:bg-rose-500 cursor-pointer shadow-md"
                                                title="ដករូបចេញ"
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    កំណត់ចំណាំ (Remarks / Note)
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.note}
                                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    placeholder="បញ្ជាក់ព័ត៌មានបន្ថែម..."
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 resize-none text-[var(--app-text,#0f172a)]"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--app-border,#e2e8f0)]">
                                <button
                                    type="button"
                                    onClick={() => setOpenModal(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all"
                                >
                                    បោះបង់ (Cancel)
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {submitting ? 'កំពុងរក្សាទុក...' : editingItem ? 'កែប្រែ (Save Changes)' : 'រក្សាទុក (Save Salary)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Proof Photo Lightbox Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2">
                            <span className="text-xs font-bold flex items-center gap-2">
                                <FaReceipt className="text-emerald-400" />
                                <span>រូបភាពភស្តុតាងប្រាក់ខែ (Salary Evidence Photo)</span>
                            </span>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>
                        <img
                            src={previewImage}
                            alt="Salary Proof"
                            className="max-h-[70vh] max-w-full object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalaryPage;
