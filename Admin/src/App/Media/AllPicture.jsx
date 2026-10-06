import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FaCompress,
    FaDownload,
    FaExpand,
    FaInfoCircle,
    FaRedo,
    FaRegCopy,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTrashAlt,
    FaUndo
} from 'react-icons/fa';
import { MdOutlinePhotoLibrary } from 'react-icons/md';
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
    return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleString();
};

const AllPicture = () => {
    const { smartFetch, hasPermission } = useAuth();
    const canDelete = hasPermission('/all-picture', 'delete');
    const scrollContainerRef = useRef(null);
    const loadMoreRef = useRef(null);
    const [assets, setAssets] = useState([]);
    const [nextCursor, setNextCursor] = useState('');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [activeAsset, setActiveAsset] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
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

    const openPreview = (asset) => {
        setActiveAsset(asset);
        setZoom(1);
        setRotation(0);
        setError('');
        setMessage('');
    };

    const copyUrl = async (asset) => {
        try {
            await navigator.clipboard.writeText(asset.secure_url);
            setMessage('Image URL copied.');
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
            link.download = `${asset.public_id.replace(/[\\/]/g, '_')}.${asset.format || 'image'}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
            setMessage('Image downloaded.');
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
                            <article key={asset.public_id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
                                        <button type="button" onClick={() => openPreview(asset)} title="View details" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"><FaInfoCircle /></button>
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

            {activeAsset && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-5"
                    onClick={() => setActiveAsset(null)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="Image preview and details"
                        className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl lg:flex-row"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="flex min-h-[45vh] flex-1 flex-col bg-slate-950 lg:min-h-[75vh]">
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white">
                                <span className="min-w-0 truncate text-xs">{activeAsset.public_id}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button type="button" onClick={() => setZoom(value => Math.max(0.5, Number((value - 0.25).toFixed(2))))} title="Zoom out" className="rounded p-2 hover:bg-white/10"><FaCompress /></button>
                                    <span className="min-w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
                                    <button type="button" onClick={() => setZoom(value => Math.min(3, Number((value + 0.25).toFixed(2))))} title="Zoom in" className="rounded p-2 hover:bg-white/10"><FaExpand /></button>
                                    <button type="button" onClick={() => setRotation(value => value - 90)} title="Rotate left" className="rounded p-2 hover:bg-white/10"><FaUndo /></button>
                                    <button type="button" onClick={() => setRotation(value => value + 90)} title="Rotate right" className="rounded p-2 hover:bg-white/10"><FaRedo /></button>
                                    <button type="button" onClick={() => setActiveAsset(null)} aria-label="Close preview" className="ml-1 rounded p-2 hover:bg-white/10"><FaTimes /></button>
                                </div>
                            </div>
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                                <img
                                    src={activeAsset.secure_url}
                                    alt={activeAsset.display_name || activeAsset.public_id}
                                    className="max-h-[72vh] max-w-full object-contain transition-transform duration-150"
                                    style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                                />
                            </div>
                        </div>

                        <aside className="max-h-[48vh] w-full shrink-0 overflow-y-auto border-t border-slate-200 p-4 lg:max-h-[90vh] lg:w-[340px] lg:border-l lg:border-t-0">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-800">Image information</h2>
                                <button type="button" onClick={() => setActiveAsset(null)} className="rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><FaTimes /></button>
                            </div>
                            <div className="space-y-3">
                                {metadata.map(([label, value]) => (
                                    <div key={label} className="border-b border-slate-100 pb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                        <p className="break-all text-sm text-slate-700">{value}</p>
                                    </div>
                                ))}
                                <div className="border-b border-slate-100 pb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">URL</p>
                                    <a href={activeAsset.secure_url} target="_blank" rel="noreferrer" className="break-all text-xs text-sky-700 hover:underline">{activeAsset.secure_url}</a>
                                </div>
                            </div>
                            <div className="mt-5 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => copyUrl(activeAsset)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"><FaRegCopy /> Copy URL</button>
                                <button type="button" onClick={() => downloadAsset(activeAsset)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"><FaDownload /> Download</button>
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const publicId = activeAsset.public_id;
                                            deleteAssets([publicId]);
                                        }}
                                        disabled={deleting}
                                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
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
