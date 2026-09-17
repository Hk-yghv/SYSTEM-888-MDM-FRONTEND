import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch, FaRegCalendarAlt,
    FaListUl, FaBuilding, FaBan,
    FaCalculator, FaChartBar, FaHistory, FaCheckCircle
} from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';
import { exportToExcel } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';

// Modular Prop-driven Subcomponents (Center Screen Modals)
import FollowUp4SubmitModal from '../components/FollowUp4SubmitModal';
import RejectSubmitModal from '../components/RejectSubmitModal';
import RejectCsModal from '../components/RejectCsModal';
import FollowUp4DetailModal from '../components/FollowUp4DetailModal';

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
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'CALL', 'Other'],
        contactTypes: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'],
        statuses: ['PENDING', 'REVIEW', 'REJECT', 'SUCCESS 1', 'SUCCESS 2', 'INQUIRE'],
        assetTypes: ['ទូរស័ព្ទ (Smart Phone)', 'ម៉ូតូ (Motorcycle)', 'រថយន្ត (Car)', 'ប្លង់ដី/ផ្ទះ (Real Estate)', 'មាស/គ្រឿងអលង្ការ (Jewelry)', 'កុំព្យូទ័រ (Laptop/PC)', 'ផ្សេងៗ (Other)'],
        rejectSubmitReasons: [],
        rejectCsReasons: []
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
            const effectiveBrand = selectedBrand || user?.brand || '';
            const brandQuery = effectiveBrand ? `?brand=${encodeURIComponent(effectiveBrand)}` : '?brand=';
            const res = await fetch(`${API_BASE}/controlsystem${brandQuery}`);
            if (res.ok) {
                const data = await res.json();
                if (data.droplists && Array.isArray(data.droplists)) {
                    const findCat = (names) => {
                        const targets = names.map(n => n.toLowerCase().trim());
                        const found = data.droplists.find(d => d && d.category && targets.includes(d.category.toLowerCase().trim()));
                        return (found && Array.isArray(found.items)) ? found.items : null;
                    };

                    const src = findCat(['Follow Up 4 Sources', 'Sources', 'ប្រភព']);
                    const ct = findCat(['Follow Up 4 Contact Types', 'Contact Types', 'ប្រភេទទំនាក់ទំនង', 'ទាក់ទង']);
                    const st = findCat(['Follow Up 4 Statuses', 'Statuses', 'ស្ថានភាព']);
                    const ast = findCat(['Follow Up 4 Asset Types', 'Asset Types', 'ប្រភេទទ្រព្យ']);
                    const rsr = findCat(['Reject Submit Reasons', 'Reject Submit', 'មូលហេតុ Reject Submit']);
                    const rcr = findCat(['Reject CS Reasons', 'Reject CS', 'មូលហេតុ Reject CS']);
                    const bList = findCat(['Brands', 'Brand']);

                    if (bList && Array.isArray(bList) && bList.length > 0) setBrandsList(bList);

                    setDroplists(prev => ({
                        sources: (src && src.length > 0) ? src : prev.sources,
                        contactTypes: (ct && ct.length > 0) ? ct : prev.contactTypes,
                        statuses: (st && st.length > 0) ? st : prev.statuses,
                        assetTypes: (ast && ast.length > 0) ? ast : prev.assetTypes,
                        rejectSubmitReasons: (rsr && Array.isArray(rsr)) ? rsr : [],
                        rejectCsReasons: (rcr && Array.isArray(rcr)) ? rcr : []
                    }));
                }
            }
        } catch (err) {
            console.error('Fetch Control System Error in FollowUp4:', err);
        }
    }, [API_BASE, selectedBrand, user?.brand]);

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

    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
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

    const handleOpenCreateSubmitForm = () => {
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
        setIsSubmitModalOpen(true);
    };

    const handleOpenEditSubmitForm = (item) => {
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
        setIsSubmitModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

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
                setIsSubmitModalOpen(false);
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

    const parseCurrencyOrNumber = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const cleaned = String(val).replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const groupedSubmitByDate = useMemo(() => {
        if (!submitList || submitList.length === 0) return [];

        const map = new Map();

        submitList.forEach(item => {
            const d = item.date ? item.date.split('T')[0] : 'N/A';
            if (!map.has(d)) {
                map.set(d, []);
            }
            map.get(d).push(item);
        });

        const groups = [];
        map.forEach((items, dateKey) => {
            let totalAppraisal = 0;
            let totalRequested = 0;
            let successCount = 0;
            let rejectCount = 0;
            let reviewCount = 0;
            let pendingCount = 0;

            items.forEach(it => {
                totalAppraisal += parseCurrencyOrNumber(it.appraisal);
                totalRequested += parseCurrencyOrNumber(it.requested);
                const st = (it.status || '').toUpperCase();
                if (st.includes('SUCCESS') || st === 'SUCCESS 1' || st === 'SUCCESS 2') {
                    successCount++;
                } else if (st === 'REJECT') {
                    rejectCount++;
                } else if (st === 'REVIEW') {
                    reviewCount++;
                } else {
                    pendingCount++;
                }
            });

            groups.push({
                date: dateKey,
                items,
                count: items.length,
                totalAppraisal,
                totalRequested,
                successCount,
                rejectCount,
                reviewCount,
                pendingCount
            });
        });

        return groups.sort((a, b) => b.date.localeCompare(a.date));
    }, [submitList]);

    const submitTotals = useMemo(() => {
        let totalAppraisal = 0;
        let totalRequested = 0;
        let successCount = 0;
        let rejectCount = 0;
        let reviewCount = 0;
        let pendingCount = 0;

        submitList.forEach(item => {
            totalAppraisal += parseCurrencyOrNumber(item.appraisal);
            totalRequested += parseCurrencyOrNumber(item.requested);
            const st = (item.status || '').toUpperCase();
            if (st.includes('SUCCESS') || st === 'SUCCESS 1' || st === 'SUCCESS 2') {
                successCount++;
            } else if (st === 'REJECT') {
                rejectCount++;
            } else if (st === 'REVIEW') {
                reviewCount++;
            } else {
                pendingCount++;
            }
        });

        return {
            count: submitList.length,
            totalAppraisal,
            totalRequested,
            successCount,
            rejectCount,
            reviewCount,
            pendingCount
        };
    }, [submitList]);

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
    const [isRejectSubmitModalOpen, setIsRejectSubmitModalOpen] = useState(false);
    const [rejectSubmitHistoryList, setRejectSubmitHistoryList] = useState([]);

    const fetchRejectSubmitData = useCallback(async () => {
        setRejectSubmitLoading(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${API_BASE}/follow-up-4/reject-submit?brand=${encodeURIComponent(targetBrand)}`);
            if (res.ok) {
                const result = await res.json();
                const rawData = result.data || [];
                setRejectSubmitHistoryList(rawData);

                // Populate active date counts
                const forDate = rawData.filter(r => r.date === rejectSubmitDate);
                const countsObj = {};
                forDate.forEach(r => {
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

    const handleOpenCreateRejectSubmit = (targetDate = null) => {
        if (targetDate) {
            setRejectSubmitDate(targetDate);
            const forDate = rejectSubmitHistoryList.filter(r => r.date === targetDate);
            const countsObj = {};
            forDate.forEach(r => {
                countsObj[r.reason] = r.count;
            });
            setRejectSubmitCounts(countsObj);
        } else {
            setRejectSubmitDate(new Date().toISOString().split('T')[0]);
            setRejectSubmitCounts({});
        }
        setIsRejectSubmitModalOpen(true);
    };

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
                setIsRejectSubmitModalOpen(false);
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

    // Group reject submit records by date
    const groupedRejectSubmit = useMemo(() => {
        const groups = {};
        rejectSubmitHistoryList.forEach(item => {
            if (!groups[item.date]) {
                groups[item.date] = { date: item.date, brand: item.brand, total: 0, reasons: {} };
            }
            groups[item.date].reasons[item.reason] = item.count;
            groups[item.date].total += (Number(item.count) || 0);
        });
        return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }, [rejectSubmitHistoryList]);

    // =========================================================
    // TAB 3: REJECT CS STATE & LOGIC
    // =========================================================
    const [rejectCsDate, setRejectCsDate] = useState(new Date().toISOString().split('T')[0]);
    const [rejectCsCounts, setRejectCsCounts] = useState({});
    const [rejectCsSaving, setRejectCsSaving] = useState(false);
    const [rejectCsLoading, setRejectCsLoading] = useState(false);
    const [isRejectCsModalOpen, setIsRejectCsModalOpen] = useState(false);
    const [rejectCsHistoryList, setRejectCsHistoryList] = useState([]);

    const fetchRejectCsData = useCallback(async () => {
        setRejectCsLoading(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${API_BASE}/follow-up-4/reject-cs?brand=${encodeURIComponent(targetBrand)}`);
            if (res.ok) {
                const result = await res.json();
                const rawData = result.data || [];
                setRejectCsHistoryList(rawData);

                // Populate active date counts
                const forDate = rawData.filter(r => r.date === rejectCsDate);
                const countsObj = {};
                forDate.forEach(r => {
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

    const handleOpenCreateRejectCs = (targetDate = null) => {
        if (targetDate) {
            setRejectCsDate(targetDate);
            const forDate = rejectCsHistoryList.filter(r => r.date === targetDate);
            const countsObj = {};
            forDate.forEach(r => {
                countsObj[r.reason] = r.count;
            });
            setRejectCsCounts(countsObj);
        } else {
            setRejectCsDate(new Date().toISOString().split('T')[0]);
            setRejectCsCounts({});
        }
        setIsRejectCsModalOpen(true);
    };

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
                setIsRejectCsModalOpen(false);
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

    // Group reject CS records by date
    const groupedRejectCs = useMemo(() => {
        const groups = {};
        rejectCsHistoryList.forEach(item => {
            if (!groups[item.date]) {
                groups[item.date] = { date: item.date, brand: item.brand, total: 0, reasons: {} };
            }
            groups[item.date].reasons[item.reason] = item.count;
            groups[item.date].total += (Number(item.count) || 0);
        });
        return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }, [rejectCsHistoryList]);

    // =========================================================
    // TAB 4: DETAIL STATE & AUTOMATED FORMULAS LOGIC
    // =========================================================
    const [detailDate, setDetailDate] = useState(new Date().toISOString().split('T')[0]);
    const [detailStartDate, setDetailStartDate] = useState('');
    const [detailEndDate, setDetailEndDate] = useState('');
    const [detailMetrics, setDetailMetrics] = useState({
        message: '',
        page: '',
        telegram: '',
        noReply: '',
        inquire: '',
        rejectCs: '',
        more: '',
        pageSubmit: '',
        telegramSubmit: '',
        call: '',
        review: '',
        reject: '',
        success1: '',
        success2: ''
    });
    const [detailSaving, setDetailSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailHistoryList, setDetailHistoryList] = useState([]);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // AUTO-CALCULATED FORMULAS (For Active Modal)
    const calculatedFormulas = useMemo(() => {
        const p = Number(detailMetrics.page) || 0;
        const tg = Number(detailMetrics.telegram) || 0;
        const c = Number(detailMetrics.call) || 0;

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

        const totalInquiries = p + tg + c;
        const totalSubmits = ps + tgs + c;
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

    // GRAND TOTALS across all filtered history rows
    const grandDetailTotals = useMemo(() => {
        const totals = {
            message: 0,
            page: 0,
            telegram: 0,
            noReply: 0,
            inquire: 0,
            rejectCs: 0,
            more: 0,
            pageSubmit: 0,
            telegramSubmit: 0,
            call: 0,
            totalSubmit: 0,
            review: 0,
            reject: 0,
            success1: 0,
            success2: 0,
            totalSuccess: 0
        };

        detailHistoryList.forEach(row => {
            const p = Number(row.page || 0);
            const tg = Number(row.telegram || 0);
            const c = Number(row.call || 0);
            const msg = p + tg + c;
            const ps = Number(row.pageSubmit || 0);
            const tgs = Number(row.telegramSubmit || 0);
            const s1 = Number(row.success1 || 0);
            const s2 = Number(row.success2 || 0);

            totals.message += msg;
            totals.page += p;
            totals.telegram += tg;
            totals.noReply += Number(row.noReply || 0);
            totals.inquire += Number(row.inquire || 0);
            totals.rejectCs += Number(row.rejectCs || 0);
            totals.more += Number(row.more || 0);
            totals.pageSubmit += ps;
            totals.telegramSubmit += tgs;
            totals.call += c;
            totals.totalSubmit += (ps + tgs + c);
            totals.review += Number(row.review || 0);
            totals.reject += Number(row.reject || 0);
            totals.success1 += s1;
            totals.success2 += s2;
            totals.totalSuccess += (s1 + s2);
        });

        return totals;
    }, [detailHistoryList]);

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
            if (detailStartDate) params.append('startDate', detailStartDate);
            if (detailEndDate) params.append('endDate', detailEndDate);

            const res = await fetch(`${API_BASE}/follow-up-4/detail?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                const list = result.data || [];
                setDetailHistoryList(list);

                const currentDay = list.find(d => d.date === detailDate);
                if (currentDay) {
                    setDetailMetrics({
                        message: currentDay.message !== undefined && currentDay.message !== null ? currentDay.message : (Number(currentDay.page || 0) + Number(currentDay.telegram || 0) + Number(currentDay.call || 0)),
                        page: currentDay.page ?? '',
                        telegram: currentDay.telegram ?? '',
                        noReply: currentDay.noReply ?? '',
                        inquire: currentDay.inquire ?? '',
                        rejectCs: currentDay.rejectCs ?? '',
                        more: currentDay.more ?? '',
                        pageSubmit: currentDay.pageSubmit ?? '',
                        telegramSubmit: currentDay.telegramSubmit ?? '',
                        call: currentDay.call ?? '',
                        review: currentDay.review ?? '',
                        reject: currentDay.reject ?? '',
                        success1: currentDay.success1 ?? '',
                        success2: currentDay.success2 ?? ''
                    });
                }
            }
        } catch (err) {
            console.error('Fetch Detail Error:', err);
        } finally {
            setDetailLoading(false);
        }
    }, [API_BASE, detailDate, detailStartDate, detailEndDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'detail') {
            fetchDetailData();
        }
    }, [activeTab, fetchDetailData]);

    const handleOpenCreateDetail = (targetDate = null) => {
        const today = new Date().toISOString().split('T')[0];
        const activeDate = targetDate || today;
        setDetailDate(activeDate);

        if (targetDate) {
            const existing = detailHistoryList.find(d => d.date === targetDate);
            if (existing) {
                setDetailMetrics({
                    message: existing.message !== undefined && existing.message !== null ? existing.message : (Number(existing.page || 0) + Number(existing.telegram || 0) + Number(existing.call || 0)),
                    page: existing.page ?? '',
                    telegram: existing.telegram ?? '',
                    noReply: existing.noReply ?? '',
                    inquire: existing.inquire ?? '',
                    rejectCs: existing.rejectCs ?? '',
                    more: existing.more ?? '',
                    pageSubmit: existing.pageSubmit ?? '',
                    telegramSubmit: existing.telegramSubmit ?? '',
                    call: existing.call ?? '',
                    review: existing.review ?? '',
                    reject: existing.reject ?? '',
                    success1: existing.success1 ?? '',
                    success2: existing.success2 ?? ''
                });
            } else {
                setDetailMetrics({
                    message: '', page: '', telegram: '', noReply: '', inquire: '',
                    rejectCs: '', more: '', pageSubmit: '', telegramSubmit: '', call: '',
                    review: '', reject: '', success1: '', success2: ''
                });
            }
        } else {
            // Clean fresh form on new create
            setDetailMetrics({
                message: '', page: '', telegram: '', noReply: '', inquire: '',
                rejectCs: '', more: '', pageSubmit: '', telegramSubmit: '', call: '',
                review: '', reject: '', success1: '', success2: ''
            });
        }
        setIsDetailModalOpen(true);
    };

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
                    message: Number(detailMetrics.page || 0) + Number(detailMetrics.telegram || 0) + Number(detailMetrics.call || 0),
                    page: Number(detailMetrics.page) || 0,
                    telegram: Number(detailMetrics.telegram) || 0,
                    noReply: Number(detailMetrics.noReply) || 0,
                    inquire: Number(detailMetrics.inquire) || 0,
                    rejectCs: Number(detailMetrics.rejectCs) || 0,
                    more: Number(detailMetrics.more) || 0,
                    pageSubmit: Number(detailMetrics.pageSubmit) || 0,
                    telegramSubmit: Number(detailMetrics.telegramSubmit) || 0,
                    call: Number(detailMetrics.call) || 0,
                    review: Number(detailMetrics.review) || 0,
                    reject: Number(detailMetrics.reject) || 0,
                    success1: Number(detailMetrics.success1) || 0,
                    success2: Number(detailMetrics.success2) || 0,
                    createdBy: user?.username || 'Staff'
                })
            });

            if (res.ok) {
                alert('✅ បានរក្សាទុកទិន្នន័យ DETAIL រួចរាល់!');
                setIsDetailModalOpen(false);
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
        } else if (activeTab === 'rejectSubmit') {
            const exportData = groupedRejectSubmit.map((item, idx) => {
                const row = { '#': idx + 1, 'កាលបរិច្ឆេទ': item.date, 'BRAND': item.brand, 'សរុប (TOTAL)': item.total };
                droplists.rejectSubmitReasons.forEach(r => {
                    row[r] = item.reasons[r] || 0;
                });
                return row;
            });
            exportToExcel(exportData, `FollowUp4_Reject_Submit_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'rejectCs') {
            const exportData = groupedRejectCs.map((item, idx) => {
                const row = { '#': idx + 1, 'កាលបរិច្ឆេទ': item.date, 'BRAND': item.brand, 'សរុប (TOTAL)': item.total };
                droplists.rejectCsReasons.forEach(r => {
                    row[r] = item.reasons[r] || 0;
                });
                return row;
            });
            exportToExcel(exportData, `FollowUp4_Reject_CS_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'detail') {
            const exportData = detailHistoryList.map((item, idx) => {
                const message = (item.page || 0) + (item.telegram || 0) + (item.call || 0);
                const verify = (item.noReply || 0) + (item.inquire || 0) + (item.rejectCs || 0) + (item.more || 0) + (item.pageSubmit || 0) + (item.telegramSubmit || 0) + (item.call || 0);
                const totalSubmit = (item.pageSubmit || 0) + (item.telegramSubmit || 0) + (item.call || 0);
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
                    'PAGE SUBMIT': item.pageSubmit || 0,
                    'TELEGRAM SUBMIT': item.telegramSubmit || 0,
                    'CALL': item.call || 0,
                    'TOTAL SUBMIT': totalSubmit,
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 shadow-xl">
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
                        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 shadow-inner">
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

                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                        <FaFileExcel size={14} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-700/80 pb-2">
                <button
                    onClick={() => setActiveTab('submit')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'submit'
                        ? 'bg-emerald-600 text-white border-b-2 border-emerald-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaListUl />
                    <span>FOLLOW UP SUBMIT</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectSubmit')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'rejectSubmit'
                        ? 'bg-rose-600 text-white border-b-2 border-rose-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaBan />
                    <span>REJECT SUBMIT</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectCs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'rejectCs'
                        ? 'bg-amber-600 text-white border-b-2 border-amber-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaBan />
                    <span>REJECT CS</span>
                </button>

                <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'detail'
                        ? 'bg-sky-600 text-white border-b-2 border-sky-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaCalculator />
                    <span>DETAIL</span>
                </button>
            </div>

            {/* =========================================================
                TAB 1: FOLLOW UP SUBMIT
               ========================================================= */}
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
                                onClick={handleOpenCreateSubmitForm}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                            >
                                <FaPlusCircle size={15} />
                                <span>+ បន្ថែម FOLLOW UP SUBMIT</span>
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
                                        (() => {
                                            let runningIdx = 0;
                                            return groupedSubmitByDate.map((group) => (
                                                <React.Fragment key={group.date}>
                                                    {group.items.map((item) => {
                                                        runningIdx++;
                                                        return (
                                                            <tr key={item._id || runningIdx} className="hover:bg-slate-700/30 transition-colors">
                                                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{runningIdx}</td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-300">{item.date}</td>
                                                                <td className="py-2.5 px-3 font-semibold text-white"><CopyCell text={item.name} /></td>
                                                                <td className="py-2.5 px-3 text-slate-300"><CopyCell text={item.userName} /></td>
                                                                <td className="py-2.5 px-3 font-mono text-cyan-300"><CopyCell text={item.phone} /></td>
                                                                <td className="py-2.5 px-3 text-sky-400"><CopyCell text={item.nameTelegram} /></td>
                                                                <td className="py-2.5 px-3"><span className="bg-slate-700/80 px-2 py-0.5 rounded text-[11px] text-amber-300">{item.fromSource}</span></td>
                                                                <td className="py-2.5 px-3 text-slate-300">{item.namePgTlFrom}</td>
                                                                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded text-[11px] text-indigo-300">{item.contactType}</span></td>
                                                                <td className="py-2.5 px-3 text-slate-300">{item.namePgTlContact}</td>
                                                                <td className="py-2.5 px-3 text-amber-400 font-mono">{item.appraisal}</td>
                                                                <td className="py-2.5 px-3 text-emerald-400 font-mono">{item.requested}</td>
                                                                <td className="py-2.5 px-3 text-slate-300">{item.assetType}</td>
                                                                <td className="py-2.5 px-3 font-medium text-slate-200">{item.model}</td>
                                                                <td className="py-2.5 px-3">
                                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${item.status === 'SUCCESS 1' || item.status === 'SUCCESS 2'
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
                                                                                onClick={() => handleOpenEditSubmitForm(item)}
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
                                                        );
                                                    })}

                                                    {/* Daily Subtotal Row (Total តាមថ្ងៃ) */}
                                                    <tr className="bg-slate-800/90 border-b-2 border-emerald-500/30 text-xs font-semibold">
                                                        <td colSpan="10" className="py-2.5 px-3 text-emerald-300 font-bold">
                                                            <div className="flex items-center gap-2">
                                                                <span>សរុបប្រចាំថ្ងៃ ({group.date}):</span>
                                                                <span className="bg-slate-900 text-slate-300 text-[11px] px-2 py-0.5 rounded border border-slate-700">
                                                                    {group.count} កំណត់ត្រា
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                                                            ${group.totalAppraisal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                                                            ${group.totalRequested.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-400 text-center">-</td>
                                                        <td className="py-2.5 px-3 text-slate-400 text-center">-</td>
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                                                                <span className="text-emerald-400">ជោគជ័យ: {group.successCount}</span>
                                                                <span className="text-rose-400">REJECT: {group.rejectCount}</span>
                                                                {group.reviewCount > 0 && <span className="text-amber-400">REVIEW: {group.reviewCount}</span>}
                                                            </div>
                                                        </td>
                                                        <td colSpan="2" className="py-2.5 px-3 text-slate-500 font-mono text-center">-</td>
                                                    </tr>
                                                </React.Fragment>
                                            ));
                                        })()
                                    )}
                                </tbody>
                                {submitList.length > 0 && (
                                    <tfoot className="border-t-2 border-emerald-500/50 text-xs shadow-inner">
                                        {/* Overall Grand Total Row */}
                                        <tr className="bg-slate-950 font-bold text-slate-100 border-t border-emerald-500/40">
                                            <td colSpan="10" className="py-3.5 px-3 font-bold text-emerald-400 uppercase tracking-wider">
                                                <div className="flex items-center gap-2">
                                                    <span>សរុបរួមទាំងអស់ (GRAND TOTAL):</span>
                                                    <span className="bg-emerald-950 text-emerald-300 text-[11px] px-2.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                                                        {submitTotals.count} កំណត់ត្រា {groupedSubmitByDate.length > 1 ? `(${groupedSubmitByDate.length} ថ្ងៃ)` : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 font-mono font-black text-amber-400 text-sm">
                                                ${submitTotals.totalAppraisal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3.5 px-3 font-mono font-black text-emerald-400 text-sm">
                                                ${submitTotals.totalRequested.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3.5 px-3 text-slate-400 text-center">-</td>
                                            <td className="py-3.5 px-3 text-slate-400 text-center">-</td>
                                            <td className="py-3.5 px-3">
                                                <div className="flex flex-col gap-0.5 text-[10px] font-mono font-bold">
                                                    <span className="text-emerald-400">ជោគជ័យ: {submitTotals.successCount}</span>
                                                    <span className="text-rose-400">REJECT: {submitTotals.rejectCount}</span>
                                                    {submitTotals.reviewCount > 0 && <span className="text-amber-400">REVIEW: {submitTotals.reviewCount}</span>}
                                                </div>
                                            </td>
                                            <td colSpan="2" className="py-3.5 px-3 text-slate-500 font-mono text-center">-</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                TAB 2: REJECT SUBMIT (Summary Table & Create Modal Trigger)
               ========================================================= */}
            {activeTab === 'rejectSubmit' && (
                <div className="space-y-4">
                    {/* Top Action Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-rose-400 flex items-center gap-2">
                                <FaBan /> <span>REJECT SUBMIT SUMMARY</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                កំណត់ត្រា Reject Submit តាមថ្ងៃសម្រាប់ Brand: <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        {hasPermission('/follow-up/follow-up-4', 'create') && (
                            <button
                                onClick={() => handleOpenCreateRejectSubmit()}
                                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
                            >
                                <FaPlusCircle size={15} />
                                <span>+ បញ្ចូល REJECT SUBMIT</span>
                            </button>
                        )}
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">ប្រវត្តិទិន្នន័យ REJECT SUBMIT តាមកាលបរិច្ឆេទ</span>
                            <span className="text-xs text-rose-400 font-mono font-semibold">{groupedRejectSubmit.length} ថ្ងៃបានកត់ត្រា</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr className='text-white'>
                                        <th className="py-3 px-3 text-center w-10">#</th>
                                        <th className="py-3 px-3">កាលបរិច្ឆេទ</th>
                                        <th className="py-3 px-3 text-center font-bold text-rose-400">សរុប (TOTAL)</th>
                                        {droplists.rejectSubmitReasons.map((reason, rIdx) => (
                                            <th key={rIdx} className="py-3 px-3 text-center">{reason}</th>
                                        ))}
                                        <th className="py-3 px-3 text-center">សកម្មភាព</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-white divide-slate-700/50">
                                    {rejectSubmitLoading ? (
                                        <tr>
                                            <td colSpan={4 + droplists.rejectSubmitReasons.length} className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-rose-400" />
                                                <p>កំពុងទាញយកទិន្នន័យ...</p>
                                            </td>
                                        </tr>
                                    ) : groupedRejectSubmit.length === 0 ? (
                                        <tr>
                                            <td colSpan={4 + droplists.rejectSubmitReasons.length} className="text-center py-8 text-slate-500 font-medium">
                                                មិនទាន់មានកំណត់ត្រា Reject Submit នៅឡើយទេ សូមចុច &quot;+ បញ្ចូល REJECT SUBMIT&quot; ដើម្បីបញ្ចូល
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedRejectSubmit.map((group, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-mono font-bold text-rose-300">{group.date}</td>
                                                <td className="py-2.5 px-3 text-center font-mono font-extrabold text-rose-400 bg-rose-950/30">
                                                    {group.total}
                                                </td>
                                                {droplists.rejectSubmitReasons.map((reason, rIdx) => (
                                                    <td key={rIdx} className="py-2.5 px-3 text-center font-mono text-slate-300">
                                                        {group.reasons[reason] || 0}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-center">
                                                    <button
                                                        onClick={() => handleOpenCreateRejectSubmit(group.date)}
                                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-rose-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        <FaEdit className="inline mr-1" /> កែប្រែ
                                                    </button>
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

            {/* =========================================================
                TAB 3: REJECT CS (Summary Table & Create Modal Trigger)
               ========================================================= */}
            {activeTab === 'rejectCs' && (
                <div className="space-y-4">
                    {/* Top Action Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                                <FaBan /> <span>REJECT CS SUMMARY</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                កំណត់ត្រា Reject CS តាមថ្ងៃសម្រាប់ Brand: <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        {hasPermission('/follow-up/follow-up-4', 'create') && (
                            <button
                                onClick={() => handleOpenCreateRejectCs()}
                                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-600/20 cursor-pointer"
                            >
                                <FaPlusCircle size={15} />
                                <span>+ បញ្ចូល REJECT CS</span>
                            </button>
                        )}
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">ប្រវត្តិទិន្នន័យ REJECT CS តាមកាលបរិច្ឆេទ</span>
                            <span className="text-xs text-amber-400 font-mono font-semibold">{groupedRejectCs.length} ថ្ងៃបានកត់ត្រា</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-3 px-3 text-center w-10">#</th>
                                        <th className="py-3 px-3">កាលបរិច្ឆេទ</th>
                                        <th className="py-3 px-3 text-center font-bold text-amber-400">សរុប (TOTAL)</th>
                                        {droplists.rejectCsReasons.map((reason, rIdx) => (
                                            <th key={rIdx} className="py-3 px-3 text-center">{reason}</th>
                                        ))}
                                        <th className="py-3 px-3 text-center">សកម្មភាព</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {rejectCsLoading ? (
                                        <tr>
                                            <td colSpan={4 + droplists.rejectCsReasons.length} className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-amber-400" />
                                                <p>កំពុងទាញយកទិន្នន័យ...</p>
                                            </td>
                                        </tr>
                                    ) : groupedRejectCs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4 + droplists.rejectCsReasons.length} className="text-center py-8 text-slate-500 font-medium">
                                                មិនទាន់មានកំណត់ត្រា Reject CS នៅឡើយទេ សូមចុច &quot;+ បញ្ចូល REJECT CS&quot; ដើម្បីបញ្ចូល
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedRejectCs.map((group, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{group.date}</td>
                                                <td className="py-2.5 px-3 text-center font-mono font-extrabold text-amber-400 bg-amber-950/30">
                                                    {group.total}
                                                </td>
                                                {droplists.rejectCsReasons.map((reason, rIdx) => (
                                                    <td key={rIdx} className="py-2.5 px-3 text-center font-mono text-slate-300">
                                                        {group.reasons[reason] || 0}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-center">
                                                    <button
                                                        onClick={() => handleOpenCreateRejectCs(group.date)}
                                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        <FaEdit className="inline mr-1" /> កែប្រែ
                                                    </button>
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

            {/* =========================================================
                TAB 4: DETAIL (Automated Calculations & History Table)
               ========================================================= */}
            {activeTab === 'detail' && (
                <div className="space-y-6">
                    {/* Top Action Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-sky-400 flex items-center gap-2">
                                <FaCalculator /> <span>DETAIL METRICS & AUTOMATED FORMULAS</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                គណនារូបមន្តស្វ័យប្រវត្តិសម្រាប់ Brand: <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Date Filter */}
                            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                                <FaRegCalendarAlt className="text-sky-400 text-xs" />
                                <input
                                    type="date"
                                    value={detailStartDate}
                                    onChange={(e) => setDetailStartDate(e.target.value)}
                                    className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                                    title="ចាប់ពីថ្ងៃ"
                                />
                                <span className="text-slate-500 text-xs">ដល់</span>
                                <input
                                    type="date"
                                    value={detailEndDate}
                                    onChange={(e) => setDetailEndDate(e.target.value)}
                                    className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                                    title="ដល់ថ្ងៃ"
                                />
                                {(detailStartDate || detailEndDate) && (
                                    <button
                                        onClick={() => { setDetailStartDate(''); setDetailEndDate(''); }}
                                        className="text-[11px] text-rose-400 hover:text-rose-300 ml-1 font-semibold cursor-pointer underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {hasPermission('/follow-up/follow-up-4', 'create') && (
                                <button
                                    onClick={() => handleOpenCreateDetail()}
                                    className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 cursor-pointer"
                                >
                                    <FaPlusCircle size={15} />
                                    <span>+ បញ្ចូល DETAIL METRICS</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">ប្រវត្តិ DETAIL METRICS តាមកាលបរិច្ឆេទ</span>
                            <span className="text-xs text-sky-400 font-mono font-semibold">{detailHistoryList.length} ថ្ងៃបានកត់ត្រា</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-2.5 px-3">កាលបរិច្ឆេទ</th>
                                        <th className="py-2.5 px-2 text-center text-indigo-300 font-bold bg-indigo-950/30">MESSAGE</th>
                                        <th className="py-2.5 px-2 text-center">PAGE</th>
                                        <th className="py-2.5 px-2 text-center">TG</th>
                                        <th className="py-2.5 px-2 text-center">NO REPLY</th>
                                        <th className="py-2.5 px-2 text-center">INQUIRE</th>
                                        <th className="py-2.5 px-2 text-center text-rose-400">REJECT CS</th>
                                        <th className="py-2.5 px-2 text-center">MORE</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400">PAGE SUB</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400">TG SUB</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400 font-bold">CALL</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-200 font-black bg-blue-200 border-x border-emerald-600/50 shadow-inner">TOTAL SUBMIT</th>
                                        <th className="py-2.5 px-2 text-center text-amber-400">REVIEW</th>
                                        <th className="py-2.5 px-2 text-center text-rose-400">REJECT</th>
                                        <th className="py-2.5 px-2 text-center text-teal-400">SUCC 1</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-300">SUCC 2</th>
                                        <th className="py-2.5 px-2 text-center text-teal-200 font-black bg-green-300 border-x border-teal-600/50 shadow-inner">TOTAL SUCCESS</th>
                                        <th className="py-2.5 px-2 text-center">សកម្មភាព</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {detailLoading ? (
                                        <tr>
                                            <td colSpan="18" className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-sky-400" />
                                                <p>កំពុងទាញយកទិន្នន័យ...</p>
                                            </td>
                                        </tr>
                                    ) : detailHistoryList.length === 0 ? (
                                        <tr>
                                            <td colSpan="18" className="text-center py-8 text-slate-500 font-medium">
                                                មិនទាន់មានទិន្នន័យ Detail Metrics នៅឡើយទេ សូមចុច &quot;+ បញ្ចូល DETAIL METRICS&quot; ដើម្បីបញ្ចូល
                                            </td>
                                        </tr>
                                    ) : (
                                        detailHistoryList.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="py-2 px-3 font-mono font-bold text-sky-400 whitespace-nowrap">{row.date}</td>
                                                <td className="py-2 px-2 text-center font-mono font-bold text-indigo-300 bg-gray-300">
                                                    {(Number(row.page || 0) + Number(row.telegram || 0) + Number(row.call || 0))}
                                                </td>
                                                <td className="py-2 px-2 text-center font-mono">{row.page || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono">{row.telegram || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono">{row.noReply || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono">{row.inquire || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-rose-400">{row.rejectCs || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono">{row.more || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.pageSubmit || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.telegramSubmit || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.call || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono font-black text-emerald-200 bg-blue-200 border-x border-emerald-700/60 shadow-inner">
                                                    {Number(row.pageSubmit || 0) + Number(row.telegramSubmit || 0) + Number(row.call || 0)}
                                                </td>
                                                <td className="py-2 px-2 text-center font-mono text-amber-400">{row.review || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-rose-400">{row.reject || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-teal-400">{row.success1 || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono text-emerald-300 font-bold">{row.success2 || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono font-black text-teal-200 bg-green-200 border-x border-teal-700/60 shadow-inner">
                                                    {Number(row.success1 || 0) + Number(row.success2 || 0)}
                                                </td>
                                                <td className="py-2 px-2 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleOpenCreateDetail(row.date)}
                                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-sky-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        <FaEdit className="inline mr-1" /> កែប្រែ
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {detailHistoryList.length > 0 && (
                                    <tfoot className="bg-gray-300 font-bold border-t-2 border-slate-600 text-[11px]">
                                        <tr className="divide-y divide-slate-700">
                                            <td className="py-3 px-3 font-bold text-amber-400 uppercase tracking-wider">សរុប (TOTAL)</td>
                                            <td className="py-3 px-2 text-center font-mono text-indigo-300 bg-indigo-950/30">{grandDetailTotals.message}</td>
                                            <td className="py-3 px-2 text-center font-mono text-slate-200">{grandDetailTotals.page}</td>
                                            <td className="py-3 px-2 text-center font-mono text-slate-200">{grandDetailTotals.telegram}</td>
                                            <td className="py-3 px-2 text-center font-mono text-slate-200">{grandDetailTotals.noReply}</td>
                                            <td className="py-3 px-2 text-center font-mono text-slate-200">{grandDetailTotals.inquire}</td>
                                            <td className="py-3 px-2 text-center font-mono text-rose-400">{grandDetailTotals.rejectCs}</td>
                                            <td className="py-3 px-2 text-center font-mono text-slate-200">{grandDetailTotals.more}</td>
                                            <td className="py-3 px-2 text-center font-mono text-emerald-400">{grandDetailTotals.pageSubmit}</td>
                                            <td className="py-3 px-2 text-center font-mono text-emerald-400">{grandDetailTotals.telegramSubmit}</td>
                                            <td className="py-3 px-2 text-center font-mono text-emerald-400 font-bold">{grandDetailTotals.call}</td>
                                            <td className="py-3 px-2 text-center font-mono font-black text-emerald-200 bg-blue-300 border-x border-emerald-600 text-xs shadow-inner">
                                                {grandDetailTotals.totalSubmit}
                                            </td>
                                            <td className="py-3 px-2 text-center font-mono text-amber-400">{grandDetailTotals.review}</td>
                                            <td className="py-3 px-2 text-center font-mono text-rose-400">{grandDetailTotals.reject}</td>
                                            <td className="py-3 px-2 text-center font-mono text-teal-400">{grandDetailTotals.success1}</td>
                                            <td className="py-3 px-2 text-center font-mono text-emerald-300">{grandDetailTotals.success2}</td>
                                            <td className="py-3 px-2 text-center font-mono font-black text-teal-200 bg-green-300 border-x border-teal-600 text-xs shadow-inner">
                                                {grandDetailTotals.totalSuccess}
                                            </td>
                                            <td className="py-3 px-2 text-center text-slate-500 font-mono">-</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                MODAL DIALOGS (PROPS POPOVER AT CENTER OF SCREEN)
               ========================================================= */}
            {/* 1. Follow Up 4 Submit Modal */}
            <FollowUp4SubmitModal
                isOpen={isSubmitModalOpen}
                onClose={() => { setIsSubmitModalOpen(false); setEditingItem(null); }}
                editingItem={editingItem}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                submitting={submitFormSaving}
                droplists={droplists}
                isMasterAdmin={isMasterAdmin}
                brandsList={brandsList}
            />

            {/* 2. Reject Submit Modal */}
            <RejectSubmitModal
                isOpen={isRejectSubmitModalOpen}
                onClose={() => setIsRejectSubmitModalOpen(false)}
                date={rejectSubmitDate}
                setDate={setRejectSubmitDate}
                brand={selectedBrand || user?.brand}
                reasons={droplists.rejectSubmitReasons}
                counts={rejectSubmitCounts}
                setCounts={setRejectSubmitCounts}
                onSave={handleSaveRejectSubmit}
                saving={rejectSubmitSaving}
            />

            {/* 3. Reject CS Modal */}
            <RejectCsModal
                isOpen={isRejectCsModalOpen}
                onClose={() => setIsRejectCsModalOpen(false)}
                date={rejectCsDate}
                setDate={setRejectCsDate}
                brand={selectedBrand || user?.brand}
                reasons={droplists.rejectCsReasons}
                counts={rejectCsCounts}
                setCounts={setRejectCsCounts}
                onSave={handleSaveRejectCs}
                saving={rejectCsSaving}
            />

            {/* 4. Detail Metrics Modal */}
            <FollowUp4DetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                date={detailDate}
                setDate={setDetailDate}
                brand={selectedBrand || user?.brand}
                metrics={detailMetrics}
                setMetrics={setDetailMetrics}
                onSave={handleSaveDetail}
                saving={detailSaving}
                calculatedFormulas={calculatedFormulas}
            />

            {/* 5. Delete Confirmation Modal */}
            {deleteModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                        <FaTrashAlt className="text-rose-500 text-3xl mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-100 mb-1">តើអ្នកប្រាកដជាចង់លុប?</h4>
                        <p className="text-xs text-slate-400 mb-6">
                            ទិន្នន័យ &quot;<span className="text-emerald-400 font-semibold">{deleteModalItem.name}</span>&quot; នឹងត្រូវលុបចេញពីប្រព័ន្ធ។
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setDeleteModalItem(null)}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
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
