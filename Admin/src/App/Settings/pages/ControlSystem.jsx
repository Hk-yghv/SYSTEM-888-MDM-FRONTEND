import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { IoIosSettings } from 'react-icons/io';
import { MdOutlineSync, MdAddCircle, MdDelete, MdSave } from 'react-icons/md';
import { FaPhoneAlt, FaList, FaUserShield, FaLayerGroup } from 'react-icons/fa';

const ControlSystem = () => {
    const { t } = useLanguage();
    const { API_BASE, user } = useAuth();

    const [selectedBrand, setSelectedBrand] = useState(user?.brand || '');
    const [brandsList, setBrandsList] = useState(['MDM', 'ECloud']);

    const [droplists, setDroplists] = useState([
        { category: 'Device Models', items: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'Samsung Galaxy S24 Ultra', 'iPad Air 5'] },
        { category: 'Contract Types', items: ['Standard Installment', 'VIP Premium', 'Corporate Plan'] },
        { category: 'Payment Methods', items: ['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer'] },
        { category: 'Brands', items: ['MDM', 'ECloud'] }
    ]);

    const [callPhoneDisplay, setCallPhoneDisplay] = useState({
        title: 'SYSTEM MDM HOTLINE',
        phoneNumber: '+855 12 903 120',
        subtext: 'Contact support for instant phone lock or payment inquiry'
    });

    const [roles, setRoles] = useState(['Administrator', 'Manager', 'Staff', 'Viewer']);
    const [lockphoneDisplayText, setLockphoneDisplayText] = useState('ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់');
    const [lockphonePhoneNumber, setLockphonePhoneNumber] = useState('+855 12 903 120');

    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const [newRoleInput, setNewRoleInput] = useState('');
    const [newItemInput, setNewItemInput] = useState('');
    const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
    const [newBrandInput, setNewBrandInput] = useState('');

    const fetchControlSystemConfigs = async () => {
        setReloading(true);
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=${selectedBrand}`);
            if (res.ok) {
                const data = await res.json();
                if (data.droplists) setDroplists(data.droplists);
                if (data.call_phone_display) setCallPhoneDisplay(data.call_phone_display);
                if (data.roles) setRoles(data.roles);
                if (data.lockphone_display_text) setLockphoneDisplayText(data.lockphone_display_text);
                if (data.lockphone_phone_number) setLockphonePhoneNumber(data.lockphone_phone_number);
            }

            // Always fetch the Global Brand list from the global config
            const globalRes = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (globalRes.ok) {
                const globalData = await globalRes.json();
                const brandCat = globalData.droplists?.find(d => d.category === 'Brands');
                if (brandCat) setBrandsList(brandCat.items);
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

            setSaving(false);
            if (res.ok) {
                setMessage(`Control System '${key}' configuration updated for brand '${selectedBrand || 'Global'}' in MongoDB successfully!`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            setSaving(false);
            console.error('Save config error:', err);
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

        // Persist into Global droplists 'Brands' category
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
            const saveRes = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'droplists', value: globalDroplists, brand: '' })
            });
            setSaving(false);
            if (saveRes.ok) {
                setMessage(`Brand '${name}' added to Global Config successfully!`);
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            setSaving(false);
            console.error('Add brand error:', err);
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
                { key: 'roles', value: roles },
                { key: 'droplists', value: droplists }
            ];
            const res = await fetch(`${API_BASE}/controlsystem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs, brand: selectedBrand })
            });

            setSaving(false);
            if (res.ok) {
                setMessage(`ការកំណត់ទាំងអស់សម្រាប់ Brand '${selectedBrand || 'Global'}' ត្រូវបានរក្សាទុកដោយជោគជ័យ! (All configurations saved successfully!)`);
                setTimeout(() => setMessage(''), 4000);
            } else {
                alert('រក្សាទុកបរាជ័យ (Failed to save configurations)');
            }
        } catch (err) {
            setSaving(false);
            console.error('Save all configs error:', err);
        }
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-6'>
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex items-center justify-between shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl'>
                        <IoIosSettings />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100 flex items-center gap-2'>
                            {t('controlSystem')} Dynamic Configurations
                        </h1>
                        <p className='text-xs text-indigo-400 font-semibold'>
                            Define dropdown options, Call Phone display texts, and roles stored in MongoDB
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
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
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {user?.role === 'Administrator' ? (
                <div className="p-4 bg-[#0f1426]/90 border border-gray-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
                    <span className="font-bold text-gray-200 flex items-center gap-1.5">
                        Select Brand Tenant Settings to Configure (កំណត់ការកំណត់តាម Brand):
                    </span>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold cursor-pointer"
                        >
                            <option value="">Global Config (Global / Default)</option>
                            {brandsList.map((br, idx) => (
                                <option key={idx} value={br}>{br} Tenant Settings</option>
                            ))}
                        </select>
                        <button
                            onClick={handleSaveAllConfigs}
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
                        >
                            <MdSave size={16} />
                            <span>{saving ? 'រក្សាទុក...' : 'Save All Settings'}</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-[#0f1426]/90 border border-gray-800 rounded-2xl flex items-center justify-between text-xs text-indigo-400 font-semibold">
                    <span>Configuring tenant settings for brand: <span className="font-bold text-white">{selectedBrand || 'Global'}</span></span>
                    <button
                        onClick={handleSaveAllConfigs}
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
                    >
                        <MdSave size={16} />
                        <span>{saving ? 'រក្សាទុក...' : 'Save All Settings'}</span>
                    </button>
                </div>
            )}

            {message && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold animate-fade-in">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Section 1: Call Phone Display Text Configuration */}
                <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-indigo-300 text-xs font-bold uppercase">
                        <FaPhoneAlt /> Call Phone & Hotline Display Text Configuration
                    </div>

                    <div className="space-y-3 text-xs">
                        <div>
                            <label className="block text-gray-300 font-semibold mb-1">Display Title / Script</label>
                            <input
                                type="text"
                                value={callPhoneDisplay.title}
                                onChange={(e) => setCallPhoneDisplay({ ...callPhoneDisplay, title: e.target.value })}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 font-semibold mb-1">Hotline Phone Number</label>
                            <input
                                type="text"
                                value={callPhoneDisplay.phoneNumber}
                                onChange={(e) => setCallPhoneDisplay({ ...callPhoneDisplay, phoneNumber: e.target.value })}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-indigo-400 font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 font-semibold mb-1">Subtext / Notice Message</label>
                            <input
                                type="text"
                                value={callPhoneDisplay.subtext}
                                onChange={(e) => setCallPhoneDisplay({ ...callPhoneDisplay, subtext: e.target.value })}
                                className="w-full h-10 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-300"
                            />
                        </div>
                        <div className="pt-2 text-right">
                            <button
                                onClick={() => saveConfigToMongoDB('call_phone_display', callPhoneDisplay)}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1 ml-auto cursor-pointer shadow-lg shadow-indigo-600/30"
                            >
                                <MdSave size={16} /> Save Hotline to MongoDB
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 1.5: Lock Phone Display Text & Phone Number */}
                <div className="p-6 rounded-3xl glass-card border border-red-500/30 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-red-400 text-xs font-bold uppercase">
                        <FaPhoneAlt /> Lost Phone Lock Display Text & Hotline Number
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
                                <MdSave size={16} /> Save Lock Config to MongoDB
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 2: Roles Definition */}
                <div className="p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-purple-300 text-xs font-bold uppercase">
                        <FaUserShield /> System User Roles Configurator
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

                {/* Section 3: Dynamic Droplists & Options */}
                <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-gray-800 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-emerald-300 text-xs font-bold uppercase">
                        <FaList /> System Dropdown Lists & Dynamic Options (Droplists)
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
                                <div key={catIdx} className="p-4 rounded-2xl bg-gray-950/60 border border-gray-800 space-y-2">
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

            </div>

            {/* Section 4: Brand Management — Administrator + Global Config only */}
            {user?.role === 'Administrator' && selectedBrand === '' && (
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

            {/* Custom Brand Delete Confirmation Modal */}
            {deleteBrandModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-4">
                    <div className="bg-[#121829] border border-red-500/50 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
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
                            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-2xl space-y-1.5 text-red-200">
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
                                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-700 cursor-pointer"
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