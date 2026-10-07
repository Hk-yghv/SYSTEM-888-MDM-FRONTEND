// High-Availability Multi-API Real-Time Failover & Smart Cache Engine for SYSTEM MDM
const normalizeUrl = (url) => (url ? url.replace(/\/$/, '') : '');

const rawApiPool = import.meta.env.DEV ? [
    import.meta.env.VITE_API_BACKEND,
    import.meta.env.VITE_API_BACKEND1,
    import.meta.env.VITE_API_BACKEND2,
    import.meta.env.VITE_API_BACKEND3,
].map(normalizeUrl).filter(Boolean) : [];

export const API_POOL = rawApiPool.length > 0 ? rawApiPool : import.meta.env.DEV ? [
    '/api',
    'http://localhost:5000/api',
    'http://localhost:5001/api',
    'http://localhost:5002/api'
] : ['/api'];

let activeApiIndex = 0;

export const getActiveApiBase = () => API_POOL[activeApiIndex] || API_POOL[0];
export const getApiPool = () => API_POOL;

// ── Smart API In-Memory & Cache Layer ──
const apiCache = new Map(); // key: relativePath -> { data: string, headers: object, status: number, timestamp: number }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL for GET requests

// Endpoints that should NOT be cached (lightweight polling / realtime status checks / auth verification)
const NON_CACHEABLE_PATHS = [
    '/auth/login',
    '/auth/verify-otp',
    '/auth/session',
    '/auth/logout',
    '/auth/heartbeat',
    '/users/status-check',
    '/phone-app/status',
    '/phone-app/consume-scanned-doc',
    '/history/report-schedule'
];

export const invalidateApiCache = (pathPrefix = '') => {
    if (!pathPrefix) {
        apiCache.clear();
        return;
    }
    let count = 0;
    for (const key of apiCache.keys()) {
        if (key.includes(pathPrefix)) {
            apiCache.delete(key);
            count++;
        }
    }
};

export const smartFetch = async (inputUrlOrPath, options = {}) => {
    let relativePath = typeof inputUrlOrPath === 'string' ? inputUrlOrPath : (inputUrlOrPath?.url || String(inputUrlOrPath));

    // Strip existing API base URL if present
    for (const baseUrl of API_POOL) {
        if (relativePath.startsWith(baseUrl)) {
            relativePath = relativePath.substring(baseUrl.length);
            break;
        }
    }

    if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
    }

    const method = (options.method || 'GET').toUpperCase();
    const bypassCache = options.bypassCache || options.headers?.['x-bypass-cache'] || false;

    // ── If method is mutation (POST, PUT, DELETE, PATCH), invalidate related cache immediately ──
    if (method !== 'GET') {
        const rootCategory = relativePath.split('/')[1] || '';
        invalidateApiCache(rootCategory ? `/${rootCategory}` : '');
    }

    // ── Check Cache for GET Requests ──
    const isCacheableGet = (method === 'GET') && !bypassCache && !NON_CACHEABLE_PATHS.some(p => relativePath.startsWith(p));
    if (isCacheableGet) {
        const cached = apiCache.get(relativePath);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return new Response(cached.data, {
                status: cached.status,
                statusText: 'OK (From SmartCache)',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'X-Smart-Cache': 'HIT',
                    ...(cached.headers || {})
                })
            });
        }
    }

    const startIndex = activeApiIndex;
    let lastError = null;

    for (let i = 0; i < API_POOL.length; i++) {
        const tryIndex = (startIndex + i) % API_POOL.length;
        const currentBase = API_POOL[tryIndex];
        const targetUrl = `${currentBase}${relativePath}`;

        try {
            const sanitizedHeaders = { ...(options.headers || {}) };
            delete sanitizedHeaders['x-system-api-key'];
            delete sanitizedHeaders['X-System-Api-Key'];

            const mergedHeaders = {
                ...sanitizedHeaders
            };

            const requestOptions = {
                ...options,
                credentials: 'include',
                headers: mergedHeaders
            };

            const response = await window._nativeFetch(targetUrl, requestOptions);

            // HTTP 502/503/504 means server down/sleeping/limit reached on Render
            if (response.status === 502 || response.status === 503 || response.status === 504) {
                continue;
            }

            // Successfully reached working backend server!
            if (activeApiIndex !== tryIndex) {
                activeApiIndex = tryIndex;
            }

            // Store successful GET response in Cache Layer
            if (isCacheableGet && response.ok) {
                try {
                    const clonedResponse = response.clone();
                    const textData = await clonedResponse.text();
                    apiCache.set(relativePath, {
                        data: textData,
                        status: response.status,
                        headers: Object.fromEntries(response.headers.entries()),
                        timestamp: Date.now()
                    });
                } catch (cErr) {
                }
            }

            return response;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('All 4 API backend servers are currently unreachable.');
};

// Global Fetch Interceptor Setup
if (!window._nativeFetch) {
    window._nativeFetch = window.fetch;

    window.fetch = async (input, init) => {
        const urlStr = typeof input === 'string' ? input : (input?.url || String(input));

        const isTargetApi = API_POOL.some(b => urlStr.startsWith(b)) ||
            (urlStr.startsWith('/') && !urlStr.startsWith('/assets') && !urlStr.startsWith('/src'));

        if (isTargetApi) {
            return smartFetch(urlStr, init);
        }

        return window._nativeFetch(input, init);
    };
}
