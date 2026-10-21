// Vercel Serverless API Multi-Backend Failover Gateway for SYSTEM MDM
// React Frontend -> Vercel Serverless API Proxy -> Auto Failover -> 888 MDM API

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '15mb',
        },
    },
};

const JWT_SECRET = process.env.JWT_SECRET;

const verifySessionToken = async (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (header.alg !== 'HS256' || !payload.username || !payload.userId) return false;
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp !== 'number' || payload.exp <= now) return false;
        if (typeof payload.nbf === 'number' && payload.nbf > now) return false;

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        return await crypto.subtle.verify(
            'HMAC',
            key,
            Buffer.from(parts[2], 'base64url'),
            new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
        );
    } catch {
        return false;
    }
};

const isPublicRequest = (method, path) => (
    (method === 'POST' && ['auth/login', 'auth/verify-otp', 'auth/qr-login'].includes(path)) ||
    (method === 'GET' && (
        path === 'health' ||
        /^contracts\/customer-info\/[^/]+$/.test(path)
    ))
);

export default async function handler(req, res) {
    // 1. CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin && origin !== '*');
    const requestOrigin = req.headers.origin;
    const requestHost = req.headers['x-forwarded-host'] || req.headers.host;
    const sameHostOrigins = requestHost ? [`https://${requestHost}`, `http://${requestHost}`] : [];
    const defaultAllowedHosts = ['.houv.online', '.hou.online'];
    const isAllowedCloudflareHost = (origin) => {
        try {
            const hostname = new URL(origin).hostname.toLowerCase();
            return defaultAllowedHosts.some(suffix => hostname === suffix.replace(/^\./, '') || hostname.endsWith(suffix));
        } catch {
            return false;
        }
    };
    if (requestOrigin && (configuredOrigins.includes(requestOrigin) || sameHostOrigins.includes(requestOrigin) || isAllowedCloudflareHost(requestOrigin))) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Partner-API-Key, x-partner-api-key, x-username, X-Username'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const sessionCookie = (req.headers.cookie || '')
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('mdm_session='));
    const sessionCookieToken = sessionCookie ? sessionCookie.slice('mdm_session='.length) : null;

    // 2. High-Availability Multi-API Pool (four named URLs take precedence)
    const configuredPool = [
        process.env.MDM_API_URL_1,
        process.env.MDM_API_URL_2,
        process.env.MDM_API_URL_3,
        process.env.MDM_API_URL_4,
    ].filter(Boolean);
    const legacyPool = configuredPool.length > 0 ? [] : [
        process.env.MDM_API_URL,
        process.env.MDM_API_URL1,
        process.env.MDM_API_URL2,
        process.env.MDM_API_URL3,
        process.env.BACKEND_API_URL,
        process.env.VITE_API_BACKEND,
        process.env.VITE_API_BACKEND1,
        process.env.VITE_API_BACKEND2,
        process.env.VITE_API_BACKEND3,
    ].filter(Boolean);
    const rawPool = [...configuredPool, ...legacyPool].map(url => url.replace(/\/$/, ''));

    const API_POOL = rawPool.length > 0 ? Array.from(new Set(rawPool)) : [
        'https://system-mdm.onrender.com/api',
        'https://system-mdm-1-nok5.onrender.com/api',
        'https://system-mdm-1.onrender.com/api',
        'https://system-mdm-2.onrender.com/api'
    ];

    // 3. Extract Path & Query accurately from req.url
    let rawUrl = req.url || '';
    if (rawUrl.startsWith('/api')) {
        rawUrl = rawUrl.substring(4);
    }
    const [pathPart, queryPart] = rawUrl.split('?');
    const cleanPath = (pathPart || '').replace(/^\/+/, '');
    const queryString = queryPart ? `?${queryPart}` : '';

    if (['audit-logs', 'system-logs'].some(path => cleanPath === path || cleanPath.startsWith(`${path}/`))) {
        return res.status(410).json({ error: 'System log endpoints have been retired.' });
    }

    // 5. Require a valid user session or a backend-validated partner key before proxying.
    const normalizedPath = cleanPath.replace(/\/+$/, '');
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
    const token = bearerToken || sessionCookieToken;
    const partnerKey = req.headers['x-partner-api-key'];

    if (req.headers['x-system-api-key']) {
        return res.status(403).json({ error: 'System API keys cannot be used through the public proxy.' });
    }

    if (!isPublicRequest(req.method, normalizedPath) && !partnerKey) {
        if (!token) {
            return res.status(401).json({ error: 'Authentication required. Please sign in to access this API.' });
        }
        if (!JWT_SECRET) {
            console.error('JWT_SECRET is not configured for the API proxy.');
            return res.status(503).json({ error: 'API authentication is not configured securely.' });
        }
        if (!(await verifySessionToken(token))) {
            return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
        }
    }

    // 6. Forward only caller credentials; never grant the proxy's privileged system identity.
    const forwardHeaders = {
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https'
    };

    if (req.headers['authorization']) {
        forwardHeaders['authorization'] = req.headers['authorization'];
    }
    if (sessionCookie) {
        forwardHeaders['cookie'] = sessionCookie;
    }
    if (req.headers['x-partner-api-key']) {
        forwardHeaders['x-partner-api-key'] = req.headers['x-partner-api-key'];
    }
    if (req.headers['content-type']) {
        forwardHeaders['content-type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
        forwardHeaders['accept'] = req.headers['accept'];
    }
    if (req.headers['x-username']) {
        forwardHeaders['x-username'] = req.headers['x-username'];
    }

    let lastError = null;
    let missingCalendarRoute = false;

    // 7. Real-Time Failover Loop across all configured backend servers
    for (let i = 0; i < API_POOL.length; i++) {
        const backendBase = API_POOL[i];
        const targetUrl = `${backendBase}/${cleanPath}${queryString}`;

        try {
            const fetchOptions = {
                method: req.method,
                headers: forwardHeaders,
                signal: AbortSignal.timeout(12000) // 12 seconds failover timeout per backend
            };

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                if (typeof req.body === 'object') {
                    fetchOptions.body = JSON.stringify(req.body);
                    if (!forwardHeaders['content-type']) {
                        forwardHeaders['content-type'] = 'application/json';
                    }
                } else if (req.body) {
                    fetchOptions.body = req.body;
                }
            }

            const backendRes = await fetch(targetUrl, fetchOptions);

            // If Render instance is sleeping/down/rate-limited (502, 503, 504), failover to next backend server
            if (backendRes.status === 502 || backendRes.status === 503 || backendRes.status === 504) {
                continue;
            }

            if (backendRes.status === 404 && (cleanPath === 'calendar-events' || cleanPath.startsWith('calendar-events/'))) {
                missingCalendarRoute = true;
                continue;
            }

            // Forward response headers
            const contentType = backendRes.headers.get('content-type');
            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }
            const setCookies = typeof backendRes.headers.getSetCookie === 'function'
                ? backendRes.headers.getSetCookie()
                : [backendRes.headers.get('set-cookie')].filter(Boolean);
            if (setCookies.length > 0) {
                res.setHeader('Set-Cookie', setCookies);
            }

            const arrayBuffer = await backendRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            return res.status(backendRes.status).send(buffer);
        } catch (err) {
            lastError = err;
        }
    }

    if (missingCalendarRoute) {
        return res.status(404).json({ error: 'Calendar API is not deployed on any configured backend.' });
    }

    // If all servers in pool fail
    return res.status(502).json({
        error: `High-Availability Gateway Error: All ${API_POOL.length} configured MDM API backends are currently unreachable.`,
        details: lastError?.message || 'Server timeout or network failure'
    });
}
