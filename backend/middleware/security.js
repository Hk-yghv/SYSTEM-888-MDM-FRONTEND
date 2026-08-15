import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mdm_super_secret_jwt_key_2026_boyboy';
const SYSTEM_API_KEY = process.env.SYSTEM_API_KEY || 'SYSTEM_MDM_SECURE_AUTH_HEADER_TOKEN_2026';

// ── NoSQL Injection Prevention Sanitizer ──
export const sanitizeInput = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeInput);
    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const cleanKey = key.replace(/^\$|\./g, '');
            sanitized[cleanKey] = typeof obj[key] === 'object' ? sanitizeInput(obj[key]) : obj[key];
        }
    }
    return sanitized;
};

export const sanitizeMiddleware = (req, res, next) => {
    if (req.body) req.body = sanitizeInput(req.body);
    if (req.query) req.query = sanitizeInput(req.query);
    if (req.params) req.params = sanitizeInput(req.params);
    next();
};

// ── Security Headers Middleware ──
export const securityHeadersMiddleware = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
};

// ── Rate Limiter Security (Anti-DDoS / Brute Force Protection) ──
const ipRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
const MAX_AUTH_ATTEMPTS = 15;
const MAX_API_ATTEMPTS = 600;

export const rateLimiterMiddleware = (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = ipRateMap.get(clientIp);

    if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        record = { startTime: now, authCount: 0, apiCount: 0 };
    }

    if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/verify-otp')) {
        record.authCount += 1;
        if (record.authCount > MAX_AUTH_ATTEMPTS) {
            ipRateMap.set(clientIp, record);
            return res.status(429).json({ error: 'Security Warning: Too many authentication attempts! Please try again in 15 minutes.' });
        }
    } else if (req.path.startsWith('/api')) {
        record.apiCount += 1;
        if (record.apiCount > MAX_API_ATTEMPTS) {
            ipRateMap.set(clientIp, record);
            return res.status(429).json({ error: 'Security Protection: Rate limit exceeded. Too many API requests from your IP address.' });
        }
    }

    ipRateMap.set(clientIp, record);
    next();
};

// ── Security Protection Middleware: Block direct API scraping / unauthenticated requests ──
export const verifySecurityAuth = (req, res, next) => {
    const publicPaths = ['/api/auth/login', '/api/auth/verify-otp', '/api/health', '/api/history/report-schedule'];
    if (!req.path.startsWith('/api') || publicPaths.some(p => req.path === p || req.path.startsWith('/api/health'))) {
        return next();
    }

    const systemKey = req.headers['x-system-api-key'];
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (systemKey === SYSTEM_API_KEY) {
        return next();
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(403).json({ error: 'Security Protection: Invalid or Expired Token signature.' });
        }
    }

    return res.status(401).json({
        error: 'Security Protection: Access Denied! Direct API scraping or unauthorized access is blocked by SYSTEM MDM Security Protocol.'
    });
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
