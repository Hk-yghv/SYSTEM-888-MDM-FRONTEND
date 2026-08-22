import React, { useState, useEffect } from 'react';
import ScanPage from './ScanPage';
import IDCard3DViewer from '../components/IDCard3DViewer';
import Device3DPointers from '../components/Device3DPointers';
import { 
    FaQrcode, FaThLarge, FaUsers, FaMobileAlt, FaFileContract, FaCog, FaSignOutAlt, 
    FaBuilding, FaSearch, FaHistory, FaTimes, FaBars, FaLock, FaUnlock, FaWallet, FaImage, FaCheckCircle, FaUserCheck, FaChevronRight
} from 'react-icons/fa';
import { MdOutlinePhoneIphone, MdOutlineWallpaper, MdInfo, MdOutlineContactPhone } from 'react-icons/md';

const MobileDashboard = ({ user, API_BASE, onLogout, onChangeBrand, onUpdateApiUrl }) => {
    const [activeCategory, setActiveCategory] = useState('scan');
    const [subPage, setSubPage] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const [contracts, setContracts] = useState([]);
    const [stats, setStats] = useState({ totalLoanAmount: 0, totalRevenue: 0, outstandingBalance: 0, totalContracts: 0 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = user?.brand ? `?userBrand=${encodeURIComponent(user.brand)}&userRole=${user?.role || ''}` : '';
                const [contractsRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE}/contracts?limit=100`),
                    fetch(`${API_BASE}/dashboard/stats${params}`)
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
            } catch { }
            setLoading(false);
        };
        fetchData();
    }, [API_BASE, user]);

    const [phoneStatus, setPhoneStatus] = useState('disconnected'); // 'connected' | 'pending' | 'disconnected'
    const [connectMsg, setConnectMsg] = useState('');

    // Poll Phone App Status every 2s
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/phone-app/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.device?.isConnected) setPhoneStatus('connected');
                    else if (data.device?.isPending) setPhoneStatus('pending');
                    else setPhoneStatus('disconnected');
                }
            } catch { }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 2000);
        return () => clearInterval(interval);
    }, [API_BASE]);

    // Send One-Tap Pair Request
    const handleQuickConnect = async () => {
        setConnectMsg('កំពុងផ្ញើសំណើ...');
        try {
            const res = await fetch(`${API_BASE}/phone-app/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username || '@houv',
                    brand: user?.brand || '888MDM',
                    id: "PH-" + Math.floor(1000 + Math.random() * 9000),
                    model: "Samsung Galaxy S24 Ultra",
                    osVersion: "Android 14",
                    batteryLevel: 94,
                    ip: "192.168.1.105"
                })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.status === 'connected') {
                    setPhoneStatus('connected');
                    setConnectMsg('🟢 បានភ្ជាប់!');
                } else {
                    setPhoneStatus('pending');
                    setConnectMsg('⏳ ផ្ញើរួច! សូមមើល Computer');
                }
            }
        } catch {
            setConnectMsg('មិនអាចភ្ជាប់បានទេ');
        } finally {
            setTimeout(() => setConnectMsg(''), 4000);
        }
    };

    const selectCategory = (cat, sub = '') => {
        setActiveCategory(cat);
        setSubPage(sub);
        setMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#060812] text-slate-100 flex flex-col justify-between select-none relative overflow-x-hidden">
            
            {/* Top Navigation Bar */}
            <header className="px-4 py-3 bg-[#0c0f1d]/90 border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-50 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <button onClick={() => setMenuOpen(true)} className="p-2 text-indigo-400 bg-slate-900/90 rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-all">
                        <FaBars className="text-base" />
                    </button>
                    <img src="/mdm_logo.svg" alt="MDM Logo" className="w-7 h-7 object-contain" />
                    <div>
                        <h1 className="text-xs font-black text-emerald-400 leading-tight tracking-wide">
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM 888MDM'}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">{user?.name || 'Administrator'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onChangeBrand}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 text-indigo-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:border-indigo-500"
                    >
                        <FaBuilding /> {user?.brand}
                    </button>
                    <button
                        onClick={onLogout}
                        className="p-1.5 bg-red-950/80 border border-red-800 text-red-400 rounded-lg text-xs cursor-pointer hover:bg-red-900"
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
                            <span className="text-sm font-bold text-indigo-400 font-khmer">គ្រប់ Page ទាំងអស់របស់ System</span>
                        </div>
                        <button onClick={() => setMenuOpen(false)} className="p-2 text-gray-400 text-base font-bold cursor-pointer">
                            <FaTimes />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs pr-1">
                        <button onClick={() => selectCategory('scan')} className="w-full text-left p-3.5 bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-700/60 rounded-2xl font-bold text-emerald-400 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaQrcode className="text-base" /> 1. Real-time Document Scanner</span>
                            <FaChevronRight className="text-xs text-emerald-500" />
                        </button>
                        <button onClick={() => selectCategory('dashboard')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-indigo-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaThLarge className="text-base text-indigo-400" /> 2. System Dashboard</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>
                        <button onClick={() => selectCategory('customer')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-indigo-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaUsers className="text-base text-indigo-400" /> 3. Customer Directory (3D ID Card)</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>
                        <button onClick={() => selectCategory('device')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-indigo-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><MdOutlinePhoneIphone className="text-lg text-purple-400" /> 4. Device Inventory (3D Model Pointers)</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>

                        {/* Contract subpages */}
                        <div className="p-3.5 bg-slate-900/90 rounded-2xl space-y-2 border border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-khmer">5. កិច្ចសន្យា Contract Sub-pages</span>
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {['Application', 'Activated', 'Check', 'Redeem', 'Comments', 'BlackList'].map((sub) => (
                                    <button key={sub} onClick={() => selectCategory('contract', sub)} className="py-2 px-2.5 bg-slate-950 rounded-xl text-left text-slate-300 hover:text-indigo-300 font-semibold text-[11px] border border-slate-800/60 flex items-center justify-between">
                                        <span>&bull; {sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Installment */}
                        <button onClick={() => selectCategory('installment', 'PaymentHistory')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-amber-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaWallet className="text-base text-amber-400" /> 6. Installment Payment History</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>

                        {/* Lost Phone */}
                        <div className="p-3.5 bg-slate-900/90 rounded-2xl space-y-2 border border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-khmer">7. Lost Phone Management</span>
                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {['Actions', 'LockPhone', 'UnlockPhone'].map((sub) => (
                                    <button key={sub} onClick={() => selectCategory('lostphone', sub)} className="py-2 px-2 bg-slate-950 rounded-xl text-center text-red-300 font-semibold text-[10px] border border-slate-800/60">
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Wallpaper */}
                        <div className="p-3.5 bg-slate-900/90 rounded-2xl space-y-2 border border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-khmer">8. Wallpaper Controls</span>
                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {['Actions', 'LockWallpaper', 'UnlockWallpaper'].map((sub) => (
                                    <button key={sub} onClick={() => selectCategory('wallpaper', sub)} className="py-2 px-2 bg-slate-950 rounded-xl text-center text-purple-300 font-semibold text-[10px] border border-slate-800/60">
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* History */}
                        <button onClick={() => selectCategory('history')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-sky-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaHistory className="text-base text-sky-400" /> 9. Login & Device Action History</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>

                        {/* Settings */}
                        <button onClick={() => selectCategory('settings')} className="w-full text-left p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-indigo-300 flex items-center justify-between">
                            <span className="flex items-center gap-2.5"><FaCog className="text-base text-indigo-400" /> 10. Settings & Controls</span>
                            <FaChevronRight className="text-xs text-slate-500" />
                        </button>
                    </div>

                    <button onClick={() => setMenuOpen(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl text-xs font-khmer">
                        បិទផ្ទាំង Menu វិញ
                    </button>
                </div>
            )}

            {/* Page Content View */}
            <main className="flex-1 pb-20 overflow-y-auto">
                {activeCategory === 'scan' && (
                    <ScanPage API_BASE={API_BASE} user={user} onUpdateApiUrl={onUpdateApiUrl} />
                )}

                {activeCategory === 'dashboard' && (
                    <div className="p-4 space-y-4">
                        <div className="bg-gradient-to-r from-slate-900 via-[#0f1426] to-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
                            <h2 className="text-sm font-bold text-indigo-400 mb-0.5">Mobile Dashboard Overview</h2>
                            <p className="text-xs text-slate-400 font-khmer">ព័ត៌មានសង្ខេបប្រព័ន្ធ SYSTEM MDM ({user?.brand})</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 text-left shadow-lg">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Total Loan Out</span>
                                <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">${stats.totalLoanAmount.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 text-left shadow-lg">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Collected Revenue</span>
                                <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">${stats.totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-500/30 text-left shadow-lg">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Outstanding Balance</span>
                                <span className="text-lg font-black text-amber-400 font-mono mt-1 block">${stats.outstandingBalance.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-900/90 rounded-2xl border border-indigo-500/30 text-left shadow-lg">
                                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Total Contracts</span>
                                <span className="text-lg font-black text-indigo-300 font-mono mt-1 block">{contracts.length}</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeCategory === 'customer' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaUsers /> Customer Directory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer mt-0.5">ចុចលើអតិថិជនដើម្បីមើលព័ត៌មាន និង **3D ID Card**</p>
                        </div>

                        {contracts.map((c, i) => (
                            <div key={i} onClick={() => setSelectedCustomer(c)} className="p-3.5 bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500 rounded-2xl text-xs flex justify-between items-center cursor-pointer transition-all shadow-md active:scale-[0.99]">
                                <div>
                                    <p className="font-bold text-white text-sm">{c.customerNameEn || 'Hakyong Houv'}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">ID: {c.idCardNumber || '010293847'} &bull; {c.phone || '012 345 678'}</p>
                                </div>
                                <span className="px-3 py-1.5 bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 text-[10px] font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                                    🪪 3D ID Card
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'device' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <MdOutlinePhoneIphone className="text-lg" /> Managed Device Inventory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer mt-0.5">ចុចលើទូរស័ព្ទដើម្បីមើល **3D Model & Callout Lines**</p>
                        </div>

                        {contracts.map((d, i) => (
                            <div key={i} onClick={() => setSelectedDevice(d)} className="p-3.5 bg-slate-900/80 border border-slate-800/80 hover:border-purple-500 rounded-2xl text-xs flex justify-between items-center cursor-pointer transition-all shadow-md active:scale-[0.99]">
                                <div>
                                    <p className="font-bold text-white text-sm">{d.model || 'Samsung S24 Ultra'}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">SN: {d.serialNumber || 'RF8X109283'} &bull; IMEI: {d.imei1 || '358941109482103'}</p>
                                </div>
                                <span className="px-3 py-1.5 bg-purple-950/80 text-purple-300 border border-purple-700/80 text-[10px] font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                                    📱 3D Device
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'contract' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                <FaFileContract /> Contracts ({subPage || 'All Application'})
                            </h2>
                        </div>
                        {contracts.map((c, i) => (
                            <div key={i} className="p-3.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl text-xs flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white text-sm">{c.customerNameEn} - {c.model}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">${c.amount || 1000} &bull; {c.status || 'Application'}</p>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold rounded-full">{c.status || 'Active'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'installment' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                <FaWallet /> Payment History & Installment
                            </h2>
                        </div>
                        <div className="p-3.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl text-xs flex justify-between items-center">
                            <div><p className="font-bold text-white">Payment #PAY-9921</p><p className="text-[10px] text-slate-400 mt-0.5">Monthly: $100 &bull; Received</p></div>
                            <span className="text-emerald-400 font-bold font-mono text-sm">+$100.00</span>
                        </div>
                    </div>
                )}

                {activeCategory === 'lostphone' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                <MdOutlinePhoneIphone className="text-lg" /> Lost Phone Actions ({subPage || 'Overview'})
                            </h2>
                        </div>
                        <div className="p-3.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl text-xs flex justify-between items-center">
                            <div><p className="font-bold text-white">Samsung S24 Ultra (IMEI: 358941...)</p></div>
                            <span className="px-2.5 py-1 bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold rounded-full">LOCK DEVICE</span>
                        </div>
                    </div>
                )}

                {activeCategory === 'wallpaper' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <MdOutlineWallpaper className="text-lg" /> Wallpaper Controls ({subPage || 'Actions'})
                            </h2>
                        </div>
                    </div>
                )}

                {activeCategory === 'history' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                                <FaHistory /> System Login & Device Action History
                            </h2>
                        </div>
                    </div>
                )}

                {activeCategory === 'settings' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2 text-left">
                            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaCog /> System Settings & Controls
                            </h2>
                            <p className="text-xs text-slate-300 font-khmer">ប្រព័ន្ធត្រួតពិនិត្យ និងភ្ជាប់ទំនាក់ទំនងទូរស័ព្ទ (SYSTEM MDM)</p>
                            <p className="text-xs text-slate-400 font-bold">Current Brand Domain: <span className="text-indigo-400">{user?.brand}</span></p>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Menu Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0c0f1d]/95 border-t border-slate-800/90 px-3 py-2 backdrop-blur-md flex items-center justify-around z-50 shadow-2xl">
                <button onClick={() => selectCategory('scan')} className={`flex flex-col items-center gap-0.5 py-1 px-3.5 rounded-xl transition-all cursor-pointer ${activeCategory === 'scan' ? 'text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-700/60' : 'text-slate-400'}`}>
                    <FaQrcode className="text-lg" />
                    <span className="text-[10px] font-khmer">Scan</span>
                </button>
                <button onClick={() => selectCategory('customer')} className={`flex flex-col items-center gap-0.5 py-1 px-3.5 rounded-xl transition-all cursor-pointer ${activeCategory === 'customer' ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-700/60' : 'text-slate-400'}`}>
                    <FaUsers className="text-lg" />
                    <span className="text-[10px]">Customer</span>
                </button>
                <button onClick={() => selectCategory('device')} className={`flex flex-col items-center gap-0.5 py-1 px-3.5 rounded-xl transition-all cursor-pointer ${activeCategory === 'device' ? 'text-purple-400 font-bold bg-purple-950/70 border border-purple-700/60' : 'text-slate-400'}`}>
                    <MdOutlinePhoneIphone className="text-xl" />
                    <span className="text-[10px]">Device</span>
                </button>
                <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-1 px-3.5 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white">
                    <FaBars className="text-lg" />
                    <span className="text-[10px] font-khmer">Menu</span>
                </button>
            </nav>

            {/* Customer 3D ID Card Information Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-indigo-500/40 rounded-3xl w-full max-w-sm shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                            <h3 className="text-xs font-bold text-indigo-400 font-khmer">
                                🪪 ព័ត៌មានអតិថិជន & 3D ID Card
                            </h3>
                            <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 text-xs font-bold p-1">✕</button>
                        </div>
                        <IDCard3DViewer customer={selectedCustomer} />
                        <div className="space-y-1 text-xs text-left bg-slate-900 p-3 rounded-2xl border border-slate-800">
                            <p><strong className="text-slate-400">Name EN:</strong> <span className="font-bold text-white">{selectedCustomer.customerNameEn}</span></p>
                            <p><strong className="text-slate-400">Name KH:</strong> <span className="font-bold text-indigo-300 font-khmer">{selectedCustomer.customerNameKh}</span></p>
                            <p><strong className="text-slate-400">ID / Passport:</strong> <span className="font-mono text-emerald-400">{selectedCustomer.idCardNumber || '010293847'}</span></p>
                            <p><strong className="text-slate-400">Phone:</strong> <span className="font-mono text-slate-200">{selectedCustomer.phone || '012 345 678'}</span></p>
                        </div>
                        <button onClick={() => setSelectedCustomer(null)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs cursor-pointer">Close</button>
                    </div>
                </div>
            )}

            {/* Device 3D Pointers Model Modal */}
            {selectedDevice && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-purple-500/40 rounded-3xl w-full max-w-sm shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                            <h3 className="text-xs font-bold text-purple-400 font-khmer">
                                📱 រូបរាង 3D Device & Callout Lines
                            </h3>
                            <button onClick={() => setSelectedDevice(null)} className="text-gray-400 text-xs font-bold p-1">✕</button>
                        </div>
                        <Device3DPointers device={selectedDevice} />
                        <button onClick={() => setSelectedDevice(null)} className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xs cursor-pointer">Close</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MobileDashboard;
