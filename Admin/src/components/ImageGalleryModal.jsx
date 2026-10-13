import { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const ImageGalleryModal = ({ images, index, onIndexChange, onClose, title = 'Image preview', subtitle }) => {
    if (!images?.length) return null;

    const currentIndex = Math.min(Math.max(index, 0), images.length - 1);
    const hasMultiple = images.length > 1;

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

    return (
        <div
            className="fixed inset-0 z-[100000000] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex flex-col max-h-[92vh] sm:max-h-[94vh] max-w-[94vw] sm:max-w-[88vw] md:max-w-[84vw] overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-2xl"
                onClick={event => event.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-1.5 sm:py-2 bg-white">
                    <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span className="truncate">{title}</span>
                            {hasMultiple && (
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-[3px] text-[10px] sm:text-[11px] font-mono text-slate-600 font-semibold shrink-0">
                                    {currentIndex + 1} / {images.length}
                                </span>
                            )}
                        </div>
                        {subtitle && <div className="truncate text-[11px] text-slate-500">{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close image viewer"
                        className="rounded-[4px] p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <FaTimes size={15} />
                    </button>
                </div>

                {/* Stage: overflow-hidden contains layout; inner div scrolls; buttons fixed */}
                <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-100/90">

                    {/* Scrollable image — no flex on scroll container so image can overflow and scroll */}
                    <div className="w-full h-full overflow-auto p-4 sm:p-6">
                        <div className="flex justify-center">
                            <img
                                key={images[currentIndex]}
                                src={images[currentIndex]}
                                alt={`${title} ${currentIndex + 1}`}
                                className="block max-w-full h-auto object-contain select-none transition-transform duration-150"
                            />
                        </div>
                    </div>

                    {/* Nav buttons — absolute on outer div, outside scroll area → stay fixed */}
                    {hasMultiple && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2.5 sm:px-3">
                            <div className="pointer-events-auto">
                                {currentIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onIndexChange(currentIndex - 1)}
                                        aria-label="Previous image"
                                        className="rounded-full bg-white/90 hover:bg-white p-2 sm:p-2.5 text-slate-700 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
                                        className="rounded-full bg-white/90 hover:bg-white p-2 sm:p-2.5 text-slate-700 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
