import React, { useState, useEffect } from 'react';
import ScanPage from './ScanPage';
import IDCard3DViewer from '../components/IDCard3DViewer';
import Device3DPointers from '../components/Device3DPointers';
import { 
    FaQrcode, FaThLarge, FaUsers, FaMobileAlt, FaFileContract, FaCog, FaSignOutAlt, 
    FaBuilding, FaSearch, FaHistory, FaTimes, FaBars, FaLock, FaUnlock, FaWallet, FaImage, FaCheckCircle, FaUserCheck
} from 'react-icons/fa';
import { MdOutlinePhoneIphone, MdOutlineWallpaper, MdInfo, MdOutlineContactPhone } from 'react-icons/md';

const MobileDashboard = ({ user, API_BASE, onLogout, onChangeBrand }) => {
    const [activeCategory, setActiveCategory] = useState('scan'); // 'scan' | 'dashboard' | 'customer' | 'device' | 'contract' | 'installment' | 'lostphone' | 'wallpaper' | 'history' | 'settings'
    const [subPage, setSubPage] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch contracts/customers/devices from System API
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/contracts?limit=50`);
                if (res.ok) {
                    const data = await res.json();
                    setContracts(data.data || []);
                }
            } catch { }
            setLoading(false);
        };
        fetchData();
    }, [API_BASE]);

    const selectCategory = (cat, sub = '') => {
        setActiveCategory(cat);
        setSubPage(sub);
        setMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col justify-between select-none relative overflow-x-hidden">
            
            {/* Top Navigation Bar */}
            <header className="px-4 py-3 bg-[#0f1426] border-b border-slate-800 flex items-center justify-between sticky top-0 z-50 shadow-lg">
                <div className="flex items-center gap-2.5">
                    <button onClick={() => setMenuOpen(true)} className="p-2 text-indigo-400 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer">
                        <FaBars className="text-base" />
                    </button>
                    <img src="/mdm_logo.svg" alt="MDM Logo" className="w-7 h-7 object-contain" />
                    <div>
                        <h1 className="text-xs font-bold text-emerald-400 leading-tight">
                            SYSTEM {user?.brand?.toUpperCase()}
                        </h1>
                        <p className="text-[10px] text-slate-400 leading-none">{user?.name || 'Administrator'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onChangeBrand}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-indigo-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                        <FaBuilding /> {user?.brand}
                    </button>
                    <button
                        onClick={onLogout}
                        className="p-2 bg-red-950/80 border border-red-800 text-red-400 rounded-lg text-xs cursor-pointer"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </header>

            {/* Slide-out Full System Pages Drawer Menu */}
            {menuOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col justify-between p-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                            <img src="/mdm_logo.svg" alt="MDM Logo" className="w-7 h-7" />
                            <span className="text-sm font-bold text-indigo-400">All System Mobile Pages</span>
                        </div>
                        <button onClick={() => setMenuOpen(false)} className="p-2 text-gray-400 text-sm font-bold">
                            <FaTimes />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
                        <button onClick={() => selectCategory('scan')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-emerald-400 flex items-center gap-2">
                            <FaQrcode /> <span>1. Scan Document (Real-time)</span>
                        </button>
                        <button onClick={() => selectCategory('dashboard')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <FaThLarge /> <span>2. Dashboard</span>
                        </button>
                        <button onClick={() => selectCategory('customer')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <FaUsers /> <span>3. Customer (3D ID Card)</span>
                        </button>
                        <button onClick={() => selectCategory('device')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <MdOutlinePhoneIphone /> <span>4. Device Inventory (3D Model Pointers)</span>
                        </button>

                        {/* Contract subpages */}
                        <div className="p-3 bg-slate-900 rounded-xl space-y-1.5 border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contract Sub-pages</span>
                            {['Application', 'Activated', 'Check', 'Redeem', 'Comments', 'BlackList'].map((sub) => (
                                <button key={sub} onClick={() => selectCategory('contract', sub)} className="block w-full text-left py-1 px-2 text-slate-300 hover:text-indigo-400 font-medium">
                                    &bull; Contract {sub}
                                </button>
                            ))}
                        </div>

                        {/* Installment */}
                        <button onClick={() => selectCategory('installment', 'PaymentHistory')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <FaWallet /> <span>Installment Payment History</span>
                        </button>

                        {/* Lost Phone */}
                        <div className="p-3 bg-slate-900 rounded-xl space-y-1.5 border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lost Phone Management</span>
                            {['Actions', 'LockPhone', 'UnlockPhone'].map((sub) => (
                                <button key={sub} onClick={() => selectCategory('lostphone', sub)} className="block w-full text-left py-1 px-2 text-slate-300 hover:text-red-400 font-medium">
                                    &bull; {sub}
                                </button>
                            ))}
                        </div>

                        {/* Wallpaper */}
                        <div className="p-3 bg-slate-900 rounded-xl space-y-1.5 border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wallpaper Controls</span>
                            {['Actions', 'LockWallpaper', 'UnlockWallpaper'].map((sub) => (
                                <button key={sub} onClick={() => selectCategory('wallpaper', sub)} className="block w-full text-left py-1 px-2 text-slate-300 hover:text-purple-400 font-medium">
                                    &bull; {sub}
                                </button>
                            ))}
                        </div>

                        {/* History */}
                        <button onClick={() => selectCategory('history')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <FaHistory /> <span>Login & Device History</span>
                        </button>

                        {/* Settings */}
                        <button onClick={() => selectCategory('settings')} className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold text-indigo-300 flex items-center gap-2">
                            <FaCog /> <span>Settings & System Controls</span>
                        </button>
                    </div>

                    <button onClick={() => setMenuOpen(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs">
                        Close Drawer Menu
                    </button>
                </div>
            )}

            {/* Page Content View */}
            <main className="flex-1 pb-20 overflow-y-auto">
                {activeCategory === 'scan' && (
                    <ScanPage API_BASE={API_BASE} />
                )}

                {activeCategory === 'dashboard' && (
                    <div className="p-4 space-y-4">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-indigo-400 mb-1">Mobile Dashboard Overview</h2>
                            <p className="text-xs text-slate-400 font-khmer">ព័ត៌មានសង្ខេបប្រព័ន្ធ SYSTEM MDM ({user?.brand})</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800"><span className="text-slate-400 block text-[10px]">Total Contracts</span><span className="text-base font-bold text-white">{contracts.length || 128}</span></div>
                            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800"><span className="text-slate-400 block text-[10px]">Active Devices</span><span className="text-base font-bold text-emerald-400">114</span></div>
                        </div>
                    </div>
                )}

                {activeCategory === 'customer' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaUsers /> Customer Directory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer mt-0.5">ចុចលើអតិថិជនដើម្បីមើលព័ត៌មាន និង **3D ID Card**</p>
                        </div>

                        {contracts.map((c, i) => (
                            <div key={i} onClick={() => setSelectedCustomer(c)} className="p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl text-xs flex justify-between items-center cursor-pointer">
                                <div>
                                    <p className="font-bold text-white">{c.customerNameEn || 'Hakyong Houv'}</p>
                                    <p className="text-[10px] text-slate-400">ID: {c.idCardNumber || '010293847'} &bull; {c.phone || '012 345 678'}</p>
                                </div>
                                <span className="px-2 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                                    🪪 3D ID Card
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'device' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <MdOutlinePhoneIphone /> Managed Device Inventory
                            </h2>
                            <p className="text-xs text-slate-400 font-khmer mt-0.5">ចុចលើទូរស័ព្ទដើម្បីមើល **3D Model & Pointer Lines**</p>
                        </div>

                        {contracts.map((d, i) => (
                            <div key={i} onClick={() => setSelectedDevice(d)} className="p-3 bg-slate-900 border border-slate-800 hover:border-purple-500 rounded-xl text-xs flex justify-between items-center cursor-pointer">
                                <div>
                                    <p className="font-bold text-white">{d.model || 'Samsung S24 Ultra'}</p>
                                    <p className="text-[10px] text-slate-400">SN: {d.serialNumber || 'RF8X109283'} &bull; IMEI: {d.imei1 || '358941109482103'}</p>
                                </div>
                                <span className="px-2 py-1 bg-purple-950 text-purple-300 border border-purple-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                                    📱 3D Device
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'contract' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                <FaFileContract /> Contracts ({subPage || 'All Application'})
                            </h2>
                        </div>
                        {contracts.map((c, i) => (
                            <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white">{c.customerNameEn} - {c.model}</p>
                                    <p className="text-[10px] text-slate-400">${c.amount || 1000} &bull; {c.status || 'Application'}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[9px] font-bold rounded-full">{c.status || 'Active'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeCategory === 'installment' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                <FaWallet /> Payment History & Installment
                            </h2>
                        </div>
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                            <div><p className="font-bold text-white">Payment #PAY-9921</p><p className="text-[10px] text-slate-400">Monthly: $100 &bull; Received</p></div>
                            <span className="text-emerald-400 font-bold font-mono">+$100.00</span>
                        </div>
                    </div>
                )}

                {activeCategory === 'lostphone' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                <MdOutlinePhoneIphone /> Lost Phone Remote Actions ({subPage || 'Overview'})
                            </h2>
                        </div>
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                            <div><p className="font-bold text-white">Samsung S24 Ultra (IMEI: 358941...)</p></div>
                            <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 text-[9px] font-bold rounded-full">LOCK DEVICE</span>
                        </div>
                    </div>
                )}

                {activeCategory === 'wallpaper' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                <MdOutlineWallpaper /> Wallpaper & Screen Lock Controls ({subPage || 'Actions'})
                            </h2>
                        </div>
                    </div>
                )}

                {activeCategory === 'history' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <h2 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                                <FaHistory /> System Login & Device Action History
                            </h2>
                        </div>
                    </div>
                )}

                {activeCategory === 'settings' && (
                    <div className="p-4 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                <FaCog /> System Settings & Controls
                            </h2>
                            <p className="text-xs text-slate-400">API Endpoint: {API_BASE}</p>
                            <p className="text-xs text-slate-400">Current Brand: {user?.brand}</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Menu Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0f1426]/95 border-t border-slate-800 px-2 py-1.5 backdrop-blur-md flex items-center justify-around z-50 shadow-2xl">
                <button onClick={() => selectCategory('scan')} className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeCategory === 'scan' ? 'text-emerald-400 font-bold bg-emerald-950/60' : 'text-slate-400'}`}>
                    <FaQrcode className="text-lg" />
                    <span className="text-[9px] font-khmer">Scan Menu</span>
                </button>
                <button onClick={() => selectCategory('customer')} className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeCategory === 'customer' ? 'text-indigo-400 font-bold bg-indigo-950/60' : 'text-slate-400'}`}>
                    <FaUsers className="text-lg" />
                    <span className="text-[9px]">3D Customer</span>
                </button>
                <button onClick={() => selectCategory('device')} className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeCategory === 'device' ? 'text-purple-400 font-bold bg-purple-950/60' : 'text-slate-400'}`}>
                    <MdOutlinePhoneIphone className="text-xl" />
                    <span className="text-[9px]">3D Device</span>
                </button>
                <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white">
                    <FaBars className="text-lg" />
                    <span className="text-[9px]">All Pages</span>
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
                            <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 text-xs font-bold">✕</button>
                        </div>
                        <IDCard3DViewer customer={selectedCustomer} />
                        <div className="space-y-1 text-xs text-left bg-slate-900 p-3 rounded-xl border border-slate-800">
                            <p><strong className="text-slate-400">Name EN:</strong> {selectedCustomer.customerNameEn}</p>
                            <p><strong className="text-slate-400">Name KH:</strong> {selectedCustomer.customerNameKh}</p>
                            <p><strong className="text-slate-400">ID / Passport:</strong> {selectedCustomer.idCardNumber || '010293847'}</p>
                            <p><strong className="text-slate-400">Phone:</strong> {selectedCustomer.phone || '012 345 678'}</p>
                        </div>
                        <button onClick={() => setSelectedCustomer(null)} className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs">Close</button>
                    </div>
                </div>
            )}

            {/* Device 3D Pointers Model Modal */}
            {selectedDevice && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <div className="bg-[#0b0f1e] border border-purple-500/40 rounded-3xl w-full max-w-sm shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                            <h3 className="text-xs font-bold text-purple-400 font-khmer">
                                📱 រូបរាង 3D Device & បន្ទាត់បង្ហាញព័ត៌មាន
                            </h3>
                            <button onClick={() => setSelectedDevice(null)} className="text-gray-400 text-xs font-bold">✕</button>
                        </div>
                        <Device3DPointers device={selectedDevice} />
                        <button onClick={() => setSelectedDevice(null)} className="w-full py-2 bg-purple-600 text-white font-bold rounded-xl text-xs">Close</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MobileDashboard;
