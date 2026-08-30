import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { FaHistory, FaFileExcel, FaSearch, FaUserShield, FaTelegramPlane, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { MdOutlineSync, MdPictureAsPdf } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';
import CopyCell from '../../../components/CopyCell';

const LIMIT = 10;

const LoginHistory = () => {
    const { t } = useLanguage();
    const { API_BASE2, user } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Schedule Countdown state
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [sendingTelegram, setSendingTelegram] = useState(false);
    const [toast, setToast] = useState(null);

    const fetchLoginHistory = useCallback(async (pg = page, search = searchTerm, role = roleFilter, status = statusFilter) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({
                page: pg,
                limit: LIMIT,
                userUsername: user?.username || '',
                userRole: user?.role || ''
            });
            if (search) params.append('search', search);
            if (role) params.append('role', role);
            if (status) params.append('status', status);

            const res = await fetch(`${API_BASE2}/history/login?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch login history error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE2, page, searchTerm, roleFilter, statusFilter, user]);

    const [targetTimestamp, setTargetTimestamp] = useState(null);

    const fetchReportSchedule = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE2}/history/report-schedule`);
            if (res.ok) {
                const data = await res.json();
                if (data.nextReportTime) {
                    setTargetTimestamp(data.nextReportTime);
                }
            }
        } catch (err) {
            console.error('Fetch report schedule error:', err);
        }
    }, [API_BASE2]);

    useEffect(() => {
        fetchLoginHistory(page, searchTerm, roleFilter, statusFilter);
    }, [page]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchLoginHistory(1, searchTerm, roleFilter, statusFilter);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, roleFilter, statusFilter]);

    // Initial fetch of report schedule and periodic sync
    useEffect(() => {
        fetchReportSchedule();
        const syncInterval = setInterval(fetchReportSchedule, 30000); // sync every 30s
        return () => clearInterval(syncInterval);
    }, [fetchReportSchedule]);

    // Live 1-second local timer calculating real-time elapsed time against targetTimestamp
    useEffect(() => {
        if (!targetTimestamp) return;

        const updateClock = () => {
            const remainingMs = Math.max(0, targetTimestamp - Date.now());
            const totalSec = Math.floor(remainingMs / 1000);
            const days = Math.floor(totalSec / (24 * 3600));
            const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;
            setCountdown({ days, hours, minutes, seconds });
        };

        updateClock();
        const tickInterval = setInterval(updateClock, 1000);
        return () => clearInterval(tickInterval);
    }, [targetTimestamp]);

    const handleSendTelegramReport = async () => {
        if (sendingTelegram) return;
        if (!window.confirm('តើអ្នកពិតជាចង់ផ្ញើរបាយការណ៍នេះ និងលុបទិន្នន័យប្រវត្តិ Login ដើម្បីរាប់ថយក្រោយជាថ្មីមែនទេ?')) {
            return;
        }

        setSendingTelegram(true);
        try {
            const res = await fetch(`${API_BASE2}/history/send-telegram-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setToast({
                    type: 'success',
                    message: 'បានផ្ញើប្រវត្តិ Login ទៅ Telegram Bot & Google Sheet និងលុបទិន្នន័យដើម្បីរាប់ថយក្រោយថ្មីដោយជោគជ័យ!'
                });
                fetchLoginHistory(1, searchTerm, roleFilter);
                fetchReportSchedule();
            } else {
                setToast({ type: 'error', message: data.error || data.telegramError || 'Failed to send report.' });
            }
        } catch (err) {
            setToast({ type: 'error', message: err.message || 'Error triggering report send.' });
        } finally {
            setSendingTelegram(false);
            setTimeout(() => setToast(null), 6000);
        }
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                page: 1,
                limit: 999999,
                userUsername: user?.username || '',
                userRole: user?.role || ''
            });
            if (searchTerm) params.append('search', searchTerm);
            if (roleFilter) params.append('role', roleFilter);
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_BASE2}/history/login?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all login logs for export error:', err);
        }
        return logs;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const dataToExport = allData.map((l, idx) => ({
            No: idx + 1,
            Username: l.username,
            Name: l.name,
            Role: l.role,
            IP: l.ip,
            DeviceInfo: l.deviceInfo,
            Timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString() : '',
            Status: l.status || 'Success'
        }));
        exportToExcel(dataToExport, 'User_Login_History');
    };

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Username', accessor: 'username' },
            { header: 'Name', accessor: 'name' },
            { header: 'Role', accessor: 'role' },
            { header: 'IP Address', accessor: 'ip' },
            { header: 'Device / Browser', accessor: 'deviceInfo' },
            { header: 'Time', cell: (r) => r.timestamp ? new Date(r.timestamp).toLocaleString() : '' },
            { header: 'Status', cell: (r) => r.status || 'Success' }
        ];
        exportToPDF('User Login Audit History Report', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>

            {/* Notification Toast */}
            {toast && (
                <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between transition-all ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                    <div className='flex items-center gap-2.5 text-xs font-bold'>
                        {toast.type === 'success' ? <FaCheckCircle className='text-emerald-600 text-base' /> : <FaExclamationTriangle className='text-red-600 text-base' />}
                        <span>{toast.message}</span>
                    </div>
                    <button onClick={() => setToast(null)} className='text-xs underline font-semibold ml-4 cursor-pointer text-slate-500 hover:text-slate-700'>Dismiss</button>
                </div>
            )}

            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 text-xl'>
                        <FaHistory />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('loginHistory')}
                        </h1>
                        <p className='text-xs text-indigo-700 font-semibold'>
                            {total} records — Track user login sessions, IP addresses, and device OS
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleExportExcel} className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <FaFileExcel className="text-emerald-600 text-sm" /><span>Excel</span>
                    </button>
                    <button onClick={handleExportPDF} className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'>
                        <MdPictureAsPdf className="text-red-600 text-sm" /><span>PDF</span>
                    </button>
                    <button onClick={() => fetchLoginHistory(page)} disabled={reloading} className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'>
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Telegram & Google Sheet Auto-Send Countdown Card (Clean White Light Theme) */}
            <div className='w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4'>
                <div className='flex items-center gap-3.5'>
                    <div className='w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xl shadow-xs'>
                        <FaTelegramPlane />
                    </div>
                    <div>
                        <div className='flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider'>
                            <FaClock className='text-blue-600 text-xs' />
                            <span>{t('nextAutoSend') || 'ថ្ងៃដែលនៅសល់ត្រូវផ្ញើទៅ Telegram Bot ម្តងទៀត៖'}</span>
                        </div>
                        <p className='text-[11px] text-slate-500 font-medium mt-0.5'>
                            ប្រព័ន្ធនឹងផ្ញើប្រវត្តិ Login ទៅ Telegram Bot &amp; Google Sheet និងប្រមូលទិន្នន័យស្វ័យប្រវត្តិ
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-4 flex-wrap'>
                    {/* Countdown Display Units (Light Slate Clean Style) */}
                    <div className='flex items-center gap-1.5 font-mono'>
                        <div className='flex flex-col items-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl min-w-[52px]'>
                            <span className='text-base font-extrabold text-blue-700 tabular-nums'>{countdown.days}</span>
                            <span className='text-[9px] text-slate-500 font-bold uppercase tracking-tight'>ថ្ងៃ</span>
                        </div>
                        <span className='text-slate-400 font-bold text-sm'>:</span>
                        <div className='flex flex-col items-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl min-w-[52px]'>
                            <span className='text-base font-extrabold text-blue-700 tabular-nums'>{String(countdown.hours).padStart(2, '0')}</span>
                            <span className='text-[9px] text-slate-500 font-bold uppercase tracking-tight'>ម៉ោង</span>
                        </div>
                        <span className='text-slate-400 font-bold text-sm'>:</span>
                        <div className='flex flex-col items-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl min-w-[52px]'>
                            <span className='text-base font-extrabold text-blue-700 tabular-nums'>{String(countdown.minutes).padStart(2, '0')}</span>
                            <span className='text-[9px] text-slate-500 font-bold uppercase tracking-tight'>នាទី</span>
                        </div>
                        <span className='text-slate-400 font-bold text-sm'>:</span>
                        <div className='flex flex-col items-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl min-w-[52px]'>
                            <span className='text-base font-extrabold text-blue-600 tabular-nums'>{String(countdown.seconds).padStart(2, '0')}</span>
                            <span className='text-[9px] text-slate-500 font-bold uppercase tracking-tight'>វិនាទី</span>
                        </div>
                    </div>

                    {/* Force Send Button */}
                    <button
                        onClick={handleSendTelegramReport}
                        disabled={sendingTelegram}
                        className='px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        {sendingTelegram ? (
                            <>
                                <div className='w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                                <span>{t('sendingReport') || 'កំពុងផ្ញើ...'}</span>
                            </>
                        ) : (
                            <>
                                <FaTelegramPlane size={14} />
                                <span>{t('sendToBot') || 'ផ្ញើទៅ Telegram Bot'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs'>
                <div className='relative flex-1 min-w-[240px]'>
                    <FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs' />
                    <input
                        type='text'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('search')}
                        className='w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 bg-slate-50'
                    />
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <div className='flex items-center gap-1.5'>
                        <label className='text-xs font-bold text-slate-600 flex items-center gap-1'>
                            <FaUserShield className='text-indigo-600' /> Role:
                        </label>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className='px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer'
                        >
                            <option value=''>All Roles</option>
                            <option value='Administrator'>Administrator</option>
                            <option value='Manager'>Manager</option>
                            <option value='Staff'>Staff</option>
                            <option value='Viewer'>Viewer</option>
                        </select>
                    </div>

                    <div className='flex items-center gap-1.5'>
                        <label className='text-xs font-bold text-slate-600 flex items-center gap-1'>
                            Status:
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer'
                        >
                            <option value=''>All Statuses</option>
                            <option value='Success'>Success Only</option>
                            <option value='Failed'>Failed Only</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-450px)] pb-28 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 font-semibold'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('username')}</th>
                            <th className='px-4 py-3'>Full Name</th>
                            <th className='px-4 py-3 text-center'>{t('role')}</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3 font-mono'>IP Address</th>
                            <th className='px-4 py-3'>Device & OS</th>
                            <th className='px-4 py-3'>Date & Time</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="text-center py-10 text-slate-400">Loading history logs...</td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-10 text-slate-500 italic">
                                    No login history records found.
                                </td>
                            </tr>
                        ) : (
                            logs.map((item, idx) => (
                                <tr key={item.id || idx} className='hover:bg-indigo-50/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>
                                        {(page - 1) * LIMIT + idx + 1}
                                    </td>
                                    <td className='px-4 py-3 font-bold text-indigo-900 font-mono'>
                                        <CopyCell text={item.username} className='font-bold text-indigo-900 font-mono' />
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-slate-900'>
                                        <CopyCell text={item.name} className='font-semibold text-slate-900' />
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${item.role === 'Administrator' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                            {item.role || 'User'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]'>
                                            {item.brand || 'Global'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-mono text-slate-700 font-bold'>
                                        <CopyCell text={item.ip} className='font-mono text-slate-700 font-bold' />
                                    </td>
                                    <td className='px-4 py-3 text-slate-700 font-medium'>
                                        <CopyCell text={item.deviceInfo} className='text-slate-700 font-medium' />
                                    </td>
                                    <td className='px-4 py-3 text-slate-600 font-mono text-[11px]'>
                                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${item.status === 'Failed' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
                                            {item.status === 'Failed' ? (
                                                <>
                                                    <FaExclamationTriangle size={9} />
                                                    <span>Failed</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FaCheckCircle size={9} />
                                                    <span>Success</span>
                                                </>
                                            )}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={page} totalItems={total} itemsPerPage={LIMIT} onPageChange={setPage} />
        </div>
    );
};

export default LoginHistory;
