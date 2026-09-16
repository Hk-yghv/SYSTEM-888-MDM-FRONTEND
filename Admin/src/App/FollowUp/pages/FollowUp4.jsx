import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaBuilding, FaBan,
    FaCalculator, FaChartBar
} from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';
import { exportToExcel } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';

// Modular Prop-driven Subcomponents
import FollowUp4SubmitModal from '../components/FollowUp4SubmitModal';
import RejectSubmitCard from '../components/RejectSubmitCard';
import RejectCsCard from '../components/RejectCsCard';
import FollowUp4DetailCard from '../components/FollowUp4DetailCard';

const FollowUp4 = () => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';

    // Active Tab
    const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'rejectSubmit' | 'rejectCs' | 'detail'

    // Brand filtering & list
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['888MDM', 'ECloud']);

    // Master droplists dynamically fetched from Control System Database
    const [droplists, setDroplists] = useState({
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'Other'],
        contactTypes: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'],
        statuses: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'],
        assetTypes: ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'],
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

    // Fetch Brands and Control System Droplists dynamically from Database
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
                    const ast = data.droplists.find(d => d.category === 'Follow Up 4 Asset Types' || d.category === 'Asset Types')?.items;
                    const rsr = data.droplists.find(d => d.category === 'Reject Submit Reasons')?.items;
                    const rcr = data.droplists.find(d => d.category === 'Reject CS Reasons')?.items;
                    const bList = data.droplists.find(d => d.category === 'Brands')?.items;

                    if (bList && Array.isArray(bList) && bList.length > 0) setBrandsList(bList);

                    setDroplists(prev => ({
                        sources: (src && src.length) ? src : prev.sources,
                        contactTypes: (ct && ct.length) ? ct : prev.contactTypes,
                        statuses: (st && st.length) ? st : prev.statuses,
                        assetTypes: (ast && ast.length) ? ast : prev.assetTypes,
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
    const [submitFormSaving, setSubmitFormSaving] = useState(false);
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
            assetType: droplists.assetTypes[0] || '',
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

        setSubmitFormSaving(true);
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
        } finally {
            setSubmitFormSaving(false);
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
    const [rejectSubmitLoading, setRejectSubmitLoading] = useState(false);

    const fetchRejectSubmitData = useCallback(async () => {
        setRejectSubmitLoading(true);
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
        } finally {
            setRejectSubmitLoading(false);
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
    const [rejectCsLoading, setRejectCsLoading] = useState(false);

    const fetchRejectCsData = useCallback(async () => {
        setRejectCsLoading(true);
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
        } finally {
            setRejectCsLoading(false);
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
    const [detailLoading, setDetailLoading] = useState(false);
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

        const totalInquiries = p + tg;
        const totalSubmits = ps + tgs;
        const totalProcessed = nr + inq + rcs + mr;
        const totalSuccess = s1 + s2;
        const conversionRate = totalSubmits > 0 ? ((totalSuccess / totalSubmits) * 100).toFixed(1) + '%' : '0.0%';

        return {
            totalInquiries,
            totalSubmits,
            totalProcessed,
            totalSuccess,
            conversionRate
        };
    }, [detailMetrics]);

    const fetchDetailData = useCallback(async () => {
        setDetailLoading(true);
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
        } finally {
            setDetailLoading(false);
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
                const totalSuccess = (item.success1 || 0) + (item.success2 || 0);
                return {
                    '#': idx + 1,
                    'កាលបរិច្ឆេទ': item.date,
                    'BRAND': item.brand,
                    'TOTAL INQUIRIES': message,
                    'PAGE': item.page || 0,
                    'TELEGRAM': item.telegram || 0,
                    'NO REPLY': item.noReply || 0,
                    'INQUIRE': item.inquire || 0,
                    'REJECT CS': item.rejectCs || 0,
                    'MORE': item.more || 0,
                    'TOTAL SUBMIT': totalSubmit,
                    'PAGE SUBMIT': item.pageSubmit || 0,
                    'TELEGRAM SUBMIT': item.telegramSubmit || 0,
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
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-all shadow-md cursor-pointer"
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'detail'
                            ? 'bg-sky-600 text-white border-b-2 border-sky-400 shadow-md'
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
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-md cursor-pointer"
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
                                                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition-all cursor-pointer"
                                                                title="កែប្រែ"
                                                            >
                                                                <FaEdit size={14} />
                                                            </button>
                                                        )}
                                                        {hasPermission('/follow-up/follow-up-4', 'delete') && (
                                                            <button
                                                                onClick={() => setDeleteModalItem(item)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-all cursor-pointer"
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

            {/* TAB 2: REJECT SUBMIT (Modular Prop Component) */}
            {activeTab === 'rejectSubmit' && (
                <RejectSubmitCard
                    date={rejectSubmitDate}
                    setDate={setRejectSubmitDate}
                    brand={selectedBrand || user?.brand}
                    reasons={droplists.rejectSubmitReasons}
                    counts={rejectSubmitCounts}
                    setCounts={setRejectSubmitCounts}
                    onSave={handleSaveRejectSubmit}
                    saving={rejectSubmitSaving}
                    loading={rejectSubmitLoading}
                />
            )}

            {/* TAB 3: REJECT CS (Modular Prop Component) */}
            {activeTab === 'rejectCs' && (
                <RejectCsCard
                    date={rejectCsDate}
                    setDate={setRejectCsDate}
                    brand={selectedBrand || user?.brand}
                    reasons={droplists.rejectCsReasons}
                    counts={rejectCsCounts}
                    setCounts={setRejectCsCounts}
                    onSave={handleSaveRejectCs}
                    saving={rejectCsSaving}
                    loading={rejectCsLoading}
                />
            )}

            {/* TAB 4: DETAIL (Modular Prop Component) */}
            {activeTab === 'detail' && (
                <FollowUp4DetailCard
                    date={detailDate}
                    setDate={setDetailDate}
                    brand={selectedBrand || user?.brand}
                    metrics={detailMetrics}
                    setMetrics={setDetailMetrics}
                    onSave={handleSaveDetail}
                    saving={detailSaving}
                    calculatedFormulas={calculatedFormulas}
                    historyList={detailHistoryList}
                    loading={detailLoading}
                />
            )}

            {/* CREATE / EDIT SUBMIT FORM MODAL (Modular Prop Component) */}
            <FollowUp4SubmitModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
                editingItem={editingItem}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                submitting={submitFormSaving}
                droplists={droplists}
                isMasterAdmin={isMasterAdmin}
                brandsList={brandsList}
            />

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
                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-md cursor-pointer"
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
