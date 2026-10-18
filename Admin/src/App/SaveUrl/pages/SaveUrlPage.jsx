import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlus,
    FaSearch,
    FaFilter,
    FaGlobe,
    FaLock,
    FaUnlock,
    FaExternalLinkAlt,
    FaCopy,
    FaCheck,
    FaEdit,
    FaTrash,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaLink,
    FaBookmark,
    FaSpinner,
    FaTags,
    FaEye,
    FaThLarge,
    FaList
} from 'react-icons/fa';
import { MdOutlineBookmark, MdOutlineSearch, MdOutlineCategory } from 'react-icons/md';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 10;
const PUBLIC_CHUNK_SIZE = 5;
const SEE_ALL_CHUNK_SIZE = 15;

const PRESET_CATEGORIES = [
    'General',
    'Work/System',
    'Tools & Utilities',
    'Social Media',
    'Documentation',
    'Payment & Banking',
    'Cloud & Storage',
    'Other'
];

const getCategoryColor = (cat) => {
    switch ((cat || '').toLowerCase()) {
        case 'work/system':
            return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
        case 'tools & utilities':
        case 'tools':
            return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
        case 'social media':
            return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800';
        case 'documentation':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
        case 'payment & banking':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
        case 'cloud & storage':
            return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
};

const formatDomain = (urlStr) => {
    try {
        const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return urlStr;
    }
};

const SaveUrlPage = () => {
    const { t } = useLanguage();
    const { API_BASE, user, hasPermission } = useAuth();

    // Main Table state
    const [urls, setUrls] = useState([]);
    const [stats, setStats] = useState({ totalAll: 0, publicCount: 0, privateCount: 0, categoriesCount: {} });
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedVisibility, setSelectedVisibility] = useState('All');

    // Top Public Showcase state (Horizontal Infinite Scroll / Progressive reveal)
    const [publicUrls, setPublicUrls] = useState([]);
    const [publicTotal, setPublicTotal] = useState(0);
    const [visiblePublicCount, setVisiblePublicCount] = useState(5);
    const [loadingPublic, setLoadingPublic] = useState(true);
    const horizontalScrollRef = useRef(null);

    // "See All" Modal state
    const [seeAllOpen, setSeeAllOpen] = useState(false);
    const [seeAllSearch, setSeeAllSearch] = useState('');
    const [seeAllCategory, setSeeAllCategory] = useState('All');
    const [seeAllVisibleCount, setSeeAllVisibleCount] = useState(SEE_ALL_CHUNK_SIZE);
    const seeAllContainerRef = useRef(null);

    // Modals
    const [openModal, setOpenModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    // Delete confirm modal
    const [deleteModalItem, setDeleteModalItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Form data
    const initialForm = {
        title: '',
        url: '',
        category: 'General',
        customCategory: '',
        visibility: 'Public',
        description: '',
        brand: user?.brand || '',
        subBrand: ''
    };
    const [formData, setFormData] = useState(initialForm);
    const [brandSubbrandsMap, setBrandSubbrandsMap] = useState({});

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Main Table Saved URLs
    // ─────────────────────────────────────────────────────────────────────────
    const fetchSavedUrls = useCallback(async (pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : '',
                ...(search.trim() ? { search: search.trim() } : {}),
                ...(selectedCategory && selectedCategory !== 'All' ? { category: selectedCategory } : {}),
                ...(selectedVisibility && selectedVisibility !== 'All' ? { visibility: selectedVisibility } : {})
            });

            const res = await fetch(`${API_BASE}/saved-urls?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setUrls(data.data || []);
                setTotal(data.total || 0);
                if (data.stats) setStats(data.stats);
            }
        } catch (err) {
            console.error('Fetch saved URLs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 400);
        }
    }, [API_BASE, page, searchTerm, selectedCategory, selectedVisibility, user]);

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Public URLs for top showcase & see all
    // ─────────────────────────────────────────────────────────────────────────
    const fetchPublicUrls = useCallback(async () => {
        setLoadingPublic(true);
        try {
            const params = new URLSearchParams({
                page: 1,
                limit: 100,
                brand: user?.brand || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userRole: user?.role || '',
                userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
            });
            const res = await fetch(`${API_BASE}/saved-urls/public?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPublicUrls(data.data || []);
                setPublicTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch public saved URLs error:', err);
        } finally {
            setLoadingPublic(false);
        }
    }, [API_BASE, user]);

    useEffect(() => {
        fetchSavedUrls(page, searchTerm);
    }, [page, selectedCategory, selectedVisibility, fetchSavedUrls]);

    useEffect(() => {
        fetchPublicUrls();
    }, [fetchPublicUrls]);

    // Fetch brand subbrands map
    useEffect(() => {
        const go = async () => {
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.brand_subbrands) setBrandSubbrandsMap(data.brand_subbrands);
                }
            } catch { }
        };
        go();
    }, [API_BASE]);

    // Handle Copy URL
    const handleCopy = (urlStr, id) => {
        if (!urlStr) return;
        navigator.clipboard.writeText(urlStr);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Handle Track Click
    const handleOpenLink = (item) => {
        if (!item?.url) return;
        try {
            fetch(`${API_BASE}/saved-urls/${item._id || item.id}/click`, { method: 'PATCH' }).catch(() => { });
        } catch { }
        window.open(item.url, '_blank', 'noopener,noreferrer');
    };

    // Horizontal Scroll Handler (Top Showcase)
    const handleHorizontalScroll = () => {
        const el = horizontalScrollRef.current;
        if (!el) return;
        // If scrolled near the right end, reveal next 5 items
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 80) {
            if (visiblePublicCount < publicUrls.length) {
                setVisiblePublicCount(prev => Math.min(prev + PUBLIC_CHUNK_SIZE, publicUrls.length));
            }
        }
    };

    const scrollLeft = () => {
        if (horizontalScrollRef.current) {
            horizontalScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (horizontalScrollRef.current) {
            // If near end and more items exist, load next chunk before scrolling
            if (visiblePublicCount < publicUrls.length) {
                setVisiblePublicCount(prev => Math.min(prev + PUBLIC_CHUNK_SIZE, publicUrls.length));
            }
            horizontalScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
        }
    };

    // "See All" Infinite Scroll Handler
    const handleSeeAllScroll = () => {
        const el = seeAllContainerRef.current;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
            setSeeAllVisibleCount(prev => Math.min(prev + 15, 100));
        }
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setEditingItem(null);
        const availSubs = user?.role === 'Administrator'
            ? (brandSubbrandsMap[user?.brand] || [])
            : (Array.isArray(user?.subBrands) ? user.subBrands : []);
        setFormData({
            ...initialForm,
            brand: user?.brand || '',
            subBrand: availSubs.length === 1 ? availSubs[0] : ''
        });
        setOpenModal(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingItem(item);
        const isPreset = PRESET_CATEGORIES.includes(item.category);
        setFormData({
            title: item.title || '',
            url: item.url || '',
            category: isPreset ? item.category : 'Other',
            customCategory: isPreset ? '' : (item.category || ''),
            visibility: item.visibility || 'Public',
            description: item.description || '',
            brand: item.brand || user?.brand || '',
            subBrand: item.subBrand || ''
        });
        setOpenModal(true);
    };

    // Form Submit
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('សូមបញ្ចូលចំណងជើង URL (Title is required)');
            return;
        }
        if (!formData.url.trim()) {
            alert('សូមបញ្ចូលតំណភ្ជាប់ URL (URL is required)');
            return;
        }

        const finalCategory = formData.category === 'Other' && formData.customCategory.trim()
            ? formData.customCategory.trim()
            : formData.category;

        setSubmitting(true);
        try {
            const payload = {
                title: formData.title.trim(),
                url: formData.url.trim(),
                category: finalCategory,
                visibility: formData.visibility,
                description: formData.description.trim(),
                brand: formData.brand,
                subBrand: formData.subBrand || '',
                createdBy: editingItem ? editingItem.createdBy : (user?.username || user?.name || 'Administrator'),
                updatedBy: user?.username || user?.name || 'Administrator',
                // Auth info so backend can verify ownership on PUT
                username: user?.username || '',
                isImmutable: user?.isImmutable || false,
                userRole: user?.role || ''
            };

            const url = editingItem
                ? `${API_BASE}/saved-urls/${editingItem._id || editingItem.id}`
                : `${API_BASE}/saved-urls`;
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
                fetchSavedUrls(page);
                fetchPublicUrls();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || 'បរាជ័យក្នុងការរក្សាទុក URL');
            }
        } catch (err) {
            console.error('Submit saved URL error:', err);
            alert('Server error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Check if current user is master admin
    const isMasterAdmin = (
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable === true ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin'
    );

    // Delete URL Handler
    const handleExecuteDelete = async () => {
        if (!deleteModalItem) return;
        setDeleting(true);
        try {
            const params = new URLSearchParams({
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                userRole: user?.role || ''
            });
            const res = await fetch(`${API_BASE}/saved-urls/${deleteModalItem._id || deleteModalItem.id}?${params.toString()}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setDeleteModalItem(null);
                fetchSavedUrls(page);
                fetchPublicUrls();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || 'បរាជ័យក្នុងការលុប URL');
            }
        } catch (err) {
            console.error('Delete saved URL error:', err);
            alert('Error deleting: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    // Filtered items for "See All" Modal
    const filteredSeeAllList = publicUrls.filter(item => {
        if (seeAllCategory && seeAllCategory !== 'All' && item.category !== seeAllCategory) return false;
        if (seeAllSearch.trim()) {
            const s = seeAllSearch.trim().toLowerCase();
            return (
                (item.title && item.title.toLowerCase().includes(s)) ||
                (item.url && item.url.toLowerCase().includes(s)) ||
                (item.description && item.description.toLowerCase().includes(s)) ||
                (item.category && item.category.toLowerCase().includes(s))
            );
        }
        return true;
    });

    const displayedSeeAllList = filteredSeeAllList.slice(0, seeAllVisibleCount);

    return (
        <div className="w-full bg-[#f4f6f8] p-2 select-none space-y-2" data-allow-scroll="true">
            {/* Top Header Bar */}
            <header className="p-2 w-full border border-slate-200 bg-white rounded-[5px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[5px] bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-xl shadow-2xs">
                        <FaBookmark />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Save URL (រក្សាទុក URL)</span>
                        </h1>
                        <p className="text-[11px] text-slate-500">
                            រក្សាទុក និងគ្រប់គ្រងតំណភ្ជាប់ URL សំខាន់ៗ (Public & Private Link Vault)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    >
                        <FaPlus />
                        <span>បញ្ចូល URL ថ្មី (Add URL)</span>
                    </button>
                </div>
            </header>

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* TOP PUBLIC URL SHOWCASE SECTION (Horizontal 5-Item Scroll)       */}
            {/* ───────────────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-white">

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <FaGlobe className="text-lg" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm font-bold text-slate-800">
                                    Public URLs
                                </h2>

                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                                    {publicTotal}
                                </span>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-0.5">
                                តំណភ្ជាប់សាធារណៈដែលបានរក្សាទុក
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setSeeAllSearch('');
                                setSeeAllCategory('All');
                                setSeeAllVisibleCount(SEE_ALL_CHUNK_SIZE);
                                setSeeAllOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all cursor-pointer"
                        >
                            <FaThLarge />
                            <span>See All</span>
                            <span className="text-slate-400">({publicTotal})</span>
                        </button>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={scrollLeft}
                                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
                                title="Scroll Left"
                                aria-label="Scroll Left"
                            >
                                <FaChevronLeft className="text-xs" />
                            </button>

                            <button
                                type="button"
                                onClick={scrollRight}
                                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
                                title="Scroll Right"
                                aria-label="Scroll Right"
                            >
                                <FaChevronRight className="text-xs" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {/* Content - Table Layout */}
                <div className="p-3 sm:p-4">

                    {loadingPublic ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                            <FaSpinner className="animate-spin text-emerald-600" />
                            <span>កំពុងទាញយក Public URLs...</span>
                        </div>
                    ) : publicUrls.length === 0 ? (
                        <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg">
                            <FaGlobe className="mx-auto mb-2 text-2xl text-slate-300" />
                            <p className="text-xs text-slate-500">
                                មិនទាន់មាន Public URL នៅឡើយទេ។
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-[170px] overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left border-collapse min-w-[650px]">

                                {/* Table Header */}
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            #
                                        </th>
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Title / Description
                                        </th>
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Category
                                        </th>
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Domain
                                        </th>
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                                            Visibility
                                        </th>
                                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                {/* Table Body */}
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {publicUrls.slice(0, visiblePublicCount).map((item, idx) => {
                                        const domain = formatDomain(item.url);
                                        const isCopied = copiedId === (item._id || item.id);

                                        return (
                                            <tr
                                                key={item._id || item.id || idx}
                                                className="hover:bg-emerald-50/40 transition-colors group"
                                            >
                                                {/* Number */}
                                                <td className="px-3 py-2.5 text-[11px] text-slate-400 font-mono">
                                                    {idx + 1}
                                                </td>

                                                {/* Title */}
                                                <td className="px-3 py-2.5 max-w-[240px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenLink(item)}
                                                        className="block max-w-full text-left text-xs font-semibold text-slate-800 hover:text-emerald-700 truncate cursor-pointer"
                                                        title={item.title}
                                                    >
                                                        {item.title}
                                                    </button>

                                                    {item.description && (
                                                        <p
                                                            className="mt-0.5 text-[10px] text-slate-400 truncate max-w-[220px]"
                                                            title={item.description}
                                                        >
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Category */}
                                                <td className="px-3 py-2.5">
                                                    <span
                                                        className={`inline-flex px-2 py-1 rounded-md text-[10px] font-semibold border ${getCategoryColor(item.category)}`}
                                                    >
                                                        {item.category || 'General'}
                                                    </span>
                                                </td>

                                                {/* Domain */}
                                                <td className="px-3 py-2.5 max-w-[180px]">
                                                    <div
                                                        className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono"
                                                        title={item.url}
                                                    >
                                                        <FaLink className="text-emerald-500 text-[10px] shrink-0" />
                                                        <span className="truncate">{domain}</span>
                                                    </div>
                                                </td>

                                                {/* Visibility */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        Public
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center justify-end gap-1.5">

                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(item.url, item._id || item.id)}
                                                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer ${isCopied
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                                }`}
                                                            title="ចម្លង URL"
                                                        >
                                                            {isCopied
                                                                ? <FaCheck />
                                                                : <FaCopy />}
                                                            {isCopied ? 'Copied' : 'Copy'}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenLink(item)}
                                                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                                                        >
                                                            Open
                                                            <FaExternalLinkAlt className="text-[9px]" />
                                                        </button>

                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Load More */}
                            {visiblePublicCount < publicUrls.length && (
                                <div className="p-2.5 flex items-center justify-center border-t border-slate-100 bg-slate-50">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setVisiblePublicCount(prev =>
                                                Math.min(prev + PUBLIC_CHUNK_SIZE, publicUrls.length)
                                            )
                                        }
                                        className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer"
                                    >
                                        + Load More (
                                        {Math.min(
                                            PUBLIC_CHUNK_SIZE,
                                            publicUrls.length - visiblePublicCount
                                        )})
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* MAIN SAVED URL TABLE & FILTER BAR                                */}
            {/* ───────────────────────────────────────────────────────────────── */}
            <div className="bg-white p-2.5 rounded-[5px] border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px]">
                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        placeholder="ស្វែងរកតាមចំណងជើង, URL, កំណត់ចំណាំ, ឬប្រភេទ..."
                        className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[5px] outline-none focus:border-emerald-500 text-slate-800 font-medium"
                    />
                </div>

                {/* Filter Options */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Visibility Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold text-[11px]">Visibility:</span>
                        <select
                            value={selectedVisibility}
                            onChange={(e) => {
                                setSelectedVisibility(e.target.value);
                                setPage(1);
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-[5px] outline-none text-slate-800 font-bold cursor-pointer"
                        >
                            <option value="All">All ({stats.totalAll || 0})</option>
                            <option value="Public">Public ({stats.publicCount || 0})</option>
                            <option value="Private">Private ({stats.privateCount || 0})</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold text-[11px]">Category:</span>
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setPage(1);
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-[5px] outline-none text-slate-800 font-bold cursor-pointer"
                        >
                            <option value="All">All Categories</option>
                            {PRESET_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {(searchTerm || selectedCategory !== 'All' || selectedVisibility !== 'All') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('All');
                                setSelectedVisibility('All');
                                setPage(1);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-[5px] border border-rose-200 transition-all cursor-pointer"
                        >
                            សម្អាត Filter
                        </button>
                    )}
                </div>
            </div>

            {/* My URLs Table label */}
            <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[10px]">
                        <FaLock />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">
                        URL របស់ខ្ញុំ (My Saved URLs)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                        — បង្ហាញតែ URL ដែលអ្នកបង្កើតផ្ទាល់ប៉ុណ្ណោះ
                    </span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Public URLs របស់អ្នកដទៃ → ឃើញខាងលើ
                </span>
            </div>

            {/* Saved URLs Table */}
            <div className="w-full overflow-x-auto rounded-[5px] border border-slate-200 bg-white shadow-md table-container">
                <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                        <tr>
                            <th className="px-4 py-1.5 text-center">No</th>
                            <th className="px-4 py-1.5">ចំណងជើង URL (Title)</th>
                            <th className="px-4 py-1.5">តំណភ្ជាប់ (URL Link)</th>
                            <th className="px-4 py-1.5">ប្រភេទ (Category)</th>
                            <th className="px-4 py-1.5">Sub Brand</th>
                            <th className="px-4 py-1.5 text-center">ភាពមើលឃើញ (Visibility)</th>
                            <th className="px-4 py-1.5">កំណត់ចំណាំ (Description)</th>
                            <th className="px-4 py-1.5">បង្កើតដោយ (By)</th>
                            <th className="px-4 py-1.5">កាលបរិច្ឆេទ (Date)</th>
                            <th className="px-4 py-1.5 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800 whitespace-nowrap">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="text-center py-10 text-slate-400 italic">
                                    កំពុងទាញយកទិន្នន័យ URLs...
                                </td>
                            </tr>
                        ) : urls.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-12 text-slate-400 italic">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FaLink className="text-3xl opacity-30 text-slate-400" />
                                        <span>មិនមានទិន្នន័យ URL ត្រូវបានរក្សាទុកនៅឡើយទេ។ សូមចុចប៊ូតុង "បញ្ចូល URL ថ្មី" ដើម្បីបង្កើត!</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            urls.map((item, idx) => {
                                const isPublic = item.visibility === 'Public';
                                const createdDateStr = item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '—';
                                const isCopied = copiedId === (item._id || item.id);
                                // Only the creator or master admin can edit/delete
                                const isOwner = isMasterAdmin ||
                                    (item.createdBy || '').trim().toLowerCase() === (user?.username || '').trim().toLowerCase();

                                return (
                                    <tr key={item._id || item.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="px-4 py-1.5 text-center font-mono text-slate-500 font-semibold">
                                            {(page - 1) * LIMIT + idx + 1}
                                        </td>

                                        {/* Title */}
                                        <td className="px-4 py-1.5 font-bold text-slate-900 max-w-[200px] truncate">
                                            <span
                                                className="cursor-pointer hover:text-emerald-600 transition-colors"
                                                onClick={() => handleOpenLink(item)}
                                                title={item.title}
                                            >
                                                {item.title}
                                            </span>
                                        </td>

                                        {/* URL with 1-click Copy */}
                                        <td className="px-4 py-1.5 font-mono max-w-[260px] truncate">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(item.url, item._id || item.id)}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-600 cursor-pointer"
                                                    title="ចម្លង URL"
                                                >
                                                    {isCopied ? <FaCheck className="text-emerald-600 text-xs" /> : <FaCopy className="text-xs" />}
                                                </button>
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-emerald-700 hover:underline truncate"
                                                    title={item.url}
                                                >
                                                    {item.url}
                                                </a>
                                            </div>
                                        </td>

                                        {/* Category Badge */}
                                        <td className="px-4 py-1.5">
                                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryColor(item.category)}`}>
                                                {item.category || 'General'}
                                            </span>
                                        </td>

                                        {/* Sub Brand */}
                                        <td className="px-4 py-1.5">
                                            {item.subBrand ? (
                                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[10px] font-bold">
                                                    {item.subBrand}
                                                </span>
                                            ) : <span className="text-slate-400">—</span>}
                                        </td>

                                        {/* Visibility Badge */}
                                        <td className="px-4 py-1.5 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${isPublic
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                {isPublic ? <FaGlobe size={10} /> : <FaLock size={10} />}
                                                <span>{item.visibility || 'Public'}</span>
                                            </span>
                                        </td>

                                        {/* Note / Description */}
                                        <td className="px-4 py-1.5 max-w-[280px] text-slate-600 whitespace-normal" title={item.description || ''}>
                                            <p className="line-clamp-3 text-xs leading-snug" title={item.description || ''}>
                                                {item.description || '—'}
                                            </p>
                                        </td>

                                        {/* Created By */}
                                        <td className="px-4 py-1.5 font-mono text-slate-600 text-[11px]">
                                            {item.createdBy || 'Administrator'}
                                        </td>

                                        {/* Date */}
                                        <td className="px-4 py-1.5 font-mono text-slate-500 text-[11px]">
                                            {createdDateStr}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-1.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLink(item)}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                                    title="បើកតំណភ្ជាប់ (Open Link)"
                                                >
                                                    <FaExternalLinkAlt size={12} />
                                                </button>

                                                {isOwner && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                                        title="កែប្រែ (Edit URL)"
                                                    >
                                                        <FaEdit size={13} />
                                                    </button>
                                                )}

                                                {isOwner && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteModalItem(item)}
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                        title="លុប (Delete URL)"
                                                    >
                                                        <FaTrash size={12} />
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

                {/* Pagination */}
                {total > LIMIT && (
                    <div className="p-2 border-t border-slate-200 flex items-center justify-between">
                        <Pagination
                            currentPage={page}
                            totalItems={total}
                            itemsPerPage={LIMIT}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* "SEE ALL" PUBLIC URLS LIGHTBOX / MODAL (Infinite Scroll 15-100+)  */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {seeAllOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
                    onClick={() => setSeeAllOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
                            <div className="flex items-center gap-2.5">
                                <FaGlobe className="text-xl" />
                                <div>
                                    <h3 className="text-sm font-bold">Public URLs Directory (បញ្ជីតំណភ្ជាប់សាធារណៈទាំងអស់)</h3>
                                    <p className="text-[11px] text-white/80">បង្ហាញទិន្នន័យម្ដង ១៥ ទៅ ១០០+ ដោយ Scroll ចុះក្រោម</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSeeAllOpen(false)}
                                className="text-white/80 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        {/* Search & Category Filter Bar */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    value={seeAllSearch}
                                    onChange={(e) => setSeeAllSearch(e.target.value)}
                                    placeholder="ស្វែងរកក្នុង Public URLs..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-medium text-slate-800"
                                />
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">ប្រភេទ:</span>
                                <select
                                    value={seeAllCategory}
                                    onChange={(e) => setSeeAllCategory(e.target.value)}
                                    className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    <option value="All">All Categories</option>
                                    {PRESET_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Public Cards Grid with Infinite Scroll */}
                        <div
                            ref={seeAllContainerRef}
                            onScroll={handleSeeAllScroll}
                            className="p-5 overflow-y-auto flex-1 space-y-4"
                        >
                            {displayedSeeAllList.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 text-xs italic">
                                    មិនមាន Public URL ត្រូវនឹងការស្វែងរកឡើយ
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                    {displayedSeeAllList.map((item, idx) => {
                                        const domain = formatDomain(item.url);
                                        const isCopied = copiedId === (item._id || item.id);

                                        return (
                                            <div
                                                key={item._id || item.id || idx}
                                                className="bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 group"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate max-w-[150px] ${getCategoryColor(item.category)}`}>
                                                            {item.category || 'General'}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                                            <FaGlobe className="text-emerald-500" />
                                                            <span>Public</span>
                                                        </span>
                                                    </div>

                                                    <h4
                                                        className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 hover:text-emerald-600 cursor-pointer transition-colors"
                                                        onClick={() => handleOpenLink(item)}
                                                        title={item.title}
                                                    >
                                                        {item.title}
                                                    </h4>

                                                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-mono bg-emerald-50/70 border border-emerald-200/60 px-2 py-1 rounded truncate">
                                                        <FaLink className="text-[9px] shrink-0" />
                                                        <span className="truncate" title={item.url}>{domain}</span>
                                                    </div>

                                                    {item.description && (
                                                        <p className="text-[11px] text-slate-500 line-clamp-3 leading-snug" title={item.description}>
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(item.url, item._id || item.id)}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                                    >
                                                        {isCopied ? <FaCheck className="text-emerald-600" /> : <FaCopy />}
                                                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenLink(item)}
                                                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] cursor-pointer shadow-xs transition-all active:scale-95"
                                                    >
                                                        <span>Open</span>
                                                        <FaExternalLinkAlt className="text-[9px]" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Load more indicator when reaching bottom */}
                            {seeAllVisibleCount < filteredSeeAllList.length && (
                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSeeAllVisibleCount(prev => Math.min(prev + 15, 100))}
                                        className="px-4 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold text-xs rounded-lg transition-all border border-slate-200 cursor-pointer"
                                    >
                                        Scroll ចុះក្រោម ឬ ចុចទីនេះដើម្បីបង្ហាញ ១៥ ទៀត ({filteredSeeAllList.length - seeAllVisibleCount} នៅសល់)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* CREATE / EDIT URL MODAL                                          */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {openModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
                    onClick={() => setOpenModal(false)}
                >
                    <div
                        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <FaBookmark />
                                <span>{editingItem ? 'កែប្រែ URL (Edit Saved URL)' : 'បញ្ចូល URL ថ្មី (Save New URL)'}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOpenModal(false)}
                                className="text-white/80 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                            {/* Title */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    ចំណងជើង URL (Title / Name) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. ABA PayWay Dashboard, Facebook Page, Google Drive..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 text-slate-900 font-bold"
                                />
                            </div>

                            {/* URL Link */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    តំណភ្ជាប់ URL Link <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <FaLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        placeholder="https://example.com/..."
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 font-mono text-emerald-700 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Visibility (Public vs Private) */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    ភាពមើលឃើញ (Visibility) <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${formData.visibility === 'Public'
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="Public"
                                            checked={formData.visibility === 'Public'}
                                            onChange={() => setFormData({ ...formData, visibility: 'Public' })}
                                            className="accent-emerald-600"
                                        />
                                        <div>
                                            <p className="font-bold flex items-center gap-1.5">
                                                <FaGlobe className="text-emerald-600" />
                                                <span>Public (សាធារណៈ)</span>
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">បង្ហាញក្នុងតារាង និងផ្នែកខាងលើ (Showcase)</p>
                                        </div>
                                    </label>

                                    <label
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${formData.visibility === 'Private'
                                            ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="Private"
                                            checked={formData.visibility === 'Private'}
                                            onChange={() => setFormData({ ...formData, visibility: 'Private' })}
                                            className="accent-amber-600"
                                        />
                                        <div>
                                            <p className="font-bold flex items-center gap-1.5">
                                                <FaLock className="text-amber-600" />
                                                <span>Private (ផ្ទាល់ខ្លួន)</span>
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">ឃើញតែអ្នកបង្កើត និង Admin ប៉ុណ្ណោះ</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <label className="block font-bold text-slate-700 mb-1">
                                    ប្រភេទ (Category)
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 text-slate-800 font-bold cursor-pointer"
                                >
                                    {PRESET_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>

                                {formData.category === 'Other' && (
                                    <input
                                        type="text"
                                        value={formData.customCategory}
                                        onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                                        placeholder="បញ្ចូលឈ្មោះប្រភេទថ្មី..."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 font-bold text-slate-800"
                                    />
                                )}
                            </div>

                            {/* Sub Brand */}
                            {(() => {
                                const availSubs = user?.role === 'Administrator'
                                    ? (brandSubbrandsMap[formData.brand || user?.brand] || [])
                                    : (Array.isArray(user?.subBrands) ? user.subBrands : []);
                                if (availSubs.length === 0) return null;
                                return (
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Sub Brand</label>
                                        {availSubs.length === 1 ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg">
                                                <span className="px-2 py-0.5 bg-indigo-100 border border-indigo-300 text-indigo-700 rounded text-[10px] font-bold">{availSubs[0]}</span>
                                            </div>
                                        ) : (
                                            <select
                                                value={formData.subBrand || ''}
                                                onChange={(e) => setFormData({ ...formData, subBrand: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 text-slate-800 font-bold cursor-pointer"
                                            >
                                                <option value="">Select Sub Brand</option>
                                                {availSubs.map((sb, idx) => (
                                                    <option key={idx} value={sb}>{sb}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Description / Note */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    កំណត់ចំណាំបន្ថែម (Description / Notes)
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="ព័ត៌មានលម្អិត ឬ ការណែនាំបន្ថែមអំពី Link នេះ..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 resize-none text-slate-800"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
                                    {submitting ? 'កំពុងរក្សាទុក...' : editingItem ? 'កែប្រែ (Save Changes)' : 'រក្សាទុក (Save URL)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ───────────────────────────────────────────────────────────────── */}
            {/* DELETE CONFIRMATION MODAL                                        */}
            {/* ───────────────────────────────────────────────────────────────── */}
            {deleteModalItem && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
                    onClick={() => {
                        if (!deleting) setDeleteModalItem(null);
                    }}
                >
                    <div
                        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 relative text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-md">
                            <FaTrash className="text-xl" />
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-900 font-khmer">
                                បញ្ជាក់ការលុប URL (Delete Saved URL)
                            </h3>
                            <p className="text-xs text-slate-500">
                                តើអ្នកពិតជាចង់លុបតំណភ្ជាប់នេះចេញពីប្រព័ន្ធមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានឡើយ។
                            </p>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1 font-medium">
                            <p className="text-slate-800 font-bold truncate">📌 {deleteModalItem.title}</p>
                            <p className="text-emerald-700 font-mono text-[11px] truncate">🔗 {deleteModalItem.url}</p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setDeleteModalItem(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40"
                            >
                                បោះបង់ (Cancel)
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleExecuteDelete}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <>
                                        <FaSpinner className="animate-spin text-xs" />
                                        <span>កំពុងលុប...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaTrash size={11} />
                                        <span>បញ្ជាក់ការលុប (Confirm Delete)</span>
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

export default SaveUrlPage;
