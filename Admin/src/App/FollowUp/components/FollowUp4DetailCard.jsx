import { useLanguage } from '../../../context/LanguageContext';
import React from 'react';
import { FaCalculator, FaRegCalendarAlt, FaSave, FaChartBar, FaHistory } from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';

/**
 * FollowUp4DetailCard
 * Prop-driven Component for DETAIL metrics inputs, automated formula calculations, and history view.
 */
const FollowUp4DetailCard = ({
    date,
    setDate,
    brand,
    metrics = {},
    setMetrics,
    onSave,
    saving = false,
    calculatedFormulas = {},
    historyList = [],
    loading = false
}) => {
    const { t } = useLanguage();
    const handleMetricChange = (field, value) => {
        const val = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
        setMetrics(prev => {
            const next = { ...prev, [field]: val };
            if (field === 'page' || field === 'telegram' || field === 'call') {
                const p = Number(field === 'page' ? val : (next.page || 0)) || 0;
                const tg = Number(field === 'telegram' ? val : (next.telegram || 0)) || 0;
                const c = Number(field === 'call' ? val : (next.call || 0)) || 0;
                next.message = p + tg + c;
            }
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* Top Container: Inputs & Automated Calculations */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Input metrics form */}
                <div className="lg:col-span-6 bg-slate-800/90 border border-slate-700/80 p-6 rounded-[5px] shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
                        <div>
                            <h2 className="text-base font-bold text-sky-400 flex items-center gap-2">
                                <FaCalculator /> <span>{t('detailMetricsInput')}</span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                {t('enterDataForBrand')}: <span className="text-emerald-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded">{brand || '888MDM'}</span>
                            </p>
                        </div>

                        {/* Date Picker */}
                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-[5px] border border-slate-700">
                            <FaRegCalendarAlt className="text-slate-400 text-xs" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-transparent text-xs text-slate-100 outline-none cursor-pointer font-mono font-bold"
                            />
                        </div>
                    </div>

                    {/* Input Fields Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('facebookPageInquiries')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.page ?? ''}
                                onChange={(e) => handleMetricChange('page', e.target.value)}
                                className="w-full bg-slate-800 text-right text-cyan-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('telegramInquiries')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.telegram ?? ''}
                                onChange={(e) => handleMetricChange('telegram', e.target.value)}
                                className="w-full bg-slate-800 text-right text-sky-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-sky-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('noReply')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.noReply ?? ''}
                                onChange={(e) => handleMetricChange('noReply', e.target.value)}
                                className="w-full bg-slate-800 text-right text-slate-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-slate-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('inquire')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.inquire ?? ''}
                                onChange={(e) => handleMetricChange('inquire', e.target.value)}
                                className="w-full bg-slate-800 text-right text-amber-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('rejectCs')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.rejectCs ?? ''}
                                onChange={(e) => handleMetricChange('rejectCs', e.target.value)}
                                className="w-full bg-slate-800 text-right text-rose-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('more')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.more ?? ''}
                                onChange={(e) => handleMetricChange('more', e.target.value)}
                                className="w-full bg-slate-800 text-right text-indigo-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('pageSubmit')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.pageSubmit ?? ''}
                                onChange={(e) => handleMetricChange('pageSubmit', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('telegramSubmit')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.telegramSubmit ?? ''}
                                onChange={(e) => handleMetricChange('telegramSubmit', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('call')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.call ?? ''}
                                onChange={(e) => handleMetricChange('call', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('inReview')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.review ?? ''}
                                onChange={(e) => handleMetricChange('review', e.target.value)}
                                className="w-full bg-slate-800 text-right text-amber-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('reject')}</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.reject ?? ''}
                                onChange={(e) => handleMetricChange('reject', e.target.value)}
                                className="w-full bg-slate-800 text-right text-rose-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('success')} 1</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.success1 ?? ''}
                                onChange={(e) => handleMetricChange('success1', e.target.value)}
                                className="w-full bg-slate-800 text-right text-teal-400 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500 font-mono"
                            />
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-[5px] border border-slate-700/60">
                            <label className="block text-slate-400 font-semibold mb-1">{t('success')} 2</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={metrics.success2 ?? ''}
                                onChange={(e) => handleMetricChange('success2', e.target.value)}
                                className="w-full bg-slate-800 text-right text-emerald-300 font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={onSave}
                        disabled={saving || loading}
                        className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-1 rounded-[5px] transition-all shadow-lg shadow-sky-600/20 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <MdOutlineSync className="animate-spin text-base" /> : <FaSave size={14} />}
                        <span>{saving ? [t('saving')]: t('save')}</span>
                    </button>
                </div>

                {/* Right: Automated Formulas Output */}
                <div className="lg:col-span-6 bg-slate-800/90 border border-slate-700/80 p-6 rounded-[5px] shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-base pb-3 border-b border-slate-700 mb-4">
                            <FaChartBar /> <span>{t('automatedFormulas')}</span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-900/80 border border-slate-700/60">
                                <div>
                                    <span className="text-xs font-bold text-slate-200">{t('inquiredMessages')}</span>
                                    <p className="text-[10px] text-slate-400">{t('facebookPage')} + {t('telegram')} + {t('call')}</p>
                                </div>
                                <span className="font-mono font-bold text-lg text-cyan-300">
                                    {calculatedFormulas.totalInquiries || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-900/80 border border-slate-700/60">
                                <div>
                                    <span className="text-xs font-bold text-slate-200">{t('totalSubmits')}</span>
                                    <p className="text-[10px] text-slate-400">{t('pageSubmit')} + {t('telegramSubmit')} + {t('call')}</p>
                                </div>
                                <span className="font-mono font-bold text-lg text-emerald-400">
                                    {calculatedFormulas.totalSubmits || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-900/80 border border-slate-700/60">
                                <div>
                                    <span className="text-xs font-bold text-slate-200">{t('totalProcessed')}</span>
                                    <p className="text-[10px] text-slate-400">{t('noReply')} + {t('inquire')} + {t('rejectCs')} + {t('more')}</p>
                                </div>
                                <span className="font-mono font-bold text-lg text-amber-300">
                                    {calculatedFormulas.totalProcessed || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-900/80 border border-slate-700/60">
                                <div>
                                    <span className="text-xs font-bold text-slate-200">{t('totalSuccess')}</span>
                                    <p className="text-[10px] text-slate-400">{t('success')} 1 + {t('success')} 2</p>
                                </div>
                                <span className="font-mono font-bold text-lg text-teal-300">
                                    {calculatedFormulas.totalSuccess || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-[5px] bg-emerald-950/40 border border-emerald-800/40">
                                <div>
                                    <span className="text-xs font-bold text-emerald-300">{t('successRate')}</span>
                                    <p className="text-[10px] text-emerald-400/70">({t('totalSuccess')} / {t('totalSubmits')}) * 100</p>
                                </div>
                                <span className="font-mono font-bold text-xl text-emerald-400">
                                    {calculatedFormulas.conversionRate || '0.0%'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom: History Table */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-[5px] overflow-hidden shadow-xl p-5">
                <div className="flex items-center gap-2 text-slate-200 font-bold text-sm mb-4">
                    <FaHistory className="text-sky-400" />
                    <span>{t('history')} ({brand || '888MDM'})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-200">
                        <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                            <tr>
                                <th className="py-2.5 px-3">{t('date')}</th>
                                <th className="py-2.5 px-2 text-center">{t('facebookPage')}</th>
                                <th className="py-2.5 px-2 text-center">{t('telegramShort')}</th>
                                <th className="py-2.5 px-2 text-center">{t('noReply')}</th>
                                <th className="py-2.5 px-2 text-center">{t('inquire')}</th>
                                <th className="py-2.5 px-2 text-center">{t('rejectCs')}</th>
                                <th className="py-2.5 px-2 text-center">{t('more')}</th>
                                <th className="py-2.5 px-2 text-center text-emerald-400">{t('pageSubmit')}</th>
                                <th className="py-2.5 px-2 text-center text-emerald-400">{t('telegramSubmit')}</th>
                                <th className="py-2.5 px-2 text-center text-emerald-400">{t('call')}</th>
                                <th className="py-2.5 px-2 text-center">{t('inReview')}</th>
                                <th className="py-2.5 px-2 text-center text-rose-400">{t('reject')}</th>
                                <th className="py-2.5 px-2 text-center text-teal-400">{t('success')} 1</th>
                                <th className="py-2.5 px-2 text-center text-emerald-300">{t('success')} 2</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {historyList.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="text-center py-6 text-slate-500">
                                        {t('noData')}
                                    </td>
                                </tr>
                            ) : (
                                historyList.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="py-2 px-3 font-mono font-bold text-sky-400">{row.date}</td>
                                        <td className="py-2 px-2 text-center font-mono">{row.page || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono">{row.telegram || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono">{row.noReply || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono">{row.inquire || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-rose-400">{row.rejectCs || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono">{row.more || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.pageSubmit || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.telegramSubmit || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.call || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-amber-400">{row.review || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-rose-400">{row.reject || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-teal-400">{row.success1 || 0}</td>
                                        <td className="py-2 px-2 text-center font-mono text-emerald-300 font-bold">{row.success2 || 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FollowUp4DetailCard;
