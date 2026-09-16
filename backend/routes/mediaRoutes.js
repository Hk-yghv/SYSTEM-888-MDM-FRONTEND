import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Allowed external image hosts for security proxying
const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com', 'images.unsplash.com'];

/**
 * GET /api/media/proxy
 * Fetches private/authenticated images from Cloudinary or external origin server-side
 * and streams the image directly to the client under the backend domain.
 */
router.get('/proxy', async (req, res) => {
    try {
        const { src, url } = req.query;
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
 * Backend proxy endpoint for uploading image files to Cloudinary as private images
 */
router.post('/upload', async (req, res) => {
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
        formData.append('type', 'private'); // Ensure image is stored as private on Cloudinary
        formData.append('folder', folder);

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await cloudinaryRes.json();
        if (!cloudinaryRes.ok) {
            return res.status(cloudinaryRes.status).json({ success: false, message: data.error?.message || 'Cloudinary upload failed' });
        }

        // Return proxied URL instead of raw Cloudinary URL
        const rawUrl = data.secure_url || data.url;
        const encodedSrc = Buffer.from(rawUrl).toString('base64');
        const proxyUrl = `/api/media/proxy?src=${encodeURIComponent(encodedSrc)}`;

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
