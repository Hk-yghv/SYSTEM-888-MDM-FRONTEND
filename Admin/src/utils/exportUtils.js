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

export const exportToPDF = (title, columns, data) => {
    if (!data || !data.length) {
        alert('No data available to export');
        return;
    }

    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - SYSTEM MDM Report</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #111; }
                h1 { font-size: 20px; color: #4f46e5; text-transform: uppercase; margin-bottom: 5px; }
                p { font-size: 12px; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background-color: #4f46e5; color: white; text-transform: uppercase; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .footer { margin-top: 30px; font-size: 10px; text-align: right; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p>Generated on: ${new Date().toLocaleString()} | SYSTEM MDM Security Protocol</p>
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
            <div class="footer">Confidential System MDM Report &bull; Printed by Administrator</div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
