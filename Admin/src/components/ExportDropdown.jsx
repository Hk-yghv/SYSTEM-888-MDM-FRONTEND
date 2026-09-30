import React, { useRef } from 'react';
import { FaDownload, FaFileExcel } from 'react-icons/fa';
import { MdKeyboardArrowDown, MdPictureAsPdf } from 'react-icons/md';

const ExportDropdown = ({
    onExportExcel,
    onExportPDF,
    triggerLabel = 'Export',
    excelLabel = 'Excel',
    pdfLabel = 'PDF',
    className = ''
}) => {
    const dropdownRef = useRef(null);

    const runExport = (handler) => {
        dropdownRef.current.open = false;
        handler();
    };

    return (
        <details ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
            <summary className="flex list-none items-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 cursor-pointer [&::-webkit-details-marker]:hidden">
                <FaDownload className="text-slate-600" />
                <span>{triggerLabel}</span>
                <MdKeyboardArrowDown className="text-base" />
            </summary>
            <div className="absolute right-0 z-50 mt-1 min-w-36 overflow-hidden rounded-[5px] border border-slate-200 bg-white p-1 shadow-lg">
                <button
                    type="button"
                    onClick={() => runExport(onExportExcel)}
                    className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                >
                    <FaFileExcel className="text-emerald-600" />
                    <span>{excelLabel}</span>
                </button>
                <button
                    type="button"
                    onClick={() => runExport(onExportPDF)}
                    className="flex w-full items-center gap-2 rounded-[5px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-800 cursor-pointer"
                >
                    <MdPictureAsPdf className="text-red-600" />
                    <span>{pdfLabel}</span>
                </button>
            </div>
        </details>
    );
};

export default ExportDropdown;
