import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import {
    FaCalculator, FaDollarSign, FaPercentage, FaCalendarAlt,
    FaFileExcel, FaPrint, FaCopy, FaCheckCircle, FaUndo,
    FaMoneyBillWave, FaChartPie, FaCalendarCheck, FaInfoCircle
} from 'react-icons/fa';
import { MdCalculate, MdOutlineSchedule, MdOutlinePayments } from 'react-icons/md';
import { exportToExcel, exportToPDF } from '../../../utils/exportUtils';
import CopyCell from '../../../components/CopyCell';
import ExportDropdown from '../../../components/ExportDropdown';
import { roundMoney, roundPrincipalToCents, toCurrencyCents } from '../../../utils/installmentRounding';

const RATE_PRESETS = ['11.5%', '10%', '12%', '15%', '8%', '5%', '3%', '1%'];
const DURATION_PRESETS = [1, 2, 3, 4, 6, 12];
const AMOUNT_PRESETS = [100, 200, 300, 500, 1000, 2000, 5000];

const CalculateSchedule1 = () => {
    const { t } = useLanguage();
    const { user } = useAuth();

    const formatDateToYMD = (d) => {
        if (!d || !(d instanceof Date) || isNaN(d)) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Inputs
    const [principalInput, setPrincipalInput] = useState('1000');
    const [rateInput, setRateInput] = useState('11.5%');
    const [durationInput, setDurationInput] = useState('4');
    const [durationUnit, setDurationUnit] = useState('months'); // 'months' | 'days'
    const [startDate, setStartDate] = useState(() => formatDateToYMD(new Date()));

    // Calculation result state
    const [calculationResult, setCalculationResult] = useState(null);
    const [copiedText, setCopiedText] = useState(false);

    // Parse clean numeric rate (e.g. '11.5%' -> 11.5)
    const parseRateNumber = (val) => {
        if (!val) return 0;
        const clean = String(val).replace(/%/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // Calculate schedule
    const handleCalculate = (e) => {
        if (e) e.preventDefault();

        const principal = parseFloat(principalInput) || 0;
        const ratePercent = parseRateNumber(rateInput);
        const duration = parseInt(durationInput, 10) || 1;

        if (principal <= 0) {
            alert('សូមបញ្ចូលចំនួនប្រាក់ដើមឱ្យបានត្រឹមត្រូវ (> 0)!');
            return;
        }
        if (duration <= 0) {
            alert('សូមបញ្ចូលចំនួនរយៈពេលកម្ចីឱ្យបានត្រឹមត្រូវ (> 0)!');
            return;
        }

        // Calculation formulas:
        // Monthly interest in USD = Principal * (Rate% / 100)
        const rateDecimal = ratePercent / 100;
        const monthlyInterestUSD = roundMoney(principal * rateDecimal);

        const monthsCount = durationUnit === 'days' ? Math.max(1, Math.ceil(duration / 30)) : duration;
        const principalCents = toCurrencyCents(principal);
        const roundedMonthlyPrincipalCents = roundPrincipalToCents(principal / monthsCount);

        // Generate schedule table rows
        const schedule = [];
        let remainingPrincipalCents = principalCents;
        const baseDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();

        // Safe addMonths: always tries the original start day, only clamps when target month is shorter.
        // e.g. start=31 Aug → Sep=30(clamped) → Oct=31(restored) → Nov=30(clamped) → Dec=31(restored)
        const originalDay = baseDate.getDate();
        const addMonthsSafe = (date, months) => {
            const d = new Date(date);
            d.setDate(1); // Reset to 1st to avoid overflow when changing month
            d.setMonth(d.getMonth() + months);
            // Always try original start day; clamp only if target month is shorter
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            d.setDate(Math.min(originalDay, lastDay));
            return d;
        };

        for (let i = 1; i <= monthsCount; i++) {
            let dueDate;
            if (durationUnit === 'days') {
                dueDate = new Date(baseDate);
                const daysPerPeriod = Math.floor(duration / monthsCount);
                dueDate.setDate(dueDate.getDate() + (daysPerPeriod * i));
            } else {
                dueDate = addMonthsSafe(baseDate, i);
            }

            const currentPrincipalCents = i === monthsCount
                ? remainingPrincipalCents
                : Math.min(remainingPrincipalCents, roundedMonthlyPrincipalCents);
            const currentPrincipalDue = currentPrincipalCents / 100;
            remainingPrincipalCents -= currentPrincipalCents;
            const totalDueMonth = roundMoney(currentPrincipalDue + monthlyInterestUSD);

            schedule.push({
                monthIndex: i,
                label: `ខែទី ${i} (Month ${i})`,
                dueDate: formatDateToYMD(dueDate),
                principalDue: currentPrincipalDue,
                interestDue: monthlyInterestUSD,
                totalDueMonth,
                remainingPrincipal: Math.max(0, remainingPrincipalCents / 100)
            });
        }

        const principalPerMonth = schedule[0]?.principalDue || 0;
        const paymentPerMonth = schedule[0]?.totalDueMonth || 0;
        const totalInterest = roundMoney(monthlyInterestUSD * monthsCount);
        const totalRepayment = roundMoney(schedule.reduce((sum, row) => sum + row.totalDueMonth, 0));

        setCalculationResult({
            principal,
            ratePercent,
            monthsCount,
            duration,
            durationUnit,
            monthlyInterestUSD,
            principalPerMonth,
            paymentPerMonth,
            totalInterest,
            totalRepayment,
            schedule,
            calculatedAt: new Date().toLocaleString('en-GB')
        });
    };

    const handleReset = () => {
        setPrincipalInput('');
        setRateInput('11.5%');
        setDurationInput('4');
        setDurationUnit('months');
        setStartDate(formatDateToYMD(new Date()));
        setCalculationResult(null);
        setCopiedText(false);
    };

    // Auto-calculate on initial load if default is set
    React.useEffect(() => {
        handleCalculate();
    }, []);

    // Copy summary breakdown to clipboard
    const handleCopySummary = () => {
        if (!calculationResult) return;
        const {
            principal, ratePercent, monthsCount,
            monthlyInterestUSD, paymentPerMonth, totalInterest, totalRepayment
        } = calculationResult;

        const text = `📋 តារាងគណនាការប្រាក់ & កាលវិភាគបង់ប្រាក់
━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 ប្រាក់ដើមកម្ចី: $${principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
📊 អត្រាការប្រាក់: ${ratePercent}% / ខែ
⏳ រយៈពេលកម្ចី: ${monthsCount} ខែ
━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 ការប្រាក់ក្នុង ១ ខែ: $${monthlyInterestUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💳 ត្រូវបង់ក្នុង ១ ខែ: $${paymentPerMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💵 សរុបការប្រាក់ទាំងអស់ (${monthsCount}ខែ): $${totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
✨ សរុបប្រាក់ត្រូវបង់ត្រឡប់មកវិញទាំងអស់: $${totalRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        navigator.clipboard.writeText(text);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2500);
    };

    const getExportData = () => {
        if (!calculationResult) return;
        const { principal, ratePercent, monthsCount, totalInterest, totalRepayment, schedule } = calculationResult;

        const exportData = schedule.map(row => ({
            'ល.រ (No.)': row.monthIndex,
            'ដំណាក់កាល (Period)': row.label,
            'កាលបរិច្ឆេទត្រូវបង់ (Due Date)': row.dueDate,
            'ប្រាក់ដើមត្រូវបង់ ($)': Number(row.principalDue.toFixed(2)),
            'ការប្រាក់ត្រូវបង់ ($)': Number(row.interestDue.toFixed(2)),
            'សរុបត្រូវបង់ក្នុងខែ ($)': Number(row.totalDueMonth.toFixed(2)),
            'សមតុល្យប្រាក់ដើមនៅសល់ ($)': Number(row.remainingPrincipal.toFixed(2))
        }));

        // Add summary row at the end
        exportData.push({
            'ល.រ (No.)': 'សរុបរួម',
            'ដំណាក់កាល (Period)': `សរុប ${monthsCount} ខែ`,
            'កាលបរិច្ឆេទត្រូវបង់ (Due Date)': '—',
            'ប្រាក់ដើមត្រូវបង់ ($)': Number(principal.toFixed(2)),
            'ការប្រាក់ត្រូវបង់ ($)': Number(totalInterest.toFixed(2)),
            'សរុបត្រូវបង់ក្នុងខែ ($)': Number(totalRepayment.toFixed(2)),
            'សមតុល្យប្រាក់ដើមនៅសល់ ($)': 0
        });

        return {
            exportData,
            fileName: `Calculate_Schedule_1_${principal}_${monthsCount}Months`
        };
    };

    const handleExportExcel = () => {
        const result = getExportData();
        if (result) exportToExcel(result.exportData, result.fileName);
    };

    const handleExportPDF = () => {
        const result = getExportData();
        if (!result) return;
        const columns = Object.keys(result.exportData[0] || {}).map(key => ({ header: key, accessor: key }));
        exportToPDF(result.fileName, columns, result.exportData);
    };

    // Print / PDF handler
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Top Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--app-card,rgba(255,255,255,0.7))] border border-[var(--app-border,rgba(226,232,240,0.8))] p-5 rounded-[5px] shadow-xs backdrop-blur-md">
                <div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                            Calculate Schedule 1
                        </h1>
                    </div>
                </div>

                {calculationResult && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopySummary}
                            className={`px-3.5 py-2 rounded-[5px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${copiedText
                                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
                                }`}
                        >
                            {copiedText ? <FaCheckCircle className="text-white" /> : <FaCopy className="text-slate-500" />}
                            {copiedText ? 'បានចម្លងរួចរាល់!' : 'ចម្លងព័ត៌មាន (Copy)'}
                        </button>
                        <ExportDropdown
                            onExportExcel={handleExportExcel}
                            onExportPDF={handleExportPDF}
                            triggerLabel="Export"
                            excelLabel="ទាញយក Excel"
                            pdfLabel="ទាញយក PDF"
                        />
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3.5 py-2 rounded-[5px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        >
                            <FaPrint /> បោះពុម្ព (Print)
                        </button>
                    </div>
                )}
            </div>

            {/* Input Form & Quick Calculator Controls */}
            <div className="bg-[var(--app-card,rgba(255,255,255,0.75))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] p-5 sm:p-6 shadow-sm backdrop-blur-md">
                <form onSubmit={handleCalculate} className="space-y-5">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                        <FaCalculator className="text-emerald-600" />
                        <h2 className="text-base font-bold text-slate-800">
                            បញ្ចូលព័ត៌មានគណនា (Calculation Inputs)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Principal Amount */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700">
                                ប្រាក់ដើមកម្ចី (Principal Amount) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">
                                    $
                                </span>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={principalInput}
                                    onChange={(e) => setPrincipalInput(e.target.value)}
                                    placeholder="ឧ. 1000"
                                    required
                                    className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-white text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                                />
                            </div>
                            {/* Preset Amount Chips */}
                            <div className="flex flex-wrap gap-1 pt-1">
                                {AMOUNT_PRESETS.map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setPrincipalInput(String(amt))}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${principalInput === String(amt)
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        ${amt.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interest Rate with Datalist Droplist */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700">
                                អត្រាការប្រាក់ (Interest Rate) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">
                                    %
                                </span>
                                <input
                                    type="text"
                                    list="interest-rate-droplist"
                                    value={rateInput}
                                    onChange={(e) => setRateInput(e.target.value)}
                                    placeholder="ឧ. 11.5%"
                                    required
                                    className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-white text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                                />
                                <datalist id="interest-rate-droplist">
                                    {RATE_PRESETS.map(r => (
                                        <option key={r} value={r} />
                                    ))}
                                </datalist>
                            </div>
                            {/* Preset Rate Chips */}
                            <div className="flex flex-wrap gap-1 pt-1">
                                {RATE_PRESETS.slice(0, 4).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRateInput(r)}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${rateInput === r
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duration / Term */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">
                                    រយៈពេលកម្ចី (Duration) <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setDurationUnit('months')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${durationUnit === 'months'
                                            ? 'bg-white text-emerald-700 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        ខែ (Months)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDurationUnit('days')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${durationUnit === 'days'
                                            ? 'bg-white text-emerald-700 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        ថ្ងៃ (Days)
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">
                                    #
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    value={durationInput}
                                    onChange={(e) => setDurationInput(e.target.value)}
                                    placeholder={durationUnit === 'months' ? 'ឧ. 4' : 'ឧ. 120'}
                                    required
                                    className="w-full pl-8 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-white text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                                />
                            </div>
                            {/* Preset Duration Chips */}
                            <div className="flex flex-wrap gap-1 pt-1">
                                {durationUnit === 'months' && DURATION_PRESETS.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setDurationInput(String(m))}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${durationInput === String(m)
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        {m} ខែ
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Loan Start Date */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700">
                                កាលបរិច្ឆេទចាប់ផ្ដើម (Start Date)
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                    <FaCalendarAlt />
                                </span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-[5px] border border-slate-300 bg-white text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                                សម្រាប់គណនាកាលបរិច្ឆេទត្រូវបង់តាមខែនីមួយៗ
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                            type="submit"
                            className="px-6 py-2.5 rounded-[5px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all transform active:scale-95 cursor-pointer"
                        >
                            <MdCalculate className="text-lg" />
                            គណនា (Calculate)
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-4 py-2.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <FaUndo className="text-xs text-slate-500" />
                            កំណត់ឡើងវិញ (Reset)
                        </button>
                    </div>
                </form>
            </div>

            {/* Calculation Results Section */}
            {calculationResult && (
                <div className="space-y-6">
                    {/* KPI Result Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                        {/* 1. Principal Amount */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                                <span>ប្រាក់ដើមកម្ចី</span>
                                <FaDollarSign className="text-emerald-500" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-900">
                                    ${calculationResult.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                    Principal Amount
                                </div>
                            </div>
                        </div>

                        {/* 2. Interest Rate */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                                <span>អត្រាការប្រាក់</span>
                                <FaPercentage className="text-indigo-500" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-indigo-600">
                                    {calculationResult.ratePercent}%
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                    Rate per Month
                                </div>
                            </div>
                        </div>

                        {/* 3. Monthly Interest USD */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                                <span>ការប្រាក់ក្នុង ១ ខែ</span>
                                <FaMoneyBillWave className="text-amber-500" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-amber-600">
                                    ${calculationResult.monthlyInterestUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                    ${calculationResult.principal} × {calculationResult.ratePercent}%
                                </div>
                            </div>
                        </div>

                        {/* 4. Monthly Payment */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-emerald-300 rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between bg-emerald-50/40">
                            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-1">
                                <span>ត្រូវបង់ក្នុង ១ ខែ</span>
                                <MdOutlinePayments className="text-emerald-600 text-lg" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-700">
                                    ${calculationResult.paymentPerMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-semibold text-emerald-600/80 mt-0.5">
                                    ដើម (${calculationResult.principalPerMonth.toFixed(0)}) + ការប្រាក់ (${calculationResult.monthlyInterestUSD.toFixed(0)})
                                </div>
                            </div>
                        </div>

                        {/* 5. Total Interest */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                                <span>សរុបការប្រាក់ទាំងអស់</span>
                                <FaChartPie className="text-rose-500" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-rose-600">
                                    ${calculationResult.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                    Total Interest ({calculationResult.monthsCount} ខែ)
                                </div>
                            </div>
                        </div>

                        {/* 6. Total Repayment Return */}
                        <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-indigo-300 rounded-[5px] p-4 shadow-xs backdrop-blur-md flex flex-col justify-between bg-indigo-50/40">
                            <div className="flex items-center justify-between text-indigo-900 text-xs font-bold mb-1">
                                <span>សរុបត្រូវបង់មកវិញ</span>
                                <FaDollarSign className="text-indigo-600" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-indigo-700">
                                    ${calculationResult.totalRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-semibold text-indigo-600/80 mt-0.5">
                                    Total Repayment Return
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Schedule Table Card */}
                    <div className="bg-[var(--app-card,rgba(255,255,255,0.8))] border border-[var(--app-border,rgba(226,232,240,0.8))] rounded-[5px] shadow-sm overflow-hidden backdrop-blur-md">
                        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <MdOutlineSchedule className="text-emerald-600 text-xl" />
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        តារាងកាលវិភាគបង់ប្រាក់លម្អិត (Installment Repayment Schedule)
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        បង្ហាញពីកាលវិភាគបង់រំលស់ប្រចាំខែនីមួយៗ ចំនួន {calculationResult.monthsCount} ដំណាក់កាល
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    រយៈពេល: {calculationResult.monthsCount} ខែ
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                <thead>
                                    <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                        <th className="px-4 py-3.5 text-center w-16">ល.រ</th>
                                        <th className="px-4 py-3.5">ដំណាក់កាល / ខែទី</th>
                                        <th className="px-4 py-3.5 text-center">កាលបរិច្ឆេទត្រូវបង់</th>
                                        <th className="px-4 py-3.5 text-right font-khmer">ប្រាក់ដើមត្រូវបង់</th>
                                        <th className="px-4 py-3.5 text-right font-khmer">ការប្រាក់ត្រូវបង់</th>
                                        <th className="px-4 py-3.5 text-right font-khmer font-black text-emerald-800">សរុបត្រូវបង់ក្នុងខែ</th>
                                        <th className="px-4 py-3.5 text-right font-khmer text-slate-600">សមតុល្យដើមនៅសល់</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/70 text-slate-800 font-medium">
                                    {calculationResult.schedule.map((row) => (
                                        <tr key={row.monthIndex} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-4 py-1 text-center font-bold text-slate-500">
                                                {row.monthIndex}
                                            </td>
                                            <td className="px-4 py-1 font-bold text-slate-900">
                                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100/80 text-emerald-800 border border-emerald-300 font-bold text-xs">
                                                    {row.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-1 text-center font-mono font-bold text-slate-700">
                                                {row.dueDate}
                                            </td>
                                            <td className="px-4 py-1 text-right font-mono font-bold text-slate-800">
                                                ${row.principalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-1 text-right font-mono font-bold text-amber-600">
                                                ${row.interestDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-1 text-right font-mono font-black text-emerald-700 bg-emerald-50/20">
                                                ${row.totalDueMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-1 text-right font-mono text-slate-500">
                                                ${row.remainingPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                                        <td colSpan={3} className="px-4 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider text-xs">
                                            សរុបរួម ({calculationResult.monthsCount} ខែ)
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-slate-900 text-sm">
                                            ${calculationResult.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-rose-600 text-sm">
                                            ${calculationResult.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-emerald-800 bg-emerald-100/50 text-base">
                                            ${calculationResult.totalRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-slate-500 text-xs">
                                            $0.00
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalculateSchedule1;
