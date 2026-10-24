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

                <div className="min-h-0 flex-1 overflow-hidden">
                    <div className="hidden h-full overflow-hidden xl:block">
                        <table className="w-full table-fixed text-left text-xs">
                            <thead className="bg-slate-100/80 text-[11px] uppercase text-slate-500">
                                <tr>
                                    <th className="w-[18%] px-3 py-2">Model</th>
                                    <th className="w-[16%] px-3 py-2">Variant</th>
                                    <th className="w-[12%] px-3 py-2">Capacity (GB)</th>
                                    <th className="w-[15%] px-3 py-2">Valuation ($)</th>
                                    <th className="w-[16%] px-3 py-2">Market ($)</th>
                                    <th className="w-[12%] px-3 py-2">40% Price</th>
                                    <th className="w-[8%] px-3 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            {visibleModels.map((model) => {
                                const modelProducts = catalog.products.filter((product) => product.model === model);
                                const isExpanded = expandedModels.has(model);
                                const droplistVariants = getAvailableDroplistVariants(model);
                                const productPageCount = Math.ceil(modelProducts.length / productsPerPage);
                                const currentProductPage = Math.min(productPageByModel[model] || 0, Math.max(0, productPageCount - 1));
                                const visibleProducts = modelProducts.slice(
                                    currentProductPage * productsPerPage,
                                    (currentProductPage + 1) * productsPerPage
                                );
                                const pricedCount = modelProducts.filter((product) => Number(product.valuationPrice) > 0).length;

                                return (
                                    <tbody key={model} className="divide-y divide-slate-100">
                                        <tr className="bg-slate-50">
                                            <td colSpan={7} className="px-3 py-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleModelExpand(model)}
                                                        className="flex items-center gap-2 text-left"
                                                        aria-expanded={isExpanded}
                                                    >
                                                        {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                                                        <span className="font-bold text-slate-900">{model}</span>
                                                        <span className="text-slate-500">{modelProducts.length} variants/capacities</span>
                                                        <span className={`rounded-full px-2 py-0.5 font-medium ${pricedCount > 0 ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                            {pricedCount} priced
                                                        </span>
                                                    </button>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <select
                                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                                                            value=""
                                                            aria-label={`Add variant for ${model}`}
                                                            onChange={(event) => {
                                                                if (event.target.value) handleAddVariantToModel(model, event.target.value);
                                                            }}
                                                        >
                                                            <option value="">Add variant...</option>
                                                            {droplistVariants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddCustomProductForModel(model)}
                                                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                        >
                                                            <FaPlus className="mr-1 inline" /> Add capacity
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && visibleProducts.map((product) => {
                                            const marketPrice = product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice;
                                            return (
                                                <tr key={product.id} className="hover:bg-slate-50/60">
                                                    <td className="px-3 py-2 pl-8 text-slate-500">{model}</td>
                                                    <td className="px-3 py-2">
                                                        <select
                                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800"
                                                            value={product.variant}
                                                            onChange={(event) => updateProduct(product.id, 'variant', event.target.value)}
                                                        >
                                                            {variantOptions.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                                                            {!variantOptions.includes(product.variant) && product.variant && <option value={product.variant}>{product.variant}</option>}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input className="w-full rounded border border-slate-200 px-2 py-1" type="number" min="1" step="1" value={product.capacityGb} onChange={(event) => updateProduct(product.id, 'capacityGb', Number(event.target.value))} />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input className="w-full rounded border border-slate-200 px-2 py-1 font-semibold" type="number" min="0" step="0.01" value={product.valuationPrice} onChange={(event) => updateProduct(product.id, 'valuationPrice', Number(event.target.value))} />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input className="w-full rounded border border-slate-200 px-2 py-1" type="number" min="0" step="0.01" value={marketPrice ?? ''} placeholder="Optional" onChange={(event) => updateProduct(product.id, 'marketPrice', event.target.value === '' ? null : Number(event.target.value))} />
                                                    </td>
                                                    <td className="px-3 py-2 font-semibold text-emerald-700">
                                                        {marketPrice == null ? 'N/A' : `$${(Number(marketPrice) * 0.4).toFixed(2)}`}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button type="button" className="rounded p-1.5 text-rose-500 hover:text-rose-700" aria-label={`Delete ${product.variant || 'variant'}`} onClick={() => removeProduct(product.id)}>
                                                            <FaTrashAlt size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {isExpanded && modelProducts.length === 0 && (
                                            <tr><td colSpan={7} className="px-4 py-4 text-center text-xs text-slate-500">No variants configured. Add one above.</td></tr>
                                        )}
                                        {isExpanded && productPageCount > 1 && (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-1.5 text-right text-xs text-slate-500">
                                                    <span className="mr-2">{currentProductPage + 1} / {productPageCount}</span>
                                                    <button type="button" className="mr-1 rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={currentProductPage === 0} onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage - 1 }))}>Previous</button>
                                                    <button type="button" className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={currentProductPage >= productPageCount - 1} onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage + 1 }))}>Next</button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>

                    <div className="h-full space-y-2 overflow-hidden xl:hidden">
                        {visibleModels.map((model) => {
                            const modelProducts = catalog.products.filter((product) => product.model === model);
                            const isExpanded = expandedModels.has(model);
                            const droplistVariants = getAvailableDroplistVariants(model);
                            const productPageCount = Math.ceil(modelProducts.length / productsPerPage);
                            const currentProductPage = Math.min(productPageByModel[model] || 0, Math.max(0, productPageCount - 1));
                            const visibleProducts = modelProducts.slice(currentProductPage * productsPerPage, (currentProductPage + 1) * productsPerPage);
                            return (
                                <section key={model} className="rounded-lg border border-slate-200 bg-white">
                                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2">
                                        <button type="button" onClick={() => toggleModelExpand(model)} className="flex items-center gap-2 text-left" aria-expanded={isExpanded}>
                                            {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                                            <span className="text-sm font-bold text-slate-900">{model}</span>
                                            <span className="text-[11px] text-slate-500">{modelProducts.length} rows</span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <select className="max-w-36 rounded border border-slate-200 bg-white px-2 py-1 text-xs" value="" aria-label={`Add variant for ${model}`} onChange={(event) => { if (event.target.value) handleAddVariantToModel(model, event.target.value); }}>
                                                <option value="">Add variant...</option>
                                                {droplistVariants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                                            </select>
                                            <button type="button" className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700" onClick={() => handleAddCustomProductForModel(model)}>+ Capacity</button>
                                        </div>
                                    </div>
                                    {isExpanded && <div className="space-y-2 p-2">
                                        {visibleProducts.map((product) => {
                                            const marketPrice = product.marketPrice !== undefined ? product.marketPrice : product.khmer24MarketPrice;
                                            return (
                                                <div key={product.id} className="space-y-2 rounded border border-slate-200 p-2">
                                                    <div className="flex items-center gap-2">
                                                        <select className={`${inputClass} min-w-0 font-semibold`} value={product.variant} onChange={(event) => updateProduct(product.id, 'variant', event.target.value)} aria-label={`Variant for ${model}`}>
                                                            {variantOptions.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                                                            {!variantOptions.includes(product.variant) && product.variant && <option value={product.variant}>{product.variant}</option>}
                                                        </select>
                                                        <button type="button" className="shrink-0 p-2 text-rose-500" aria-label={`Delete ${product.variant || 'variant'}`} onClick={() => removeProduct(product.id)}><FaTrashAlt size={13} /></button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <label className="text-[11px] text-slate-500">Capacity (GB)<input className={`${inputClass} mt-1`} type="number" min="1" step="1" value={product.capacityGb} onChange={(event) => updateProduct(product.id, 'capacityGb', Number(event.target.value))} /></label>
                                                        <label className="text-[11px] text-slate-500">Valuation ($)<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={product.valuationPrice} onChange={(event) => updateProduct(product.id, 'valuationPrice', Number(event.target.value))} /></label>
                                                        <label className="text-[11px] text-slate-500">Market ($)<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={marketPrice ?? ''} onChange={(event) => updateProduct(product.id, 'marketPrice', event.target.value === '' ? null : Number(event.target.value))} /></label>
                                                        <div className="self-end pb-2 text-[11px] text-slate-500">40%: <span className="font-semibold text-emerald-700">{marketPrice == null ? 'N/A' : `$${(Number(marketPrice) * 0.4).toFixed(2)}`}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {modelProducts.length === 0 && <p className="py-3 text-center text-xs text-slate-500">No variants configured yet.</p>}
                                        {productPageCount > 1 && <div className="flex items-center justify-end gap-2 text-xs text-slate-500"><span>{currentProductPage + 1} / {productPageCount}</span><button type="button" className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={currentProductPage === 0} onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage - 1 }))}>Previous</button><button type="button" className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={currentProductPage >= productPageCount - 1} onClick={() => setProductPageByModel((current) => ({ ...current, [model]: currentProductPage + 1 }))}>Next</button></div>}
                                    </div>}
                                </section>
                            );
                        })}
                    </div>

                    {filteredModels.length === 0 && (
                        <div className="p-10 text-center text-sm text-slate-500">
                            {modelOptions.length === 0
                                ? 'No Device Models found for this brand. Add models in Control System / System Data (Device Models) first.'
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
