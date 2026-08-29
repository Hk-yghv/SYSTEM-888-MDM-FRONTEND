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
    const { API_BASE1, user } = useAuth();

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
            const params = new URLSearchParams({
                page: pg,
                limit: LIMIT,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
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
    }, [API_BASE1, searchTerm, user]);

    useEffect(() => { fetchPayments(page); }, [page]);
    useEffect(() => { fetchPayments(1, searchTerm); setPage(1); }, [searchTerm]);

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchTerm(searchInput);
    };

    const fetchAllForExport = async () => {
        try {
            const params = new URLSearchParams({
                page: 1,
                limit: 999999,
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`${API_BASE1}/payments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
        } catch (err) {
            console.error('Fetch all payments for export error:', err);
        }
        return payments;
    };

    const handleExportExcel = async () => {
        const allData = await fetchAllForExport();
        const data = allData.map((p, idx) => ({
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

    const handleExportPDF = async () => {
        const allData = await fetchAllForExport();
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Payment ID', accessor: 'paymentId' },
            { header: 'Customer', accessor: 'customerName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Paid Date', accessor: 'paidDate' },
            { header: 'Paid By', accessor: 'paidBy' },
            { header: 'Amount ($)', cell: (r) => `$${r.amount}` }
        ];
        exportToPDF('Payment History Audit Report', columns, allData);
    };

    return (
        <div className='w-full bg-[#f4f6f8] p-4 select-none space-y-4'>
            {/* Header */}
            <header className='p-3 w-full border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xl'>
                        <IoMdWallet />
                    </div>
                    <div>
                        <h1 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
                            {t('paymentHistory')}
                        </h1>
                        <p className='text-xs text-emerald-700 font-mono font-bold'>
                            Total Revenue: ${totalPaid.toLocaleString()} — {total} Transactions
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <button
                        onClick={handleExportExcel}
                        className='flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <FaFileExcel className="text-emerald-600 text-sm" />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className='flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs'
                    >
                        <MdPictureAsPdf className="text-red-600 text-sm" />
                        <span>PDF</span>
                    </button>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex items-center gap-1">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('search')}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 w-44 font-medium outline-none shadow-xs"
                        />
                        <button type="submit" className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                            Go
                        </button>
                        {searchTerm && (
                            <button type="button" onClick={() => { setSearchTerm(''); setSearchInput(''); }} className="px-2 py-1.5 text-slate-400 hover:text-red-600 text-xs cursor-pointer font-bold">✕</button>
                        )}
                    </form>

                    <button
                        onClick={() => fetchPayments(page)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-slate-300 transition-all shadow-xs'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-emerald-600' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Payment History Table */}
            <div className='w-full overflow-x-auto h-[calc(100vh-250px)] pb-14 rounded-2xl border border-slate-200 bg-white shadow-md table-container'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200'>
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
                    <tbody className='divide-y divide-slate-100 font-medium text-slate-800'>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-emerald-600 font-semibold">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-500 italic font-medium">
                                    No payment history records found.
                                </td>
                            </tr>
                        ) : (
                            payments.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-emerald-50/50 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-slate-600 font-semibold'>{(page - 1) * LIMIT + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-emerald-700 font-semibold'>{item.paidDate}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-2.5">
                                            {/* {item.photo ? (
                                                <img src={item.photo} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[10px] font-bold text-emerald-700">PAY</div>
                                            )} */}
                                            <span className='font-bold text-slate-900'>{item.customerName}</span>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3'>
                                        <span className='text-slate-900 font-semibold block'>{item.model}</span>
                                        <span className='text-slate-500 font-mono text-[11px] block'>{item.serialNumber}</span>
                                    </td>
                                    <td className='px-4 py-3'>
                                        {item.brand ? (
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-full font-bold text-[10px]">{item.brand}</span>
                                        ) : <span className="text-slate-400 text-[10px]">-</span>}
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-slate-700'>{item.paidBy}</td>
                                    <td className='px-4 py-3 text-right font-bold text-emerald-700 font-mono text-sm'>
                                        ${Number(item.amount).toLocaleString()}
                                    </td>
                                    <td className='px-4 py-3 text-slate-600 text-[11px] font-medium'>{item.description || '-'}</td>
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
