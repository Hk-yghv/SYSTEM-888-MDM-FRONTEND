import React, { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./index.css";

import json from "./Routes.json";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import Loading from "../utils/Loading";

import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";
import { getFirstAllowedRoute } from "../utils/permissionUtils";
import MobileBottomNav from "../components/MobileBottomNav";
import MobileResponsiveContent from "../components/MobileResponsiveContent";

// Dashboard);
import Dashboard from "../App/Dashboard/Dashboard";

// Customer
import Customer from "../App/Customer/pages/Customer";

// Device
import Device from "../App/Device/pages/Device";
import KhmerCalendarPage from "../App/Calendar/KhmerCalendarPage";

// Report Pages (each sub-route has its own dedicated component)
import AllCustomersReport from "../App/Report/pages/AllCustomersReport";
import ReportAll from "../App/Report/pages/ReportAll";
import ActivatedReport from "../App/Report/pages/ActivatedReport";
import RedeemReport from "../App/Report/pages/RedeemReport";
import LockPhoneReport from "../App/Report/pages/LockPhoneReport";
import SetWallpaperReport from "../App/Report/pages/SetWallpaperReport";
import InstallmentReport from "../App/Report/pages/InstallmentReport";
import FollowUpReport from "../App/Report/pages/FollowUpReport";

// Contract 
import Application from "../App/Contract/page/Application";
import Activated from "../App/Contract/page/Activated";
import Check from "../App/Contract/page/Check";
import Redeem from "../App/Contract/page/Redeem";
import Comments from "../App/Contract/page/Comments";
import BlackList from "../App/Contract/page/BlackList";

// Installment
import InstallmentPage from "../App/Installment/pages/InstallmentPage";
import InstallmentHistory from "../App/Installment/pages/InstallmentHistory";
import PaymentHistory from "../App/Installment/pages/PaymentHistory";
import CashOutPage from "../App/Installment/pages/CashOutPage";
import CashInPage from "../App/Installment/pages/CashInPage";
import PenaltyPage from "../App/Installment/pages/PenaltyPage";
import OverduePage from "../App/Installment/pages/OverduePage";
import DueTodayPage from "../App/Installment/pages/DueTodayPage";
import DueIn3DaysPage from "../App/Installment/pages/DueIn3DaysPage";
import Overdue3DaysPage from "../App/Installment/pages/Overdue3DaysPage";
import UnpaidYesterdayPage from "../App/Installment/pages/UnpaidYesterdayPage";
import Overdue7DaysPage from "../App/Installment/pages/Overdue7DaysPage";

// Lostphone
import ActionLockphone from "../App/Lostphone/pages/Actions";
import LockPhone from "../App/Lostphone/pages/LockPhone";
import UnlockPhone from "../App/Lostphone/pages/UnlockPhone";

// Wallpaper
import ActionWallpaper from "../App/Wallpaper/pages/Actions";
import LockWallpaper from "../App/Wallpaper/pages/LockWallpaper";
import UnlockWallpaper from "../App/Wallpaper/pages/UnlockWallpaper";

// History
import LoginHistory from "../App/History/pages/LoginHistory";
import DeviceActionHistory from "../App/History/pages/DeviceActionHistory";

// Calculate
import CalculateSchedule1 from "../App/Calculate/pages/CalculateSchedule1";
import CalculateSchedule2 from "../App/Calculate/pages/CalculateSchedule2";

// Follow Up
import FollowUp1 from "../App/FollowUp/pages/FollowUp1";
import FollowUp2 from "../App/FollowUp/pages/FollowUp2";
import FollowUp3 from "../App/FollowUp/pages/FollowUp3";
import FollowUp4 from "../App/FollowUp/pages/FollowUp4";

// Salary
import SalaryPage from "../App/Salary/pages/SalaryPage";

// Settings & Profile
import ControlSystem from "../App/Settings/pages/ControlSystem";
import AllAccount from "../App/Settings/pages/AllAccount";
import Profile from "../App/Profile/Profile";

// import DesktopOnlyGuard from "../components/DesktopOnlyGuard";
import PaymentAlertDrawer from "../components/PaymentAlertDrawer";

const MainLayout = ({ children }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const { theme } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] relative transition-colors duration-300 overflow-hidden">
      {/* Background Image Layer (Fixed Fullscreen Backdrop) */}
      {theme?.bgType === 'image' && theme?.bgImage && (
        <div
          className="fixed inset-0 w-full h-full bg-cover bg-center z-0 pointer-events-none transition-opacity duration-500"
          style={{
            backgroundImage: `url(${theme.bgImage})`,
            opacity: 'var(--app-bg-opacity, 0.75)'
          }}
        />
      )}

      {/* Background Video Player (Capped to 10 Seconds Loop) */}
      {theme?.bgType === 'video' && theme?.bgVideo && (
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
          style={{ opacity: 'var(--app-bg-opacity, 0.75)' }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <Header
          onOpenAlerts={() => setIsAlertOpen(true)}
          alertCount={alertCount}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((isOpen) => !isOpen)}
        />
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`mobile-sidebar-backdrop ${isSidebarOpen ? 'mobile-sidebar-backdrop-open' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <Left
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            collapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebarCollapse}
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
      </div>
    </div>
  );
};


const RootRedirect = () => {
  const { user, hasPermission } = useAuth();
  const targetRoute = getFirstAllowedRoute(user, hasPermission);
  return <Navigate to={targetRoute} replace />;
};

const App = () => {
  return (
    // <DesktopOnlyGuard>
    <Suspense fallback={<Loading />}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <BrowserRouter>
              <Routes>
                {/* Sign In Route */}
                <Route path={json.signin} element={<SignIn />} />
                {/* Protected System Routes */}
                <Route path={json.start} element={<RootRedirect />} />
                <Route path={json.dashboard} element={<ProtectRoute pagePath={json.dashboard}> <MainLayout><Dashboard /></MainLayout> </ProtectRoute>} />
                <Route path={json.calendar || '/calendar'} element={<ProtectRoute pagePath={json.calendar || '/calendar'}> <MainLayout><KhmerCalendarPage /></MainLayout> </ProtectRoute>} />
                {/* Customer */}
                <Route path={json.customer} element={<ProtectRoute pagePath={json.customer}> <MainLayout><Customer /></MainLayout> </ProtectRoute>} />
                {/* Device */}
                <Route path={json.device} element={<ProtectRoute pagePath={json.device}> <MainLayout><Device /></MainLayout> </ProtectRoute>} />
                {/* Report Droplist Sub-Routes — each page is its own dedicated component */}
                <Route path={json.report.report} element={<Navigate to={json.report.allCustomers} replace />} />
                <Route path={json.report?.allCustomers} element={<ProtectRoute pagePath={json.report?.allCustomers}> <MainLayout><AllCustomersReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.reportAll} element={<ProtectRoute pagePath={json.report?.reportAll}> <MainLayout><ReportAll /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.activated} element={<ProtectRoute pagePath={json.report?.activated}> <MainLayout><ActivatedReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.redeem} element={<ProtectRoute pagePath={json.report?.redeem}> <MainLayout><RedeemReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.lockPhone} element={<ProtectRoute pagePath={json.report?.lockPhone}> <MainLayout><LockPhoneReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.setWallpaper} element={<ProtectRoute pagePath={json.report?.setWallpaper}> <MainLayout><SetWallpaperReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.installment} element={<ProtectRoute pagePath={json.report?.installment}> <MainLayout><InstallmentReport /></MainLayout> </ProtectRoute>} />
                <Route path={json.report?.followUpReport || '/report/follow-up'} element={<ProtectRoute pagePath={json.report?.followUpReport || '/report/follow-up'}> <MainLayout><FollowUpReport /></MainLayout> </ProtectRoute>} />
                <Route path="/follow-up/report" element={<ProtectRoute pagePath={json.report?.followUpReport || '/report/follow-up'}> <MainLayout><FollowUpReport /></MainLayout> </ProtectRoute>} />
                {/* Contract */}
                <Route path={json.contract.application} element={<ProtectRoute pagePath={json.contract.application}> <MainLayout><Application /></MainLayout> </ProtectRoute>} />
                <Route path={json.contract.activated} element={<ProtectRoute pagePath={json.contract.activated}> <MainLayout><Activated /></MainLayout> </ProtectRoute>} />
                <Route path={json.contract.check} element={<ProtectRoute pagePath={json.contract.check}> <MainLayout><Check /></MainLayout> </ProtectRoute>} />
                <Route path={json.contract.redeem} element={<ProtectRoute pagePath={json.contract.redeem}> <MainLayout><Redeem /></MainLayout> </ProtectRoute>} />
                <Route path={json.contract.comments} element={<ProtectRoute pagePath={json.contract.comments}> <MainLayout><Comments /></MainLayout> </ProtectRoute>} />
                <Route path={json.contract.blacklist} element={<ProtectRoute pagePath={json.contract.blacklist}> <MainLayout><BlackList /></MainLayout> </ProtectRoute>} />
                {/* Calculate */}
                <Route path={json.calculate?.calculateSchedule1 || '/calculate/schedule-1'} element={<ProtectRoute pagePath={json.calculate?.calculateSchedule1 || '/calculate/schedule-1'}> <MainLayout><CalculateSchedule1 /></MainLayout> </ProtectRoute>} />
                <Route path={json.calculate?.calculateSchedule2 || '/calculate/schedule-2'} element={<ProtectRoute pagePath={json.calculate?.calculateSchedule2 || '/calculate/schedule-2'}> <MainLayout><CalculateSchedule2 /></MainLayout> </ProtectRoute>} />
                {/* Installment */}
                <Route path={json.installment.installmentPage} element={<ProtectRoute pagePath={json.installment.installmentPage}> <MainLayout><InstallmentPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.installmentPad} element={<ProtectRoute pagePath={json.installment.installmentPad}><MainLayout><InstallmentHistory mode="pad" /></MainLayout></ProtectRoute>} />
                <Route path={json.installment.installmentHistory} element={<ProtectRoute pagePath={json.installment.installmentHistory}> <MainLayout><InstallmentHistory /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.paymentHistory} element={<ProtectRoute pagePath={json.installment.paymentHistory}> <MainLayout><PaymentHistory /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.cashOut} element={<ProtectRoute pagePath={json.installment.cashOut}> <MainLayout><CashOutPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.cashIn} element={<ProtectRoute pagePath={json.installment.cashIn}> <MainLayout><CashInPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.penalty} element={<ProtectRoute pagePath={json.installment.penalty}> <MainLayout><PenaltyPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.overdue} element={<ProtectRoute pagePath={json.installment.overdue}> <MainLayout><OverduePage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.dueToday} element={<ProtectRoute pagePath={json.installment.dueToday}> <MainLayout><DueTodayPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.dueIn3Days} element={<ProtectRoute pagePath={json.installment.dueIn3Days}> <MainLayout><DueIn3DaysPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.overdue3Days} element={<ProtectRoute pagePath={json.installment.overdue3Days}> <MainLayout><Overdue3DaysPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.unpaidYesterday} element={<ProtectRoute pagePath={json.installment.unpaidYesterday}> <MainLayout><UnpaidYesterdayPage /></MainLayout> </ProtectRoute>} />
                <Route path={json.installment.overdue7Days} element={<ProtectRoute pagePath={json.installment.overdue7Days}> <MainLayout><Overdue7DaysPage /></MainLayout> </ProtectRoute>} />
                {/* Lostphone */}
                <Route path={json.lostphone.actionLockphone} element={<ProtectRoute pagePath={json.lostphone.actionLockphone}> <MainLayout><ActionLockphone /></MainLayout> </ProtectRoute>} />
                <Route path={json.lostphone.lockPhone} element={<ProtectRoute pagePath={json.lostphone.lockPhone}> <MainLayout><LockPhone /></MainLayout> </ProtectRoute>} />
                <Route path={json.lostphone.unlockPhone} element={<ProtectRoute pagePath={json.lostphone.unlockPhone}> <MainLayout><UnlockPhone /></MainLayout> </ProtectRoute>} />
                {/* Wallpaper */}
                <Route path={json.wallpaper.actionWallpaper} element={<ProtectRoute pagePath={json.wallpaper.actionWallpaper}> <MainLayout><ActionWallpaper /></MainLayout> </ProtectRoute>} />
                <Route path={json.wallpaper.lockWallpaper} element={<ProtectRoute pagePath={json.wallpaper.lockWallpaper}> <MainLayout><LockWallpaper /></MainLayout> </ProtectRoute>} />
                <Route path={json.wallpaper.unlockWallpaper} element={<ProtectRoute pagePath={json.wallpaper.unlockWallpaper}> <MainLayout><UnlockWallpaper /></MainLayout> </ProtectRoute>} />
                {/* History */}
                <Route path={json.history?.loginHistory} element={<ProtectRoute pagePath={json.history?.loginHistory}> <MainLayout><LoginHistory /></MainLayout> </ProtectRoute>} />
                <Route path={json.history?.deviceHistory} element={<ProtectRoute pagePath={json.history?.deviceHistory}> <MainLayout><DeviceActionHistory /></MainLayout> </ProtectRoute>} />

                {/* Follow Up */}
                <Route path={json.followUp?.followUp1 || '/follow-up/follow-up-1'} element={<ProtectRoute pagePath={json.followUp?.followUp1 || '/follow-up/follow-up-1'}> <MainLayout><FollowUp1 /></MainLayout> </ProtectRoute>} />
                <Route path={json.followUp?.followUp2 || '/follow-up/follow-up-2'} element={<ProtectRoute pagePath={json.followUp?.followUp2 || '/follow-up/follow-up-2'}> <MainLayout><FollowUp2 /></MainLayout> </ProtectRoute>} />
                <Route path={json.followUp?.followUp3 || '/follow-up/follow-up-3'} element={<ProtectRoute pagePath={json.followUp?.followUp3 || '/follow-up/follow-up-3'}> <MainLayout><FollowUp3 /></MainLayout> </ProtectRoute>} />
                <Route path={json.followUp?.followUp4 || '/follow-up/follow-up-4'} element={<ProtectRoute pagePath={json.followUp?.followUp4 || '/follow-up/follow-up-4'}> <MainLayout><FollowUp4 /></MainLayout> </ProtectRoute>} />
                <Route path="/follow-up/sen-sok" element={<ProtectRoute pagePath="/follow-up/follow-up-3"> <MainLayout><FollowUp3 /></MainLayout> </ProtectRoute>} />

                {/* Salary */}
                <Route path={json.salary || '/salary'} element={<ProtectRoute pagePath={json.salary || '/salary'}> <MainLayout><SalaryPage /></MainLayout> </ProtectRoute>} />

                {/* Settings */}
                <Route path={json.settings.allAccount} element={<ProtectRoute pagePath={json.settings.allAccount}><MainLayout><AllAccount /></MainLayout></ProtectRoute>} />
                <Route path={json.settings.controlSystem} element={<ProtectRoute pagePath={json.settings.controlSystem}><MainLayout><ControlSystem /></MainLayout></ProtectRoute>} />
                <Route path={json.settings.profile} element={<ProtectRoute pagePath={json.settings.profile}> <MainLayout><Profile /></MainLayout> </ProtectRoute>} />

                {/* Fallback */}
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </Suspense>
    // </DesktopOnlyGuard>
  );
};

export default App;
