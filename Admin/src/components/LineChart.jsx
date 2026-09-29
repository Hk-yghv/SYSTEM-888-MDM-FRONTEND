import React, { useState, useMemo } from 'react';
import { FaChartLine } from 'react-icons/fa';

/**
 * Reusable LineChart component built with pure SVG for high performance and visual excellence.
 *
 * Props:
 * - title: Chart main title (string)
 * - subtitle: Chart subtitle or description (string)
 * - data: Array of data items, e.g. [{ label: '2026-08-01', val1: 10, val2: 500 }, ...]
 * - series: Array of series config [{ key: 'val1', label: 'Contracts', color: '#6366f1', isCurrency: false }, ...]
 * - timeFilterOptions: Optional array of ['7d', '30d', 'monthly', 'all'] for quick filtering
 * - defaultFilter: Default selected time filter
 * - height: Height in pixels (default 260)
 */
const LineChart = ({
    title = 'ក្រាបខ្សែនិន្នាការ (Trend Line Chart)',
    subtitle = 'បង្ហាញពីការប្រែប្រួលតាមពេលវេលា',
    data = [],
    series = [{ key: 'count', label: 'ចំនួនសរុប', color: '#6366f1', isCurrency: false }],
    timeFilterOptions = ['7d', '30d', 'monthly', 'all'],
    defaultFilter = '30d',
    height = 260
}) => {
    const [selectedFilter, setSelectedFilter] = useState(defaultFilter);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Filter raw data based on selected range
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        if (selectedFilter === 'all') return data;

        const now = new Date();
        let daysToKeep = 30;
        if (selectedFilter === '7d') daysToKeep = 7;
        if (selectedFilter === '30d') daysToKeep = 30;

        if (selectedFilter === 'monthly') {
            // Group by month YYYY-MM
            const monthMap = {};
            data.forEach(item => {
                const labelStr = String(item.label || item.date || '');
                const mKey = labelStr.slice(0, 7) || 'Unknown';
                if (!monthMap[mKey]) {
                    monthMap[mKey] = { label: mKey, count: 0 };
                    series.forEach(s => { monthMap[mKey][s.key] = 0; });
                }
                series.forEach(s => {
                    monthMap[mKey][s.key] += (Number(item[s.key]) || 0);
                });
            });
            return Object.values(monthMap).sort((a, b) => a.label.localeCompare(b.label));
        }

        // Filter by last N items or date range
        if (data.length > daysToKeep) {
            return data.slice(-daysToKeep);
        }
        return data;
    }, [data, selectedFilter, series]);

    // Dimensions & Calculations
    const viewBoxWidth = 800;
    const viewBoxHeight = Math.max(180, height - 60);
    const padLeft = 60;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 40;

    const chartW = viewBoxWidth - padLeft - padRight;
    const chartH = viewBoxHeight - padTop - padBottom;

    // Calculate Max across all active series
    const maxValue = useMemo(() => {
        let max = 0;
        filteredData.forEach(d => {
            series.forEach(s => {
                const val = Number(d[s.key]) || 0;
                if (val > max) max = val;
            });
        });
        return max === 0 ? 10 : Math.ceil(max * 1.15);
    }, [filteredData, series]);

    // Grid ticks (5 horizontal lines)
    const yTicks = useMemo(() => {
        return [1, 0.75, 0.5, 0.25, 0].map(ratio => Math.round(maxValue * ratio));
    }, [maxValue]);

    // Coordinates mapping for points
    const pointsData = useMemo(() => {
        const n = filteredData.length;
        if (n === 0) return [];

        return filteredData.map((d, i) => {
            const x = n === 1 ? padLeft + chartW / 2 : padLeft + (i / (n - 1)) * chartW;
            const seriesCoords = {};

            series.forEach(s => {
                const val = Number(d[s.key]) || 0;
                const ratio = val / maxValue;
                const y = (padTop + chartH) - ratio * chartH;
                seriesCoords[s.key] = { y, val };
            });

            return {
                x,
                label: d.label || d.date || `Item ${i + 1}`,
                raw: d,
                seriesCoords
            };
        });
    }, [filteredData, series, maxValue, chartW, chartH, padLeft, padTop]);

    // Generate smooth spline SVG path
    const getSmoothPath = (pts, key) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x} ${pts[0].seriesCoords[key].y}`;

        let d = `M ${pts[0].x} ${pts[0].seriesCoords[key].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) * 0.4;
            const cp1y = p0.seriesCoords[key].y;
            const cp2x = p1.x - (p1.x - p0.x) * 0.4;
            const cp2y = p1.seriesCoords[key].y;
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.seriesCoords[key].y}`;
        }
        return d;
    };

    // Generate Area fill path
    const getAreaPath = (pts, key) => {
        const linePath = getSmoothPath(pts, key);
        if (!linePath) return '';
        const lastPt = pts[pts.length - 1];
        const firstPt = pts[0];
        const bottomY = padTop + chartH;
        return `${linePath} L ${lastPt.x} ${bottomY} L ${firstPt.x} ${bottomY} Z`;
    };

    return (
        <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4 font-sans select-none transition-all">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[5px] bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold shadow-2xs">
                        <FaChartLine />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            {title}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Series Legend */}
                    <div className="flex items-center gap-3 text-xs font-bold">
                        {series.map(s => (
                            <span key={s.key} className="flex items-center gap-1.5 text-slate-700">
                                <span className="w-3 h-3 rounded-full shadow-2xs" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </span>
                        ))}
                    </div>

                    {/* Time Filter Buttons */}
                    {timeFilterOptions && timeFilterOptions.length > 0 && (
                        <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-[5px] text-xs font-bold">
                            {timeFilterOptions.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setSelectedFilter(opt)}
                                    className={`px-3 py-1 rounded-[5px] cursor-pointer transition-all ${selectedFilter === opt
                                        ? 'bg-blue-900 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                >
                                    {opt === '7d' ? '7 ថ្ងៃ' : opt === '30d' ? '30 ថ្ងៃ' : opt === 'monthly' ? 'ប្រចាំខែ' : 'ទាំងអស់'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* SVG Chart Container */}
            {pointsData.length === 0 ? (
                <div className="w-full h-48 flex items-center justify-center bg-slate-50/50 rounded-[5px] border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                    ពុំមានទិន្នន័យសម្រាប់បង្ហាញ (No chart data available)
                </div>
            ) : (
                <div className="relative w-full overflow-visible bg-slate-50/40 rounded-[5px] border border-slate-100 p-2">
                    <svg
                        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                        className="w-full h-auto overflow-visible"
                        style={{ maxHeight: `${height}px` }}
                    >
                        <defs>
                            {series.map(s => (
                                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                                    <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Y-Axis Horizontal Gridlines & Labels */}
                        {yTicks.map((val, i) => {
                            const y = padTop + (i / (yTicks.length - 1)) * chartH;
                            const isCurrency = series.some(s => s.isCurrency);
                            const labelStr = isCurrency
                                ? `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`
                                : val.toLocaleString();

                            return (
                                <g key={i}>
                                    <line
                                        x1={padLeft}
                                        y1={y}
                                        x2={viewBoxWidth - padRight}
                                        y2={y}
                                        stroke="#e2e8f0"
                                        strokeDasharray="4 4"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={padLeft - 10}
                                        y={y + 4}
                                        textAnchor="end"
                                        className="text-[10px] font-mono fill-slate-600 font-bold"
                                    >
                                        {labelStr}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Area Fills */}
                        {series.map(s => (
                            <path
                                key={`area-${s.key}`}
                                d={getAreaPath(pointsData, s.key)}
                                fill={`url(#grad-${s.key})`}
                            />
                        ))}

                        {/* Line Splines */}
                        {series.map(s => (
                            <path
                                key={`line-${s.key}`}
                                d={getSmoothPath(pointsData, s.key)}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}

                        {/* Interactive Data Points & Vertical Hover Guide */}
                        {pointsData.map((pt, idx) => {
                            const isHovered = hoveredIndex === idx;

                            return (
                                <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
                                    {/* Hover vertical line */}
                                    {isHovered && (
                                        <line
                                            x1={pt.x}
                                            y1={padTop}
                                            x2={pt.x}
                                            y2={padTop + chartH}
                                            stroke="#64748b"
                                            strokeDasharray="3 3"
                                            strokeWidth="1.5"
                                        />
                                    )}

                                    {/* Circle dots for each series */}
                                    {series.map(s => {
                                        const { y } = pt.seriesCoords[s.key];
                                        return (
                                            <g key={s.key}>
                                                <circle
                                                    cx={pt.x}
                                                    cy={y}
                                                    r={isHovered ? "6" : "4"}
                                                    fill="#ffffff"
                                                    stroke={s.color}
                                                    strokeWidth="3"
                                                    className="transition-all duration-150"
                                                />
                                            </g>
                                        );
                                    })}

                                    {/* X-Axis Labels (draw max ~12 labels to prevent overlap) */}
                                    {(pointsData.length <= 14 || idx % Math.ceil(pointsData.length / 12) === 0 || idx === pointsData.length - 1) && (
                                        <text
                                            x={pt.x}
                                            y={padTop + chartH + 20}
                                            textAnchor="middle"
                                            className="text-[10px] font-mono fill-slate-700 font-bold"
                                        >
                                            {pt.label.length > 10 ? pt.label.slice(5) : pt.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* 2D Smart Adaptive Hover Floating Tooltip */}
                    {hoveredIndex !== null && pointsData[hoveredIndex] && (() => {
                        const xRatio = pointsData[hoveredIndex].x / viewBoxWidth;
                        let transformX = '-translate-x-1/2';
                        if (xRatio > 0.68) {
                            transformX = '-translate-x-[96%]'; // Flip left when near right end
                        } else if (xRatio < 0.28) {
                            transformX = '-translate-x-[4%]';  // Flip right when near left end
                        }

                        // Check vertical position of the highest dot in active series
                        const minY = Math.min(...series.map(s => pointsData[hoveredIndex].seriesCoords[s.key]?.y ?? 100));
                        const yRatio = minY / viewBoxHeight;

                        // If dot is high (upper 48% of chart) or near top border, drop tooltip DOWN; otherwise float UP
                        const isNearTop = yRatio < 0.48;
                        const transformY = isNearTop ? 'translate-y-4' : '-translate-y-[112%]';
                        const topPosition = `${(minY / viewBoxHeight) * 100}%`;

                        return (
                            <div
                                className={`absolute pointer-events-none z-50 bg-slate-950/95 text-white text-xs p-3 rounded-[5px] shadow-2xl border-2 border-emerald-400 space-y-1.5 transform ${transformX} ${transformY} transition-all duration-150 animate-in fade-in zoom-in-95 backdrop-blur-md min-w-[200px] whitespace-nowrap`}
                                style={{
                                    left: `${(pointsData[hoveredIndex].x / viewBoxWidth) * 100}%`,
                                    top: topPosition
                                }}
                            >
                                <div className="font-bold border-b border-slate-700 pb-1 font-mono text-emerald-400 text-xs flex justify-between items-center">
                                    <span>📅 {pointsData[hoveredIndex].label}</span>
                                </div>
                                {series.map(s => {
                                    const val = pointsData[hoveredIndex].seriesCoords[s.key].val;
                                    return (
                                        <div key={s.key} className="flex justify-between items-center gap-4 text-xs">
                                            <span className="flex items-center gap-1.5 text-slate-200">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                                {s.label}:
                                            </span>
                                            <span className="font-mono font-black" style={{ color: s.color }}>
                                                {s.isCurrency ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default LineChart;
