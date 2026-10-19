import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { FaChevronDown, FaMobileAlt, FaRedo, FaSearch } from 'react-icons/fa';
import { MdOutlineDevices } from 'react-icons/md';
import CopyCell from '../../../components/CopyCell';

const DeviceEnrolment = () => {
    const { t } = useLanguage();
    const { API_BASE1, user, hasPermission } = useAuth();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [expandedModel, setExpandedModel] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const canViewCustomerInformation = hasPermission('/device', 'information');
    const isMasterAdmin = user?.username === '@hakyonghouv'
        || user?.username === 'hakyonghouv'
        || user?.isImmutable
        || user?.role === 'Administrator';

    useEffect(() => {
        let isCurrent = true;

        const fetchEnrolments = async () => {
            if (!API_BASE1) {
                setLoadError('API is not configured.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setLoadError('');

            try {
                const params = new URLSearchParams({
                    status: 'Activated',
                    page: '1',
                    limit: '999999',
                    userBrand: user?.brand || '',
                    userRole: user?.role || '',
                    username: user?.username || '',
                    isImmutable: user?.isImmutable ? 'true' : 'false',
                    userSubBrands: Array.isArray(user?.subBrands) ? user.subBrands.join(',') : ''
                });

                if (!isMasterAdmin && user?.brand) {
                    params.set('brand', user.brand);
                }

                const response = await fetch(`${API_BASE1}/contracts?${params.toString()}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const payload = await response.json();
                if (!Array.isArray(payload.data)) {
                    throw new Error(payload.error || 'Invalid contracts response.');
                }

                if (isCurrent) {
                    setContracts(payload.data);
                }
            } catch (error) {
                console.error('Failed to load device enrolments:', error);
                if (isCurrent) {
                    setLoadError(error.message || t('enrolmentLoadError'));
                }
            } finally {
                if (isCurrent) {
                    setLoading(false);
                }
            }
        };

        fetchEnrolments();
        return () => {
            isCurrent = false;
        };
    }, [
        API_BASE1,
        isMasterAdmin,
        refreshKey,
        t,
        user?.brand,
        user?.isImmutable,
        user?.role,
        user?.subBrands,
        user?.username
    ]);

    const modelGroups = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        const groups = new Map();

        contracts.forEach(contract => {
            const model = String(contract.model || '').trim() || t('unknownModel', 'Unknown model');
            const matches = !term || [
                model,
                contract.customerNameEn,
                contract.customerNameKh,
                contract.phone,
                contract.contractIid,
                contract.contractId,
                contract.serialNumber,
                contract.brand,
                contract.subBrand
            ].some(value => String(value || '').toLocaleLowerCase().includes(term));

            if (!matches) return;

            const key = model.toLocaleLowerCase();
            if (!groups.has(key)) {
                groups.set(key, { key, model, contracts: [] });
            }
            groups.get(key).contracts.push(contract);
        });

        return Array.from(groups.values()).sort((a, b) =>
            b.contracts.length - a.contracts.length || a.model.localeCompare(b.model)
        );
    }, [contracts, search, t]);

    const matchingContractCount = modelGroups.reduce((total, group) => total + group.contracts.length, 0);

    const formatAmount = (amount) => {
        const value = Number(amount);
        return Number.isFinite(value) ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
    };

    return (
        <main className="w-full min-h-full bg-[#f4f6f8] p-2 sm:p-3 space-y-4">
            <header className="flex flex-col gap-3 rounded-[5px] border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <MdOutlineDevices size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{t('deviceEnrolment')}</h1>
                        <p className="text-xs text-slate-500">{t('enrolmentDescription')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                        {modelGroups.length} {t('enrolmentModels')}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        {matchingContractCount} {t('enrolmentContracts')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setRefreshKey(value => value + 1)}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-[5px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FaRedo className={loading ? 'animate-spin' : ''} />
                        {t('reload')}
                    </button>
                </div>
            </header>

            <div className="relative max-w-xl">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                <input
                    type="search"
                    value={search}
                    onChange={event => {
                        setSearch(event.target.value);
                        setExpandedModel('');
                    }}
                    placeholder={t('enrolmentSearch')}
                    className="w-full rounded-[5px] border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
            </div>

            {loadError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <span>{t('enrolmentLoadError')} {loadError}</span>
                    <button
                        type="button"
                        onClick={() => setRefreshKey(value => value + 1)}
                        className="rounded-[5px] border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100"
                    >
                        {t('reload')}
                    </button>
                </div>
            )}

            {loading ? (
                <div role="status" className="rounded-[5px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                    <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                    {t('loading')}
                </div>
            ) : !loadError && modelGroups.length === 0 ? (
                <div className="rounded-[5px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                    {search ? t('enrolmentNoMatches') : t('deviceNoActivatedContracts')}
                </div>
            ) : (
                <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label={t('deviceEnrolment')}>
                    {modelGroups.map(group => {
                        const isExpanded = expandedModel === group.key;

                        return (
                            <article key={group.key} className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-xs">
                                <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    onClick={() => setExpandedModel(isExpanded ? '' : group.key)}
                                    className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-emerald-50/60"
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                            <FaMobileAlt />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-slate-900">{group.model}</span>
                                            <span className="text-xs text-slate-500">{t('enrolmentContracts')}</span>
                                        </span>
                                    </span>
                                    <span className="flex flex-shrink-0 items-center gap-3">
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800">
                                            {group.contracts.length}
                                        </span>
                                        <FaChevronDown className={`text-xs text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-3">
                                        {canViewCustomerInformation ? (
                                            <div className="space-y-2">
                                                {group.contracts.map((contract, index) => (
                                                    <div
                                                        key={contract._id || contract.contractId || `${group.key}-${index}`}
                                                        className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-[5px] border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('customerName')}</span>
                                                            <span className="block truncate text-sm font-semibold text-slate-800">
                                                                {contract.customerNameEn || contract.customerNameKh || '—'}
                                                            </span>
                                                            {contract.customerNameKh && contract.customerNameEn && (
                                                                <span className="block truncate font-khmer text-xs text-slate-500">{contract.customerNameKh}</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('contractIidManual', 'Contract IID')}</span>
                                                            <CopyCell
                                                                text={contract.contractIid || contract.contractId || '—'}
                                                                className="block truncate font-mono text-sm font-bold text-indigo-700"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('phone')}</span>
                                                            <CopyCell text={contract.phone || '—'} className="block truncate text-xs text-slate-700" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('inputDate')}</span>
                                                            <span className="block truncate text-xs text-slate-700">{contract.inputDate || '—'}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('amount')}</span>
                                                            <span className="block truncate text-xs font-semibold text-emerald-700">{formatAmount(contract.amount)}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('duration')}</span>
                                                            <span className="block truncate text-xs text-slate-700">{contract.duration || '—'}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('serialNumber')}</span>
                                                            <CopyCell text={contract.serialNumber || '—'} className="block truncate font-mono text-xs text-slate-700" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-semibold uppercase text-slate-400">{t('brand')}</span>
                                                            <span className="block truncate text-xs text-slate-700">
                                                                {[contract.brand, contract.subBrand].filter(Boolean).join(' / ') || '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="rounded-[5px] bg-amber-50 p-3 text-xs text-amber-800">
                                                {t('enrolmentInformationRestricted')}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            )}
        </main>
    );
};

export default DeviceEnrolment;
