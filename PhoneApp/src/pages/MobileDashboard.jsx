import React, { useState, useEffect } from 'react';
import IDCard3DViewer from '../components/IDCard3DViewer';
import Device3DPointers from '../components/Device3DPointers';
import { 
    FaThLarge, FaUsers, FaMobileAlt, FaFileContract, FaCog, FaSignOutAlt, 
    FaBuilding, FaSearch, FaHistory, FaTimes, FaBars, FaLock, FaUnlock, FaWallet, FaImage, FaCheckCircle, FaChevronRight, FaFilter, FaSyncAlt
} from 'react-icons/fa';
import { MdOutlinePhoneIphone, MdOutlineWallpaper, MdOutlineContactPhone } from 'react-icons/md';

const MobileDashboard = ({ user, API_BASE, onLogout, onChangeBrand }) => {
    const [activeCategory, setActiveCategory] = useState('dashboard');
    const [subPage, setSubPage] = useState('Application');
    const [menuOpen, setMenuOpen] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const [contracts, setContracts] = useState([]);
    const [stats, setStats] = useState({ totalLoanAmount: 0, totalRevenue: 0, outstandingBalance: 0, totalContracts: 0 });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const brandParam = user?.brand ? `userBrand=${encodeURIComponent(user.brand)}&userRole=${encodeURIComponent(user?.role || '')}` : '';
            const [contractsRes, statsRes] = await Promise.all([
                fetch(`${API_BASE}/contracts?limit=200${brandParam ? '&' + brandParam : ''}`),
                fetch(`${API_BASE}/dashboard/stats?${brandParam}`)
            ]);

            if (contractsRes.ok) {
                const data = await contractsRes.json();
                setContracts(data.data || []);
            }
            if (statsRes.ok) {
                const sData = await statsRes.json();
                setStats({
                    totalLoanAmount: sData.totalLoanAmount || 0,
                    totalRevenue: sData.totalRevenue || 0,
                    outstandingBalance: sData.outstandingBalance || 0,
                    totalContracts: sData.totalContracts || 0
                });
            }
        } catch (err) {
            console.error('Fetch mobile dashboard data error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [API_BASE, user]);

    const selectCategory = (cat, sub = '') => {
        setActiveCategory(cat);
        if (sub) setSubPage(sub);
        setMenuOpen(false);
    };

    // Filter contracts based on active subPage or search term
    const filteredContracts = contracts.filter(c => {
        const matchesSearch = !searchTerm || 
            (c.customerNameEn && c.customerNameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.customerNameKh && c.customerNameKh.includes(searchTerm)) ||
            (c.model && c.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.serialNumber && c.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.imei1 && c.imei1.includes(searchTerm)) ||
            (c.idCardNumber && c.idCardNumber.includes(searchTerm));

        if (activeCategory === 'contract') {
            if (subPage === 'Activated') return matchesSearch && c.status === 'Activated';
            if (subPage === 'Check') return matchesSearch && c.status === 'Check';
            if (subPage === 'Redeem') return matchesSearch && c.status === 'Redeem';
            if (subPage === 'BlackList') return matchesSearch && c.status === 'BlackList';
            return matchesSearch;
        }

        return matchesSearch;
    });

    return (
        <div className="min-h-screen bg-[#060812] text-slate-100 flex flex-col justify-between select-none relative overflow-x-hidden">
            
            {/* Top Navigation Bar */}
            <header className="px-4 py-3 bg-[#0c0f1d]/90 border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-50 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                    <button onClick={() => setMenuOpen(true)} className="p-2 text-indigo-400 bg-slate-900/90 rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-all">
                        <FaBars className="text-base" />
                    </button>
                    <img src="/mdm_logo.svg" alt="MDM Logo" className="w-7 h-7 object-contain" />
                    <div>
                        <h1 className="text-xs font-black text-emerald-400 leading-tight tracking-wide">
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM 888MDM'}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">{user?.name || 'Administrator'} &bull; <span className="text-indigo-400 font-mono">{user?.role || 'Admin'}</span></p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchAllData}
                        className="p-2 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl text-xs cursor-pointer hover:bg-slate-800"
                        title="Refresh Live Data"
                    >
                        <FaSyncAlt className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={onChangeBrand}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 text-indigo-300 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:border-indigo-500"
                    >
                        <FaBuilding /> {user?.brand || '888MDM'}
                    </button>
                    <button
                        onClick={onLogout}
                        className="p-2 bg-red-950/80 border border-red-800 text-red-400 rounded-xl text-xs cursor-pointer hover:bg-red-900"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </header>

            {/* Slide-out Full System Pages Drawer Menu */}
            {menuOpen && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex flex-col justify-between p-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2.5">
                            <img src="/mdm_logo.svg" alt="MDM Logo" className="w-7 h-7" />
                            <span className="text-sm font-bold text-indigo-400 font-khmer">គ្រប់ Page ទាំងអស់របស់ System MDM</span>
                        </div>
                        <button onClick={() => setMenuOpen(false)} className="p-2 text-gray-400 text-base font-bold cursor-pointer">
                            <FaTimes />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs pr-1">
                        <button onClick={() => selectCategory('dashboard')} className={`w-full text-left p-3.5 border rounded-2xl font-bold flex items-center justify-between transition-all ${activeCategory === 'dashboard' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-indigo-300 hover:bg-slate-800'}`}>
                            <span className="flex items-center gap-2.5"><FaThLarge className="text-base" /> 1. System Dashboard</span>
                            <FaChevronRight className="text-xs opacity-60" />
                        </button>

                        <button onClick={() => selectCategory('customer')} className={`w-full text-left p-3.5 border rounded-2xl font-bold flex items-center justify-between transition-all ${activeCategory === 'customer' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-indigo-300 hover:bg-slate-800'}`}>
                            <span className="flex items-center gap-2.5"><FaUsers className="text-base" /> 2. Customer Directory</span>
                            <FaChevronRight className="text-xs opacity-60" />
                        </button>

                        <button onClick={() => selectCategory('device')} className={`w-full text-left p-3.5 border rounded-2xl font-bold flex items-center justify-between transition-all ${activeCategory === 'device' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-purple-300 hover:bg-slate-800'}`}>
                            <span className="flex items-center gap-2.5"><MdOutlinePhoneIphone className="text-lg text-purple-400" /> 3. Managed Device Inventory</span>
                            <FaChevronRight className="text-xs opacity-60" />
                        </button>

                        {/* Contract subpages */}
                        <div className="p-3.5 bg-slate-900/90 rounded-2xl space-y-2 border border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-khmer">4. កិច្ចសន្យា Contract Sub-pages</span>
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {['Application', 'Activated', 'Check', 'Redeem', 'Comments', 'BlackList'].map((sub) => (
                                    <button key={sub} onClick={() => selectCategory('contract', sub)} className={`py-2 px-2.5 rounded-xl text-left font-semibold text-[11px] border transition-all ${activeCategory === 'contract' && subPage === sub ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-300 border-slate-800/60 hover:text-indigo-300'}`}>
                                        <span>&bull; {sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Installment */}
                        <button onClick={() => selectCategory('installment', 'PaymentHistory')} className={`w-full text-left p-3.5 border rounded-2xl font-bold flex items-center justify-between transition-all ${activeCategory === 'installment' ? 'bg-amber-600 text-white border-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800'}`}>
                            <span className="flex items-center gap-2.5"><FaWallet className="text-base text-amber-400" /> 5. Installment Payment History</span>
                            <FaChevronRight className="text-xs opacity-60" />
                        </button>

                        {/* History */}
                        <button onClick={() => selectCategory('history')} className={`w-full text-left p-3.5 border rounded-2xl font-bold flex items-center justify-between transition-all ${activeCategory === 'history' ? 'bg-sky-600 text-white border-sky-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-sky-300 hover:bg-slate-800'}`}>
                            <span className="flex items-center gap-2.5"><FaHistory className="text-base text-sky-400" /> 6. Audit & Device History</span>
                            <FaChevronRight className="text-xs opacity-60" />
                        </button>
                    </div>

                    <button onClick={() => setMenuOpen(false)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs font-khmer">
                        បិទផ្ទាំង Menu វិញ
                    </button>
                </div>
            )}

            {/* Page Content View */}
            <main className="flex-1 pb-20 overflow-y-auto">
                
                {/* 1. Dashboard View */}
                {activeCategory === 'dashboard' && (
                    <div className="p-4 space-y-4">
                        <div className="bg-gradient-to-r from-slate-900 via-[#0f1426] to-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-1">
                            <h2 className="text-sm font-bold text-indigo-400">Mobile System Overview</h2>
                            <p className="text-xs text-slate-400 font-khmer">
                                ព័ត៌មានសង្ខេបប្រព័ន្ធ MDM ({user?.brand || 'All Brands'}) &bull; Real-time Database Sync
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 text-left shadow-lg space-y-1">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Total Loan Out</span>
                                <span className="text-lg font-black text-emerald-400 font-mono block">${stats.totalLoanAmount.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 text-left shadow-lg space-y-1">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Collected Revenue</span>
                                <span className="text-lg font-black text-emerald-400 font-mono block">${stats.totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-500/30 text-left shadow-lg space-y-1">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Outstanding Balance</span>
                                <span className="text-lg font-black text-amber-400 font-mono block">${stats.outstandingBalance.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-indigo-500/30 text-left shadow-lg space-y-1">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Total Contracts</span>
                                <span className="text-lg font-black text-indigo-300 font-mono block">{contracts.length}</span>
                            </div>
                        </div>

                        {/* Recent Contracts Summary */}
                        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl">
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-khmer flex items-center justify-between">
                                <span>កិច្ចសន្យាថ្មីៗ (Recent Contracts)</span>
                                <span className="text-[10px] text-indigo-400 font-normal">{contracts.length} items</span>
                            </h3>

                            {contracts.slice(0, 5).map((c, i) => (
                                <div key={i} onClick={() => setSelectedCustomer(c)} className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-white text-xs">{c.customerNameEn || 'Customer'}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{c.model} &bull; ID: {c.idCardNumber || '—'}</p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-700 text-emerald-400 font-mono text-[10px] font-bold rounded-lg">
                                        ${c.loanAmount || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Customer Directory View */}
                {activeCategory === 'customer' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-2">
                            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaUsers /> Customer Directory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer">បញ្ជីឈ្មោះអតិថិជនទាំងអស់ក្នុងប្រព័ន្ធ ({user?.brand || 'All Brands'})</p>

                            <div className="relative pt-1">
                                <FaSearch className="absolute left-3 top-4 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="ស្វែងរកឈ្មោះ, លេខទូរស័ព្ទ, លេខអត្តសញ្ញាណប័ណ្ណ..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 font-khmer"
                                />
                            </div>
                        </div>

                        {filteredContracts.map((c, i) => (
                            <div key={i} onClick={() => setSelectedCustomer(c)} className="p-3.5 bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500 rounded-2xl text-xs flex justify-between items-center cursor-pointer transition-all shadow-md active:scale-[0.99]">
                                <div className="space-y-0.5">
                                    <p className="font-bold text-white text-sm">{c.customerNameEn} ({c.customerNameKh || ''})</p>
                                    <p className="text-[10px] text-slate-400">ID Card: {c.idCardNumber || '—'} &bull; Phone: {c.phone || '—'}</p>
                                </div>
                                <span className="px-3 py-1.5 bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 text-[10px] font-bold rounded-xl flex items-center gap-1.5 shadow-sm font-khmer">
                                    🪪 មើលឯកសារ
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. Managed Device Inventory View */}
                {activeCategory === 'device' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-2">
                            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <MdOutlinePhoneIphone className="text-lg" /> Managed Device Inventory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer">បញ្ជីឧបករណ៍ទូរស័ព្ទ MDM ទាំងអស់ ({user?.brand || 'All Brands'})</p>

                            <div className="relative pt-1">
                                <FaSearch className="absolute left-3 top-4 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="ស្វែងរក Model, Serial Number, IMEI..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 font-khmer"
                                />
                            </div>
                        </div>

                        {filteredContracts.map((d, i) => (
                            <div key={i} onClick={() => setSelectedDevice(d)} className="p-3.5 bg-slate-900/90 border border-slate-800/80 hover:border-purple-500 rounded-2xl text-xs flex justify-between items-center cursor-pointer transition-all shadow-md active:scale-[0.99]">
                                <div className="space-y-0.5">
                                    <p className="font-bold text-white text-sm">{d.model || 'Smart Device'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">SN: {d.serialNumber || 'SN-9812'} &bull; IMEI: {d.imei1 || '—'}</p>
                                </div>
                                <span className="px-3 py-1.5 bg-purple-950/80 text-purple-300 border border-purple-700/80 text-[10px] font-bold rounded-xl flex items-center gap-1.5 shadow-sm font-khmer">
                                    📱 ព័ត៌មាន Specs
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 4. Contract Subpages View */}
                {activeCategory === 'contract' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                    <FaFileContract /> Contracts &bull; <span className="text-emerald-400">{subPage}</span>
                                </h2>
                                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                    {filteredContracts.length} items
                                </span>
                            </div>

                            <div className="relative pt-1">
                                <FaSearch className="absolute left-3 top-4 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="ស្វែងរកតាមឈ្មោះ, Model, ID Card..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 font-khmer"
                                />
                            </div>
                        </div>

                        {filteredContracts.map((c, i) => (
                            <div key={i} onClick={() => setSelectedCustomer(c)} className="p-4 bg-slate-900/90 border border-slate-800 hover:border-indigo-500 rounded-3xl text-xs space-y-2 cursor-pointer transition-all shadow-md">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-white text-sm">{c.customerNameEn}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{c.model} &bull; Phone: {c.phone}</p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
                                        {c.status || 'Active'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[10px]">
                                    <div><span className="text-slate-500 block">Loan Amount</span><span className="font-bold text-emerald-400 font-mono">${c.loanAmount || 0}</span></div>
                                    <div><span className="text-slate-500 block">Monthly</span><span className="font-bold text-amber-300 font-mono">${c.monthlyPayment || 0}</span></div>
                                    <div><span className="text-slate-500 block">Term</span><span className="font-bold text-indigo-300 font-mono">{c.paymentTerm || '12'} Mo</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 5. Installment View */}
                {activeCategory === 'installment' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-1">
                            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                <FaWallet /> Installment Payment History
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer">ប្រវត្តិបង់ប្រាក់រំលស់ទាំងអស់ ({user?.brand || 'All Brands'})</p>
                        </div>

                        {contracts.map((c, i) => (
                            <div key={i} className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl text-xs space-y-2 shadow-md">
                                <div className="flex justify-between items-center">
                                    <p className="font-bold text-white text-sm">{c.customerNameEn}</p>
                                    <span className="text-emerald-400 font-mono font-bold">${c.monthlyPayment}/mo</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-400 font-khmer border-t border-slate-800 pt-2">
                                    <span>ប្រាក់បានបង់រួច ៖ <strong className="text-emerald-300 font-mono">${(c.loanAmount - c.remainingBalance) || 0}</strong></span>
                                    <span>នៅខ្វះ ៖ <strong className="text-amber-400 font-mono">${c.remainingBalance || 0}</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 6. History View */}
                {activeCategory === 'history' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-1">
                            <h2 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                                <FaHistory /> Audit & Device Action History
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer">កត់ត្រាសកម្មភាពទាំងអស់ក្នុងប្រព័ន្ធ System MDM</p>
                        </div>

                        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl text-xs space-y-3 shadow-md">
                            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>Account: {user?.username} ({user?.brand})</span>
                                    <span>Just Now</span>
                                </div>
                                <p className="font-bold text-emerald-400">Logged in via Mobile Phone App</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* 2D Customer Details Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-indigo-500/40 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-khmer">
                                🪪 ព័ត៌មានលម្អិតអតិថិជន (Customer Profile)
                            </h3>
                            <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold cursor-pointer">✕</button>
                        </div>

                        <IDCard3DViewer customer={selectedCustomer} />

                        <div className="text-right pt-2">
                            <button onClick={() => setSelectedCustomer(null)} className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer font-khmer">
                                បិទផ្ទាំងវិញ (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2D Device Specs Modal */}
            {selectedDevice && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-purple-500/40 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider font-khmer">
                                📱 ព័ត៌មាន Specs ទូរស័ព្ទ (Device Specifications)
                            </h3>
                            <button onClick={() => setSelectedDevice(null)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold cursor-pointer">✕</button>
                        </div>

                        <Device3DPointers device={selectedDevice} />

                        <div className="text-right pt-2">
                            <button onClick={() => setSelectedDevice(null)} className="px-5 py-2.5 bg-purple-600 text-white font-bold text-xs rounded-xl cursor-pointer font-khmer">
                                បិទផ្ទាំងវិញ (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileDashboard;
