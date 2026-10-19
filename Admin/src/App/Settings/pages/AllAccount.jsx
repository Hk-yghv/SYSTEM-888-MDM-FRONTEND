import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaShieldAlt,
    FaUserPlus,
    FaLock,
    FaTelegramPlane,
    FaHistory,
    FaBan,
    FaUnlock,
    FaCheckCircle,
    FaExclamationTriangle,
    FaTimes,
    FaSave,
    FaArrowRight,
    FaArrowLeft,
    FaEye,
    FaDesktop,
    FaUserCheck,
    FaCheck,
    FaSyncAlt
} from 'react-icons/fa';
import { MdOutlineSync, MdDelete, MdEdit, MdCheckCircle } from 'react-icons/md';
import { CONTROL_SYSTEM_SECTIONS } from '../../../utils/controlSystemPermissions';

const ALL_SYSTEM_PAGES = [
    { category: 'Main Systems', path: '/dashboard', label: 'Dashboard Analysis', actions: ['read', 'export'] },
    { category: 'Main Systems', path: '/cashflow/monitor', label: 'Cash Flow Trader (លំហូរសាច់ប្រាក់)', actions: ['read', 'export'] },
    { category: 'Main Systems', path: '/customer', label: 'Customer Directory', actions: ['read', 'export', 'seePhoto', 'detail', 'qrcode'] },
    { category: 'Main Systems', path: '/device', label: 'Device List & Actions', actions: ['read', 'export', 'information', 'deviceAction'] },
    { category: 'Main Systems', path: '/device/enrolment', label: 'Device Enrolment (Phone Models)', actions: ['read', 'information'] },
    { category: 'Main Systems', path: '/telegram', label: 'Telegram Web (Multi-Account)', actions: ['read'] },

    { category: 'Contract Management', path: '/contract/application', label: 'Contract Application', actions: ['read', 'export', 'create', 'edit', 'delete', 'information', 'activate'] },
    { category: 'Contract Management', path: '/contract/activated', label: 'Contract Activated', actions: ['read', 'export', 'openFacebook', 'history', 'comment', 'lockDevice', 'setWallpaper', 'check', 'blacklist'] },
    { category: 'Contract Management', path: '/contract/check', label: 'Contract Check', actions: ['read', 'export', 'edit', 'delete'] },
    { category: 'Contract Management', path: '/contract/redeem', label: 'Contract Redeem', actions: ['read', 'export', 'edit', 'delete'] },
    { category: 'Contract Management', path: '/contract/comments', label: 'Contract Comments', actions: ['read', 'export', 'create', 'edit', 'delete', 'information'] },
    { category: 'Contract Management', path: '/contract/blacklist', label: 'Contract Blacklist', actions: ['read', 'export', 'create', 'edit', 'delete'] },
    { category: 'Calculation & Tools', path: '/calculate/schedule-1', label: 'Calculate Schedule 1', actions: ['read', 'export'] },
    { category: 'Calculation & Tools', path: '/calculate/schedule-2', label: 'Calculate Schedule 2', actions: ['read', 'export', 'create', 'edit', 'delete'] },
    { category: 'Calculation & Tools', path: '/calendar', label: 'Khmer Calendar', actions: ['read', 'create', 'edit', 'delete'] },

    { category: 'Installment & Payment', path: '/installment/schedule', label: 'Installment Schedule', actions: ['read', 'edit', 'export'] },
    { category: 'Installment & Payment', path: '/installment/pad', label: 'Installment Pad', actions: ['read', 'edit', 'export'] },
    { category: 'Installment & Payment', path: '/installment/history', label: 'Installment History', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/paymentHistory', label: 'Payment History', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Installment & Payment', path: '/installment/cash-out', label: 'Cash Out', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Installment & Payment', path: '/installment/penalty', label: 'Penalty', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue', label: 'Overdue Customers', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/due-today', label: 'Due Today', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/due-in-3-days', label: 'Due In 3 Days', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue-3-days', label: 'Overdue 3 Days', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/unpaid-yesterday', label: 'Unpaid Yesterday', actions: ['read', 'export'] },
    { category: 'Installment & Payment', path: '/installment/overdue-7-days', label: 'Overdue 7 Days', actions: ['read', 'export'] },

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
    { category: 'Reports & Analytics', path: '/report/follow-up', label: 'Follow Up Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/report/follow-up-4', label: 'Follow Up 4 Report', actions: ['read', 'export'] },
    { category: 'Reports & Analytics', path: '/audit/telegram/report', label: 'Report Audit Telegram (របាយការណ៍ Audit)', actions: ['read', 'export'] },

    { category: 'Audit & History Logs', path: '/history/login-history', label: 'Login History Log', actions: ['read', 'export'] },
    { category: 'Audit & History Logs', path: '/history/device-history', label: 'Device Action Log', actions: ['read', 'export'] },

    { category: 'Follow Up System', path: '/follow-up/follow-up-1', label: 'Follow Up 1', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/follow-up-2', label: 'Follow up 2 (បញ្ចាំ & ឆ្លើយតបឆាត)', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/follow-up-3', label: 'Follow Up 3', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    { category: 'Follow Up System', path: '/follow-up/follow-up-4', label: 'Follow up 4 (Follow Up 4 System)', actions: ['read', 'create', 'edit', 'delete', 'export'] },

    { category: 'Salary System', path: '/salary', label: 'Salary Management (គ្រប់គ្រងប្រាក់ខែ)', actions: ['read', 'create', 'edit', 'delete', 'export'] },

    { category: 'Tools & Utilities', path: '/save-url', label: 'Save URL (រក្សាទុក URL)', actions: ['read', 'create', 'edit', 'delete'] },
    { category: 'Audit System', path: '/audit/telegram', label: 'Audit Telegram (សវនកម្មតេឡេក្រាម)', actions: ['read', 'create', 'edit', 'delete', 'export'] },

    { category: 'Print System', path: '/print/id-card', label: 'Print ID Card (A4 ព្រីនកាតសម្គាល់ខ្លួន)', actions: ['read', 'print'] },

    { category: 'Support & Help', path: '/help-support', label: 'Help & Support (មជ្ឈមណ្ឌលជំនួយ)', actions: ['read'] },
    { category: 'Support & Help', path: '/settings/control-support-help', label: 'Control Support & Help (គ្រប់គ្រងជំនួយ)', actions: ['read', 'create', 'edit', 'delete'] },

    { category: 'Media Management', path: '/all-picture', label: 'All Picture (Cloudinary)', actions: ['read', 'delete'] },

    { category: 'Settings & Profile', path: '/profile', label: 'User Profile', actions: ['read', 'edit'] },
    { category: 'Settings & Profile', path: '/settings/all-account', label: 'All Account Management', actions: ['read', 'create', 'edit', 'delete'] },
    ...CONTROL_SYSTEM_SECTIONS.map(section => ({
        category: 'Control System',
        path: section.path,
        label: section.label,
        actions: ['read', 'create', 'edit', 'delete']
    }))
];

const PERMISSION_CATEGORY_KEYS = {
    'Main Systems': 'permissionCategory_mainSystems',
    'Contract Management': 'permissionCategory_contractManagement',
    'Calculation & Tools': 'permissionCategory_calculationTools',
    'Installment & Payment': 'permissionCategory_installmentPayment',
    'Lost Phone Control': 'permissionCategory_lostPhoneControl',
    'Wallpaper Control': 'permissionCategory_wallpaperControl',
    'Reports & Analytics': 'permissionCategory_reportsAnalytics',
    'Audit & History Logs': 'permissionCategory_auditHistoryLogs',
    'Follow Up System': 'permissionCategory_followUpSystem',
    'Salary System': 'permissionCategory_salarySystem',
    'Tools & Utilities': 'permissionCategory_toolsUtilities',
    'Audit System': 'permissionCategory_auditSystem',
    'Print System': 'permissionCategory_printSystem',
    'Support & Help': 'permissionCategory_supportHelp',
    'Media Management': 'permissionCategory_mediaManagement',
    'Settings & Profile': 'permissionCategory_settingsProfile',
    'Control System': 'controlSystem'
};

const PERMISSION_ACTION_KEYS = {
    read: 'permissionAction_read',
    export: 'export',
    create: 'create',
    edit: 'edit',
    delete: 'delete',
    seePhoto: 'seePhoto',
    detail: 'permissionAction_detail',
    qrcode: 'permissionAction_qrcode',
    information: 'information',
    deviceAction: 'permissionAction_deviceAction',
    activate: 'permissionAction_activate',
    openFacebook: 'openFacebook',
    history: 'history',
    comment: 'permissionAction_comment',
    lockDevice: 'permissionAction_lockDevice',
    setWallpaper: 'permissionAction_setWallpaper',
    check: 'check',
    blacklist: 'blacklist',
    unlockPhone: 'unlockPhone',
    unlockWallpaper: 'permissionAction_unlockWallpaper',
    print: 'print'
};

const AllAccount = () => {
    const { t } = useLanguage();
    const { API_BASE, hasPermission } = useAuth();
    const getPermissionPageLabel = (page) => {
        const key = `permissionPage_${page.path.replace(/^\/+/, '').replace(/[/-]/g, '_')}`;
        const label = t(key);
        return label === key ? page.label : label;
    };
    const getPermissionCategoryLabel = (category) => {
        const key = PERMISSION_CATEGORY_KEYS[category];
        if (!key) return category;
        const label = t(key);
        return label === key ? category : label;
    };
    const getPermissionActionLabel = (action) => {
        const key = PERMISSION_ACTION_KEYS[action] || `permissionAction_${action}`;
        const label = t(key);
        return label === key ? action : label;
    };

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState(['Administrator', 'Manager', 'Staff', 'Viewer', 'Salary']);
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);
    const [brandSubbrandsMap, setBrandSubbrandsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    // Selected account for detail view
    const [selectedAccount, setSelectedAccount] = useState(null);

    // Wizard modal state: step 1 = info, step 2 = permissions, step 3 = preview & test
    const [modalStep, setModalStep] = useState(1);
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [previewSelectedPage, setPreviewSelectedPage] = useState('/dashboard');

    // Audit History Modal
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);
    const [historyModalTab, setHistoryModalTab] = useState('online');

    // Custom Alert / Confirm Dialog state (No browser popups!)
    const [customDialog, setCustomDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm', // 'confirm' | 'alert' | 'danger'
        confirmText: t('confirmAction'),
        cancelText: t('cancel'),
        onConfirm: null
    });

    const showConfirm = (title, message, onConfirm, type = 'confirm') => {
        setCustomDialog({
            isOpen: true,
            title,
            message,
            type,
            confirmText: type === 'danger' ? t('delete') : t('confirmAction'),
            cancelText: t('cancel'),
            onConfirm: () => {
                setCustomDialog(prev => ({ ...prev, isOpen: false }));
                if (onConfirm) onConfirm();
            }
        });
    };

    const showAlert = (title, message, type = 'alert') => {
        setCustomDialog({
            isOpen: true,
            title,
            message,
            type,
            confirmText: t('confirmAction'),
            cancelText: '',
            onConfirm: () => setCustomDialog(prev => ({ ...prev, isOpen: false }))
        });
    };

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

    const getSalaryPermissions = () => {
        const salaryPage = ALL_SYSTEM_PAGES.find(pg => pg.path === '/salary');
        const salaryActions = salaryPage?.actions || ['read', 'create', 'edit', 'delete', 'export'];
        const salaryPerms = {};
        salaryActions.forEach(act => {
            salaryPerms[act] = true;
        });
        return { '/salary': salaryPerms };
    };

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'Staff',
        brand: '',
        subBrands: [],
        permissions: {}
    });

    const handleRoleChange = (newRole) => {
        const isSalary = newRole?.toLowerCase() === 'salary';
        if (isSalary) {
            setFormData(prev => ({
                ...prev,
                role: newRole,
                brand: '',
                subBrands: [],
                permissions: getSalaryPermissions()
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                role: newRole
            }));
        }
    };

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setModalStep(1);
        setFormData({
            name: '',
            username: '',
            email: '',
            password: '',
            role: 'Staff',
            brand: '',
            subBrands: [],
            permissions: {}
        });
        setOpenCreateModal(true);
    };

    const handleOpenEditUserModal = (userObj) => {
        if (userObj.isImmutable || userObj.username === '@hakyonghouv') {
            showAlert(t('protectedMasterAdmin'), t('protectedMasterAdminEditMessage'), 'danger');
            return;
        }
        const isSalary = userObj.role?.toLowerCase() === 'salary';
        setEditingUser(userObj);
        setModalStep(1);
        setFormData({
            name: userObj.name || '',
            username: userObj.username || '',
            email: userObj.email || '',
            password: '',
            role: userObj.role || 'Staff',
            brand: isSalary ? '' : (userObj.brand || ''),
            subBrands: isSalary ? [] : (userObj.subBrands || []),
            permissions: isSalary
                ? (userObj.permissions && Object.keys(userObj.permissions).length > 0 ? userObj.permissions : getSalaryPermissions())
                : (userObj.permissions || {})
        });
    };

    const fetchUsers = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/users`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
                // Also update selectedAccount if viewing
                setSelectedAccount(prev => {
                    if (!prev) return null;
                    return data.find(u => u._id === prev._id || u.username === prev.username) || prev;
                });
            }
            const cRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (cRes.ok) {
                const cData = await cRes.json();
                if (cData.roles) {
                    const rSet = new Set([...cData.roles, 'Salary']);
                    setRoles(Array.from(rSet));
                }
                const brandCat = cData.droplists?.find(d => d.category === 'Brands');
                if (brandCat && Array.isArray(brandCat.items)) setBrandsList(brandCat.items);
                if (cData.brand_subbrands) setBrandSubbrandsMap(cData.brand_subbrands);
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
                .then(data => {
                    if (data) {
                        setUsers(data);
                        setSelectedAccount(prev => {
                            if (!prev) return null;
                            return data.find(u => u._id === prev._id || u.username === prev.username) || prev;
                        });
                    }
                })
                .catch(() => { });
        }, 3000);
        return () => clearInterval(pollInterval);
    }, [API_BASE]);

    // iOS style page toggle switch (On / Off)
    const handleTogglePageSwitch = (page) => {
        setFormData(prev => {
            const currentPerms = prev.permissions[page.path] || {};
            const isCurrentlyEnabled = Object.values(currentPerms).some(Boolean);

            const updated = { ...prev.permissions };
            if (isCurrentlyEnabled) {
                // Turn completely off
                delete updated[page.path];
            } else {
                // Turn on with read and standard actions enabled by default
                const newActions = {};
                (page.actions || ['read']).forEach(act => {
                    newActions[act] = true;
                });
                updated[page.path] = newActions;
            }
            return { ...prev, permissions: updated };
        });
    };

    // Granular action toggle
    const handleActionToggle = (path, action) => {
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
        const isSalary = formData.role?.toLowerCase() === 'salary';
        if (isSalary) {
            setFormData(prev => ({
                ...prev,
                permissions: getSalaryPermissions()
            }));
            return;
        }
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
        const isSalary = formData.role?.toLowerCase() === 'salary';
        const pagesToUse = isSalary ? ALL_SYSTEM_PAGES.filter(pg => pg.path === '/salary') : ALL_SYSTEM_PAGES;
        setFormData(prev => {
            const relevantPages = pagesToUse.filter(pg => (pg.actions || ['read', 'create', 'edit', 'delete']).includes(action));
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

    const handleCreateUser = async () => {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setOpenCreateModal(false);
                setModalStep(1);
                fetchUsers();
                showAlert(t('success'), `${t('userAccountCreated')}: "${formData.username}"`, 'alert');
            } else {
                const data = await res.json();
                showAlert(t('failed'), data.error || t('userAccountCreateFailed'), 'danger');
            }
        } catch (err) {
            console.error('Create user error:', err);
            showAlert(t('error'), err.message || t('userAccountCreateFailed'), 'danger');
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        try {
            const payload = {
                ...formData,
                syncStatus: 'Pending',
                permissionPending: true
            };

            const res = await fetch(`${API_BASE}/users/${editingUser._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setEditingUser(null);
                setModalStep(1);
                fetchUsers();
                showAlert(t('accountSavedSuccessfully'), `${t('userAccountUpdated')}: "${formData.username}" — ${t('permissionsWillSyncOnLogin')}`, 'alert');
            } else {
                const data = await res.json();
                showAlert(t('failed'), data.error || t('userAccountUpdateFailed'), 'danger');
            }
        } catch (err) {
            console.error('Update user error:', err);
            showAlert(t('error'), err.message || t('userAccountUpdateFailed'), 'danger');
        }
    };

    const handleDeleteUser = (userObj) => {
        if (userObj.isImmutable || userObj.username === '@hakyonghouv') {
            showAlert(t('protectedMasterAdmin'), t('protectedMasterAdminDeleteMessage'), 'danger');
            return;
        }

        showConfirm(
            t('deleteAccount'),
            `${t('confirmDeleteUserMessage')} "${userObj.username}" (${userObj.name || ''})? ${t('cannotUndoAction')}`,
            async () => {
                try {
                    const res = await fetch(`${API_BASE}/users/${userObj._id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchUsers();
                        showAlert(t('success'), `${t('userAccountDeleted')}: ${userObj.username}`, 'alert');
                    } else {
                        const data = await res.json();
                        showAlert(t('failed'), data.error || t('deleteFailed'), 'danger');
                    }
                } catch (err) {
                    console.error('Delete user error:', err);
                }
            },
            'danger'
        );
    };

    const handleToggleBlock = (userObj) => {
        const willBlock = !userObj.isBlocked;
        const title = willBlock ? t('blockAccount') : t('unblockAccount');
        const msg = willBlock
            ? `${t('confirmBlockAccountMessage')} "${userObj.username}"? ${t('accountWillLogOutImmediately')}`
            : `${t('confirmUnblockAccountMessage')} "${userObj.username}"? ${t('accountCanLogInAgain')}`;

        showConfirm(title, msg, async () => {
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
                    showAlert(t('failed'), data.error || t('blockActionFailed'), 'danger');
                }
            } catch (err) {
                console.error('Block toggle error:', err);
            }
        }, willBlock ? 'danger' : 'confirm');
    };

    // Calculate granted pages count for preview
    const grantedPages = ALL_SYSTEM_PAGES.filter(pg => {
        const pState = formData.permissions[pg.path];
        return pState && Object.values(pState).some(Boolean);
    });

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            {/* Header */}
            <header className='p-2.5 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div>
                    <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                        {t('accountRoleBasedPermissions')}
                    </h1>
                </div>

                <div className='flex items-center gap-3'>
                    {hasPermission('/settings/all-account', 'create') && (
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className='flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all'
                        >
                            <FaUserPlus size={14} />
                            <span>{t('createAccount')}</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Account Cards Grid — shown when no account is selected */}
            {!selectedAccount ? (
                <div className='w-full'>
                    {loading ? (
                        <div className='flex items-center justify-center py-20 text-slate-400 italic text-sm'>{t('loading')}</div>
                    ) : (
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                            {users.map((item, idx) => {
                                const isMaster = item.isImmutable || item.username === '@hakyonghouv';
                                const isBlocked = !!item.isBlocked;
                                const isSalary = item.role?.toLowerCase() === 'salary';
                                const isPendingSync = item.syncStatus === 'Pending' || item.permissionPending;

                                return (
                                    <div
                                        key={item._id || idx}
                                        onClick={() => setSelectedAccount(item)}
                                        className={`relative cursor-pointer rounded-[5px] border p-3 flex flex-col gap-3 shadow-xs transition-all hover:shadow-lg hover:-translate-y-0.5 select-none
                                            ${isMaster ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-300' : isBlocked ? 'bg-red-50/70 border-red-300' : 'bg-white border-slate-200 hover:border-emerald-400'}`}
                                    >
                                        {/* Status badges */}
                                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                                            {isPendingSync && (
                                                <span className='text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1 animate-pulse' title={t('pendingPermissionSyncTitle')}>
                                                    ⏳ {t('pending')}
                                                </span>
                                            )}
                                            {isMaster && (
                                                <span className='text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 flex items-center gap-1'>
                                                    <FaLock size={8} /> {t('masterAdmin')}
                                                </span>
                                            )}
                                            {isBlocked && !isMaster && (
                                                <span className='text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300'>{t('blocked')}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className='flex items-center gap-3'>
                                            <div className={`w-12 h-12 rounded-[5px] flex items-center justify-center text-xl font-black text-white shadow-md
                                                ${isMaster ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : isSalary ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-500 to-slate-700'}`}>
                                                {(item.name || item.username || '?')[0].toUpperCase()}
                                            </div>
                                            <div className='flex-1 min-w-0 pr-14'>
                                                <p className='text-sm font-black text-slate-900 truncate'>{item.name || '—'}</p>
                                                <p className='text-[11px] text-emerald-600 font-mono truncate'>{item.username}</p>
                                            </div>
                                        </div>

                                        {/* Role & Brand */}
                                        <div className='flex items-center gap-2 flex-wrap'>
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border
                                                ${isMaster ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {item.role || 'Staff'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border
                                                ${isSalary ? 'bg-purple-50 text-purple-700 border-purple-200' : item.brand ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {isSalary ? t('noBrand') : item.brand || t('allBrands')}
                                            </span>
                                            {item.subBrands && item.subBrands.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-sky-50 text-sky-700 border border-sky-200">
                                                    {item.subBrands.length} {t('subBrands')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className='flex items-center justify-between text-[11px] pt-1 border-t border-slate-100'>
                                            <span className={`flex items-center gap-1.5 font-bold ${item.status === 'Online' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${item.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                                {item.status === 'Online' ? t('online') : t('offline')}
                                            </span>
                                            <span className='text-slate-400 font-mono text-[10px]'>ID: {item.userId || '—'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* Account Detail Panel — Structured, categorized permissions view */
                <div className='w-full bg-white border border-slate-200 rounded-[5px] shadow-md overflow-hidden flex flex-col h-[calc(100vh-140px)]'>
                    {/* Detail Header */}
                    <div className='flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50 shrink-0'>
                        <div className='flex items-center gap-3'>
                            <button
                                type="button"
                                onClick={() => setSelectedAccount(null)}
                                className='flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:text-slate-900 rounded-[5px] text-xs font-bold cursor-pointer shadow-xs transition-all'
                            >
                                ← {t('back')}
                            </button>
                            <div className={`w-10 h-10 rounded-[5px] flex items-center justify-center text-lg font-black text-white shadow-md
                                ${selectedAccount.isImmutable ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : selectedAccount.role?.toLowerCase() === 'salary' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-500 to-slate-700'}`}>
                                {(selectedAccount.name || selectedAccount.username || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className='text-sm font-black text-slate-900'>{selectedAccount.name}</p>
                                    {(selectedAccount.syncStatus === 'Pending' || selectedAccount.permissionPending) ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                                            ⏳ {t('pending')} {t('liveSync')}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                                            <FaCheck className="text-[9px]" /> {t('synced')}
                                        </span>
                                    )}
                                </div>
                                <p className='text-[11px] text-emerald-600 font-mono'>
                                    {selectedAccount.username} &bull; {selectedAccount.role} &bull; {selectedAccount.brand || t('noBrand')}
                                    {selectedAccount.subBrands && selectedAccount.subBrands.length > 0 && (
                                        <span className="ml-2 text-sky-600 font-semibold font-sans">
                                            &bull; {t('subBrands')}: [{selectedAccount.subBrands.join(', ')}]
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className='flex items-center gap-2'>
                            {!selectedAccount.isImmutable && selectedAccount.username !== '@hakyonghouv' && (
                                <>
                                    {hasPermission('/settings/all-account', 'edit') && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditUserModal(selectedAccount)}
                                            className='flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all'
                                        >
                                            <MdEdit size={14} /> {t('edit')}
                                        </button>
                                    )}
                                    {hasPermission('/settings/all-account', 'edit') && (
                                        <button
                                            type="button"
                                            onClick={() => handleToggleBlock(selectedAccount)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-[5px] text-xs font-bold cursor-pointer transition-all
                                                ${selectedAccount.isBlocked ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-orange-50 border-orange-300 text-orange-700'}`}
                                        >
                                            {selectedAccount.isBlocked ? <><FaUnlock size={11} /> {t('unblock')}</> : <><FaBan size={11} /> {t('block')}</>}
                                        </button>
                                    )}
                                    {hasPermission('/settings/all-account', 'delete') && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteUser(selectedAccount)}
                                            className='flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all'
                                        >
                                            <MdDelete size={14} /> {t('delete')}
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => { setSelectedHistoryUser(selectedAccount); setHistoryModalTab('online'); }}
                                className='flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-700 rounded-[5px] text-xs font-bold cursor-pointer transition-all'
                            >
                                <FaHistory size={12} /> Audit History
                            </button>
                        </div>
                    </div>

                    {/* Permissions Summary — Structured by System Categories, Internal Scrollable */}
                    <div className='p-4 text-xs flex-1 flex flex-col overflow-hidden min-h-0'>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 shrink-0">
                            <h3 className='text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2'>
                                <FaShieldAlt className="text-emerald-600" />
                                <span>{t('pageAndActionPermissions')}</span>
                            </h3>
                            <span className="text-[11px] font-bold text-slate-500">
                                {t('enabledPermissions')}: {Object.keys(selectedAccount.permissions || {}).length} {t('pagesCountLabel')}
                            </span>
                        </div>

                        {(!selectedAccount.permissions || Object.keys(selectedAccount.permissions).length === 0) ? (
                            <p className="text-slate-400 italic py-4">{t('allPagesDisabled')}</p>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-1.5 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {Object.entries(
                                        ALL_SYSTEM_PAGES.reduce((acc, pg) => {
                                            const pPerms = selectedAccount.permissions?.[pg.path];
                                            const granted = pPerms ? Object.entries(pPerms).filter(([, v]) => v).map(([k]) => k) : [];
                                            if (granted.length > 0) {
                                                const cat = pg.category || 'Other';
                                                if (!acc[cat]) acc[cat] = [];
                                                acc[cat].push({ ...pg, granted });
                                            }
                                            return acc;
                                        }, {})
                                    ).map(([category, pages]) => (
                                        <div key={category} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                                            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                                <span className="font-bold text-slate-800 text-xs">{getPermissionCategoryLabel(category)}</span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                    {pages.length} {t('pagesCountLabel')}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {pages.map((pg) => (
                                                    <div key={pg.path} className="p-1.5 rounded bg-white border border-slate-200/80 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-slate-800 text-[11px] truncate">{getPermissionPageLabel(pg)}</span>
                                                            <span className="text-[9px] font-mono text-slate-400">{pg.path}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {pg.granted.map((act) => (
                                                                <span key={act} className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                                                                    ✓ {getPermissionActionLabel(act)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AUDIT HISTORY MODAL */}
            {selectedHistoryUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[10000] p-2">
                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 w-full max-w-2xl shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FaHistory className="text-indigo-400" />
                                    Account Audit & Logs: <span className="text-emerald-400 font-mono">{selectedHistoryUser.username}</span>
                                </h3>
                                <p className="text-[11px] text-slate-400">User ID: {selectedHistoryUser.userId || '—'} &bull; Role: {selectedHistoryUser.role || 'Staff'}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedHistoryUser(null)} className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"><FaTimes /></button>
                        </div>

                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <button
                                type="button"
                                onClick={() => setHistoryModalTab('online')}
                                className={`px-3 py-1.5 rounded-[5px] text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'online' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                Online Sessions ({selectedHistoryUser.onlineHistory?.length || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistoryModalTab('otp')}
                                className={`px-3 py-1.5 rounded-[5px] text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'otp' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                OTP 6-Digit Codes ({selectedHistoryUser.otpHistory?.length || (selectedHistoryUser.lastOtp ? 1 : 0)})
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistoryModalTab('login')}
                                className={`px-3 py-1.5 rounded-[5px] text-xs font-bold transition-all cursor-pointer ${historyModalTab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                Login Audit ({selectedHistoryUser.loginHistory?.length || 0})
                            </button>
                        </div>

                        {historyModalTab === 'online' && (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                                {(!selectedHistoryUser.onlineHistory || selectedHistoryUser.onlineHistory.length === 0) ? (
                                    <div className="text-center py-8 text-slate-500 italic">{t('noActiveOnlineSessionHistory')}</div>
                                ) : (
                                    selectedHistoryUser.onlineHistory.map((sess, sIdx) => {
                                        const isCurrent = !sess.logoutTime && selectedHistoryUser.status === 'Online';
                                        return (
                                            <div key={sIdx} className={`p-2.5 rounded-[5px] border ${isCurrent ? 'bg-emerald-950/30 border-emerald-800/80' : 'bg-slate-900/70 border-slate-800'} space-y-1 font-mono`}>
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                                        {isCurrent ? `🟢 ${t('currentlyOnline')}` : `⚪ ${t('completedSession')}`}
                                                    </span>
                                                    <span className="text-indigo-400 font-bold bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                                                        {t('duration')}: {formatDuration(sess.durationSeconds)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400">
                                                    <div>
                                                        <span className="text-slate-500 block">{t('loginTime')}:</span>
                                                        <span className="text-slate-200">{new Date(sess.loginTime).toLocaleString('en-GB')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 block">{t('lastActive')}:</span>
                                                        <span className="text-slate-200">
                                                            {sess.logoutTime ? new Date(sess.logoutTime).toLocaleString('en-GB') : t('active')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        <div className="text-right pt-2 border-t border-slate-800">
                            <button type="button" onClick={() => setSelectedHistoryUser(null)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[5px] text-xs font-bold transition-all cursor-pointer">
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MULTI-STEP WIZARD: CREATE / EDIT ACCOUNT (WITH PREVIEW & SANDBOX TEST)
            ========================================================================= */}
            {(openCreateModal || editingUser) && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-[10000] p-2 overflow-y-auto">
                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-4 text-white">
                        {/* WIZARD HEADER & PROGRESS INDICATOR */}
                        <div className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                                        <FaUserPlus size={16} />
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-white">
                                            {editingUser
                                                ? `${t('editAccount')}: ${editingUser.username}`
                                                : t('createAccountAndSetPermissions')}
                                        </h2>
                                        <p className="text-[11px] text-slate-400">
                                            {modalStep === 1 && `${t('stepLabel')} 1: ${t('wizardStepAccountInformation')}`}
                                            {modalStep === 2 && `${t('stepLabel')} 2: ${t('wizardStepPermissions')}`}
                                            {modalStep === 3 && `${t('stepLabel')} 3: ${t('wizardStepPreviewTest')}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setOpenCreateModal(false); setEditingUser(null); }}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            {/* Multi-step progress bar */}
                            <div className="flex items-center justify-between max-w-lg mx-auto w-full pt-1">
                                {[
                                    { num: 1, label: t('wizardStepAccountInformation') },
                                    { num: 2, label: t('wizardStepPermissions') },
                                    { num: 3, label: t('wizardStepPreviewTest') }
                                ].map((st, i) => (
                                    <React.Fragment key={st.num}>
                                        <div
                                            onClick={() => {
                                                if (st.num < modalStep || (formData.name && formData.username)) {
                                                    setModalStep(st.num);
                                                }
                                            }}
                                            className={`flex items-center gap-2 cursor-pointer transition-all ${
                                                modalStep === st.num
                                                    ? 'text-emerald-400 font-bold'
                                                    : modalStep > st.num
                                                    ? 'text-slate-300'
                                                    : 'text-slate-500 opacity-60'
                                            }`}
                                        >
                                            <div
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    modalStep === st.num
                                                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                                                        : modalStep > st.num
                                                        ? 'bg-emerald-800 text-white'
                                                        : 'bg-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {modalStep > st.num ? '✓' : st.num}
                                            </div>
                                            <span className="text-xs hidden sm:inline">{st.label}</span>
                                        </div>
                                        {i < 2 && (
                                            <div className={`flex-1 h-0.5 mx-2 ${modalStep > i + 1 ? 'bg-emerald-600' : 'bg-slate-800'}`} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* STEP 1: ACCOUNT INFORMATION */}
                        {modalStep === 1 && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('fullName')} <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder={t('fullNamePlaceholder')}
                                            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('username')} <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            placeholder={t('usernamePlaceholder')}
                                            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('emailAddress')}
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder={t('emailPlaceholder')}
                                            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('password')} {editingUser && <span className="text-[10px] text-slate-400 font-normal">({t('leaveBlankToKeepCurrentPassword')})</span>}
                                        </label>
                                        <input
                                            type="password"
                                            required={!editingUser}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder={editingUser ? t('newPasswordOptionalPlaceholder') : t('passwordPlaceholder')}
                                            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('systemRole')}
                                        </label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-semibold outline-none focus:border-emerald-500"
                                        >
                                            {roles.map((r, rIdx) => (
                                                <option key={rIdx} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-bold mb-1.5">
                                            {t('assignedBrand')}
                                        </label>
                                        <select
                                            value={formData.role?.toLowerCase() === 'salary' ? '' : formData.brand}
                                            disabled={formData.role?.toLowerCase() === 'salary'}
                                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                            className={`w-full h-10 px-3 border rounded-lg font-semibold outline-none focus:border-emerald-500 ${
                                                formData.role?.toLowerCase() === 'salary'
                                                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed italic border-slate-700'
                                                    : 'bg-slate-900 border-slate-700 text-slate-100'
                                            }`}
                                        >
                                            {formData.role?.toLowerCase() === 'salary' ? (
                                                <option value="">{t('allBrands')} (No Brand)</option>
                                            ) : (
                                                <>
                                                    <option value="">{t('allBrands')}</option>
                                                    {brandsList.map((b, bIdx) => (
                                                        <option key={bIdx} value={b}>{b}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Sub Brands multi-select for the selected Brand */}
                                    {(() => {
                                        const rawSubs = brandSubbrandsMap[formData.brand];
                                        const availableSubBrands = Array.isArray(rawSubs)
                                            ? rawSubs
                                            : (typeof rawSubs === 'string' && rawSubs.trim() ? [rawSubs.trim()] : []);
                                        if (!formData.brand || availableSubBrands.length === 0) return null;

                                        return (
                                            <div className="sm:col-span-2 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                                                        <span>🏷️ {t('assignedSubBrands')}</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const allSelected = availableSubBrands.every(sb => (formData.subBrands || []).includes(sb));
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                subBrands: allSelected ? [] : [...availableSubBrands]
                                                            }));
                                                        }}
                                                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                                                    >
                                                        {availableSubBrands.every(sb => (formData.subBrands || []).includes(sb))
                                                            ? t('deselectAll')
                                                            : t('selectAll')}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400">
                                                    {t('assignedSubBrandsHelp')}
                                                </p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {availableSubBrands.map((sb, sbIdx) => {
                                                        const isChecked = (formData.subBrands || []).includes(sb);
                                                        return (
                                                            <label
                                                                key={sbIdx}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                                                    isChecked
                                                                        ? 'bg-sky-600/30 border-sky-500 text-sky-200 shadow-sm'
                                                                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        setFormData(prev => {
                                                                            const current = prev.subBrands || [];
                                                                            const updated = checked
                                                                                ? [...current, sb]
                                                                                : current.filter(item => item !== sb);
                                                                            return { ...prev, subBrands: updated };
                                                                        });
                                                                    }}
                                                                    className="rounded text-sky-600 focus:ring-0"
                                                                />
                                                                <span>{sb}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: PERMISSION MATRIX WITH PHONE SETTINGS STYLE TOGGLE SWITCHES */}
                        {modalStep === 2 && (
                            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                    <div>
                                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
                                            <FaShieldAlt /> {t('permissionMatrixHeading')}
                                        </h3>
                                        <p className="text-[11px] text-slate-400">
                                            {t('permissionMatrixDescription')}
                                        </p>
                                    </div>

                                    {formData.role?.toLowerCase() !== 'salary' && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleGrantAllPermissions}
                                                className="px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-600 rounded-md font-bold text-[10px]"
                                            >
                                                ⭐ {t('grantAllPermissions')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAllPermissions}
                                                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-600 rounded-md font-bold text-[10px]"
                                            >
                                                ✕ {t('clearAllPermissions')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Category Accordions / Lists with iOS Toggle Switches */}
                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                                    {Object.entries(
                                        (formData.role?.toLowerCase() === 'salary'
                                            ? ALL_SYSTEM_PAGES.filter(pg => pg.path === '/salary' || pg.category === 'Salary System')
                                            : ALL_SYSTEM_PAGES
                                        ).reduce((acc, pg) => {
                                            const cat = pg.category || 'Other';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(pg);
                                            return acc;
                                        }, {})
                                    ).map(([category, pages]) => (
                                        <div key={category} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                                <span className="font-bold text-emerald-400 text-xs">{getPermissionCategoryLabel(category)}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">({pages.length} {t('pagesCountLabel')})</span>
                                            </div>

                                            <div className="space-y-2">
                                                {pages.map((pg) => {
                                                    const pState = formData.permissions[pg.path] || {};
                                                    const isPageEnabled = Object.values(pState).some(Boolean);
                                                    const availableActions = pg.actions || ['read', 'create', 'edit', 'delete'];

                                                    return (
                                                        <div
                                                            key={pg.path}
                                                            className={`p-2.5 rounded-lg border transition-all ${
                                                                isPageEnabled
                                                                    ? 'bg-slate-950 border-emerald-500/40'
                                                                    : 'bg-slate-950/40 border-slate-800/80 opacity-70'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <span className="font-bold text-slate-200 text-xs">{getPermissionPageLabel(pg)}</span>
                                                                    <span className="text-[10px] text-slate-400 font-mono ml-2">({pg.path})</span>
                                                                </div>

                                                                {/* iOS PHONE STYLE TOGGLE SWITCH BUTTON */}
                                                                <button
                                                                    type="button"
                                                                    role="switch"
                                                                    aria-checked={isPageEnabled}
                                                                    onClick={() => handleTogglePageSwitch(pg)}
                                                                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                        isPageEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                                                            isPageEnabled ? 'translate-x-5' : 'translate-x-0'
                                                                        }`}
                                                                    />
                                                                </button>
                                                            </div>

                                                            {/* Granular Action Pills when switch is ON */}
                                                            {isPageEnabled && (
                                                                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                                                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">{t('permissions')}:</span>
                                                                    {availableActions.map(act => {
                                                                        const isChecked = !!pState[act];
                                                                        return (
                                                                            <label
                                                                                key={act}
                                                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-[10px] font-bold border transition-all ${
                                                                                    isChecked
                                                                                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                                                                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                                                                                }`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => handleActionToggle(pg.path, act)}
                                                                                    className="h-3 w-3 accent-emerald-500"
                                                                                />
                                                                                <span>{getPermissionActionLabel(act)}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: INTERACTIVE PREVIEW & SANDBOX TEST BEFORE SUBMIT */}
                        {modalStep === 3 && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                                <div className="border-b border-slate-800 pb-3">
                                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                        <FaDesktop /> {t('permissionPreviewHeading')}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {t('permissionPreviewDescription')}
                                    </p>
                                </div>

                                {/* Simulated User Identity Badge */}
                                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-bold text-white shadow">
                                            {(formData.name || formData.username || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-sm">{formData.name || t('defaultUserName')}</h4>
                                            <p className="text-[11px] text-emerald-400 font-mono">{formData.username}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                                                    {t('role')}: {formData.role}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                                    {t('brand')}: {formData.brand || t('allBrandsShort')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[11px] text-slate-400 block">{t('enabledPages')}:</span>
                                        <span className="text-xl font-black text-emerald-400">{grantedPages.length}</span>
                                        <span className="text-slate-500 text-xs"> / {ALL_SYSTEM_PAGES.length}</span>
                                    </div>
                                </div>

                                {/* Live Simulation Columns: Left = Simulated Sidebar, Right = Page Permission Checker */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Simulated Sidebar Menu */}
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                            <span className="font-bold text-slate-300 text-xs">{t('simulatedUserSidebar')}</span>
                                            <span className="text-[10px] text-emerald-400 font-bold">{grantedPages.length} {t('visible')}</span>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 font-medium">
                                            {grantedPages.length === 0 ? (
                                                <p className="text-slate-500 italic py-6 text-center">{t('noPagesEnabled')}</p>
                                            ) : (
                                                grantedPages.map(pg => (
                                                    <div
                                                        key={pg.path}
                                                        onClick={() => setPreviewSelectedPage(pg.path)}
                                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                                            previewSelectedPage === pg.path
                                                                ? 'bg-emerald-900/50 border border-emerald-500/50 text-emerald-300'
                                                                : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border border-transparent'
                                                        }`}
                                                    >
                                                        <span className="text-xs truncate">{getPermissionPageLabel(pg)}</span>
                                                        <span className="text-[10px] font-mono text-slate-400">{pg.path}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Permission Inspector Card */}
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                                        <div className="border-b border-slate-800 pb-2">
                                            <span className="font-bold text-slate-300 text-xs">{t('testPagePermissions')}:</span>
                                            <p className="text-[11px] text-emerald-400 font-mono mt-0.5">{previewSelectedPage}</p>
                                        </div>

                                        {(() => {
                                            const curPage = ALL_SYSTEM_PAGES.find(p => p.path === previewSelectedPage);
                                            const pState = formData.permissions[previewSelectedPage] || {};
                                            const availableActions = curPage?.actions || ['read', 'create', 'edit', 'delete'];

                                            return (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-slate-300 font-semibold">{curPage ? getPermissionPageLabel(curPage) : t('generalPage')}</p>
                                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                                        {availableActions.map(act => {
                                                            const isGranted = !!pState[act];
                                                            return (
                                                                <div
                                                                    key={act}
                                                                    className={`p-2 rounded-lg border flex items-center justify-between text-xs font-bold ${
                                                                        isGranted
                                                                            ? 'bg-emerald-950/50 border-emerald-600 text-emerald-300'
                                                                            : 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                                                                    }`}
                                                                >
                                                                    <span>{getPermissionActionLabel(act)}</span>
                                                                    <span>{isGranted ? `✅ ${t('allowed')}` : `❌ ${t('permissionDisabled')}`}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* WIZARD FOOTER NAVIGATION */}
                        <div className="border-t border-slate-800 bg-slate-900/90 px-6 py-3.5 flex items-center justify-between">
                            <div>
                                {modalStep > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setModalStep(s => s - 1)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
                                    >
                                        <FaArrowLeft /> {t('back')}
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setOpenCreateModal(false); setEditingUser(null); }}
                                    className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                                >
                                    {t('cancel')}
                                </button>

                                {modalStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (modalStep === 1) {
                                                if (!formData.name.trim() || !formData.username.trim()) {
                                                    showAlert(t('completeRequiredInformation'), t('enterFullNameAndUsername'), 'danger');
                                                    return;
                                                }
                                                if (!editingUser && !formData.password.trim()) {
                                                    showAlert(t('completeRequiredInformation'), t('enterPasswordForNewAccount'), 'danger');
                                                    return;
                                                }
                                            }
                                            setModalStep(s => s + 1);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all"
                                    >
                                        <span>{t('continue')}</span> <FaArrowRight />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={editingUser ? handleUpdateUser : handleCreateUser}
                                        className="inline-flex items-center gap-1.5 px-6 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all cursor-pointer"
                                    >
                                        <FaCheck /> <span>{editingUser ? t('saveChanges') : `✓ ${t('confirmAndCreateAccount')}`}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                CUSTOM MODERN ALERT / CONFIRMATION MODAL UI (NO NATIVE BROWSER ALERTS!)
            ========================================================================= */}
            {customDialog.isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
                    <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-white">
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                customDialog.type === 'danger'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : customDialog.type === 'alert'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/20 text-amber-400'
                            }`}>
                                {customDialog.type === 'danger' ? (
                                    <FaExclamationTriangle size={20} />
                                ) : (
                                    <FaCheckCircle size={20} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-white">{customDialog.title}</h3>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{customDialog.message}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            {customDialog.cancelText && (
                                <button
                                    type="button"
                                    onClick={() => setCustomDialog(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                    {customDialog.cancelText}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={customDialog.onConfirm}
                                className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-md transition-all ${
                                    customDialog.type === 'danger'
                                        ? 'bg-rose-600 hover:bg-rose-500'
                                        : 'bg-emerald-600 hover:bg-emerald-500'
                                }`}
                            >
                                {customDialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllAccount;