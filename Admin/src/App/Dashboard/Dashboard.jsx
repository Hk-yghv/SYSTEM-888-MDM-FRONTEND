import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    FaLayerGroup,
    FaExpand,
    FaCompress,
    FaMoon,
    FaSun,
    FaChartLine,
    FaCalendarCheck,
    FaPrint,
    FaRotateRight,
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
import { getAutomaticPenalty, getRowWithDueDate } from '../../utils/repaymentUtils';

const Dashboard = () => {
    const { t } = useLanguage();
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

    // ── Theme State ──
    const [theme, setTheme] = useState(() => localStorage.getItem('dashboard_theme') || 'light');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
        } else {
            root.classList.remove('dark');
            root.setAttribute('data-theme', 'light');
        }
    }, [theme]);

    const handleToggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('dashboard_theme', next);
            return next;
        });
    };

    // ── Fullscreen Toggle ──
    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.().catch(() => {});
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // ── Core States ──
    const [stats, setStats] = useState({
        totalContracts: 0,
        activatedContracts: 0,
        applicationContracts: 0,
        checkContracts: 0,
        redeemContracts: 0,
        blacklistContracts: 0,
        lockedPhones: 0,
        unlockedPhones: 0,
        totalRevenue: 0,
        totalLoanAmount: 0,
        totalCustomerReceived: 0,
        totalBorrowers: 0
    });

    const [brandFilter, setBrandFilter] = useState('');
    const [brandsList, setBrandsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [rawContracts, setRawContracts] = useState([]);
    const [rawPayments, setRawPayments] = useState([]);
    const [penaltyRulesByBrand, setPenaltyRulesByBrand] = useState({});
    const [lastSyncTime, setLastSyncTime] = useState('មុននេះបន្តិច');

    // Timeframe filter state
    const [selectedTimeframe, setSelectedTimeframe] = useState('monthly'); // 'today' | '7d' | '30d' | 'monthly' | 'all' | 'custom'
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false);
    const [customDateError, setCustomDateError] = useState(null);

    // Overdue Filter State in Late section
    const [lateSectionFilter, setLateSectionFilter] = useState('all'); // 'all' | 'filtered'

    // Receipt image modal preview
    const [previewImage, setPreviewImage] = useState(null);

    const popoverRef = useRef(null);

    // Close popover on outside click or escape
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

    // Active Brand Filter Scope
    const activeUserBrand = useMemo(() => {
        if (!isMasterAdmin && user?.brand) return user.brand;
        return brandFilter;
    }, [isMasterAdmin, user, brandFilter]);

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

    // ── API Fetchers ──
    const fetchBrands = async () => {
        try {
            const res = await fetch(`${API_BASE}/controlsystem?brand=`);
            if (res.ok) {
                const data = await res.json();
                const brandCat = data.droplists?.find(d => d.category === 'Brands');
                if (brandCat) setBrandsList(brandCat.items || []);
            }
        } catch { }
    };

    const fetchDashboardStats = useCallback(async () => {
        setReloading(true);
        try {
            const params = new URLSearchParams();
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');

            const res = await fetch(`${API_BASE}/dashboard/stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 400);
        }
    }, [API_BASE, activeUserBrand, user]);

    const fetchRawData = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (activeUserBrand) params.set('userBrand', activeUserBrand);
            if (user?.username) params.set('username', user.username);
            if (user?.role) params.set('userRole', user.role);
            if (user?.isImmutable) params.set('isImmutable', 'true');
            params.set('limit', '999999');

            const [cRes, pRes] = await Promise.all([
                fetch(`${API_BASE1}/contracts?${params.toString()}`),
                fetch(`${API_BASE1}/payments?${params.toString()}`)
            ]);

            if (cRes.ok) {
                const cData = await cRes.json();
                const contracts = cData.data || cData.contracts || (Array.isArray(cData) ? cData : []);
                setRawContracts(contracts);

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
    }, [API_BASE1, activeUserBrand, user]);

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

    // ── Contract & Repayment Data Processing ──
    const now = new Date();
    const currentMonthKhmer = useMemo(() => {
        const khmerMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
        return `${khmerMonths[now.getMonth()]} ${now.getFullYear()}`;
    }, []);

    const timeframeLabel = useMemo(() => {
        switch (selectedTimeframe) {
            case 'today': return `ថ្ងៃនេះ (${now.toISOString().split('T')[0]})`;
            case '7d': return '៧ ថ្ងៃចុងក្រោយ';
            case '30d': return '៣០ ថ្ងៃចុងក្រោយ';
            case 'all': return 'ទិន្នន័យទាំងអស់ (All Time)';
            case 'custom':
                if (customStartDate && customEndDate) {
                    return `${customStartDate} ដល់ ${customEndDate}`;
                }
                return 'កំណត់តាមកាលបរិច្ឆេទ';
            case 'monthly':
            default:
                return `ប្រចាំខែ (${currentMonthKhmer})`;
        }
    }, [selectedTimeframe, customStartDate, customEndDate, currentMonthKhmer]);

    // Filtered Contracts by Timeframe
    const filteredContracts = useMemo(() => {
        if (!rawContracts || rawContracts.length === 0) return [];
        if (selectedTimeframe === 'all') return rawContracts;

        const todayStr = now.toISOString().split('T')[0];

        return rawContracts.filter(c => {
            const dateStr = String(c.date || c.createdAt || c.startDate || '').split('T')[0];
            if (!dateStr) return true;

            if (selectedTimeframe === 'today') {
                return dateStr === todayStr;
            }
            if (selectedTimeframe === '7d') {
                const diff = (now - new Date(dateStr)) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 7;
            }
            if (selectedTimeframe === '30d') {
                const diff = (now - new Date(dateStr)) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 30;
            }
            if (selectedTimeframe === 'monthly') {
                const cDate = new Date(dateStr);
                return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
            }
            if (selectedTimeframe === 'custom') {
                if (customStartDate && customEndDate) {
                    return dateStr >= customStartDate && dateStr <= customEndDate;
                }
            }
            return true;
        });
    }, [rawContracts, selectedTimeframe, customStartDate, customEndDate]);

    // ── Core Computed Metrics ──
    const totalCount = stats.totalContracts || filteredContracts.length || 1;
    const activatedCount = stats.activatedContracts || filteredContracts.filter(c => c.status === 'Activated' || c.status === 'ដំណើរការ').length || 0;
    const applicationCount = stats.applicationContracts || filteredContracts.filter(c => c.status === 'Application' || c.status === 'ពាក្យស្នើសុំ').length || 0;
    const checkCount = stats.checkContracts || filteredContracts.filter(c => c.status === 'Check' || c.status === 'កំពុងត្រួតពិនិត្យ').length || 0;
    const redeemCount = stats.redeemContracts || filteredContracts.filter(c => c.status === 'Redeem' || c.status === 'បញ្ចាំ/ដោះដូរ').length || 0;
    const blacklistCount = stats.blacklistContracts || filteredContracts.filter(c => c.status === 'BlackList' || c.status === 'បញ្ជីខ្មៅ').length || 0;

    const activatedPct = ((activatedCount / totalCount) * 100).toFixed(2);
    const applicationPct = ((applicationCount / totalCount) * 100).toFixed(2);
    const checkPct = ((checkCount / totalCount) * 100).toFixed(2);
    const redeemPct = ((redeemCount / totalCount) * 100).toFixed(2);
    const blacklistPct = ((blacklistCount / totalCount) * 100).toFixed(2);

    const lockedPhones = stats.lockedPhones || 0;
    const unlockedPhones = Math.max(0, totalCount - lockedPhones);
    const lockedRatio = totalCount > 0 ? ((lockedPhones / totalCount) * 100).toFixed(2) : '0.00';
    const unlockedRatio = (100 - Number(lockedRatio)).toFixed(2);

    // ── Repayments & Customers Computation ──
    const repaymentRows = useMemo(() => {
        const rows = [];
        rawContracts.forEach(contract => {
            const rules = penaltyRulesByBrand[String(contract.brand || '').trim()] || [];
            if (Array.isArray(contract.repaymentSchedule) && contract.repaymentSchedule.length > 0) {
                contract.repaymentSchedule.forEach((row, idx) => {
                    const rowData = getRowWithDueDate(row, idx, contract);
                    const penaltyInfo = getAutomaticPenalty(rowData, contract, rules);
                    const penalty = Number(penaltyInfo.penalty || rowData.penalty || 0);
                    const scheduledAmt = Number(rowData.scheduledAmount || rowData.amount || rowData.due || 0);
                    const paidAmt = Number(rowData.paidAmount || rowData.paid || 0);
                    const unpaidAmt = Math.max(0, scheduledAmt - paidAmt);
                    const isPaid = rowData.isPaid || (unpaidAmt <= 0 && scheduledAmt > 0);

                    rows.push({
                        id: `${contract._id || contract.id || 'c'}-${idx}`,
                        contractId: contract._id || contract.id,
                        contractIid: contract.contractId || contract.contractIid || contract.code || `CT-${idx + 1}`,
                        customerName: contract.customerName || contract.name || 'Unknown',
                        phone: contract.phone || contract.phoneNumber || contract.tel || '-',
                        dueDate: rowData.dueDate ? String(rowData.dueDate).split('T')[0] : (rowData.date ? String(rowData.date).split('T')[0] : ''),
                        scheduledAmount: scheduledAmt,
                        paidAmount: paidAmt,
                        outstandingAmount: unpaidAmt,
                        penaltyAmount: penalty,
                        isPaid,
                        daysUntilDue: rowData.daysUntilDue,
                        status: isPaid ? 'PAID' : (penalty > 0 ? 'PENALTY' : (rowData.daysUntilDue < 0 ? 'OVERDUE' : 'DUE')),
                        brand: contract.brand || 'MDM'
                    });
                });
            }
        });
        return rows;
    }, [rawContracts, penaltyRulesByBrand]);

    // Active customer payment details for the tables
    const dueCustomerRows = useMemo(() => {
        return repaymentRows.filter(r => !r.isPaid && r.scheduledAmount > 0);
    }, [repaymentRows]);

    const overdueCustomerRows = useMemo(() => {
        return repaymentRows.filter(r => !r.isPaid && (r.penaltyAmount > 0 || r.daysUntilDue < 0));
    }, [repaymentRows]);

    const penaltyPaymentRows = useMemo(() => {
        // Collect penalty payments or raw payments with penalty category
        const pRows = [];
        rawPayments.forEach((p, idx) => {
            const isPenalty = p.type === 'penalty' || p.category === 'Penalty' || String(p.description || '').toLowerCase().includes('penalty') || String(p.description || '').toLowerCase().includes('ពិន័យ');
            if (isPenalty || Number(p.penaltyAmount || 0) > 0) {
                pRows.push({
                    id: p._id || p.id || `p-${idx}`,
                    dueDate: p.date ? String(p.date).split('T')[0] : new Date().toISOString().split('T')[0],
                    paymentMethod: p.paymentMethod || p.method || 'Cash',
                    category: p.customerName || p.customer || p.category || 'ពិន័យយឺត',
                    penaltyAmount: Number(p.amount || p.penaltyAmount || 0),
                    description: p.description || p.notes || 'ការទូទាត់ប្រាក់ពិន័យ',
                    photoUrl: p.photoUrl || p.image || p.receiptUrl || null
                });
            }
        });
        return pRows;
    }, [rawPayments]);

    // Aggregate totals for KPI Cards
    const totalDisbursedAmount = stats.totalLoanAmount || filteredContracts.reduce((s, c) => s + Number(c.amount || c.loanAmount || 0), 0);
    const totalCollectedRevenue = stats.totalRevenue || rawPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalScheduledAmount = useMemo(() => repaymentRows.reduce((s, r) => s + r.scheduledAmount, 0), [repaymentRows]);
    const totalPenaltyAmount = useMemo(() => repaymentRows.reduce((s, r) => s + r.penaltyAmount, 0), [repaymentRows]);
    const totalObligation = totalScheduledAmount + totalPenaltyAmount;
    const totalOutstandingAmount = useMemo(() => repaymentRows.filter(r => !r.isPaid).reduce((s, r) => s + r.outstandingAmount + r.penaltyAmount, 0), [repaymentRows]);

    // Summary counts for sections
    const dueTotalPaid = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.paidAmount, 0), [dueCustomerRows]);
    const dueTotalRemaining = useMemo(() => dueCustomerRows.reduce((s, r) => s + r.outstandingAmount + r.penaltyAmount, 0), [dueCustomerRows]);
    const lateTotalPenalty = useMemo(() => overdueCustomerRows.reduce((s, r) => s + r.penaltyAmount, 0), [overdueCustomerRows]);
    const penaltyTotalAmount = useMemo(() => penaltyPaymentRows.reduce((s, r) => s + r.penaltyAmount, 0), [penaltyPaymentRows]);

    // Overdue alert count
    const totalOverdueAlertCount = overdueCustomerRows.length;

    // ── Chart Points (Dynamic Daily/Monthly Timeline) ──
    const chartPoints = useMemo(() => {
        const pointsMap = {};
        const today = new Date();

        if (selectedTimeframe === 'today') {
            const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
            hours.forEach(h => {
                pointsMap[h] = { label: h, collected: 0, disbursed: 0, customers: 0 };
            });
            // Distribute today's data
            const todayStr = today.toISOString().split('T')[0];
            filteredContracts.forEach(c => {
                if (String(c.date || '').startsWith(todayStr)) {
                    pointsMap['12:00'].disbursed += Number(c.amount || c.loanAmount || 0);
                    pointsMap['12:00'].customers += 1;
                }
            });
            rawPayments.forEach(p => {
                if (String(p.date || '').startsWith(todayStr)) {
                    pointsMap['12:00'].collected += Number(p.amount || 0);
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
                const cDate = String(c.date || c.createdAt || '').split('T')[0];
                if (pointsMap[cDate]) {
                    pointsMap[cDate].disbursed += Number(c.amount || c.loanAmount || 0);
                    pointsMap[cDate].customers += 1;
                }
            });

            rawPayments.forEach(p => {
                const pDate = String(p.date || p.createdAt || '').split('T')[0];
                if (pointsMap[pDate]) {
                    pointsMap[pDate].collected += Number(p.amount || 0);
                }
            });
        } else {
            // 'all' -> Group by month
            const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            months.forEach(m => {
                const mKey = `2026-${m}`;
                pointsMap[mKey] = { label: mKey, collected: 0, disbursed: 0, customers: 0 };
            });
            filteredContracts.forEach(c => {
                const cMonth = String(c.date || c.createdAt || '').slice(0, 7);
                if (pointsMap[cMonth]) {
                    pointsMap[cMonth].disbursed += Number(c.amount || c.loanAmount || 0);
                    pointsMap[cMonth].customers += 1;
                }
            });
            rawPayments.forEach(p => {
                const pMonth = String(p.date || p.createdAt || '').slice(0, 7);
                if (pointsMap[pMonth]) {
                    pointsMap[pMonth].collected += Number(p.amount || 0);
                }
            });
        }

        return Object.values(pointsMap);
    }, [selectedTimeframe, filteredContracts, rawPayments]);

    // Handle Custom Popover Shortcut
    const handleApplyDatePreset = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setCustomStartDate(start.toISOString().split('T')[0]);
        setCustomEndDate(end.toISOString().split('T')[0]);
        setCustomDateError(null);
    };

    const handleApplyCustomDateRange = () => {
        if (!customStartDate || !customEndDate) {
            setCustomDateError('សូមជ្រើសរើសថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់');
            return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
            setCustomDateError('ថ្ងៃចាប់ផ្តើមត្រូវតែតូចជាង ឬស្មើថ្ងៃបញ្ចប់');
            return;
        }
        setCustomDateError(null);
        setIsCustomPopoverOpen(false);
        setSelectedTimeframe('custom');
    };

    // Print Action
    const handlePrint = () => {
        window.print();
    };

    return (
        <main className="dashboard-root select-none">
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
                                    <option value="">{t('allBrands') || 'គ្រប់ Brand ទាំងអស់'}</option>
                                    {brandsList.map((b, i) => (
                                        <option key={i} value={typeof b === 'string' ? b : b.name || ''}>
                                            {typeof b === 'string' ? b : b.name || ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Overdue Alert Chip */}
                            {totalOverdueAlertCount > 0 && (
                                <div className="system-alert-chip" title={`មាន ${totalOverdueAlertCount} កុងត្រាហួសថ្ងៃកំណត់បង់ប្រាក់`}>
                                    <FaTriangleExclamation />
                                    <span>ហួសកំណត់: <strong>{totalOverdueAlertCount}</strong></span>
                                </div>
                            )}

                            {/* Live System Status Chip */}
                            <div className="system-status-chip">
                                <div className="status-live-indicator">
                                    <span className="live-status-dot"></span>
                                    <span className="status-text desktop-only">ប្រព័ន្ធដំណើរការល្អ</span>
                                    <span className="status-text mobile-only">Online</span>
                                </div>
                                <span className="status-divider desktop-only">·</span>
                                <div className="sync-time-box desktop-only">
                                    <FaClock />
                                    <span>បច្ចុប្បន្នភាព: {lastSyncTime}</span>
                                </div>
                            </div>

                            {/* Fullscreen Button */}
                            <button
                                type="button"
                                className="icon-btn desktop-only"
                                title={isFullscreen ? 'ចាកចេញពីអេក្រង់ពេញ' : 'ពង្រីកពេញអេក្រង់'}
                                onClick={handleToggleFullscreen}
                                aria-label="ពង្រីកពេញអេក្រង់"
                            >
                                {isFullscreen ? <FaCompress /> : <FaExpand />}
                            </button>

                            {/* Theme Toggle Button */}
                            <button
                                type="button"
                                className="icon-btn"
                                title="ប្តូរពន្លឺ (Theme)"
                                onClick={handleToggleTheme}
                                aria-label="ប្តូរពន្លឺ"
                            >
                                {theme === 'dark' ? <FaSun /> : <FaMoon />}
                            </button>
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
                                <h2>Dashboard</h2>
                                <span className="live-badge">
                                    <span className="pulse-dot"></span> LIVE MDM ANALYTICS
                                </span>
                            </div>
                        </div>
                        <div className="header-desc-row">
                            <p className="header-desc">ផ្ទាំងគ្រប់គ្រងសង្ខេបប្រតិបត្តិ ឥណទាន និងទូរស័ព្ទ MDM</p>
                            <span className="desc-timeframe-tag">
                                <FaCalendarCheck /> {timeframeLabel}
                            </span>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button
                            type="button"
                            className="btn-action btn-print desktop-only"
                            title="បោះពុម្ព ឬទាញយកជារបាយការណ៍ PDF"
                            onClick={handlePrint}
                        >
                            <FaPrint />
                            <span>Print Report</span>
                        </button>
                        <button
                            type="button"
                            className={`btn-action btn-reload ${reloading ? 'reloading' : ''}`}
                            onClick={handleManualReload}
                            title="ទាញទិន្នន័យថ្មីឡើងវិញ"
                        >
                            <FaRotateRight />
                            <span>Reload</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Executive KPI Grid ── */}
            <div className="executive-kpi-grid">
                {/* Card 1: Disbursed */}
                <div className="exec-card card-disbursed">
                    <div className="exec-card-header">
                        <span className="card-label">ឥណទានបញ្ចេញសរុប</span>
                        <div className="exec-card-icon icon-blue">
                            <FaCreditCard />
                        </div>
                    </div>
                    <div className="card-value">{formatMoney(totalDisbursedAmount)}</div>
                    <div className="exec-card-footer">
                        <div className="stacked-stat">
                            <span>អតិថិជន: <strong>{formatNumber(activatedCount)} នាក់</strong></span>
                            <span>អតិថិជនសរុប: <strong>{formatNumber(totalCount)} នាក់</strong></span>
                            <span>ឥណទានសរុប: <strong>{formatMoney(totalDisbursedAmount)}</strong></span>
                        </div>
                        <span className="badge-pill badge-disbursed">DISBURSED</span>
                    </div>
                </div>

                {/* Card 2: Collected */}
                <div className="exec-card card-collected">
                    <div className="exec-card-header">
                        <span className="card-label">ប្រាក់ប្រមូលបានសរុប</span>
                        <div className="exec-card-icon icon-green">
                            <FaArrowTrendUp />
                        </div>
                    </div>
                    <div className="card-value color-green">{formatMoney(totalCollectedRevenue)}</div>
                    <div className="exec-card-footer">
                        <div className="stacked-stat">
                            <span>បានបង់: <strong>{formatNumber(rawPayments.length)} ប្រតិបត្តិការ</strong></span>
                            <span>ប្រមូលបាន: <strong>{totalDisbursedAmount > 0 ? ((totalCollectedRevenue / totalDisbursedAmount) * 100).toFixed(2) : '0.00'}%</strong></span>
                        </div>
                        <span className="badge-pill" style={{ background: '#d1fae5', color: '#059669' }}>COLLECTED</span>
                    </div>
                </div>

                {/* Card 3: Scheduled */}
                <div className="exec-card card-scheduled">
                    <div className="exec-card-header">
                        <span className="card-label">ប្រាក់ត្រូវប្រមូលសរុប</span>
                        <div className="exec-card-icon icon-purple">
                            <FaReceipt />
                        </div>
                    </div>
                    <div className="card-value color-purple">{formatMoney(totalScheduledAmount)}</div>
                    <div className="exec-card-footer split-footer">
                        <div className="stacked-stat">
                            <span>ពិន័យ: <strong>{formatMoney(totalPenaltyAmount)}</strong></span>
                            <span>កាតព្វកិច្ចសរុប: <strong>{formatMoney(totalObligation)}</strong></span>
                        </div>
                        <span className="badge-pill badge-scheduled">SCHEDULED</span>
                    </div>
                </div>

                {/* Card 4: Outstanding */}
                <div className="exec-card card-outstanding">
                    <div className="exec-card-header">
                        <span className="card-label">ប្រាក់នៅសល់មិនទាន់ប្រមូល</span>
                        <div className="exec-card-icon icon-orange">
                            <FaLock />
                        </div>
                    </div>
                    <div className="card-value color-orange">{formatMoney(totalOutstandingAmount)}</div>
                    <div className="exec-card-footer">
                        <div className="stacked-stat">
                            <span>អត្រាមិនទាន់ប្រមូល: <strong>{totalObligation > 0 ? ((totalOutstandingAmount / totalObligation) * 100).toFixed(2) : '0.00'}%</strong></span>
                        </div>
                        <span className="badge-pill badge-outstanding">OUTSTANDING</span>
                    </div>
                </div>
            </div>

            {/* ── Middle Dashboard Row ── */}
            <div className="middle-dashboard-row">
                {/* Left: Chart Card */}
                <div className="chart-card flow-trend-card">
                    <div className="c-head-row">
                        <div className="c-title-box">
                            <div className="title-icon-line">
                                <div className="mini-icon green-icon">
                                    <FaChartArea />
                                </div>
                                <h3>ក្រាហ្វិកប្រាក់ប្រមូល & អតិថិជន</h3>
                            </div>
                            <span className="c-subtitle">បង្ហាញពីលំហូរទឹកប្រាក់ប្រមូលបាន ឥណទានបញ្ចេញ និងចំនួនអតិថិជន Activated</span>
                        </div>

                        <div className="chart-controls">
                            <div className="custom-legend">
                                <span className="legend-badge">
                                    <span className="legend-dot dot-green"></span>
                                    <span className="legend-text-full desktop-only">ប្រាក់ប្រមូលបាន</span>
                                    <span className="legend-text-short mobile-only">ប្រមូល</span>
                                </span>
                                <span className="legend-badge">
                                    <span className="legend-dot dot-blue"></span>
                                    <span className="legend-text-full desktop-only">ឥណទានបញ្ចេញ</span>
                                    <span className="legend-text-short mobile-only">ឥណទាន</span>
                                </span>
                                <span className="legend-badge">
                                    <span className="legend-dot dot-purple"></span>
                                    <span className="legend-text-full desktop-only">ចំនួនអតិថិជន</span>
                                    <span className="legend-text-short mobile-only">អតិថិជន</span>
                                </span>
                            </div>

                            <div className="timeframe-container" ref={popoverRef}>
                                <div className="timeframe-switch">
                                    {[
                                        { key: 'today', label: 'ថ្ងៃនេះ' },
                                        { key: '7d', label: '៧ ថ្ងៃ' },
                                        { key: '30d', label: '៣០ ថ្ងៃ' },
                                        { key: 'monthly', label: 'ខែនេះ' },
                                        { key: 'all', label: 'ទាំងអស់' },
                                        { key: 'custom', label: '📅 កំណត់ថ្ងៃ' }
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
                                                    ) : '📅 កំណត់ថ្ងៃ'
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
                                                <span>កំណត់ចន្លោះកាលបរិច្ឆេទ</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-close-popover"
                                                onClick={() => setIsCustomPopoverOpen(false)}
                                                aria-label="បិទ"
                                            >
                                                <FaXmark />
                                            </button>
                                        </div>

                                        <div className="popover-shortcuts">
                                            <button type="button" onClick={() => handleApplyDatePreset(7)}>៧ ថ្ងៃកន្លងទៅ</button>
                                            <button type="button" onClick={() => handleApplyDatePreset(14)}>១៤ ថ្ងៃកន្លងទៅ</button>
                                            <button type="button" onClick={() => handleApplyDatePreset(30)}>៣០ ថ្ងៃកន្លងទៅ</button>
                                        </div>

                                        <div className="popover-inputs">
                                            <label className="date-input-group">
                                                <span className="input-label">ចាប់ពី</span>
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
                                                <span className="input-label">ដល់</span>
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
                                                បោះបង់
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-popover-apply"
                                                onClick={handleApplyCustomDateRange}
                                            >
                                                ត្រងទិន្នន័យ
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SVG Interactive Trend Chart */}
                    <div className="line-canvas-box">
                        <LineChartCanvas points={chartPoints} theme={theme} />
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
                                <h3>ស្ថានភាពកិច្ចសន្យា & MDM</h3>
                            </div>
                            <span className="c-subtitle">សរុបកិច្ចសន្យា: <strong>{formatNumber(totalCount)} ករណី</strong></span>
                        </div>
                    </div>

                    <div className="pipeline-list">
                        <PipelineItem
                            label="Activated"
                            khmerLabel="ដំណើរការ"
                            count={activatedCount}
                            percent={Number(activatedPct)}
                            colorClass="fill-green"
                            trackColor="rgba(16, 185, 129, 0.12)"
                        />
                        <PipelineItem
                            label="Application"
                            khmerLabel="ពាក្យស្នើសុំ"
                            count={applicationCount}
                            percent={Number(applicationPct)}
                            colorClass="fill-blue"
                            trackColor="rgba(59, 130, 246, 0.12)"
                        />
                        <PipelineItem
                            label="Check"
                            khmerLabel="កំពុងត្រួតពិនិត្យ"
                            count={checkCount}
                            percent={Number(checkPct)}
                            colorClass="fill-cyan"
                            trackColor="rgba(6, 182, 212, 0.12)"
                        />
                        <PipelineItem
                            label="Redeem"
                            khmerLabel="បញ្ចាំ/ដោះដូរ"
                            count={redeemCount}
                            percent={Number(redeemPct)}
                            colorClass="fill-purple"
                            trackColor="rgba(139, 92, 246, 0.12)"
                        />
                        <PipelineItem
                            label="Blacklist"
                            khmerLabel="បញ្ជីខ្មៅ"
                            count={blacklistCount}
                            percent={Number(blacklistPct)}
                            colorClass="fill-red"
                            trackColor="rgba(239, 68, 68, 0.12)"
                        />
                    </div>

                    {/* Phone Remote Lock Ratio Panel */}
                    <div className="remote-lock-panel">
                        <div className="lock-header">
                            <span>Phone Remote Lock Ratio</span>
                            <span className="lock-stat-badge">{formatNumber(lockedPhones)} Locked</span>
                        </div>
                        <div className="lock-ratio-bar">
                            <div className="ratio-locked" style={{ width: `${lockedRatio}%` }}></div>
                            <div className="ratio-unlocked" style={{ width: `${unlockedRatio}%` }}></div>
                        </div>
                        <div className="lock-footer">
                            <span className="lock-text locked">
                                <FaLock /> {lockedRatio}% Locked
                            </span>
                            <span className="lock-text unlocked">
                                <FaLockOpen /> {unlockedRatio}% Unlocked
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
                            <h3>
                                លម្អិតភ្ញៀវត្រូវបង់ និងពិន័យ
                                <span className="brand-en-badge">CUSTOMER PAYMENT DETAIL</span>
                            </h3>
                        </div>
                        <span className="c-subtitle">បញ្ជីភ្ញៀវក្នុង {timeframeLabel} និងស្ថានភាពការបង់ប្រាក់</span>
                    </div>
                </div>

                <div className="mobile-table-hint mobile-only">
                    <FaTableCellsLarge />
                    <span>បង្ហាញជាកាតសម្រាប់មើលងាយលើទូរស័ព្ទ</span>
                </div>

                {/* Sub-section 1: ភ្ញៀវត្រូវបង់ (Due) */}
                <div className="payment-section payment-section-due">
                    <div className="payment-section-heading">
                        <h4>
                            <FaReceipt /> ភ្ញៀវត្រូវបង់
                        </h4>
                        <div className="payment-section-summary">
                            <span className="payment-total">
                                បានបង់ <strong>{formatMoney(dueTotalPaid)}</strong>
                            </span>
                            <span className="payment-total">
                                នៅសល់ <strong>{formatMoney(dueTotalRemaining)}</strong>
                            </span>
                            <span className="payment-count">{dueCustomerRows.length} នាក់</span>
                        </div>
                    </div>
                    <CustomerTable rows={dueCustomerRows} formatMoney={formatMoney} formatNumber={formatNumber} />
                </div>

                {/* Sub-section 2: ភ្ញៀវយឺត (Late / Overdue) */}
                <div className="payment-section payment-section-late">
                    <div className="payment-section-heading">
                        <h4>
                            <FaClock /> ភ្ញៀវយឺត
                        </h4>
                        <div className="payment-section-summary">
                            <span className="payment-total">
                                ពិន័យសរុប <strong>{formatMoney(lateTotalPenalty)}</strong>
                            </span>
                            <span className="payment-count">{overdueCustomerRows.length} នាក់</span>
                            <select
                                className="payment-filter-select"
                                aria-label="តម្រងបញ្ជីភ្ញៀវយឺត"
                                value={lateSectionFilter}
                                onChange={(e) => setLateSectionFilter(e.target.value)}
                            >
                                <option value="all">ទាំងអស់</option>
                                <option value="filtered">តាម Filter</option>
                            </select>
                        </div>
                    </div>
                    <CustomerTable
                        rows={lateSectionFilter === 'all' ? overdueCustomerRows : overdueCustomerRows.slice(0, 10)}
                        formatMoney={formatMoney}
                        formatNumber={formatNumber}
                    />
                </div>

                {/* Sub-section 3: ភ្ញៀវត្រូវពិន័យ (Penalty / Receipts) */}
                <div className="payment-section payment-section-penalty">
                    <div className="payment-section-heading">
                        <h4>
                            <FaTriangleExclamation /> ភ្ញៀវត្រូវពិន័យ
                        </h4>
                        <div className="payment-section-summary">
                            <span className="payment-total">
                                សរុប <strong>{formatMoney(penaltyTotalAmount)}</strong>
                            </span>
                            <span className="payment-count">{penaltyPaymentRows.length} នាក់</span>
                        </div>
                    </div>

                    {penaltyPaymentRows.length === 0 ? (
                        <div className="table-responsive">
                            <table className="analytics-table customer-payment-table">
                                <tbody>
                                    <tr>
                                        <td colSpan={9} className="empty-table-cell">មិនមានទិន្នន័យ</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="analytics-table customer-payment-table">
                                <thead>
                                    <tr>
                                        <th>NO</th>
                                        <th>DATE</th>
                                        <th>PAYMENT TYPE</th>
                                        <th>CUSTOMER NAME</th>
                                        <th className="num">AMOUNT</th>
                                        <th>DESCRIPTION</th>
                                        <th>RECEIPT IMAGE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {penaltyPaymentRows.map((p, idx) => (
                                        <tr key={p.id}>
                                            <td data-label="NO">{idx + 1}</td>
                                            <td data-label="DATE">{p.dueDate}</td>
                                            <td data-label="PAYMENT TYPE">{p.paymentMethod || '-'}</td>
                                            <td data-label="CUSTOMER NAME">{p.category || '-'}</td>
                                            <td data-label="AMOUNT" className="num color-red">{formatMoney(p.penaltyAmount)}</td>
                                            <td data-label="DESCRIPTION">{p.description || '-'}</td>
                                            <td data-label="RECEIPT IMAGE">
                                                {p.photoUrl ? (
                                                    <button
                                                        type="button"
                                                        className="receipt-preview-button"
                                                        onClick={() => setPreviewImage(p.photoUrl)}
                                                    >
                                                        <FaImage /> View
                                                    </button>
                                                ) : 'No image'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Receipt Image Modal ── */}
            {previewImage && (
                <div
                    className="receipt-preview-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Receipt image preview"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="receipt-preview-close"
                            aria-label="Close image preview"
                            onClick={() => setPreviewImage(null)}
                        >
                            <FaXmark />
                        </button>
                        <img src={previewImage} alt="Receipt" className="receipt-preview-image" />
                    </div>
                </div>
            )}

            {/* ── Footer ── */}
            <footer className="foot">
                SYSTEM 888MDM — ផ្ទាំងគ្រប់គ្រងសង្ខេបប្រតិបត្តិ (Executive Mini Dashboard Summary)
                <span style={{ marginLeft: 8, opacity: 0.7 }}>· 🟢 Live API Connected</span>
            </footer>
        </main>
    );
};

// ── Sub-Components ──

const PipelineItem = ({ label, khmerLabel, count, percent, colorClass, trackColor }) => (
    <div className="pipeline-item">
        <div className="pipeline-labels">
            <span className="pipeline-title">
                <strong>{label}</strong> <span className="kh-sub">({khmerLabel})</span>
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

const CustomerTable = ({ rows = [], formatMoney, formatNumber }) => {
    if (rows.length === 0) {
        return (
            <div className="table-responsive">
                <table className="analytics-table customer-payment-table">
                    <tbody>
                        <tr>
                            <td colSpan={9} className="empty-table-cell">មិនមានទិន្នន័យ</td>
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
                        <th>ឈ្មោះភ្ញៀវ</th>
                        <th>លេខកិច្ចសន្យា</th>
                        <th>ថ្ងៃត្រូវបង់</th>
                        <th className="num">ត្រូវបង់ ($)</th>
                        <th className="num">បានបង់ ($)</th>
                        <th className="num">នៅសល់ ($)</th>
                        <th className="num">ពិន័យ ($)</th>
                        <th>ស្ថានភាព</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const totalDue = row.scheduledAmount + row.penaltyAmount;
                        const totalRemaining = row.outstandingAmount + row.penaltyAmount;

                        let statusLabel = 'ត្រូវបង់';
                        let statusClass = 'due';

                        if (row.isPaid || totalRemaining <= 0) {
                            statusLabel = 'បានបង់';
                            statusClass = 'paid';
                        } else if (row.penaltyAmount > 0) {
                            statusLabel = 'មានពិន័យ';
                            statusClass = 'penalty';
                        } else if (row.daysUntilDue < 0) {
                            statusLabel = `ហួសកំណត់ ${formatNumber(Math.abs(row.daysUntilDue))} ថ្ងៃ`;
                            statusClass = 'overdue';
                        } else if (row.daysUntilDue === 0) {
                            statusLabel = 'ត្រូវបង់ថ្ងៃនេះ';
                            statusClass = 'due';
                        } else if (row.daysUntilDue > 0) {
                            statusLabel = `នៅសល់ ${formatNumber(row.daysUntilDue)} ថ្ងៃត្រូវបង់`;
                            statusClass = 'due';
                        }

                        return (
                            <tr key={row.id}>
                                <td data-label="#">{idx + 1}</td>
                                <td data-label="ឈ្មោះភ្ញៀវ" className="customer-name-cell">
                                    <strong>{row.customerName}</strong>
                                    <small>{row.phone}</small>
                                </td>
                                <td data-label="កិច្ចសន្យា">{row.contractIid}</td>
                                <td data-label="ថ្ងៃត្រូវបង់">{row.dueDate || '-'}</td>
                                <td data-label="ត្រូវបង់" className="num">{formatMoney(totalDue)}</td>
                                <td data-label="បានបង់" className="num color-green">{formatMoney(row.paidAmount)}</td>
                                <td data-label="នៅសល់" className="num color-orange">{formatMoney(totalRemaining)}</td>
                                <td data-label="ពិន័យ" className="num color-red">{formatMoney(row.penaltyAmount)}</td>
                                <td data-label="ស្ថានភាព">
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
const LineChartCanvas = ({ points = [], theme = 'light' }) => {
    const isDark = theme === 'dark';
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
                            stroke={isDark ? '#232d45' : '#f1f5f9'}
                            strokeWidth="1"
                        />
                        <text
                            x={padX - 8}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="10"
                            fill={isDark ? '#94a3b8' : '#94a3b8'}
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
                            fill={isDark ? '#94a3b8' : '#64748b'}
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
                        stroke={isDark ? '#3b82f6' : '#93c5fd'}
                        strokeWidth="1"
                        strokeDasharray="3 3"
                    />
                    <g transform={`translate(${coords[hoverIdx].x > width - 150 ? -140 : 10}, 20)`}>
                        <rect
                            width="130"
                            height="72"
                            rx="8"
                            fill={isDark ? '#151c2e' : '#ffffff'}
                            stroke={isDark ? '#232d45' : '#e2e8f0'}
                            filter="drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
                        />
                        <text x="10" y="16" fontSize="11" fontWeight="700" fill={isDark ? '#f1f5f9' : '#0f172a'}>
                            {coords[hoverIdx].label}
                        </text>
                        <text x="10" y="32" fontSize="10" fill="#3b82f6" fontWeight="600">
                            ● ឥណទាន: ${Number(coords[hoverIdx].disbursed).toLocaleString()}
                        </text>
                        <text x="10" y="47" fontSize="10" fill="#10b981" fontWeight="600">
                            ● ប្រមូល: ${Number(coords[hoverIdx].collected).toLocaleString()}
                        </text>
                        <text x="10" y="62" fontSize="10" fill="#8b5cf6" fontWeight="600">
                            ● អតិថិជន: {coords[hoverIdx].customers} នាក់
                        </text>
                    </g>
                </g>
            )}
        </svg>
    );
};

export default Dashboard;
