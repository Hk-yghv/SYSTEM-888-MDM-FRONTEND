const ACTION_HEADER_PATTERN = /^(actions?(?:\s*\([^)]*\))?|សកម្មភាព(?:\s*\(actions?\))?)$/i;

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

const findVerticalScrollContainer = (table) => {
    let current = table.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY || style.overflow;
        if (
            /(auto|scroll|overlay)/.test(overflowY) &&
            current.scrollHeight > current.clientHeight + 4
        ) {
            return current;
        }
        current = current.parentElement;
    }

    const mobileContent = document.querySelector('.mobile-content-area');
    if (mobileContent && mobileContent.scrollHeight > mobileContent.clientHeight + 4) {
        return mobileContent;
    }

    return window;
};

const prepareStickyActions = (table) => {
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
};

const updateTableAnimation = (table) => {
    const allRows = table.querySelectorAll(':scope > tbody > tr');
    if (!allRows.length) return;

    prepareStickyActions(table);

    // Filter out rows that are placeholders (loading spinner, "no data" with colspan >= 3)
    const validRows = [];
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const firstCell = row.firstElementChild;
        if (firstCell && Number(firstCell.getAttribute('colspan')) >= 3) {
            row.classList.remove('table-scroll-row');
            row.style.removeProperty('--table-scroll-scale');
            row.style.removeProperty('--table-scroll-opacity');
            continue;
        }
        validRows.push(row);
    }

    if (!validRows.length) return;

    const scrollContainer = findVerticalScrollContainer(table);
    const isWin = scrollContainer === window;
    const containerRect = isWin
        ? { top: 0, height: window.innerHeight }
        : scrollContainer.getBoundingClientRect();

    const scrollTop = isWin ? window.scrollY : scrollContainer.scrollTop;
    const scrollHeight = isWin ? document.documentElement.scrollHeight : scrollContainer.scrollHeight;
    const clientHeight = containerRect.height;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);

    // If container cannot scroll or content fully fits, all items remain normal 1.0
    if (maxScroll <= 4) {
        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            row.classList.add('table-scroll-row');
            row.style.setProperty('--table-scroll-scale', '1');
            row.style.setProperty('--table-scroll-opacity', '1');
        }
        return;
    }

    // Top progress: 0 when at very top (scrollTop === 0), ramps to 1 as user scrolls down by 70px
    // When at the very top, top items DO NOT shrink!
    const topProgress = Math.min(1, Math.max(0, scrollTop / 70));

    // Bottom progress: 0 when at very bottom, ramps to 1 when scrolled 70px above bottom
    // When at the very bottom, bottom items DO NOT shrink!
    const remainingScroll = Math.max(0, maxScroll - scrollTop);
    const bottomProgress = Math.min(1, Math.max(0, remainingScroll / 70));

    // Boundary threshold from top/bottom where shrinking occurs (smooth curve matching LeftMenu)
    const edgeThreshold = Math.min(140, Math.max(90, Math.round(clientHeight * 0.22)));
    const maxShrink = 0.14; // up to 14% shrink (scale 0.86 to 1.00)

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        row.classList.add('table-scroll-row');
        const rowRect = row.getBoundingClientRect();
        const rowCenter = rowRect.top + rowRect.height / 2 - containerRect.top;

        let shrink = 0;

        // Near top edge (only shrinks if user has scrolled away from top)
        if (rowCenter < edgeThreshold && topProgress > 0) {
            const factor = Math.max(0, rowCenter / edgeThreshold); // 0 at top, 1 at boundary
            shrink = (1 - factor) * topProgress * maxShrink;
        }
        // Near bottom edge (only shrinks if there is more content to scroll below)
        else if (rowCenter > clientHeight - edgeThreshold && bottomProgress > 0) {
            const distFromBottom = clientHeight - rowCenter;
            const factor = Math.max(0, distFromBottom / edgeThreshold); // 0 at bottom, 1 at boundary
            shrink = (1 - factor) * bottomProgress * maxShrink;
        }

        const scale = (1 - shrink).toFixed(3);
        const opacity = (1 - shrink * 1.5).toFixed(3);

        row.style.setProperty('--table-scroll-scale', scale);
        row.style.setProperty('--table-scroll-opacity', opacity);
    }
};

export const installTableInteractions = () => {
    let frameId = 0;

    const updateAllTables = () => {
        frameId = 0;
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            updateTableAnimation(table);
        });
    };

    const scheduleUpdate = () => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(updateAllTables);
    };

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen to scroll globally in capture phase to detect any scrolling container
    document.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    scheduleUpdate();

    return () => {
        observer.disconnect();
        document.removeEventListener('scroll', scheduleUpdate, true);
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
