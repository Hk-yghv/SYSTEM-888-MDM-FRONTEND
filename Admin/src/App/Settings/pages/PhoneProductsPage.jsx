import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FaPlus, FaTrashAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { readApiResponse } from '../../../utils/apiResponse';

const emptyCatalog = { products: [], defects: [] };
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50';
const modelsPerPage = 3;
const productsPerPage = 2;
const defectsPerPage = 1;
const statusesPerPage = 2;

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
    const [variantOptions, setVariantOptions] = useState([]);
    const [expandedModels, setExpandedModels] = useState(new Set());
    const [activeTab, setActiveTab] = useState('models');
    const [searchModel, setSearchModel] = useState('');
    const [modelPage, setModelPage] = useState(0);
    const [productPageByModel, setProductPageByModel] = useState({});
    const [defectPage, setDefectPage] = useState(0);
    const [statusPageByDefect, setStatusPageByDefect] = useState({});
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
            const models = Array.isArray(result.models) ? result.models : [];
            setModelOptions(models);

            const variants = Array.isArray(result.variants)
                ? result.variants.map((v) => (typeof v === 'string' ? v : v.name)).filter(Boolean)
                : [];
            setVariantOptions(variants);

            // Auto-expand the first model by default if models exist
            if (models.length > 0) {
                setExpandedModels(new Set([models[0]]));
            }

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

    // All unique models from modelOptions + any existing products in catalog
    const allModels = useMemo(() => {
        const fromOptions = Array.isArray(modelOptions) ? modelOptions : [];
        const fromCatalog = Array.isArray(catalog.products) ? catalog.products.map((p) => p.model).filter(Boolean) : [];
        return [...new Set([...fromOptions, ...fromCatalog])];
    }, [modelOptions, catalog.products]);

    const filteredModels = useMemo(() => {
        if (!searchModel.trim()) return allModels;
        const q = searchModel.toLowerCase();
        return allModels.filter((m) => m.toLowerCase().includes(q));
    }, [allModels, searchModel]);
    const modelPageCount = Math.ceil(filteredModels.length / modelsPerPage);
    const currentModelPage = Math.min(modelPage, Math.max(0, modelPageCount - 1));
    const visibleModels = filteredModels.slice(
        currentModelPage * modelsPerPage,
        (currentModelPage + 1) * modelsPerPage
    );
    const defectPageCount = Math.ceil(catalog.defects.length / defectsPerPage);
    const currentDefectPage = Math.min(defectPage, Math.max(0, defectPageCount - 1));

    const toggleModelExpand = (model) => {
        setExpandedModels((prev) => {
            return prev.has(model) ? new Set() : new Set([model]);
        });
    };

    const updateProduct = (id, field, value) => {
        setCatalog((current) => ({
            ...current,
            products: current.products.map((product) => product.id === id
                ? { ...product, [field]: value }
                : product)
        }));
    };

    // Add variant from droplist for a specific model
    const handleAddVariantToModel = (model, variantName) => {
        if (!variantName) return;
        const newProduct = {
            id: newId(),
            model,
            variant: variantName,
            capacityGb: 128,
            valuationPrice: 0,
            marketPrice: null
        };
        setCatalog((current) => ({
            ...current,
            products: [...current.products, newProduct]
        }));
        setExpandedModels((prev) => new Set([...prev, model]));
        setMessage('');
    };

    const handleAddCustomProductForModel = (model) => {
        const newProduct = {
            id: newId(),
            model,
            variant: variantOptions[0] || '',
            capacityGb: 128,
            valuationPrice: 0,
            marketPrice: null
        };
        setCatalog((current) => ({
            ...current,
            products: [...current.products, newProduct]
        }));
        setExpandedModels((prev) => new Set([...prev, model]));
        setMessage('');
    };

    const removeProduct = (id) => {
        const products = catalog.products.filter((item) => item.id !== id);
        setCatalog((current) => ({ ...current, products }));
    };

    // Calculate available droplist variants for a model:
    // If a variant is already priced (valuationPrice > 0), it disappears from the droplist.
    // If it has not been given a price, it still shows in the droplist.
    const getAvailableDroplistVariants = (model) => {
        const modelProducts = catalog.products.filter((p) => p.model === model);
        const pricedVariants = new Set(
            modelProducts
                .filter((p) => Number(p.valuationPrice) > 0)
                .map((p) => String(p.variant || '').trim())
        );
        return variantOptions.filter((v) => !pricedVariants.has(v));
    };

    const updateDefect = (defectId, field, value) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.map((defect) => defect.id === defectId
                ? { ...defect, [field]: value }
                : defect)
        }));
    };

    const updateDefectStatus = (defectId, statusId, field, value) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.map((defect) => defect.id === defectId
                ? {
                    ...defect,
                    statuses: (defect.statuses || []).map((status) => status.id === statusId
                        ? {
                            ...status,
                            [field]: value,
                            ...(field === 'minDeduction' && Number(value) > Number(status.maxDeduction)
                                ? { maxDeduction: Number(value) }
                                : {}),
                            ...(field === 'maxDeduction' && Number(value) < Number(status.minDeduction)
                                ? { minDeduction: Number(value) }
                                : {})
                        }
                        : status)
                }
                : defect)
        }));
    };

    const addDefect = () => {
        setDefectPage(0);
        setCatalog((current) => ({
            ...current,
            defects: [{
                id: newId(),
                name: '',
                statuses: [{
                    id: newId(),
                    name: '',
                    enabled: true,
                    minDeduction: 0,
                    maxDeduction: 0
                }]
            }, ...current.defects]
        }));
        setMessage('');
    };

    const addDefectStatus = (defectId) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.map((defect) => defect.id === defectId
                ? {
                    ...defect,
                    statuses: [...(defect.statuses || []), {
                        id: newId(),
                        name: '',
                        enabled: true,
                        minDeduction: 0,
                        maxDeduction: 0
                    }]
                }
                : defect)
        }));
    };

    const removeDefectStatus = (defectId, statusId) => {
        setCatalog((current) => ({
            ...current,
            defects: current.defects.map((defect) => defect.id === defectId
                ? { ...defect, statuses: (defect.statuses || []).filter((status) => status.id !== statusId) }
                : defect)
        }));
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
        <main className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 overflow-hidden p-2 md:p-3">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Phone Products</h1>
                    <p className="mt-0.5 text-xs text-slate-500">Manage valuation prices and product defect deductions.</p>
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
                    <button type="button" className={buttonClass} onClick={saveCatalog} disabled={saving}>
                        {saving ? 'Saving...' : 'Save settings'}
                    </button>
                </div>
            </header>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

            <div role="tablist" aria-label="Product settings sections" className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 sm:gap-2">
                <button
                    id="product-models-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'models'}
                    aria-controls="product-models-panel"
                    onClick={() => setActiveTab('models')}
                    className={`border-b-2 px-2 py-2 text-center text-xs font-semibold transition sm:px-4 sm:py-3 sm:text-sm ${
                        activeTab === 'models'
                            ? 'border-emerald-600 text-emerald-700'
                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                >
                    Models and Variant Valuation Prices
                </button>
                <button
                    id="product-defects-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'defects'}
                    aria-controls="product-defects-panel"
                    onClick={() => setActiveTab('defects')}
                    className={`border-b-2 px-2 py-2 text-center text-xs font-semibold transition sm:px-4 sm:py-3 sm:text-sm ${
                        activeTab === 'defects'
                            ? 'border-amber-600 text-amber-700'
                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                >
                    Product Defect Deductions
                </button>
            </div>

            {/* Section 1: Device Models and Variant Pricing Table */}
            <section
                id="product-models-panel"
                role="tabpanel"
                aria-labelledby="product-models-tab"
                tabIndex={0}
                hidden={activeTab !== 'models'}
                className={`${activeTab === 'models' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`}
            >
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:px-4">
                    <div className="text-xs text-slate-500">
                        Catalog: <span className="font-semibold text-slate-700">{selectedBrand || 'Global'}</span>. Select a model to configure variants.
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={searchModel}
                            onChange={(e) => {
                                setSearchModel(e.target.value);
                                setModelPage(0);
                            }}
                            placeholder="Filter model name..."
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                            {filteredModels.length} Models
                        </span>
                    </div>
                </div>

                {/* Models List Accordion / Table */}
                <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">
                    {visibleModels.map((model) => {
                        const modelProducts = catalog.products.filter((p) => p.model === model);
                        const isExpanded = expandedModels.has(model);
                        const droplistVariants = getAvailableDroplistVariants(model);
                        const productPageCount = Math.ceil(modelProducts.length / productsPerPage);
                        const currentProductPage = Math.min(productPageByModel[model] || 0, Math.max(0, productPageCount - 1));
                        const visibleProducts = modelProducts.slice(
                            currentProductPage * productsPerPage,
                            (currentProductPage + 1) * productsPerPage
                        );
                        const pricedCount = modelProducts.filter((p) => Number(p.valuationPrice) > 0).length;

                        // Calculate price range for model preview
                        const prices = modelProducts.map((p) => Number(p.valuationPrice)).filter((v) => v > 0);
                        const minPrice = prices.length ? Math.min(...prices) : 0;
                        const maxPrice = prices.length ? Math.max(...prices) : 0;
                        const priceDisplay = prices.length
                            ? (minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`)
                            : 'No price set';

                        return (
                            <div key={model} className="transition-colors hover:bg-slate-50/60">
                                {/* Model Header Row (clickable) */}
                                <div
                                    onClick={() => toggleModelExpand(model)}
                                    className="flex cursor-pointer items-center justify-between px-3 py-2 select-none"
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="text-slate-400 hover:text-slate-600 transition"
                                            aria-label={`Toggle ${model}`}
                                        >
                                            {isExpanded ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                                        </button>
                                        <div>
                                            <span className="font-bold text-slate-900 text-sm">{model}</span>
                                            <span className="ml-2 text-xs text-slate-500">
                                                ({modelProducts.length} {modelProducts.length === 1 ? 'variant/capacity' : 'variants/capacities'})
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pricedCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                            {pricedCount > 0 ? `${pricedCount} priced (${priceDisplay})` : 'Unpriced'}
                                        </span>
                                        <span className="text-xs text-emerald-700 font-semibold hover:underline">
                                            {isExpanded ? 'Hide variants' : 'View variants'}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Variants Sub-panel */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3">
                                        {/* Action Bar: Select from Variant Droplist or add custom */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <label className="text-xs font-bold text-slate-700">
                                                    Add Variant from Control System:
                                                </label>
                                                <select
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        const selected = e.target.value;
                                                        if (selected) {
                                                            handleAddVariantToModel(model, selected);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-semibold outline-none focus:border-emerald-500"
                                                >
                                                    <option value="" disabled>
                                                        {droplistVariants.length > 0
                                                            ? `Select variant (${droplistVariants.length} available)...`
                                                            : 'All variants are priced!'}
                                                    </option>
                                                    {droplistVariants.map((v) => (
                                                        <option key={v} value={v}>
                                                            {v}
                                                        </option>
                                                    ))}
                                                </select>
                                                {droplistVariants.length === 0 && (
                                                    <span className="text-xs text-emerald-700 font-medium">
                                                        ✓ All available variants configured
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleAddCustomProductForModel(model)}
                                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                                            >
                                                <FaPlus size={11} /> <span>Add capacity / custom row</span>
                                            </button>
                                        </div>

                                        {/* Variants Table for this model */}
                                        {modelProducts.length > 0 ? (
                                            <>
                                            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs lg:block">
                                                <table className="w-full min-w-[850px] text-left text-xs">
                                                    <thead className="bg-slate-100/80 uppercase text-[11px] text-slate-500 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-3.5 py-2.5">Variant</th>
                                                            <th className="px-3.5 py-2.5">Capacity (GB)</th>
                                                            <th className="px-3.5 py-2.5">Valuation Price ($)</th>
                                                            <th className="px-3.5 py-2.5">Khmer24 Market Price ($)</th>
                                                            <th className="px-3.5 py-2.5">40% Price ($)</th>
                                                            <th className="px-3.5 py-2.5 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {visibleProducts.map((product) => {
                                                            const mktPrice = product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice;
                                                            return (
                                                                <tr key={product.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-3.5 py-2.5 w-44">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <select
                                                                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                                                                value={product.variant}
                                                                                onChange={(e) => updateProduct(product.id, 'variant', e.target.value)}
                                                                            >
                                                                                {variantOptions.map((v) => (
                                                                                    <option key={v} value={v}>{v}</option>
                                                                                ))}
                                                                                {!variantOptions.includes(product.variant) && product.variant && (
                                                                                    <option value={product.variant}>{product.variant}</option>
                                                                                )}
                                                                            </select>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3.5 py-2.5 w-36">
                                                                        <div className="flex items-center gap-1">
                                                                            <input
                                                                                className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500"
                                                                                type="number"
                                                                                min="1"
                                                                                step="1"
                                                                                value={product.capacityGb}
                                                                                onChange={(e) => updateProduct(product.id, 'capacityGb', Number(e.target.value))}
                                                                            />
                                                                            <span className="text-slate-400 text-[11px]">GB</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3.5 py-2.5 w-44">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-slate-400 font-bold">$</span>
                                                                            <input
                                                                                className="w-32 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                value={product.valuationPrice}
                                                                                placeholder="0.00"
                                                                                onChange={(e) => updateProduct(product.id, 'valuationPrice', Number(e.target.value))}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3.5 py-2.5 w-48">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-slate-400">$</span>
                                                                            <input
                                                                                className="w-32 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500"
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                value={mktPrice ?? ''}
                                                                                placeholder="Optional"
                                                                                onChange={(e) => updateProduct(product.id, 'marketPrice', e.target.value === '' ? null : Number(e.target.value))}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3.5 py-2.5 font-bold text-emerald-700">
                                                                        {mktPrice == null ? '—' : `$${(Number(mktPrice) * 0.4).toFixed(2)}`}
                                                                    </td>
                                                                    <td className="px-3.5 py-2.5 text-center">
                                                                        <button
                                                                            type="button"
                                                                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded transition"
                                                                            aria-label={`Delete ${product.variant || 'variant'}`}
                                                                            onClick={() => removeProduct(product.id)}
                                                                        >
                                                                            <FaTrashAlt size={13} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="space-y-2 lg:hidden">
                                                {visibleProducts.map((product) => {
                                                    const marketPrice = product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice;
                                                    return (
                                                        <div key={product.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    className={`${inputClass} min-w-0 font-semibold`}
                                                                    value={product.variant}
                                                                    onChange={(event) => updateProduct(product.id, 'variant', event.target.value)}
                                                                    aria-label={`Variant for ${model}`}
                                                                >
                                                                    {variantOptions.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                                                                    {!variantOptions.includes(product.variant) && product.variant && (
                                                                        <option value={product.variant}>{product.variant}</option>
                                                                    )}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    className="shrink-0 rounded p-2 text-rose-500 hover:text-rose-700"
                                                                    aria-label={`Delete ${product.variant || 'variant'}`}
                                                                    onClick={() => removeProduct(product.id)}
                                                                >
                                                                    <FaTrashAlt size={13} />
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <label className="text-[11px] text-slate-500">
                                                                    Capacity (GB)
                                                                    <input
                                                                        className={`${inputClass} mt-1`}
                                                                        type="number"
                                                                        min="1"
                                                                        step="1"
                                                                        value={product.capacityGb}
                                                                        onChange={(event) => updateProduct(product.id, 'capacityGb', Number(event.target.value))}
                                                                    />
                                                                </label>
                                                                <label className="text-[11px] text-slate-500">
                                                                    Valuation Price ($)
                                                                    <input
                                                                        className={`${inputClass} mt-1`}
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={product.valuationPrice}
                                                                        onChange={(event) => updateProduct(product.id, 'valuationPrice', Number(event.target.value))}
                                                                    />
                                                                </label>
                                                                <label className="text-[11px] text-slate-500">
                                                                    Market Price ($)
                                                                    <input
                                                                        className={`${inputClass} mt-1`}
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={marketPrice ?? ''}
                                                                        placeholder="Optional"
                                                                        onChange={(event) => updateProduct(product.id, 'marketPrice', event.target.value === '' ? null : Number(event.target.value))}
                                                                    />
                                                                </label>
                                                                <div className="self-end pb-2 text-[11px] text-slate-500">
                                                                    40%: <span className="font-semibold text-emerald-700">
                                                                        {marketPrice == null ? '—' : `$${(Number(marketPrice) * 0.4).toFixed(2)}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {productPageCount > 1 && (
                                                <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                                    <span>{currentProductPage + 1} / {productPageCount}</span>
                                                    <button
                                                        type="button"
                                                        className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                                        disabled={currentProductPage === 0}
                                                        onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage - 1 }))}
                                                    >
                                                        Previous
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                                        disabled={currentProductPage >= productPageCount - 1}
                                                        onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage + 1 }))}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            )}
                                            </>
                                        ) : (
                                            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 text-xs">
                                                No variants configured for <span className="font-bold text-slate-700">{model}</span> yet. Select a variant from the droplist above to set prices.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredModels.length === 0 && (
                        <div className="p-10 text-center text-slate-500 text-sm">
                            {modelOptions.length === 0
                                ? 'No Device Models found for this brand. Add models in Control System → System Data (Device Models) first.'
                                : 'No models matched your search query.'}
                        </div>
                    )}
                </div>
                {modelPageCount > 1 && (
                    <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                        <span>
                            {currentModelPage * modelsPerPage + 1}–{Math.min((currentModelPage + 1) * modelsPerPage, filteredModels.length)} of {filteredModels.length} models
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                disabled={currentModelPage === 0}
                                onClick={() => setModelPage(currentModelPage - 1)}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                disabled={currentModelPage >= modelPageCount - 1}
                                onClick={() => setModelPage(currentModelPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Section 2: Product Defect Deductions Table with Internal Scroll */}
            <section
                id="product-defects-panel"
                role="tabpanel"
                aria-labelledby="product-defects-tab"
                tabIndex={0}
                hidden={activeTab !== 'defects'}
                className={`${activeTab === 'defects' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`}
            >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:px-4">
                    <div className="text-xs text-slate-500">
                        Deductions apply to all configured products.
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1.5 rounded-lg">
                            {catalog.defects.length} Defects
                        </span>
                        <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={addDefect}>
                            <FaPlus className="mr-1.5 inline" /> Add defect
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
                    {catalog.defects.slice(
                        currentDefectPage * defectsPerPage,
                        (currentDefectPage + 1) * defectsPerPage
                    ).map((defect) => {
                        const statuses = defect.statuses || [];
                        const statusPageCount = Math.ceil(statuses.length / statusesPerPage);
                        const currentStatusPage = Math.min(statusPageByDefect[defect.id] || 0, Math.max(0, statusPageCount - 1));
                        const visibleStatuses = statuses.slice(
                            currentStatusPage * statusesPerPage,
                            (currentStatusPage + 1) * statusesPerPage
                        );
                        return (
                                <div key={defect.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Defect Name:</span>
                                <input
                                    className={`${inputClass} font-semibold`}
                                    value={defect.name}
                                    maxLength={100}
                                    onChange={(event) => updateDefect(defect.id, 'name', event.target.value)}
                                    placeholder="e.g. Broken screen, Camera cracked, Battery degraded..."
                                />
                                <button type="button" className="shrink-0 text-rose-600 hover:text-rose-800 p-2" aria-label={`Delete ${defect.name || 'defect'}`} onClick={() => removeDefect(defect.id)}>
                                    <FaTrashAlt size={14} />
                                </button>
                            </div>

                            <div className="mt-3 space-y-2 pb-1">
                                {visibleStatuses.map((status) => (
                                    <div key={status.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(140px,1fr)_auto_110px_auto_110px_auto]">
                                        <input
                                            className={inputClass}
                                            value={status.name}
                                            maxLength={60}
                                            onChange={(event) => updateDefectStatus(defect.id, status.id, 'name', event.target.value)}
                                            placeholder="Status name (Minor, Moderate, Heavy...)"
                                            aria-label={`Status name for ${defect.name || 'defect'}`}
                                        />
                                        <button
                                            type="button"
                                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${status.enabled ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            onClick={() => updateDefectStatus(defect.id, status.id, 'enabled', !status.enabled)}
                                            aria-pressed={status.enabled}
                                        >
                                            {status.enabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400 font-bold">$</span>
                                            <input className={inputClass} type="number" min="0" step="0.01" value={status.minDeduction} onChange={(event) => updateDefectStatus(defect.id, status.id, 'minDeduction', Number(event.target.value))} aria-label={`Minimum deduction for ${status.name || 'status'}`} title="Minimum deduction" disabled={!status.enabled} />
                                        </div>
                                        <span className="text-center text-slate-400 font-bold">–</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400 font-bold">$</span>
                                            <input className={inputClass} type="number" min={status.minDeduction} step="0.01" value={status.maxDeduction} onChange={(event) => updateDefectStatus(defect.id, status.id, 'maxDeduction', Number(event.target.value))} aria-label={`Maximum deduction for ${status.name || 'status'}`} title="Maximum deduction" disabled={!status.enabled} />
                                        </div>
                                        <button type="button" className="justify-self-center text-rose-600 hover:text-rose-800 p-1" aria-label={`Delete ${status.name || 'status'}`} onClick={() => removeDefectStatus(defect.id, status.id)}>
                                            <FaTrashAlt size={13} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 mt-1 inline-flex items-center gap-1" onClick={() => addDefectStatus(defect.id)}>
                                    <FaPlus size={11} /> <span>Add status level</span>
                                </button>
                                {statusPageCount > 1 && (
                                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                        <span>{currentStatusPage + 1} / {statusPageCount} status pages</span>
                                        <button
                                            type="button"
                                            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                            disabled={currentStatusPage === 0}
                                            onClick={() => setStatusPageByDefect((current) => ({ ...current, [defect.id]: currentStatusPage - 1 }))}
                                        >
                                            Previous
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                            disabled={currentStatusPage >= statusPageCount - 1}
                                            onClick={() => setStatusPageByDefect((current) => ({ ...current, [defect.id]: currentStatusPage + 1 }))}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                            </div>
                        );
                    })}
                    {catalog.defects.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No defects configured yet. Click "Add defect" above.</p>}
                </div>
                {defectPageCount > 1 && (
                    <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                        <span>Defect {currentDefectPage + 1} of {defectPageCount}</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                disabled={currentDefectPage === 0}
                                onClick={() => setDefectPage(currentDefectPage - 1)}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
                                disabled={currentDefectPage >= defectPageCount - 1}
                                onClick={() => setDefectPage(currentDefectPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
};

export default PhoneProductsPage;
