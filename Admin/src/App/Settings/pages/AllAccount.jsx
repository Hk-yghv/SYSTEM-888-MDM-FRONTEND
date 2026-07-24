import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaShieldAlt, FaUserPlus, FaLock, FaTelegramPlane, FaHistory } from 'react-icons/fa';
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
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);

    // New User Form State
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'Staff',
        permissions: {}
    });

    const fetchUsers = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/users`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
            const cRes = await fetch(`${API_BASE}/controlsystem`);
            if (cRes.ok) {
                const cData = await cRes.json();
                if (cData.roles) setRoles(cData.roles);
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

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl'>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100 flex items-center gap-2'>
                            {t('allAccount')} & Role-Based Permissions (RBAC)
                        </h1>
                        <p className='text-xs text-indigo-400 font-semibold'>
                            Manage system users, login history, Telegram 2FA codes, and page-level permission matrices
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <button
                        onClick={() => setOpenCreateModal(true)}
                        className='flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/30 transition-all'
                    >
                        <FaUserPlus size={14} />
                        <p>{t('create')} Account</p>
                    </button>

                    <button
                        onClick={fetchUsers}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Users Table */}
            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('username')} & ID</th>
                            <th className='px-4 py-3'>Full Name & Email</th>
                            <th className='px-4 py-3 text-center'>{t('role')}</th>
                            <th className='px-4 py-3 text-center'>Status</th>
                            <th className='px-4 py-3 text-center'>Last OTP Code</th>
                            <th className='px-4 py-3 text-center'>Login History</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {users.map((item, idx) => {
                            const isMaster = item.isImmutable || item.username === '@hakyonghouv';
                            return (
                                <tr key={item._id || idx} className={`hover:bg-gray-800/40 transition-colors ${isMaster ? 'bg-indigo-950/20' : ''}`}>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{idx + 1}</td>
                                    <td className='px-4 py-3'>
                                        <span className='font-bold text-indigo-300 font-mono block'>{item.username}</span>
                                        <span className='text-[10px] text-gray-400 font-mono block'>ID: {item.userId || '001290312'}</span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='font-bold text-gray-100 block'>{item.name}</span>
                                        <span className='text-gray-400 font-mono text-[11px] block'>{item.email}</span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase border ${isMaster ? 'bg-purple-950 text-purple-300 border-purple-700' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                                            {item.role || 'Staff'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center justify-center gap-1 w-20 mx-auto ${item.status === 'Online' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Online' ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`}></span>
                                            {item.status || 'Offline'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-center font-mono text-xs text-amber-400 font-bold'>
                                        {item.lastOtp ? (
                                            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800">{item.lastOtp}</span>
                                        ) : (
                                            <span className="text-gray-600 font-normal text-[10px]">-</span>
                                        )}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <button
                                            onClick={() => setSelectedHistoryUser(item)}
                                            className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-indigo-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 mx-auto cursor-pointer"
                                        >
                                            <FaHistory /> View
                                        </button>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        {isMaster ? (
                                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                                                <FaLock size={9} /> Immutable Master Admin
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleDeleteUser(item)}
                                                className="p-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg cursor-pointer transition-all"
                                                title="Delete Account"
                                            >
                                                <MdDelete size={16} />
                                            </button>
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

            {/* Create Account & Permissions Matrix Modal */}
            {openCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-3xl shadow-2xl space-y-5 my-8">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                <FaUserPlus className="text-indigo-400" />
                                Create New System User & Assign Page Permissions
                            </h2>
                            <button onClick={() => setOpenCreateModal(false)} className="text-gray-400 hover:text-gray-200 text-xs font-bold">✕</button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
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
                                    <label className="block text-gray-300 font-semibold mb-1">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Enter account password"
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-gray-300 font-semibold mb-1">Assign System Role (Configured in Control System)</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                    >
                                        {roles.map((r, rIdx) => (
                                            <option key={rIdx} value={r}>{r}</option>
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
                                    onClick={() => setOpenCreateModal(false)}
                                    className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-700 cursor-pointer"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/30"
                                >
                                    Save Account
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