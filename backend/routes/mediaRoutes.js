import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import User from '../models/User.js';
import { isMongoConnected, MEM_DB } from '../config/db.js';
import { queryAllDBs } from '../config/multiDB.js';

const router = express.Router();

// Secret used to sign/verify proxy tokens (set in .env)
const PROXY_SECRET = process.env.MEDIA_PROXY_SECRET || 'mdm_media_proxy_hmac_secret_2026_boyboy_secure';

// Token valid for 4 hours (ms)
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Allowed external image hosts for security proxying
const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com', 'images.unsplash.com'];

const requireCloudinaryPermission = (action) => async (req, res, next) => {
    try {
        const identity = req.user;
        let user = null;
        if (identity?.username) {
            if (isMongoConnected) {
                const users = await queryAllDBs(User, Model => Model.find({ username: identity.username }));
                user = users.find(item => !identity.userId || item.userId === identity.userId) || users[0] || null;
            } else {
                user = MEM_DB.users.find(item =>
                    item.username === identity.username && (!identity.userId || item.userId === identity.userId)
                ) || null;
            }
        }

        const isAdmin = user && (
            user.role === 'Administrator' ||
            user.role === 'Admin' ||
            user.username === '@hakyonghouv' ||
            user.username === 'hakyonghouv' ||
            user.isImmutable === true
        );
        const permissions = user?.permissions instanceof Map
            ? Object.fromEntries(user.permissions)
            : user?.permissions?.toObject?.() || user?.permissions || {};
        const hasPermission = isAdmin || permissions['/all-picture']?.[action] === true;

        if (!hasPermission) {
            return res.status(403).json({ error: `Permission denied: ${action} access to All Picture is required.` });
        }
        return next();
    } catch (err) {
        console.error('Cloudinary permission lookup failed:', err);
        return res.status(500).json({ error: 'Unable to verify Cloudinary image permissions.' });
    }
};

const getCloudinaryAdminConfig = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ouuzfexp';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiKey || !apiSecret) {
        return null;
    }

    return {
        cloudName,
        authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
    };
};

const getCloudinaryAdminError = async (response) => {
    const responseText = await response.text();
    let message = responseText;
    try {
        const data = JSON.parse(responseText);
        message = data.error?.message || responseText;
    } catch {
        // Keep the upstream response text for diagnostics when it is not JSON.
    }
    return message || `Cloudinary Admin API returned ${response.status}`;
};

/**
 * Generate HMAC-SHA256 signature for a given URL + expiry timestamp.
 */
const signProxyUrl = (rawUrl, exp) => {
    return crypto
        .createHmac('sha256', PROXY_SECRET)
        .update(`${rawUrl}|${exp}`)
        .digest('hex');
};

/**
 * Verify that the signature is valid and token has not expired.
 */
const verifyProxyToken = (rawUrl, exp, sig) => {
    try {
        const now = Date.now();
        if (!exp || now > parseInt(exp, 10)) return false; // expired
        const expected = signProxyUrl(rawUrl, exp);
        return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
        return false;
    }
};

// ── CORS pre-flight for media proxy ──
router.options('/proxy', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendStatus(204);
});

/**
 * GET /api/media/sign
 * Accepts a raw Cloudinary URL (base64-encoded as `src`) and returns
 * a signed proxy URL that the frontend can use to display images.
 *
 * This endpoint is authenticated (verifySecurityAuth already applies
 * to all /api routes in server.js).
 */
router.get('/sign', (req, res) => {
    const { src } = req.query;
    if (!src) {
        return res.status(400).json({ error: 'Missing src parameter' });
    }

    let rawUrl;
    try {
        rawUrl = Buffer.from(src, 'base64').toString('utf-8');
    } catch {
        rawUrl = src;
    }

    // Validate the URL is an allowed host
    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const isAllowedHost = ALLOWED_HOSTS.some(host => parsedUrl.hostname.endsWith(host));
    if (!isAllowedHost) {
        return res.status(403).json({ error: 'URL host not permitted for proxying' });
    }

    const exp = String(Date.now() + TOKEN_TTL_MS);
    const sig = signProxyUrl(rawUrl, exp);

    // Re-encode URL as base64 for the proxy param
    const encodedSrc = Buffer.from(rawUrl).toString('base64');
    const proxyUrl = `/api/media/proxy?src=${encodeURIComponent(encodedSrc)}&exp=${exp}&sig=${sig}`;

    return res.json({ proxy_url: proxyUrl });
});

/**
 * GET /api/media/proxy
 * Fetches private images from Cloudinary and streams back to client.
 * Requires valid HMAC signature (`sig`) + expiry (`exp`).
 * Without a valid token this endpoint returns 403 Forbidden.
 */
