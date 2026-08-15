import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaShieldAlt, FaUserPlus, FaLock, FaTelegramPlane, FaHistory, FaBan, FaUnlock } from 'react-icons/fa';
import { MdOutlineSync, MdDelete, MdEdit } from 'react-icons/md';

const ALL_SYSTEM_PAGES = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/customer', label: 'Customer' },
    { path: '/device', label: 'Device' },
    { path: '/contract/application', label: 'Contract Application' },
    { path: '/contract/activated', label: 'Contract Activated' },
    { path: '/contract/check', label: 'Contract Check' },
    { path: '/contract/redeem', label: 'Contract Redeem' },
    { path: '/contract/comments', label: 'Contract Comments' },
    { path: '/contract/blacklist', label: 'Contract Blacklist' },
    { path: '/installment/paymentHistory', label: 'Payment History' },
    { path: '/lostphone/actions', label: 'Lost Phone Actions' },
    { path: '/lostphone/lockphone', label: 'Lock Phone Log' },
    { path: '/lostphone/unlockphone', label: 'Unlock Phone Log' },
    { path: '/wallpaper/actions', label: 'Wallpaper Actions' },
    { path: '/wallpaper/lockphone', label: 'Lock Wallpaper Log' },
    { path: '/wallpaper/unlockphone', label: 'Unlock Wallpaper Log' },
    { path: '/settings/all-account', label: 'All Account Management' },
    { path: '/settings/control-system', label: 'Control System Settings' }
];

const AllAccount = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState(['Administrator', 'Manager', 'Staff', 'Viewer']);
    const [brandsList, setBrandsList] = useState([['MDM', 'ECloud']]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);

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
    }, []);

    const handlePermissionToggle = (path, action) => {
        setFormData(prev => {
            const currentPerms = prev.permissions[path] || { read: false, edit: false, create: false, delete: false };
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
                    <button
                        onClick={() => setOpenCreateModal(true)}
                        className='flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all'
                    >
                        <FaUserPlus size={14} />
                        <p>{t('create')} Account</p>
                    </button>

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
                                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1 w-20 mx-auto ${item.status === 'Online' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Online' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                                            {item.status || 'Offline'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-center font-mono text-xs text-amber-700 font-bold'>
                                        {item.lastOtp ? (
                                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800">{item.lastOtp}</span>
                                        ) : (
                                            <span className="text-slate-400 font-normal text-[10px]">-</span>
                                        )}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <button
                                            onClick={() => setSelectedHistoryUser(item)}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 mx-auto cursor-pointer transition-all"
                                        >
                                            <FaHistory /> View
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
                                                <button
                                                    onClick={() => handleOpenEditUserModal(item)}
                                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-lg cursor-pointer transition-all text-[11px] font-bold flex items-center gap-1 px-2"
                                                    title="Edit User Info & Permissions"
                                                >
                                                    <MdEdit size={14} /> Edit
                                                </button>
                                                {/* Block / Unblock */}
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
                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDeleteUser(item)}
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-lg cursor-pointer transition-all"
                                                    title="Delete Account"
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Login History Modal */}
            {selectedHistoryUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                                <FaHistory className="text-indigo-400" />
                                Login History for {selectedHistoryUser.username}
                            </h3>
                            <button onClick={() => setSelectedHistoryUser(null)} className="text-gray-400 hover:text-gray-200 text-xs font-bold">✕</button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
                            {(!selectedHistoryUser.loginHistory || selectedHistoryUser.loginHistory.length === 0) ? (
                                <p className="text-gray-500 italic text-center py-4">No login history recorded yet.</p>
                            ) : (
                                selectedHistoryUser.loginHistory.map((log, lIdx) => (
                                    <div key={lIdx} className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl space-y-0.5 font-mono">
                                        <p className="text-indigo-300 font-bold">{new Date(log.timestamp).toLocaleString()}</p>
                                        <p className="text-gray-400 text-[11px]">IP: {log.ip || '127.0.0.1'} &bull; {log.deviceInfo}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="text-right pt-2">
                            <button onClick={() => setSelectedHistoryUser(null)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Close</button>
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
                            <div className="space-y-2 pt-2 border-t border-gray-800">
                                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                    Page & Action Permissions Matrix (Check to Grant Access)
                                </h4>
                                <p className="text-[11px] text-gray-400">
                                    If a page is un-ticked, the user will be blocked from accessing it by URL and the sidebar link will be completely hidden!
                                </p>

                                <div className="max-h-60 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900/60 p-3 space-y-2">
                                    {ALL_SYSTEM_PAGES.map((pg) => {
                                        const pState = formData.permissions[pg.path] || { read: false, edit: false, create: false, delete: false };
                                        return (
                                            <div key={pg.path} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-gray-950/60 border border-gray-800 text-xs">
                                                <span className="font-bold text-gray-200">{pg.label} <span className="text-[10px] text-indigo-400 font-mono">({pg.path})</span></span>
                                                <div className="flex items-center gap-4 mt-1 sm:mt-0 font-semibold text-gray-300">
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!pState.read}
                                                            onChange={() => handlePermissionToggle(pg.path, 'read')}
                                                            className="rounded border-gray-700 text-indigo-600 focus:ring-0"
                                                        />
                                                        Read
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!pState.create}
                                                            onChange={() => handlePermissionToggle(pg.path, 'create')}
                                                            className="rounded border-gray-700 text-indigo-600 focus:ring-0"
                                                        />
                                                        Create
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!pState.edit}
                                                            onChange={() => handlePermissionToggle(pg.path, 'edit')}
                                                            className="rounded border-gray-700 text-indigo-600 focus:ring-0"
                                                        />
                                                        Edit
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer text-red-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!pState.delete}
                                                            onChange={() => handlePermissionToggle(pg.path, 'delete')}
                                                            className="rounded border-gray-700 text-indigo-600 focus:ring-0"
                                                        />
                                                        Delete
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
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