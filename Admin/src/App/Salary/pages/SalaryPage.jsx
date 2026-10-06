import React, { useState, useEffect, useCallback, useRef } from 'react';
import ExportDropdown from '../../../components/ExportDropdown';
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
    FaQrcode,
    FaDownload,
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
    FaUsers,
    FaArrowLeft,
    FaUserCircle,
    FaBuilding
} from 'react-icons/fa';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import SalaryBarChart from '../../../components/SalaryBarChart';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import { getProxyImageUrl } from '../../../utils/mediaUtils';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';
import ImageGalleryModal from '../../../components/ImageGalleryModal';
import ImageUrlListInput from '../../../components/ImageUrlListInput';

const getProofPhotos = item => [...new Set([
    ...(Array.isArray(item?.proofPhotos) ? item.proofPhotos : []),
    ...(item?.proofPhoto ? [item.proofPhoto] : [])
].filter(Boolean))];

const KHMER_DAYS = [
    'ថ្ងៃអាទិត្យ',
    'ថ្ងៃច័ន្ទ',
    'ថ្ងៃអង្គារ',
    'ថ្ងៃពុធ',
    'ថ្ងៃព្រហស្បតិ៍',
    'ថ្ងៃសុក្រ',
    'ថ្ងៃសៅរ៍'
];

