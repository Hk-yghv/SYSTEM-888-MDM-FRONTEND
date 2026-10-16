import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FaArrowsAltH,
    FaArrowsAltV,
    FaCalendarAlt,
    FaCheck,
    FaCompress,
    FaCropAlt,
    FaDownload,
    FaExpand,
    FaExternalLinkAlt,
    FaInfoCircle,
    FaMapMarkerAlt,
    FaRedo,
    FaRegCopy,
    FaSave,
    FaSearch,
    FaSearchMinus,
    FaSearchPlus,
    FaSyncAlt,
    FaTimes,
    FaTrashAlt,
    FaUndo,
    FaUser
} from 'react-icons/fa';
import { MdOutlinePhotoLibrary } from 'react-icons/md';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_LABELS = {
    All: { label: 'ទាំងអស់ (All)', color: 'bg-slate-700 text-white' },
    Cloudinary: { label: '☁️ Cloudinary', color: 'bg-sky-600 text-white' },
    Contract: { label: 'កិច្ចសន្យា', color: 'bg-blue-600 text-white' },
    CashTransaction: { label: 'Cash In/Out/Penalty', color: 'bg-amber-600 text-white' },
    Salary: { label: 'ប្រាក់ខែ', color: 'bg-emerald-600 text-white' },
    FollowUp: { label: 'Follow Up', color: 'bg-purple-600 text-white' },
    SupportHelp: { label: 'Help & Support', color: 'bg-cyan-600 text-white' },
    SupportComment: { label: 'Comment', color: 'bg-rose-600 text-white' },
};

const CATEGORY_PAGE_MAP = {
    Contract: '/contract/activated',
    CashTransaction: '/installment',
    Salary: '/salary',
    FollowUp: '/follow-up',
    SupportHelp: '/help-support',
    SupportComment: '/help-support',
};

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? String(date) : d.toLocaleString();
};

