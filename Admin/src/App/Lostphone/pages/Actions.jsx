import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaLock, FaUnlock, FaTimes, FaSpinner, FaShieldAlt } from 'react-icons/fa';
import { MdOutlineSync, MdOutlinePhoneIphone } from 'react-icons/md';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';
import DatabaseSearchInput from '../../../components/DatabaseSearchInput';

const LIMIT = 10;

const Actions = () => {
    const { t } = useLanguage();
    const { API_BASE, API_BASE1, API_BASE2, user, hasPermission } = useAuth();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSearchRecord, setSelectedSearchRecord] = useState(null);

    // Confirmation Modal state
    const [confirmModalData, setConfirmModalData] = useState(null); // { contract, newStatus }

    const fetchContracts = async (pg = page, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                status: 'Activated',
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false',
                ...(search.trim() ? { search: search.trim() } : {})
            });
            const res = await fetch(`${API_BASE1}/contracts?${params.toString()}`);

            if (res.ok) {
                const result = await res.json();
                setContracts(Array.isArray(result.data) ? result.data : []);
                setTotal(result.total || 0);
            }
        } catch (err) {
            console.error('Fetch lostphone action contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    useEffect(() => {
        fetchContracts(page, searchTerm);
    }, [page, searchTerm, API_BASE1, user]);

    const filteredContracts = selectedSearchRecord ? [selectedSearchRecord] : contracts;

    const handleOpenConfirm = (contract, newStatus) => {
        setConfirmModalData({ contract, newStatus });
    };

    const handleExecuteToggleLock = async () => {
        if (!confirmModalData) return;
        const { contract, newStatus } = confirmModalData;

        setTogglingId(contract._id);
        try {
            // Fetch current lockphone display configs from MongoDB ControlSystem (brand-specific first, fallback to Global)
            let displayText = 'ប្រព័ន្ធ SYSTEM MDM — ទូរស័ព្ទនេះត្រូវបានចាក់សោ ហេតុថាមានបំណុលជំពាក់';
            let phoneNumber = '+855 12 903 120';
            try {
                const targetBrand = contract.brand || user?.brand || '';
                const brandParam = targetBrand ? `?brand=${encodeURIComponent(targetBrand)}` : '';
                const configRes = await fetch(`${API_BASE}/controlsystem${brandParam}`);
                if (configRes.ok) {
                    const cfg = await configRes.json();
                    if (cfg.lockphone_display_text) displayText = cfg.lockphone_display_text;
                    if (cfg.lockphone_phone_number) phoneNumber = cfg.lockphone_phone_number;
                }
            } catch (cErr) { }

            const res = await fetch(`${API_BASE2}/lostphone/toggle-lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contract.contractId,
                    newStatus,
                    performedBy: user?.name || 'BOY BOY (Administrator)',
                    userName: user?.name || user?.username || 'BOY BOY',
                    displayText,
                    phoneNumber,
                    reason: `Device set to ${newStatus} from Lost Phone Action Control`
                })
            });

            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                // Update local state directly and smoothly without reloading the page
                setContracts(prev => prev.map(c => {
                    if (c._id === contract._id || (c.contractId && c.contractId === contract.contractId)) {
                        return { ...c, lockPhoneStatus: newStatus };
                    }
                    return c;
                }));

                setSelectedSearchRecord(prev => {
                    if (prev && (prev._id === contract._id || (prev.contractId && prev.contractId === contract.contractId))) {
                        return { ...prev, lockPhoneStatus: newStatus };
                    }
                    return prev;
                });

                const failedNotifications = result.telegramNotifications?.failed || [];
                if (result.telegramNotifications?.error) {
                    alert(`Phone lock was saved, but Telegram notification failed: ${result.telegramNotifications.error}`);
                } else if (failedNotifications.length > 0) {
                    const failedIds = failedNotifications.map((notification) => notification.chatId).join(', ');
                    alert(`Phone lock was saved, but Telegram could not send to: ${failedIds}`);
                }
                setConfirmModalData(null);
            } else {
                alert(`Failed to update phone lock: ${result.error || res.statusText}`);
            }
        } catch (err) {
            console.error('Toggle lock error:', err);
            alert(`Failed to update phone lock: ${err.message}`);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-2 select-none space-y-4'>
            <header className='p-2 w-full border border-slate-200 bg-white rounded-[5px] flex items-center justify-between shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            Lost Phone
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <DatabaseSearchInput
                        apiBase={API_BASE1}
                        endpoint="/contracts"
                        params={{
                            status: 'Activated',
                            userBrand: user?.brand || '',
                            userRole: user?.role || '',
                            username: user?.username || '',
                            isImmutable: user?.isImmutable ? 'true' : 'false'
                        }}
                        value={searchTerm}
                        placeholder="Search customer, model, serial..."
                        onChange={(value) => {
                            setSelectedSearchRecord(null);
                            setPage(1);
                            setSearchTerm(value);
                        }}
                        onSelect={(record) => {
                            setSelectedSearchRecord(record);
                            setPage(1);
                        }}
                        className="w-64"
                    />
                </div>
            </header>

            <div className='w-full overflow-x-auto h-[calc(100vh-300px)] pb-14 rounded-[5px] border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs whitespace-nowrap'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap'>
                        <tr>
                            <th className='px-4 py-1 text-center'>No</th>
                            <th className='px-4 py-1'>{t('customerName')}</th>
                            <th className='px-4 py-1'>{t('model')}</th>
                            <th className='px-4 py-1'>{t('serialNumber')}</th>
                            <th className='px-4 py-1 text-center'>Current Lock Status</th>
                            <th className='px-4 py-1 text-center'>Toggle Action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800 whitespace-nowrap'>
                        {filteredContracts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-500 italic font-medium">
                                    No devices found.
                                </td>
                            </tr>
                        ) : (
                            filteredContracts.map((item, idx) => {
                                const isLocked = item.lockPhoneStatus === 'Locked';
                                return (
                                    <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                        <td className='px-4 py-1 text-center font-mono text-slate-600 font-semibold'>{(selectedSearchRecord ? 0 : (page - 1) * LIMIT) + idx + 1}</td>
                                        <td className='px-4 py-1 font-bold text-slate-900'>
                                            <CopyCell text={item.customerNameEn} className="font-bold text-slate-900 block" />
                                            {item.customerNameKh && <CopyCell text={item.customerNameKh} className="text-emerald-700 font-khmer text-xs font-semibold" />}
                                        </td>
                                        <td className='px-4 py-1 font-semibold text-slate-800'>
                                            <CopyCell text={item.model} className="font-semibold text-slate-800" />
                                        </td>
                                        <td className='px-4 py-1 font-mono text-emerald-700 font-semibold'>
                                            <CopyCell text={item.serialNumber} className="font-mono text-emerald-700 font-semibold" />
                                        </td>
                                        <td className='px-4 py-1 text-center'>
                                            <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase inline-flex items-center gap-1.5 ${isLocked ? 'bg-red-50 border border-red-300 text-red-700' : 'bg-emerald-50 border border-emerald-300 text-emerald-800'}`}>
                                                {isLocked ? <FaLock size={10} /> : <FaUnlock size={10} />}
                                                {item.lockPhoneStatus || 'Unlocked'}
                                            </span>
                                        </td>
                                        <td className='px-4 py-1 text-center'>
                                            {hasPermission('/lostphone/actions', 'edit') || hasPermission('/lostphone/actions', 'create') ? (
                                                isLocked ? (
                                                    <button
                                                        onClick={() => handleOpenConfirm(item, 'Unlocked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                                                    >
                                                        <FaUnlock size={11} />
                                                        <span>Set to Unlock Phone</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenConfirm(item, 'Locked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-red-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                                                    >
                                                        <FaLock size={11} />
                                                        <span>Set to Lock Phone</span>
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-slate-400 font-semibold text-xs italic">Read Only</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={selectedSearchRecord ? 1 : total} itemsPerPage={LIMIT} onPageChange={setPage} />

            {/* Custom Confirmation UI Modal */}
            {confirmModalData && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
                    onClick={() => {
                        if (!togglingId) setConfirmModalData(null);
                    }}
                >
                    <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            disabled={!!togglingId}
                            onClick={() => setConfirmModalData(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer disabled:opacity-30"
                        >
                            <FaTimes size={16} />
                        </button>

                        {/* Top Icon */}
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                                confirmModalData.newStatus === 'Locked'
                                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800 shadow-rose-500/20'
                                    : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200 dark:border-emerald-800 shadow-emerald-500/20'
                            }`}>
                                {confirmModalData.newStatus === 'Locked' ? (
                                    <FaLock className="text-2xl animate-pulse" />
                                ) : (
                                    <FaUnlock className="text-2xl animate-pulse" />
                                )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white font-khmer">
                                {confirmModalData.newStatus === 'Locked'
                                    ? 'បញ្ជាក់ការចាក់សោទូរស័ព្ទ (Lock Device)'
                                    : 'បញ្ជាក់ការដោះសោទូរស័ព្ទ (Unlock Device)'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {confirmModalData.newStatus === 'Locked'
                                    ? 'តើអ្នកពិតជាចង់កំណត់ចាក់សោ (Lock) លើឧបករណ៍នេះមែនទេ?'
                                    : 'តើអ្នកពិតជាចង់កំណត់ដោះសោ (Unlock) លើឧបករណ៍នេះមែនទេ?'}
                            </p>
                        </div>

                        {/* Device Info Summary Card */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">អតិថិជន (Customer):</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                                    {confirmModalData.contract?.customerNameKh || confirmModalData.contract?.customerNameEn || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">ម៉ូឌែល (Model):</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                    {confirmModalData.contract?.model || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Serial / IMEI:</span>
                                <span className="font-mono font-bold text-emerald-600">
                                    {confirmModalData.contract?.serialNumber || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">សកម្មភាព (Action):</span>
                                <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                    confirmModalData.newStatus === 'Locked'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                }`}>
                                    {confirmModalData.newStatus === 'Locked' ? '🔴 Set to Lock Phone' : '🟢 Set to Unlock Phone'}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={!!togglingId}
                                onClick={() => setConfirmModalData(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40"
                            >
                                បោះបង់ (Cancel)
                            </button>
                            <button
                                type="button"
                                disabled={!!togglingId}
                                onClick={handleExecuteToggleLock}
                                className={`px-5 py-2 text-white font-bold rounded-lg text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 ${
                                    confirmModalData.newStatus === 'Locked'
                                        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                                }`}
                            >
                                {togglingId ? (
                                    <>
                                        <FaSpinner className="animate-spin text-xs" />
                                        <span>កំពុងដំណើរការ...</span>
                                    </>
                                ) : confirmModalData.newStatus === 'Locked' ? (
                                    <>
                                        <FaLock size={11} />
                                        <span>បញ្ជាក់ចាក់សោ (Confirm Lock)</span>
                                    </>
                                ) : (
                                    <>
                                        <FaUnlock size={11} />
                                        <span>បញ្ជាក់ដោះសោ (Confirm Unlock)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Actions;