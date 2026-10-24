import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { CONTROL_SYSTEM_PATH, CONTROL_SYSTEM_SECTIONS } from '../../../utils/controlSystemPermissions';
import { IoIosSettings } from 'react-icons/io';
import { MdOutlineSync, MdAddCircle, MdDelete, MdSave, MdOutlineSettingsBackupRestore } from 'react-icons/md';
import { FaPhoneAlt, FaList, FaUserShield, FaLayerGroup, FaGlobeAmericas, FaDollarSign, FaFolder, FaFolderOpen, FaShieldAlt, FaTags } from 'react-icons/fa';
import './ControlSystem.css';

const FOLLOW_UP_SUGGESTION_LISTS = [
    { category: 'Follow Up 4 PG/TL Names', items: [] },
    { category: 'Follow Up 4 Descriptions', items: [] }
];

const ensureFollowUpSuggestionLists = (lists) => {
    const result = Array.isArray(lists) ? [...lists] : [];
    FOLLOW_UP_SUGGESTION_LISTS.forEach(defaultList => {
        if (!result.some(list => list.category === defaultList.category)) {
            result.push({ ...defaultList, items: [...defaultList.items] });
        }
    });
    return result;
};

const isFollowUpDroplist = (category) => category.startsWith('Follow Up 4 ') || category.startsWith('Reject ');