const AllPicture = () => {
    const { smartFetch, hasPermission } = useAuth();
    const canDelete = hasPermission('/all-picture', 'delete');
    const scrollContainerRef = useRef(null);
    const previewContainerRef = useRef(null);

    const [images, setImages] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [category, setCategory] = useState('All');
    const [search, setSearch] = useState('');

    const [activeImage, setActiveImage] = useState(null);

    // Zoom & view
    const [zoom, setZoom] = useState(1);

    // Edit states
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
    const [cropAspect, setCropAspect] = useState('free');
    const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });

    const [loading, setLoading] = useState(true);
    const [savingNewVersion, setSavingNewVersion] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const fetchImages = useCallback(async (pg = 1, cat = category) => {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const params = new URLSearchParams({ page: String(pg), limit: '48', category: cat });
            const res = await smartFetch(`/media/all-images?${params.toString()}`, { bypassCache: true });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
            setImages(data.images || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
            setCurrentPage(pg);
        } catch (err) {
            setError(err.message || 'Unable to load images from database.');
        } finally {
            setLoading(false);
        }
    }, [smartFetch, category]);

    useEffect(() => {
        fetchImages(1, category);
    }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

    const visibleImages = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return images;
        return images.filter(img =>
            [img.entityName, img.field, img.usedBy, img.category, img.entityId]
                .filter(Boolean)
                .some(v => String(v).toLowerCase().includes(q))
        );
    }, [images, search]);

    // Delete a Cloudinary image by public_id
    const deleteCloudinaryImage = async (img) => {
        if (!img.publicId) return;
        const confirmed = window.confirm(`លុបរូបភាព Cloudinary "${img.entityName}"? មិនអាចសង្គ្រោះបាន!`);
        if (!confirmed) return;
        try {
            const res = await smartFetch('/media/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_ids: [img.publicId] })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setImages(prev => prev.filter(i => i !== img));
                setActiveImage(null);
                setMessage('បានលុបរូបភាព Cloudinary ជោគជ័យ!');
            } else {
                setError(data.error || 'មិនអាចលុបបាន');
            }
        } catch (e) {
            setError('Delete failed: ' + e.message);
        }
    };

    const openPreview = (img) => {
        setActiveImage(img);
        setZoom(1);
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setIsCropping(false);
        setCropAspect('free');
        setCropBox({ x: 10, y: 10, width: 80, height: 80 });
        setError('');
        setMessage('');
    };

    const copyImgData = async (img) => {
        try {
            const id = img.entityId || img.category;
            setCopiedId(id);
            // Copy the data URL to clipboard if supported, else show message
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(`[Base64 Image - ${img.category} / ${img.entityName}]`);
            }
            setMessage('បានចម្លង Base64 identifier ជោគជ័យ');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            setError('Could not copy.');
        }
    };

    const downloadImage = (img) => {
        try {
            const link = document.createElement('a');
            link.href = img.src;
            const ext = img.src.includes('image/png') ? 'png' : 'jpg';
            link.download = `${img.category}_${img.entityId || 'image'}.${ext}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setMessage('បានទាញយករូបភាពជោគជ័យ!');
        } catch (e) {
            setError('Could not download image.');
        }
    };

    // Render edited image from canvas and download
    const handleDownloadEdited = async () => {
        if (!activeImage) return;
        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = activeImage.src;
            });
            const canvas = document.createElement('canvas');
            const rad = (rotation * Math.PI) / 180;
            const sw = Math.abs(img.width * Math.cos(rad)) + Math.abs(img.height * Math.sin(rad));
            const sh = Math.abs(img.width * Math.sin(rad)) + Math.abs(img.height * Math.cos(rad));
            canvas.width = Math.round(isCropping ? img.width * (cropBox.width / 100) : sw);
            canvas.height = Math.round(isCropping ? img.height * (cropBox.height / 100) : sh);
            const ctx = canvas.getContext('2d');
            if (!isCropping) {
                ctx.translate(sw / 2, sh / 2);
                ctx.rotate(rad);
                ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
            } else {
                ctx.drawImage(img,
                    img.width * (cropBox.x / 100), img.height * (cropBox.y / 100),
                    img.width * (cropBox.width / 100), img.height * (cropBox.height / 100),
                    0, 0, canvas.width, canvas.height
                );
            }
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `edited_${activeImage.category}_${activeImage.entityId || 'image'}.jpg`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setMessage('បានទាញយករូបភាពដែលបានកែជោគជ័យ!');
            }, 'image/jpeg', 0.95);
        } catch (err) {
            setError(`Could not download edited image: ${err.message}`);
        }
    };

    // Save edited image as new base64 (just updates locally — no server update since it's embedded in records)
    const handleSaveNewVersion = async () => {
        if (!activeImage) return;
        setSavingNewVersion(true);
        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve; img.onerror = reject;
                img.src = activeImage.src;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(img.width / 2, img.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            ctx.restore();
            const newSrc = canvas.toDataURL('image/jpeg', 0.92);
            setActiveImage(prev => ({ ...prev, src: newSrc }));
            setImages(prev => prev.map(i => i === activeImage ? { ...i, src: newSrc } : i));
            setRotation(0); setFlipH(false); setFlipV(false); setIsCropping(false);
            setMessage('រូបភាពបានកែប្រែក្នុងទំព័រ (Save to DB តម្រូវឱ្យកែក្នុង Record ដើម)');
        } catch (err) {
            setError('Could not save edited version.');
        } finally {
            setSavingNewVersion(false);
        }
    };

    const applyAspect = (aspectKey) => {
        setCropAspect(aspectKey);
        setIsCropping(true);
        if (aspectKey === 'free') return;
        let targetRatio = 1;
        if (aspectKey === '1:1') targetRatio = 1;
        else if (aspectKey === '4:3') targetRatio = 4 / 3;
        else if (aspectKey === '16:9') targetRatio = 16 / 9;
        else if (aspectKey === '3:2') targetRatio = 3 / 2;
        setCropBox(prev => {
            let newW = prev.width;
            let newH = newW / targetRatio;
            if (newH > 90) { newH = 80; newW = newH * targetRatio; }
            if (newW > 90) newW = 80;
            const newX = Math.max(0, Math.min(100 - newW, 50 - newW / 2));
            const newY = Math.max(0, Math.min(100 - newH, 50 - newH / 2));
            return { x: +newX.toFixed(1), y: +newY.toFixed(1), width: +newW.toFixed(1), height: +newH.toFixed(1) };
        });
    };

    const catColor = (cat, storageType) => {
        if (storageType === 'cloudinary' || cat === 'Cloudinary') return 'bg-sky-100 text-sky-800';
        const map = {
            Contract: 'bg-blue-100 text-blue-800',
            CashTransaction: 'bg-amber-100 text-amber-800',
            Salary: 'bg-emerald-100 text-emerald-800',
            FollowUp: 'bg-purple-100 text-purple-800',
            SupportHelp: 'bg-cyan-100 text-cyan-800',
            SupportComment: 'bg-rose-100 text-rose-800',
        };
        return map[cat] || 'bg-slate-100 text-slate-700';
    };

    const storageLabel = (img) => img.storageType === 'cloudinary'
        ? <span className="text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">☁️ Cloud</span>
        : <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">🗄️ Base64</span>;

    return (
        <div ref={scrollContainerRef} className="h-full min-h-0 overflow-y-auto bg-slate-50 p-3 text-slate-800 sm:p-5">
            <div className="mx-auto max-w-[1600px] space-y-4">
                {/* HEADER */}
                <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><MdOutlinePhotoLibrary size={24} /></span>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">All Picture</h1>
                            <p className="text-sm text-slate-500">
                        {images.some(i => i.storageType === 'cloudinary') ? '☁️ Cloudinary + ' : ''}
                        🗄️ MongoDB Base64 · {total} រូប
                    </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[210px] flex-1 sm:flex-none">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ស្វែងរករូបភាព..."
                                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => fetchImages(currentPage, category)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                        >
                            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </header>

                {/* CATEGORY FILTER TABS */}
                <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => { setCategory(key); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                                category === key ? color : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* ALERT */}
                {(error || message) && (
                    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        <span>{error || message}</span>
                        <button type="button" onClick={() => { setError(''); setMessage(''); }}><FaTimes /></button>
                    </div>
                )}

                {/* GRID */}
                {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-20 text-center text-slate-500">
                        <FaSyncAlt className="mx-auto mb-3 animate-spin text-2xl text-emerald-600" />
                        <p className="text-sm">កំពុងទាញយករូបភាព Base64 ពី MongoDB...</p>
                    </div>
                ) : visibleImages.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-20 text-center text-slate-500">
                        <MdOutlinePhotoLibrary className="mx-auto mb-3 text-4xl text-slate-300" />
                        <p className="text-sm font-medium">
                            {error ? 'រូបភាពមិនអាចទាញបាន។' : search ? 'រកមិនឃើញរូបភាពដែលត្រូវនឹងការស្វែងរក។' : 'មិនទាន់មានរូបភាព Base64 ក្នុង MongoDB នៅឡើយ។'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            រូបភាពនឹងបង្ហាញនៅទីនេះ នៅពេលដែល Staff Upload រូបភាពតាម Contract, Salary, Follow Up ជាដើម។
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {visibleImages.map((img, idx) => {
                            const uniqueKey = `${img.category}_${img.entityId}_${idx}`;
                            return (
                                <article key={uniqueKey} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
                                    <div className="relative aspect-square bg-slate-100">
                                        <img
                                            src={img.src}
                                            alt={img.entityName || img.field}
                                            loading="lazy"
                                            className="h-full w-full cursor-zoom-in object-contain p-1"
                                            onClick={() => openPreview(img)}
                                            data-no-zoom
                                        />
                                        {/* Category badge */}
                                        <span className={`absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow ${catColor(img.category, img.storageType)}`}>
                                            {img.storageType === 'cloudinary' ? '☁️' : '🗄️'} {img.category}
                                        </span>
                                        {/* Zoom hint */}
                                        <button
                                            type="button"
                                            onClick={() => openPreview(img)}
                                            title="ពង្រីកមើល (Zoom & View)"
                                            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-emerald-600 text-white text-[10px] font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                        >
                                            <FaSearchPlus size={10} />
                                            <span>រូបភាព</span>
                                        </button>
                                    </div>
                                    <div className="space-y-1 p-2.5">
                                        <p className="truncate text-xs font-semibold text-slate-700" title={img.entityName}>{img.entityName || '—'}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{img.field}</p>
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            {storageLabel(img)}
                                            <button type="button" onClick={() => copyImgData(img)} title="Copy info" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700">
                                                {copiedId === (img.entityId || img.category) ? <FaCheck className="text-emerald-600" /> : <FaRegCopy />}
                                            </button>
                                            <button type="button" onClick={() => downloadImage(img)} title="Download" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"><FaDownload /></button>
                                            <button type="button" onClick={() => openPreview(img)} title="View details" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"><FaInfoCircle /></button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* PAGINATION */}
                {pages > 1 && !loading && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => fetchImages(currentPage - 1, category)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
                        >← មុន</button>
                        {Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => fetchImages(p, category)}
                                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                                    p === currentPage ? 'bg-emerald-600 text-white shadow' : 'border border-slate-300 hover:bg-slate-100 text-slate-700'
                                }`}
                            >{p}</button>
                        ))}
                        {pages > 8 && <span className="text-slate-400 text-sm">... {pages} ទំព័រ</span>}
                        <button
                            type="button"
                            disabled={currentPage >= pages}
                            onClick={() => fetchImages(currentPage + 1, category)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
                        >បន្ទាប់ →</button>
                    </div>
                )}
            </div>

            {/* PREVIEW & EDIT MODAL */}
            {activeImage && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-sm sm:p-4"
                    onClick={() => setActiveImage(null)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="Image preview and details"
                        className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl lg:flex-row"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* LEFT: IMAGE VIEWPORT & EDIT CONTROLS */}
                        <div className="flex min-h-[50vh] flex-1 flex-col bg-slate-950 lg:min-h-[78vh]">
                            {/* TOP TOOLBAR */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white">
                                <span className="min-w-0 max-w-[200px] truncate text-xs sm:max-w-xs">
                                    {activeImage.category} · {activeImage.entityName}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {/* Zoom Bar (របាពង្រីកបង្រួម) */}
                                    <div className="flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 border border-white/15 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => setZoom(v => Math.max(0.25, +(v - 0.25).toFixed(2)))}
                                            title="បង្រួមតូច"
                                            className="rounded p-1 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                                        ><FaSearchMinus className="text-xs" /></button>
                                        <input
                                            type="range" min="0.25" max="4.0" step="0.05"
                                            value={zoom}
                                            onChange={e => setZoom(+e.target.value)}
                                            className="h-1.5 w-16 sm:w-28 cursor-pointer accent-emerald-500 bg-white/20 rounded-lg"
                                            title={`${Math.round(zoom * 100)}%`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setZoom(v => Math.min(4.0, +(v + 0.25).toFixed(2)))}
                                            title="ពង្រីកធំ"
                                            className="rounded p-1 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                                        ><FaSearchPlus className="text-xs" /></button>
                                        <span className="min-w-9 text-center font-mono text-xs font-bold text-emerald-400 select-none">
                                            {Math.round(zoom * 100)}%
                                        </span>
                                        {zoom !== 1 && (
                                            <button type="button" onClick={() => setZoom(1)}
                                                className="rounded px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 text-slate-300 font-mono cursor-pointer">
                                                100%
                                            </button>
                                        )}
                                    </div>

                                    <div className="mx-1 h-4 w-[1px] bg-white/20" />

                                    {/* Rotate */}
                                    <button type="button" onClick={() => setRotation(r => r - 90)}
                                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                                        <FaUndo className="text-[11px]" /> -90°
                                    </button>
                                    <button type="button" onClick={() => setRotation(r => r + 90)}
                                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                                        <FaRedo className="text-[11px]" /> +90°
                                    </button>

                                    {/* Flip */}
                                    <button type="button" onClick={() => setFlipH(f => !f)}
                                        className={`rounded px-2 py-1 text-xs transition-colors ${flipH ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                                        <FaArrowsAltH />
                                    </button>
                                    <button type="button" onClick={() => setFlipV(f => !f)}
                                        className={`rounded px-2 py-1 text-xs transition-colors ${flipV ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                                        <FaArrowsAltV />
                                    </button>

                                    <div className="mx-1 h-4 w-[1px] bg-white/20" />

                                    {/* Crop Toggle */}
                                    <button type="button"
                                        onClick={() => { setIsCropping(c => !c); }}
                                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${isCropping ? 'bg-emerald-600 text-white' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                                        <FaCropAlt /> {isCropping ? 'កំពុងកាត់រូប' : 'កាត់រូប (Crop)'}
                                    </button>

                                    <button type="button" onClick={() => setActiveImage(null)} aria-label="Close preview"
                                        className="ml-1 rounded p-1.5 hover:bg-white/10"><FaTimes /></button>
                                </div>
                            </div>

                            {/* CROP SETTINGS BAR */}
                            {isCropping && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-semibold text-emerald-400">សមាមាត្រ:</span>
                                        {[
                                            { key: 'free', label: 'Free' },
                                            { key: '1:1', label: '1:1' },
                                            { key: '4:3', label: '4:3' },
                                            { key: '16:9', label: '16:9' },
                                            { key: '3:2', label: '3:2' }
                                        ].map(item => (
                                            <button key={item.key} type="button" onClick={() => applyAspect(item.key)}
                                                className={`rounded px-2 py-1 transition-colors ${cropAspect === item.key ? 'bg-emerald-600 font-bold text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <label className="flex items-center gap-1">
                                            <span>ទំហំ:</span>
                                            <input type="range" min="20" max="100" value={cropBox.width}
                                                onChange={e => {
                                                    const val = +e.target.value;
                                                    setCropBox(p => ({ ...p, width: val, height: cropAspect === '1:1' ? val : p.height, x: Math.min(p.x, 100 - val) }));
                                                }}
                                                className="h-1.5 w-20 cursor-pointer accent-emerald-500" />
                                        </label>
                                        <button type="button" onClick={() => { setCropBox({ x: 10, y: 10, width: 80, height: 80 }); setCropAspect('free'); }}
                                            className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Reset</button>
                                        <button type="button" onClick={() => setIsCropping(false)}
                                            className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* IMAGE DISPLAY AREA */}
                            <div ref={previewContainerRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 select-none">
                                <div
                                    className="relative inline-block"
                                    style={{ transform: `scale(${zoom})`, transition: 'transform 120ms ease-out' }}
                                >
                                    <img
                                        src={activeImage.src}
                                        alt={activeImage.entityName || activeImage.field}
                                        className="max-h-[65vh] max-w-full object-contain shadow-lg"
                                        style={{ transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`, transition: 'transform 150ms ease-out' }}
                                        data-no-zoom
                                    />
                                    {/* CROP BOX OVERLAY */}
                                    {isCropping && (
                                        <div
                                            className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
                                            style={{ left: `${cropBox.x}%`, top: `${cropBox.y}%`, width: `${cropBox.width}%`, height: `${cropBox.height}%` }}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                const startX = e.clientX, startY = e.clientY;
                                                const initBox = { ...cropBox };
                                                const container = previewContainerRef.current;
                                                if (!container) return;
                                                const rect = container.getBoundingClientRect();
                                                const onMove = (ev) => {
                                                    const dx = ((ev.clientX - startX) / rect.width) * 100;
                                                    const dy = ((ev.clientY - startY) / rect.height) * 100;
                                                    setCropBox(b => ({
                                                        ...b,
                                                        x: +Math.max(0, Math.min(100 - initBox.width, initBox.x + dx)).toFixed(1),
                                                        y: +Math.max(0, Math.min(100 - initBox.height, initBox.y + dy)).toFixed(1)
                                                    }));
                                                };
                                                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                                                window.addEventListener('mousemove', onMove);
                                                window.addEventListener('mouseup', onUp);
                                            }}
                                        >
                                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                                                {[...Array(9)].map((_, i) => <div key={i} className="border border-emerald-300" />)}
                                            </div>
                                            <div className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border border-white shadow" />
                                            <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border border-white shadow" />
                                            <div className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border border-white shadow" />
                                            <div className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border border-white shadow" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap">
                                                {cropAspect} ({Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%)
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* BOTTOM ACTION BAR */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-white">
                                <div className="flex items-center gap-2">
                                    {(rotation !== 0 || flipH || flipV || isCropping) ? (
                                        <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-amber-300 font-medium">
                                            ● បានកែ: {rotation !== 0 ? `${rotation}° ` : ''}{flipH ? 'FlipH ' : ''}{flipV ? 'FlipV ' : ''}{isCropping ? 'Crop' : ''}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">ទម្រង់ដើម (Original)</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(rotation !== 0 || flipH || flipV || isCropping) && (
                                        <button type="button"
                                            onClick={() => { setRotation(0); setFlipH(false); setFlipV(false); setIsCropping(false); setCropAspect('free'); setCropBox({ x: 10, y: 10, width: 80, height: 80 }); }}
                                            className="rounded border border-slate-600 px-2.5 py-1.5 hover:bg-white/10">
                                            Reset
                                        </button>
                                    )}
                                    <button type="button" onClick={handleDownloadEdited}
                                        className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-3 py-1.5 font-medium hover:bg-slate-600">
                                        <FaDownload /> ទាញយក
                                    </button>
                                    <button type="button" onClick={handleSaveNewVersion} disabled={savingNewVersion}
                                        className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
                                        {savingNewVersion ? <><FaSyncAlt className="animate-spin" /> រក្សា...</> : <><FaSave /> រក្សាទុក</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT ASIDE: METADATA */}
                        <aside className="max-h-[48vh] w-full shrink-0 overflow-y-auto border-t border-slate-200 p-4 lg:max-h-[90vh] lg:w-[340px] lg:border-l lg:border-t-0 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-800">ព័ត៌មានរូបភាព</h2>
                                <button type="button" onClick={() => setActiveImage(null)} className="rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><FaTimes /></button>
                            </div>

                            {/* Location / Usage Card */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-3">
                                <div className="flex items-center gap-2 font-bold text-xs text-emerald-800 uppercase tracking-wide border-b border-emerald-200/80 pb-2">
                                    <FaMapMarkerAlt className="text-emerald-600 text-sm" />
                                    <span>ទីតាំង & ព័ត៌មានប្រើប្រាស់</span>
                                </div>
                                <div className="space-y-2.5 text-xs">
                                    {/* Category */}
                                    <div>
                                        <span className="font-semibold text-slate-500 text-[11px] block">ប្រភេទ / Category:</span>
                                        <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[11px] font-bold ${catColor(activeImage.category)}`}>
                                            {CATEGORY_LABELS[activeImage.category]?.label || activeImage.category}
                                        </span>
                                    </div>
                                    {/* Entity */}
                                    <div>
                                        <span className="font-semibold text-slate-500 text-[11px] block">ភ្ជាប់ទៅ / Entity:</span>
                                        <p className="font-semibold text-slate-800 mt-0.5">{activeImage.entityName || '—'}</p>
                                    </div>
                                    {/* Field */}
                                    {activeImage.field && (
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[11px] block">មុខងារ / Field:</span>
                                            <p className="text-slate-700 mt-0.5">{activeImage.field}</p>
                                        </div>
                                    )}
                                    {/* Link to page */}
                                    {CATEGORY_PAGE_MAP[activeImage.category] && (
                                        <Link
                                            to={CATEGORY_PAGE_MAP[activeImage.category]}
                                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline text-[11px]"
                                        >
                                            <FaExternalLinkAlt className="text-[10px]" />
                                            បើកទំព័រ {activeImage.category}
                                        </Link>
                                    )}
                                    {/* When */}
                                    <div className="pt-2 border-t border-emerald-100">
                                        <span className="font-semibold text-slate-500 text-[11px] flex items-center gap-1">
                                            <FaCalendarAlt className="text-[10px] text-slate-400" /> ពេលណា:
                                        </span>
                                        <p className="text-slate-800 mt-0.5 font-medium">{formatDate(activeImage.usedAt)}</p>
                                    </div>
                                    {/* Who */}
                                    <div className="pt-2 border-t border-emerald-100">
                                        <span className="font-semibold text-slate-500 text-[11px] flex items-center gap-1">
                                            <FaUser className="text-[10px] text-slate-400" /> អ្នកណា:
                                        </span>
                                        <p className="text-slate-800 mt-0.5 font-medium">{activeImage.usedBy || 'Staff'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Storage Type & Info */}
                            <div className="space-y-2 text-xs">
                                <div className="border-b border-slate-100 pb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Storage Type</p>
                                    {activeImage.storageType === 'cloudinary'
                                        ? <p className="font-medium text-sky-700">☁️ Cloudinary CDN</p>
                                        : <p className="font-medium text-emerald-700">🗄️ MongoDB Base64</p>
                                    }
                                </div>
                                {activeImage.storageType === 'base64' && (
                                    <div className="border-b border-slate-100 pb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ទំហំ (Approximate)</p>
                                        <p className="break-all font-medium text-slate-700">{Math.round(activeImage.src.length * 0.75 / 1024)} KB</p>
                                    </div>
                                )}
                                {activeImage.storageType === 'cloudinary' && activeImage.format && (
                                    <div className="border-b border-slate-100 pb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dimensions & Size</p>
                                        <p className="font-medium text-slate-700">{activeImage.width}×{activeImage.height} · {activeImage.bytes ? Math.round(activeImage.bytes / 1024) + ' KB' : '—'}</p>
                                    </div>
                                )}
                                <div className="border-b border-slate-100 pb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Format</p>
                                    <p className="font-medium text-slate-700">
                                        {activeImage.storageType === 'cloudinary'
                                            ? (activeImage.format || '—')
                                            : (activeImage.src.split(';')[0].replace('data:', '') || 'image/jpeg')
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => copyImgData(activeImage)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                    <FaRegCopy /> Copy Info
                                </button>
                                <button type="button" onClick={() => downloadImage(activeImage)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                    <FaDownload /> Download
                                </button>
                                {canDelete && activeImage.storageType === 'cloudinary' && (
                                    <button
                                        type="button"
                                        onClick={() => deleteCloudinaryImage(activeImage)}
                                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                                    >
                                        <FaTrashAlt /> លុបចេញពី Cloudinary
                                    </button>
                                )}
                            </div>
                        </aside>
                    </section>
                </div>
            )}
        </div>
    );
};

export default AllPicture;
