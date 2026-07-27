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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0f1426]/90 border border-gray-800 rounded-2xl text-xs select-none">
            <div className="text-gray-400">
                Showing <span className="font-bold text-indigo-400">{startItem}</span> – <span className="font-bold text-indigo-400">{endItem}</span> of <span className="font-bold text-gray-100">{totalItems}</span> records
            </div>

            <div className="flex items-center gap-1.5">
                {/* First */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-xl font-bold border border-gray-700 transition-all cursor-pointer"
                >«</button>

                {/* Prev */}
                <button
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer"
                >
                    <MdChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {getPageNumbers().map(pg => (
                    <button
                        key={pg}
                        onClick={() => onPageChange(pg)}
                        className={`w-8 h-8 rounded-xl font-bold border transition-all cursor-pointer ${
                            pg === currentPage
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        {pg}
                    </button>
                ))}

                {/* Next */}
                <button
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer"
                >
                    <MdChevronRight size={16} />
                </button>

                {/* Last */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-xl font-bold border border-gray-700 transition-all cursor-pointer"
                >»</button>
            </div>
        </div>
    );
};

export default Pagination;
