import React, { useEffect, useRef } from 'react';

const applyTableLabels = (container) => {
    if (!container) return;

    container.querySelectorAll('table').forEach((table) => {
        const headers = Array.from(table.querySelectorAll(':scope > thead > tr:first-child > th'));
        if (headers.length === 0) return;

        table.querySelectorAll(':scope > tbody > tr').forEach((row) => {
            Array.from(row.children).forEach((cell, index) => {
                if (cell.tagName !== 'TD') return;
                const header = headers[index]?.textContent?.replace(/\s+/g, ' ').trim();
                if (header) cell.setAttribute('data-label', header);
            });
        });
    });
};

const MobileResponsiveContent = ({ children, className, ...rest }) => {
    const contentRef = useRef(null);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) return undefined;

        applyTableLabels(container);
        const observer = new MutationObserver(() => applyTableLabels(container));
        observer.observe(container, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return <div ref={contentRef} className={className} {...rest}>{children}</div>;
};

export default MobileResponsiveContent;