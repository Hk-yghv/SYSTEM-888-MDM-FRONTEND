import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { readApiResponse } from '../../../utils/apiResponse';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const getDeductionOptions = (status) => {
    const min = Number(status.minDeduction || 0);
    const max = Number(status.maxDeduction ?? min);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) return [min];

    const step = Math.max(5, Math.ceil((range / 4) / 5) * 5);
    const values = [min];
    for (let value = min + step; value < max; value += step) {
        values.push(Number(value.toFixed(2)));
    }
    if (values[values.length - 1] !== max) values.push(max);
    return values;
};

const PhoneValuationPage = () => {
    const { API_BASE } = useAuth();
    const [catalog, setCatalog] = useState({ products: [], defects: [] });
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedStatusByDefect, setSelectedStatusByDefect] = useState({});
    const [selectedDeductionByDefect, setSelectedDeductionByDefect] = useState({});
    const [deductionRangeErrorByDefect, setDeductionRangeErrorByDefect] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/phone-products`, { cache: 'no-store' });
            const result = await readApiResponse(response, 'Unable to load phone products.');
            const products = Array.isArray(result.data?.products) ? result.data.products : [];
            const activeProducts = products.filter((item) => item.enabled !== false);
            setCatalog({
                products,
                defects: Array.isArray(result.data?.defects) ? result.data.defects : []
            });
            setSelectedProductId((current) => activeProducts.some((item) => item.id === current) ? current : activeProducts[0]?.id || '');
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => { loadCatalog(); }, [loadCatalog]);

    const activeProducts = useMemo(() => catalog.products.filter((item) => item.enabled !== false), [catalog.products]);
    const product = activeProducts.find((item) => item.id === selectedProductId);
    const modelOptions = useMemo(() => [...new Set(activeProducts.map((item) => item.model))], [activeProducts]);
    const variantOptions = useMemo(() => [...new Set(
        activeProducts
            .filter((item) => item.model === product?.model)
            .map((item) => String(item.variant || ''))
    )], [activeProducts, product?.model]);
    const capacityOptions = useMemo(() => [...new Set(activeProducts
        .filter((item) => item.model === product?.model && String(item.variant || '') === String(product?.variant || ''))
        .map((item) => item.capacityGb))], [activeProducts, product?.model, product?.variant]);
    const productDefects = catalog.defects;
    const selectedDefects = useMemo(() => productDefects
        .filter((item) => selectedStatusByDefect[item.id])
        .map((item) => {
            const status = item.statuses?.find((option) => (
                option.id === selectedStatusByDefect[item.id] && option.enabled
            ));
            if (!status) return null;
            const min = Number(status.minDeduction || 0);
            const max = Number(status.maxDeduction ?? min);
            const selectedAmount = selectedDeductionByDefect[item.id] ?? String(min);
            const amount = Number(selectedAmount);
            if (selectedAmount === '' || !Number.isFinite(amount) || amount < min || amount > max) return null;
            return { ...item, status, amount };
        })
        .filter(Boolean), [productDefects, selectedStatusByDefect, selectedDeductionByDefect]);
    const deduction = useMemo(() => selectedDefects
        .reduce((total, item) => total + item.amount, 0), [selectedDefects]);
    const finalValue = Math.max(0, Number(product?.valuationPrice || 0) - deduction);

    if (loading) return <div className="p-8 text-center text-black">Loading phone valuation...</div>;

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-4 text-black md:p-8">
            <header>
                <h1 className="text-2xl font-bold text-black">Phone Valuation</h1>
            </header>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-black">{error}</p>}
            {!error && activeProducts.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-black">
                    {catalog.products.length === 0
                        ? 'No phone products are configured yet. Ask an administrator to add them in Settings → Product.'
                        : 'No phone products are enabled. Ask an administrator to enable one in Settings → Product.'}
                </p>
            )}

            {activeProducts.length > 0 && (
                <>
                    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-3">
                            <label className="block text-sm font-semibold text-black">
                                Model
                                <select
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                    value={product?.model || ''}
                                    onChange={(event) => {
                                        const nextProduct = activeProducts.find((item) => item.model === event.target.value);
                                        setSelectedProductId(nextProduct?.id || '');
                                        setSelectedStatusByDefect({});
                                        setSelectedDeductionByDefect({});
                                        setDeductionRangeErrorByDefect({});
                                    }}
                                >
                                    {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                                </select>
                            </label>
                            <label className="block text-sm font-semibold text-black">
                                Variant
                                <select
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                    value={String(product?.variant || '')}
                                    onChange={(event) => {
                                        const nextProduct = activeProducts.find((item) => (
                                            item.model === product?.model && String(item.variant || '') === event.target.value
                                        ));
                                        setSelectedProductId(nextProduct?.id || '');
                                        setSelectedStatusByDefect({});
                                        setSelectedDeductionByDefect({});
                                        setDeductionRangeErrorByDefect({});
                                    }}
                                >
                                    {variantOptions.map((variant) => (
                                        <option key={variant || 'no-variant'} value={variant}>{variant || 'No variant'}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm font-semibold text-black">
                                Capacity (GB)
                                <select
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                    value={String(product?.capacityGb || '')}
                                    onChange={(event) => {
                                        const nextProduct = activeProducts.find((item) => (
                                            item.model === product?.model &&
                                            String(item.variant || '') === String(product?.variant || '') &&
                                            String(item.capacityGb) === event.target.value
                                        ));
                                        setSelectedProductId(nextProduct?.id || '');
                                        setSelectedStatusByDefect({});
                                        setSelectedDeductionByDefect({});
                                        setDeductionRangeErrorByDefect({});
                                    }}
                                >
                                    {capacityOptions.map((capacity) => (
                                        <option key={capacity} value={capacity}>{capacity} GB</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {product && (
                            <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-xs font-medium uppercase text-black">Valuation base price</p>
                                <p className="mt-1 text-xl font-bold text-black">{money(product.valuationPrice)}</p>
                            </div>
                        )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-bold text-black">Phone defects</h2>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {productDefects.map((defect) => {
                                const selectedStatus = defect.statuses?.find((status) => (
                                    status.id === selectedStatusByDefect[defect.id] && status.enabled
                                ));
                                const deductionOptions = selectedStatus ? getDeductionOptions(selectedStatus) : [];
                                const minDeduction = Number(selectedStatus?.minDeduction || 0);
                                const maxDeduction = Number(selectedStatus?.maxDeduction ?? minDeduction);
                                const selectedDeduction = selectedDeductionByDefect[defect.id] ?? String(minDeduction);

                                return (
                                <div key={defect.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3">
                                    <span className="text-sm font-medium text-black">{defect.name}</span>
                                    <div className="grid gap-2">
                                        <select
                                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-black outline-none focus:border-emerald-500"
                                            value={selectedStatusByDefect[defect.id] || ''}
                                            onChange={(event) => {
                                                setSelectedStatusByDefect((current) => ({
                                                    ...current,
                                                    [defect.id]: event.target.value
                                                }));
                                                const nextStatus = defect.statuses?.find((status) => status.id === event.target.value);
                                                setSelectedDeductionByDefect((current) => ({
                                                    ...current,
                                                    [defect.id]: event.target.value ? String(nextStatus?.minDeduction ?? 0) : ''
                                                }));
                                                setDeductionRangeErrorByDefect((current) => ({
                                                    ...current,
                                                    [defect.id]: ''
                                                }));
                                            }}
                                            aria-label={`Status of ${defect.name}`}
                                        >
                                            <option value="">No issue</option>
                                            {(defect.statuses || []).filter((status) => status.enabled).map((status) => (
                                                <option key={status.id} value={status.id}>{status.name}</option>
                                            ))}
                                        </select>
                                        {selectedStatus && (
                                            <div className="grid gap-2">
                                                <input
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500"
                                                    type="number"
                                                    min={minDeduction}
                                                    max={maxDeduction}
                                                    step="0.01"
                                                    list={`deduction-options-${defect.id}`}
                                                    value={selectedDeduction}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        const amount = Number(value);
                                                        setSelectedDeductionByDefect((current) => ({
                                                            ...current,
                                                            [defect.id]: value
                                                        }));
                                                        setDeductionRangeErrorByDefect((current) => ({
                                                            ...current,
                                                            [defect.id]: value !== '' && (
                                                                !Number.isFinite(amount) ||
                                                                amount < minDeduction ||
                                                                amount > maxDeduction
                                                            )
                                                                ? `Amount must be between ${money(minDeduction)} and ${money(maxDeduction)}.`
                                                                : ''
                                                        }));
                                                    }}
                                                    aria-label={`Deduction amount for ${defect.name}`}
                                                    aria-describedby={`deduction-range-${defect.id}`}
                                                />
                                                <datalist id={`deduction-options-${defect.id}`}>
                                                    {deductionOptions.map((amount) => (
                                                        <option key={amount} value={amount} label={money(amount)} />
                                                    ))}
                                                </datalist>
                                                <span id={`deduction-range-${defect.id}`} className="text-xs text-slate-600">
                                                    Allowed range: {money(minDeduction)}–{money(maxDeduction)}
                                                </span>
                                                {deductionRangeErrorByDefect[defect.id] && (
                                                    <span className="text-xs text-rose-700" role="alert">
                                                        {deductionRangeErrorByDefect[defect.id]}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {selectedStatusByDefect[defect.id] && selectedDefects.some((item) => item.id === defect.id) && (
                                            <span className="whitespace-nowrap text-xs font-semibold text-black">
                                                −{money(selectedDefects.find((item) => item.id === defect.id)?.amount)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                            {productDefects.length === 0 && <p className="text-sm text-black">No defect deductions are configured for this product.</p>}
                        </div>
                    </section>

                    {product && (
                        <section className="rounded-xl bg-emerald-50 p-5 text-black shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-black">Total defect deduction</p>
                                    <p className="mt-1 text-lg font-semibold text-black">−{money(deduction)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-black">Estimated phone value</p>
                                    <p className="mt-1 text-3xl font-bold text-black">{money(finalValue)}</p>
                                </div>
                            </div>
                        </section>
                    )}
                </>
            )}
        </main>
    );
};

export default PhoneValuationPage;
