import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaMobileAlt, FaCheck, FaCloudUploadAlt, FaTrashAlt, FaExpand, FaImage } from "react-icons/fa";
import { MdClose } from "react-icons/md";
import ImageGalleryModal from '../../../components/ImageGalleryModal';
import ImageUrlListInput from '../../../components/ImageUrlListInput';
import { fileToBase64 } from '../../../utils/mediaUtils';

const QrPaymentModal = ({ open, contract, onClose, onSaved }) => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    const [paymentMethods, setPaymentMethods] = useState(['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer']);
    const [phoneForm, setPhoneForm] = useState({
        paidDate: new Date().toISOString().split('T')[0],
        paidBy: 'ABA Pay QR',
        amount: 150,
        description: ''
    });
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState('');
    const [receiptUrls, setReceiptUrls] = useState([]);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [qrPayments, setQrPayments] = useState([]);
    const [loadingQrPayments, setLoadingQrPayments] = useState(false);
    const [previewLightbox, setPreviewLightbox] = useState(false);
    const [viewHistoryImages, setViewHistoryImages] = useState([]);
    const [viewHistoryImageIndex, setViewHistoryImageIndex] = useState(0);

    const fileInputRef = useRef(null);

    // Reset when modal opens
    useEffect(() => {
        if (!open || !contract) return;

        setPaymentSuccess(false);
        setQrPayments([]);
        setLoadingQrPayments(true);
        setReceiptFile(null);
        setReceiptPreview('');
        setReceiptUrls([]);
        setPreviewLightbox(false);
        setViewHistoryImages([]);
        setViewHistoryImageIndex(0);

        // Calculate initial amount from schedule or monthlyPayment
        let defaultAmount = Number(contract.monthlyPayment || contract.amount || 150);
        if (Array.isArray(contract.repaymentSchedule) && contract.repaymentSchedule.length > 0) {
            const pendingRow = contract.repaymentSchedule.find(r => r.status === 'Pending' || r.status === 'Saved');
            if (pendingRow && pendingRow.scheduledAmount) {
                defaultAmount = Number(pendingRow.scheduledAmount);
            }
        }

        setPhoneForm({
            paidDate: new Date().toISOString().split('T')[0],
            paidBy: paymentMethods[0] || 'ABA Pay QR',
            amount: defaultAmount,
            description: `Installment payment for ${contract.model || ''} (${contract.contractIid || contract.contractId || ''})`
        });

        // 1. Fetch Payment Methods
        const brand = contract.brand || user?.brand || '';
        fetch(`${API_BASE}/controlsystem?brand=${encodeURIComponent(brand)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                const pmCat = data?.droplists?.find(d => d.category === 'Payment Methods');
                if (pmCat && pmCat.items?.length) {
                    setPaymentMethods(pmCat.items);
                    setPhoneForm(prev => ({
                        ...prev,
                        paidBy: prev.paidBy || pmCat.items[0]
                    }));
                }
            })
            .catch(err => console.error('Fetch payment methods error:', err));

        // 2. Fetch Payment History
        const contractIdToUse = contract.contractId || contract._id;
        if (contractIdToUse) {
            fetch(`${API_BASE1}/payments/contract/${encodeURIComponent(contractIdToUse)}`)
                .then(res => res.ok ? res.json() : null)
                .then(paymentsData => {
                    setQrPayments(paymentsData?.data || []);
                })
                .catch(err => console.error('Error fetching payments:', err))
                .finally(() => setLoadingQrPayments(false));
        } else {
            setLoadingQrPayments(false);
        }
    }, [open, contract, API_BASE, API_BASE1, user?.brand]);

    // Handle File Selection
    const handleFileChange = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setReceiptFile(file);
        const previewUrl = URL.createObjectURL(file);
        setReceiptPreview(previewUrl);
    };

    // Support Paste (Ctrl+V) from Clipboard
    const handlePaste = useCallback((e) => {
        if (!open) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    handleFileChange(file);
                    break;
                }
            }
        }
    }, [open]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    // Convert receipt image to base64
    const uploadReceiptImage = async (file) => {
        if (!file) return '';
        try {
            return await fileToBase64(file);
        } catch (err) {
            console.error('Base64 conversion failed:', err);
            return '';
        }
    };

    if (!open || !contract) return null;

    const handleMobilePaymentSubmit = async (e) => {
        e.preventDefault();
        setPaymentSubmitting(true);
        setIsUploadingPhoto(Boolean(receiptFile));

        try {
            let photoUrl = '';
            if (receiptFile) {
                photoUrl = await uploadReceiptImage(receiptFile);
            }
            const paymentImages = [...new Set([...(photoUrl ? [photoUrl] : []), ...receiptUrls])];
            const primaryPhoto = paymentImages[0] || '';

            const res = await fetch(`${API_BASE1}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contract.contractId || contract._id,
                    customerName: `${contract.customerNameEn || ''} (${contract.customerNameKh || ''})`.trim(),
                    photo: primaryPhoto,
                    image: primaryPhoto,
                    receiptImage: primaryPhoto,
                    paymentImages,
                    serialNumber: contract.serialNumber || '',
                    model: contract.model || '',
                    paidDate: phoneForm.paidDate,
                    paidBy: phoneForm.paidBy,
                    amount: Number(phoneForm.amount),
                    description: phoneForm.description
                })
            });

            if (res.ok) {
                const data = await res.json();
                const savedPayment = data.payment || {
                    paidDate: phoneForm.paidDate,
                    paidBy: phoneForm.paidBy,
                    amount: Number(phoneForm.amount),
                    description: phoneForm.description,
                    photo: primaryPhoto,
                    image: primaryPhoto,
                    receiptImage: primaryPhoto,
                    paymentImages
                };

                setQrPayments(current => [savedPayment, ...current]);
                setPaymentSuccess(true);
                if (onSaved) onSaved();

                setTimeout(() => {
                    onClose();
                    setPaymentSuccess(false);
                }, 2000);
            }
        } catch (err) {
            console.error('Submit payment error:', err);
        } finally {
            setPaymentSubmitting(false);
            setIsUploadingPhoto(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-2 overflow-y-auto">
                <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[5px] bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                <FaMobileAlt className="text-xl" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                    Payment Entry & Payment Proof
                                </h3>
                                <p className="text-[11px] text-gray-400">
                                    {contract.customerNameEn || contract.customerNameKh} • <span className="text-indigo-400 font-mono font-semibold">{contract.contractIid || contract.contractId}</span>
                                    {contract.model && <span className="text-gray-400 ml-2">({contract.model})</span>}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
                        >
                            <MdClose size={18} />
                        </button>
                    </div>

                    {paymentSuccess ? (
                        <div className="p-8 text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-400 text-3xl mx-auto animate-bounce">
                                <FaCheck />
                            </div>
                            <h3 className="text-lg font-bold text-emerald-400">Payment Submitted Successfully!</h3>
                            <p className="text-xs text-gray-300">Payment receipt has been saved and is now visible in Payment History.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Payment Entry Form */}
                                <div className="p-5 rounded-[5px] bg-[#090c17] border border-indigo-500/30 text-left space-y-4 relative shadow-inner flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-xs font-bold text-emerald-400">
                                            <FaMobileAlt className="text-base" />
                                            <span>{t('paymentEntry')}</span>
                                        </div>
                                        <form id="paymentForm" onSubmit={handleMobilePaymentSubmit} className="space-y-3 text-xs mt-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('paidDate')}</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={phoneForm.paidDate}
                                                    onChange={(e) => setPhoneForm({ ...phoneForm, paidDate: e.target.value })}
                                                    className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('paidBy')} / Payment Method</label>
                                                <select
                                                    required
                                                    value={phoneForm.paidBy}
                                                    onChange={(e) => setPhoneForm({ ...phoneForm, paidBy: e.target.value })}
                                                    className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100 font-semibold cursor-pointer"
                                                >
                                                    <option value="">-- Select Payment Method --</option>
                                                    {paymentMethods.map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('amount')} ($ USD)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="any"
                                                    value={phoneForm.amount}
                                                    onChange={(e) => setPhoneForm({ ...phoneForm, amount: e.target.value })}
                                                    className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-emerald-400 font-bold font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('description')}</label>
                                                <input
                                                    type="text"
                                                    value={phoneForm.description}
                                                    onChange={(e) => setPhoneForm({ ...phoneForm, description: e.target.value })}
                                                    placeholder="Note or transaction ref"
                                                    className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-[5px] text-gray-100"
                                                />
                                            </div>
                                        </form>
                                    </div>

                                    <button
                                        type="submit"
                                        form="paymentForm"
                                        disabled={paymentSubmitting}
                                        className="w-full h-10 mt-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-[5px] shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        {paymentSubmitting ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>{isUploadingPhoto ? 'Uploading Proof Image...' : 'Submitting Payment...'}</span>
                                            </div>
                                        ) : (
                                            <span>Submit Payment</span>
                                        )}
                                    </button>
                                </div>

                                {/* Right Column: Payment Proof / Receipt Image Upload */}
                                <div className="p-5 rounded-[5px] bg-gray-900/80 border border-gray-800 text-center space-y-3 flex flex-col justify-between">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                            <FaImage className="text-sm" />
                                            <span>{t('receiptEvidence')}</span>
                                        </div>
                                        {receiptPreview && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReceiptFile(null);
                                                    setReceiptPreview('');
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <FaTrashAlt size={10} /> លុប
                                            </button>
                                        )}
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleFileChange(e.target.files[0]);
                                            }
                                        }}
                                    />

                                    {receiptPreview ? (
                                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                                            <div className="relative group rounded-[5px] overflow-hidden bg-black/70 border border-emerald-500/40 flex items-center justify-center h-52">
                                                <img
                                                    src={receiptPreview}
                                                    alt="Payment Proof Receipt"
                                                    className="w-full h-full object-contain cursor-pointer transition-transform duration-200 group-hover:scale-105"
                                                    onClick={() => setPreviewLightbox(true)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewLightbox(true)}
                                                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                                                    title="View Full Size"
                                                >
                                                    <FaExpand size={12} />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                                    ✓ បានជ្រើសរើសរូបភាពភស្តុតាង
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                                >
                                                    ប្តូររូបភាពថ្មី
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    handleFileChange(e.dataTransfer.files[0]);
                                                }
                                            }}
                                            className="h-52 rounded-[5px] bg-gray-950/60 border-2 border-dashed border-gray-700 hover:border-emerald-500/60 transition-all flex flex-col items-center justify-center p-2 cursor-pointer group space-y-2"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                                                <FaCloudUploadAlt />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-200 group-hover:text-emerald-300 transition-colors">
                                                    ចុចទីនេះដើម្បី Upload ឬ អូសទម្លាក់រូបភាព
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-1">
                                                    ឬចុច <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono text-[10px]">Ctrl + V</kbd> ដើម្បី Paste រូបភាព
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                រូបភាពនេះនឹងបង្ហាញក្នុង Payment History
                                            </span>
                                        </div>
                                    )}

                                    <ImageUrlListInput
                                        onAddUrls={urls => setReceiptUrls(current => [...new Set([...current, ...urls])])}
                                    />
                                    {receiptUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {receiptUrls.map((url, index) => (
                                                <button
                                                    key={`${url}-${index}`}
                                                    type="button"
                                                    onClick={() => setReceiptUrls(current => current.filter((_, urlIndex) => urlIndex !== index))}
                                                    className="max-w-full truncate rounded bg-gray-800 px-2 py-1 text-[10px] text-emerald-300"
                                                    title={`${url} (click to remove)`}
                                                >
                                                    {url}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="text-[10px] text-gray-400 text-left bg-gray-950/40 p-2.5 rounded-[5px] border border-gray-800">
                                        💡 <span className="text-gray-300 font-medium">ចំណាំ៖</span> រូបភាពដែលបានភ្ជាប់នឹងត្រូវរក្សាទុកជាភស្តុតាងនៃការបង់ប្រាក់ ហើយលោតទៅបង្ហាញនៅជួររូបភាពក្នុងទំព័រ <span className="text-emerald-400 font-mono">Payment History</span>។
                                    </div>
                                </div>
                            </div>

                            {/* Payment History Section */}
                            <div className="p-5 rounded-[5px] bg-gray-900/80 border border-sky-500/30 space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                    <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider">{t('paymentHistory')}</h4>
                                    <span className="text-[10px] text-gray-400">{qrPayments.length} Transactions</span>
                                </div>
                                <div className="max-h-44 overflow-y-auto divide-y divide-gray-800">
                                    {loadingQrPayments ? (
                                        <p className="py-4 text-center text-xs text-gray-500">Loading payment history...</p>
                                    ) : qrPayments.length === 0 ? (
                                        <p className="py-4 text-center text-xs text-gray-500">No payment records yet.</p>
                                    ) : qrPayments.map((payment, index) => {
                                        const proofImages = Array.isArray(payment.paymentImages) && payment.paymentImages.length
                                            ? payment.paymentImages.filter(Boolean)
                                            : [payment.photo || payment.image || payment.receiptImage].filter(Boolean);
                                        const proofImg = proofImages[0];
                                        return (
                                            <div key={payment._id || `${payment.paidDate}-${index}`} className="flex items-center justify-between gap-3 py-2 text-xs">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    {proofImg && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setViewHistoryImages(proofImages); setViewHistoryImageIndex(0); }}
                                                            className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/40 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                                            title="មើលរូបភាពភស្តុតាង"
                                                        >
                                                            <img src={proofImg} alt="Receipt" className="w-full h-full object-cover" />
                                                        </button>
                                                    )}
                                                    {proofImages.length > 1 && <span className="text-[10px] text-sky-300">{proofImages.length} photos</span>}
                                                    <div className="min-w-0">
                                                        <p className="text-gray-300 font-mono">{payment.paidDate || payment.paymentDate || '—'}</p>
                                                        <p className="text-gray-500 truncate">{payment.paidBy || 'System'} · {payment.description || '—'}</p>
                                                    </div>
                                                </div>
                                                <span className="text-emerald-400 font-bold font-mono whitespace-nowrap">${Number(payment.amount || 0).toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-800 text-xs font-bold">
                                    <span className="text-gray-400">Total Paid</span>
                                    <span className="text-emerald-400 font-mono">${qrPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox / Full-size photo preview for uploaded receipt */}
            {previewLightbox && receiptPreview && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000000] flex items-center justify-center p-2"
                    onClick={() => setPreviewLightbox(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setPreviewLightbox(false)}
                            className="absolute -top-10 right-0 text-white hover:text-red-400 text-xl font-bold cursor-pointer"
                        >
                            <MdClose size={28} />
                        </button>
                        <img
                            src={receiptPreview}
                            alt="Full receipt preview"
                            className="max-h-[80vh] max-w-full object-contain rounded-[5px] shadow-2xl border border-gray-700"
                        />
                    </div>
                </div>
            )}

            {/* Lightbox for Payment History receipt image */}
            {viewHistoryImages.length > 0 && (
                <ImageGalleryModal
                    images={viewHistoryImages}
                    index={viewHistoryImageIndex}
                    onIndexChange={setViewHistoryImageIndex}
                    onClose={() => setViewHistoryImages([])}
                    title="Payment proof"
                />
            )}
        </>
    );
};

export default QrPaymentModal;
