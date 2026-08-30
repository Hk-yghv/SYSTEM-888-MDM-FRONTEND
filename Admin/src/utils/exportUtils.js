// Utility helpers for Exporting Data to Excel (Styled Spreadsheet) and PDF (Print-ready HTML)

// Safely extract plain text/number string from cell renderer or accessor
const extractCellText = (col, row, idx) => {
    try {
        let val;
        if (col.cell) {
            val = col.cell(row, idx);
        } else if (col.accessor) {
            val = typeof col.accessor === 'function' ? col.accessor(row, idx) : row[col.accessor];
        } else {
            val = '';
        }

        if (val === null || val === undefined) return '';

        // If it's a React element (JSX), extract string children
        if (typeof val === 'object') {
            if (val.props && val.props.children !== undefined) {
                const child = val.props.children;
                if (typeof child === 'string' || typeof child === 'number') return String(child);
                if (Array.isArray(child)) return child.map(c => typeof c === 'object' ? '' : String(c)).join(' ').trim();
            }
            if (col.accessor && row[col.accessor] !== undefined && row[col.accessor] !== null) {
                return String(row[col.accessor]);
            }
            return '';
        }

        return String(val);
    } catch (e) {
        if (col.accessor && row[col.accessor] !== undefined && row[col.accessor] !== null) {
            return String(row[col.accessor]);
        }
        return '';
    }
};

/**
 * Rich Styled Excel Export (.xls HTML Format)
 * Opens in Excel with indigo headers, colored borders, formatted rows, and summary totals!
 */
