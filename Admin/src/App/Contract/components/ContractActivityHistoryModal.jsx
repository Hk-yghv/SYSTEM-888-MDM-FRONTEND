import React, { useState, useEffect } from 'react';
import { FaHistory, FaCheckCircle, FaLock, FaUnlock, FaMoneyBillWave, FaCommentDots, FaMobileAlt, FaUserEdit, FaFileAlt } from 'react-icons/fa';
import { MdOutlineSync, MdOutlineClose } from 'react-icons/md';
import { useAuth } from '../../../context/AuthContext';

const ContractActivityHistoryModal = ({ contract, onClose }) => {
    const { API_BASE } = useAuth();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!contract) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Fetch payments for this contract
                const payRes = await fetch(`${API_BASE}/payments?search=${encodeURIComponent(contract.contractId || contract.phone || '')}&limit=100`);
                if (payRes.ok) {
                    const payData = await payRes.json();
                    setPayments(payData.data || []);
                }
            } catch (err) {
                console.error('Error fetching activity history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [contract, API_BASE]);

    if (!contract) return null;

    // Compile timeline events from contract metadata and payments
    const timelineEvents = [];

    // Event 1: Application Created
    if (contract.inputDate || contract.createdAt) {
        timelineEvents.push({
            date: new Date(contract.inputDate || contract.createdAt),
            type: 'create',
            icon: <FaFileAlt className="text-emerald-500" />,
            title: 'Application Created (បង្កើតកិច្ចសន្យា)',
            description: `Contract ID: ${contract.contractId} created for ${contract.customerNameEn || contract.customerNameKh}`,
            badge: 'Application',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-300'
        });
    }

    // Event 2: Activated
    if (contract.status === 'Activated' || contract.activatedAt) {
        timelineEvents.push({
            date: new Date(contract.activatedAt || contract.inputDate || contract.createdAt),
            type: 'activate',
            icon: <FaCheckCircle className="text-purple-500" />,
            title: 'Contract Activated (ធ្វើឱ្យកិច្ចសន្យាសកម្ម)',
            description: `Device model: ${contract.model || '—'} (${contract.serialNumber || '—'}) enrolled in active installment`,
            badge: 'Activated',
            badgeColor: 'bg-purple-50 text-purple-700 border-purple-300'
        });
    }

    // Event 3: Phone Lock Status
    if (contract.lockPhoneStatus && contract.lockPhoneStatus !== 'Unlocked') {
        timelineEvents.push({
            date: new Date(contract.updatedAt || Date.now()),
            type: 'lock_phone',
            icon: <FaLock className="text-red-500" />,
            title: `Device Status: ${contract.lockPhoneStatus}`,
            description: `Phone lock applied due to policy or overdue installment`,
            badge: 'Lock Phone',
            badgeColor: 'bg-red-50 text-red-700 border-red-300'
        });
    }

    // Event 4: Wallpaper Status
    if (contract.lockWallpaperStatus && contract.lockWallpaperStatus !== 'Unlocked') {
        timelineEvents.push({
            date: new Date(contract.updatedAt || Date.now()),
            type: 'wallpaper',
            icon: <FaMobileAlt className="text-amber-500" />,
            title: `Wallpaper Status: ${contract.lockWallpaperStatus}`,
            description: `Notification wallpaper displayed on customer phone screen`,
            badge: 'Wallpaper',
            badgeColor: 'bg-amber-50 text-amber-700 border-amber-300'
        });
    }

    // Event 5: Payments
    payments.forEach(p => {
        timelineEvents.push({
            date: new Date(p.paidDate || p.createdAt || Date.now()),
            type: 'payment',
            icon: <FaMoneyBillWave className="text-emerald-600" />,
            title: `Payment Received: $${(parseFloat(p.amount) || 0).toFixed(2)}`,
            description: `Payment ID: ${p.paymentId || '—'} via ${p.paidBy || 'QR Mobile Payment'}. ${p.description || ''}`,
            badge: 'Payment',
            badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300'
        });
    });

    // Event 6: Comments & Notes
    if (contract.notes || contract.comments) {
        timelineEvents.push({
            date: new Date(contract.updatedAt || contract.createdAt || Date.now()),
            type: 'comment',
            icon: <FaCommentDots className="text-cyan-500" />,
            title: 'Internal Staff Comment (កំណត់ចំណាំ)',
            description: contract.notes || contract.comments,
            badge: 'Note',
            badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-300'
        });
    }

    // Event 7: Edit History Revisions
    if (Array.isArray(contract.editHistory) && contract.editHistory.length > 0) {
        contract.editHistory.forEach(h => {
            timelineEvents.push({
                date: new Date(h.timestamp || Date.now()),
                type: 'edit',
                icon: <FaUserEdit className="text-amber-500" />,
                title: `Data Edited by ${h.editedBy || 'Staff'}: ${h.reason || 'Contract update'}`,
                description: Array.isArray(h.changedFields) && h.changedFields.length > 0
                    ? `Changed fields: [${h.changedFields.join(', ')}]`
                    : 'Information updated and synced.',
                badge: 'Edit Revision',
                badgeColor: 'bg-amber-50 text-amber-700 border-amber-300'
            });
        });
    }

    // Sort descending by date (newest first)
    timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[5px] bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 text-lg shadow-xs">
                            <FaHistory />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                Activity History (ប្រវត្តិសកម្មភាពអតិថិជន)
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">
                                Contract: <span className="font-bold text-indigo-600">{contract.contractId || '—'}</span> &bull; {contract.customerNameEn} ({contract.customerNameKh || '—'})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-all"
                    >
                        <MdOutlineClose size={18} />
                    </button>
                </div>

                {/* Customer Quick Summary Pill */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-[5px] border border-slate-200">
                    <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Device Model</span>
                        <span className="font-bold text-slate-800">{contract.model || '—'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Phone Number</span>
                        <span className="font-bold text-slate-800 font-mono">{contract.phone || '—'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lock Phone Status</span>
                        <span className={`font-bold ${contract.lockPhoneStatus === 'Locked' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {contract.lockPhoneStatus || 'Unlocked'}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Payments</span>
                        <span className="font-bold text-indigo-600 font-mono">{payments.length} Transaction(s)</span>
                    </div>
                </div>

                {/* Timeline List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 py-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 gap-2 text-indigo-600 text-xs font-bold">
                            <MdOutlineSync className="spin-reload text-lg" />
                            <span>Loading customer timeline activities...</span>
                        </div>
                    ) : timelineEvents.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic text-xs">
                            No recorded activity events for this contract yet.
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-200 ml-4 pl-4 space-y-4">
                            {timelineEvents.map((evt, idx) => (
                                <div key={idx} className="relative group">
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[25px] top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-[10px] shadow-xs">
                                        {evt.icon}
                                    </div>

                                    {/* Event Card */}
                                    <div className="p-3 bg-white border border-slate-200 rounded-[5px] shadow-xs hover:border-indigo-300 transition-all space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900 text-xs">{evt.title}</span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${evt.badgeColor}`}>
                                                {evt.badge}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-[11px] leading-relaxed">{evt.description}</p>
                                        <div className="pt-1 text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-50">
                                            <span>{isNaN(evt.date.getTime()) ? 'Recent' : evt.date.toLocaleString('en-GB')}</span>
                                            <span className="text-slate-400 font-sans">Recorded Event</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 font-mono">Total Recorded Events: {timelineEvents.length}</span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[5px] text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContractActivityHistoryModal;
