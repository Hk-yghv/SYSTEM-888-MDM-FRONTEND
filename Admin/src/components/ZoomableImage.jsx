import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FaSearchPlus, FaSearchMinus, FaExpand, FaRedo, FaUndo, FaTimes, FaDownload, FaSyncAlt } from 'react-icons/fa';

/**
 * ZoomableImage - Universal image component with interactive zoom bar (របាពង្រីកបង្រួម)
 * Allows inline zoom with slider & buttons, drag-to-pan, and full-screen lightbox zoom.
 */
const ZoomableImage = ({
    src,
    alt = '',
    className = '',
    style = {},
    showBarOnHover = true,
    allowInlineZoom = true,
    allowFullscreen = true,
    onClick,
    ...rest
}) => {
    const [inlineZoom, setInlineZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalZoom, setModalZoom] = useState(1);
    const [modalRotation, setModalRotation] = useState(0);
    const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
    const [isModalDragging, setIsModalDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const modalDragStart = useRef({ x: 0, y: 0 });
    const modalPanStart = useRef({ x: 0, y: 0 });

    if (!src) return null;

    // Reset inline pan when zoom resets to 1
    const handleInlineZoomChange = (newZoom) => {
        const clamped = Math.max(0.5, Math.min(3.5, Number(newZoom)));
        setInlineZoom(clamped);
        if (clamped <= 1) setPan({ x: 0, y: 0 });
    };

    // Inline drag-to-pan
    const handleMouseDown = (e) => {
        if (inlineZoom <= 1) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || inlineZoom <= 1) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Modal drag-to-pan
    const handleModalMouseDown = (e) => {
        setIsModalDragging(true);
        modalDragStart.current = { x: e.clientX, y: e.clientY };
        modalPanStart.current = { ...modalPan };
    };

    const handleModalMouseMove = (e) => {
        if (!isModalDragging) return;
        const dx = e.clientX - modalDragStart.current.x;
        const dy = e.clientY - modalDragStart.current.y;
        setModalPan({ x: modalPanStart.current.x + dx, y: modalPanStart.current.y + dy });
    };

    const handleModalMouseUp = () => setIsModalDragging(false);

    // Wheel zoom in modal
    const handleModalWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        setModalZoom((z) => Math.max(0.3, Math.min(5, Number((z + delta).toFixed(2)))));
    };

    return (
        <div
            className="group/img relative inline-block overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsDragging(false);
            }}
            style={{ touchAction: inlineZoom > 1 ? 'none' : 'auto' }}
        >
            {/* The Image */}
            <div
                className="overflow-hidden cursor-pointer"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={(e) => {
                    if (onClick) {
                        onClick(e);
                    } else if (allowFullscreen) {
                        setShowModal(true);
                        setModalZoom(1);
                        setModalPan({ x: 0, y: 0 });
                        setModalRotation(0);
                    }
                }}
            >
                <img
                    src={src}
                    alt={alt}
                    className={`${className} select-none transition-transform duration-100 ease-out`}
                    style={{
                        ...style,
                        transform: `scale(${inlineZoom}) translate(${pan.x / inlineZoom}px, ${pan.y / inlineZoom}px)`,
                        cursor: inlineZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                    }}
                    {...rest}
                />
            </div>

            {/* ── Zoom Bar Overlay (របាពង្រីកបង្រួម) ── */}
            {allowInlineZoom && (
                <div
                    className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all duration-200 pointer-events-auto ${
                        isHovered || inlineZoom !== 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    title="របាពង្រីកបង្រួមរូបភាព (Image Zoom Bar)"
                >
                    {/* Zoom Out Button */}
                    <button
                        type="button"
                        onClick={() => handleInlineZoomChange(inlineZoom - 0.25)}
                        title="បង្រួមតូច (Zoom Out)"
                        className="p-1 rounded-full hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer text-[10px]"
                    >
                        <FaSearchMinus />
                    </button>

                    {/* Zoom Range Slider Bar (របា) */}
                    <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.05"
                        value={inlineZoom}
                        onChange={(e) => handleInlineZoomChange(e.target.value)}
                        className="w-14 sm:w-20 h-1 accent-emerald-500 bg-white/20 rounded-lg cursor-pointer"
                        title={`កម្រិតពង្រីក: ${Math.round(inlineZoom * 100)}%`}
                    />

                    {/* Zoom In Button */}
                    <button
                        type="button"
                        onClick={() => handleInlineZoomChange(inlineZoom + 0.25)}
                        title="ពង្រីកធំ (Zoom In)"
                        className="p-1 rounded-full hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer text-[10px]"
                    >
                        <FaSearchPlus />
                    </button>

                    {/* Badge % */}
                    <span className="text-[10px] font-mono font-bold text-emerald-400 min-w-8 text-center select-none">
                        {Math.round(inlineZoom * 100)}%
                    </span>

                    {/* Reset Button (when zoomed) */}
                    {inlineZoom !== 1 && (
                        <button
                            type="button"
                            onClick={() => {
                                setInlineZoom(1);
                                setPan({ x: 0, y: 0 });
                            }}
                            title="កំណត់ឡើងវិញ (Reset)"
                            className="p-1 rounded-full hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer text-[9px]"
                        >
                            <FaSyncAlt />
                        </button>
                    )}

                    {/* Fullscreen Expand */}
                    {allowFullscreen && (
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(true);
                                setModalZoom(inlineZoom > 1 ? inlineZoom : 1);
                                setModalPan({ x: 0, y: 0 });
                                setModalRotation(0);
                            }}
                            title="ពង្រីកពេញផ្ទាំង (Fullscreen Preview)"
                            className="p-1 rounded-full hover:bg-emerald-600/60 text-slate-200 hover:text-white transition-colors cursor-pointer text-[10px]"
                        >
                            <FaExpand />
                        </button>
                    )}
                </div>
            )}

            {/* ── Fullscreen Zoom Lightbox Modal with Full Zoom Bar ── */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[9999999] flex flex-col bg-slate-950/92 backdrop-blur-md animate-in fade-in duration-150 select-none"
                    onClick={() => setShowModal(false)}
                >
                    {/* Top Control Bar with Full របាពង្រីកបង្រួម */}
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-white z-20 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Title / Info */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">របាពង្រីកបង្រួម / Zoom Controls</span>
                            {alt && <span className="text-xs text-slate-400 truncate max-w-xs">• {alt}</span>}
                        </div>

                        {/* Interactive Zoom Bar (របាពង្រីកបង្រួម) */}
                        <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700 shadow-inner">
                            {/* Zoom Out */}
                            <button
                                type="button"
                                onClick={() => setModalZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
                                title="បង្រួមតូច (-)"
                                className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 hover:text-white text-xs cursor-pointer transition-colors"
                            >
                                <FaSearchMinus />
                            </button>

                            {/* Range Slider Bar */}
                            <input
                                type="range"
                                min="0.25"
                                max="4.0"
                                step="0.05"
                                value={modalZoom}
                                onChange={(e) => setModalZoom(Number(e.target.value))}
                                className="w-24 sm:w-36 h-1.5 accent-emerald-500 bg-slate-700 rounded-lg cursor-pointer"
                                title={`Zoom: ${Math.round(modalZoom * 100)}%`}
                            />

                            {/* Zoom In */}
                            <button
                                type="button"
                                onClick={() => setModalZoom((z) => Math.min(4.0, Number((z + 0.25).toFixed(2))))}
                                title="ពង្រីកធំ (+)"
                                className="p-1.5 rounded-full hover:bg-slate-700 text-slate-200 hover:text-white text-xs cursor-pointer transition-colors"
                            >
                                <FaSearchPlus />
                            </button>

                            {/* % Badge */}
                            <span className="text-xs font-mono font-bold text-emerald-400 min-w-12 text-center">
                                {Math.round(modalZoom * 100)}%
                            </span>

                            {/* Preset Buttons */}
                            <button
                                type="button"
                                onClick={() => {
                                    setModalZoom(1);
                                    setModalPan({ x: 0, y: 0 });
                                }}
                                title="១០០% (100%)"
                                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                                    modalZoom === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                                }`}
                            >
                                100%
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalZoom(2)}
                                title="២០០% (200%)"
                                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                                    modalZoom === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                                }`}
                            >
                                200%
                            </button>
                        </div>

                        {/* Rotation & Actions */}
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setModalRotation((r) => r - 90)}
                                title="បង្វិលឆ្វេង -90°"
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                            >
                                <FaUndo />
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalRotation((r) => r + 90)}
                                title="បង្វិលស្តាំ +90°"
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                            >
                                <FaRedo />
                            </button>
                            <a
                                href={src}
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
                                onClick={() => setShowModal(false)}
                                title="បិទ (Close)"
                                className="p-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs cursor-pointer transition-colors ml-1"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    {/* Modal Image Stage */}
                    <div
                        className="relative flex-1 flex items-center justify-center overflow-hidden p-4 cursor-grab active:cursor-grabbing"
                        onMouseDown={handleModalMouseDown}
                        onMouseMove={handleModalMouseMove}
                        onMouseUp={handleModalMouseUp}
                        onWheel={handleModalWheel}
                    >
                        <img
                            src={src}
                            alt={alt}
                            className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-100 ease-out shadow-2xl pointer-events-none"
                            style={{
                                transform: `translate(${modalPan.x}px, ${modalPan.y}px) scale(${modalZoom}) rotate(${modalRotation}deg)`,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoomableImage;
