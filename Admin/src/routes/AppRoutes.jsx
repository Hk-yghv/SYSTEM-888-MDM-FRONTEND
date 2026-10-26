import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import json from "./Routes.json";
import ProtectRoute from "../services/ProtectRoute";
import SignIn from "../services/SignIn";
import MainLayout from "./MainLayout";
import { useAuth } from "../context/AuthContext";
import { getFirstAllowedRoute } from "../utils/permissionUtils";

const Dashboard = lazy(() => import("../App/Dashboard/Dashboard"));
const CashFlowTrader = lazy(() => import("../App/CashFlow/pages/CashFlowTrader"));
const KhmerCalendarPage = lazy(() => import("../App/Calendar/KhmerCalendarPage"));
const TelegramPage = lazy(() => import("../App/Telegram/TelegramPage"));
const Customer = lazy(() => import("../App/Customer/pages/Customer"));
const Device = lazy(() => import("../App/Device/pages/Device"));
const DeviceEnrolment = lazy(() => import("../App/Device/pages/DeviceEnrolment"));
const PhoneValuationPage = lazy(() => import("../App/Device/pages/PhoneValuationPage"));
const Application = lazy(() => import("../App/Contract/page/Application"));
const Activated = lazy(() => import("../App/Contract/page/Activated"));
const Check = lazy(() => import("../App/Contract/page/Check"));
const Redeem = lazy(() => import("../App/Contract/page/Redeem"));
const Comments = lazy(() => import("../App/Contract/page/Comments"));
const BlackList = lazy(() => import("../App/Contract/page/BlackList"));
const InstallmentPage = lazy(() => import("../App/Installment/pages/InstallmentPage"));
const InstallmentHistory = lazy(() => import("../App/Installment/pages/InstallmentHistory"));
const PaymentHistory = lazy(() => import("../App/Installment/pages/PaymentHistory"));
const CashOutPage = lazy(() => import("../App/Installment/pages/CashOutPage"));
const CashInPage = lazy(() => import("../App/Installment/pages/CashInPage"));
const PenaltyPage = lazy(() => import("../App/Installment/pages/PenaltyPage"));
const OverduePage = lazy(() => import("../App/Installment/pages/OverduePage"));
const DueTodayPage = lazy(() => import("../App/Installment/pages/DueTodayPage"));
const DueIn3DaysPage = lazy(() => import("../App/Installment/pages/DueIn3DaysPage"));
const Overdue3DaysPage = lazy(() => import("../App/Installment/pages/Overdue3DaysPage"));
const UnpaidYesterdayPage = lazy(() => import("../App/Installment/pages/UnpaidYesterdayPage"));
const Overdue7DaysPage = lazy(() => import("../App/Installment/pages/Overdue7DaysPage"));
const AllCustomersReport = lazy(() => import("../App/Report/pages/AllCustomersReport"));
const ReportAll = lazy(() => import("../App/Report/pages/ReportAll"));
const ActivatedReport = lazy(() => import("../App/Report/pages/ActivatedReport"));
const RedeemReport = lazy(() => import("../App/Report/pages/RedeemReport"));
const LockPhoneReport = lazy(() => import("../App/Report/pages/LockPhoneReport"));
const SetWallpaperReport = lazy(() => import("../App/Report/pages/SetWallpaperReport"));
const InstallmentReport = lazy(() => import("../App/Report/pages/InstallmentReport"));
const FollowUpReport = lazy(() => import("../App/Report/pages/FollowUpReport"));
const FollowUp4Report = lazy(() => import("../App/Report/pages/FollowUp4Report"));
const ActionWallpaper = lazy(() => import("../App/Wallpaper/pages/Actions"));
const LockWallpaper = lazy(() => import("../App/Wallpaper/pages/LockWallpaper"));
const UnlockWallpaper = lazy(() => import("../App/Wallpaper/pages/UnlockWallpaper"));
const ActionLockphone = lazy(() => import("../App/Lostphone/pages/Actions"));
const LockPhone = lazy(() => import("../App/Lostphone/pages/LockPhone"));
const UnlockPhone = lazy(() => import("../App/Lostphone/pages/UnlockPhone"));
const LoginHistory = lazy(() => import("../App/History/pages/LoginHistory"));
const DeviceActionHistory = lazy(() => import("../App/History/pages/DeviceActionHistory"));
const CalculateSchedule1 = lazy(() => import("../App/Calculate/pages/CalculateSchedule1"));
const CalculateSchedule2 = lazy(() => import("../App/Calculate/pages/CalculateSchedule2"));
const FollowUp1 = lazy(() => import("../App/FollowUp/pages/FollowUp1"));
const FollowUp2 = lazy(() => import("../App/FollowUp/pages/FollowUp2"));
const FollowUp3 = lazy(() => import("../App/FollowUp/pages/FollowUp3"));
const FollowUp4 = lazy(() => import("../App/FollowUp/pages/FollowUp4"));
const SalaryPage = lazy(() => import("../App/Salary/pages/SalaryPage"));
const ControlSystem = lazy(() => import("../App/Settings/pages/ControlSystem"));
const PhoneProductsPage = lazy(() => import("../App/Settings/pages/PhoneProductsPage"));
const AllAccount = lazy(() => import("../App/Settings/pages/AllAccount"));
const Profile = lazy(() => import("../App/Profile/Profile"));
const AllPicture = lazy(() => import("../App/Media/AllPicture"));
const SaveUrlPage = lazy(() => import("../App/SaveUrl/pages/SaveUrlPage"));
const AuditTelegram = lazy(() => import("../App/Audit/pages/AuditTelegram"));
const AuditDevice = lazy(() => import("../App/Audit/pages/AuditDevice"));
const ReportAuditTelegram = lazy(() => import("../App/Audit/pages/ReportAuditTelegram"));
const PrintIdCard = lazy(() => import("../App/Print/pages/PrintIdCard"));
const HelpSupport = lazy(() => import("../App/Support/pages/HelpSupport"));
const ControlSupportHelp = lazy(() => import("../App/Settings/pages/ControlSupportHelp"));
const MusicPage = lazy(() => import("../App/Music/MusicPage"));

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
const renderProtected = (pagePath, Component, props = {}) => (
  <ProtectRoute pagePath={pagePath}>
    <MainLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-slate-500" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            <span>Loading page...</span>
          </div>
        }
      >
        <Component {...props} />
      </Suspense>
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

      {/* Salary */}
      <Route path={json.salary || "/salary"} element={renderProtected(json.salary || "/salary", SalaryPage)} />

      {/* Cloudinary Media */}
      <Route path={json.allPicture || "/all-picture"} element={renderProtected(json.allPicture || "/all-picture", AllPicture)} />

      {/* Save URL */}
      <Route path={json.saveUrl || "/save-url"} element={renderProtected(json.saveUrl || "/save-url", SaveUrlPage)} />

      {/* Audit */}
      <Route path={json.audit?.telegram || "/audit/telegram"} element={renderProtected(json.audit?.telegram || "/audit/telegram", AuditTelegram)} />
      <Route path={json.audit?.device || "/audit/device"} element={renderProtected(json.audit?.device || "/audit/device", AuditDevice)} />
      <Route path={json.audit?.reportTelegram || "/audit/telegram/report"} element={renderProtected(json.audit?.reportTelegram || "/audit/telegram/report", ReportAuditTelegram)} />

      {/* Print */}
      <Route path={json.print?.idCard || "/print/id-card"} element={renderProtected(json.print?.idCard || "/print/id-card", PrintIdCard)} />

      {/* Help & Support */}
      <Route path={json.helpSupport || "/help-support"} element={renderProtected(json.helpSupport || "/help-support", HelpSupport)} />

      {/* Local YouTube playlist */}
      <Route path={json.music || "/music"} element={renderProtected("/profile", MusicPage)} />

      {/* Settings & Profile */}
      <Route path={json.settings.allAccount} element={renderProtected(json.settings.allAccount, AllAccount)} />
      <Route path={json.settings.controlSystem} element={renderProtected(json.settings.controlSystem, ControlSystem)} />
      <Route path={json.settings.products || "/settings/products"} element={renderProtected(json.settings.products || "/settings/products", PhoneProductsPage)} />
      <Route path={json.settings?.controlSupportHelp || "/settings/control-support-help"} element={renderProtected(json.settings?.controlSupportHelp || "/settings/control-support-help", ControlSupportHelp)} />
      <Route path={json.settings.profile} element={renderProtected(json.settings.profile, Profile)} />

      {/* Wildcard Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

export default AppRoutes;
