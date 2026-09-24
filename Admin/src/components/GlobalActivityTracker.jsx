import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * GlobalActivityTracker:
 * 1. Automatically records every page / screen navigation across the entire app
 * 2. Automatically records every button click, tab switch, export, and interactive action
 */
const GlobalActivityTracker = () => {
    const location = useLocation();
    const { API_BASE, user } = useAuth();
    const lastPageRef = useRef('');
    const lastClickRef = useRef({ target: '', time: 0 });

    // 1. Record Page Navigation / Screen Visits
    useEffect(() => {
        if (!user || !user.username) return;
        const currentPath = location.pathname + (location.search || '');
        if (lastPageRef.current === currentPath) return;
        lastPageRef.current = currentPath;

        const recordPageVisit = async () => {
            try {
                // Get page readable name from pathname
                const pathSegments = location.pathname.split('/').filter(Boolean);
                const pageTitle = pathSegments.length > 0
                    ? pathSegments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' > ')
                    : 'Home Dashboard';

                await fetch(`${API_BASE}/audit-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category: 'Navigation',
                        level: 'Information',
                        action: 'PAGE_VIEW',
                        taskCategory: 'Page Visit',
                        description: `Navigated to screen: ${pageTitle} (${location.pathname})`,
                        username: user.username,
                        name: user.name || '',
                        role: user.role || 'Staff',
                        brand: user.brand || '',
                        path: location.pathname,
                        payload: {
                            fullPath: currentPath,
                            search: location.search || '',
                            pageTitle
                        }
                    })
                });
            } catch {
                // Non-blocking logging
            }
        };

        // Small delay to let page render
        const timer = setTimeout(recordPageVisit, 200);
        return () => clearTimeout(timer);
    }, [location.pathname, location.search, user, API_BASE]);

    // 2. Record All Button Clicks & User Interactions
    useEffect(() => {
        if (!user || !user.username) return;

        const handleGlobalClick = async (e) => {
            try {
                // Find clickable target
                const clickable = e.target.closest(
                    'button, a, input[type="submit"], input[type="button"], [role="button"], [role="tab"], [role="menuitem"], select, .clickable-action'
                );
                if (!clickable) return;

                // Extract button text or description
                let label = (
                    clickable.innerText ||
                    clickable.getAttribute('aria-label') ||
                    clickable.getAttribute('title') ||
                    clickable.getAttribute('placeholder') ||
                    clickable.name ||
                    clickable.id ||
                    clickable.dataset?.action ||
                    ''
                ).trim().replace(/\s+/g, ' ');

                // If empty, try child icons or text
                if (!label && clickable.querySelector('svg, img, span')) {
                    label = clickable.className?.includes('delete') || clickable.className?.includes('trash') || clickable.className?.includes('red')
                        ? 'Delete Button'
                        : clickable.className?.includes('edit')
                        ? 'Edit Button'
                        : clickable.className?.includes('search')
                        ? 'Search Button'
                        : clickable.className?.includes('download') || clickable.className?.includes('export')
                        ? 'Export Button'
                        : clickable.className?.includes('refresh') || clickable.className?.includes('sync')
                        ? 'Refresh Button'
                        : `${clickable.tagName} Action`;
                }

                if (!label) label = `${clickable.tagName} Action`;
                label = label.slice(0, 80);

                // Prevent duplicates within 1.2 seconds for same button
                const clickKey = `${location.pathname}:${clickable.id || label}`;
                const now = Date.now();
                if (lastClickRef.current.target === clickKey && (now - lastClickRef.current.time) < 1200) {
                    return;
                }
                lastClickRef.current = { target: clickKey, time: now };

                const isDeleteAction = label.toLowerCase().includes('delete') ||
                    label.toLowerCase().includes('remove') ||
                    label.includes('លុប') ||
                    clickable.className?.includes('delete') ||
                    clickable.className?.includes('rose') ||
                    clickable.className?.includes('red');

                const isExportAction = label.toLowerCase().includes('export') ||
                    label.toLowerCase().includes('download') ||
                    label.toLowerCase().includes('excel') ||
                    label.includes('ទាញយក') ||
                    label.includes('បញ្ជូន');

                // Send non-blocking log
                fetch(`${API_BASE}/audit-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category: isDeleteAction ? 'Contract' : (isExportAction ? 'System' : 'UserActivity'),
                        level: isDeleteAction ? 'Warning' : 'Information',
                        action: isDeleteAction ? 'DELETE_BUTTON_CLICK' : (isExportAction ? 'EXPORT_ACTION' : 'BUTTON_CLICK'),
                        taskCategory: isDeleteAction ? 'Delete Request' : 'UI Action',
                        description: `User clicked [${label}] on ${location.pathname}`,
                        username: user.username,
                        name: user.name || '',
                        role: user.role || 'Staff',
                        brand: user.brand || '',
                        path: location.pathname,
                        payload: {
                            buttonLabel: label,
                            tagName: clickable.tagName,
                            elementId: clickable.id || '',
                            buttonType: clickable.type || '',
                            href: clickable.getAttribute('href') || '',
                            path: location.pathname
                        }
                    })
                }).catch(() => {});
            } catch {
                // Non-blocking
            }
        };

        window.addEventListener('click', handleGlobalClick, true);
        return () => window.removeEventListener('click', handleGlobalClick, true);
    }, [location.pathname, user, API_BASE]);

    return null;
};

export default GlobalActivityTracker;
