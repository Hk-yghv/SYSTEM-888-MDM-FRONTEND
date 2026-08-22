// Utility helpers for Exporting Data to Excel (CSV) and Printing/Exporting to PDF

export const exportToExcel = (data, filename = 'MDM_Report') => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Header row
    csvRows.push(headers.join(','));

    // Data rows
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
                body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #0f172a; background: #fff; }
                .header-brand { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px; }
                h1 { font-size: 20px; color: #3730a3; text-transform: uppercase; margin: 0; font-weight: 800; }
                p { font-size: 11px; color: #64748b; margin-top: 4px; margin-bottom: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                th { background-color: #4f46e5; color: white; text-transform: uppercase; font-weight: 700; }
                tr:nth-child(even) { background-color: #f8fafc; }
            </style>
        </head>
        <body>
            <div class="header-brand">
                <h1>${systemTitle}</h1>
                <p>Report: ${title} &bull; Generated: ${new Date().toLocaleString()}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col.header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map((row, idx) => `
                        <tr>
                            ${columns.map(col => `<td>${col.cell ? col.cell(row, idx) : (row[col.accessor] || '')}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
