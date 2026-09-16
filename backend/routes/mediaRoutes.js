import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';

const router = express.Router();

// Secret used to sign/verify proxy tokens (set in .env)
const PROXY_SECRET = process.env.MEDIA_PROXY_SECRET || 'mdm_media_proxy_hmac_secret_2026_boyboy_secure';

// Token valid for 4 hours (ms)
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Allowed external image hosts for security proxying
const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com', 'images.unsplash.com'];

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

export default router;
