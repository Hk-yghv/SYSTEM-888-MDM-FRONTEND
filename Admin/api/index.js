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
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-system-api-key'
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
        'https://system-mdm-1.onrender.com/api',
        'https://system-mdm-2.onrender.com/api'
    ];

    // 3. Secret SYSTEM_API_KEY (Stored safely on Server - Never exposed to Client Browser)
    const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || process.env.MDM_API_KEY || 'sys-mdm@hkayonghouv-fdasdlfjri98chbLI*Y0&*T(';

    // 4. Extract Path & Query accurately from req.url
    let rawUrl = req.url || '';
    if (rawUrl.startsWith('/api')) {
        rawUrl = rawUrl.substring(4);
    }
    const [pathPart, queryPart] = rawUrl.split('?');
    const cleanPath = (pathPart || '').replace(/^\/+/, '');
    const queryString = queryPart ? `?${queryPart}` : '';

    // 5. Prepare Forward Headers with Secret x-system-api-key
    const forwardHeaders = {
        'x-system-api-key': SYSTEM_API_KEY,
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
    };

    if (req.headers['authorization']) {
        forwardHeaders['authorization'] = req.headers['authorization'];
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

    // If all servers in pool fail
    return res.status(502).json({
        error: 'High-Availability Gateway Error: All 3 MDM API backend servers are currently unreachable.',
        details: lastError?.message || 'Server timeout or network failure'
    });
}
