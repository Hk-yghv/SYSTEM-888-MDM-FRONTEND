import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import FollowUp4Report from '../../Report/pages/FollowUp4Report';
import { FOLLOW_UP_NAMES } from '../../../utils/followUpNames';

const ReportAuditTelegram = () => {
    const { hasPermission } = useAuth();
    const { t } = useLanguage();
    const [activeFollowUp, setActiveFollowUp] = useState(null);

    const permittedFollowUps = [1, 2, 3, 4].filter((workspaceId) =>
        hasPermission(`/audit/telegram/report/follow-up-${workspaceId}`, 'read')
    );
    const selectedFollowUp = permittedFollowUps.includes(activeFollowUp)
        ? activeFollowUp
        : permittedFollowUps[0];

    if (selectedFollowUp === undefined) {
        return (
            <div className="m-3 rounded-[5px] border border-rose-200 bg-white p-6 text-center font-semibold text-rose-600">
                {t('accessDenied')}
            </div>
        );
    }

    const getFollowUpTitle = (workspaceId) =>
        workspaceId === 1 ? t('followUp1') : FOLLOW_UP_NAMES[workspaceId];

    return (
        <div data-allow-scroll="true" className="w-full min-w-0 space-y-4">
            <nav
                aria-label={t('followUpReports')}
                className="mx-4 mt-4 flex flex-wrap gap-2 rounded-[5px] border border-slate-200 bg-white p-2 sm:mx-6"
            >
                {permittedFollowUps.map((workspaceId) => (
                    <button
                        key={workspaceId}
                        type="button"
                        onClick={() => setActiveFollowUp(workspaceId)}
                        aria-current={selectedFollowUp === workspaceId ? 'page' : undefined}
                        className={`rounded-[5px] px-4 py-2 text-sm font-bold transition ${
                            selectedFollowUp === workspaceId
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        {getFollowUpTitle(workspaceId)}
                    </button>
                ))}
            </nav>

            <FollowUp4Report
                key={selectedFollowUp}
                workspaceId={selectedFollowUp}
                permissionPath={`/audit/telegram/report/follow-up-${selectedFollowUp}`}
                reportTitle={getFollowUpTitle(selectedFollowUp)}
            />
        </div>
    );
};

export default ReportAuditTelegram;
