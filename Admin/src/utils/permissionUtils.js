// Ordered list of all primary routes in the application
export const ORDERED_SYSTEM_ROUTES = [
    '/dashboard',
    '/cashflow/monitor',
    '/calendar',
    '/telegram',
    '/customer',
    '/device',
    '/device/enrolment',
    '/contract/application',
    '/contract/activated',
    '/contract/check',
    '/contract/redeem',
    '/contract/comments',
    '/contract/blacklist',
    '/calculate/schedule-1',
    '/calculate/schedule-2',
    '/installment/schedule',
    '/installment/pad',
    '/installment/history',
    '/installment/overdue',
    '/installment/due-today',
    '/installment/unpaid-yesterday',
    '/installment/due-in-3-days',
    '/installment/overdue-3-days',
    '/installment/overdue-7-days',
    '/installment/paymentHistory',
    '/installment/cash-out',
    '/installment/cash-in',
    '/lostphone/actions',
    '/lostphone/lockphone',
    '/lostphone/unlockphone',
    '/wallpaper/actions',
    '/wallpaper/lockphone',
    '/wallpaper/unlockphone',
    '/report/all-customers',
    '/report/all',
    '/report/activated',
    '/report/redeem',
    '/report/lock-phone',
    '/report/set-wallpaper',
    '/report/installment',
    '/report/follow-up',
    '/report/follow-up-4',
    '/history/login-history',
    '/history/device-history',
    '/follow-up/follow-up-1',
    '/follow-up/follow-up-2',
    '/follow-up/follow-up-3',
    '/follow-up/follow-up-4',
    '/salary',
    '/all-picture',
    '/save-url',
    '/audit/telegram',
    '/audit/telegram/report',
    '/print/id-card',
    '/help-support',
    '/settings/control-support-help',
    '/settings/all-account',
    '/settings/control-system',
    '/profile'
];

/**
 * Check if a user object has permission for a specific page & action
 */
export const checkUserPermission = (user, pagePath, action = 'read') => {
    if (!user) return false;
    // Master Admin has full access to all routes
    if (user.username === '@hakyonghouv' || user.username === 'hakyonghouv' || user.isImmutable || user.role === 'Administrator') {
        return true;
    }
    // Profile is universally accessible
    if (pagePath === '/profile' || pagePath === '/settings/phone-app') return true;

    if (!user.permissions) return false;

    const pagePerms = user.permissions[pagePath] || 
        (user.permissions instanceof Map ? user.permissions.get(pagePath) : user.permissions.get?.(pagePath));
        
    if (!pagePerms) return false;
    return !!pagePerms[action];
};

/**
 * Resolve the first allowed route for a user in sequential system order.
 * If user has read access to /dashboard, it returns /dashboard.
 * Otherwise, it scans down the routes and returns the first permitted page.
 */
export const getFirstAllowedRoute = (user, hasPermissionFn) => {
    if (!user) return '/signin';

    if (user.role?.toLowerCase() === 'salary') {
        return '/salary';
    }

    const checkFn = typeof hasPermissionFn === 'function' 
        ? hasPermissionFn 
        : (path, action = 'read') => checkUserPermission(user, path, action);

    for (const route of ORDERED_SYSTEM_ROUTES) {
        if (checkFn(route, 'read')) {
            return route;
        }
    }

    return '/profile';
};

/**
 * Map of Alert Category keys to their required page permissions
 */
export const ALERT_CATEGORY_ROUTES = {
    overdue: '/installment/overdue',
    dueToday: '/installment/due-today',
    dueIn1Day: '/installment/schedule',
    dueIn3Days: '/installment/due-in-3-days',
    overdue3Days: '/installment/overdue-3-days',
    overdue7Days: '/installment/overdue-7-days',
    followUp2Review: '/follow-up/follow-up-2',
    others: '/history/device-history'
};

/**
 * Check if user has permission to view at least one alert category
 */
export const hasAnyAlertPermission = (user, hasPermissionFn) => {
    if (!user) return false;
    if (user.role?.toLowerCase() === 'salary') return false;
    if (user.username === '@hakyonghouv' || user.username === 'hakyonghouv' || user.isImmutable || user.role === 'Administrator') return true;

    const checkFn = typeof hasPermissionFn === 'function' 
        ? hasPermissionFn 
        : (path, action = 'read') => checkUserPermission(user, path, action);

    return Object.values(ALERT_CATEGORY_ROUTES).some(route => checkFn(route, 'read'));
};
