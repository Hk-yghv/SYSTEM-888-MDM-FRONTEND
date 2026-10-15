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
    FaSyncAlt,
    FaTimes,
    FaTrashAlt,
    FaUndo,
    FaUser
} from 'react-icons/fa';
import { MdOutlinePhotoLibrary } from 'react-icons/md';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 18;

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const formatDate = (date) => {
    if (!date) return 'Unknown';
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime()) ? String(date) : parsedDate.toLocaleString();
};

const AllPicture = () => {
    const { smartFetch, hasPermission } = useAuth();
    const canDelete = hasPermission('/all-picture', 'delete');
    const scrollContainerRef = useRef(null);
    const loadMoreRef = useRef(null);
    const previewContainerRef = useRef(null);

    const [assets, setAssets] = useState([]);
    const [nextCursor, setNextCursor] = useState('');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [activeAsset, setActiveAsset] = useState(null);

    // Zoom & view
    const [zoom, setZoom] = useState(1);

    // Edit states (Crop, Rotate, Flip)
    const [isEditMode, setIsEditMode] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
    const [cropAspect, setCropAspect] = useState('free');
    const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });

    // Usage info state (Location, Who, When)
    const [assetUsage, setAssetUsage] = useState(null);
    const [loadingUsage, setLoadingUsage] = useState(false);

    // Saving & loading states
    const [savingNewVersion, setSavingNewVersion] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const requestAssets = useCallback(async (cursor = '', append = false) => {
        append ? setLoadingMore(true) : setLoading(true);
        setError('');
        setMessage('');
        try {
            const params = new URLSearchParams({ max_results: String(PAGE_SIZE) });
            if (cursor) params.set('next_cursor', cursor);
            const response = await smartFetch(`/media/assets?${params.toString()}`, { bypassCache: true });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

            const pageAssets = Array.isArray(data.resources) ? data.resources : [];
            setAssets(current => append ? [...current, ...pageAssets] : pageAssets);
            setNextCursor(data.next_cursor || '');
        } catch (requestError) {
            setError(requestError.message || 'Unable to load Cloudinary images.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [smartFetch]);

    const loadMore = useCallback(() => {
        if (nextCursor && !loading && !loadingMore) {
            requestAssets(nextCursor, true);
        }
    }, [loading, loadingMore, nextCursor, requestAssets]);

    useEffect(() => {
        const target = loadMoreRef.current;
        const root = scrollContainerRef.current;
        if (!target || !root || !nextCursor || loading || loadingMore) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) loadMore();
        }, { root, rootMargin: '160px' });
        observer.observe(target);
        return () => observer.disconnect();
    }, [assets.length, loadMore, loading, loadingMore, nextCursor]);

    useEffect(() => {
        requestAssets();
    }, [requestAssets]);

    const visibleAssets = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return assets;
        return assets.filter(asset =>
            [asset.public_id, asset.asset_folder, asset.folder, asset.display_name, asset.format, asset.secure_url]
                .filter(Boolean)
                .some(value => String(value).toLowerCase().includes(query))
        );
    }, [assets, search]);

    const allVisibleSelected = visibleAssets.length > 0 &&
        visibleAssets.every(asset => selectedIds.has(asset.public_id));

    const toggleAsset = (publicId) => {
        setSelectedIds(current => {
            const next = new Set(current);
            next.has(publicId) ? next.delete(publicId) : next.add(publicId);
            return next;
        });
    };

    const toggleVisible = () => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (allVisibleSelected) {
                visibleAssets.forEach(asset => next.delete(asset.public_id));
            } else {
                visibleAssets.forEach(asset => next.add(asset.public_id));
            }
            return next;
        });
    };

    // Fetch usage details (Location, Who, When)
    const fetchUsage = useCallback(async (asset) => {
        if (!asset) return;
        setLoadingUsage(true);
        setAssetUsage(null);
        try {
            const params = new URLSearchParams();
            if (asset.secure_url) params.set('url', asset.secure_url);
            if (asset.public_id) params.set('public_id', asset.public_id);
            const res = await smartFetch(`/media/usage?${params.toString()}`);
            const data = await res.json();
            if (data.success && data.usage) {
                setAssetUsage(data.usage);
            }
        } catch (err) {
            console.error('Failed to load image usage:', err);
        } finally {
            setLoadingUsage(false);
        }
    }, [smartFetch]);

    const openPreview = (asset) => {
        setActiveAsset(asset);
        setZoom(1);
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setIsEditMode(false);
        setIsCropping(false);
        setCropAspect('free');
        setCropBox({ x: 10, y: 10, width: 80, height: 80 });
        setError('');
        setMessage('');
        fetchUsage(asset);
    };

    const copyUrl = async (asset) => {
        try {
            await navigator.clipboard.writeText(asset.secure_url);
            setMessage('បានចម្លង URL រូបភាពជោគជ័យ (Image URL copied)');
            setError('');
        } catch (copyError) {
            setError(`Could not copy the image URL: ${copyError.message}`);
        }
    };

    const downloadAsset = async (asset) => {
        try {
            const response = await fetch(asset.secure_url);
            if (!response.ok) throw new Error(`Download failed (${response.status})`);
            const blobUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${asset.public_id.replace(/[\\/]/g, '_')}.${asset.format || 'jpg'}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
            setMessage('បានទាញយករូបភាពជោគជ័យ (Image downloaded)');
            setError('');
        } catch (downloadError) {
            setError(`Could not download the image: ${downloadError.message}`);
        }
    };

    const deleteAssets = async (publicIds) => {
        if (!publicIds.length || deleting) return;
        const confirmed = window.confirm(
            `Permanently delete ${publicIds.length} image${publicIds.length === 1 ? '' : 's'} from Cloudinary? This cannot be undone.`
        );
        if (!confirmed) return;

        setDeleting(true);
        setError('');
        setMessage('');
        try {
            const successfullyDeleted = new Set();
            let batchError = '';
            for (let index = 0; index < publicIds.length; index += 100) {
                const batchIds = publicIds.slice(index, index + 100);
                const response = await smartFetch('/media/assets/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_ids: batchIds })
                });
                const data = await response.json();
                if (!response.ok) {
                    batchError = data.error || `Delete failed (${response.status})`;
                    break;
                }
                Object.entries(data.deleted || {})
                    .filter(([, status]) => status === 'deleted')
                    .forEach(([publicId]) => successfullyDeleted.add(publicId));
            }
            if (!successfullyDeleted.size && batchError) throw new Error(batchError);
            if (!successfullyDeleted.size) throw new Error('Cloudinary did not confirm deletion of the selected images.');

            setAssets(current => current.filter(asset => !successfullyDeleted.has(asset.public_id)));
            setSelectedIds(current => {
                const next = new Set(current);
                successfullyDeleted.forEach(id => next.delete(id));
                return next;
            });
            if (activeAsset && successfullyDeleted.has(activeAsset.public_id)) setActiveAsset(null);
            const skippedCount = publicIds.length - successfullyDeleted.size;
            setMessage(`${successfullyDeleted.size} image${successfullyDeleted.size === 1 ? '' : 's'} deleted from Cloudinary.${skippedCount ? ` ${skippedCount} were not deleted.` : ''}`);
            if (batchError) setError(batchError);
        } catch (deleteError) {
            setError(deleteError.message || 'Unable to delete selected images.');
        } finally {
            setDeleting(false);
        }
    };

    // Aspect ratio selection helper
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
            const imgAspect = (activeAsset?.width && activeAsset?.height)
                ? (activeAsset.width / activeAsset.height)
                : 1;

            let newW = prev.width;
            let newH = (newW * imgAspect) / targetRatio;

            if (newH > 90) {
                newH = 80;
                newW = (newH * targetRatio) / imgAspect;
            }
            if (newW > 90) newW = 80;

            const newX = Math.max(0, Math.min(100 - newW, 50 - newW / 2));
            const newY = Math.max(0, Math.min(100 - newH, 50 - newH / 2));
            return { x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)), width: Number(newW.toFixed(1)), height: Number(newH.toFixed(1)) };
        });
    };

    // Offscreen Canvas Generator for edited output
    const renderEditedCanvas = async () => {
        if (!activeAsset) throw new Error('No active image selected');

        // Fetch as blob to guarantee CORS compliance and prevent tainted canvas
        const response = await fetch(activeAsset.secure_url);
        if (!response.ok) throw new Error('Failed to load image data for editing');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to process image in canvas'));
            img.src = blobUrl;
        });
        URL.revokeObjectURL(blobUrl);

        const origW = img.naturalWidth || activeAsset.width || 800;
        const origH = img.naturalHeight || activeAsset.height || 600;

        // Calculate natural pixel coordinates for crop
        let cropX = 0;
        let cropY = 0;
        let cropW = origW;
        let cropH = origH;

        if (isCropping) {
            cropX = Math.round((cropBox.x / 100) * origW);
            cropY = Math.round((cropBox.y / 100) * origH);
            cropW = Math.round((cropBox.width / 100) * origW);
            cropH = Math.round((cropBox.height / 100) * origH);

            cropX = Math.max(0, Math.min(origW - 10, cropX));
            cropY = Math.max(0, Math.min(origH - 10, cropY));
            cropW = Math.max(10, Math.min(origW - cropX, cropW));
            cropH = Math.max(10, Math.min(origH - cropY, cropH));
        }

        // Intermediate canvas for crop
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Apply rotation and flip
        const normalizedRot = ((rotation % 360) + 360) % 360;
        const isQuarterRot = normalizedRot === 90 || normalizedRot === 270;
        const finalW = isQuarterRot ? cropH : cropW;
        const finalH = isQuarterRot ? cropW : cropH;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = finalW;
        finalCanvas.height = finalH;
        const ctx = finalCanvas.getContext('2d');

        ctx.save();
        ctx.translate(finalW / 2, finalH / 2);
        ctx.rotate((normalizedRot * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(cropCanvas, -cropW / 2, -cropH / 2);
        ctx.restore();

        return finalCanvas;
    };

    // Save as new version to Cloudinary
    const handleSaveNewVersion = async () => {
        if (!activeAsset || savingNewVersion) return;
        setSavingNewVersion(true);
        setError('');
        setMessage('');
        try {
            const canvas = await renderEditedCanvas();
            const base64Data = canvas.toDataURL('image/jpeg', 0.92);

            const folder = activeAsset.asset_folder || activeAsset.folder || 'system_mdm_private';
            const res = await smartFetch('/media/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: base64Data,
                    folder
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || data.error || 'Upload to Cloudinary failed');
            }

            const newAsset = {
                public_id: data.public_id,
                secure_url: data.secure_url || data.raw_url,
                format: data.format || 'jpg',
                width: data.width || canvas.width,
                height: data.height || canvas.height,
                bytes: data.bytes || Math.round(base64Data.length * 0.75),
                created_at: data.created_at || new Date().toISOString(),
                asset_folder: folder,
                folder,
                resource_type: 'image',
                type: 'upload'
            };

            // Prepend new image to assets list
            setAssets(current => [newAsset, ...current]);
            setActiveAsset(newAsset);
            setIsEditMode(false);
            setIsCropping(false);
            setRotation(0);
            setFlipH(false);
            setFlipV(false);
            setMessage('រក្សាទុកជារូបភាពទម្រង់ថ្មីបានជោគជ័យ! (New version saved to Cloudinary)');
            fetchUsage(newAsset);
        } catch (saveErr) {
            console.error('Save new version error:', saveErr);
            setError(`មិនអាចរក្សាទុកទម្រង់ថ្មីបានទេ: ${saveErr.message}`);
        } finally {
            setSavingNewVersion(false);
        }
    };

    // Download the edited version directly
    const handleDownloadEdited = async () => {
        try {
            const canvas = await renderEditedCanvas();
            canvas.toBlob((blob) => {
                if (!blob) {
                    setError('Unable to generate download blob');
                    return;
                }
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `${activeAsset.public_id.replace(/[\\/]/g, '_')}_edited.jpg`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(blobUrl);
                setMessage('បានទាញយករូបភាពដែលបានកែប្រែជោគជ័យ! (Edited image downloaded)');
            }, 'image/jpeg', 0.95);
        } catch (dlErr) {
            setError(`Could not download edited image: ${dlErr.message}`);
        }
    };

    const metadata = activeAsset ? [
        ['Public ID', activeAsset.public_id],
        ['Folder', activeAsset.asset_folder || activeAsset.folder || '—'],
        ['Format', activeAsset.format || '—'],
        ['Dimensions', activeAsset.width && activeAsset.height ? `${activeAsset.width} × ${activeAsset.height}` : '—'],
        ['File size', formatBytes(activeAsset.bytes)],
        ['Created', formatDate(activeAsset.created_at)],
        ['Resource type', activeAsset.resource_type || 'image'],
        ['Delivery type', activeAsset.type || '—']
    ] : [];

    return (
        <div ref={scrollContainerRef} className="h-full min-h-0 overflow-y-auto bg-slate-50 p-3 text-slate-800 sm:p-5">
            <div className="mx-auto max-w-[1600px] space-y-4">
                <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><MdOutlinePhotoLibrary size={24} /></span>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">All Picture</h1>
                            <p className="text-sm text-slate-500">Images stored in Cloudinary · {assets.length} loaded</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[210px] flex-1 sm:flex-none">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search loaded images..."
                                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => requestAssets()}
                            disabled={loading || loadingMore}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                        >
                            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </header>

                {(error || message) && (
                    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        <span>{error || message}</span>
                        <button type="button" onClick={() => { setError(''); setMessage(''); }} aria-label="Dismiss message">
                            <FaTimes />
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-4 w-4 accent-emerald-600" />
                        Select visible ({visibleAssets.length})
                    </label>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{selectedIds.size} selected</span>
                        {canDelete && (
                            <button
                                type="button"
                                onClick={() => deleteAssets([...selectedIds])}
                                disabled={!selectedIds.size || deleting}
                                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FaTrashAlt /> {deleting ? 'Deleting...' : 'Delete selected'}
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-slate-500">
                        <FaSyncAlt className="mx-auto mb-3 animate-spin text-2xl text-emerald-600" />
                        Loading Cloudinary images...
                    </div>
                ) : visibleAssets.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-slate-500">
                        {error ? 'Images could not be loaded.' : search ? 'No loaded images match your search.' : 'No Cloudinary images found.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {visibleAssets.map(asset => (
                            <article key={asset.public_id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
                                <div className="relative aspect-square bg-slate-100">
                                    <img
                                        src={asset.secure_url}
                                        alt={asset.display_name || asset.public_id}
                                        loading="lazy"
                                        className="h-full w-full cursor-zoom-in object-contain p-1"
                                        onClick={() => openPreview(asset)}
                                    />
                                    <label className="absolute left-2 top-2 rounded bg-white/90 p-1.5 shadow">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(asset.public_id)}
                                            onChange={() => toggleAsset(asset.public_id)}
                                            aria-label={`Select ${asset.public_id}`}
                                            className="h-4 w-4 accent-emerald-600"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => openPreview(asset)}
                                        aria-label="View image details"
                                        className="absolute right-2 top-2 rounded bg-white/90 p-2 text-slate-600 shadow hover:text-emerald-700"
                                    >
                                        <FaInfoCircle />
                                    </button>
                                </div>
                                <div className="space-y-2 p-3">
                                    <p className="truncate text-xs font-semibold text-slate-700" title={asset.public_id}>{asset.public_id}</p>
                                    <p className="text-[11px] text-slate-500">
                                        {asset.width || '?'} × {asset.height || '?'} · {formatBytes(asset.bytes)} · {asset.format || 'image'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => copyUrl(asset)} title="Copy URL" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"><FaRegCopy /></button>
                                        <button type="button" onClick={() => downloadAsset(asset)} title="Download" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"><FaDownload /></button>
                                        <button type="button" onClick={() => openPreview(asset)} title="View details & edit" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"><FaInfoCircle /></button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {nextCursor && !loading && (
                    <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center pb-2 text-sm text-slate-500">
                        {loadingMore ? (
                            <span className="inline-flex items-center gap-2"><FaSyncAlt className="animate-spin text-emerald-600" /> Loading 18 more images...</span>
                        ) : 'Scroll to load more images'}
                    </div>
                )}
            </div>

            {/* PREVIEW & EDIT MODAL */}
            {activeAsset && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-sm sm:p-4"
                    onClick={() => setActiveAsset(null)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="Image preview and details"
                        className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl lg:flex-row"
                        onClick={event => event.stopPropagation()}
                    >
                        {/* LEFT: IMAGE VIEWPORT & EDIT CONTROLS */}
                        <div className="flex min-h-[50vh] flex-1 flex-col bg-slate-950 lg:min-h-[78vh]">
                            {/* TOP TOOLBAR */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white">
                                <span className="min-w-0 max-w-[200px] truncate text-xs sm:max-w-xs">{activeAsset.public_id}</span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {/* Zoom controls */}
                                    <button type="button" onClick={() => setZoom(v => Math.max(0.5, Number((v - 0.25).toFixed(2))))} title="Zoom out" className="rounded p-1.5 hover:bg-white/10"><FaCompress /></button>
                                    <span className="min-w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
                                    <button type="button" onClick={() => setZoom(v => Math.min(3, Number((v + 0.25).toFixed(2))))} title="Zoom in" className="rounded p-1.5 hover:bg-white/10"><FaExpand /></button>

                                    <div className="mx-1 h-4 w-[1px] bg-white/20" />

                                    {/* Rotate controls */}
                                    <button
                                        type="button"
                                        onClick={() => setRotation(r => r - 90)}
                                        title="បង្វិលឆ្វេង 90° (Rotate left)"
                                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                                    >
                                        <FaUndo className="text-[11px]" /> -90°
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRotation(r => r + 90)}
                                        title="បង្វិលស្តាំ 90° (Rotate right)"
                                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                                    >
                                        <FaRedo className="text-[11px]" /> +90°
                                    </button>

                                    {/* Flip controls */}
                                    <button
                                        type="button"
                                        onClick={() => setFlipH(f => !f)}
                                        title="ត្រឡប់ផ្ដេក (Flip Horizontal)"
                                        className={`rounded px-2 py-1 text-xs transition-colors ${flipH ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                                    >
                                        <FaArrowsAltH />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFlipV(f => !f)}
                                        title="ត្រឡប់បញ្ឈរ (Flip Vertical)"
                                        className={`rounded px-2 py-1 text-xs transition-colors ${flipV ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                                    >
                                        <FaArrowsAltV />
                                    </button>

                                    <div className="mx-1 h-4 w-[1px] bg-white/20" />

                                    {/* Toggle Crop Mode */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCropping(c => !c);
                                            setIsEditMode(true);
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${isCropping ? 'bg-emerald-600 text-white' : 'bg-white/15 text-white hover:bg-white/25'}`}
                                    >
                                        <FaCropAlt /> {isCropping ? 'កំពុងកាត់រូប' : 'កាត់រូប (Crop)'}
                                    </button>

                                    <button type="button" onClick={() => setActiveAsset(null)} aria-label="Close preview" className="ml-1 rounded p-1.5 hover:bg-white/10"><FaTimes /></button>
                                </div>
                            </div>

                            {/* CROP SETTINGS BAR (visible when crop mode is active) */}
                            {isCropping && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-semibold text-emerald-400">សមាមាត្រកាត់ (Aspect):</span>
                                        {[
                                            { key: 'free', label: 'សេរី (Free)' },
                                            { key: '1:1', label: '1:1 (ការ៉េ)' },
                                            { key: '4:3', label: '4:3' },
                                            { key: '16:9', label: '16:9' },
                                            { key: '3:2', label: '3:2 (ID Card)' }
                                        ].map(item => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => applyAspect(item.key)}
                                                className={`rounded px-2 py-1 transition-colors ${cropAspect === item.key ? 'bg-emerald-600 font-bold text-white' : 'bg-white/10 hover:bg-white/20'}`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Precision Range Sliders for fine-tuning */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <label className="flex items-center gap-1">
                                            <span>ទំហំ:</span>
                                            <input
                                                type="range"
                                                min="20"
                                                max="100"
                                                value={cropBox.width}
                                                onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setCropBox(p => ({
                                                        ...p,
                                                        width: val,
                                                        height: cropAspect === '1:1' ? val : p.height,
                                                        x: Math.min(p.x, 100 - val),
                                                        y: Math.min(p.y, 100 - (cropAspect === '1:1' ? val : p.height))
                                                    }));
                                                }}
                                                className="h-1.5 w-20 cursor-pointer accent-emerald-500"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCropBox({ x: 10, y: 10, width: 80, height: 80 });
                                                setCropAspect('free');
                                            }}
                                            className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
                                        >
                                            Reset Box
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCropping(false)}
                                            className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                                        >
                                            បោះបង់ (Cancel)
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* MAIN IMAGE DISPLAY AREA */}
                            <div ref={previewContainerRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 select-none">
                                <div
                                    className="relative inline-block"
                                    style={{
                                        transform: `scale(${zoom})`,
                                        transition: 'transform 120ms ease-out'
                                    }}
                                >
                                    <img
                                        src={activeAsset.secure_url}
                                        alt={activeAsset.display_name || activeAsset.public_id}
                                        className="max-h-[65vh] max-w-full object-contain shadow-lg"
                                        style={{
                                            transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                                            transition: 'transform 150ms ease-out'
                                        }}
                                    />

                                    {/* INTERACTIVE CROP BOX OVERLAY */}
                                    {isCropping && (
                                        <div
                                            className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
                                            style={{
                                                left: `${cropBox.x}%`,
                                                top: `${cropBox.y}%`,
                                                width: `${cropBox.width}%`,
                                                height: `${cropBox.height}%`
                                            }}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                const startX = e.clientX;
                                                const startY = e.clientY;
                                                const initialBox = { ...cropBox };
                                                const container = previewContainerRef.current;
                                                if (!container) return;
                                                const rect = container.getBoundingClientRect();

                                                const onMouseMove = (moveEvent) => {
                                                    const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
                                                    const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
                                                    const newX = Math.max(0, Math.min(100 - initialBox.width, initialBox.x + dx));
                                                    const newY = Math.max(0, Math.min(100 - initialBox.height, initialBox.y + dy));
                                                    setCropBox(b => ({ ...b, x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) }));
                                                };

                                                const onMouseUp = () => {
                                                    window.removeEventListener('mousemove', onMouseMove);
                                                    window.removeEventListener('mouseup', onMouseUp);
                                                };

                                                window.addEventListener('mousemove', onMouseMove);
                                                window.addEventListener('mouseup', onMouseUp);
                                            }}
                                        >
                                            {/* Grid Guidelines */}
                                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                                                <div className="border-r border-b border-emerald-300"></div>
                                                <div className="border-r border-b border-emerald-300"></div>
                                                <div className="border-b border-emerald-300"></div>
                                                <div className="border-r border-b border-emerald-300"></div>
                                                <div className="border-r border-b border-emerald-300"></div>
                                                <div className="border-b border-emerald-300"></div>
                                                <div className="border-r border-emerald-300"></div>
                                                <div className="border-r border-emerald-300"></div>
                                                <div></div>
                                            </div>

                                            {/* Handles */}
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

                            {/* BOTTOM ACTION BAR FOR SAVING EDITED VERSIONS */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-white">
                                <div className="flex items-center gap-2">
                                    {(rotation !== 0 || flipH || flipV || isCropping) ? (
                                        <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-amber-300 font-medium">
                                            ● បានកែប្រែ: {rotation !== 0 ? `បង្វិល ${rotation}° ` : ''} {flipH ? 'ត្រឡប់H ' : ''} {flipV ? 'ត្រឡប់V ' : ''} {isCropping ? 'កាត់រូប ' : ''}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">ទម្រង់ដើម (Original View)</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(rotation !== 0 || flipH || flipV || isCropping) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRotation(0);
                                                setFlipH(false);
                                                setFlipV(false);
                                                setIsCropping(false);
                                                setCropAspect('free');
                                                setCropBox({ x: 10, y: 10, width: 80, height: 80 });
                                            }}
                                            className="rounded border border-slate-600 px-2.5 py-1.5 hover:bg-white/10"
                                        >
                                            កំណត់ឡើងវិញ (Reset)
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDownloadEdited}
                                        className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-3 py-1.5 font-medium hover:bg-slate-600"
                                    >
                                        <FaDownload /> ទាញយករូបកែប្រែ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveNewVersion}
                                        disabled={savingNewVersion}
                                        className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {savingNewVersion ? (
                                            <>
                                                <FaSyncAlt className="animate-spin" /> កំពុងរក្សាទុក...
                                            </>
                                        ) : (
                                            <>
                                                <FaSave /> រក្សាទុកជាទម្រង់ថ្មី (Save New Version)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT ASIDE: LOCATION & USAGE + IMAGE INFORMATION */}
                        <aside className="max-h-[48vh] w-full shrink-0 overflow-y-auto border-t border-slate-200 p-4 lg:max-h-[90vh] lg:w-[360px] lg:border-l lg:border-t-0 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-800">ព័ត៌មានរូបភាព (Information)</h2>
                                <button type="button" onClick={() => setActiveAsset(null)} className="rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><FaTimes /></button>
                            </div>

                            {/* 1. LOCATION & USAGE DETAILS (កន្លែងណា ពេលណា អ្នកណា) */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-xs space-y-3">
                                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-800 uppercase tracking-wide">
                                        <FaMapMarkerAlt className="text-emerald-600 text-sm" />
                                        <span>ទីតាំង & ព័ត៌មានប្រើប្រាស់</span>
                                    </div>
                                    {loadingUsage && <FaSyncAlt className="animate-spin text-emerald-600 text-xs" />}
                                </div>

                                {loadingUsage ? (
                                    <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                        <FaSyncAlt className="animate-spin text-emerald-600" />
                                        <span>កំពុងស្វែងរកទីតាំងប្រើប្រាស់...</span>
                                    </div>
                                ) : assetUsage ? (
                                    <div className="space-y-2.5 text-xs">
                                        {/* Where / កន្លែងណា */}
                                        <div>
                                            <span className="font-semibold text-slate-500 text-[11px] block">កន្លែងណា / ទីតាំងប្រើប្រាស់:</span>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    assetUsage.category === 'Contract' ? 'bg-blue-100 text-blue-700' :
                                                    assetUsage.category === 'Salary' ? 'bg-amber-100 text-amber-700' :
                                                    assetUsage.category === 'Support & Help' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {assetUsage.category}
                                                </span>
                                                <span className="font-semibold text-slate-800">{assetUsage.location}</span>
                                            </div>
                                            {assetUsage.customer && (
                                                <p className="mt-1 text-slate-600">
                                                    អតិថិជន: <strong className="text-slate-800">{assetUsage.customer}</strong> {assetUsage.phone ? `(${assetUsage.phone})` : ''}
                                                </p>
                                            )}
                                            {assetUsage.field && (
                                                <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                                                    មុខងារ: {assetUsage.field}
                                                </p>
                                            )}
                                            {assetUsage.page && (
                                                <div className="mt-1.5">
                                                    <Link
                                                        to={assetUsage.page}
                                                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline text-[11px]"
                                                    >
                                                        <FaExternalLinkAlt className="text-[10px]" /> បើកមើលទំព័រ {assetUsage.category}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        {/* When / ពេលណា */}
                                        <div className="pt-2 border-t border-emerald-100">
                                            <span className="font-semibold text-slate-500 text-[11px] flex items-center gap-1">
                                                <FaCalendarAlt className="text-[10px] text-slate-400" /> ពេលណា / កាលបរិច្ឆេទ:
                                            </span>
                                            <p className="text-slate-800 mt-0.5 font-medium">
                                                {formatDate(assetUsage.usedAt || activeAsset.created_at)}
                                            </p>
                                        </div>

                                        {/* Who / អ្នកណា */}
                                        <div className="pt-2 border-t border-emerald-100">
                                            <span className="font-semibold text-slate-500 text-[11px] flex items-center gap-1">
                                                <FaUser className="text-[10px] text-slate-400" /> អ្នកណា / អ្នកបញ្ចូល:
                                            </span>
                                            <p className="text-slate-800 mt-0.5 font-medium">
                                                {assetUsage.usedBy || 'Staff / Administrator'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500">ពុំមានព័ត៌មានប្រើប្រាស់ជាក់លាក់ (Cloudinary Library)</p>
                                )}
                            </div>

                            {/* 2. TECHNICAL METADATA */}
                            <div className="space-y-2.5">
                                {metadata.map(([label, value]) => (
                                    <div key={label} className="border-b border-slate-100 pb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                        <p className="break-all text-xs font-medium text-slate-700">{value}</p>
                                    </div>
                                ))}
                                <div className="border-b border-slate-100 pb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">URL</p>
                                    <a href={activeAsset.secure_url} target="_blank" rel="noreferrer" className="break-all text-xs text-sky-700 hover:underline">{activeAsset.secure_url}</a>
                                </div>
                            </div>

                            {/* 3. ACTION BUTTONS */}
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => copyUrl(activeAsset)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"><FaRegCopy /> Copy URL</button>
                                <button type="button" onClick={() => downloadAsset(activeAsset)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"><FaDownload /> Download</button>
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const publicId = activeAsset.public_id;
                                            deleteAssets([publicId]);
                                        }}
                                        disabled={deleting}
                                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <FaTrashAlt /> Delete image
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
