import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import json from "./Routes.json";
import Header from "../App/components/Header";
import Left from "../App/components/Left";
import Loading from "../utils/Loading";

import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";

// Dashboard
const Dashboard = lazy(() => import("../App/Dashboard/Dashboard"));

// Customer
const Customer = lazy(() => import("../App/Customer/pages/Customer"));

// Device
const Device = lazy(() => import("../App/Device/pages/Device"));

// Contract 
const Application = lazy(() => import("../App/Contract/page/Application"));
const Activated = lazy(() => import("../App/Contract/page/Activated"));
const Check = lazy(() => import("../App/Contract/page/Check"));
const Redeem = lazy(() => import("../App/Contract/page/Redeem"));
const Comments = lazy(() => import("../App/Contract/page/Comments"));
const BlackList = lazy(() => import("../App/Contract/page/BlackList"));

// Installment
const PaymentHistory = lazy(() => import("../App/Installment/pages/PaymentHistory"));

// Lostphone
const ActionLockphone = lazy(() => import("../App/Lostphone/pages/Actions"));
const LockPhone = lazy(() => import("../App/Lostphone/pages/LockPhone"));
const UnlockPhone = lazy(() => import("../App/Lostphone/pages/UnlockPhone"));

// Wallpaper
const ActionWallpaper = lazy(() => import("../App/Wallpaper/pages/Actions"));
const LockWallpaper = lazy(() => import("../App/Wallpaper/pages/LockWallpaper"));
const UnlockWallpaper = lazy(() => import("../App/Wallpaper/pages/UnlockWallpaper"));

// Settings & Profile
const ControlSystem = lazy(() => import("../App/Settings/pages/ControlSystem"));
const AllAccount = lazy(() => import("../App/Settings/pages/AllAccount"));
const Profile = lazy(() => import("../App/Profile/Profile"));

import DesktopOnlyGuard from "../components/DesktopOnlyGuard";

const MainLayout = ({ children }) => (
  <div className="flex flex-col h-screen bg-[#070913]">
    <Header />
    <div className="flex flex-1 overflow-hidden">
      <Left />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  </div>
);

const App = () => {
  return (
    <DesktopOnlyGuard>
      <Suspense fallback={<Loading />}>
        <AuthProvider>
          <LanguageProvider>
            <BrowserRouter>
            <Routes>
              {/* Sign In Route */}
              <Route path="/signin" element={<SignIn />} />

              {/* Protected System Routes */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                path={json.dashboard}
                element={
                  <ProtectRoute pagePath={json.dashboard}>
                    <MainLayout><Dashboard /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Customer */}
              <Route
                path={json.customer}
                element={
                  <ProtectRoute pagePath={json.customer}>
                    <MainLayout><Customer /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Device */}
              <Route
                path={json.device}
                element={
                  <ProtectRoute pagePath={json.device}>
                    <MainLayout><Device /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Contract */}
              <Route
                path={json.contract.application}
                element={
                  <ProtectRoute pagePath={json.contract.application}>
                    <MainLayout><Application /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.contract.activated}
                element={
                  <ProtectRoute pagePath={json.contract.activated}>
                    <MainLayout><Activated /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.contract.check}
                element={
                  <ProtectRoute pagePath={json.contract.check}>
                    <MainLayout><Check /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.contract.redeem}
                element={
                  <ProtectRoute pagePath={json.contract.redeem}>
                    <MainLayout><Redeem /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.contract.comments}
                element={
                  <ProtectRoute pagePath={json.contract.comments}>
                    <MainLayout><Comments /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.contract.blacklist}
                element={
                  <ProtectRoute pagePath={json.contract.blacklist}>
                    <MainLayout><BlackList /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Installment */}
              <Route
                path={json.installment.paymentHistory}
                element={
                  <ProtectRoute pagePath={json.installment.paymentHistory}>
                    <MainLayout><PaymentHistory /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Lostphone */}
              <Route
                path={json.lostphone.actionLockphone}
                element={
                  <ProtectRoute pagePath={json.lostphone.actionLockphone}>
                    <MainLayout><ActionLockphone /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.lostphone.lockPhone}
                element={
                  <ProtectRoute pagePath={json.lostphone.lockPhone}>
                    <MainLayout><LockPhone /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.lostphone.unlockPhone}
                element={
                  <ProtectRoute pagePath={json.lostphone.unlockPhone}>
                    <MainLayout><UnlockPhone /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Wallpaper */}
              <Route
                path={json.wallpaper.actionWallpaper}
                element={
                  <ProtectRoute pagePath={json.wallpaper.actionWallpaper}>
                    <MainLayout><ActionWallpaper /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.wallpaper.lockWallpaper}
                element={
                  <ProtectRoute pagePath={json.wallpaper.lockWallpaper}>
                    <MainLayout><LockWallpaper /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.wallpaper.unlockWallpaper}
                element={
                  <ProtectRoute pagePath={json.wallpaper.unlockWallpaper}>
                    <MainLayout><UnlockWallpaper /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Settings */}
              <Route
                path="/settings/all-account"
                element={
                  <ProtectRoute pagePath="/settings/all-account">
                    <MainLayout><AllAccount /></MainLayout>
                  </ProtectRoute>
                }
              />
              <Route
                path={json.settings.controlSystem}
                element={
                  <ProtectRoute pagePath={json.settings.controlSystem}>
                    <MainLayout><ControlSystem /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Profile */}
              <Route
                path="/profile"
                element={
                  <ProtectRoute pagePath="/profile">
                    <MainLayout><Profile /></MainLayout>
                  </ProtectRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </Suspense>
    </DesktopOnlyGuard>
  );
};

export default App;
