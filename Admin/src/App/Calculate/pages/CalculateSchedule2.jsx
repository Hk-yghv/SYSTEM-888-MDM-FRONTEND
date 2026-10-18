import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaCalculator, FaCalendarAlt, FaPrint, FaUndo, FaFileContract,
    FaGem, FaHashtag, FaUser, FaSave, FaHistory, FaTrash, FaEye,
    FaSearch, FaCheckCircle, FaSpinner, FaFileInvoiceDollar
} from 'react-icons/fa';
import { MdCalculate } from 'react-icons/md';
import { roundMoney, roundPrincipalToCents, toCurrencyCents } from '../../../utils/installmentRounding';

const CalculateSchedule2 = () => {
    const { t, lang } = useLanguage();
    const { user, API_BASE } = useAuth();

    const formatDateToYMD = (d) => {
        if (!d || !(d instanceof Date) || isNaN(d)) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // ─── Form Inputs ───────────────────────────────────────────────
    const [startDate, setStartDate] = useState(() => formatDateToYMD(new Date()));
    const [customerName, setCustomerName] = useState('');
    const [assetName, setAssetName] = useState('');
    const [assetTypes, setAssetTypes] = useState([]);
    const [durationMonths, setDurationMonths] = useState('');
    const [contractNumber, setContractNumber] = useState('');
    const [principalInput, setPrincipalInput] = useState('');
    const [rateInput, setRateInput] = useState('11.5');
    const [notes, setNotes] = useState('');

    // ─── Result & UI States ─────────────────────────────────────────
    const [result, setResult] = useState(null);
    const [savedHistory, setSavedHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyLoadError, setHistoryLoadError] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
    const [activeRecordId, setActiveRecordId] = useState(null);
    const [newlyAddedId, setNewlyAddedId] = useState(null);
    const [displayLimit, setDisplayLimit] = useState(10);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [printOrientation, setPrintOrientation] = useState('landscape'); // 'portrait' | 'landscape'

    const getNextContractNumber = (records) => {
        const maxNumber = records.reduce((max, record) => {
            const value = String(record?.contractNumber || '').trim();
            if (!/^\d+$/.test(value)) return max;
            return Math.max(max, parseInt(value, 10));
        }, 0);
        return String(maxNumber + 1);
    };

    // ─── Load asset types from ControlSystem DB ────────────────────
    useEffect(() => {
        const fetchAssetTypes = async () => {
            try {
                const brand = user?.brand || '';
                const urls = brand
                    ? [`${API_BASE}/controlsystem?brand=${encodeURIComponent(brand)}`, `${API_BASE}/controlsystem?brand=`]
                    : [`${API_BASE}/controlsystem?brand=`];

                let lists = [];
                for (const url of urls) {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (data.droplists && Array.isArray(data.droplists)) {
                        const pawnCat = data.droplists.find(d =>
                            d.category === 'Pawn Asset Types' || d.category === 'ប្រភេទទ្រព្យបញ្ចាំ'
                        );
                        const deviceCat = data.droplists.find(d => d.category === 'Device Models');
                        const cat = pawnCat || deviceCat;
                        if (cat && Array.isArray(cat.items) && cat.items.length > 0) {
                            lists = cat.items;
                            break;
                        }
                    }
                }
                setAssetTypes(lists);
            } catch (err) {
                console.error('Failed to fetch asset types:', err);
            }
        };
        if (API_BASE) fetchAssetTypes();
    }, [API_BASE, user?.brand]);

    // ─── Load Saved History from DB (with silent realtime refresh support) ──────
    const fetchHistory = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setHistoryLoading(true);
            const brand = user?.brand || '';
            const username = user?.username || '';
            const role = user?.role || '';
            const isImmutable = user?.isImmutable ? 'true' : 'false';
            const userSubBrands = (user?.subBrands || []).join(',');

            const res = await fetch(
                `${API_BASE}/calculate-schedules?userBrand=${encodeURIComponent(brand)}&username=${encodeURIComponent(username)}&userRole=${encodeURIComponent(role)}&isImmutable=${isImmutable}&userSubBrands=${encodeURIComponent(userSubBrands)}&_t=${Date.now()}`
            );
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.success || !Array.isArray(data.data)) {
                throw new Error(data.error || 'Invalid calculate schedules response');
            }
            setSavedHistory(data.data);
            setHistoryLoadError(false);
            setContractNumber(current => current || getNextContractNumber(data.data));
        } catch (err) {
            console.error('Error loading saved calculation history:', err);
            setHistoryLoadError(true);
        } finally {
            if (!isSilent) setHistoryLoading(false);
        }
    }, [API_BASE, user?.brand, user?.username, user?.role, user?.isImmutable, user?.subBrands]);

    const [searchParams] = useSearchParams();

    // ─── Realtime SSE Stream & Polling Sync for Saved Props ─────────
    useEffect(() => {
        if (!API_BASE) return;

        // Initial fetch with spinner
        fetchHistory(false);

        // Instant Realtime SSE (Server-Sent Events) push
        let eventSource = null;
        try {
            const streamUrl = `${API_BASE}/calculate-schedules/stream`;
            eventSource = new EventSource(streamUrl);

            eventSource.onmessage = (e) => {
                try {
                    const eventData = JSON.parse(e.data);
                    if (eventData.type === 'CREATED' && eventData.data) {
                        const newDoc = eventData.data;
                        setSavedHistory(prev => [newDoc, ...prev.filter(item => String(item._id) !== String(newDoc._id))]);
                        setNewlyAddedId(newDoc._id);
                        setTimeout(() => {
                            setNewlyAddedId(null);
                        }, 5000);
                        fetchHistory(true);
                    } else if (eventData.type === 'DELETED' && eventData.id) {
                        setSavedHistory(prev => prev.filter(item => String(item._id) !== String(eventData.id)));
                    }
                } catch (err) {
                    // Ignore non-json heartbeats
                }
            };
        } catch (err) {
            console.warn('SSE initialization notice:', err);
        }

        // Realtime fallback polling every 2.5 seconds silently
        const pollInterval = setInterval(() => {
            fetchHistory(true);
        }, 2500);

        // Sync immediately when tab is focused / becomes visible
        const handleSync = () => {
            if (document.visibilityState === 'visible') {
                fetchHistory(true);
            }
        };

        window.addEventListener('focus', handleSync);
        document.addEventListener('visibilitychange', handleSync);

        // Cross-tab sync listener
        const handleStorage = (e) => {
            if (e.key === 'calc_schedules_updated') {
                fetchHistory(true);
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (eventSource) {
                eventSource.close();
            }
            clearInterval(pollInterval);
            window.removeEventListener('focus', handleSync);
            document.removeEventListener('visibilitychange', handleSync);
            window.removeEventListener('storage', handleStorage);
        };
    }, [API_BASE, fetchHistory]);

    // ─── Auto load record from Query Parameters ─────────────────────
    useEffect(() => {
        const customerQuery = searchParams.get('customerName');
        const idQuery = searchParams.get('id');
        const contractNumQuery = searchParams.get('contractNumber');

        if (savedHistory.length > 0 && (customerQuery || idQuery || contractNumQuery)) {
            const found = savedHistory.find(item =>
                (idQuery && String(item._id) === String(idQuery)) ||
                (customerQuery && item.customerName && item.customerName.trim().toLowerCase().replace(/\s+/g, ' ') === customerQuery.trim().toLowerCase().replace(/\s+/g, ' ')) ||
                (contractNumQuery && item.contractNumber && item.contractNumber.trim() === contractNumQuery.trim())
            );
            if (found) {
                handleLoadRecord(found);
            }
        }
    }, [savedHistory, searchParams]);

    // ─── Helpers ───────────────────────────────────────────────────
    const parseRate = (val) => {
        const clean = String(val).replace(/%/g, '').trim();
        const n = parseFloat(clean);
        return isNaN(n) ? 0 : n;
    };

    const addMonthsSafe = (baseDate, originalDay, months) => {
        const d = new Date(baseDate);
        d.setDate(1);
        d.setMonth(d.getMonth() + months);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(originalDay, lastDay));
        return d;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
    };

    const followsInstallmentFormula = (record) => {
        const months = Number(record?.months);
        const schedule = record?.schedule;
        if (!Number.isInteger(months) || months < 2 || !Array.isArray(schedule) || schedule.length !== months) {
            return false;
        }

        const totalDueAmounts = schedule.map(row => {
            if (row?.totalDueMonth === undefined || row?.totalDueMonth === null || row.totalDueMonth === '') return null;
            const amount = Number(row.totalDueMonth);
            return Number.isFinite(amount) ? toCurrencyCents(amount) : null;
        });
        if (totalDueAmounts.some(amount => amount === null)) return false;

        const regularAmount = totalDueAmounts[0];
        const regularMonthsMatch = totalDueAmounts.slice(1, -1).every(amount => amount === regularAmount);
        const finalMonthDiffers = totalDueAmounts[months - 1] !== regularAmount;
        return regularMonthsMatch && finalMonthDiffers;
    };

    // ─── Calculate ─────────────────────────────────────────────────
    const handleCalculate = (e) => {
        if (e) e.preventDefault();
        const principal = parseFloat(principalInput) || 0;
        const ratePercent = parseRate(rateInput);
        const months = parseInt(durationMonths, 10) || 1;

        if (principal <= 0) return null;

        const monthlyInterest = roundMoney(principal * (ratePercent / 100));
        const principalCents = toCurrencyCents(principal);
        const roundedMonthlyPrincipalCents = roundPrincipalToCents(principal / months);

        const baseDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
        const originalDay = baseDate.getDate();

        const schedule = [];
        let remainingPrincipalCents = principalCents;

        for (let i = 1; i <= months; i++) {
            const dueDate = addMonthsSafe(baseDate, originalDay, i);

            // ប្រាក់ដើមដែលត្រូវបង់ក្នុងខែនេះ
            const principalPaymentCents = i === months
                ? remainingPrincipalCents
                : Math.min(remainingPrincipalCents, roundedMonthlyPrincipalCents);
            const principalPayment = principalPaymentCents / 100;
            const totalDueMonth = roundMoney(principalPayment + monthlyInterest);

            // ដកប្រាក់ដើមដែលបានបង់
            remainingPrincipalCents -= principalPaymentCents;

            schedule.push({
                no: i,
                dueDate: formatDateToYMD(dueDate),
                principal,
                monthlyPrincipal: principalPayment,
                interestAndFee: monthlyInterest,
                totalDueMonth,

                // សមតុល្យនៅសល់
                remainingBalance: Math.max(0, remainingPrincipalCents / 100),
            });
        }

        const calcData = {
            principal,
            ratePercent,
            months,
            monthlyPrincipal: schedule[0]?.monthlyPrincipal || 0,
            monthlyTotalDue: schedule[0]?.totalDueMonth || 0,
            monthlyInterest,
            totalInterest: roundMoney(monthlyInterest * months),
            totalRepayment: roundMoney(schedule.reduce((sum, row) => sum + row.totalDueMonth, 0)),
            schedule,
            startDate,
            customerName: customerName.trim(),
            assetName: assetName.trim(),
            contractNumber: contractNumber.trim(),
            notes: notes.trim(),
        };

        setResult(calcData);
        return calcData;
    };

    // Auto calculate when inputs are valid
    useEffect(() => {
        if (principalInput && rateInput && durationMonths) {
            handleCalculate();
        } else {
            setResult(null);
        }
    }, [startDate, principalInput, rateInput, durationMonths, customerName, assetName, contractNumber]);

    // ─── Save to Database ──────────────────────────────────────────
    const handleSave = async () => {
        let calcData = result;
        if (!calcData) {
            calcData = handleCalculate();
            if (!calcData) return;
        }

        try {
            setSaving(true);
            const payload = {
                contractNumber: calcData.contractNumber || contractNumber,
                customerName: calcData.customerName || customerName,
                assetName: calcData.assetName || assetName,
                assetType: '',
                startDate: calcData.startDate || startDate,
                principal: calcData.principal,
                ratePercent: calcData.ratePercent,
                months: calcData.months,
                monthlyInterest: calcData.monthlyInterest,
                totalInterest: calcData.totalInterest,
                schedule: calcData.schedule,
                brand: user?.brand || '',
                subBrand: user?.subBrands?.[0] || '',
                createdBy: user?.username || user?.name || 'Staff',
                notes: notes.trim()
            };

            const res = await fetch(`${API_BASE}/calculate-schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setSaveSuccessMsg('រក្សាទុកបានជោគជ័យ!');
                setTimeout(() => setSaveSuccessMsg(''), 3500);
                if (data.data) {
                    const savedDoc = data.data;
                    if (savedDoc._id) {
                        setActiveRecordId(savedDoc._id);
                        setNewlyAddedId(savedDoc._id);
                        setTimeout(() => setNewlyAddedId(null), 5000);
                    }
                    setSavedHistory(prev => [savedDoc, ...prev.filter(item => String(item._id) !== String(savedDoc._id))]);
                }
                localStorage.setItem('calc_schedules_updated', Date.now().toString());
                fetchHistory(true);
            } else {
                alert(`${t('calculateSaveFailed', lang === 'km' ? 'បរាជ័យក្នុងការរក្សាទុក' : 'Failed to save')}: ${data.error || t('serverError', lang === 'km' ? 'កំហុសម៉ាស៊ីនមេ' : 'Server error')}`);
            }
        } catch (err) {
            console.error('Error saving schedule:', err);
            alert(t('networkError', lang === 'km' ? 'មានបញ្ហាក្នុងការតភ្ជាប់ទៅម៉ាស៊ីនមេ!' : 'Server connection error.'));
        } finally {
            setSaving(false);
        }
    };

    // ─── Load Record from History ───────────────────────────────────
    const handleLoadRecord = (record) => {
        setActiveRecordId(record._id);
        setCustomerName(record.customerName || '');
        setContractNumber(record.contractNumber || '');
        setAssetName(record.assetName || '');
        setStartDate(record.startDate || formatDateToYMD(new Date()));
        setPrincipalInput(String(record.principal || 120));
        setRateInput(String(record.ratePercent || 11.5));
        setDurationMonths(String(record.months || 4));
        setNotes(record.notes || '');

        setResult({
            principal: record.principal,
            ratePercent: record.ratePercent,
            months: record.months,
            monthlyInterest: record.monthlyInterest,
            totalInterest: record.totalInterest,
            schedule: record.schedule || [],
            startDate: record.startDate,
            customerName: record.customerName || '',
            assetName: record.assetName || '',
            contractNumber: record.contractNumber || '',
            notes: record.notes || ''
        });

        setTimeout(() => {
            const previewEl = document.getElementById('cs2-print-area');
            if (previewEl) {
                previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    // ─── Delete Record from History ────────────────────────────────
    const handleDeleteRecord = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(t('calculateConfirmDelete', lang === 'km' ? 'តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?' : 'Are you sure you want to delete this record?'))) return;

        try {
            const res = await fetch(`${API_BASE}/calculate-schedules/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                if (activeRecordId === id) setActiveRecordId(null);
                setSavedHistory(prev => prev.filter(item => item._id !== id));
                localStorage.setItem('calc_schedules_updated', Date.now().toString());
            } else {
                alert(t('calculateDeleteFailed', lang === 'km' ? 'មិនអាចលុបទិន្នន័យបានទេ' : 'Unable to delete the record.'));
            }
        } catch (err) {
            console.error('Error deleting record:', err);
        }
    };

    // ─── Reset ─────────────────────────────────────────────────────
    const handleReset = () => {
        setCustomerName('');
        setPrincipalInput('');
        setRateInput('11.5');
        setDurationMonths('');
        setStartDate(formatDateToYMD(new Date()));
        setAssetName('');
        setContractNumber(getNextContractNumber(savedHistory));
        setNotes('');
        setResult(null);
        setActiveRecordId(null);
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredHistory = savedHistory.filter(item => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase();
        return (
            (item.customerName && item.customerName.toLowerCase().includes(q)) ||
            (item.contractNumber && item.contractNumber.toLowerCase().includes(q)) ||
            (item.assetName && item.assetName.toLowerCase().includes(q))
        );
    });

    // Reset pagination when search query changes
    useEffect(() => {
        setDisplayLimit(10);
    }, [historySearch]);

    const displayedHistory = filteredHistory.slice(0, displayLimit);
    const hasMoreHistory = filteredHistory.length > displayLimit;

    const handleHistoryScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 60 && hasMoreHistory) {
            setDisplayLimit(prev => Math.min(prev + 10, filteredHistory.length));
        }
    };

    const formatDateWithWeekday = (dateStr) => {
        if (!dateStr) return '';

        const [y, m, d] = dateStr.split('-');
        const date = new Date(`${y}-${m}-${d}T00:00:00`);

        const localeByLanguage = {
            km: 'km-KH',
            en: 'en-US',
            ja: 'ja-JP',
            th: 'th-TH',
            vi: 'vi-VN',
            zh: 'zh-CN',
            ko: 'ko-KR',
            ru: 'ru-RU',
            la: 'lo-LA'
        };
        const weekday = new Intl.DateTimeFormat(localeByLanguage[lang] || 'en-US', {
            weekday: 'long'
        }).format(date);

        return `${d}-${m}-${y} ${weekday}`;
    };
    const formatMoney = (value) => {
        if (value === null || value === undefined || value === '') return '';

        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    return (
        <>
            <style>{`
                @page {
                    size: A4 ${printOrientation};
                    margin: ${printOrientation === 'landscape' ? '8mm 0mm' : '10mm 0mm'};
                }
                @media print {
                    html, body {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 100% !important;
                        max-height: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print,
                    .no-print *,
                    header,
                    aside,
                    nav,
                    .mobile-sidebar,
                    .mobile-bottom-nav,
                    #floating-display-uplist {
                        display: none !important;
                        height: 0 !important;
                        min-height: 0 !important;
                        max-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        visibility: hidden !important;
                        overflow: hidden !important;
                    }
                    #root,
                    #root > div,
                    main,
                    .mobile-content-area,
                    .calculate-schedule-root,
                    .max-w-7xl,
                    .space-y-6 {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        max-height: none !important;
                        min-height: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        display: block !important;
                        position: static !important;
                        overflow: visible !important;
                        background: transparent !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    #cs2-print-area {
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        max-width: ${printOrientation === 'landscape' ? '297mm' : '210mm'} !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: #ffffff !important;
                        overflow: visible !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    #cs2-print-area div.overflow-x-auto,
                    #cs2-print-area div[class*="overflow-x-auto"] {
                        min-height: auto !important;
                        padding-bottom: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    #cs2-print-area table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        margin: 0 auto !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    #cs2-print-area tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    #cs2-print-area table th,
                    #cs2-print-area table td {
                        border: 1px solid #000000 !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #cs2-print-area .cs2-meta-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        width: 100% !important;
                        column-gap: 32px !important;
                    }
                    #cs2-print-area .cs2-meta-row {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        width: 100% !important;
                    }
                    #cs2-print-area .cs2-page-margin {
                        padding-left: 150px !important;
                        padding-right: 150px !important;
                    }
                    #cs2-print-area .cs2-signature-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        width: 100% !important;
                        column-gap: 32px !important;
                        text-align: center !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    #cs2-print-area .cs2-signature-col {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        text-align: center !important;
                        width: 100% !important;
                    }
                    #cs2-print-area .cs2-signature-line {
                        width: 180px !important;
                        margin: 48px auto 0 auto !important;
                        border-bottom: 1px dotted #94a3b8 !important;
                    }
                    #cs2-print-area .cs2-address-footer {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
                #cs2-print-area .cs2-page-margin {
                    padding-left: 150px;
                    padding-right: 150px;
                }
                #cs2-print-area .cs2-signature-line {
                    margin: 64px auto 0 auto;
                }
                @media (max-width: 768px) {
                    #cs2-print-area .cs2-page-margin {
                        padding-left: 16px;
                        padding-right: 16px;
                    }
                }
            `}</style>

            <div data-allow-scroll="true" className="calculate-schedule-root p-2 sm:p-2 max-w-7xl mx-auto space-y-6 bg-[#fff]">

                {/* ── Header ────────────────────────────────────────── */}
                <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#fff] p-5 rounded-[5px] border border-slate-200 shadow-xs">
                    <div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                កាលវិភាគបញ្ចាំ
                            </h1>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 no-print">
                        {savedHistory.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowHistoryModal(true)}
                                className="px-4 py-2.5 rounded-[5px] bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs sm:text-sm flex items-center gap-2 border border-violet-200 transition-all cursor-pointer">
                                <FaHistory /> {t('history', lang === 'km' ? 'បញ្ជីចាស់ៗ' : 'History')} ({savedHistory.length})
                            </button>
                        )}
                        {result && (
                            <>
                                {/* Orientation Selection Toggle */}
                                <div className="flex items-center bg-slate-100 p-2 rounded-[5px] border border-slate-200 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setPrintOrientation('portrait')}
                                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${printOrientation === 'portrait'
                                            ? 'bg-white text-violet-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        title={t('calculatePrintPortrait', lang === 'km' ? 'បោះពុម្ពទម្រង់បញ្ឈរ (Portrait)' : 'Print in portrait orientation')}>
                                        <span>📄</span>
                                        <span>{t('portrait', lang === 'km' ? 'បញ្ឈរ' : 'Portrait')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrintOrientation('landscape')}
                                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${printOrientation === 'landscape'
                                            ? 'bg-white text-violet-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        title={t('calculatePrintLandscape', lang === 'km' ? 'បោះពុម្ពទម្រង់ប្ដេក (Landscape)' : 'Print in landscape orientation')}>
                                        <span>📑</span>
                                        <span>{t('landscape', lang === 'km' ? 'ប្ដេក' : 'Landscape')}</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
                                    {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                    {t('save', lang === 'km' ? 'រក្សាទុក' : 'Save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-4 py-2.5 rounded-[5px] bg-green-800 hover:bg-slate-800 text-white text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer">
                                    <FaPrint /> {t('print', lang === 'km' ? 'បោះពុម្ព' : 'Print')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Save Success Alert */}
                {saveSuccessMsg && (
                    <div className="no-print p-2 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 animate-fadeIn">
                        <FaCheckCircle className="text-emerald-600 text-lg" />
                        <span>{saveSuccessMsg} ព័ត៌មានត្រូវបានរក្សាទុក ដោយជោគជ័យ។</span>
                    </div>
                )}

                {/* Main Grid: Form Inputs + Saved Records Sidebar */}
                <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6" >

                    {/* ── Left Column (2 cols): Input Form ──────────── */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[#fff] border border-slate-200 rounded-[5px] p-5 sm:p-2 shadow-xs">
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                                <FaCalculator className="text-violet-600 text-base" />
                                <h2 className="text-base text-slate-800">
                                    បញ្ចូលព័ត៌មានកិច្ចសន្យា
                                </h2>
                            </div>

                            <form onSubmit={handleCalculate} className="space-y-4">
                                {/* Row 1: Start Date, Customer Name, Asset Name */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Start Date */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            ថ្ងៃខែឆ្នាំដាក់បញ្ចាំ <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><FaCalendarAlt /></span>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                required
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Customer Name */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            ឈ្មោះអតិថិជន <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><FaUser /></span>
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder={t('calculateCustomerNameExample', lang === 'km' ? 'ឧ. ចន ពេជ្រច័ន្ទដារ៉ា' : 'e.g. ចន ពេជ្រច័ន្ទដារ៉ា')}
                                                required
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Asset Name with Droplist */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            ប្រភេទទ្រព្យបញ្ចាំ <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><FaGem /></span>
                                            <input
                                                type="text"
                                                list="cs2-asset-list"
                                                value={assetName}
                                                onChange={(e) => setAssetName(e.target.value)}
                                                placeholder={t('calculateAssetNameExample', lang === 'km' ? 'ឧ. iPhone 14' : 'e.g. iPhone 14')}
                                                required
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                            <datalist id="cs2-asset-list">
                                                {assetTypes.map((item, i) => <option key={i} value={item} />)}
                                            </datalist>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Duration | Contract No | Principal | Rate */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Duration */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            {t('duration', lang === 'km' ? 'រយៈពេល' : 'Duration')} <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm">#</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={durationMonths}
                                                onChange={(e) => setDurationMonths(e.target.value)}
                                                placeholder="4"
                                                required
                                                className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {[1, 2, 3, 4, 6, 12].map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setDurationMonths(String(m))}
                                                    className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer ${durationMonths === String(m)
                                                        ? 'bg-violet-600 text-white border-violet-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}>
                                                    {m}ខែ
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Contract Number */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            លេខកិច្ចសន្យា
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><FaHashtag /></span>
                                            <input
                                                type="text"
                                                value={contractNumber}
                                                onChange={(e) => setContractNumber(e.target.value)}
                                                placeholder={t('calculateContractNumberExample', lang === 'km' ? 'ឧ. 013' : 'e.g. 013')}
                                                className="w-full pl-9 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Principal */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            ប្រាក់ដើម <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">$</span>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                value={principalInput}
                                                onChange={(e) => setPrincipalInput(e.target.value)}
                                                placeholder="120"
                                                required
                                                className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {[100, 120, 200, 500].map(a => (
                                                <button
                                                    key={a}
                                                    type="button"
                                                    onClick={() => setPrincipalInput(String(a))}
                                                    className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer ${principalInput === String(a)
                                                        ? 'bg-violet-600 text-white border-violet-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}>
                                                    ${a}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Rate */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs text-slate-700">
                                            អត្រា % <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">%</span>
                                            <input
                                                type="text"
                                                value={rateInput}
                                                onChange={(e) => setRateInput(e.target.value)}
                                                placeholder="11.5"
                                                required
                                                className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-[#fff] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {['11.5', '10', '12', '15'].map(r => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => setRateInput(r)}
                                                    className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer ${rateInput === r
                                                        ? 'bg-violet-600 text-white border-violet-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}>
                                                    {r}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-3 pt-3">
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 rounded-[5px] bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black text-sm flex items-center gap-2 shadow-md shadow-violet-600/25 transition-all transform active:scale-95 cursor-pointer">
                                        <MdCalculate className="text-lg" /> {t('calculate', lang === 'km' ? 'គណនា' : 'Calculate')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-5 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all transform active:scale-95 cursor-pointer">
                                        {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                        រក្សាទុក
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="px-4 py-2.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm flex items-center gap-1.5 transition-colors cursor-pointer">
                                        <FaUndo className="text-xs text-slate-500" /> Reset
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Right Column (1 col): Saved History Props List ── */}
                    <div className="lg:col-span-1 bg-[#fff] border border-slate-200 rounded-[5px] p-5 shadow-xs flex flex-col h-[480px]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <FaHistory className="text-violet-600" />
                                <h3 className="font-bold text-sm text-slate-800">
                                    បញ្ជីបានរក្សាទុក
                                </h3>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Realtime
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 font-bold">
                                {displayedHistory.length > 0 ? `${displayedHistory.length}/${filteredHistory.length}` : filteredHistory.length}
                            </span>
                            <button
                                type="button"
                                onClick={() => fetchHistory(false)}
                                aria-label={t('reload')}
                                title={t('reload')}
                                disabled={historyLoading}
                                className="ml-2 p-1.5 rounded text-slate-500 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                            >
                                <FaUndo className={historyLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {/* Search in History */}
                        <div className="py-1">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs"><FaSearch /></span>
                                <input
                                    type="text"
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    placeholder={t('calculateHistorySearch', lang === 'km' ? 'ស្វែងរកតាមឈ្មោះ ឬលេខកិច្ចសន្យា...' : 'Search by name or contract...')}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-[#fff] focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        {/* History Records Scrollable List */}
                        <div
                            onScroll={handleHistoryScroll}
                            className="flex-1 overflow-y-auto space-y-2 pr-1 scroll-smooth">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-xs gap-2">
                                    <FaSpinner className="animate-spin text-lg text-violet-500" />
                                    <span>{t('loading', lang === 'km' ? 'កំពុងទាញយកទិន្នន័យ...' : 'Loading data...')}</span>
                                </div>
                            ) : historyLoadError && savedHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-rose-500 text-xs text-center p-2">
                                    <span>{t('calculateHistoryLoadFailed', lang === 'km' ? 'មិនអាចទាញយកប្រវត្តិកាលវិភាគបានទេ។ សូមព្យាយាមម្ដងទៀត។' : 'Unable to load saved schedules. Please try again.')}</span>
                                    <button
                                        type="button"
                                        onClick={() => fetchHistory(false)}
                                        className="mt-2 px-3 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
                                    >
                                        {t('reload')}
                                    </button>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-xs text-center p-2">
                                    <FaFileInvoiceDollar className="text-3xl text-slate-300 mb-2" />
                                    <span>{t('calculateNoSavedData', lang === 'km' ? 'មិនទាន់មានទិន្នន័យបានរក្សាទុកទេ' : 'No saved data yet')}</span>
                                    <span className="text-[11px] text-slate-400 mt-1">{t('calculateSaveScheduleHint', lang === 'km' ? 'ចុចប៊ូតុង "រក្សាទុក (Save)" ដើម្បីរក្សាទុកកាលវិភាគ' : 'Click "Save" to save the schedule.')}</span>
                                </div>
                            ) : (
                                <>
                                    {displayedHistory.map((item) => {
                                        const isNewlyAdded = newlyAddedId === item._id;
                                        const isActive = activeRecordId === item._id;
                                        const followsFormula = followsInstallmentFormula(item);
                                        return (
                                            <div
                                                key={item._id}
                                                onClick={() => handleLoadRecord(item)}
                                                className={`p-2 rounded-[5px] border text-xs cursor-pointer transition-all ${followsFormula
                                                    ? 'bg-red-50 border-red-500 shadow-xs ring-1 ring-red-400'
                                                    : isNewlyAdded
                                                        ? 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-400 animate-pulse'
                                                        : isActive
                                                            ? 'bg-violet-50 border-violet-400 shadow-xs ring-1 ring-violet-400'
                                                            : 'bg-[#fff] border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                                                    }`}>
                                                <div className="flex items-start justify-between gap-1">
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                                                        <span>{item.customerName || t('generalCustomer')}</span>
                                                        {isNewlyAdded && (
                                                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-600 text-white font-bold tracking-tight animate-bounce">
                                                                {t('newRecord')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteRecord(item._id, e)}
                                                            title={t('delete')}
                                                            className="p-2 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors">
                                                            <FaTrash className="text-[10px]" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="text-slate-500 text-[11px] mt-1 flex items-center justify-between">
                                                    <span>{item.assetName} {item.contractNumber ? `(#${item.contractNumber})` : ''}</span>
                                                    <span className="font-bold text-slate-700 font-mono">${item.principal}</span>
                                                </div>

                                                <div className="text-slate-400 text-[10px] mt-1 flex items-center justify-between pt-1 border-t border-slate-100">
                                                    <span>{formatDate(item.startDate)} • {item.months} {t('months', lang === 'km' ? 'ខែ' : 'months')}</span>
                                                    <span className="text-violet-600 font-semibold font-mono">{t('interest', lang === 'km' ? 'ការប្រាក់' : 'Interest')} ${item.monthlyInterest}/{t('month', lang === 'km' ? 'ខែ' : 'month')}</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Load More Indicator / Button on bottom */}
                                    {hasMoreHistory && (
                                        <div className="py-2.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setDisplayLimit(prev => Math.min(prev + 10, filteredHistory.length))}
                                                className="w-full py-1.5 px-3 rounded-lg text-[11px] bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold border border-violet-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                                                <span>{t('loadMore', lang === 'km' ? 'ទាញយកបន្ថែម' : 'Load more')} +10 ({displayedHistory.length}/{filteredHistory.length})</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Print Document Preview ─────────────────────── */}
                {result && (
                    <div
                        id="cs2-print-area"
                        className="bg-[#fff] overflow-hidden w-full mx-auto"
                        style={{ fontFamily: "'Noto Serif Khmer', 'Khmer OS Battambang', serif" }}>

                        {/* KH Royal Header */}
                        <div className="text-center pt-8 px-8">
                            <p className="text-sm text-slate-700 tracking-widest" style={{ fontFamily: 'moul' }}>
                                ព្រះរាជាណាចក្រកម្ពុជា
                            </p>
                            <p className="text-sm text-slate-700 tracking-widest" style={{ fontFamily: 'moul' }}>
                                ជាតិ សាសនា ព្រះមហាក្សត្រ
                            </p>
                            <p className="text-sm text-slate-700 tracking-widest text-[18px]">
                                {'\u{1F65C}'}{'\u{1F65C}'}{'\u{1F66A}'}{'\u{1F65E}'}{'\u{1F65E}'}
                            </p>
                            <div className="flex justify-center my-2">
                                <div className="h-0.5 w-32 bg-slate-300 rounded" />
                            </div>
                            <h4 className="text-[#2750F5] text-[14px] mt-2" style={{ fontFamily: 'moul' }}>
                                កាលវិភាគសងប្រាក់
                            </h4>
                        </div>

                        {/* Meta Info */}
                        <div className="cs2-meta-grid cs2-page-margin py-4 grid grid-cols-2 gap-x-12 gap-y-2 text-xs w-full">
                            {/* Left Meta */}
                            <div className="space-y-2 w-full">
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="whitespace-nowrap text-slate-800 text-[13px]">{t('pawnDate', lang === 'km' ? 'ថ្ងៃខែឆ្នាំដាក់បញ្ចាំ:' : 'Pawn date:')}</span>
                                    <span className="text-blue-500 font-bold  text-[13px]">
                                        {formatDate(result.startDate)}
                                    </span>
                                </div>
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800  text-[13px]">{t('pawnAmount', lang === 'km' ? 'ចំនួនទឹកប្រាក់បញ្ចាំ:' : 'Pawn amount:')}</span>
                                    <span className="text-blue-500 font-bold  text-[13px]">
                                        {result.principal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                                    </span>
                                </div>
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800  text-[13px]">{t('durationMonths', lang === 'km' ? 'រយៈពេល (ចំនួនខែ):' : 'Duration (months):')}</span>
                                    <span className="text-blue-500 font-bold text-right  text-[13px]">{result.months}</span>
                                </div>
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800 text-[13px]">{t('interestAndRentalFee', lang === 'km' ? 'ការប្រាក់ និងសេវាជួល:' : 'Interest and rental fee:')}</span>
                                    <span className="font-black text-right  text-[13px] text-blue-500">
                                        {result.monthlyInterest.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Right Meta */}
                            <div className="space-y-2 text-left w-full">
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800  text-[13px]">{t('customerName', lang === 'km' ? 'ឈ្មោះអតិថិជន:' : 'Customer name:')}</span>
                                    <span className="text-blue-500 font-bold  text-[13px] text-right">{result.customerName || '—'}</span>
                                </div>
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800 text-[13px]">{t('pawnAssetType', lang === 'km' ? 'ប្រភេទទ្រព្យបញ្ចាំ:' : 'Pawn asset type:')}</span>
                                    <span className="text-blue-500 font-bold text-[13px] text-right">{result.assetName || '—'}</span>
                                </div>
                                <div className="cs2-meta-row flex items-center justify-between w-full">
                                    <span className="text-slate-800 text-[13px]">{t('contractNumber', lang === 'km' ? 'លេខកិច្ចសន្យា:' : 'Contract number:')}</span>
                                    <span className="text-blue-500 font-bold text-[13px] text-right">
                                        {result.contractNumber || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Schedule Table */}
                        <div className="overflow-x-auto cs2-page-margin">
                            <table className="w-full border-collapse border border-black text-xs sm:text-sm">
                                <tbody>
                                    <tr className='border border-black'>
                                        <th className="px-4 py-1 border border-black text-[11px]"><span className='text-black text-bold text-[13px]'>{t('monthNumberLabel', lang === 'km' ? 'ខែទី' : 'Month')}</span></th>
                                        <th className="px-4 py-1 border border-black text-[11px]"><span className='text-black text-bold text-[13px]'>{t('paymentDate', lang === 'km' ? 'ថ្ងៃបង់ប្រាក់' : 'Payment date')}</span></th>
                                        <th className="px-4 py-1 border border-black text-[11px]"><span className='text-black text-bold text-[13px]'>{t('totalAmountDue', lang === 'km' ? 'ទឹកប្រាក់ត្រូវបង់សរុប' : 'Total amount due')}</span></th>
                                        <th className="px-4 py-1 border border-black text-[11px]"><span className='text-black text-bold text-[13px]'>{t('interestDue', lang === 'km' ? 'ការប្រាក់ត្រូវបង់' : 'Interest due')}</span></th>
                                        <th className="px-4 py-1 border border-black text-[11px]"><span className='text-black text-bold text-[13px]'>{t('remainingBalance', lang === 'km' ? 'សមតុល្យនៅសល់' : 'Remaining balance')}</span></th>
                                    </tr>
                                </tbody>
                                <tbody>
                                    {result.schedule.map((row) => (
                                        <tr key={row.no}
                                            className="text-center">
                                            <td className="px-3 border border-black text-slate-900">{row.no}</td>
                                            <td className="px-4 border border-black text-slate-900 text-left py-1">
                                                {formatDateWithWeekday(row.dueDate)}
                                            </td>
                                            <td className="px-4 border border-black text-slate-900">
                                                {row.totalDueMonth ? row.totalDueMonth.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : ''}
                                            </td>
                                            <td className="px-4 border border-black text-slate-900">
                                                {result.monthlyInterest.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-3 border border-black text-slate-900">
                                                {formatMoney(row.remainingBalance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className='text-left mt-4 text-[12px] font-bold '>
                                <span className='text-red-900'>{t('note', lang === 'km' ? 'ចំណាំ ៖' : 'Note:')}</span> {t('calculateInterestRefundNotice', lang === 'km' ? 'ករណីអតិថិជនបង់ការប្រាក់រួចហើយ អតិថិជនមិនអាចដកប្រាក់វិញបានទេ (ដោយគ្មានលក្ខខណ្ឌ) ។' : 'Once the customer has paid interest, it is non-refundable under any circumstances.')}
                            </p>
                        </div>

                        {/* Signature Block */}
                        <div className="cs2-signature-grid w-full mt-6 cs2-page-margin pb-1 grid grid-cols-2 gap-12 text-xs text-slate-800">
                            <div className="cs2-signature-col flex flex-col items-center justify-center text-center w-full">
                                <p className="text-[13px] font-bold text-slate-800 text-center w-full" style={{ fontFamily: 'moul' }}>{t('companyRepresentative', lang === 'km' ? 'តំណាងក្រុមហ៊ុន' : 'Company representative')}</p>
                                <div className="cs2-signature-line mt-16 border-b border-dotted border-slate-400 w-[180px] mx-auto" />
                            </div>
                            <div className="cs2-signature-col flex flex-col items-center justify-center text-center w-full">
                                <p className="text-[13px] font-bold text-slate-800 text-center w-full" style={{ fontFamily: 'moul' }}>{t('customerName', lang === 'km' ? 'ឈ្មោះអតិថិជន' : 'Customer name')}</p>
                                <div className="cs2-signature-line mt-16 border-b border-dotted border-slate-400 w-[180px] mx-auto" />
                            </div>
                        </div>

                        {/* Address Footer */}
                        <div className="cs2-address-footer text-center pb-4 text-[12px] pt-8 mt-6 cs2-page-margin" style={{ fontFamily: 'khmer' }}>
                            {t('companyAddress', lang === 'km' ? 'អាសយដ្ឋាន: អគារលេខ378A ផ្លូវ1928 ភូមិកោះអណ្តែត សង្កាត់ទួលសង្កែទី២ ខណ្ឌឬស្សីកែវ រាជធានីភ្នំពេញ' : 'Address: Building 378A, Street 1928, Koh Andet Village, Sangkat Toul Sangke 2, Khan Russey Keo, Phnom Penh')}
                        </div>
                    </div>
                )}

                {/* ── Full History Modal (if user wants bigger view) ──── */}
                {showHistoryModal && (
                    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2">
                        <div className="bg-[#fff] rounded-[5px] max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
                            <div className="p-2 sm:p-2 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaHistory className="text-violet-600 text-lg" />
                                    <h3 className="font-black text-base text-slate-800">
                                        {t('savedHistory', lang === 'km' ? 'ប្រវត្តិបានរក្សាទុក' : 'Saved history')} ({savedHistory.length})
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryModal(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer">
                                    ✕
                                </button>
                            </div>

                            <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><FaSearch /></span>
                                    <input
                                        type="text"
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        placeholder={t('calculateCustomerSearch', lang === 'km' ? 'ស្វែងរកតាមឈ្មោះអតិថិជន លេខកិច្ចសន្យា ឬប្រភេទទ្រព្យ...' : 'Search by customer name, contract number, or asset type...')}
                                        className="w-full pl-9 pr-3.5 py-2 rounded-[5px] border border-slate-200 text-sm bg-slate-50 focus:bg-[#fff] focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {filteredHistory.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 text-sm">
                                        {t('noDataToDisplay', lang === 'km' ? 'មិនមានទិន្នន័យត្រូវបង្ហាញទេ' : 'No data to display')}
                                    </div>
                                ) : (
                                    filteredHistory.map((item) => (
                                        <div
                                            key={item._id}
                                            className={`p-2 rounded-[5px] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${followsInstallmentFormula(item) ? 'border-red-500 bg-red-50/30' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/20'}`}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800 text-sm">
                                                        {item.customerName || t('generalCustomer', lang === 'km' ? 'អតិថិជនទូទៅ' : 'General customer')}
                                                    </span>
                                                    {item.contractNumber && (
                                                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600">
                                                            #{item.contractNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span>{t('asset', lang === 'km' ? 'ទ្រព្យ' : 'Asset')}: <strong className="text-slate-700">{item.assetName}</strong></span>
                                                    <span>{t('startDate', lang === 'km' ? 'ថ្ងៃចាប់ផ្តើម' : 'Start date')}: <strong className="text-slate-700 font-mono">{formatDate(item.startDate)}</strong></span>
                                                    <span>{t('duration', lang === 'km' ? 'រយៈពេល' : 'Duration')}: <strong className="text-slate-700">{item.months} {t('months', lang === 'km' ? 'ខែ' : 'months')}</strong></span>
                                                    <span>{t('principal', lang === 'km' ? 'ប្រាក់ដើម' : 'Principal')}: <strong className="text-emerald-700 font-mono">${item.principal}</strong></span>
                                                    <span>{t('monthlyInterest', lang === 'km' ? 'ការប្រាក់/ខែ' : 'Monthly interest')}: <strong className="text-violet-700 font-mono">${item.monthlyInterest}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleLoadRecord(item);
                                                        setShowHistoryModal(false);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer">
                                                    <FaEye /> {t('viewLoad', lang === 'km' ? 'មើល / Load' : 'View / Load')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteRecord(item._id, e)}
                                                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs flex items-center gap-1.5 border border-rose-200 transition-all cursor-pointer">
                                                    <FaTrash /> {t('delete')}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

export default CalculateSchedule2;