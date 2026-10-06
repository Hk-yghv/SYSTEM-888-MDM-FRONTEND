import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaLock, FaUnlock } from 'react-icons/fa';
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

    const handleToggleLock = async (contract, newStatus) => {
        const actionLabel = newStatus === 'LockPhone' || newStatus === 'Locked' ? t('lockPhone') : t('unlockPhone');
        if (!window.confirm(t('confirmAction') + ` (${actionLabel})`)) return;

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
                const failedNotifications = result.telegramNotifications?.failed || [];
                if (result.telegramNotifications?.error) {
                    alert(`Phone lock was saved, but Telegram notification failed: ${result.telegramNotifications.error}`);
                } else if (failedNotifications.length > 0) {
                    const failedIds = failedNotifications.map((notification) => notification.chatId).join(', ');
                    alert(`Phone lock was saved, but Telegram could not send to: ${failedIds}`);
                }
                await fetchContracts(page);
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
                                                        onClick={() => handleToggleLock(item, 'Unlocked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                    >
                                                        <FaUnlock size={11} />
                                                        <span>Set to Unlock Phone</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleLock(item, 'Locked')}
                                                        disabled={togglingId === item._id}
                                                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[5px] text-xs shadow-lg shadow-red-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
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
        </div>
    );
};

export default Actions;