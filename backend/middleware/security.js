import '../config/loadEnv.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY;
// External Partner API Key — for third-party integrations (access to specific endpoints)
const EXTERNAL_PARTNER_API_KEY = process.env.EXTERNAL_PARTNER_API_KEY || 'MDM-PARTNER-2026-EXT-KEY-X9mK3pQrV7wZ';
const EXTERNAL_PARTNER_API_KEYS = [
    process.env.EXTERNAL_PARTNER_API_KEY,
    'MDM-PARTNER-2026-EXT-KEY-X9mK3pQrV7wZ'
].filter(Boolean);

// Endpoints accessible to external partners with X-Partner-API-Key
const PARTNER_ALLOWED_PATH_PREFIXES = [
    '/api/contracts',
    '/contracts',
    '/api/payments',
    '/payments',
    '/api/calculate-schedules',
    '/calculate-schedules',
    '/api/dashboard',
    '/dashboard',
    '/api/cash-transactions',
    '/api/telegram-audit',
    '/telegram-audit',
    '/api/cashflow-trader',
    '/cashflow-trader',
    '/api/health',
];

const isPenaltyReadPath = (req) => (
    req.path === '/api/cash-transactions' &&
    String(req.query?.type || '').toLowerCase() === 'penalty'
);

const getSessionCookieToken = (cookieHeader = '') => {
    const sessionCookie = cookieHeader
        .split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith('mdm_session='));
    return sessionCookie ? sessionCookie.slice('mdm_session='.length) : null;
};

let telegramBotInstance = null;
export const setSecurityTelegramBot = (bot) => {
    telegramBotInstance = bot;
};

// ── LAYER 1: HTTP Security Headers & Hardening ──
export const securityHeadersMiddleware = (req, res, next) => {
    // Suppress server fingerprinting
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // CSP: Allow styles, fonts, and connections from Cloudflare tunnel domains & CDNs
    res.setHeader('Content-Security-Policy', [
        "default-src 'self' https: http: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://systemmdm.houv.online https://apisystemmdm.houv.online",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://systemmdm.houv.online https://apisystemmdm.houv.online",
        "connect-src 'self' https: http: ws: wss:",
        "worker-src 'self' blob:",
        "media-src 'self' blob: https:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'"
    ].join('; '));
    next();
};

// ── LAYER 2: Bot Scanner & Malicious User-Agent Firewall ──
const HACKER_BOT_USER_AGENTS = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'dirbuster', 'gobuster', 'wpscan',
    'zgrab', 'censys', 'shodan', 'acunetix', 'nessus', 'qualys', 'openvas',
    'havij', 'hydra', 'medusa', 'commix', 'sublist3r', 'amass'
];

export const botFirewallMiddleware = (req, res, next) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

    const isHackerBot = HACKER_BOT_USER_AGENTS.some(botName => ua.includes(botName));
    if (isHackerBot) {
        notifySecurityAlert(`⚠️ <b>HACKER BOT SCANNER BLOCKED</b>\nIP: <code>${clientIp}</code>\nUser-Agent: <code>${req.headers['user-agent']}</code>\nPath: <code>${req.originalUrl}</code>`);
        return res.status(403).json({
            error: 'Security Warning: Automated security scanner / bot traffic blocked by SYSTEM MDM Firewall.'
        });
    }
    next();
};

