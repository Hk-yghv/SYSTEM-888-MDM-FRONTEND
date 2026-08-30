import React, { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import json from "./Routes.json";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import Loading from "../utils/Loading";

import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";

// Dashboard);
import Dashboard from "../App/Dashboard/Dashboard";

// Customer
import Customer from "../App/Customer/pages/Customer";

// Device
import Device from "../App/Device/pages/Device";

// Report Pages (each sub-route has its own dedicated component)
import AllCustomersReport from "../App/Report/pages/AllCustomersReport";
import ReportAll from "../App/Report/pages/ReportAll";
import ActivatedReport from "../App/Report/pages/ActivatedReport";
import RedeemReport from "../App/Report/pages/RedeemReport";
import LockPhoneReport from "../App/Report/pages/LockPhoneReport";
import SetWallpaperReport from "../App/Report/pages/SetWallpaperReport";
import InstallmentReport from "../App/Report/pages/InstallmentReport";

// Contract 
import Application from "../App/Contract/page/Application";
import Activated from "../App/Contract/page/Activated";
import Check from "../App/Contract/page/Check";
import Redeem from "../App/Contract/page/Redeem";
import Comments from "../App/Contract/page/Comments";
import BlackList from "../App/Contract/page/BlackList";

// Installment
import PaymentHistory from "../App/Installment/pages/PaymentHistory";
import CashOutPage from "../App/Installment/pages/CashOutPage";
import CashInPage from "../App/Installment/pages/CashInPage";

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


// Settings & Profile
import ControlSystem from "../App/Settings/pages/ControlSystem";
import AllAccount from "../App/Settings/pages/AllAccount";
import Personalization from "../App/Settings/pages/Personalization";
import Profile from "../App/Profile/Profile";

import DesktopOnlyGuard from "../components/DesktopOnlyGuard";
import PaymentAlertDrawer from "../components/PaymentAlertDrawer";

const MainLayout = ({ children }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const { theme } = useTheme();

  return (
    <div
      className="flex flex-col h-screen bg-[var(--app-bg,#f4f6f8)] text-[var(--app-text,#0f172a)] relative transition-colors duration-300 overflow-hidden"
      style={
        theme?.bgType === 'image' && theme?.bgImage
          ? { backgroundImage: `url(${theme.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {}
      }
    >
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
          style={{ opacity: 'var(--app-bg-opacity, 0.65)' }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <Header onOpenAlerts={() => setIsAlertOpen(true)} alertCount={alertCount} />
        <div className="flex flex-1 overflow-hidden">
          <Left />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
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


const App = () => {
  return (
    <DesktopOnlyGuard>
      <Suspense fallback={<Loading />}>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <BrowserRouter>
                <Routes>
                  {/* Sign In Route */}
                  <Route path={json.signin} element={<SignIn />} />
                  {/* Protected System Routes */}
                  <Route path={json.start} element={<Navigate to={json.dashboard} replace />} />
                  <Route path={json.dashboard} element={<ProtectRoute pagePath={json.dashboard}> <MainLayout><Dashboard /></MainLayout> </ProtectRoute>} />
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
                  {/* Contract */}
                  <Route path={json.contract.application} element={<ProtectRoute pagePath={json.contract.application}> <MainLayout><Application /></MainLayout> </ProtectRoute>} />
                  <Route path={json.contract.activated} element={<ProtectRoute pagePath={json.contract.activated}> <MainLayout><Activated /></MainLayout> </ProtectRoute>} />
                  <Route path={json.contract.check} element={<ProtectRoute pagePath={json.contract.check}> <MainLayout><Check /></MainLayout> </ProtectRoute>} />
                  <Route path={json.contract.redeem} element={<ProtectRoute pagePath={json.contract.redeem}> <MainLayout><Redeem /></MainLayout> </ProtectRoute>} />
                  <Route path={json.contract.comments} element={<ProtectRoute pagePath={json.contract.comments}> <MainLayout><Comments /></MainLayout> </ProtectRoute>} />
                  <Route path={json.contract.blacklist} element={<ProtectRoute pagePath={json.contract.blacklist}> <MainLayout><BlackList /></MainLayout> </ProtectRoute>} />
                  {/* Installment */}
                  <Route path={json.installment.paymentHistory} element={<ProtectRoute pagePath={json.installment.paymentHistory}> <MainLayout><PaymentHistory /></MainLayout> </ProtectRoute>} />
                  <Route path={json.installment.cashOut} element={<ProtectRoute pagePath={json.installment.cashOut}> <MainLayout><CashOutPage /></MainLayout> </ProtectRoute>} />
                  <Route path={json.installment.cashIn} element={<ProtectRoute pagePath={json.installment.cashIn}> <MainLayout><CashInPage /></MainLayout> </ProtectRoute>} />
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

                  {/* Settings */}
                  <Route path={json.settings.allAccount} element={<ProtectRoute pagePath={json.settings.allAccount}><MainLayout><AllAccount /></MainLayout></ProtectRoute>} />
                  <Route path={json.settings.controlSystem} element={<ProtectRoute pagePath={json.settings.controlSystem}><MainLayout><ControlSystem /></MainLayout></ProtectRoute>} />
                  <Route path={json.settings.personalization} element={<MainLayout><Personalization /></MainLayout>} />
                  <Route path={json.settings.profile} element={<ProtectRoute pagePath={json.settings.profile}> <MainLayout><Profile /></MainLayout> </ProtectRoute>} />

                  {/* Fallback */}
                  <Route path={json.start} element={<Navigate to={json.dashboard} replace />} />
                </Routes>
              </BrowserRouter>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </Suspense>
    </DesktopOnlyGuard>
  );
};

export default App;
