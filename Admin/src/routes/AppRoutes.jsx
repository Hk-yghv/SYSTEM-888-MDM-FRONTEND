import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import json from "./Routes.json";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";
import MainLayout from "./MainLayout";
import { useAuth } from "../context/AuthContext";
import { getFirstAllowedRoute } from "../utils/permissionUtils";
import ScreenRecorderDock from "../components/ScreenRecorderDock";

import Dashboard from "../App/Dashboard/Dashboard";
import CashFlowTrader from "../App/CashFlow/pages/CashFlowTrader";
import KhmerCalendarPage from "../App/Calendar/KhmerCalendarPage";
import TelegramPage from "../App/Telegram/TelegramPage";
import Customer from "../App/Customer/pages/Customer";
import Device from "../App/Device/pages/Device";
import DeviceEnrolment from "../App/Device/pages/DeviceEnrolment";
import PhoneValuationPage from "../App/Device/pages/PhoneValuationPage";
import Application from "../App/Contract/page/Application";
import Activated from "../App/Contract/page/Activated";
import Check from "../App/Contract/page/Check";
import Redeem from "../App/Contract/page/Redeem";
import Comments from "../App/Contract/page/Comments";
import BlackList from "../App/Contract/page/BlackList";
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
import AllCustomersReport from "../App/Report/pages/AllCustomersReport";
import DailyReport from "../App/Report/pages/DailyReport";
import ReportAll from "../App/Report/pages/ReportAll";
import ActivatedReport from "../App/Report/pages/ActivatedReport";
import RedeemReport from "../App/Report/pages/RedeemReport";
import LockPhoneReport from "../App/Report/pages/LockPhoneReport";
import SetWallpaperReport from "../App/Report/pages/SetWallpaperReport";
import InstallmentReport from "../App/Report/pages/InstallmentReport";
import FollowUpReport from "../App/Report/pages/FollowUpReport";
import FollowUp4Report from "../App/Report/pages/FollowUp4Report";
import ActionWallpaper from "../App/Wallpaper/pages/Actions";
import LockWallpaper from "../App/Wallpaper/pages/LockWallpaper";
import UnlockWallpaper from "../App/Wallpaper/pages/UnlockWallpaper";
import ActionLockphone from "../App/Lostphone/pages/Actions";
import LockPhone from "../App/Lostphone/pages/LockPhone";
import UnlockPhone from "../App/Lostphone/pages/UnlockPhone";
import LoginHistory from "../App/History/pages/LoginHistory";
import DeviceActionHistory from "../App/History/pages/DeviceActionHistory";
import CalculateSchedule1 from "../App/Calculate/pages/CalculateSchedule1";
import CalculateSchedule2 from "../App/Calculate/pages/CalculateSchedule2";
import FollowUp1 from "../App/FollowUp/pages/FollowUp1";
import FollowUp2 from "../App/FollowUp/pages/FollowUp2";
import FollowUp3 from "../App/FollowUp/pages/FollowUp3";
import FollowUp4 from "../App/FollowUp/pages/FollowUp4";
import InventoryLocationPage from "../App/Inventory/pages/InventoryLocationPage";
import SalaryPage from "../App/Salary/pages/SalaryPage";
import ControlSystem from "../App/Settings/pages/ControlSystem";
import PhoneProductsPage from "../App/Settings/pages/PhoneProductsPage";
import AllAccount from "../App/Settings/pages/AllAccount";
import Profile from "../App/Profile/Profile";
import AllPicture from "../App/Media/AllPicture";
import SaveUrlPage from "../App/SaveUrl/pages/SaveUrlPage";
import AuditTelegram from "../App/Audit/pages/AuditTelegram";
import AuditDevice from "../App/Audit/pages/AuditDevice";
import ReportAuditTelegram from "../App/Audit/pages/ReportAuditTelegram";
import PrintIdCard from "../App/Print/pages/PrintIdCard";
import HelpSupport from "../App/Support/pages/HelpSupport";
import ControlSupportHelp from "../App/Settings/pages/ControlSupportHelp";
import MusicPage from "../App/Music/MusicPage";
import AccountMap from "../App/Settings/pages/AccountMap";

/**
 * Redirect root or unauthenticated users to their first permitted page
 */
export const RootRedirect = () => {
  const { user, authInitialized, hasPermission } = useAuth();
  if (!authInitialized) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#070913] text-gray-300">
        Loading session...
      </div>
    );
  }
  const targetRoute = getFirstAllowedRoute(user, hasPermission);
  return <Navigate to={targetRoute} replace />;
};

/**
 * Route wrapper helper to keep route declaration concise
 */
const renderProtected = (pagePath, Component, props = {}, anyPermissionPaths = []) => (
  <ProtectRoute pagePath={pagePath} anyPermissionPaths={anyPermissionPaths}>
    <MainLayout>
      <Component {...props} />
    </MainLayout>
  </ProtectRoute>
);

