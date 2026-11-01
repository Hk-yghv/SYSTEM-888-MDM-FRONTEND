import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { FaDollarSign, FaExclamationTriangle, FaMoneyBillWave, FaUsers } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateOnly = (value) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const formatMoney = (value) =>
    `$${(Number(value) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const DailyReport = () => {
    const { API_BASE, API_BASE1, user } = useAuth();
    const { t } = useLanguage();
    const [selectedDate, setSelectedDate] = useState(getLocalDate);
    const [report, setReport] = useState({ contracts: [], payments: [], penalties: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchReport = useCallback(async (signal) => {
        const userParams = {
            userBrand: user?.brand || '',
            userRole: user?.role || '',
            username: user?.username || '',
            isImmutable: user?.isImmutable ? 'true' : 'false'
        };
        const contractParams = new URLSearchParams({
            ...userParams,
            page: '1',
            limit: '999999'
        });
        const paymentParams = new URLSearchParams({
            ...userParams,
            page: '1',
            limit: '999999',
            dateFrom: selectedDate,
            dateTo: selectedDate
        });
        const penaltyParams = new URLSearchParams({
            type: 'penalty',
            page: '1',
            limit: '999999',
            startDate: selectedDate,
            endDate: selectedDate
        });

        const responses = await Promise.all([
            fetch(`${API_BASE1}/contracts?${contractParams}`, { signal }),
            fetch(`${API_BASE1}/payments?${paymentParams}`, { signal }),
            fetch(`${API_BASE}/cash-transactions?${penaltyParams}`, { signal })
        ]);
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
            throw new Error(`${failedResponse.status} ${failedResponse.statusText}`.trim());
        }

        const [contractResult, paymentResult, penaltyResult] = await Promise.all(
            responses.map((response) => response.json())
        );
        const contracts = (contractResult.data || []).filter((contract) =>
            getDateOnly(contract.inputDate || contract.createdAt || contract.date) === selectedDate
        );

        setReport({
            contracts,
            payments: paymentResult.data || [],
            penalties: penaltyResult.data || []
        });
    }, [API_BASE, API_BASE1, selectedDate, user]);

    useEffect(() => {
        if (!selectedDate) {
            setReport({ contracts: [], payments: [], penalties: [] });
            setError('');
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        setReport({ contracts: [], payments: [], penalties: [] });
        setLoading(true);
        setError('');
        fetchReport(controller.signal)
            .catch((fetchError) => {
                if (fetchError.name !== 'AbortError') {
                    console.error('Fetch daily report error:', fetchError);
                    setError(fetchError.message || 'Unknown error');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [fetchReport, refreshKey]);

    const summary = useMemo(() => ({
        submittedGuests: report.contracts.length,
        requestedAmount: report.contracts.reduce(
            (total, contract) => total + (Number(contract.amount || contract.totalAmount) || 0),
            0
        ),
        paidAmount: report.payments.reduce(
            (total, payment) => total + (Number(payment.amount) || 0),
            0
        ),
        penaltyAmount: report.penalties.reduce((total, penalty) => {
            const amount = Number(penalty.amount) || 0;
            const amountUSD = penalty.amountUSD == null
                ? (penalty.currency === 'KHR' ? amount / 4000 : amount)
                : Number(penalty.amountUSD) || 0;
            return total + amountUSD;
        }, 0)
    }), [report]);

    const cards = [
        {
            label: t('dailyReportSubmittedGuests'),
            value: summary.submittedGuests.toLocaleString(),
            icon: FaUsers,
            color: 'text-emerald-600',
            background: 'bg-emerald-50'
        },
        {
            label: t('totalRequestedAmount'),
            value: formatMoney(summary.requestedAmount),
            icon: FaDollarSign,
            color: 'text-blue-600',
            background: 'bg-blue-50'
        },
        {
            label: t('paidAmountLabel'),
            value: formatMoney(summary.paidAmount),
            icon: FaMoneyBillWave,
            color: 'text-violet-600',
            background: 'bg-violet-50'
        },
        {
            label: t('penaltyAmount'),
            value: formatMoney(summary.penaltyAmount),
            icon: FaExclamationTriangle,
            color: 'text-rose-600',
            background: 'bg-rose-50'
        }
    ];

    return (
        <div className="min-h-full space-y-4 p-3 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-black text-slate-800">{t('dailyReport')}</h1>
                    <p className="mt-1 text-sm text-slate-500">{t('date')}: {selectedDate}</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600" htmlFor="daily-report-date">
                        {t('date')}
                    </label>
                    <input
                        id="daily-report-date"
                        type="date"
                        required
                        value={selectedDate}
                        onChange={(event) => setSelectedDate(event.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                    <button
                        type="button"
                        onClick={() => setRefreshKey((key) => key + 1)}
                        disabled={loading}
                        aria-label={t('refresh')}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <MdOutlineSync className={loading ? 'animate-spin' : ''} size={19} />
                    </button>
                </div>
            </div>

            {error && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {t('dailyReportLoadError')}: {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, icon: Icon, color, background }) => (
                    <div key={label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold text-slate-500">{label}</p>
                                <p className="mt-2 text-2xl font-black tabular-nums text-slate-800">
                                    {loading ? '—' : value}
                                </p>
                            </div>
                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${background} ${color}`}>
                                <Icon size={18} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DailyReport;
