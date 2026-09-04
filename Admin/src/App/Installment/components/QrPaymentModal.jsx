import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaQrcode, FaCheck, FaMobileAlt } from "react-icons/fa";
import { MdClose } from "react-icons/md";

const QrPaymentModal = ({ open, contract, onClose, onSaved }) => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    const [qrPayload, setQrPayload] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
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

    useEffect(() => {
        if (!open || !contract) return;

        setPaymentSuccess(false);
        setQrPayments([]);
        setLoadingQrPayments(true);
        setQrDataUrl('');
        setQrPayload(null);

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

        // 2. Fetch QR Payload
        const contractIdToUse = contract.contractId || contract._id;
        if (contractIdToUse) {
            fetch(`${API_BASE1}/payments/qr-payload/${encodeURIComponent(contractIdToUse)}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data) {
                        setQrPayload(data.payload);
                        setQrDataUrl(data.qrDataUrl);
                    }
                })
                .catch(err => console.error('Error fetching QR payload:', err));

            // 3. Fetch Payment History
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
            const res = await fetch(`${API_BASE1}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contract.contractId || contract._id,
                    customerName: `${contract.customerNameEn || ''} (${contract.customerNameKh || ''})`.trim(),
                    photo: contract.customerPhoto || '',
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

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4 overflow-y-auto">
            <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <FaQrcode className="text-xl" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                QR Code Payment & Mobile Entry Simulator
                            </h3>
                            <p className="text-[11px] text-gray-400">
                                {contract.customerNameEn || contract.customerNameKh} • <span className="text-indigo-400 font-mono font-semibold">{contract.contractIid || contract.contractId}</span>
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
                            <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 text-center space-y-4 flex flex-col items-center justify-center">
                                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Scan ABA Pay / System QR</h4>
                                {qrDataUrl ? (
                                    <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                                        <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-44 h-44 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500 animate-pulse text-xs">
                                        Generating QR...
                                    </div>
                                )}
                            </div>

                            <div className="p-5 rounded-2xl bg-[#090c17] border border-indigo-500/30 text-left space-y-4 relative shadow-inner">
                                <div className="flex items-center gap-2 pb-2 border-b border-gray-800 text-xs font-bold text-emerald-400">
                                    <FaMobileAlt className="text-base" />
                                    <span>Mobile Phone Entry Simulator</span>
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
                        </div>

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
    );
};

export default QrPaymentModal;
