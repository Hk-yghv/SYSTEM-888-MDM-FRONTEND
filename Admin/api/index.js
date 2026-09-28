// Vercel Serverless API Multi-Backend Failover Gateway for SYSTEM MDM
// React Frontend -> Vercel Serverless API Proxy -> Auto Failover (3 APIs) with x-system-api-key -> 888 MDM API

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '15mb',
        },
    },
};

export default async function handler(req, res) {
    // 1. CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-system-api-key, X-Partner-API-Key, x-partner-api-key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. High-Availability Multi-API Pool (Checks Server Environment Variables or defaults to 3 Render Backends)
    const rawPool = [
        process.env.MDM_API_URL,
        process.env.MDM_API_URL1,
        process.env.MDM_API_URL2,
        process.env.MDM_API_URL3,
        process.env.BACKEND_API_URL,
        process.env.VITE_API_BACKEND,
        process.env.VITE_API_BACKEND1,
        process.env.VITE_API_BACKEND2,
        process.env.VITE_API_BACKEND3,
    ].filter(Boolean).map(url => url.replace(/\/$/, ''));

    const API_POOL = rawPool.length > 0 ? Array.from(new Set(rawPool)) : [
        'https://system-mdm.onrender.com/api',
        'https://system-mdm-1-nok5.onrender.com/api',
        'https://system-mdm-1.onrender.com/api',
        'https://system-mdm-2.onrender.com/api'
    ];

    // 3. Secret SYSTEM_API_KEY (Stored safely on Vercel Server - Never exposed to Client Browser)
    const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || process.env.MDM_API_KEY || 'sys-mdm@hkayonghouv-fdasdlfjri98chbLI*Y0&*T(';
    const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';

    // 4. Extract Path & Query accurately from req.url
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

    // 5. ── PROXY-LEVEL AUTH GATE ──
    // Whitelist of public paths that do NOT require a JWT token at proxy level
    // NOTE: Backend still enforces its own auth for sensitive paths
    const PUBLIC_PATH_PREFIXES = [
        'auth/login',
        'auth/verify-otp',
        'auth/logout',
        'auth/heartbeat',
        'health',
        'history/report-schedule',
        'calculate-schedules/stream',
        'users/status-check',
        'docs',
        'api-docs'
    ];

    const isPublicPath = PUBLIC_PATH_PREFIXES.some(p =>
        cleanPath === p ||
        cleanPath.startsWith(p + '/') ||
        cleanPath.startsWith(p + '?')
    );

    if (!isPublicPath) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const partnerKey = req.headers['x-partner-api-key'];
        const systemKey = req.headers['x-system-api-key'];
        const acceptHeader = (req.headers['accept'] || '').toLowerCase();

        // Block browser navigation immediately at proxy level
        // Browsers send: text/html + xhtml+xml in Accept header
        // Programmatic tools (curl, Python, Node, PHP) do NOT
        const isBrowserNavigation = (
            acceptHeader.includes('text/html') &&
            acceptHeader.includes('application/xhtml+xml') &&
            !token && !partnerKey && !systemKey
        );

        if (isBrowserNavigation) {
            return res.status(401).json({
                error: 'Security Protection: Direct browser access to this API is not permitted.'
            });
        }

        // For JWT token requests: verify at proxy level before forwarding
        if (token) {
            try {
                const parts = token.split('.');
                if (parts.length !== 3) throw new Error('Malformed token');
                const [headerB64, payloadB64, signatureB64] = parts;

                const enc = new TextEncoder();
                const keyData = enc.encode(JWT_SECRET);
                const cryptoKey = await crypto.subtle.importKey(
                    'raw', keyData,
                    { name: 'HMAC', hash: 'SHA-256' },
                    false, ['verify']
                );

                const dataToVerify = enc.encode(`${headerB64}.${payloadB64}`);
                const b64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
                const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
                const sigBuffer = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

                const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBuffer, dataToVerify);
                if (!valid) throw new Error('Invalid signature');

                const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payloadB64.length % 4) % 4));
                const payload = JSON.parse(payloadJson);
                if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
                    return res.status(401).json({ error: 'Security Protection: Token has expired. Please log in again.' });
                }
            } catch {
                return res.status(403).json({ error: 'Security Protection: Invalid or tampered token. Access denied.' });
            }
        }
        // Partner key requests & other programmatic requests → forwarded to backend for validation
    }

    // 6. Prepare Forward Headers with Secret x-system-api-key (only injected AFTER auth passes)
    const forwardHeaders = {
        'x-system-api-key': SYSTEM_API_KEY,
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
    };

    if (req.headers['authorization']) {
        forwardHeaders['authorization'] = req.headers['authorization'];
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

    let lastError = null;
    let missingCalendarRoute = false;

    // 7. Real-Time Failover Loop across all 3 Backend Servers
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
        error: 'High-Availability Gateway Error: All 3 MDM API backend servers are currently unreachable.',
        details: lastError?.message || 'Server timeout or network failure'
    });
}
