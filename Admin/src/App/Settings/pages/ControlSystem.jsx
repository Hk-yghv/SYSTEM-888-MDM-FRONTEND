import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosSettings } from 'react-icons/io';
import { MdOutlineSync, MdAddCircle, MdDelete, MdSave, MdOutlineSettingsBackupRestore } from 'react-icons/md';
import { FaPhoneAlt, FaList, FaUserShield, FaLayerGroup, FaGlobeAmericas, FaDollarSign, FaFolder, FaFolderOpen, FaShieldAlt } from 'react-icons/fa';
import './ControlSystem.css';



const ControlSystem = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

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
        { category: 'Follow Up 4 Asset Types', items: ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'] },
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

    // Dedicated Follow Up 4 inputs
    const [newRejectSubmitInput, setNewRejectSubmitInput] = useState('');
    const [newRejectCsInput, setNewRejectCsInput] = useState('');
    const [newFollowUpSourceInput, setNewFollowUpSourceInput] = useState('');
    const [newFollowUpContactInput, setNewFollowUpContactInput] = useState('');
    const [newFollowUpStatusInput, setNewFollowUpStatusInput] = useState('');
    const [newFollowUpAssetInput, setNewFollowUpAssetInput] = useState('');

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
    const activeExplorerFile = explorerFolders.flatMap(folder => folder.files).find(file => file.id === activeFile)
        || explorerFolders[0].files[0];

    const handleRestoreFromFirebase = async () => {
        const isConfirmed = window.confirm(
            '⚠️ ការព្រមានសំខាន់ (IMPORTANT RESTORE NOTICE):\n\n' +
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
                { category: 'Follow Up 4 Asset Types', items: ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'] },
                { category: 'Reject Submit Reasons', items: ['ឯកសារមិនគ្រប់', 'ព័ត៌មានមិនច្បាស់', 'អតិថិជនប្តូរចិត្ត', 'ទាក់ទងមិនបាន', 'ផ្សេងៗ'] },
                { category: 'Reject CS Reasons', items: ['តម្លៃមិនព្រម', 'គ្មានសមត្ថភាពបង់', 'លក្ខខណ្ឌមិនត្រូវ', 'មិនឆ្លើយតប', 'ផ្សេងៗ'] }
            ];
            const globalRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (globalRes.ok) {
                globalData = await globalRes.json();
                if (globalData.droplists && Array.isArray(globalData.droplists) && globalData.droplists.length > 0) {
                    globalDroplists = globalData.droplists;
                }
                const brandCat = globalDroplists.find(d => d.category === 'Brands');
                if (brandCat && Array.isArray(brandCat.items)) {
                    setBrandsList(brandCat.items);
                }
            }

            // 2. Fetch the selected brand config
            if (selectedBrand) {
                const res = await fetch(`${API_BASE}/controlsystem?brand=${selectedBrand}`);
                if (res.ok) {
                    const data = await res.json();

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

    const saveConfigToMongoDB = async (key, value) => {
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
                alert(`រក្សាទុកបរាជ័យ (Failed to save configuration): ${data.error || res.statusText || 'Server Error'}`);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save config error:', err);
            alert(`រក្សាទុកបរាជ័យ: Network Error (${err.message})`);
        }
    };

    const handleAddRole = () => {
        if (!newRoleInput.trim()) return;
        const updated = [...roles, newRoleInput.trim()];
        setRoles(updated);
        setNewRoleInput('');
        saveConfigToMongoDB('roles', updated);
    };

    const handleDeleteRole = (index) => {
        if (roles[index] === 'Administrator') {
            alert('Administrator role cannot be removed!');
            return;
        }
        const updated = roles.filter((_, idx) => idx !== index);
        setRoles(updated);
        saveConfigToMongoDB('roles', updated);
    };

    const handleAddItemToCategory = () => {
        if (!newItemInput.trim()) return;
        const updated = [...droplists];
        updated[selectedCategoryIdx].items.push(newItemInput.trim());
        setDroplists(updated);
        setNewItemInput('');
        saveConfigToMongoDB('droplists', updated);
    };

    const handleDeleteItemFromCategory = (catIdx, itemIdx) => {
        const updated = [...droplists];
        updated[catIdx].items.splice(itemIdx, 1);
        setDroplists(updated);
        saveConfigToMongoDB('droplists', updated);
    };

    const handleAddSpecificReason = (categoryName, reasonText, setInput) => {
        const text = reasonText.trim();
        if (!text) return;
        const updated = [...droplists];
        const catIdx = updated.findIndex(d => d.category === categoryName);
        if (catIdx !== -1) {
            if (!updated[catIdx].items.includes(text)) {
                updated[catIdx].items.push(text);
            }
        } else {
            updated.push({ category: categoryName, items: [text] });
        }
        setDroplists(updated);
        if (setInput) setInput('');
        saveConfigToMongoDB('droplists', updated);
    };

    const handleDeleteSpecificReason = (categoryName, itemIndex) => {
        const updated = [...droplists];
        const catIdx = updated.findIndex(d => d.category === categoryName);
        if (catIdx !== -1) {
            updated[catIdx].items.splice(itemIndex, 1);
            setDroplists(updated);
            saveConfigToMongoDB('droplists', updated);
        }
    };

    // --- Brand Management (Global Config only) ---
    const handleAddBrand = async () => {
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
            setMessage(`Brand '${name}' ត្រូវបានបង្កើត និងចម្លងរាល់ការកំណត់ពី Global ដោយស្វ័យប្រវត្តិកុំឱ្យទទេ! (Created & Auto-populated from Global)`);
            setTimeout(() => setMessage(''), 4500);
        } catch (err) {
            setSaving(false);
            console.error('Add brand error:', err);
        }
    };

    const handleCloneFromGlobal = async () => {
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
        setDeleteBrandModal({ open: true, brandName });
    };

    const handleConfirmDeleteBrand = async () => {
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
        <div id="control-system-explorer" className='w-full bg-transparent p-3 md:p-5 select-none space-y-4'>
            <header className='p-3 w-full border border-slate-300 bg-white rounded-md flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-sm'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-md bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 text-xl'>
                        <IoIosSettings />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                            {t('controlSystem')} Dynamic Configurations
                        </h1>
                        <p className='text-xs text-slate-500 font-semibold'>
                            System configuration registry
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {user?.role === 'Administrator' && (
                        <button
                            type="button"
                            onClick={handleRestoreFromFirebase}
                            disabled={restoring}
                            className='flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-orange-600/20 transition-all border border-amber-400/30'
                            title="Restore and synchronize MongoDB from latest Firebase Backup"
                        >
                            <MdOutlineSettingsBackupRestore size={16} className={restoring ? 'spin-reload' : ''} />
                            <span>{restoring ? 'កំពុង Restore...' : 'Restore from Firebase'}</span>
                        </button>
                    )}
                    <button
                        onClick={handleSaveAllConfigs}
                        disabled={saving}
                        className='flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-emerald-600/20 transition-all'
                    >
                        <MdSave size={16} />
                        <span>{saving ? 'រក្សាទុក...' : 'Save All Settings'}</span>
                    </button>
                    <button
                        onClick={fetchControlSystemConfigs}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs cursor-pointer border border-slate-300 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {user?.role === 'Administrator' ? (
                <div className="p-3 bg-white border border-slate-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
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
                            <button
                                type="button"
                                onClick={handleCloneFromGlobal}
                                disabled={saving}
                                className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-md text-xs font-bold transition-all border border-sky-200 flex items-center gap-1.5 cursor-pointer"
                                title="Copy all current Global configurations into this brand"
                            >
                                <MdOutlineSettingsBackupRestore className="text-sm" />
                                <span>ចម្លងពី Global (Sync from Global)</span>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-white border border-slate-300 rounded-md flex items-center justify-between text-xs text-sky-700 font-semibold">
                    <span>Configuring tenant settings for brand: <span className="font-bold text-slate-900">{selectedBrand || 'Global'}</span></span>
                </div>
            )}


            {message && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold animate-fade-in">
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
                    <aside className="border-b border-slate-300 bg-white p-3 md:border-b-0 md:border-r">
                        <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold text-slate-600">
                            <FaShieldAlt className="text-sky-700" /> Registry tree
                        </div>
                        <div className="mb-2 flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                            <FaFolderOpen className="text-sky-700" /> Computer
                        </div>
                        <nav aria-label="Control system folders" className="space-y-2 pl-4">
                            {explorerFolders.map(folder => {
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
                        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,.8fr)_minmax(100px,1fr)] border-b border-slate-300 bg-[#f3f3f3] px-3 py-2 text-xs font-semibold text-slate-700">
                            <span>Name</span><span>Type</span><span>Data</span>
                        </div>
                        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,.8fr)_minmax(100px,1fr)] items-center border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                            <span className="flex min-w-0 items-center gap-2 truncate"><FaFolder className="shrink-0 text-amber-500" />{activeExplorerFile.label}</span>
                            <span>Configuration file</span>
                            <span className="truncate">{selectedBrand || 'Global'} settings</span>
                        </div>
                        <div className="p-3 sm:p-5">

                            <div className="grid grid-cols-1 gap-4">

                                {/* Section 1: Lock Phone Display Text & Phone Number */}
                                {activeExplorerFile.id === 'lock-screen' && (
                                    <div className="p-6 rounded-3xl glass-card border border-red-500/30 space-y-4 shadow-xl">
                                        <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-red-400 text-xs font-bold uppercase">
                                            <FaPhoneAlt /> Lost Phone Lock Display Text & Hotline Number
                                            <OriginBadge fieldKey="lockphone_display_text" />
                                        </div>

                                        <div className="space-y-3 text-xs">
                                            <div>
                                                <label className="block text-gray-400 font-semibold mb-1">Lock Screen Display Text (Khmer/EN Message)</label>
                                                <input
                                                    type="text"
                                                    value={lockphoneDisplayText}
                                                    onChange={(e) => setLockphoneDisplayText(e.target.value)}
                                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-khmer"
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
                                                    className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono"
                                                    placeholder="+855 12 903 120"
                                                />
                                            </div>
                                            <div className="pt-2 text-right">
                                                <button
                                                    onClick={() => {
                                                        saveConfigToMongoDB('lockphone_display_text', lockphoneDisplayText);
                                                        saveConfigToMongoDB('lockphone_phone_number', lockphonePhoneNumber);
                                                    }}
                                                    disabled={saving}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-1 ml-auto cursor-pointer shadow-lg shadow-red-600/30"
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
                                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold"
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
                                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 font-semibold mb-1">Penalty / Day ($)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={newPenaltyAmount}
                                                        onChange={(e) => setNewPenaltyAmount(Number(e.target.value) || 0)}
                                                        className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const brandValue = (newPenaltyBrand || selectedBrand || 'MDM').trim();
                                                        if (!brandValue || newPenaltyDays < 0 || newPenaltyAmount < 0) return;
                                                        const nextRule = { brand: brandValue, afterDays: Number(newPenaltyDays), penaltyPerDay: Number(newPenaltyAmount) };
                                                        setLatePenaltyRules(prev => [...prev, nextRule]);
                                                        setNewPenaltyDays(1);
                                                        setNewPenaltyAmount(0);
                                                    }}
                                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold cursor-pointer"
                                                >
                                                    Add Rule
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {latePenaltyRules.length === 0 ? (
                                                    <div className="p-3 rounded-xl bg-gray-950/70 border border-gray-800 text-gray-400 text-[11px] italic">
                                                        No penalty rule configured yet.
                                                    </div>
                                                ) : (
                                                    latePenaltyRules.map((rule, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-950/60 border border-gray-800">
                                                            <input
                                                                type="text"
                                                                value={rule.brand || ''}
                                                                onChange={(e) => {
                                                                    const next = [...latePenaltyRules];
                                                                    next[idx].brand = e.target.value;
                                                                    setLatePenaltyRules(next);
                                                                }}
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
                                                                className="w-28 h-9 px-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-[11px] font-mono"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setLatePenaltyRules(prev => prev.filter((_, i) => i !== idx))}
                                                                className="ml-auto px-2 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <div className="pt-2 text-right">
                                                <button
                                                    onClick={() => saveConfigToMongoDB('late_penalty_rules', latePenaltyRules)}
                                                    disabled={saving}
                                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1 ml-auto cursor-pointer shadow-lg shadow-amber-600/30"
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
                                                    placeholder="Add new role (e.g. Supervisor)"
                                                    className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                                />
                                                <button
                                                    onClick={handleAddRole}
                                                    className="px-4 h-10 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <MdAddCircle size={16} /> Add Role
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {roles.map((r, rIdx) => (
                                                    <div key={rIdx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border border-gray-700 rounded-xl font-semibold text-gray-200">
                                                        <span>{r}</span>
                                                        {r !== 'Administrator' && (
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

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                            {/* Box A: Reject Submit Reasons */}
                                            <div className="p-4 rounded-xl bg-slate-900/90 border border-rose-600/30 space-y-3">
                                                <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                                                    <h4 className="text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                                                        <span>🛑</span> មូលហេតុ REJECT SUBMIT (Reject Submit Reasons)
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
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                                        placeholder="បញ្ចូលមូលហេតុ Reject Submit ថ្មី (ឧ. ភ្ញៀវមិនឆ្លើយតប)..."
                                                        className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-rose-500 outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddSpecificReason('Reject Submit Reasons', newRejectSubmitInput, setNewRejectSubmitInput)}
                                                        disabled={!newRejectSubmitInput.trim()}
                                                        className="px-3.5 h-9 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/20"
                                                    >
                                                        <MdAddCircle size={15} /> <span>បន្ថែម</span>
                                                    </button>
                                                </div>

                                                {/* Reasons List */}
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                    {(droplists.find(d => d.category === 'Reject Submit Reasons')?.items || []).map((reason, rIdx) => (
                                                        <div
                                                            key={rIdx}
                                                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs transition-colors"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-mono">
                                                                    {rIdx + 1}
                                                                </span>
                                                                {reason}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSpecificReason('Reject Submit Reasons', rIdx)}
                                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 p-1 rounded-lg cursor-pointer transition-colors"
                                                                title="លុបមូលហេតុនេះ"
                                                            >
                                                                <MdDelete size={15} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Box B: Reject CS Reasons */}
                                            <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-600/30 space-y-3">
                                                <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
                                                    <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                                                        <span>⚠️</span> មូលហេតុ REJECT CS (Reject CS Reasons)
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
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                                        placeholder="បញ្ចូលមូលហេតុ Reject CS ថ្មី (ឧ. តម្លៃមិនព្រម, គ្មានលទ្ធភាព)..."
                                                        className="flex-1 h-9 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-amber-500 outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddSpecificReason('Reject CS Reasons', newRejectCsInput, setNewRejectCsInput)}
                                                        disabled={!newRejectCsInput.trim()}
                                                        className="px-3.5 h-9 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-amber-600/20"
                                                    >
                                                        <MdAddCircle size={15} /> <span>បន្ថែម</span>
                                                    </button>
                                                </div>

                                                {/* Reasons List */}
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                    {(droplists.find(d => d.category === 'Reject CS Reasons')?.items || []).map((reason, rIdx) => (
                                                        <div
                                                            key={rIdx}
                                                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs transition-colors"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-mono">
                                                                    {rIdx + 1}
                                                                </span>
                                                                {reason}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSpecificReason('Reject CS Reasons', rIdx)}
                                                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 p-1 rounded-lg cursor-pointer transition-colors"
                                                                title="លុបមូលហេតុនេះ"
                                                            >
                                                                <MdDelete size={15} />
                                                            </button>
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
                                                    className="h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold"
                                                >
                                                    {droplists.map((d, dIdx) => (
                                                        <option key={dIdx} value={dIdx}>{d.category}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newItemInput}
                                                    onChange={(e) => setNewItemInput(e.target.value)}
                                                    placeholder={`Add item to ${droplists[selectedCategoryIdx]?.category}...`}
                                                    className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                                />
                                                <button
                                                    onClick={handleAddItemToCategory}
                                                    className="px-4 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <MdAddCircle size={16} /> Add Option
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                                {droplists.map((cat, catIdx) => (
                                                    <div key={catIdx} className="p-4 rounded-xl bg-gray-950/60 border border-gray-800 space-y-2">
                                                        <h4 className="font-bold text-gray-200 border-b border-gray-800 pb-1.5">{cat.category}</h4>
                                                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                                            {cat.items.map((item, itemIdx) => (
                                                                <div key={itemIdx} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-900/60 text-gray-300 text-[11px]">
                                                                    <span>{item}</span>
                                                                    <button
                                                                        onClick={() => handleDeleteItemFromCategory(catIdx, itemIdx)}
                                                                        className="text-red-400 hover:text-red-300 cursor-pointer"
                                                                    >
                                                                        <MdDelete size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Section 5: Brand Management — Administrator + Global Config only */}
                            {activeExplorerFile.id === 'brands' && user?.role === 'Administrator' && selectedBrand === '' && (
                                <div className="p-6 rounded-3xl glass-card border border-amber-500/30 space-y-4 shadow-xl">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-amber-300 text-xs font-bold uppercase">
                                        <FaLayerGroup /> Brand Tenant Management (Global Config — Add / Remove Brands)
                                    </div>

                                    <p className="text-[11px] text-gray-400">
                                        Brands listed here will appear in the <span className="text-amber-300 font-semibold">brand selector</span> above and in all dropdowns across the system. Only <span className="text-white font-bold">Administrator</span> editing Global Config can manage this list.
                                    </p>

                                    <div className="flex items-center gap-2 text-xs">
                                        <input
                                            type="text"
                                            value={newBrandInput}
                                            onChange={(e) => setNewBrandInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                                            placeholder="New brand name (e.g. SuperTech)"
                                            className="flex-1 h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 focus:border-amber-500 outline-none"
                                        />
                                        <button
                                            onClick={handleAddBrand}
                                            disabled={saving || !newBrandInput.trim()}
                                            className="px-4 h-10 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                            <MdAddCircle size={16} /> Add Brand
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {brandsList.length === 0 && (
                                            <p className="text-gray-500 text-xs italic">No brands defined yet.</p>
                                        )}
                                        {brandsList.map((br, brIdx) => (
                                            <div
                                                key={brIdx}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border border-amber-600/40 rounded-xl text-amber-200 text-xs font-semibold"
                                            >
                                                <FaLayerGroup size={11} className="text-amber-400" />
                                                <span>{br}</span>
                                                <button
                                                    onClick={() => handleDeleteBrandClick(br)}
                                                    disabled={saving}
                                                    className="text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50 transition-colors"
                                                    title={`Remove brand '${br}'`}
                                                >
                                                    <MdDelete size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {/* Custom Brand Delete Confirmation Modal */}
            {deleteBrandModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-4">
                    <div className="bg-white border border-red-300 rounded-md p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                <MdDelete size={18} />
                                សួរបញ្ជាក់ពីការលុប Brand (Delete Brand Confirmation)
                            </h3>
                            <button onClick={() => setDeleteBrandModal({ open: false, brandName: '' })} className="text-gray-400 hover:text-gray-200 text-xs font-bold cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-3 text-xs text-gray-200">
                            <p className="font-bold text-sm text-white">
                                តើអ្នកពិតជាចង់លុប Brand <span className="text-amber-400 font-mono">"{deleteBrandModal.brandName}"</span> នេះមែនទេ?
                            </p>
                            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl space-y-1.5 text-red-200">
                                <p className="font-bold uppercase text-[10px] text-red-400 tracking-wider">⚠️ ការប្រុងប្រយ័ត្នខ្ពស់ (High Alert Warning):</p>
                                <p className="text-[11px] leading-relaxed">
                                    នៅពេលលុប Brand នេះ ព័ត៌មាន និងទិន្នន័យទាំងអស់ដែលពាក់ព័ន្ធនឹង Brand <span className="font-mono font-bold text-amber-300">"{deleteBrandModal.brandName}"</span> រួមមាន៖
                                </p>
                                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-red-300 font-medium">
                                    <li>កិច្ចសន្យាទាំងអស់ (Contracts) របស់ Brand នេះ</li>
                                    <li>Account System Users ដែលត្រូវបានកំណត់ក្នុង Brand នេះ</li>
                                    <li>ប្រវត្តិចាក់សោ (Phone/Wallpaper Logs) និង Device Action Logs</li>
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
                                បោះបង់ (Cancel)
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteBrand}
                                disabled={saving}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
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