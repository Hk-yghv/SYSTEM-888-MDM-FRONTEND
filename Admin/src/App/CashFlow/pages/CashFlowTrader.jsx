import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
    FaChartLine, FaArrowUp, FaArrowDown, FaCalendarAlt, FaSearch,
    FaSync, FaExchangeAlt, FaMoneyBillWave, FaCoins, FaCheckCircle,
    FaExclamationCircle, FaChevronDown, FaChevronUp, FaInfoCircle,
    FaSpinner, FaFilter, FaFire
} from 'react-icons/fa';
import { MdOutlineBarChart, MdTrendingUp, MdTrendingDown } from 'react-icons/md';
import { BsArrowRepeat, BsSliders } from 'react-icons/bs';

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

const getDayNameKhmer = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const days = ['ថ្ងៃអាទិត្យ', 'ថ្ងៃច័ន្ទ', 'ថ្ងៃអង្គារ', 'ថ្ងៃពុធ', 'ថ្ងៃព្រហស្បតិ៍', 'ថ្ងៃសុក្រ', 'ថ្ងៃសៅរ៍'];
    return days[d.getDay()] || '';
};

const CashFlowTrader = () => {
    const { user, API_BASE } = useAuth();
    const { t } = useLanguage();

    const todayStr = useMemo(() => formatDateToYMD(new Date()), []);
    const [selectedPeriod, setSelectedPeriod] = useState('30D'); // 7D | 14D | 30D | 90D | All
    const [chartMode, setChartMode] = useState('dual'); // 'dual' (In/Out Bars) | 'net' (Net Area)
    
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
    const [filterFlowType, setFilterFlowType] = useState('All'); // All | Inflow | Outflow | Surplus | Deficit
    const [expandedDays, setExpandedDays] = useState({});

    // Chart Hover State
    const [hoveredPoint, setHoveredPoint] = useState(null);

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
            alert(`មិនមានទិន្នន័យប្រតិបត្តិការសម្រាប់ថ្ងៃ ${normalized} នៅក្នុងបញ្ជីបច្ចុប្បន្នទេ!`);
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

    // ─── SVG Chart Data Calculation ──────────────────────────────────
    const chartHeight = 220;
    const chartWidth = 900;
    const paddingX = 40;
    const paddingY = 25;

    const maxVal = useMemo(() => {
        let max = 0;
        chronologicalRecords.forEach(r => {
            if (r.cashIn > max) max = r.cashIn;
            if (r.cashOut > max) max = r.cashOut;
            if (Math.abs(r.netFlow) > max) max = Math.abs(r.netFlow);
        });
        return max > 0 ? max * 1.15 : 1000;
    }, [chronologicalRecords]);

    const chartPoints = useMemo(() => {
        const count = chronologicalRecords.length;
        if (count === 0) return [];
        const stepX = (chartWidth - paddingX * 2) / Math.max(count - 1, 1);

        return chronologicalRecords.map((r, i) => {
            const x = paddingX + i * stepX;
            const inY = chartHeight - paddingY - (r.cashIn / maxVal) * (chartHeight - paddingY * 2);
            const outY = chartHeight - paddingY - (r.cashOut / maxVal) * (chartHeight - paddingY * 2);
            
            // Net position: mapped with center line
            const zeroY = chartHeight - paddingY - (0 / maxVal) * (chartHeight - paddingY * 2);
            const netY = chartHeight - paddingY - (Math.max(0, r.netFlow) / maxVal) * (chartHeight - paddingY * 2);

            return {
                ...r,
                x,
                inY,
                outY,
                netY,
                zeroY
            };
        });
    }, [chronologicalRecords, maxVal]);

    const netAreaPath = useMemo(() => {
        if (chartPoints.length === 0) return '';
        const first = chartPoints[0];
        const last = chartPoints[chartPoints.length - 1];
        const bottomY = chartHeight - paddingY;

        let path = `M ${first.x} ${first.netY}`;
        for (let i = 1; i < chartPoints.length; i++) {
            path += ` L ${chartPoints[i].x} ${chartPoints[i].netY}`;
        }
        path += ` L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
        return path;
    }, [chartPoints]);

    const netLinePath = useMemo(() => {
        if (chartPoints.length === 0) return '';
        let path = `M ${chartPoints[0].x} ${chartPoints[0].netY}`;
        for (let i = 1; i < chartPoints.length; i++) {
            path += ` L ${chartPoints[i].x} ${chartPoints[i].netY}`;
        }
        return path;
    }, [chartPoints]);

    const toggleExpandDay = (date) => {
        setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
    };

    return (
        <div className="p-3 sm:p-5 space-y-4 bg-[#0a0e17] text-slate-100 min-h-screen font-sans">
            {/* ═════════════════════════════════════════════════════════════ */}
            {/* TRADER HEADER / TICKER TERMINAL                               */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-[#111827] border border-slate-800 rounded-[5px] p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 animate-pulse"></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Title & Live Status */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-[5px] bg-gradient-to-br from-amber-500 via-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <MdTrendingUp size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                                    CASH FLOW TRADER
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                    LIVE MARKET
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                                តាមដានលំហូរសាច់ប្រាក់ចេញ-ចូលប្រចាំថ្ងៃ ដូចក្រាហ្វិកទីផ្សារហិរញ្ញវត្ថុ & DoD Change
                            </p>
                        </div>
                    </div>

                    {/* Period Selector & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Timeframe Chips */}
                        <div className="flex items-center bg-[#1f2937] p-1 rounded-[5px] border border-slate-700 text-xs font-bold font-mono">
                            {['7D', '14D', '30D', '90D', 'All'].map(period => (
                                <button
                                    key={period}
                                    onClick={() => setSelectedPeriod(period)}
                                    className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                        selectedPeriod === period
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>

                        {/* Chart View Toggle */}
                        <div className="flex items-center bg-[#1f2937] p-1 rounded-[5px] border border-slate-700 text-xs font-bold font-mono">
                            <button
                                onClick={() => setChartMode('dual')}
                                className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                    chartMode === 'dual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                In/Out Bar
                            </button>
                            <button
                                onClick={() => setChartMode('net')}
                                className={`px-2.5 py-1 rounded-[5px] transition-all cursor-pointer ${
                                    chartMode === 'net' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Net Flow
                            </button>
                        </div>

                        {/* Reload */}
                        <button
                            onClick={fetchTraderMetrics}
                            disabled={reloading}
                            title="Refresh Data"
                            className="p-2 rounded-[5px] bg-[#1f2937] hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
                        >
                            <FaSync className={`text-xs ${reloading ? 'animate-spin text-emerald-400' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Live Ticker Bar (Trader Bar) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-800/80">
                    {/* Cash In Ticker */}
                    <div className="bg-[#162032] p-2.5 rounded-[5px] border border-emerald-900/40">
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                            <span>TOTAL CASH IN (ចូល)</span>
                            <FaMoneyBillWave />
                        </div>
                        <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                            {formatCurrency(summary.totalCashIn)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            ពីការបង់ប្រាក់កុងត្រា & ប្រាក់ចូល
                        </p>
                    </div>

                    {/* Cash Out Ticker */}
                    <div className="bg-[#24141e] p-2.5 rounded-[5px] border border-rose-900/40">
                        <div className="flex items-center justify-between text-[11px] text-rose-400 font-bold">
                            <span>TOTAL CASH OUT (ចេញ)</span>
                            <FaCoins />
                        </div>
                        <p className="text-lg font-black font-mono text-rose-400 mt-0.5">
                            {formatCurrency(summary.totalCashOut)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            ចំណាយសាច់ប្រាក់ចេញសរុប
                        </p>
                    </div>

                    {/* Net Balance Ticker */}
                    <div className={`p-2.5 rounded-[5px] border ${
                        summary.totalNetFlow >= 0 ? 'bg-[#0f2420] border-emerald-700/50' : 'bg-[#29141b] border-rose-700/50'
                    }`}>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={summary.totalNetFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                NET CASH FLOW (សល់សុទ្ធ)
                            </span>
                            <FaExchangeAlt className={summary.totalNetFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                        </div>
                        <p className={`text-lg font-black font-mono mt-0.5 ${
                            summary.totalNetFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}>
                            {summary.totalNetFlow >= 0 ? '+' : ''}{formatCurrency(summary.totalNetFlow)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {summary.totalNetFlow >= 0 ? '🟢 លើសចំណូល (Surplus)' : '🔴 ឱនភាពសាច់ប្រាក់ (Deficit)'}
                        </p>
                    </div>

                    {/* Today DoD Ticker */}
                    <div className="bg-[#1f2937] p-2.5 rounded-[5px] border border-slate-700">
                        <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold">
                            <span>TODAY VS YESTERDAY</span>
                            <FaFire />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-black font-mono text-white">
                                {formatCurrency(summary.todayStats?.cashIn || 0)}
                            </span>
                            {summary.todayStats?.inDiff !== 0 && (
                                <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] font-mono ${
                                    summary.todayStats?.inDiff > 0
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                }`}>
                                    {summary.todayStats?.inDiff > 0 ? <FaArrowUp className="mr-0.5 text-[8px]" /> : <FaArrowDown className="mr-0.5 text-[8px]" />}
                                    {summary.todayStats?.inPct > 0 ? '+' : ''}{summary.todayStats?.inPct}%
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {summary.todayStats?.inDiff > 0 ? 'ចូលច្រើនជាងម្សិលមិញ' : (summary.todayStats?.inDiff < 0 ? 'ចូលតិចជាងម្សិលមិញ' : 'ទិន្នន័យស្មើម្សិលមិញ')}
                        </p>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* TRADER CHART (SVG INTERACTIVE GOLD / CRYPTO STYLE CHART)      */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-[#111827] border border-slate-800 rounded-[5px] p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-300 font-mono">
                            📊 TRADING TIMELINE ({chronologicalRecords.length} ថ្ងៃ)
                        </span>
                        <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500"></span> Cash In (បៃតង)
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-400">
                                <span className="w-2.5 h-2.5 rounded-[2px] bg-rose-500"></span> Cash Out (ក្រហម)
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-400">
                                <span className="w-3 h-0.5 bg-amber-400"></span> Net Trend (មាស)
                            </span>
                        </div>
                    </div>

                    <span className="text-[11px] text-slate-400 italic">
                        💡 ចុចលើចំណុចណាមួយ ដើម្បី Scroll ទៅរកថ្ងៃនោះ
                    </span>
                </div>

                {/* SVG Canvas Area */}
                <div className="relative w-full overflow-x-auto select-none bg-[#0a0e17] rounded-[5px] border border-slate-800/80 p-2">
                    {loading ? (
                        <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                            <FaSpinner className="animate-spin text-2xl text-emerald-500" />
                            <span>កំពុងទាញយកទិន្នន័យក្រាហ្វិក...</span>
                        </div>
                    ) : chartPoints.length === 0 ? (
                        <div className="h-[220px] flex items-center justify-center text-slate-500 text-xs font-mono">
                            មិនទាន់មានទិន្នន័យប្រតិបត្តិការក្នុងចន្លោះពេលនេះឡើយ
                        </div>
                    ) : (
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="w-full h-[220px] overflow-visible"
                        >
                            <defs>
                                <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                                const y = paddingY + pct * (chartHeight - paddingY * 2);
                                const valLabel = Math.round(maxVal * (1 - pct));
                                return (
                                    <g key={idx}>
                                        <line
                                            x1={paddingX}
                                            y1={y}
                                            x2={chartWidth - paddingX}
                                            y2={y}
                                            stroke="#1f2937"
                                            strokeDasharray="3 3"
                                        />
                                        <text
                                            x={paddingX - 8}
                                            y={y + 3}
                                            fill="#6b7280"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            textAnchor="end"
                                        >
                                            ${valLabel >= 1000 ? `${(valLabel / 1000).toFixed(1)}k` : valLabel}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Net Flow Gradient Area & Line (if in Net Mode) */}
                            {chartMode === 'net' && (
                                <>
                                    <path d={netAreaPath} fill="url(#goldGradient)" />
                                    <path
                                        d={netLinePath}
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </>
                            )}

                            {/* Dual Candlestick / Bar Columns */}
                            {chartMode === 'dual' && chartPoints.map((pt) => {
                                const barW = Math.max(3, Math.min(12, (chartWidth / chartPoints.length) * 0.35));
                                return (
                                    <g key={pt.date}>
                                        {/* Cash In Bar (Green) */}
                                        <rect
                                            x={pt.x - barW - 1}
                                            y={pt.inY}
                                            width={barW}
                                            height={Math.max(1, chartHeight - paddingY - pt.inY)}
                                            fill="#10b981"
                                            opacity={hoveredPoint?.date === pt.date ? 1 : 0.85}
                                            rx="1"
                                        />

                                        {/* Cash Out Bar (Red) */}
                                        <rect
                                            x={pt.x + 1}
                                            y={pt.outY}
                                            width={barW}
                                            height={Math.max(1, chartHeight - paddingY - pt.outY)}
                                            fill="#ef4444"
                                            opacity={hoveredPoint?.date === pt.date ? 1 : 0.85}
                                            rx="1"
                                        />

                                        {/* Net Trend Point */}
                                        <circle
                                            cx={pt.x}
                                            cy={pt.netY}
                                            r="2.5"
                                            fill="#f59e0b"
                                        />
                                    </g>
                                );
                            })}

                            {/* Net Trend Line on Dual Mode */}
                            {chartMode === 'dual' && (
                                <path
                                    d={netLinePath}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="1.5"
                                    strokeDasharray="2 2"
                                    opacity="0.8"
                                />
                            )}

                            {/* Interactive Touch / Click Columns */}
                            {chartPoints.map((pt) => (
                                <rect
                                    key={`hit-${pt.date}`}
                                    x={pt.x - 12}
                                    y={paddingY}
                                    width={24}
                                    height={chartHeight - paddingY * 2}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredPoint(pt)}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                    onClick={() => handleScrollToDate(pt.date)}
                                />
                            ))}

                            {/* Active Hover Crosshair Line */}
                            {hoveredPoint && (
                                <g>
                                    <line
                                        x1={hoveredPoint.x}
                                        y1={paddingY}
                                        x2={hoveredPoint.x}
                                        y2={chartHeight - paddingY}
                                        stroke="#3b82f6"
                                        strokeWidth="1.5"
                                        strokeDasharray="2 2"
                                    />
                                    <circle
                                        cx={hoveredPoint.x}
                                        cy={hoveredPoint.netY}
                                        r="4"
                                        fill="#3b82f6"
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                    />
                                </g>
                            )}
                        </svg>
                    )}

                    {/* Floating HUD Tooltip */}
                    {hoveredPoint && (
                        <div
                            className="absolute top-3 right-4 bg-[#1f2937]/95 border border-slate-700 rounded-[5px] p-2.5 shadow-2xl backdrop-blur-md text-[11px] font-mono pointer-events-none animate-in fade-in duration-150 z-20"
                        >
                            <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1">
                                📅 {hoveredPoint.date} ({getDayNameKhmer(hoveredPoint.date)})
                            </p>
                            <p className="text-emerald-400 font-bold">
                                ចូល (In): {formatCurrency(hoveredPoint.cashIn)}{' '}
                                {hoveredPoint.inDiff !== 0 && (
                                    <span className={hoveredPoint.inDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                        ({hoveredPoint.inDiff > 0 ? '+' : ''}{hoveredPoint.inPct}%)
                                    </span>
                                )}
                            </p>
                            <p className="text-rose-400 font-bold">
                                ចេញ (Out): {formatCurrency(hoveredPoint.cashOut)}
                            </p>
                            <p className={hoveredPoint.netFlow >= 0 ? 'text-amber-400 font-black' : 'text-rose-400 font-black'}>
                                សល់ (Net): {hoveredPoint.netFlow >= 0 ? '+' : ''}{formatCurrency(hoveredPoint.netFlow)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* SEARCH & JUMP CONTROLS (AUTO-SCROLL MECHANISM)                */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="bg-[#111827] border border-slate-800 rounded-[5px] p-3 shadow-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Date Search Input */}
                    <div className="flex items-center gap-1.5 bg-[#1f2937] px-3 py-1.5 rounded-[5px] border border-slate-700 text-xs">
                        <FaSearch className="text-emerald-400 text-xs" />
                        <span className="font-bold text-slate-300">ស្វែងរកកាលបរិច្ឆេទ:</span>
                        <input
                            type="date"
                            value={searchDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchDate(val);
                                if (val) handleScrollToDate(val);
                            }}
                            className="bg-transparent text-white font-mono text-xs font-bold focus:outline-none cursor-pointer"
                        />
                        {searchDate && (
                            <button
                                onClick={() => setSearchDate('')}
                                className="text-slate-400 hover:text-white text-xs px-1"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Quick Jump Buttons */}
                    <button
                        onClick={() => handleScrollToDate(todayStr)}
                        className="px-2.5 py-1.5 rounded-[5px] text-xs font-bold font-mono bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                        🎯 ទៅកាន់ថ្ងៃនេះ
                    </button>

                    <button
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            handleScrollToDate(formatDateToYMD(d));
                        }}
                        className="px-2.5 py-1.5 rounded-[5px] text-xs font-bold font-mono bg-[#1f2937] hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    >
                        ម្សិលមិញ
                    </button>
                </div>

                {/* Filter Flow Type */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-slate-400">តម្រង:</span>
                    <select
                        value={filterFlowType}
                        onChange={(e) => setFilterFlowType(e.target.value)}
                        className="bg-[#1f2937] text-slate-200 border border-slate-700 rounded-[5px] px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                    >
                        <option value="All">ថ្ងៃទាំងអស់ ({dailyRecords.length})</option>
                        <option value="Surplus">ថ្ងៃចំណេញសល់ (Surplus)</option>
                        <option value="Deficit">ថ្ងៃឱនភាព (Deficit)</option>
                        <option value="InflowOnly">ថ្ងៃមានប្រាក់ចូល</option>
                        <option value="OutflowOnly">ថ្ងៃមានប្រាក់ចេញ</option>
                    </select>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* DAILY COMPARATIVE CARDS STREAM (DAY-OVER-DAY TRADER FEED)     */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-bold font-mono">
                        📋 កំណត់ត្រាហិរញ្ញវត្ថុប្រចាំថ្ងៃ (DAY-OVER-DAY ANALYSIS)
                    </span>
                    <span>បង្ហាញ {filteredRecords.length} ថ្ងៃ</span>
                </div>

                {filteredRecords.length === 0 ? (
                    <div className="bg-[#111827] border border-slate-800 rounded-[5px] p-8 text-center text-slate-400 text-xs font-mono">
                        មិនមានទិន្នន័យក្នុងចន្លោះពេលនេះឡើយ
                    </div>
                ) : (
                    filteredRecords.map((day) => {
                        const isToday = day.date === todayStr;
                        const isHighlighted = highlightedDate === day.date;
                        const isExpanded = Boolean(expandedDays[day.date]);

                        const isSurplus = day.netFlow >= 0;
                        const dayNameKh = getDayNameKhmer(day.date);

                        return (
                            <div
                                key={day.date}
                                id={`day-card-${day.date}`}
                                className={`bg-[#111827] border rounded-[5px] p-3.5 sm:p-4 transition-all duration-300 relative ${
                                    isHighlighted
                                        ? 'border-emerald-400 ring-2 ring-emerald-500 shadow-2xl bg-[#131d2e]'
                                        : isToday
                                            ? 'border-amber-500/60 shadow-lg bg-[#141b2b]'
                                            : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                {/* Card Header / Top Bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-[5px] flex items-center justify-center font-bold text-xs ${
                                            isSurplus ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                        }`}>
                                            {isSurplus ? <MdTrendingUp size={18} /> : <MdTrendingDown size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-sm text-white tracking-wider">
                                                    {day.date}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    ({dayNameKh})
                                                </span>
                                                {isToday && (
                                                    <span className="px-2 py-0.5 rounded-[5px] text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
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
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                        }`}>
                                            {isSurplus ? '▲ លើសសាច់ប្រាក់ (SURPLUS)' : '▼ ឱនភាព (DEFICIT)'}
                                        </span>

                                        <button
                                            onClick={() => toggleExpandDay(day.date)}
                                            className="px-2 py-1 rounded-[5px] text-xs font-bold text-slate-400 hover:text-white bg-[#1f2937] hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>{day.inflowCount + day.outflowCount} ប្រតិបត្តិការ</span>
                                            {isExpanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                        </button>
                                    </div>
                                </div>

                                {/* 3 Column Metric Breakdown (In, Out, Net) with DoD Comparisons */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* 1. Cash In Box */}
                                    <div className="bg-[#0c1824] p-3 rounded-[5px] border border-emerald-900/30">
                                        <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1">
                                            <span>📥 CASH IN (ប្រាក់ចូល)</span>
                                            <span className="text-[10px] font-mono font-normal text-slate-400">
                                                {day.inflowCount} ប្រតិបត្តិការ
                                            </span>
                                        </div>
                                        <p className="text-base sm:text-lg font-black font-mono text-emerald-400">
                                            {formatCurrency(day.cashIn)}
                                        </p>

                                        {/* Day-over-Day Inflow Delta */}
                                        <div className="mt-1.5 pt-1.5 border-t border-emerald-950/60 text-[11px] font-mono flex items-center gap-1">
                                            {day.inDiff > 0 ? (
                                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                                    <FaArrowUp className="text-[9px]" />
                                                    ច្រើនជាងម្សិលមិញ +{formatCurrency(day.inDiff)} (+{day.inPct}%)
                                                </span>
                                            ) : day.inDiff < 0 ? (
                                                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                                    <FaArrowDown className="text-[9px]" />
                                                    តិចជាងម្សិលមិញ -{formatCurrency(Math.abs(day.inDiff))} ({day.inPct}%)
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">
                                                    = ស្មើនឹងម្សិលមិញ (0.0%)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Cash Out Box */}
                                    <div className="bg-[#1c0f16] p-3 rounded-[5px] border border-rose-900/30">
                                        <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1">
                                            <span>📤 CASH OUT (ប្រាក់ចេញ)</span>
                                            <span className="text-[10px] font-mono font-normal text-slate-400">
                                                {day.outflowCount} ប្រតិបត្តិការ
                                            </span>
                                        </div>
                                        <p className="text-base sm:text-lg font-black font-mono text-rose-400">
                                            {formatCurrency(day.cashOut)}
                                        </p>

                                        {/* Day-over-Day Outflow Delta */}
                                        <div className="mt-1.5 pt-1.5 border-t border-rose-950/60 text-[11px] font-mono flex items-center gap-1">
                                            {day.outDiff > 0 ? (
                                                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                                    <FaArrowUp className="text-[9px]" />
                                                    ចេញច្រើនជាងម្សិលមិញ +{formatCurrency(day.outDiff)} (+{day.outPct}%)
                                                </span>
                                            ) : day.outDiff < 0 ? (
                                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                                    <FaArrowDown className="text-[9px]" />
                                                    ចេញតិចជាងម្សិលមិញ -{formatCurrency(Math.abs(day.outDiff))} ({day.outPct}%)
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">
                                                    = ចំណាយស្មើម្សិលមិញ
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Net Flow Box */}
                                    <div className={`p-3 rounded-[5px] border ${
                                        isSurplus
                                            ? 'bg-[#0f1f1d] border-emerald-800/40'
                                            : 'bg-[#211116] border-rose-800/40'
                                    }`}>
                                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                                            <span className={isSurplus ? 'text-amber-400' : 'text-rose-400'}>
                                                ⚖️ NET CASH FLOW (សល់សុទ្ធ)
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">
                                                Inflow vs Outflow
                                            </span>
                                        </div>
                                        <p className={`text-base sm:text-lg font-black font-mono ${
                                            isSurplus ? 'text-emerald-300' : 'text-rose-300'
                                        }`}>
                                            {isSurplus ? '+' : ''}{formatCurrency(day.netFlow)}
                                        </p>

                                        {/* Day-over-Day Net Spread */}
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[11px] font-mono flex items-center gap-1">
                                            {day.netDiff > 0 ? (
                                                <span className="text-emerald-400 font-bold">
                                                    ▲ ចំណេញជាងម្សិលមិញ +{formatCurrency(day.netDiff)}
                                                </span>
                                            ) : day.netDiff < 0 ? (
                                                <span className="text-rose-400 font-bold">
                                                    ▼ ធ្លាក់ចុះជាងម្សិលមិញ -{formatCurrency(Math.abs(day.netDiff))}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">
                                                    = ស្មើសុទ្ធនឹងម្សិលមិញ
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Flow Proportion Bar */}
                                <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                                        <span>សមាមាត្រលំហូរសាច់ប្រាក់:</span>
                                        <span>
                                            In: {day.cashIn + day.cashOut > 0 ? ((day.cashIn / (day.cashIn + day.cashOut)) * 100).toFixed(1) : 0}% | Out: {day.cashIn + day.cashOut > 0 ? ((day.cashOut / (day.cashIn + day.cashOut)) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-[5px] bg-slate-800 overflow-hidden flex">
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
                                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 animate-in fade-in duration-200">
                                        <p className="text-xs font-bold text-slate-300 font-mono">
                                            🧾 បញ្ជីប្រតិបត្តិការលម្អិតសម្រាប់ថ្ងៃ {day.date}:
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {/* Inflow List */}
                                            <div className="bg-[#0d1624] p-2.5 rounded-[5px] border border-emerald-950 text-xs font-mono">
                                                <p className="font-bold text-emerald-400 mb-1.5 pb-1 border-b border-emerald-900/40">
                                                    📥 ប្រាក់ចូល ({day.inflowItems?.length || 0})
                                                </p>
                                                {day.inflowItems && day.inflowItems.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                        {day.inflowItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-1.5 rounded-[3px] bg-slate-900/60">
                                                                <div className="truncate mr-2">
                                                                    <p className="font-semibold text-slate-200 truncate">{item.title}</p>
                                                                    <p className="text-[10px] text-slate-400">{item.performedBy} {item.time && `• ${item.time}`}</p>
                                                                </div>
                                                                <span className="font-bold text-emerald-400 whitespace-nowrap">
                                                                    +{formatCurrency(item.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-500 text-[11px] italic">មិនមានប្រតិបត្តិការប្រាក់ចូលទេ</p>
                                                )}
                                            </div>

                                            {/* Outflow List */}
                                            <div className="bg-[#1c0f16] p-2.5 rounded-[5px] border border-rose-950 text-xs font-mono">
                                                <p className="font-bold text-rose-400 mb-1.5 pb-1 border-b border-rose-900/40">
                                                    📤 ប្រាក់ចេញ ({day.outflowItems?.length || 0})
                                                </p>
                                                {day.outflowItems && day.outflowItems.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                        {day.outflowItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-1.5 rounded-[3px] bg-slate-900/60">
                                                                <div className="truncate mr-2">
                                                                    <p className="font-semibold text-slate-200 truncate">{item.title}</p>
                                                                    <p className="text-[10px] text-slate-400">{item.performedBy} {item.time && `• ${item.time}`}</p>
                                                                </div>
                                                                <span className="font-bold text-rose-400 whitespace-nowrap">
                                                                    -{formatCurrency(item.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-500 text-[11px] italic">មិនមានប្រតិបត្តិការប្រាក់ចេញទេ</p>
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
