import React, { useState, useEffect } from 'react';
import { FaBuilding, FaChevronRight, FaSyncAlt } from 'react-icons/fa';

const BrandSelect = ({ API_BASE, onSelectBrand }) => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchBrands = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const cat = data.droplists?.find(d => d.category === 'Brands');
                if (cat && cat.items && cat.items.length > 0) {
                    setBrands(cat.items);
                } else {
                    setBrands(['MDM Main System', 'Brand Alpha', 'Brand Beta', 'Enterprise']);
                }
            } else {
                setBrands(['MDM Main System', 'Brand Alpha', 'Brand Beta']);
            }
        } catch {
            setBrands(['MDM Main System', 'Brand Alpha', 'Brand Beta']);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    return (
        <div className="min-h-screen bg-[#070913] flex flex-col justify-between p-6 select-none relative overflow-hidden">
            {/* Background Glow Orbs */}
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header / Logo */}
            <div className="flex flex-col items-center pt-8 text-center space-y-3 z-10">
                <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-indigo-500/40 p-3 flex items-center justify-center shadow-2xl pulse-glow">
                    <img src="/mdm_logo.svg" alt="SYSTEM MDM Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-emerald-400 to-amber-300">
                        SYSTEM MDM
                    </h1>
                    <p className="text-xs text-indigo-300 font-khmer font-semibold mt-1">
                        សូមជ្រើសរើស Brand (ម៉ាក) ដើម្បីបន្ត
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        Select System Brand before signing in
                    </p>
                </div>
            </div>

            {/* Brand List Selection */}
            <div className="w-full max-w-sm mx-auto space-y-3 z-10 my-auto">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer">
                        បញ្ជី Brand ទាំងអស់ ({brands.length})
                    </span>
                    <button onClick={fetchBrands} className="text-xs text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer">
                        <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                        Loading available brands...
                    </div>
                ) : (
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                        {brands.map((brandName, idx) => (
                            <button
                                key={idx}
                                onClick={() => onSelectBrand(brandName)}
                                className="w-full p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/80 transition-all flex items-center justify-between text-left group shadow-lg cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 font-bold text-sm group-hover:scale-105 transition-transform">
                                        <FaBuilding />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors block">
                                            {brandName}
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-medium">
                                            Active System Domain
                                        </span>
                                    </div>
                                </div>
                                <FaChevronRight className="text-slate-500 text-xs group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 z-10 pb-4">
                SYSTEM MDM Phone App &bull; Powered by Google DeepMind Agentic AI Architecture
            </div>
        </div>
    );
};

export default BrandSelect;
