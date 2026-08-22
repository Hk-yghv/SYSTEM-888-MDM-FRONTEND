// Utility helpers for Exporting Data to Excel (CSV) and Printing/Exporting to PDF

export const exportToExcel = (data, filename = 'MDM_Report') => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Header row
    csvRows.push(headers.map(h => `"${('' + h).replace(/"/g, '""')}"`).join(','));

    // Process all data rows continuously without page breaks or artificial Page No column
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header] === null || row[header] === undefined ? '' : row[header];
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToPDF = (title, columns, data, brandName = '') => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const bName = (brandName || '').trim();
    const systemTitle = bName ? (bName.toUpperCase().startsWith('SYSTEM') ? bName.toUpperCase() : `SYSTEM ${bName.toUpperCase()}`) : 'MDM SYSTEM';

    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - ${systemTitle}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm 12mm;
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
                    padding: 10px 0;
                }
                .header-brand {
                    border-bottom: 2px solid #4f46e5;
                    padding-bottom: 8px;
                    margin-bottom: 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .header-left h1 {
                    font-size: 18px;
                    color: #3730a3;
                    text-transform: uppercase;
                    margin: 0;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                }
                .header-left p {
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 4px;
                    margin-bottom: 0;
                }
                .header-right {
                    font-size: 11px;
                    font-weight: 700;
                    color: #4f46e5;
                    background: #eef2ff;
                    padding: 4px 10px;
                    border-radius: 6px;
                    border: 1px solid #c7d2fe;
                }
                .table-container {
                    width: 100%;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
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
                    padding: 8px 10px;
                    text-align: left;
                }
                th {
                    background-color: #4f46e5 !important;
                    color: white !important;
                    text-transform: uppercase;
                    font-weight: 700;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .footer-page {
                    border-top: 1px solid #cbd5e1;
                    padding-top: 8px;
                    margin-top: 14px;
                    font-size: 10px;
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
                        <h1>${systemTitle}</h1>
                        <p>Report: ${title} &bull; Generated: ${new Date().toLocaleString()}</p>
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
                                <tr>
                                    ${columns.map(col => `<td>${col.cell ? col.cell(row, idx) : (row[col.accessor] !== undefined && row[col.accessor] !== null ? row[col.accessor] : '')}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="footer-page">
                    <span>SYSTEM MDM &bull; ${title}</span>
                    <span>Total Records: ${data.length}</span>
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
