import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import { readApiResponse } from '../../../utils/apiResponse';

const emptyCatalog = { products: [], defects: [] };
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50';

const PhoneProductsPage = () => {
    const { API_BASE, user } = useAuth();
    const isMasterAdmin = Boolean(
        user?.username === '@hakyonghouv' ||
        user?.username === 'hakyonghouv' ||
        user?.isImmutable ||
        user?.role === 'Administrator' ||
        user?.role === 'Admin'
    );
    const [selectedBrand, setSelectedBrand] = useState(String(user?.brand || '').trim());
    const [brandOptions, setBrandOptions] = useState([]);
    const [catalog, setCatalog] = useState(emptyCatalog);
    const [modelOptions, setModelOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const loadBrandOptions = useCallback(async () => {
        if (!isMasterAdmin) {
            setBrandOptions([]);
            setSelectedBrand(String(user?.brand || '').trim());
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/controlsystem?brand=`, { cache: 'no-store' });
            const result = await readApiResponse(response, 'Unable to load brands.');
            const brands = result.droplists?.find((item) => item.category === 'Brands')?.items || [];
            setBrandOptions([...new Set(['', ...brands.map((brand) => String(brand || '').trim()).filter(Boolean)])]);
        } catch (loadError) {
            setError(loadError.message);
        }
    }, [API_BASE, isMasterAdmin, user?.brand]);

    useEffect(() => { loadBrandOptions(); }, [loadBrandOptions]);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/phone-products?brand=${encodeURIComponent(selectedBrand)}`, { cache: 'no-store' });
            const result = await readApiResponse(response, 'Unable to load product data.');
            const products = Array.isArray(result.data?.products) ? result.data.products : [];
            setCatalog({
                products,
                defects: Array.isArray(result.data?.defects) ? result.data.defects : []
            });
            setModelOptions(Array.isArray(result.models) ? result.models : []);
            if (!isMasterAdmin && result.brand !== undefined) {
                setSelectedBrand(String(result.brand || '').trim());
            }
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [API_BASE, isMasterAdmin, selectedBrand]);

    useEffect(() => { loadCatalog(); }, [loadCatalog]);

    const updateProduct = (id, field, value) => {
        setCatalog((current) => ({
            ...current,
            products: current.products.map((product) => product.id === id
                ? { ...product, [field]: value }
                : product)
        }));
    };

    const addProduct = () => {
        const product = {
            id: newId(),
            model: modelOptions[0] || '',
            variant: '',
            capacityGb: 128,
            valuationPrice: 0,
            marketPrice: null
        };
        setCatalog((current) => ({
            ...current,
            products: [...current.products, product]
        }));
        setMessage('');
    };

    const removeProduct = (id) => {
        const products = catalog.products.filter((item) => item.id !== id);
        setCatalog((current) => ({ ...current, products }));
    };

    const updateDefect = (defectId, field, value) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.map((defect) => defect.id === defectId
                ? {
                    ...defect,
                    [field]: value,
                    ...(field === 'minDeduction' && Number(value) > Number(defect.maxDeduction)
                        ? { maxDeduction: Number(value) }
                        : {}),
                    ...(field === 'maxDeduction' && Number(value) < Number(defect.minDeduction)
                        ? { minDeduction: Number(value) }
                        : {})
                }
                : defect)
        }));
    };

    const addDefect = () => {
        setCatalog((current) => ({
            ...current,
            defects: [...current.defects, { id: newId(), name: '', minDeduction: 0, maxDeduction: 0 }]
        }));
        setMessage('');
    };

    const removeDefect = (defectId) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.filter((defect) => defect.id !== defectId)
        }));
    };

    const saveCatalog = async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const response = await fetch(`${API_BASE}/phone-products`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...catalog, brand: selectedBrand })
            });
            const result = await readApiResponse(response, 'Unable to save product data.');
            setCatalog({
                products: result.data.products || [],
                defects: result.data.defects || []
            });
            if (!isMasterAdmin && result.brand !== undefined) {
                setSelectedBrand(String(result.brand || '').trim());
            }
            setMessage('Product settings saved.');
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading product settings...</div>;
    }

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Phone Products</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage models, variants, capacities, valuation prices, manually entered market prices, and defect deductions.</p>
                </div>
                {isMasterAdmin && (
                    <label className="min-w-52 text-sm font-semibold text-slate-700">
                        Brand
                        <select className={`${inputClass} mt-1`} value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
                            <option value="">Global</option>
                            {brandOptions.filter(Boolean).map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                    </label>
                )}
                <div className="flex gap-2">
                    <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={addProduct} disabled={!modelOptions.length}>
                        <FaPlus className="mr-2 inline" /> Add model
                    </button>
                    <button type="button" className={buttonClass} onClick={saveCatalog} disabled={saving}>
                        {saving ? 'Saving...' : 'Save settings'}
                    </button>
                </div>
            </header>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="font-bold text-slate-800">Models and valuation prices</h2>
                    <p className="mt-1 text-xs text-slate-500">Catalog: {selectedBrand || 'Global'}. Select models from this brand's Device Models list. LL/A, ZA, and other market variants are stored separately.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Model</th>
                                <th className="px-4 py-3">Variant</th>
                                <th className="px-4 py-3">Capacity (GB)</th>
                                <th className="px-4 py-3">Valuation price ($)</th>
                                <th className="px-4 py-3">Khmer24 market price ($)</th>
                                <th className="px-4 py-3">40% price ($)</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {catalog.products.map((product) => (
                                <tr key={product.id}>
                                    <td className="px-4 py-3">
                                        <select className={inputClass} value={product.model} onChange={(event) => updateProduct(product.id, 'model', event.target.value)}>
                                            <option value="">Select model</option>
                                            {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3"><input className={inputClass} value={product.variant} maxLength={40} onChange={(event) => updateProduct(product.id, 'variant', event.target.value)} placeholder="LL/A, ZA, Global..." /></td>
                                    <td className="px-4 py-3"><input className={inputClass} type="number" min="1" step="1" value={product.capacityGb} onChange={(event) => updateProduct(product.id, 'capacityGb', Number(event.target.value))} /></td>
                                    <td className="px-4 py-3"><input className={inputClass} type="number" min="0" step="0.01" value={product.valuationPrice} onChange={(event) => updateProduct(product.id, 'valuationPrice', Number(event.target.value))} /></td>
                                    <td className="px-4 py-3">
                                        <input
                                            className={inputClass}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={(product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice) ?? ''}
                                            onChange={(event) => updateProduct(product.id, 'marketPrice', event.target.value === '' ? null : Number(event.target.value))}
                                            aria-label={`Manually entered Khmer24 market price for ${product.model || 'product'}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-emerald-700">
                                        {(product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice) == null
                                            ? '—'
                                            : `$${(Number(product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice) * 0.4).toFixed(2)}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button type="button" className="text-rose-600 hover:text-rose-800" aria-label={`Delete ${product.model || 'product'}`} onClick={() => removeProduct(product.id)}>
                                            <FaTrashAlt />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {catalog.products.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">{modelOptions.length ? 'No products configured. Add a model to begin.' : 'No Device Models are configured for this brand. Add them in Control System → System Data first.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="font-bold text-slate-800">Product defect deductions</h2>
                        <p className="mt-1 text-xs text-slate-500">These defects and deduction ranges apply to every model, variant, and capacity. Valuation uses the minimum for low, midpoint for medium, and maximum for high severity.</p>
                    </div>
                    <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={addDefect}>
                        <FaPlus className="mr-2 inline" /> Add defect
                    </button>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {catalog.defects.map((defect) => (
                        <div key={defect.id} className="flex items-center gap-2">
                            <input className={inputClass} value={defect.name} maxLength={100} onChange={(event) => updateDefect(defect.id, 'name', event.target.value)} placeholder="Broken screen / Service Google" />
                            <input className={`${inputClass} max-w-28`} type="number" min="0" step="0.01" value={defect.minDeduction ?? defect.deduction ?? 0} onChange={(event) => updateDefect(defect.id, 'minDeduction', Number(event.target.value))} aria-label={`Minimum deduction for ${defect.name || 'defect'}`} title="Minimum deduction" />
                            <span className="text-slate-400">–</span>
                            <input className={`${inputClass} max-w-28`} type="number" min={defect.minDeduction ?? defect.deduction ?? 0} step="0.01" value={defect.maxDeduction ?? defect.deduction ?? 0} onChange={(event) => updateDefect(defect.id, 'maxDeduction', Number(event.target.value))} aria-label={`Maximum deduction for ${defect.name || 'defect'}`} title="Maximum deduction" />
                            <button type="button" className="shrink-0 text-rose-600" aria-label={`Delete ${defect.name || 'defect'}`} onClick={() => removeDefect(defect.id)}>
                                <FaTrashAlt />
                            </button>
                        </div>
                    ))}
                    {catalog.defects.length === 0 && <p className="text-sm text-slate-500">No defects configured.</p>}
                </div>
            </section>
        </main>
    );
};

export default PhoneProductsPage;
