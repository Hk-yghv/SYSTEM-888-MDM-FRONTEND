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

const STORAGE_KEY_POS = "floatingDisplayDockPos";
const STORAGE_KEY_HEADER = "isHeaderOpen";

const MainLayout = ({ children }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [isFloatingUplistOpen, setIsFloatingUplistOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Docked position — defaults to left edge, strictly docks to left or right browser edges
  const [dockPos, setDockPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const p = JSON.parse(saved);
        return {
          side: p.side === "right" ? "right" : "left",
          y: typeof p.y === "number" ? Math.max(20, Math.min(p.y, window.innerHeight - 70)) : 350,
        };
      }
    } catch {}
    return {
      side: isHeaderOpen ? "left" : "right",
      y: typeof window !== "undefined" ? Math.round(window.innerHeight * 0.65) : 350,
    };
  });

  const dragging = useRef(false);
  const dragOffsetY = useRef(0);
  const dragMoved = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const floatingRef = useRef(null);
  const dockPosRef = useRef(dockPos);
  dockPosRef.current = dockPos;

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragMoved.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    const rect = floatingRef.current?.getBoundingClientRect();
    dragOffsetY.current = rect ? e.clientY - rect.top : 18;
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = Math.abs(e.clientX - startX.current);
    const dy = Math.abs(e.clientY - startY.current);
    if (dx > 4 || dy > 4) {
      dragMoved.current = true;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = floatingRef.current;
    const h = el ? el.offsetHeight : 38;

    // Up/down tracking along edge
    const newY = Math.max(20, Math.min(e.clientY - dragOffsetY.current, vh - h - 20));

    // Left/right edge snap: strictly snaps to browser side (left or right), never floats in middle
    const newSide = e.clientX < vw / 2 ? "left" : "right";

    setDockPos({ side: newSide, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    try { localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(dockPosRef.current)); } catch {}
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
      setDockPos((prev) => ({
        ...prev,
        y: Math.max(20, Math.min(prev.y, window.innerHeight - 60)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleHeader = (val) => {
    const next = typeof val === "boolean" ? val : !isHeaderOpen;
    setIsHeaderOpen(next);
    try { localStorage.setItem(STORAGE_KEY_HEADER, JSON.stringify(next)); } catch {}
    if (isHeaderOpen && !next) {
      setDockPos((current) => {
        const nextPos = { ...current, side: "right" };
        try { localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(nextPos)); } catch {}
        return nextPos;
      });
    }
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

  // Smart popup positioning: auto-detect collision so popup never goes off-screen
  const popupGoesUp = typeof window !== "undefined"
    ? dockPos.y + 260 > window.innerHeight && dockPos.y >= 210
    : dockPos.y > 220;

  const isLeftSide = dockPos.side === "left";
  const shouldHideContent = (!isHeaderOpen || !isSidebarOpen) && !isHovered && !isFloatingUplistOpen;

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

        {/* ── Draggable Floating Display Button (docked to browser edge) ── */}
        <div
          id="floating-display-uplist"
          ref={floatingRef}
          onPointerDown={onPointerDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed z-[99999] select-none flex items-center transition-[top] duration-75 ease-out"
          style={{
            top: dockPos.y,
            ...(isLeftSide ? { left: 0, right: "auto" } : { right: 0, left: "auto" }),
            touchAction: "none",
          }}
        >
          {/* Floating Button Pill - Docked flush to the browser edge */}
          <div
            onClick={() => {
              if (!dragMoved.current) setIsFloatingUplistOpen((prev) => !prev);
              dragMoved.current = false;
            }}
            className={`flex items-center overflow-hidden shadow-xl cursor-pointer active:scale-[0.98] transition-all duration-200 ${
              isLeftSide
                ? "rounded-r-2xl rounded-l-none border-y border-r border-white/40"
                : "rounded-l-2xl rounded-r-none border-y border-l border-white/40 flex-row-reverse"
            }`}
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              boxShadow: "0 4px 20px rgba(16,185,129,0.45)",
            }}
            title={shouldHideContent ? "Display" : "គ្រប់គ្រងផ្ទាំងបង្ហាញ"}
          >
            {/* Drag Handle */}
            <div
              id="drag-handle"
              className="flex items-center justify-center w-7 h-9 cursor-grab active:cursor-grabbing text-white/70 hover:text-white transition-colors flex-shrink-0"
              title="អូសឡើងចុះ ឬឆ្វេងស្តាំ"
            >
              <MdDragIndicator size={18} />
            </div>

            {/* Eye icon + "Display" text — auto-hidden when header and leftMenu are visible */}
            <div
              className={`flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${
                shouldHideContent
                  ? "max-w-0 opacity-0 px-0 pointer-events-none"
                  : isLeftSide
                  ? "max-w-[130px] opacity-100 pr-3.5 pl-0.5"
                  : "max-w-[130px] opacity-100 pl-3.5 pr-0.5"
              }`}
            >
              <FaEye className="text-[11px] text-emerald-100 flex-shrink-0" />
              <span className="text-xs font-extrabold tracking-wide text-white whitespace-nowrap">Display</span>
            </div>
          </div>

          {/* Absolute Popup Panel */}
          {isFloatingUplistOpen && (
            <div
              className="absolute w-[222px] bg-white border border-slate-200 rounded-[14px] p-2 shadow-[0_15px_50px_rgba(0,0,0,0.22)] animate-in fade-in duration-150 z-50 pointer-events-auto"
              style={{
                ...(popupGoesUp
                  ? { bottom: "calc(100% + 8px)", top: "auto" }
                  : { top: "calc(100% + 8px)", bottom: "auto" }),
                ...(isLeftSide
                  ? { left: 8, right: "auto" }
                  : { right: 8, left: "auto" }),
              }}
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
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
