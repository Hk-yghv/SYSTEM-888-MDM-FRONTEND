import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaSearchPlus, FaSearchMinus, FaExpand, FaRedo, FaUndo, FaTimes, FaDownload, FaSyncAlt } from 'react-icons/fa';

/**
 * GlobalImageZoomModal - Provides universal zoom bar (របាពង្រីកបង្រួម) for any image across the entire system.
 * Listens for image clicks or inspect triggers, offering smooth slider zooming, drag-to-pan, and rotation.
 */
const GlobalImageZoomModal = () => {
    const [activeSrc, setActiveSrc] = useState(null);
    const [activeAlt, setActiveAlt] = useState('');
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });

    const openZoom = useCallback((src, alt = '') => {
        if (!src) return;
        setActiveSrc(src);
        setActiveAlt(alt);
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, []);

    const closeZoom = useCallback(() => {
        setActiveSrc(null);
    }, []);

    // Listen for custom trigger or click delegation on images
    useEffect(() => {
        const handleImageClick = (e) => {
            const img = e.target.closest('img');
            if (!img) return;

            // Skip if image explicitly opts out
            if (img.dataset.noZoom || img.closest('[data-no-zoom]')) return;

            // Skip if inside an input, checkbox, or already handled by specific modal like AllPicture
            if (img.closest('#all-picture-modal') || img.closest('.ql-editor') || img.closest('[role="dialog"]')) return;

            // Check if valid image src
            const src = img.currentSrc || img.src;
            if (!src || src.startsWith('data:image/svg') || (img.naturalWidth > 0 && img.naturalWidth < 40)) return;

            // If the image has an interactive parent doing something else, skip
            const parentButton = img.closest('button:not(.zoom-trigger), a:not(.zoom-trigger)');
            if (parentButton && !parentButton.classList.contains('cursor-zoom-in') && !parentButton.title?.includes('Zoom') && !parentButton.title?.includes('View')) {
                return;
            }

            // Open in global zoom
            openZoom(src, img.alt || '');
        };

        document.addEventListener('click', handleImageClick);

        // Window event for openGlobalZoom
        const handleCustomZoom = (e) => {
            if (e.detail?.src) {
                openZoom(e.detail.src, e.detail.alt || '');
            }
        };

        window.addEventListener('openGlobalImageZoom', handleCustomZoom);
        return () => {
            document.removeEventListener('click', handleImageClick);
            window.removeEventListener('openGlobalImageZoom', handleCustomZoom);
        };
    }, [openZoom]);

    // Keyboard (ESC)
    useEffect(() => {
        if (!activeSrc) return;
        const onKey = (e) => {
            if (e.key === 'Escape') closeZoom();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [activeSrc, closeZoom]);

    if (!activeSrc) return null;

    const handleZoomChange = (newZoom) => {
        const val = Math.max(0.25, Math.min(4.5, Number(Number(newZoom).toFixed(2))));
        setZoom(val);
        if (val <= 1) setPan({ x: 0, y: 0 });
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        handleZoomChange(zoom + delta);
    };

    return (
        <div
            className="fixed inset-0 z-[999999999] flex flex-col bg-slate-950/92 backdrop-blur-md animate-in fade-in duration-150 select-none"
            onClick={closeZoom}
        >
            {/* Top Toolbar with របាពង្រីកបង្រួម */}
            <div
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 text-white z-20 shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Info */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">របាពង្រីកបង្រួម / Image Zoom</span>
                    {activeAlt && <span className="text-xs text-slate-400 truncate max-w-xs">• {activeAlt}</span>}
                </div>

                {/* ── Interactive Zoom Bar (របាពង្រីកបង្រួម) ── */}
                <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700 shadow-inner">
                    <button
                        type="button"
                        onClick={() => handleZoomChange(zoom - 0.25)}
                        title="បង្រួមតូច (-)"
                        className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 hover:text-white text-xs cursor-pointer transition-colors"
                    >
                        <FaSearchMinus />
                    </button>

                    {/* Range slider (របា) */}
                    <input
                        type="range"
                        min="0.25"
                        max="4.0"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => handleZoomChange(e.target.value)}
                        className="w-24 sm:w-40 h-1.5 accent-emerald-500 bg-slate-700 rounded-lg cursor-pointer"
                        title={`កម្រិតពង្រីក: ${Math.round(zoom * 100)}%`}
                    />

                    <button
                        type="button"
                        onClick={() => handleZoomChange(zoom + 0.25)}
                        title="ពង្រីកធំ (+)"
                        className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 hover:text-white text-xs cursor-pointer transition-colors"
                    >
                        <FaSearchPlus />
                    </button>

                    <span className="text-xs font-mono font-bold text-emerald-400 min-w-12 text-center select-none">
                        {Math.round(zoom * 100)}%
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            setZoom(1);
                            setPan({ x: 0, y: 0 });
                        }}
                        title="កំណត់ ១០០% (Reset 100%)"
                        className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                            zoom === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                        }`}
                    >
                        100%
                    </button>
                    <button
                        type="button"
                        onClick={() => handleZoomChange(2)}
                        title="២០០% (200%)"
                        className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                            zoom === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                        }`}
                    >
                        200%
                    </button>
                </div>

                {/* Rotate & Actions */}
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setRotation((r) => r - 90)}
                        title="បង្វិលឆ្វេង -90°"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                    >
                        <FaUndo />
                    </button>
                    <button
                        type="button"
                        onClick={() => setRotation((r) => r + 90)}
                        title="បង្វិលស្តាំ +90°"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                    >
                        <FaRedo />
                    </button>
                    <a
                        href={activeSrc}
                        download
                        target="_blank"
                        rel="noreferrer"
                        title="ទាញយករូបភាព (Download)"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                    >
                        <FaDownload />
                    </a>
                    <button
                        type="button"
                        onClick={closeZoom}
                        title="បិទ (Close)"
                        className="p-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs cursor-pointer transition-colors ml-1"
                    >
                        <FaTimes />
                    </button>
                </div>
            </div>

            {/* Stage */}
            <div
                className="relative flex-1 flex items-center justify-center overflow-hidden p-4 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
            >
                <img
                    src={activeSrc}
                    alt={activeAlt}
                    className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-100 ease-out shadow-2xl pointer-events-none rounded"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                />
            </div>
        </div>
    );
};

export default GlobalImageZoomModal;
