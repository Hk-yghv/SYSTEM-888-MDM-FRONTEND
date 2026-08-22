import React from 'react';
import { FaMobileAlt, FaHdd, FaMemory, FaBatteryFull, FaSimCard } from 'react-icons/fa';

const Device3DPointers = ({ device }) => {
    if (!device) return null;

    return (
        <div className="w-full bg-[#0b0f1e] border border-indigo-500/30 rounded-2xl p-4 text-slate-100 space-y-3 shadow-xl select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    <FaMobileAlt className="text-indigo-400 text-lg" />
                    <div>
                        <h4 className="text-xs font-bold text-white">{device.model || 'Smart Device'}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">SN: {device.serialNumber || 'SN-MDM'}</p>
                    </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950 border border-emerald-700 text-emerald-300">
                    Active
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-khmer">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 space-y-0.5">
                    <span className="text-[9px] text-slate-400 flex items-center gap-1"><FaSimCard className="text-sky-400" /> IMEI 1</span>
                    <p className="font-mono font-bold text-sky-300 text-[10px]">{device.imei1 || '—'}</p>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 space-y-0.5">
                    <span className="text-[9px] text-slate-400 flex items-center gap-1"><FaHdd className="text-amber-400" /> Storage</span>
                    <p className="font-bold text-white text-[10px]">{device.storage || '128 GB'}</p>
                </div>
            </div>
        </div>
    );
};

export default Device3DPointers;
