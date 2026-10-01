import React, { useRef } from 'react';
import { FaDownload, FaFileExcel } from 'react-icons/fa';
import { MdKeyboardArrowDown, MdPictureAsPdf } from 'react-icons/md';
import { useLanguage } from '../context/LanguageContext';

const ExportDropdown = ({
    onExportExcel,
    onExportPDF,
    triggerLabel,
    excelLabel,
    className = ''
}) => {
    const { t } = useLanguage();
    const dropdownRef = useRef(null);

    const resolvedTrigger = triggerLabel || t('export');
    const resolvedExcel = excelLabel || t('exportExcel') || 'Excel';
    const resolvedPdfPortrait = t('pdfPortrait') || 'PDF (Portrait)';
    const resolvedPdfLandscape = t('pdfLandscape') || 'PDF (Landscape)';

    const runExport = (handler, arg) => {
        if (dropdownRef.current) dropdownRef.current.open = false;
        handler?.(arg);
    };

    return (
        <details ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
            <summary className="flex list-none items-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 cursor-pointer [&::-webkit-details-marker]:hidden">
                <FaDownload className="text-slate-600" />
                <span>{resolvedTrigger}</span>
                <MdKeyboardArrowDown className="text-base" />
            </summary>
            <div className="absolute right-0 z-50 mt-1 min-w-44 overflow-hidden rounded-[5px] border border-slate-200 bg-white p-2 shadow-lg divide-y divide-slate-100">
                <button
                    type="button"
                    onClick={() => runExport(onExportExcel)}
                    className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                >
                    <FaFileExcel className="text-emerald-600 text-sm" />
                    <span>{resolvedExcel}</span>
                </button>
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => runExport(onExportPDF, 'portrait')}
                        className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-rose-50 hover:text-rose-800 cursor-pointer"
                    >
                        <MdPictureAsPdf className="text-rose-600 text-sm" />
                        <span>{resolvedPdfPortrait}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => runExport(onExportPDF, 'landscape')}
                        className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-800 cursor-pointer"
                    >
                        <MdPictureAsPdf className="text-indigo-600 text-sm" />
                        <span>{resolvedPdfLandscape}</span>
                    </button>
                </div>
            </div>
        </details>
    );
};

export default ExportDropdown;