const KHMER_MONTH_NAMES = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
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

    // Check if current user is an Admin / "Account ធំ"
    const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin' || user?.isImmutable || user?.username === '@hakyonghouv';

    // Staff Directory state for Admin
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staffDirectory, setStaffDirectory] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffSearchTerm, setStaffSearchTerm] = useState('');

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
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modals
    const [openModal, setOpenModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [qrPhotoUploading, setQrPhotoUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null); // { url, title, filename }
    const [proofGalleryImages, setProofGalleryImages] = useState([]);
    const [proofGalleryIndex, setProofGalleryIndex] = useState(0);

    // Global Saved Join Date + Staff Names + Staff QR Code
    const [savedJoinDate, setSavedJoinDate] = useState(() => localStorage.getItem('salary_saved_join_date') || '');
    const [savedStaffNameKh, setSavedStaffNameKh] = useState(() => localStorage.getItem('salary_saved_name_kh') || '');
    const [savedStaffNameEn, setSavedStaffNameEn] = useState(() => localStorage.getItem('salary_saved_name_en') || '');
    const [savedQrCodePhoto, setSavedQrCodePhoto] = useState(() => localStorage.getItem('salary_saved_qr_code') || '');
    const [tempNameKh, setTempNameKh] = useState(() => localStorage.getItem('salary_saved_name_kh') || '');
    const [tempNameEn, setTempNameEn] = useState(() => localStorage.getItem('salary_saved_name_en') || '');
    const [tempQrCodePhoto, setTempQrCodePhoto] = useState(() => localStorage.getItem('salary_saved_qr_code') || '');
    const [tempDay, setTempDay] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) { const parts = saved.split('-'); if (parts[2]) return parseInt(parts[2], 10); }
        return new Date().getDate();
    });
    const [tempMonth, setTempMonth] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) { const parts = saved.split('-'); if (parts[1]) return parseInt(parts[1], 10); }
        return new Date().getMonth() + 1;
    });
    const [tempYear, setTempYear] = useState(() => {
        const saved = localStorage.getItem('salary_saved_join_date');
        if (saved) { const parts = saved.split('-'); if (parts[0]) return parseInt(parts[0], 10); }
        return new Date().getFullYear();
    });
    const [isEditingDate, setIsEditingDate] = useState(() => !localStorage.getItem('salary_saved_join_date'));

    const computeTempDateString = (y, m, d) => {
        const yy = String(y);
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const handleSaveDate = async () => {
        const dateStr = computeTempDateString(tempYear, tempMonth, tempDay);
        setSavedJoinDate(dateStr);
        setSavedStaffNameKh(tempNameKh);
        setSavedStaffNameEn(tempNameEn);
        setSavedQrCodePhoto(tempQrCodePhoto);
        localStorage.setItem('salary_saved_join_date', dateStr);
        localStorage.setItem('salary_saved_name_kh', tempNameKh);
        localStorage.setItem('salary_saved_name_en', tempNameEn);
        localStorage.setItem('salary_saved_qr_code', tempQrCodePhoto);
        setIsEditingDate(false);

        // Sync with backend
        try {
            const res = await fetch(`${API_BASE}/salary/save-staff-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffKey: selectedStaff?.key || user?.username || '',
                    username: user?.username || '',
                    staffNameKh: tempNameKh,
                    staffNameEn: tempNameEn,
                    joinDate: dateStr,
                    qrCodePhoto: tempQrCodePhoto
                })
            });
            if (res.ok && isAdmin) {
                fetchStaffDirectory();
            }
        } catch (err) {
            console.error('Save staff info error:', err);
        }
    };

    // Automatically load saved staff info from backend
    const fetchStaffInfo = useCallback(async (targetStaff = selectedStaff) => {
        try {
            const targetKey = targetStaff?.key || targetStaff?.staffName || user?.username || '';
            const uname = user?.username || '';
            const params = new URLSearchParams({
                username: uname,
                staffKey: targetKey
            });
            const res = await fetch(`${API_BASE}/salary/staff-info?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                const d = json.data;
                if (d) {
                    if (d.staffNameKh) {
                        setSavedStaffNameKh(d.staffNameKh);
                        setTempNameKh(d.staffNameKh);
                        localStorage.setItem('salary_saved_name_kh', d.staffNameKh);
                    }
                    if (d.staffNameEn) {
                        setSavedStaffNameEn(d.staffNameEn);
                        setTempNameEn(d.staffNameEn);
                        localStorage.setItem('salary_saved_name_en', d.staffNameEn);
                    }
                    if (d.qrCodePhoto) {
                        setSavedQrCodePhoto(d.qrCodePhoto);
                        setTempQrCodePhoto(d.qrCodePhoto);
                        localStorage.setItem('salary_saved_qr_code', d.qrCodePhoto);
                    }
                    if (d.joinDate) {
                        setSavedJoinDate(d.joinDate);
                        localStorage.setItem('salary_saved_join_date', d.joinDate);
                        const parts = d.joinDate.split('-');
                        if (parts.length >= 3) {
                            setTempYear(parseInt(parts[0], 10));
                            setTempMonth(parseInt(parts[1], 10));
                            setTempDay(parseInt(parts[2], 10));
                        }
                        setIsEditingDate(false);
                    }
                }
            }
        } catch (err) {
            console.error('Fetch staff info error:', err);
        }
    }, [API_BASE, user, selectedStaff, isAdmin]);

    useEffect(() => {
        if (!isAdmin || selectedStaff) {
            fetchStaffInfo(selectedStaff);
        }
    }, [isAdmin, selectedStaff, fetchStaffInfo]);

    const handleEditDate = () => {
        if (savedJoinDate) {
            const parts = savedJoinDate.split('-');
            if (parts.length >= 3) {
                setTempYear(parseInt(parts[0], 10));
                setTempMonth(parseInt(parts[1], 10));
                setTempDay(parseInt(parts[2], 10));
            }
        }
        setTempNameKh(savedStaffNameKh);
        setTempNameEn(savedStaffNameEn);
        setTempQrCodePhoto(savedQrCodePhoto);
        setIsEditingDate(true);
    };

    // Download image helper
    const handleDownloadImage = async (imgUrl, defaultName = 'download.png') => {
        if (!imgUrl) return;
        try {
            if (imgUrl.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = imgUrl;
                link.download = defaultName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = defaultName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download error:', err);
            window.open(imgUrl, '_blank');
        }
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
        proofPhotos: [],
        qrCodePhoto: '',
        note: '',
        brand: user?.brand || ''
    };
    const [formData, setFormData] = useState(initialForm);
    const photoFileRef = useRef(null);
    const qrFileRef = useRef(null);

    // Fetch Staff Directory (for Admin view)
    const fetchStaffDirectory = useCallback(async () => {
        if (!isAdmin) return;
        setStaffLoading(true);
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            const res = await fetch(`${API_BASE}/salary/staff-list?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStaffDirectory(data.data || []);
            }
        } catch (err) {
            console.error('Fetch staff directory error:', err);
        } finally {
            setStaffLoading(false);
        }
    }, [API_BASE, isAdmin, user]);

    useEffect(() => {
        if (isAdmin) {
            fetchStaffDirectory();
        }
    }, [isAdmin, fetchStaffDirectory]);

    // Handle Selecting a Staff Member (for Admin)
    const handleSelectStaff = (staff) => {
        setSelectedStaff(staff);
        const sKh = staff.staffNameKh || '';
        const sEn = staff.staffNameEn || staff.staffName || '';
        const sDate = staff.joinDate || '';
        const sQr = staff.qrCodePhoto || '';

        setSavedStaffNameKh(sKh);
        setSavedStaffNameEn(sEn);
        setSavedQrCodePhoto(sQr);
        setTempNameKh(sKh);
        setTempNameEn(sEn);
        setTempQrCodePhoto(sQr);

        if (sDate) {
            setSavedJoinDate(sDate);
            const parts = sDate.split('-');
            if (parts.length >= 3) {
                setTempYear(parseInt(parts[0], 10));
                setTempMonth(parseInt(parts[1], 10));
                setTempDay(parseInt(parts[2], 10));
            }
            setIsEditingDate(false);
        } else {
            setSavedJoinDate('');
            setIsEditingDate(true);
        }
        setCurrentPage(1);
    };

    // Return to All Staff Directory View
    const handleBackToDirectory = () => {
        setSelectedStaff(null);
        fetchStaffDirectory();
    };

    // Active target staff identifier for API queries
    const activeStaffKey = selectedStaff ? (selectedStaff.staffName || selectedStaff.staffNameEn || selectedStaff.staffNameKh) : '';

    // Fetch Stats
    const fetchStats = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (isAdmin && activeStaffKey) {
                params.set('staffName', activeStaffKey);
            }
            const res = await fetch(`${API_BASE}/salary/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Fetch salary stats error:', err);
        }
    }, [API_BASE, user, isAdmin, activeStaffKey]);

    // Fetch Salaries List
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
            if (isAdmin && activeStaffKey) {
                params.set('staffName', activeStaffKey);
            }
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
    }, [API_BASE, itemsPerPage, selectedMonth, selectedPaymentMethod, startDate, endDate, user, isAdmin, activeStaffKey]);

    useEffect(() => {
        if (!isAdmin || selectedStaff) {
            fetchSalaries(currentPage, searchTerm);
            fetchStats();
        }
    }, [currentPage, selectedMonth, selectedPaymentMethod, startDate, endDate, selectedStaff, isAdmin]);

    useEffect(() => {
        if (!isAdmin || selectedStaff) {
            setCurrentPage(1);
            fetchSalaries(1, searchTerm);
        }
    }, [searchTerm]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchSalaries(1, searchTerm);
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedSearchRecord(null);
        setSelectedMonth('');
        setSelectedPaymentMethod('');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    // Open Create Modal
    const handleOpenCreate = (prefillStaff = null) => {
        const staffObj = prefillStaff || selectedStaff;
        const khName = staffObj?.staffNameKh || savedStaffNameKh || '';
        const enName = staffObj?.staffNameEn || staffObj?.staffName || savedStaffNameEn || '';
        const jDate = staffObj?.joinDate || savedJoinDate || '';

        setEditingItem(null);
        setFormData({
            ...initialForm,
            staffNameKh: khName,
            staffNameEn: enName,
            joinDate: jDate,
            brand: staffObj?.brand || user?.brand || '',
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
            proofPhotos: getProofPhotos(item),
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
                if (isAdmin) fetchStaffDirectory();
            } else {
                const data = await res.json();
                alert(data.error || 'លុបមិនបានជោគជ័យ');
            }
        } catch (err) {
            console.error('Delete salary error:', err);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoUploading(true);
        try {
            const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD || 'demo';
            const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.VITE_CLOUDINARY_PRESET || 'ml_default';
            const bodyData = new FormData();
            bodyData.append('file', file);
            bodyData.append('upload_preset', CLOUDINARY_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
                method: 'POST',
                body: bodyData
            });

            if (res.ok) {
                const data = await res.json();
                const rawUrl = data.secure_url || data.url;
                setFormData(prev => {
                    const proofPhotos = [...new Set([...getProofPhotos(prev), rawUrl])];
                    return { ...prev, proofPhoto: proofPhotos[0] || '', proofPhotos };
                });
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => {
                        const proofPhotos = [...new Set([...getProofPhotos(prev), reader.result])];
                        return { ...prev, proofPhoto: proofPhotos[0] || '', proofPhotos };
                    });
                };
                reader.readAsDataURL(file);
            }
        } catch (err) {
            console.error('Cloudinary upload error:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => {
                    const proofPhotos = [...new Set([...getProofPhotos(prev), reader.result])];
                    return { ...prev, proofPhoto: proofPhotos[0] || '', proofPhotos };
                });
            };
            reader.readAsDataURL(file);
        } finally {
            setPhotoUploading(false);
            if (photoFileRef.current) photoFileRef.current.value = '';
        }
    };

    const handleQrPhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setQrPhotoUploading(true);
        try {
            const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD || 'demo';
            const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.VITE_CLOUDINARY_PRESET || 'ml_default';
            const bodyData = new FormData();
            bodyData.append('file', file);
            bodyData.append('upload_preset', CLOUDINARY_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
                method: 'POST',
                body: bodyData
            });

            if (res.ok) {
                const data = await res.json();
                const rawUrl = data.secure_url || data.url;
                setTempQrCodePhoto(rawUrl);
                setFormData(prev => ({ ...prev, qrCodePhoto: rawUrl }));
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setTempQrCodePhoto(reader.result);
                    setFormData(prev => ({ ...prev, qrCodePhoto: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        } catch (err) {
            console.error('Cloudinary QR upload error:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempQrCodePhoto(reader.result);
                setFormData(prev => ({ ...prev, qrCodePhoto: reader.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setQrPhotoUploading(false);
            if (qrFileRef.current) qrFileRef.current.value = '';
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
                proofPhotos: getProofPhotos(formData),
                proofPhoto: getProofPhotos(formData)[0] || '',
                staffName: formData.staffNameEn || formData.staffNameKh || formData.staffName || '',
                staffNameKh: formData.staffNameKh || '',
                staffNameEn: formData.staffNameEn || formData.staffName || '',
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
                if (isAdmin) fetchStaffDirectory();
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
            if (isAdmin && activeStaffKey) {
                params.set('staffName', activeStaffKey);
            }
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
            [t('date')]: item.date || '',
            [t('staffNameKh')]: item.staffNameKh || '',
            [t('staffNameEn')]: item.staffNameEn || item.staffName || '',
            [t('joinDate')]: item.joinDate || '',
            'Amount ($) (ចំនួនទឹកប្រាក់)': item.amount || 0,
            [t('category')]: item.category || 'Basic Salary',
            [t('paymentMethod')]: item.paymentMethod || 'ABA Bank',
            [t('note')]: item.note || '',
            [t('createdBy')]: item.createdBy || ''
        }));
        exportToExcel(data, `Salary_Report_${selectedStaff ? selectedStaff.staffName : 'All'}`);
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Date', accessor: 'date' },
            { header: 'Staff Name (KH)', accessor: 'staffNameKh' },
            { header: 'Staff Name (EN)', accessor: 'staffNameEn' },
            { header: 'Join Date', accessor: 'joinDate' },
            { header: 'Amount ($)', cell: (r) => `$${Number(r.amount || 0).toLocaleString()}` },
            { header: 'Method', accessor: 'paymentMethod' },
            { header: 'Category', accessor: 'category' },
            { header: 'Note', accessor: 'note' }
        ];
        exportToPDF(`Salary Management Report - ${selectedStaff ? selectedStaff.staffName : 'All'}`, columns, allData, user?.brand || '', orientation);
    };

    // Filtered Staff Directory for Admin View (strictly only accounts with role salary)
    const filteredStaffDirectory = staffDirectory.filter(s => {
        const r = (s.role || '').toLowerCase();
        if (r !== 'salary') return false;
        if (!staffSearchTerm.trim()) return true;
        const term = staffSearchTerm.toLowerCase();
        return (
            (s.staffName && s.staffName.toLowerCase().includes(term)) ||
            (s.staffNameKh && s.staffNameKh.toLowerCase().includes(term)) ||
            (s.staffNameEn && s.staffNameEn.toLowerCase().includes(term)) ||
            (s.role && s.role.toLowerCase().includes(term)) ||
            (s.brand && s.brand.toLowerCase().includes(term)) ||
            (s.joinDate && s.joinDate.includes(term))
        );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // VIEW 1: ADMIN STAFF DIRECTORY SCREEN (Account ធំ initial page view)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isAdmin && !selectedStaff) {
        const salaryOnlyStaff = staffDirectory.filter(s => (s.role || '').toLowerCase() === 'salary');
        const totalDisbursedAll = salaryOnlyStaff.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const totalRecordsAll = salaryOnlyStaff.reduce((sum, s) => sum + (Number(s.recordsCount) || 0), 0);

        return (
            <div className="w-full bg-[var(--app-bg,#f4f6f8)] p-2 select-none space-y-5 relative min-h-screen">
                {/* Header Bar */}
                <header className="p-2 w-full border border-[var(--app-border,#e2e8f0)] bg-[var(--app-card,white)] rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                    <div>
                        <div>
                            <h1 className="text-base sm:text-lg font-black text-[var(--app-text,#0f172a)] flex items-center gap-2">
                                <span>{t('staffSalaryDirectory')}</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {hasPermission('/salary', 'create') && (
                            <button
                                onClick={() => handleOpenCreate()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                            >
                                <FaPlus />
                                <span>{t('createEntry')}</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Directory Stats KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('totalStaff')}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white font-khmer mt-1">
                                {salaryOnlyStaff.length} នាក់
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">គណនី និងបុគ្គលិកទាំងអស់</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-2xl">
                            <FaUsers />
                        </div>
                    </div>

                    <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('totalDisbursed')}</p>
                            <h3 className="text-2xl font-black text-emerald-600 font-mono mt-1">
                                ${totalDisbursedAll.toLocaleString()}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">ទូទាំងប្រព័ន្ធបុគ្គលិក</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl">
                            <FaDollarSign />
                        </div>
                    </div>

                    <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('totalRecords')}</p>
                            <h3 className="text-2xl font-black text-cyan-600 font-mono mt-1">
                                {totalRecordsAll} លើក
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">ទិន្នន័យប្រាក់ខែបានកត់ត្រា</p>
                        </div>
                        <div className="w-12 h-12 rounded-[5px] bg-cyan-500/10 text-cyan-600 flex items-center justify-center text-2xl">
                            <FaReceipt />
                        </div>
                    </div>
                </div>

                {/* Search Staff Bar */}
                <div className="bg-[var(--app-card,white)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input
                            type="text"
                            value={staffSearchTerm}
                            onChange={(e) => setStaffSearchTerm(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[5px] outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)] font-medium"
                        />
                    </div>
                    {staffSearchTerm && (
                        <button
                            onClick={() => setStaffSearchTerm('')}
                            className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-[5px] transition cursor-pointer"
                        >
                            សម្អាត
                        </button>
                    )}
                </div>

                {/* Staff Cards Grid */}
                {staffLoading ? (
                    <div className="py-20 text-center text-slate-400">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-xs font-semibold">កំពុងទាញយកបញ្ជីឈ្មោះបុគ្គលិកទាំងអស់...</p>
                    </div>
                ) : filteredStaffDirectory.length === 0 ? (
                    <div className="bg-[var(--app-card,white)] border border-dashed border-slate-300 rounded-[5px] p-12 text-center text-slate-400">
                        <FaUserTie className="text-4xl mx-auto opacity-30 mb-2" />
                        <p className="text-sm font-bold text-slate-600">មិនមានទិន្នន័យបុគ្គលិកត្រូវនឹងការស្វែងរកទេ</p>
                        <p className="text-xs text-slate-400 mt-1">សូមចុចប៊ូតុង "បញ្ចូលប្រាក់ខែថ្មី" ដើម្បីបង្កើតកំណត់ត្រាដំបូង</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredStaffDirectory.map((staff, idx) => {
                            const displayNameKh = staff.staffNameKh || '';
                            const displayNameEn = staff.staffNameEn || staff.staffName || 'Staff';
                            const jDate = staff.joinDate;

                            return (
                                <div
                                    key={staff.key || idx}
                                    className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] hover:border-emerald-500/70 rounded-[5px] p-2 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
                                >
                                    {/* Top decorative accent */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-80 group-hover:h-1.5 transition-all"></div>

                                    <div className="space-y-3 pt-1">
                                        {/* Avatar & Main Identity */}
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 rounded-[5px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-xl font-black shadow-md shadow-emerald-600/20 shrink-0">
                                                {displayNameEn.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {displayNameKh && (
                                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                                                        {displayNameKh}
                                                    </h3>
                                                )}
                                                <p className={`text-xs font-bold ${displayNameKh ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100 text-sm font-black'} truncate`}>
                                                    {displayNameEn}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {staff.role || 'Staff'}
                                                    </span>
                                                    {staff.brand && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                            {staff.brand}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Employment Join Date */}
                                        <div className="p-2.5 rounded-[5px] bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-400 flex items-center gap-1 font-medium">
                                                    <FaCalendarAlt className="text-amber-500" />
                                                    <span>ចូលបម្រើ:</span>
                                                </span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                                    {jDate ? jDate : 'មិនទាន់កំណត់'}
                                                </span>
                                            </div>
                                            {jDate && (
                                                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold truncate">
                                                    {getKhmerDateDetails(jDate).formatted}
                                                </p>
                                            )}
                                        </div>

                                        {/* Financial Summary for this staff */}
                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block font-medium">ទឹកប្រាក់សរុប</span>
                                                <span className="font-mono font-black text-emerald-600 text-sm">
                                                    ${Number(staff.totalAmount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 block font-medium">កំណត់ត្រា</span>
                                                <span className="font-khmer font-bold text-slate-700 dark:text-slate-300">
                                                    {staff.recordsCount || 0} លើក
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectStaff(staff)}
                                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                        >
                                            <FaEye />
                                            <span>មើលប្រាក់ខែ</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCreate(staff)}
                                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all"
                                            title="បញ្ចូលប្រាក់ខែឱ្យបុគ្គលិកនេះ"
                                        >
                                            <FaPlus />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Create & Edit Modal in Directory Screen */}
                {openModal && (
                    <CreateEditSalaryModal
                        openModal={openModal}
                        setOpenModal={setOpenModal}
                        editingItem={editingItem}
                        formData={formData}
                        setFormData={setFormData}
                        handleFormSubmit={handleFormSubmit}
                        submitting={submitting}
                        photoUploading={photoUploading}
                        photoFileRef={photoFileRef}
                        handlePhotoUpload={handlePhotoUpload}
                        savedStaffNameKh={savedStaffNameKh}
                        savedStaffNameEn={savedStaffNameEn}
                    />
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // VIEW 2: INDIVIDUAL STAFF SALARY DETAIL & MANAGEMENT VIEW
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="w-full bg-[var(--app-bg,#f4f6f8)] p-2 select-none space-y-4 relative min-h-screen">
            {/* Admin Switcher Top Banner */}
            {isAdmin && selectedStaff && (
                <div className="p-2 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-[5px] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-700">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleBackToDirectory}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[5px] text-xs font-bold cursor-pointer transition border border-white/20 active:scale-95"
                        >
                            <FaArrowLeft />
                            <span>{t('allStaff')}</span>
                        </button>
                        <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
                        <div>
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">កំពុងពិនិត្យប្រាក់ខែបុគ្គលិក:</span>
                            <h2 className="text-sm font-black text-white flex items-center gap-2">
                                {savedStaffNameKh && <span>{savedStaffNameKh}</span>}
                                {savedStaffNameEn && <span className="text-slate-300 font-medium">({savedStaffNameEn})</span>}
                            </h2>
                        </div>
                    </div>

                    {/* Quick Staff Switch Dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium hidden md:inline">ប្តូរបុគ្គលិក:</span>
                        <select
                            value={selectedStaff.key || selectedStaff.staffName}
                            onChange={(e) => {
                                const target = staffDirectory.find(s => (s.key || s.staffName) === e.target.value);
                                if (target) handleSelectStaff(target);
                            }}
                            className="px-3 py-1.5 bg-slate-800 text-white border border-slate-600 rounded-[5px] text-xs font-bold outline-none cursor-pointer"
                        >
                            {staffDirectory.map((s, idx) => (
                                <option key={s.key || idx} value={s.key || s.staffName}>
                                    {s.staffNameKh ? `${s.staffNameKh} (${s.staffNameEn || s.staffName})` : (s.staffNameEn || s.staffName)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Header Bar */}
            <header className="p-2 w-full border border-[var(--app-border,#e2e8f0)] bg-[var(--app-card,white)] rounded-[5px] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div>
                    <div>
                        <h1 className="text-base font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>{t('salaryManagement')}</span>
                        </h1>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {savedQrCodePhoto && (
                        <button
                            type="button"
                            onClick={() => setPreviewImage({
                                url: savedQrCodePhoto,
                                title: `QR Code - ${savedStaffNameKh || savedStaffNameEn || 'Staff'}`,
                                filename: `Salary_QRCode_${(savedStaffNameKh || savedStaffNameEn || 'Staff').replace(/\s+/g, '_')}.png`
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-95"
                            title={t('viewQrCode')}
                        >
                            <FaQrcode className="text-white text-sm" />
                            <span>{t('viewQrCode')}</span>
                        </button>
                    )}
                    {hasPermission('/salary', 'export') && (
                        <>
                            <ExportDropdown onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                        </>
                    )}
                </div>
            </header>

            {/* Top Employment Card: Names + Join Date + QR Code */}
            {savedJoinDate && !isEditingDate ? (
                /* Saved State Card */
                <div className="p-2 w-full border border-emerald-300/80 dark:border-emerald-700/60 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-cyan-950/30 rounded-[5px] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[5px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex flex-col items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">
                                {getKhmerDateDetails(savedJoinDate).dayName}
                            </span>
                            <span className="text-xl font-black font-mono leading-none mt-0.5">
                                {getKhmerDateDetails(savedJoinDate).day}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {savedStaffNameKh && (
                                    <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">{savedStaffNameKh}</span>
                                )}
                                {savedStaffNameEn && (
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">({savedStaffNameEn})</span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200">
                                    <FaCheckCircle className="text-emerald-600 dark:text-emerald-400" />
                                    <span>{t('saved')}</span>
                                </span>
                            </div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2 flex-wrap font-mono">
                                <span className="text-emerald-700 dark:text-emerald-300">ចូលបម្រើ: {getKhmerDateDetails(savedJoinDate).formatted}</span>
                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                    ({savedJoinDate})
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                        {/* View Staff QR Code Button */}
                        {savedQrCodePhoto ? (
                            <button
                                type="button"
                                onClick={() => setPreviewImage({
                                    url: savedQrCodePhoto,
                                    title: `QR Code - ${savedStaffNameKh || savedStaffNameEn || 'Staff'}`,
                                    filename: `Salary_QRCode_${(savedStaffNameKh || savedStaffNameEn || 'Staff').replace(/\s+/g, '_')}.png`
                                })}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/30 active:scale-95"
                                title={t('viewQrCode')}
                            >
                                <FaQrcode className="text-sm" />
                                <span>{t('viewQrCode')}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleEditDate}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs"
                                title={t('qrCode')}
                            >
                                <FaQrcode className="text-emerald-600" />
                                <span>+ QR Code</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleEditDate}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200 rounded-[5px] text-xs font-bold cursor-pointer transition-all shadow-xs"
                        >
                            <FaEdit />
                            <span>កែប្រែ</span>
                        </button>

                        {hasPermission('/salary', 'create') && (
                            <button
                                type="button"
                                onClick={() => handleOpenCreate()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-[5px] text-xs cursor-pointer shadow-lg shadow-emerald-600/30 transition-all active:scale-95 animate-in fade-in"
                            >
                                <FaPlus />
                                <span>{t('salary')}</span>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Edit & Setup State Card */
                <div className="p-2 w-full border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 dark:from-amber-950/30 dark:via-slate-900/60 dark:to-orange-950/20 rounded-[5px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-[5px] bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30 shrink-0">
                            <FaCalendarAlt />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                                    បំពេញឈ្មោះ + ថ្ងៃចូលបម្រើការងារ + រូបភាព QR Code <span className="text-rose-500">*</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 animate-pulse">
                                    សូមបំពេញ រួចចុច Save
                                </span>
                            </div>
                            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 font-mono mt-1">
                                មើលសាកល្បង: {getKhmerDateDetails(computeTempDateString(tempYear, tempMonth, tempDay)).formatted}
                            </div>
                        </div>
                    </div>

                    {/* Name Fields Row */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs flex-1 min-w-[160px]">
                            <FaUserTie className="text-emerald-600 text-xs shrink-0" />
                            <input
                                type="text"
                                value={tempNameKh}
                                onChange={(e) => setTempNameKh(e.target.value)}
                                placeholder="ឈ្មោះបុគ្គលិកជាភាសាខ្មែរ..."
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none w-full"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs flex-1 min-w-[160px]">
                            <FaUserTie className="text-indigo-500 text-xs shrink-0" />
                            <input
                                type="text"
                                value={tempNameEn}
                                onChange={(e) => setTempNameEn(e.target.value)}
                                placeholder={t('staffNameEn')}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none w-full"
                            />
                        </div>
                    </div>

                    {/* Date Fields Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Day Select */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs">
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
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs">
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
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs">
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
                        <div className="flex items-center bg-white dark:bg-slate-800 px-2 py-1.5 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs" title="ឬជ្រើសពី Calendar">
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
                    </div>

                    {/* QR Code Upload Row */}
                    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white dark:bg-slate-800 rounded-[5px] border border-amber-300 dark:border-amber-600 shadow-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <FaQrcode className="text-emerald-600 text-sm shrink-0" />
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                រូបភាព QR Code របស់យើង:
                            </span>
                            <input
                                type="text"
                                value={tempQrCodePhoto}
                                onChange={(e) => setTempQrCodePhoto(e.target.value)}
                                placeholder="បញ្ចូល URL QR Code ឬ ចុចប៊ូតុង Upload..."
                                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 outline-none flex-1"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => qrFileRef.current?.click()}
                            disabled={qrPhotoUploading}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                            <FaCloudUploadAlt />
                            <span>{qrPhotoUploading ? 'Uploading...' : 'Upload QR'}</span>
                        </button>
                        <input
                            ref={qrFileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleQrPhotoUpload}
                        />
                        {tempQrCodePhoto && (
                            <div className="flex items-center gap-2">
                                <img
                                    src={tempQrCodePhoto}
                                    alt="QR Preview"
                                    className="w-7 h-7 object-contain rounded border border-slate-300 cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => setPreviewImage({
                                        url: tempQrCodePhoto,
                                        title: 'រូបភាព QR Code របស់យើង (Our QR Code)',
                                        filename: 'My_Salary_QRCode.png'
                                    })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setTempQrCodePhoto('')}
                                    className="text-rose-500 hover:text-rose-700 text-xs p-2"
                                    title={t('delete')}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveDate}
                            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                        >
                            <FaSave />
                            <span>{t('saveInfoAndQr')}</span>
                        </button>

                        {savedJoinDate && (
                            <button
                                type="button"
                                onClick={() => setIsEditingDate(false)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all"
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
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('total')}</p>
                        <h3 className="text-xl font-black text-emerald-600 font-mono mt-1">
                            ${Number(stats.grandTotal || totalAmount || 0).toLocaleString()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">({stats.totalRecords || total} កំណត់ត្រា)</p>
                    </div>
                    <div className="w-11 h-11 rounded-[5px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl">
                        <FaDollarSign />
                    </div>
                </div>

                {/* This Month */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ប្រាក់ខែ{t('thisMonth')}</p>
                        <h3 className="text-xl font-black text-cyan-600 font-mono mt-1">
                            ${Number(stats.currentMonthTotal || 0).toLocaleString()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date().toISOString().slice(0, 7)}</p>
                    </div>
                    <div className="w-11 h-11 rounded-[5px] bg-cyan-500/10 text-cyan-600 flex items-center justify-center text-xl">
                        <FaCalendarCheck />
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('totalRecords')}</p>
                        <h3 className="text-xl font-black text-indigo-600 font-mono mt-1">
                            {stats.totalRecords || total}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">ទិន្នន័យបានបញ្ចូល</p>
                    </div>
                    <div className="w-11 h-11 rounded-[5px] bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-xl">
                        <FaUserTie />
                    </div>
                </div>

                {/* Monthly Average */}
                <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] p-2 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('monthlyEstCol')}</p>
                        <h3 className="text-xl font-black text-amber-600 font-mono mt-1">
                            ${(() => {
                                const mCount = (stats.monthlyStats && stats.monthlyStats.length) || 1;
                                const avg = (stats.grandTotal || 0) / mCount;
                                return Math.round(avg).toLocaleString();
                            })()}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">គណនាតាមខែដែលមានទិន្នន័យ</p>
                    </div>
                    <div className="w-11 h-11 rounded-[5px] bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl">
                        <FaReceipt />
                    </div>
                </div>
            </div>

            {/* Monthly Bar Chart (ក្រាបសសរ) */}
            <SalaryBarChart
                data={stats.monthlyStats || []}
                grandTotal={stats.grandTotal || 0}
                title={t('monthlySalaryBarChart')}
                subtitle="ក្រាបស្ថិតិសរុបប្រាក់ខែប្រចាំខែដើម្បីពិនិត្យនិន្នាការនៃការចំណាយ"
            />

            {/* Filter & Search Bar */}
            <div className="bg-[var(--app-card,white)] p-2 rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-xs flex flex-wrap items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <DatabaseSearchInput
                        apiBase={API_BASE}
                        endpoint="/salary"
                        params={{
                            userBrand: user?.brand || '',
                            userRole: user?.role || '',
                            username: user?.username || '',
                            isImmutable: user?.isImmutable ? 'true' : 'false',
                            ...(isAdmin && activeStaffKey ? { staffName: activeStaffKey } : {}),
                            ...(selectedMonth ? { month: selectedMonth } : {}),
                            ...(selectedPaymentMethod ? { paymentMethod: selectedPaymentMethod } : {}),
                            ...(startDate ? { startDate } : {}),
                            ...(endDate ? { endDate } : {})
                        }}
                        value={searchTerm}
                        placeholder="ស្វែងរកតាមឈ្មោះបុគ្គលិក, កំណត់ចំណាំ, ឬប្រភេទ..."
                        onChange={(value) => {
                            setSearchTerm(value);
                            setSelectedSearchRecord(null);
                            setCurrentPage(1);
                        }}
                        onSelect={(record) => {
                            setSelectedSearchRecord(record);
                            setSearchTerm(record.staffNameEn || record.staffNameKh || record.staffName || '');
                            setCurrentPage(1);
                        }}
                        getLabel={(record) => record.staffNameEn || record.staffNameKh || record.staffName || ''}
                        getDescription={(record) => [record.date, record.amount != null ? `$${Number(record.amount).toLocaleString()}` : '', record.paymentMethod, record.note || record.description].filter(Boolean).join(' · ')}
                        className="relative flex-1"
                    />
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
                            <option value="">{t('allMethods')}</option>
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
            <div className="w-full overflow-x-auto rounded-[5px] border border-[var(--app-border,#e2e8f0)] bg-[var(--app-card,white)] shadow-md table-container">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-[var(--app-border,#e2e8f0)]">
                        <tr>
                            <th className="px-4 py-1 text-center">No</th>
                            <th className="px-4 py-1">{t('date')}</th>
                            <th className="px-4 py-1">{t('staff')}</th>
                            <th className="px-4 py-1">ថ្ងៃចូលបម្រើ</th>
                            <th className="px-4 py-1 text-right">{t('amount')}</th>
                            <th className="px-4 py-1 text-center">វិធីសាស្ត្រទូទាត់</th>
                            <th className="px-4 py-1">{t('category')}</th>
                            <th className="px-4 py-1 text-center">រូបភាពភស្តុតាង</th>
                            <th className="px-4 py-1">{t('note')}</th>
                            <th className="px-4 py-1">បញ្ចូលដោយ</th>
                            <th className="px-4 py-1 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-[var(--app-text,#0f172a)]">
                        {loading ? (
                            <tr>
                                <td colSpan={11} className="text-center py-10 text-slate-400 italic">
                                    កំពុងទាញយកទិន្នន័យប្រាក់ខែ...
                                </td>
                            </tr>
                        ) : (selectedSearchRecord ? [selectedSearchRecord] : salaries).length === 0 ? (
                            <tr>
                                <td colSpan={11} className="text-center py-12 text-slate-400 italic">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FaReceipt className="text-3xl opacity-30 text-slate-400" />
                                        <span>មិនមានទិន្នន័យប្រាក់ខែនៅឡើយទេ។ សូមចុចប៊ូតុង "បញ្ចូលប្រាក់ខែ" ដើម្បីបង្កើតថ្មី!</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            (selectedSearchRecord ? [selectedSearchRecord] : salaries).map((item, idx) => (
                                <tr key={item._id || item.id || idx} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
                                    <td className="px-4 py-1 text-center font-mono text-slate-500 font-semibold">
                                        {(currentPage - 1) * itemsPerPage + idx + 1}
                                    </td>
                                    <td className="px-4 py-1 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {item.date}
                                    </td>
                                    <td className="px-4 py-1">
                                        <div>
                                            {item.staffNameKh && (
                                                <p className="font-black text-slate-900 dark:text-white">{item.staffNameKh}</p>
                                            )}
                                            <p className={`font-bold ${item.staffNameKh ? 'text-slate-500 text-[11px]' : 'text-slate-900 font-black'}`}>
                                                {item.staffNameEn || item.staffName || '—'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-1 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {item.joinDate || '—'}
                                    </td>
                                    <td className="px-4 py-1 text-right font-mono font-black text-emerald-600 text-sm">
                                        ${Number(item.amount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-1 text-center">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                            {item.paymentMethod || 'ABA Bank'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            {item.category || 'Basic Salary'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1 text-center">
                                        {getProofPhotos(item).length > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProofGalleryImages(getProofPhotos(item));
                                                    setProofGalleryIndex(0);
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-[5px] text-[10px] font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
                                                title={t('receiptEvidence')}
                                            >
                                                <FaEye />
                                                <span>មើលរូប{getProofPhotos(item).length > 1 ? ` (${getProofPhotos(item).length})` : ''}</span>
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 text-[10px] italic">គ្មានរូប</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-1 max-w-[200px] truncate text-slate-600 dark:text-slate-400" title={item.note || ''}>
                                        {item.note || '—'}
                                    </td>
                                    <td className="px-4 py-1 text-slate-500 text-[11px] font-mono">
                                        {item.createdBy || 'Administrator'}
                                    </td>
                                    <td className="px-4 py-1 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {hasPermission('/salary', 'edit') && (
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                                    title={t('edit')}
                                                >
                                                    <FaEdit size={13} />
                                                </button>
                                            )}
                                            {hasPermission('/salary', 'delete') && (
                                                <button
                                                    onClick={() => handleDelete(item._id || item.id)}
                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                                    title={t('delete')}
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
                {!selectedSearchRecord && total > itemsPerPage && (
                    <div className="p-2 border-t border-[var(--app-border,#e2e8f0)] flex items-center justify-between">
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
                <CreateEditSalaryModal
                    openModal={openModal}
                    setOpenModal={setOpenModal}
                    editingItem={editingItem}
                    formData={formData}
                    setFormData={setFormData}
                    handleFormSubmit={handleFormSubmit}
                    submitting={submitting}
                    photoUploading={photoUploading}
                    photoFileRef={photoFileRef}
                    handlePhotoUpload={handlePhotoUpload}
                    savedStaffNameKh={savedStaffNameKh}
                    savedStaffNameEn={savedStaffNameEn}
                />
            )}

            {/* Image Preview Lightbox Modal with Download */}
            {proofGalleryImages.length > 0 && (
                <ImageGalleryModal
                    images={proofGalleryImages}
                    index={proofGalleryIndex}
                    onIndexChange={setProofGalleryIndex}
                    onClose={() => setProofGalleryImages([])}
                    title={t('receiptEvidence')}
                />
            )}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-2 animate-in fade-in duration-150"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-3xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-[5px] overflow-hidden p-2 shadow-2xl flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2 gap-3 flex-wrap">
                            <span className="text-xs font-bold flex items-center gap-2 truncate">
                                <FaQrcode className="text-emerald-400 shrink-0" />
                                <span className="truncate">
                                    {typeof previewImage === 'object'
                                        ? (previewImage.title || 'រូបភាព (Image Preview)')
                                        : 'រូបភាពភស្តុតាងប្រាក់ខែ (Salary Photo)'}
                                </span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadImage(
                                        typeof previewImage === 'object' ? previewImage.url : previewImage,
                                        typeof previewImage === 'object' ? (previewImage.filename || 'salary_photo.png') : 'salary_photo.png'
                                    )}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95"
                                    title="ទាញយករូបភាពនេះទុក (Download Image)"
                                >
                                    <FaDownload className="text-xs" />
                                    <span>ទាញយក (Download)</span>
                                </button>
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="text-slate-400 hover:text-white p-2 rounded-md transition-colors cursor-pointer"
                                    title="បិទ (Close)"
                                >
                                    <FaTimes size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-center p-2 overflow-auto w-full">
                            <img
                                src={typeof previewImage === 'object' ? previewImage.url : previewImage}
                                alt="Preview"
                                className="max-h-[70vh] max-w-full object-contain rounded-lg border border-slate-800 shadow-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CREATE / EDIT SALARY MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const CreateEditSalaryModal = ({
    openModal,
    setOpenModal,
    editingItem,
    formData,
    setFormData,
    handleFormSubmit,
    submitting,
    photoUploading,
    photoFileRef,
    handlePhotoUpload
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-2 animate-in fade-in duration-150">
            <div className="bg-[var(--app-card,white)] border border-[var(--app-border,#e2e8f0)] rounded-[5px] w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-border,#e2e8f0)] bg-emerald-600 text-white shrink-0">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <FaMoneyBillWave />
                        <span>{editingItem ? [t('editSalary')]: 'បញ្ចូលប្រាក់ខែថ្មី (Create Salary Entry)'}</span>
                    </h3>
                    <button
                        onClick={() => setOpenModal(false)}
                        className="text-white/80 hover:text-white p-2 rounded-md transition-colors cursor-pointer"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                    {/* Staff Names Row (Khmer & English) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                ឈ្មោះខ្មែរ (Khmer Name)
                            </label>
                            <input
                                type="text"
                                value={formData.staffNameKh}
                                onChange={(e) => setFormData({ ...formData, staffNameKh: e.target.value })}
                                placeholder="ឈ្មោះបុគ្គលិកជាភាសាខ្មែរ..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)] font-bold"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                ឈ្មោះអង់គ្លេស (English Name)
                            </label>
                            <input
                                type="text"
                                value={formData.staffNameEn}
                                onChange={(e) => setFormData({ ...formData, staffNameEn: e.target.value })}
                                placeholder="e.g. Sok San..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)] font-bold"
                            />
                        </div>
                    </div>

                    {/* Join Date & Amount Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                ថ្ងៃចូលបម្រើការងារ (Join Date)
                            </label>
                            <input
                                type="date"
                                value={formData.joinDate}
                                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs outline-none focus:border-emerald-500 text-[var(--app-text,#0f172a)]"
                            />
                        </div>

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
                    </div>

                    {/* Date & Category Row */}
                    <div className="grid grid-cols-2 gap-3">
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

                    {/* Payment Method & Brand Row */}
                    <div className="grid grid-cols-2 gap-3">
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

                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {t('brand')}
                            </label>
                            <input
                                type="text"
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                placeholder={t('brand')}
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

                            <ImageUrlListInput
                                onAddUrls={urls => setFormData(prev => {
                                    const proofPhotos = [...new Set([...getProofPhotos(prev), ...urls])];
                                    return { ...prev, proofPhoto: proofPhotos[0] || '', proofPhotos };
                                })}
                            />

                            {/* Preview Box */}
                            {getProofPhotos(formData).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {getProofPhotos(formData).map((url, index) => (
                                        <div key={`${url}-${index}`} className="relative border border-slate-300 dark:border-slate-700 rounded-[5px] p-1 bg-slate-50 dark:bg-slate-800">
                                            <img src={url} alt={`Receipt preview ${index + 1}`} className="h-16 w-16 rounded object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => {
                                                    const proofPhotos = getProofPhotos(prev).filter((_, photoIndex) => photoIndex !== index);
                                                    return { ...prev, proofPhoto: proofPhotos[0] || '', proofPhotos };
                                                })}
                                                className="absolute -right-1 -top-1 bg-rose-600 text-white p-1.5 rounded-full text-[9px] hover:bg-rose-500 cursor-pointer shadow-md"
                                                title="ដករូបចេញ"
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
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
    );
};

export default SalaryPage;
