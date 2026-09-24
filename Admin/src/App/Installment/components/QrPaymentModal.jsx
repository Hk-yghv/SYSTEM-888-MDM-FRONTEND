import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaMobileAlt, FaCheck, FaImages, FaChevronLeft, FaChevronRight, FaExpand, FaUser } from "react-icons/fa";
import { MdClose } from "react-icons/md";

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
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [qrPayments, setQrPayments] = useState([]);
    const [loadingQrPayments, setLoadingQrPayments] = useState(false);
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [previewLightbox, setPreviewLightbox] = useState(false);

    // Extract all photos from contract
    const photosList = useMemo(() => {
        if (!contract) return [];
        const list = [];
        if (Array.isArray(contract.photos)) list.push(...contract.photos);
        if (Array.isArray(contract.evidencePhotos)) list.push(...contract.evidencePhotos);
        if (contract.customerPhoto) list.push(contract.customerPhoto);
        if (contract.googleDrivePhotoUrl) list.push(contract.googleDrivePhotoUrl);
        if (contract.photo) list.push(contract.photo);
        if (contract.photoUrl) list.push(contract.photoUrl);
        if (contract.idCardPhoto) list.push(contract.idCardPhoto);
        if (contract.itemPhoto) list.push(contract.itemPhoto);
        return [...new Set(list.filter(Boolean))];
    }, [contract]);

    useEffect(() => {
        if (!open || !contract) return;

        setPaymentSuccess(false);
        setQrPayments([]);
        setLoadingQrPayments(true);
        setActivePhotoIdx(0);
        setPreviewLightbox(false);

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

    if (!open || !contract) return null;

    const handleMobilePaymentSubmit = async (e) => {
        e.preventDefault();
        setPaymentSubmitting(true);
        try {
            const primaryPhoto = photosList[0] || contract.customerPhoto || '';
            const res = await fetch(`${API_BASE1}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contract.contractId || contract._id,
                    customerName: `${contract.customerNameEn || ''} (${contract.customerNameKh || ''})`.trim(),
                    photo: primaryPhoto,
                    serialNumber: contract.serialNumber || '',
                    model: contract.model || '',
                    paidDate: phoneForm.paidDate,
                    paidBy: phoneForm.paidBy,
                    amount: Number(phoneForm.amount),
                    description: phoneForm.description
                })
            });
            if (res.ok) {
                const newRecord = {
                    paidDate: phoneForm.paidDate,
                    paidBy: phoneForm.paidBy,
                    amount: Number(phoneForm.amount),
                    description: phoneForm.description
                };
                setQrPayments(current => [newRecord, ...current]);
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
        }
    };

    const currentPhotoUrl = photosList[activePhotoIdx] || '';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4 overflow-y-auto">
                <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                <FaMobileAlt className="text-xl" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                    Payment Entry & Customer Information
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
                            <p className="text-xs text-gray-300">Payment record has been stored in MongoDB and updated in Payment History.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Payment Entry Form */}
                                <div className="p-5 rounded-2xl bg-[#090c17] border border-indigo-500/30 text-left space-y-4 relative shadow-inner">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-xs font-bold text-emerald-400">
                                        <FaMobileAlt className="text-base" />
                                        <span>Payment Entry Form / បញ្ចូលព័ត៌មានបង់ប្រាក់</span>
                                    </div>
                                    <form onSubmit={handleMobilePaymentSubmit} className="space-y-3 text-xs">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('paidDate')}</label>
                                            <input
                                                type="date"
                                                required
                                                value={phoneForm.paidDate}
                                                onChange={(e) => setPhoneForm({ ...phoneForm, paidDate: e.target.value })}
                                                className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('paidBy')} / Payment Method</label>
                                            <select
                                                required
                                                value={phoneForm.paidBy}
                                                onChange={(e) => setPhoneForm({ ...phoneForm, paidBy: e.target.value })}
                                                className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-semibold cursor-pointer"
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
                                                className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('description')}</label>
                                            <input
                                                type="text"
                                                value={phoneForm.description}
                                                onChange={(e) => setPhoneForm({ ...phoneForm, description: e.target.value })}
                                                placeholder="Note or transaction ref"
                                                className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={paymentSubmitting}
                                            className="w-full h-10 mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            {paymentSubmitting ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span>Submit Payment to MongoDB</span>
                                            )}
                                        </button>
                                    </form>
                                </div>

                                {/* Right Column: Customer / Contract Photo Display */}
                                <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 text-center space-y-3 flex flex-col justify-between">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                            <FaImages className="text-sm text-indigo-400" />
                                            <span>រូបភាពអតិថិជន / ភស្តុតាង</span>
                                        </div>
                                        {photosList.length > 0 && (
                                            <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-700 px-2 py-0.5 rounded-full">
                                                {activePhotoIdx + 1} / {photosList.length}
                                            </span>
                                        )}
                                    </div>

                                    {photosList.length > 0 ? (
                                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                                            {/* Main Image Display */}
                                            <div className="relative group rounded-2xl overflow-hidden bg-black/60 border border-gray-700 flex items-center justify-center h-52">
                                                <img
                                                    src={currentPhotoUrl}
                                                    alt="Customer/Evidence"
                                                    className="w-full h-full object-contain cursor-pointer transition-transform duration-200 group-hover:scale-105"
                                                    onClick={() => setPreviewLightbox(true)}
                                                />
                                                {/* Expand Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewLightbox(true)}
                                                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    title="View Full Size"
                                                >
                                                    <FaExpand size={12} />
                                                </button>

                                                {/* Left/Right arrow navigation */}
                                                {photosList.length > 1 && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photosList.length - 1));
                                                            }}
                                                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer shadow-md transition-all"
                                                        >
                                                            <FaChevronLeft size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActivePhotoIdx((prev) => (prev < photosList.length - 1 ? prev + 1 : 0));
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer shadow-md transition-all"
                                                        >
                                                            <FaChevronRight size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* Thumbnail Strip */}
                                            {photosList.length > 1 && (
                                                <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                                                    {photosList.map((img, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => setActivePhotoIdx(idx)}
                                                            className={`w-11 h-11 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${idx === activePhotoIdx
                                                                ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/30'
                                                                : 'border-gray-700 opacity-60 hover:opacity-100'
                                                                }`}
                                                        >
                                                            <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-52 rounded-2xl bg-gray-950/60 border border-gray-800 border-dashed flex flex-col items-center justify-center text-gray-500 space-y-2">
                                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl text-gray-400">
                                                <FaUser />
                                            </div>
                                            <p className="text-xs font-medium">គ្មានរូបភាពភ្ជាប់ (No Photo Available)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Payment History */}
                            <div className="p-5 rounded-2xl bg-gray-900/80 border border-sky-500/30 space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                    <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider">Payment History / ប្រវត្តិបង់ប្រាក់</h4>
                                    <span className="text-[10px] text-gray-400">{qrPayments.length} Transactions</span>
                                </div>
                                <div className="max-h-44 overflow-y-auto divide-y divide-gray-800">
                                    {loadingQrPayments ? (
                                        <p className="py-4 text-center text-xs text-gray-500">Loading payment history...</p>
                                    ) : qrPayments.length === 0 ? (
                                        <p className="py-4 text-center text-xs text-gray-500">No payment records yet.</p>
                                    ) : qrPayments.map((payment, index) => (
                                        <div key={payment._id || `${payment.paidDate}-${index}`} className="flex items-center justify-between gap-3 py-2 text-xs">
                                            <div className="min-w-0">
                                                <p className="text-gray-300 font-mono">{payment.paidDate || payment.paymentDate || '—'}</p>
                                                <p className="text-gray-500 truncate">{payment.paidBy || 'System'} · {payment.description || '—'}</p>
                                            </div>
                                            <span className="text-emerald-400 font-bold font-mono whitespace-nowrap">${Number(payment.amount || 0).toLocaleString()}</span>
                                        </div>
                                    ))}
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

            {/* Lightbox / Full-size photo preview */}
            {previewLightbox && currentPhotoUrl && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000000] flex items-center justify-center p-4"
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
                            src={currentPhotoUrl}
                            alt="Full preview"
                            className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-gray-700"
                        />
                        {photosList.length > 1 && (
                            <div className="flex items-center gap-4 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photosList.length - 1))}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                                >
                                    <FaChevronLeft /> Prev
                                </button>
                                <span className="text-xs text-gray-300 font-bold">
                                    {activePhotoIdx + 1} / {photosList.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setActivePhotoIdx((prev) => (prev < photosList.length - 1 ? prev + 1 : 0))}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                                >
                                    Next <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default QrPaymentModal;
