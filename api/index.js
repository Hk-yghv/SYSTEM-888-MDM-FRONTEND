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
    (method === 'GET' && path === 'health')
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
    if (requestOrigin && (configuredOrigins.includes(requestOrigin) || sameHostOrigins.includes(requestOrigin))) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Partner-API-Key, x-partner-api-key, X-API-Key, x-api-key, X-Partner-Key, x-partner-key'
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

    // 2. High-Availability Multi-API Pool from deployment environment variables
    const rawPool = [
        process.env.MDM_API_URL_1,
        process.env.MDM_API_URL_2,
        process.env.MDM_API_URL_3,
        process.env.MDM_API_URL_4,
        process.env.MDM_API_URL,
        process.env.MDM_API_URL1,
        process.env.MDM_API_URL2,
        process.env.MDM_API_URL3,
        process.env.BACKEND_API_URL,
    ].filter(Boolean).map(url => url.replace(/\/$/, ''));

    const API_POOL = Array.from(new Set(rawPool));
    if (API_POOL.length === 0) {
        console.error('No API backends are configured. Set MDM_API_URL or BACKEND_API_URL in the Vercel environment.');
        return res.status(503).json({ error: 'API backend is not configured.' });
    }

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

    // 4.1 Block direct browser URL bar navigation to API endpoints
    const secFetchDest = (req.headers['sec-fetch-dest'] || '').toLowerCase();
    const secFetchMode = (req.headers['sec-fetch-mode'] || '').toLowerCase();
    const acceptHeader = (req.headers['accept'] || '').toLowerCase();
    const isDocOrNavigate = secFetchDest === 'document' || secFetchMode === 'navigate';
    const isHtmlNavigation = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');
    const isDirectBrowserNavigation = isDocOrNavigate || isHtmlNavigation;

    const isExemptBrowserPath = (
        cleanPath === 'docs' ||
        cleanPath === 'api-docs' ||
        cleanPath.startsWith('docs/') ||
        cleanPath.startsWith('api-docs/') ||
        cleanPath.endsWith('/pdf')
    );

    if (isDirectBrowserNavigation && !isExemptBrowserPath) {
        if (acceptHeader.includes('text/html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(403).send(`<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>403 Forbidden - Direct Access Prohibited | SYSTEM MDM</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .box { background: #111827; border: 1px solid #1f2937; border-radius: 18px; padding: 36px 32px; max-width: 500px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
        .icon { width: 64px; height: 64px; margin: 0 auto 16px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; border: 1px solid rgba(239, 68, 68, 0.25); }
        .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
        h1 { font-size: 18px; font-weight: 800; color: #fff; margin: 0 0 10px; }
        p { font-size: 13.5px; color: #9ca3af; line-height: 1.6; margin: 0 0 18px; }
        .footer-note { font-size: 11.5px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 14px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">🛡️</div>
        <div class="badge">Security Protection Active</div>
        <h1>ការចូលមើលទិន្នន័យផ្ទាល់ត្រូវបានហាមឃាត់</h1>
        <p>ប្រព័ន្ធ SYSTEM MDM មិនអនុញ្ញាតឱ្យបើកមើលទិន្នន័យ API ផ្ទាល់នៅលើ Browser URL Bar ឡើយ ដើម្បីការពារសុវត្ថិភាពទិន្នន័យ។ សូមចូលប្រើប្រាស់តាមរយៈផ្ទាំងកម្មវិធី SYSTEM MDM ដោយផ្ទាល់។</p>
        <div class="footer-note">403 Forbidden • Direct Browser Navigation Blocked</div>
    </div>
</body>
</html>`);
        }
        return res.status(403).json({ error: 'Security Protection: Direct browser access to this API is not permitted. Use the SYSTEM MDM application to access this data.' });
    }

    // 5. Require a valid user session or a backend-validated partner key before proxying.
    const normalizedPath = cleanPath.replace(/\/+$/, '');
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
    const partnerKey = req.headers['x-partner-api-key'] ||
        req.headers['x-api-key'] ||
        req.headers['x-partner-key'] ||
        req.query?.partnerKey ||
        req.query?.apiKey ||
        req.query?.partner_key ||
        (bearerToken === 'MDM-PARTNER-2026-EXT-KEY-X9mK3pQrV7wZ' ? bearerToken : null);

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

    // 6. Forward caller credentials without granting the proxy's privileged system identity.
    const forwardHeaders = {
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
    };

    if (req.headers['authorization']) {
        forwardHeaders['authorization'] = req.headers['authorization'];
    }
    if (sessionCookie) {
        forwardHeaders['cookie'] = sessionCookie;
    }
    if (partnerKey) {
        forwardHeaders['x-partner-api-key'] = partnerKey;
    }
    if (req.headers['content-type']) {
        forwardHeaders['content-type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
        forwardHeaders['accept'] = req.headers['accept'];
    }

    let lastError = null;

    // 6. Real-Time Failover Loop across all 3 Backend Servers
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
                console.warn(`[Proxy Failover] Server ${backendBase} returned HTTP ${backendRes.status}. Trying next server...`);
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
            console.warn(`[Proxy Failover Error] Server ${backendBase} unreachable (${err.message}). Trying next...`);
            lastError = err;
        }
    }

    // If all servers in pool fail
    console.error('[Proxy Gateway Fatal]: All API backend servers failed.', lastError);
    return res.status(502).json({
        error: 'High-Availability Gateway Error: All 3 MDM API backend servers are currently unreachable.',
        details: lastError?.message || 'Server timeout or network failure'
    });
}
