import PDFDocument from 'pdfkit';

/**
 * Generate a comprehensive PDF report containing:
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
                    Title: `Customer Report - ${contract.customerNameEn || contract.customerNameKh || contract.contractId}`,
                    Author: 'SYSTEM MDM Platform',
                    Subject: 'Customer Details & Repayment Schedule',
                    Keywords: 'MDM, Contract, Repayment, Schedule, Loan'
                }
            });

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

            // Palette
            const primaryColor = '#1e293b'; // Slate 800
            const accentColor = '#2563eb'; // Blue 600
            const lightBg = '#f8fafc'; // Slate 50
            const borderColor = '#e2e8f0'; // Slate 200
            const textDark = '#0f172a';
            const textMuted = '#64748b';
            const successColor = '#16a34a';
            const warningColor = '#d97706';
            const dangerColor = '#dc2626';

            // ── HEADER BANNER ──
            doc.rect(margin, margin, contentWidth, 60).fillAndStroke('#0f172a', '#0f172a');
            
            doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
               .text('SYSTEM MDM', margin + 16, margin + 12);
            
            doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold')
               .text(`BRAND: ${activeBrand.toUpperCase()}`, margin + 16, margin + 34);

            doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
               .text('CUSTOMER DOSSIER & REPAYMENT SCHEDULE', margin, margin + 16, { align: 'right', width: contentWidth - 16 });

            const printDate = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
            doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
               .text(`Generated: ${printDate}`, margin, margin + 34, { align: 'right', width: contentWidth - 16 });

            let y = margin + 72;

            // Helper: Section Title
            const drawSectionHeader = (title, iconText = '') => {
                // Check page overflow
                if (y > pageHeight - 120) {
                    doc.addPage();
                    y = margin;
                }
                doc.rect(margin, y, contentWidth, 22).fill(lightBg);
                doc.rect(margin, y, 4, 22).fill(accentColor);
                doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
                   .text(`${iconText} ${title}`.trim(), margin + 12, y + 6);
                y += 28;
            };

            // Helper: 2-Column Info Grid
            const drawGrid2Col = (items) => {
                const colWidth = (contentWidth - 10) / 2;
                for (let i = 0; i < items.length; i += 2) {
                    if (y > pageHeight - 50) {
                        doc.addPage();
                        y = margin;
                    }
                    const rowItems = [items[i], items[i + 1]].filter(Boolean);
                    rowItems.forEach((item, colIdx) => {
                        const x = margin + (colIdx * (colWidth + 10));
                        doc.rect(x, y, colWidth, 18).fillAndStroke('#ffffff', borderColor);
                        doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold')
                           .text(item.label + ':', x + 6, y + 5, { width: colWidth * 0.4 - 6 });
                        doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
                           .text(String(item.value || '—'), x + (colWidth * 0.4), y + 5, { width: colWidth * 0.6 - 6, ellipsis: true });
                    });
                    y += 21;
                }
                y += 6;
            };

            // ── 1. CUSTOMER INFORMATION ──
            drawSectionHeader('CUSTOMER INFORMATION (ព័ត៌មានអតិថិជន)', '👤');
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
            drawGrid2Col(customerItems);

            // ── 2. DEVICE SPECIFICATIONS ──
            drawSectionHeader('DEVICE SPECIFICATIONS (ព័ត៌មានឧបករណ៍)', '📱');
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
            drawGrid2Col(deviceItems);

            // ── 3. LOAN & CONTRACT FINANCIALS ──
            drawSectionHeader('LOAN & FINANCIAL TERMS (លក្ខខណ្ឌកម្ចី)', '💰');
            
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
            drawGrid2Col(loanItems);

            // ── 4. REPAYMENT SCHEDULE TABLE ──
            drawSectionHeader('REPAYMENT SCHEDULE ($) (តារាងកាលវិភាគបង់ប្រាក់)', '📅');

            const schedule = Array.isArray(contract.repaymentSchedule) ? contract.repaymentSchedule : [];
            
            // Table Column Definitions
            const cols = [
                { title: '#', width: 24, align: 'center' },
                { title: 'Due Date', width: 70, align: 'left' },
                { title: 'Schedule ($)', width: 66, align: 'right' },
                { title: 'Penalty ($)', width: 56, align: 'right' },
                { title: 'Total Due ($)', width: 68, align: 'right' },
                { title: 'Paid ($)', width: 60, align: 'right' },
                { title: 'Paid Date', width: 70, align: 'center' },
                { title: 'Status', width: 56, align: 'center' },
                { title: 'Notes', width: 53.28, align: 'left' }
            ];

            // Render Table Header
            const renderTableHeader = () => {
                doc.rect(margin, y, contentWidth, 18).fill('#1e293b');
                let currX = margin;
                cols.forEach(col => {
                    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
                       .text(col.title, currX + 2, y + 5, { width: col.width - 4, align: col.align });
                    currX += col.width;
                });
                y += 18;
            };

            renderTableHeader();

            if (schedule.length === 0) {
                doc.rect(margin, y, contentWidth, 20).fillAndStroke('#ffffff', borderColor);
                doc.fillColor(textMuted).fontSize(8).font('Helvetica-Oblique')
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
                    const rowHeight = 16;

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
                    
                    // Column 1: #
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
                       .text(String(monthNum), currX + 2, y + 4, { width: cols[0].width - 4, align: cols[0].align });
                    currX += cols[0].width;

                    // Column 2: Due Date
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
                       .text(dueDate, currX + 2, y + 4, { width: cols[1].width - 4, align: cols[1].align });
                    currX += cols[1].width;

                    // Column 3: Scheduled ($)
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
                       .text(`$${schedAmount}`, currX + 2, y + 4, { width: cols[2].width - 4, align: cols[2].align });
                    currX += cols[2].width;

                    // Column 4: Penalty ($)
                    doc.fillColor(parseFloat(penalty) > 0 ? dangerColor : textMuted).fontSize(7.5).font('Helvetica')
                       .text(parseFloat(penalty) > 0 ? `$${penalty}` : '$0.00', currX + 2, y + 4, { width: cols[3].width - 4, align: cols[3].align });
                    currX += cols[3].width;

                    // Column 5: Total Due ($)
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold')
                       .text(`$${totalDue}`, currX + 2, y + 4, { width: cols[4].width - 4, align: cols[4].align });
                    currX += cols[4].width;

                    // Column 6: Paid ($)
                    doc.fillColor(parseFloat(paid) > 0 ? successColor : textMuted).fontSize(7.5).font('Helvetica-Bold')
                       .text(`$${paid}`, currX + 2, y + 4, { width: cols[5].width - 4, align: cols[5].align });
                    currX += cols[5].width;

                    // Column 7: Paid Date
                    doc.fillColor(textDark).fontSize(7).font('Helvetica')
                       .text(paidDate, currX + 2, y + 4, { width: cols[6].width - 4, align: cols[6].align });
                    currX += cols[6].width;

                    // Column 8: Status Chip
                    let statusColor = dangerColor;
                    if (status.toLowerCase().includes('paid')) statusColor = successColor;
                    else if (status.toLowerCase().includes('partial') || status.toLowerCase().includes('due')) statusColor = warningColor;

                    doc.fillColor(statusColor).fontSize(7.5).font('Helvetica-Bold')
                       .text(status, currX + 2, y + 4, { width: cols[7].width - 4, align: cols[7].align });
                    currX += cols[7].width;

                    // Column 9: Notes
                    doc.fillColor(textMuted).fontSize(6.5).font('Helvetica')
                       .text(note || '—', currX + 2, y + 4, { width: cols[8].width - 4, align: cols[8].align, ellipsis: true });

                    y += rowHeight;
                });
                y += 10;
            }

            // ── 5. PAYMENT HISTORY LOG (IF ANY) ──
            if (payments && payments.length > 0) {
                drawSectionHeader('PAYMENT TRANSACTION HISTORY (ប្រវត្តិការបង់ប្រាក់)', '💳');
                
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
                    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
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
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(String(pIdx + 1), px + 2, y + 4, { width: pCols[0].width - 4, align: 'center' });
                    px += pCols[0].width;
                    // Payment ID
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(p.paymentId || '—', px + 2, y + 4, { width: pCols[1].width - 4, align: 'left' });
                    px += pCols[1].width;
                    // Paid Date
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(p.paidDate || '—', px + 2, y + 4, { width: pCols[2].width - 4, align: 'left' });
                    px += pCols[2].width;
                    // Paid By
                    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(p.paidBy || 'QR Mobile Payment', px + 2, y + 4, { width: pCols[3].width - 4, align: 'left' });
                    px += pCols[3].width;
                    // Amount
                    doc.fillColor(successColor).fontSize(7.5).font('Helvetica-Bold').text(`$${(parseFloat(p.amount) || 0).toFixed(2)}`, px + 2, y + 4, { width: pCols[4].width - 4, align: 'right' });
                    px += pCols[4].width;
                    // Description
                    doc.fillColor(textMuted).fontSize(7).font('Helvetica').text(p.description || '—', px + 2, y + 4, { width: pCols[5].width - 4, align: 'left', ellipsis: true });

                    y += 16;
                });
                y += 10;
            }

            // ── PAGE NUMBERING FOOTER ON ALL PAGES ──
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.rect(margin, pageHeight - 28, contentWidth, 1).fill(borderColor);
                doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
                   .text(`SYSTEM MDM Automated Dossier • Brand: ${activeBrand} • Confidential Document`, margin, pageHeight - 22, { align: 'left' });
                doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
                   .text(`Page ${i + 1} of ${range.count}`, margin, pageHeight - 22, { align: 'right', width: contentWidth });
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
