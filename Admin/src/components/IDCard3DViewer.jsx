import React from 'react';
import { FaIdCard, FaUserCheck, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';

const IDCard3DViewer = ({ customer }) => {
    if (!customer) return null;

    return (
        <div className="w-full bg-gray-200 rounded-[5px] p-5 text-slate-100 space-y-4 shadow-xl select-none">
            <div className="flex items-center justify-between border-b border-indigo-500/30 pb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-khmer">
                        អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ
                    </span>
                </div>
            </div>

            <div className="w-full space-y-2 text-xs font-khmer">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <span className="text-[9px] text-slate-400 block">ឈ្មោះ អង់គ្លេស</span>
                            <span className="font-bold text-black text-xs">{customer.customerNameEn || '—'}</span>
                        </div>
                        <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <span className="text-[9px] text-slate-400 block">ឈ្មោះ ខ្មែរ</span>
                            <span className="font-bold text-indigo-300 text-xs">{customer.customerNameKh || '—'}</span>
                        </div>
                    </div>

                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div>
                            <span className="text-[9px] text-slate-400 block">លេខអត្តសញ្ញាណប័ណ្ណ (ID Card No)</span>
                            <span className="font-mono font-bold text-emerald-400 text-xs">{customer.idCardNumber || '—'}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] text-slate-400 block">ថ្ងៃខែឆ្នាំកំណើត (DOB)</span>
                            <span className="font-bold text-black text-xs">{customer.dob || '—'}</span>
                        </div>
                    </div>

                    {customer.currentAddress && (
                        <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
                            <FaMapMarkerAlt className="text-red-400 flex-shrink-0" />
                            <span className="truncate text-black">{customer.currentAddress}</span>
                        </div>
                    )}
                </div>
        </div>
    );
};

export default IDCard3DViewer;
