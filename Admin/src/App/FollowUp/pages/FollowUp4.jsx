import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaPlusCircle, FaFileExcel, FaTrashAlt,
    FaEdit, FaSearch,
    FaListUl, FaBuilding, FaBan,
    FaCalculator, FaChartBar, FaHistory, FaCheckCircle
} from 'react-icons/fa';
import { MdOutlineSync } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import ExportDropdown from '../../../components/ExportDropdown';
import CopyCell from '../../../components/CopyCell';
import DateRangeDropdown from '../../../components/DateRangeDropdown';

// Modular Prop-driven Subcomponents (Center Screen Modals)
import FollowUp4SubmitModal from '../components/FollowUp4SubmitModal';
import RejectSubmitModal from '../components/RejectSubmitModal';
import RejectCsModal from '../components/RejectCsModal';
import FollowUp4DetailModal from '../components/FollowUp4DetailModal';

const FollowUp4 = ({ workspaceId = 4 }) => {
    const { t } = useLanguage();
    const { API_BASE1, API_BASE2, user, hasPermission } = useAuth();
    const API_BASE = API_BASE1 || API_BASE2 || '/api';
    const workspaceApi = `${API_BASE}/follow-up-${workspaceId}`;
    const permissionPath = `/follow-up/follow-up-${workspaceId}`;

    // Active Tab
    const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'rejectSubmit' | 'rejectCs' | 'detail'

    // Brand filtering & list
    const [selectedBrand, setSelectedBrand] = useState('');
    const [brandsList, setBrandsList] = useState(['888MDM', 'ECloud']);

    // Master droplists dynamically fetched from Control System Database
    const [droplists, setDroplists] = useState({
        sources: ['PAGE', 'TELEGRAM', 'TikTok', 'FB Page', 'Walk-in', 'CALL', 'Other'],
        contactTypes: ['Call', 'Chat', 'Telegram', 'Walk-in', 'Other'],
        statuses: [],
        assetTypes: ['Smart Phone', 'Motorcycle', 'Car', 'Real Estate', 'Jewelry', 'Laptop/PC', 'Other'],
        models: [],
        pgTlNames: [],
        descriptions: [],
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
                    const ast = findCat(['Follow Up 4 Asset Types', 'Asset Types', 'ប្រភេទទ្រព្យ']);
                    const modelOptions = findCat(['Device Models', 'Models', 'ម៉ូឌែល']);
                    const pgTlNames = findCat(['Follow Up 4 PG/TL Names', 'PG/TL Names']);
                    const descriptions = findCat(['Follow Up 4 Descriptions', 'Follow Up 4 Description Options']);
                    const rsr = findCat(['Reject Submit Reasons', 'Reject Submit', 'មូលហេតុ Reject Submit']);
                    const rcr = findCat(['Reject CS Reasons', 'Reject CS', 'មូលហេតុ Reject CS']);
                    const bList = findCat(['Brands', 'Brand']);

                    if (bList && Array.isArray(bList) && bList.length > 0) setBrandsList(bList);

                    setDroplists(prev => ({
                        sources: (src && src.length > 0) ? src : prev.sources,
                        contactTypes: (ct && ct.length > 0) ? ct : prev.contactTypes,
                        statuses: prev.statuses,
                        assetTypes: (ast && ast.length > 0) ? ast : prev.assetTypes,
                        models: modelOptions || prev.models,
                        pgTlNames: pgTlNames || [],
                        descriptions: descriptions || [],
                        rejectSubmitReasons: (rsr && Array.isArray(rsr)) ? rsr : [],
                        rejectCsReasons: (rcr && Array.isArray(rcr)) ? rcr : []
                    }));
                }
            }
        } catch (err) {
            console.error('Fetch Control System Error in FollowUp4:', err);
        }
    }, [API_BASE, workspaceId, selectedBrand, user?.brand]);

    useEffect(() => {
        fetchControlSystemData();
    }, [fetchControlSystemData]);

    const fetchStatuses = useCallback(async (brandOverride = '') => {
        const brand = brandOverride || selectedBrand || user?.brand || '888MDM';
        const params = new URLSearchParams({
            brand,
            username: user?.username || '',
            userRole: user?.role || '',
            userBrand: user?.brand || '',
            isImmutable: user?.isImmutable ? 'true' : 'false'
        });
        try {
            const res = await fetch(`${workspaceApi}/statuses?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load Follow Up 4 statuses (${res.status})`);
            const data = await res.json();
            setDroplists(prev => ({ ...prev, statuses: Array.isArray(data.data) ? data.data : [] }));
        } catch (err) {
            console.error('Fetch Follow Up 4 statuses error:', err);
            setDroplists(prev => ({ ...prev, statuses: [] }));
        }
    }, [workspaceApi, selectedBrand, user]);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    const handleCreateStatus = async (status) => {
        const brand = selectedBrand || user?.brand || formData.brand || '888MDM';
        const response = await fetch(`${workspaceApi}/statuses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                brand,
                username: user?.username || '',
                userRole: user?.role || '',
                userBrand: user?.brand || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || t('failedToSave'));
        }
        await fetchStatuses(brand);
        setFormData(prev => ({ ...prev, status: result.data.status }));
    };

    // Helper functions for date range formatting
    const getPastDateStr = (daysAgo) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTodayStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // =========================================================
    // TAB 1: FOLLOW UP SUBMIT STATE & LOGIC
    // =========================================================
    const [submitList, setSubmitList] = useState([]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitFormSaving, setSubmitFormSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitStartDate, setSubmitStartDate] = useState(() => getTodayStr());
    const [submitEndDate, setSubmitEndDate] = useState(() => getTodayStr());

    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        date: getTodayStr(),
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

    useEffect(() => {
        if (isSubmitModalOpen) fetchStatuses(formData.brand);
    }, [isSubmitModalOpen, formData.brand, fetchStatuses]);

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
            if (submitStartDate) params.append('startDate', submitStartDate);
            if (submitEndDate) params.append('endDate', submitEndDate);
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`${workspaceApi}/submit?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setSubmitList(result.data || []);
            }
        } catch (err) {
            console.error('Fetch Submit Data Error:', err);
        } finally {
            setSubmitLoading(false);
        }
    }, [workspaceApi, API_BASE, user, selectedBrand, submitStartDate, submitEndDate, searchTerm]);

    useEffect(() => {
        if (activeTab === 'submit') {
            fetchSubmitData();
        }
    }, [activeTab, fetchSubmitData]);

    const handleOpenCreateSubmitForm = () => {
        setEditingItem(null);
        const telegramContactType = droplists.contactTypes.find(
            contactType => typeof contactType === 'string' && contactType.trim().toLowerCase() === 'telegram'
        );
        setFormData({
            date: getTodayStr(),
            name: '',
            userName: '',
            phone: '',
            nameTelegram: '',
            fromSource: droplists.sources[0] || 'PAGE',
            namePgTlFrom: '',
            contactType: telegramContactType || droplists.contactTypes[0] || 'Telegram',
            namePgTlContact: '',
            appraisal: '',
            requested: '',
            assetType: droplists.assetTypes[0] || '',
            model: '',
            status: droplists.statuses[0] || '',
            description: '',
            brand: selectedBrand || user?.brand || '888MDM'
        });
        setIsSubmitModalOpen(true);
    };

    const handleOpenEditSubmitForm = (item) => {
        setEditingItem(item);
        setFormData({
            date: item.date || getTodayStr(),
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
                ? `${workspaceApi}/submit/${editingItem._id}`
                : `${workspaceApi}/submit`;
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
                alert(`${t('error')}: ${errData.message || t('failedToSave')}`);
            }
        } catch (err) {
            alert(`${t('networkError')}: ${err.message}`);
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
            const res = await fetch(`${workspaceApi}/submit/${deleteModalItem._id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setDeleteModalItem(null);
                fetchSubmitData();
            } else {
                alert(t('failedToDeleteItem'));
            }
        } catch (err) {
            alert(`${t('error')}: ${err.message}`);
        }
    };

    // =========================================================
    // TAB 2: REJECT SUBMIT STATE & LOGIC (Default: 1 Week)
    // =========================================================
    const [rejectSubmitDate, setRejectSubmitDate] = useState(getTodayStr());
    const [rejectSubmitStartDate, setRejectSubmitStartDate] = useState(getPastDateStr(6)); // Default 1 week (today & past 6 days)
    const [rejectSubmitEndDate, setRejectSubmitEndDate] = useState(getTodayStr());
    const [rejectSubmitCounts, setRejectSubmitCounts] = useState({});
    const [rejectSubmitSaving, setRejectSubmitSaving] = useState(false);
    const [rejectSubmitLoading, setRejectSubmitLoading] = useState(false);
    const [isRejectSubmitModalOpen, setIsRejectSubmitModalOpen] = useState(false);
    const [rejectSubmitHistoryList, setRejectSubmitHistoryList] = useState([]);
    const [rejectSubmitFollowUpRows, setRejectSubmitFollowUpRows] = useState([]);
    const [rejectSubmitFollowUpLoading, setRejectSubmitFollowUpLoading] = useState(false);
    const [rejectSubmitFollowUpError, setRejectSubmitFollowUpError] = useState('');

    const fetchRejectSubmitData = useCallback(async () => {
        setRejectSubmitLoading(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const params = new URLSearchParams();
            if (user?.brand) params.append('userBrand', user.brand);
            if (user?.role) params.append('userRole', user.role);
            if (user?.username) params.append('username', user.username);
            if (user?.isImmutable) params.append('isImmutable', String(user.isImmutable));
            if (selectedBrand) params.append('brand', targetBrand);
            if (rejectSubmitStartDate) params.append('startDate', rejectSubmitStartDate);
            if (rejectSubmitEndDate) params.append('endDate', rejectSubmitEndDate);

            const res = await fetch(`${workspaceApi}/reject-submit?${params.toString()}`);
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
    }, [workspaceApi, API_BASE, rejectSubmitDate, rejectSubmitStartDate, rejectSubmitEndDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'rejectSubmit') {
            fetchRejectSubmitData();
        }
    }, [activeTab, fetchRejectSubmitData]);

    const handleOpenCreateRejectSubmit = (targetDate = null) => {
        const nextDate = targetDate || getTodayStr();
        setRejectSubmitDate(nextDate);
        const forDate = rejectSubmitHistoryList.filter(r => r.date === nextDate);
        const countsObj = {};
        forDate.forEach(r => {
            countsObj[r.reason] = r.count;
        });
        setRejectSubmitCounts(countsObj);
        setIsRejectSubmitModalOpen(true);
    };

    const fetchRejectSubmitFollowUpRows = useCallback(async (targetDate) => {
        if (!targetDate) {
            setRejectSubmitFollowUpRows([]);
            return;
        }

        setRejectSubmitFollowUpLoading(true);
        setRejectSubmitFollowUpError('');
        try {
            const params = new URLSearchParams({ date: targetDate });
            if (user?.brand) params.append('userBrand', user.brand);
            if (user?.role) params.append('userRole', user.role);
            if (user?.username) params.append('username', user.username);
            if (user?.isImmutable) params.append('isImmutable', String(user.isImmutable));
            if (selectedBrand) params.append('brand', selectedBrand);

            const res = await fetch(`${workspaceApi}/submit?${params.toString()}`);
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.message || 'Failed to load Follow Up Submit records');
            }

            setRejectSubmitFollowUpRows(result.data || []);
        } catch (err) {
            console.error('Fetch Follow Up Submit for Reject Submit Error:', err);
            setRejectSubmitFollowUpRows([]);
            setRejectSubmitFollowUpError(err.message || 'Failed to load Follow Up Submit records');
        } finally {
            setRejectSubmitFollowUpLoading(false);
        }
    }, [workspaceApi, API_BASE, selectedBrand, user]);

    const handleSaveRejectSubmit = async () => {
        setRejectSubmitSaving(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const entries = droplists.rejectSubmitReasons.map(reason => ({
                reason,
                count: Number(rejectSubmitCounts[reason]) || 0
            }));

            const res = await fetch(`${workspaceApi}/reject-submit/save`, {
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
                alert(t('rejectSubmitDataSaved'));
                setIsRejectSubmitModalOpen(false);
                fetchRejectSubmitData();
            } else {
                alert(t('failedToSave'));
            }
        } catch (err) {
            alert(`${t('error')}: ${err.message}`);
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

    const rejectSubmitDisplayReasons = useMemo(() => (
        [...new Set([
            ...(droplists.rejectSubmitReasons || []),
            ...rejectSubmitHistoryList.map(item => item.reason).filter(Boolean)
        ])]
    ), [droplists.rejectSubmitReasons, rejectSubmitHistoryList]);

    // Calculate Grand Totals across all filtered rows in Reject Submit
    const grandRejectSubmitTotals = useMemo(() => {
        let grandTotal = 0;
        const reasonTotals = {};
        rejectSubmitDisplayReasons.forEach(r => {
            reasonTotals[r] = 0;
        });

        groupedRejectSubmit.forEach(group => {
            grandTotal += (Number(group.total) || 0);
            rejectSubmitDisplayReasons.forEach(r => {
                reasonTotals[r] = (reasonTotals[r] || 0) + (Number(group.reasons[r]) || 0);
            });
        });

        return {
            grandTotal,
            reasonTotals
        };
    }, [groupedRejectSubmit, rejectSubmitDisplayReasons]);

    // =========================================================
    // TAB 3: REJECT CS STATE & LOGIC (Default: 1 Week)
    // =========================================================
    const [rejectCsDate, setRejectCsDate] = useState(getTodayStr());
    const [rejectCsStartDate, setRejectCsStartDate] = useState(getPastDateStr(6)); // Default 1 week (today & past 6 days)
    const [rejectCsEndDate, setRejectCsEndDate] = useState(getTodayStr());
    const [rejectCsCounts, setRejectCsCounts] = useState({});
    const [rejectCsSaving, setRejectCsSaving] = useState(false);
    const [rejectCsLoading, setRejectCsLoading] = useState(false);
    const [isRejectCsModalOpen, setIsRejectCsModalOpen] = useState(false);
    const [rejectCsHistoryList, setRejectCsHistoryList] = useState([]);

    const fetchRejectCsData = useCallback(async () => {
        setRejectCsLoading(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const params = new URLSearchParams();
            if (user?.brand) params.append('userBrand', user.brand);
            if (user?.role) params.append('userRole', user.role);
            if (user?.username) params.append('username', user.username);
            if (user?.isImmutable) params.append('isImmutable', String(user.isImmutable));
            if (selectedBrand) params.append('brand', targetBrand);
            if (rejectCsStartDate) params.append('startDate', rejectCsStartDate);
            if (rejectCsEndDate) params.append('endDate', rejectCsEndDate);

            const res = await fetch(`${workspaceApi}/reject-cs?${params.toString()}`);
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
    }, [workspaceApi, API_BASE, rejectCsDate, rejectCsStartDate, rejectCsEndDate, selectedBrand, user]);

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
            setRejectCsDate(getTodayStr());
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

            const res = await fetch(`${workspaceApi}/reject-cs/save`, {
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
                alert(t('rejectCsDataSaved'));
                setIsRejectCsModalOpen(false);
                fetchRejectCsData();
            } else {
                alert(t('failedToSave'));
            }
        } catch (err) {
            alert(`${t('error')}: ${err.message}`);
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

    const rejectCsDisplayReasons = useMemo(() => (
        [...new Set([
            ...(droplists.rejectCsReasons || []),
            ...rejectCsHistoryList.map(item => item.reason).filter(Boolean)
        ])]
    ), [droplists.rejectCsReasons, rejectCsHistoryList]);

    // Calculate Grand Totals across all filtered rows in Reject CS
    const grandRejectCsTotals = useMemo(() => {
        let grandTotal = 0;
        const reasonTotals = {};
        rejectCsDisplayReasons.forEach(r => {
            reasonTotals[r] = 0;
        });

        groupedRejectCs.forEach(group => {
            grandTotal += (Number(group.total) || 0);
            rejectCsDisplayReasons.forEach(r => {
                reasonTotals[r] = (reasonTotals[r] || 0) + (Number(group.reasons[r]) || 0);
            });
        });

        return {
            grandTotal,
            reasonTotals
        };
    }, [groupedRejectCs, rejectCsDisplayReasons]);

    // =========================================================
    // TAB 4: DETAIL STATE & AUTOMATED FORMULAS LOGIC (Default: 1 Week)
    // =========================================================
    const [detailDate, setDetailDate] = useState(getTodayStr());
    const [detailStartDate, setDetailStartDate] = useState(getPastDateStr(6)); // Default 1 week (today & past 6 days)
    const [detailEndDate, setDetailEndDate] = useState(getTodayStr());
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
        reject2: '',
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
            reject2: 0,
            totalReject: 0,
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
            totals.reject2 += Number(row.reject2 || 0);
            totals.totalReject += Number(row.reject || 0) + Number(row.reject2 || 0);
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

            const res = await fetch(`${workspaceApi}/detail?${params.toString()}`);
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
                        reject2: currentDay.reject2 ?? '',
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
    }, [workspaceApi, API_BASE, detailDate, detailStartDate, detailEndDate, selectedBrand, user]);

    useEffect(() => {
        if (activeTab === 'detail') {
            fetchDetailData();
        }
    }, [activeTab, fetchDetailData]);

    const handleOpenCreateDetail = (targetDate = null) => {
        const today = getTodayStr();
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
                    reject2: existing.reject2 ?? '',
                    success1: existing.success1 ?? '',
                    success2: existing.success2 ?? ''
                });
            } else {
                setDetailMetrics({
                    message: '', page: '', telegram: '', noReply: '', inquire: '',
                    rejectCs: '', more: '', pageSubmit: '', telegramSubmit: '', call: '',
                    review: '', reject: '', reject2: '', success1: '', success2: ''
                });
            }
        } else {
            // Clean fresh form on new create
            setDetailMetrics({
                message: '', page: '', telegram: '', noReply: '', inquire: '',
                rejectCs: '', more: '', pageSubmit: '', telegramSubmit: '', call: '',
                review: '', reject: '', reject2: '', success1: '', success2: ''
            });
        }
        setIsDetailModalOpen(true);
    };

    const handleSaveDetail = async () => {
        setDetailSaving(true);
        try {
            const targetBrand = selectedBrand || user?.brand || '888MDM';
            const res = await fetch(`${workspaceApi}/detail/save`, {
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
                    reject2: Number(detailMetrics.reject2) || 0,
                    success1: Number(detailMetrics.success1) || 0,
                    success2: Number(detailMetrics.success2) || 0,
                    createdBy: user?.username || 'Staff'
                })
            });

            if (res.ok) {
                alert(t('detailDataSaved'));
                setIsDetailModalOpen(false);
                fetchDetailData();
            } else {
                alert(t('failedToSave'));
            }
        } catch (err) {
            alert(`${t('error')}: ${err.message}`);
        } finally {
            setDetailSaving(false);
        }
    };

    // Excel Export Helper
    const handleExport = (format) => {
        const downloadReport = (data, fileName) => {
            if (format === 'excel') {
                exportToExcel(data, fileName);
                return;
            }
            const columns = Object.keys(data[0] || {}).map(key => ({ header: key, accessor: key }));
            exportToPDF(fileName, columns, data, user?.brand || '', orientation);
        };

        if (activeTab === 'submit') {
            const exportData = submitList.map((item, idx) => ({
                '#': idx + 1,
                [t('date')]: item.date,
                'NAME': item.name,
                'USER NAME': item.userName,
                'PHONE NUMBER': item.phone,
                'NAME TELEGRAM': item.nameTelegram,
                [t('source')]: item.fromSource,
                'PG/TL From': item.namePgTlFrom,
                [t('contactType')]: item.contactType,
                'PG/TL Contact': item.namePgTlContact,
                [t('evaluation')]: item.appraisal,
                [t('requested')]: item.requested,
                [t('collateral')]: item.assetType,
                'MODEL': item.model,
                'STATUS': item.status,
                [t('description')]: item.description,
                'BRAND': item.brand
            }));
            downloadReport(exportData, `FollowUp4_Submit_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'rejectSubmit') {
            const exportData = groupedRejectSubmit.map((item, idx) => {
                const row = { '#': idx + 1, [t('date')]: item.date, [t('brand')]: item.brand, [t('total')]: item.total };
                rejectSubmitDisplayReasons.forEach(r => {
                    row[r] = item.reasons[r] || 0;
                });
                return row;
            });
            if (groupedRejectSubmit.length > 0) {
                const totalRow = {
                    '#': t('total'),
                    [t('date')]: `${t('grandTotal')} (${groupedRejectSubmit.length} ${t('days')})`,
                    'BRAND': selectedBrand || user?.brand || '888MDM',
                    [t('total')]: grandRejectSubmitTotals.grandTotal
                };
                rejectSubmitDisplayReasons.forEach(r => {
                    totalRow[r] = grandRejectSubmitTotals.reasonTotals[r] || 0;
                });
                exportData.push(totalRow);
            }
            downloadReport(exportData, `FollowUp4_Reject_Submit_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'rejectCs') {
            const exportData = groupedRejectCs.map((item, idx) => {
                const row = { '#': idx + 1, [t('date')]: item.date, [t('brand')]: item.brand, [t('total')]: item.total };
                rejectCsDisplayReasons.forEach(r => {
                    row[r] = item.reasons[r] || 0;
                });
                return row;
            });
            if (groupedRejectCs.length > 0) {
                const totalRow = {
                    '#': t('total'),
                    [t('date')]: `${t('grandTotal')} (${groupedRejectCs.length} ${t('days')})`,
                    'BRAND': selectedBrand || user?.brand || '888MDM',
                    [t('total')]: grandRejectCsTotals.grandTotal
                };
                rejectCsDisplayReasons.forEach(r => {
                    totalRow[r] = grandRejectCsTotals.reasonTotals[r] || 0;
                });
                exportData.push(totalRow);
            }
            downloadReport(exportData, `FollowUp4_Reject_CS_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'detail') {
            const exportData = detailHistoryList.map((item, idx) => {
                const message = (item.page || 0) + (item.telegram || 0) + (item.call || 0);
                const verify = (item.noReply || 0) + (item.inquire || 0) + (item.rejectCs || 0) + (item.more || 0) + (item.pageSubmit || 0) + (item.telegramSubmit || 0) + (item.call || 0);
                const totalSubmit = (item.pageSubmit || 0) + (item.telegramSubmit || 0) + (item.call || 0);
                const totalReject = (Number(item.reject) || 0) + (Number(item.reject2) || 0);
                const totalSuccess = (item.success1 || 0) + (item.success2 || 0);
                return {
                    '#': idx + 1,
                    [t('date')]: item.date,
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
                    'REJECT1': item.reject || 0,
                    'REJECT2': item.reject2 || 0,
                    'TOTAL': totalReject,
                    'TOTAL SUCCESS': totalSuccess,
                    'SUCCESS 1': item.success1 || 0,
                    'SUCCESS 2': item.success2 || 0
                };
            });
            downloadReport(exportData, `FollowUp4_Detail_Metrics_${new Date().toISOString().split('T')[0]}`);
        }
    };

    return (
        <div className="p-2 md:p-2 bg-slate-900 text-slate-100">
            {/* Header & Brand Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-800/80 p-2 rounded-[5px] border border-slate-700/60 shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                        Follow Up {workspaceId} System
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Brand Selector */}
                    {isMasterAdmin && (
                        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-[5px] border border-slate-700 shadow-inner">
                            <FaBuilding className="text-emerald-400 text-sm" />
                            <span className="text-xs text-slate-300 font-semibold">{t('brand')}:</span>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer"
                            >
                                <option value="" className="bg-slate-800 text-slate-200">{t('allBrands')}</option>
                                {brandsList.map(b => (
                                    <option key={b} value={b} className="bg-slate-800 text-slate-200">{b}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <ExportDropdown
                        onExportExcel={() => handleExport('excel')}
                        onExportPDF={() => handleExport('pdf')}
                        excelLabel="Export Excel"
                        pdfLabel="Export PDF"
                    />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-700/80">
                <button
                    onClick={() => {
                        setActiveTab('submit');
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-[5px] font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'submit'
                        ? 'bg-emerald-600 text-white border-b-2 border-emerald-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaListUl />
                    <span>{t('followUpSubmit')}</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectSubmit')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-[5px] font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'rejectSubmit'
                        ? 'bg-rose-600 text-white border-b-2 border-rose-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaBan />
                    <span>{t('rejectSubmit')}</span>
                </button>

                <button
                    onClick={() => setActiveTab('rejectCs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-[5px] font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'rejectCs'
                        ? 'bg-amber-600 text-white border-b-2 border-amber-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaBan />
                    <span>{t('rejectCs')}</span>
                </button>

                <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-[5px] font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'detail'
                        ? 'bg-sky-600 text-white border-b-2 border-sky-400 shadow-md'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <FaCalculator />
                    <span>{t('detailMetrics')}</span>
                </button>
            </div>

            {/* =========================================================
                TAB 1: FOLLOW UP SUBMIT
               ========================================================= */}
            {activeTab === 'submit' && (
                <div className="space-y-4">
                    {/* Filters & Actions Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/60 p-2 rounded-[5px] border border-slate-700/50">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder={t('searchNamePhoneUsername')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/90 text-xs text-black pl-9 pr-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <DateRangeDropdown
                                from={submitStartDate}
                                to={submitEndDate}
                                label={t('submissionDate')}
                                onApplyRange={(from, to) => {
                                    setSubmitStartDate(from);
                                    setSubmitEndDate(to);
                                }}
                            />
                        </div>

                        {/* Add Button */}
                        {hasPermission(permissionPath, 'create') && (
                            <button
                                onClick={handleOpenCreateSubmitForm}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-semibold text-xs px-4 py-2.5 rounded-[5px] transition-all shadow-md cursor-pointer"
                            >
                                <FaPlusCircle size={15} />
                                <span>{t('addFollowUpSubmit')}</span>
                            </button>
                        )}
                    </div>

                    {/* Submissions Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-[5px] overflow-hidden shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-1 px-3 text-center w-10">#</th>
                                        <th className="py-1 px-3">{t('date')}</th>
                                        <th className="py-1 px-3">{t('customerName')}</th>
                                        <th className="py-1 px-3">{t('username')}</th>
                                        <th className="py-1 px-3">{t('phone')}</th>
                                        <th className="py-1 px-3">{t('telegramName')}</th>
                                        <th className="py-1 px-3">{t('source')}</th>
                                        <th className="py-1 px-3">{t('pgTlSourceName')}</th>
                                        <th className="py-1 px-3">{t('contactType')}</th>
                                        <th className="py-1 px-3">{t('pgTlContactName')}</th>
                                        <th className="py-1 px-3">{t('evaluation')}</th>
                                        <th className="py-1 px-3">{t('requested')}</th>
                                        <th className="py-1 px-3">{t('collateral')}</th>
                                        <th className="py-1 px-3">{t('model')}</th>
                                        <th className="py-1 px-3">{t('status')}</th>
                                        <th className="py-1 px-3">{t('description')}</th>
                                        <th className="py-1 px-3 text-center">{t('actionLabel')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {submitLoading ? (
                                        <tr>
                                            <td colSpan="17" className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-emerald-400" />
                                                <p>{t('loading')}</p>
                                            </td>
                                        </tr>
                                    ) : submitList.length === 0 ? (
                                        <tr>
                                            <td colSpan="17" className="text-center py-8 text-slate-500 font-medium">
                                                {t('noData')}
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
                                                                        {hasPermission(permissionPath, 'edit') && (
                                                                            <button
                                                                                onClick={() => handleOpenEditSubmitForm(item)}
                                                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition-all cursor-pointer"
                                                                                title={t('edit')}
                                                                            >
                                                                                <FaEdit size={14} />
                                                                            </button>
                                                                        )}
                                                                        {hasPermission(permissionPath, 'delete') && (
                                                                            <button
                                                                                onClick={() => setDeleteModalItem(item)}
                                                                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-all cursor-pointer"
                                                                                title={t('delete')}
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
                                                                <span>{t('dailyTotal')} ({group.date}):</span>
                                                                <span className="bg-slate-900 text-slate-300 text-[11px] px-2 py-0.5 rounded border border-slate-700">
                                                                    {group.count} {t('records')}
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
                                                                <span className="text-emerald-400">{t('success')}: {group.successCount}</span>
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
                                                    <span>{t('grandTotal')}:</span>
                                                    <span className="bg-emerald-950 text-emerald-300 text-[11px] px-2.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                                                        {submitTotals.count} {t('records')} {groupedSubmitByDate.length > 1 ? `(${groupedSubmitByDate.length} ${t('days')})` : ''}
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
                                                    <span className="text-emerald-400">{t('success')}: {submitTotals.successCount}</span>
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
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/70 p-2 rounded-[5px] border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-rose-400 flex items-center gap-2">
                                <FaBan /> <span>{t('rejectSubmitSummary')}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {t('rejectSubmitRecordsByDayForBrand')} <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Date Filter */}
                            <DateRangeDropdown
                                from={rejectSubmitStartDate}
                                to={rejectSubmitEndDate}
                                label="Date Filter"
                                onApplyRange={(from, to) => {
                                    setRejectSubmitStartDate(from);
                                    setRejectSubmitEndDate(to);
                                }}
                            />

                            {hasPermission(permissionPath, 'create') && (
                                <button
                                    onClick={() => handleOpenCreateRejectSubmit()}
                                    className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-[5px] transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
                                >
                                    <FaPlusCircle size={15} />
                                    <span>{t('addRejectSubmit')}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-[5px] overflow-hidden shadow-xl">
                        <div className="p-2 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{t('rejectSubmitHistoryByDate')}</span>
                            <span className="text-xs text-rose-400 font-mono font-semibold">{groupedRejectSubmit.length} {t('daysRecorded')}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr className='text-white'>
                                        <th className="py-1 px-3 text-center w-10">#</th>
                                        <th className="py-1 px-3">{t('date')}</th>
                                        <th className="py-1 px-3 text-center font-bold text-rose-400">{t('total')}</th>
                                        {rejectSubmitDisplayReasons.map((reason, rIdx) => (
                                            <th key={rIdx} className="py-1 px-3 text-center">{reason}</th>
                                        ))}
                                        <th className="py-1 px-3 text-center">{t('actionLabel')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-white divide-slate-700/50">
                                    {rejectSubmitLoading ? (
                                        <tr>
                                            <td colSpan={4 + rejectSubmitDisplayReasons.length} className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-rose-400" />
                                                <p>{t('loading')}</p>
                                            </td>
                                        </tr>
                                    ) : groupedRejectSubmit.length === 0 ? (
                                        <tr>
                                            <td colSpan={4 + rejectSubmitDisplayReasons.length} className="text-center py-8 text-slate-500 font-medium">
                                                {t('noRejectSubmitHistoryAddPrompt')} {t('addRejectSubmit')}
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
                                                {rejectSubmitDisplayReasons.map((reason, rIdx) => (
                                                    <td key={rIdx} className="py-2.5 px-3 text-center font-mono text-slate-300">
                                                        {group.reasons[reason] || 0}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-center">
                                                    <button
                                                        onClick={() => handleOpenCreateRejectSubmit(group.date)}
                                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-rose-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        <FaEdit className="inline mr-1" /> {t('edit')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {groupedRejectSubmit.length > 0 && (
                                    <tfoot className="border-t-2 border-rose-500/50 text-xs shadow-inner">
                                        <tr className="bg-slate-950 font-bold text-slate-100 border-t border-rose-500/40">
                                            <td className="py-3.5 px-3 text-center text-slate-400 font-mono">-</td>
                                            <td className="py-3.5 px-3 font-bold text-rose-400 uppercase tracking-wider">
                                                <div className="flex items-center gap-2">
                                                    <span>{t('grandTotal')}:</span>
                                                    <span className="bg-rose-950 text-rose-300 text-[11px] px-2.5 py-0.5 rounded border border-rose-500/40 font-bold">
                                                        {groupedRejectSubmit.length} {t('days')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono font-black text-rose-400 bg-rose-950/40 text-sm">
                                                {grandRejectSubmitTotals.grandTotal}
                                            </td>
                                            {rejectSubmitDisplayReasons.map((reason, rIdx) => (
                                                <td key={rIdx} className="py-3.5 px-3 text-center font-mono font-bold text-slate-200">
                                                    {grandRejectSubmitTotals.reasonTotals[reason] || 0}
                                                </td>
                                            ))}
                                            <td className="py-3.5 px-3 text-center text-slate-500 font-mono">-</td>
                                        </tr>
                                    </tfoot>
                                )}
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
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/70 p-2 rounded-[5px] border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                                <FaBan /> <span>{t('rejectCsSummary')}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {t('rejectCsRecordsByDayForBrand')} <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Date Filter */}
                            <DateRangeDropdown
                                from={rejectCsStartDate}
                                to={rejectCsEndDate}
                                label="Date Filter"
                                onApplyRange={(from, to) => {
                                    setRejectCsStartDate(from);
                                    setRejectCsEndDate(to);
                                }}
                            />

                            {hasPermission(permissionPath, 'create') && (
                                <button
                                    onClick={() => handleOpenCreateRejectCs()}
                                    className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-[5px] transition-all shadow-lg shadow-amber-600/20 cursor-pointer"
                                >
                                    <FaPlusCircle size={15} />
                                    <span>{t('addRejectCs')}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-[5px] overflow-hidden shadow-xl">
                        <div className="p-2 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{t('rejectCsHistoryByDate')}</span>
                            <span className="text-xs text-amber-400 font-mono font-semibold">{groupedRejectCs.length} {t('daysRecorded')}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-1 px-3 text-center w-10">#</th>
                                        <th className="py-1 px-3">{t('date')}</th>
                                        <th className="py-1 px-3 text-center font-bold text-amber-400">{t('total')}</th>
                                        {rejectCsDisplayReasons.map((reason, rIdx) => (
                                            <th key={rIdx} className="py-1 px-3 text-center">{reason}</th>
                                        ))}
                                        <th className="py-1 px-3 text-center">{t('actionLabel')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {rejectCsLoading ? (
                                        <tr>
                                            <td colSpan={4 + rejectCsDisplayReasons.length} className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-amber-400" />
                                                <p>{t('loading')}</p>
                                            </td>
                                        </tr>
                                    ) : groupedRejectCs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4 + rejectCsDisplayReasons.length} className="text-center py-8 text-slate-500 font-medium">
                                                {t('noRejectCsHistoryAddPrompt')} {t('addRejectCs')}
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
                                                {rejectCsDisplayReasons.map((reason, rIdx) => (
                                                    <td key={rIdx} className="py-2.5 px-3 text-center font-mono text-slate-300">
                                                        {group.reasons[reason] || 0}
                                                    </td>
                                                ))}
                                                <td className="py-2.5 px-3 text-center">
                                                    <button
                                                        onClick={() => handleOpenCreateRejectCs(group.date)}
                                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        <FaEdit className="inline mr-1" /> {t('edit')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {groupedRejectCs.length > 0 && (
                                    <tfoot className="border-t-2 border-amber-500/50 text-xs shadow-inner">
                                        <tr className="bg-slate-950 font-bold text-slate-100 border-t border-amber-500/40">
                                            <td className="py-3.5 px-3 text-center text-slate-400 font-mono">-</td>
                                            <td className="py-3.5 px-3 font-bold text-amber-400 uppercase tracking-wider">
                                                <div className="flex items-center gap-2">
                                                    <span>{t('grandTotal')}:</span>
                                                    <span className="bg-amber-950 text-amber-300 text-[11px] px-2.5 py-0.5 rounded border border-amber-500/40 font-bold">
                                                        {groupedRejectCs.length} {t('days')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono font-black text-amber-400 bg-amber-950/40 text-sm">
                                                {grandRejectCsTotals.grandTotal}
                                            </td>
                                            {rejectCsDisplayReasons.map((reason, rIdx) => (
                                                <td key={rIdx} className="py-3.5 px-3 text-center font-mono font-bold text-slate-200">
                                                    {grandRejectCsTotals.reasonTotals[reason] || 0}
                                                </td>
                                            ))}
                                            <td className="py-3.5 px-3 text-center text-slate-500 font-mono">-</td>
                                        </tr>
                                    </tfoot>
                                )}
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
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/70 p-2 rounded-[5px] border border-slate-700/60 shadow-lg">
                        <div>
                            <h2 className="text-base font-bold text-sky-400 flex items-center gap-2">
                                <FaCalculator /> <span>{t('detailMetricsAndAutomatedFormulas')}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {t('calculateAutomaticFormulasForBrand')} <span className="text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded">{selectedBrand || user?.brand || '888MDM'}</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Date Filter */}
                            <DateRangeDropdown
                                from={detailStartDate}
                                to={detailEndDate}
                                label="Date Filter"
                                onApplyRange={(from, to) => {
                                    setDetailStartDate(from);
                                    setDetailEndDate(to);
                                }}
                            />

                            {hasPermission(permissionPath, 'create') && (
                                <button
                                    onClick={() => handleOpenCreateDetail()}
                                    className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-[5px] transition-all shadow-lg shadow-sky-600/20 cursor-pointer"
                                >
                                    <FaPlusCircle size={15} />
                                    <span>{t('addDetailMetrics')}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-[5px] overflow-hidden shadow-xl">
                        <div className="p-2 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{t('detailMetricsHistoryByDate')}</span>
                            <span className="text-xs text-sky-400 font-mono font-semibold">{detailHistoryList.length} {t('daysRecorded')}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-200">
                                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="py-2.5 px-3">{t('date')}</th>
                                        <th className="py-2.5 px-2 text-center text-indigo-300 font-bold bg-indigo-950/30">{t('totalMessages')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('facebookPage')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('telegramShort')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('noReply')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('inquire')}</th>
                                        <th className="py-2.5 px-2 text-center text-rose-400">{t('rejectCs')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('more')}</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400">{t('pageSubmit')}</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400">{t('telegramSubmit')}</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-400 font-bold">{t('call')}</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-200 font-black bg-blue-200 border-x border-emerald-600/50 shadow-inner">{t('totalSubmits')}</th>
                                        <th className="py-2.5 px-2 text-center text-amber-400">{t('inReview')}</th>
                                        <th className="py-2.5 px-2 text-center text-rose-400">{t('reject')} 1</th>
                                        <th className="py-2.5 px-2 text-center text-rose-300">{t('reject')} 2</th>
                                        <th className="py-2.5 px-2 text-center text-rose-200 font-black bg-rose-950/30">{t('totalLabel')}</th>
                                        <th className="py-2.5 px-2 text-center text-teal-400">{t('success')} 1</th>
                                        <th className="py-2.5 px-2 text-center text-emerald-300">{t('success')} 2</th>
                                        <th className="py-2.5 px-2 text-center text-teal-200 font-black bg-green-300 border-x border-teal-600/50 shadow-inner">{t('totalSuccess')}</th>
                                        <th className="py-2.5 px-2 text-center">{t('actionLabel')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {detailLoading ? (
                                        <tr>
                                            <td colSpan="20" className="text-center py-8 text-slate-400">
                                                <MdOutlineSync className="animate-spin inline-block text-2xl mb-1 text-sky-400" />
                                                <p>{t('loading')}</p>
                                            </td>
                                        </tr>
                                    ) : detailHistoryList.length === 0 ? (
                                        <tr>
                                            <td colSpan="20" className="text-center py-8 text-slate-500 font-medium">
                                                {t('noDetailMetricsDataAddPrompt')} {t('addDetailMetrics')}
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
                                                <td className="py-2 px-2 text-center font-mono text-rose-300">{row.reject2 || 0}</td>
                                                <td className="py-2 px-2 text-center font-mono font-black text-rose-200 bg-rose-950/30 border-x border-rose-700/60">
                                                    {(Number(row.reject) || 0) + (Number(row.reject2) || 0)}
                                                </td>
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
                                                        <FaEdit className="inline mr-1" /> {t('edit')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {detailHistoryList.length > 0 && (
                                    <tfoot className="bg-gray-300 font-bold border-t-2 border-slate-600 text-[11px]">
                                        <tr className="divide-y divide-slate-700">
                                            <td className="py-1 px-3 font-bold text-amber-400 uppercase tracking-wider">{t('total')}</td>
                                            <td className="py-1 px-2 text-center font-mono text-indigo-300 bg-indigo-950/30">{grandDetailTotals.message}</td>
                                            <td className="py-1 px-2 text-center font-mono text-slate-200">{grandDetailTotals.page}</td>
                                            <td className="py-1 px-2 text-center font-mono text-slate-200">{grandDetailTotals.telegram}</td>
                                            <td className="py-1 px-2 text-center font-mono text-slate-200">{grandDetailTotals.noReply}</td>
                                            <td className="py-1 px-2 text-center font-mono text-slate-200">{grandDetailTotals.inquire}</td>
                                            <td className="py-1 px-2 text-center font-mono text-rose-400">{grandDetailTotals.rejectCs}</td>
                                            <td className="py-1 px-2 text-center font-mono text-slate-200">{grandDetailTotals.more}</td>
                                            <td className="py-1 px-2 text-center font-mono text-emerald-400">{grandDetailTotals.pageSubmit}</td>
                                            <td className="py-1 px-2 text-center font-mono text-emerald-400">{grandDetailTotals.telegramSubmit}</td>
                                            <td className="py-1 px-2 text-center font-mono text-emerald-400 font-bold">{grandDetailTotals.call}</td>
                                            <td className="py-1 px-2 text-center font-mono font-black text-emerald-200 bg-blue-300 border-x border-emerald-600 text-xs shadow-inner">
                                                {grandDetailTotals.totalSubmit}
                                            </td>
                                            <td className="py-1 px-2 text-center font-mono text-amber-400">{grandDetailTotals.review}</td>
                                            <td className="py-1 px-2 text-center font-mono text-rose-400">{grandDetailTotals.reject}</td>
                                            <td className="py-1 px-2 text-center font-mono text-rose-300">{grandDetailTotals.reject2}</td>
                                            <td className="py-1 px-2 text-center font-mono font-black text-rose-200 bg-rose-950/30 border-x border-rose-700">
                                                {grandDetailTotals.totalReject}
                                            </td>
                                            <td className="py-1 px-2 text-center font-mono text-teal-400">{grandDetailTotals.success1}</td>
                                            <td className="py-1 px-2 text-center font-mono text-emerald-300">{grandDetailTotals.success2}</td>
                                            <td className="py-1 px-2 text-center font-mono font-black text-teal-200 bg-green-300 border-x border-teal-600 text-xs shadow-inner">
                                                {grandDetailTotals.totalSuccess}
                                            </td>
                                            <td className="py-1 px-2 text-center text-slate-500 font-mono">-</td>
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
                onCreateStatus={handleCreateStatus}
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
                submitList={rejectSubmitFollowUpRows}
                submitLoading={rejectSubmitFollowUpLoading}
                submitError={rejectSubmitFollowUpError}
                onLoadSubmitList={fetchRejectSubmitFollowUpRows}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-xs">
                    <div className="bg-slate-800 border border-slate-700 rounded-[5px] shadow-2xl p-6 max-w-sm w-full text-center">
                        <FaTrashAlt className="text-rose-500 text-3xl mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-100 mb-1">{t('confirmDelete')}</h4>
                        <p className="text-xs text-slate-400 mb-6">
                            {t('dataWillBeDeleted')}: &quot;<span className="text-emerald-400 font-semibold">{deleteModalItem.name}</span>&quot;
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setDeleteModalItem(null)}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-[5px] transition-all cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-[5px] transition-all shadow-md cursor-pointer"
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUp4;
