import React, { lazy, Suspense } from "react";
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

// Report
import Report from "../App/Report/pages/Report";

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

const MainLayout = ({ children }) => (
  <div className="flex flex-col h-screen bg-[#f4f6f8]">
    <Header />
    <div className="flex flex-1 overflow-hidden">
      <Left />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

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
                  {/* Report Droplist Sub-Routes */}
                  <Route path="/report" element={<Navigate to="/report/all-customers" replace />} />
                  <Route path={json.report?.allCustomers || '/report/all-customers'} element={<ProtectRoute pagePath={json.report?.allCustomers || '/report/all-customers'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
                  <Route path={json.report?.activated || '/report/activated'} element={<ProtectRoute pagePath={json.report?.activated || '/report/activated'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
                  <Route path={json.report?.redeem || '/report/redeem'} element={<ProtectRoute pagePath={json.report?.redeem || '/report/redeem'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
                  <Route path={json.report?.lockPhone || '/report/lock-phone'} element={<ProtectRoute pagePath={json.report?.lockPhone || '/report/lock-phone'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
                  <Route path={json.report?.setWallpaper || '/report/set-wallpaper'} element={<ProtectRoute pagePath={json.report?.setWallpaper || '/report/set-wallpaper'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
                  <Route path={json.report?.installment || '/report/installment'} element={<ProtectRoute pagePath={json.report?.installment || '/report/installment'}> <MainLayout><Report /></MainLayout> </ProtectRoute>} />
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
                  <Route path={json.history?.loginHistory || '/history/login-history'} element={<ProtectRoute pagePath={json.history?.loginHistory || '/history/login-history'}> <MainLayout><LoginHistory /></MainLayout> </ProtectRoute>} />
                  <Route path={json.history?.deviceHistory || '/history/device-history'} element={<ProtectRoute pagePath={json.history?.deviceHistory || '/history/device-history'}> <MainLayout><DeviceActionHistory /></MainLayout> </ProtectRoute>} />

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
