/**
 * Media URL utility — fetches HMAC-signed proxy URLs from the backend.
 *
 * Images are served via /api/media/proxy with a time-limited HMAC token.
 * - Raw Cloudinary URLs are NEVER exposed to the browser.
 * - Unsigned proxy requests are rejected by the backend with 403.
 * - Signed tokens expire after 4 hours (backend controlled).
 */

const getApiBase = () => {
    const base = import.meta.env.VITE_API_BACKEND || '/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
};

/**
 * In-memory cache: rawUrl → { proxyUrl, exp }
 * Avoids repeated /sign requests for the same image within the session.
 */
const _signCache = new Map();

/**
 * Request a signed proxy URL from the backend.
 * @param {string} rawUrl - The raw Cloudinary URL to sign
 * @returns {Promise<string>} - Signed proxy URL
 */
export const getProxyImageUrl = async (rawUrl, apiBase = '') => {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl || '';

    const cleanUrl = rawUrl.trim();

    // Leave data URLs, blob URLs, or already-signed proxy URLs intact
    if (
        cleanUrl.startsWith('data:') ||
        cleanUrl.startsWith('blob:') ||
        (cleanUrl.includes('/api/media/proxy') && cleanUrl.includes('sig='))
    ) {
        return cleanUrl;
    }

    // Only proxy Cloudinary URLs
    const isCloudinary = cleanUrl.includes('cloudinary.com') || cleanUrl.includes('res.cloudinary.com');
    if (!isCloudinary) return cleanUrl;

    // Check cache — reuse signed URL if not yet expired (with 5-min buffer)
    const cached = _signCache.get(cleanUrl);
    if (cached && Date.now() < cached.exp - 5 * 60 * 1000) {
        return cached.proxyUrl;
    }

    try {
        const base = apiBase || getApiBase();
        const encodedSrc = btoa(unescape(encodeURIComponent(cleanUrl)));
        const signRes = await fetch(
            `${base}/media/sign?src=${encodeURIComponent(encodedSrc)}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                    'x-system-api-key': import.meta.env.VITE_SYSTEM_API_KEY || ''
                }
            }
        );

        if (!signRes.ok) {
            console.warn('[MediaUtils] Failed to sign image URL:', signRes.status);
            return ''; // Return empty — do not expose raw Cloudinary URL
        }

        const { proxy_url } = await signRes.json();

        // Extract exp from returned URL for cache tracking
        const expMatch = proxy_url.match(/[?&]exp=(\d+)/);
        const expTs = expMatch ? parseInt(expMatch[1], 10) : Date.now() + 4 * 60 * 60 * 1000;

        _signCache.set(cleanUrl, { proxyUrl: `${base}${proxy_url.startsWith('/') ? '' : '/'}${proxy_url.replace(/^\/api/, '/api')}`, exp: expTs });

        // The proxy_url from backend starts with /api/media/proxy — prepend backend host if needed
        const fullProxyUrl = proxy_url.startsWith('http')
            ? proxy_url
            : `${base}${proxy_url.startsWith('/api') ? proxy_url.slice(4) : proxy_url}`;

        _signCache.set(cleanUrl, { proxyUrl: fullProxyUrl, exp: expTs });
        return fullProxyUrl;
    } catch (err) {
        console.warn('[MediaUtils] Sign request error:', err.message);
        return ''; // Return empty — do not expose raw Cloudinary URL
    }
};

/**
 * Synchronous version — returns cached proxy URL or empty string.
 * Use this for cases where async is not possible (e.g., src attributes in JSX initial render).
 * Pair with useProxyImage hook for reactive updates.
 */
export const getProxyImageUrlSync = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const cleanUrl = rawUrl.trim();
    if (
        cleanUrl.startsWith('data:') ||
        cleanUrl.startsWith('blob:') ||
        (cleanUrl.includes('/api/media/proxy') && cleanUrl.includes('sig='))
    ) return cleanUrl;
    const cached = _signCache.get(cleanUrl);
    if (cached && Date.now() < cached.exp - 5 * 60 * 1000) return cached.proxyUrl;
    return ''; // Not signed yet — caller must use async getProxyImageUrl
};

/**
 * React hook that returns a signed proxy URL for a given raw image URL.
 * Automatically fetches signature on mount/URL change.
 */
import { useState, useEffect } from 'react';

export const useProxyImage = (rawUrl) => {
    const [proxyUrl, setProxyUrl] = useState(() => getProxyImageUrlSync(rawUrl));

    useEffect(() => {
        if (!rawUrl) { setProxyUrl(''); return; }
        let cancelled = false;
        getProxyImageUrl(rawUrl).then(url => {
            if (!cancelled) setProxyUrl(url);
        });
        return () => { cancelled = true; };
    }, [rawUrl]);

    return proxyUrl;
};

/**
 * Array helper — signs multiple image URLs in parallel.
 */
export const getProxyImageUrls = async (urls, apiBase = '') => {
    if (!Array.isArray(urls)) return [];
    return Promise.all(urls.map(u => getProxyImageUrl(u, apiBase)));
};