export const exportToExcel = (dataOrTitle, filenameOrColumns, optionalData, brandName = '') => {
    let title = 'MDM_Report';
    let columns = null;
    let data = [];
    let bName = brandName;

    if (Array.isArray(dataOrTitle)) {
        // Legacy call: exportToExcel(dataArray, filename)
        data = dataOrTitle;
        title = filenameOrColumns || 'MDM_Report';
        if (data.length > 0) {
            columns = Object.keys(data[0]).map(k => ({ header: k, accessor: k }));
        }
    } else {
        // Structured call: exportToExcel(title, columns, data, brandName)
        title = dataOrTitle || 'MDM_Report';
        columns = filenameOrColumns;
        data = optionalData || [];
    }

    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const systemTitle = (bName || '').trim() ? ((bName || '').toUpperCase().startsWith('SYSTEM') ? bName.toUpperCase() : `SYSTEM ${(bName || '').toUpperCase()}`) : 'MDM SYSTEM';

    const colHeaders = columns ? columns.map(c => typeof c === 'string' ? c : (c.header || c.accessor || '')) : Object.keys(data[0]);

    // Build styled HTML string for Excel
    const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${title.replace(/[\\/?*\[\]]/g, '_').slice(0, 30)}</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11pt; }
                .title-header { background-color: #1e1b4b; color: #ffffff; font-size: 16pt; font-weight: bold; padding: 12px; height: 38px; text-align: left; }
                .subtitle-header { background-color: #312e81; color: #c7d2fe; font-size: 10pt; padding: 6px; italic: true; height: 24px; }
                th { background-color: #4f46e5 !important; color: #ffffff !important; font-weight: bold; border: 1px solid #312e81; padding: 8px 12px; height: 30px; font-size: 10pt; text-transform: uppercase; text-align: left; }
                td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10pt; vertical-align: middle; color: #0f172a; }
                tr.even { background-color: #f8fafc; }
                tr.summary { background-color: #e0e7ff !important; font-weight: bold; color: #1e1b4b; }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="${colHeaders.length}" class="title-header">${systemTitle} — ${title}</td>
                </tr>
                <tr>
                    <td colspan="${colHeaders.length}" class="subtitle-header">Report Generated: ${new Date().toLocaleString()} | Total Records: ${data.length}</td>
                </tr>
                <tr></tr>
                <thead>
                    <tr>
                        ${colHeaders.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        const isTotal = row.isTotalRow || row.isGrandTotal;
                        return `
                            <tr class="${isTotal ? 'summary' : (isEven ? 'even' : '')}">
                                ${columns ? columns.map(c => {
                                    const val = extractCellText(c, row, idx);
                                    return `<td>${val}</td>`;
                                }).join('') : Object.keys(data[0]).map(h => `<td>${row[h] !== undefined && row[h] !== null ? row[h] : ''}</td>`).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^A-Za-z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Print-Ready PDF Generator with Full A4 Portrait & Landscape Support
 */
export const exportToPDF = (title, columns, data, brandName = '', orientation = 'portrait') => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const bName = (brandName || '').trim();
    const systemTitle = bName ? (bName.toUpperCase().startsWith('SYSTEM') ? bName.toUpperCase() : `SYSTEM ${bName.toUpperCase()}`) : 'MDM SYSTEM';
    const isLandscape = orientation === 'landscape';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up window blocked! Please allow pop-ups for this site to export PDF.');
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - ${systemTitle}</title>
            <style>
                @page {
                    size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                    margin: ${isLandscape ? '8mm 10mm' : '12mm 12mm'};
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 0;
                    color: #0f172a;
                    background: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .pdf-container {
                    width: 100%;
                    box-sizing: border-box;
                    padding: ${isLandscape ? '6px 0' : '10px 0'};
                }
                .header-brand {
                    border-bottom: 2px solid #4f46e5;
                    padding-bottom: ${isLandscape ? '6px' : '8px'};
                    margin-bottom: ${isLandscape ? '10px' : '14px'};
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .header-left h1 {
                    font-size: ${isLandscape ? '15px' : '18px'};
                    color: #3730a3;
                    text-transform: uppercase;
                    margin: 0;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                }
                .header-left p {
                    font-size: ${isLandscape ? '9px' : '11px'};
                    color: #64748b;
                    margin-top: 4px;
                    margin-bottom: 0;
                }
                .header-right {
                    font-size: ${isLandscape ? '9px' : '11px'};
                    font-weight: 700;
                    color: #4f46e5;
                    background: #eef2ff;
                    padding: ${isLandscape ? '3px 8px' : '4px 10px'};
                    border-radius: 6px;
                    border: 1px solid #c7d2fe;
                }
                .table-container {
                    width: 100%;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: ${isLandscape ? '9px' : '11px'};
                    page-break-inside: auto;
                }
                thead {
                    display: table-header-group;
                }
                tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: ${isLandscape ? '5px 7px' : '8px 10px'};
                    text-align: left;
                }
                th {
                    background-color: #4f46e5 !important;
                    color: white !important;
                    text-transform: uppercase;
                    font-weight: 700;
                    font-size: ${isLandscape ? '8px' : '10px'};
                    letter-spacing: 0.5px;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .summary-row {
                    background-color: #eef2ff !important;
                    font-weight: bold;
                    color: #1e1b4b;
                }
                .footer-page {
                    border-top: 1px solid #cbd5e1;
                    padding-top: ${isLandscape ? '5px' : '8px'};
                    margin-top: ${isLandscape ? '10px' : '14px'};
                    font-size: ${isLandscape ? '8px' : '10px'};
                    color: #64748b;
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                }
                @media screen {
                    body { padding: 20px; background: #f1f5f9; }
                    .pdf-container {
                        background: white;
                        padding: 24px;
                        margin-bottom: 24px;
                        border-radius: 12px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    }
                }
            </style>
        </head>
        <body>
            <div class="pdf-container">
                <div class="header-brand">
                    <div class="header-left">
                        <h1>${systemTitle} — ${title}</h1>
                        <p>Generated: ${new Date().toLocaleString()} &bull; Layout: A4 ${isLandscape ? 'Landscape (ផ្តេក)' : 'Portrait (បញ្ឈរ)'}</p>
                    </div>
                    <div class="header-right">
                        Total Records: ${data.length}
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                ${columns.map(col => `<th>${col.header}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((row, idx) => `
                                <tr class="${row.isTotalRow || row.isGrandTotal ? 'summary-row' : ''}">
                                    ${columns.map(col => `<td>${extractCellText(col, row, idx)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="footer-page">
                    <span>SYSTEM MDM &bull; ${title}</span>
                    <span>Total Records: ${data.length} &bull; A4 ${isLandscape ? 'Landscape' : 'Portrait'}</span>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

export const exportToPDFLandscape = (title, columns, data, brandName = '') => {
    return exportToPDF(title, columns, data, brandName, 'landscape');
};
