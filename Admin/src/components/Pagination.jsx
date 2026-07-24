import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const Pagination = ({ currentPage = 1, totalItems = 0, itemsPerPage = 10, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (totalItems <= itemsPerPage) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0f1426]/90 border border-gray-800 rounded-2xl text-xs select-none">
            <div className="text-gray-400">
                Showing <span className="font-bold text-indigo-400">{startItem}</span> to <span className="font-bold text-indigo-400">{endItem}</span> of <span className="font-bold text-gray-100">{totalItems}</span> records (10 per page)
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer"
                >
                    <MdChevronLeft size={18} />
                    <span>Previous</span>
                </button>

                <div className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl font-mono text-gray-200 font-bold">
                    Page {currentPage} of {totalPages}
                </div>

                <button
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-xl font-semibold border border-gray-700 transition-all cursor-pointer"
                >
                    <span>Next</span>
                    <MdChevronRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
