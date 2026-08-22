import React, { useState, useEffect } from 'react';
import { FaBuilding, FaChevronRight, FaSyncAlt, FaShieldAlt } from 'react-icons/fa';

const BrandSelect = ({ API_BASE, onSelectBrand, onUpdateApiUrl }) => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchBrands = async () => {
        setLoading(true);
        try {
            const foundBrands = new Set();

            // 1. Fetch from ControlSystem config droplists
            try {
                const res = await fetch(`${API_BASE}/controlsystem?brand=`);
                if (res.ok) {
                    const data = await res.json();
                    const cat = data.droplists?.find(d => d.category === 'Brands');
                    if (cat && cat.items && Array.isArray(cat.items)) {
                        cat.items.forEach(b => b && foundBrands.add(b.trim()));
                    }
                }
            } catch { }

            // 2. Fetch active brands from Contracts database
            try {
                const cRes = await fetch(`${API_BASE}/contracts?limit=100`);
                if (cRes.ok) {
                    const cData = await cRes.json();
                    if (cData.data && Array.isArray(cData.data)) {
                        cData.data.forEach(item => {
                            if (item.brand && item.brand.trim()) foundBrands.add(item.brand.trim());
                        });
                    }
                }
            } catch { }

            // 3. Fetch active brands from Users database
            try {
                const uRes = await fetch(`${API_BASE}/users`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    const usersList = Array.isArray(uData) ? uData : (uData.data || []);
                    usersList.forEach(u => {
                        if (u.brand && u.brand.trim()) foundBrands.add(u.brand.trim());
                    });
                }
            } catch { }

            const uniqueList = Array.from(foundBrands).filter(Boolean);
            if (uniqueList.length > 0) {
                setBrands(uniqueList);
            } else {
                setBrands(['888MDM']); // Fallback default brand if empty
            }
        } catch (err) {
            console.error('Fetch brands error:', err);
            setBrands(['888MDM']);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, [API_BASE]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#070913] to-[#04060c] flex flex-col justify-between p-6 select-none relative overflow-hidden">
            {/* Ambient Glassmorphism Glows */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Header / System Logo */}
            <div className="flex flex-col items-center pt-8 text-center space-y-4 z-10">
                <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-indigo-500/40 p-3.5 flex items-center justify-center shadow-2xl shadow-indigo-500/20 pulse-glow backdrop-blur-xl">
                    <img src="/mdm_logo.svg" alt="SYSTEM MDM Logo" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-emerald-300 to-amber-300 tracking-wide">
                        SYSTEM MDM
                    </h1>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/80 border border-indigo-700/60 rounded-full text-[11px] font-bold text-indigo-300 font-khmer">
                        <FaShieldAlt className="text-indigo-400" />
                        <span>ជ្រើសរើស Brand ក្នុងប្រព័ន្ធ ({brands.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                        Select System Brand domain before signing in
                    </p>
                </div>
            </div>

            {/* Brand List Card Selection */}
            <div className="w-full max-w-sm mx-auto space-y-3.5 z-10 my-auto">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        បញ្ជី Brand ទាំងអស់ ({brands.length})
                    </span>
                    <button onClick={fetchBrands} className="text-xs text-indigo-400 flex items-center gap-1.5 hover:text-indigo-300 cursor-pointer font-medium">
                        <FaSyncAlt className={loading ? "animate-spin text-emerald-400" : ""} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-900/60 rounded-3xl border border-slate-800 backdrop-blur-md">
                        កំពុងទាញយកបញ្ជី Brand ពីប្រព័ន្ធ...
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                        {brands.map((brandName, idx) => (
                            <button
                                key={idx}
                                onClick={() => onSelectBrand(brandName)}
                                className="w-full p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-900/60 border border-slate-800/80 hover:border-indigo-500/80 hover:from-slate-900 hover:to-indigo-950/40 transition-all flex items-center justify-between text-left group shadow-xl hover:shadow-indigo-500/10 cursor-pointer backdrop-blur-md"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 font-bold text-base group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                        <FaBuilding />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors block">
                                            {brandName}
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-semibold font-khmer flex items-center gap-1">
                                            <span>●</span> Active Brand Domain
                                        </span>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-300 group-hover:bg-indigo-900/50 group-hover:border-indigo-600 transition-all">
                                    <FaChevronRight className="text-xs group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 font-khmer z-10 pb-2">
                SYSTEM MDM Mobile Application &bull; គ្រប់គ្រងឧបករណ៍ទូរស័ព្ទដៃ
            </div>
        </div>
    );
};

export default BrandSelect;
