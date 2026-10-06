import { FaTimes } from 'react-icons/fa';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const ImageGalleryModal = ({ images, index, onIndexChange, onClose, title = 'Image preview', subtitle }) => {
    if (!images?.length) return null;

    const currentIndex = Math.min(Math.max(index, 0), images.length - 1);

    return (
        <div
            className="fixed inset-0 z-[100000000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="max-w-[84vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-700">
                            {title}
                            {images.length > 1 && <span className="ml-2 text-xs text-slate-500">{currentIndex + 1} / {images.length}</span>}
                        </div>
                        {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close image viewer"
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="relative flex items-center justify-center bg-slate-100 p-2">
                    {images.length > 1 && currentIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(currentIndex - 1)}
                            aria-label="Previous image"
                            className="absolute left-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-md hover:bg-white"
                        >
                            <MdChevronLeft size={22} />
                        </button>
                    )}
                    <img
                        key={images[currentIndex]}
                        src={images[currentIndex]}
                        alt={`${title} ${currentIndex + 1}`}
                        className="block max-h-[65vh] max-w-[80vw] object-contain"
                    />
                    {images.length > 1 && currentIndex < images.length - 1 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(currentIndex + 1)}
                            aria-label="Next image"
                            className="absolute right-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-md hover:bg-white"
                        >
                            <MdChevronRight size={22} />
                        </button>
                    )}
                </div>

                {images.length > 1 && (
                    <div className="flex max-w-[82vw] justify-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 p-2">
                        {images.map((image, imageIndex) => (
                            <button
                                key={`${image}-${imageIndex}`}
                                type="button"
                                onClick={() => onIndexChange(imageIndex)}
                                aria-label={`Show image ${imageIndex + 1}`}
                                aria-current={imageIndex === currentIndex ? 'true' : undefined}
                                className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
                                    imageIndex === currentIndex ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-300'
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
