import React, { useState } from 'react';
import { FaCheck, FaClock } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import { useLanguage } from '../../../context/LanguageContext';

const CashTransactionSubmissionChecklist = ({ onCancel, onComplete }) => {
    const { t } = useLanguage();
    const [stepIndex, setStepIndex] = useState(0);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const steps = [
        t('cashTransactionRecordedInSystem'),
        t('cashTransactionWrittenOnPaper'),
        t('cashTransactionReceiptPrinted')
    ];

    const handleDone = async () => {
        if (isCompleting) return;
        if (stepIndex < steps.length - 1) {
            setStepIndex(current => current + 1);
            setIsWaiting(false);
            return;
        }

        setIsCompleting(true);
        try {
            const saved = await onComplete();
            if (!saved) setIsCompleting(false);
        } catch (error) {
            console.error('Cash transaction checklist completion error:', error);
            setIsCompleting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-transaction-checklist-title"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 id="cash-transaction-checklist-title" className="text-base font-bold text-slate-900">
                            {t('cashTransactionChecklistTitle')}
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            {t('cashTransactionChecklistProgress')} {stepIndex + 1}/{steps.length}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-label={t('cancel')}
                    >
                        <MdClose size={20} />
                    </button>
                </header>

                <div className="p-5">
                    <div className="relative space-y-3">
                        {steps.slice(0, stepIndex).map((step, index) => (
                            <div key={index} className="relative flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-600">
                                    <FaCheck size={12} />
                                </span>
                                <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                                    <p className="text-xs font-semibold text-slate-700">{step}</p>
                                    <span className="mt-1 block text-[10px] font-bold uppercase text-emerald-700">
                                        {t('cashTransactionDone')}
                                    </span>
                                </div>
                            </div>
                        ))}

                        <div className="relative flex items-start gap-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isWaiting ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-indigo-300 bg-indigo-50 text-indigo-600'}`}>
                                {isWaiting ? <FaClock size={12} /> : <span className="text-xs font-bold">{stepIndex + 1}</span>}
                            </span>
                            <div className="flex-1 rounded-lg border border-indigo-200 bg-white px-4 py-4 shadow-sm">
                                <p className="text-sm font-bold leading-relaxed text-slate-800">{steps[stepIndex]}</p>
                                {isWaiting && (
                                    <p className="mt-2 text-xs font-medium text-amber-700">
                                        {t('cashTransactionWaiting')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isCompleting}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={() => isWaiting ? handleDone() : setIsWaiting(true)}
                        disabled={isCompleting}
                        className={`rounded-md px-5 py-2 text-xs font-bold text-white transition disabled:cursor-wait disabled:opacity-60 ${isWaiting ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isCompleting ? t('submit') : isWaiting ? t('cashTransactionDone') : t('cashTransactionWait')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CashTransactionSubmissionChecklist;
