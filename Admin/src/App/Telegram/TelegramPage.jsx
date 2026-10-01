import React, { useState, useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  FaTelegramPlane,
  FaPlus,
  FaTrash,
  FaEdit,
  FaExternalLinkAlt,
  FaCheck,
  FaTimes,
  FaUser,
  FaShieldAlt,
  FaQrcode,
  FaPhoneAlt,
  FaRocket,
  FaWindowRestore
} from "react-icons/fa";
import { MdOutlineSwapHoriz } from "react-icons/md";

const DEFAULT_ACCOUNTS = [
  {
    id: "acc_1",
    name: "Telegram 1 (Primary)",
    version: "a", // 'a' = Web A (https://web.telegram.org/a/), 'k' = Web K (https://web.telegram.org/k/)
    color: "#0284c7" // sky-600
  }
];

const COLOR_PALETTE = [
  "#0284c7", // Sky Blue
  "#059669", // Emerald Green
  "#7c3aed", // Violet
  "#d97706", // Amber
  "#e11d48", // Rose
  "#0891b2", // Cyan
  "#4f46e5"  // Indigo
];

const TelegramPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Storage key is scoped to the logged-in system user
  const storageKey = `telegram_accounts_${user?.username || "default"}`;

  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 5);
        }
      }
    } catch (e) {
      console.error("Failed to parse saved telegram accounts:", e);
    }
    return DEFAULT_ACCOUNTS;
  });

  const [activeAccountId, setActiveAccountId] = useState(() => {
    return accounts[0]?.id || "acc_1";
  });

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [accountNameInput, setAccountNameInput] = useState("");
  const [accountColorInput, setAccountColorInput] = useState(COLOR_PALETTE[0]);
  const [accountVersionInput, setAccountVersionInput] = useState("a");

  // Save accounts to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(accounts));
    } catch (e) {
      console.error("Failed to save telegram accounts:", e);
    }
  }, [accounts, storageKey]);

  // Ensure active account exists
  useEffect(() => {
    if (!accounts.some((a) => a.id === activeAccountId) && accounts.length > 0) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // Telegram URL for the account
  const getTelegramUrl = (acc) => {
    if (!acc) return "https://web.telegram.org/a/";
    return acc.version === "k"
      ? "https://web.telegram.org/k/"
      : "https://web.telegram.org/a/";
  };

  // Launch standalone app window for Telegram
  const handleLaunchAppWindow = (acc) => {
    const targetAcc = acc || activeAccount;
    const url = getTelegramUrl(targetAcc);
    const windowName = `Telegram_Session_${user?.username || "user"}_${targetAcc.id}`;
    const windowFeatures = "width=1200,height=850,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
    window.open(url, windowName, windowFeatures);
  };

  // Open in standard browser new tab
  const handleOpenExternal = (acc) => {
    const targetAcc = acc || activeAccount;
    window.open(getTelegramUrl(targetAcc), "_blank", "noopener,noreferrer");
  };

  const handleAddAccount = (e) => {
    e.preventDefault();
    if (accounts.length >= 5) return;

    const trimmed = accountNameInput.trim() || `Telegram ${accounts.length + 1}`;
    const newId = `acc_${Date.now()}`;
    const newAcc = {
      id: newId,
      name: trimmed,
      version: accountVersionInput || "a",
      color: accountColorInput || COLOR_PALETTE[accounts.length % COLOR_PALETTE.length]
    };

    const updated = [...accounts, newAcc].slice(0, 5);
    setAccounts(updated);
    setActiveAccountId(newId);
    setAccountNameInput("");
    setIsAddingAccount(false);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingAccountId) return;
    const trimmed = accountNameInput.trim();
    if (!trimmed) return;

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === editingAccountId
          ? { ...a, name: trimmed, color: accountColorInput, version: accountVersionInput }
          : a
      )
    );
    setEditingAccountId(null);
    setAccountNameInput("");
  };

  const handleDeleteAccount = (accId, e) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      alert("អ្នកត្រូវតែមានយ៉ាងហោចណាស់គណនី Telegram ចំនួន 1 (Must keep at least 1 account).");
      return;
    }
    if (window.confirm("តើអ្នកប្រាកដជាចង់លុប Account Slot នេះមែនទេ? (Are you sure you want to remove this account tab?)")) {
      const filtered = accounts.filter((a) => a.id !== accId);
      setAccounts(filtered);
      if (activeAccountId === accId && filtered.length > 0) {
        setActiveAccountId(filtered[0].id);
      }
    }
  };

  const startEdit = (acc, e) => {
    e.stopPropagation();
    setEditingAccountId(acc.id);
    setAccountNameInput(acc.name);
    setAccountColorInput(acc.color || COLOR_PALETTE[0]);
    setAccountVersionInput(acc.version || "a");
  };

  const handleToggleVersion = (accId) => {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === accId) {
          const nextVer = a.version === "k" ? "a" : "k";
          return { ...a, version: nextVer };
        }
        return a;
      })
    );
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[700px] bg-slate-50 text-slate-800 select-none overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 custom-scrollbar">
      {/* Top Header Card */}
      <header className="bg-white border border-slate-200 rounded-[14px] p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-[12px] bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 shadow-xs flex-shrink-0">
            <FaTelegramPlane className="text-2xl animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Telegram Web (Multi-Account Workspace)
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-700 text-[10px] font-black">
                Max 5 Accounts
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              គ្រប់គ្រង និងប្រើប្រាស់ Telegram រហូតដល់ <b>5 គណនី</b> ក្នុងពេលតែមួយសម្រាប់ Account System: <b className="text-emerald-700 font-mono">{user?.username || "Admin"}</b>
            </p>
          </div>
        </div>

        {/* Global Action Launchers */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleLaunchAppWindow(activeAccount)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-all duration-200 cursor-pointer shadow-md shadow-sky-600/20 active:scale-95 group"
          >
            <FaRocket className="text-sm transition-transform group-hover:-translate-y-0.5" />
            <span>បើកដំណើរការ {activeAccount?.name}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenExternal(activeAccount)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-all cursor-pointer shadow-2xs"
          >
            <FaExternalLinkAlt className="text-xs text-sky-600" />
            <span>Open Tab</span>
          </button>
        </div>
      </header>

      {/* Account Switcher Tabs Bar */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-3 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <FaUser className="text-sky-600 text-xs" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              បញ្ជីគណនី Telegram ({accounts.length}/5)
            </span>
          </div>

          {accounts.length < 5 ? (
            <button
              type="button"
              onClick={() => {
                setIsAddingAccount(true);
                setAccountNameInput(`Telegram ${accounts.length + 1}`);
                setAccountColorInput(COLOR_PALETTE[accounts.length % COLOR_PALETTE.length]);
                setAccountVersionInput("a");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-sky-50 hover:bg-sky-100 text-sky-700 border border-dashed border-sky-400 text-xs font-black transition-all cursor-pointer"
            >
              <FaPlus className="text-[10px]" />
              <span>+ បន្ថែមគណនីថ្មី (Slot {accounts.length + 1})</span>
            </button>
          ) : (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              គ្រប់ចំនួន 5 គណនីអតិបរមា
            </span>
          )}
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar pb-1">
          {accounts.map((acc, index) => {
            const isActive = acc.id === activeAccountId;
            return (
              <div
                key={acc.id}
                onClick={() => setActiveAccountId(acc.id)}
                className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer flex-shrink-0 border ${
                  isActive
                    ? "bg-sky-50 text-slate-900 border-sky-500 shadow-sm ring-1 ring-sky-500"
                    : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200 shadow-2xs"
                }`}
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: acc.color || COLOR_PALETTE[index % COLOR_PALETTE.length]
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-black flex-shrink-0"
                  style={{ backgroundColor: acc.color || COLOR_PALETTE[index % COLOR_PALETTE.length] }}
                >
                  {index + 1}
                </span>

                <span className="truncate max-w-[140px] font-black text-slate-900">{acc.name}</span>

                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                  {acc.version?.toUpperCase() === "K" ? "Web K" : "Web A"}
                </span>

                {/* Edit / Delete Icons */}
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={(e) => startEdit(acc, e)}
                    className="p-1 text-slate-400 hover:text-sky-600 rounded transition-colors"
                    title="កែឈ្មោះ (Edit Name)"
                  >
                    <FaEdit className="text-[11px]" />
                  </button>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteAccount(acc.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="លុប Slot នេះ"
                    >
                      <FaTrash className="text-[11px]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Active Account Workspace Card */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-black shadow-xs"
              style={{ backgroundColor: activeAccount?.color || COLOR_PALETTE[0] }}
            >
              {accounts.findIndex((a) => a.id === activeAccount?.id) + 1}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">{activeAccount?.name}</h2>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
                  Active Slot
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Session Target: {getTelegramUrl(activeAccount)}
              </p>
            </div>
          </div>

          {/* Quick Version Toggle & Direct Launch */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleToggleVersion(activeAccount.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-slate-100 hover:bg-sky-50 text-slate-800 hover:text-sky-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer"
              title="ប្តូរ Version Telegram សម្រាប់ Account នេះ"
            >
              <MdOutlineSwapHoriz className="text-sm text-sky-600" />
              <span>Version: {activeAccount?.version?.toUpperCase() === "K" ? "Web K (Fast)" : "Web A (Modern)"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleLaunchAppWindow(activeAccount)}
              className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-all cursor-pointer shadow-sm shadow-sky-600/20 active:scale-95"
            >
              <FaWindowRestore className="text-xs" />
              <span>Launch Telegram Window</span>
            </button>
          </div>
        </div>

        {/* 3 Step Quick Start Guide Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Step 1 */}
          <div className="p-4 rounded-[12px] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-[8px] bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs mb-2.5">
                1
              </div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <FaRocket className="text-sky-600" /> ចុចបើកដំណើរការ (Launch)
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                ចុចប៊ូតុង <b>"Launch Telegram Window"</b> ដើម្បីបើកផ្ទាំងកម្មវិធី Telegram Web ដាច់ដោយឡែកសម្រាប់ Account នេះ។
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunchAppWindow(activeAccount)}
              className="w-full mt-3 py-2 px-3 rounded-[8px] bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              បើកផ្ទាំងកម្មវិធី (Open Window)
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-[12px] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-[8px] bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs mb-2.5">
                2
              </div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <FaQrcode className="text-emerald-600" /> ស្កេន QR Code ឬវាយលេខទូរស័ព្ទ
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                លើទូរស័ព្ទដៃបើក Telegram ➔ <b>Settings ➔ Devices ➔ Link Desktop Device</b> រួចស្កេន QR Code ដើម្បីចូលប្រើ។
              </p>
            </div>
            <div className="w-full mt-3 py-1.5 px-3 rounded-[8px] bg-emerald-50 text-emerald-700 text-center text-[10px] font-bold border border-emerald-200">
              រក្សាទុក Session ស្វ័យប្រវត្តិ
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-[12px] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-[8px] bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs mb-2.5">
                3
              </div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <FaShieldAlt className="text-purple-600" /> ប្រើប្រាស់រហូតដល់ 5 គណនី
              </h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                អាចចុច Tab ខាងលើដើម្បីបើកគណនីផ្សេងទៀតបានរហូតដល់ <b>5 គណនី</b> ក្នុងពេលតែមួយដោយមិនចាំបាច់ Log out ឡើយ។
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenExternal(activeAccount)}
              className="w-full mt-3 py-2 px-3 rounded-[8px] bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            >
              <FaExternalLinkAlt className="text-[10px] text-slate-500" />
              <span>បើកក្នុង Browser Tab</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddingAccount && (
        <div className="fixed inset-0 z-[999999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-[14px] p-5 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <FaTelegramPlane className="text-sky-600 text-lg" />
                <h3 className="text-sm font-black text-slate-900">បន្ថែមគណនី Telegram (Slot {accounts.length + 1}/5)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingAccount(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-black mb-1">
                  ឈ្មោះគណនី / Account Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  placeholder="ឧ. Telegram Support, Sales, Personal..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[8px] text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-black mb-1">Telegram Web Version</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("a")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "a"
                        ? "bg-sky-50 border-sky-500 text-slate-900 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-600">Web A (Default)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Feature-rich & Modern</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("k")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "k"
                        ? "bg-sky-50 border-sky-500 text-slate-900 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-600">Web K (Lightweight)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Fast & Compact</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-black mb-1.5">ពណ៌សម្គាល់ / Color Badge</label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColorInput(color)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        accountColorInput === color ? "scale-125 ring-2 ring-slate-800 shadow-xs" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {accountColorInput === color && <FaCheck className="text-white text-[10px]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="px-4 py-2 rounded-[8px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  បោះបង់ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] bg-sky-600 hover:bg-sky-700 text-white font-extrabold cursor-pointer shadow-md shadow-sky-600/20"
                >
                  បង្កើតគណនី (Create Slot)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccountId && (
        <div className="fixed inset-0 z-[999999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-[14px] p-5 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <FaEdit className="text-sky-600 text-lg" />
                <h3 className="text-sm font-black text-slate-900">កែប្រែគណនី Telegram</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccountId(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-800 font-black mb-1">ឈ្មោះគណនី / Account Label</label>
                <input
                  type="text"
                  required
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-[8px] text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-black mb-1">Telegram Web Version</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("a")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "a"
                        ? "bg-sky-50 border-sky-500 text-slate-900 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-600">Web A (Default)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Feature-rich & Modern</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("k")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "k"
                        ? "bg-sky-50 border-sky-500 text-slate-900 font-black shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-600">Web K (Lightweight)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Fast & Compact</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-black mb-1.5">ពណ៌សម្គាល់ / Color Badge</label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColorInput(color)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        accountColorInput === color ? "scale-125 ring-2 ring-slate-800 shadow-xs" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {accountColorInput === color && <FaCheck className="text-white text-[10px]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAccountId(null)}
                  className="px-4 py-2 rounded-[8px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  បោះបង់ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] bg-sky-600 hover:bg-sky-700 text-white font-extrabold cursor-pointer shadow-md shadow-sky-600/20"
                >
                  រក្សាទុក (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramPage;
