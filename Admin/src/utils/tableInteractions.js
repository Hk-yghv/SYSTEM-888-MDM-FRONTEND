const ACTION_HEADER_PATTERN = /^(actions?(?:\s*\([^)]*\))?|សកម្មភាព(?:\s*\(actions?\))?)$/i;
const EDGE_THRESHOLD = 85;
const MAX_EDGE_SHRINK = 0.16;

const getOpaqueBackground = (element) => {
    let current = element;
    while (current && current !== document.documentElement) {
        const color = window.getComputedStyle(current).backgroundColor;
        const isTransparent = color === 'transparent' ||
            /^rgba\([^)]*,\s*0(?:\.0+)?\)$/i.test(color) ||
            /^rgb\([^)]*\/\s*0(?:%|\.0+)?\)$/i.test(color);
        if (!isTransparent) return color;
        current = current.parentElement;
    }
    return '#fff';
};

const getVerticalScrollContainer = (element) => {
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
        const style = window.getComputedStyle(ancestor);
        if (
            /(auto|scroll|overlay)/.test(style.overflowY) &&
            ancestor.scrollHeight - ancestor.clientHeight > 4
        ) {
            return ancestor;
        }
        ancestor = ancestor.parentElement;
    }
    return window;
};

const updateRowScale = (row, scrollContainer) => {
    const rowRect = row.getBoundingClientRect();
    const containerRect = scrollContainer === window
        ? { top: 0, height: window.innerHeight }
        : scrollContainer.getBoundingClientRect();
    const scrollTop = scrollContainer === window
        ? window.scrollY
        : scrollContainer.scrollTop;
    const scrollHeight = scrollContainer === window
        ? document.documentElement.scrollHeight
        : scrollContainer.scrollHeight;
    const clientHeight = containerRect.height;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const topProgress = Math.min(1, Math.max(0, scrollTop / 70));
    const bottomProgress = Math.min(1, Math.max(0, (maxScroll - scrollTop) / 70));
    const rowCenter = rowRect.top + rowRect.height / 2 - containerRect.top;

    let shrink = 0;
    if (rowCenter < EDGE_THRESHOLD && topProgress > 0) {
        shrink = (1 - Math.max(0, rowCenter / EDGE_THRESHOLD)) * topProgress * MAX_EDGE_SHRINK;
    } else if (rowCenter > clientHeight - EDGE_THRESHOLD && bottomProgress > 0) {
        const distanceFromBottom = clientHeight - rowCenter;
        shrink = (1 - Math.max(0, distanceFromBottom / EDGE_THRESHOLD)) * bottomProgress * MAX_EDGE_SHRINK;
    }

    row.style.setProperty('--table-scroll-scale', (1 - shrink).toFixed(3));
    row.style.setProperty('--table-scroll-opacity', (1 - shrink * 1.4).toFixed(3));
};

export const installTableInteractions = () => {
    let frameId = 0;

    const prepareTables = () => {
        document.querySelectorAll('table').forEach(table => {
            const headers = Array.from(table.querySelectorAll(':scope > thead > tr > th'));
            const actionIndex = headers.reduce((lastIndex, header, index) => (
                ACTION_HEADER_PATTERN.test(header.textContent.replace(/\s+/g, ' ').trim()) ? index : lastIndex
            ), -1);
            if (actionIndex < 0) {
                table.classList.remove('table-with-sticky-actions');
                table.querySelectorAll(':scope > thead tr > .table-action-cell, :scope > tbody tr > .table-action-cell, :scope > tfoot tr > .table-action-cell')
                    .forEach(cell => {
                        cell.classList.remove('table-action-cell');
                        cell.style.removeProperty('--table-action-background');
                    });
                return;
            }

            table.classList.add('table-with-sticky-actions');
            const currentActionCells = new Set();
            table.querySelectorAll(':scope > thead tr, :scope > tbody tr, :scope > tfoot tr').forEach(row => {
                const cell = row.children[actionIndex];
                if (cell?.matches('th, td')) {
                    const background = getOpaqueBackground(cell.tagName === 'TH' ? cell : cell.parentElement);
                    if (cell.style.getPropertyValue('--table-action-background') !== background) {
                        cell.style.setProperty('--table-action-background', background);
                    }
                    cell.classList.add('table-action-cell');
                    currentActionCells.add(cell);
                }
            });
            table.querySelectorAll(':scope > thead tr > .table-action-cell, :scope > tbody tr > .table-action-cell, :scope > tfoot tr > .table-action-cell')
                .forEach(cell => {
                    if (!currentActionCells.has(cell)) {
                        cell.classList.remove('table-action-cell');
                        cell.style.removeProperty('--table-action-background');
                    }
                });
        });
    };

    const updateRows = () => {
        frameId = 0;
        prepareTables();
        document.querySelectorAll('table tbody tr').forEach(row => {
            row.classList.add('table-scroll-row');
            updateRowScale(row, getVerticalScrollContainer(row));
        });
    };

    const scheduleUpdate = () => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(updateRows);
    };

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('scroll', scheduleUpdate, true);
    document.addEventListener('pointerover', scheduleUpdate, true);
    document.addEventListener('pointerout', scheduleUpdate, true);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
        observer.disconnect();
        document.removeEventListener('scroll', scheduleUpdate, true);
        document.removeEventListener('pointerover', scheduleUpdate, true);
        document.removeEventListener('pointerout', scheduleUpdate, true);
        window.removeEventListener('scroll', scheduleUpdate);
        window.removeEventListener('resize', scheduleUpdate);
        if (frameId) cancelAnimationFrame(frameId);
        document.querySelectorAll('.table-scroll-row').forEach(row => {
            row.classList.remove('table-scroll-row');
            row.style.removeProperty('--table-scroll-scale');
            row.style.removeProperty('--table-scroll-opacity');
        });
        document.querySelectorAll('.table-with-sticky-actions').forEach(table => {
            table.classList.remove('table-with-sticky-actions');
        });
        document.querySelectorAll('.table-action-cell').forEach(cell => {
            cell.classList.remove('table-action-cell');
            cell.style.removeProperty('--table-action-background');
        });
    };
};
