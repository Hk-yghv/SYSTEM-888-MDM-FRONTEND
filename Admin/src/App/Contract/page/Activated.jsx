import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { AiOutlineMenu } from "react-icons/ai";
import { MdOutlineSync, MdInfo, MdQrCode2, MdCheckCircle, MdSearch, MdSwapHoriz, MdComment, MdPictureAsPdf } from "react-icons/md";
import { FaQrcode, FaCheck, FaMobileAlt, FaFileExcel } from "react-icons/fa";
import CreateApplication from '../components/CreateApplication';
import CustomModal from '../../../components/CustomModal';
import Pagination from '../../../components/Pagination';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';

const Activated = () => {
    const { t } = useLanguage();
    const { API_BASE } = useAuth();

    const [activatedContracts, setActivatedContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const itemsPerPage = 10;

    const [openMenuId, setOpenMenuId] = useState(null);
    const [selectedInfo, setSelectedInfo] = useState(null);
    const [editData, setEditData] = useState(null);
    const [openEditModal, setOpenEditModal] = useState(false);

    // Comment Modal State
    const [selectedCommentItem, setSelectedCommentItem] = useState(null);
    const [commentInput, setCommentInput] = useState('');

    // UI Custom Modal alert state
    const [uiModal, setUiModal] = useState({ open: false, title: '', message: '', type: 'info' });

    // QR/Payment state
    const [selectedQrContract, setSelectedQrContract] = useState(null);
    const [qrPayload, setQrPayload] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [paymentMethods, setPaymentMethods] = useState(['ABA Pay QR', 'Wing Money', 'Cash', 'Bank Transfer']);
    const [phoneForm, setPhoneForm] = useState({
        paidDate: new Date().toISOString().split('T')[0],
        paidBy: '',
        amount: 150,
        description: ''
    });
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const fetchActivatedContracts = async (pg = currentPage, search = searchTerm) => {
        setReloading(true);
        try {
            const params = new URLSearchParams({ status: 'Activated', page: pg, limit: itemsPerPage });
            if (search) params.set('search', search);
            const res = await fetch(`${API_BASE}/contracts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setActivatedContracts(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Fetch activated contracts error:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 500);
        }
    };

    // Fetch Payment Methods from ControlSystem
    const fetchPaymentMethods = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const pmCat = data.droplists?.find(d => d.category === 'Payment Methods');
                if (pmCat && pmCat.items?.length) setPaymentMethods(pmCat.items);
            }
        } catch { }
    };

    useEffect(() => { fetchActivatedContracts(currentPage, searchTerm); }, [currentPage]);
    useEffect(() => { fetchActivatedContracts(1, searchTerm); setCurrentPage(1); }, [searchTerm]);
    useEffect(() => { fetchPaymentMethods(); }, []);

    const filteredContracts = activatedContracts; // server already filters+paginates

    const handleChangeStatus = async (item, targetStatus) => {
        try {
            const res = await fetch(`${API_BASE}/contracts/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus })
            });
            if (res.ok) {
                setUiModal({
                    open: true,
                    title: 'Status Updated',
                    message: `Contract "${item.customerNameEn}" status successfully changed to ${targetStatus}!`,
                    type: 'success'
                });
                fetchActivatedContracts();
                setOpenMenuId(null);
            }
        } catch (err) {
            console.error('Change status error:', err);
        }
    };

    const handleSaveComment = async (e) => {
        e.preventDefault();
        if (!selectedCommentItem) return;

        try {
            const res = await fetch(`${API_BASE}/contracts/${selectedCommentItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Comments',
                    notes: commentInput
                })
            });

            if (res.ok) {
                setUiModal({
                    open: true,
                    title: 'Comment Saved',
                    message: `Comment added for "${selectedCommentItem.customerNameEn}". Moved to Comments page!`,
                    type: 'success'
                });
                setSelectedCommentItem(null);
                setCommentInput('');
                fetchActivatedContracts();
            }
        } catch (err) {
            console.error('Save comment error:', err);
        }
    };

    const handleOpenQrModal = async (contract) => {
        setSelectedQrContract(contract);
        setPaymentSuccess(false);
        setPhoneForm({
            paidDate: new Date().toISOString().split('T')[0],
            paidBy: paymentMethods[0] || 'Cash',
            amount: contract.monthlyPayment || 150,
            description: `Installment payment for ${contract.model}`
        });
        try {
            const res = await fetch(`${API_BASE}/payments/qr-payload/${contract.contractId}`);
            if (res.ok) {
                const data = await res.json();
                setQrPayload(data.payload);
                setQrDataUrl(data.qrDataUrl);
            }
        } catch (err) {
            console.error('Error fetching QR payload:', err);
        }
    };

    const handleMobilePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedQrContract) return;
        setPaymentSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: selectedQrContract.contractId,
                    customerName: `${selectedQrContract.customerNameEn} (${selectedQrContract.customerNameKh})`,
                    photo: selectedQrContract.customerPhoto,
                    serialNumber: selectedQrContract.serialNumber,
                    model: selectedQrContract.model,
                    paidDate: phoneForm.paidDate,
                    paidBy: phoneForm.paidBy,
                    amount: Number(phoneForm.amount),
                    description: phoneForm.description
                })
            });
            if (res.ok) {
                setPaymentSuccess(true);
                setTimeout(() => {
                    setSelectedQrContract(null);
                    setPaymentSuccess(false);
                }, 2000);
            }
        } catch (err) {
            console.error('Submit payment error:', err);
        } finally {
            setPaymentSubmitting(false);
        }
    };

    const handleExportExcel = () => {
        const data = filteredContracts.map((c, idx) => ({
            'No': idx + 1,
            'Name (EN)': c.customerNameEn || '',
            'Name (KH)': c.customerNameKh || '',
            'ID Card': c.idCardNumber || '',
            'DOB': c.dob || '',
            'Gender': c.gender || '',
            'Phone': c.phone || '',
            'Device Model': c.model || '',
            'Serial Number': c.serialNumber || '',
            'Total Amount ($)': c.amount || c.totalAmount || 0,
            'Monthly ($)': c.monthlyPayment || 0,
            'Input Date': c.inputDate || '',
            'Status': c.status || 'Activated',
        }));
        exportToExcel(data, 'Activated_Contracts');
    };

    const handleExportPDF = () => {
        const columns = [
            { header: 'No', cell: (_, idx) => idx + 1 },
            { header: 'Name EN', accessor: 'customerNameEn' },
            { header: 'Name KH', accessor: 'customerNameKh' },
            { header: 'Phone', accessor: 'phone' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Monthly ($)', cell: (r) => `$${r.monthlyPayment}` },
        ];
        exportToPDF('Activated Contracts Directory', columns, filteredContracts);
    };

    return (
        <div className='w-full h-[93vh] overflow-y-auto bg-[#070913] p-4 select-none space-y-4 relative'>

            {/* UI Custom Modal Popup */}
            <CustomModal
                open={uiModal.open}
                title={uiModal.title}
                message={uiModal.message}
                type={uiModal.type}
                onConfirm={() => setUiModal({ ...uiModal, open: false })}
            />

            {/* Header */}
            <header className='p-3 w-full border-b border-gray-800/80 bg-[#0f1426]/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md'>
                <div>
                    <h1 className='text-lg font-bold text-indigo-400 flex items-center gap-2'>
                        <MdCheckCircle className="text-emerald-400 text-xl" />
                        <span>{t('activated')} Contracts</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                            {filteredContracts.length} Records
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Search name, model, serial..."
                            className="pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 focus:border-indigo-500 w-52 outline-none"
                        />
                    </div>

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

                    <button
                        onClick={() => fetchActivatedContracts(currentPage, searchTerm)}
                        disabled={reloading}
                        className='flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl text-xs cursor-pointer border border-gray-700 transition-all'
                    >
                        <MdOutlineSync size={16} className={reloading ? 'spin-reload text-indigo-400' : ''} />
                        <p>{t('reload')}</p>
                    </button>
                </div>
            </header>

            {/* Table */}
            <div className='w-full overflow-x-auto rounded-2xl border border-gray-800 bg-[#0f1426]/90 shadow-xl'>
                <table className='w-full text-left text-xs'>
                    <thead className='bg-gray-900/90 text-gray-400 uppercase tracking-wider border-b border-gray-800'>
                        <tr>
                            <th className='px-4 py-3 text-center'>No</th>
                            <th className='px-4 py-3'>{t('inputDate')}</th>
                            <th className='px-4 py-3'>{t('customerName')}</th>
                            <th className='px-4 py-3 text-center'>{t('status')}</th>
                            <th className='px-4 py-3'>{t('model')}</th>
                            <th className='px-4 py-3'>{t('serialNumber')}</th>
                            <th className='px-4 py-3 text-center'>Monthly</th>
                            <th className='px-4 py-3 text-center'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-800/60 font-medium text-gray-200'>
                        {filteredContracts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500 italic">
                                    {searchTerm ? `No results found for "${searchTerm}"` : 'No activated contracts yet. Activate contracts in Application page first.'}
                                </td>
                            </tr>
                        ) : (
                            filteredContracts.map((item, idx) => (
                                <tr key={item._id || idx} className='hover:bg-gray-800/40 transition-colors'>
                                    <td className='px-4 py-3 text-center font-mono text-gray-400'>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className='px-4 py-3 font-mono text-gray-400'>{item.inputDate}</td>
                                    <td className='px-4 py-3'>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={item.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                                alt="avatar"
                                                className="w-7 h-7 rounded-full object-cover border border-gray-700"
                                            />
                                            <div>
                                                <span className='font-bold text-gray-100 block'>{item.customerNameEn}</span>
                                                <span className='text-indigo-400 font-khmer text-xs block'>{item.customerNameKh}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className='px-4 py-3 text-center'>
                                        <span className='px-3 py-1 bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 rounded-full font-bold text-[10px] uppercase'>
                                            Activated
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 font-semibold text-gray-300'>{item.model}</td>
                                    <td className='px-4 py-3 font-mono text-gray-400'>{item.serialNumber}</td>
                                    <td className='px-4 py-3 text-center font-mono font-bold text-emerald-400'>${item.monthlyPayment}/mo</td>
                                    <td className="px-4 py-3 text-center relative">
                                        <div className="flex items-center justify-center gap-2">
                                            {(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL) && (
                                                <button
                                                    onClick={() => window.open(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL, '_blank')}
                                                    className="px-3 h-8 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 flex items-center justify-center text-[10px] font-semibold transition-all"
                                                >
                                                    Mosyle
                                                </button>
                                            )}
                                            <div className="relative inline-block text-left">
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === item._id ? null : item._id)}
                                                    className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 transition-all cursor-pointer"
                                                >
                                                    <AiOutlineMenu size={16} />
                                                </button>

                                            {openMenuId === item._id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-[#141a30] border border-gray-700 rounded-2xl shadow-2xl z-50 p-1 space-y-1">
                                                    <button
                                                        onClick={() => { setSelectedInfo(item); setOpenMenuId(null); }}
                                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdInfo className="text-indigo-400 text-sm" />
                                                        <span>{t('information')}</span>
                                                    </button>
                                                    {(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL) && (
                                                        <button
                                                            onClick={() => window.open(item.mosyleUrl || item.mosyle_url || item.urlMosyle || item.mosyleURL, '_blank')}
                                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <span>Open Mosyle</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { handleOpenQrModal(item); setOpenMenuId(null); }}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdQrCode2 className="text-emerald-400 text-base" />
                                                        <span>{t('qrCode')} Payment</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedCommentItem(item);
                                                            setCommentInput(item.notes || '');
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdComment className="text-cyan-400 text-base" />
                                                        <span>Comment</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleChangeStatus(item, 'Check')}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdSwapHoriz className="text-blue-400 text-base" />
                                                        <span>Move to Check</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleChangeStatus(item, 'Redeem')}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdSwapHoriz className="text-purple-400 text-base" />
                                                        <span>Move to Redeem</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleChangeStatus(item, 'Blacklist')}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/50 rounded-xl flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <MdSwapHoriz className="text-red-400 text-base" />
                                                        <span>Move to Blacklist</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination controls */}
            <Pagination
                currentPage={currentPage}
                totalItems={total}
                itemsPerPage={itemsPerPage}
                onPageChange={(pg) => setCurrentPage(pg)}
            />

            {/* Comment Input Modal */}
            {selectedCommentItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
                    <form onSubmit={handleSaveComment} className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                                <MdComment className="text-lg" /> Add Comment Note
                            </h3>
                            <button type="button" onClick={() => setSelectedCommentItem(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>

                        <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800 text-xs">
                            <p className="text-gray-400">Customer: <span className="text-gray-100 font-bold">{selectedCommentItem.customerNameEn}</span></p>
                            <p className="text-gray-400">Model: <span className="text-gray-200 font-semibold">{selectedCommentItem.model}</span></p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Enter Comment Note</label>
                            <textarea
                                required
                                rows={4}
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                placeholder="Type comment or notes about this contract..."
                                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 outline-none focus:border-cyan-500 font-sans"
                            ></textarea>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedCommentItem(null)}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30"
                            >
                                Submit & Move to Comments
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Information Modal */}
            {selectedInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                                <MdInfo className="text-indigo-400 text-xl" />
                                Activated Contract Details
                            </h3>
                            <button onClick={() => setSelectedInfo(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
                            <img
                                src={selectedInfo.customerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                alt="avatar"
                                className="w-16 h-16 rounded-2xl object-cover border border-indigo-500/40"
                            />
                            <div>
                                <h4 className="text-base font-bold text-gray-100">{selectedInfo.customerNameEn}</h4>
                                <p className="text-sm text-indigo-400 font-khmer">{selectedInfo.customerNameKh}</p>
                                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                    ✓ Activated
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-indigo-300 uppercase">Customer Info</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Contract ID</span><span className="font-mono text-gray-200 font-bold">{selectedInfo.contractId}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">ID Card</span><span className="font-mono text-gray-200">{selectedInfo.idCardNumber || '-'}</span></div>
                                <div className="p-2.5 bg-gray-900/60 rounded-xl border border-gray-800"><span className="text-gray-400 block text-[10px]">Phone</span><span className="font-mono text-gray-200">{selectedInfo.phone || '-'}</span></div>
                            </div>
                        </div>

                        <div className="text-right pt-2">
                            <button onClick={() => setSelectedInfo(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code & Mobile Payment Simulator Modal */}
            {selectedQrContract && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-[#0f1426] border border-gray-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                                <FaQrcode className="text-emerald-400 text-xl" />
                                QR Code Payment & Mobile Entry Simulator
                            </h3>
                            <button onClick={() => setSelectedQrContract(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 text-center space-y-4 flex flex-col items-center justify-center">
                                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Scan ABA Pay / System QR</h4>
                                    {qrDataUrl ? (
                                        <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                                            <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-44 h-44 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500 animate-pulse">
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
                                            <input type="date" required value={phoneForm.paidDate} onChange={(e) => setPhoneForm({ ...phoneForm, paidDate: e.target.value })} className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100 font-mono" />
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
                                            <input type="number" required value={phoneForm.amount} onChange={(e) => setPhoneForm({ ...phoneForm, amount: e.target.value })} className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-emerald-400 font-bold font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-400 mb-1">{t('description')}</label>
                                            <input type="text" value={phoneForm.description} onChange={(e) => setPhoneForm({ ...phoneForm, description: e.target.value })} placeholder="Note or transaction ref" className="w-full h-9 px-3 bg-gray-900 border border-gray-700 rounded-xl text-gray-100" />
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
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Activated;