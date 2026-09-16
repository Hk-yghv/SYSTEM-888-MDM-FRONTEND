import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaFilter, FaBuilding,
    FaSave, FaTimes, FaCalculator,
    FaBan, FaCheckCircle, FaChartBar
} from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';
import { exportToExcel } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';

const FollowUp4 = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    // Active Tab
    const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'rejectSubmit' | 'rejectCs' | 'detail'

    // Brand filtering & list
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['888MDM', 'ECloud']);

    // Master droplists from Control System
    const [droplists, setDroplists] = useState({
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'],
        contactTypes: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'],
        statuses: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'],
        rejectSubmitReasons: ['ឯកសារមិនគ្រប់', 'ព័ត៌មានមិនច្បាស់', 'អតិថិជនប្តូរចិត្ត', 'ទាក់ទងមិនបាន', 'ផ្សេងៗ'],
        rejectCsReasons: ['តម្លៃមិនព្រម', 'គ្មានសមត្ថភាពបង់', 'លក្ខខណ្ឌមិនត្រូវ', 'មិនឆ្លើយតប', 'ផ្សេងៗ']
    });

    const isMasterAdmin = useMemo(() => {
        return (
            user?.username === '@hakyonghouv' ||
            user?.username === 'hakyonghouv' ||
            user?.isImmutable === true ||
            user?.role === 'Administrator' ||
            user?.role === 'Admin'
        );
    }, [user]);

    // Fetch Brands and Control System Droplists
    const fetchControlSystemData = useCallback(async () => {
        try {
            const brandQuery = selectedBrand ? `?brand=${encodeURIComponent(selectedBrand)}` : '?brand=';
            const res = await fetch(`${API_BASE}/controlsystem${brandQuery}`);
            if (res.ok) {
                const data = await res.json();
                if (data.droplists && Array.isArray(data.droplists)) {
                    const src = data.droplists.find(d => d.category === 'Follow Up 4 Sources')?.items;
                    const ct = data.droplists.find(d => d.category === 'Follow Up 4 Contact Types')?.items;
                    const st = data.droplists.find(d => d.category === 'Follow Up 4 Statuses')?.items;
                    const rsr = data.droplists.find(d => d.category === 'Reject Submit Reasons')?.items;
                    const rcr = data.droplists.find(d => d.category === 'Reject CS Reasons')?.items;
                    const bList = data.droplists.find(d => d.category === 'Brands')?.items;

                    if (bList && Array.isArray(bList) && bList.length > 0) setBrandsList(bList);

                    setDroplists(prev => ({
                        sources: (src && src.length) ? src : prev.sources,
                        contactTypes: (ct && ct.length) ? ct : prev.contactTypes,
                        statuses: (st && st.length) ? st : prev.statuses,
                        rejectSubmitReasons: (rsr && rsr.length) ? rsr : prev.rejectSubmitReasons,
                        rejectCsReasons: (rcr && rcr.length) ? rcr : prev.rejectCsReasons
                    }));
                }
            }
        } catch (err) {
            console.error('Fetch Control System Error in FollowUp4:', err);
        }
    }, [API_BASE, selectedBrand]);

    useEffect(() => {
        fetchControlSystemData();
    }, [fetchControlSystemData]);

    // =========================================================
    // TAB 1: FOLLOW UP SUBMIT STATE & LOGIC
    // =========================================================
    const [submitList, setSubmitList] = useState([]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        name: '',
        userName: '',
        phone: '',
        nameTelegram: '',
        fromSource: '',
        namePgTlFrom: '',
        contactType: '',
        namePgTlContact: '',
        appraisal: '',
        requested: '',
        assetType: '',
        model: '',
        status: 'PENDING',
        description: '',
        brand: user?.brand || '888MDM'
    });

    const [deleteModalItem, setDeleteModalItem] = useState(null);

    const fetchSubmitData = useCallback(async () => {
        setSubmitLoading(true);
        try {
            const params = new URLSearchParams();
            if (user?.brand) params.append('userBrand', user.brand);
            if (user?.role) params.append('userRole', user.role);
            if (user?.username) params.append('username', user.username);
            if (user?.isImmutable) params.append('isImmutable', String(user.isImmutable));
            if (selectedBrand) params.append('brand', selectedBrand);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`${API_BASE}/follow-up-4/submit?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setSubmitList(result.data || []);
            }
        } catch (err) {
            console.error('Fetch Submit Data Error:', err);
        } finally {
            setSubmitLoading(false);
        }
    }, [API_BASE, user, selectedBrand, startDate, endDate, searchTerm]);

    useEffect(() => {
        if (activeTab === 'submit') {
            fetchSubmitData();
        }
    }, [activeTab, fetchSubmitData]);

    const handleOpenCreateForm = () => {
        setEditingItem(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            name: '',
            userName: '',
            phone: '',
            nameTelegram: '',
            fromSource: droplists.sources[0] || 'PAGE',
            namePgTlFrom: '',
            contactType: droplists.contactTypes[0] || 'Call',
            namePgTlContact: '',
            appraisal: '',
            requested: '',
            assetType: '',
            model: '',
            status: droplists.statuses[0] || 'PENDING',
            description: '',
            brand: selectedBrand || user?.brand || '888MDM'
        });
        setIsFormOpen(true);
    };

    const handleOpenEditForm = (item) => {
        setEditingItem(item);
        setFormData({
            date: item.date || new Date().toISOString().split('T')[0],
            name: item.name || '',
            userName: item.userName || '',
            phone: item.phone || '',
            nameTelegram: item.nameTelegram || '',
            fromSource: item.fromSource || '',
            namePgTlFrom: item.namePgTlFrom || '',
            contactType: item.contactType || '',
            namePgTlContact: item.namePgTlContact || '',
            appraisal: item.appraisal || '',
            requested: item.requested || '',
            assetType: item.assetType || '',
            model: item.model || '',
            status: item.status || 'PENDING',
            description: item.description || '',
            brand: item.brand || selectedBrand || user?.brand || '888MDM'
        });
        setIsFormOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('សូមបញ្ចូល NAME');
            return;
        }

        try {
            const url = editingItem
                ? `${API_BASE}/follow-up-4/submit/${editingItem._id}`
                : `${API_BASE}/follow-up-4/submit`;
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                createdBy: user?.username || user?.name || 'Staff'
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsFormOpen(false);
                fetchSubmitData();
            } else {
                const errData = await res.json();
                alert(`Error: ${errData.message || 'Failed to save'}`);
            }
        } catch (err) {
            alert(`Network Error: ${err.message}`);
        }
    };

    const handleDeleteSubmit = async () => {
        if (!deleteModalItem) return;
        try {
            const res = await fetch(`${API_BASE}/follow-up-4/submit/${deleteModalItem._id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setDeleteModalItem(null);
                fetchSubmitData();
            } else {
                alert('Failed to delete item');
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    // =========================================================
    // TAB 2: REJECT SUBMIT STATE & LOGIC
    // =========================================================
    const [rejectSubmitDate, setRejectSubmitDate] = useState(new Date().toISOString().split('T')[0]);
    const [rejectSubmitCounts, setRejectSubmitCounts] = useState({});
    const [rejectSubmitSaving, setRejectSubmitSaving] = useState(false);

    const fetchRejectSubmitData = useCallback(async () => {
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${API_BASE}/follow-up-4/reject-submit?date=${rejectSubmitDate}&brand=${encodeURIComponent(targetBrand)}`);
            if (res.ok) {
                const result = await res.json();
                const countsObj = {};
                (result.data || []).forEach(r => {
                    countsObj[r.reason] = r.count;
                });
                setRejectSubmitCounts(countsObj);
            }
        } catch (err) {
            console.error('Fetch Reject Submit Error:', err);
        }
    }, [API_BASE, rejectSubmitDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'rejectSubmit') {
            fetchRejectSubmitData();
        }
    }, [activeTab, fetchRejectSubmitData]);

    const handleSaveRejectSubmit = async () => {
        setRejectSubmitSaving(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const entries = droplists.rejectSubmitReasons.map(reason => ({
                reason,
                count: Number(rejectSubmitCounts[reason]) || 0
            }));

            const res = await fetch(`${API_BASE}/follow-up-4/reject-submit/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: rejectSubmitDate,
                    brand: targetBrand,
                    entries,
                    createdBy: user?.username || 'Staff'
                })
            });

            if (res.ok) {
                alert('✅ បានរក្សាទុកទិន្នន័យ REJECT SUBMIT រួចរាល់!');
                fetchRejectSubmitData();
            } else {
                alert('❌ បរាជ័យក្នុងការរក្សាទុក');
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setRejectSubmitSaving(false);
        }
    };

    // =========================================================
    // TAB 3: REJECT CS STATE & LOGIC
    // =========================================================
    const [rejectCsDate, setRejectCsDate] = useState(new Date().toISOString().split('T')[0]);
    const [rejectCsCounts, setRejectCsCounts] = useState({});
    const [rejectCsSaving, setRejectCsSaving] = useState(false);

    const fetchRejectCsData = useCallback(async () => {
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${API_BASE}/follow-up-4/reject-cs?date=${rejectCsDate}&brand=${encodeURIComponent(targetBrand)}`);
            if (res.ok) {
                const result = await res.json();
                const countsObj = {};
                (result.data || []).forEach(r => {
                    countsObj[r.reason] = r.count;
                });
                setRejectCsCounts(countsObj);
            }
        } catch (err) {
            console.error('Fetch Reject CS Error:', err);
        }
    }, [API_BASE, rejectCsDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'rejectCs') {
            fetchRejectCsData();
        }
    }, [activeTab, fetchRejectCsData]);

    const handleSaveRejectCs = async () => {
        setRejectCsSaving(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const entries = droplists.rejectCsReasons.map(reason => ({
                reason,
                count: Number(rejectCsCounts[reason]) || 0
            }));

            const res = await fetch(`${API_BASE}/follow-up-4/reject-cs/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: rejectCsDate,
                    brand: targetBrand,
                    entries,
                    createdBy: user?.username || 'Staff'
                })
            });

            if (res.ok) {
                alert('✅ បានរក្សាទុកទិន្នន័យ REJECT CS រួចរាល់!');
                fetchRejectCsData();
            } else {
                alert('❌ បរាជ័យក្នុងការរក្សាទុក');
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setRejectCsSaving(false);
        }
    };

    // =========================================================
    // TAB 4: DETAIL STATE & AUTOMATED FORMULAS LOGIC
    // =========================================================
    const [detailDate, setDetailDate] = useState(new Date().toISOString().split('T')[0]);
    const [detailMetrics, setDetailMetrics] = useState({
        page: 0,
        telegram: 0,
        noReply: 0,
        inquire: 0,
        rejectCs: 0,
        more: 0,
        pageSubmit: 0,
        telegramSubmit: 0,
        review: 0,
        reject: 0,
        success1: 0,
        success2: 0
    });
    const [detailSaving, setDetailSaving] = useState(false);
    const [detailHistoryList, setDetailHistoryList] = useState([]);

    // AUTO-CALCULATED FORMULAS
    const calculatedFormulas = useMemo(() => {
        const p = Number(detailMetrics.page) || 0;
        const tg = Number(detailMetrics.telegram) || 0;

        const nr = Number(detailMetrics.noReply) || 0;
        const inq = Number(detailMetrics.inquire) || 0;
        const rcs = Number(detailMetrics.rejectCs) || 0;
        const mr = Number(detailMetrics.more) || 0;
        const ps = Number(detailMetrics.pageSubmit) || 0;
        const tgs = Number(detailMetrics.telegramSubmit) || 0;

        const rev = Number(detailMetrics.review) || 0;
        const rej = Number(detailMetrics.reject) || 0;
        const s1 = Number(detailMetrics.success1) || 0;
        const s2 = Number(detailMetrics.success2) || 0;

        const message = p + tg;
        const verify = nr + inq + rcs + mr + ps + tgs;
        const totalSubmit = ps + tgs;
        const verifySubmit = rev + rej + s1;
        const totalSuccess = s1 + s2;

        return {
            message,
            verify,
            totalSubmit,
            verifySubmit,
            totalSuccess
        };
    }, [detailMetrics]);

    const fetchDetailData = useCallback(async () => {
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const params = new URLSearchParams();
            if (user?.brand) params.append('userBrand', user.brand);
            if (user?.role) params.append('userRole', user.role);
            if (user?.username) params.append('username', user.username);
            if (user?.isImmutable) params.append('isImmutable', String(user.isImmutable));
            if (selectedBrand) params.append('brand', targetBrand);

            const res = await fetch(`${API_BASE}/follow-up-4/detail?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                const list = result.data || [];
                setDetailHistoryList(list);

                const currentDay = list.find(d => d.date === detailDate);
                if (currentDay) {
                    setDetailMetrics({
                        page: currentDay.page || 0,
                        telegram: currentDay.telegram || 0,
                        noReply: currentDay.noReply || 0,
                        inquire: currentDay.inquire || 0,
                        rejectCs: currentDay.rejectCs || 0,
                        more: currentDay.more || 0,
                        pageSubmit: currentDay.pageSubmit || 0,
                        telegramSubmit: currentDay.telegramSubmit || 0,
                        review: currentDay.review || 0,
                        reject: currentDay.reject || 0,
                        success1: currentDay.success1 || 0,
                        success2: currentDay.success2 || 0
                    });
                } else {
                    setDetailMetrics({
                        page: 0, telegram: 0, noReply: 0, inquire: 0,
                        rejectCs: 0, more: 0, pageSubmit: 0, telegramSubmit: 0,
                        review: 0, reject: 0, success1: 0, success2: 0
                    });
                }
            }
        } catch (err) {
            console.error('Fetch Detail Error:', err);
        }
    }, [API_BASE, detailDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'detail') {
            fetchDetailData();
        }
    }, [activeTab, detailDate, fetchDetailData]);

    const handleSaveDetail = async () => {
        setDetailSaving(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${API_BASE}/follow-up-4/detail/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: detailDate,
                    brand: targetBrand,
                    ...detailMetrics,
                    createdBy: user?.username || 'Staff'
                })
            });

            if (res.ok) {
                alert('✅ បានរក្សាទុកទិន្នន័យ DETAIL រួចរាល់!');
                fetchDetailData();
            } else {
                alert('❌ បរាជ័យក្នុងការរក្សាទុក');
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setDetailSaving(false);
        }
    };

    // Excel Export Helper
    const handleExportExcel = () => {
        if (activeTab === 'submit') {
            const exportData = submitList.map((item, idx) => ({
                '#': idx + 1,
                'កាលបរិច្ឆេទ': item.date,
                'NAME': item.name,
                'USER NAME': item.userName,
                'PHONE NUMBER': item.phone,
                'NAME TELEGRAM': item.nameTelegram,
                'មកពី': item.fromSource,
                'NAME PG/TL មកពី': item.namePgTlFrom,
                'ទាក់ទង': item.contactType,
                'NAME PG/TL ទាក់ទង': item.namePgTlContact,
                'វាយតម្លៃ': item.appraisal,
                'បានស្នើ': item.requested,
                'ប្រភេទទ្រព្យ': item.assetType,
                'MODEL': item.model,
                'STATUS': item.status,
                'បរិយាយ': item.description,
                'BRAND': item.brand
            }));
            exportToExcel(exportData, `FollowUp4_Submit_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'detail') {
            const exportData = detailHistoryList.map((item, idx) => {
                const message = (item.page || 0) + (item.telegram || 0);
                const verify = (item.noReply || 0) + (item.inquire || 0) + (item.rejectCs || 0) + (item.more || 0) + (item.pageSubmit || 0) + (item.telegramSubmit || 0);
                const totalSubmit = (item.pageSubmit || 0) + (item.telegramSubmit || 0);
                const verifySubmit = (item.review || 0) + (item.reject || 0) + (item.success1 || 0);
                const totalSuccess = (item.success1 || 0) + (item.success2 || 0);
                return {
                    '#': idx + 1,
                    'កាលបរិច្ឆេទ': item.date,
                    'BRAND': item.brand,
                    'MESSAGE (សរុប)': message,
                    'PAGE': item.page || 0,
                    'TELEGRAM': item.telegram || 0,
                    'VERIFY (សរុប)': verify,
                    'NO REPLY': item.noReply || 0,
                    'INQUIRE': item.inquire || 0,
                    'REJECT CS': item.rejectCs || 0,
                    'MORE': item.more || 0,
                    'TOTAL SUBMIT': totalSubmit,
                    'PAGE SUBMIT': item.pageSubmit || 0,
                    'TELEGRAM SUBMIT': item.telegramSubmit || 0,
                    'VERIFY SUBMIT': verifySubmit,
                    'REVIEW': item.review || 0,
                    'REJECT': item.reject || 0,
                    'TOTAL SUCCESS': totalSuccess,
                    'SUCCESS 1': item.success1 || 0,
                    'SUCCESS 2': item.success2 || 0
                };
            });
            exportToExcel(exportData, `FollowUp4_Detail_Metrics_${new Date().toISOString().split('T')[0]}`);
        }
    };

    return (
        <div className="p-4 md:p-6 bg-slate-900 text-slate-100 min-h-screen">
            {/* Header & Brand Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 shadow-lg">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                        <FaChartBar className="text-emerald-400" />
                        Follow Up 4 System
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">
                        ប្រព័ន្ធគ្រប់គ្រង Lead Submit, Reject Reasons, & Automated Detail Metrics
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Brand Selector */}
                    {isMasterAdmin && (
                        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
                            <FaBuilding className="text-emerald-400 text-sm" />
                            <span className="text-xs text-slate-300 font-semibold">Brand:</span>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer"
                            >
                                <option value="" className="bg-slate-800 text-slate-200">ALL BRANDS</option>
                                {brandsList.map(b => (
                                    <option key={b} value={b} className="bg-slate-800 text-slate-200">{b}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(activeTab === 'submit' || activeTab === 'detail') && (
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-all shadow-md"
                        >
                            <FaFileExcel size={14} />
                            <span>Export Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-700/80 pb-2">
                <button
                    onClick={() => setActiveTab('submit')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'submit'
                            ? 'bg-emerald-600 text-white border-b-2 border-emerald-400 shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <FaListUl />
                    <span>FOLLOW UP SUBMIT</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectSubmit')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'rejectSubmit'
                            ? 'bg-rose-600 text-white border-b-2 border-rose-400 shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <FaBan />
                    <span>REJECT SUBMIT</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectCs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'rejectCs'
                            ? 'bg-amber-600 text-white border-b-2 border-amber-400 shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <FaBan />
                    <span>REJECT CS</span>
                </button>

                <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'detail'
                            ? 'bg-blue-600 text-white border-b-2 border-blue-400 shadow-md'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <FaCalculator />
                    <span>DETAIL</span>
                </button>
            </div>

            {/* TAB 1: FOLLOW UP SUBMIT */}
            {activeTab === 'submit' && (
                <div className="space-y-4">
                    {/* Filters & Actions Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="ស្វែងរក Name, Phone, Username..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/90 text-xs text-slate-100 pl-9 pr-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Date Filter */}
                            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700">
                                <FaRegCalendarAlt className="text-slate-400 text-xs" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                                />
                                <span className="text-slate-500 text-xs">ដល់</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Add Button */}
                        {hasPermission('/follow-up/follow-up-4', 'create') && (
                            <button
                                onClick={handleOpenCreateForm}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-md"
                            >
                                <FaPlusCircle size={15} />
                                <span>បន្ថែម FOLLOW UP SUBMIT</span>
                            </button>
                        )}
                    </div>

                    {/* Submissions Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-3 px-3 text-center w-10">#</th>
                                        <th className="py-3 px-3">ថ្ងៃខែឆ្នាំ</th>
                                        <th className="py-3 px-3">NAME</th>
                                        <th className="py-3 px-3">USER NAME</th>
                                        <th className="py-3 px-3">PHONE NUMBER</th>
                                        <th className="py-3 px-3">NAME TELEGRAM</th>
                                        <th className="py-3 px-3">មកពី</th>
                                        <th className="py-3 px-3">PG/TL មកពី</th>
                                        <th className="py-3 px-3">ទាក់ទង</th>
                                        <th className="py-3 px-3">PG/TL ទាក់ទង</th>
                                        <th className="py-3 px-3">វាយតម្លៃ</th>
                                        <th className="py-3 px-3">បានស្នើ</th>
                                        <th className="py-3 px-3">ប្រភេទទ្រព្យ</th>
                                        <th className="py-3 px-3">MODEL</th>
                                        <th className="py-3 px-3">STATUS</th>
                                        <th className="py-3 px-3">បរិយាយ</th>
                                        <th className="py-3 px-3 text-center">សកម្មភាព</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {submitLoading ? (
                                        <tr>
                                            <td colSpan="17" className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-emerald-400" />
                                                <p>កំពុងទាញយកទិន្នន័យ...</p>
                                            </td>
                                        </tr>
                                    ) : submitList.length === 0 ? (
                                        <tr>
                                            <td colSpan="17" className="text-center py-8 text-slate-500 font-medium">
                                                មិនទាន់មានទិន្នន័យ Follow Up Submit នៅឡើយទេ
                                            </td>
                                        </tr>
                                    ) : (
                                        submitList.map((item, idx) => (
                                            <tr key={item._id || idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-300">{item.date}</td>
                                                <td className="py-2.5 px-3 font-semibold text-white"><CopyCell value={item.name} /></td>
                                                <td className="py-2.5 px-3 text-slate-300"><CopyCell value={item.userName} /></td>
                                                <td className="py-2.5 px-3 font-mono text-cyan-300"><CopyCell value={item.phone} /></td>
                                                <td className="py-2.5 px-3 text-sky-400"><CopyCell value={item.nameTelegram} /></td>
                                                <td className="py-2.5 px-3"><span className="bg-slate-700/80 px-2 py-0.5 rounded text-[11px] text-amber-300">{item.fromSource}</span></td>
                                                <td className="py-2.5 px-3 text-slate-300">{item.namePgTlFrom}</td>
                                                <td className="py-2.5 px-3"><span className="bg-slate-700/80 px-2 py-0.5 rounded text-[11px] text-indigo-300">{item.contactType}</span></td>
                                                <td className="py-2.5 px-3 text-slate-300">{item.namePgTlContact}</td>
                                                <td className="py-2.5 px-3 text-amber-400 font-mono">{item.appraisal}</td>
                                                <td className="py-2.5 px-3 text-emerald-400 font-mono">{item.requested}</td>
                                                <td className="py-2.5 px-3 text-slate-300">{item.assetType}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-200">{item.model}</td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        item.status === 'SUCCESS 1' || item.status === 'SUCCESS 2'
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                                            : item.status === 'REJECT'
                                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-400 truncate max-w-[150px]">{item.description}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {hasPermission('/follow-up/follow-up-4', 'edit') && (
                                                            <button
                                                                onClick={() => handleOpenEditForm(item)}
                                                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition-all"
                                                                title="កែប្រែ"
                                                            >
                                                                <FaEdit size={14} />
                                                            </button>
                                                        )}
                                                        {hasPermission('/follow-up/follow-up-4', 'delete') && (
                                                            <button
                                                                onClick={() => setDeleteModalItem(item)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-all"
                                                                title="លុប"
                                                            >
                                                                <FaTrashAlt size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: REJECT SUBMIT */}
            {activeTab === 'rejectSubmit' && (
                <div className="max-w-3xl mx-auto bg-slate-800/80 border border-slate-700/60 p-6 rounded-xl shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
                        <div>
                            <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                                <FaBan /> REJECT SUBMIT (បញ្ចូលចំនួនតាមមូលហេតុ)
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                បញ្ចូលចំនួន Reject Submit ប្រចាំថ្ងៃសម្រាប់ Brand: <span className="text-emerald-400 font-bold">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        {/* Date Picker */}
                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                            <FaRegCalendarAlt className="text-slate-400 text-sm" />
                            <input
                                type="date"
                                value={rejectSubmitDate}
                                onChange={(e) => setRejectSubmitDate(e.target.value)}
                                className="bg-transparent text-sm text-slate-100 outline-none cursor-pointer font-mono"
                            />
                        </div>
                    </div>

                    {/* Reasons Input List */}
                    <div className="space-y-3 mb-6">
                        {droplists.rejectSubmitReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-all">
                                <span className="text-xs font-semibold text-slate-200">{reason}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={rejectSubmitCounts[reason] !== undefined ? rejectSubmitCounts[reason] : 0}
                                    onChange={(e) => setRejectSubmitCounts({
                                        ...rejectSubmitCounts,
                                        [reason]: e.target.value
                                    })}
                                    className="w-24 bg-slate-800 text-right text-rose-400 font-bold text-sm px-3 py-1.5 rounded border border-slate-700 outline-none focus:border-rose-500"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSaveRejectSubmit}
                        disabled={rejectSubmitSaving}
                        className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm py-3 rounded-lg transition-all shadow-lg"
                    >
                        <FaSave />
                        <span>{rejectSubmitSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក REJECT SUBMIT'}</span>
                    </button>
                </div>
            )}

            {/* TAB 3: REJECT CS */}
            {activeTab === 'rejectCs' && (
                <div className="max-w-3xl mx-auto bg-slate-800/80 border border-slate-700/60 p-6 rounded-xl shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
                        <div>
                            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                <FaBan /> REJECT CS (បញ្ចូលចំនួនតាមមូលហេតុ)
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                បញ្ចូលចំនួន Reject CS ប្រចាំថ្ងៃសម្រាប់ Brand: <span className="text-emerald-400 font-bold">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        {/* Date Picker */}
                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                            <FaRegCalendarAlt className="text-slate-400 text-sm" />
                            <input
                                type="date"
                                value={rejectCsDate}
                                onChange={(e) => setRejectCsDate(e.target.value)}
                                className="bg-transparent text-sm text-slate-100 outline-none cursor-pointer font-mono"
                            />
                        </div>
                    </div>

                    {/* Reasons Input List */}
                    <div className="space-y-3 mb-6">
                        {droplists.rejectCsReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-all">
                                <span className="text-xs font-semibold text-slate-200">{reason}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={rejectCsCounts[reason] !== undefined ? rejectCsCounts[reason] : 0}
                                    onChange={(e) => setRejectCsCounts({
                                        ...rejectCsCounts,
                                        [reason]: e.target.value
                                    })}
                                    className="w-24 bg-slate-800 text-right text-amber-400 font-bold text-sm px-3 py-1.5 rounded border border-slate-700 outline-none focus:border-amber-500"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSaveRejectCs}
                        disabled={rejectCsSaving}
                        className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm py-3 rounded-lg transition-all shadow-lg"
                    >
                        <FaSave />
                        <span>{rejectCsSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក REJECT CS'}</span>
                    </button>
                </div>
            )}

            {/* TAB 4: DETAIL (WITH AUTOMATED FORMULAS) */}
            {activeTab === 'detail' && (
                <div className="space-y-6">
                    {/* Automated Metrics Form Card */}
                    <div className="bg-slate-800/80 border border-slate-700/60 p-6 rounded-xl shadow-xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
                            <div>
                                <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                    <FaCalculator /> DETAIL (រូបមន្តគណនាស្វ័យប្រវត្ត)
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    បញ្ចូលលេខទិន្នន័យប្រចាំថ្ងៃ ហើយប្រព័ន្ធនឹងគណនារូបមន្ត MESSAGE, VERIFY, TOTAL SUBMIT, VERIFY SUBMIT, TOTAL SUCCESS ដោយស្វ័យប្រវត្តិ
                                </p>
                            </div>

                            {/* Date Picker */}
                            <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                                <FaRegCalendarAlt className="text-slate-400 text-sm" />
                                <input
                                    type="date"
                                    value={detailDate}
                                    onChange={(e) => setDetailDate(e.target.value)}
                                    className="bg-transparent text-sm text-slate-100 outline-none cursor-pointer font-mono"
                                />
                            </div>
                        </div>

                        {/* Automated Summary Formula Badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-sky-500/30 text-center">
                                <p className="text-[11px] text-slate-400 font-semibold uppercase">MESSAGE</p>
                                <p className="text-xl font-extrabold text-sky-400 font-mono mt-1">{calculatedFormulas.message}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">PAGE + TELEGRAM</p>
                            </div>

                            <div className="bg-slate-900/90 p-3 rounded-lg border border-indigo-500/30 text-center">
                                <p className="text-[11px] text-slate-400 font-semibold uppercase">VERIFY</p>
                                <p className="text-xl font-extrabold text-indigo-400 font-mono mt-1">{calculatedFormulas.verify}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">NO REPLY + INQUIRE + REJECT CS + MORE + SUBMITS</p>
                            </div>

                            <div className="bg-slate-900/90 p-3 rounded-lg border border-amber-500/30 text-center">
                                <p className="text-[11px] text-slate-400 font-semibold uppercase">TOTAL SUBMIT</p>
                                <p className="text-xl font-extrabold text-amber-400 font-mono mt-1">{calculatedFormulas.totalSubmit}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">PAGE SUBMIT + TELEGRAM SUBMIT</p>
                            </div>

                            <div className="bg-slate-900/90 p-3 rounded-lg border border-purple-500/30 text-center">
                                <p className="text-[11px] text-slate-400 font-semibold uppercase">VERIFY SUBMIT</p>
                                <p className="text-xl font-extrabold text-purple-400 font-mono mt-1">{calculatedFormulas.verifySubmit}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">REVIEW + REJECT + SUCCESS 1</p>
                            </div>

                            <div className="bg-slate-900/90 p-3 rounded-lg border border-emerald-500/30 text-center col-span-2 sm:col-span-1">
                                <p className="text-[11px] text-slate-400 font-semibold uppercase">TOTAL SUCCESS</p>
                                <p className="text-xl font-extrabold text-emerald-400 font-mono mt-1">{calculatedFormulas.totalSuccess}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">SUCCESS 1 + SUCCESS 2</p>
                            </div>
                        </div>

                        {/* Input Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">PAGE</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.page}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, page: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">TELEGRAM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.telegram}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, telegram: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">NO REPLY</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.noReply}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, noReply: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">INQUIRE</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.inquire}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, inquire: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">REJECT CS</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.rejectCs}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, rejectCs: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">MORE</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.more}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, more: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">PAGE SUBMIT</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.pageSubmit}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, pageSubmit: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">TELEGRAM SUBMIT</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.telegramSubmit}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, telegramSubmit: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">REVIEW</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.review}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, review: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">REJECT</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.reject}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, reject: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">SUCCESS 1</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.success1}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, success1: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>

                            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
                                <label className="block text-xs font-semibold text-slate-300 mb-1">SUCCESS 2</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={detailMetrics.success2}
                                    onChange={(e) => setDetailMetrics({ ...detailMetrics, success2: e.target.value })}
                                    className="w-full bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-blue-500 font-mono font-bold"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveDetail}
                            disabled={detailSaving}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-lg transition-all shadow-lg"
                        >
                            <FaSave />
                            <span>{detailSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក DETAIL METRICS'}</span>
                        </button>
                    </div>

                    {/* Saved Detail History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg">
                        <div className="p-4 border-b border-slate-700 bg-slate-900/60 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-200">ប្រវត្តិ DETAIL METRICS ដែលបានរក្សាទុក</h3>
                            <span className="text-xs text-slate-400 font-mono">{detailHistoryList.length} ថ្ងៃ</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-3 px-3 text-center w-10">#</th>
                                        <th className="py-3 px-3">កាលបរិច្ឆេទ</th>
                                        <th className="py-3 px-3">MESSAGE</th>
                                        <th className="py-3 px-3">VERIFY</th>
                                        <th className="py-3 px-3">TOTAL SUBMIT</th>
                                        <th className="py-3 px-3">VERIFY SUBMIT</th>
                                        <th className="py-3 px-3">TOTAL SUCCESS</th>
                                        <th className="py-3 px-3">PAGE / TG</th>
                                        <th className="py-3 px-3">SUBMITS (PAGE/TG)</th>
                                        <th className="py-3 px-3">SUCCESS (1/2)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {detailHistoryList.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="text-center py-6 text-slate-500 font-medium">
                                                មិនទាន់មានទិន្នន័យ Detail Metrics នៅឡើយទេ
                                            </td>
                                        </tr>
                                    ) : (
                                        detailHistoryList.map((item, idx) => {
                                            const message = (item.page || 0) + (item.telegram || 0);
                                            const verify = (item.noReply || 0) + (item.inquire || 0) + (item.rejectCs || 0) + (item.more || 0) + (item.pageSubmit || 0) + (item.telegramSubmit || 0);
                                            const totalSubmit = (item.pageSubmit || 0) + (item.telegramSubmit || 0);
                                            const verifySubmit = (item.review || 0) + (item.reject || 0) + (item.success1 || 0);
                                            const totalSuccess = (item.success1 || 0) + (item.success2 || 0);

                                            return (
                                                <tr key={item._id || idx} className="hover:bg-slate-700/30 transition-colors">
                                                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-mono text-emerald-300 font-bold">{item.date}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-sky-400">{message}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">{verify}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{totalSubmit}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-purple-400">{verifySubmit}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{totalSuccess}</td>
                                                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.page || 0} / {item.telegram || 0}</td>
                                                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.pageSubmit || 0} / {item.telegramSubmit || 0}</td>
                                                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.success1 || 0} / {item.success2 || 0}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE / EDIT SUBMIT FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/60">
                            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                                <FaPlusCircle />
                                <span>{editingItem ? 'កែប្រែ FOLLOW UP SUBMIT' : 'បន្ថែម FOLLOW UP SUBMIT ថ្មី'}</span>
                            </h3>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">ថ្ងៃខែឆ្នាំ *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">NAME *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="បញ្ចូលឈ្មោះ"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">USER NAME</label>
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={formData.userName}
                                        onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">PHONE NUMBER</label>
                                    <input
                                        type="text"
                                        placeholder="លេខទូរស័ព្ទ"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">NAME TELEGRAM</label>
                                    <input
                                        type="text"
                                        placeholder="ឈ្មោះ Telegram"
                                        value={formData.nameTelegram}
                                        onChange={(e) => setFormData({ ...formData, nameTelegram: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">មកពី (Droplist)</label>
                                    <select
                                        value={formData.fromSource}
                                        onChange={(e) => setFormData({ ...formData, fromSource: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        {droplists.sources.map((s, i) => (
                                            <option key={i} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">NAME PG OR TL មកពី</label>
                                    <input
                                        type="text"
                                        placeholder="NAME PG/TL មកពី"
                                        value={formData.namePgTlFrom}
                                        onChange={(e) => setFormData({ ...formData, namePgTlFrom: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">ទាក់ទង (Droplist)</label>
                                    <select
                                        value={formData.contactType}
                                        onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        {droplists.contactTypes.map((c, i) => (
                                            <option key={i} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">NAME PG OR TL ទាក់ទង</label>
                                    <input
                                        type="text"
                                        placeholder="NAME PG/TL ទាក់ទង"
                                        value={formData.namePgTlContact}
                                        onChange={(e) => setFormData({ ...formData, namePgTlContact: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">វាយតម្លៃ</label>
                                    <input
                                        type="text"
                                        placeholder="តម្លៃវាយតម្លៃ"
                                        value={formData.appraisal}
                                        onChange={(e) => setFormData({ ...formData, appraisal: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">បានស្នើ</label>
                                    <input
                                        type="text"
                                        placeholder="ចំនួនស្នើ"
                                        value={formData.requested}
                                        onChange={(e) => setFormData({ ...formData, requested: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">ប្រភេទទ្រព្យ</label>
                                    <input
                                        type="text"
                                        placeholder="ប្រភេទទ្រព្យ"
                                        value={formData.assetType}
                                        onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">MODEL</label>
                                    <input
                                        type="text"
                                        placeholder="ម៉ូឌែលទូរស័ព្ទ/ឧបករណ៍"
                                        value={formData.model}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">STATUS (Droplist)</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        {droplists.statuses.map((st, i) => (
                                            <option key={i} value={st}>{st}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">បរិយាយ</label>
                                <textarea
                                    rows="3"
                                    placeholder="ការបរិយាយបន្ថែម..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-900 text-slate-100 text-xs p-3 rounded border border-slate-700 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
                                >
                                    បោះបង់
                                </button>
                                <button
                                    type="submit"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5"
                                >
                                    <FaSave />
                                    <span>រក្សាទុក</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                        <FaTrashAlt className="text-rose-500 text-3xl mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-100 mb-1">តើអ្នកប្រាកដជាចង់លុប?</h4>
                        <p className="text-xs text-slate-400 mb-6">
                            ទិន្នន័យ &quot;<span className="text-emerald-400 font-semibold">{deleteModalItem.name}</span>&quot; នឹងត្រូវលុបចេញពីប្រព័ន្ធ។
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setDeleteModalItem(null)}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-md"
                            >
                                លុបចេញ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp4;
