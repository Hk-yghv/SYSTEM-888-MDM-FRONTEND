import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    FaLayerGroup,
    FaChartLine,
    FaCalendarCheck,
    FaPrint,
    FaCreditCard,
    FaArrowTrendUp,
    FaReceipt,
    FaLock,
    FaLockOpen,
    FaChartArea,
    FaFileContract,
    FaUsers,
    FaClock,
    FaTriangleExclamation,
    FaTableCellsLarge,
    FaImage,
    FaXmark,
    FaCalendarDays
} from 'react-icons/fa6';
import './Dashboard.css';
import { getAutomaticPenalty, getRowWithDueDate, getRowInterest, getContractTotalInterest } from '../../utils/repaymentUtils';

const Dashboard = () => {
    const { t, lang } = useLanguage();
    const { API_BASE, API_BASE1, user } = useAuth();

    // ── Number & Currency Formatting ──
    const formatMoney = (val) => {
        const num = Number(val) || 0;
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatNumber = (val) => {
        return Number(val || 0).toLocaleString('en-US');
    };

    // ── Master Admin Check ──
    const isMasterAdmin = useMemo(() => {
        return user?.username === '@hakyonghouv' || user?.username === 'hakyonghouv' || user?.role === 'Administrator' || user?.isImmutable;
    }, [user]);

    // ── Core API States ──
    const [stats, setStats] = useState({
        totalContracts: 0,
        activatedContracts: 0,
        applicationContracts: 0,
        checkContracts: 0,
        redeemContracts: 0,
        blacklistContracts: 0,
        commentsContracts: 0,
        lockedPhones: 0,
        unlockedPhones: 0,
        lockedWallpapers: 0,
        unlockedWallpapers: 0,
        totalRevenue: 0,
        paymentCount: 0,
        totalLoanAmount: 0,
        totalCustomerReceived: 0,
        totalBorrowers: 0,
        outstandingBalance: 0,
        totalRepaymentExpected: 0,
        totalScheduledRepayment: 0,
        totalPenaltyRepayment: 0,
        totalInterest: 0
    });

    const [brandFilter, setBrandFilter] = useState(() => user?.brand || '');
    const [brandsList, setBrandsList] = useState([]);
    const availableSubBrands = useMemo(() => (
        Array.isArray(user?.subBrands)
            ? [...new Set(user.subBrands.map(value => String(value || '').trim()).filter(Boolean))]
            : []
    ), [user?.subBrands]);
    const [subBrandFilter, setSubBrandFilter] = useState(() => user?.subBrands?.[0] || 'All');
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [rawContracts, setRawContracts] = useState([]);
    const [rawPayments, setRawPayments] = useState([]);
    const [penaltyRulesByBrand, setPenaltyRulesByBrand] = useState({});
    const [lastSyncTime, setLastSyncTime] = useState('');

    // Timeframe Filter State
    const [selectedTimeframe, setSelectedTimeframe] = useState('monthly'); // 'today' | '7d' | '30d' | 'monthly' | 'month_select' | 'all' | 'custom'
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false);
    const [customDateError, setCustomDateError] = useState(null);

    // Overdue Table Filter: 'all' | 'filtered'
    const [lateSectionFilter, setLateSectionFilter] = useState('all');

    // Receipt image preview modal
    const [previewImage, setPreviewImage] = useState(null);

    const popoverRef = useRef(null);

    // Close popover on outside click or Escape
    useEffect(() => {
        if (!isCustomPopoverOpen) return;
        const handleClick = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsCustomPopoverOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsCustomPopoverOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCustomPopoverOpen]);

    // Active Brand Scope
    const activeUserBrand = useMemo(() => {
        if (!isMasterAdmin && user?.brand) return user.brand;
        return brandFilter;
    }, [isMasterAdmin, user, brandFilter]);
    const activeUserSubBrand = availableSubBrands.length > 0
        ? (availableSubBrands.includes(subBrandFilter) || subBrandFilter === 'All'
            ? subBrandFilter
            : availableSubBrands[0])
        : '';

    useEffect(() => {
        setSubBrandFilter(current => (
            current === 'All' || availableSubBrands.includes(current)
                ? current
                : (availableSubBrands[0] || 'All')
        ));
    }, [availableSubBrands]);

    useEffect(() => {
        if (!brandFilter && user?.brand) setBrandFilter(user.brand);
    }, [brandFilter, user?.brand]);

    // Live Clock Update
    useEffect(() => {
        const updateClock = () => {
            if (!reloading) {
                const now = new Date();
                setLastSyncTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
            }
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [reloading]);

    // ── Fetch Brands List ──
    const fetchBrands = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat && Array.isArray(brandCat.items)) {
                    setBrandsList(brandCat.items || []);
                }
            }
        } catch (e) {
            console.error('Fetch brands error:', e);
        }
    };

    // ── Fetch Live Dashboard Stats from Backend API ──
    const fetchDashboardStats = useCallback(async () => {
        setReloading(true);
        try {
            const params = new URLSearchParams();
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');
            if (availableSubBrands.length > 0) params.set('userSubBrands', availableSubBrands.join(','));
            if (activeUserSubBrand) params.set('subBrand', activeUserSubBrand);

            const res = await fetch(`${API_BASE}/dashboard/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 300);
        }
    }, [API_BASE, activeUserBrand, activeUserSubBrand, availableSubBrands, user]);

    // ── Fetch Raw Contracts, Payments, and Penalty Rules ──
    const fetchRawData = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');
            if (availableSubBrands.length > 0) params.set('userSubBrands', availableSubBrands.join(','));
            if (activeUserSubBrand) params.set('subBrand', activeUserSubBrand);
            params.set('limit', '999999');

            const [cRes, pRes] = await Promise.all([
                fetch(`${API_BASE1}/contracts?${params.toString()}`),
                fetch(`${API_BASE1}/payments?${params.toString()}`)
            ]);

            if (cRes.ok) {
                const cData = await cRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                setRawContracts(contracts);

                // Fetch Penalty Rules for all active brands in contracts
                const brands = [...new Set(['', ...contracts.map(contract => String(contract.brand || '').trim())])];
                const ruleEntries = await Promise.all(brands.map(async brand => {
                    try {
                        const configRes = await fetch(`${API_BASE1}/controlsystem?brand=${encodeURIComponent(brand)}`);
                        if (!configRes.ok) return [brand, []];
                        const config = await configRes.json();
                        return [brand, Array.isArray(config?.late_penalty_rules) ? config.late_penalty_rules : []];
                    } catch {
                        return [brand, []];
                    }
                }));
                setPenaltyRulesByBrand(Object.fromEntries(ruleEntries));
            }

            if (pRes.ok) {
                const pData = await pRes.json();
                const payments = pData.data || pData.payments || (Array.isArray(pData) ? pData : []);
                setRawPayments(payments);
            }
        } catch (err) {
            console.error('Failed to fetch raw data:', err);
        }
    }, [API_BASE1, activeUserBrand, activeUserSubBrand, availableSubBrands, user]);

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        fetchDashboardStats();
        fetchRawData();
    }, [fetchDashboardStats, fetchRawData]);

    const handleManualReload = () => {
        fetchDashboardStats();
        fetchRawData();
    };

    // ── Timeframe Descriptions & Unified Range Computation ──
    const monthNames = useMemo(() => Array.from({ length: 12 }, (_, month) => (
        new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month, 1)))
    )), [lang]);

    const dateRange = useMemo(() => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (selectedTimeframe === 'all') {
            return { start: null, end: null, isAll: true };
        }
        if (selectedTimeframe === 'today') {
            return { start: todayStr, end: todayStr, isAll: false };
        }
        if (selectedTimeframe === '7d') {
            const d = new Date(today);
            d.setDate(d.getDate() - 7);
            return { start: d.toISOString().split('T')[0], end: todayStr, isAll: false };
        }
        if (selectedTimeframe === '30d') {
            const d = new Date(today);
            d.setDate(d.getDate() - 30);
            return { start: d.toISOString().split('T')[0], end: todayStr, isAll: false };
        }
        if (selectedTimeframe === 'monthly') {
            const curY = today.getFullYear();
            const curM = today.getMonth() + 1;
            const lastDay = new Date(curY, curM, 0).getDate();
            const start = `${curY}-${String(curM).padStart(2, '0')}-01`;
            const end = `${curY}-${String(curM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start, end, isAll: false, month: curM, year: curY };
        }
        if (selectedTimeframe === 'month_select') {
            const m = Number(selectedMonth) || (today.getMonth() + 1);
            const y = Number(selectedYear) || today.getFullYear();
            const lastDay = new Date(y, m, 0).getDate();
            const start = `${y}-${String(m).padStart(2, '0')}-01`;
            const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start, end, isAll: false, month: m, year: y };
        }
        if (selectedTimeframe === 'custom') {
            if (customStartDate && customEndDate) {
                return { start: customStartDate, end: customEndDate, isAll: false };
            }
            return { start: null, end: null, isAll: true };
        }
        return { start: null, end: null, isAll: true };
    }, [selectedTimeframe, selectedMonth, selectedYear, customStartDate, customEndDate]);

    const isDateInRange = (dateStr, range) => {
        if (!range || range.isAll || !range.start || !range.end) return true;
        if (!dateStr) return false;
        const d = String(dateStr).split('T')[0];
        return d >= range.start && d <= range.end;
    };

    const timeframeLabel = useMemo(() => {
        switch (selectedTimeframe) {
            case 'today': return `${t('today')} (${new Date().toISOString().split('T')[0]})`;
            case '7d': return t('dashboardLast7Days');
            case '30d': return t('dashboardLast30Days');
            case 'all': return t('dashboardAllTime');
            case 'month_select':
                return `${monthNames[(selectedMonth || 1) - 1]} ${selectedYear}`;
            case 'custom':
                if (customStartDate && customEndDate) {
                    return `${customStartDate} ${t('to')} ${customEndDate}`;
                }
                return t('dashboardCustomDateRange');
            case 'monthly':
            default:
                return `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;
        }
    }, [t, monthNames, selectedTimeframe, selectedMonth, selectedYear, customStartDate, customEndDate]);

    // ── Filter Contracts by Timeframe (Matching Loan Date or Installment Due Date) ──
    const filteredContracts = useMemo(() => {
        if (!rawContracts || rawContracts.length === 0) return [];
        const scopedContracts = rawContracts.filter(contract => {
            if (activeUserBrand && String(contract.brand || '').trim().toLowerCase() !== activeUserBrand.toLowerCase()) return false;
            if (activeUserSubBrand && activeUserSubBrand !== 'All' && contract.subBrand !== activeUserSubBrand) return false;
            return true;
        });
        if (dateRange.isAll) return scopedContracts;

        return scopedContracts.filter(c => {
            const cDate = String(c.inputDate || c.date || c.createdAt || '').split('T')[0];
            const isContractDateMatch = cDate ? isDateInRange(cDate, dateRange) : false;

            const schedule = Array.isArray(c.repaymentSchedule) ? c.repaymentSchedule : [];
            const isScheduleMatch = schedule.some(row => {
                const due = row.dueDate ? String(row.dueDate).split('T')[0] : '';
                const paid = row.paidDate ? String(row.paidDate).split('T')[0] : '';
                return (due && isDateInRange(due, dateRange)) || (paid && isDateInRange(paid, dateRange));
            });

            return isContractDateMatch || isScheduleMatch;
        });
    }, [rawContracts, dateRange, activeUserBrand, activeUserSubBrand]);

    // ── Filter Payments by Timeframe ──
    const filteredPayments = useMemo(() => {
        if (!rawPayments || rawPayments.length === 0) return [];
        if (dateRange.isAll) return rawPayments;

        return rawPayments.filter(p => {
            const dateStr = String(p.paidDate || p.date || p.createdAt || '').split('T')[0];
            return isDateInRange(dateStr, dateRange);
        });
    }, [rawPayments, dateRange]);

    // ── Contract Statuses Pipeline Metrics (Filtered) ──
    const totalCount = filteredContracts.length || 0;
    const activatedCount = filteredContracts.filter(c => c.status === 'Activated' || c.status === 'ដំណើរការ').length;
    const applicationCount = filteredContracts.filter(c => c.status === 'Application' || c.status === 'ពាក្យស្នើសុំ').length;
    const checkCount = filteredContracts.filter(c => c.status === 'Check' || c.status === 'កំពុងត្រួតពិនិត្យ').length;
    const redeemCount = filteredContracts.filter(c => c.status === 'Redeem' || c.status === 'បញ្ចាំ/ដោះដូរ').length;
    const blacklistCount = filteredContracts.filter(c => c.status === 'Blacklist' || c.status === 'BlackList' || c.status === 'បញ្ជីខ្មៅ').length;

    const safeTotalCount = totalCount > 0 ? totalCount : 1;
    const activatedPct = ((activatedCount / safeTotalCount) * 100).toFixed(2);
    const applicationPct = ((applicationCount / safeTotalCount) * 100).toFixed(2);
    const checkPct = ((checkCount / safeTotalCount) * 100).toFixed(2);
    const redeemPct = ((redeemCount / safeTotalCount) * 100).toFixed(2);
    const blacklistPct = ((blacklistCount / safeTotalCount) * 100).toFixed(2);

    const lockedPhones = filteredContracts.filter(c => c.lockPhoneStatus === 'Locked').length;
    const unlockedPhones = Math.max(0, totalCount - lockedPhones);
    const lockedRatio = totalCount > 0 ? ((lockedPhones / totalCount) * 100).toFixed(2) : '0.00';
    const unlockedRatio = (100 - Number(lockedRatio)).toFixed(2);

    // ── Installment Helpers ──
    const getActiveRowIdx = (schedule = []) => {
        const payOffIdx = schedule.findIndex(r => r.status === 'PayOff');
        if (payOffIdx !== -1) return -1;
        return schedule.findIndex(r => r.status === 'Pending' || r.status === 'Saved' || r.status === 'Due' || !r.status);
    };

    const getDisplayRow = (schedule = [], selectedIdx = null) => {
        if (!schedule.length) return null;
        if (selectedIdx !== null && schedule[selectedIdx]) return schedule[selectedIdx];
        const idx = getActiveRowIdx(schedule);
        return idx === -1 ? schedule[schedule.length - 1] : schedule[idx];
    };

    // ── Installment Financial Calculations (Strictly Filter-based) ──
    const installmentStats = useMemo(() => {
        let totalPrincipal = 0;
        let totalCollectedFromInstallment = 0;
        let totalScheduledFromInstallment = 0;
        let totalPenaltyFromInstallment = 0;
        let totalPaidInstallmentsCount = 0;
        let totalScheduledInterest = 0;
        let totalCollectedInterest = 0;
        let totalOutstandingInterest = 0;

        filteredContracts.forEach(contract => {
            const cDate = String(contract.inputDate || contract.date || contract.createdAt || '').split('T')[0];
            const isContractInTimeframe = isDateInRange(cDate, dateRange);

            if (dateRange.isAll || isContractInTimeframe) {
                const principal = Number(contract.amount || contract.loanAmount || contract.totalAmount || 0);
                totalPrincipal += principal;
            }

            const rules = penaltyRulesByBrand[String(contract.brand || '').trim()] || [];
            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];

            if (schedule.length > 0) {
                schedule.forEach(row => {
                    const rowData = getRowWithDueDate(row, contract);
                    const penalty = getAutomaticPenalty(rowData, contract, rules);
                    const schedAmt = Number(rowData.scheduledAmount || rowData.amount || 0);
                    const paidAmt = Number(rowData.paidAmount || rowData.paid || 0);
                    const rowInterest = getRowInterest(rowData, contract);

                    const dueStr = rowData.dueDate ? String(rowData.dueDate).split('T')[0] : '';
                    const paidStr = rowData.paidDate ? String(rowData.paidDate).split('T')[0] : '';

                    const isDueInRange = isDateInRange(dueStr, dateRange);
                    const isPaidInRange = paidStr ? isDateInRange(paidStr, dateRange) : isDueInRange;

                    const isRowPaid = ['Paid', 'PayOff', 'Settled'].includes(rowData.status) || (paidAmt >= schedAmt && schedAmt > 0);
                    const paidInterest = isRowPaid
                        ? rowInterest
                        : (schedAmt > 0 ? (rowInterest * Math.min(paidAmt, schedAmt)) / schedAmt : 0);
                    const unpaidInterest = Math.max(0, rowInterest - paidInterest);

                    if (dateRange.isAll || isDueInRange) {
                        totalScheduledFromInstallment += schedAmt;
                        totalPenaltyFromInstallment += Number(penalty || 0);
                        totalScheduledInterest += rowInterest;
                        totalOutstandingInterest += unpaidInterest;
                    }

                    if (dateRange.isAll || isPaidInRange) {
                        totalCollectedFromInstallment += paidAmt;
                        totalCollectedInterest += paidInterest;
                        if (paidAmt > 0) {
                            totalPaidInstallmentsCount += 1;
                        }
                    }
                });
            } else {
                if (dateRange.isAll || isContractInTimeframe) {
                    const monthlyPayment = Number(contract.monthlyPayment || 0);
                    const durationMatch = String(contract.duration || '').match(/\d+/);
                    const months = durationMatch ? Math.max(1, Number(durationMatch[0])) : 1;
                    const contractInterest = getContractTotalInterest(contract);
                    const schedAmt = monthlyPayment > 0 ? (monthlyPayment * months) : (Number(contract.amount || 0) + contractInterest);
                    const paidAmt = Number(contract.paidAmount || 0);

                    totalScheduledFromInstallment += schedAmt;
                    totalScheduledInterest += contractInterest;

                    const paidInterest = schedAmt > 0 ? (contractInterest * Math.min(paidAmt, schedAmt)) / schedAmt : 0;
                    const unpaidInterest = Math.max(0, contractInterest - paidInterest);

                    totalCollectedFromInstallment += paidAmt;
                    totalCollectedInterest += paidInterest;
                    totalOutstandingInterest += unpaidInterest;
                    if (paidAmt > 0) {
                        totalPaidInstallmentsCount += 1;
                    }
                }
            }
        });

        const totalPayableScheduled = totalScheduledFromInstallment + totalPenaltyFromInstallment;
        const totalOutstanding = Math.max(0, totalPayableScheduled - totalCollectedFromInstallment);

        return {
            totalPrincipal,
            totalCollectedFromInstallment,
            totalScheduledFromInstallment,
            totalPenaltyFromInstallment,
            totalPayableScheduled,
            totalOutstanding,
            totalPaidInstallmentsCount,
            totalScheduledInterest,
            totalCollectedInterest,
            totalOutstandingInterest
        };
    }, [filteredContracts, penaltyRulesByBrand, dateRange]);

    // Active Installment Rows extracted directly from each contract's installment schedule (Filtered by dateRange)
    const installmentCustomerRows = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const rows = [];
        rawContracts.forEach((contract) => {
            const contractBrand = String(contract.brand || '').trim();
            if (activeUserBrand && contractBrand.toLowerCase() !== activeUserBrand.toLowerCase()) {
                return;
            }
            if (activeUserSubBrand && activeUserSubBrand !== 'All' && contract.subBrand !== activeUserSubBrand) {
                return;
            }

            const rules = penaltyRulesByBrand[contractBrand] || [];
            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];
            if (schedule.length === 0) return;

            const nameEn = contract.customerNameEn || contract.customerName || contract.name || contract.clientName || '';
            const nameKh = contract.customerNameKh || contract.nameKh || '';
            const phone = contract.phone || contract.phoneNumber || contract.tel || contract.clientPhone || contract.contactNumber || '-';

            if (dateRange.isAll) {
                // If All Time: extract the currently active pending/due/saved row
                const activeIdx = getActiveRowIdx(schedule);
                const displayRow = getDisplayRow(schedule, activeIdx === -1 ? null : activeIdx);
                if (!displayRow) return;

                const rowData = getRowWithDueDate(displayRow, contract);
                const scheduledAmt = Number(rowData.scheduledAmount || rowData.amount || rowData.due || 0);
                const paidAmt = Number(rowData.paidAmount || rowData.paid || 0);
                const unpaidAmt = Math.max(0, scheduledAmt - paidAmt);
                const isPaid = ['Paid', 'PayOff', 'Settled'].includes(rowData.status) || (unpaidAmt <= 0 && scheduledAmt > 0);
                const dueDateStr = rowData.dueDate ? String(rowData.dueDate).split('T')[0] : '';
                const paidDateStr = rowData.paidDate ? String(rowData.paidDate).split('T')[0] : '';

                let diffDays = null;
                let lateDays = 0;
                if (dueDateStr) {
                    const dueDateObj = new Date(`${dueDateStr}T00:00:00`);
                    if (!isNaN(dueDateObj.getTime())) {
                        if (isPaid && paidDateStr) {
                            const paidDateObj = new Date(`${paidDateStr}T00:00:00`);
                            if (!isNaN(paidDateObj.getTime())) {
                                const diff = Math.round((paidDateObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
                                if (diff > 0) lateDays = diff;
                            }
                        } else {
                            diffDays = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                                lateDays = Math.abs(diffDays);
                            }
                        }
                    }
                }

                let calculatedPenalty = 0;
                if (isPaid) {
                    if (Number(rowData.penalty || 0) > 0) {
                        calculatedPenalty = Number(rowData.penalty);
                    } else if (lateDays > 0) {
                        calculatedPenalty = getAutomaticPenalty({ ...rowData, status: 'Due' }, contract, rules);
                    }
                } else {
                    calculatedPenalty = getAutomaticPenalty(rowData, contract, rules);
                }

                const paidPenalty = isPaid ? calculatedPenalty : 0;
                const unpaidPenalty = isPaid ? 0 : calculatedPenalty;
                const isOverdue = !isPaid && (lateDays > 0 || unpaidPenalty > 0 || (dueDateStr && dueDateStr < todayStr));

                rows.push({
                    id: `${contract._id || contract.id || 'c'}-${rowData.monthIndex || (activeIdx !== -1 ? activeIdx + 1 : 1)}`,
                    contractId: contract._id || contract.id,
                    contractIid: contract.contractIid || contract.contractId || contract.contractNo || contract.code || (contract._id ? String(contract._id).slice(-6) : `CT-${rows.length + 1}`),
                    customerNameEn: nameEn,
                    customerNameKh: nameKh,
                    customerName: nameKh || nameEn || 'Unknown',
                    phone: phone,
                    dueDate: dueDateStr,
                    paidDate: paidDateStr,
                    scheduledAmount: scheduledAmt,
                    paidAmount: paidAmt,
                    outstandingAmount: unpaidAmt,
                    penaltyAmount: calculatedPenalty,
                    paidPenaltyAmount: paidPenalty,
                    unpaidPenaltyAmount: unpaidPenalty,
                    interestAmount: getRowInterest(rowData, contract),
                    isPaid,
                    daysUntilDue: diffDays,
                    lateDays,
                    isOverdue,
                    monthIndex: rowData.monthIndex || (activeIdx !== -1 ? activeIdx + 1 : schedule.length),
                    monthLabel: rowData.labelName || `Month ${rowData.monthIndex || (activeIdx !== -1 ? activeIdx + 1 : schedule.length)}`,
                    status: isPaid ? 'PAID' : (isOverdue ? 'OVERDUE' : (diffDays === 0 ? 'DUE_TODAY' : 'DUE')),
                    brand: contract.brand || 'MDM'
                });
            } else {
                // If a specific timeframe/range is selected (today, 7d, monthly, month_select, custom):
                // Find all schedule rows whose dueDate falls within the selected dateRange
                schedule.forEach((row, rIdx) => {
                    const rowData = getRowWithDueDate(row, contract);
                    const dueDateStr = rowData.dueDate ? String(rowData.dueDate).split('T')[0] : '';
                    const paidDateStr = rowData.paidDate ? String(rowData.paidDate).split('T')[0] : '';

                    const isDueDateInRange = isDateInRange(dueDateStr, dateRange);
                    const isPaidDateInRange = paidDateStr ? isDateInRange(paidDateStr, dateRange) : false;

                    // Match if either dueDate or paidDate is within the selected range
                    if (!isDueDateInRange && !isPaidDateInRange) return;

                    const scheduledAmt = Number(rowData.scheduledAmount || rowData.amount || rowData.due || 0);
                    const paidAmt = Number(rowData.paidAmount || rowData.paid || 0);
                    const unpaidAmt = Math.max(0, scheduledAmt - paidAmt);
                    const isPaid = ['Paid', 'PayOff', 'Settled'].includes(rowData.status) || (unpaidAmt <= 0 && scheduledAmt > 0);

                    let diffDays = null;
                    let lateDays = 0;
                    if (dueDateStr) {
                        const dueDateObj = new Date(`${dueDateStr}T00:00:00`);
                        if (!isNaN(dueDateObj.getTime())) {
                            if (isPaid && paidDateStr) {
                                const paidDateObj = new Date(`${paidDateStr}T00:00:00`);
                                if (!isNaN(paidDateObj.getTime())) {
                                    const diff = Math.round((paidDateObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diff > 0) lateDays = diff;
                                }
                            } else {
                                diffDays = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) {
                                    lateDays = Math.abs(diffDays);
                                }
                            }
                        }
                    }

                    let calculatedPenalty = 0;
                    if (isPaid) {
                        if (Number(rowData.penalty || 0) > 0) {
                            calculatedPenalty = Number(rowData.penalty);
                        } else if (lateDays > 0) {
                            calculatedPenalty = getAutomaticPenalty({ ...rowData, status: 'Due' }, contract, rules);
                        }
                    } else {
                        calculatedPenalty = getAutomaticPenalty(rowData, contract, rules);
                    }

                    const paidPenalty = isPaid ? calculatedPenalty : 0;
                    const unpaidPenalty = isPaid ? 0 : calculatedPenalty;
                    const isOverdue = !isPaid && (lateDays > 0 || unpaidPenalty > 0 || (dueDateStr && dueDateStr < todayStr));

                    rows.push({
                        id: `${contract._id || contract.id || 'c'}-${rowData.monthIndex || rIdx + 1}`,
                        contractId: contract._id || contract.id,
                        contractIid: contract.contractIid || contract.contractId || contract.contractNo || contract.code || (contract._id ? String(contract._id).slice(-6) : `CT-${rows.length + 1}`),
                        customerNameEn: nameEn,
                        customerNameKh: nameKh,
                        customerName: nameKh || nameEn || 'Unknown',
                        phone: phone,
                        dueDate: dueDateStr,
                        paidDate: paidDateStr,
                        scheduledAmount: scheduledAmt,
                        paidAmount: paidAmt,
                        outstandingAmount: unpaidAmt,
                        penaltyAmount: calculatedPenalty,
                        paidPenaltyAmount: paidPenalty,
                        unpaidPenaltyAmount: unpaidPenalty,
                        interestAmount: getRowInterest(rowData, contract),
                        isPaid,
                        daysUntilDue: diffDays,
                        lateDays,
                        isOverdue,
                        monthIndex: rowData.monthIndex || rIdx + 1,
                        monthLabel: rowData.labelName || `Month ${rowData.monthIndex || rIdx + 1}`,
                        status: isPaid ? 'PAID' : (isOverdue ? 'OVERDUE' : (diffDays === 0 ? 'DUE_TODAY' : 'DUE')),
                        brand: contract.brand || 'MDM'
                    });
                });
            }
        });

        return rows;
    }, [rawContracts, activeUserBrand, activeUserSubBrand, penaltyRulesByBrand, dateRange]);

    // Active customer payment details for the tables
    const dueCustomerRows = useMemo(() => {
        return installmentCustomerRows
            .filter(r => r.scheduledAmount > 0)
            .sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            });
    }, [installmentCustomerRows]);

    const overdueCustomerRows = useMemo(() => {
        return installmentCustomerRows
            .filter(r => r.isOverdue)
            .sort((a, b) => {
                if (b.lateDays !== a.lateDays) return b.lateDays - a.lateDays;
                if (b.penaltyAmount !== a.penaltyAmount) return b.penaltyAmount - a.penaltyAmount;
                return (a.dueDate || '').localeCompare(b.dueDate || '');
            });
    }, [installmentCustomerRows]);

    // Penalty payment records from filtered payments
    const penaltyPaymentRows = useMemo(() => {
        const pRows = [];
        filteredPayments.forEach((p, idx) => {
            const isPenalty = p.type === 'penalty' || p.category === 'Penalty' || String(p.description || '').toLowerCase().includes('penalty') || String(p.description || '').toLowerCase().includes('ពិន័យ');
            if (isPenalty || Number(p.penaltyAmount || 0) > 0) {
                const singleImg = p.photo || p.image || p.receiptImage || (Array.isArray(p.paymentImages) && p.paymentImages[0]) || null;
                pRows.push({
                    id: p._id || p.id || `p-${idx}`,
                    dueDate: p.paidDate ? String(p.paidDate).split('T')[0] : (p.date ? String(p.date).split('T')[0] : new Date().toISOString().split('T')[0]),
                    paymentMethod: p.paymentMethod || p.method || 'Cash',
                    category: p.customerName || p.customer || p.category || 'ពិន័យយឺត',
                    penaltyAmount: Number(p.penaltyAmount || p.amount || 0),
                    description: p.description || p.notes || 'ការទូទាត់ប្រាក់ពិន័យ',
                    photoUrl: singleImg
                });
            }
        });
        return pRows;
    }, [filteredPayments]);

    // ── Live KPI Financial Totals (Filter-based) ──
    const totalDisbursedAmount = installmentStats.totalPrincipal;
    const totalCollectedRevenue = installmentStats.totalCollectedFromInstallment;
    const totalScheduledAmount = installmentStats.totalPayableScheduled;
    const totalPenaltyAmount = installmentStats.totalPenaltyFromInstallment;
    const totalObligation = totalScheduledAmount;
    const totalOutstandingAmount = installmentStats.totalOutstanding;
    const totalPaidInstallmentsCount = installmentStats.totalPaidInstallmentsCount;
    const totalScheduledInterest = installmentStats.totalScheduledInterest;
    const totalCollectedInterest = installmentStats.totalCollectedInterest;
    const totalOutstandingInterest = installmentStats.totalOutstandingInterest;

    // Section Summary Totals
    const dueTotalPaid = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.paidAmount, 0), [dueCustomerRows]);
    const dueTotalRemaining = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.outstandingAmount + r.unpaidPenaltyAmount, 0), [dueCustomerRows]);
    const dueTotalPenalty = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.penaltyAmount, 0), [dueCustomerRows]);
    const dueTotalPaidPenalty = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.paidPenaltyAmount, 0), [dueCustomerRows]);
    const dueTotalUnpaidPenalty = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.unpaidPenaltyAmount, 0), [dueCustomerRows]);
    const dueTotalInterest = useMemo(() => dueCustomerRows.reduce((s, r) => s + (r.interestAmount || 0), 0), [dueCustomerRows]);

    const lateTotalPenalty = useMemo(() => overdueCustomerRows.reduce((s, r) => s + r.unpaidPenaltyAmount, 0), [overdueCustomerRows]);
    const penaltyTotalAmount = useMemo(() => penaltyPaymentRows.reduce((s, r) => s + r.penaltyAmount, 0), [penaltyPaymentRows]);

    // Strictly calculate penalty metrics from the Due Customers Table (តារាងភ្ញៀវត្រូវបង់)
    const totalPaidPenalty = useMemo(() => dueTotalPaidPenalty, [dueTotalPaidPenalty]);
    const totalUnpaidPenalty = useMemo(() => dueTotalUnpaidPenalty, [dueTotalUnpaidPenalty]);
    const totalPenaltyAll = useMemo(() => dueTotalPenalty, [dueTotalPenalty]);

    const totalOverdueAlertCount = overdueCustomerRows.length;

    // ── Dynamic Chart Data Points ──
    // ── Dynamic Chart Data Points (From Real Database Records) ──
    const chartPoints = useMemo(() => {
        const pointsMap = {};
        const today = new Date();

        if (selectedTimeframe === 'today') {
            const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
            hours.forEach(h => {
                pointsMap[h] = { label: h, collected: 0, disbursed: 0, customers: 0 };
            });
            const todayStr = today.toISOString().split('T')[0];

            filteredContracts.forEach(c => {
                const dateStr = String(c.date || c.createdAt || c.inputDate || '');
                if (dateStr.startsWith(todayStr)) {
                    const cDate = new Date(dateStr);
                    const hour = isNaN(cDate.getTime()) ? 12 : cDate.getHours();
                    const matchedHour = hours.reduce((closest, h) => {
                        const hNum = parseInt(h.split(':')[0], 10);
                        return Math.abs(hNum - hour) < Math.abs(parseInt(closest.split(':')[0], 10) - hour) ? h : closest;
                    }, '12:00');
                    if (pointsMap[matchedHour]) {
                        pointsMap[matchedHour].disbursed += Number(c.amount || c.loanAmount || c.totalAmount || 0);
                        pointsMap[matchedHour].customers += 1;
                    }
                }
            });

            filteredPayments.forEach(p => {
                const dateStr = String(p.paidDate || p.date || p.createdAt || '');
                if (dateStr.startsWith(todayStr)) {
                    const pDate = new Date(dateStr);
                    const hour = isNaN(pDate.getTime()) ? 12 : pDate.getHours();
                    const matchedHour = hours.reduce((closest, h) => {
                        const hNum = parseInt(h.split(':')[0], 10);
                        return Math.abs(hNum - hour) < Math.abs(parseInt(closest.split(':')[0], 10) - hour) ? h : closest;
                    }, '12:00');
                    if (pointsMap[matchedHour]) {
                        pointsMap[matchedHour].collected += Number(p.amount || 0);
                    }
                }
            });
        } else if (selectedTimeframe === '7d' || selectedTimeframe === '30d' || selectedTimeframe === 'monthly' || selectedTimeframe === 'custom') {
            const numDays = selectedTimeframe === '7d' ? 7 : (selectedTimeframe === '30d' ? 30 : (selectedTimeframe === 'monthly' ? 30 : 14));
            for (let i = numDays - 1; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                const label = `${d.getDate()}/${d.getMonth() + 1}`;
                pointsMap[dStr] = { label, collected: 0, disbursed: 0, customers: 0 };
            }

            filteredContracts.forEach(c => {
                const cDate = String(c.date || c.createdAt || c.inputDate || '').split('T')[0];
                if (pointsMap[cDate]) {
                    pointsMap[cDate].disbursed += Number(c.amount || c.loanAmount || c.totalAmount || 0);
                    pointsMap[cDate].customers += 1;
                }
            });

            filteredPayments.forEach(p => {
                const pDate = String(p.paidDate || p.date || p.createdAt || '').split('T')[0];
                if (pointsMap[pDate]) {
                    pointsMap[pDate].collected += Number(p.amount || 0);
                }
            });
        } else {
            // 'all' -> Group by months
            const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            const curYear = today.getFullYear();
            months.forEach(m => {
                const mKey = `${curYear}-${m}`;
                pointsMap[mKey] = { label: `${m}/${curYear.toString().slice(-2)}`, collected: 0, disbursed: 0, customers: 0 };
            });

            filteredContracts.forEach(c => {
                const cMonth = String(c.date || c.createdAt || c.inputDate || '').slice(0, 7);
                if (pointsMap[cMonth]) {
                    pointsMap[cMonth].disbursed += Number(c.amount || c.loanAmount || c.totalAmount || 0);
                    pointsMap[cMonth].customers += 1;
                }
            });

            filteredPayments.forEach(p => {
                const pMonth = String(p.paidDate || p.date || p.createdAt || '').slice(0, 7);
                if (pointsMap[pMonth]) {
                    pointsMap[pMonth].collected += Number(p.amount || 0);
                }
            });
        }

        return Object.values(pointsMap);
    }, [selectedTimeframe, filteredContracts, filteredPayments]);

    // Handle Custom Popover Shortcut
    const handleApplyDatePreset = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        const sStr = start.toISOString().split('T')[0];
        const eStr = end.toISOString().split('T')[0];
        setCustomStartDate(sStr);
        setCustomEndDate(eStr);
        setCustomDateError(null);
        setSelectedTimeframe('custom');
        setIsCustomPopoverOpen(false);
    };

    const handleApplyMonthPreset = (m, y) => {
        setSelectedMonth(Number(m));
        setSelectedYear(Number(y));
        setSelectedTimeframe('month_select');
        setCustomDateError(null);
        setIsCustomPopoverOpen(false);
    };

    const handleApplyCustomDateRange = () => {
        if (!customStartDate || !customEndDate) {
            setCustomDateError(t('dashboardSelectDateRangeError'));
            return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
            setCustomDateError(t('dashboardDateRangeOrderError'));
            return;
        }
        setCustomDateError(null);
        setIsCustomPopoverOpen(false);
        setSelectedTimeframe('custom');
    };

    const handlePrint = () => {
        const printEl = document.getElementById('dashboard-print-area');
        if (!printEl) {
            window.print();
            return;
        }

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(el => el.outerHTML)
            .join('\n');

        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', `${t('dashboard')} ${t('dashboardPrintReport')}`);
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${t('dashboard')} ${t('report')}</title>
                ${styles}
                <style>
                    @page {
                        size: landscape;
                        margin: 8mm 6mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        font-family: 'KhmerAuto', sans-serif !important;
                        width: 100% !important;
                        height: auto !important;
                    }
                    #dashboard-print-area {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 4px 0 !important;
                        background: #ffffff !important;
                    }
                    .executive-kpi-grid {
                        display: grid !important;
                        grid-template-columns: repeat(4, 1fr) !important;
                        gap: 8px !important;
                        margin-bottom: 12px !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .exec-card {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #ffffff !important;
                        padding: 10px 12px !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .middle-dashboard-row {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 12px !important;
                        margin-bottom: 12px !important;
                        page-break-inside: auto;
                        break-inside: auto;
                    }
                    .chart-card {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #ffffff !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 10px !important;
                    }
                    .customer-payment-card,
                    .payment-section {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #ffffff !important;
                        margin-bottom: 14px !important;
                        page-break-inside: auto;
                        break-inside: auto;
                        overflow: visible !important;
                    }
                    .payment-section-header {
                        background: #f1f5f9 !important;
                        border-bottom: 1px solid #cbd5e1 !important;
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    .payment-filter-select,
                    .btn-action,
                    .mobile-table-hint,
                    .receipt-preview-button {
                        display: none !important;
                    }
                    .table-container,
                    .table-responsive {
                        overflow: visible !important;
                        max-height: none !important;
                        height: auto !important;
                        border: none !important;
                    }
                    .analytics-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto;
                        break-inside: auto;
                    }
                    .analytics-table thead {
                        display: table-header-group !important;
                    }
                    .analytics-table th {
                        background: #e2e8f0 !important;
                        color: #0f172a !important;
                        border: 1px solid #cbd5e1 !important;
                        font-weight: 700 !important;
                        padding: 6px 8px !important;
                    }
                    .analytics-table td {
                        border: 1px solid #e2e8f0 !important;
                        padding: 5px 8px !important;
                        color: #1e293b !important;
                    }
                    .analytics-table tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .brand-summary-section {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #ffffff !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-top: 12px !important;
                    }
                    .brand-card-grid {
                        display: grid !important;
                        grid-template-columns: repeat(4, 1fr) !important;
                        gap: 8px !important;
                        overflow: visible !important;
                    }
                    .brand-item-card {
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                </style>
            </head>
            <body>
                <div id="dashboard-print-area">
                    ${printEl.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Print failed', err);
            }
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }, 3000);
        }, 400);
    };

    return (
        <main className="dashboard-root select-none" data-allow-scroll="true">
            {/* ── Executive Header ── */}
            <header className="executive-header">
                {/* Top Ticker Row */}
                <div className="top-ticker-row">
                    <div className="top-ticker-bar-top">
                        <div className="brand-title">
                            <div className="brand-badge-icon">
                                <FaLayerGroup />
                            </div>
                            <h1>{activeUserBrand ? `SYSTEM ${activeUserBrand.toUpperCase()}` : 'SYSTEM 888MDM'}</h1>
                        </div>

                        <div className="top-user-actions">
                            {/* Brand Filter for Master Admin */}
                            {isMasterAdmin && brandsList.length > 0 && (
                                <select
                                    value={brandFilter}
                                    onChange={(e) => setBrandFilter(e.target.value)}
                                    className="brand-filter-select desktop-only"
                                >
                                    <option value="">{t('allBrands')}</option>
                                    {brandsList.map((b, i) => (
                                        <option key={i} value={typeof b === 'string' ? b : b.name || ''}>
                                            {typeof b === 'string' ? b : b.name || ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {availableSubBrands.length > 1 && (
                                <select
                                    value={activeUserSubBrand}
                                    onChange={(e) => setSubBrandFilter(e.target.value)}
                                    className="brand-filter-select"
                                    aria-label={t('subBrand')}
                                >
                                    <option value="All">{t('all')}</option>
                                    {availableSubBrands.map(subBrand => (
                                        <option key={subBrand} value={subBrand}>{subBrand}</option>
                                    ))}
                                </select>
                            )}

                            {/* Overdue Alert Chip */}
                            {totalOverdueAlertCount > 0 && (
                                <div className="system-alert-chip" title={`${t('dashboardOverdueAlertTitle')} ${totalOverdueAlertCount}`}>
                                    <FaTriangleExclamation />
                                    <span>{t('overdueCustomers')}: <strong>{totalOverdueAlertCount}</strong></span>
                                </div>
                            )}

                            {/* Live System Status Chip */}
                            <div className="system-status-chip">
                                <div className="status-live-indicator">
                                    <span className="live-status-dot"></span>
                                    <span className="status-text desktop-only">{t('dashboardSystemHealthy')}</span>
                                    <span className="status-text mobile-only">{t('online')}</span>
                                </div>
                                <span className="status-divider desktop-only">·</span>
                                <div className="sync-time-box desktop-only">
                                    <FaClock />
                                    <span>{t('dashboardLastUpdated')}: {lastSyncTime || t('now')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Header Bar */}
                <div className="header-main-bar">
                    <div className="header-info-col">
                        <div className="title-with-badge">
                            <div className="header-icon-box">
                                <FaChartLine />
                            </div>
                            <div className="title-text-group">
                                <h2>{t('dashboard')}</h2>
                            </div>
                        </div>
                        <div className="header-desc-row">
                            <p className="header-desc">{t('dashboardDescription')}</p>
                            <span className="desc-timeframe-tag">
                                <FaCalendarCheck /> {timeframeLabel}
                            </span>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button
                            type="button"
                            className="btn-action btn-print"
                            title={t('dashboardPrintReport')}
                            onClick={handlePrint}
                        >
                            <FaPrint />
                            <span>{t('dashboardPrintReport')}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Printable Content Area (Starts at Page 1, No Blank Headers) ── */}
            <div id="dashboard-print-area" className="dashboard-content-body">
                {/* ── Executive KPI Grid ── */}
                <div className="executive-kpi-grid">
                    {/* Card 1: Disbursed */}
                    <div className="exec-card card-disbursed">
                        <div className="exec-card-header">
                            <span className="card-label">{t('dashboardTotalDisbursed')}</span>
                            <div className="exec-card-icon icon-blue">
                                <FaCreditCard />
                            </div>
                        </div>
                        <div className="card-value">{formatMoney(totalDisbursedAmount)}</div>
                        <div className="exec-card-footer">
                            <div className="stacked-stat">
                                <span>{t('dashboardCustomers')}: <strong>{formatNumber(activatedCount)} {t('people')}</strong></span>
                                <span>{t('totalCustomers')}: <strong>{formatNumber(totalCount)} {t('people')}</strong></span>
                                <span>{t('dashboardTotalLoans')}: <strong>{formatMoney(totalDisbursedAmount)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Collected */}
                    <div className="exec-card card-collected">
                        <div className="exec-card-header">
                            <span className="card-label">{t('dashboardTotalCollected')}</span>
                            <div className="exec-card-icon icon-green">
                                <FaArrowTrendUp />
                            </div>
                        </div>
                        <div className="card-value color-green">{formatMoney(totalCollectedRevenue)}</div>
                        <div className="exec-card-footer">
                            <div className="stacked-stat">
                                <span>{t('dashboardPaymentsMade')}: <strong>{formatNumber(totalPaidInstallmentsCount)} {t('dashboardPaymentsCount')}</strong></span>
                                <span>{t('dashboardInterestCollected')}: <strong className="color-green">{formatMoney(totalCollectedInterest)}</strong></span>
                                <span>{t('dashboardCollectionRate')}: <strong>{totalDisbursedAmount > 0 ? ((totalCollectedRevenue / totalDisbursedAmount) * 100).toFixed(2) : '0.00'}%</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Scheduled */}
                    <div className="exec-card card-scheduled">
                        <div className="exec-card-header">
                            <span className="card-label">{t('dashboardTotalScheduled')}</span>
                            <div className="exec-card-icon icon-purple">
                                <FaReceipt />
                            </div>
                        </div>
                        <div className="card-value color-purple">{formatMoney(totalScheduledAmount)}</div>
                        <div className="exec-card-footer split-footer">
                            <div className="stacked-stat">
                                <span>{t('dashboardInterestScheduled')}: <strong className="color-purple">{formatMoney(totalScheduledInterest)}</strong></span>
                                <span>{t('dashboardTotalPenalty')}: <strong>{formatMoney(totalPenaltyAll)}</strong></span>
                                <span>{t('dashboardPenaltyPaid')}: <strong>{formatMoney(totalPaidPenalty)}</strong></span>
                                <span>{t('dashboardPenaltyUnpaid')}: <strong>{formatMoney(totalUnpaidPenalty)}</strong></span>
                                <span>{t('dashboardTotalObligation')}: <strong>{formatMoney(totalObligation)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Outstanding */}
                    <div className="exec-card card-outstanding">
                        <div className="exec-card-header">
                            <span className="card-label">{t('dashboardOutstanding')}</span>
                            <div className="exec-card-icon icon-orange">
                                <FaLock />
                            </div>
                        </div>
                        <div className="card-value color-orange">{formatMoney(totalOutstandingAmount)}</div>
                        <div className="exec-card-footer">
                            <div className="stacked-stat">
                                <span>{t('dashboardInterestOutstanding')}: <strong className="color-orange">{formatMoney(totalOutstandingInterest)}</strong></span>
                                <span>{t('dashboardPenaltyUncollected')}: <strong>{formatMoney(totalUnpaidPenalty)}</strong></span>
                                <span>{t('dashboardOutstandingRate')}: <strong>{totalObligation > 0 ? ((totalOutstandingAmount / totalObligation) * 100).toFixed(2) : '0.00'}%</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Middle Dashboard Row ── */}
                <div className="middle-dashboard-row">
                    {/* Left: Interactive Line & Area Chart Card */}
                    <div className="chart-card flow-trend-card">
                        <div className="c-head-row">
                            <div className="c-title-box">
                                <div className="title-icon-line">
                                    <div className="mini-icon green-icon">
                                        <FaChartArea />
                                    </div>
                                    <h3>{t('dashboardCollectionChartTitle')}</h3>
                                </div>
                                <span className="c-subtitle">{t('dashboardCollectionChartSubtitle')}</span>
                            </div>

                            <div className="chart-controls">
                                <div className="custom-legend">
                                    <span className="legend-badge">
                                        <span className="legend-dot dot-green"></span>
                                        <span className="legend-text-full desktop-only">{t('dashboardCollected')}</span>
                                        <span className="legend-text-short mobile-only">{t('dashboardCollectedShort')}</span>
                                    </span>
                                    <span className="legend-badge">
                                        <span className="legend-dot dot-blue"></span>
                                        <span className="legend-text-full desktop-only">{t('dashboardDisbursed')}</span>
                                        <span className="legend-text-short mobile-only">{t('dashboardDisbursedShort')}</span>
                                    </span>
                                    <span className="legend-badge">
                                        <span className="legend-dot dot-purple"></span>
                                        <span className="legend-text-full desktop-only">{t('totalCustomers')}</span>
                                        <span className="legend-text-short mobile-only">{t('customer')}</span>
                                    </span>
                                </div>

                                <div className="timeframe-container" ref={popoverRef}>
                                    <div className="timeframe-switch">
                                        {[
                                            { key: 'today', label: t('today') },
                                            { key: '7d', label: t('dashboardLast7Days') },
                                            { key: '30d', label: t('dashboardLast30Days') },
                                            { key: 'monthly', label: t('thisMonth') },
                                            { key: 'all', label: t('all') },
                                            { key: 'custom', label: t('dashboardCustomDate') }
                                        ].map(item => {
                                            const isCustom = item.key === 'custom';
                                            const isActive = selectedTimeframe === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    className={`btn-timeframe ${isActive ? 'active' : ''} ${isCustom ? 'btn-custom-trigger' : ''}`}
                                                    onClick={() => {
                                                        if (isCustom) {
                                                            setIsCustomPopoverOpen(prev => !prev);
                                                        } else {
                                                            setIsCustomPopoverOpen(false);
                                                            setSelectedTimeframe(item.key);
                                                        }
                                                    }}
                                                >
                                                    {isCustom ? (
                                                        selectedTimeframe === 'custom' && customStartDate && customEndDate ? (
                                                            `📅 ${customStartDate.slice(5)} - ${customEndDate.slice(5)}`
                                                        ) : t('dashboardCustomDate')
                                                    ) : item.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Date Popover */}
                                    {isCustomPopoverOpen && (
                                        <div className="custom-date-popover">
                                            <div className="popover-header">
                                                <div className="popover-title">
                                                    <FaCalendarDays />
                                                    <span>{t('filterDateRange')}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-close-popover"
                                                    onClick={() => setIsCustomPopoverOpen(false)}
                                                    aria-label={t('close')}
                                                >
                                                    <FaXmark />
                                                </button>
                                            </div>

                                            <div className="popover-shortcuts">
                                                <button type="button" onClick={() => handleApplyDatePreset(7)}>{t('dashboardLast7Days')}</button>
                                                <button type="button" onClick={() => handleApplyDatePreset(14)}>{t('dashboardLast14Days')}</button>
                                                <button type="button" onClick={() => handleApplyDatePreset(30)}>{t('dashboardLast30Days')}</button>
                                                <button type="button" onClick={() => {
                                                    const d = new Date();
                                                    d.setMonth(d.getMonth() - 1);
                                                    handleApplyMonthPreset(d.getMonth() + 1, d.getFullYear());
                                                }}>{t('dashboardPreviousMonth')}</button>
                                            </div>

                                            {/* Month & Year Select Section */}
                                            <div style={{ marginBottom: 10, padding: '8px 0', borderTop: '1px dashed var(--dash-line)', borderBottom: '1px dashed var(--dash-line)' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--dash-ink)', marginBottom: 6 }}>
                                                    {t('dashboardSelectMonthYear')}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 6, marginBottom: 6 }}>
                                                    <select
                                                        value={selectedMonth}
                                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                                        style={{ padding: '4px 6px', fontSize: '11.5px', borderRadius: 5, border: '1px solid var(--dash-line)', background: 'var(--dash-bg)', color: 'var(--dash-ink)' }}
                                                    >
                                                        {monthNames.map((mName, idx) => (
                                                            <option key={idx + 1} value={idx + 1}>{mName}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={selectedYear}
                                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                                        style={{ padding: '4px 6px', fontSize: '11.5px', borderRadius: 5, border: '1px solid var(--dash-line)', background: 'var(--dash-bg)', color: 'var(--dash-ink)' }}
                                                    >
                                                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyMonthPreset(selectedMonth, selectedYear)}
                                                    style={{ width: '100%', padding: '4px', fontSize: '11px', fontWeight: 600, background: '#059669', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                                                >
                                                    {t('dashboardFilterSelectedMonth')}
                                                </button>
                                            </div>

                                            <div className="popover-inputs">
                                                <label className="date-input-group">
                                                    <span className="input-label">{t('from')}</span>
                                                    <input
                                                        type="date"
                                                        value={customStartDate}
                                                        onChange={(e) => {
                                                            setCustomStartDate(e.target.value);
                                                            setCustomDateError(null);
                                                        }}
                                                    />
                                                </label>
                                                <label className="date-input-group">
                                                    <span className="input-label">{t('to')}</span>
                                                    <input
                                                        type="date"
                                                        value={customEndDate}
                                                        onChange={(e) => {
                                                            setCustomEndDate(e.target.value);
                                                            setCustomDateError(null);
                                                        }}
                                                    />
                                                </label>
                                            </div>

                                            {customDateError && (
                                                <div className="date-popover-error">{customDateError}</div>
                                            )}

                                            <div className="popover-actions">
                                                <button
                                                    type="button"
                                                    className="btn-popover-cancel"
                                                    onClick={() => setIsCustomPopoverOpen(false)}
                                                >
                                                    {t('cancel')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-popover-apply"
                                                    onClick={handleApplyCustomDateRange}
                                                >
                                                    {t('dashboardFilterDateRange')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SVG Interactive Trend Chart */}
                        <div className="line-canvas-box">
                            <LineChartCanvas points={chartPoints} t={t} />
                        </div>
                    </div>

                    {/* Right: Contract Pipeline & Lock Ratio Card */}
                    <div className="chart-card contract-status-card">
                        <div className="c-head-row">
                            <div className="c-title-box">
                                <div className="title-icon-line">
                                    <div className="mini-icon purple-icon">
                                        <FaFileContract />
                                    </div>
                                    <h3>{t('dashboardContractStatus')}</h3>
                                </div>
                                <span className="c-subtitle">{t('totalContracts')}: <strong>{formatNumber(totalCount)} {t('dashboardCases')}</strong></span>
                            </div>
                        </div>

                        <div className="pipeline-list">
                            <PipelineItem
                                label={t('activated')}
                                khmerLabel=""
                                count={activatedCount}
                                percent={Number(activatedPct)}
                                colorClass="fill-green"
                                trackColor="rgba(16, 185, 129, 0.12)"
                            />
                            <PipelineItem
                                label={t('application')}
                                khmerLabel=""
                                count={applicationCount}
                                percent={Number(applicationPct)}
                                colorClass="fill-blue"
                                trackColor="rgba(59, 130, 246, 0.12)"
                            />
                            <PipelineItem
                                label={t('check')}
                                khmerLabel=""
                                count={checkCount}
                                percent={Number(checkPct)}
                                colorClass="fill-cyan"
                                trackColor="rgba(6, 182, 212, 0.12)"
                            />
                            <PipelineItem
                                label={t('redeem')}
                                khmerLabel=""
                                count={redeemCount}
                                percent={Number(redeemPct)}
                                colorClass="fill-purple"
                                trackColor="rgba(139, 92, 246, 0.12)"
                            />
                            <PipelineItem
                                label={t('blacklist')}
                                khmerLabel=""
                                count={blacklistCount}
                                percent={Number(blacklistPct)}
                                colorClass="fill-red"
                                trackColor="rgba(239, 68, 68, 0.12)"
                            />
                        </div>

                        {/* Phone Remote Lock Ratio Panel */}
                        <div className="remote-lock-panel">
                            <div className="lock-header">
                                <span>{t('dashboardRemoteLockRatio')}</span>
                                <span className="lock-stat-badge">{formatNumber(lockedPhones)} {t('locked')}</span>
                            </div>
                            <div className="lock-ratio-bar">
                                <div className="ratio-locked" style={{ width: `${lockedRatio}%` }}></div>
                                <div className="ratio-unlocked" style={{ width: `${unlockedRatio}%` }}></div>
                            </div>
                            <div className="lock-footer">
                                <span className="lock-text locked">
                                    <FaLock /> {lockedRatio}% {t('locked')}
                                </span>
                                <span className="lock-text unlocked">
                                    <FaLockOpen /> {unlockedRatio}% {t('unlocked')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Customer Payment Detail Section ── */}
                <div className="chart-card customer-payment-card">
                    <div className="c-head-row">
                        <div className="c-title-box">
                            <div className="title-icon-line">
                                <div className="mini-icon orange-icon">
                                    <FaUsers />
                                </div>
                                <h3>{t('dashboardPaymentDetails')}</h3>
                            </div>
                            <span className="c-subtitle">{t('dashboardCustomerListFor')} {timeframeLabel} · {t('dashboardPaymentStatus')}</span>
                        </div>
                    </div>

                    <div className="mobile-table-hint mobile-only">
                        <FaTableCellsLarge />
                        <span>{t('dashboardMobileTableHint')}</span>
                    </div>

                    {/* Sub-section 1: ភ្ញៀវត្រូវបង់ (Due) */}
                    <div className="payment-section payment-section-due">
                        <div className="payment-section-heading">
                            <h4>
                                <FaReceipt /> {t('dashboardDueCustomers')}
                            </h4>
                            <div className="payment-section-summary">
                                <span className="payment-total">
                                    {t('paid')} <strong>{formatMoney(dueTotalPaid)}</strong>
                                </span>
                                <span className="payment-total">
                                    {t('dashboardRemaining')} <strong>{formatMoney(dueTotalRemaining)}</strong>
                                </span>
                                <span className="payment-total">
                                    {t('dashboardTotalInterest')} <strong>{formatMoney(dueTotalInterest)}</strong>
                                </span>
                                <span className="payment-total">
                                    {t('dashboardTotalPenalty')} <strong>{formatMoney(dueTotalPenalty)}</strong>
                                </span>
                                <span className="payment-count">{dueCustomerRows.length} {t('people')}</span>
                            </div>
                        </div>
                        <CustomerTable rows={dueCustomerRows} formatMoney={formatMoney} formatNumber={formatNumber} t={t} />
                    </div>

                    {/* Sub-section 2: ភ្ញៀវយឺត (Late / Overdue) */}
                    <div className="payment-section payment-section-late">
                        <div className="payment-section-heading">
                            <h4>
                                <FaClock /> {t('dashboardOverdueCustomers')}
                            </h4>
                            <div className="payment-section-summary">
                                <span className="payment-total">
                                    {t('dashboardTotalPenalty')} <strong>{formatMoney(lateTotalPenalty)}</strong>
                                </span>
                                <span className="payment-count">{overdueCustomerRows.length} {t('people')}</span>
                                <select
                                    className="payment-filter-select"
                                    aria-label={t('dashboardOverdueFilter')}
                                    value={lateSectionFilter}
                                    onChange={(e) => setLateSectionFilter(e.target.value)}
                                >
                                    <option value="all">{t('all')}</option>
                                    <option value="filtered">{t('dashboardFiltered')}</option>
                                </select>
                            </div>
                        </div>
                        <CustomerTable
                            rows={lateSectionFilter === 'all' ? overdueCustomerRows : overdueCustomerRows.slice(0, 10)}
                            formatMoney={formatMoney}
                            formatNumber={formatNumber}
                            t={t}
                        />
                    </div>

                    {/* Sub-section 3: ភ្ញៀវត្រូវពិន័យ (Penalty / Receipts) */}
                    <div className="payment-section payment-section-penalty">
                        <div className="payment-section-heading">
                            <h4>
                                <FaTriangleExclamation /> {t('dashboardPenaltyCustomers')}
                            </h4>
                            <div className="payment-section-summary">
                                <span className="payment-total">
                                    {t('total')} <strong>{formatMoney(penaltyTotalAmount)}</strong>
                                </span>
                                <span className="payment-count">{penaltyPaymentRows.length} {t('people')}</span>
                            </div>
                        </div>

                        {penaltyPaymentRows.length === 0 ? (
                            <div className="table-responsive">
                                <table className="analytics-table customer-payment-table">
                                    <tbody>
                                        <tr>
                                            <td colSpan={9} className="empty-table-cell">{t('noData')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="analytics-table customer-payment-table">
                                    <thead>
                                        <tr>
                                            <th>{t('no')}</th>
                                            <th>{t('date')}</th>
                                            <th>{t('type')}</th>
                                            <th>{t('customerName')}</th>
                                            <th className="num">{t('amount')}</th>
                                            <th>{t('description')}</th>
                                            <th>{t('dashboardReceiptImage')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {penaltyPaymentRows.map((p, idx) => (
                                            <tr key={p.id}>
                                                <td data-label={t('no')}>{penaltyPaymentRows.length - idx}</td>
                                                <td data-label={t('date')}>{p.dueDate}</td>
                                                <td data-label={t('type')}>{p.paymentMethod || '-'}</td>
                                                <td data-label={t('customerName')}>{p.category || '-'}</td>
                                                <td data-label={t('amount')} className="num color-red">{formatMoney(p.penaltyAmount)}</td>
                                                <td data-label={t('description')}>{p.description || '-'}</td>
                                                <td data-label={t('dashboardReceiptImage')}>
                                                    {p.photoUrl ? (
                                                        <button
                                                            type="button"
                                                            className="receipt-preview-button"
                                                            onClick={() => setPreviewImage(p.photoUrl)}
                                                        >
                                                            <FaImage /> {t('view')}
                                                        </button>
                                                    ) : t('dashboardNoImage')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Receipt Image Modal ── */}
            {previewImage && (
                <div
                    className="receipt-preview-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('dashboardReceiptPreview')}
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="receipt-preview-close"
                            aria-label={t('close')}
                            onClick={() => setPreviewImage(null)}
                        >
                            <FaXmark />
                        </button>
                        <img src={previewImage} alt={t('dashboardReceipt')} className="receipt-preview-image" />
                    </div>
                </div>
            )}
        </main>
    );
};

// ── Sub-Components ──

const PipelineItem = ({ label, count, percent, colorClass, trackColor }) => (
    <div className="pipeline-item">
        <div className="pipeline-labels">
            <span className="pipeline-title">
                <strong>{label}</strong>
            </span>
            <span className="pipeline-count">
                <strong>{count}</strong> ({percent.toFixed(2)}%)
            </span>
        </div>
        <div className="progress-track" style={{ backgroundColor: trackColor }}>
            <div className={`progress-fill ${colorClass}`} style={{ width: `${Math.max(percent, count > 0 ? 4 : 0)}%` }}></div>
        </div>
    </div>
);

const CustomerTable = ({ rows = [], formatMoney, formatNumber, t }) => {
    if (rows.length === 0) {
        return (
            <div className="table-responsive">
                <table className="analytics-table customer-payment-table">
                    <tbody>
                        <tr>
                            <td colSpan={9} className="empty-table-cell">{t('noData')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="table-responsive">
            <table className="analytics-table customer-payment-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{t('customerName')}</th>
                        <th>{t('contractIdLabel')}</th>
                        <th>{t('dueDateLabel')}</th>
                        <th className="num">{t('dashboardDueAmount')} ($)</th>
                        <th className="num">{t('paid')} ($)</th>
                        <th className="num">{t('dashboardRemaining')} ($)</th>
                        <th className="num">{t('dashboardPenalty')} ($)</th>
                        <th>{t('status')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const penaltyDisplayVal = row.isPaid
                            ? (row.paidPenaltyAmount || row.penaltyAmount || 0)
                            : (row.unpaidPenaltyAmount || row.penaltyAmount || 0);

                        const totalDue = row.scheduledAmount + (row.isPaid ? (row.paidPenaltyAmount || 0) : row.penaltyAmount);
                        const totalRemaining = row.isPaid ? 0 : (row.outstandingAmount + (row.unpaidPenaltyAmount || 0));

                        let statusLabel = t('dashboardDue');
                        let statusClass = 'due';

                        if (row.isPaid || totalRemaining <= 0) {
                            if (row.paidPenaltyAmount > 0 || row.lateDays > 0) {
                                statusLabel = row.lateDays > 0
                                    ? t('dashboardPaidLateStatus').replace('{days}', formatNumber(row.lateDays))
                                    : t('dashboardPaidWithPenalty');
                            } else {
                                statusLabel = t('paid');
                            }
                            statusClass = 'paid';
                        } else if (row.lateDays > 0 || (row.daysUntilDue !== null && row.daysUntilDue < 0)) {
                            const lateCount = row.lateDays || Math.abs(row.daysUntilDue);
                            if (lateCount >= 30) {
                                const m = Math.floor(lateCount / 30);
                                const d = lateCount % 30;
                                statusLabel = d > 0
                                    ? t('dashboardOverdueMonthsAndDays')
                                        .replace('{months}', formatNumber(m))
                                        .replace('{days}', formatNumber(d))
                                    : t('dashboardOverdueMonths').replace('{months}', formatNumber(m));
                            } else {
                                statusLabel = t('dashboardOverdueDays').replace('{days}', formatNumber(lateCount));
                            }
                            statusClass = 'overdue';
                        } else if (row.unpaidPenaltyAmount > 0 || row.penaltyAmount > 0) {
                            statusLabel = t('dashboardHasPenalty');
                            statusClass = 'penalty';
                        } else if (row.daysUntilDue === 0) {
                            statusLabel = t('dashboardDueToday');
                            statusClass = 'due';
                        } else if (row.daysUntilDue === 1) {
                            statusLabel = t('dashboardDueInOneDay');
                            statusClass = 'due';
                        } else if (row.daysUntilDue !== null && row.daysUntilDue > 1) {
                            statusLabel = t('dashboardDueInDays').replace('{days}', formatNumber(row.daysUntilDue));
                            statusClass = 'due';
                        }

                        return (
                            <tr key={row.id}>
                                <td data-label="#">{rows.length - idx}</td>
                                <td data-label={t('customerName')} className="customer-name-cell">
                                    <strong style={{ display: 'block', color: '#0f172a' }}>
                                        {row.customerNameKh || row.customerName || row.customerNameEn || t('unknown')}
                                    </strong>
                                    <small style={{ color: '#64748b' }}>{row.phone}</small>
                                </td>
                                <td data-label={t('contractIdLabel')}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong>{row.contractIid || row.contractId || '-'}</strong>
                                        {row.monthLabel && <small style={{ fontSize: '11px', color: '#64748b' }}>{row.monthLabel}</small>}
                                    </div>
                                </td>
                                <td data-label={t('dueDateLabel')}>{row.dueDate || '-'}</td>
                                <td data-label={t('dashboardDueAmount')} className="num">{formatMoney(totalDue)}</td>
                                <td data-label={t('paid')} className="num color-green">{formatMoney(row.paidAmount)}</td>
                                <td data-label={t('dashboardRemaining')} className="num color-orange">{formatMoney(totalRemaining)}</td>
                                <td data-label={t('dashboardPenalty')} className={`num ${row.isPaid && penaltyDisplayVal > 0 ? 'color-green' : (penaltyDisplayVal > 0 ? 'color-red' : '')}`}>
                                    {formatMoney(penaltyDisplayVal)}
                                </td>
                                <td data-label={t('status')}>
                                    <span className={`payment-status payment-status-${statusClass}`}>
                                        {statusLabel}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ── SVG Interactive Line & Area Chart ──
const LineChartCanvas = ({ points = [], t }) => {
    const width = 800;
    const height = 250;
    const padX = 50;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const [hoverIdx, setHoverIdx] = useState(null);

    const maxVal = useMemo(() => {
        let m = 0;
        points.forEach(p => {
            if (p.disbursed > m) m = p.disbursed;
            if (p.collected > m) m = p.collected;
        });
        return m === 0 ? 100 : Math.ceil(m * 1.2);
    }, [points]);

    const maxCust = useMemo(() => {
        let m = 0;
        points.forEach(p => {
            if (p.customers > m) m = p.customers;
        });
        return m === 0 ? 10 : Math.ceil(m * 1.2);
    }, [points]);

    const coords = useMemo(() => {
        const n = points.length;
        if (n === 0) return [];
        return points.map((p, i) => {
            const x = n === 1 ? padX + chartW / 2 : padX + (i / (n - 1)) * chartW;
            const yDisbursed = padY + chartH - (p.disbursed / maxVal) * chartH;
            const yCollected = padY + chartH - (p.collected / maxVal) * chartH;
            const yCust = padY + chartH - (p.customers / maxCust) * chartH;
            return { ...p, x, yDisbursed, yCollected, yCust };
        });
    }, [points, maxVal, maxCust, chartW, chartH]);

    const disbursedPath = useMemo(() => {
        if (coords.length === 0) return '';
        return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yDisbursed.toFixed(1)}`).join(' ');
    }, [coords]);

    const disbursedArea = useMemo(() => {
        if (coords.length === 0) return '';
        const first = coords[0];
        const last = coords[coords.length - 1];
        const baseY = padY + chartH;
        return `${disbursedPath} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    }, [coords, disbursedPath, chartH]);

    const collectedPath = useMemo(() => {
        if (coords.length === 0) return '';
        return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yCollected.toFixed(1)}`).join(' ');
    }, [coords]);

    const custPath = useMemo(() => {
        if (coords.length === 0) return '';
        return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yCust.toFixed(1)}`).join(' ');
    }, [coords]);

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full select-none"
            style={{ overflow: 'visible' }}
            onMouseLeave={() => setHoverIdx(null)}
        >
            <defs>
                <linearGradient id="disbursedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padY + chartH * (1 - ratio);
                const val = Math.round(maxVal * ratio);
                return (
                    <g key={idx}>
                        <line
                            x1={padX}
                            y1={y}
                            x2={width - padX}
                            y2={y}
                            stroke="#f1f5f9"
                            strokeWidth="1"
                        />
                        <text
                            x={padX - 8}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="10"
                            fill="#94a3b8"
                            fontWeight="500"
                        >
                            ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                        </text>
                    </g>
                );
            })}

            {/* Disbursed Area fill */}
            {disbursedArea && <path d={disbursedArea} fill="url(#disbursedGrad)" />}

            {/* Disbursed Line */}
            {disbursedPath && (
                <path
                    d={disbursedPath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Collected Line */}
            {collectedPath && (
                <path
                    d={collectedPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Customers Line (Dashed) */}
            {custPath && (
                <path
                    d={custPath}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="1.8"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Data Points and Hover Vertical Line */}
            {coords.map((c, i) => (
                <g key={i} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: 'pointer' }}>
                    {/* Disbursed Dot */}
                    <circle
                        cx={c.x}
                        cy={c.yDisbursed}
                        r={hoverIdx === i ? 5 : 3.5}
                        fill="#fff"
                        stroke="#3b82f6"
                        strokeWidth="2"
                    />

                    {/* Collected Dot */}
                    <circle
                        cx={c.x}
                        cy={c.yCollected}
                        r={hoverIdx === i ? 4.5 : 3}
                        fill="#fff"
                        stroke="#10b981"
                        strokeWidth="2"
                    />

                    {/* Customer Dot */}
                    <circle
                        cx={c.x}
                        cy={c.yCust}
                        r={hoverIdx === i ? 4 : 2.5}
                        fill="#fff"
                        stroke="#8b5cf6"
                        strokeWidth="1.5"
                    />

                    {/* X-axis Label */}
                    {(coords.length <= 15 || i % Math.ceil(coords.length / 10) === 0) && (
                        <text
                            x={c.x}
                            y={height - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748b"
                            fontWeight="500"
                        >
                            {c.label}
                        </text>
                    )}
                </g>
            ))}

            {/* Active Hover Tooltip */}
            {hoverIdx !== null && coords[hoverIdx] && (
                <g transform={`translate(${coords[hoverIdx].x}, 0)`}>
                    <line
                        x1="0"
                        y1={padY}
                        x2="0"
                        y2={padY + chartH}
                        stroke="#93c5fd"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                    />
                    <g transform={`translate(${coords[hoverIdx].x > width - 150 ? -140 : 10}, 20)`}>
                        <rect
                            width="130"
                            height="72"
                            rx="8"
                            fill="#ffffff"
                            stroke="#e2e8f0"
                            filter="drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
                        />
                        <text x="10" y="16" fontSize="11" fontWeight="700" fill="#0f172a">
                            {coords[hoverIdx].label}
                        </text>
                        <text x="10" y="32" fontSize="10" fill="#3b82f6" fontWeight="600">
                            ● {t('dashboardDisbursed')}: ${Number(coords[hoverIdx].disbursed).toLocaleString()}
                        </text>
                        <text x="10" y="47" fontSize="10" fill="#10b981" fontWeight="600">
                            ● {t('dashboardCollected')}: ${Number(coords[hoverIdx].collected).toLocaleString()}
                        </text>
                        <text x="10" y="62" fontSize="10" fill="#8b5cf6" fontWeight="600">
                            ● {t('customer')}: {coords[hoverIdx].customers} {t('people')}
                        </text>
                    </g>
                </g>
            )}
        </svg>
    );
};

export default Dashboard;
