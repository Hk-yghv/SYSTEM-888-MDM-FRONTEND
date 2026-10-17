import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { CONTROL_SYSTEM_PATH, CONTROL_SYSTEM_SECTIONS } from '../../../utils/controlSystemPermissions';
import { IoIosSettings } from 'react-icons/io';
import { MdOutlineSync, MdAddCircle, MdDelete, MdSave, MdOutlineSettingsBackupRestore } from 'react-icons/md';
import { FaPhoneAlt, FaList, FaUserShield, FaLayerGroup, FaGlobeAmericas, FaDollarSign, FaFolder, FaFolderOpen, FaShieldAlt } from 'react-icons/fa';
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
    const { t } = useLanguage();
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

    const explorerFolders = [
        {
            name: 'DEVICE & SECURITY',
            files: [{ id: 'lock-screen', label: 'Lock screen & hotline', icon: <FaPhoneAlt />, color: 'text-rose-400' }]
        },
        {
            name: 'FINANCE',
            files: [{ id: 'penalties', label: 'Late penalty rules', icon: <FaDollarSign />, color: 'text-amber-400' }]
        },
        {
            name: 'ACCESS CONTROL',
            files: [{ id: 'roles', label: 'User roles', icon: <FaUserShield />, color: 'text-sky-400' }]
        },
        {
            name: 'WORKFLOWS',
            files: [{ id: 'follow-up', label: 'Follow Up 4', icon: <FaList />, color: 'text-orange-400' }]
        },
        {
            name: 'SYSTEM DATA',
            files: [{ id: 'dropdowns', label: 'Dropdown lists', icon: <FaLayerGroup />, color: 'text-emerald-400' }]
        },
        ...(user?.role === 'Administrator' && selectedBrand === '' ? [{
            name: 'ORGANIZATION',
            files: [{ id: 'brands', label: 'Brand directory', icon: <FaGlobeAmericas />, color: 'text-violet-400' }]
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
            alert('You do not have permission to restore Control System data.');
            return;
        }
        const isConfirmed = window.confirm(
            t('restoreNotice') + ':\n\n' +
            'តើអ្នកពិតជាចង់ផ្ទេរទិន្នន័យពី Firebase មក MongoDB វិញមែនទេ?\n' +
            'សកម្មភាពនេះនឹងសម្អាតទិន្នន័យ MongoDB ដែលខូច ហើយទាញយកច្បាប់ចម្លងទិន្នន័យចុងក្រោយទាំងអស់ពី Firebase មកវិញ។\n' +
            'ទិន្នន័យនៅក្នុង Firebase នឹងមិនបាត់បង់ឡើយ!'
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
                alert(`✅ ជោគជ័យ! បានផ្ទេរទិន្នន័យពី Firebase មក MongoDB រួចរាល់:\n\n` +
                    `• Contracts: ${data.result.counts?.contracts || 0}\n` +
                    `• Users: ${data.result.counts?.users || 0}\n` +
                    `• Payments: ${data.result.counts?.payments || 0}\n` +
                    `• Control System: ${data.result.counts?.controlSystems || 0}\n` +
                    `• Phone Logs: ${data.result.counts?.phoneLogs || 0}\n` +
                    `• Wallpaper Logs: ${data.result.counts?.wallpaperLogs || 0}`
                );
                fetchControlSystemConfigs();
            } else {
                alert(`❌ បរាជ័យក្នុងការ Restore: ${data.error || data.message || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`❌ Error connecting to server: ${err.message}`);
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
            alert(`You do not have ${permissionAction} permission for this Control System section.`);
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
                setMessage(`Control System '${key}' configuration updated for brand '${selectedBrand || 'Global'}' in MongoDB successfully!`);
                setTimeout(() => setMessage(''), 3000);
                // Mark this field as private after successful save (only for brand-specific saves)
                if (selectedBrand) {
                    setFieldOrigins(prev => ({ ...prev, [key]: 'private' }));
                }
            } else {
                alert(`Failed to save configuration: ${data.error || res.statusText || 'Server Error'}`);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save config error:', err);
            alert(`រក្សាទុកបរាជ័យ: Network Error (${err.message})`);
        }
    };

    const addLockphoneTelegramChatId = () => {
        const chatId = newLockphoneTelegramChatId.trim();
        if (!/^-?\d+$/.test(chatId)) {
            alert('Please enter a numeric Telegram account/chat ID.');
            return;
        }
        if (!lockphoneTelegramChatIds.includes(chatId)) {
            setLockphoneTelegramChatIds((ids) => [...ids, chatId]);
        }
        setNewLockphoneTelegramChatId('');
    };

    const saveLockphoneConfig = async () => {
        if (!canEditSection('lock-screen')) {
            alert('You do not have edit permission for Device & Security.');
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
            if (!response.ok) throw new Error(result.error || response.statusText || 'Server Error');
            setMessage(`Lock Phone configuration updated for ${selectedBrand || 'Global'} successfully!`);
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
            alert(`រក្សាទុកបរាជ័យ: ${err.message}`);
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
            alert('Administrator role cannot be removed!');
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
            alert('ការបន្ថែម Brand ថ្មីត្រូវបានអនុញ្ញាតសម្រាប់តែ Administrator ប៉ុណ្ណោះ!');
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
            alert('លោកអ្នកគ្មានសិទ្ធិលុប Brand ទេ! មុខងារនេះសម្រាប់តែ Administrator ប៉ុណ្ណោះ។');
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
            alert('You do not have edit permission for Organization settings.');
            return;
        }
        const name = newBrandInput.trim();
        if (!name) return;
        if (brandsList.includes(name)) {
            setMessage(`Brand '${name}' already exists!`);
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
            setMessage(`Brand '${name}' ត្រូវបានបង្កើត និងចម្លងរាល់ការកំណត់ពី Global ដោយស្វ័យប្រវត្តិកុំឱ្យទទេ! `);
            setTimeout(() => setMessage(''), 4500);
        } catch (err) {
            setSaving(false);
            console.error('Add brand error:', err);
        }
    };

    const handleAddSubBrand = async (brandName) => {
        if (!canEditSection('brands')) {
            alert('You do not have edit permission for Organization settings.');
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
                setMessage(`បានបន្ថែម Sub Brand '${subName}' សម្រាប់ Brand '${brandName}' និងភ្ជាប់ទិន្នន័យចាស់ដោយស្វ័យប្រវត្តិ!`);
                setTimeout(() => setMessage(''), 4500);
            } else {
                alert(data.error || 'Failed to add sub brand');
            }
        } catch (err) {
            setSaving(false);
            console.error('Add subbrand error:', err);
        }
    };

    const handleDeleteSubBrand = async (brandName, subName) => {
        if (!canDeleteSection('brands')) {
            alert('You do not have delete permission for Organization settings.');
            return;
        }
        if (!window.confirm(`តើអ្នកពិតជាចង់លុប Sub Brand '${subName}' ពី Brand '${brandName}' ដែរឬទេ?`)) return;
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
                setMessage(`បានលុប Sub Brand '${subName}' ដោយជោគជ័យ។`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            setSaving(false);
            console.error('Delete subbrand error:', err);
        }
    };

    const handleCloneFromGlobal = async () => {
        if (!hasPermission(CONTROL_SYSTEM_PATH, 'edit')) {
            alert('Clone from Global requires full Control System edit permission.');
            return;
        }
        if (!selectedBrand) return;
        if (!window.confirm(`តើអ្នកពិតជាចង់ចម្លងរាល់ការកំណត់ពី Global មកជំនួសការកំណត់របស់ Brand '${selectedBrand}' ដែរឬទេ?`)) return;
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
                setMessage(`បានចម្លងការកំណត់ពី Global មក Brand '${selectedBrand}' ដោយជោគជ័យ!`);
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
            alert('You do not have delete permission for Organization settings.');
            return;
        }
        setDeleteBrandModal({ open: true, brandName });
    };

    const handleConfirmDeleteBrand = async () => {
        if (!canDeleteSection('brands')) {
            alert('You do not have delete permission for Organization settings.');
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
                setMessage(data.message || `Brand '${brandName}' and all associated data purged successfully!`);
                fetchControlSystemConfigs();
                setTimeout(() => setMessage(''), 4000);
            } else {
                alert('Failed to delete brand');
            }
        } catch (err) {
            setSaving(false);
            setDeleteBrandModal({ open: false, brandName: '' });
            console.error('Delete brand error:', err);
        }
    };

    const handleSaveAllConfigs = async () => {
        if (!hasPermission(CONTROL_SYSTEM_PATH, 'edit')) {
            alert('Save All requires full Control System edit permission.');
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
                { key: 'droplists', value: droplists }
            ];
            const res = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs, brand: selectedBrand })
            });

            const data = await res.json().catch(() => ({}));
            setSaving(false);

            if (res.ok) {
                setMessage(`ការកំណត់ទាំងអស់សម្រាប់ Brand '${selectedBrand || 'Global'}' ត្រូវបានរក្សាទុកដោយជោគជ័យ! (All configurations saved successfully!)`);
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
                    }));
                }
            } else {
                alert(`រក្សាទុកបរាជ័យ (Failed to save configurations): ${data.error || res.statusText || 'Server Error'}`);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save all configs error:', err);
            alert(`រក្សាទុកបរាជ័យ: Network Error (${err.message})`);
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
                            {t('controlSystem')} Dynamic Configurations
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
                            title="Restore and synchronize MongoDB from latest Firebase Backup"
                        >
                            <MdOutlineSettingsBackupRestore size={16} className={restoring ? 'spin-reload' : ''} />
                            <span>{restoring ? 'កំពុង Restore...' : 'Restore from Firebase'}</span>
                        </button>
                    )}
                    {hasPermission(CONTROL_SYSTEM_PATH, 'edit') && (
                        <button
                            onClick={handleSaveAllConfigs}
                            disabled={saving}
                            className='flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-[5px] text-xs font-bold cursor-pointer shadow-lg shadow-emerald-600/20 transition-all'
                        >
                            <MdSave size={16} />
                            <span>{saving ? 'រក្សាទុក...' : 'Save All Settings'}</span>
                        </button>
                    )}
                </div>
            </header>

            {user?.role === 'Administrator' ? (
                <div className="p-2 bg-white border border-slate-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-2">
                        <FaGlobeAmericas className="text-indigo-400 text-sm" />
                        <span className="font-bold text-slate-700">
                            Select Brand to Configure (កំណត់ការកំណត់តាម Brand):
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-800 font-semibold cursor-pointer outline-none focus:border-sky-500"
                        >
                            <option value="">🌐 Global Config (Master Default Template)</option>
                            {brandsList.map((br, idx) => (
                                <option key={idx} value={br}>🏷️ {br} Settings</option>
                            ))}
                        </select>

                        {selectedBrand && (
                            hasPermission(CONTROL_SYSTEM_PATH, 'edit') && (
                                <button
                                    type="button"
                                    onClick={handleCloneFromGlobal}
                                    disabled={saving}
                                    className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-md text-xs font-bold transition-all border border-sky-200 flex items-center gap-1.5 cursor-pointer"
                                    title="Copy all current Global configurations into this brand"
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
                    <span>Configuring tenant settings for brand: <span className="font-bold text-slate-900">{selectedBrand || 'Global'}</span></span>
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
                    <span className="font-semibold">System MDM - Registry Editor</span>
                </div>
                <div role="menubar" aria-label="Registry menu" className="flex gap-1 border-b border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                    {['File', 'Edit', 'View', 'Favorites', 'Help'].map(menu => (
                        <span key={menu} role="menuitem" className="cursor-default px-2 py-1 hover:bg-sky-100">{menu}</span>
                    ))}
                </div>
                <div className="flex min-h-9 items-center gap-2 border-b border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                    <FaGlobeAmericas className="text-sky-700" />
                    <span>Computer</span><span className="text-slate-400">›</span>
                    <span>System MDM</span><span className="text-slate-400">›</span>
                    <span className="truncate font-semibold">{activeExplorerFile.label}</span>
                </div>

                <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="border-b border-slate-300 bg-white p-2 md:border-b-0 md:border-r">
                        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold text-slate-600">
                            <FaShieldAlt className="text-sky-700" /> Registry tree
                        </div>
                        <div className="mb-2 flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                            <FaFolderOpen className="text-sky-700" /> Computer
                        </div>
                        <nav aria-label="Control system folders" className="space-y-2 pl-4">
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
                            <span>Name</span><span>Type</span><span>Data</span>
                        </div>
                        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,.8fr)_minmax(100px,1fr)] items-center border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                            <span className="flex min-w-0 items-center gap-2 truncate"><FaFolder className="shrink-0 text-amber-500" />{activeExplorerFile.label}</span>
                            <span>Configuration file</span>
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
                            <label className="block text-gray-400 font-semibold mb-1">Lock Screen Display Text (Khmer/EN Message)</label>
                            <input
                                type="text"
                                value={lockphoneDisplayText}
                                onChange={(e) => setLockphoneDisplayText(e.target.value)}
                                disabled={!canEditSection('lock-screen')}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-khmer"
                                placeholder="e.g. ទូរស័ព្ទរបស់ {{customerName}} ត្រូវបានចាក់សោ"
                            />
                            <p className="mt-1.5 text-[10px] text-amber-400/80 font-mono leading-relaxed">
                                💡 Use <span className="bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.5 rounded text-amber-300 font-bold">{'{{customerName}}'}</span> — it will be replaced automatically with the customer's name when locking the phone.
                            </p>
                        </div>
                        <div>
                            <label className="block text-gray-400 font-semibold mb-1">Hotline Phone Number to Call</label>
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
                            <label className="block text-gray-400 font-semibold mb-1">Telegram account/chat IDs to notify on lock</label>
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
                                    placeholder="Telegram account/chat ID"
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
                                <label className="block text-gray-400 font-semibold mb-1">Brand</label>
                                <select
                                    value={newPenaltyBrand}
                                    onChange={(e) => setNewPenaltyBrand(e.target.value)}
                                    disabled={!canEditSection('penalties')}
                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-semibold"
                                >
                                    <option value="">Global</option>
                                    {brandsList.map((b, idx) => (
                                        <option key={idx} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-400 font-semibold mb-1">After Days</label>
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
                                placeholder="Add new role (e.g. Supervisor)"
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
                            <span>⚡ ការកំណត់ប្រព័ន្ធ FOLLOW UP 4 (Reject Submit & Reject CS Private Reasons)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-semibold border border-slate-700">
                                Brand កំពុងកំណត់: <strong className="text-emerald-400 font-mono">{selectedBrand || '🌐 Global Template'}</strong>
                            </span>
                            <OriginBadge fieldKey="droplists" />
                        </div>
                    </div>

                    <p className="text-xs text-slate-400">
                        កំណត់បញ្ជីមូលហេតុ (Reasons) និងជម្រើស Droplists សម្រាប់ទំព័រ <strong className="text-rose-400 font-semibold">Reject Submit</strong> និង <strong className="text-amber-400 font-semibold">Reject CS</strong> ដោយឡែកពីគ្នា។ ទិន្នន័យដែលបានបញ្ចូលនៅទីនេះ នឹងបង្ហាញជាប្រអប់បំពេញលេខនៅក្នុង Modal នៃទំព័រ Follow Up 4 តាម Brand នីមួយៗភ្លាមៗ។
                    </p>

                    <div className="rounded-[5px] border border-sky-600/30 bg-slate-900/80 p-3 space-y-3">
                        <h4 className="text-xs font-bold text-sky-300">FOLLOW UP 4 DROPDOWN OPTIONS</h4>
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
                                placeholder="បញ្ចូលជម្រើសថ្មី (អាចបន្ថែមបានច្រើន)"
                                disabled={!canEditSection('follow-up')}
                                className="h-9 min-w-0 flex-1 rounded-[5px] border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddSpecificReason(selectedWorkflowCategory, newWorkflowOption, setNewWorkflowOption)}
                                disabled={!canEditSection('follow-up') || !newWorkflowOption.trim()}
                                className="h-9 rounded-[5px] bg-sky-600 px-3 text-xs font-bold text-white disabled:opacity-40"
                            >
                                <MdAddCircle className="inline mr-1" /> បន្ថែម
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
                                    {(droplists.find(d => d.category === 'Reject Submit Reasons')?.items || []).length} ជម្រើស
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={newRejectSubmitInput}
                                    onChange={(e) => setNewRejectSubmitInput(e.target.value)}
                                    disabled={!canEditSection('follow-up')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                    placeholder="បញ្ចូលមូលហេតុ Reject Submit ថ្មី (ឧ. ភ្ញៀវមិនឆ្លើយតប)..."
                                    className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-[5px] text-slate-100 text-xs focus:border-rose-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                    disabled={!canEditSection('follow-up') || !newRejectSubmitInput.trim()}
                                    className="px-3.5 h-9 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/20"
                                >
                                    <MdAddCircle size={15} /> <span>បន្ថែម</span>
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
                                                title="លុបមូលហេតុនេះ"
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
                                    {(droplists.find(d => d.category === 'Reject CS Reasons')?.items || []).length} ជម្រើស
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <input
                                    type="text"
                                    value={newRejectCsInput}
                                    onChange={(e) => setNewRejectCsInput(e.target.value)}
                                    disabled={!canEditSection('follow-up')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                    placeholder="បញ្ចូលមូលហេតុ Reject CS ថ្មី (ឧ. តម្លៃមិនព្រម, គ្មានលទ្ធភាព)..."
                                    className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-[5px] text-slate-100 text-xs focus:border-amber-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                    disabled={!canEditSection('follow-up') || !newRejectCsInput.trim()}
                                    className="px-3.5 h-9 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-amber-600/20"
                                >
                                    <MdAddCircle size={15} /> <span>បន្ថែម</span>
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
                                                title="លុបមូលហេតុនេះ"
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
                            <label className="text-gray-300 font-semibold">Select Droplist Category:</label>
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
                                placeholder={`Add item to ${systemDroplists[selectedCategoryIdx]?.category}...`}
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
                                                <span className="text-[10px] text-amber-400 font-semibold">(Your Brand)</span>
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
                                                                title="Delete item"
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

            </div>

            {/* Section 5: Brand & Sub Brand Management — Administrator + Global Config only */}
            {activeExplorerFile.id === 'brands' && user?.role === 'Administrator' && selectedBrand === '' && (
                <div className="p-6 rounded-3xl glass-card border border-amber-500/30 space-y-6 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-amber-300 text-xs font-bold uppercase">
                        <FaLayerGroup /> {t('brandTenant')} &amp; Sub Brand Management
                    </div>

                    <p className="text-[11px] text-gray-400">
                        គ្រប់គ្រង Brand និង <strong className="text-amber-300">Sub Brands (អនុម៉ាក)</strong> របស់ប្រព័ន្ធ។ នៅក្នុង Brand មួយអាចបង្កើត Sub Brand បានលើសពីពីរ។ ពេលបង្កើត Sub Brand ដំបូង រាល់ទិន្នន័យដែលមានស្រាប់ក្នុង Brand នោះ នឹងត្រូវរត់ចូល Sub Brand ដំបូងដោយស្វ័យប្រវត្តិ។
                    </p>

                    {/* Create Brand Input */}
                    <div className="flex items-center gap-2 text-xs">
                        <input
                            type="text"
                            value={newBrandInput}
                            onChange={(e) => setNewBrandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                            disabled={!canEditSection('brands')}
                            placeholder="New brand name (e.g. SuperTech)"
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
                            <p className="text-gray-500 text-xs italic">No brands defined yet.</p>
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
                                                <span>Delete Brand</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Sub Brands Section */}
                                    <div className="space-y-2 pl-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-gray-300">
                                                Sub Brands (អនុម៉ាក) — អាចបង្កើតលើសពី ២ បាន:
                                            </span>
                                            <span className="text-[10px] text-amber-400/80 italic">
                                                💡 ទិន្នន័យចាស់រត់ចូល Sub Brand ដំបូងបង្អស់
                                            </span>
                                        </div>

                                        {/* Sub Brands Chips */}
                                        <div className="flex flex-wrap gap-2 min-h-[30px] items-center">
                                            {currentSubBrands.length === 0 ? (
                                                <span className="text-gray-500 text-xs italic">
                                                    មិនទាន់មាន Sub Brand នៅឡើយ (សូមបង្កើតខាងក្រោម)
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
                                                placeholder={`បញ្ចូល Sub Brand ថ្មីសម្រាប់ ${br}...`}
                                                className="flex-1 h-8 px-3 bg-gray-950 border border-gray-700 rounded-[5px] text-gray-200 text-xs focus:border-sky-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddSubBrand(br)}
                                                disabled={saving || !canEditSection('brands') || !(newSubBrandInputs[br] || '').trim()}
                                                className="px-3 h-8 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-[5px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                                            >
                                                <MdAddCircle size={14} /> Add Sub Brand
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
                                តើអ្នកពិតជាចង់លុប Brand <span className="text-amber-400 font-mono">"{deleteBrandModal.brandName}"</span> នេះមែនទេ?
                            </p>
                            <div className="p-2 bg-red-950/50 border border-red-800/80 rounded-[5px] space-y-1.5 text-red-200">
                                <p className="font-bold uppercase text-[10px] text-red-400 tracking-wider">{t('deleteBrandWarning')}:</p>
                                <p className="text-[11px] leading-relaxed">
                                    នៅពេលលុប Brand នេះ ព័ត៌មាន និងទិន្នន័យទាំងអស់ដែលពាក់ព័ន្ធនឹង Brand <span className="font-mono font-bold text-amber-300">"{deleteBrandModal.brandName}"</span> រួមមាន៖
                                </p>
                                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-red-300 font-medium">
                                    <li>{t('contract')} (Contracts)</li>
                                    <li>System Users</li>
                                    <li>Device Action Logs</li>
                                </ul>
                                <p className="text-[11px] font-bold text-red-400 pt-1">
                                    ទិន្នន័យទាំងនេះនឹងត្រូវបានលុបចេញពីប្រព័ន្ធ MongoDB ទាំងស្រុង ដោយមិនអាចទាញយកមកវិញបានឡើយ!
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
                                <MdDelete size={16} /> {saving ? 'Purging Data...' : 'លុប Brand និងទិន្នន័យទាំងអស់'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ControlSystem;