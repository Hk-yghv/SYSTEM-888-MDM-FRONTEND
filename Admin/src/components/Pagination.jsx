import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const Pagination = ({ currentPage = 1, totalItems = 0, itemsPerPage = 10, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Build page number buttons (show max 5 around current)
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl text-xs select-none shadow-xs">
            <div className="text-slate-500 font-medium">
                Showing <span className="font-bold text-emerald-700">{startItem}</span> – <span className="font-bold text-emerald-700">{endItem}</span> of <span className="font-extrabold text-slate-800">{totalItems}</span> records
            </div>

            <div className="flex items-center gap-1.5">
                {/* First */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:cursor-not-allowed text-slate-700 rounded-lg font-bold border border-slate-200 transition-all cursor-pointer shadow-xs"
                >«</button>

                {/* Prev */}
                <button
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:cursor-not-allowed text-slate-700 rounded-lg font-semibold border border-slate-200 transition-all cursor-pointer shadow-xs"
                >
                    <MdChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {getPageNumbers().map(pg => (
                    <button
                        key={pg}
                        onClick={() => onPageChange(pg)}
                        className={`w-8 h-8 rounded-lg font-bold border transition-all cursor-pointer text-xs ${pg === currentPage
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                    >
                        {pg}
                    </button>
                ))}

                {/* Next */}
                <button
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:cursor-not-allowed text-slate-700 rounded-lg font-semibold border border-slate-200 transition-all cursor-pointer shadow-xs"
                >
                    <MdChevronRight size={16} />
                </button>

                {/* Last */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:cursor-not-allowed text-slate-700 rounded-lg font-bold border border-slate-200 transition-all cursor-pointer shadow-xs"
                >»</button>
            </div>
        </div>
    );
};

export default Pagination;
