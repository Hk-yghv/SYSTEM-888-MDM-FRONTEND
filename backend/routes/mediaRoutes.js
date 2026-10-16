import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import User from '../models/User.js';
import Contract from '../models/Contract.js';
import Salary from '../models/Salary.js';
import SupportHelp from '../models/SupportHelp.js';
import CashTransaction from '../models/CashTransaction.js';
import FollowUp2 from '../models/FollowUp2.js';
import FollowUp from '../models/FollowUp.js';
import SupportComment from '../models/SupportComment.js';
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
            secure_url: rawUrl,
            proxy_url: proxyUrl,
            public_id: data.public_id,
            format: data.format,
            width: data.width,
            height: data.height,
            bytes: data.bytes,
            created_at: data.created_at
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

/**
 * GET /api/media/usage
 * Find where an image is used in the system (Contract, Salary, SupportHelp, etc.), when, and who.
 */
router.get('/usage', async (req, res) => {
    try {
        const { url, public_id } = req.query;
        if (!url && !public_id) {
            return res.status(400).json({ error: 'Missing url or public_id' });
        }

        const searchTerms = [];
        if (public_id) searchTerms.push(public_id);
        if (url) {
            searchTerms.push(url);
            const baseName = url.split('/').pop()?.split('.')[0];
            if (baseName && baseName.length > 4) searchTerms.push(baseName);
        }

        let foundLocation = null;

        if (isMongoConnected) {
            // 1. Search in Contracts
            for (const term of searchTerms) {
                const regex = new RegExp(term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                const contracts = await queryAllDBs(Contract, (M) =>
                    M.find({
                        $or: [
                            { customerPhoto: regex },
                            { photos: regex },
                            { evidencePhotos: regex }
                        ]
                    }).limit(1)
                );

                if (contracts.length > 0) {
                    const c = contracts[0];
                    let fieldType = 'រូបភាពកិច្ចសន្យា (Contract Photo)';
                    if (c.customerPhoto && c.customerPhoto.includes(term)) {
                        fieldType = 'រូបថតអតិថិជន (Customer Photo)';
                    } else if (c.evidencePhotos && c.evidencePhotos.some((p) => p && p.includes(term))) {
                        fieldType = 'រូបភាពភស្តុតាង (Evidence Photo)';
                    }

                    foundLocation = {
                        found: true,
                        category: 'Contract',
                        location: `កិច្ចសន្យា #${c.contractId || c._id}`,
                        customer: c.customerNameKh || c.customerNameEn || '—',
                        phone: c.phone || '—',
                        page: `/contract/activated?search=${encodeURIComponent(c.contractId || '')}`,
                        field: fieldType,
                        usedAt: c.createdAt || c.inputDate,
                        usedBy: c.createdBy || 'Staff'
                    };
                    break;
                }
            }

            // 2. Search in Salary
            if (!foundLocation) {
                for (const term of searchTerms) {
                    const regex = new RegExp(term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                    const salaries = await queryAllDBs(Salary, (M) =>
                        M.find({
                            $or: [
                                { receiptEvidence: regex },
                                { evidence: regex }
                            ]
                        }).limit(1)
                    );

                    if (salaries.length > 0) {
                        const s = salaries[0];
                        foundLocation = {
                            found: true,
                            category: 'Salary',
                            location: `ប្រាក់ខែបុគ្គលិក: ${s.staffName || 'Staff'}`,
                            page: '/salary',
                            field: 'រូបភាពភស្តុតាងបើកប្រាក់ខែ (Salary Receipt)',
                            usedAt: s.createdAt,
                            usedBy: s.createdBy || 'Finance/Admin'
                        };
                        break;
                    }
                }
            }

            // 3. Search in SupportHelp
            if (!foundLocation) {
                for (const term of searchTerms) {
                    const regex = new RegExp(term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
                    const supports = await queryAllDBs(SupportHelp, (M) =>
                        M.find({
                            photos: regex
                        }).limit(1)
                    );

                    if (supports.length > 0) {
                        const sup = supports[0];
                        foundLocation = {
                            found: true,
                            category: 'Support & Help',
                            location: `ជំនួយ & ការគាំទ្រ: "${sup.title}" (${sup.page || 'General'})`,
                            page: '/help-support',
                            field: 'រូបភាពណែនាំប្រើប្រាស់ប្រព័ន្ធ',
                            usedAt: sup.createdAt,
                            usedBy: sup.createdBy || 'Administrator'
                        };
                        break;
                    }
                }
            }
        }

        res.json({
            success: true,
            usage: foundLocation || {
                found: false,
                category: 'Media Library',
                location: 'ផ្ទុកក្នុង Cloudinary Media Library (ទូទៅ)',
                field: 'រូបភាពប្រព័ន្ធទូទៅ',
                usedAt: null,
                usedBy: 'Administrator'
            }
        });
    } catch (err) {
        console.error('Media usage lookup error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET / POST /api/media/to-base64
 * Fetches an image from external URL (especially Cloudinary) and returns it as a base64 data URL.
 * Solves browser CORS restrictions and enables seamless auto-conversion of existing images.
 */
router.all('/to-base64', async (req, res) => {
    try {
        const targetUrl = req.query.url || req.body?.url;
        if (!targetUrl || typeof targetUrl !== 'string') {
            return res.status(400).json({ success: false, error: 'Missing url parameter' });
        }

        if (targetUrl.startsWith('data:')) {
            return res.json({ success: true, base64: targetUrl });
        }

        const imageRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (SystemMDM MediaConverter/1.0)'
            }
        });

        if (!imageRes.ok) {
            console.warn(`to-base64 fetch failed (${imageRes.status}):`, targetUrl);
            return res.status(imageRes.status).json({ success: false, error: `Failed to fetch image: status ${imageRes.status}` });
        }

        const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64Data}`;

        return res.json({ success: true, base64: dataUrl });
    } catch (err) {
        console.error('to-base64 error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/media/migrate-cloudinary
 * Bulk migration endpoint: Scans MongoDB collections (Contract, CashTransaction, Salary, FollowUp2, FollowUp, SupportHelp)
 * finds existing Cloudinary URLs, downloads the images, converts them to Base64, and updates the documents.
 */
router.post('/migrate-cloudinary', async (req, res) => {
    try {
        const stats = {
            contractsUpdated: 0,
            transactionsUpdated: 0,
            salariesUpdated: 0,
            followUpsUpdated: 0,
            supportHelpsUpdated: 0,
            totalImagesConverted: 0
        };

        const convertUrl = async (url) => {
            if (!url || typeof url !== 'string') return url;
            if (url.startsWith('data:')) return url;
            if (!url.includes('cloudinary.com') && !url.includes('res.cloudinary.com')) return url;
            try {
                const imgRes = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (SystemMDM Migrator/1.0)' }
                });
                if (!imgRes.ok) return url;
                const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                const buffer = Buffer.from(await imgRes.arrayBuffer());
                stats.totalImagesConverted++;
                return `data:${contentType};base64,${buffer.toString('base64')}`;
            } catch (e) {
                console.warn('Migration convert error for URL:', url, e.message);
                return url;
            }
        };

        const convertArray = async (arr) => {
            if (!Array.isArray(arr)) return arr;
            const updated = [];
            for (const item of arr) {
                updated.push(await convertUrl(item));
            }
            return updated;
        };

        // 1. Contracts
        const contracts = await queryAllDBs(Contract, (M) =>
            M.find({
                $or: [
                    { photos: { $regex: 'cloudinary', $options: 'i' } },
                    { evidencePhotos: { $regex: 'cloudinary', $options: 'i' } },
                    { customerPhoto: { $regex: 'cloudinary', $options: 'i' } },
                    { googleDrivePhotoUrl: { $regex: 'cloudinary', $options: 'i' } },
                    { 'repaymentSchedule.imageUrls': { $regex: 'cloudinary', $options: 'i' } }
                ]
            })
        );

        for (const doc of contracts) {
            let changed = false;
            if (doc.photos?.length) {
                const newPhotos = await convertArray(doc.photos);
                if (JSON.stringify(newPhotos) !== JSON.stringify(doc.photos)) {
                    doc.photos = newPhotos;
                    changed = true;
                }
            }
            if (doc.evidencePhotos?.length) {
                const newEv = await convertArray(doc.evidencePhotos);
                if (JSON.stringify(newEv) !== JSON.stringify(doc.evidencePhotos)) {
                    doc.evidencePhotos = newEv;
                    changed = true;
                }
            }
            if (doc.customerPhoto && doc.customerPhoto.includes('cloudinary')) {
                doc.customerPhoto = await convertUrl(doc.customerPhoto);
                changed = true;
            }
            if (doc.googleDrivePhotoUrl && doc.googleDrivePhotoUrl.includes('cloudinary')) {
                doc.googleDrivePhotoUrl = await convertUrl(doc.googleDrivePhotoUrl);
                changed = true;
            }
            if (Array.isArray(doc.repaymentSchedule)) {
                for (const row of doc.repaymentSchedule) {
                    if (row && Array.isArray(row.imageUrls)) {
                        const newImgs = await convertArray(row.imageUrls);
                        if (JSON.stringify(newImgs) !== JSON.stringify(row.imageUrls)) {
                            row.imageUrls = newImgs;
                            changed = true;
                        }
                    }
                }
            }
            if (changed) {
                await doc.save();
                stats.contractsUpdated++;
            }
        }

        // 2. CashTransaction
        const transactions = await queryAllDBs(CashTransaction, (M) =>
            M.find({
                $or: [
                    { photoUrls: { $regex: 'cloudinary', $options: 'i' } },
                    { photoUrl: { $regex: 'cloudinary', $options: 'i' } }
                ]
            })
        );

        for (const tx of transactions) {
            let changed = false;
            if (tx.photoUrls?.length) {
                const newPhotos = await convertArray(tx.photoUrls);
                if (JSON.stringify(newPhotos) !== JSON.stringify(tx.photoUrls)) {
                    tx.photoUrls = newPhotos;
                    changed = true;
                }
            }
            if (tx.photoUrl && tx.photoUrl.includes('cloudinary')) {
                tx.photoUrl = await convertUrl(tx.photoUrl);
                changed = true;
            }
            if (changed) {
                await tx.save();
                stats.transactionsUpdated++;
            }
        }

        // 3. Salary
        const salaries = await queryAllDBs(Salary, (M) =>
            M.find({
                $or: [
                    { proofPhotos: { $regex: 'cloudinary', $options: 'i' } },
                    { proofPhoto: { $regex: 'cloudinary', $options: 'i' } },
                    { qrCodePhoto: { $regex: 'cloudinary', $options: 'i' } }
                ]
            })
        );

        for (const sal of salaries) {
            let changed = false;
            if (sal.proofPhotos?.length) {
                const newProof = await convertArray(sal.proofPhotos);
                if (JSON.stringify(newProof) !== JSON.stringify(sal.proofPhotos)) {
                    sal.proofPhotos = newProof;
                    changed = true;
                }
            }
            if (sal.proofPhoto && sal.proofPhoto.includes('cloudinary')) {
                sal.proofPhoto = await convertUrl(sal.proofPhoto);
                changed = true;
            }
            if (sal.qrCodePhoto && sal.qrCodePhoto.includes('cloudinary')) {
                sal.qrCodePhoto = await convertUrl(sal.qrCodePhoto);
                changed = true;
            }
            if (changed) {
                await sal.save();
                stats.salariesUpdated++;
            }
        }

        // 4. FollowUp2
        const followups = await queryAllDBs(FollowUp2, (M) =>
            M.find({
                images: { $regex: 'cloudinary', $options: 'i' }
            })
        );

        for (const fu of followups) {
            let changed = false;
            if (fu.images?.length) {
                const newImgs = await convertArray(fu.images);
                if (JSON.stringify(newImgs) !== JSON.stringify(fu.images)) {
                    fu.images = newImgs;
                    changed = true;
                }
            }
            if (changed) {
                await fu.save();
                stats.followUpsUpdated++;
            }
        }

        // 5. SupportHelp
        const supports = await queryAllDBs(SupportHelp, (M) =>
            M.find({
                photos: { $regex: 'cloudinary', $options: 'i' }
            })
        );
        for (const sup of supports) {
            let changed = false;
            if (sup.photos?.length) {
                const newPhotos = await convertArray(sup.photos);
                if (JSON.stringify(newPhotos) !== JSON.stringify(sup.photos)) {
                    sup.photos = newPhotos;
                    changed = true;
                }
            }
            if (changed) {
                await sup.save();
                stats.supportHelpsUpdated++;
            }
        }

        return res.json({
            success: true,
            message: `Migration completed: Converted ${stats.totalImagesConverted} Cloudinary images to Base64.`,
            stats
        });
    } catch (err) {
        console.error('migrate-cloudinary error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
