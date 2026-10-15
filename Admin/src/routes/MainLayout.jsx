import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import MobileBottomNav from "../components/MobileBottomNav";
import MobileResponsiveContent from "../components/MobileResponsiveContent";
import PaymentAlertDrawer from "../components/PaymentAlertDrawer";
import GlobalImageZoomModal from "../components/GlobalImageZoomModal";
import { useTheme } from "../context/ThemeContext";

import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdOutlineViewHeadline, MdOutlineViewSidebar, MdDragIndicator } from "react-icons/md";

const STORAGE_KEY_POS = "floatingDisplayPos";
const STORAGE_KEY_HEADER = "isHeaderOpen";

const MainLayout = ({ children }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [isFloatingUplistOpen, setIsFloatingUplistOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 1024;
    return true;
  });

  const [isHeaderOpen, setIsHeaderOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEADER);
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });

  // Draggable position — default bottom-right
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const p = JSON.parse(saved);
        return {
          x: Math.max(0, Math.min(p.x, window.innerWidth - 140)),
          y: Math.max(0, Math.min(p.y, window.innerHeight - 50)),
        };
      }
    } catch {}
    return {
      x: typeof window !== "undefined" ? window.innerWidth - 150 : 900,
      y: typeof window !== "undefined" ? window.innerHeight - 72 : 600,
    };
  });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);
  const floatingRef = useRef(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  const onPointerDown = useCallback((e) => {
    if (!e.target.closest("#drag-handle")) return;
    e.preventDefault();
    dragging.current = true;
    dragMoved.current = false;
    const rect = floatingRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    dragMoved.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = floatingRef.current;
    const w = el ? el.offsetWidth : 140;
    const h = el ? el.offsetHeight : 42;
    const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, vw - w));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.current.y, vh - h));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    try { localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(posRef.current)); } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Clamp on resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.max(0, Math.min(prev.x, window.innerWidth - 140)),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - 50)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleHeader = (val) => {
    setIsHeaderOpen((prev) => {
      const next = typeof val === "boolean" ? val : !prev;
      try { localStorage.setItem(STORAGE_KEY_HEADER, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Close popup on outside click
  useEffect(() => {
    if (!isFloatingUplistOpen) return;
    const handleOutside = (e) => {
      if (!e.target.closest("#floating-display-uplist")) setIsFloatingUplistOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isFloatingUplistOpen]);

  const { theme } = useTheme();

  // Popup direction: above button if near bottom, below if near top
  const popupGoesUp = pos.y > 220;

  return (
    <div className="flex flex-col h-screen bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] relative transition-colors duration-300 overflow-hidden">
      {/* Background Image */}
      {theme?.bgType === "image" && theme?.bgImage && (
        <div
          className="fixed inset-0 w-full h-full bg-cover bg-center z-0 pointer-events-none transition-opacity duration-500"
          style={{ backgroundImage: `url(${theme.bgImage})`, opacity: "var(--app-bg-opacity, 0.75)" }}
        />
      )}

      {/* Background Video */}
      {theme?.bgType === "video" && theme?.bgVideo && (
        <video
          src={theme.bgVideo}
          autoPlay loop muted playsInline
          onTimeUpdate={(e) => { if (e.target.currentTime >= 10) e.target.currentTime = 0; }}
          className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none transition-opacity duration-500"
          style={{ opacity: "var(--app-bg-opacity, 0.75)" }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Collapsible Header */}
        <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isHeaderOpen ? "max-h-[80px] opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden pointer-events-none"}`}>
          <Header
            onOpenAlerts={() => setIsAlertOpen(true)}
            alertCount={alertCount}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
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

        {/* Global Zoom Bar Modal for any image in the system */}
        <GlobalImageZoomModal />

        {/* ── Draggable Floating Display Button (always visible) ── */}
        <div
          id="floating-display-uplist"
          ref={floatingRef}
          onPointerDown={onPointerDown}
          className="fixed z-[99999] select-none"
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        >
          {/* Popup — stacks above or below */}
          <div className={`flex flex-col items-end ${popupGoesUp ? "flex-col-reverse" : "flex-col"}`}>
            {/* Popup Panel */}
            {isFloatingUplistOpen && (
              <div
                className={`w-[222px] bg-white border border-slate-200 rounded-[14px] p-2 shadow-[0_15px_50px_rgba(0,0,0,0.2)] animate-in fade-in duration-150 ${popupGoesUp ? "mb-2.5" : "mt-2.5"}`}
              >
                {/* Title */}
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">ផ្ទាំងបង្ហាញ / Display</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">Controls</span>
                </div>

                {/* Show All */}
                <button
                  type="button"
                  onClick={() => { handleToggleHeader(true); setIsSidebarOpen(true); setIsFloatingUplistOpen(false); }}
                  className="w-full h-[36px] flex items-center justify-between px-2.5 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-[8px] transition-all cursor-pointer text-xs font-semibold group"
                >
                  <div className="flex items-center gap-2">
                    <FaEye className="text-sm text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>បង្ហាញទាំង២ (Show All)</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600">✓</span>
                </button>

                {/* Hide All */}
                <button
                  type="button"
                  onClick={() => { handleToggleHeader(false); setIsSidebarOpen(false); setIsFloatingUplistOpen(false); }}
                  className="w-full h-[36px] flex items-center justify-between px-2.5 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-[8px] transition-all cursor-pointer text-xs font-semibold group"
                >
                  <div className="flex items-center gap-2">
                    <FaEyeSlash className="text-sm text-rose-500 group-hover:scale-110 transition-transform" />
                    <span>លាក់ទាំង២ (Hide Both)</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-500">✕</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* Toggle Header */}
                <button
                  type="button"
                  onClick={() => handleToggleHeader()}
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

                {/* Toggle Left Menu */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
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

            {/* Floating Button */}
            <div
              className="flex items-center rounded-full overflow-hidden shadow-xl border border-white/40"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.45)" }}
            >
              {/* Drag Handle — grab here to drag */}
              <div
                id="drag-handle"
                className="flex items-center justify-center w-8 h-9 cursor-grab active:cursor-grabbing border-r border-white/20 text-white/60 hover:text-white transition-colors"
                title="ចាប់ទៅដាក់កន្លែងណា"
              >
                <MdDragIndicator size={18} />
              </div>

              {/* Click to toggle popup */}
              <button
                type="button"
                onClick={() => {
                  if (!dragMoved.current) setIsFloatingUplistOpen((prev) => !prev);
                  dragMoved.current = false;
                }}
                className="flex items-center gap-1.5 px-3.5 h-9 text-white cursor-pointer active:opacity-80 transition-opacity"
                title="គ្រប់គ្រងផ្ទាំងបង្ហាញ"
              >
                <FaEye className="text-[11px] text-emerald-100" />
                <span className="text-xs font-extrabold tracking-wide">Display</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
