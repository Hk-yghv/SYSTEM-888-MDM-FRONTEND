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

                {/* Main Image Stage - Maximum visibility, scrollable if image overflows */}
                <div className="relative flex-1 min-h-0 bg-slate-100/90 overflow-hidden">
                    {/* Scrollable image container */}
                    <div className="w-full h-full overflow-auto p-2 sm:p-4 flex">
                        <img
                            key={images[currentIndex]}
                            src={images[currentIndex]}
                            alt={`${title} ${currentIndex + 1}`}
                            className="m-auto max-w-full max-h-full object-contain select-none transition-transform duration-150"
                        />
                    </div>

                    {/* Previous button */}
                    {hasMultiple && currentIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(currentIndex - 1)}
                            aria-label="Previous image"
                            className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 hover:bg-white p-2 sm:p-2.5 text-slate-700 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                            <MdChevronLeft size={24} />
                        </button>
                    )}

                    {/* Next button */}
                    {hasMultiple && currentIndex < images.length - 1 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(currentIndex + 1)}
                            aria-label="Next image"
                            className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 hover:bg-white p-2 sm:p-2.5 text-slate-700 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                            <MdChevronRight size={24} />
                        </button>
                    )}
                </div>

                {/* Compact Thumbnail Strip for 2+ Images - Exactly 15px gap to divider border */}
                {hasMultiple && (
                    <div className="shrink-0 flex justify-center items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 pt-[15px] pb-[15px] max-w-full">
                        {images.map((image, imageIndex) => (
                            <button
                                key={`${image}-${imageIndex}`}
                                type="button"
                                onClick={() => onIndexChange(imageIndex)}
                                aria-label={`Show image ${imageIndex + 1}`}
                                aria-current={imageIndex === currentIndex ? 'true' : undefined}
                                className={`h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-[5px] border-2 transition-all cursor-pointer ${
                                    imageIndex === currentIndex
                                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-105 shadow-xs'
                                        : 'border-slate-300 hover:border-indigo-400 opacity-70 hover:opacity-100'
                                }`}
                            >
                                <img src={image} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGalleryModal;
