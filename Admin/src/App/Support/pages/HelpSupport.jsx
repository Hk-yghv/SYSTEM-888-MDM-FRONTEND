import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaSearch,
    FaQuestionCircle,
    FaImage,
    FaVideo,
    FaFacebook,
    FaExternalLinkAlt,
    FaLayerGroup,
    FaBookOpen,
    FaTimes,
    FaChevronRight,
    FaExpand,
    FaRegLightbulb,
    FaShareAlt,
    FaCheck,
    FaPlay,
    FaHeadset,
    FaCommentDots,
    FaPaperPlane,
    FaUserCircle,
    FaReply,
    FaCheckCircle,
    FaClock,
    FaUpload
} from 'react-icons/fa';
import {
    MdDashboard,
    MdOutlineContactPhone,
    MdOutlinePhoneIphone,
    MdOutlineWallpaper,
    MdOutlineBarChart,
    MdCalculate,
    MdOutlinePhotoLibrary,
    MdPrint,
    MdHelpCenter,
    MdOutlineFeedback
} from 'react-icons/md';
import { IoIosContact, IoIosSettings, IoMdWallet } from 'react-icons/io';

// Helper to get matching icon for page names
const getPageIcon = (pageName) => {
    const p = (pageName || '').toLowerCase();
    if (p.includes('dash')) return <MdDashboard className="text-emerald-600" size={16} />;
    if (p.includes('customer')) return <IoIosContact className="text-blue-600" size={16} />;
    if (p.includes('contract')) return <MdOutlineContactPhone className="text-indigo-600" size={16} />;
    if (p.includes('installment')) return <IoMdWallet className="text-amber-600" size={16} />;
    if (p.includes('device')) return <MdOutlinePhoneIphone className="text-purple-600" size={16} />;
    if (p.includes('lost')) return <MdOutlinePhoneIphone className="text-rose-600" size={16} />;
    if (p.includes('wallpaper')) return <MdOutlineWallpaper className="text-pink-600" size={16} />;
    if (p.includes('report')) return <MdOutlineBarChart className="text-teal-600" size={16} />;
    if (p.includes('salary')) return <MdCalculate className="text-emerald-600" size={16} />;
    if (p.includes('print')) return <MdPrint className="text-cyan-600" size={16} />;
    if (p.includes('setting')) return <IoIosSettings className="text-slate-600" size={16} />;
    return <FaBookOpen className="text-emerald-600" size={15} />;
};

// Helper to convert YouTube URL to embed URL
const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
    } catch {
        return null;
    }
    return null;
};

