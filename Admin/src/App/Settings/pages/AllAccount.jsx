import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaShieldAlt, FaUserPlus, FaLock, FaTelegramPlane, FaHistory, FaBan, FaUnlock } from 'react-icons/fa';
import { MdOutlineSync, MdDelete, MdEdit } from 'react-icons/md';

const ALL_SYSTEM_PAGES = [
    { category: 'Main Systems', path: '/dashboard', label: 'Dashboard Analysis', actions: ['read', 'export'] },
    { category: 'Main Systems', path: '/customer', label: 'Customer Directory', actions: ['read', 'create', 'edit', 'delete', 'information'] },
    { category: 'Main Systems', path: '/device', label: 'Device List', actions: ['read', 'edit', 'delete', 'information', 'lockDevice', 'setWallpaper'] },

    { category: 'Contract Management', path: '/contract/application', label: 'Contract Application', actions: ['read', 'create', 'edit', 'delete', 'activate', 'information'] },
    { category: 'Contract Management', path: '/contract/activated', label: 'Contract Activated', actions: ['read', 'edit', 'delete', 'information', 'lockDevice', 'setWallpaper', 'redeem'] },
    { category: 'Contract Management', path: '/contract/check', label: 'Contract Check', actions: ['read', 'edit', 'information'] },
    { category: 'Contract Management', path: '/contract/redeem', label: 'Contract Redeem', actions: ['read', 'edit', 'information'] },
    { category: 'Contract Management', path: '/contract/comments', label: 'Contract Comments', actions: ['read', 'create', 'edit', 'delete'] },
    { category: 'Contract Management', path: '/contract/blacklist', label: 'Contract Blacklist', actions: ['read', 'create', 'delete'] },
    { category: 'Calculation & Tools', path: '/calculate/schedule-1', label: 'Calculate Schedule 1 (គណនាការប្រាក់ & កាលវិភាគ)', actions: ['read', 'export'] },

    { category: 'Installment & Payment', path: '/installment/schedule', label: 'Installment Schedule (តារាងបង់ប្រាក់)', actions: ['read', 'edit', 'export'] },
    { category: 'Installment & Payment', path: '/installment/paymentHistory', label: 'Payment History', actions: ['read', 'create', 'export'] },
    { category: 'Installment & Payment', path: '/installment/cash-out', label: 'Cash Out (ប្រាក់ចេញ)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Installment & Payment', path: '/installment/cash-in', label: 'Cash In (ប្រាក់ចូល)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue', label: 'Overdue Customers (ភ្ញៀវយឺត)', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/due-today', label: 'Due Today (ភ្ញៀវត្រូវបង់ថ្ងៃនេះ)', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/due-in-3-days', label: 'Due In 3 Days (ភ្ញៀវនៅសល់ ៣ ថ្ងៃ)', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue-3-days', label: 'Overdue 3 Days (ភ្ញៀវយឺត ៣ ថ្ងៃ)', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/unpaid-yesterday', label: 'Unpaid Yesterday (ភ្ញៀវមិនបានបង់ប្រាក់ម្សិលម៉ិញ)', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue-7-days', label: 'Overdue 7 Days (ភ្ញៀវខកខានបង់ប្រាក់ ៧ ថ្ងៃ)', actions: ['read', 'export'] },

    { category: 'Lost Phone Control', path: '/lostphone/actions', label: 'Lost Phone Actions', actions: ['read', 'lockDevice', 'unlockPhone'] },
    { category: 'Lost Phone Control', path: '/lostphone/lockphone', label: 'Lock Phone Log', actions: ['read', 'export'] },
    { category: 'Lost Phone Control', path: '/lostphone/unlockphone', label: 'Unlock Phone Log', actions: ['read', 'export'] },

    { category: 'Wallpaper Control', path: '/wallpaper/actions', label: 'Wallpaper Actions', actions: ['read', 'setWallpaper', 'unlockWallpaper'] },
    { category: 'Wallpaper Control', path: '/wallpaper/lockphone', label: 'Lock Wallpaper Log', actions: ['read', 'export'] },
    { category: 'Wallpaper Control', path: '/wallpaper/unlockphone', label: 'Unlock Wallpaper Log', actions: ['read', 'export'] },

    { category: 'Reports & Analytics', path: '/report/all-customers', label: 'All Customer Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/all', label: 'Master Executive Report All', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/activated', label: 'Activated Contract Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/redeem', label: 'Redeem Contract Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/lock-phone', label: 'Lock Phone Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/set-wallpaper', label: 'Set Wallpaper Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/installment', label: 'Installment Payment Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/follow-up', label: 'Follow Up Report (របាយការណ៍ Follow Up)', actions: ['read', 'export'] },

    { category: 'Audit & History Logs', path: '/history/login-history', label: 'Login History Log', actions: ['read', 'export'] },
    { category: 'Audit & History Logs', path: '/history/device-history', label: 'Device Action Log', actions: ['read', 'export'] },

    { category: 'Follow Up System', path: '/follow-up/follow-up-1', label: 'Follow up 1 (ការតាមដាន Message)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/follow-up-2', label: 'Follow up 2 (បញ្ចាំ & ឆ្លើយតបឆាត)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/follow-up-3', label: 'Follow up 3 (ការតាមដាន Leads & Follow Up 3)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/report', label: 'Follow Up Report (របាយការណ៍ Follow Up)', actions: ['read', 'export'] },

    { category: 'Salary System', path: '/salary', label: 'Salary Management (គ្រប់គ្រងប្រាក់ខែ)', actions: ['read', 'create', 'edit', 'delete', 'export'] },

    { category: 'Settings & Profile', path: '/profile', label: 'User Profile', actions: ['read', 'edit'] },
    { category: 'Settings & Profile', path: '/settings/all-account', label: 'All Account Management', actions: ['read', 'create', 'edit', 'delete'] },
    { category: 'Settings & Profile', path: '/settings/control-system', label: 'Control System Settings', actions: ['read', 'edit'] },
    { category: 'Settings & Profile', path: '/settings/system-logs', label: 'System Event Logs (កំណត់ហេតុប្រព័ន្ធ)', actions: ['read', 'export'] }
];

const AllAccount = () => {
    const { t } = useLanguage();
    const { API_BASE, hasPermission } = useAuth();

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState(['Administrator', 'Manager', 'Staff', 'Viewer']);
    const [brandsList, setBrandsList] = useState([['MDM', 'ECloud']]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);
    const [historyModalTab, setHistoryModalTab] = useState('online'); // 'online', 'otp', 'login'

    // Format duration in seconds to human readable (e.g. 1h 25m 30s)
    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return '< 1m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || h > 0) parts.push(`${m}m`);
        if (parts.length === 0 || s > 0) parts.push(`${s}s`);
        return parts.join(' ');
    };

    // New / Edit User Form State
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'Staff',
        brand: '',
        permissions: {}
    });

    const handleOpenEditUserModal = (userObj) => {
        if (userObj.isImmutable || userObj.username === '@hakyonghouv') {
            alert('Master Admin account (@hakyonghouv) is protected and CANNOT be edited!');
            return;
        }
        setEditingUser(userObj);
        setFormData({
            name: userObj.name || '',
            username: userObj.username || '',
            email: userObj.email || '',
            password: '',
            role: userObj.role || 'Staff',
            brand: userObj.brand || '',
            permissions: userObj.permissions || {}
        });
    };

    const fetchUsers = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/users`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
            const cRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (cRes.ok) {
                const cData = await cRes.json();
                if (cData.roles) setRoles(cData.roles);
                const brandCat = cData.droplists?.find(d => d.category === 'Brands');
                if (brandCat) setBrandsList(brandCat.items);
            }
        } catch (err) {
            console.error('Fetch users error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchUsers();
        const pollInterval = setInterval(() => {
            fetch(`${API_BASE}/users`)
                .then(res => res.ok ? res.json() : null)
                .then(data => { if (data) setUsers(data); })
                .catch(() => { });
        }, 3000);
        return () => clearInterval(pollInterval);
    }, [API_BASE]);

    const handlePermissionToggle = (path, action) => {
        setFormData(prev => {
            const currentPerms = prev.permissions[path] || {};
            const updated = { ...currentPerms, [action]: !currentPerms[action] };
            return {
                ...prev,
                permissions: {
                    ...prev.permissions,
                    [path]: updated
                }
            };
        });
    };

    const handleGrantAllPermissions = () => {
        setFormData(prev => {
            const newPerms = {};
            ALL_SYSTEM_PAGES.forEach(pg => {
                const pObj = {};
                (pg.actions || ['read', 'create', 'edit', 'delete']).forEach(act => {
                    pObj[act] = true;
                });
                newPerms[pg.path] = pObj;
            });
            return { ...prev, permissions: newPerms };
        });
    };

    const handleToggleAllAction = (action) => {
        setFormData(prev => {
            const relevantPages = ALL_SYSTEM_PAGES.filter(pg => (pg.actions || ['read', 'create', 'edit', 'delete']).includes(action));
            const allChecked = relevantPages.every(pg => prev.permissions[pg.path]?.[action]);
            const newPerms = { ...prev.permissions };
            relevantPages.forEach(pg => {
                newPerms[pg.path] = {
                    ...(newPerms[pg.path] || {}),
                    [action]: !allChecked
                };
            });
            return { ...prev, permissions: newPerms };
        });
    };

    const handleClearAllPermissions = () => {
        setFormData(prev => ({ ...prev, permissions: {} }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setOpenCreateModal(false);
                fetchUsers();
                setFormData({
                    name: '',
                    username: '',
                    email: '',
                    password: '',
                    role: 'Staff',
                    brand: '',
                    permissions: {}
                });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create user');
            }
        } catch (err) {
            console.error('Create user error:', err);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        try {
            const res = await fetch(`${API_BASE}/users/${editingUser._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setEditingUser(null);
                fetchUsers();
                setFormData({
                    name: '',
                    username: '',
                    email: '',
                    password: '',
                    role: 'Staff',
                    brand: '',
                    permissions: {}
                });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update user');
            }
        } catch (err) {
            console.error('Update user error:', err);
        }
    };

    const handleDeleteUser = async (userObj) => {
        if (userObj.isImmutable || userObj.username === '@hakyonghouv') {
            alert('Master Admin account (@hakyonghouv) is protected and CANNOT be deleted!');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete account ${userObj.username}?`)) return;

        try {
            const res = await fetch(`${API_BASE}/users/${userObj._id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'Delete failed');
            }
        } catch (err) {
            console.error('Delete user error:', err);
        }
    };

    const handleToggleBlock = async (userObj) => {
        const willBlock = !userObj.isBlocked;
        const confirmMsg = willBlock
            ? `Block account "${userObj.username}"? They will be kicked out immediately if online.`
            : `Unblock account "${userObj.username}"? They will regain access immediately.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${API_BASE}/users/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userObj._id, block: willBlock })
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'Block action failed');
            }
        } catch (err) {
            console.error('Block toggle error:', err);
        }
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xl'>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('allAccount')} & Role-Based Permissions (RBAC)
                        </h1>
                        <p className='text-xs text-emerald-700 font-bold'>
                            Manage system users, login history, Telegram 2FA codes, and page-level permission matrices
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    {hasPermission('/settings/all-account', 'create') && (
                        <button
                            onClick={() => setOpenCreateModal(true)}
                            className='flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all'
                        >
                            <FaUserPlus size={14} />
                            <p>{t('create')} Account</p>
                        </button>
                    )}

                    <button
                        onClick={fetchUsers}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Users Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-180px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('username')} & ID</th>
                            <th className='px-4 py-3'>Full Name & Email</th>
                            <th className='px-4 py-3 text-center'>{t('role')}</th>
                            <th className='px-4 py-3 text-center'>Brand</th>
                            <th className='px-4 py-3 text-center'>Status</th>
                            <th className='px-4 py-3 text-center'>Last OTP Code</th>
                            <th className='px-4 py-3 text-center'>Login History</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {users.map((item, idx) => {
                            const isMaster = item.isImmutable || item.username === '@hakyonghouv';
                            const isBlockedUser = !!item.isBlocked;
                            return (
                                <tr key={item._id || idx} className={`transition-colors ${isMaster ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-emerald-50/40'} ${isBlockedUser ? 'bg-red-50/60 border-l-2 border-red-400' : ''}`}>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{idx + 1}</td>
                                    <td className='px-4 py-3'>
                                        <span className='font-bold text-emerald-700 font-mono block'>{item.username}</span>
                                        <span className='text-[10px] text-slate-500 font-mono block'>ID: {item.userId || '001290312'}</span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='font-bold text-slate-900 block'>{item.name}</span>
                                        <span className='text-slate-500 font-mono text-[11px] block'>{item.email}</span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase border ${isMaster ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                                            {item.role || 'Staff'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        {item.brand ? (
                                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px]">
                                                {item.brand}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 rounded-full font-bold text-[10px]">
                                                All Brands
                                            </span>
                                        )}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        {item.status === 'Online' ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                    </span>
                                                    Online
                                                </span>
                                                <span className="text-[9px] text-emerald-600 font-medium">Active now</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1 bg-slate-100 text-slate-500 border border-slate-300">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                    Offline
                                                </span>
                                                {item.lastSeen && (
                                                    <span className="text-[9px] text-slate-400 font-mono">
                                                        {new Date(item.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        {item.lastOtp ? (
                                            <button
                                                onClick={() => { setSelectedHistoryUser(item); setHistoryModalTab('otp'); }}
                                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-mono font-bold text-xs inline-flex items-center gap-1.5 mx-auto cursor-pointer transition-all shadow-xs"
                                                title="Click to view all OTP History"
                                            >
                                                <span className="tracking-wider">{item.lastOtp}</span>
                                                {item.otpHistory?.length > 1 && (
                                                    <span className="text-[9px] bg-amber-200 text-amber-800 px-1 py-0.2 rounded-full">
                                                        +{item.otpHistory.length - 1}
                                                    </span>
                                                )}
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 font-normal text-[11px]">-</span>
                                        )}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <button
                                            onClick={() => { setSelectedHistoryUser(item); setHistoryModalTab('online'); }}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 mx-auto cursor-pointer transition-all shadow-xs"
                                        >
                                            <FaHistory className="text-indigo-600" />
                                            <span>Sessions & Logs</span>
                                        </button>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        {isMaster ? (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                                                <FaLock size={9} /> Immutable Master Admin
                                            </span>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* Edit User */}
                                                {hasPermission('/settings/all-account', 'edit') && (
                                                    <button
                                                        onClick={() => handleOpenEditUserModal(item)}
                                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-lg cursor-pointer transition-all text-[11px] font-bold flex items-center gap-1 px-2"
                                                        title="Edit User Info & Permissions"
                                                    >
                                                        <MdEdit size={14} /> Edit
                                                    </button>
                                                )}
                                                {/* Block / Unblock */}
                                                {hasPermission('/settings/all-account', 'edit') && (
                                                    <button
                                                        onClick={() => handleToggleBlock(item)}
                                                        className={`p-1.5 border rounded-lg cursor-pointer transition-all text-[11px] font-bold flex items-center gap-1 px-2 ${item.isBlocked
                                                            ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
                                                            : 'bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-700'
                                                            }`}
                                                        title={item.isBlocked ? 'Unblock User' : 'Block User'}
                                                    >
                                                        {item.isBlocked ? <><FaUnlock size={11} /> Unblock</> : <><FaBan size={11} /> Block</>}
                                                    </button>
                                                )}
                                                {/* Delete */}
                                                {hasPermission('/settings/all-account', 'delete') && (
                                                    <button
                                                        onClick={() => handleDeleteUser(item)}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-lg cursor-pointer transition-all"
                                                        title="Delete Account"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 3-in-1 Audit History Modal: Online Sessions, 6-Digit OTP History, and Login Logs */}
            {selectedHistoryUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50000000000 p-4">
                    <div className="bg-[#0f172a] border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FaHistory className="text-indigo-400" />
                                    Account Audit & Logs: <span className="text-emerald-400 font-mono">{selectedHistoryUser.username}</span>
                                </h3>
                                <p className="text-[11px] text-slate-400">User ID: {selectedHistoryUser.userId || '—'} &bull; Role: {selectedHistoryUser.role || 'Staff'}</p>
                            </div>
                            <button onClick={() => setSelectedHistoryUser(null)} className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer">✕</button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <button
                                onClick={() => setHistoryModalTab('online')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'online' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                Online Sessions ({selectedHistoryUser.onlineHistory?.length || 0})
                            </button>
                            <button
                                onClick={() => setHistoryModalTab('otp')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'otp' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                OTP 6-Digit Codes ({selectedHistoryUser.otpHistory?.length || (selectedHistoryUser.lastOtp ? 1 : 0)})
                            </button>
                            <button
                                onClick={() => setHistoryModalTab('login')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                Login Audit ({selectedHistoryUser.loginHistory?.length || 0})
                            </button>
                        </div>

                        {/* Tab Content: Online Sessions (From - To Time & Duration) */}
                        {historyModalTab === 'online' && (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                                {(!selectedHistoryUser.onlineHistory || selectedHistoryUser.onlineHistory.length === 0) ? (
                                    <div className="text-center py-8 text-slate-500 italic space-y-1">
                                        <p>No active online session history recorded yet.</p>
                                        <p className="text-[11px] text-slate-600">Sessions are automatically recorded when user logs in and active.</p>
                                    </div>
                                ) : (
                                    selectedHistoryUser.onlineHistory.map((sess, sIdx) => {
                                        const isCurrent = !sess.logoutTime && selectedHistoryUser.status === 'Online';
                                        return (
                                            <div key={sIdx} className={`p-3 rounded-2xl border ${isCurrent ? 'bg-emerald-950/30 border-emerald-800/80' : 'bg-slate-900/70 border-slate-800'} space-y-1 font-mono`}>
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                                        {isCurrent ? '🟢 Currently Online (Active Session)' : '⚪ Completed Session'}
                                                    </span>
                                                    <span className="text-indigo-400 font-bold bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                                                        Duration: {formatDuration(sess.durationSeconds)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400">
                                                    <div>
                                                        <span className="text-slate-500 block">Login Time (ម៉ោងចូល):</span>
                                                        <span className="text-slate-200">{new Date(sess.loginTime).toLocaleString('en-GB')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 block">Last Active / Logout (ម៉ោងចេញ):</span>
                                                        <span className="text-slate-200">
                                                            {sess.logoutTime ? new Date(sess.logoutTime).toLocaleString('en-GB') : (sess.lastSeen ? new Date(sess.lastSeen).toLocaleString('en-GB') : 'Active')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-slate-500 pt-0.5">IP: {sess.ip || '127.0.0.1'} &bull; Device: {sess.deviceInfo || 'Web Browser'}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Tab Content: OTP 6-Digit Codes History */}
                        {historyModalTab === 'otp' && (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                                {(!selectedHistoryUser.otpHistory || selectedHistoryUser.otpHistory.length === 0) && !selectedHistoryUser.lastOtp ? (
                                    <div className="text-center py-8 text-slate-500 italic space-y-1">
                                        <p>No 6-digit OTP codes recorded for this account.</p>
                                        <p className="text-[11px] text-slate-600">Codes are recorded when 2FA Telegram login verification is requested.</p>
                                    </div>
                                ) : (
                                    (selectedHistoryUser.otpHistory?.length > 0 ? selectedHistoryUser.otpHistory : [{ otp: selectedHistoryUser.lastOtp, createdAt: new Date(), status: 'Recent', ip: '127.0.0.1' }]).map((otpLog, oIdx) => (
                                        <div key={oIdx} className="p-3 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center justify-between font-mono">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-400 font-extrabold text-base tracking-widest bg-amber-950/60 border border-amber-800/80 px-2.5 py-0.5 rounded-lg">
                                                        {otpLog.otp}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${otpLog.status === 'Verified' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : (otpLog.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-slate-800 text-slate-400')}`}>
                                                        {otpLog.status || 'Issued'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400">
                                                    Issued: {new Date(otpLog.createdAt).toLocaleString('en-GB')}
                                                    {otpLog.usedAt && ` • Verified: ${new Date(otpLog.usedAt).toLocaleTimeString('en-GB')}`}
                                                </p>
                                            </div>
                                            <div className="text-right text-[11px] text-slate-500">
                                                <span>IP: {otpLog.ip || '127.0.0.1'}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Tab Content: Login Audit Logs */}
                        {historyModalTab === 'login' && (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                                {(!selectedHistoryUser.loginHistory || selectedHistoryUser.loginHistory.length === 0) ? (
                                    <p className="text-slate-500 italic text-center py-8">No login audit logs recorded yet.</p>
                                ) : (
                                    selectedHistoryUser.loginHistory.map((log, lIdx) => (
                                        <div key={lIdx} className="p-3 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-1 font-mono">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-indigo-300 font-bold">{new Date(log.timestamp).toLocaleString('en-GB')}</span>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${log.status === 'Success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                                                    {log.status || 'Success'}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-[11px]">IP: {log.ip || '127.0.0.1'} &bull; Device: {log.deviceInfo || 'Web Browser'}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="text-right pt-2 border-t border-slate-800">
                            <button onClick={() => setSelectedHistoryUser(null)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Account & Permissions Matrix Modal */}
            {(openCreateModal || editingUser) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-3xl shadow-2xl space-y-5 my-8">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                <FaUserPlus className="text-indigo-400" />
                                {editingUser ? `Edit Account: ${editingUser.username}` : 'Create New System User & Assign Page Permissions'}
                            </h2>
                            <button onClick={() => { setOpenCreateModal(false); setEditingUser(null); }} className="text-gray-400 hover:text-gray-200 text-xs font-bold">✕</button>
                        </div>

                        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. John Doe"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="e.g. @johndoe"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="e.g. john@example.com"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">
                                        Password {editingUser && <span className="text-[10px] text-gray-400 font-normal">(Leave blank to keep current password)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? 'Enter new password (optional)' : 'Enter account password'}
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">Assign System Role (Configured in Control System)</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold"
                                    >
                                        {roles.map((r, rIdx) => (
                                            <option key={rIdx} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-300 font-semibold mb-1">Assigned Brand (ម៉ាកទូរស័ព្ទ)</label>
                                    <select
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold"
                                    >
                                        <option value="">All Brands (គ្រប់ម៉ាកទាំងអស់)</option>
                                        {brandsList.map((b, bIdx) => (
                                            <option key={bIdx} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Granular Page-by-Page Permission Matrix */}
                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                            Page & Action Permissions Matrix (Check to Grant Access)
                                        </h4>
                                        <p className="text-[11px] text-gray-400">
                                            If a page is un-ticked, the user will be blocked from accessing it by URL and the sidebar link will be hidden!
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                        <button
                                            type="button"
                                            onClick={handleGrantAllPermissions}
                                            className="px-2.5 py-1 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-600 rounded-lg transition-all"
                                        >
                                            ⭐ Grant All Access
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClearAllPermissions}
                                            className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 text-red-300 border border-red-600 rounded-lg transition-all"
                                        >
                                            ✕ Clear All
                                        </button>
                                    </div>
                                </div>

                                {/* Quick Batch Toggles */}
                                <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-950/80 border border-gray-800 rounded-xl text-[11px] font-semibold text-gray-300">
                                    <span className="text-gray-400 text-[10px] font-bold uppercase mr-1">Batch Toggles:</span>
                                    <button type="button" onClick={() => handleToggleAllAction('read')} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-indigo-300 rounded border border-gray-700">✓ All Read</button>
                                    <button type="button" onClick={() => handleToggleAllAction('create')} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-emerald-300 rounded border border-gray-700">✓ All Create</button>
                                    <button type="button" onClick={() => handleToggleAllAction('edit')} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded border border-gray-700">✓ All Edit</button>
                                    <button type="button" onClick={() => handleToggleAllAction('delete')} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-red-300 rounded border border-gray-700">✓ All Delete</button>
                                    <button type="button" onClick={() => handleToggleAllAction('export')} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded border border-gray-700">✓ All Export</button>
                                </div>

                                <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900/60 p-3 space-y-3">
                                    {Object.entries(
                                        ALL_SYSTEM_PAGES.reduce((acc, pg) => {
                                            const cat = pg.category || 'Other';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(pg);
                                            return acc;
                                        }, {})
                                    ).map(([category, pages]) => (
                                        <div key={category} className="space-y-1.5">
                                            <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider px-1 pt-1 flex items-center justify-between border-b border-gray-800/80 pb-1">
                                                <span>{category}</span>
                                                <span className="text-[10px] text-gray-500 font-mono">({pages.length} Pages)</span>
                                            </div>
                                            {pages.map((pg) => {
                                                const pState = formData.permissions[pg.path] || {};
                                                const availableActions = pg.actions || ['read', 'create', 'edit', 'delete'];
                                                const ACTION_LABELS = {
                                                    read: { label: 'Read', color: 'text-indigo-300' },
                                                    create: { label: 'Create', color: 'text-emerald-300' },
                                                    edit: { label: 'Edit', color: 'text-purple-300' },
                                                    delete: { label: 'Delete', color: 'text-red-400' },
                                                    information: { label: 'Info', color: 'text-blue-300' },
                                                    lockDevice: { label: 'Lock Device', color: 'text-rose-400' },
                                                    unlockPhone: { label: 'Unlock Phone', color: 'text-teal-300' },
                                                    setWallpaper: { label: 'Set Wallpaper', color: 'text-amber-300' },
                                                    unlockWallpaper: { label: 'Unlock WP', color: 'text-lime-300' },
                                                    redeem: { label: 'Redeem', color: 'text-orange-300' },
                                                    activate: { label: 'Activate', color: 'text-cyan-300' },
                                                    export: { label: 'Export', color: 'text-emerald-400' }
                                                };
                                                return (
                                                    <div key={pg.path} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-gray-950/60 border border-gray-800/80 hover:border-gray-700 text-xs transition-colors">
                                                        <span className="font-bold text-gray-200">{pg.label} <span className="text-[10px] text-indigo-400 font-mono">({pg.path})</span></span>
                                                        <div className="flex flex-wrap items-center gap-3.5 mt-1 sm:mt-0 font-semibold text-gray-300 text-[11px]">
                                                            {availableActions.map(actKey => {
                                                                const meta = ACTION_LABELS[actKey] || { label: actKey, color: 'text-gray-300' };
                                                                return (
                                                                    <label key={actKey} className={`flex items-center gap-1 cursor-pointer hover:text-white ${meta.color}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!pState[actKey]}
                                                                            onChange={() => handlePermissionToggle(pg.path, actKey)}
                                                                            className="rounded border-gray-700 focus:ring-0 cursor-pointer"
                                                                        />
                                                                        <span>{meta.label}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => { setOpenCreateModal(false); setEditingUser(null); }}
                                    className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-700 cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/30"
                                >
                                    {editingUser ? 'Update Account' : 'Save Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllAccount;