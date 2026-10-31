import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBoxes, FaFilePdf, FaImage, FaPlus, FaPrint, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { storeImageFile } from '../../../utils/mediaUtils';
import './InventoryLocationPage.css';

const LOCATIONS = {
    'sen-sok': 'SEN SOK',
    'chbar-ampov': 'CHBAR AMPOV',
    'stueng-mean-chey': 'STUENG MEAN CHEY'
};

const InventoryLocationPage = ({ locationCode }) => {
    const { API_BASE1, API_BASE2, hasPermission, smartFetch } = useAuth();
    const { t, lang } = useLanguage();
    const currentLocation = useLocation();
    const apiBase = API_BASE1 || API_BASE2 || '/api';
    const permissionPath = `/inventory/${locationCode}`;
    const previewPath = `${permissionPath}/preview`;
    const isPreviewPage = currentLocation.pathname === previewPath;
    const locationName = LOCATIONS[locationCode];
    const printAreaRef = useRef(null);

    const [items, setItems] = useState([]);
    const [assetName, setAssetName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [feedback, setFeedback] = useState(null);

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const response = await smartFetch(`${apiBase}/inventory/${locationCode}`, { bypassCache: true });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || t('inventoryLoadFailed'));
            }
            setItems(Array.isArray(result.data) ? result.data : []);
            setFeedback(null);
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || t('inventoryLoadFailed') });
        } finally {
            setLoading(false);
        }
    }, [apiBase, locationCode, smartFetch, t]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const [imagePreviewUrl, setImagePreviewUrl] = useState('');

    useEffect(() => {
        if (!imageFile) {
            setImagePreviewUrl('');
            return undefined;
        }
        const previewUrl = URL.createObjectURL(imageFile);
        setImagePreviewUrl(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [imageFile]);

    const visibleItems = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase();
        if (!normalizedSearch) return items;
        return items.filter((item) => String(item.assetName || '').toLocaleLowerCase().includes(normalizedSearch));
    }, [items, search]);

    const totalQuantity = useMemo(
        () => items.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
        [items]
    );

    const canCreate = hasPermission(permissionPath, 'create');
    const canDelete = hasPermission(permissionPath, 'delete');
    const canExport = hasPermission(permissionPath, 'export') || hasPermission(permissionPath, 'print');

    const handleImageChange = (event) => {
        const file = event.target.files?.[0] || null;
        if (file && !file.type.startsWith('image/')) {
            setFeedback({ type: 'error', text: t('chooseImage') });
            setImageFile(null);
            event.target.value = '';
            return;
        }
        setImageFile(file);
        setFeedback(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const normalizedName = assetName.trim();
        const parsedQuantity = Number(quantity);
        if (!normalizedName || !Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
            setFeedback({ type: 'error', text: t('inventorySaveFailed') });
            return;
        }
        if (!imageFile) {
            setFeedback({ type: 'error', text: t('chooseImage') });
            return;
        }

        setSaving(true);
        setFeedback(null);
        try {
            const imageUrl = await storeImageFile(imageFile, 'cloudinary', apiBase);
            const response = await smartFetch(`${apiBase}/inventory/${locationCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetName: normalizedName, quantity: parsedQuantity, imageUrl })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || t('inventorySaveFailed'));
            }

            setItems((currentItems) => [result.data, ...currentItems]);
            setAssetName('');
            setQuantity('');
            setImageFile(null);
            form.reset();
            setFeedback({ type: 'success', text: t('inventorySaved') });
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || t('inventorySaveFailed') });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(t('confirmDeleteInventory'))) return;
        setDeletingId(item._id);
        setFeedback(null);
        try {
            const response = await smartFetch(`${apiBase}/inventory/${locationCode}/${encodeURIComponent(item._id)}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || t('inventoryDeleteFailed'));
            }
            setItems((currentItems) => currentItems.filter((entry) => entry._id !== item._id));
            setFeedback({ type: 'success', text: t('inventoryDeleted') });
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || t('inventoryDeleteFailed') });
        } finally {
            setDeletingId('');
        }
    };

    const handleExportPdf = async () => {
        if (!printAreaRef.current) return;
        setExporting(true);
        setFeedback(null);
        try {
            const images = Array.from(printAreaRef.current.querySelectorAll('img'));
            await Promise.all(images.map((image) => image.decode()));
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0.35,
                    filename: `inventory-${locationCode}-${new Date().toISOString().slice(0, 10)}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        ignoreElements: (element) => element.classList?.contains('inventory-no-print')
                    },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
                    pagebreak: { mode: ['css', 'legacy'] }
                })
                .from(printAreaRef.current)
                .save();
        } catch (error) {
            setFeedback({ type: 'error', text: `${t('inventoryPdfFailed')} ${error.message || ''}`.trim() });
        } finally {
            setExporting(false);
        }
    };

    const handlePrint = async () => {
        if (!printAreaRef.current) return;
        try {
            const images = Array.from(printAreaRef.current.querySelectorAll('img'));
            await Promise.all(images.map((image) => image.decode()));
            window.print();
        } catch (error) {
            setFeedback({ type: 'error', text: `${t('inventoryPrintFailed')} ${error.message || ''}`.trim() });
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : lang, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(date));
    };

    if (!locationName) return null;

    return (
        <main className="inventory-page-root inventory-page-enter h-full overflow-y-auto p-3 sm:p-5 lg:p-7">
            <div className="mx-auto max-w-7xl space-y-5">
                <nav aria-label={t('inventoryPages')} className="inventory-no-print flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <Link
                        to={permissionPath}
                        aria-current={!isPreviewPage ? 'page' : undefined}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                            !isPreviewPage
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        {t('inventoryEntryPage')}
                    </Link>
                    <Link
                        to={previewPath}
                        aria-current={isPreviewPage ? 'page' : undefined}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                            isPreviewPage
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        {t('inventoryPreviewPage')}
                    </Link>
                </nav>

                {feedback && (
                    <div
                        role="status"
                        className={`inventory-no-print inventory-feedback rounded-xl border px-4 py-3 text-sm font-medium ${
                            feedback.type === 'error'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                    >
                        {feedback.text}
                    </div>
                )}

                {!isPreviewPage && canCreate && (
                    <section className="inventory-no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                <FaPlus />
                            </span>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{t('addAsset')}</h2>
                                <p className="text-sm text-slate-500">{locationName}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.5fr)_minmax(220px,1fr)_auto] md:items-end">
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('inventoryAssetName')}</span>
                                <input
                                    value={assetName}
                                    onChange={(event) => setAssetName(event.target.value)}
                                    maxLength={160}
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                    placeholder={t('inventoryAssetName')}
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('inventoryQuantity')}</span>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                    min="1"
                                    max="1000000000"
                                    step="1"
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                    placeholder="0"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-slate-700">{t('inventoryPhoto')}</span>
                                <span className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50">
                                    {imagePreviewUrl
                                        ? <img src={imagePreviewUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                                        : <FaImage className="text-lg text-emerald-600" />}
                                    <span className="min-w-0 flex-1 truncate">{imageFile?.name || t('chooseImage')}</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FaPlus />
                                {saving ? t('loading') : t('addAsset')}
                            </button>
                        </form>
                    </section>
                )}

                {isPreviewPage && (
                <section ref={printAreaRef} className="inventory-print-area space-y-5 rounded-2xl">
                    <header className="inventory-heading overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg sm:p-7">
                        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">{t('inventory')}</p>
                                <h1 className="text-2xl font-black tracking-wide sm:text-3xl">{locationName}</h1>
                                <p className="mt-2 text-sm text-emerald-50">{t('inventoryList')}</p>
                            </div>
                            {canExport && (
                                <div className="inventory-no-print flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportPdf}
                                        disabled={exporting || loading}
                                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                        <FaFilePdf />
                                        {exporting ? t('loading') : t('exportPdf')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        disabled={loading}
                                        className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
                                    >
                                        <FaPrint />
                                        {t('inventoryPrint')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <article className="inventory-stat-card rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                            <p className="text-sm font-semibold text-slate-500">{t('totalAssets')}</p>
                            <p className="mt-2 text-3xl font-black text-emerald-700">{items.length.toLocaleString()}</p>
                        </article>
                        <article className="inventory-stat-card rounded-2xl border border-teal-100 bg-white p-4 shadow-sm sm:p-5">
                            <p className="text-sm font-semibold text-slate-500">{t('totalQuantity')}</p>
                            <p className="mt-2 text-3xl font-black text-teal-700">{totalQuantity.toLocaleString()}</p>
                        </article>
                    </div>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="inventory-no-print flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                                <FaBoxes className="text-emerald-600" />
                                {t('inventoryList')}
                            </h2>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white sm:max-w-xs"
                                placeholder={t('searchInventory')}
                            />
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-sm font-medium text-slate-500">{t('loadingInventory')}</div>
                        ) : visibleItems.length === 0 ? (
                            <div className="p-10 text-center text-sm text-slate-500">
                                {items.length ? t('noInventorySearchResults') : t('noInventoryItems')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="inventory-table w-full min-w-[680px] border-collapse text-left">
                                    <thead>
                                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                                            <th className="px-5 py-3">{t('inventoryPhoto')}</th>
                                            <th className="px-5 py-3">{t('inventoryAssetName')}</th>
                                            <th className="px-5 py-3 text-right">{t('inventoryQuantity')}</th>
                                            <th className="px-5 py-3">{t('inventoryDate')}</th>
                                            {canDelete && <th className="inventory-no-print px-5 py-3 text-center">{t('actions')}</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleItems.map((item) => (
                                            <tr key={item._id} className="inventory-table-row border-t border-slate-100 transition hover:bg-emerald-50/40">
                                                <td className="px-5 py-3">
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.assetName}
                                                        className="inventory-item-image h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 object-cover"
                                                    />
                                                </td>
                                                <td className="px-5 py-3 font-semibold text-slate-800">{item.assetName}</td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="inline-flex min-w-12 justify-center rounded-full bg-emerald-50 px-3 py-1 font-bold tabular-nums text-emerald-700">
                                                        {Number(item.quantity).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-xs text-slate-500">{formatDate(item.createdAt)}</td>
                                                {canDelete && (
                                                    <td className="inventory-no-print px-5 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(item)}
                                                            disabled={deletingId === item._id}
                                                            aria-label={`${t('delete')} ${item.assetName}`}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                                        >
                                                            <FaTrashAlt />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </section>
                )}
            </div>
        </main>
    );
};

export default InventoryLocationPage;
