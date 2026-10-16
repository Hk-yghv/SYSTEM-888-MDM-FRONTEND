import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaTrashAlt,
    FaImage,
    FaVideo,
    FaFacebook,
    FaCheck,
    FaTimes,
    FaSyncAlt,
    FaFileAlt,
    FaEye,
    FaEyeSlash,
    FaExternalLinkAlt,
    FaLink,
    FaQuestionCircle,
    FaSlidersH,
    FaLayerGroup,
    FaCommentDots,
    FaReply,
    FaCheckCircle,
    FaClock,
    FaUserCircle,
    FaChevronLeft,
    FaChevronRight,
    FaExclamationCircle
} from 'react-icons/fa';
import { MdSupportAgent, MdOutlineMenuBook, MdOutlineAddPhotoAlternate, MdOutlineFeedback } from 'react-icons/md';

const PRESET_PAGES = [
    'General',
    'Dashboard',
    'Customer',
    'Device',
    'Contract',
    'Installment',
    'Lost Phone',
    'Wallpaper',
    'Report',
    'Follow Up',
    'Salary',
    'Print ID Card',
    'Telegram',
    'Settings'
];

const COMMENTS_PER_PAGE = 10;

const ControlSupportHelp = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    // Active Top-Level Tab: 'guides' or 'comments'
    const [activeTab, setActiveTab] = useState('guides');

    // ─────────────────────────────────────────────────────────────────────────
    // Guides State
    // ─────────────────────────────────────────────────────────────────────────
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedPage, setSelectedPage] = useState('All');

    // Modals for Guides
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [deleteModalItem, setDeleteModalItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form state for Guides
    const initialForm = {
        title: '',
        text: '',
        page: 'General',
        customPage: '',
        photos: [],
        videoUrl: '',
        facebookUrl: '',
        order: 0,
        isActive: true
    };
    const [formData, setFormData] = useState(initialForm);
    const [photoUrlInput, setPhotoUrlInput] = useState('');
    const [showPhotoInputModal, setShowPhotoInputModal] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const fileInputRef = useRef(null);

    // ─────────────────────────────────────────────────────────────────────────
    // Comments to Master Admin State (បង្ហាញម្តង ១០ៗ)
    // ─────────────────────────────────────────────────────────────────────────
    const [comments, setComments] = useState([]);
    const [commentsTotal, setCommentsTotal] = useState(0);
    const [commentPage, setCommentPage] = useState(1);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentSearch, setCommentSearch] = useState('');
    const [commentStatusFilter, setCommentStatusFilter] = useState('All');

    // Modals for Comments
    const [replyingComment, setReplyingComment] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replySubmitting, setReplySubmitting] = useState(false);
    const [deleteCommentModal, setDeleteCommentModal] = useState(null);

    // Open Image in Global Zoom Modal with zoom bar
    const handleOpenImageZoom = (src, alt = '') => {
        if (!src) return;
        window.dispatchEvent(new CustomEvent('openGlobalImageZoom', { detail: { src, alt } }));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Guides
    // ─────────────────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        setReloading(true);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.append('search', search.trim());
            if (selectedPage && selectedPage !== 'All') params.append('page', selectedPage);

            const res = await fetch(`${API_BASE}/support-help?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.data || []);
            }
        } catch (err) {
            console.error('Fetch support help error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 300);
        }
    }, [API_BASE, search, selectedPage]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch Comments (Pagination 10 items)
    // ─────────────────────────────────────────────────────────────────────────
    const fetchComments = useCallback(async (pg = commentPage) => {
        setCommentsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pg),
                limit: String(COMMENTS_PER_PAGE)
            });
            if (commentStatusFilter && commentStatusFilter !== 'All') {
                params.append('status', commentStatusFilter);
            }
            if (commentSearch.trim()) {
                params.append('search', commentSearch.trim());
            }

            const res = await fetch(`${API_BASE}/support-help/comments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.data || []);
                setCommentsTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch comments error:', err);
        } finally {
            setCommentsLoading(false);
        }
    }, [API_BASE, commentPage, commentStatusFilter, commentSearch]);

    useEffect(() => {
        if (activeTab === 'comments') {
            fetchComments(commentPage);
        }
    }, [activeTab, fetchComments, commentPage]);

    // ─────────────────────────────────────────────────────────────────────────
    // Guide Handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleOpenCreate = () => {
        setEditingItem(null);
        setFormData(initialForm);
        setPhotoUrlInput('');
        setModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        const isPreset = PRESET_PAGES.includes(item.page);
        setFormData({
            title: item.title || '',
            text: item.text || '',
            page: isPreset ? item.page : 'Custom',
            customPage: isPreset ? '' : item.page,
            photos: Array.isArray(item.photos) ? [...item.photos] : [],
            videoUrl: item.videoUrl || '',
            facebookUrl: item.facebookUrl || '',
            order: item.order || 0,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true
        });
        setPhotoUrlInput('');
        setModalOpen(true);
    };

    const handleAddPhotoUrl = () => {
        if (!photoUrlInput.trim()) return;
        setFormData((prev) => ({
            ...prev,
            photos: [...prev.photos, photoUrlInput.trim()]
        }));
        setPhotoUrlInput('');
        setShowPhotoInputModal(false);
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setFormData((prev) => ({
                        ...prev,
                        photos: [...prev.photos, event.target.result]
                    }));
                };
                reader.readAsDataURL(file);
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemovePhoto = (index) => {
        setFormData((prev) => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('សូមបញ្ចូលចំណងជើង (Title is required)');
            return;
        }

        const resolvedPage =
            formData.page === 'Custom'
                ? (formData.customPage.trim() || 'General')
                : formData.page;

        setSubmitting(true);
        try {
            const payload = {
                title: formData.title.trim(),
                text: formData.text.trim(),
                page: resolvedPage,
                photos: formData.photos,
                videoUrl: formData.videoUrl.trim(),
                facebookUrl: formData.facebookUrl.trim(),
                order: Number(formData.order) || 0,
                isActive: Boolean(formData.isActive),
                createdBy: user?.username || 'Administrator'
            };

            const url = editingItem
                ? `${API_BASE}/support-help/${editingItem._id}`
                : `${API_BASE}/support-help`;

            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': user?.username || 'Administrator'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setModalOpen(false);
                fetchItems();
            } else {
                const err = await res.json();
                alert(err.message || 'ប្រតិបត្តិការមិនបានជោគជ័យ');
            }
        } catch (err) {
            console.error('Save support help error:', err);
            alert('កំហុសប្រព័ន្ធក្នុងការរក្សាទុក');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModalItem) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE}/support-help/${deleteModalItem._id}`, {
                method: 'DELETE',
                headers: {
                    'x-username': user?.username || 'Administrator'
                }
            });
            if (res.ok) {
                setDeleteModalItem(null);
                fetchItems();
            } else {
                alert('មិនអាចលុបបានទេ');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('កំហុសប្រព័ន្ធក្នុងការលុប');
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleActive = async (item) => {
        try {
            const res = await fetch(`${API_BASE}/support-help/${item._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': user?.username || 'Administrator'
                },
                body: JSON.stringify({ isActive: !item.isActive })
            });
            if (res.ok) {
                setItems((prev) =>
                    prev.map((i) => (i._id === item._id ? { ...i, isActive: !i.isActive } : i))
                );
            }
        } catch (err) {
            console.error('Toggle status error:', err);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Comment Handlers (Master Admin Reply & Resolve)
    // ─────────────────────────────────────────────────────────────────────────
    const handleOpenReply = (comment) => {
        setReplyingComment(comment);
        setReplyText(comment.adminReply || '');
    };

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!replyingComment) return;

        setReplySubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/support-help/comments/${replyingComment._id}/reply`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': user?.username || 'Master Admin'
                },
                body: JSON.stringify({
                    adminReply: replyText.trim(),
                    status: 'Resolved'
                })
            });

            if (res.ok) {
                setReplyingComment(null);
                fetchComments(commentPage);
            } else {
                alert('មិនអាចឆ្លើយតបបានទេ');
            }
        } catch (err) {
            console.error('Submit reply error:', err);
            alert('កំហុសប្រព័ន្ធក្នុងការឆ្លើយតប');
        } finally {
            setReplySubmitting(false);
        }
    };

    const handleToggleCommentStatus = async (comment) => {
        const nextStatus = comment.status === 'Resolved' ? 'Pending' : 'Resolved';
        try {
            const res = await fetch(`${API_BASE}/support-help/comments/${comment._id}/reply`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': user?.username || 'Master Admin'
                },
                body: JSON.stringify({ status: nextStatus })
            });
            if (res.ok) {
                fetchComments(commentPage);
            }
        } catch (err) {
            console.error('Update status error:', err);
        }
    };

    const handleDeleteComment = async () => {
        if (!deleteCommentModal) return;
        try {
            const res = await fetch(`${API_BASE}/support-help/comments/${deleteCommentModal._id}`, {
                method: 'DELETE',
                headers: {
                    'x-username': user?.username || 'Master Admin'
                }
            });
            if (res.ok) {
                setDeleteCommentModal(null);
                fetchComments(commentPage);
            }
        } catch (err) {
            console.error('Delete comment error:', err);
        }
    };

    const availablePages = Array.from(
        new Set([...PRESET_PAGES, ...items.map((i) => i.page).filter(Boolean)])
    );

    const totalCommentPages = Math.ceil(commentsTotal / COMMENTS_PER_PAGE) || 1;

    return (
        <div className="min-h-full flex flex-col bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Header section with Tab Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-2xs">
                            <MdSupportAgent size={28} />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span>{t('controlSupportHelp') || 'Control Support & Help'}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                    Admin Dashboard
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                គ្រប់គ្រងអត្ថបទណែនាំ មេឌៀ និងពិនិត្យមតិយោបល់របស់បុគ្គលិកដែលផ្ញើមកកាន់ Admin ធំ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {activeTab === 'guides' ? (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-600/20 border border-emerald-500 transition-all cursor-pointer active:scale-95"
                            >
                                <FaPlus size={12} />
                                <span>{t('addSupportHelp') || '+ បន្ថែមការណែនាំថ្មី'}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fetchComments(commentPage)}
                                className="h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <FaSyncAlt size={12} className={commentsLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
                                <span>Refresh Comments</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 🌟 Tab Switcher (Guides vs Staff Comments) 🌟 */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                        type="button"
                        onClick={() => setActiveTab('guides')}
                        className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'guides'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <MdOutlineMenuBook size={15} />
                        <span>គ្រប់គ្រងអត្ថបទណែនាំ (Guides & Media)</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            activeTab === 'guides' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {items.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('comments')}
                        className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'comments'
                                ? 'bg-amber-500 text-slate-900 shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <FaCommentDots size={14} className={activeTab === 'comments' ? 'text-slate-900' : 'text-amber-600'} />
                        <span>មតិយោបល់ពីបុគ្គលិក (Staff Comments)</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            activeTab === 'comments' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                            {commentsTotal}
                        </span>
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                TAB 1: GUIDES & MEDIA MANAGEMENT
            ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'guides' && (
                <div className="space-y-5">
                    {/* Filter & Search Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[220px] relative">
                            <FaSearch size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="ស្វែងរកតាមចំណងជើង អត្ថបទ ឬ Page..."
                                className="w-full h-[38px] pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 select-none">Page:</span>
                            <select
                                value={selectedPage}
                                onChange={(e) => setSelectedPage(e.target.value)}
                                className="h-[38px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
                            >
                                <option value="All">ទំព័រទាំងអស់ (All Pages)</option>
                                {availablePages.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table of Guides */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400 text-xs">
                                <FaSyncAlt size={22} className="animate-spin text-emerald-600 mx-auto mb-2" />
                                <span>កំពុងទាញយកទិន្នន័យ...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                    <MdOutlineMenuBook size={28} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">មិនទាន់មានការណែនាំនៅឡើយទេ</p>
                                <button
                                    type="button"
                                    onClick={handleOpenCreate}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all cursor-pointer"
                                >
                                    <FaPlus size={11} />
                                    <span>បន្ថែមឥឡូវនេះ</span>
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                            <th className="py-3 px-4 w-12 text-center">ល.រ</th>
                                            <th className="py-3 px-4">រូបភាព</th>
                                            <th className="py-3 px-4">ចំណងជើង & អត្ថបទ</th>
                                            <th className="py-3 px-4">បង្ហាញនៅ Page</th>
                                            <th className="py-3 px-4 text-center">មេឌៀ (Media)</th>
                                            <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                                            <th className="py-3 px-4 text-right">សកម្មភាព</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((item, index) => (
                                            <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3 px-4 text-center font-mono text-slate-400">
                                                    {item.order !== undefined ? item.order : index + 1}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {item.photos && item.photos.length > 0 ? (
                                                        <div
                                                            onClick={() => handleOpenImageZoom(item.photos[0], item.title)}
                                                            className="relative w-12 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                                            title="ចុចដើម្បីពង្រីកបង្រួមរូបភាព"
                                                        >
                                                            <img
                                                                src={item.photos[0]}
                                                                alt="Thumbnail"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            {item.photos.length > 1 && (
                                                                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl font-mono">
                                                                    +{item.photos.length - 1}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                                                            <FaImage size={14} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs">
                                                    <p className="font-bold text-slate-800 line-clamp-1">{item.title}</p>
                                                    <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">
                                                        {item.text || 'គ្មានអត្ថបទពិពណ៌នា'}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        <FaLayerGroup size={10} className="text-emerald-600" />
                                                        {item.page || 'General'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {item.photos && item.photos.length > 0 && (
                                                            <span
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                                                                title={`${item.photos.length} រូបភាព`}
                                                            >
                                                                <FaImage size={10} />
                                                                {item.photos.length}
                                                            </span>
                                                        )}
                                                        {item.videoUrl && (
                                                            <a
                                                                href={item.videoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                                                title="Video Link"
                                                            >
                                                                <FaVideo size={10} />
                                                                <span>Video</span>
                                                            </a>
                                                        )}
                                                        {item.facebookUrl && (
                                                            <a
                                                                href={item.facebookUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                                                                title="Facebook Link"
                                                            >
                                                                <FaFacebook size={10} />
                                                                <span>FB</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleActive(item)}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                                                            item.isActive
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                        }`}
                                                    >
                                                        {item.isActive ? 'Active' : 'Inactive'}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(item)}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Edit"
                                                        >
                                                            <FaEdit size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteModalItem(item)}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Delete"
                                                        >
                                                            <FaTrashAlt size={11} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                TAB 2: STAFF COMMENTS TO MASTER ADMIN (បង្ហាញម្តង ១០ៗ)
            ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'comments' && (
                <div className="space-y-5">
                    {/* Filter and Search Bar for Comments */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[220px] relative">
                            <FaSearch size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={commentSearch}
                                onChange={(e) => {
                                    setCommentSearch(e.target.value);
                                    setCommentPage(1);
                                }}
                                placeholder="ស្វែងរកតាមឈ្មោះបុគ្គលិក ខ្លឹមសារ ឬ Page..."
                                className="w-full h-[38px] pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 select-none">ស្ថានភាព:</span>
                            <select
                                value={commentStatusFilter}
                                onChange={(e) => {
                                    setCommentStatusFilter(e.target.value);
                                    setCommentPage(1);
                                }}
                                className="h-[38px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:bg-white focus:border-amber-500 transition-all cursor-pointer"
                            >
                                <option value="All">ទាំងអស់ (All Status)</option>
                                <option value="Pending">⏳ រង់ចាំការដោះស្រាយ (Pending)</option>
                                <option value="Resolved">✓ បានដោះស្រាយ (Resolved)</option>
                            </select>
                        </div>
                    </div>

                    {/* Comments List (Displays 10 records per page) */}
                    <div className="space-y-3.5">
                        {commentsLoading ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-2xs">
                                <FaSyncAlt size={22} className="animate-spin text-amber-500 mx-auto mb-2" />
                                <span>កំពុងទាញយកមតិយោបល់...</span>
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                                    <FaCommentDots size={28} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">មិនទាន់មានមតិយោបល់ណាមួយឡើយ</p>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    រាល់ពេលបុគ្គលិកសរសេរមតិ ឬសំណូមពរចេញពី Help & Support វានឹងបង្ហាញនៅទីនេះម្តង ១០ៗ សម្រាប់ Master Admin ពិនិត្យ និងឆ្លើយតប។
                                </p>
                            </div>
                        ) : (
                            comments.map((c, cIdx) => (
                                <div
                                    key={c._id}
                                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5 hover:shadow-md transition-shadow"
                                >
                                    {/* Header */}
                                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                                                {c.senderName ? c.senderName.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 text-sm">
                                                        {c.senderName || c.senderUsername}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-slate-400">
                                                        (@{c.senderUsername})
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                        {c.senderRole || 'Staff'} {c.senderBrand ? `• ${c.senderBrand}` : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                                    <span>ប្រធានបទ: <strong className="text-slate-700">{c.subject}</strong></span>
                                                    <span>•</span>
                                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                                        <FaLayerGroup size={10} />
                                                        {c.pageContext || 'General'}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="font-mono text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status & Quick Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleCommentStatus(c)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                                    c.status === 'Resolved'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
                                                }`}
                                            >
                                                {c.status === 'Resolved' ? '✓ បានដោះស្រាយ' : '⏳ រង់ចាំដោះស្រាយ'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenReply(c)}
                                                className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                                title="Reply"
                                            >
                                                <FaReply size={11} className="rotate-180 text-emerald-600" />
                                                <span>{c.adminReply ? 'កែប្រែចម្លើយ' : 'ឆ្លើយតប'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setDeleteCommentModal(c)}
                                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                                                title="Delete"
                                            >
                                                <FaTrashAlt size={11} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message Body */}
                                    <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                                        {c.message}
                                    </div>

                                    {/* Photo preview */}
                                    {c.photoUrl && (
                                        <div
                                            onClick={() => handleOpenImageZoom(c.photoUrl, `Screenshot by ${c.senderName || c.senderUsername}`)}
                                            className="w-28 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center"
                                            title="ចុចដើម្បីពង្រីកបង្រួមរូបភាព"
                                        >
                                            <img src={c.photoUrl} alt="Screenshot" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {/* Admin Reply Display */}
                                    {c.adminReply && (
                                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1">
                                            <div className="flex items-center justify-between text-emerald-900 font-bold">
                                                <div className="flex items-center gap-1.5">
                                                    <FaReply size={11} className="rotate-180 text-emerald-600" />
                                                    <span>ចម្លើយពី Master Admin ({c.repliedBy || 'Admin'}):</span>
                                                </div>
                                                {c.repliedAt && (
                                                    <span className="text-[10px] text-emerald-700 font-normal font-mono">
                                                        {new Date(c.repliedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-emerald-950 font-medium pl-4 whitespace-pre-line leading-relaxed">
                                                {c.adminReply}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* 🌟 10-Item Pagination Controls 🌟 */}
                    {commentsTotal > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs select-none shadow-2xs">
                            <div className="text-slate-500 font-medium">
                                បង្ហាញ <span className="font-bold text-slate-800">{(commentPage - 1) * COMMENTS_PER_PAGE + 1}</span> ដល់{' '}
                                <span className="font-bold text-slate-800">
                                    {Math.min(commentPage * COMMENTS_PER_PAGE, commentsTotal)}
                                </span>{' '}
                                នៃចំនួនសរុប <span className="font-bold text-amber-700">{commentsTotal}</span> មតិយោបល់ (ម្តង ១០ៗ)
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                                    disabled={commentPage === 1}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                                >
                                    <FaChevronLeft size={10} />
                                    <span>មុន</span>
                                </button>

                                <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold font-mono">
                                    {commentPage} / {totalCommentPages}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setCommentPage((p) => Math.min(totalCommentPages, p + 1))}
                                    disabled={commentPage >= totalCommentPages}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                                >
                                    <span>បន្ទាប់</span>
                                    <FaChevronRight size={10} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                MODALS
            ───────────────────────────────────────────────────────────────── */}

            {/* Guide Create / Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                                    <MdSupportAgent size={20} />
                                </div>
                                <h3 className="text-base font-bold text-slate-800">
                                    {editingItem ? 'កែសម្រួលការណែនាំ (Edit Guide)' : 'បន្ថែមការណែនាំថ្មី (Add Guide)'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <FaTimes size={14} />
                            </button>
                        </div>

                        <form id="support-help-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">
                                    ចំណងជើង (Title) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="ឧ. របៀបចាក់សោរទូរស័ព្ទ ឬ របៀបបង់ប្រាក់រំលស់..."
                                    className="w-full h-[38px] px-3.5 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">
                                    បង្ហាញនៅ Page ណា? (Target Page) <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select
                                        value={formData.page}
                                        onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                                        className="h-[38px] px-3 rounded-xl border border-slate-200 text-slate-800 font-medium focus:border-emerald-500 outline-none cursor-pointer"
                                    >
                                        {PRESET_PAGES.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                        <option value="Custom">+ បញ្ចូលឈ្មោះ Page ថ្មី (Custom Page)...</option>
                                    </select>

                                    {formData.page === 'Custom' && (
                                        <input
                                            type="text"
                                            required
                                            value={formData.customPage}
                                            onChange={(e) => setFormData({ ...formData, customPage: e.target.value })}
                                            placeholder="វាយបញ្ចូលឈ្មោះ Page..."
                                            className="h-[38px] px-3.5 rounded-xl border border-emerald-300 bg-emerald-50/30 text-slate-800 focus:border-emerald-500 outline-none"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">
                                    អត្ថបទណែនាំ / ពិពណ៌នា (Content Text)
                                </label>
                                <textarea
                                    rows={5}
                                    value={formData.text}
                                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                    placeholder="សរសេរការណែនាំលម្អិត ជំហានអនុវត្ត ឬព័ត៌មានជំនួយ..."
                                    className="w-full p-3 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none transition-all resize-y"
                                />
                            </div>

                            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                                <div className="flex items-center justify-between">
                                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                                        <FaImage className="text-emerald-600" />
                                        <span>រូបភាព (Photos)</span>
                                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                                            ({formData.photos.length})
                                        </span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            <MdOutlineAddPhotoAlternate size={13} />
                                            <span>Upload រូបភាព</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowPhotoInputModal(true)}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                                        >
                                            <FaLink size={10} />
                                            <span>Link URL</span>
                                        </button>
                                    </div>
                                </div>

                                {formData.photos.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                                        {formData.photos.map((photo, pIdx) => (
                                            <div key={pIdx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-video flex items-center justify-center">
                                                <img src={photo} alt={`Photo ${pIdx}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(pIdx)}
                                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                                                    title="Remove Photo"
                                                >
                                                    <FaTrashAlt size={9} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400 italic">មិនទាន់មានរូបភាពត្រូវបានបន្ថែមទេ</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                                        <FaVideo className="text-rose-600" />
                                        <span>Link Video (YouTube / MP4)</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.videoUrl}
                                        onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="w-full h-[38px] px-3.5 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                                        <FaFacebook className="text-indigo-600" />
                                        <span>Link Facebook (Page / Post / Video)</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.facebookUrl}
                                        onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                                        placeholder="https://facebook.com/..."
                                        className="w-full h-[38px] px-3.5 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">លំដាប់បង្ហាញ (Order):</label>
                                    <input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                                        className="w-full h-[38px] px-3.5 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none"
                                    />
                                </div>

                                <div className="flex items-end pb-1.5">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                                        />
                                        <span>បង្ហាញជាសាធារណៈ (Active)</span>
                                    </label>
                                </div>
                            </div>
                        </form>

                        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                type="submit"
                                form="support-help-form"
                                disabled={submitting}
                                className="h-[38px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 border border-emerald-500 flex items-center gap-2 cursor-pointer"
                            >
                                {submitting && <FaSyncAlt size={11} className="animate-spin" />}
                                <span>{editingItem ? 'រក្សាទុកការកែប្រែ' : 'បង្កើតថ្មី'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Master Admin Reply Modal for Comment */}
            {replyingComment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <FaReply size={14} className="rotate-180" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    ឆ្លើយតបទៅកាន់បុគ្គលិក ({replyingComment.senderName || replyingComment.senderUsername})
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReplyingComment(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                            >
                                <FaTimes size={14} />
                            </button>
                        </div>

                        {/* Summary of user comment */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <p className="font-bold text-slate-800">{replyingComment.subject}</p>
                            <p className="text-slate-600 line-clamp-3">{replyingComment.message}</p>
                        </div>

                        {/* Reply Form */}
                        <form onSubmit={handleSubmitReply} className="space-y-3 text-xs">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-700">ខ្លឹមសារឆ្លើយតបពី Master Admin:</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="សរសេរការឆ្លើយតប ឬដំណោះស្រាយ..."
                                    className="w-full p-3 rounded-xl border border-slate-200 text-slate-800 focus:border-emerald-500 outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReplyingComment(null)}
                                    className="h-[36px] px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                                >
                                    បោះបង់
                                </button>
                                <button
                                    type="submit"
                                    disabled={replySubmitting || !replyText.trim()}
                                    className="h-[36px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                                >
                                    {replySubmitting && <FaSyncAlt size={11} className="animate-spin" />}
                                    <span>ផ្ញើការឆ្លើយតប</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Photo URL Input Modal */}
            {showPhotoInputModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100000] p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-3">
                        <h4 className="text-sm font-bold text-slate-800">បញ្ចូលតំណភ្ជាប់រូបភាព (Image URL)</h4>
                        <input
                            type="url"
                            value={photoUrlInput}
                            onChange={(e) => setPhotoUrlInput(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="w-full h-[38px] px-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowPhotoInputModal(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                បោះបង់
                            </button>
                            <button
                                type="button"
                                onClick={handleAddPhotoUrl}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                            >
                                បន្ថែម
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Guide Modal */}
            {deleteModalItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100000] p-4">
                    <div className="bg-white rounded-2xl border border-rose-200 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                            <FaTrashAlt size={20} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-800">តើអ្នកពិតជាចង់លុបមែនទេ?</h3>
                            <p className="text-xs text-slate-500 line-clamp-2">
                                "{deleteModalItem.title}"
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalItem(null)}
                                className="h-[36px] px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="h-[36px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                            >
                                {deleting ? 'កំពុងលុប...' : 'លុបចោល'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Comment Modal */}
            {deleteCommentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100000] p-4">
                    <div className="bg-white rounded-2xl border border-rose-200 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                            <FaTrashAlt size={20} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-800">តើអ្នកពិតជាចង់លុបមតិយោបល់នេះមែនទេ?</h3>
                            <p className="text-xs text-slate-500 line-clamp-2">
                                "{deleteCommentModal.message}"
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteCommentModal(null)}
                                className="h-[36px] px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteComment}
                                className="h-[36px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                            >
                                លុបចេញ
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default ControlSupportHelp;
