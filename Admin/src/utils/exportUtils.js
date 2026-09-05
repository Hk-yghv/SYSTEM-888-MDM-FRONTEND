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

/**
 * Multi-Worksheet Excel XML Export
 * Supports 2 or more separate tabs (Worksheets) in a single Excel file
 */
export const exportMultiSheetExcel = (filename, sheets, brandName = '') => {
    if (!sheets || !sheets.length) {
        alert('No sheet data available to export');
        return;
    }

    const bName = (brandName || '').trim();
    const systemTitle = bName ? (bName.toUpperCase().startsWith('SYSTEM') ? bName.toUpperCase() : `SYSTEM ${bName.toUpperCase()}`) : 'MDM SYSTEM';

    const escapeXml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    let xmlWorksheets = '';

    sheets.forEach((sheet) => {
        const sheetName = (sheet.name || 'Sheet').replace(/[\\/?*\[\]:]/g, '_').slice(0, 31);
        const columns = sheet.columns || [];
        const data = sheet.data || [];
        const colHeaders = columns.map(c => typeof c === 'string' ? c : (c.header || c.accessor || ''));

        let rowsXml = '';

        // Title Rows
        rowsXml += `
        <Row ss:Height="28">
            <Cell ss:MergeAcross="${Math.max(0, colHeaders.length - 1)}" ss:StyleID="HeaderTitle">
                <Data ss:Type="String">${escapeXml(systemTitle + ' — ' + (sheet.title || sheetName))}</Data>
            </Cell>
        </Row>
        <Row ss:Height="20">
            <Cell ss:MergeAcross="${Math.max(0, colHeaders.length - 1)}" ss:StyleID="HeaderSubtitle">
                <Data ss:Type="String">${escapeXml(`Generated: ${new Date().toLocaleString()} | Total Records: ${data.length}`)}</Data>
            </Cell>
        </Row>
        <Row ss:Height="12"></Row>
        `;

        // Column Headers Row
        rowsXml += `
        <Row ss:Height="24">
            ${colHeaders.map(h => `<Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
        </Row>
        `;

        // Data Rows
        data.forEach((row, idx) => {
            const isTotal = row.isTotalRow || row.isGrandTotal;
            const isEven = idx % 2 === 0;
            const styleId = isTotal ? 'TableSummary' : (isEven ? 'TableRowEven' : 'TableRow');

            const cellsXml = columns.map(c => {
                const rawVal = extractCellText(c, row, idx);
                const isNumeric = rawVal !== '' && !isNaN(rawVal) && !rawVal.includes('-') && !rawVal.startsWith('0') && rawVal.length < 12;
                return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${isNumeric ? 'Number' : 'String'}">${escapeXml(rawVal)}</Data></Cell>`;
            }).join('');

            rowsXml += `
            <Row ss:Height="20">
                ${cellsXml}
            </Row>
            `;
        });

        xmlWorksheets += `
        <Worksheet ss:Name="${escapeXml(sheetName)}">
            <Table>
                ${colHeaders.map(() => `<Column ss:AutoFitWidth="1" ss:Width="115"/>`).join('')}
                ${rowsXml}
            </Table>
            <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
                <DisplayGridlines/>
            </WorksheetOptions>
        </Worksheet>
        `;
    });

    const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>SYSTEM MDM</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="HeaderTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#065F46" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderSubtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#D1FAE5" ss:Italic="1"/>
   <Interior ss:Color="#047857" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#059669" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableRow">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="TableRowEven">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableSummary">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#059669"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#059669"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#064E3B" ss:Bold="1"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${xmlWorksheets}
</Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[^A-Za-z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Print-Ready Multi-Page Follow-Up 1 PDF Generator
 * Page 1: Detailed follow-up entries
 * Page 2: Dedicated Executive Summary Page with KPI cards and Performance breakdown
 */
export const exportFollowUp1PDF = (title, columns, data, summary, dateRangeLabel = '', brandName = '') => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const bName = (brandName || '').trim();
    const systemTitle = bName ? (bName.toUpperCase().startsWith('SYSTEM') ? bName.toUpperCase() : `SYSTEM ${bName.toUpperCase()}`) : 'MDM SYSTEM';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up window blocked! Please allow pop-ups for this site to export PDF.');
        return;
    }

    const safeSum = summary || {};
    const totalRecords = safeSum.totalRecords || data.length;
    const totalMessages = safeSum.totalMessages || 0;
    const totalNoResponse = safeSum.totalNoResponse || 0;
    const totalRequested = safeSum.totalRequested || 0;
    const totalReview = safeSum.totalReview || 0;
    const totalFailed = safeSum.totalFailed || 0;
    const totalSuccess = safeSum.totalSuccess || 0;
    const totalCreated = safeSum.totalCreated || 0;
    const successRate = safeSum.successRate || (totalRequested > 0 ? ((totalSuccess / totalRequested) * 100).toFixed(1) : '0.0');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - ${systemTitle}</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 8mm 10mm;
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
                .page {
                    width: 100%;
                    box-sizing: border-box;
                    page-break-after: always;
                }
                .page:last-child {
                    page-break-after: auto;
                }
                .header-brand {
                    border-bottom: 2px solid #059669;
                    padding-bottom: 6px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .header-left h1 {
                    font-size: 16px;
                    color: #065f46;
                    text-transform: uppercase;
                    margin: 0;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                }
                .header-left p {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 2px;
                    margin-bottom: 0;
                }
                .header-right {
                    font-size: 10px;
                    font-weight: 700;
                    color: #065f46;
                    background: #d1fae5;
                    padding: 4px 10px;
                    border-radius: 6px;
                    border: 1px solid #6ee7b7;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 5px 6px;
                    text-align: left;
                }
                th {
                    background-color: #059669 !important;
                    color: white !important;
                    text-transform: uppercase;
                    font-weight: 700;
                    font-size: 8.5px;
                    letter-spacing: 0.3px;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .summary-row {
                    background-color: #d1fae5 !important;
                    font-weight: bold;
                    color: #064e3b;
                }
                .summary-page-title {
                    text-align: center;
                    font-size: 18px;
                    font-weight: 800;
                    color: #065f46;
                    margin-bottom: 4px;
                }
                .summary-page-subtitle {
                    text-align: center;
                    font-size: 11px;
                    color: #64748b;
                    margin-bottom: 16px;
                }
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .kpi-box {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 12px;
                    background: #f8fafc;
                    text-align: center;
                }
                .kpi-box.primary {
                    border-color: #34d399;
                    background: #ecfdf5;
                }
                .kpi-title {
                    font-size: 10px;
                    color: #475569;
                    font-weight: 700;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .kpi-val {
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .signature-section {
                    margin-top: 35px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    text-align: center;
                    font-size: 11px;
                    color: #334155;
                }
                .sig-box {
                    padding-top: 45px;
                    border-top: 1px dashed #94a3b8;
                    margin: 0 20px;
                    font-weight: 700;
                }
                .footer-page {
                    border-top: 1px solid #cbd5e1;
                    padding-top: 5px;
                    margin-top: 12px;
                    font-size: 8px;
                    color: #64748b;
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                }
                @media screen {
                    body { padding: 20px; background: #f1f5f9; }
                    .page {
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
            <!-- PAGE 1: DETAILED LIST -->
            <div class="page">
                <div class="header-brand">
                    <div class="header-left">
                        <h1>${systemTitle} — Follow Up 1 Detailed Report</h1>
                        <p>Date Range: ${dateRangeLabel || 'All'} &bull; Generated: ${new Date().toLocaleString()}</p>
                    </div>
                    <div class="header-right">
                        Total Records: ${data.length}
                    </div>
                </div>
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
                <div class="footer-page">
                    <span>Page 1: Detailed Records List &bull; ${systemTitle}</span>
                    <span>Total Items: ${data.length}</span>
                </div>
            </div>

            <!-- PAGE 2: TOTAL SUMMARY OVERVIEW TABLE -->
            <div class="page">
                <div class="header-brand">
                    <div class="header-left">
                        <h1>${systemTitle} — Follow Up 1 Summary Overview</h1>
                        <p>Aggregated KPI Totals &bull; Date Range: ${dateRangeLabel || 'All'}</p>
                    </div>
                    <div class="header-right">
                        Summary Page (ទំព័រសរុប)
                    </div>
                </div>

                <div class="summary-page-title">របាយការណ៍សង្ខេប និងតារាងសរុប Follow up 1</div>
                <div class="summary-page-subtitle">Range: ${dateRangeLabel || 'All'} | Generated: ${new Date().toLocaleString()}</div>

                <div class="kpi-grid">
                    <div class="kpi-box">
                        <div class="kpi-title">កំណត់ត្រាសរុប (Total Entries)</div>
                        <div class="kpi-val">${totalRecords.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">Message សរុប (Total Messages)</div>
                        <div class="kpi-val" style="color: #2563eb;">${totalMessages.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">មិនឆ្លើយតប (No Response)</div>
                        <div class="kpi-val" style="color: #475569;">${totalNoResponse.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">បានស្នើរ (Requested)</div>
                        <div class="kpi-val" style="color: #d97706;">${totalRequested.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">កំពុងពិនិត្យ (In Review)</div>
                        <div class="kpi-val" style="color: #4f46e5;">${totalReview.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-title">បរាជ័យ (Failed)</div>
                        <div class="kpi-val" style="color: #dc2626;">${totalFailed.toLocaleString()}</div>
                    </div>
                    <div class="kpi-box primary">
                        <div class="kpi-title">ជោគជ័យ (Success)</div>
                        <div class="kpi-val" style="color: #059669;">${totalSuccess.toLocaleString()}</div>
                    </div>
                </div>

                <div style="margin-top: 15px;">
                    <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #065f46;">📊 តារាងសង្ខេបសូចនាករប្រតិបត្តិការ (KPI Performance Breakdown):</div>
                    <table>
                        <thead>
                            <tr>
                                <th>សូចនាករ (Metric)</th>
                                <th style="text-align: center;">ចំនួនសរុប (Total Count)</th>
                                <th style="text-align: center;">ភាគរយ / អត្រា (Percentage / Rate)</th>
                                <th>ការពិពណ៌នា (Description)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>1. Message សាកសួរ សរុប</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #2563eb;">${totalMessages.toLocaleString()}</td>
                                <td style="text-align: center;">100%</td>
                                <td>ចំនួន Message ផ្ញើទៅកាន់អតិថិជនសរុប</td>
                            </tr>
                            <tr>
                                <td><strong>2. អតិថិជនមិនឆ្លើយតប</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #475569;">${totalNoResponse.toLocaleString()}</td>
                                <td style="text-align: center;">${totalMessages > 0 ? ((totalNoResponse / totalMessages) * 100).toFixed(1) : 0}%</td>
                                <td>អតិថិជនមិនបាន Reply Message</td>
                            </tr>
                            <tr>
                                <td><strong>3. អតិថិជនបានស្នើ</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #d97706;">${totalRequested.toLocaleString()}</td>
                                <td style="text-align: center;">${totalMessages > 0 ? ((totalRequested / totalMessages) * 100).toFixed(1) : 0}%</td>
                                <td>អតិថិជនឆ្លើយតប និងស្នើសុំព័ត៌មានកុងត្រា</td>
                            </tr>
                            <tr>
                                <td><strong>4. កំពុងពិនិត្យ / Review</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #4f46e5;">${totalReview.toLocaleString()}</td>
                                <td style="text-align: center;">${totalRequested > 0 ? ((totalReview / totalRequested) * 100).toFixed(1) : 0}%</td>
                                <td>អតិថិជនស្ថិតក្នុងដំណាក់កាលពិនិត្យឯកសារ</td>
                            </tr>
                            <tr>
                                <td><strong>5. បរាជ័យ / Failed</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #dc2626;">${totalFailed.toLocaleString()}</td>
                                <td style="text-align: center;">${totalRequested > 0 ? ((totalFailed / totalRequested) * 100).toFixed(1) : 0}%</td>
                                <td>អតិថិជនមិនត្រូវតាមលក្ខខណ្ឌ ឬបដិសេធ</td>
                            </tr>
                            <tr class="summary-row">
                                <td><strong>6. ជោគជ័យ / Success (Success Rate)</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #059669;">${totalSuccess.toLocaleString()}</td>
                                <td style="text-align: center; font-weight: bold; color: #059669;">${successRate}%</td>
                                <td>អតិថិជនជោគជ័យក្នុងការស្នើបញ្ចាំ</td>
                            </tr>
                            <tr>
                                <td><strong>7. បានបង្កើតកុងត្រា (Created)</strong></td>
                                <td style="text-align: center; font-weight: bold; color: #7c3aed;">${totalCreated.toLocaleString()}</td>
                                <td style="text-align: center;">${totalSuccess > 0 ? ((totalCreated / totalSuccess) * 100).toFixed(1) : 0}%</td>
                                <td>កុងត្រាត្រូវបានបង្កើតចូលប្រព័ន្ធរួចរាល់</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="signature-section">
                    <div>
                        <div class="sig-box">អ្នករៀបចំ (Prepared By)</div>
                    </div>
                    <div>
                        <div class="sig-box">អ្នកត្រួតពិនិត្យ (Verified By)</div>
                    </div>
                    <div>
                        <div class="sig-box">ប្រធានសាខា (Approved By)</div>
                    </div>
                </div>

                <div class="footer-page">
                    <span>Page 2: Executive Summary & Performance Breakdown &bull; ${systemTitle}</span>
                    <span>Report Verified & Ready</span>
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

