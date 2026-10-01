import { useLanguage } from '../context/LanguageContext';
import React, { useState, useMemo } from 'react';
import { FaChartBar, FaCalendarAlt, FaMoneyBillWave } from 'react-icons/fa';

/**
 * Modern Interactive SVG Bar Chart (ក្រាបសសរ) for Monthly Salary Visualization.
 */
const SalaryBarChart = ({
    data = [], // [{ month: '2026-01', totalAmount: 1200, count: 4 }, ...]
    grandTotal = 0,
    title = '',
    subtitle = 'ទិន្នន័យប្រាក់ខែសរុបប្រចាំខែនីមួយៗ'
}) => {
    const { t } = useLanguage();
    const [hoveredBar, setHoveredBar] = useState(null);
    const [selectedYear, setSelectedYear] = useState('ALL');

    // Available years from data
    const availableYears = useMemo(() => {
        const years = new Set();
        data.forEach(d => {
            const yr = String(d.month || '').slice(0, 4);
            if (yr && yr.length === 4) years.add(yr);
        });
        const arr = Array.from(years).sort().reverse();
        if (arr.length === 0) arr.push(new Date().getFullYear().toString());
        return arr;
    }, [data]);

    // Filtered data by selected year
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        let list = [...data];
        if (selectedYear !== 'ALL') {
            list = list.filter(d => String(d.month || '').startsWith(selectedYear));
        }
        return list.sort((a, b) => String(a.month).localeCompare(String(b.month)));
    }, [data, selectedYear]);

    // Calculate maximum amount for scale
    const maxAmount = useMemo(() => {
        let max = 0;
        filteredData.forEach(d => {
            const amt = Number(d.totalAmount) || 0;
            if (amt > max) max = amt;
        });
        return max === 0 ? 1000 : Math.ceil(max * 1.2);
    }, [filteredData]);

    // Format Month display (e.g. '2026-01' -> 'Jan 2026' or '01/26')
    const formatMonthLabel = (mStr) => {
        if (!mStr) return '—';
        const parts = mStr.split('-');
        if (parts.length >= 2) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mIndex = parseInt(parts[1], 10) - 1;
            const mName = monthNames[mIndex] || parts[1];
            return `${mName} ${parts[0].slice(2)}`;
        }
        return mStr;
    };

    // Chart Dimensions
    const viewBoxWidth = 850;
    const viewBoxHeight = 280;
    const padLeft = 65;
    const padRight = 30;
    const padTop = 35;
    const padBottom = 45;

    const chartW = viewBoxWidth - padLeft - padRight;
    const chartH = viewBoxHeight - padTop - padBottom;

    // Ticks on Y-axis (5 steps)
    const yTicks = [1, 0.75, 0.5, 0.25, 0].map(r => Math.round(maxAmount * r));

    // Filtered year total
    const currentYearTotal = useMemo(() => {
        return filteredData.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    }, [filteredData]);

    return (
        <div className="w-full bg-[var(--app-card,white)] rounded-[5px] border border-[var(--app-border,#e2e8f0)] shadow-sm p-2 space-y-3 transition-colors">
            {/* Header with Title & Year Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--app-border,#f1f5f9)]">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[5px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg border border-emerald-500/20">
                        <FaChartBar />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--app-text,#0f172a)] flex items-center gap-2">
                            <span>{title}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">
                                ${currentYearTotal.toLocaleString()}
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-500">{subtitle}</p>
                    </div>
                </div>

                {/* Year Filter Buttons */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setSelectedYear('ALL')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${selectedYear === 'ALL'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        All Years
                    </button>
                    {availableYears.map(yr => (
                        <button
                            key={yr}
                            onClick={() => setSelectedYear(yr)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${selectedYear === yr
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            {yr}
                        </button>
                    ))}
                </div>
            </div>

            {/* SVG Bar Chart Area */}
            {filteredData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <FaMoneyBillWave className="text-3xl opacity-40" />
                    <p className="text-xs font-semibold">{t('noSalaryDataChart')}</p>
                    <p className="text-[11px] opacity-75">{t('pleaseAddSalaryPrompt')}</p>
                </div>
            ) : (
                <div className="relative w-full overflow-hidden">
                    <svg
                        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                        className="w-full h-auto overflow-visible select-none"
                    >
                        <defs>
                            {/* Bar Linear Gradient */}
                            <linearGradient id="salaryBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
                            </linearGradient>

                            {/* Bar Hover Gradient */}
                            <linearGradient id="salaryBarHoverGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
                                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.85" />
                            </linearGradient>

                            {/* Drop Shadow for top values */}
                            <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#10b981" floodOpacity="0.25" />
                            </filter>
                        </defs>

                        {/* Y-Axis Horizontal Gridlines */}
                        {yTicks.map((tickVal, idx) => {
                            const ratio = tickVal / maxAmount;
                            const yPos = padTop + chartH * (1 - ratio);
                            return (
                                <g key={idx}>
                                    <line
                                        x1={padLeft}
                                        y1={yPos}
                                        x2={viewBoxWidth - padRight}
                                        y2={yPos}
                                        stroke="currentColor"
                                        className="text-slate-200 dark:text-slate-800"
                                        strokeWidth="1"
                                        strokeDasharray={idx === yTicks.length - 1 ? "none" : "3,3"}
                                    />
                                    <text
                                        x={padLeft - 10}
                                        y={yPos + 4}
                                        textAnchor="end"
                                        className="text-[10px] font-mono fill-slate-400 font-semibold"
                                    >
                                        ${tickVal >= 1000 ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Bars Rendering */}
                        {(() => {
                            const count = filteredData.length;
                            const slotWidth = chartW / count;
                            const barWidth = Math.min(48, Math.max(18, slotWidth * 0.55));

                            return filteredData.map((d, i) => {
                                const amount = Number(d.totalAmount) || 0;
                                const ratio = maxAmount > 0 ? amount / maxAmount : 0;
                                const barHeight = Math.max(4, ratio * chartH);
                                const x = padLeft + i * slotWidth + (slotWidth - barWidth) / 2;
                                const y = padTop + chartH - barHeight;
                                const isHovered = hoveredBar === i;

                                return (
                                    <g
                                        key={d.month || i}
                                        className="cursor-pointer transition-all duration-200"
                                        onMouseEnter={() => setHoveredBar(i)}
                                        onMouseLeave={() => setHoveredBar(null)}
                                    >
                                        {/* Hover Highlight Column Background */}
                                        {isHovered && (
                                            <rect
                                                x={padLeft + i * slotWidth + 2}
                                                y={padTop}
                                                width={slotWidth - 4}
                                                height={chartH}
                                                fill="currentColor"
                                                className="text-emerald-500/5"
                                                rx="6"
                                            />
                                        )}

                                        {/* Main Column Bar */}
                                        <rect
                                            x={x}
                                            y={y}
                                            width={barWidth}
                                            height={barHeight}
                                            rx="6"
                                            fill={isHovered ? "url(#salaryBarHoverGradient)" : "url(#salaryBarGradient)"}
                                            filter={isHovered ? "url(#barGlow)" : "none"}
                                            className="transition-all duration-200"
                                        />

                                        {/* Value Label above Bar */}
                                        {amount > 0 && (
                                            <text
                                                x={x + barWidth / 2}
                                                y={Math.max(16, y - 6)}
                                                textAnchor="middle"
                                                className={`text-[10px] font-mono font-bold transition-all ${isHovered ? "fill-cyan-600 font-extrabold" : "fill-slate-700 dark:fill-slate-200"
                                                    }`}
                                            >
                                                ${amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
                                            </text>
                                        )}

                                        {/* X-Axis Month Label */}
                                        <text
                                            x={x + barWidth / 2}
                                            y={padTop + chartH + 18}
                                            textAnchor="middle"
                                            className={`text-[10px] font-semibold transition-all ${isHovered ? "fill-emerald-600 font-bold" : "fill-slate-500"
                                                }`}
                                        >
                                            {formatMonthLabel(d.month)}
                                        </text>

                                        {/* Record Count sublabel */}
                                        <text
                                            x={x + barWidth / 2}
                                            y={padTop + chartH + 30}
                                            textAnchor="middle"
                                            className="text-[9px] font-mono fill-slate-400 font-normal"
                                        >
                                            {d.count || 1} txn
                                        </text>
                                    </g>
                                );
                            });
                        })()}
                    </svg>

                    {/* Interactive Tooltip Card */}
                    {hoveredBar !== null && filteredData[hoveredBar] && (
                        <div
                            className="absolute top-2 right-2 bg-slate-900/90 text-white backdrop-blur-md px-3 py-2 rounded-[5px] border border-slate-700 shadow-xl text-xs space-y-1 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
                        >
                            <div className="flex items-center gap-2 font-bold text-emerald-400">
                                <FaCalendarAlt />
                                <span>{formatMonthLabel(filteredData[hoveredBar].month)} ({filteredData[hoveredBar].month})</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-300 font-mono">
                                <span>{t('totalSalary')}:</span>
                                <strong className="text-white text-sm font-bold">${Number(filteredData[hoveredBar].totalAmount).toLocaleString()}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px]">
                                <span>{t ? [t('totalRecords')]: 'Entries'}:</span>
                                <span className="font-mono text-amber-300 font-bold">{filteredData[hoveredBar].count} Records</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SalaryBarChart;
