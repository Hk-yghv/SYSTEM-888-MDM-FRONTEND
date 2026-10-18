import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
    FaChartLine, FaArrowUp, FaArrowDown, FaCalendarAlt, FaSearch,
    FaSync, FaExchangeAlt, FaMoneyBillWave, FaCoins, FaCheckCircle,
    FaExclamationCircle, FaChevronDown, FaChevronUp, FaInfoCircle,
    FaSpinner, FaFilter, FaFire
} from 'react-icons/fa';
import { MdOutlineBarChart, MdTrendingUp, MdTrendingDown } from 'react-icons/md';

const formatDateToYMD = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatCurrency = (num) => {
    const val = Number(num || 0);
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPriceDollar = (num) => {
    const val = Number(num || 0);
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getDayNameKhmer = (dateStr, lang) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-US', { weekday: 'long' })
        .format(d)
        .replace(/^ថ្ងៃ/, '');
};

const CashFlowTrader = () => {
    const { user, API_BASE } = useAuth();
    const { t, lang } = useLanguage();

    const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
    const [selectedPeriod, setSelectedPeriod] = useState('30D'); // 7D | 14D | 30D | 90D | All
    const [flowFocus, setFlowFocus] = useState('both'); // 'both' (ចេញ & ចូល) | 'in' (ប្រាក់ចូល) | 'out' (ប្រាក់ចេញ) | 'net' (លំហូរសុទ្ធ)
    const [chartMode, setChartMode] = useState('candles'); // 'candles' (Japanese Candlesticks) | 'dual' | 'net'
    const [candleTimeframe, setCandleTimeframe] = useState('D1'); // 'D1' (ថ្ងៃ) | 'M15' | 'H1'
    
    // Data State
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [summary, setSummary] = useState({
        totalCashIn: 0,
        totalCashOut: 0,
        totalNetFlow: 0,
        highestInflowDay: null,
        highestOutflowDay: null,
        totalDaysRecorded: 0,
        todayStats: null
    });
    const [dailyRecords, setDailyRecords] = useState([]);

    // Search and Auto-scroll
    const [searchDate, setSearchDate] = useState('');
    const [highlightedDate, setHighlightedDate] = useState(null);
    const [filterFlowType, setFilterFlowType] = useState('All'); // All | Surplus | Deficit | InflowOnly | OutflowOnly
    const [expandedDays, setExpandedDays] = useState({});

    // Chart Hover & Zoom State
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const chartScrollRef = React.useRef(null);
    const [zoomLevel, setZoomLevel] = useState(1); // 0.6x to 2.5x

    const handleZoomIn = () => setZoomLevel(prev => Math.min(2.5, +(prev + 0.25).toFixed(2)));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(0.6, +(prev - 0.25).toFixed(2)));
    const handleResetZoom = () => setZoomLevel(1);

    const handleScrollLeft = () => {
        if (chartScrollRef.current) chartScrollRef.current.scrollBy({ left: -350, behavior: 'smooth' });
    };
    const handleScrollRight = () => {
        if (chartScrollRef.current) chartScrollRef.current.scrollBy({ left: 350, behavior: 'smooth' });
    };
    const handleScrollToLatest = () => {
        if (chartScrollRef.current) chartScrollRef.current.scrollTo({ left: chartScrollRef.current.scrollWidth, behavior: 'smooth' });
    };

    const formatPriceDollar = (val) => {
        const num = Number(val || 0);
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ─── Fetch Trader Metrics from Backend ───────────────────────────
    const fetchTraderMetrics = useCallback(async () => {
        setReloading(true);
        try {
            const base = API_BASE || '';
            const params = new URLSearchParams({
                userBrand: user?.brand || '',
                userRole: user?.role || '',
                username: user?.username || '',
                isImmutable: user?.isImmutable ? 'true' : 'false'
            });

            // Calculate start date based on selected period
            if (selectedPeriod !== 'All') {
                const now = new Date();
                const daysBack = selectedPeriod === '7D' ? 7 : (selectedPeriod === '14D' ? 14 : (selectedPeriod === '30D' ? 30 : 90));
                now.setDate(now.getDate() - daysBack);
                params.set('startDate', formatDateToYMD(now));
            }

            const res = await fetch(`${base}/cashflow-trader?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setSummary(data.summary || {});
                    setDailyRecords(Array.isArray(data.dailyRecords) ? data.dailyRecords : []);
                }
            }
        } catch (err) {
            console.error('Error fetching cashflow trader metrics:', err);
        } finally {
            setLoading(false);
            setTimeout(() => setReloading(false), 400);
        }
    }, [API_BASE, user, selectedPeriod]);

    useEffect(() => {
        fetchTraderMetrics();
    }, [fetchTraderMetrics]);

    // ─── Auto-Scroll to Target Date ──────────────────────────────────
    const handleScrollToDate = (targetDate) => {
        if (!targetDate) return;
        const normalized = targetDate.trim();
        const element = document.getElementById(`day-card-${normalized}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedDate(normalized);
            setTimeout(() => {
                setHighlightedDate(null);
            }, 3500);
        } else {
            alert(t('cashFlowNoTransactionsForDate', lang === 'km' ? `មិនមានទិន្នន័យប្រតិបត្តិការសម្រាប់ថ្ងៃ ${normalized} នៅក្នុងបញ្ជីបច្ចុប្បន្នទេ!` : `No transactions found for ${normalized} in the current list.`));
        }
    };

    // ─── Filtered Records ────────────────────────────────────────────
    const filteredRecords = useMemo(() => {
        return dailyRecords.filter(r => {
            if (filterFlowType === 'Surplus' && r.netFlow < 0) return false;
            if (filterFlowType === 'Deficit' && r.netFlow >= 0) return false;
            if (filterFlowType === 'InflowOnly' && r.cashIn <= 0) return false;
            if (filterFlowType === 'OutflowOnly' && r.cashOut <= 0) return false;
            return true;
        });
    }, [dailyRecords, filterFlowType]);

    // Chronological order for chart rendering (oldest -> newest)
    const chronologicalRecords = useMemo(() => {
        return [...dailyRecords].reverse();
    }, [dailyRecords]);

    // ─── JAPANESE CANDLESTICK DATA ENGINE (TradingView Style) ────────
    const chartHeight = 360;
    const paddingTop = 26;
    const paddingBottom = 44; // Dedicated bottom-axis time scale
    const drawableHeight = chartHeight - paddingTop - paddingBottom;

    // Zoom-based dynamic candle width & spacing so candles are NEVER cramped
    const baseStepX = 48; // Base spacing at 100% zoom
    const stepX = Math.round(baseStepX * zoomLevel);
    const candleW = Math.max(8, Math.round(stepX * 0.58));

    const paddingTimelineLeft = 24;
    const paddingTimelineRight = 36;

    // Generate Candlesticks based on REAL Cash In / Cash Out amounts ($100+, etc.)
    const candlesticks = useMemo(() => {
        const records = chronologicalRecords;
        let list = [];

        // If no records in database yet, generate a realistic sample in the real range ($60 - $180)
        if (records.length === 0) {
            const now = new Date();
            for (let i = 14; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dStr = formatDateToYMD(d);
                const sampleIn = Math.round(90 + Math.sin(i * 1.2) * 50);
                const sampleOut = Math.round(45 + Math.cos(i * 1.5) * 30);
                list.push({
                    id: `candle-${dStr}`,
                    date: dStr,
                    timeLabel: `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`,
                    dayNumber: `${d.getDate()}`,
                    cashIn: sampleIn,
                    cashOut: sampleOut,
                    netFlow: sampleIn - sampleOut
                });
            }
        } else {
            records.forEach((r, idx) => {
                const dObj = new Date(r.date);
                const timeLabel = !isNaN(dObj.getTime())
                    ? `${dObj.getDate()} ${dObj.toLocaleString('en-US', { month: 'short' })}`
                    : r.date;

                list.push({
                    id: `candle-${r.date}`,
                    date: r.date,
                    timeLabel,
                    dayNumber: !isNaN(dObj.getTime()) ? `${dObj.getDate()}` : `${idx + 1}`,
                    cashIn: r.cashIn || 0,
                    cashOut: r.cashOut || 0,
                    netFlow: r.netFlow || 0,
                    inflowItems: r.inflowItems || [],
                    outflowItems: r.outflowItems || []
                });
            });
        }

        // Process candle values based on flowFocus (in / out / both / net)
        const processed = list.map((item, idx) => {
            const prev = idx > 0 ? list[idx - 1] : null;

            if (flowFocus === 'in') {
                // Focus: Cash In (ប្រាក់ចូល)
                const cur = item.cashIn;
                const prevVal = prev ? prev.cashIn : cur * 0.85;
                const isGreen = cur >= prevVal;
                const open = prevVal;
                const close = cur;
                const high = Math.max(open, close) + (cur > 0 ? Math.max(3, cur * 0.08) : 2);
                const low = Math.max(0, Math.min(open, close) - (cur > 0 ? Math.max(3, cur * 0.08) : 2));
                return {
                    ...item,
                    open,
                    close,
                    high,
                    low,
                    displayVal: cur,
                    isGreen,
                    color: isGreen ? '#089981' : '#f23645'
                };
            } else if (flowFocus === 'out') {
                // Focus: Cash Out (ប្រាក់ចេញ)
                const cur = item.cashOut;
                const prevVal = prev ? prev.cashOut : cur * 0.85;
                const isGreen = cur <= prevVal; // Spending less is favorable (green)
                const open = prevVal;
                const close = cur;
                const high = Math.max(open, close) + (cur > 0 ? Math.max(3, cur * 0.08) : 2);
                const low = Math.max(0, Math.min(open, close) - (cur > 0 ? Math.max(3, cur * 0.08) : 2));
                return {
                    ...item,
                    open,
                    close,
                    high,
                    low,
                    displayVal: cur,
                    isGreen,
                    color: cur > 0 ? '#f23645' : '#089981'
                };
            } else if (flowFocus === 'net') {
                // Focus: Net Flow (លំហូរសុទ្ធ)
                const cur = item.netFlow;
                const isGreen = cur >= 0;
                const open = 0;
                const close = cur;
                const high = Math.max(0, cur);
                const low = Math.min(0, cur);
                return {
                    ...item,
                    open,
                    close,
                    high,
                    low,
                    displayVal: cur,
                    isGreen,
                    color: isGreen ? '#089981' : '#f23645'
                };
            } else {
                // Focus: Both (ចេញ & ចូល)
                const inVal = item.cashIn;
                const outVal = item.cashOut;
                const isGreen = inVal >= outVal; // Cash In exceeds Cash Out
                const open = outVal;
                const close = inVal;
                const high = Math.max(inVal, outVal) + (Math.max(inVal, outVal) > 0 ? Math.max(3, Math.max(inVal, outVal) * 0.06) : 2);
                const low = Math.max(0, Math.min(inVal, outVal) - (Math.min(inVal, outVal) > 0 ? Math.max(2, Math.min(inVal, outVal) * 0.06) : 0));
                return {
                    ...item,
                    open,
                    close,
                    high,
                    low,
                    displayVal: inVal,
                    isGreen,
                    color: isGreen ? '#089981' : '#f23645'
                };
            }
        });

        // Detect Swing Highs (▲) & Swing Lows (▼) on the real amounts
        for (let i = 1; i < processed.length - 1; i++) {
            const p = processed[i - 1];
            const c = processed[i];
            const n = processed[i + 1];

            if (c.high > p.high && c.high >= n.high) {
                c.isSwingHigh = true;
            }
            if (c.low < p.low && c.low <= n.low) {
                c.isSwingLow = true;
            }
        }

        return processed;
    }, [chronologicalRecords, flowFocus, candleTimeframe, todayStr]);

    // Timeline width expands dynamically so candles never cram together
    const timelineWidth = useMemo(() => {
        return Math.max(860, candlesticks.length * stepX + paddingTimelineLeft + paddingTimelineRight);
    }, [candlesticks.length, stepX, paddingTimelineLeft, paddingTimelineRight]);

    // Real Price Bounds Calculation in Dollars based on the actual transactions
    const { minPrice, maxPrice, paddedMin, paddedMax, paddedRange, priceTicks } = useMemo(() => {
        if (candlesticks.length === 0) {
            return { minPrice: 0, maxPrice: 150, paddedMin: 0, paddedMax: 150, paddedRange: 150, priceTicks: [] };
        }
        let min = 0;
        let max = 0;
        candlesticks.forEach(c => {
            if (c.high > max) max = c.high;
            if (c.low < min) min = c.low;
        });

        if (max <= 0) max = 150;

        // Clean headroom (12%)
        const pMax = Math.ceil((max * 1.12) / 10) * 10;
        const pMin = flowFocus === 'net' && min < 0 ? Math.floor((min * 1.12) / 10) * 10 : 0;
        const pRange = Math.max(pMax - pMin, 20);

        // 8-10 clean price ticks
        const tickCount = 8;
        const ticks = [];
        for (let i = 0; i <= tickCount; i++) {
            const pct = i / tickCount;
            const val = pMax - pct * pRange;
            const y = paddingTop + pct * drawableHeight;
            ticks.push({ val: Math.round(val * 100) / 100, y });
        }

        return {
            minPrice: min,
            maxPrice: max,
            paddedMin: pMin,
            paddedMax: pMax,
            paddedRange: pRange,
            priceTicks: ticks
        };
    }, [candlesticks, flowFocus, drawableHeight, paddingTop]);

    // Price to Y coordinate mapper
    const priceToY = useCallback((price) => {
        if (!paddedRange) return paddingTop;
        return paddingTop + (1 - (price - paddedMin) / paddedRange) * drawableHeight;
    }, [paddedMin, paddedRange, drawableHeight, paddingTop]);

    // Candle points with computed SVG coordinates
    const candlePoints = useMemo(() => {
        const count = candlesticks.length;
        if (count === 0) return [];

        return candlesticks.map((c, i) => {
            const x = paddingTimelineLeft + (i + 0.5) * stepX;
            const yOpen = priceToY(c.open);
            const yClose = priceToY(c.close);
            const yHigh = priceToY(c.high);
            const yLow = priceToY(c.low);

            const isGreen = c.close >= c.open;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyBottom = Math.max(yOpen, yClose);
            const bodyH = Math.max(2, bodyBottom - bodyTop);

            return {
                ...c,
                index: i,
                x,
                candleW,
                yOpen,
                yClose,
                yHigh,
                yLow,
                bodyTop,
                bodyBottom,
                bodyH,
                isGreen,
                color: c.color
            };
        });
    }, [candlesticks, stepX, candleW, paddingTimelineLeft, priceToY]);

    const latestCandle = useMemo(() => {
        return candlePoints[candlePoints.length - 1] || null;
    }, [candlePoints]);

    // Auto scroll timeline to right on candle count change or timeframe switch
    useEffect(() => {
        if (chartScrollRef.current) {
            setTimeout(() => {
                if (chartScrollRef.current) {
                    chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
                }
            }, 80);
        }
    }, [candlesticks.length, candleTimeframe, flowFocus]);

    const toggleExpandDay = (date) => {
        setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
    };

    return (
        <div className="p-3 sm:p-5 space-y-4 bg-slate-50 text-slate-800 min-h-screen font-sans">
            {/* ═════════════════════════════════════════════════════════════ */}
            {/* TRADER HEADER / TICKER TERMINAL (CLEAN WHITE THEME)           */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 rounded-[5px] p-4 sm:p-5 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Title & Live Status */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-[5px] bg-gradient-to-br from-amber-500 via-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <MdTrendingUp size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                    {t('cashFlowTrader')}
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] font-mono font-bold bg-emerald-50 border border-emerald-300 text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    {t('cashFlowLiveMarket', lang === 'km' ? 'ទីផ្សារបន្តផ្ទាល់' : 'LIVE MARKET')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {t('cashFlowTraderSubtitle', lang === 'km' ? 'តាមដានលំហូរសាច់ប្រាក់ចេញ-ចូលប្រចាំថ្ងៃ ដូចក្រាហ្វិកទីផ្សារហិរញ្ញវត្ថុ និងការប្រែប្រួលពីមួយថ្ងៃទៅមួយថ្ងៃ' : 'Track daily cash inflows and outflows with financial-market-style charts and day-over-day changes.')}
                            </p>
                        </div>
                    </div>

                    {/* Period Selector & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Timeframe Chips */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-[5px] border border-slate-200 text-xs font-bold font-mono">
                            {['7D', '14D', '30D', '90D', 'All'].map(period => (
                                <button
                                    key={period}
                                    onClick={() => setSelectedPeriod(period)}
                                    className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                        selectedPeriod === period
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                    }`}
                                >
                                    {period === 'All' ? t('all', lang === 'km' ? 'ទាំងអស់' : 'All') : period}
                                </button>
                            ))}
                        </div>

                        {/* Chart View Toggle */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-[5px] border border-slate-200 text-xs font-bold font-mono">
                            <button
                                onClick={() => setChartMode('dual')}
                                className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                    chartMode === 'dual' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                            >
                                {t('cashFlowInOutBar', lang === 'km' ? 'ក្រាហ្វិកប្រាក់ចូល/ចេញ' : 'In/Out Bar')}
                            </button>
                            <button
                                onClick={() => setChartMode('net')}
                                className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                    chartMode === 'net' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                            >
                                {t('cashFlowNetFlow', lang === 'km' ? 'លំហូរសុទ្ធ' : 'Net Flow')}
                            </button>
                        </div>

                        {/* Reload */}
                        <button
                            onClick={fetchTraderMetrics}
                            disabled={reloading}
                            title={t('refresh', lang === 'km' ? 'ធ្វើឱ្យទិន្នន័យថ្មី' : 'Refresh data')}
                            className="p-2 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition-colors shadow-2xs"
                        >
                            <FaSync className={`text-xs ${reloading ? 'animate-spin text-emerald-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Live Ticker Bar (Light White Ticker Boxes) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    {/* Cash In Ticker */}
                    <div className="bg-emerald-50/70 p-3 rounded-[5px] border border-emerald-200 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                            <span>{t('cashFlowTotalCashIn', lang === 'km' ? 'សាច់ប្រាក់ចូលសរុប' : 'TOTAL CASH IN')}</span>
                            <FaMoneyBillWave className="text-emerald-600" />
                        </div>
                        <p className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                            {formatCurrency(summary.totalCashIn)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {t('cashFlowCashInSources', lang === 'km' ? 'ពីការបង់ប្រាក់កុងត្រា និងប្រាក់ចូល' : 'From contract payments and cash-in records')}
                        </p>
                    </div>

                    {/* Cash Out Ticker */}
                    <div className="bg-rose-50/70 p-3 rounded-[5px] border border-rose-200 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] text-rose-800 font-bold">
                            <span>{t('cashFlowTotalCashOut', lang === 'km' ? 'សាច់ប្រាក់ចេញសរុប' : 'TOTAL CASH OUT')}</span>
                            <FaCoins className="text-rose-600" />
                        </div>
                        <p className="text-lg font-black font-mono text-rose-700 mt-0.5">
                            {formatCurrency(summary.totalCashOut)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {t('cashFlowCashOutSummary', lang === 'km' ? 'ចំណាយសាច់ប្រាក់ចេញសរុប' : 'Total cash out expenses')}
                        </p>
                    </div>

                    {/* Net Balance Ticker */}
                    <div className={`p-3 rounded-[5px] border shadow-2xs ${
                        summary.totalNetFlow >= 0 ? 'bg-teal-50/80 border-teal-200' : 'bg-rose-50/80 border-rose-200'
                    }`}>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={summary.totalNetFlow >= 0 ? 'text-teal-800' : 'text-rose-800'}>
                                {t('cashFlowNetCashFlow', lang === 'km' ? 'លំហូរសាច់ប្រាក់សុទ្ធ' : 'NET CASH FLOW')}
                            </span>
                            <FaExchangeAlt className={summary.totalNetFlow >= 0 ? 'text-teal-600' : 'text-rose-600'} />
                        </div>
                        <p className={`text-lg font-black font-mono mt-0.5 ${
                            summary.totalNetFlow >= 0 ? 'text-teal-700' : 'text-rose-700'
                        }`}>
                            {summary.totalNetFlow >= 0 ? '+' : ''}{formatCurrency(summary.totalNetFlow)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {summary.totalNetFlow >= 0
                                ? `🟢 ${t('cashFlowSurplus', lang === 'km' ? 'សាច់ប្រាក់លើស' : 'Surplus')}`
                                : `🔴 ${t('cashFlowDeficit', lang === 'km' ? 'ឱនភាពសាច់ប្រាក់' : 'Cash deficit')}`}
                        </p>
                    </div>

                    {/* Today DoD Ticker */}
                    <div className="bg-slate-50 p-3 rounded-[5px] border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-700 font-bold">
                            <span>{t('cashFlowTodayVsYesterday', lang === 'km' ? 'ថ្ងៃនេះធៀបនឹងម្សិលមិញ' : 'TODAY VS YESTERDAY')}</span>
                            <FaFire className="text-amber-500" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-black font-mono text-slate-900">
                                {formatCurrency(summary.todayStats?.cashIn || 0)}
                            </span>
                            {summary.todayStats?.inDiff !== 0 && (
                                <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] font-mono ${
                                    summary.todayStats?.inDiff > 0
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                    {summary.todayStats?.inDiff > 0 ? <FaArrowUp className="mr-0.5 text-[8px]" /> : <FaArrowDown className="mr-0.5 text-[8px]" />}
                                    {summary.todayStats?.inPct > 0 ? '+' : ''}{summary.todayStats?.inPct}%
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {summary.todayStats?.inDiff > 0
                                ? t('cashFlowInflowMoreThanYesterday', lang === 'km' ? 'ប្រាក់ចូលច្រើនជាងម្សិលមិញ' : 'Cash inflow higher than yesterday')
                                : (summary.todayStats?.inDiff < 0
                                    ? t('cashFlowInflowLessThanYesterday', lang === 'km' ? 'ប្រាក់ចូលតិចជាងម្សិលមិញ' : 'Cash inflow lower than yesterday')
                                    : t('cashFlowDataUnchanged', lang === 'km' ? 'ទិន្នន័យស្មើម្សិលមិញ' : 'Same as yesterday'))}
                        </p>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* TRADER CANDLESTICK CHART (RIGHT DOLLAR AXIS + ZOOM & SCROLL)   */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 rounded-[5px] p-3 sm:p-4 shadow-xs">
                {/* Chart Header Bar: Pair, Flow Selection, Timeframe, Zoom & Scroll Toolbar */}
                <div className="flex flex-col gap-2.5 mb-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        {/* Primary Flow Selection: [ 🟢 ប្រាក់ចូល ] [ 🔴 ប្រាក់ចេញ ] [ ⚖️ ទាំងពីរ ] [ 📊 លំហូរសុទ្ធ ] */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 font-sans">
                                {t('cashFlowSelectView', lang === 'km' ? 'ជ្រើសរើសមើល:' : 'Select view:')}
                            </span>
                            <div className="flex flex-wrap items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200 text-xs font-sans font-bold">
                                <button
                                    onClick={() => setFlowFocus('in')}
                                    className={`px-3 py-1 rounded-[4px] cursor-pointer transition-all flex items-center gap-1.5 ${
                                        flowFocus === 'in'
                                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                            : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                                    <span>🟢 {t('cashFlowTotalCashIn', lang === 'km' ? 'ប្រាក់ចូល' : 'Cash in')}</span>
                                </button>
                                <button
                                    onClick={() => setFlowFocus('out')}
                                    className={`px-3 py-1 rounded-[4px] cursor-pointer transition-all flex items-center gap-1.5 ${
                                        flowFocus === 'out'
                                            ? 'bg-rose-600 text-white shadow-xs font-bold'
                                            : 'text-slate-600 hover:text-rose-700 hover:bg-slate-200'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-rose-300"></span>
                                    <span>🔴 {t('cashFlowTotalCashOut', lang === 'km' ? 'ប្រាក់ចេញ' : 'Cash out')}</span>
                                </button>
                                <button
                                    onClick={() => setFlowFocus('both')}
                                    className={`px-3 py-1 rounded-[4px] cursor-pointer transition-all flex items-center gap-1.5 ${
                                        flowFocus === 'both'
                                            ? 'bg-slate-900 text-white shadow-xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                    }`}
                                >
                                    <span>⚖️ {t('cashFlowBothFlows', lang === 'km' ? 'ប្រាក់ចូល និងប្រាក់ចេញ' : 'Inflow & outflow')}</span>
                                </button>
                                <button
                                    onClick={() => setFlowFocus('net')}
                                    className={`px-2.5 py-1 rounded-[4px] cursor-pointer transition-all flex items-center gap-1.5 ${
                                        flowFocus === 'net'
                                            ? 'bg-teal-700 text-white shadow-xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                    }`}
                                >
                                    <span>📊 {t('cashFlowNetFlow', lang === 'km' ? 'លំហូរសុទ្ធ' : 'Net flow')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Right: Zoom & Horizontal Scroll Controls */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        {/* Zoom Controls (ព្រងីក / បង្រួម) */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200">
                            <button
                                onClick={handleZoomOut}
                                title={t('cashFlowZoomOut', lang === 'km' ? 'បង្រួម' : 'Zoom out')}
                                className="px-2 py-0.5 rounded-[4px] font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 cursor-pointer transition-colors"
                            >
                                🔍 −
                            </button>
                            <span className="px-2 py-0.5 font-bold text-[11px] text-slate-900 bg-white rounded-[3px] border border-slate-200 shadow-2xs">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                title={t('cashFlowZoomIn', lang === 'km' ? 'ពង្រីក' : 'Zoom in')}
                                className="px-2 py-0.5 rounded-[4px] font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 cursor-pointer transition-colors"
                            >
                                🔍 +
                            </button>
                            <button
                                onClick={handleResetZoom}
                                title={t('cashFlowResetZoom', lang === 'km' ? 'កំណត់ការពង្រីកឡើងវិញទៅ ១០០%' : 'Reset zoom to 100%')}
                                className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
                            >
                                ⟲ Reset
                            </button>
                        </div>

                        {/* Zoom Preset Chips */}
                        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200 text-[10px] font-bold">
                            {[0.75, 1, 1.5, 2].map(z => (
                                <button
                                    key={z}
                                    onClick={() => setZoomLevel(z)}
                                    className={`px-1.5 py-0.5 rounded-[3px] cursor-pointer transition-all ${
                                        zoomLevel === z ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {Math.round(z * 100)}%
                                </button>
                            ))}
                        </div>

                        {/* Horizontal Scroll Quick Buttons */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200">
                            <button
                                onClick={handleScrollLeft}
                                title={t('cashFlowScrollPast', lang === 'km' ? 'រំកិលទៅខាងឆ្វេង (អតីតកាល)' : 'Scroll left (past)')}
                                className="px-2 py-0.5 rounded-[4px] text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                            >
                                ◀ ឆ្វេង
                            </button>
                            <button
                                onClick={handleScrollRight}
                                title={t('cashFlowScrollCurrent', lang === 'km' ? 'រំកិលទៅខាងស្តាំ (បច្ចុប្បន្ន)' : 'Scroll right (present)')}
                                className="px-2 py-0.5 rounded-[4px] text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                            >
                                ស្តាំ ▶
                            </button>
                            <button
                                onClick={handleScrollToLatest}
                                title={t('cashFlowJumpLatest', lang === 'km' ? 'ទៅកាន់ទិន្នន័យថ្មីបំផុត' : 'Jump to latest candle')}
                                className="px-2 py-0.5 rounded-[4px] text-xs font-bold bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200 cursor-pointer shadow-2xs"
                            >
                                ⏭ ចុងក្រោយ
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Row: Pair Symbol, Timeframe (1D, 1h, 15m), Chart Style, and Mode Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                        {/* Trading Pair Symbol */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-slate-100 border border-slate-200 font-bold text-slate-900">
                            <span className={`w-2 h-2 rounded-full ${flowFocus === 'in' ? 'bg-emerald-500' : flowFocus === 'out' ? 'bg-rose-500' : 'bg-teal-500'} animate-pulse`}></span>
                            <span>{flowFocus === 'in' ? 'CASH_IN / USD' : flowFocus === 'out' ? 'CASH_OUT / USD' : flowFocus === 'net' ? 'NET_FLOW / USD' : 'DUAL_FLOW / USD'}</span>
                        </div>

                        {/* Candle Timeframe Switcher (1D, 1h, 15m) */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200 font-bold">
                            {[
                                { key: 'D1', label: '1D (ប្រចាំថ្ងៃ)' },
                                { key: 'H1', label: '1h' },
                                { key: 'M15', label: '15m' }
                            ].map(tf => (
                                <button
                                    key={tf.key}
                                    onClick={() => setCandleTimeframe(tf.key)}
                                    className={`px-2 py-0.5 rounded-[4px] cursor-pointer transition-all ${
                                        candleTimeframe === tf.key
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                    }`}
                                >
                                    {tf.label}
                                </button>
                            ))}
                        </div>

                        {/* Chart Style Switcher */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-[5px] border border-slate-200 font-bold">
                            <button
                                onClick={() => setChartMode('candles')}
                                className={`px-2 py-0.5 rounded-[4px] cursor-pointer transition-all flex items-center gap-1 ${
                                    chartMode === 'candles'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                            >
                                <span>🕯️ {t('cashFlowCandles', lang === 'km' ? 'ក្រាហ្វិកទៀន' : 'Candles')}</span>
                            </button>
                            <button
                                onClick={() => setChartMode('net')}
                                className={`px-2 py-0.5 rounded-[4px] cursor-pointer transition-all ${
                                    chartMode === 'net'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                            >
                                <span>{t('cashFlowNetArea', lang === 'km' ? 'តំបន់លំហូរសុទ្ធ' : 'Net Area')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Status / Focus Badge */}
                    <div className="text-[11px] font-sans font-medium">
                        {flowFocus === 'in' && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 font-bold">● {t('cashFlowTrackingInflow', lang === 'km' ? 'កំពុងតាមដាន៖ ប្រាក់ចូល' : 'Tracking: cash inflow')}</span>}
                        {flowFocus === 'out' && <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-[4px] border border-rose-200 font-bold">● {t('cashFlowTrackingOutflow', lang === 'km' ? 'កំពុងតាមដាន៖ ប្រាក់ចេញ' : 'Tracking: cash outflow')}</span>}
                        {flowFocus === 'both' && <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded-[4px] border border-slate-200 font-bold">● {t('cashFlowTrackingBoth', lang === 'km' ? 'កំពុងប្រៀបធៀបប្រាក់ចេញ និងប្រាក់ចូល' : 'Comparing cash inflow and outflow')}</span>}
                        {flowFocus === 'net' && <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-[4px] border border-teal-200 font-bold">● {t('cashFlowTrackingNet', lang === 'km' ? 'កំពុងតាមដាន៖ លំហូរសុទ្ធ' : 'Tracking: net cash flow')}</span>}
                    </div>
                </div>
            </div>

            {/* Top OHLC Inspection Ticker Bar */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 py-1 text-[11px] font-mono text-slate-700 bg-slate-50/80 rounded-[4px] mb-2 border border-slate-200">
                {(() => {
                    const activeCandle = hoveredPoint || latestCandle;
                    if (!activeCandle) return <span>{t('preparingData', lang === 'km' ? 'កំពុងរៀបចំទិន្នន័យ...' : 'Preparing data...')}</span>;
                    const diff = activeCandle.close - activeCandle.open;
                    const pct = ((diff / (activeCandle.open || 1)) * 100).toFixed(2);
                    const isUp = diff >= 0;

                    return (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="text-slate-500 font-bold">{activeCandle.timeLabel}</span>
                            <span>O <b className="text-slate-900">{formatPriceDollar(activeCandle.open)}</b></span>
                            <span>H <b className="text-slate-900">{formatPriceDollar(activeCandle.high)}</b></span>
                            <span>L <b className="text-slate-900">{formatPriceDollar(activeCandle.low)}</b></span>
                            <span>C <b className={isUp ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                                {formatPriceDollar(activeCandle.close)}
                            </b></span>
                            <span className={isUp ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                                {isUp ? '+' : ''}{diff >= 0 ? '+' : ''}{formatPriceDollar(diff)} ({isUp ? '+' : ''}{pct}%)
                            </span>
                            <span className="hidden lg:inline text-slate-300">|</span>
                            <span className="hidden lg:inline text-slate-600">
                                {t('cashFlowInLabel', lang === 'km' ? 'ចូល (In):' : 'In:')} <b className="text-emerald-700 font-bold">${activeCandle.cashIn.toLocaleString()}</b>
                            </span>
                            <span className="hidden lg:inline text-slate-600">
                                {t('cashFlowOutLabel', lang === 'km' ? 'ចេញ (Out):' : 'Out:')} <b className="text-rose-700 font-bold">${activeCandle.cashOut.toLocaleString()}</b>
                            </span>
                        </div>
                    );
                })()}

                <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                    💡 {t('cashFlowChartNavigationHelp', lang === 'km' ? 'អូស Scroll ឆ្វេង-ស្តាំ ឬចុចលើ Candle ដើម្បី Scroll ទៅរកកាលបរិច្ឆេទនោះ' : 'Drag left or right, or click a candle to scroll to that date.')}
                </span>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* DUAL-COLUMN CHART: SCROLLABLE TIMELINE + STICKY RIGHT DOLLAR AXIS */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="flex border border-slate-200 rounded-[5px] bg-white overflow-hidden shadow-xs relative">
                {/* ─── COLUMN 1: SCROLLABLE CANDLESTICK TIMELINE (overflow-x-auto) ─── */}
                <div
                    ref={chartScrollRef}
                    className="flex-1 overflow-x-auto select-none bg-white relative scroll-smooth"
                    style={{ minHeight: `${chartHeight}px` }}
                >
                    {loading ? (
                        <div className="h-[360px] flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-mono">
                            <FaSpinner className="animate-spin text-2xl text-emerald-600" />
                            <span>{t('loadingChartData', lang === 'km' ? 'កំពុងទាញយកទិន្នន័យក្រាហ្វិក...' : 'Loading chart data...')}</span>
                        </div>
                    ) : candlePoints.length === 0 ? (
                        <div className="h-[360px] flex items-center justify-center text-slate-400 text-xs font-mono">
                            {t('cashFlowNoTransactionsInRange', lang === 'km' ? 'មិនទាន់មានទិន្នន័យប្រតិបត្តិការក្នុងចន្លោះពេលនេះឡើយ' : 'No transactions in this date range yet.')}
                        </div>
                    ) : (
                            <svg
                                width={timelineWidth}
                                height={chartHeight}
                                className="overflow-visible bg-white"
                            >
                                <defs>
                                    <linearGradient id="tradingNetAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#089981" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#089981" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {/* Background Canvas */}
                                <rect width={timelineWidth} height={chartHeight} fill="#ffffff" />

                                {/* Horizontal Grid Lines Across the Full Timeline */}
                                {priceTicks.map((pt, idx) => (
                                    <line
                                        key={`grid-line-${idx}`}
                                        x1="0"
                                        y1={pt.y}
                                        x2={timelineWidth}
                                        y2={pt.y}
                                        stroke="#f1f5f9"
                                        strokeWidth="1"
                                        strokeDasharray="2 3"
                                    />
                                ))}

                                {/* Bottom Axis Baseline (Time/Day Axis) */}
                                <line
                                    x1="0"
                                    y1={chartHeight - paddingBottom}
                                    x2={timelineWidth}
                                    y2={chartHeight - paddingBottom}
                                    stroke="#e2e8f0"
                                    strokeWidth="1.2"
                                />

                                {/* Net Area Mode Line (if activated) */}
                                {chartMode === 'net' && (
                                    <g>
                                        <path
                                            d={(() => {
                                                if (candlePoints.length === 0) return '';
                                                const first = candlePoints[0];
                                                const last = candlePoints[candlePoints.length - 1];
                                                const bY = chartHeight - paddingBottom;
                                                let p = `M ${first.x} ${first.yClose}`;
                                                for (let i = 1; i < candlePoints.length; i++) {
                                                    p += ` L ${candlePoints[i].x} ${candlePoints[i].yClose}`;
                                                }
                                                return `${p} L ${last.x} ${bY} L ${first.x} ${bY} Z`;
                                            })()}
                                            fill="url(#tradingNetAreaGrad)"
                                        />
                                        <path
                                            d={(() => {
                                                if (candlePoints.length === 0) return '';
                                                let p = `M ${candlePoints[0].x} ${candlePoints[0].yClose}`;
                                                for (let i = 1; i < candlePoints.length; i++) {
                                                    p += ` L ${candlePoints[i].x} ${candlePoints[i].yClose}`;
                                                }
                                                return p;
                                            })()}
                                            fill="none"
                                            stroke="#089981"
                                            strokeWidth="2"
                                        />
                                    </g>
                                )}

                                {/* Candlestick Columns (Real Japanese K-Line) */}
                                {candlePoints.map((pt) => (
                                    <g key={pt.id}>
                                        {/* Center Vertical Wick (High to Low) */}
                                        <line
                                            x1={pt.x}
                                            y1={pt.yHigh}
                                            x2={pt.x}
                                            y2={pt.yLow}
                                            stroke={pt.color}
                                            strokeWidth="1.3"
                                        />

                                        {/* Candle Body (Open to Close) */}
                                        <rect
                                            x={pt.x - pt.candleW / 2}
                                            y={pt.bodyTop}
                                            width={pt.candleW}
                                            height={pt.bodyH}
                                            fill={pt.color}
                                            rx="1"
                                        />

                                        {/* Swing High Pivot Triangle (▲) */}
                                        {pt.isSwingHigh && (
                                            <polygon
                                                points={`${pt.x},${pt.yHigh - 10} ${pt.x - 3.5},${pt.yHigh - 4} ${pt.x + 3.5},${pt.yHigh - 4}`}
                                                fill="#475569"
                                            />
                                        )}

                                        {/* Swing Low Pivot Triangle (▼) */}
                                        {pt.isSwingLow && (
                                            <polygon
                                                points={`${pt.x},${pt.yLow + 10} ${pt.x - 3.5},${pt.yLow + 4} ${pt.x + 3.5},${pt.yLow + 4}`}
                                                fill="#475569"
                                            />
                                        )}

                                        {/* Bottom Day/Time Labels (ចំនួនថ្ងៃ) */}
                                        <line
                                            x1={pt.x}
                                            y1={chartHeight - paddingBottom}
                                            x2={pt.x}
                                            y2={chartHeight - paddingBottom + 5}
                                            stroke="#cbd5e1"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={pt.x}
                                            y={chartHeight - paddingBottom + 16}
                                            fill="#475569"
                                            fontSize="9.5"
                                            fontWeight="600"
                                            fontFamily="monospace"
                                            textAnchor="middle"
                                        >
                                            {pt.timeLabel}
                                        </text>
                                        <text
                                            x={pt.x}
                                            y={chartHeight - paddingBottom + 28}
                                            fill="#94a3b8"
                                            fontSize="8"
                                            fontFamily="sans-serif"
                                            textAnchor="middle"
                                        >
                                            {candleTimeframe === 'D1' ? getDayNameKhmer(pt.date, lang) : `Vol: $${(pt.cashIn + pt.cashOut).toLocaleString()}`}
                                        </text>
                                    </g>
                                ))}

                                {/* Latest Price Reference Line Across the Full Timeline */}
                                {latestCandle && (
                                    <line
                                        x1="0"
                                        y1={latestCandle.yClose}
                                        x2={timelineWidth}
                                        y2={latestCandle.yClose}
                                        stroke={latestCandle.color}
                                        strokeWidth="1"
                                        strokeDasharray="2 2"
                                    />
                                )}

                                {/* Interactive Touch / Click Columns */}
                                {candlePoints.map((pt) => (
                                    <rect
                                        key={`hit-${pt.id}`}
                                        x={pt.x - stepX / 2}
                                        y={paddingTop}
                                        width={stepX}
                                        height={drawableHeight}
                                        fill="transparent"
                                        className="cursor-crosshair"
                                        onMouseEnter={() => setHoveredPoint(pt)}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                        onClick={() => handleScrollToDate(pt.date)}
                                    />
                                ))}

                                {/* Crosshair Lines on Hover */}
                                {hoveredPoint && (
                                    <g pointerEvents="none">
                                        {/* Vertical Crosshair Line */}
                                        <line
                                            x1={hoveredPoint.x}
                                            y1={paddingTop}
                                            x2={hoveredPoint.x}
                                            y2={chartHeight - paddingBottom}
                                            stroke="#64748b"
                                            strokeWidth="1"
                                            strokeDasharray="3 3"
                                        />

                                        {/* Horizontal Crosshair Line */}
                                        <line
                                            x1="0"
                                            y1={hoveredPoint.yClose}
                                            x2={timelineWidth}
                                            y2={hoveredPoint.yClose}
                                            stroke="#64748b"
                                            strokeWidth="1"
                                            strokeDasharray="3 3"
                                        />

                                        {/* Floating Time Tag on Bottom Axis */}
                                        <rect
                                            x={hoveredPoint.x - 42}
                                            y={chartHeight - paddingBottom + 2}
                                            width={84}
                                            height={16}
                                            fill="#0f172a"
                                            rx="2"
                                        />
                                        <text
                                            x={hoveredPoint.x}
                                            y={chartHeight - paddingBottom + 13}
                                            fill="#ffffff"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            textAnchor="middle"
                                        >
                                            {hoveredPoint.timeLabel}
                                        </text>
                                    </g>
                                )}
                            </svg>
                        )}

                        {/* Floating HUD Tooltip Card */}
                        {hoveredPoint && (
                            <div
                                className="fixed bottom-6 right-6 bg-white/95 border border-slate-300 rounded-[5px] p-3 shadow-2xl backdrop-blur-md text-[11px] font-mono pointer-events-none animate-in fade-in duration-150 z-30"
                            >
                                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1">
                                    📅 {hoveredPoint.timeLabel} ({hoveredPoint.date})
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-700">
                                    <span>{t('cashFlowOpen', lang === 'km' ? 'បើក' : 'Open')}: <b>{formatPriceDollar(hoveredPoint.open)}</b></span>
                                    <span>{t('cashFlowHigh', lang === 'km' ? 'ខ្ពស់' : 'High')}: <b>{formatPriceDollar(hoveredPoint.high)}</b></span>
                                    <span>{t('cashFlowLow', lang === 'km' ? 'ទាប' : 'Low')}: <b>{formatPriceDollar(hoveredPoint.low)}</b></span>
                                    <span>{t('cashFlowClose', lang === 'km' ? 'បិទ' : 'Close')}: <b className={hoveredPoint.isGreen ? 'text-emerald-700' : 'text-rose-700'}>{formatPriceDollar(hoveredPoint.close)}</b></span>
                                </div>
                                <div className="border-t border-slate-100 pt-1 mt-1">
                                    <p className="text-emerald-700 font-bold">
                                        {t('cashFlowInflowLabel', lang === 'km' ? 'ចូល (Inflow):' : 'Inflow:')} ${hoveredPoint.cashIn.toLocaleString()}
                                    </p>
                                    <p className="text-rose-700 font-bold">
                                        {t('cashFlowOutflowLabel', lang === 'km' ? 'ចេញ (Outflow):' : 'Outflow:')} ${hoveredPoint.cashOut.toLocaleString()}
                                    </p>
                                    <p className={hoveredPoint.netFlow >= 0 ? 'text-teal-700 font-black' : 'text-rose-700 font-black'}>
                                        {t('cashFlowNetLabel', lang === 'km' ? 'សល់ (Net):' : 'Net:')} {hoveredPoint.netFlow >= 0 ? '+' : ''}${hoveredPoint.netFlow.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── COLUMN 2: STICKY RIGHT DOLLAR AXIS ─── */}
                    <div className="w-[100px] sm:w-[112px] shrink-0 border-l border-slate-200 bg-white select-none z-10 relative">
                        {/* Axis Top Label */}
                        <div className="h-[24px] flex items-center justify-center px-2 text-[10px] font-mono font-bold text-slate-500 border-b border-slate-100 bg-slate-50/70">
                            {flowFocus === 'in' ? '$ ចូល' : flowFocus === 'out' ? '$ ចេញ' : flowFocus === 'net' ? '$ Net' : '$ USD'}
                        </div>

                        <svg width="100%" height={chartHeight} className="overflow-visible bg-white">
                            {/* Left Border Line */}
                            <line
                                x1="0"
                                y1={paddingTop}
                                x2="0"
                                y2={chartHeight - paddingBottom}
                                stroke="#cbd5e1"
                                strokeWidth="1"
                            />

                            {/* Price Ticks in Dollars ($) on Right Axis */}
                            {priceTicks.map((pt, idx) => (
                                <g key={`right-pt-${idx}`}>
                                    {/* Tick notch */}
                                    <line
                                        x1="0"
                                        y1={pt.y}
                                        x2="10"
                                        y2={pt.y}
                                        stroke="#94a3b8"
                                        strokeWidth="1"
                                    />
                                    {/* Dollar Price Text Label */}
                                    <text
                                        x="14"
                                        y={pt.y + 3.5}
                                        fill="#475569"
                                        fontSize="10"
                                        fontFamily="monospace"
                                        fontWeight="600"
                                        textAnchor="start"
                                    >
                                        {formatPriceDollar(pt.val)}
                                    </text>
                                </g>
                            ))}

                            {/* Latest Price Badge on Right Axis */}
                            {latestCandle && (
                                <g>
                                    <rect
                                        x="4"
                                        y={latestCandle.yClose - 8.5}
                                        width="98"
                                        height="17"
                                        fill={latestCandle.color}
                                        rx="3"
                                    />
                                    <text
                                        x="52"
                                        y={latestCandle.yClose + 3.5}
                                        fill="#ffffff"
                                        fontSize="9.5"
                                        fontWeight="bold"
                                        fontFamily="monospace"
                                        textAnchor="middle"
                                    >
                                        {formatPriceDollar(latestCandle.close)}
                                    </text>
                                </g>
                            )}

                            {/* Hovered Price Badge on Right Axis */}
                            {hoveredPoint && (
                                <g pointerEvents="none">
                                    <rect
                                        x="4"
                                        y={hoveredPoint.yClose - 8.5}
                                        width="98"
                                        height="17"
                                        fill="#0f172a"
                                        rx="3"
                                    />
                                    <text
                                        x="52"
                                        y={hoveredPoint.yClose + 3.5}
                                        fill="#ffffff"
                                        fontSize="9.5"
                                        fontWeight="bold"
                                        fontFamily="monospace"
                                        textAnchor="middle"
                                    >
                                        {formatPriceDollar(hoveredPoint.close)}
                                    </text>
                                </g>
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* SEARCH & JUMP CONTROLS (AUTO-SCROLL MECHANISM)                */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200 rounded-[5px] p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Date Search Input */}
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-[5px] border border-slate-300 text-xs">
                        <FaSearch className="text-emerald-600 text-xs" />
                        <span className="font-bold text-slate-700">{t('searchDate', lang === 'km' ? 'ស្វែងរកកាលបរិច្ឆេទ:' : 'Search date:')}</span>
                        <input
                            type="date"
                            value={searchDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchDate(val);
                                if (val) handleScrollToDate(val);
                            }}
                            className="bg-transparent text-slate-900 font-mono text-xs font-bold focus:outline-none cursor-pointer"
                        />
                        {searchDate && (
                            <button
                                onClick={() => setSearchDate('')}
                                className="text-slate-400 hover:text-slate-700 text-xs px-1"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Quick Jump Buttons */}
                    <button
                        onClick={() => handleScrollToDate(todayStr)}
                        className="px-2.5 py-1.5 rounded-[5px] text-xs font-bold font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer"
                    >
                        🎯 {t('goToToday', lang === 'km' ? 'ទៅកាន់ថ្ងៃនេះ' : 'Go to today')}
                    </button>

                    <button
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            handleScrollToDate(formatDateToYMD(d));
                        }}
                        className="px-2.5 py-1.5 rounded-[5px] text-xs font-bold font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                    >
                        {t('yesterday', lang === 'km' ? 'ម្សិលមិញ' : 'Yesterday')}
                    </button>
                </div>

                {/* Filter Flow Type */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-slate-600">{t('filter', lang === 'km' ? 'តម្រង:' : 'Filter:')}</span>
                    <select
                        value={filterFlowType}
                        onChange={(e) => setFilterFlowType(e.target.value)}
                        className="bg-slate-50 text-slate-800 border border-slate-300 rounded-[5px] px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                    >
                        <option value="All">{t('cashFlowAllDays', lang === 'km' ? 'ថ្ងៃទាំងអស់' : 'All days')} ({dailyRecords.length})</option>
                        <option value="Surplus">{t('cashFlowSurplusDays', lang === 'km' ? 'ថ្ងៃមានសាច់ប្រាក់លើស' : 'Surplus days')}</option>
                        <option value="Deficit">{t('cashFlowDeficitDays', lang === 'km' ? 'ថ្ងៃមានឱនភាព' : 'Deficit days')}</option>
                        <option value="InflowOnly">{t('cashFlowDaysWithInflow', lang === 'km' ? 'ថ្ងៃមានប្រាក់ចូល' : 'Days with inflow')}</option>
                        <option value="OutflowOnly">{t('cashFlowDaysWithOutflow', lang === 'km' ? 'ថ្ងៃមានប្រាក់ចេញ' : 'Days with outflow')}</option>
                    </select>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* DAILY COMPARATIVE CARDS STREAM (WHITE THEME TRADER CARDS)     */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
                    <span className="font-bold font-mono text-slate-700">
                        📋 {t('cashFlowDailyRecordsAnalysis', lang === 'km' ? 'កំណត់ត្រាហិរញ្ញវត្ថុប្រចាំថ្ងៃ (វិភាគប្រៀបធៀបពីមួយថ្ងៃទៅមួយថ្ងៃ)' : 'Daily financial records (day-over-day analysis)')}
                    </span>
                    <span>{t('showing', lang === 'km' ? 'បង្ហាញ' : 'Showing')} {filteredRecords.length} {t('days', lang === 'km' ? 'ថ្ងៃ' : 'days')}</span>
                </div>

                {filteredRecords.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-[5px] p-8 text-center text-slate-400 text-xs font-mono">
                        មិនមានទិន្នន័យក្នុងចន្លោះពេលនេះឡើយ
                    </div>
                ) : (
                    filteredRecords.map((day) => {
                        const isToday = day.date === todayStr;
                        const isHighlighted = highlightedDate === day.date;
                        const isExpanded = Boolean(expandedDays[day.date]);

                        const isSurplus = day.netFlow >= 0;
                        const dayNameKh = getDayNameKhmer(day.date, lang);

                        return (
                            <div
                                key={day.date}
                                id={`day-card-${day.date}`}
                                className={`bg-white border rounded-[5px] p-3.5 sm:p-4 transition-all duration-300 relative shadow-2xs ${
                                    isHighlighted
                                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg bg-emerald-50/20'
                                        : isToday
                                            ? 'border-amber-400/80 shadow-md bg-amber-50/20'
                                            : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {/* Card Header / Top Bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-[5px] flex items-center justify-center font-bold text-xs ${
                                            isSurplus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {isSurplus ? <MdTrendingUp size={18} /> : <MdTrendingDown size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                                                    {day.date}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    ({dayNameKh})
                                                </span>
                                                {isToday && (
                                                    <span className="px-2 py-0.5 rounded-[5px] text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        ថ្ងៃនេះ (TODAY)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Surplus/Deficit Status Badge */}
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-[5px] text-[11px] font-mono font-bold border ${
                                            isSurplus
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                : 'bg-rose-50 text-rose-700 border-rose-300'
                                        }`}>
                                            {isSurplus ? '▲ លើសសាច់ប្រាក់ (SURPLUS)' : '▼ ឱនភាព (DEFICIT)'}
                                        </span>

                                        <button
                                            onClick={() => toggleExpandDay(day.date)}
                                            className="px-2 py-1 rounded-[5px] text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>{day.inflowCount + day.outflowCount} {t('cashFlowTransactions', lang === 'km' ? 'ប្រតិបត្តិការ' : 'transactions')}</span>
                                            {isExpanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                        </button>
                                    </div>
                                </div>

                                {/* 3 Column Metric Breakdown (In, Out, Net) with DoD Comparisons */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* 1. Cash In Box */}
                                    <div className="bg-emerald-50/70 p-3 rounded-[5px] border border-emerald-200/80">
                                        <div className="flex items-center justify-between text-xs text-emerald-800 font-bold mb-1">
                                            <span>📥 {t('cashFlowTotalCashIn', lang === 'km' ? 'ប្រាក់ចូល' : 'CASH IN')}</span>
                                            <span className="text-[10px] font-mono font-normal text-slate-500">
                                                {day.inflowCount} {t('cashFlowTransactions', lang === 'km' ? 'ប្រតិបត្តិការ' : 'transactions')}
                                            </span>
                                        </div>
                                        <p className="text-base sm:text-lg font-black font-mono text-emerald-700">
                                            {formatCurrency(day.cashIn)}
                                        </p>

                                        {/* Day-over-Day Inflow Delta */}
                                        <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[11px] font-mono flex items-center gap-1">
                                            {day.inDiff > 0 ? (
                                                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                                    <FaArrowUp className="text-[9px]" />
                                                    {t('cashFlowMoreThanYesterday', lang === 'km' ? 'ច្រើនជាងម្សិលមិញ' : 'More than yesterday')} +{formatCurrency(day.inDiff)} (+{day.inPct}%)
                                                </span>
                                            ) : day.inDiff < 0 ? (
                                                <span className="text-rose-700 font-bold flex items-center gap-0.5">
                                                    <FaArrowDown className="text-[9px]" />
                                                    {t('cashFlowLessThanYesterday', lang === 'km' ? 'តិចជាងម្សិលមិញ' : 'Less than yesterday')} -{formatCurrency(Math.abs(day.inDiff))} ({day.inPct}%)
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">
                                                    = {t('cashFlowSameAsYesterday', lang === 'km' ? 'ស្មើនឹងម្សិលមិញ' : 'Same as yesterday')} (0.0%)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Cash Out Box */}
                                    <div className="bg-rose-50/70 p-3 rounded-[5px] border border-rose-200/80">
                                        <div className="flex items-center justify-between text-xs text-rose-800 font-bold mb-1">
                                            <span>📤 {t('cashFlowTotalCashOut', lang === 'km' ? 'ប្រាក់ចេញ' : 'CASH OUT')}</span>
                                            <span className="text-[10px] font-mono font-normal text-slate-500">
                                                {day.outflowCount} {t('cashFlowTransactions', lang === 'km' ? 'ប្រតិបត្តិការ' : 'transactions')}
                                            </span>
                                        </div>
                                        <p className="text-base sm:text-lg font-black font-mono text-rose-700">
                                            {formatCurrency(day.cashOut)}
                                        </p>

                                        {/* Day-over-Day Outflow Delta */}
                                        <div className="mt-1.5 pt-1.5 border-t border-rose-200/60 text-[11px] font-mono flex items-center gap-1">
                                            {day.outDiff > 0 ? (
                                                <span className="text-rose-700 font-bold flex items-center gap-0.5">
                                                    <FaArrowUp className="text-[9px]" />
                                                    {t('cashFlowOutflowMoreThanYesterday', lang === 'km' ? 'ចេញច្រើនជាងម្សិលមិញ' : 'Outflow higher than yesterday')} +{formatCurrency(day.outDiff)} (+{day.outPct}%)
                                                </span>
                                            ) : day.outDiff < 0 ? (
                                                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                                    <FaArrowDown className="text-[9px]" />
                                                    {t('cashFlowOutflowLessThanYesterday', lang === 'km' ? 'ចេញតិចជាងម្សិលមិញ' : 'Outflow lower than yesterday')} -{formatCurrency(Math.abs(day.outDiff))} ({day.outPct}%)
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">
                                                    = {t('cashFlowExpenseSameAsYesterday', lang === 'km' ? 'ចំណាយស្មើម្សិលមិញ' : 'Same expenses as yesterday')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Net Flow Box */}
                                    <div className={`p-3 rounded-[5px] border ${
                                        isSurplus
                                            ? 'bg-teal-50/70 border-teal-200/80'
                                            : 'bg-rose-50/70 border-rose-200/80'
                                    }`}>
                                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                                            <span className={isSurplus ? 'text-teal-800' : 'text-rose-800'}>
                                                ⚖️ {t('cashFlowNetCashFlow', lang === 'km' ? 'លំហូរសាច់ប្រាក់សុទ្ធ' : 'NET CASH FLOW')}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500">
                                                {t('cashFlowInflowVsOutflow', lang === 'km' ? 'ប្រាក់ចូលធៀបនឹងប្រាក់ចេញ' : 'Inflow vs Outflow')}
                                            </span>
                                        </div>
                                        <p className={`text-base sm:text-lg font-black font-mono ${
                                            isSurplus ? 'text-teal-700' : 'text-rose-700'
                                        }`}>
                                            {isSurplus ? '+' : ''}{formatCurrency(day.netFlow)}
                                        </p>

                                        {/* Day-over-Day Net Spread */}
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[11px] font-mono flex items-center gap-1">
                                            {day.netDiff > 0 ? (
                                                <span className="text-emerald-700 font-bold">
                                                    ▲ {t('cashFlowNetHigherThanYesterday', lang === 'km' ? 'សល់សុទ្ធច្រើនជាងម្សិលមិញ' : 'Net flow higher than yesterday')} +{formatCurrency(day.netDiff)}
                                                </span>
                                            ) : day.netDiff < 0 ? (
                                                <span className="text-rose-700 font-bold">
                                                    ▼ {t('cashFlowNetLowerThanYesterday', lang === 'km' ? 'សល់សុទ្ធតិចជាងម្សិលមិញ' : 'Net flow lower than yesterday')} -{formatCurrency(Math.abs(day.netDiff))}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">
                                                    = {t('cashFlowNetSameAsYesterday', lang === 'km' ? 'ស្មើនឹងម្សិលមិញ' : 'Same net flow as yesterday')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Flow Proportion Bar */}
                                <div className="mt-2.5 pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                                        <span>{t('cashFlowProportion', lang === 'km' ? 'សមាមាត្រលំហូរសាច់ប្រាក់:' : 'Cash flow proportion:')}</span>
                                        <span>
                                            In: {day.cashIn + day.cashOut > 0 ? ((day.cashIn / (day.cashIn + day.cashOut)) * 100).toFixed(1) : 0}% | Out: {day.cashIn + day.cashOut > 0 ? ((day.cashOut / (day.cashIn + day.cashOut)) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-[5px] bg-slate-200 overflow-hidden flex">
                                        <div
                                            style={{ width: `${day.cashIn + day.cashOut > 0 ? (day.cashIn / (day.cashIn + day.cashOut)) * 100 : 50}%` }}
                                            className="bg-emerald-500 h-full"
                                        ></div>
                                        <div
                                            style={{ width: `${day.cashIn + day.cashOut > 0 ? (day.cashOut / (day.cashIn + day.cashOut)) * 100 : 50}%` }}
                                            className="bg-rose-500 h-full"
                                        ></div>
                                    </div>
                                </div>

                                {/* Expandable Transaction Details List */}
                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-200">
                                        <p className="text-xs font-bold text-slate-800 font-mono">
                                            🧾 {t('cashFlowTransactionsForDate', lang === 'km' ? `បញ្ជីប្រតិបត្តិការលម្អិតសម្រាប់ថ្ងៃ ${day.date}:` : `Transactions for ${day.date}:`)}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {/* Inflow List */}
                                            <div className="bg-emerald-50/40 p-2.5 rounded-[5px] border border-emerald-200 text-xs font-mono">
                                                <p className="font-bold text-emerald-800 mb-1.5 pb-1 border-b border-emerald-200">
                                                    📥 {t('cashFlowTotalCashIn', lang === 'km' ? 'ប្រាក់ចូល' : 'Cash in')} ({day.inflowItems?.length || 0})
                                                </p>
                                                {day.inflowItems && day.inflowItems.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                        {day.inflowItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-1.5 rounded-[3px] bg-white border border-slate-200 shadow-2xs">
                                                                <div className="truncate mr-2">
                                                                    <p className="font-semibold text-slate-800 truncate">{item.title}</p>
                                                                    <p className="text-[10px] text-slate-500">{item.performedBy} {item.time && `• ${item.time}`}</p>
                                                                </div>
                                                                <span className="font-bold text-emerald-700 whitespace-nowrap">
                                                                    +{formatCurrency(item.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-400 text-[11px] italic">{t('cashFlowNoInflowTransactions', lang === 'km' ? 'មិនមានប្រតិបត្តិការប្រាក់ចូលទេ' : 'No cash-in transactions')}</p>
                                                )}
                                            </div>

                                            {/* Outflow List */}
                                            <div className="bg-rose-50/40 p-2.5 rounded-[5px] border border-rose-200 text-xs font-mono">
                                                <p className="font-bold text-rose-800 mb-1.5 pb-1 border-b border-rose-200">
                                                    📤 {t('cashFlowTotalCashOut', lang === 'km' ? 'ប្រាក់ចេញ' : 'Cash out')} ({day.outflowItems?.length || 0})
                                                </p>
                                                {day.outflowItems && day.outflowItems.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                        {day.outflowItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-1.5 rounded-[3px] bg-white border border-slate-200 shadow-2xs">
                                                                <div className="truncate mr-2">
                                                                    <p className="font-semibold text-slate-800 truncate">{item.title}</p>
                                                                    <p className="text-[10px] text-slate-500">{item.performedBy} {item.time && `• ${item.time}`}</p>
                                                                </div>
                                                                <span className="font-bold text-rose-700 whitespace-nowrap">
                                                                    -{formatCurrency(item.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-400 text-[11px] italic">{t('cashFlowNoOutflowTransactions', lang === 'km' ? 'មិនមានប្រតិបត្តិការប្រាក់ចេញទេ' : 'No cash-out transactions')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CashFlowTrader;
