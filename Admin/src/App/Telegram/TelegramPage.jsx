import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  FaTelegramPlane,
  FaPlus,
  FaTrash,
  FaEdit,
  FaRedo,
  FaExternalLinkAlt,
  FaExpand,
  FaCompress,
  FaCheck,
  FaTimes,
  FaUser,
  FaShieldAlt,
  FaInfoCircle
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
  const iframeRef = useRef(null);

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

  const [iframeLoading, setIframeLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelperBanner, setShowHelperBanner] = useState(true);

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

  // Telegram URL for the active account
  const getTelegramUrl = (acc) => {
    if (!acc) return "https://web.telegram.org/a/";
    return acc.version === "k"
      ? "https://web.telegram.org/k/"
      : "https://web.telegram.org/a/";
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
    setIframeLoading(true);
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

  const handleReloadFrame = () => {
    setIframeLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = getTelegramUrl(activeAccount);
    }
  };

  const handleOpenExternal = () => {
    window.open(getTelegramUrl(activeAccount), "_blank", "noopener,noreferrer");
  };

  const handleToggleVersion = () => {
    const nextVer = activeAccount?.version === "k" ? "a" : "k";
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId ? { ...a, version: nextVer } : a
      )
    );
    setIframeLoading(true);
  };

  return (
    <div className={`flex flex-col w-full h-[calc(100vh-7vh)] min-h-[600px] bg-slate-900 text-slate-100 select-none overflow-hidden ${isFullscreen ? "fixed inset-0 z-[999999] h-screen" : ""}`}>
      {/* Top Header Bar with Multi-Account Switcher */}
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-md">
        {/* Left: Branding & Account Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <FaTelegramPlane className="text-lg text-sky-400 animate-pulse" />
            <span className="text-xs font-black tracking-wide">Telegram Web</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span>គណនី Telegram:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-bold font-mono">
              {accounts.length}/5
            </span>
            <span className="hidden lg:inline text-slate-500 text-[10px]">
              (កំណត់ដោយ Account System: <b className="text-slate-300">{user?.username || "Admin"}</b>)
            </span>
          </div>
        </div>

        {/* Right: Version Switcher & Frame Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Version Switcher (Web A vs Web K) */}
          <button
            type="button"
            onClick={handleToggleVersion}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="ប្តូរ Version Telegram (Switch between Web A and Web K)"
          >
            <MdOutlineSwapHoriz className="text-sm text-sky-400" />
            <span>Ver: {activeAccount?.version?.toUpperCase() === "K" ? "Web K (Fast)" : "Web A (Modern)"}</span>
          </button>

          {/* Reload Frame Button */}
          <button
            type="button"
            onClick={handleReloadFrame}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Refresh Telegram Session"
          >
            <FaRedo className={`text-xs ${iframeLoading ? "animate-spin text-sky-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Open in New Window */}
          <button
            type="button"
            onClick={handleOpenExternal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="បើកក្នុងផ្ទាំងថ្មី (Open in New Tab)"
          >
            <FaExternalLinkAlt className="text-xs" />
            <span className="hidden sm:inline">Open New Tab</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            title={isFullscreen ? "បង្រួមមកវិញ (Exit Fullscreen)" : "ពង្រីកពេញអេក្រង់ (Fullscreen)"}
          >
            {isFullscreen ? <FaCompress className="text-xs" /> : <FaExpand className="text-xs" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      </header>

      {/* Account Tabs Bar (Up to 5 Accounts) */}
      <div className="flex-shrink-0 bg-slate-950/80 border-b border-slate-800/80 px-3 py-1.5 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
          <FaUser className="text-[9px] text-sky-400" /> Accounts:
        </span>

        {accounts.map((acc, index) => {
          const isActive = acc.id === activeAccountId;
          return (
            <div
              key={acc.id}
              onClick={() => {
                if (!isActive) {
                  setActiveAccountId(acc.id);
                  setIframeLoading(true);
                }
              }}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer flex-shrink-0 border ${
                isActive
                  ? "bg-slate-800 text-white border-sky-500 shadow-md shadow-sky-500/10"
                  : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-slate-800"
              }`}
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: acc.color || COLOR_PALETTE[index % COLOR_PALETTE.length]
              }}
            >
              {/* Account Number Indicator */}
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-extrabold"
                style={{ backgroundColor: acc.color || COLOR_PALETTE[index % COLOR_PALETTE.length] }}
              >
                {index + 1}
              </span>

              {/* Account Name */}
              <span className="truncate max-w-[130px] sm:max-w-[160px]">{acc.name}</span>

              {/* Quick Actions (Edit / Delete) */}
              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity pl-1 border-l border-slate-700/50">
                <button
                  type="button"
                  onClick={(e) => startEdit(acc, e)}
                  className="p-1 hover:text-sky-400 rounded transition-colors"
                  title="កែឈ្មោះ Account (Edit Name)"
                >
                  <FaEdit className="text-[10px]" />
                </button>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAccount(acc.id, e)}
                    className="p-1 hover:text-rose-400 rounded transition-colors"
                    title="លុប Account Slot នេះ (Delete Slot)"
                  >
                    <FaTrash className="text-[10px]" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Account Button (Disabled when reached 5) */}
        {accounts.length < 5 ? (
          <button
            type="button"
            onClick={() => {
              setIsAddingAccount(true);
              setAccountNameInput(`Telegram ${accounts.length + 1}`);
              setAccountColorInput(COLOR_PALETTE[accounts.length % COLOR_PALETTE.length]);
              setAccountVersionInput("a");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 hover:text-sky-300 border border-dashed border-sky-500/50 text-xs font-bold transition-all cursor-pointer flex-shrink-0"
            title="បន្ថែម Account Telegram ថ្មី (Add Telegram Account slot - Max 5)"
          >
            <FaPlus className="text-[10px]" />
            <span>+ បន្ថែម Account ({accounts.length}/5)</span>
          </button>
        ) : (
          <div className="px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-[6px] flex-shrink-0">
            គ្រប់ចំនួនអតិបរមា 5 គណនី (Max 5 Reached)
          </div>
        )}
      </div>

      {/* Helper Banner for Telegram Authentication */}
      {showHelperBanner && (
        <div className="flex-shrink-0 bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <FaInfoCircle className="text-sky-400 text-sm flex-shrink-0" />
            <span>
              <b>របៀបចូលប្រើ៖</b> ស្កេន <b>QR Code</b> ឬវាយលេខទូរស័ព្ទដើម្បី Login គណនី Telegram របស់អ្នក។ គណនីនីមួយៗនឹងរក្សាទុក session ដាច់ដោយឡែកពីគ្នា (Up to 5 Accounts)។
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelperBanner(false)}
            className="text-slate-500 hover:text-slate-300 p-1 text-xs"
            title="បិទការណែនាំ"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Main Telegram Web Content Area */}
      <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {/* Loading Spinner Indicator */}
        {iframeLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xs text-slate-300 space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin flex items-center justify-center">
              <FaTelegramPlane className="text-sky-400 text-lg" />
            </div>
            <p className="text-xs font-bold text-slate-300">
              កំពុងតភ្ជាប់ទៅកាន់ <span className="text-sky-400 font-mono">{activeAccount?.name || "Telegram Web"}</span>...
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm text-center">
              ប្រសិនបើចំណាយពេលយូរ ឬ browser ទប់ស្កាត់ iframe លោកអ្នកអាចចុច <b>"Open New Tab"</b> ខាងលើបាន។
            </p>
          </div>
        )}

        {/* Live Official Telegram Web Frame */}
        <iframe
          key={`${activeAccount?.id}_${activeAccount?.version}`}
          ref={iframeRef}
          src={getTelegramUrl(activeAccount)}
          title={`Telegram Web - ${activeAccount?.name}`}
          className="w-full h-full flex-1 border-0 bg-white"
          onLoad={() => setIframeLoading(false)}
          allow="camera; microphone; display-capture; clipboard-read; clipboard-write; autoplay; fullscreen; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-presentation allow-pointer-lock"
        />
      </div>

      {/* Add Account Modal */}
      {isAddingAccount && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[14px] p-5 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FaTelegramPlane className="text-sky-400 text-lg" />
                <h3 className="text-sm font-extrabold text-white">បន្ថែមគណនី Telegram (Add Slot)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingAccount(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  ឈ្មោះគណនី / Account Label <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  placeholder="ឧ. Telegram Support, Sales, Personal..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-[8px] text-white focus:outline-none focus:border-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Telegram Web Version</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("a")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "a"
                        ? "bg-sky-500/20 border-sky-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-400">Web A (Default)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Feature-rich & Modern</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("k")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "k"
                        ? "bg-sky-500/20 border-sky-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-400">Web K (Lightweight)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Fast & Compact</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">ពណ៌សម្គាល់ / Color Badge</label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColorInput(color)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        accountColorInput === color ? "scale-125 ring-2 ring-white" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {accountColorInput === color && <FaCheck className="text-white text-[10px]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="px-4 py-2 rounded-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  បោះបង់ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer shadow-md shadow-sky-600/20"
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
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[14px] p-5 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FaEdit className="text-sky-400 text-lg" />
                <h3 className="text-sm font-extrabold text-white">កែប្រែគណនី Telegram</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccountId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ឈ្មោះគណនី / Account Label</label>
                <input
                  type="text"
                  required
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-[8px] text-white focus:outline-none focus:border-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Telegram Web Version</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("a")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "a"
                        ? "bg-sky-500/20 border-sky-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-400">Web A (Default)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Feature-rich & Modern</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountVersionInput("k")}
                    className={`p-2.5 rounded-[8px] border text-left cursor-pointer transition-all ${
                      accountVersionInput === "k"
                        ? "bg-sky-500/20 border-sky-500 text-white font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-400">Web K (Lightweight)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Fast & Compact</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">ពណ៌សម្គាល់ / Color Badge</label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColorInput(color)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        accountColorInput === color ? "scale-125 ring-2 ring-white" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {accountColorInput === color && <FaCheck className="text-white text-[10px]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAccountId(null)}
                  className="px-4 py-2 rounded-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  បោះបង់ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[8px] bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer shadow-md shadow-sky-600/20"
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
