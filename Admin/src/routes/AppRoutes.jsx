import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import json from "./Routes.json";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";
import MainLayout from "./MainLayout";
import { useAuth } from "../context/AuthContext";
import { getFirstAllowedRoute } from "../utils/permissionUtils";

// Dashboard & Calendar
import Dashboard from "../App/Dashboard/Dashboard";
import KhmerCalendarPage from "../App/Calendar/KhmerCalendarPage";
import TelegramPage from "../App/Telegram/TelegramPage";

// Customer & Device
import Customer from "../App/Customer/pages/Customer";
import Device from "../App/Device/pages/Device";

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

// Report Pages
import AllCustomersReport from "../App/Report/pages/AllCustomersReport";
import ReportAll from "../App/Report/pages/ReportAll";
import ActivatedReport from "../App/Report/pages/ActivatedReport";
import RedeemReport from "../App/Report/pages/RedeemReport";
import LockPhoneReport from "../App/Report/pages/LockPhoneReport";
import SetWallpaperReport from "../App/Report/pages/SetWallpaperReport";
import InstallmentReport from "../App/Report/pages/InstallmentReport";
import FollowUpReport from "../App/Report/pages/FollowUpReport";

// Wallpaper
import ActionWallpaper from "../App/Wallpaper/pages/Actions";
import LockWallpaper from "../App/Wallpaper/pages/LockWallpaper";
import UnlockWallpaper from "../App/Wallpaper/pages/UnlockWallpaper";

// Lost Phone
import ActionLockphone from "../App/Lostphone/pages/Actions";
import LockPhone from "../App/Lostphone/pages/LockPhone";
import UnlockPhone from "../App/Lostphone/pages/UnlockPhone";

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

/**
 * Redirect root or unauthenticated users to their first permitted page
 */
export const RootRedirect = () => {
  const { user, hasPermission } = useAuth();
  const targetRoute = getFirstAllowedRoute(user, hasPermission);
  return <Navigate to={targetRoute} replace />;
};

/**
 * Route wrapper helper to keep route declaration concise
 */
const renderProtected = (pagePath, Component, props = {}) => (
  <ProtectRoute pagePath={pagePath}>
    <MainLayout>
      <Component {...props} />
    </MainLayout>
  </ProtectRoute>
);

