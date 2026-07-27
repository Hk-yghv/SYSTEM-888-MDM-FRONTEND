import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { MdOutlineSync, MdPictureAsPdf } from "react-icons/md";
import { FaFileExcel } from 'react-icons/fa';
import { IoMdWallet } from 'react-icons/io';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import Pagination from '../../../components/Pagination';

const LIMIT = 10;

const PaymentHistory = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchPayments = useCallback(async (pg = 1, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ page: pg, limit: LIMIT });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/payments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch payments error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    }, [API_BASE, searchTerm]);

    useEffect(() => { fetchPayments(page); }, [page]);
    useEffect(() => { fetchPayments(1, searchTerm); setPage(1); }, [searchTerm]);

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchTerm(searchInput);
    };

    const handleExportExcel = () => {
        const data = payments.map((p, idx) => ({
            'No': idx + 1,
            'Payment ID': p.paymentId || '',
            'Contract ID': p.contractId || '',
            'Customer Name': p.customerName || '',
            'Model': p.model || '',
            'Serial Number': p.serialNumber || '',
            'Brand': p.brand || '',
            'Paid Date': p.paidDate || '',
            'Paid By': p.paidBy || '',
            'Amount ($)': p.amount || 0,
            'Description': p.description || ''
        }));
        exportToExcel(data, 'Payment_History_Report');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Payment ID', accessor: 'paymentId' },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Paid Date', accessor: 'paidDate' },
            { header: 'Paid By', accessor: 'paidBy' },
            { header: 'Amount ($)', cell: (r) => `$${r.amount}` }
        ];
        exportToPDF('Payment History Audit Report', columns, payments);
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl'>
                        <IoMdWallet />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-gray-100 flex items-center gap-2'>
                            {t('paymentHistory')}
                        </h1>
                        <p className='text-xs text-emerald-400 font-mono font-semibold'>
                            Total Revenue: ${totalPaid.toLocaleString()} — {total} Transactions
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'
                    >
                        <FaFileExcel />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all'
                    >
                        <MdPictureAsPdf className="text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex items-center gap-1">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('search')}
                            className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 focus:border-indigo-500 w-44"
                        />
                        <button type="submit" className="px-3 py-1.5 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-300 border border-indigo-700/40 rounded-xl text-xs font-bold cursor-pointer">
                            Go
                        </button>
                        {searchTerm && (
                            <button type="button" onClick={() => { setSearchTerm(''); setSearchInput(''); }} className="px-2 py-1.5 text-gray-500 hover:text-red-400 text-xs cursor-pointer">✕</button>
                        )}
                    </form>

                    <button
                        onClick={() => fetchPayments(page)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Payment History Table */}
            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('paidDate')}</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3'>{t('model')} & Serial</th>
                            <th className='px-4 py-3'>Brand</th>
                            <th className='px-4 py-3'>{t('paidBy')}</th>
                            <th className='px-4 py-3 text-right'>{t('amount')}</th>
                            <th className='px-4 py-3'>{t('description')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-indigo-400">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500 italic">
                                    No payment history records found.
                                </td>
                            </tr>
                        ) : (
                            payments.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-indigo-300 font-semibold'>{item.paidDate}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-2.5">
                                            {item.photo ? (
                                                <img src={item.photo} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-gray-700" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center text-[10px] font-bold text-indigo-300">PAY</div>
                                            )}
                                            <span className='font-bold text-gray-100'>{item.customerName}</span>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='text-gray-200 font-semibold block'>{item.model}</span>
                                        <span className='text-gray-400 font-mono text-[11px] block'>{item.serialNumber}</span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? (
                                            <span className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 text-indigo-300 rounded-full font-bold text-[10px]">{item.brand}</span>
                                        ) : <span className="text-gray-600 text-[10px]">-</span>}
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-gray-300'>{item.paidBy}</td>
                                    <td className='px-4 py-3 text-right font-bold text-emerald-400 font-mono text-sm'>
                                        ${Number(item.amount).toLocaleString()}
                                    </td>
                                    <td className='px-4 py-3 text-gray-400 text-[11px]'>{item.description || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={LIMIT}
                onPageChange={setPage}
            />
        </div>
    );
};

export default PaymentHistory;
