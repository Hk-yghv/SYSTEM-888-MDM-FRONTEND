import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { readApiResponse } from '../../../utils/apiResponse';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const PhoneValuationPage = () => {
    const { API_BASE } = useAuth();
    const [catalog, setCatalog] = useState({ products: [], defects: [] });
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedDefects, setSelectedDefects] = useState([]);
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
    const deduction = useMemo(() => catalog.defects
        .filter((item) => selectedDefects.includes(item.id))
        .reduce((total, item) => total + Number(item.deduction || 0), 0), [catalog.defects, selectedDefects]);
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
                            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value); setSelectedDefects([]); }}>
                                {catalog.products.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.model}{item.variant ? ` · ${item.variant}` : ''} · ${item.capacityGb} GB
                                    </option>
                                ))}
                            </select>
                        </label>

                        {product && (
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium uppercase text-slate-500">Valuation base price</p>
                                    <p className="mt-1 text-xl font-bold text-slate-800">{money(product.valuationPrice)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-slate-500">Khmer24 market price</p>
                                    <p className="mt-1 text-xl font-bold text-blue-700">{product.khmer24MarketPrice == null ? 'Not synced' : money(product.khmer24MarketPrice)}</p>
                                    {product.khmer24MarketPrice != null && <p className="text-xs text-slate-500">40% reference: {money(Number(product.khmer24MarketPrice) * 0.4)}</p>}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-bold text-slate-800">Phone defects</h2>
                        <p className="mt-1 text-sm text-slate-500">Select each issue found. Its deduction is subtracted from the base price.</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {catalog.defects.map((defect) => (
                                <label key={defect.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                                    <span className="flex items-center gap-3 text-sm text-slate-700">
                                        <input type="checkbox" checked={selectedDefects.includes(defect.id)} onChange={() => toggleDefect(defect.id)} className="h-4 w-4 accent-emerald-600" />
                                        {defect.name}
                                    </span>
                                    <span className="text-sm font-semibold text-rose-600">−{money(defect.deduction)}</span>
                                </label>
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
