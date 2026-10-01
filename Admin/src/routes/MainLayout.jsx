import React, { useState, useEffect } from "react";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import MobileBottomNav from "../components/MobileBottomNav";
import MobileResponsiveContent from "../components/MobileResponsiveContent";
import PaymentAlertDrawer from "../components/PaymentAlertDrawer";
import { useTheme } from "../context/ThemeContext";

import { FaChevronUp, FaEye, FaEyeSlash } from "react-icons/fa";
import { MdOutlineViewHeadline, MdOutlineViewSidebar } from "react-icons/md";

const MainLayout = ({ children }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [isFloatingUplistOpen, setIsFloatingUplistOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const [isHeaderOpen, setIsHeaderOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("isHeaderOpen");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleToggleHeader = (val) => {
    setIsHeaderOpen((prev) => {
      const next = typeof val === "boolean" ? val : !prev;
      try {
        localStorage.setItem("isHeaderOpen", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!isFloatingUplistOpen) return;
    const handleOutside = (e) => {
      if (!e.target.closest("#floating-display-uplist")) {
        setIsFloatingUplistOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isFloatingUplistOpen]);

  const { theme } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] relative transition-colors duration-300 overflow-hidden">
      {/* Background Image Layer (Fixed Fullscreen Backdrop) */}
      {theme?.bgType === "image" && theme?.bgImage && (
        <div
          className="fixed inset-0 w-full h-full bg-cover bg-center z-0 pointer-events-none transition-opacity duration-500"
          style={{
            backgroundImage: `url(${theme.bgImage})`,
            opacity: "var(--app-bg-opacity, 0.75)",
          }}
        />
      )}

      {/* Background Video Player (Capped to 10 Seconds Loop) */}
      {theme?.bgType === "video" && theme?.bgVideo && (
        <video
          src={theme.bgVideo}
          autoPlay
          loop
          muted
          playsInline
          onTimeUpdate={(e) => {
            if (e.target.currentTime >= 10) {
              e.target.currentTime = 0;
            }
          }}
          className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none transition-opacity duration-500"
          style={{ opacity: "var(--app-bg-opacity, 0.75)" }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Collapsible Header Container */}
        <div
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            isHeaderOpen
              ? "max-h-[80px] opacity-100 overflow-visible"
              : "max-h-0 opacity-0 overflow-hidden pointer-events-none"
          }`}
        >
          <Header
            onOpenAlerts={() => setIsAlertOpen(true)}
            alertCount={alertCount}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((isOpen) => !isOpen)}
            onHideHeader={() => handleToggleHeader(false)}
          />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className={`mobile-sidebar-backdrop ${isSidebarOpen ? "mobile-sidebar-backdrop-open" : ""}`}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <Left
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onHideHeader={() => handleToggleHeader(false)}
            isHeaderOpen={isHeaderOpen}
            onToggleHeader={() => handleToggleHeader()}
          />
          <MobileResponsiveContent className="flex-1 min-w-0 overflow-auto mobile-content-area">
            {children}
          </MobileResponsiveContent>
        </div>

        <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

        <PaymentAlertDrawer
          isOpen={isAlertOpen}
          onClose={() => setIsAlertOpen(false)}
          alertCount={alertCount}
          setAlertCount={setAlertCount}
        />

        {/* Floating Button at Bottom-Right with Uplist (Shown when either Left Menu or Header is hidden) */}
        {(!isHeaderOpen || !isSidebarOpen) && (
          <div id="floating-display-uplist" className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[99999] flex flex-col items-end">
            {/* Uplist Popup Menu (Pops UP above the button) */}
            {isFloatingUplistOpen && (
              <div
                className="mb-2.5 w-[220px] bg-white border border-slate-200 rounded-[14px] p-2 shadow-[0_15px_50px_rgba(0,0,0,0.22)] animate-in fade-in slide-in-from-bottom-2 duration-200 opacity-100 select-none"
                style={{ backgroundColor: "#ffffff" }}
              >
                {/* Header Title */}
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    ផ្ទាំងបង្ហាញ / Display
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                    Menu
                  </span>
                </div>

                {/* Option 1: Show Both (បង្ហាញទាំង២មកវិញ) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderOpen(true);
                    setIsSidebarOpen(true);
                    try { localStorage.setItem("isHeaderOpen", JSON.stringify(true)); } catch {}
                    setIsFloatingUplistOpen(false);
                  }}
                  className="w-full h-[36px] flex items-center justify-between px-2.5 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[8px] transition-all cursor-pointer text-xs font-semibold group"
                >
                  <div className="flex items-center gap-2">
                    <FaEye className="text-sm text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>បង្ហាញទាំង២ (Show All)</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600">✓</span>
                </button>

                {/* Option 2: Hide Both (លាក់ទាំង២) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderOpen(false);
                    setIsSidebarOpen(false);
                    try { localStorage.setItem("isHeaderOpen", JSON.stringify(false)); } catch {}
                    setIsFloatingUplistOpen(false);
                  }}
                  className="w-full h-[36px] flex items-center justify-between px-2.5 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-[8px] transition-all cursor-pointer text-xs font-semibold group"
                >
                  <div className="flex items-center gap-2">
                    <FaEyeSlash className="text-sm text-rose-500 group-hover:scale-110 transition-transform" />
                    <span>លាក់ទាំង២ (Hide Both)</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-500">✕</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* Option 3: Toggle Header */}
                <button
                  type="button"
                  onClick={() => {
                    handleToggleHeader();
                  }}
                  className="w-full h-[34px] flex items-center justify-between px-2.5 hover:bg-slate-100 text-slate-700 rounded-[8px] transition-all cursor-pointer text-xs font-medium"
                >
                  <div className="flex items-center gap-2">
                    <MdOutlineViewHeadline className="text-base text-slate-500" />
                    <span>Header</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isHeaderOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {isHeaderOpen ? "បើក" : "បិទ"}
                  </span>
                </button>

                {/* Option 4: Toggle Left Menu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen((prev) => !prev);
                  }}
                  className="w-full h-[34px] flex items-center justify-between px-2.5 hover:bg-slate-100 text-slate-700 rounded-[8px] transition-all cursor-pointer text-xs font-medium"
                >
                  <div className="flex items-center gap-2">
                    <MdOutlineViewSidebar className="text-base text-slate-500" />
                    <span>Left Menu</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSidebarOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {isSidebarOpen ? "បើក" : "បិទ"}
                  </span>
                </button>
              </div>
            )}

            {/* Floating Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFloatingUplistOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl border border-white/40 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer select-none group"
              title="គ្រប់គ្រងផ្ទាំងបង្ហាញ (Display Controls)"
              aria-label="Display Controls"
            >
              <FaChevronUp className={`text-xs transition-transform duration-300 ${isFloatingUplistOpen ? "rotate-180 text-white" : "rotate-0 text-emerald-200"}`} />
              <span className="text-xs font-extrabold tracking-wide select-none">
                {!isHeaderOpen && !isSidebarOpen
                  ? "Menu & Header"
                  : !isHeaderOpen
                  ? "Header"
                  : "Menu"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