const AppRoutes = () => {
  return (
    <>
      <ScreenRecorderDock />
      <Routes>
      {/* Sign In Route */}
      <Route path={json.signin} element={<SignIn />} />

      {/* Root Entry & Dashboard */}
      <Route path={json.start} element={<RootRedirect />} />
      <Route path={json.dashboard} element={renderProtected(json.dashboard, Dashboard)} />
      <Route path={json.cashFlowTrader || "/cashflow/monitor"} element={renderProtected(json.cashFlowTrader || "/cashflow/monitor", CashFlowTrader)} />
      <Route path={json.calendar || "/calendar"} element={renderProtected(json.calendar || "/calendar", KhmerCalendarPage)} />
      <Route path={json.telegram || "/telegram"} element={renderProtected(json.telegram || "/telegram", TelegramPage)} />

      {/* Customer & Device */}
      <Route path={json.customer} element={renderProtected(json.customer, Customer)} />
      <Route path={json.device} element={renderProtected(json.device, Device)} />
      <Route path={json.deviceEnrolment || "/device/enrolment"} element={renderProtected(json.deviceEnrolment || "/device/enrolment", DeviceEnrolment)} />
      <Route path={json.phoneValuation || "/phone-valuation"} element={renderProtected(json.phoneValuation || "/phone-valuation", PhoneValuationPage)} />

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
      <Route path={json.report?.daily} element={renderProtected(json.report?.daily, DailyReport)} />
      <Route path={json.report?.reportAll} element={renderProtected(json.report?.reportAll, ReportAll)} />
      <Route path={json.report?.activated} element={renderProtected(json.report?.activated, ActivatedReport)} />
      <Route path={json.report?.redeem} element={renderProtected(json.report?.redeem, RedeemReport)} />
      <Route path={json.report?.lockPhone} element={renderProtected(json.report?.lockPhone, LockPhoneReport)} />
      <Route path={json.report?.setWallpaper} element={renderProtected(json.report?.setWallpaper, SetWallpaperReport)} />
      <Route path={json.report?.installment} element={renderProtected(json.report?.installment, InstallmentReport)} />
      <Route path={json.report?.followUpReport || "/report/follow-up"} element={renderProtected(json.report?.followUpReport || "/report/follow-up", FollowUpReport)} />
      <Route path={json.report?.followUp4Report || "/report/follow-up-4"} element={renderProtected(json.report?.followUp4Report || "/report/follow-up-4", FollowUp4Report)} />
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

      {/* Inventory */}
      <Route path={json.inventory.senSok} element={renderProtected(json.inventory.senSok, InventoryLocationPage, { locationCode: "sen-sok" })} />
      <Route path={`${json.inventory.senSok}/preview`} element={renderProtected(json.inventory.senSok, InventoryLocationPage, { locationCode: "sen-sok" })} />
      <Route path={json.inventory.chbarAmpov} element={renderProtected(json.inventory.chbarAmpov, InventoryLocationPage, { locationCode: "chbar-ampov" })} />
      <Route path={`${json.inventory.chbarAmpov}/preview`} element={renderProtected(json.inventory.chbarAmpov, InventoryLocationPage, { locationCode: "chbar-ampov" })} />
      <Route path={json.inventory.stuengMeanChey} element={renderProtected(json.inventory.stuengMeanChey, InventoryLocationPage, { locationCode: "stueng-mean-chey" })} />
      <Route path={`${json.inventory.stuengMeanChey}/preview`} element={renderProtected(json.inventory.stuengMeanChey, InventoryLocationPage, { locationCode: "stueng-mean-chey" })} />

      {/* Salary */}
      <Route path={json.salary || "/salary"} element={renderProtected(json.salary || "/salary", SalaryPage)} />

      {/* Cloudinary Media */}
      <Route path={json.allPicture || "/all-picture"} element={renderProtected(json.allPicture || "/all-picture", AllPicture)} />

      {/* Save URL */}
      <Route path={json.saveUrl || "/save-url"} element={renderProtected(json.saveUrl || "/save-url", SaveUrlPage)} />

      {/* Audit */}
      <Route path={json.audit?.telegram || "/audit/telegram"} element={renderProtected(json.audit?.telegram || "/audit/telegram", AuditTelegram)} />
      <Route path={json.audit?.device || "/audit/device"} element={renderProtected(json.audit?.device || "/audit/device", AuditDevice)} />
      <Route
        path={json.audit?.reportTelegram || "/audit/telegram/report"}
        element={renderProtected(
          json.audit?.reportTelegram || "/audit/telegram/report",
          ReportAuditTelegram,
          {},
          [1, 2, 3, 4].map((workspaceId) => `/audit/telegram/report/follow-up-${workspaceId}`)
        )}
      />

      {/* Print */}
      <Route path={json.print?.idCard || "/print/id-card"} element={renderProtected(json.print?.idCard || "/print/id-card", PrintIdCard)} />

      {/* Help & Support */}
      <Route path={json.helpSupport || "/help-support"} element={renderProtected(json.helpSupport || "/help-support", HelpSupport)} />

      {/* Local YouTube playlist */}
      <Route path={json.music || "/music"} element={renderProtected("/profile", MusicPage)} />

      {/* Settings & Profile */}
      <Route path={json.settings.allAccount} element={renderProtected(json.settings.allAccount, AllAccount)} />
      <Route path={json.settings.accountMap} element={renderProtected(json.settings.allAccount, AccountMap)} />
      <Route path={json.settings.controlSystem} element={renderProtected(json.settings.controlSystem, ControlSystem)} />
      <Route path={json.settings.products || "/settings/products"} element={renderProtected(json.settings.products || "/settings/products", PhoneProductsPage)} />
      <Route path={json.settings?.controlSupportHelp || "/settings/control-support-help"} element={renderProtected(json.settings?.controlSupportHelp || "/settings/control-support-help", ControlSupportHelp)} />
      <Route path={json.settings.profile} element={renderProtected(json.settings.profile, Profile)} />

      {/* Wildcard Fallback */}
      <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
