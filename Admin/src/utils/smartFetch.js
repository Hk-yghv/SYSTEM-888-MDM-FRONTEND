// High-Availability Multi-API Automatic Real-Time Failover Engine for SYSTEM MDM

const normalizeUrl = (url) => (url ? url.replace(/\/$/, '') : '');

const rawApiPool = [
    import.meta.env.VITE_API_BACKEND,
    import.meta.env.VITE_API_BACKEND1,
    import.meta.env.VITE_API_BACKEND2,
    import.meta.env.VITE_API_BACKEND3,
].map(normalizeUrl).filter(Boolean);

export const API_POOL = rawApiPool.length > 0 ? rawApiPool : [
    'http://localhost:5000/api',
    'http://localhost:5001/api',
    'http://localhost:5002/api',
    'http://localhost:5003/api'
];

let activeApiIndex = 0;

export const getActiveApiBase = () => API_POOL[activeApiIndex] || API_POOL[0];

export const getApiPool = () => API_POOL;

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

    const startIndex = activeApiIndex;
    let lastError = null;

    for (let i = 0; i < API_POOL.length; i++) {
        const tryIndex = (startIndex + i) % API_POOL.length;
        const currentBase = API_POOL[tryIndex];
        const targetUrl = `${currentBase}${relativePath}`;

        try {
            const token = sessionStorage.getItem('mdm_token') || localStorage.getItem('mdm_token');
            const mergedHeaders = {
                'x-system-api-key': 'SYSTEM_MDM_SECURE_AUTH_HEADER_TOKEN_2026',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...(options.headers || {})
            };

            const requestOptions = {
                ...options,
                headers: mergedHeaders
            };

            const response = await window._nativeFetch(targetUrl, requestOptions);

            // HTTP 502/503/504 means server down/sleeping/limit reached on Render
            if (response.status === 502 || response.status === 503 || response.status === 504) {
                console.warn(`[SmartFetch Real-Time Failover] Server ${currentBase} returned HTTP ${response.status}. Retrying on next API...`);
                continue;
            }

            // Successfully reached working backend server!
            if (activeApiIndex !== tryIndex) {
                console.log(`[SmartFetch Real-Time Failover] Promoted active API server to: ${currentBase}`);
                activeApiIndex = tryIndex;
            }

            return response;
        } catch (err) {
            console.warn(`[SmartFetch Real-Time Failover] Connection failed to ${targetUrl}: ${err.message}. Trying next backend...`);
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

    console.log('[SmartFetch] Global Real-Time Multi-API Failover Interceptor active with 4 backend endpoints:', API_POOL);
}