// ── LAYER 3: Anti-Command Injection & Path Traversal Engine ──
const PATH_TRAVERSAL_REGEX = /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|%2e%2e%5c/i;
const COMMAND_INJECTION_REGEX = /;|&&|\|\||`|\$\([^)]*\)/i;

export const pathAndCommandGuardMiddleware = (req, res, next) => {
    const rawUrl = decodeURIComponent(req.originalUrl || '');
    if (PATH_TRAVERSAL_REGEX.test(rawUrl) || PATH_TRAVERSAL_REGEX.test(req.path)) {
        return res.status(400).json({ error: 'Security Protection: Directory path traversal attack detected and blocked.' });
    }

    const isActivatedDescriptionRoute = /^\/(?:api\/)?contracts\/[^/]+\/activated-description-history(?:\/|$)/.test(req.originalUrl?.split('?')[0] || req.path);
    const checkValue = (val, key = '') => {
        if (typeof val === 'string') {
            if (val.startsWith('data:image/') || val.startsWith('data:application/') || val.startsWith('data:')) {
                return false;
            }
            if (COMMAND_INJECTION_REGEX.test(val) && !(isActivatedDescriptionRoute && ['description', 'status'].includes(key))) {
                return true;
            }
        }
        if (val && typeof val === 'object') {
            return Object.entries(val).some(([childKey, child]) => checkValue(child, childKey));
        }
        return false;
    };

    if (checkValue(req.query) || checkValue(req.body)) {
        return res.status(400).json({ error: 'Security Protection: Command injection pattern blocked by SYSTEM MDM Security engine.' });
    }

    next();
};

// ── LAYER 4: Deep Input Sanitization & Anti-Injection Engine ──
const NOSQL_OPERATOR_REGEX = /^\$|\.(?=[^.]*$)/g;
const MALICIOUS_PAYLOAD_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:|onerror\s*=|onload\s*=|eval\(|document\.cookie/gi;

const isPlainObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
};

export const sanitizeValue = (val, _seen = new WeakSet()) => {
    if (typeof val === 'string') {
        let clean = val.replace(MALICIOUS_PAYLOAD_REGEX, '');
        if (clean.startsWith('$') && (clean.includes('where') || clean.includes('gt') || clean.includes('ne') || clean.includes('regex'))) {
            clean = clean.replace(/^\$/, '_');
        }
        return clean;
    }
    if (val && typeof val === 'object') {
        return sanitizeInput(val, _seen);
    }
    return val;
};

export const sanitizeInput = (obj, _seen = new WeakSet()) => {
    if (!obj || typeof obj !== 'object') return sanitizeValue(obj, _seen);

    if (_seen.has(obj)) return obj;
    _seen.add(obj);

    if (Array.isArray(obj)) return obj.map(item => sanitizeInput(item, _seen));

    if (obj instanceof Map || obj.constructor?.name === 'MongooseMap' || !isPlainObject(obj)) {
        return obj;
    }

    const sanitized = {};
    for (const key of Object.keys(obj)) {
        const cleanKey = key.replace(NOSQL_OPERATOR_REGEX, '');
        sanitized[cleanKey] = sanitizeValue(obj[key], _seen);
    }
    return sanitized;
};

export const preventHPP = (req, res, next) => {
    if (req.query) {
        for (const k in req.query) {
            if (Array.isArray(req.query[k])) {
                req.query[k] = req.query[k][req.query[k].length - 1];
            }
        }
    }
    next();
};

export const sanitizeMiddleware = (req, res, next) => {
    preventHPP(req, res, () => {
        if (req.body) req.body = sanitizeInput(req.body);
        if (req.query) req.query = sanitizeInput(req.query);
        if (req.params) req.params = sanitizeInput(req.params);
        next();
    });
};

// ── LAYER 5: Anti-Replay Attack Protection ──
export const antiReplayMiddleware = (req, res, next) => {
    const clientTimestamp = req.headers['x-request-timestamp'] || req.headers['x-timestamp'];
    if (clientTimestamp) {
        const reqTime = parseInt(clientTimestamp, 10);
        const now = Date.now();
        if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
            return res.status(401).json({
                error: 'Security Protection: Request expired or potential Replay Attack detected.'
            });
        }
    }
    next();
};

// ── LAYER 6: IP Tracking & Rate Monitoring (No IP Ban / Lockout) ──
const ipRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of ipRateMap.entries()) {
        if (now - rec.startTime > RATE_LIMIT_WINDOW_MS) {
            ipRateMap.delete(ip);
        }
    }
}, 10 * 60 * 1000);

export const rateLimiterMiddleware = (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
    req.clientIp = clientIp;
    const now = Date.now();
    let record = ipRateMap.get(clientIp);

    const isValidRecord = record && typeof record === 'object' && typeof record.startTime === 'number';
    if (!isValidRecord || (now - record.startTime > RATE_LIMIT_WINDOW_MS)) {
        record = { startTime: now, authCount: 0, apiCount: 0 };
    }

    if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/verify-otp')) {
        record.authCount = Number(record.authCount || 0) + 1;
    } else if (req.path.startsWith('/api')) {
        record.apiCount = Number(record.apiCount || 0) + 1;
    }

    ipRateMap.set(clientIp, record);
    next();
};

// ── LAYER 7: Token Session Revocation ──
const revokedTokensMap = new Set();
export const revokeToken = (token) => {
    if (token) revokedTokensMap.add(token);
};
export const isTokenRevoked = (token) => revokedTokensMap.has(token);

// ── LAYER 8: Security Verification Auth Middleware ──
export const verifySecurityAuth = (req, res, next) => {
    // Strictly whitelisted public endpoints that do NOT require authentication
    const publicPaths = [
        '/api/auth/login',
        '/api/auth/verify-otp',
        '/api/auth/qr-login',
        '/api/health',
        '/api/history/report-schedule',
        '/api/calculate-schedules/stream',
        '/calculate-schedules/stream',
        '/api-docs',
        '/docs',
        '/api/docs'
    ];

    const path = req.path;
    const originalUrl = req.originalUrl?.split('?')[0] || path;
    const isCustomerInfoPath = /^\/(?:api\/)?contracts\/customer-info\/[^/]+$/.test(path);

    // Allow only explicitly whitelisted public paths
    const isPublicPath = publicPaths.some(p =>
        path === p ||
        originalUrl === p ||
        path.startsWith('/api/health') ||
        originalUrl.startsWith('/api/health') ||
        path.startsWith('/docs') ||
        originalUrl.startsWith('/docs') ||
        path.startsWith('/api-docs') ||
        originalUrl.startsWith('/api-docs') ||
        path.endsWith('/calculate-schedules/stream') ||
        originalUrl.endsWith('/calculate-schedules/stream') ||
        isCustomerInfoPath
    );

    if (isPublicPath) {
        return next();
    }

    // All other paths (with or without /api prefix) require authentication
    const systemKey = req.headers['x-system-api-key'];
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const partnerKey = req.headers['x-partner-api-key'] ||
        req.headers['x-api-key'] ||
        req.headers['x-partner-key'] ||
        (bearerToken && EXTERNAL_PARTNER_API_KEYS.includes(bearerToken) ? bearerToken : null) ||
        req.query?.partnerKey ||
        req.query?.apiKey ||
        req.query?.partner_key;
    const token = (bearerToken && !EXTERNAL_PARTNER_API_KEYS.includes(bearerToken))
        ? bearerToken
        : getSessionCookieToken(req.headers.cookie);
    const isSessionCookieToken = token && token === getSessionCookieToken(req.headers.cookie);
    const acceptHeader = (req.headers['accept'] || '').toLowerCase();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // Internal system key — full access
    if (SYSTEM_API_KEY && systemKey === SYSTEM_API_KEY) {
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                req.user = decoded;
            } catch (err) {
                // ignore invalid token if system key is valid
            }
        }
        return next();
    }

    // ── BROWSER NAVIGATION DETECTION ──
    // Detect top-level address bar navigation from any browser
    const secFetchDest = (req.headers['sec-fetch-dest'] || '').toLowerCase();
    const secFetchMode = (req.headers['sec-fetch-mode'] || '').toLowerCase();
    const isDocOrNavigate = secFetchDest === 'document' || secFetchMode === 'navigate';
    const isHtmlNavigation = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');
    const isDirectBrowserNavigation = isDocOrNavigate || isHtmlNavigation;

    const isExemptBrowserPath = (
        path === '/docs' ||
        path === '/api-docs' ||
        path === '/api/docs' ||
        originalUrl.startsWith('/docs') ||
        originalUrl.startsWith('/api-docs') ||
        originalUrl.startsWith('/api/docs') ||
        originalUrl.endsWith('/pdf') ||
        path.endsWith('/pdf') ||
        isCustomerInfoPath
    );

    if (isDirectBrowserNavigation && !isExemptBrowserPath && !systemKey) {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
        notifySecurityAlert(`🌐 <b>BROWSER DIRECT ACCESS BLOCKED</b>\nIP: <code>${clientIp}</code>\nPath: <code>${originalUrl}</code>\nUser-Agent: <code>${req.headers['user-agent']?.substring(0, 80)}</code>`);

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

        return res.status(403).json({
            error: 'Security Protection: Direct browser access to this API is not permitted. Use the SYSTEM MDM application to access this data.'
        });
    }

    // External Partner API Key — access to whitelisted endpoints (/api/contracts, /api/payments, etc.)
    const isPartnerKeyValid = Boolean(partnerKey && EXTERNAL_PARTNER_API_KEYS.includes(partnerKey));

    if (isPartnerKeyValid) {
        const isPartnerAllowedPath = PARTNER_ALLOWED_PATH_PREFIXES.some(p =>
            path.startsWith(p) || originalUrl.startsWith(p)
        );

        if (path === '/api/cash-transactions' && !isPenaltyReadPath(req)) {
            return res.status(403).json({
                error: 'Partner Access Denied: External partner access to cash transactions is limited to penalty records.'
            });
        }

        if (!isPartnerAllowedPath) {
            return res.status(403).json({
                error: 'Partner Access Denied: This endpoint is not available for external partner access.'
            });
        }

        const isContractOrPaymentPath = (
            path.startsWith('/api/contracts') ||
            originalUrl.startsWith('/api/contracts') ||
            path.startsWith('/contracts') ||
            originalUrl.startsWith('/contracts') ||
            path.startsWith('/api/payments') ||
            originalUrl.startsWith('/api/payments') ||
            path.startsWith('/payments') ||
            originalUrl.startsWith('/payments')
        );

        // For contracts and payments, allow GET, POST, and PUT. For other partner endpoints, allow GET only.
        const allowedMethods = isContractOrPaymentPath ? ['GET', 'POST', 'PUT'] : ['GET'];
        if (!allowedMethods.includes(req.method)) {
            return res.status(403).json({
                error: `Partner Access Denied: External partner API key allows ${allowedMethods.join(', ')} access only for this endpoint.`
            });
        }

        // Mark request as partner access with full brand visibility
        req.isPartnerAccess = true;
        req.user = req.user || {
            username: 'ExternalPartner',
            role: 'Partner',
            isPartner: true,
            isImmutable: true
        };
        return next();
    }

    // Wrong partner key provided
    if (partnerKey && !isPartnerKeyValid) {
        return res.status(403).json({
            error: 'Partner Access Denied: Invalid partner API key.'
        });
    }

    if (token) {
        if (isTokenRevoked(token)) {
            return res.status(401).json({ error: 'Security Notice: Session has been revoked or logged out. Please log in again.' });
        }

        try {
            if (!JWT_SECRET) {
                return res.status(503).json({ error: 'API authentication is not configured securely.' });
            }
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            if (isSessionCookieToken && decoded.sessionVersion !== 2) {
                return res.status(401).json({ error: 'Browser session expired. Please log in again.' });
            }
            req.user = decoded;
            req.authToken = token;
            return next();
        } catch (err) {
            return res.status(403).json({ error: 'Security Protection: Invalid or Expired Token signature.' });
        }
    }

    // Block unauthorized access to non-partner endpoints
    const clientIpFinal = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
    notifySecurityAlert(`🔒 <b>UNAUTHORIZED API ACCESS BLOCKED</b>\nIP: <code>${clientIpFinal}</code>\nPath: <code>${originalUrl}</code>\nMethod: <code>${req.method}</code>`);

    return res.status(401).json({
        error: 'Security Protection: Access Denied! Direct API scraping or unauthorized access is blocked by SYSTEM MDM Security Protocol.'
    });
};

// Administrator Authorization Check
export const requireAdminRole = (req, res, next) => {
    const systemKey = req.headers['x-system-api-key'];
    if (SYSTEM_API_KEY && systemKey === SYSTEM_API_KEY) {
        return next();
    }
    if (req.user && (req.user.role === 'Administrator' || req.user.role === 'Admin')) {
        return next();
    }
    return res.status(403).json({ error: 'Security Protection: Administrator privileges required to execute this operation.' });
};

// ── LAYER 9: Sensitive Data Response Masking ──
const SENSITIVE_FIELDS = [
    'password', 'jwtSecret', 'dbPassword', 'dbUri',
    'FIREBASE_SECRET_KEY', 'FIREBASE_DATABASE_URL', 'authSecret',
    'secondPassword', 'telegramToken', 'botToken', 'secretKey'
];

const maskSensitiveData = (data, _ancestors = new Set()) => {
    try {
        if (!data || typeof data !== 'object') return data;

        // Circular reference guard — only trigger if data is in the active ancestor stack (real cycle)
        if (_ancestors.has(data)) return '[Circular]';

        const nextAncestors = new Set(_ancestors);
        nextAncestors.add(data);

        if (Array.isArray(data)) return data.map(item => maskSensitiveData(item, nextAncestors));

        // Convert Map or MongooseMap to plain object
        if (data instanceof Map) {
            const cleanedMap = {};
            for (const [key, value] of data.entries()) {
                if (!SENSITIVE_FIELDS.includes(key)) {
                    cleanedMap[key] = maskSensitiveData(value, nextAncestors);
                }
            }
            return cleanedMap;
        }

        if (data.constructor && data.constructor.name === 'MongooseMap' && typeof data.entries === 'function') {
            const cleanedMap = {};
            for (const [key, value] of data.entries()) {
                if (!SENSITIVE_FIELDS.includes(key)) {
                    cleanedMap[key] = maskSensitiveData(value, nextAncestors);
                }
            }
            return cleanedMap;
        }

        // Skip non-plain objects (e.g. Date, ObjectId, Buffer, Error, RegExp, Streams, etc.)
        if (!isPlainObject(data)) {
            return data;
        }

        const cleaned = {};
        for (const key of Object.keys(data)) {
            if (!SENSITIVE_FIELDS.includes(key)) {
                cleaned[key] = maskSensitiveData(data[key], nextAncestors);
            }
        }
        return cleaned;
    } catch (e) {
        return data;
    }
};

export const sensitiveDataMaskingMiddleware = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        try {
            if (data && typeof data === 'object') {
                data = maskSensitiveData(data);
            }
        } catch (e) {
            console.error('Data masking middleware notice:', e.message);
        }
        return originalJson.call(this, data);
    };
    next();
};

// ── LAYER 10: Real-time Telegram Security Alerting ──
export const notifySecurityAlert = (message) => {
    const adminChatId = process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
    if (telegramBotInstance && adminChatId) {
        try {
            telegramBotInstance.sendMessage(adminChatId, message, { parse_mode: 'HTML' }).catch(() => {});
        } catch (e) {
            // Ignore telegram error
        }
    }
};

export const parseUserAgent = (ua) => {
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';
    if (!ua) return { os, browser };
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
    return { os, browser };
};