router.get('/proxy', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    try {
        const { src, url, exp, sig } = req.query;
        let targetUrl = url;

        if (!targetUrl && src) {
            try {
                targetUrl = Buffer.from(src, 'base64').toString('utf-8');
            } catch {
                targetUrl = src;
            }
        }

        if (!targetUrl) {
            return res.status(400).send('Missing src or url parameter');
        }

        // ── HMAC Verification — reject all unsigned / expired requests ──
        if (!exp || !sig) {
            return res.status(403).json({ error: 'Access denied: missing proxy token. Images are private.' });
        }

        if (!verifyProxyToken(targetUrl, exp, sig)) {
            return res.status(403).json({ error: 'Access denied: invalid or expired proxy token.' });
        }

        // Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(targetUrl);
        } catch {
            return res.status(400).send('Invalid image URL format');
        }

        // Host check for security
        const isAllowedHost = ALLOWED_HOSTS.some(host => parsedUrl.hostname.endsWith(host));
        if (!isAllowedHost) {
            return res.status(403).send('Proxy access denied for host');
        }

        // Fetch image from origin
        const imageRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (SystemMDM MediaProxy/1.0)'
            }
        });

        if (!imageRes.ok) {
            console.error(`Media proxy fetch failed (${imageRes.status}): ${targetUrl}`);
            return res.status(imageRes.status).send('Failed to retrieve image from origin server');
        }

        const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Stream image buffer to response
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);

    } catch (err) {
        console.error('Media proxy internal error:', err.message);
        return res.status(500).send('Internal media proxy error');
    }
});

/**
 * POST /api/media/upload
 * Backend proxy endpoint for uploading image files to Cloudinary.
 * Returns a signed proxy_url (not the raw Cloudinary URL).
 */
router.post('/upload', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const { file, upload_preset, folder = 'system_mdm_private' } = req.body;
        if (!file) {
            return res.status(400).json({ success: false, message: 'file base64 or URL is required' });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ouuzfexp';
        const preset = upload_preset || process.env.CLOUDINARY_UPLOAD_PRESET || 'ml_default';

        const formData = new URLSearchParams();
        formData.append('file', file);
        formData.append('upload_preset', preset);
        formData.append('folder', folder);

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await cloudinaryRes.json();
        if (!cloudinaryRes.ok) {
            return res.status(cloudinaryRes.status).json({ success: false, message: data.error?.message || 'Cloudinary upload failed' });
        }

        const rawUrl = data.secure_url || data.url;

        // Generate a signed proxy URL immediately upon upload
        const exp = String(Date.now() + TOKEN_TTL_MS);
        const sig = signProxyUrl(rawUrl, exp);
        const encodedSrc = Buffer.from(rawUrl).toString('base64');
        const proxyUrl = `/api/media/proxy?src=${encodeURIComponent(encodedSrc)}&exp=${exp}&sig=${sig}`;

        return res.json({
            success: true,
            raw_url: rawUrl,
            proxy_url: proxyUrl,
            public_id: data.public_id,
            format: data.format
        });
    } catch (err) {
        console.error('Media upload proxy error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/media/assets
 * List uploaded Cloudinary images. Admin API credentials remain server-side.
 */
router.get('/assets', requireCloudinaryPermission('read'), async (req, res) => {
    const config = getCloudinaryAdminConfig();
    if (!config) {
        return res.status(503).json({
            error: 'Cloudinary image management is not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the backend.'
        });
    }

    const requestedLimit = Number.parseInt(req.query.max_results, 10);
    const maxResults = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
    const params = new URLSearchParams({ max_results: String(maxResults) });
    if (typeof req.query.next_cursor === 'string' && req.query.next_cursor.length <= 2048) {
        params.set('next_cursor', req.query.next_cursor);
    }

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/image/upload?${params}`, {
            headers: { Authorization: config.authorization }
        });
        if (!response.ok) {
            const message = await getCloudinaryAdminError(response);
            console.error('Cloudinary asset listing failed:', response.status, message);
            return res.status(502).json({ error: `Cloudinary image listing failed: ${message}` });
        }
        return res.json(await response.json());
    } catch (err) {
        console.error('Cloudinary asset listing error:', err);
        return res.status(502).json({ error: 'Unable to contact Cloudinary to list images.' });
    }
});

/**
 * POST /api/media/assets/delete
 * Delete a bounded batch of uploaded images by their Cloudinary public IDs.
 */
router.post('/assets/delete', requireCloudinaryPermission('delete'), async (req, res) => {
    const config = getCloudinaryAdminConfig();
    if (!config) {
        return res.status(503).json({
            error: 'Cloudinary image management is not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the backend.'
        });
    }

    const publicIds = req.body?.public_ids;
    if (!Array.isArray(publicIds) || publicIds.length < 1 || publicIds.length > 100 ||
        publicIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 255)) {
        return res.status(400).json({ error: 'Provide between 1 and 100 valid Cloudinary public IDs.' });
    }

    try {
        const body = new URLSearchParams();
        [...new Set(publicIds)].forEach(id => body.append('public_ids[]', id));
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/image/upload`, {
            method: 'DELETE',
            headers: {
                Authorization: config.authorization,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        });
        if (!response.ok) {
            const message = await getCloudinaryAdminError(response);
            console.error('Cloudinary asset deletion failed:', response.status, message);
            return res.status(502).json({ error: `Cloudinary image deletion failed: ${message}` });
        }
        return res.json({ success: true, ...(await response.json()) });
    } catch (err) {
        console.error('Cloudinary asset deletion error:', err);
        return res.status(502).json({ error: 'Unable to contact Cloudinary to delete images.' });
    }
});

export default router;
