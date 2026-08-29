import React, { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import json from "./Routes.json";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import Loading from "../utils/Loading";

import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
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
import Profile from "../App/Profile/Profile";

import DesktopOnlyGuard from "../components/DesktopOnlyGuard";
import AIAssistantDrawer from "../components/AIAssistantDrawer";

const MainLayout = ({ children }) => {
  const [isAIOpen, setIsAIOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#f4f6f8] relative">
      <Header onOpenAI={() => setIsAIOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Left />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
      <AIAssistantDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
};


const App = () => {
  return (
    <DesktopOnlyGuard>
      <Suspense fallback={<Loading />}>
        <ThemeProvider>
          <AuthProvider>
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
                  <Route path={json.settings.profile} element={<ProtectRoute pagePath={json.settings.profile}> <MainLayout><Profile /></MainLayout> </ProtectRoute>} />

                  {/* Fallback */}
                  <Route path={json.start} element={<Navigate to={json.dashboard} replace />} />
                </Routes>
              </BrowserRouter>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </Suspense>
    </DesktopOnlyGuard>
  );
};

export default App;