const ControlSystem = () => {
    const { t, lang } = useLanguage();
    const { API_BASE, user, hasPermission } = useAuth();

    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin'
    );

    const [selectedBrand, setSelectedBrand] = useState(user?.brand || '');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);

    const [droplists, setDroplists] = useState([
        { category: 'Device Models', items: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'Samsung Galaxy S24 Ultra', 'iPad Air 5'] },
        { category: 'Contract Types', items: ['Standard Installment', 'VIP Premium', 'Corporate Plan'] },
        { category: 'Payment Methods', items: ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'] },
        { category: 'Brands', items: ['MDM', 'ECloud'] },
        { category: 'Follow Up 4 Sources', items: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'] },
        { category: 'Follow Up 4 Contact Types', items: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'] },
        { category: 'Follow Up 4 Statuses', items: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'] },
        { category: 'Follow Up 4 Asset Types', items: ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'] },
        ...FOLLOW_UP_SUGGESTION_LISTS,
        ...FOLLOW_UP_SUGGESTION_LISTS,
        { category: 'Reject Submit Reasons', items: ['ឯកសារមិនគ្រប់', 'ព័ត៌មានមិនច្បាស់', 'អតិថិជនប្តូរចិត្ត', 'ទាក់ទងមិនបាន', 'ផ្សេងៗ'] },
        { category: 'Reject CS Reasons', items: ['តម្លៃមិនព្រម', 'គ្មានសមត្ថភាពបង់', 'លក្ខខណ្ឌមិនត្រូវ', 'មិនឆ្លើយតប', 'ផ្សេងៗ'] }
    ]);

    const [callPhoneDisplay, setCallPhoneDisplay] = useState({
        title: 'SYSTEM MDM HOTLINE',
        phoneNumber: '+855 12 903 120',
        subtext: 'Contact support for instant phone lock or payment inquiry'
    });

    const [roles, setRoles] = useState(['Administrator', 'Manager', 'Staff', 'Viewer', 'Salary']);
    const [lockphoneDisplayText, setLockphoneDisplayText] = useState('ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់');
    const [lockphonePhoneNumber, setLockphonePhoneNumber] = useState('+855 12 903 120');
    const [lockphoneTelegramChatIds, setLockphoneTelegramChatIds] = useState([]);
    const [newLockphoneTelegramChatId, setNewLockphoneTelegramChatId] = useState('');
    const [latePenaltyRules, setLatePenaltyRules] = useState([]);
    const [newPenaltyBrand, setNewPenaltyBrand] = useState(user?.brand || 'MDM');
    const [newPenaltyDays, setNewPenaltyDays] = useState(1);
    const [newPenaltyAmount, setNewPenaltyAmount] = useState(0);

    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [fieldOrigins, setFieldOrigins] = useState({});

    const [newRoleInput, setNewRoleInput] = useState('');
    const [newItemInput, setNewItemInput] = useState('');
    const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
    const [newBrandInput, setNewBrandInput] = useState('');
    const [brandSubbrands, setBrandSubbrands] = useState({});
    const [newSubBrandInputs, setNewSubBrandInputs] = useState({});

    // Dedicated Follow Up 4 inputs
    const [newRejectSubmitInput, setNewRejectSubmitInput] = useState('');
    const [newRejectCsInput, setNewRejectCsInput] = useState('');
    const [newWorkflowOption, setNewWorkflowOption] = useState('');
    const [selectedWorkflowCategory, setSelectedWorkflowCategory] = useState('Follow Up 4 Sources');

    const [restoring, setRestoring] = useState(false);
    const [activeFile, setActiveFile] = useState('lock-screen');

    const [productVariants, setProductVariants] = useState([]);
    const [newVariantName, setNewVariantName] = useState('');
    const [newVariantRegion, setNewVariantRegion] = useState('');
    const [newVariantDesc, setNewVariantDesc] = useState('');

    const explorerFolders = [
        {
            name: t('deviceAndSecurity'),
            files: [{ id: 'lock-screen', label: t('lockScreenAndHotline'), icon: <FaPhoneAlt />, color: 'text-rose-400' }]
        },
        {
            name: t('finance'),
            files: [{ id: 'penalties', label: t('latePenaltyRules'), icon: <FaDollarSign />, color: 'text-amber-400' }]
        },
        {
            name: t('accessControl'),
            files: [{ id: 'roles', label: t('userRoles'), icon: <FaUserShield />, color: 'text-sky-400' }]
        },
        {
            name: t('workflows'),
            files: [{ id: 'follow-up', label: t('followUp4'), icon: <FaList />, color: 'text-orange-400' }]
        },
        {
            name: t('systemData'),
            files: [
                { id: 'dropdowns', label: t('dropdownLists'), icon: <FaLayerGroup />, color: 'text-emerald-400' },
                { id: 'variants', label: lang === 'km' ? 'វ៉ារ្យ៉ង់ផលិតផល (Variants)' : 'Product Variants', icon: <FaTags />, color: 'text-teal-400' }
            ]
        },
        ...(user?.role === 'Administrator' && selectedBrand === '' ? [{
            name: t('organization'),
            files: [{ id: 'brands', label: t('brandDirectory'), icon: <FaGlobeAmericas />, color: 'text-violet-400' }]
        }] : [])
    ];
    const canAccessSection = (sectionId) => {
        const section = CONTROL_SYSTEM_SECTIONS.find(entry => entry.id === sectionId);
        return !!section && hasPermission(section.path, 'read');
    };
    const canEditSection = (sectionId) => {
        const section = CONTROL_SYSTEM_SECTIONS.find(entry => entry.id === sectionId);
        return !!section && hasPermission(section.path, 'edit');
    };
    const canDeleteSection = (sectionId) => {
        const section = CONTROL_SYSTEM_SECTIONS.find(entry => entry.id === sectionId);
        return !!section && hasPermission(section.path, 'delete');
    };
    const accessibleExplorerFolders = explorerFolders
        .map(folder => ({
            ...folder,
            files: folder.files.filter(file =>
                canAccessSection(file.id) && (file.id !== 'brands' || (user?.role === 'Administrator' && selectedBrand === ''))
            )
        }))
        .filter(folder => folder.files.length > 0);
    const accessibleFiles = accessibleExplorerFolders.flatMap(folder => folder.files);
    const activeExplorerFile = accessibleFiles.find(file => file.id === activeFile) || accessibleFiles[0] || null;
    const workflowDroplists = droplists.filter(list => isFollowUpDroplist(list.category));
    const systemDroplists = droplists.filter(list => !isFollowUpDroplist(list.category));

    const handleRestoreFromFirebase = async () => {
        if (user?.role !== 'Administrator' || !hasPermission(CONTROL_SYSTEM_PATH, 'edit')) {
            alert(t('noRestoreControlSystemPermission'));
            return;
        }
        const isConfirmed = window.confirm(
            t('restoreNotice') + ':\n\n' +
            t('confirmRestoreFirebaseData') + '\n' +
            t('restoreClearsMongoDbData') + '\n' +
            t('firebaseDataWillRemain')
        );
        if (!isConfirmed) return;

        setRestoring(true);
        try {
            const res = await fetch(`${API_BASE}/db-status/restore-firebase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': user?.role || 'Administrator',
                    'x-user-id': user?.userId || ''
                }
            });
            const data = await res.json();
            if (res.ok && data.result?.success) {
                alert(`${t('firebaseRestoreSucceeded')}:\n\n` +
                    `• Contracts: ${data.result.counts?.contracts || 0}\n` +
                    `• Users: ${data.result.counts?.users || 0}\n` +
                    `• Payments: ${data.result.counts?.payments || 0}\n` +
                    `• Control System: ${data.result.counts?.controlSystems || 0}\n` +
                    `• Phone Logs: ${data.result.counts?.phoneLogs || 0}\n` +
                    `• Wallpaper Logs: ${data.result.counts?.wallpaperLogs || 0}`
                );
                fetchControlSystemConfigs();
            } else {
                alert(`${t('firebaseRestoreFailed')}: ${data.error || data.message || t('unknownError')}`);
            }
        } catch (err) {
            alert(`${t('serverConnectionError')}: ${err.message}`);
        } finally {
            setRestoring(false);
        }
    };

    // Fetch which fields are private overrides vs inherited from Global
    const fetchFieldOrigins = async (brand) => {
        try {
            if (!brand || brand === '') { setFieldOrigins({}); return; }
            const res = await fetch(`${API_BASE}/controlsystem/field-origins?brand=${encodeURIComponent(brand)}`);
            if (res.ok) {
                const data = await res.json();
                setFieldOrigins(data.origins || {});
            }
        } catch (err) {
            console.error('fetchFieldOrigins error:', err);
        }
    };

    const fetchControlSystemConfigs = async () => {
        setReloading(true);
        try {
            // 1. Always fetch the Master Global Config first
            let globalData = {};
            let globalDroplists = [
                { category: 'Device Models', items: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'Samsung Galaxy S24 Ultra', 'iPad Air 5'] },
                { category: 'Contract Types', items: ['Standard Installment', 'VIP Premium', 'Corporate Plan'] },
                { category: 'Payment Methods', items: ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'] },
                { category: 'Brands', items: ['888MDM', 'ECloud'] },
                { category: 'Follow Up 4 Sources', items: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'] },
                { category: 'Follow Up 4 Contact Types', items: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'] },
                { category: 'Follow Up 4 Statuses', items: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'] },
                { category: 'Follow Up 4 Asset Types', items: ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'] },
                ...FOLLOW_UP_SUGGESTION_LISTS,
                { category: 'Reject Submit Reasons', items: ['ឯកសារមិនគ្រប់', 'ព័ត៌មានមិនច្បាស់', 'អតិថិជនប្តូរចិត្ត', 'ទាក់ទងមិនបាន', 'ផ្សេងៗ'] },
                { category: 'Reject CS Reasons', items: ['តម្លៃមិនព្រម', 'គ្មានសមត្ថភាពបង់', 'លក្ខខណ្ឌមិនត្រូវ', 'មិនឆ្លើយតប', 'ផ្សេងៗ'] }
            ];
            const globalRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (globalRes.ok) {
                globalData = await globalRes.json();
                if (globalData.droplists && Array.isArray(globalData.droplists) && globalData.droplists.length > 0) {
                    globalDroplists = ensureFollowUpSuggestionLists(globalData.droplists);
                }
                const brandCat = globalDroplists.find(d => d.category === 'Brands');
                if (brandCat && Array.isArray(brandCat.items)) {
                    setBrandsList(brandCat.items);
                }
                if (globalData.brand_subbrands) {
                    setBrandSubbrands(globalData.brand_subbrands);
                }
            }

            // 2. Fetch the selected brand config
            if (selectedBrand) {
                const res = await fetch(`${API_BASE}/controlsystem?brand=${selectedBrand}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.brand_subbrands) {
                        setBrandSubbrands(data.brand_subbrands);
                    }

                    // Smart auto-inherit droplists: If any category in the brand is empty or missing, auto-fill from Global!
                    if (data.droplists && Array.isArray(data.droplists)) {
                        const mergedDroplists = globalDroplists.map(gCat => {
                            const bCat = data.droplists.find(d => d.category === gCat.category);
                            if (bCat && Array.isArray(bCat.items) && bCat.items.length > 0) {
                                return bCat;
                            }
                            return gCat; // Auto-inherit from Global
                        });
                        data.droplists.forEach(bCat => {
                            if (!mergedDroplists.some(d => d.category === bCat.category)) {
                                mergedDroplists.push(bCat);
                            }
                        });
                        setDroplists(mergedDroplists);
                    } else {
                        setDroplists(globalDroplists);
                    }

                    if (data.call_phone_display) setCallPhoneDisplay(data.call_phone_display);
                    else if (globalData.call_phone_display) setCallPhoneDisplay(globalData.call_phone_display);

                    if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) setRoles(data.roles);
                    else if (globalData.roles) setRoles(globalData.roles);

                    if (data.lockphone_display_text) setLockphoneDisplayText(data.lockphone_display_text);
                    else if (globalData.lockphone_display_text) setLockphoneDisplayText(globalData.lockphone_display_text);

                    if (data.lockphone_phone_number) setLockphonePhoneNumber(data.lockphone_phone_number);
                    else if (globalData.lockphone_phone_number) setLockphonePhoneNumber(globalData.lockphone_phone_number);
                    if (Array.isArray(data.lockphone_telegram_chat_ids)) setLockphoneTelegramChatIds(data.lockphone_telegram_chat_ids.map(String));
                    else setLockphoneTelegramChatIds(Array.isArray(globalData.lockphone_telegram_chat_ids) ? globalData.lockphone_telegram_chat_ids.map(String) : []);

                    const highPriorityRules = Array.isArray(data.late_penalty_rules) && data.late_penalty_rules.length > 0
                        ? data.late_penalty_rules
                        : (Array.isArray(globalData.late_penalty_rules) ? globalData.late_penalty_rules : []);
                    setLatePenaltyRules(highPriorityRules);
                    if (!selectedBrand) setNewPenaltyBrand((globalData?.brand || 'MDM'));

                    if (Array.isArray(data.product_variants)) {
                        setProductVariants(data.product_variants);
                    } else if (Array.isArray(globalData.product_variants)) {
                        setProductVariants(globalData.product_variants);
                    } else {
                        setProductVariants([]);
                    }
                }
            } else {
                // Global brand selected
                if (globalDroplists) setDroplists(globalDroplists);
                if (globalData.call_phone_display) setCallPhoneDisplay(globalData.call_phone_display);
                if (globalData.roles) setRoles(globalData.roles);
                if (globalData.lockphone_display_text) setLockphoneDisplayText(globalData.lockphone_display_text);
                if (globalData.lockphone_phone_number) setLockphonePhoneNumber(globalData.lockphone_phone_number);
                setLockphoneTelegramChatIds(Array.isArray(globalData.lockphone_telegram_chat_ids) ? globalData.lockphone_telegram_chat_ids.map(String) : []);
                setLatePenaltyRules(Array.isArray(globalData.late_penalty_rules) ? globalData.late_penalty_rules : []);
                setNewPenaltyBrand(globalData?.brand || 'MDM');
                if (Array.isArray(globalData.product_variants)) {
                    setProductVariants(globalData.product_variants);
                } else {
                    setProductVariants([]);
                }
            }
        } catch (err) {
            console.error('Fetch control system configs error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };


    useEffect(() => {
        fetchControlSystemConfigs();
        fetchFieldOrigins(selectedBrand);
    }, [selectedBrand]);

    const saveConfigToMongoDB = async (key, value, sectionId = null, permissionAction = 'edit') => {
        const mappedSectionId = sectionId || ({
            lockphone_display_text: 'lock-screen',
            lockphone_phone_number: 'lock-screen',
            lockphone_telegram_chat_ids: 'lock-screen',
            late_penalty_rules: 'penalties',
            roles: 'roles',
            droplists: activeExplorerFile?.id
        })[key];
        const section = CONTROL_SYSTEM_SECTIONS.find(entry => entry.id === mappedSectionId);
        if (!section || !hasPermission(section.path, permissionAction)) {
            alert(`${t('missingControlSystemSectionPermission')}: ${permissionAction}`);
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, brand: selectedBrand })
            });

            const data = await res.json().catch(() => ({}));
            setSaving(false);
            if (res.ok) {
                setMessage(`${t('controlSystemConfigurationUpdated')} '${key}' ${t('forBrand')} '${selectedBrand || t('global')}'`);
                setTimeout(() => setMessage(''), 3000);
                // Mark this field as private after successful save (only for brand-specific saves)
                if (selectedBrand) {
                    setFieldOrigins(prev => ({ ...prev, [key]: 'private' }));
                }
            } else {
                alert(`${t('failedToSaveConfiguration')}: ${data.error || res.statusText || t('serverError')}`);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save config error:', err);
            alert(`${t('failedToSaveConfiguration')}: ${t('networkError')} (${err.message})`);
        }
    };

    const addLockphoneTelegramChatId = () => {
        const chatId = newLockphoneTelegramChatId.trim();
        if (!/^-?\d+$/.test(chatId)) {
            alert(t('enterNumericTelegramAccountChatId'));
            return;
        }
        if (!lockphoneTelegramChatIds.includes(chatId)) {
            setLockphoneTelegramChatIds((ids) => [...ids, chatId]);
        }
        setNewLockphoneTelegramChatId('');
    };

    const saveLockphoneConfig = async () => {
        if (!canEditSection('lock-screen')) {
            alert(t('noEditDeviceSecurityPermission'));
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            const response = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand: selectedBrand,
                    configs: [
                        { key: 'lockphone_display_text', value: lockphoneDisplayText },
                        { key: 'lockphone_phone_number', value: lockphonePhoneNumber },
                        { key: 'lockphone_telegram_chat_ids', value: lockphoneTelegramChatIds }
                    ]
                })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || response.statusText || t('serverError'));
            setMessage(`${t('lockPhoneConfigurationUpdated')} ${selectedBrand || t('global')}!`);
            setTimeout(() => setMessage(''), 3000);
            if (selectedBrand) {
                setFieldOrigins((origins) => ({
                    ...origins,
                    lockphone_display_text: 'private',
                    lockphone_phone_number: 'private',
                    lockphone_telegram_chat_ids: 'private'
                }));
            }
        } catch (err) {
            console.error('Save Lock Phone config error:', err);
            alert(`${t('failedToSaveConfiguration')}: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleAddRole = () => {
        if (!canEditSection('roles')) return;
        if (!newRoleInput.trim()) return;
        const updated = [...roles, newRoleInput.trim()];
        setRoles(updated);
        setNewRoleInput('');
        saveConfigToMongoDB('roles', updated, 'roles');
    };

    const handleDeleteRole = (index) => {
        if (!canDeleteSection('roles')) return;
        if (roles[index] === 'Administrator') {
            alert(t('administratorRoleCannotBeRemoved'));
            return;
        }
        const updated = roles.filter((_, idx) => idx !== index);
        setRoles(updated);
        saveConfigToMongoDB('roles', updated, 'roles', 'delete');
    };

    const handleAddItemToCategory = () => {
        if (!canEditSection('dropdowns')) return;
        if (!newItemInput.trim()) return;
        const selectedCategory = systemDroplists[selectedCategoryIdx];
        if (!selectedCategory) return;
        // Brand addition is strictly reserved for Master Admin
        if (selectedCategory.category === 'Brands' && !isMasterAdmin) {
            alert(t('onlyAdministratorCanAddBrand'));
            return;
        }
        const updated = droplists.map(category => category.category === selectedCategory.category
            ? { ...category, items: [...category.items, newItemInput.trim()] }
            : category);
        setDroplists(updated);
        setNewItemInput('');
        saveConfigToMongoDB('droplists', updated, 'dropdowns');
    };

    const handleDeleteItemFromCategory = (catIdx, itemIdx) => {
        if (!canDeleteSection('dropdowns')) return;
        const selectedCategory = systemDroplists[catIdx];
        if (!selectedCategory) return;
        // Strict protection: regular users can NEVER delete Brands items
        if (selectedCategory.category === 'Brands' && !isMasterAdmin) {
            alert(t('onlyAdministratorCanDeleteBrand'));
            return;
        }
        const updated = droplists.map(category => category.category === selectedCategory.category
            ? { ...category, items: category.items.filter((_, index) => index !== itemIdx) }
            : category);
        setDroplists(updated);
        saveConfigToMongoDB('droplists', updated, 'dropdowns', 'delete');
    };

    const handleAddSpecificReason = (categoryName, reasonText, setInput) => {
        if (!canEditSection('follow-up')) return;
        const text = reasonText.trim();
        if (!text) return;
        const categoryExists = droplists.some(category => category.category === categoryName);
        const updated = categoryExists
            ? droplists.map(category => category.category === categoryName && !category.items.includes(text)
                ? { ...category, items: [...category.items, text] }
                : category)
            : [...droplists, { category: categoryName, items: [text] }];
        setDroplists(updated);
        if (setInput) setInput('');
        saveConfigToMongoDB('droplists', updated, 'follow-up');
    };

    const handleDeleteSpecificReason = (categoryName, itemIndex) => {
        if (!canDeleteSection('follow-up')) return;
        const updated = droplists.map(category => category.category === categoryName
            ? { ...category, items: category.items.filter((_, index) => index !== itemIndex) }
            : category);
        setDroplists(updated);
        saveConfigToMongoDB('droplists', updated, 'follow-up', 'delete');
    };

    // --- Brand Management (Global Config only) ---
    const handleAddBrand = async () => {
        if (!canEditSection('brands') || user?.role !== 'Administrator' || selectedBrand !== '') {
            alert(t('noEditOrganizationSettingsPermission'));
            return;
        }
        const name = newBrandInput.trim();
        if (!name) return;
        if (brandsList.includes(name)) {
            setMessage(`${t('brandAlreadyExists')}: '${name}'`);
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        const updatedBrands = [...brandsList, name];
        setBrandsList(updatedBrands);
        setNewBrandInput('');

        // Persist into Global droplists 'Brands' category & auto-clone Global config into this new brand
        setSaving(true);
        setMessage('');
        try {
            const globalRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            let globalDroplists = [
                { category: 'Device Models', items: [] },
                { category: 'Contract Types', items: [] },
                { category: 'Payment Methods', items: [] },
                { category: 'Brands', items: [] }
            ];
            if (globalRes.ok) {
                const gData = await globalRes.json();
                if (gData.droplists) globalDroplists = gData.droplists;
            }
            const brandCatIdx = globalDroplists.findIndex(d => d.category === 'Brands');
            if (brandCatIdx !== -1) {
                globalDroplists[brandCatIdx].items = updatedBrands;
            } else {
                globalDroplists.push({ category: 'Brands', items: updatedBrands });
            }
            await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'droplists', value: globalDroplists, brand: '' })
            });

            // Auto-clone all Global configs to the new Brand so it is never empty
            await fetch(`${API_BASE}/controlsystem/clone-global`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: name })
            });

            setSaving(false);
            setMessage(`${t('brandCreatedAndGlobalConfigCloned')}: '${name}'`);
            setTimeout(() => setMessage(''), 4500);
        } catch (err) {
            setSaving(false);
            console.error('Add brand error:', err);
        }
    };

    const handleAddSubBrand = async (brandName) => {
        if (!canEditSection('brands')) {
            alert(t('noEditOrganizationSettingsPermission'));
            return;
        }
        const subName = (newSubBrandInputs[brandName] || '').trim();
        if (!subName) return;
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${API_BASE}/controlsystem/subbrands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: brandName, subBrand: subName })
            });
            const data = await res.json();
            setSaving(false);
            if (res.ok) {
                setBrandSubbrands(data.brand_subbrands || {});
                setNewSubBrandInputs(prev => ({ ...prev, [brandName]: '' }));
                setMessage(`${t('subBrandAddedForBrand')}: '${subName}' — '${brandName}'`);
                setTimeout(() => setMessage(''), 4500);
            } else {
                alert(data.error || t('failedToAddSubBrand'));
            }
        } catch (err) {
            setSaving(false);
            console.error('Add subbrand error:', err);
        }
    };

    const handleDeleteSubBrand = async (brandName, subName) => {
        if (!canDeleteSection('brands')) {
            alert(t('noDeleteOrganizationSettingsPermission'));
            return;
        }
        if (!window.confirm(`${t('confirmDeleteSubBrand')} '${subName}' ${t('fromBrand')} '${brandName}'?`)) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/controlsystem/subbrands`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: brandName, subBrand: subName })
            });
            const data = await res.json();
            setSaving(false);
            if (res.ok) {
                setBrandSubbrands(data.brand_subbrands || {});
                setMessage(`${t('subBrandDeleted')}: '${subName}'`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            setSaving(false);
            console.error('Delete subbrand error:', err);
        }
    };

    const handleCloneFromGlobal = async () => {
        if (!hasPermission(CONTROL_SYSTEM_PATH, 'edit')) {
            alert(t('cloneFromGlobalRequiresFullEditPermission'));
            return;
        }
        if (!selectedBrand) return;
        if (!window.confirm(`${t('confirmCloneGlobalConfigurations')} '${selectedBrand}'?`)) return;
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${API_BASE}/controlsystem/clone-global`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: selectedBrand })
            });
            setSaving(false);
            if (res.ok) {
                setMessage(`${t('globalConfigurationsCopiedToBrand')}: '${selectedBrand}'`);
                fetchControlSystemConfigs();
                setTimeout(() => setMessage(''), 4000);
            }
        } catch (err) {
            setSaving(false);
            console.error('Clone global error:', err);
        }
    };


    const [deleteBrandModal, setDeleteBrandModal] = useState({ open: false, brandName: '' });

    const handleDeleteBrandClick = (brandName) => {
        if (!canDeleteSection('brands')) {
            alert(t('noDeleteOrganizationSettingsPermission'));
            return;
        }
        setDeleteBrandModal({ open: true, brandName });
    };

    const handleConfirmDeleteBrand = async () => {
        if (!canDeleteSection('brands')) {
            alert(t('noDeleteOrganizationSettingsPermission'));
            return;
        }
        const brandName = deleteBrandModal.brandName;
        if (!brandName) return;
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${API_BASE}/controlsystem/delete-brand`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: brandName })
            });

            setSaving(false);
            setDeleteBrandModal({ open: false, brandName: '' });
            if (res.ok) {
                const data = await res.json();
                setMessage(data.message || `${t('brandAndAssociatedDataDeleted')}: '${brandName}'`);
                fetchControlSystemConfigs();
                setTimeout(() => setMessage(''), 4000);
            } else {
                alert(t('failedToDeleteBrand'));
            }
        } catch (err) {
            setSaving(false);
            setDeleteBrandModal({ open: false, brandName: '' });
            console.error('Delete brand error:', err);
        }
    };

    const handleSaveAllConfigs = async () => {
        if (!hasPermission(CONTROL_SYSTEM_PATH, 'edit')) {
            alert(t('saveAllRequiresFullEditPermission'));
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            const configs = [
                { key: 'call_phone_display', value: callPhoneDisplay },
                { key: 'lockphone_display_text', value: lockphoneDisplayText },
                { key: 'lockphone_phone_number', value: lockphonePhoneNumber },
                { key: 'late_penalty_rules', value: latePenaltyRules },
                { key: 'roles', value: roles },
                { key: 'droplists', value: droplists },
                { key: 'product_variants', value: productVariants }
            ];
            const res = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs, brand: selectedBrand })
            });

            const data = await res.json().catch(() => ({}));
            setSaving(false);

            if (res.ok) {
                setMessage(`${t('allConfigurationsSavedForBrand')} '${selectedBrand || t('global')}'`);
                setTimeout(() => setMessage(''), 4000);
                // Mark all saved keys as private after bulk save
                if (selectedBrand) {
                    setFieldOrigins(prev => ({
                        ...prev,
                        call_phone_display: 'private',
                        lockphone_display_text: 'private',
                        lockphone_phone_number: 'private',
                        late_penalty_rules: 'private',
                        roles: 'private',
                        droplists: 'private',
                        product_variants: 'private',
                    }));
                }
            } else {
                alert(`${t('failedToSaveConfigurations')}: ${data.error || res.statusText || t('serverError')}`);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save all configs error:', err);
            alert(`${t('failedToSaveConfigurations')}: ${t('networkError')} (${err.message})`);
        }
    };

    // Helper component: badge showing 🌐 Global inherited vs 🏷️ Private override
    const OriginBadge = ({ fieldKey }) => {
        if (!selectedBrand) return null; // Don't show badge when viewing Global
        const origin = fieldOrigins[fieldKey];
        if (origin === 'private') {
            return (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-50 border border-amber-300 text-amber-800 text-[9px] font-bold uppercase tracking-wide">
                    🏷️ Private Override
                </span>
            );
        }
        return (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold uppercase tracking-wide">
                🌐 Inherited Global
            </span>
        );
    };

    return (
        <div id="control-system-explorer" className='w-full bg-transparent p-2 md:p-2 select-none space-y-4'>
            <header className='p-2 w-full border border-slate-300 bg-white rounded-md flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-sm'>
                <div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                            {t('controlSystem')} {t('dynamicConfigurations')}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {user?.role === 'Administrator' && hasPermission(CONTROL_SYSTEM_PATH, 'edit') && (
                        <button
                            type="button"
                            onClick={handleRestoreFromFirebase}
                            disabled={restoring}
                            className='flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold cursor-pointer shadow-md shadow-orange-600/20 transition-all border border-amber-400/30'
                            title={t('restoreAndSyncLatestFirebaseBackup')}
                        >
                            <MdOutlineSettingsBackupRestore size={16} className={restoring ? 'spin-reload' : ''} />
                            <span>{restoring ? t('restoring') : t('restoreFromFirebase')}</span>
                        </button>
                    )}
                    {hasPermission(CONTROL_SYSTEM_PATH, 'edit') && (
                        <button
                            onClick={handleSaveAllConfigs}
                            disabled={saving}
                            className='flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold cursor-pointer shadow-lg shadow-emerald-600/20 transition-all'
                        >
                            <MdSave size={16} />
                            <span>{saving ? t('saving') : t('saveAllSettings')}</span>
                        </button>
                    )}
                </div>
            </header>

            {user?.role === 'Administrator' ? (
                <div className="p-2 bg-white border border-slate-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-2">
                        <FaGlobeAmericas className="text-indigo-400 text-sm" />
                        <span className="font-bold text-slate-700">
                            {t('selectBrandToConfigure')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 font-semibold cursor-pointer outline-none focus:border-sky-500"
                        >
                            <option value="">🌐 {t('globalConfigMasterTemplate')}</option>
                            {brandsList.map((br, idx) => (
                                <option key={idx} value={br}>🏷️ {br} {t('settings')}</option>
                            ))}
                        </select>

                        {selectedBrand && (
                            hasPermission(CONTROL_SYSTEM_PATH, 'edit') && (
                                <button
                                    type="button"
                                    onClick={handleCloneFromGlobal}
                                    disabled={saving}
                                    className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-md text-xs font-bold transition-all border border-sky-200 flex items-center gap-1.5 cursor-pointer"
                                    title={t('copyGlobalConfigurationsToBrand')}
                                >
                                    <MdOutlineSettingsBackupRestore className="text-sm" />
                                    <span>{t('syncFromGlobal')}</span>
                                </button>
                            )
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-2 bg-white border border-slate-300 rounded-md flex items-center justify-between text-xs text-sky-700 font-semibold">
                    <span>{t('configuringBrandTenantSettings')}: <span className="font-bold text-slate-900">{selectedBrand || 'Global'}</span></span>
                </div>
            )}


            {message && (
                <div className="p-2 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold animate-fade-in">
                    {message}
                </div>
            )}

            <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-md">
                <div className="flex items-center gap-2 border-b border-slate-300 bg-[#f3f3f3] px-3 py-2 text-xs text-slate-700">
                    <FaFolderOpen className="text-sky-700" />
                    <span className="font-semibold">{t('systemMdmRegistryEditor')}</span>
                </div>
                <div role="menubar" aria-label={t('registryMenu')} className="flex gap-1 border-b border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                    {[['File', 'fileMenu'], ['Edit', 'editMenu'], ['View', 'viewMenu'], ['Favorites', 'favoritesMenu'], ['Help', 'helpMenu']].map(([menu, key]) => (
                        <span key={menu} role="menuitem" className="cursor-default px-2 py-1 hover:bg-sky-100">{t(key)}</span>
                    ))}
                </div>
                <div className="flex min-h-9 items-center gap-2 border-b border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                    <FaGlobeAmericas className="text-sky-700" />
                    <span>{t('computer')}</span><span className="text-slate-400">›</span>
                    <span>{t('systemTitle')}</span><span className="text-slate-400">›</span>
                    <span className="truncate font-semibold">{activeExplorerFile.label}</span>
                </div>

                <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="border-b border-slate-300 bg-white p-2 md:border-b-0 md:border-r">
                        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold text-slate-600">
                            <FaShieldAlt className="text-sky-700" /> {t('registryTree')}
                        </div>
                        <div className="mb-2 flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                            <FaFolderOpen className="text-sky-700" /> {t('computer')}
                        </div>
                        <nav aria-label={t('controlSystemFolders', lang === 'km' ? 'ថតឯកសារប្រព័ន្ធគ្រប់គ្រង' : 'Control system folders')} className="space-y-2 pl-4">
                            {accessibleExplorerFolders.map(folder => {
                                const folderIsOpen = folder.files.some(file => file.id === activeExplorerFile.id);
                                return (
                                    <div key={folder.name}>
                                        <div className="mb-0.5 flex items-center gap-2 px-2 text-xs font-semibold text-slate-700">
                                            {folderIsOpen ? <FaFolderOpen className="text-amber-500" /> : <FaFolder className="text-amber-500" />}
                                            {folder.name}
                                        </div>
                                        <div className="space-y-0.5">
                                            {folder.files.map(file => (
                                                <button
                                                    key={file.id}
                                                    type="button"
                                                    onClick={() => setActiveFile(file.id)}
                                                    aria-current={activeExplorerFile.id === file.id ? 'page' : undefined}
                                                    className={`ml-5 flex w-[calc(100%-1.25rem)] items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors ${activeExplorerFile.id === file.id ? 'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                                                >
                                                    <span className={`shrink-0 ${file.color}`}>{file.icon}</span>
                                                    <span className="truncate">{file.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </nav>
                    </aside>

                    <main className="min-w-0 bg-white">
                        {!activeExplorerFile && (
                            <div className="p-6 text-sm text-slate-500">
                                You do not have read permission for any Control System section.
                            </div>
                        )}
                        {activeExplorerFile && <>
                        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,.8fr)_minmax(100px,1fr)] border-b border-slate-300 bg-[#f3f3f3] px-3 py-2 text-xs font-semibold text-slate-700">
                            <span>{t('name')}</span><span>{t('type')}</span><span>{t('data')}</span>
                        </div>
                        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,.8fr)_minmax(100px,1fr)] items-center border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                            <span className="flex min-w-0 items-center gap-2 truncate"><FaFolder className="shrink-0 text-amber-500" />{activeExplorerFile.label}</span>
                            <span>{t('configurationFile')}</span>
                            <span className="truncate">{selectedBrand || 'Global'} settings</span>
                        </div>
                        <div className="p-2 sm:p-2">

            <div className="grid grid-cols-1 gap-4">

                {/* Section 1: Lock Phone Display Text & Phone Number */}
                {activeExplorerFile.id === 'lock-screen' && (
                <div className="p-6 rounded-3xl glass-card border border-red-500/30 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-red-400 text-xs font-bold uppercase">
                        <FaPhoneAlt /> Lost Phone Lock Display Text & Hotline Number
                        <OriginBadge fieldKey="lockphone_display_text" />
                        <OriginBadge fieldKey="lockphone_telegram_chat_ids" />
                    </div>

                    <div className="space-y-3 text-xs">
                        <div>
                            <label className="block text-gray-400 font-semibold mb-1">{t('lockScreenDisplayTextKhmerEnglish')}</label>
                            <input
                                type="text"
                                value={lockphoneDisplayText}
                                onChange={(e) => setLockphoneDisplayText(e.target.value)}
                                disabled={!canEditSection('lock-screen')}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-khmer"
                                placeholder={t('lockScreenDisplayTextExample')}
                            />
                            <p className="mt-1.5 text-[10px] text-amber-400/80 font-mono leading-relaxed">
                                💡 Use <span className="bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.5 rounded text-amber-300 font-bold">{'{{customerName}}'}</span> — it will be replaced automatically with the customer's name when locking the phone.
                            </p>
                        </div>
                        <div>
                            <label className="block text-gray-400 font-semibold mb-1">{t('hotlinePhoneNumberToCall')}</label>
                            <input
                                type="text"
                                value={lockphonePhoneNumber}
                                onChange={(e) => setLockphonePhoneNumber(e.target.value)}
                                disabled={!canEditSection('lock-screen')}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-mono"
                                placeholder="+855 12 903 120"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 font-semibold mb-1">{t('telegramChatIdsForLockNotifications')}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newLockphoneTelegramChatId}
                                    onChange={(e) => setNewLockphoneTelegramChatId(e.target.value)}
                                    disabled={!canEditSection('lock-screen')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addLockphoneTelegramChatId();
                                        }
                                    }}
                                    className="h-10 min-w-0 flex-1 rounded-[5px] border border-gray-700 bg-gray-900 px-3 font-mono text-gray-100"
                                    placeholder={t('telegramAccountChatIdPlaceholder')}
                                />
                                <button
                                    type="button"
                                    onClick={addLockphoneTelegramChatId}
                                    disabled={!canEditSection('lock-screen')}
                                    className="rounded-[5px] bg-slate-700 px-4 font-bold text-white hover:bg-slate-600"
                                >
                                    Add ID
                                </button>
                            </div>
                            <p className="mt-1.5 text-[10px] leading-relaxed text-amber-400/80">
                                Add a numeric Telegram ID for each recipient. Each recipient must start the bot first; negative group chat IDs are supported.
                            </p>
                            {lockphoneTelegramChatIds.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {lockphoneTelegramChatIds.map((chatId) => (
                                        <li key={chatId} className="flex items-center justify-between rounded-[5px] border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-200">
                                            <span>{chatId}</span>
                                            {canDeleteSection('lock-screen') && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!canDeleteSection('lock-screen')) return;
                                                        const updated = lockphoneTelegramChatIds.filter(id => id !== chatId);
                                                        setLockphoneTelegramChatIds(updated);
                                                        saveConfigToMongoDB('lockphone_telegram_chat_ids', updated, 'lock-screen', 'delete');
                                                    }}
                                                    className="font-sans font-semibold text-rose-400 hover:text-rose-300"
                                                    aria-label={`Remove Telegram ID ${chatId}`}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="pt-2 text-right">
                            <button
                                onClick={saveLockphoneConfig}
                                disabled={saving || !canEditSection('lock-screen')}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-[5px] font-bold flex items-center gap-1 ml-auto cursor-pointer shadow-lg shadow-red-600/30"
                            >
                                <MdSave size={16} /> Save Lock Config
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {/* Section 2: Installment Late Penalty Rules */}
                {activeExplorerFile.id === 'penalties' && (
                <div className="p-6 rounded-3xl glass-card border border-amber-500/30 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-amber-300 text-xs font-bold uppercase">
                        <FaDollarSign /> Installment Late Penalty Rules
                        <OriginBadge fieldKey="late_penalty_rules" />
                    </div>

                    <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-gray-400 font-semibold mb-1">{t('brand')}</label>
                                <select
                                    value={newPenaltyBrand}
                                    onChange={(e) => setNewPenaltyBrand(e.target.value)}
                                    disabled={!canEditSection('penalties')}
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-semibold"
                                >
                                    <option value="">{t('global')}</option>
                                    {brandsList.map((b, idx) => (
                                        <option key={idx} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-400 font-semibold mb-1">{t('afterDays')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={newPenaltyDays}
                                    onChange={(e) => setNewPenaltyDays(Number(e.target.value) || 0)}
                                    disabled={!canEditSection('penalties')}
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 font-semibold mb-1">{t('penalty')} / Day ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newPenaltyAmount}
                                    onChange={(e) => setNewPenaltyAmount(Number(e.target.value) || 0)}
                                    disabled={!canEditSection('penalties')}
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canEditSection('penalties')) return;
                                    const brandValue = (newPenaltyBrand || selectedBrand || 'MDM').trim();
                                    if (!brandValue || newPenaltyDays < 0 || newPenaltyAmount < 0) return;
                                    const nextRule = { brand: brandValue, afterDays: Number(newPenaltyDays), penaltyPerDay: Number(newPenaltyAmount) };
                                    setLatePenaltyRules(prev => [...prev, nextRule]);
                                    setNewPenaltyDays(1);
                                    setNewPenaltyAmount(0);
                                }}
                                disabled={!canEditSection('penalties')}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-[5px] font-bold cursor-pointer"
                            >
                                Add Rule
                            </button>
                        </div>

                        <div className="space-y-2">
                            {latePenaltyRules.length === 0 ? (
                                <div className="p-2 rounded-[5px] bg-gray-950/70 border border-gray-800 text-gray-400 text-[11px] italic">
                                    No penalty rule configured yet.
                                </div>
                            ) : (
                                latePenaltyRules.map((rule, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-[5px] bg-gray-950/60 border border-gray-800">
                                        <input
                                            type="text"
                                            value={rule.brand || ''}
                                            onChange={(e) => {
                                                const next = [...latePenaltyRules];
                                                next[idx].brand = e.target.value;
                                                setLatePenaltyRules(next);
                                            }}
                                            disabled={!canEditSection('penalties')}
                                            className="w-28 h-9 px-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-[11px] font-semibold"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={rule.afterDays ?? 0}
                                            onChange={(e) => {
                                                const next = [...latePenaltyRules];
                                                next[idx].afterDays = Number(e.target.value) || 0;
                                                setLatePenaltyRules(next);
                                            }}
                                            disabled={!canEditSection('penalties')}
                                            className="w-20 h-9 px-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-[11px] font-mono"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={rule.penaltyPerDay ?? 0}
                                            onChange={(e) => {
                                                const next = [...latePenaltyRules];
                                                next[idx].penaltyPerDay = Number(e.target.value) || 0;
                                                setLatePenaltyRules(next);
                                            }}
                                            disabled={!canEditSection('penalties')}
                                            className="w-28 h-9 px-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-[11px] font-mono"
                                        />
                                        {canDeleteSection('penalties') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!canDeleteSection('penalties')) return;
                                                    const updated = latePenaltyRules.filter((_, index) => index !== idx);
                                                    setLatePenaltyRules(updated);
                                                    saveConfigToMongoDB('late_penalty_rules', updated, 'penalties', 'delete');
                                                }}
                                                className="ml-auto px-2 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-2 text-right">
                            <button
                                onClick={() => saveConfigToMongoDB('late_penalty_rules', latePenaltyRules)}
                                disabled={saving || !canEditSection('penalties')}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-[5px] font-bold flex items-center gap-1 ml-auto cursor-pointer shadow-lg shadow-amber-600/30"
                            >
                                <MdSave size={16} /> Save Late Penalty Rules
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {/* Section 3: Roles Definition */}
                {activeExplorerFile.id === 'roles' && (
                <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-purple-300 text-xs font-bold uppercase">
                        <FaUserShield /> System User Roles Configurator
                        <OriginBadge fieldKey="roles" />
                    </div>

                    <div className="space-y-3 text-xs">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newRoleInput}
                                onChange={(e) => setNewRoleInput(e.target.value)}
                                disabled={!canEditSection('roles')}
                                placeholder={t('newRolePlaceholder')}
                                className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100"
                            />
                            <button
                                onClick={handleAddRole}
                                disabled={!canEditSection('roles')}
                                className="px-4 h-10 bg-purple-600 hover:bg-purple-500 text-white rounded-[5px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <MdAddCircle size={16} /> Add Role
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            {roles.map((r, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border border-gray-700 rounded-[5px] font-semibold text-gray-200">
                                    <span>{r}</span>
                                    {r !== 'Administrator' && canDeleteSection('roles') && (
                                        <button onClick={() => handleDeleteRole(rIdx)} className="text-red-400 hover:text-red-300">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}

                {/* Section 4: Follow Up 4 System Customizer (Private Brand Reasons & Settings) */}
                {activeExplorerFile.id === 'follow-up' && (
                <div className="p-6 rounded-3xl glass-card border border-rose-500/30 space-y-5 shadow-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-800">
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-bold uppercase">
                            <FaList className="text-rose-400" />
                            <span>⚡ {t('followUp4PrivateReasonSettings')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-semibold border border-slate-700">
                                {t('configuredBrand', lang === 'km' ? 'Brand កំពុងកំណត់:' : 'Configured brand:')} <strong className="text-emerald-400 font-mono">{selectedBrand || '🌐 Global Template'}</strong>
                            </span>
                            <OriginBadge fieldKey="droplists" />
                        </div>
                    </div>

                    <p className="text-xs text-slate-400">
                        {t('followUpReasonOptionsHelp', lang === 'km' ? 'កំណត់បញ្ជីមូលហេតុ (Reasons) និងជម្រើស Droplists សម្រាប់ទំព័រ' : 'Configure reason lists and dropdown options separately for')} <strong className="text-rose-400 font-semibold">{t('rejectSubmit')}</strong> {t('and', lang === 'km' ? 'និង' : 'and')} <strong className="text-amber-400 font-semibold">{t('rejectCs')}</strong>. {t('followUpReasonOptionsHelpSuffix', lang === 'km' ? 'ទិន្នន័យដែលបានបញ្ចូលនៅទីនេះ នឹងបង្ហាញជាប្រអប់បំពេញលេខនៅក្នុង Modal នៃទំព័រ Follow Up 4 តាម Brand នីមួយៗភ្លាមៗ។' : 'Options entered here appear immediately in the Follow Up 4 modal for each brand.')}
                    </p>

                    <div className="rounded-[5px] border border-sky-600/30 bg-slate-900/80 p-3 space-y-3">
                        <h4 className="text-xs font-bold text-sky-300">{t('followUp4DropdownOptions')}</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                value={selectedWorkflowCategory}
                                onChange={(event) => setSelectedWorkflowCategory(event.target.value)}
                                className="h-9 rounded-[5px] border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100"
                            >
                                {workflowDroplists.map(list => (
                                    <option key={list.category} value={list.category}>{list.category}</option>
                                ))}
                            </select>
                            <input
                                value={newWorkflowOption}
                                onChange={(event) => setNewWorkflowOption(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleAddSpecificReason(selectedWorkflowCategory, newWorkflowOption, setNewWorkflowOption)}
                                placeholder={t('newDropdownOptionPlaceholder')}
                                disabled={!canEditSection('follow-up')}
                                className="h-9 min-w-0 flex-1 rounded-[5px] border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddSpecificReason(selectedWorkflowCategory, newWorkflowOption, setNewWorkflowOption)}
                                disabled={!canEditSection('follow-up') || !newWorkflowOption.trim()}
                                className="h-9 rounded-[5px] bg-sky-600 px-3 text-xs font-bold text-white disabled:opacity-40"
                            >
                                <MdAddCircle className="inline mr-1" /> {t('add')}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(workflowDroplists.find(list => list.category === selectedWorkflowCategory)?.items || []).map((option, index) => (
                                <span key={`${option}-${index}`} className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200">
                                    {option}
                                    {canDeleteSection('follow-up') && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSpecificReason(selectedWorkflowCategory, index)}
                                            aria-label={`Delete ${option}`}
                                            className="text-rose-400 hover:text-rose-300"
                                        >
                                            <MdDelete size={13} />
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Box A: Reject Submit Reasons */}
                        <div className="p-2 rounded-[5px] bg-slate-900/90 border border-rose-600/30 space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                                <h4 className="text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                                    <span>🛑</span> Reject Submit Reasons
                                </h4>
                                <span className="text-[10px] bg-rose-950/80 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800/40 font-mono">
                                    {(droplists.find(d => d.category === 'Reject Submit Reasons')?.items || []).length} {t('options', lang === 'km' ? 'ជម្រើស' : 'options')}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={newRejectSubmitInput}
                                    onChange={(e) => setNewRejectSubmitInput(e.target.value)}
                                    disabled={!canEditSection('follow-up')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                    placeholder={t('newRejectSubmitReasonPlaceholder')}
                                    className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-[5px] text-slate-100 text-xs focus:border-rose-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                    disabled={!canEditSection('follow-up') || !newRejectSubmitInput.trim()}
                                    className="px-3.5 h-9 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/20"
                                >
                                    <MdAddCircle size={15} /> <span>{t('add')}</span>
                                </button>
                            </div>

                            {/* Reasons List */}
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {(droplists.find(d => d.category === 'Reject Submit Reasons')?.items || []).map((reason, rIdx) => (
                                    <div
                                        key={rIdx}
                                        className="flex items-center justify-between p-2 rounded-[5px] bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-mono">
                                                {rIdx + 1}
                                            </span>
                                            {reason}
                                        </span>
                                        {canDeleteSection('follow-up') && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSpecificReason('Reject Submit Reasons', rIdx)}
                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 p-2 rounded-lg cursor-pointer transition-colors"
                                                title={t('deleteThisReason')}
                                            >
                                                <MdDelete size={15} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Box B: Reject CS Reasons */}
                        <div className="p-2 rounded-[5px] bg-slate-900/90 border border-amber-600/30 space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
                                <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                                    <span>⚠️</span> Reject CS Reasons
                                </h4>
                                <span className="text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800/40 font-mono">
                                    {(droplists.find(d => d.category === 'Reject CS Reasons')?.items || []).length} {t('options', lang === 'km' ? 'ជម្រើស' : 'options')}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={newRejectCsInput}
                                    onChange={(e) => setNewRejectCsInput(e.target.value)}
                                    disabled={!canEditSection('follow-up')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                    placeholder={t('newRejectCsReasonPlaceholder')}
                                    className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-[5px] text-slate-100 text-xs focus:border-amber-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                    disabled={!canEditSection('follow-up') || !newRejectCsInput.trim()}
                                    className="px-3.5 h-9 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-amber-600/20"
                                >
                                    <MdAddCircle size={15} /> <span>{t('add')}</span>
                                </button>
                            </div>

                            {/* Reasons List */}
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {(droplists.find(d => d.category === 'Reject CS Reasons')?.items || []).map((reason, rIdx) => (
                                    <div
                                        key={rIdx}
                                        className="flex items-center justify-between p-2 rounded-[5px] bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-mono">
                                                {rIdx + 1}
                                            </span>
                                            {reason}
                                        </span>
                                        {canDeleteSection('follow-up') && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSpecificReason('Reject CS Reasons', rIdx)}
                                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 p-2 rounded-lg cursor-pointer transition-colors"
                                                title={t('deleteThisReason')}
                                            >
                                                <MdDelete size={15} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Section 5: General Dynamic Droplists & Options */}
                {activeExplorerFile.id === 'dropdowns' && (
                <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-emerald-300 text-xs font-bold uppercase">
                        <FaList /> System Dropdown Lists & Dynamic Options (Droplists)
                        <OriginBadge fieldKey="droplists" />
                    </div>

                    <div className="space-y-4 text-xs">
                        <div className="flex items-center gap-3">
                            <label className="text-gray-300 font-semibold">{t('selectDroplistCategory')}:</label>
                            <select
                                value={selectedCategoryIdx}
                                onChange={(e) => setSelectedCategoryIdx(Number(e.target.value))}
                                className="h-9 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-semibold"
                            >
                                {systemDroplists.map((d, dIdx) => (
                                    <option key={dIdx} value={dIdx}>{d.category}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newItemInput}
                                onChange={(e) => setNewItemInput(e.target.value)}
                                placeholder={`${t('addItemTo')} ${systemDroplists[selectedCategoryIdx]?.category}...`}
                                disabled={!canEditSection('dropdowns')}
                                className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100"
                            />
                            <button
                                onClick={handleAddItemToCategory}
                                disabled={!canEditSection('dropdowns') || !newItemInput.trim()}
                                className="px-4 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[5px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <MdAddCircle size={16} /> Add Option
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            {systemDroplists.map((cat, catIdx) => {
                                const isBrandCat = cat.category === 'Brands';
                                const catItems = Array.isArray(cat?.items) ? cat.items : [];
                                // For Brands category, regular users only see their own assigned brand
                                const itemsToDisplay = (isBrandCat && !isMasterAdmin && user?.brand)
                                    ? catItems.filter(item => item && typeof item === 'string' && item.toLowerCase() === user.brand.toLowerCase())
                                    : catItems;

                                return (
                                    <div key={catIdx} className="p-2 rounded-[5px] bg-gray-950/60 border border-gray-800 space-y-2">
                                        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                                            <h4 className="font-bold text-gray-200">{cat.category}</h4>
                                            {isBrandCat && !isMasterAdmin && (
                                                <span className="text-[10px] text-amber-400 font-semibold">({t('yourBrand')})</span>
                                            )}
                                        </div>
                                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                            {itemsToDisplay.map((item, itemIdx) => {
                                                const originalIndex = catItems.indexOf(item);
                                                // Regular users can NEVER delete Brands items
                                                const canDeleteThis = canDeleteSection('dropdowns') && (!isBrandCat || isMasterAdmin);

                                                return (
                                                    <div key={itemIdx} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/60 text-gray-300 text-[11px]">
                                                        <span>{item}</span>
                                                        {canDeleteThis && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteItemFromCategory(catIdx, originalIndex)}
                                                                className="text-red-400 hover:text-red-300 cursor-pointer"
                                                                title={t('deleteItem')}
                                                            >
                                                                <MdDelete size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                )}

                {/* Section 6: Product Variants Management */}
                {activeExplorerFile.id === 'variants' && (
                <div className="p-6 rounded-3xl glass-card border border-teal-500/30 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                        <div className="flex items-center gap-2 text-teal-300 text-xs font-bold uppercase">
                            <FaTags /> {lang === 'km' ? 'វ៉ារ្យ៉ង់ផលិតផល (Product Variants)' : 'Product Variants & Descriptions'}
                            <OriginBadge fieldKey="product_variants" />
                        </div>
                        <span className="text-[10px] bg-teal-950/80 text-teal-300 px-2 py-0.5 rounded-full border border-teal-800/40 font-mono">
                            {productVariants.length} {lang === 'km' ? 'វ៉ារ្យ៉ង់' : 'Variants'}
                        </span>
                    </div>

                    <p className="text-xs text-gray-400">
                        {lang === 'km'
                            ? 'កំណត់កូដវ៉ារ្យ៉ង់ (Variant Code) ដូចជា LL/A, ZA/A, VN/A និងការពិពណ៌នា (Description) ដើម្បីដឹងពីប្រទេស/តំបន់/លក្ខណៈ SIM។ វ៉ារ្យ៉ង់ទាំងនេះនឹងបង្ហាញក្នុង Droplist ពេលកំណត់តម្លៃទូរស័ព្ទនៅ Settings -> Products។'
                            : 'Configure device variant codes (e.g. LL/A, ZA/A, VN/A) and descriptions (region/SIM specs). These variants will appear in the dropdown list when managing phone valuation prices.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-[140px_180px_1fr_auto] gap-2 text-xs">
                        <input
                            type="text"
                            value={newVariantName}
                            onChange={(e) => setNewVariantName(e.target.value)}
                            placeholder={lang === 'km' ? 'កូដវ៉ារ្យ៉ង់ (ឧ. LL/A)' : 'Variant (e.g. LL/A)'}
                            disabled={!canEditSection('variants')}
                            className="h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-bold uppercase focus:border-teal-500 outline-none"
                        />
                        <input
                            type="text"
                            value={newVariantRegion}
                            onChange={(e) => setNewVariantRegion(e.target.value)}
                            placeholder={lang === 'km' ? 'តំបន់ (ឧ. United States)' : 'Region (e.g. United States)'}
                            disabled={!canEditSection('variants')}
                            className="h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 focus:border-teal-500 outline-none"
                        />
                        <input
                            type="text"
                            value={newVariantDesc}
                            onChange={(e) => setNewVariantDesc(e.target.value)}
                            placeholder={lang === 'km' ? 'ការពិពណ៌នា (ឧ. eSIM + Single SIM)' : 'Description (e.g. United States - eSIM + Nano SIM)'}
                            disabled={!canEditSection('variants')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const trimmedName = newVariantName.trim();
                                    if (!trimmedName) return;
                                    if (productVariants.some(v => (typeof v === 'string' ? v : v.name)?.toLowerCase() === trimmedName.toLowerCase())) {
                                        alert('Variant code already exists!');
                                        return;
                                    }
                                    const updated = [...productVariants, { name: trimmedName, region: newVariantRegion.trim(), description: newVariantDesc.trim() }];
                                    setProductVariants(updated);
                                    setNewVariantName('');
                                    setNewVariantRegion('');
                                    setNewVariantDesc('');
                                    fetch(`${API_BASE}/controlsystem`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ key: 'product_variants', value: updated, brand: selectedBrand })
                                    }).then(() => {
                                        setMessage(`${t('controlSystemConfigurationUpdated')} 'Product Variants' ${t('forBrand')} '${selectedBrand || t('global')}'`);
                                        fetchFieldOrigins(selectedBrand);
                                    });
                                }
                            }}
                            className="h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 focus:border-teal-500 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const trimmedName = newVariantName.trim();
                                if (!trimmedName) return;
                                if (productVariants.some(v => (typeof v === 'string' ? v : v.name)?.toLowerCase() === trimmedName.toLowerCase())) {
                                    alert('Variant code already exists!');
                                    return;
                                }
                                const updated = [...productVariants, { name: trimmedName, region: newVariantRegion.trim(), description: newVariantDesc.trim() }];
                                setProductVariants(updated);
                                setNewVariantName('');
                                setNewVariantRegion('');
                                setNewVariantDesc('');
                                fetch(`${API_BASE}/controlsystem`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ key: 'product_variants', value: updated, brand: selectedBrand })
                                }).then(() => {
                                    setMessage(`${t('controlSystemConfigurationUpdated')} 'Product Variants' ${t('forBrand')} '${selectedBrand || t('global')}'`);
                                    fetchFieldOrigins(selectedBrand);
                                });
                            }}
                            disabled={!canEditSection('variants') || !newVariantName.trim()}
                            className="px-4 h-10 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-[5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-md shadow-teal-600/20"
                        >
                            <MdAddCircle size={16} /> <span>{lang === 'km' ? 'បន្ថែមវ៉ារ្យ៉ង់' : 'Add Variant'}</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/70">
                        <table className="w-full text-left text-xs text-gray-300">
                            <thead className="bg-gray-900/80 uppercase text-[11px] text-gray-400 border-b border-gray-800">
                                <tr>
                                    <th className="px-4 py-2.5 w-12 text-center">#</th>
                                    <th className="px-4 py-2.5 w-36">{lang === 'km' ? 'កូដវ៉ារ្យ៉ង់' : 'Variant Code'}</th>
                                    <th className="px-4 py-2.5 w-48">{lang === 'km' ? 'តំបន់' : 'Region'}</th>
                                    <th className="px-4 py-2.5">{lang === 'km' ? 'ការពិពណ៌នា' : 'Description'}</th>
                                    {canDeleteSection('variants') && <th className="px-4 py-2.5 w-20 text-center">{lang === 'km' ? 'សកម្មភាព' : 'Action'}</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                                {productVariants.map((v, idx) => {
                                    const vName = typeof v === 'string' ? v : v.name;
                                    const vRegion = typeof v === 'string' ? '' : (v.region || '');
                                    const vDesc = typeof v === 'string' ? '' : (v.description || '');
                                    return (
                                        <tr key={idx} className="hover:bg-gray-900/40 transition-colors">
                                            <td className="px-4 py-2.5 text-center text-gray-500 font-mono">{idx + 1}</td>
                                            <td className="px-4 py-2.5 text-center sm:text-left">
                                                <span
                                                    className="inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold border border-slate-600 bg-black tracking-wider shadow-sm"
                                                    style={{ color: '#ffffff' }}
                                                >
                                                    {vName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-teal-300 font-medium">
                                                {vRegion || <span className="text-gray-600 italic">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-300">{vDesc || <span className="text-gray-600 italic">—</span>}</td>
                                            {canDeleteSection('variants') && (
                                                <td className="px-4 py-2.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = productVariants.filter((_, i) => i !== idx);
                                                            setProductVariants(updated);
                                                            fetch(`${API_BASE}/controlsystem`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ key: 'product_variants', value: updated, brand: selectedBrand })
                                                            }).then(() => {
                                                                setMessage(`${t('controlSystemConfigurationUpdated')} 'Product Variants' ${t('forBrand')} '${selectedBrand || t('global')}'`);
                                                                fetchFieldOrigins(selectedBrand);
                                                            });
                                                        }}
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-950/60 p-1.5 rounded transition-colors"
                                                        title={t('deleteItem')}
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {productVariants.length === 0 && (
                                    <tr>
                                        <td colSpan={canDeleteSection('variants') ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                                            {lang === 'km' ? 'មិនទាន់មានវ៉ារ្យ៉ង់នៅឡើយទេ។ សូមបន្ថែមវ៉ារ្យ៉ង់ខាងលើ។' : 'No variants configured yet. Add one above.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}

            </div>

            {/* Section 5: Brand & Sub Brand Management — Administrator + Global Config only */}
            {activeExplorerFile.id === 'brands' && user?.role === 'Administrator' && selectedBrand === '' && (
                <div className="p-6 rounded-3xl glass-card border border-amber-500/30 space-y-6 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-amber-300 text-xs font-bold uppercase">
                        <FaLayerGroup /> {t('brandTenant')} &amp; Sub Brand Management
                    </div>

                    <p className="text-[11px] text-gray-400">
                        {t('brandSubBrandManagementDescription')}
                    </p>

                    {/* Create Brand Input */}
                    <div className="flex items-center gap-2 text-xs">
                        <input
                            type="text"
                            value={newBrandInput}
                            onChange={(e) => setNewBrandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                            disabled={!canEditSection('brands')}
                            placeholder={t('newBrandNamePlaceholder')}
                            className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 focus:border-amber-500 outline-none"
                        />
                        <button
                            onClick={handleAddBrand}
                            disabled={saving || !canEditSection('brands') || !newBrandInput.trim()}
                            className="px-4 h-10 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-[5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                            <MdAddCircle size={16} /> Add Brand
                        </button>
                    </div>

                    {/* Brands with Sub Brands Cards */}
                    <div className="space-y-4 pt-1">
                        {(!Array.isArray(brandsList) || brandsList.length === 0) && (
                            <p className="text-gray-500 text-xs italic">{t('noBrandsDefined')}</p>
                        )}
                        {(Array.isArray(brandsList) ? brandsList : []).map((br, brIdx) => {
                            const rawSubs = brandSubbrands?.[br];
                            const currentSubBrands = Array.isArray(rawSubs)
                                ? rawSubs
                                : (typeof rawSubs === 'string' && rawSubs.trim() ? [rawSubs.trim()] : []);
                            return (
                                <div
                                    key={brIdx}
                                    className="p-4 bg-gray-900/80 border border-amber-600/30 rounded-xl space-y-3 shadow-md"
                                >
                                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                                                <FaLayerGroup size={13} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-300 text-sm">{br}</h4>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {currentSubBrands.length} Sub Brands
                                                </span>
                                            </div>
                                        </div>
                                        {canDeleteSection('brands') && (
                                            <button
                                                onClick={() => handleDeleteBrandClick(br)}
                                                disabled={saving}
                                                className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1"
                                                title={`Remove brand '${br}'`}
                                            >
                                                <MdDelete size={14} />
                                                <span>{t('deleteBrand')}</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Sub Brands Section */}
                                    <div className="space-y-2 pl-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-gray-300">
                                                {t('subBrandsMoreThanTwo', lang === 'km' ? 'Sub Brands (អនុម៉ាក) — អាចបង្កើតលើសពី ២ បាន:' : 'Sub-brands (you can create more than two):')}
                                            </span>
                                            <span className="text-[10px] text-amber-400/80 italic">
                                                💡 {t('subBrandLegacyDataNote', lang === 'km' ? 'ទិន្នន័យចាស់រត់ចូល Sub Brand ដំបូងបង្អស់' : 'Existing data is assigned to the first sub-brand')}
                                            </span>
                                        </div>

                                        {/* Sub Brands Chips */}
                                        <div className="flex flex-wrap gap-2 min-h-[30px] items-center">
                                            {currentSubBrands.length === 0 ? (
                                                <span className="text-gray-500 text-xs italic">
                                                    {t('noSubBrandsYet', lang === 'km' ? 'មិនទាន់មាន Sub Brand នៅឡើយ (សូមបង្កើតខាងក្រោម)' : 'No sub-brands yet (create one below)')}
                                                </span>
                                            ) : (
                                                currentSubBrands.map((sb, sbIdx) => (
                                                    <div
                                                        key={sbIdx}
                                                        className="flex items-center gap-1.5 px-3 py-1 bg-sky-950/70 border border-sky-600/40 rounded-full text-sky-200 text-xs font-semibold"
                                                    >
                                                        <span>{sb}</span>
                                                        {canDeleteSection('brands') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSubBrand(br, sb)}
                                                                disabled={saving}
                                                                className="text-red-400 hover:text-red-300 ml-1 text-xs cursor-pointer"
                                                                title={`Remove sub brand '${sb}'`}
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add Sub Brand inline */}
                                        <div className="flex items-center gap-2 pt-1 max-w-md">
                                            <input
                                                type="text"
                                                value={newSubBrandInputs[br] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setNewSubBrandInputs(prev => ({ ...prev, [br]: val }));
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubBrand(br)}
                                                disabled={!canEditSection('brands')}
                                                placeholder={`${t('enterNewSubBrandFor', lang === 'km' ? 'បញ្ចូល Sub Brand ថ្មីសម្រាប់' : 'Enter a new sub-brand for')} ${br}...`}
                                                className="flex-1 h-8 px-3 bg-gray-950 border border-gray-700 rounded-[5px] text-gray-200 text-xs focus:border-sky-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddSubBrand(br)}
                                                disabled={saving || !canEditSection('brands') || !(newSubBrandInputs[br] || '').trim()}
                                                className="px-3 h-8 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                                            >
                                                <MdAddCircle size={14} /> {t('addSubBrand', lang === 'km' ? 'បន្ថែម Sub Brand' : 'Add sub-brand')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
                        </div>
                        </>}
                    </main>
                </div>
            </div>

            {/* Custom Brand Delete Confirmation Modal */}
            {deleteBrandModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-2">
                    <div className="bg-white border border-red-300 rounded-md p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                <MdDelete size={18} />
                                {t('deleteBrandConfirm')}
                            </h3>
                            <button onClick={() => setDeleteBrandModal({ open: false, brandName: '' })} className="text-gray-400 hover:text-gray-200 text-xs font-bold cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-3 text-xs text-gray-200">
                            <p className="font-bold text-sm text-white">
                                {t('confirmDeleteBrand', lang === 'km' ? 'តើអ្នកពិតជាចង់លុប Brand' : 'Are you sure you want to delete brand')} <span className="text-amber-400 font-mono">"{deleteBrandModal.brandName}"</span> {t('confirmDeleteBrandSuffix', lang === 'km' ? 'នេះមែនទេ?' : '?')}
                            </p>
                            <div className="p-2 bg-red-950/50 border border-red-800/80 rounded-[5px] space-y-1.5 text-red-200">
                                <p className="font-bold uppercase text-[10px] text-red-400 tracking-wider">{t('deleteBrandWarning')}:</p>
                                <p className="text-[11px] leading-relaxed">
                                    {t('deleteBrandWarning', lang === 'km' ? 'នៅពេលលុប Brand នេះ ព័ត៌មាន និងទិន្នន័យទាំងអស់ដែលពាក់ព័ន្ធនឹង Brand' : 'Deleting this brand also removes all information and data associated with')} <span className="font-mono font-bold text-amber-300">"{deleteBrandModal.brandName}"</span> {t('including', lang === 'km' ? 'រួមមាន៖' : 'including:')}
                                </p>
                                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-red-300 font-medium">
                                    <li>{t('contract')} (Contracts)</li>
                                    <li>{t('systemUsers')}</li>
                                    <li>{t('deviceActionLogs')}</li>
                                </ul>
                                <p className="text-[11px] font-bold text-red-400 pt-1">
                                    {t('deleteBrandIrreversible', lang === 'km' ? 'ទិន្នន័យទាំងនេះនឹងត្រូវបានលុបចេញពីប្រព័ន្ធ MongoDB ទាំងស្រុង ដោយមិនអាចទាញយកមកវិញបានឡើយ!' : 'This data will be permanently deleted from MongoDB and cannot be recovered!')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                            <button
                                type="button"
                                onClick={() => setDeleteBrandModal({ open: false, brandName: '' })}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteBrand}
                                disabled={saving}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold shadow-lg shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
                            >
                                <MdDelete size={16} /> {saving ? t('purgingData', lang === 'km' ? 'កំពុងលុបទិន្នន័យ...' : 'Purging data...') : t('deleteBrandAndAllData', lang === 'km' ? 'លុប Brand និងទិន្នន័យទាំងអស់' : 'Delete brand and all data')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ControlSystem;