const HelpSupport = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activePage, setActivePage] = useState('All');

    // Lightbox modal for enlarged image
    const [lightboxImage, setLightboxImage] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // ─────────────────────────────────────────────────────────────────────────
    // Comment / Feedback to Admin ធំ State
    // ─────────────────────────────────────────────────────────────────────────
    const [commentSubject, setCommentSubject] = useState('សំណើកែលម្អ');
    const [commentPageContext, setCommentPageContext] = useState('ទូទៅ (General)');
    const [commentMessage, setCommentMessage] = useState('');
    const [commentPhoto, setCommentPhoto] = useState('');
    const [commentSending, setCommentSending] = useState(false);
    const [commentSuccess, setCommentSuccess] = useState(false);
    const [userComments, setUserComments] = useState([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const commentFileRef = useRef(null);

    // Fetch active support & help guides
    const fetchGuides = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/support-help?activeOnly=true`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.data || []);
            }
        } catch (err) {
            console.error('Fetch support guides error:', err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        fetchGuides();
    }, [fetchGuides]);

    // Fetch user comments
    const fetchUserComments = useCallback(async () => {
        setLoadingComments(true);
        try {
            const username = user?.username || 'Anonymous';
            const res = await fetch(`${API_BASE}/support-help/comments?username=${encodeURIComponent(username)}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setUserComments(data.data || []);
            }
        } catch (err) {
            console.error('Fetch user comments error:', err);
        } finally {
            setLoadingComments(false);
        }
    }, [API_BASE, user]);

    useEffect(() => {
        if (activePage === '__COMMENTS__') {
            fetchUserComments();
        }
    }, [activePage, fetchUserComments]);

    // Aggregate unique pages and their statistics (for the right panel mini cards)
    const pageStats = useMemo(() => {
        const statsMap = new Map();

        items.forEach((item) => {
            const p = item.page || 'General';
            if (!statsMap.has(p)) {
                statsMap.set(p, {
                    name: p,
                    total: 0,
                    hasPhotos: false,
                    hasVideos: false,
                    hasFacebook: false
                });
            }
            const current = statsMap.get(p);
            current.total += 1;
            if (item.photos && item.photos.length > 0) current.hasPhotos = true;
            if (item.videoUrl) current.hasVideos = true;
            if (item.facebookUrl) current.hasFacebook = true;
        });

        return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    }, [items]);

    // Filter items based on active selected page and search keyword
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (activePage !== 'All' && item.page !== activePage) {
                return false;
            }
            if (search.trim()) {
                const s = search.trim().toLowerCase();
                const matchTitle = item.title && item.title.toLowerCase().includes(s);
                const matchText = item.text && item.text.toLowerCase().includes(s);
                const matchPage = item.page && item.page.toLowerCase().includes(s);
                if (!matchTitle && !matchText && !matchPage) return false;
            }
            return true;
        });
    }, [items, activePage, search]);

    const handleCopyShare = (item) => {
        navigator.clipboard?.writeText(window.location.href);
        setCopiedId(item._id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Handle Comment Image Upload
    const handleCommentFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCommentPhoto(event.target.result);
            };
            reader.readAsDataURL(file);
        }
        if (commentFileRef.current) commentFileRef.current.value = '';
    };

    // Handle Submit Comment to Admin ធំ
    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!commentMessage.trim()) {
            alert('សូមសរសេរមតិយោបល់របស់អ្នកជាមុនសិន');
            return;
        }

        setCommentSending(true);
        try {
            const payload = {
                senderUsername: user?.username || 'Anonymous',
                senderName: user?.name || user?.username || 'Staff',
                senderRole: user?.role || 'Staff',
                senderBrand: user?.brand || '',
                subject: commentSubject,
                pageContext: commentPageContext,
                message: commentMessage.trim(),
                photoUrl: commentPhoto
            };

            const res = await fetch(`${API_BASE}/support-help/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': user?.username || 'Anonymous'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setCommentMessage('');
                setCommentPhoto('');
                setCommentSuccess(true);
                fetchUserComments();
                setTimeout(() => setCommentSuccess(false), 3500);
            } else {
                alert('មិនអាចផ្ញើមតិយោបល់បានទេ');
            }
        } catch (err) {
            console.error('Send comment error:', err);
            alert('កំហុសប្រព័ន្ធក្នុងការផ្ញើមតិយោបល់');
        } finally {
            setCommentSending(false);
        }
    };

    return (
        <div className="min-h-full flex flex-col bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Hero Top Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-lg shadow-emerald-700/15">
                <div className="relative z-10 max-w-2xl space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-emerald-100 border border-white/20">
                        <MdHelpCenter size={16} />
                        <span>{t('supportCenter') || 'មជ្ឈមណ្ឌលជំនួយ និងការគាំទ្រ (Help & Support Center)'}</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                        តើអ្នកត្រូវការជំនួយអ្វីខ្លះថ្ងៃនេះ?
                    </h1>
                    <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                        ស្វែងយល់ពីរបៀបប្រើប្រាស់ប្រព័ន្ធ វីដេអូបង្រៀន រូបភាពណែនាំ និងផ្ញើមតិយោបល់ដោយផ្ទាល់ទៅកាន់ Admin ធំ។
                    </p>

                    {/* Quick search input */}
                    <div className="pt-2 flex flex-wrap items-center gap-2.5">
                        <div className="relative flex-1 min-w-[220px] max-w-md">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    if (activePage === '__COMMENTS__') setActivePage('All');
                                }}
                                placeholder="ស្វែងរកអត្ថបទណែនាំ វីដេអូ ឬប្រធានបទ..."
                                className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white text-slate-800 placeholder-slate-400 text-xs shadow-md outline-none focus:ring-2 focus:ring-emerald-300 transition-all font-medium"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <FaTimes size={12} />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setActivePage('__COMMENTS__')}
                            className="h-11 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            <FaCommentDots size={14} />
                            <span>សរសេរ Comment ទៅ Admin ធំ</span>
                        </button>
                    </div>
                </div>

                {/* Background decorative shapes */}
                <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute right-20 top-4 w-32 h-32 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />
            </div>

            {/* Main Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── LEFT / MAIN CONTENT AREA (8 Cols on Desktop) ── */}
                <div className="lg:col-span-8 space-y-5">
                    {/* Active Filter Bar */}
                    <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">បង្ហាញ:</span>
                            <span className={`px-2.5 py-0.5 rounded-full font-bold border ${
                                activePage === '__COMMENTS__'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                                {activePage === '__COMMENTS__'
                                    ? '💬 សរសេរមតិយោបល់ទៅកាន់ Admin ធំ'
                                    : activePage === 'All'
                                    ? 'គ្រប់ទំព័រទាំងអស់ (All Pages)'
                                    : activePage}
                            </span>
                            {activePage !== '__COMMENTS__' && (
                                <span className="text-slate-400 font-mono">
                                    ({filteredItems.length} ប្រធានបទ)
                                </span>
                            )}
                        </div>
                        {activePage !== 'All' && (
                            <button
                                type="button"
                                onClick={() => setActivePage('All')}
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                            >
                                បង្ហាញអត្ថបទទាំងអស់
                            </button>
                        )}
                    </div>

                    {/* ════════════════════════════════════════════════════════════════
                        SPECIAL AUTO PAGE: COMMENT & FEEDBACK TO MASTER ADMIN
                    ════════════════════════════════════════════════════════════════ */}
                    {activePage === '__COMMENTS__' ? (
                        <div className="space-y-6">
                            {/* Comment Form Card */}
                            <div className="bg-white rounded-3xl border border-amber-200/80 p-5 sm:p-7 shadow-md space-y-5">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
                                        <FaCommentDots size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-base sm:text-lg font-bold text-slate-800">
                                            សរសេរមតិយោបល់ ឬ សំណូមពរទៅកាន់ Admin ធំ
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            រាល់មតិយោបល់ និងសំណើររបស់អ្នកនឹងត្រូវបញ្ជូនដោយផ្ទាល់ទៅកាន់ Master Admin
                                        </p>
                                    </div>
                                </div>

                                {/* Sender Identity Badge */}
                                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                    <div className="flex items-center gap-2.5">
                                        <FaUserCircle size={20} className="text-slate-400" />
                                        <div>
                                            <span className="font-bold text-slate-800">{user?.name || user?.username || 'Staff'}</span>
                                            <span className="text-slate-500 font-mono text-[11px] ml-1.5">(@{user?.username || 'anonymous'})</span>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                                        {user?.role || 'Staff'} {user?.brand ? `• ${user.brand}` : ''}
                                    </span>
                                </div>

                                {commentSuccess && (
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                                        <FaCheckCircle className="text-emerald-600" size={14} />
                                        <span>បានផ្ញើមតិយោបល់ទៅកាន់ Admin ធំដោយជោគជ័យ! សូមរង់ចាំការពិនិត្យ។</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmitComment} className="space-y-4 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Subject / Category */}
                                        <div className="space-y-1">
                                            <label className="font-bold text-slate-700">ប្រភេទមតិយោបល់ / ប្រធានបទ:</label>
                                            <select
                                                value={commentSubject}
                                                onChange={(e) => setCommentSubject(e.target.value)}
                                                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-800 font-medium focus:border-amber-500 outline-none"
                                            >
                                                <option value="សំណើកែលម្អ">💡 សំណើកែលម្អប្រព័ន្ធ (Feature Suggestion)</option>
                                                <option value="រាយការណ៍បញ្ហា">⚠️ រាយការណ៍បញ្ហា/កំហុស (Report Bug / Issue)</option>
                                                <option value="ចម្ងល់ / សំណួរ">❓ សំណួរ / ត្រូវការជំនួយ (Questions / Help)</option>
                                                <option value="ស្នើសុំមុខងារបន្ថែម">✨ ស្នើសុំមុខងារបន្ថែម (New Request)</option>
                                                <option value="មតិយោបល់ទូទៅ">📝 មតិយោបល់ទូទៅ (General Feedback)</option>
                                            </select>
                                        </div>

                                        {/* Target Page Context */}
                                        <div className="space-y-1">
                                            <label className="font-bold text-slate-700">ទាក់ទងនឹង Page ណា?:</label>
                                            <select
                                                value={commentPageContext}
                                                onChange={(e) => setCommentPageContext(e.target.value)}
                                                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-800 font-medium focus:border-amber-500 outline-none"
                                            >
                                                <option value="ទូទៅ (General)">ទូទៅ (General)</option>
                                                <option value="Dashboard">Dashboard (ទំព័រដើម)</option>
                                                <option value="Customer">Customer (អតិថិជន)</option>
                                                <option value="Contract">Contract (កិច្ចសន្យា)</option>
                                                <option value="Installment">Installment (ការបង់រំលស់)</option>
                                                <option value="Lost Phone">Lost Phone (ចាក់សោទូរស័ព្ទ)</option>
                                                <option value="Wallpaper">Wallpaper (រូបភាព)</option>
                                                <option value="Report">Report (របាយការណ៍)</option>
                                                <option value="Salary">Salary (ប្រាក់ខែ)</option>
                                                <option value="Print ID Card">Print ID Card (ព្រីនកាត)</option>
                                                <option value="Settings">Settings (ការកំណត់)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Message Textarea */}
                                    <div className="space-y-1">
                                        <label className="font-bold text-slate-700">
                                            ខ្លឹមសារមតិយោបល់ (Comment Details) <span className="text-rose-500">*</span>:
                                        </label>
                                        <textarea
                                            required
                                            rows={4}
                                            value={commentMessage}
                                            onChange={(e) => setCommentMessage(e.target.value)}
                                            placeholder="សរសេរមតិយោបល់ បញ្ជាក់បញ្ហា ឬសំណើរបស់អ្នកយ៉ាងលម្អិត..."
                                            className="w-full p-3.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500 outline-none transition-all resize-y"
                                        />
                                    </div>

                                    {/* Photo attachment */}
                                    <div className="space-y-2">
                                        <input
                                            ref={commentFileRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCommentFileUpload}
                                            className="hidden"
                                        />
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => commentFileRef.current?.click()}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <FaImage className="text-amber-600" />
                                                <span>{commentPhoto ? 'ប្តូររូបភាព Screenshot' : '+ ភ្ជាប់រូបភាព Screenshot (Optional)'}</span>
                                            </button>
                                            {commentPhoto && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCommentPhoto('')}
                                                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                                                >
                                                    លុបរូបចេញ
                                                </button>
                                            )}
                                        </div>

                                        {commentPhoto && (
                                            <div className="w-32 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-xs">
                                                <img src={commentPhoto} alt="Screenshot" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={commentSending || !commentMessage.trim()}
                                            className={`h-10 px-6 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 ${
                                                commentMessage.trim() && !commentSending
                                                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-amber-500/25'
                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                            }`}
                                        >
                                            {commentSending ? (
                                                <span>កំពុងផ្ញើ...</span>
                                            ) : (
                                                <>
                                                    <FaPaperPlane size={12} />
                                                    <span>ផ្ញើមតិទៅកាន់ Admin ធំ</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Sent Comments History */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <FaClock className="text-slate-400" />
                                    <span>ប្រវត្តិមតិយោបល់ដែលអ្នកបានផ្ញើ ({userComments.length})</span>
                                </h3>

                                {loadingComments ? (
                                    <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                                        <span>កំពុងទាញយកប្រវត្តិមតិយោបល់...</span>
                                    </div>
                                ) : userComments.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                                        <span>អ្នកមិនទាន់បានផ្ញើមតិយោបល់ណាមួយនៅឡើយទេ។</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {userComments.map((comment) => (
                                            <div
                                                key={comment._id}
                                                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                                                {comment.subject}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                                Page: {comment.pageContext}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                            {new Date(comment.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                        comment.status === 'Resolved'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {comment.status === 'Resolved' ? '✓ បានដោះស្រាយ' : '⏳ រង់ចាំការពិនិត្យ'}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    {comment.message}
                                                </p>

                                                {comment.photoUrl && (
                                                    <div
                                                        onClick={() => setLightboxImage(comment.photoUrl)}
                                                        className="w-24 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center"
                                                    >
                                                        <img src={comment.photoUrl} alt="Attachment" className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                {/* Admin Reply Card */}
                                                {comment.adminReply && (
                                                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1 text-xs">
                                                        <div className="flex items-center gap-2 text-emerald-800 font-bold">
                                                            <FaReply size={11} className="rotate-180" />
                                                            <span>ការឆ្លើយតបពី Master Admin ({comment.repliedBy || 'Admin'}):</span>
                                                            {comment.repliedAt && (
                                                                <span className="text-[10px] text-emerald-600 font-normal font-mono">
                                                                    {new Date(comment.repliedAt).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-emerald-950 font-medium pl-4 whitespace-pre-line">
                                                            {comment.adminReply}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Standard Guides List for Selected Page */
                        loading ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-2xs">
                                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <span>កំពុងទាញយកមាតិកាជំនួយ...</span>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                                    <FaQuestionCircle size={28} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-700">រកមិនឃើញអត្ថបទណែនាំទេ</h3>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    មិនមានមាតិកាជំនួយដែលត្រូវគ្នានឹងការស្វែងរករបស់អ្នកឡើយ។ សូមសាកល្បងពាក្យគន្លឹះផ្សេង ឬជ្រើសរើសទំព័រផ្សេង។
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {filteredItems.map((item) => {
                                    const youtubeEmbed = getYouTubeEmbedUrl(item.videoUrl);

                                    return (
                                        <div
                                            key={item._id}
                                            className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4 hover:shadow-md transition-shadow duration-200"
                                        >
                                            {/* Card Header */}
                                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            {getPageIcon(item.page)}
                                                            <span>{item.page || 'General'}</span>
                                                        </span>
                                                    </div>
                                                    <h2 className="text-base sm:text-lg font-bold text-slate-800 pt-1">
                                                        {item.title}
                                                    </h2>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyShare(item)}
                                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                                                        title="Share link"
                                                    >
                                                        {copiedId === item._id ? <FaCheck size={11} className="text-emerald-600" /> : <FaShareAlt size={11} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Content Text (Formatted with line breaks) */}
                                            {item.text && (
                                                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                                    {item.text}
                                                </div>
                                            )}

                                            {/* Photo Gallery (Grid of photos) */}
                                            {item.photos && item.photos.length > 0 && (
                                                <div className="space-y-2 pt-1">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                        <FaImage className="text-emerald-600" />
                                                        <span>រូបភាពណែនាំ ({item.photos.length}):</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                                        {item.photos.map((photo, pIdx) => (
                                                            <div
                                                                key={pIdx}
                                                                onClick={() => setLightboxImage(photo)}
                                                                className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video cursor-pointer hover:shadow-md transition-all flex items-center justify-center"
                                                            >
                                                                <img
                                                                    src={photo}
                                                                    alt={`Guide photo ${pIdx + 1}`}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                    <FaExpand size={16} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video Section (YouTube Embed or Link Card) */}
                                            {item.videoUrl && (
                                                <div className="space-y-2 pt-1">
                                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                        <div className="flex items-center gap-1.5">
                                                            <FaVideo className="text-rose-600" />
                                                            <span>វីដេអូណែនាំ (Video Tutorial):</span>
                                                        </div>
                                                        <a
                                                            href={item.videoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                                                        >
                                                            <span>បើកមើលលើ Web</span>
                                                            <FaExternalLinkAlt size={9} />
                                                        </a>
                                                    </div>

                                                    {youtubeEmbed ? (
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video shadow-xs">
                                                            <iframe
                                                                src={youtubeEmbed}
                                                                title={item.title}
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                allowFullScreen
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={item.videoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition-colors group"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                                                                <FaPlay size={14} className="ml-0.5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold text-rose-900 truncate">
                                                                    ចុចទីនេះដើម្បីទស្សនាវីដេអូ
                                                            </p>
                                                            <p className="text-[11px] text-rose-700/80 truncate font-mono">
                                                                {item.videoUrl}
                                                            </p>
                                                        </div>
                                                        <FaExternalLinkAlt size={12} className="text-rose-500 mr-2" />
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {/* Facebook Link Section */}
                                        {item.facebookUrl && (
                                            <div className="pt-1">
                                                <a
                                                    href={item.facebookUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                                                            <FaFacebook size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-indigo-950">
                                                                តំណភ្ជាប់ Facebook ជំនួយ
                                                            </p>
                                                            <p className="text-[11px] text-indigo-700 truncate font-mono mt-0.5">
                                                                {item.facebookUrl}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#1877F2] group-hover:underline flex-shrink-0 ml-2">
                                                        <span>ចូលមើល</span>
                                                        <FaExternalLinkAlt size={11} />
                                                    </span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* ── RIGHT PANEL: MINI PAGES CARDS (4 Cols on Desktop) ── */}
                <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <FaLayerGroup className="text-emerald-600" size={13} />
                                <span>ទំព័រដែលមានការណែនាំ (Pages)</span>
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                                {pageStats.length} ទំព័រ
                            </span>
                        </div>

                        {/* All Pages Mini Card */}
                        <div
                            onClick={() => setActivePage('All')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                activePage === 'All'
                                    ? 'bg-emerald-50 border-emerald-400 shadow-xs'
                                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    activePage === 'All' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                                }`}>
                                    <FaBookOpen size={13} />
                                </div>
                                <div>
                                    <p className={`text-xs font-bold ${activePage === 'All' ? 'text-emerald-900' : 'text-slate-800'}`}>
                                        ទំព័រទាំងអស់ (All Pages)
                                    </p>
                                    <p className="text-[10px] text-slate-400">បង្ហាញមាតិកាទាំងអស់</p>
                                </div>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                activePage === 'All' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {items.length}
                            </span>
                        </div>

                        {/* 🌟 SPECIAL AUTOMATIC MINI PAGE CARD: WRITE COMMENT TO ADMIN ធំ 🌟 */}
                        <div
                            onClick={() => setActivePage('__COMMENTS__')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                activePage === '__COMMENTS__'
                                    ? 'bg-amber-50 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                                    : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    activePage === '__COMMENTS__' ? 'bg-amber-500 text-slate-900 shadow-xs' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    <FaCommentDots size={14} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5 truncate">
                                        <span>សរសេរ Comment ទៅ Admin ធំ</span>
                                    </p>
                                    <p className="text-[10px] text-amber-700 truncate">
                                        មតិយោបល់ & សំណូមពរ
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 flex-shrink-0">
                                💬 ផ្ញើមតិ
                            </span>
                        </div>

                        {/* Mini Cards for each Page configured from Control Support & Help */}
                        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5 custom-scrollbar">
                            {pageStats.map((pageObj) => {
                                const isSelected = activePage === pageObj.name;

                                return (
                                    <div
                                        key={pageObj.name}
                                        onClick={() => setActivePage(pageObj.name)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                                            isSelected
                                                ? 'bg-emerald-50 border-emerald-400 shadow-xs'
                                                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                {getPageIcon(pageObj.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-xs font-bold truncate ${
                                                    isSelected ? 'text-emerald-900' : 'text-slate-800'
                                                }`}>
                                                    {pageObj.name}
                                                </p>
                                                {/* Mini media badges */}
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400">
                                                    {pageObj.hasPhotos && (
                                                        <span title="មានរូបភាព" className="text-blue-500 font-bold flex items-center gap-0.5">
                                                            <FaImage size={9} /> រូប
                                                        </span>
                                                    )}
                                                    {pageObj.hasVideos && (
                                                        <span title="មានវីដេអូ" className="text-rose-500 font-bold flex items-center gap-0.5">
                                                            <FaVideo size={9} /> វីដេអូ
                                                        </span>
                                                    )}
                                                    {pageObj.hasFacebook && (
                                                        <span title="មាន Facebook" className="text-indigo-500 font-bold flex items-center gap-0.5">
                                                            <FaFacebook size={9} /> FB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                                isSelected ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {pageObj.total}
                                            </span>
                                            <FaChevronRight size={10} className={isSelected ? 'text-emerald-600' : 'text-slate-300'} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Support Contact Box */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white space-y-2 shadow-md">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                            <FaHeadset size={14} />
                            <span>ត្រូវការជំនួយបន្ទាន់?</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                            ប្រសិនបើអ្នកមានចម្ងល់បន្ថែម ឬប្រព័ន្ធមានបញ្ហា សូមទាក់ទងមកកាន់អ្នកគ្រប់គ្រងប្រព័ន្ធ (System Administrator)។
                        </p>
                    </div>
                </div>
            </div>

            {/* Photo Fullscreen Lightbox Modal */}
            {lightboxImage && (
                <div
                    onClick={() => setLightboxImage(null)}
                    className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
                >
                    <button
                        type="button"
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <FaTimes size={18} />
                    </button>
                    <img
                        src={lightboxImage}
                        alt="Enlarged"
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default HelpSupport;