const AppRoutes = () => {
  return (
    <Routes>
      {/* Sign In Route */}
      <Route path={json.signin} element={<SignIn />} />

      {/* Root Entry & Dashboard */}
      <Route path={json.start} element={<RootRedirect />} />
      <Route path={json.dashboard} element={renderProtected(json.dashboard, Dashboard)} />
      <Route path={json.calendar || "/calendar"} element={renderProtected(json.calendar || "/calendar", KhmerCalendarPage)} />
      <Route path={json.telegram || "/telegram"} element={renderProtected(json.telegram || "/telegram", TelegramPage)} />

      {/* Customer & Device */}
      <Route path={json.customer} element={renderProtected(json.customer, Customer)} />
      <Route path={json.device} element={renderProtected(json.device, Device)} />

      {/* Contracts */}
      <Route path={json.contract.application} element={renderProtected(json.contract.application, Application)} />
      <Route path={json.contract.activated} element={renderProtected(json.contract.activated, Activated)} />
      <Route path={json.contract.check} element={renderProtected(json.contract.check, Check)} />
      <Route path={json.contract.redeem} element={renderProtected(json.contract.redeem, Redeem)} />
      <Route path={json.contract.comments} element={renderProtected(json.contract.comments, Comments)} />
      <Route path={json.contract.blacklist} element={renderProtected(json.contract.blacklist, BlackList)} />

      {/* Installment & Repayment Schedules */}
      <Route path={json.installment.installmentPage} element={renderProtected(json.installment.installmentPage, InstallmentPage)} />
      <Route path={json.installment.installmentPad} element={renderProtected(json.installment.installmentPad, InstallmentHistory, { mode: "pad" })} />
      <Route path={json.installment.installmentHistory} element={renderProtected(json.installment.installmentHistory, InstallmentHistory)} />
      <Route path={json.installment.paymentHistory} element={renderProtected(json.installment.paymentHistory, PaymentHistory)} />
      <Route path={json.installment.cashOut} element={renderProtected(json.installment.cashOut, CashOutPage)} />
      <Route path={json.installment.cashIn} element={renderProtected(json.installment.cashIn, CashInPage)} />
      <Route path={json.installment.penalty} element={renderProtected(json.installment.penalty, PenaltyPage)} />
      <Route path={json.installment.overdue} element={renderProtected(json.installment.overdue, OverduePage)} />
      <Route path={json.installment.dueToday} element={renderProtected(json.installment.dueToday, DueTodayPage)} />
      <Route path={json.installment.dueIn3Days} element={renderProtected(json.installment.dueIn3Days, DueIn3DaysPage)} />
      <Route path={json.installment.overdue3Days} element={renderProtected(json.installment.overdue3Days, Overdue3DaysPage)} />
      <Route path={json.installment.unpaidYesterday} element={renderProtected(json.installment.unpaidYesterday, UnpaidYesterdayPage)} />
      <Route path={json.installment.overdue7Days} element={renderProtected(json.installment.overdue7Days, Overdue7DaysPage)} />

      {/* Reports */}
      <Route path={json.report.report} element={<Navigate to={json.report.allCustomers} replace />} />
      <Route path={json.report?.allCustomers} element={renderProtected(json.report?.allCustomers, AllCustomersReport)} />
      <Route path={json.report?.reportAll} element={renderProtected(json.report?.reportAll, ReportAll)} />
      <Route path={json.report?.activated} element={renderProtected(json.report?.activated, ActivatedReport)} />
      <Route path={json.report?.redeem} element={renderProtected(json.report?.redeem, RedeemReport)} />
      <Route path={json.report?.lockPhone} element={renderProtected(json.report?.lockPhone, LockPhoneReport)} />
      <Route path={json.report?.setWallpaper} element={renderProtected(json.report?.setWallpaper, SetWallpaperReport)} />
      <Route path={json.report?.installment} element={renderProtected(json.report?.installment, InstallmentReport)} />
      <Route path={json.report?.followUpReport || "/report/follow-up"} element={renderProtected(json.report?.followUpReport || "/report/follow-up", FollowUpReport)} />
      <Route path="/follow-up/report" element={renderProtected(json.report?.followUpReport || "/report/follow-up", FollowUpReport)} />

      {/* Wallpaper */}
      <Route path={json.wallpaper.actionWallpaper} element={renderProtected(json.wallpaper.actionWallpaper, ActionWallpaper)} />
      <Route path={json.wallpaper.lockWallpaper} element={renderProtected(json.wallpaper.lockWallpaper, LockWallpaper)} />
      <Route path={json.wallpaper.unlockWallpaper} element={renderProtected(json.wallpaper.unlockWallpaper, UnlockWallpaper)} />

      {/* Lost Phone */}
      <Route path={json.lostphone.actionLockphone} element={renderProtected(json.lostphone.actionLockphone, ActionLockphone)} />
      <Route path={json.lostphone.lockPhone} element={renderProtected(json.lostphone.lockPhone, LockPhone)} />
      <Route path={json.lostphone.unlockPhone} element={renderProtected(json.lostphone.unlockPhone, UnlockPhone)} />

      {/* History */}
      <Route path={json.history?.loginHistory} element={renderProtected(json.history?.loginHistory, LoginHistory)} />
      <Route path={json.history?.deviceHistory} element={renderProtected(json.history?.deviceHistory, DeviceActionHistory)} />

      {/* Calculate */}
      <Route path={json.calculate?.calculateSchedule1 || "/calculate/schedule-1"} element={renderProtected(json.calculate?.calculateSchedule1 || "/calculate/schedule-1", CalculateSchedule1)} />
      <Route path={json.calculate?.calculateSchedule2 || "/calculate/schedule-2"} element={renderProtected(json.calculate?.calculateSchedule2 || "/calculate/schedule-2", CalculateSchedule2)} />

      {/* Follow Up */}
      <Route path={json.followUp?.followUp1 || "/follow-up/follow-up-1"} element={renderProtected(json.followUp?.followUp1 || "/follow-up/follow-up-1", FollowUp1)} />
      <Route path={json.followUp?.followUp2 || "/follow-up/follow-up-2"} element={renderProtected(json.followUp?.followUp2 || "/follow-up/follow-up-2", FollowUp2)} />
      <Route path={json.followUp?.followUp3 || "/follow-up/follow-up-3"} element={renderProtected(json.followUp?.followUp3 || "/follow-up/follow-up-3", FollowUp3)} />
      <Route path={json.followUp?.followUp4 || "/follow-up/follow-up-4"} element={renderProtected(json.followUp?.followUp4 || "/follow-up/follow-up-4", FollowUp4)} />
      <Route path="/follow-up/sen-sok" element={renderProtected("/follow-up/follow-up-3", FollowUp3)} />

      {/* Salary */}
      <Route path={json.salary || "/salary"} element={renderProtected(json.salary || "/salary", SalaryPage)} />

      {/* Settings & Profile */}
      <Route path={json.settings.allAccount} element={renderProtected(json.settings.allAccount, AllAccount)} />
      <Route path={json.settings.controlSystem} element={renderProtected(json.settings.controlSystem, ControlSystem)} />
      <Route path={json.settings.profile} element={renderProtected(json.settings.profile, Profile)} />

      {/* Wildcard Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

export default AppRoutes;
