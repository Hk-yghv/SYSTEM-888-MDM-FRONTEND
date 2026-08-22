import React from 'react';
import { FaMobileAlt, FaMicrochip, FaMemory, FaHdd, FaBatteryFull, FaShieldAlt, FaSimCard } from 'react-icons/fa';

const Device3DPointers = ({ device }) => {
    if (!device) return null;

    return (
        <div className="w-full bg-[#0b0f1e] border border-indigo-500/30 rounded-2xl p-5 text-slate-100 space-y-4 shadow-xl select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-600 flex items-center justify-center text-indigo-400 text-xl shadow-md">
                        <FaMobileAlt />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">{device.model || 'Smart Device'}</h4>
                        <p className="text-[11px] text-slate-400 font-mono">Serial: {device.serialNumber || 'SN-MDM-9912'}</p>
                    </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    device.lockPhoneStatus === 'Locked'
                        ? 'bg-red-950/90 border-red-700 text-red-300'
                        : 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
                }`}>
                    {device.lockPhoneStatus === 'Locked' ? '🔒 Locked' : '🟢 Active'}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-khmer">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaSimCard className="text-sky-400" /> IMEI 1
                    </span>
                    <p className="font-mono font-bold text-sky-300 text-[11px]">{device.imei1 || '—'}</p>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaSimCard className="text-sky-400" /> IMEI 2
                    </span>
                    <p className="font-mono font-bold text-sky-300 text-[11px]">{device.imei2 || '—'}</p>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaHdd className="text-amber-400" /> Storage
                    </span>
                    <p className="font-bold text-white">{device.storage || '128 GB'}</p>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaMemory className="text-indigo-400" /> RAM
                    </span>
                    <p className="font-bold text-white">{device.ram || '8 GB'}</p>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaBatteryFull className="text-emerald-400" /> Battery
                    </span>
                    <p className="font-bold text-emerald-300">{device.batteryLevel ? `${device.batteryLevel}%` : '95%'}</p>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                        <FaShieldAlt className="text-purple-400" /> MDM Guard
                    </span>
                    <p className="font-bold text-purple-300">Protected</p>
                </div>
            </div>
        </div>
    );
};

export default Device3DPointers;
