import { useEffect, useRef, useState } from 'react';
import { FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

const DateRangeDropdown = ({
    from = '',
    to = '',
    onApplyRange,
    onClear,
    label,
}) => {
    const { t } = useLanguage();
    const defaultLabel = label || t('date');
    const [open, setOpen] = useState(false);
    const [draftFrom, setDraftFrom] = useState(from);
    const [draftTo, setDraftTo] = useState(to);
    const rootRef = useRef(null);

    useEffect(() => {
        if (open) {
            setDraftFrom(from);
            setDraftTo(to);
        }
    }, [open, from, to]);

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const hasRange = Boolean(from || to);
    const invalidRange = Boolean(draftFrom && draftTo && draftFrom > draftTo);
    const buttonLabel = from && to ? `${from} - ${to}` : from ? `${t('fromDate')} ${from}` : to ? `${t('toDate')} ${to}` : defaultLabel;

    const clearRange = () => {
        onApplyRange('', '');
        onClear?.();
        setOpen(false);
    };

    return (
        <div ref={rootRef} className={`relative inline-flex ${open ? 'z-100' : 'z-10'}`}>
            <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-[5px] border px-3 py-2 text-xs font-semibold transition-colors ${hasRange ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
                <FaCalendarAlt className="shrink-0 text-emerald-600" />
                <span>{buttonLabel}</span>
                <FaChevronDown className={`shrink-0 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={defaultLabel}
                    className="absolute right-0 top-full z-100 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[5px] border border-slate-200 bg-white p-2 shadow-xl"
                >
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-slate-600">
                            {t('fromDate')}
                            <input
                                type="date"
                                value={draftFrom}
                                onChange={(event) => setDraftFrom(event.target.value)}
                                className="min-w-0 rounded-[5px] border border-slate-300 px-2 py-2 text-xs text-slate-800"
                            />
                        </label>
                        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-slate-600">
                            {t('toDate')}
                            <input
                                type="date"
                                value={draftTo}
                                onChange={(event) => setDraftTo(event.target.value)}
                                className="min-w-0 rounded-[5px] border border-slate-300 px-2 py-2 text-xs text-slate-800"
                            />
                        </label>
                    </div>
                    {invalidRange && <p className="mt-2 text-[11px] text-rose-600">{t('fromDate')} &le; {t('toDate')}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={clearRange}
                            className="rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                            {t('clear')}
                        </button>
                        <button
                            type="button"
                            disabled={invalidRange}
                            onClick={() => {
                                onApplyRange(draftFrom, draftTo);
                                setOpen(false);
                            }}
                            className="rounded-[5px] bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t('apply')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeDropdown;
