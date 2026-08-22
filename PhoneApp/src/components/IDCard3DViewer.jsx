import React from 'react';
import { FaIdCard } from 'react-icons/fa';

const IDCard3DViewer = ({ customer }) => {
    if (!customer) return null;

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-slate-100 space-y-2 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 font-khmer">
                    <FaIdCard /> 🇰🇭 អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ
                </span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                    VERIFIED
                </span>
            </div>

            <div className="flex items-center gap-3">
                <img
                    src={customer.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt="Customer"
                    className="w-14 h-16 object-cover rounded-lg border border-slate-700"
                />
                <div className="flex-1 text-[11px] space-y-1 font-khmer">
                    <p className="font-bold text-white leading-tight">{customer.customerNameEn} ({customer.customerNameKh})</p>
                    <p className="text-[10px] font-mono text-emerald-400">ID: {customer.idCardNumber || '—'}</p>
                    <p className="text-[10px] text-slate-400">DOB: {customer.dob || '—'}</p>
                </div>
            </div>
        </div>
    );
};

export default IDCard3DViewer;
