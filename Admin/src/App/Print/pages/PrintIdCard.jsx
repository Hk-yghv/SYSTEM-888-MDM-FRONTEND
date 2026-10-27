import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext';
import {
    FaPrint,
    FaIdCard,
    FaCloudUploadAlt,
    FaTrashAlt,
    FaRedo,
    FaSlidersH,
    FaCheck,
    FaPaste,
    FaFileImage,
    FaUndoAlt,
    FaPlus,
    FaMinus,
    FaExclamationTriangle,
    FaTimes,
    FaInfoCircle,
    FaCopy,
    FaEdit,
    FaCropAlt,
    FaFont,
    FaSquare
} from 'react-icons/fa';

const PrintIdCard = () => {
    const { t, lang } = useLanguage();

    // Image state
    const [imageSrc, setImageSrc] = useState(null);
    const [imageName, setImageName] = useState('');
    const [imageSize, setImageSize] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Layout configuration (Default: 100px from top, 200px from left and right)
    const [topMargin, setTopMargin] = useState(100);
    const [sideMargin, setSideMargin] = useState(200);
    const [rotation, setRotation] = useState(0);
    const [scalePercent, setScalePercent] = useState(100);
    const [showBorder, setShowBorder] = useState(false);
    const [showAdjustments, setShowAdjustments] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [isCropMode, setIsCropMode] = useState(false);
    const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [shadow, setShadow] = useState(0);
    const [annotations, setAnnotations] = useState([]);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
    const [pasteSuccess, setPasteSuccess] = useState(false);

    // Number of print copies (ចំនួនសន្លឹកព្រីន)
    const [copies, setCopies] = useState(1);

    // Custom UI Alert Modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [warningModalMessage, setWarningModalMessage] = useState('');
    const [showKioskTip, setShowKioskTip] = useState(false);

    const fileInputRef = useRef(null);
    const dropzoneRef = useRef(null);
    const cropImageFrameRef = useRef(null);
    const activeCropSideRef = useRef(null);

    useEffect(() => {
        if (!showConfirmModal) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showConfirmModal]);

    // Process a loaded file
    const processFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) {
            setWarningModalMessage('សូមជ្រើសរើសឯកសារជារូបភាព (PNG, JPG, WEBP...)');
            return;
        }

        setImageName(file.name || 'Pasted_ID_Card.png');
        setImageSize((file.size / 1024).toFixed(1) + ' KB');

        const reader = new FileReader();
        reader.onload = (e) => {
            setImageSrc(e.target.result);
            setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
            setIsCropMode(false);
            setBrightness(100);
            setContrast(100);
            setShadow(0);
            setAnnotations([]);
            setSelectedAnnotationId(null);
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 2500);
        };
        reader.readAsDataURL(file);
    }, []);

    // Drag & Drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };

    // File input change
    const handleFileInputChange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };

    // Paste handler (Ctrl + V) from clipboard
    useEffect(() => {
        const handleGlobalPaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        processFile(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [processFile]);

    // Complete Reset (សម្អាតរូបចេញ និង កំណត់ឡើងវិញទាំងអស់)
    const handleResetAll = () => {
        setImageSrc(null);
        setImageName('');
        setImageSize(null);
        setTopMargin(100);
        setSideMargin(200);
        setRotation(0);
        setScalePercent(100);
        setCopies(1);
        setShowBorder(false);
        setIsCropMode(false);
        setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
        setBrightness(100);
        setContrast(100);
        setShadow(0);
        setAnnotations([]);
        setSelectedAnnotationId(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const addAnnotation = (type) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setAnnotations(current => [
            ...current,
            {
                id,
                type,
                text: type === 'text' ? 'អត្ថបទ' : '',
                color: '#ef4444',
                x: 10,
                y: 10,
                width: 25,
                height: 20,
                fontSize: 18
            }
        ]);
        setSelectedAnnotationId(id);
    };

    const updateSelectedAnnotation = (field, value) => {
        setAnnotations(current => current.map(annotation => (
            annotation.id === selectedAnnotationId
                ? { ...annotation, [field]: value }
                : annotation
        )));
    };

    const updateCropFromPointer = (side, event) => {
        const frame = cropImageFrameRef.current;
        if (!frame) return;

        const bounds = frame.getBoundingClientRect();
        const radians = rotation * Math.PI / 180;
        const deltaX = event.clientX - (bounds.left + bounds.width / 2);
        const deltaY = event.clientY - (bounds.top + bounds.height / 2);
        const scale = scalePercent / 100 || 1;
        const localX = (deltaX * Math.cos(radians) + deltaY * Math.sin(radians)) / scale + frame.clientWidth / 2;
        const localY = (-deltaX * Math.sin(radians) + deltaY * Math.cos(radians)) / scale + frame.clientHeight / 2;
        const value = side === 'top'
            ? localY / frame.clientHeight * 100
            : side === 'bottom'
                ? (1 - localY / frame.clientHeight) * 100
                : side === 'left'
                    ? localX / frame.clientWidth * 100
                    : (1 - localX / frame.clientWidth) * 100;

        setCrop(current => ({
            ...current,
            [side]: Math.max(0, Math.min(35, 100 - current[side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left'] - 1, value))
        }));
    };

    const changeRotation = (amount) => {
        setRotation(current => Math.max(-180, Math.min(180, current + amount)));
    };

    const rotateBy90 = () => {
        setRotation(current => {
            const next = (current + 90) % 360;
            return next > 180 ? next - 360 : next;
        });
    };

    const renderCropHandle = (side, className, label) => (
        <button
            key={side}
            type="button"
            role="slider"
            aria-label={label}
            aria-orientation={side === 'top' || side === 'bottom' ? 'horizontal' : 'vertical'}
            aria-valuemin={0}
            aria-valuemax={Math.min(35, 99 - crop[side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left'])}
            aria-valuenow={crop[side]}
            tabIndex={0}
            className={`absolute z-10 touch-none bg-transparent ${className}`}
            style={side === 'top'
                ? { left: `${crop.left}%`, right: `${crop.right}%`, top: `calc(${crop.top}% - 6px)` }
                : side === 'bottom'
                    ? { left: `${crop.left}%`, right: `${crop.right}%`, bottom: `calc(${crop.bottom}% - 6px)` }
                    : side === 'left'
                        ? { top: `${crop.top}%`, bottom: `${crop.bottom}%`, left: `calc(${crop.left}% - 6px)` }
                        : { top: `${crop.top}%`, bottom: `${crop.bottom}%`, right: `calc(${crop.right}% - 6px)` }}
            onPointerDown={(event) => {
                event.preventDefault();
                activeCropSideRef.current = side;
                event.currentTarget.setPointerCapture(event.pointerId);
                updateCropFromPointer(side, event);
            }}
            onPointerMove={(event) => {
                if (activeCropSideRef.current === side) updateCropFromPointer(side, event);
            }}
            onPointerUp={() => {
                activeCropSideRef.current = null;
            }}
            onPointerCancel={() => {
                activeCropSideRef.current = null;
            }}
            onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const change = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
                setCrop(current => ({
                    ...current,
                    [side]: Math.max(0, Math.min(35, 100 - current[side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left'] - 1, current[side] + change))
                }));
            }}
        />
    );

    const renderAnnotations = () => annotations.map(annotation => (
        annotation.type === 'box' ? (
            <div
                key={annotation.id}
                style={{
                    position: 'absolute',
                    left: `${annotation.x}%`,
                    top: `${annotation.y}%`,
                    width: `${annotation.width}%`,
                    height: `${annotation.height}%`,
                    border: `2px solid ${annotation.color}`,
                    boxSizing: 'border-box',
                    pointerEvents: 'none'
                }}
            />
        ) : (
            <div
                key={annotation.id}
                style={{
                    position: 'absolute',
                    left: `${annotation.x}%`,
                    top: `${annotation.y}%`,
                    color: annotation.color,
                    fontSize: `${annotation.fontSize}px`,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.7)',
                    whiteSpace: 'pre-wrap',
                    pointerEvents: 'none'
                }}
            >
                {annotation.text}
            </div>
        )
    ));

    // When clicking Print button -> Show custom Alert UI confirmation
    const handleInitiatePrint = () => {
        if (!imageSrc) {
            setWarningModalMessage('សូមបញ្ចូល ឬ បិទភ្ជាប់រូបភាពកាតសម្គាល់ខ្លួនជាមុនសិន មុនពេលព្រីន!');
            return;
        }
        setShowConfirmModal(true);
    };

    // Confirm print action
    const handleExecutePrint = () => {
        setShowConfirmModal(false);
        // Small delay to allow modal close animation before opening print view
        setTimeout(() => {
            window.print();
        }, 120);
    };

    return (
        <div className="min-h-full flex flex-col bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] print:p-0">
            {/* Embedded Print CSS Rules */}
            <style>
                {`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0mm;
                    }
                    html, body {
                        width: 210mm !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .no-print, header, aside, nav, .mobile-sidebar, .mobile-bottom-nav, #floating-display-uplist {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    #print-a4-sheet, #print-a4-sheet * {
                        visibility: visible !important;
                    }
                    #print-a4-sheet {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: #ffffff !important;
                    }
                    .printable-page {
                        display: block !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        max-height: 297mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        background: #ffffff !important;
                        box-sizing: border-box !important;
                        position: relative !important;
                        overflow: hidden !important;
                    }
                    .printable-page:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .printable-card-wrapper {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        box-sizing: border-box !important;
                    }
                }
                `}
            </style>

            {/* Top Header & Action Bar (Hidden in Print) */}
            <div className="no-print bg-white border-b border-slate-200 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-2xs">
                        <FaIdCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span>{t('printIdCard') || 'Print id card'}</span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                                A4 Portrait
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            គម្លាតពីលើ {topMargin}px | គម្លាតសងខាង {sideMargin}px | ចំនួន {copies} សន្លឹក
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Copies Counter (ចំនួនសន្លឹកព្រីន) */}
                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                        <span className="text-[11px] font-semibold text-slate-600 px-2 select-none">
                            ចំនួនសន្លឹក:
                        </span>
                        <button
                            type="button"
                            onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-700 rounded-md transition-all active:scale-95 cursor-pointer shadow-2xs"
                            title={t('printDecreaseCopies', lang === 'km' ? 'បន្ថយចំនួនសន្លឹកមួយ' : 'Decrease copies by one')}
                        >
                            <FaMinus size={10} />
                        </button>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={copies}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setCopies(isNaN(val) || val < 1 ? 1 : Math.min(val, 50));
                            }}
                            className="w-10 text-center font-bold text-xs text-emerald-700 bg-transparent outline-none py-1"
                        />
                        <button
                            type="button"
                            onClick={() => setCopies((prev) => Math.min(50, prev + 1))}
                            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-700 rounded-md transition-all active:scale-95 cursor-pointer shadow-2xs"
                            title={t('printIncreaseCopies', lang === 'km' ? 'បន្ថែមចំនួនសន្លឹកមួយ' : 'Increase copies by one')}
                        >
                            <FaPlus size={10} />
                        </button>
                    </div>

                    {/* Reset Button (កំណត់ឡើងវិញ / សម្អាតរូបភាព) */}
                    <button
                        type="button"
                        onClick={handleResetAll}
                        className="h-[38px] px-3.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title={t('printClearAll', lang === 'km' ? 'សម្អាតរូបភាព និងកំណត់ឡើងវិញទាំងអស់' : 'Clear image and reset all settings')}
                    >
                        <FaUndoAlt size={12} className="text-rose-600" />
                        <span>{t('printResetSettings', lang === 'km' ? 'កំណត់ឡើងវិញ' : 'Reset settings')}</span>
                    </button>

                    {/* Adjust Margins Button */}
                    <button
                        type="button"
                        onClick={() => setShowAdjustments(!showAdjustments)}
                        className={`h-[38px] px-3.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${showAdjustments
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                        title={t('printAdjustMargins', lang === 'km' ? 'កំណត់គម្លាតបន្ថែម' : 'Adjust margins')}
                    >
                        <FaSlidersH size={13} className="text-emerald-600" />
                        <span>{t('printMargins', lang === 'km' ? 'គម្លាត' : 'Margins')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowEditor(open => !open)}
                        disabled={!imageSrc}
                        aria-expanded={showEditor}
                        className={`h-[38px] px-3.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${showEditor
                            ? 'bg-violet-50 border-violet-300 text-violet-700 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                    >
                        <FaEdit size={13} className="text-violet-600" />
                        <span>កែរូបភាព</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCropMode(open => !open)}
                        disabled={!imageSrc}
                        aria-pressed={isCropMode}
                        className={`h-[38px] px-3.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isCropMode
                            ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                        title={isCropMode ? 'ចុចដើម្បីបិទការកាត់រូប' : 'ចុចដើម្បីទាញគែមកាត់រូប'}
                    >
                        <FaCropAlt size={13} className="text-amber-600" />
                        <span>{isCropMode ? 'បិទការកាត់' : 'កាត់រូប'}</span>
                    </button>

                    {/* Print Button (Opens Custom Alert UI Confirmation) */}
                    <button
                        type="button"
                        onClick={handleInitiatePrint}
                        className={`h-[38px] px-5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 ${imageSrc
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 border border-emerald-500'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                            }`}
                        title={imageSrc ? t('printCopiesTitle', lang === 'km' ? `ចុចព្រីនចំនួន ${copies} សន្លឹក` : `Print ${copies} copies`) : t('printImageRequired', lang === 'km' ? 'សូមបញ្ចូលរូបភាពជាមុនសិន' : 'Please add an image first')}
                    >
                        <FaPrint size={14} />
                        <span>{t('printNow') || 'ចុចព្រីន'} ({copies})</span>
                    </button>
                </div>
            </div>

            {/* Paste Success Flash Toast */}
            {pasteSuccess && (
                <div className="no-print bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 shadow-md">
                    <FaCheck size={13} />
                    <span>{t('printClipboardPasteSuccess', lang === 'km' ? 'បានបិទភ្ជាប់រូបភាពដោយជោគជ័យពី Clipboard!' : 'Image pasted from clipboard successfully!')}</span>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
                {/* 1. Upload & Dropzone Section (Hidden in print) */}
                <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <h2 className="text-sm font-bold text-slate-800">
                                {t('uploadOrPasteIdCard') || 'បញ្ចូល ឬ បិទភ្ជាប់រូបភាពកាត (Drag & Drop / Copy & Paste)'}
                            </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                                <FaPaste size={11} className="text-amber-600" />
                                {t('printCanPasteShortcut', lang === 'km' ? 'អាចចុច' : 'Press')} <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300 font-bold">Ctrl + V</kbd> {t('printToPaste', lang === 'km' ? 'ដើម្បីបិទភ្ជាប់' : 'to paste')}
                            </span>

                            <button
                                type="button"
                                onClick={() => setShowKioskTip(!showKioskTip)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-medium hover:bg-sky-100 cursor-pointer"
                                title={t('printKioskModeInfo', lang === 'km' ? 'ព័ត៌មានអំពីការព្រីនស្វ័យប្រវត្តិកុំឱ្យចេញផ្ទាំង Browser' : 'Information about kiosk printing without the browser dialog')}
                            >
                                <FaInfoCircle size={11} className="text-sky-600" />
                                <span>{t('printKioskModeButton', lang === 'km' ? 'ព្រីនភ្លាមៗ' : 'Print instantly')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Kiosk Mode Tip Box */}
                    {showKioskTip && (
                        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 space-y-1.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between font-bold">
                                <span>💡 {t('printKioskModeHeading', lang === 'km' ? 'របៀបព្រីនភ្លាមៗដោយមិនចាំបាច់ឆ្លងកាត់ផ្ទាំង Browser:' : 'How to print instantly without the browser dialog:')}</span>
                                <button type="button" onClick={() => setShowKioskTip(false)} className="text-sky-600 hover:text-sky-800">
                                    <FaTimes size={12} />
                                </button>
                            </div>
                            <p className="text-[11px] text-sky-800">
                                {t('printKioskModeInstructions', lang === 'km' ? 'កម្មវិធីរុករកដូចជា Google Chrome និង Microsoft Edge ទាមទារឱ្យបង្ហាញផ្ទាំង Print Preview។ បើអ្នកចង់ឱ្យការចុចព្រីនបញ្ជូនទៅម៉ាស៊ីនព្រីនភ្លាមៗ អ្នកអាចបើក Chrome ដោយបន្ថែម parameter នេះទៅ Shortcut របស់ Chrome:' : 'Browsers such as Google Chrome and Microsoft Edge require a Print Preview dialog. To send print jobs directly to the printer, add this parameter to the Chrome shortcut:')}
                            </p>
                            <code className="block bg-white p-2 rounded border border-sky-300 font-mono text-[11px] select-all font-bold text-sky-700">
                                chrome.exe --kiosk-printing
                            </code>
                            <p className="text-[10px] text-sky-600">
                                {t('printKioskModeResult', lang === 'km' ? 'នៅពេលប្រើរបៀបនេះ ការចុច "ព្រីនឥឡូវនេះ" នឹងបោះពុម្ពផ្ទាល់ទៅម៉ាស៊ីនព្រីន ដោយមិនបង្ហាញផ្ទាំងរំខានឡើយ!' : 'With this mode enabled, clicking "Print now" sends the job directly to the printer without another dialog.')}
                            </p>
                        </div>
                    )}

                    {/* Drag and Drop Box */}
                    <div
                        ref={dropzoneRef}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center group ${isDragging
                            ? 'border-emerald-500 bg-emerald-50/80 scale-[1.008] shadow-md'
                            : imageSrc
                                ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40'
                                : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60 hover:bg-slate-50'
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />

                        {imageSrc ? (
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg mx-auto bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
                                <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                                    <img
                                        src={imageSrc}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={imageName}>
                                        {imageName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {t('fileSize', lang === 'km' ? 'ទំហំ' : 'Size')}: {imageSize || 'N/A'} • {t('printCopies', lang === 'km' ? 'ចំនួនព្រីន' : 'Copies')}: <strong className="text-emerald-700">{copies} {t('sheets', lang === 'km' ? 'សន្លឹក' : 'sheets')}</strong>
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            {t('printReady', lang === 'km' ? 'រួចរាល់សម្រាប់ព្រីន' : 'Ready to print')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                                    >
                                        {t('changeImage', lang === 'km' ? 'ប្តូររូប' : 'Change image')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleResetAll();
                                        }}
                                        className="px-2.5 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors border border-rose-200"
                                        title={t('printRemoveImage', lang === 'km' ? 'សម្អាតរូបភាពចេញ' : 'Remove image')}
                                    >
                                        <FaTrashAlt size={11} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-100 transition-all shadow-2xs border border-emerald-100">
                                    <FaCloudUploadAlt size={28} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">
                                    {t('dragDropOrPaste') || 'ទាញរូបភាពទម្លាក់ទីនេះ ឬ ចុច Ctrl+V ដើម្បីបិទភ្ជាប់រូប (Paste)'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {t('printSupportedImageTypes', lang === 'km' ? 'គាំទ្រឯកសារ PNG, JPG, JPEG, WEBP ឬរូបភាពដែលបាន Copy ពី Snipping Tool' : 'Supports PNG, JPG, JPEG, WEBP, or images copied from Snipping Tool')}
                                </p>
                                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-xs hover:bg-emerald-700 transition-colors">
                                    <FaFileImage size={13} />
                                    <span>{t('browseImage') || 'ជ្រើសរើសរូបភាពពីកុំព្យូទ័រ'}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Expandable Margin & Image Adjustment Controls */}
                    {showAdjustments && (
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-xs">
                            {/* Top Margin Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between font-semibold text-slate-700">
                                    <span>{t('printTopMargin', lang === 'km' ? 'គម្លាតពីលើ:' : 'Top margin:')}</span>
                                    <span className="font-mono text-emerald-700 font-bold">{topMargin}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="300"
                                    step="5"
                                    value={topMargin}
                                    onChange={(e) => setTopMargin(Number(e.target.value))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <p className="text-[10px] text-slate-400">{t('printStandardValue', lang === 'km' ? 'តាមស្តង់ដារ:' : 'Standard:')} 100px</p>
                            </div>

                            {/* Left/Right Margin Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between font-semibold text-slate-700">
                                    <span>{t('printSideMargins', lang === 'km' ? 'គម្លាតសងខាង' : 'Side margins')}:</span>
                                    <span className="font-mono text-emerald-700 font-bold">{sideMargin}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="300"
                                    step="5"
                                    value={sideMargin}
                                    onChange={(e) => setSideMargin(Number(e.target.value))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <p className="text-[10px] text-slate-400">{t('printStandardValue', lang === 'km' ? 'តាមស្តង់ដារ:' : 'Standard:')} 200px</p>
                            </div>

                            {/* Image Scale Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between font-semibold text-slate-700">
                                    <span>{t('printImageScale', lang === 'km' ? 'ទំហំរូបភាព (Scale):' : 'Image scale:')}</span>
                                    <span className="font-mono text-emerald-700 font-bold">{scalePercent}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="150"
                                    step="5"
                                    value={scalePercent}
                                    onChange={(e) => setScalePercent(Number(e.target.value))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                                <p className="text-[10px] text-slate-400">{t('printOriginalSize', lang === 'km' ? 'ទំហំដើម:' : 'Original size:')} 100%</p>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex flex-col justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={rotateBy90}
                                        className="flex-1 h-[32px] px-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <FaRedo size={11} className="text-emerald-600" />
                                        <span>{t('printRotate90', lang === 'km' ? 'បង្វិល 90°' : 'Rotate 90°')} ({rotation}°)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowBorder(!showBorder)}
                                        className={`h-[32px] px-2.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${showBorder
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                            : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                        title={t('printShowBorder', lang === 'km' ? 'បង្ហាញបន្ទាត់គែម' : 'Show border')}
                                    >
                                        <span>{t('printCropBorder', lang === 'km' ? 'បន្ទាត់កាត់' : 'Crop border')}</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTopMargin(100);
                                        setSideMargin(200);
                                        setRotation(0);
                                        setScalePercent(100);
                                        setShowBorder(false);
                                    }}
                                    className="w-full h-[32px] rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
                                >
                                    {t('printResetToDefaults', lang === 'km' ? 'កំណត់តាមលំនាំដើម (100px & 200px)' : 'Reset to defaults (100px & 200px)')}
                                </button>
                            </div>
                        </div>
                    )}

                    {showEditor && imageSrc && (
                        <div className="border border-violet-200 bg-violet-50/50 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                                <h3 className="text-sm font-bold text-slate-800">កែរូបភាព ID Card</h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
                                        setIsCropMode(false);
                                        setRotation(0);
                                        setBrightness(100);
                                        setContrast(100);
                                        setShadow(0);
                                        setAnnotations([]);
                                        setSelectedAnnotationId(null);
                                    }}
                                    className="text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                                >
                                    កំណត់ឡើងវិញ
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries({
                                    top: 'កាត់ពីលើ',
                                    right: 'កាត់ពីស្តាំ',
                                    bottom: 'កាត់ពីក្រោម',
                                    left: 'កាត់ពីឆ្វេង'
                                }).map(([side, label]) => (
                                    <label key={side} className="space-y-1 block">
                                        <span className="flex justify-between text-[11px] font-semibold text-slate-700">
                                            <span>{label}</span>
                                            <span className="font-mono text-violet-700">{crop[side]}%</span>
                                        </span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="35"
                                            step="1"
                                            value={crop[side]}
                                            onChange={(event) => {
                                                const oppositeSide = side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
                                                setCrop(current => ({
                                                    ...current,
                                                    [side]: Math.min(Number(event.target.value), 99 - current[oppositeSide])
                                                }));
                                            }}
                                            className="w-full accent-violet-600"
                                        />
                                    </label>
                                ))}
                                <label className="space-y-1 block">
                                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
                                        <span>បង្វិលរូបភាព</span>
                                        <span className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => changeRotation(-1)}
                                                aria-label="បង្វិលថយក្រោយ ១ ដឺក្រេ"
                                                className="w-7 h-7 rounded border border-violet-200 bg-white text-violet-700 hover:bg-violet-100"
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                min="-180"
                                                max="180"
                                                step="0.1"
                                                value={rotation}
                                                aria-label="មុំបង្វិលជាដឺក្រេ"
                                                onChange={(event) => {
                                                    const value = event.target.valueAsNumber;
                                                    if (Number.isFinite(value)) setRotation(Math.max(-180, Math.min(180, value)));
                                                }}
                                                className="w-16 h-7 rounded border border-violet-200 bg-white px-1 text-center font-mono text-violet-700"
                                            />
                                            <span className="font-mono text-violet-700">°</span>
                                            <button
                                                type="button"
                                                onClick={() => changeRotation(1)}
                                                aria-label="បង្វិលទៅមុខ ១ ដឺក្រេ"
                                                className="w-7 h-7 rounded border border-violet-200 bg-white text-violet-700 hover:bg-violet-100"
                                            >
                                                +
                                            </button>
                                        </span>
                                    </span>
                                    <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="0.1"
                                        value={rotation}
                                        onChange={(event) => setRotation(Number(event.target.value))}
                                        className="w-full accent-violet-600"
                                    />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="flex justify-between text-[11px] font-semibold text-slate-700">
                                        <span>ពន្លឺ</span>
                                        <span className="font-mono text-violet-700">{brightness}%</span>
                                    </span>
                                    <input
                                        type="range"
                                        min="40"
                                        max="200"
                                        step="1"
                                        value={brightness}
                                        onChange={(event) => setBrightness(Number(event.target.value))}
                                        className="w-full accent-violet-600"
                                    />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="flex justify-between text-[11px] font-semibold text-slate-700">
                                        <span>កម្រិតពណ៌/Contrast</span>
                                        <span className="font-mono text-violet-700">{contrast}%</span>
                                    </span>
                                    <input
                                        type="range"
                                        min="50"
                                        max="200"
                                        step="1"
                                        value={contrast}
                                        onChange={(event) => setContrast(Number(event.target.value))}
                                        className="w-full accent-violet-600"
                                    />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="flex justify-between text-[11px] font-semibold text-slate-700">
                                        <span>ស្រមោល</span>
                                        <span className="font-mono text-violet-700">{shadow}px</span>
                                    </span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="30"
                                        step="1"
                                        value={shadow}
                                        onChange={(event) => setShadow(Number(event.target.value))}
                                        className="w-full accent-violet-600"
                                    />
                                </label>
                            </div>

                            <div className="border-t border-violet-100 pt-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 mr-1">បន្ថែមលើរូប៖</span>
                                    <button
                                        type="button"
                                        onClick={() => addAnnotation('text')}
                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                                    >
                                        <FaFont className="text-violet-600" /> បន្ថែមអក្សរ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => addAnnotation('box')}
                                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                                    >
                                        <FaSquare className="text-violet-600" /> បន្ថែមប្រអប់
                                    </button>
                                </div>

                                {annotations.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {annotations.map((annotation, index) => (
                                            <button
                                                key={annotation.id}
                                                type="button"
                                                onClick={() => setSelectedAnnotationId(annotation.id)}
                                                className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${
                                                    annotation.id === selectedAnnotationId
                                                        ? 'bg-violet-100 border-violet-300 text-violet-800'
                                                        : 'bg-white border-slate-200 text-slate-600'
                                                }`}
                                            >
                                                {annotation.type === 'text' ? 'អក្សរ' : 'ប្រអប់'} {index + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {annotations.find(annotation => annotation.id === selectedAnnotationId) && (() => {
                                    const selectedAnnotation = annotations.find(annotation => annotation.id === selectedAnnotationId);
                                    return (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-lg p-3">
                                            {selectedAnnotation.type === 'text' && (
                                                <>
                                                    <label className="space-y-1 sm:col-span-2">
                                                        <span className="block text-[10px] font-semibold text-slate-600">អត្ថបទ</span>
                                                        <input
                                                            type="text"
                                                            value={selectedAnnotation.text}
                                                            onChange={(event) => updateSelectedAnnotation('text', event.target.value)}
                                                            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                                                        />
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="block text-[10px] font-semibold text-slate-600">ទំហំអក្សរ</span>
                                                        <input
                                                            type="number"
                                                            min="8"
                                                            max="72"
                                                            value={selectedAnnotation.fontSize}
                                                            onChange={(event) => updateSelectedAnnotation('fontSize', Math.min(72, Math.max(8, Number(event.target.value) || 8)))}
                                                            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                                                        />
                                                    </label>
                                                </>
                                            )}
                                            <label className="space-y-1">
                                                <span className="block text-[10px] font-semibold text-slate-600">ពណ៌</span>
                                                <input
                                                    type="color"
                                                    value={selectedAnnotation.color}
                                                    onChange={(event) => updateSelectedAnnotation('color', event.target.value)}
                                                    className="h-8 w-full rounded border border-slate-200 bg-white"
                                                />
                                            </label>
                                            <label className="space-y-1">
                                                <span className="flex justify-between text-[10px] font-semibold text-slate-600"><span>ទីតាំង X</span><span>{selectedAnnotation.x}%</span></span>
                                                <input type="range" min="0" max="95" value={selectedAnnotation.x} onChange={(event) => updateSelectedAnnotation('x', Number(event.target.value))} className="w-full accent-violet-600" />
                                            </label>
                                            <label className="space-y-1">
                                                <span className="flex justify-between text-[10px] font-semibold text-slate-600"><span>ទីតាំង Y</span><span>{selectedAnnotation.y}%</span></span>
                                                <input type="range" min="0" max="95" value={selectedAnnotation.y} onChange={(event) => updateSelectedAnnotation('y', Number(event.target.value))} className="w-full accent-violet-600" />
                                            </label>
                                            {selectedAnnotation.type === 'box' && (
                                                <>
                                                    <label className="space-y-1">
                                                        <span className="flex justify-between text-[10px] font-semibold text-slate-600"><span>ទទឹង</span><span>{selectedAnnotation.width}%</span></span>
                                                        <input type="range" min="5" max="80" value={selectedAnnotation.width} onChange={(event) => updateSelectedAnnotation('width', Number(event.target.value))} className="w-full accent-violet-600" />
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="flex justify-between text-[10px] font-semibold text-slate-600"><span>កម្ពស់</span><span>{selectedAnnotation.height}%</span></span>
                                                        <input type="range" min="5" max="80" value={selectedAnnotation.height} onChange={(event) => updateSelectedAnnotation('height', Number(event.target.value))} className="w-full accent-violet-600" />
                                                    </label>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAnnotations(current => current.filter(item => item.id !== selectedAnnotationId));
                                                    setSelectedAnnotationId(null);
                                                }}
                                                className="self-end px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold"
                                            >
                                                លុបធាតុនេះ
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Review Section Below (A4 Preview) */}
                <div className="space-y-3">
                    <div className="no-print flex flex-wrap items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span>{t('previewA4') || 'ទម្រង់មើលជាមុនលើក្រដាស A4 (A4 Portrait Paper Preview)'}</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 font-mono text-[11px] text-emerald-800 font-bold border border-emerald-200">
                                {t('printCopies', lang === 'km' ? 'ចំនួនព្រីន' : 'Copies')}: {copies} {t('sheets', lang === 'km' ? 'សន្លឹក' : 'sheets')}
                            </span>
                            <span className="hidden sm:inline text-slate-400">•</span>
                            <span className="hidden sm:inline">
                                {t('printTopMargin', lang === 'km' ? 'គម្លាតពីលើ:' : 'Top margin:')} <strong className="text-slate-700">{topMargin}px</strong>
                            </span>
                            <span className="hidden sm:inline text-slate-400">•</span>
                            <span className="hidden sm:inline">
                                {t('printSideMargins', lang === 'km' ? 'គម្លាតសងខាង' : 'Side margins')}: <strong className="text-slate-700">{sideMargin}px</strong>
                            </span>
                        </div>
                    </div>

                    {/* Realistic A4 Canvas Workspace */}
                    <div className="no-print w-full bg-slate-200/70 rounded-2xl p-4 sm:p-8 flex justify-center items-start overflow-x-auto border border-slate-300/80 shadow-inner min-h-[500px]">
                        <div
                            style={{
                                width: '794px', // 210mm in CSS px at 96 DPI
                                minHeight: '1123px', // 297mm in CSS px at 96 DPI
                                height: '1123px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 15px 40px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                boxSizing: 'border-box'
                            }}
                            className="transition-all duration-300 rounded-[2px]"
                        >
                            <div className="absolute top-2 right-3 text-[10px] text-slate-300 font-mono select-none pointer-events-none">
                                A4 PORTRAIT (210mm × 297mm) • {copies} PAGE(S)
                            </div>

                            {/* Positioned ID Card Box: Exactly topMargin from top, sideMargin from left & right */}
                            <div
                                style={{
                                    marginTop: `${topMargin}px`,
                                    marginLeft: `${sideMargin}px`,
                                    marginRight: `${sideMargin}px`,
                                    width: `calc(100% - ${sideMargin * 2}px)`,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {imageSrc ? (
                                    <div
                                        style={{
                                            transform: `rotate(${rotation}deg) scale(${scalePercent / 100})`,
                                            transition: 'transform 0.2s ease-out',
                                            position: 'relative',
                                            display: 'inline-block',
                                            maxWidth: '100%'
                                        }}
                                        ref={cropImageFrameRef}
                                    >
                                        <img
                                            src={imageSrc}
                                            alt="ID Card Preview"
                                            className={`block max-w-full h-auto object-contain transition-all ${showBorder
                                                ? 'border-2 border-dashed border-slate-400 p-0.5'
                                                : 'shadow-xs'
                                                }`}
                                            style={{
                                                maxHeight: '400px',
                                                clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
                                                filter: `brightness(${brightness}%) contrast(${contrast}%) drop-shadow(0 2px ${shadow}px rgba(0, 0, 0, 0.35))`
                                            }}
                                        />
                                        {renderAnnotations()}
                                        {isCropMode && (
                                            <div className="absolute inset-0 z-20" aria-label="Crop image edges">
                                                <div
                                                    className="absolute border-2 border-dashed border-amber-400 bg-amber-300/10 pointer-events-none"
                                                    style={{
                                                        top: `${crop.top}%`,
                                                        right: `${crop.right}%`,
                                                        bottom: `${crop.bottom}%`,
                                                        left: `${crop.left}%`
                                                    }}
                                                />
                                                {renderCropHandle('top', 'h-3 cursor-ns-resize', 'កាត់ពីលើ')}
                                                {renderCropHandle('bottom', 'h-3 cursor-ns-resize', 'កាត់ពីក្រោម')}
                                                {renderCropHandle('left', 'w-3 cursor-ew-resize', 'កាត់ពីឆ្វេង')}
                                                {renderCropHandle('right', 'w-3 cursor-ew-resize', 'កាត់ពីស្តាំ')}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className="w-full h-[220px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 flex flex-col items-center justify-center p-6 text-center select-none"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-slate-200/80 text-slate-400 flex items-center justify-center mb-2">
                                            <FaIdCard size={24} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-500">
                                            ទីតាំងរូបភាពកាតសម្គាល់ខ្លួន
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                                            រូបភាពនឹងស្ថិតនៅចំកណ្តាល ដោយមានគម្លាតសងខាង {sideMargin}px និង គម្លាតពីលើ {topMargin}px
                                        </p>
                                        <span className="mt-3 px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold shadow-2xs hover:bg-slate-100 cursor-pointer">
                                            + បញ្ចូលរូបភាពឥឡូវនេះ
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. PHYSICAL PRINT SHEET (Generates exact N pages based on 'copies') */}
            <div
                id="print-a4-sheet"
                style={{
                    display: 'none',
                    width: '210mm',
                    margin: 0,
                    padding: 0,
                    backgroundColor: '#ffffff'
                }}
            >
                {imageSrc &&
                    Array.from({ length: copies }).map((_, pageIndex) => (
                        <div
                            key={pageIndex}
                            className="printable-page"
                            style={{
                                width: '210mm',
                                height: '297mm',
                                minHeight: '297mm',
                                maxHeight: '297mm',
                                backgroundColor: '#ffffff',
                                boxSizing: 'border-box',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                className="printable-card-wrapper"
                                style={{
                                    marginTop: `${topMargin}px`,
                                    marginLeft: `${sideMargin}px`,
                                    marginRight: `${sideMargin}px`,
                                    width: `calc(100% - ${sideMargin * 2}px)`,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <div
                                    style={{
                                        transform: `rotate(${rotation}deg) scale(${scalePercent / 100})`,
                                        position: 'relative',
                                        display: 'inline-block',
                                        maxWidth: '100%'
                                    }}
                                >
                                    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                                        <img
                                            src={imageSrc}
                                            alt={`Print ID Card Page ${pageIndex + 1}`}
                                            className={`block max-w-full h-auto object-contain ${showBorder ? 'border border-dashed border-gray-400 p-0.5' : ''
                                                }`}
                                            style={{
                                                maxHeight: '400px',
                                                clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
                                                filter: `brightness(${brightness}%) contrast(${contrast}%) drop-shadow(0 2px ${shadow}px rgba(0, 0, 0, 0.35))`
                                            }}
                                        />
                                        {renderAnnotations()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
            </div>

            {/* 4. CUSTOM ALERT UI - CONFIRM PRINT MODAL (ជំនួសឱ្យ Alert ធម្មតា) */}
            {showConfirmModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4 overflow-y-auto overscroll-none animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                                    <FaPrint size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">
                                        {t('confirmPrint', lang === 'km' ? 'បញ្ជាក់ការព្រីន' : 'Confirm print')}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        {t('printReviewBeforePrinting', lang === 'km' ? 'សូមពិនិត្យព័ត៌មានមុនពេលដំណើរការព្រីន' : 'Review the details before printing.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <FaTimes size={14} />
                            </button>
                        </div>

                        {/* Content summary */}
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-3">
                                {imageSrc && (
                                    <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white flex-shrink-0 flex items-center justify-center">
                                        <img src={imageSrc} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-800 truncate">{imageName || 'ID_Card.png'}</p>
                                    <p className="text-[11px] text-slate-500">{t('fileSize', lang === 'km' ? 'ទំហំឯកសារ' : 'File size')}: {imageSize || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-200/80 pt-2.5 space-y-1.5 font-medium text-slate-600 text-[11px]">
                                <div className="flex justify-between items-center">
                                    <span>{t('printCopies', lang === 'km' ? 'ចំនួនសន្លឹកព្រីនចេញ' : 'Number of copies')}:</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                                        {copies} {t('sheets', lang === 'km' ? 'សន្លឹក' : 'sheets')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>{t('paperOrientation', lang === 'km' ? 'ទម្រង់ក្រដាស' : 'Paper orientation')}:</span>
                                    <span className="font-semibold text-slate-800">{t('printA4Portrait', lang === 'km' ? 'A4 បញ្ឈរ' : 'A4 Portrait')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>{t('printMargins', lang === 'km' ? 'គម្លាតកំណត់' : 'Margins')}:</span>
                                    <span className="font-mono text-slate-700">{t('printTopMargin', lang === 'km' ? 'ពីលើ' : 'Top')} {topMargin}px | {t('printSideMargins', lang === 'km' ? 'សងខាង' : 'Sides')} {sideMargin}px</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleExecutePrint}
                                className="h-[38px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 border border-emerald-500 flex items-center gap-2 cursor-pointer active:scale-95"
                            >
                                <FaPrint size={13} />
                                <span>{t('printNow', lang === 'km' ? 'ព្រីនឥឡូវនេះ' : 'Print now')}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 5. CUSTOM ALERT UI - WARNING / NOTICE MODAL */}
            {warningModalMessage && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-amber-200 max-w-sm w-full p-5 shadow-2xl text-center space-y-3.5 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
                            <FaExclamationTriangle size={22} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-800">
                                {t('printNotice', lang === 'km' ? 'សូមបញ្ជាក់ព័ត៌មាន' : 'Please review the details')}
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {warningModalMessage}
                            </p>
                        </div>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setWarningModalMessage('')}
                                className="w-full h-[36px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                            >
                                {t('ok', lang === 'km' ? 'យល់ព្រម' : 'OK')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrintIdCard;
