import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBoxes, FaEdit, FaFilePdf, FaImage, FaPlus, FaSave, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { storeImageFile } from '../../../utils/mediaUtils';
import khmerFontUrl from '../../../assets/font/font_khmer.ttf?url';
import './InventoryLocationPage.css';

const LOCATIONS = {
    'sen-sok': 'SEN SOK',
    'chbar-ampov': 'CHBAR AMPOV',
    'stueng-mean-chey': 'STUENG MEAN CHEY'
};

const wrapCanvasText = (context, value, maxWidth, maxLines) => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return [''];

    const segments = typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
        : Array.from(text);
    const lines = [];
    let currentLine = '';

    for (const segment of segments) {
        const candidate = currentLine + segment;
        if (currentLine && context.measureText(candidate).width > maxWidth) {
            if (lines.length === maxLines - 1) {
                let lastLine = currentLine.trimEnd();
                while (lastLine && context.measureText(`${lastLine}…`).width > maxWidth) {
                    lastLine = Array.from(lastLine).slice(0, -1).join('');
                }
                lines.push(`${lastLine}…`);
                return lines;
            }
            lines.push(currentLine.trimEnd());
            currentLine = segment.trimStart();
        } else {
            currentLine = candidate;
        }
    }

    if (currentLine) lines.push(currentLine.trimEnd());
    return lines.slice(0, maxLines);
};

