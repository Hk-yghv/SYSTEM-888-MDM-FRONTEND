import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { readApiResponse } from '../../../utils/apiResponse';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const PhoneValuationPage = () => {
    const { API_BASE } = useAuth();
    const [catalog, setCatalog] = useState({ products: [], defects: [] });
    const [selectedProductId, setSelectedProductId] = useState('');
    const [defectSeverity, setDefectSeverity] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/phone-products`, { cache: 'no-store' });
            const result = await readApiResponse(response, 'Unable to load phone products.');
            const products = Array.isArray(result.data?.products) ? result.data.products : [];
            setCatalog({
                products,
                defects: Array.isArray(result.data?.defects) ? result.data.defects : []
            });
            setSelectedProductId((current) => products.some((item) => item.id === current) ? current : products[0]?.id || '');
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => { loadCatalog(); }, [loadCatalog]);

    const product = catalog.products.find((item) => item.id === selectedProductId);
    const selectedDefects = useMemo(() => catalog.defects
        .filter((item) => defectSeverity[item.id])
        .map((item) => {
            const min = Number(item.minDeduction ?? item.deduction ?? 0);
            const max = Number(item.maxDeduction ?? item.deduction ?? min);
            const severity = defectSeverity[item.id];
            const amount = severity === 'low' ? min : severity === 'high' ? max : (min + max) / 2;
            return { ...item, severity, amount };
        }), [catalog.defects, defectSeverity]);
    const deduction = useMemo(() => selectedDefects
        .reduce((total, item) => total + item.amount, 0), [selectedDefects]);
    const finalValue = Math.max(0, Number(product?.valuationPrice || 0) - deduction);
    const toggleDefect = (id) => setSelectedDefects((current) => (
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));

    if (loading) return <div className="p-8 text-center text-slate-500">Loading phone valuation...</div>;

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Phone Valuation</h1>
                <p className="mt-1 text-sm text-slate-500">Select a configured model and defects to calculate its valuation.</p>
            </header>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {!error && catalog.products.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No phone products are configured yet. Ask an administrator to add them in Settings → Product.</p>
            )}

            {catalog.products.length > 0 && (
                <>
                    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <label className="block text-sm font-semibold text-slate-700">
                            Phone model / variant / capacity
                            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value); setDefectSeverity({}); }}>
                                {catalog.products.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.model}{item.variant ? ` · ${item.variant}` : ''} · ${item.capacityGb} GB
                                    </option>
                                ))}
                            </select>
                        </label>

                        {product && (
                            <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-xs font-medium uppercase text-slate-500">Valuation base price</p>
                                <p className="mt-1 text-xl font-bold text-slate-800">{money(product.valuationPrice)}</p>
                            </div>
                        )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-bold text-slate-800">Phone defects</h2>
                        <p className="mt-1 text-sm text-slate-500">Choose how severe each issue is. Low uses the minimum deduction, medium uses the midpoint, and high uses the maximum.</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {catalog.defects.map((defect) => (
                                <div key={defect.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                                    <span className="text-sm font-medium text-slate-700">{defect.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="whitespace-nowrap text-xs text-slate-500">
                                            {money(defect.minDeduction ?? defect.deduction ?? 0)}–{money(defect.maxDeduction ?? defect.deduction ?? 0)}
                                        </span>
                                        {defectSeverity[defect.id] && (
                                            <span className="whitespace-nowrap text-xs font-semibold text-rose-600">
                                                −{money(selectedDefects.find((item) => item.id === defect.id)?.amount)}
                                            </span>
                                        )}
                                        <select
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-500"
                                            value={defectSeverity[defect.id] || ''}
                                            onChange={(event) => setDefectSeverity((current) => ({
                                                ...current,
                                                [defect.id]: event.target.value
                                            }))}
                                            aria-label={`Severity of ${defect.name}`}
                                        >
                                            <option value="">គ្មាន</option>
                                            <option value="low">តិច</option>
                                            <option value="medium">មធ្យម</option>
                                            <option value="high">ខ្លាំង</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                            {catalog.defects.length === 0 && <p className="text-sm text-slate-500">No defect deductions are configured.</p>}
                        </div>
                    </section>

                    {product && (
                        <section className="rounded-xl bg-emerald-700 p-5 text-white shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-emerald-100">Total defect deduction</p>
                                    <p className="mt-1 text-lg font-semibold">−{money(deduction)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-emerald-100">Estimated phone value</p>
                                    <p className="mt-1 text-3xl font-bold">{money(finalValue)}</p>
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
