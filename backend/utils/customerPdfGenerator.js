import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve font paths safely
const FONT_DIR = path.resolve(__dirname, '../fonts');
const khmerFontPath = fs.existsSync(path.join(FONT_DIR, 'khmer_os.ttf'))
    ? path.join(FONT_DIR, 'khmer_os.ttf')
    : (fs.existsSync(path.join(FONT_DIR, 'noto_khmer.ttf'))
        ? path.join(FONT_DIR, 'noto_khmer.ttf')
        : path.join(FONT_DIR, 'arial.ttf'));
const arialFontPath = path.join(FONT_DIR, 'arial.ttf');
const arialBoldPath = path.join(FONT_DIR, 'arialbd.ttf');

/**
 * Generate a clean, responsive, non-overlapping PDF report containing:
 * Page 1:
 *   1. Customer Information
 *   2. Device Specifications
 *   3. Loan & Financial Terms
 *   4. Full Repayment Schedule Table ($)
 * Page 2:
 *   5. Installment & Overdue Analytics Report (Consecutive, Never skips #5)
 *   6. Payment Transaction History (if payments exist)
 *
 * @param {Object} contract - Contract document
 * @param {Array} payments - Array of payment records
 * @param {String} brandName - Active brand name
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export function generateCustomerPdf(contract, payments = [], brandName = '') {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 30, bottom: 15, left: 30, right: 30 },
                bufferPages: true,
                autoFirstPage: true,
                info: {
                    Title: `Customer Report - ${contract.customerNameEn || contract.contractId || 'MDM'}`,
                    Author: 'SYSTEM MDM Platform',
                    Subject: 'Customer Details, Repayment Schedule & Installment Analytics',
                    Keywords: 'MDM, Contract, Repayment, Schedule, Loan, Installment, Overdue'
                }
            });

            // Register TrueType Fonts for proper Unicode & Khmer support
            const hasKhmer = fs.existsSync(khmerFontPath);
            const hasArial = fs.existsSync(arialFontPath);
            const hasArialBold = fs.existsSync(arialBoldPath);

            if (hasKhmer) doc.registerFont('KhmerFont', khmerFontPath);
            if (hasArial) doc.registerFont('RegularFont', arialFontPath);
            if (hasArialBold) doc.registerFont('BoldFont', arialBoldPath);

            const FONT_BOLD = hasArialBold ? 'BoldFont' : (hasKhmer ? 'KhmerFont' : 'Helvetica-Bold');
            const FONT_REGULAR = hasArial ? 'RegularFont' : (hasKhmer ? 'KhmerFont' : 'Helvetica');
            const FONT_KHMER = hasKhmer ? 'KhmerFont' : (hasArial ? 'RegularFont' : 'Helvetica');

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            const activeBrand = brandName || contract.brand || 'SYSTEM MDM';
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 36;
            const contentWidth = pageWidth - (margin * 2);

            // Dynamic Sequential Section Numbering
            let sectionIndex = 0;
            const nextSection = () => {
                sectionIndex += 1;
                return String(sectionIndex);
            };

            // Theme Palette
            const brandNavy = '#0f172a'; // Slate 900
            const accentBlue = '#2563eb'; // Blue 600
            const lightCardBg = '#f8fafc'; // Slate 50
            const borderColor = '#cbd5e1'; // Slate 300
            const textDark = '#0f172a';
            const textMuted = '#475569';
            const successColor = '#16a34a';
            const warningColor = '#d97706';
            const dangerColor = '#dc2626';

            // ── TOP HEADER BANNER ──
            const printDate = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });

            const renderTopHeader = (isContinuation = false) => {
                if (!isContinuation) {
                    doc.rect(margin, margin, contentWidth, 52).fillAndStroke(brandNavy, brandNavy);

                    doc.fillColor('#ffffff').fontSize(14).font(FONT_BOLD)
                        .text('SYSTEM MDM', margin + 14, margin + 10, { lineBreak: false });

                    doc.fillColor('#38bdf8').fontSize(9).font(FONT_BOLD)
                        .text(`BRAND: ${String(activeBrand).toUpperCase()}`, margin + 14, margin + 28, { lineBreak: false });

                    doc.fillColor('#94a3b8').fontSize(8).font(FONT_BOLD)
                        .text('CUSTOMER DOSSIER & REPAYMENT SCHEDULE', margin, margin + 12, { align: 'right', width: contentWidth - 14, lineBreak: false });

                    doc.fillColor('#cbd5e1').fontSize(7.5).font(FONT_REGULAR)
                        .text(`Generated: ${printDate}`, margin, margin + 28, { align: 'right', width: contentWidth - 14, lineBreak: false });
                } else {
                    doc.rect(margin, margin, contentWidth, 24).fillAndStroke(brandNavy, brandNavy);
                    doc.fillColor('#ffffff').fontSize(9).font(FONT_BOLD)
                        .text(`SYSTEM MDM — ${String(activeBrand).toUpperCase()} (Customer Dossier & Analytics)`, margin + 10, margin + 7, { lineBreak: false });
                    doc.fillColor('#94a3b8').fontSize(7.5).font(FONT_REGULAR)
                        .text(`Report ID: ${contract.contractId || contract.serialNumber || 'DOC'}`, margin, margin + 7, { align: 'right', width: contentWidth - 10, lineBreak: false });
                }
            };

            // First Page Header
            renderTopHeader(false);
            let y = margin + 58;

            // Helper: Section Title with Clean Vector Badge
            const drawSectionHeader = (number, titleEn, titleKh = '') => {
                doc.rect(margin, y, contentWidth, 18).fillAndStroke(lightCardBg, borderColor);
                doc.rect(margin, y, 4, 18).fill(accentBlue);

                doc.circle(margin + 13, y + 9, 5.5).fill(accentBlue);
                doc.fillColor('#ffffff').fontSize(6.5).font(FONT_BOLD)
                    .text(String(number), margin + 8, y + 6, { width: 10, align: 'center', lineBreak: false });

                doc.fillColor(brandNavy).fontSize(8.5).font(FONT_BOLD)
                    .text(titleEn.toUpperCase(), margin + 24, y + 4.5, { lineBreak: false });

                if (titleKh) {
                    doc.fillColor(textMuted).fontSize(7.5).font(FONT_KHMER)
                        .text(`(${titleKh})`, margin + 26 + doc.widthOfString(titleEn.toUpperCase(), { font: FONT_BOLD, size: 8.5 }) + 6, y + 4.5, { lineBreak: false });
                }

                y += 21;
            };

            // Helper: Dynamic-Height 2-Column Grid
            const drawDynamicGrid2Col = (items) => {
                const gap = 6;
                const colWidth = (contentWidth - gap) / 2;
                const labelWidth = colWidth * 0.38;
                const valueWidth = colWidth * 0.62 - 10;

                for (let i = 0; i < items.length; i += 2) {
                    const item1 = items[i];
                    const item2 = items[i + 1] || null;

                    const valStr1 = String(item1.value || '—');
                    const valStr2 = item2 ? String(item2.value || '—') : '';

                    const h1 = doc.heightOfString(valStr1, { width: valueWidth, font: FONT_KHMER, size: 7.5 });
                    const h2 = item2 ? doc.heightOfString(valStr2, { width: valueWidth, font: FONT_KHMER, size: 7.5 }) : 0;
                    const rowHeight = Math.max(16, Math.max(h1, h2) + 6);

                    // Box 1
                    const x1 = margin;
                    doc.rect(x1, y, colWidth, rowHeight).fillAndStroke('#ffffff', borderColor);
                    doc.fillColor(textMuted).fontSize(7).font(FONT_BOLD)
                        .text(item1.label + ':', x1 + 5, y + 3.5, { width: labelWidth - 5, lineBreak: false });
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_KHMER)
                        .text(valStr1, x1 + labelWidth, y + 3.5, { width: valueWidth, lineBreak: false });

                    // Box 2
                    if (item2) {
                        const x2 = margin + colWidth + gap;
                        doc.rect(x2, y, colWidth, rowHeight).fillAndStroke('#ffffff', borderColor);
                        doc.fillColor(textMuted).fontSize(7).font(FONT_BOLD)
                            .text(item2.label + ':', x2 + 5, y + 3.5, { width: labelWidth - 5, lineBreak: false });
                        doc.fillColor(textDark).fontSize(7.5).font(FONT_KHMER)
                            .text(valStr2, x2 + labelWidth, y + 3.5, { width: valueWidth, lineBreak: false });
                    }

                    y += rowHeight + 2.5;
                }
                y += 3;
            };

            // ── 1. CUSTOMER INFORMATION ──
            drawSectionHeader(nextSection(), 'Customer Information');
            const customerItems = [
                { label: 'Name (EN)', value: contract.customerNameEn },
                { label: 'Name (KH)', value: contract.customerNameKh },
                { label: 'ID Card / Passport', value: contract.idCardNumber },
                { label: 'Date of Birth', value: contract.dob },
                { label: 'Gender', value: contract.gender ? (contract.gender.charAt(0).toUpperCase() + contract.gender.slice(1)) : '—' },
                { label: 'Primary Phone', value: contract.phone },
                { label: 'Relative Phone', value: contract.relativePhone },
                { label: 'Facebook', value: contract.facebookName || contract.urlFb },
                { label: 'Telegram', value: contract.telegramName },
                { label: 'Current Address', value: contract.currentAddress },
                { label: 'Birth Address', value: contract.birthAddress },
                { label: 'Customer Status', value: contract.status || 'Active' }
            ];
            drawDynamicGrid2Col(customerItems);

            // ── 2. DEVICE SPECIFICATIONS ──
            drawSectionHeader(nextSection(), 'Device Specifications');
            const deviceItems = [
                { label: 'Model', value: contract.model },
                { label: 'Device Brand', value: contract.brand || activeBrand },
                { label: 'Serial Number', value: contract.serialNumber },
                { label: 'Color / Capacity', value: [contract.color, contract.capacity].filter(Boolean).join(' / ') },
                { label: 'IMEI 1', value: contract.imei1 },
                { label: 'IMEI 2', value: contract.imei2 },
                { label: 'MEID', value: contract.meid },
                { label: 'OS Version', value: contract.version },
                { label: 'Phone Lock Status', value: contract.lockPhoneStatus || 'Unlocked' },
                { label: 'Wallpaper Lock', value: contract.lockWallpaperStatus || 'Unlocked' },
                { label: 'Device Problem', value: contract.deviceProblem || 'None' },
                { label: 'Mosyle URL', value: contract.mosyleUrl ? 'Enrolled' : '—' }
            ];
            drawDynamicGrid2Col(deviceItems);

            // ── FINANCIAL TERMS SETUP ──
            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];

            const scheduleTotal = schedule.reduce((acc, row) => acc + (parseFloat(row.totalAmount || row.amount || 0) || 0), 0);
            const totalLoanAmount = (parseFloat(contract.totalAmount) > 0)
                ? parseFloat(contract.totalAmount)
                : (scheduleTotal > 0 ? scheduleTotal : (parseFloat(contract.amount) || 0));

            const originalLoanAmount = (parseFloat(contract.amount) > 0)
                ? parseFloat(contract.amount)
                : totalLoanAmount;

            const totalPaidAmount = (payments && payments.length > 0)
                ? payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)
                : schedule.reduce((acc, row) => acc + (parseFloat(row.paidAmount || 0) || 0), 0);

            const remainingBalance = Math.max(0, totalLoanAmount - totalPaidAmount);
            const monthlyPayment = (parseFloat(contract.monthlyPayment) > 0)
                ? parseFloat(contract.monthlyPayment)
                : (schedule.length > 0 && parseFloat(schedule[0].amount || schedule[0].monthlyPayment)
                    ? parseFloat(schedule[0].amount || schedule[0].monthlyPayment)
                    : (totalLoanAmount / Math.max(1, schedule.length || 1)));

            // ── 3. LOAN & FINANCIAL TERMS ──
            drawSectionHeader(nextSection(), 'Loan & Financial Terms');

            const loanItems = [
                { label: 'Contract ID', value: contract.contractId },
                { label: 'Contract IID', value: contract.contractIid },
                { label: 'Input Date', value: contract.inputDate },
                { label: 'Loan Duration', value: contract.duration || `${schedule.length} Months` },
                { label: 'Original Loan ($)', value: `$${originalLoanAmount.toFixed(2)}` },
                { label: 'Interest Rate', value: contract.interest || contract.interestType || '14%' },
                { label: 'Admin Fee ($)', value: `$${(parseFloat(contract.adminFee) || 0).toFixed(2)}` },
                { label: 'Monthly Payment ($)', value: `$${monthlyPayment.toFixed(2)}` },
                { label: 'Total Loan Amount ($)', value: `$${totalLoanAmount.toFixed(2)}` },
                { label: 'Total Paid to Date ($)', value: `$${totalPaidAmount.toFixed(2)}` },
                { label: 'Remaining Balance ($)', value: `$${remainingBalance.toFixed(2)}` },
                { label: 'Contract Status', value: contract.status || 'Application' }
            ];
            drawDynamicGrid2Col(loanItems);

            // ── 4. REPAYMENT SCHEDULE TABLE ──
            drawSectionHeader(nextSection(), 'Repayment Schedule ($)');

            const cols = [
                { title: '#', width: 24, align: 'center' },
                { title: 'Due Date', width: 70, align: 'left' },
                { title: 'Schedule ($)', width: 68, align: 'right' },
                { title: 'Penalty ($)', width: 56, align: 'right' },
                { title: 'Total Due ($)', width: 68, align: 'right' },
                { title: 'Paid ($)', width: 60, align: 'right' },
                { title: 'Paid Date', width: 68, align: 'center' },
                { title: 'Status', width: 56, align: 'center' },
                { title: 'Notes', width: 53.28, align: 'left' }
            ];

            const renderScheduleTableHeader = () => {
                doc.rect(margin, y, contentWidth, 16).fill(brandNavy);
                let currX = margin;
                cols.forEach(col => {
                    doc.fillColor('#ffffff').fontSize(7).font(FONT_BOLD)
                        .text(col.title, currX + 2, y + 4.5, { width: col.width - 4, align: col.align, lineBreak: false });
                    currX += col.width;
                });
                y += 16;
            };

            renderScheduleTableHeader();

            if (schedule.length === 0) {
                doc.rect(margin, y, contentWidth, 16).fillAndStroke('#ffffff', borderColor);
                doc.fillColor(textMuted).fontSize(7.5).font(FONT_REGULAR)
                    .text('No repayment schedule records available for this contract.', margin + 8, y + 4.5, { lineBreak: false });
                y += 18;
            } else {
                schedule.forEach((row, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = isEven ? '#ffffff' : '#f8fafc';
                    const rowHeight = 14;

                    doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(rowBg, borderColor);

                    const monthNum = row.month || row.term || (idx + 1);
                    const dueDate = row.dueDate || '—';
                    const schedAmount = (parseFloat(row.amount || row.monthlyPayment || 0) || 0).toFixed(2);
                    const penalty = (parseFloat(row.penalty || row.latePenalty || 0) || 0).toFixed(2);
                    const totalDue = (parseFloat(row.totalAmount || (parseFloat(schedAmount) + parseFloat(penalty))) || 0).toFixed(2);
                    const paid = (parseFloat(row.paidAmount || 0) || 0).toFixed(2);
                    const paidDate = row.paidDate || '—';
                    const status = row.status || (parseFloat(paid) >= parseFloat(totalDue) && parseFloat(totalDue) > 0 ? 'Paid' : 'Unpaid');
                    const note = row.notes || row.comment || '';

                    let currX = margin;

                    // #
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(String(monthNum), currX + 2, y + 3.5, { width: cols[0].width - 4, align: cols[0].align, lineBreak: false });
                    currX += cols[0].width;

                    // Due Date
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(dueDate, currX + 2, y + 3.5, { width: cols[1].width - 4, align: cols[1].align, lineBreak: false });
                    currX += cols[1].width;

                    // Scheduled ($)
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(`$${schedAmount}`, currX + 2, y + 3.5, { width: cols[2].width - 4, align: cols[2].align, lineBreak: false });
                    currX += cols[2].width;

                    // Penalty ($)
                    doc.fillColor(parseFloat(penalty) > 0 ? dangerColor : textMuted).fontSize(7).font(FONT_REGULAR)
                        .text(parseFloat(penalty) > 0 ? `$${penalty}` : '$0.00', currX + 2, y + 3.5, { width: cols[3].width - 4, align: cols[3].align, lineBreak: false });
                    currX += cols[3].width;

                    // Total Due ($)
                    doc.fillColor(textDark).fontSize(7).font(FONT_BOLD)
                        .text(`$${totalDue}`, currX + 2, y + 3.5, { width: cols[4].width - 4, align: cols[4].align, lineBreak: false });
                    currX += cols[4].width;

                    // Paid ($)
                    doc.fillColor(parseFloat(paid) > 0 ? successColor : textMuted).fontSize(7).font(FONT_BOLD)
                        .text(`$${paid}`, currX + 2, y + 3.5, { width: cols[5].width - 4, align: cols[5].align, lineBreak: false });
                    currX += cols[5].width;

                    // Paid Date
                    doc.fillColor(textDark).fontSize(6.5).font(FONT_REGULAR)
                        .text(paidDate, currX + 2, y + 3.5, { width: cols[6].width - 4, align: cols[6].align, lineBreak: false });
                    currX += cols[6].width;

                    // Status
                    let statusColor = dangerColor;
                    if (status.toLowerCase().includes('paid') || status.toLowerCase().includes('settled')) statusColor = successColor;
                    else if (status.toLowerCase().includes('partial') || status.toLowerCase().includes('due')) statusColor = warningColor;

                    doc.fillColor(statusColor).fontSize(7).font(FONT_BOLD)
                        .text(status, currX + 2, y + 3.5, { width: cols[7].width - 4, align: cols[7].align, lineBreak: false });
                    currX += cols[7].width;

                    // Notes
                    doc.fillColor(textMuted).fontSize(6).font(FONT_KHMER)
                        .text(note || '—', currX + 2, y + 3.5, { width: cols[8].width - 4, align: cols[8].align, ellipsis: true, lineBreak: false });

                    y += rowHeight;
                });
                y += 6;
            }

            // ── PAGE 2: DEDICATED INSTALLMENT & OVERDUE ANALYTICS REPORT ──
            doc.addPage();
            renderTopHeader(true);
            y = margin + 32;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let totalLateDays = 0;
            let totalPenaltyIncurred = 0;
            let totalPenaltyPaid = 0;
            let overdueTermsCount = 0;
            let paidLateTermsCount = 0;
            let paidOnTimeTermsCount = 0;
            let pendingUpcomingTermsCount = 0;
            let maxOverdueDaysOnSingleTerm = 0;

            let overdue3To6DaysCount = 0;
            let overdue7PlusDaysCount = 0;
            let dueIn3DaysCount = 0;
            let dueTodayCount = 0;
            let unpaidYesterdayCount = 0;

            const installmentBreakdown = schedule.map((row, idx) => {
                const termNum = row.month || row.term || (idx + 1);
                const dueDateStr = row.dueDate || '';
                const schedAmt = parseFloat(row.amount || row.monthlyPayment || 0) || 0;
                const penaltyAmt = parseFloat(row.penalty || row.latePenalty || 0) || 0;
                const totalDueAmt = parseFloat(row.totalAmount || (schedAmt + penaltyAmt)) || 0;
                const paidAmt = parseFloat(row.paidAmount || 0) || 0;
                const paidDateStr = row.paidDate || '';
                const statusStr = row.status || 'Pending';

                let overdueDays = 0;
                let isTermOverdue = false;
                let isTermLatePaid = false;

                if (dueDateStr) {
                    const dueDate = new Date(`${dueDateStr}T00:00:00`);
                    if (!isNaN(dueDate.getTime())) {
                        const diffDays = Math.floor((today - dueDate) / 86400000);
                        const isNotPaid = statusStr !== 'Paid' && statusStr !== 'PayOff' && statusStr !== 'Settled' && paidAmt < totalDueAmt;

                        if (paidDateStr) {
                            const paidDate = new Date(`${paidDateStr}T00:00:00`);
                            if (!isNaN(paidDate.getTime())) {
                                overdueDays = Math.max(0, Math.floor((paidDate - dueDate) / 86400000));
                                if (overdueDays > 0) isTermLatePaid = true;
                            }
                        } else if (isNotPaid) {
                            overdueDays = Math.max(0, diffDays);
                            if (overdueDays > 0) {
                                isTermOverdue = true;
                                if (overdueDays >= 7) overdue7PlusDaysCount++;
                                else if (overdueDays >= 3) overdue3To6DaysCount++;
                                if (diffDays === 1) unpaidYesterdayCount++;
                            } else if (diffDays === 0) {
                                dueTodayCount++;
                            } else if (diffDays >= -3 && diffDays < 0) {
                                dueIn3DaysCount++;
                            }
                        }
                    }
                }

                if (isTermOverdue) {
                    overdueTermsCount++;
                    totalLateDays += overdueDays;
                    if (overdueDays > maxOverdueDaysOnSingleTerm) maxOverdueDaysOnSingleTerm = overdueDays;
                } else if (isTermLatePaid) {
                    paidLateTermsCount++;
                    totalLateDays += overdueDays;
                    if (overdueDays > maxOverdueDaysOnSingleTerm) maxOverdueDaysOnSingleTerm = overdueDays;
                } else if (statusStr === 'Paid' || statusStr === 'PayOff' || statusStr === 'Settled' || paidAmt >= totalDueAmt) {
                    paidOnTimeTermsCount++;
                } else {
                    pendingUpcomingTermsCount++;
                }

                totalPenaltyIncurred += penaltyAmt;
                if (paidAmt >= totalDueAmt && totalDueAmt > 0) {
                    totalPenaltyPaid += penaltyAmt;
                }

                return {
                    termNum,
                    dueDateStr,
                    schedAmt,
                    penaltyAmt,
                    totalDueAmt,
                    paidAmt,
                    paidDateStr,
                    statusStr,
                    overdueDays,
                    isTermOverdue,
                    isTermLatePaid
                };
            });

            const unpaidPenalty = Math.max(0, totalPenaltyIncurred - totalPenaltyPaid);

            let healthRating = 'Good Standing (Up to Date)';
            let healthColor = successColor;
            if (overdueTermsCount > 0) {
                if (maxOverdueDaysOnSingleTerm >= 7) {
                    healthRating = `High Risk (Overdue 7+ Days: ${maxOverdueDaysOnSingleTerm}d)`;
                    healthColor = dangerColor;
                } else if (maxOverdueDaysOnSingleTerm >= 3) {
                    healthRating = `Moderate Delay (Overdue 3-6 Days: ${maxOverdueDaysOnSingleTerm}d)`;
                    healthColor = warningColor;
                } else {
                    healthRating = `Minor Delay (Overdue ${maxOverdueDaysOnSingleTerm} Days)`;
                    healthColor = warningColor;
                }
            }

            // ── 5. INSTALLMENT & OVERDUE ANALYTICS REPORT (Always Section 5) ──
            drawSectionHeader(nextSection(), 'Installment & Overdue Analytics Report');

            // 4 KPI Overview Metric Cards
            const cardWidth = (contentWidth - 18) / 4;
            const cardHeight = 40;

            const kpiCards = [
                { label: 'Installment Terms', value: `${schedule.length} Terms`, sub: `${paidOnTimeTermsCount} Paid / ${overdueTermsCount} Overdue`, color: accentBlue },
                { label: 'Total Overdue Days', value: `${totalLateDays} Days`, sub: `Max Delay: ${maxOverdueDaysOnSingleTerm} Days`, color: totalLateDays > 0 ? dangerColor : successColor },
                { label: 'Total Late Penalty', value: `$${totalPenaltyIncurred.toFixed(2)}`, sub: `$${unpaidPenalty.toFixed(2)} Unpaid`, color: totalPenaltyIncurred > 0 ? dangerColor : successColor },
                { label: 'Installment Health', value: overdueTermsCount === 0 ? 'Healthy' : 'Late Alert', sub: healthRating, color: healthColor }
            ];

            kpiCards.forEach((card, cIdx) => {
                const cx = margin + (cIdx * (cardWidth + 6));
                doc.rect(cx, y, cardWidth, cardHeight).fillAndStroke(lightCardBg, borderColor);
                doc.rect(cx, y, cardWidth, 3).fill(card.color);

                doc.fillColor(textMuted).fontSize(6.5).font(FONT_BOLD)
                    .text(card.label.toUpperCase(), cx + 5, y + 5, { width: cardWidth - 10, lineBreak: false });

                doc.fillColor(card.color).fontSize(10).font(FONT_BOLD)
                    .text(card.value, cx + 5, y + 14, { width: cardWidth - 10, lineBreak: false });

                doc.fillColor(textDark).fontSize(6.5).font(FONT_REGULAR)
                    .text(card.sub, cx + 5, y + 27, { width: cardWidth - 10, ellipsis: true, lineBreak: false });
            });

            y += cardHeight + 8;

            // Summary Analytics Grid with Overdue Categories
            const analyticsSummaryItems = [
                { label: 'Contract Duration', value: contract.duration || `${schedule.length} Months` },
                { label: 'Monthly Payment ($)', value: `$${monthlyPayment.toFixed(2)}` },
                { label: 'Terms Paid On-Time', value: `${paidOnTimeTermsCount} Month(s)` },
                { label: 'Terms Paid with Delay', value: `${paidLateTermsCount} Month(s)` },
                { label: 'Overdue 3-6 Days (យឺត ៣ ថ្ងៃ)', value: `${overdue3To6DaysCount} Term(s)` },
                { label: 'Overdue 7+ Days (យឺត ៧ ថ្ងៃឡើង)', value: `${overdue7PlusDaysCount} Term(s)` },
                { label: 'Due in 3 Days (ជិតដល់ថ្ងៃបង់)', value: `${dueIn3DaysCount} Term(s)` },
                { label: 'Due Today (ត្រូវបង់ថ្ងៃនេះ)', value: `${dueTodayCount} Term(s)` },
                { label: 'Unpaid Yesterday (មិនបានបង់ម្សិលមិញ)', value: `${unpaidYesterdayCount} Term(s)` },
                { label: 'Remaining Principal ($)', value: `$${remainingBalance.toFixed(2)}` },
                { label: 'Total Penalty Paid ($)', value: `$${totalPenaltyPaid.toFixed(2)}` },
                { label: 'Remaining Unpaid Penalty ($)', value: `$${unpaidPenalty.toFixed(2)}` }
            ];

            drawDynamicGrid2Col(analyticsSummaryItems);

            // Overdue Detailed Breakdown Table (if schedule exists)
            if (installmentBreakdown.length > 0) {
                doc.rect(margin, y, contentWidth, 16).fill('#334155');
                doc.fillColor('#ffffff').fontSize(7.5).font(FONT_BOLD)
                    .text('TERM-BY-TERM OVERDUE & LATE PAYMENT BREAKDOWN', margin + 8, y + 4.5, { lineBreak: false });
                y += 18;

                const repCols = [
                    { title: 'Term #', width: 40, align: 'center' },
                    { title: 'Due Date', width: 75, align: 'left' },
                    { title: 'Scheduled ($)', width: 70, align: 'right' },
                    { title: 'Overdue / Late', width: 95, align: 'center' },
                    { title: 'Penalty ($)', width: 65, align: 'right' },
                    { title: 'Paid Date', width: 75, align: 'center' },
                    { title: 'Paid ($)', width: 60, align: 'right' },
                    { title: 'Status', width: 43.28, align: 'center' }
                ];

                const renderRepTableHeader = () => {
                    doc.rect(margin, y, contentWidth, 15).fill(brandNavy);
                    let currX = margin;
                    repCols.forEach(col => {
                        doc.fillColor('#ffffff').fontSize(7).font(FONT_BOLD)
                            .text(col.title, currX + 2, y + 4, { width: col.width - 4, align: col.align, lineBreak: false });
                        currX += col.width;
                    });
                    y += 15;
                };

                renderRepTableHeader();

                installmentBreakdown.forEach((r, rIdx) => {
                    const isEven = rIdx % 2 === 0;
                    const rowBg = isEven ? '#ffffff' : '#f8fafc';
                    const rowHeight = 14;

                    doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(rowBg, borderColor);

                    let currX = margin;

                    // Term #
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(`Term ${r.termNum}`, currX + 2, y + 3.5, { width: repCols[0].width - 4, align: 'center', lineBreak: false });
                    currX += repCols[0].width;

                    // Due Date
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(r.dueDateStr || '—', currX + 2, y + 3.5, { width: repCols[1].width - 4, align: 'left', lineBreak: false });
                    currX += repCols[1].width;

                    // Scheduled
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                        .text(`$${r.schedAmt.toFixed(2)}`, currX + 2, y + 3.5, { width: repCols[2].width - 4, align: 'right', lineBreak: false });
                    currX += repCols[2].width;

                    // Overdue Days
                    let dayColor = successColor;
                    let dayText = '0 Days (On-Time)';
                    if (r.overdueDays > 0) {
                        dayColor = r.overdueDays >= 7 ? dangerColor : warningColor;
                        dayText = `+${r.overdueDays} Days Late`;
                    }
                    doc.fillColor(dayColor).fontSize(7).font(FONT_BOLD)
                        .text(dayText, currX + 2, y + 3.5, { width: repCols[3].width - 4, align: 'center', lineBreak: false });
                    currX += repCols[3].width;

                    // Penalty
                    doc.fillColor(r.penaltyAmt > 0 ? dangerColor : textMuted).fontSize(7).font(FONT_REGULAR)
                        .text(r.penaltyAmt > 0 ? `$${r.penaltyAmt.toFixed(2)}` : '$0.00', currX + 2, y + 3.5, { width: repCols[4].width - 4, align: 'right', lineBreak: false });
                    currX += repCols[4].width;

                    // Paid Date
                    doc.fillColor(textDark).fontSize(6.5).font(FONT_REGULAR)
                        .text(r.paidDateStr || '—', currX + 2, y + 3.5, { width: repCols[5].width - 4, align: 'center', lineBreak: false });
                    currX += repCols[5].width;

                    // Paid Amount
                    doc.fillColor(r.paidAmt > 0 ? successColor : textMuted).fontSize(7).font(FONT_BOLD)
                        .text(`$${r.paidAmt.toFixed(2)}`, currX + 2, y + 3.5, { width: repCols[6].width - 4, align: 'right', lineBreak: false });
                    currX += repCols[6].width;

                    // Status
                    let sColor = dangerColor;
                    if (r.statusStr.toLowerCase().includes('paid') || r.statusStr.toLowerCase().includes('settled')) sColor = successColor;
                    else if (r.statusStr.toLowerCase().includes('partial') || r.statusStr.toLowerCase().includes('due')) sColor = warningColor;

                    doc.fillColor(sColor).fontSize(7).font(FONT_BOLD)
                        .text(r.statusStr, currX + 2, y + 3.5, { width: repCols[7].width - 4, align: 'center', lineBreak: false });

                    y += rowHeight;
                });
                y += 6;
            }

            // ── 6. PAYMENT TRANSACTION HISTORY (If payments exist) ──
            if (payments && payments.length > 0) {
                drawSectionHeader(nextSection(), 'Payment Transaction History');

                const pCols = [
                    { title: '#', width: 30, align: 'center' },
                    { title: 'Payment ID', width: 95, align: 'left' },
                    { title: 'Paid Date', width: 85, align: 'left' },
                    { title: 'Payment Method', width: 110, align: 'left' },
                    { title: 'Amount ($)', width: 80, align: 'right' },
                    { title: 'Description', width: 123.28, align: 'left' }
                ];

                doc.rect(margin, y, contentWidth, 15).fill('#334155');
                let currX = margin;
                pCols.forEach(col => {
                    doc.fillColor('#ffffff').fontSize(7).font(FONT_BOLD)
                        .text(col.title, currX + 2, y + 4, { width: col.width - 4, align: col.align, lineBreak: false });
                    currX += col.width;
                });
                y += 15;

                payments.forEach((p, pIdx) => {
                    const rowBg = pIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                    doc.rect(margin, y, contentWidth, 14).fillAndStroke(rowBg, borderColor);

                    let px = margin;
                    // #
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR).text(String(pIdx + 1), px + 2, y + 3.5, { width: pCols[0].width - 4, align: 'center', lineBreak: false });
                    px += pCols[0].width;
                    // Payment ID
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR).text(p.paymentId || '—', px + 2, y + 3.5, { width: pCols[1].width - 4, align: 'left', lineBreak: false });
                    px += pCols[1].width;
                    // Paid Date
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR).text(p.paidDate || '—', px + 2, y + 3.5, { width: pCols[2].width - 4, align: 'left', lineBreak: false });
                    px += pCols[2].width;
                    // Paid By
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR).text(p.paidBy || 'QR Mobile Payment', px + 2, y + 3.5, { width: pCols[3].width - 4, align: 'left', lineBreak: false });
                    px += pCols[3].width;
                    // Amount
                    doc.fillColor(successColor).fontSize(7.5).font(FONT_BOLD).text(`$${(parseFloat(p.amount) || 0).toFixed(2)}`, px + 2, y + 3.5, { width: pCols[4].width - 4, align: 'right', lineBreak: false });
                    px += pCols[4].width;
                    // Description
                    doc.fillColor(textMuted).fontSize(6.5).font(FONT_KHMER).text(p.description || '—', px + 2, y + 3.5, { width: pCols[5].width - 4, align: 'left', ellipsis: true, lineBreak: false });

                    y += 14;
                });
                y += 6;
            }

            // ── PAGE NUMBERING FOOTER ON ALL PAGES ──
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.rect(margin, pageHeight - 30, contentWidth, 1).fill(borderColor);
                doc.fillColor(textMuted).fontSize(7).font(FONT_REGULAR)
                    .text(`SYSTEM MDM Automated Dossier • Brand: ${activeBrand} • Confidential Document`, margin, pageHeight - 24, {
                        align: 'left',
                        lineBreak: false
                    });
                doc.fillColor(textMuted).fontSize(7).font(FONT_REGULAR)
                    .text(`Page ${i + 1} of ${range.count}`, margin, pageHeight - 24, {
                        align: 'right',
                        width: contentWidth,
                        lineBreak: false
                    });
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