const InventoryLocationPage = ({ locationCode }) => {
    const { API_BASE1, API_BASE2, hasPermission, smartFetch } = useAuth();
    const { t, lang } = useLanguage();
    const currentLocation = useLocation();
    const navigate = useNavigate();
    const apiBase = API_BASE1 || API_BASE2 || '/api';
    const permissionPath = `/inventory/${locationCode}`;
    const previewPath = `${permissionPath}/preview`;
    const isPreviewPage = currentLocation.pathname === previewPath;
    const locationName = LOCATIONS[locationCode];
    const [items, setItems] = useState([]);
    const [assetName, setAssetName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState('');
    const [editingId, setEditingId] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [pdfOrientation, setPdfOrientation] = useState('landscape');
    const [deletingId, setDeletingId] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const response = await smartFetch(`${apiBase}/inventory/${locationCode}`);
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

    useEffect(() => {
        if (!imageFile) {
            setImagePreviewUrl('');
            return undefined;
        }
        const previewUrl = URL.createObjectURL(imageFile);
        setImagePreviewUrl(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [imageFile]);

    useEffect(() => {
        const item = currentLocation.state?.editItem;
        if (isPreviewPage || !item) return;
        setEditingId(item._id);
        setAssetName(item.assetName || '');
        setQuantity(String(item.quantity || ''));
        setExistingImageUrl(item.imageUrl || '');
        setImageFile(null);
        setFeedback(null);
        navigate(permissionPath, { replace: true, state: null });
    }, [currentLocation.state, isPreviewPage, navigate, permissionPath]);

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
    const canEdit = hasPermission(permissionPath, 'edit');
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
        if (!imageFile && !existingImageUrl) {
            setFeedback({ type: 'error', text: t('chooseImage') });
            return;
        }

        setSaving(true);
        setFeedback(null);
        try {
            const imageUrl = imageFile
                ? await storeImageFile(imageFile, 'cloudinary', apiBase)
                : existingImageUrl;
            const response = await smartFetch(
                editingId
                    ? `${apiBase}/inventory/${locationCode}/${encodeURIComponent(editingId)}`
                    : `${apiBase}/inventory/${locationCode}`,
                {
                    method: editingId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assetName: normalizedName, quantity: parsedQuantity, imageUrl })
                }
            );
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || t(editingId ? 'inventoryUpdateFailed' : 'inventorySaveFailed'));
            }

            setItems((currentItems) => editingId
                ? currentItems.map((item) => item._id === editingId ? result.data : item)
                : [result.data, ...currentItems]);
            setAssetName('');
            setQuantity('');
            setImageFile(null);
            setExistingImageUrl('');
            setEditingId('');
            form.reset();
            setFeedback({ type: 'success', text: t(editingId ? 'inventoryUpdated' : 'inventorySaved') });
        } catch (error) {
            setFeedback({
                type: 'error',
                text: error.message || t(editingId ? 'inventoryUpdateFailed' : 'inventorySaveFailed')
            });
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        setEditingId('');
        setAssetName('');
        setQuantity('');
        setImageFile(null);
        setExistingImageUrl('');
        setFeedback(null);
        navigate(permissionPath, { replace: true, state: null });
    };

    const handleEdit = (item) => {
        navigate(permissionPath, { state: { editItem: item } });
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
        setExporting(true);
        setFeedback(null);
        try {
            const pdfItems = await Promise.all(visibleItems.map(async (item) => {
                if (!item.imageUrl) return { ...item, pdfImageUrl: '' };
                if (String(item.imageUrl || '').startsWith('data:image/')) {
                    return { ...item, pdfImageUrl: item.imageUrl };
                }
                const imageResponse = await smartFetch(
                    `${apiBase}/media/to-base64?url=${encodeURIComponent(item.imageUrl)}`,
                    { bypassCache: true }
                );
                const imageResult = await imageResponse.json();
                if (!imageResponse.ok || !imageResult.success || !String(imageResult.base64 || '').startsWith('data:image/')) {
                    throw new Error(imageResult.error || t('inventoryImageExportFailed'));
                }
                return { ...item, pdfImageUrl: imageResult.base64 };
            }));

            const imageObjects = await Promise.all(pdfItems.map(async (item) => {
                if (!item.pdfImageUrl) return null;
                const image = new Image();
                image.src = item.pdfImageUrl;
                await image.decode();
                return image;
            }));
            const fontFace = new FontFace('InventoryKhmer', `url("${khmerFontUrl}")`);
            await fontFace.load();
            document.fonts.add(fontFace);
            await document.fonts.load('16px InventoryKhmer');

            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4', compress: true });
            const isPortrait = pdfOrientation === 'portrait';
            const pageWidth = isPortrait ? 210 : 297;
            const pageHeight = isPortrait ? 297 : 210;
            const pageMargin = 12;
            const contentWidth = pageWidth - pageMargin * 2;
            const tableLayout = isPortrait
                ? { photoCenter: 24, nameX: 38, nameWidth: 82, quantityCenter: 132, dateCenter: 174, dateWidth: 44 }
                : { photoCenter: 25, nameX: 44, nameWidth: 124, quantityCenter: 189.5, dateCenter: 246, dateWidth: 70 };
            const pixelsPerMm = 6;
            const canvas = document.createElement('canvas');
            canvas.width = pageWidth * pixelsPerMm;
            canvas.height = pageHeight * pixelsPerMm;
            const context = canvas.getContext('2d');
            if (!context) throw new Error(t('inventoryPdfFailed'));

            const firstPageSize = isPortrait ? 9 : 5;
            const continuationPageSize = isPortrait ? 10 : 7;
            const pageCount = pdfItems.length <= firstPageSize
                ? 1
                : 1 + Math.ceil((pdfItems.length - firstPageSize) / continuationPageSize);
            const mm = (value) => value * pixelsPerMm;
            const drawPage = (pageIndex) => {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.textBaseline = 'middle';
                const isFirstPage = pageIndex === 0;
                if (isFirstPage) {
                    context.fillStyle = '#047857';
                    context.font = `bold ${mm(7)}px InventoryKhmer, Arial, sans-serif`;
                    context.fillText(locationName, mm(12), mm(18));

                    context.fillStyle = '#64748b';
                    context.font = `${mm(4)}px InventoryKhmer, Arial, sans-serif`;
                    context.fillText(t('inventoryList'), mm(12), mm(29));

                    const quantityTotal = pdfItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                    context.fillStyle = '#ecfdf5';
                    context.fillRect(mm(pageMargin), mm(37), mm(contentWidth), mm(12));
                    context.fillStyle = '#065f46';
                    context.font = `${mm(3.8)}px InventoryKhmer, Arial, sans-serif`;
                    context.fillText(
                        `${t('totalAssets')}: ${pdfItems.length.toLocaleString()}   |   ${t('totalQuantity')}: ${quantityTotal.toLocaleString()}`,
                        mm(16),
                        mm(43)
                    );
                }

                const tableHeaderTop = isFirstPage ? 56 : 12;
                context.fillStyle = '#047857';
                context.fillRect(mm(pageMargin), mm(tableHeaderTop), mm(contentWidth), mm(11));
                context.fillStyle = '#ffffff';
                context.font = `bold ${mm(3.5)}px InventoryKhmer, Arial, sans-serif`;
                context.textAlign = 'left';
                context.fillText(t('inventoryPhoto'), mm(pageMargin + 2), mm(tableHeaderTop + 5.5));
                context.fillText(t('inventoryAssetName'), mm(tableLayout.nameX), mm(tableHeaderTop + 5.5));
                context.textAlign = 'center';
                context.fillText(t('inventoryQuantity'), mm(tableLayout.quantityCenter), mm(tableHeaderTop + 5.5));
                context.fillText(t('inventoryDate'), mm(tableLayout.dateCenter), mm(tableHeaderTop + 5.5));

                const pageSize = isFirstPage ? firstPageSize : continuationPageSize;
                const firstItemIndex = pageIndex === 0
                    ? 0
                    : firstPageSize + (pageIndex - 1) * continuationPageSize;
                const pageItems = pdfItems.slice(firstItemIndex, firstItemIndex + pageSize);
                pageItems.forEach((item, rowIndex) => {
                    const rowTop = tableHeaderTop + 11 + rowIndex * 24;
                    const rowBottom = rowTop + 24;
                    context.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                    context.fillRect(mm(pageMargin), mm(rowTop), mm(contentWidth), mm(24));
                    context.strokeStyle = '#e2e8f0';
                    context.lineWidth = 1;
                    context.beginPath();
                    context.moveTo(mm(pageMargin), mm(rowBottom));
                    context.lineTo(mm(pageWidth - pageMargin), mm(rowBottom));
                    context.stroke();

                    const image = imageObjects[firstItemIndex + rowIndex];
                    if (image) {
                        const maxImageSize = mm(19);
                        const imageScale = Math.min(maxImageSize / image.width, maxImageSize / image.height);
                        const imageWidth = image.width * imageScale;
                        const imageHeight = image.height * imageScale;
                        context.drawImage(
                            image,
                            mm(tableLayout.photoCenter) - imageWidth / 2,
                            mm(rowTop + 12) - imageHeight / 2,
                            imageWidth,
                            imageHeight
                        );
                    }

                    context.fillStyle = '#1e293b';
                    context.font = `${mm(3.8)}px InventoryKhmer, Arial, sans-serif`;
                    context.textAlign = 'left';
                    const nameLines = wrapCanvasText(context, item.assetName, mm(tableLayout.nameWidth), 2);
                    const nameTop = rowTop + (24 - nameLines.length * 5) / 2;
                    nameLines.forEach((line, lineIndex) => {
                        context.fillText(line, mm(tableLayout.nameX), mm(nameTop + lineIndex * 5));
                    });

                    context.textAlign = 'center';
                    context.fillText(Number(item.quantity).toLocaleString(), mm(tableLayout.quantityCenter), mm(rowTop + 12));
                    const dateLines = wrapCanvasText(context, formatDate(item.createdAt), mm(tableLayout.dateWidth), 2);
                    const dateTop = rowTop + (24 - dateLines.length * 5) / 2;
                    dateLines.forEach((line, lineIndex) => {
                        context.fillText(line, mm(tableLayout.dateCenter), mm(dateTop + lineIndex * 5));
                    });
                });

            };

            for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
                if (pageIndex > 0) pdf.addPage();
                drawPage(pageIndex);
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);
            }
            pdf.save(`inventory-${locationCode}-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            setFeedback({ type: 'error', text: `${t('inventoryPdfFailed')} ${error.message || ''}`.trim() });
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : lang, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(date));
    };

    const renderInventoryList = (className = '') => (
        <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
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
                                {(canEdit || canDelete) && <th className="inventory-no-print px-5 py-3 text-center">{t('actions')}</th>}
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
                                    {(canEdit || canDelete) && (
                                        <td className="inventory-no-print px-5 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(item)}
                                                        aria-label={`${t('editInventory')} ${item.assetName}`}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-800"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={deletingId === item._id}
                                                        aria-label={`${t('delete')} ${item.assetName}`}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                                    >
                                                        <FaTrashAlt />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );

    if (!locationName) return null;

    return (
        <main
            data-allow-scroll="true"
            className={`inventory-page-root inventory-page-enter h-full overflow-y-auto p-3 sm:p-5 lg:p-7${exporting ? ' inventory-exporting' : ''}`}
        >
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

                {!isPreviewPage && (canCreate || (editingId && canEdit)) && (
                    <section className="inventory-no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                {editingId ? <FaEdit /> : <FaPlus />}
                            </span>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{t(editingId ? 'editInventoryItem' : 'addAsset')}</h2>
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
                                    {imagePreviewUrl || existingImageUrl
                                        ? <img src={imagePreviewUrl || existingImageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                                        : <FaImage className="text-lg text-emerald-600" />}
                                    <span className="min-w-0 flex-1 truncate">{imageFile?.name || t('chooseImage')}</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                                </span>
                            </label>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {editingId ? <FaSave /> : <FaPlus />}
                                    {saving ? t('loading') : t(editingId ? 'saveInventoryChanges' : 'addAsset')}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <FaTimes />
                                        {t('cancel')}
                                    </button>
                                )}
                            </div>
                        </form>
                    </section>
                )}

                {!isPreviewPage && renderInventoryList('inventory-no-print')}

                {isPreviewPage && (
                <section className="inventory-print-area space-y-5 rounded-2xl">
                    <header className="inventory-heading overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg sm:p-7">
                        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">{t('inventory')}</p>
                                <h1 className="text-2xl font-black tracking-wide sm:text-3xl">{locationName}</h1>
                                <p className="mt-2 text-sm text-emerald-50">{t('inventoryList')}</p>
                            </div>
                            {canExport && (
                                <div className="inventory-no-print flex flex-wrap gap-2">
                                    <label className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
                                        <span>{t('inventoryPdfOrientation')}</span>
                                        <select
                                            value={pdfOrientation}
                                            onChange={(event) => setPdfOrientation(event.target.value)}
                                            disabled={exporting || loading}
                                            className="rounded-lg border border-white/30 bg-white px-2 py-1.5 text-sm font-semibold text-emerald-800 outline-none focus:ring-2 focus:ring-white/70"
                                        >
                                            <option value="portrait">{t('portrait')}</option>
                                            <option value="landscape">{t('landscape')}</option>
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleExportPdf}
                                        disabled={exporting || loading}
                                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                        <FaFilePdf />
                                        {exporting ? t('loading') : t('exportPdf')}
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

                    {renderInventoryList()}
                </section>
                )}
            </div>
        </main>
    );
};

export default InventoryLocationPage;
