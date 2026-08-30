import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { FaPalette, FaUndo, FaSave, FaCheckCircle, FaMagic, FaRegSun } from 'react-icons/fa';
import { MdOutlineDashboard, MdOutlineColorLens } from 'react-icons/md';

const Personalization = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const { theme, updateTheme, applyPreset, resetDefault, PRESET_THEMES } = useTheme();

    const [customTheme, setCustomTheme] = useState({ ...theme });
    const [savedNotice, setSavedNotice] = useState(false);

    const handleColorChange = (key, value) => {
        const updated = {
            ...customTheme,
            mode: 'custom',
            [key]: value
        };
        setCustomTheme(updated);
        updateTheme(updated);
    };

    const handleSelectPreset = (presetKey) => {
        const selected = PRESET_THEMES[presetKey];
        if (selected) {
            setCustomTheme(selected);
            applyPreset(presetKey);
        }
    };

    const handleSave = () => {
        updateTheme(customTheme);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
    };

    const handleReset = () => {
        resetDefault();
        setCustomTheme({ ...PRESET_THEMES.default });
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
    };

    return (
        <div className="w-full bg-[var(--app-bg,#f4f6f8)] min-h-screen p-4 select-none space-y-6 transition-colors duration-300">
            {/* Top Header Card */}
            <header className="p-4 w-full border border-slate-200 bg-[var(--app-card,#ffffff)] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-500/30">
                        <FaPalette />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-[var(--app-text,#0f172a)] flex items-center gap-2 tracking-wide">
                            {user?.brand ? (user.brand.toUpperCase().startsWith('SYSTEM') ? user.brand.toUpperCase() : `SYSTEM ${user.brand.toUpperCase()}`) : 'SYSTEM MDM'} — Personalization (កែប្រែរូបរាង)
                        </h1>
                        <p className="text-xs text-[var(--app-text-sub,#64748b)] font-semibold">
                            {t('personalizationSub') || 'Customize background, card, sidebar, and text colors per account'} &bull; User: <span className="font-bold text-indigo-600">@{user?.username}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {savedNotice && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold animate-bounce">
                            <FaCheckCircle />
                            <span>{t('themeSaved') || 'Saved successfully! (បានរក្សាទុក)'}</span>
                        </div>
                    )}

                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                    >
                        <FaUndo className="text-xs" />
                        <span>{t('resetDefault') || 'Reset Default (ទម្រង់ដើម)'}</span>
                    </button>

                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-600/30"
                    >
                        <FaSave className="text-xs" />
                        <span>{t('saveTheme') || 'Save Preferences (រក្សាទុក)'}</span>
                    </button>
                </div>
            </header>

            {/* 1. Preset Themes Grid */}
            <section className="bg-[var(--app-card,#ffffff)] p-5 border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-black text-[var(--app-text,#0f172a)] flex items-center gap-2">
                        <FaMagic className="text-indigo-600" />
                        <span>Preset Themes (រូបរាងស្រាប់ៗ)</span>
                    </h2>
                    <span className="text-xs text-slate-500 font-semibold">Choose a pre-designed theme style</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.keys(PRESET_THEMES).map((key) => {
                        const p = PRESET_THEMES[key];
                        const isSelected = customTheme.mode === p.mode && customTheme.bgPrimary === p.bgPrimary;
                        return (
                            <button
                                key={key}
                                onClick={() => handleSelectPreset(key)}
                                className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                                    isSelected
                                        ? 'border-indigo-600 ring-2 ring-indigo-500/40 bg-indigo-50/30 shadow-md'
                                        : 'border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50 shadow-2xs'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-xs font-bold text-slate-800">{p.name}</span>
                                    {isSelected && <FaCheckCircle className="text-indigo-600 text-xs flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1.5 w-full h-5 rounded-lg overflow-hidden border border-slate-200 p-0.5" style={{ backgroundColor: p.bgPrimary }}>
                                    <div className="w-1/3 h-full rounded" style={{ backgroundColor: p.sidebarBg }}></div>
                                    <div className="w-1/3 h-full rounded" style={{ backgroundColor: p.bgCard }}></div>
                                    <div className="w-1/3 h-full rounded" style={{ backgroundColor: p.accentColor }}></div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 2. Custom Color Pickers & Live Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Custom Color Adjustment Form */}
                <section className="lg:col-span-1 bg-[var(--app-card,#ffffff)] p-5 border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                    <h2 className="text-base font-black text-[var(--app-text,#0f172a)] flex items-center gap-2">
                        <MdOutlineColorLens className="text-indigo-600 text-xl" />
                        <span>Custom Color Settings (កំណត់ពណ៌)</span>
                    </h2>

                    <div className="space-y-3 text-xs">
                        {/* Main Background Color */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Main Background (ពណ៌ផ្ទៃក្រោយ)</p>
                                <p className="text-[10px] text-slate-500">Global page background</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.bgPrimary || '#f4f6f8'}
                                    onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.bgPrimary}</span>
                            </div>
                        </div>

                        {/* Card Background Color */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Card Background (ពណ៌ប្រអប់)</p>
                                <p className="text-[10px] text-slate-500">Panels, cards & modals</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.bgCard || '#ffffff'}
                                    onChange={(e) => handleColorChange('bgCard', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.bgCard}</span>
                            </div>
                        </div>

                        {/* Accent / Primary Button Color */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Accent Color (ពណ៌លេចធ្លោ)</p>
                                <p className="text-[10px] text-slate-500">Buttons, highlights & badges</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.accentColor || '#4f46e5'}
                                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.accentColor}</span>
                            </div>
                        </div>

                        {/* Primary Text Color */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Primary Text Color (ពណ៌អក្សរចម្បង)</p>
                                <p className="text-[10px] text-slate-500">Headings & table headers</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.textPrimary || '#0f172a'}
                                    onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.textPrimary}</span>
                            </div>
                        </div>

                        {/* Secondary Text Color */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Secondary Text Color (ពណ៌អក្សរបន្ទាប់)</p>
                                <p className="text-[10px] text-slate-500">Subtitles & details</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.textSecondary || '#64748b'}
                                    onChange={(e) => handleColorChange('textSecondary', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.textSecondary}</span>
                            </div>
                        </div>

                        {/* Sidebar Background */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="font-bold text-slate-800">Sidebar Background (ពណ៌ម៉ឺនុយឆ្វេង)</p>
                                <p className="text-[10px] text-slate-500">Navigation sidebar</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customTheme.sidebarBg || '#f8fafc'}
                                    onChange={(e) => handleColorChange('sidebarBg', e.target.value)}
                                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                                />
                                <span className="font-mono text-xs font-bold text-slate-700">{customTheme.sidebarBg}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Live Interactive UI Preview */}
                <section className="lg:col-span-2 bg-[var(--app-card,#ffffff)] p-5 border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-black text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <FaRegSun className="text-amber-500 animate-spin-slow" />
                            <span>Live System Preview (មើលការផ្លាស់ប្តូរផ្ទាល់)</span>
                        </h2>
                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">Real-time Mockup</span>
                    </div>

                    {/* Preview Box Container */}
                    <div
                        className="w-full h-[360px] rounded-2xl border border-slate-300 overflow-hidden flex flex-col shadow-inner transition-colors duration-300 p-2"
                        style={{ backgroundColor: customTheme.bgPrimary }}
                    >
                        {/* Mock Top Header */}
                        <div
                            className="w-full h-10 rounded-xl px-3 flex items-center justify-between border border-slate-200/50 shadow-xs mb-2 transition-colors"
                            style={{ backgroundColor: customTheme.headerBg }}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: customTheme.accentColor }}>M</div>
                                <span className="text-xs font-extrabold" style={{ color: customTheme.textPrimary }}>SYSTEM MDM</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: customTheme.accentColor }}>Online</span>
                                <div className="w-6 h-6 rounded-full bg-slate-300 border border-white"></div>
                            </div>
                        </div>

                        <div className="flex-1 flex gap-2 overflow-hidden">
                            {/* Mock Left Sidebar */}
                            <div
                                className="w-40 rounded-xl p-2 flex flex-col gap-1.5 border border-slate-200/50 transition-colors"
                                style={{ backgroundColor: customTheme.sidebarBg }}
                            >
                                <div className="w-full h-7 rounded-lg px-2 flex items-center gap-2 text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: customTheme.accentColor }}>
                                    <MdOutlineDashboard /> Dashboard
                                </div>
                                <div className="w-full h-7 rounded-lg px-2 flex items-center gap-2 text-[10px] font-bold" style={{ color: customTheme.textSecondary }}>
                                    📂 Customers
                                </div>
                                <div className="w-full h-7 rounded-lg px-2 flex items-center gap-2 text-[10px] font-bold" style={{ color: customTheme.textSecondary }}>
                                    📱 Devices
                                </div>
                                <div className="w-full h-7 rounded-lg px-2 flex items-center gap-2 text-[10px] font-bold" style={{ color: customTheme.textSecondary }}>
                                    ⚙️ Settings
                                </div>
                            </div>

                            {/* Mock Main Content Area */}
                            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2.5 rounded-xl border border-slate-200/60 shadow-2xs" style={{ backgroundColor: customTheme.bgCard }}>
                                        <p className="text-[9px] font-bold" style={{ color: customTheme.textSecondary }}>Total Revenue</p>
                                        <p className="text-sm font-black mt-0.5" style={{ color: customTheme.accentColor }}>$12,450.00</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl border border-slate-200/60 shadow-2xs" style={{ backgroundColor: customTheme.bgCard }}>
                                        <p className="text-[9px] font-bold" style={{ color: customTheme.textSecondary }}>Active Devices</p>
                                        <p className="text-sm font-black mt-0.5" style={{ color: customTheme.textPrimary }}>1,280 Units</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl border border-slate-200/60 shadow-2xs" style={{ backgroundColor: customTheme.bgCard }}>
                                        <p className="text-[9px] font-bold" style={{ color: customTheme.textSecondary }}>Lock Phone</p>
                                        <p className="text-sm font-black mt-0.5 text-rose-500">24 Locked</p>
                                    </div>
                                </div>

                                {/* Mock Table */}
                                <div className="flex-1 rounded-xl p-2 border border-slate-200/60 shadow-2xs flex flex-col gap-1.5" style={{ backgroundColor: customTheme.bgCard }}>
                                    <div className="w-full h-6 rounded-md px-2 flex items-center justify-between text-[9px] font-bold text-white" style={{ backgroundColor: customTheme.accentColor }}>
                                        <span>Customer Name</span>
                                        <span>Status</span>
                                    </div>
                                    <div className="w-full h-6 rounded-md px-2 flex items-center justify-between text-[9px] border-b border-slate-100" style={{ color: customTheme.textPrimary }}>
                                        <span>Hak Yonghouv</span>
                                        <span className="font-bold text-emerald-600">Active</span>
                                    </div>
                                    <div className="w-full h-6 rounded-md px-2 flex items-center justify-between text-[9px]" style={{ color: customTheme.textPrimary }}>
                                        <span>John Doe</span>
                                        <span className="font-bold text-indigo-600">Pending</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Personalization;
