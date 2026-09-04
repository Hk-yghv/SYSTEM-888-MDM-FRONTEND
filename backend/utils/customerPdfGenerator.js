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
 * 1. Customer Personal Profile
 * 2. Device & Hardware Details
 * 3. Loan & Financial Summary
 * 4. Full Repayment Schedule Table ($)
 * 5. Payment Transaction History
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
                margin: 36, // 0.5 inch margins
                bufferPages: true,
                info: {
                    Title: `Customer Report - ${contract.customerNameEn || contract.contractId || 'MDM'}`,
                    Author: 'SYSTEM MDM Platform',
                    Subject: 'Customer Details & Repayment Schedule',
                    Keywords: 'MDM, Contract, Repayment, Schedule, Loan'
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
            doc.rect(margin, margin, contentWidth, 58).fillAndStroke(brandNavy, brandNavy);

            doc.fillColor('#ffffff').fontSize(15).font(FONT_BOLD)
               .text('SYSTEM MDM', margin + 16, margin + 12);

            doc.fillColor('#38bdf8').fontSize(9.5).font(FONT_BOLD)
               .text(`BRAND: ${String(activeBrand).toUpperCase()}`, margin + 16, margin + 33);

            doc.fillColor('#94a3b8').fontSize(8.5).font(FONT_BOLD)
               .text('CUSTOMER DOSSIER & REPAYMENT SCHEDULE', margin, margin + 14, { align: 'right', width: contentWidth - 16 });

            const printDate = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
            doc.fillColor('#cbd5e1').fontSize(8).font(FONT_REGULAR)
               .text(`Generated: ${printDate}`, margin, margin + 33, { align: 'right', width: contentWidth - 16 });

            let y = margin + 68;

            // ── Helper: Section Title with Clean Vector Badge (No raw emoji) ──
            const drawSectionHeader = (number, titleEn, titleKh = '') => {
                if (y > pageHeight - 110) {
                    doc.addPage();
                    y = margin;
                }
                
                // Background bar
                doc.rect(margin, y, contentWidth, 22).fillAndStroke(lightCardBg, borderColor);
                doc.rect(margin, y, 4, 22).fill(accentBlue);

                // Number badge
                doc.circle(margin + 16, y + 11, 7).fill(accentBlue);
                doc.fillColor('#ffffff').fontSize(7.5).font(FONT_BOLD)
                   .text(String(number), margin + 11, y + 7.5, { width: 10, align: 'center' });

                // Title Text
                doc.fillColor(brandNavy).fontSize(9.5).font(FONT_BOLD)
                   .text(titleEn.toUpperCase(), margin + 28, y + 6);

                if (titleKh) {
                    doc.fillColor(textMuted).fontSize(8.5).font(FONT_KHMER)
                       .text(`(${titleKh})`, margin + 30 + doc.widthOfString(titleEn.toUpperCase(), { font: FONT_BOLD, size: 9.5 }) + 6, y + 6);
                }

                y += 26;
            };

            // ── Helper: Dynamic-Height 2-Column Grid (Zero Overlap Guaranteed) ──
            const drawDynamicGrid2Col = (items) => {
                const gap = 8;
                const colWidth = (contentWidth - gap) / 2;
                const labelWidth = colWidth * 0.38;
                const valueWidth = colWidth * 0.62 - 12;

                for (let i = 0; i < items.length; i += 2) {
                    const item1 = items[i];
                    const item2 = items[i + 1] || null;

                    // Calculate required heights for both items
                    const valStr1 = String(item1.value || '—');
                    const valStr2 = item2 ? String(item2.value || '—') : '';

                    const h1 = doc.heightOfString(valStr1, {
                        width: valueWidth,
                        font: FONT_KHMER,
                        size: 8
                    });

                    const h2 = item2 ? doc.heightOfString(valStr2, {
                        width: valueWidth,
                        font: FONT_KHMER,
                        size: 8
                    }) : 0;

                    const rowHeight = Math.max(22, Math.max(h1, h2) + 10);

                    // Check page overflow
                    if (y + rowHeight > pageHeight - 35) {
                        doc.addPage();
                        y = margin;
                    }

                    // Draw Box 1
                    const x1 = margin;
                    doc.rect(x1, y, colWidth, rowHeight).fillAndStroke('#ffffff', borderColor);
                    doc.fillColor(textMuted).fontSize(8).font(FONT_BOLD)
                       .text(item1.label + ':', x1 + 6, y + 5, { width: labelWidth - 6 });
                    doc.fillColor(textDark).fontSize(8).font(FONT_KHMER)
                       .text(valStr1, x1 + labelWidth, y + 5, { width: valueWidth });

                    // Draw Box 2 (if present)
                    if (item2) {
                        const x2 = margin + colWidth + gap;
                        doc.rect(x2, y, colWidth, rowHeight).fillAndStroke('#ffffff', borderColor);
                        doc.fillColor(textMuted).fontSize(8).font(FONT_BOLD)
                           .text(item2.label + ':', x2 + 6, y + 5, { width: labelWidth - 6 });
                        doc.fillColor(textDark).fontSize(8).font(FONT_KHMER)
                           .text(valStr2, x2 + labelWidth, y + 5, { width: valueWidth });
                    }

                    y += rowHeight + 3;
                }
                y += 6;
            };

            // ── 1. CUSTOMER INFORMATION ──
            drawSectionHeader('1', 'Customer Information', 'ព័ត៌មានអតិថិជន');
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
            drawSectionHeader('2', 'Device Specifications', 'ព័ត៌មានឧបករណ៍');
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

            // ── 3. LOAN & CONTRACT FINANCIALS ──
            drawSectionHeader('3', 'Loan & Financial Terms', 'លក្ខខណ្ឌកម្ចី');

            const totalScheduled = Array.isArray(contract.repaymentSchedule)
                ? contract.repaymentSchedule.reduce((acc, row) => acc + (parseFloat(row.totalAmount || row.amount || 0) || 0), 0)
                : (contract.totalAmount || 0);

            const totalPaidAmount = (payments && payments.length > 0)
                ? payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)
                : (Array.isArray(contract.repaymentSchedule)
                    ? contract.repaymentSchedule.reduce((acc, row) => acc + (parseFloat(row.paidAmount || 0) || 0), 0)
                    : 0);

            const remainingBalance = Math.max(0, (contract.totalAmount || totalScheduled) - totalPaidAmount);

            const loanItems = [
                { label: 'Contract ID', value: contract.contractId },
                { label: 'Contract IID', value: contract.contractIid },
                { label: 'Input Date', value: contract.inputDate },
                { label: 'Loan Duration', value: contract.duration },
                { label: 'Original Loan ($)', value: `$${(parseFloat(contract.amount) || 0).toFixed(2)}` },
                { label: 'Interest Rate', value: contract.interest || contract.interestType || '14%' },
                { label: 'Admin Fee ($)', value: `$${(parseFloat(contract.adminFee) || 0).toFixed(2)}` },
                { label: 'Monthly Payment ($)', value: `$${(parseFloat(contract.monthlyPayment) || 0).toFixed(2)}` },
                { label: 'Total Loan Amount ($)', value: `$${(parseFloat(contract.totalAmount || totalScheduled) || 0).toFixed(2)}` },
                { label: 'Total Paid to Date ($)', value: `$${totalPaidAmount.toFixed(2)}` },
                { label: 'Remaining Balance ($)', value: `$${remainingBalance.toFixed(2)}` },
                { label: 'Contract Status', value: contract.status || 'Application' }
            ];
            drawDynamicGrid2Col(loanItems);

            // ── 4. REPAYMENT SCHEDULE TABLE ──
            drawSectionHeader('4', 'Repayment Schedule ($)', 'តារាងកាលវិភាគបង់ប្រាក់');

            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];

            // Table Column Setup
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

            const renderTableHeader = () => {
                doc.rect(margin, y, contentWidth, 18).fill(brandNavy);
                let currX = margin;
                cols.forEach(col => {
                    doc.fillColor('#ffffff').fontSize(7.5).font(FONT_BOLD)
                       .text(col.title, currX + 2, y + 5, { width: col.width - 4, align: col.align });
                    currX += col.width;
                });
                y += 18;
            };

            renderTableHeader();

            if (schedule.length === 0) {
                doc.rect(margin, y, contentWidth, 20).fillAndStroke('#ffffff', borderColor);
                doc.fillColor(textMuted).fontSize(8).font(FONT_REGULAR)
                   .text('No repayment schedule records available for this contract.', margin + 10, y + 6);
                y += 26;
            } else {
                schedule.forEach((row, idx) => {
                    if (y > pageHeight - 40) {
                        doc.addPage();
                        y = margin;
                        renderTableHeader();
                    }

                    const isEven = idx % 2 === 0;
                    const rowBg = isEven ? '#ffffff' : '#f8fafc';
                    const rowHeight = 17;

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
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR)
                       .text(String(monthNum), currX + 2, y + 4.5, { width: cols[0].width - 4, align: cols[0].align });
                    currX += cols[0].width;

                    // Due Date
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR)
                       .text(dueDate, currX + 2, y + 4.5, { width: cols[1].width - 4, align: cols[1].align });
                    currX += cols[1].width;

                    // Scheduled ($)
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR)
                       .text(`$${schedAmount}`, currX + 2, y + 4.5, { width: cols[2].width - 4, align: cols[2].align });
                    currX += cols[2].width;

                    // Penalty ($)
                    doc.fillColor(parseFloat(penalty) > 0 ? dangerColor : textMuted).fontSize(7.5).font(FONT_REGULAR)
                       .text(parseFloat(penalty) > 0 ? `$${penalty}` : '$0.00', currX + 2, y + 4.5, { width: cols[3].width - 4, align: cols[3].align });
                    currX += cols[3].width;

                    // Total Due ($)
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_BOLD)
                       .text(`$${totalDue}`, currX + 2, y + 4.5, { width: cols[4].width - 4, align: cols[4].align });
                    currX += cols[4].width;

                    // Paid ($)
                    doc.fillColor(parseFloat(paid) > 0 ? successColor : textMuted).fontSize(7.5).font(FONT_BOLD)
                       .text(`$${paid}`, currX + 2, y + 4.5, { width: cols[5].width - 4, align: cols[5].align });
                    currX += cols[5].width;

                    // Paid Date
                    doc.fillColor(textDark).fontSize(7).font(FONT_REGULAR)
                       .text(paidDate, currX + 2, y + 4.5, { width: cols[6].width - 4, align: cols[6].align });
                    currX += cols[6].width;

                    // Status
                    let statusColor = dangerColor;
                    if (status.toLowerCase().includes('paid') || status.toLowerCase().includes('settled')) statusColor = successColor;
                    else if (status.toLowerCase().includes('partial') || status.toLowerCase().includes('due')) statusColor = warningColor;

                    doc.fillColor(statusColor).fontSize(7.5).font(FONT_BOLD)
                       .text(status, currX + 2, y + 4.5, { width: cols[7].width - 4, align: cols[7].align });
                    currX += cols[7].width;

                    // Notes
                    doc.fillColor(textMuted).fontSize(6.5).font(FONT_KHMER)
                       .text(note || '—', currX + 2, y + 4.5, { width: cols[8].width - 4, align: cols[8].align, ellipsis: true });

                    y += rowHeight;
                });
                y += 10;
            }

            // ── 5. PAYMENT HISTORY LOG (IF ANY) ──
            if (payments && payments.length > 0) {
                drawSectionHeader('5', 'Payment History', 'ប្រវត្តិការបង់ប្រាក់');

                const pCols = [
                    { title: '#', width: 30, align: 'center' },
                    { title: 'Payment ID', width: 95, align: 'left' },
                    { title: 'Paid Date', width: 85, align: 'left' },
                    { title: 'Payment Method', width: 110, align: 'left' },
                    { title: 'Amount ($)', width: 80, align: 'right' },
                    { title: 'Description', width: 123.28, align: 'left' }
                ];

                doc.rect(margin, y, contentWidth, 18).fill('#334155');
                let currX = margin;
                pCols.forEach(col => {
                    doc.fillColor('#ffffff').fontSize(7.5).font(FONT_BOLD)
                       .text(col.title, currX + 2, y + 5, { width: col.width - 4, align: col.align });
                    currX += col.width;
                });
                y += 18;

                payments.forEach((p, pIdx) => {
                    if (y > pageHeight - 40) {
                        doc.addPage();
                        y = margin;
                    }
                    const rowBg = pIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                    doc.rect(margin, y, contentWidth, 16).fillAndStroke(rowBg, borderColor);

                    let px = margin;
                    // #
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR).text(String(pIdx + 1), px + 2, y + 4, { width: pCols[0].width - 4, align: 'center' });
                    px += pCols[0].width;
                    // Payment ID
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR).text(p.paymentId || '—', px + 2, y + 4, { width: pCols[1].width - 4, align: 'left' });
                    px += pCols[1].width;
                    // Paid Date
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR).text(p.paidDate || '—', px + 2, y + 4, { width: pCols[2].width - 4, align: 'left' });
                    px += pCols[2].width;
                    // Paid By
                    doc.fillColor(textDark).fontSize(7.5).font(FONT_REGULAR).text(p.paidBy || 'QR Mobile Payment', px + 2, y + 4, { width: pCols[3].width - 4, align: 'left' });
                    px += pCols[3].width;
                    // Amount
                    doc.fillColor(successColor).fontSize(7.5).font(FONT_BOLD).text(`$${(parseFloat(p.amount) || 0).toFixed(2)}`, px + 2, y + 4, { width: pCols[4].width - 4, align: 'right' });
                    px += pCols[4].width;
                    // Description
                    doc.fillColor(textMuted).fontSize(7).font(FONT_KHMER).text(p.description || '—', px + 2, y + 4, { width: pCols[5].width - 4, align: 'left', ellipsis: true });

                    y += 16;
                });
                y += 10;
            }

            // ── PAGE NUMBERING FOOTER ON ALL PAGES ──
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.rect(margin, pageHeight - 26, contentWidth, 1).fill(borderColor);
                doc.fillColor(textMuted).fontSize(7.5).font(FONT_REGULAR)
                   .text(`SYSTEM MDM Automated Dossier • Brand: ${activeBrand} • Confidential Document`, margin, pageHeight - 20, { align: 'left' });
                doc.fillColor(textMuted).fontSize(7.5).font(FONT_REGULAR)
                   .text(`Page ${i + 1} of ${range.count}`, margin, pageHeight - 20, { align: 'right', width: contentWidth });
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
