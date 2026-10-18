import { useEffect, useState, useRef } from 'react';
import { FaTimes, FaSearchPlus, FaSearchMinus, FaUndo, FaRedo, FaSyncAlt } from 'react-icons/fa';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const ImageGalleryModal = ({ images, index, onIndexChange, onClose, title = 'Image preview', subtitle }) => {
    if (!images?.length) return null;

    const currentIndex = Math.min(Math.max(index, 0), images.length - 1);
    const hasMultiple = images.length > 1;

    // Zoom & pan states
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });

    // Reset zoom & pan when switching images
    useEffect(() => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, [currentIndex]);

    // Keyboard navigation (Arrow keys & Escape)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.();
            } else if (e.key === 'ArrowLeft' && hasMultiple && currentIndex > 0) {
                onIndexChange(currentIndex - 1);
            } else if (e.key === 'ArrowRight' && hasMultiple && currentIndex < images.length - 1) {
                onIndexChange(currentIndex + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, hasMultiple, onClose, onIndexChange]);

    const handleZoomChange = (newZoom) => {
        const val = Math.max(0.3, Math.min(4.5, Number(Number(newZoom).toFixed(2))));
        setZoom(val);
        if (val <= 1) setPan({ x: 0, y: 0 });
    };

    // Drag to pan
    const handleMouseDown = (e) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || zoom <= 1) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Mouse wheel zoom
    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        handleZoomChange(zoom + delta);
    };

    return (
        <div
            className="fixed inset-0 z-[100000000] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 select-none"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex flex-col h-[94vh] w-[96vw] max-w-6xl overflow-hidden rounded-[10px] border border-slate-700 bg-slate-900 shadow-2xl text-white"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-2 bg-slate-950">
                    <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-black flex items-center gap-2">
                            <span className="truncate">{title}</span>
                            {hasMultiple && (
                                <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] sm:text-[11px] font-mono text-black font-semibold shrink-0">
                                    {currentIndex + 1} / {images.length}
                                </span>
                            )}
                        </div>
                        {subtitle && <div className="truncate text-[11px] text-slate-400">{subtitle}</div>}
                    </div>

                    {/* ── Interactive Zoom Bar (របាពង្រីកបង្រួម) ── */}
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 shadow-inner">
                        <button
                            type="button"
                            onClick={() => handleZoomChange(zoom - 0.25)}
                            title="បង្រួមតូច (-)"
                            className="p-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                        >
                            <FaSearchMinus />
                        </button>

                        {/* Range slider (របា) */}
                        <input
                            type="range"
                            min="0.3"
                            max="4.0"
                            step="0.05"
                            value={zoom}
                            onChange={(e) => handleZoomChange(e.target.value)}
                            className="w-16 sm:w-28 h-1.5 accent-emerald-500 bg-slate-700 rounded-lg cursor-pointer"
                            title={`កម្រិតពង្រីក: ${Math.round(zoom * 100)}%`}
                        />

                        <button
                            type="button"
                            onClick={() => handleZoomChange(zoom + 0.25)}
                            title="ពង្រីកធំ (+)"
                            className="p-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                        >
                            <FaSearchPlus />
                        </button>

                        <span className="text-xs font-mono font-bold text-emerald-400 min-w-10 text-center select-none">
                            {Math.round(zoom * 100)}%
                        </span>

                        <button
                            type="button"
                            onClick={() => {
                                setZoom(1);
                                setPan({ x: 0, y: 0 });
                                setRotation(0);
                            }}
                            title="កំណត់ឡើងវិញ (Reset)"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                        >
                            <FaSyncAlt />
                        </button>

                        <div className="h-3 w-[1px] bg-slate-700 mx-0.5" />

                        {/* Rotate */}
                        <button
                            type="button"
                            onClick={() => setRotation((r) => r - 90)}
                            title="បង្វិលឆ្វេង -90°"
                            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] cursor-pointer"
                        >
                            <FaUndo />
                        </button>
                        <button
                            type="button"
                            onClick={() => setRotation((r) => r + 90)}
                            title="បង្វិលស្តាំ +90°"
                            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] cursor-pointer"
                        >
                            <FaRedo />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close image viewer"
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Stage: Interactive Canvas Area */}
                <div
                    className="relative flex-1 min-h-0 overflow-hidden bg-slate-950 flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                    style={{ touchAction: zoom > 1 ? 'none' : 'auto' }}
                >
                    <div
                        className="transition-transform duration-100 ease-out"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        }}
                    >
                        <img
                            key={images[currentIndex]}
                            src={images[currentIndex]}
                            alt={`${title} ${currentIndex + 1}`}
                            className="block max-h-[82vh] max-w-[88vw] object-contain select-none shadow-2xl pointer-events-none rounded"
                        />
                    </div>

                    {/* Nav buttons */}
                    {hasMultiple && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-3 sm:px-4">
                            <div className="pointer-events-auto">
                                {currentIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onIndexChange(currentIndex - 1)}
                                        aria-label="Previous image"
                                        className="rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 p-2 sm:p-2.5 text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur"
                                    >
                                        <MdChevronLeft size={24} />
                                    </button>
                                )}
                            </div>
                            <div className="pointer-events-auto">
                                {currentIndex < images.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={() => onIndexChange(currentIndex + 1)}
                                        aria-label="Next image"
                                        className="rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 p-2 sm:p-2.5 text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur"
                                    >
                                        <MdChevronRight size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageGalleryModal;
