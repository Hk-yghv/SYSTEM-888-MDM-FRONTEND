/**
 * Utility function to proxy image URLs through backend /api/media/proxy
 * Hides raw Cloudinary URLs (res.cloudinary.com) from frontend DOM and network inspect tab.
 */

export const getProxyImageUrl = (url, apiBase = '') => {
    if (!url || typeof url !== 'string') return url || '';

    const cleanUrl = url.trim();

    // Leave data URLs, local blob URLs, or already proxied URLs intact
    if (
        cleanUrl.startsWith('data:') ||
        cleanUrl.startsWith('blob:') ||
        cleanUrl.includes('/api/media/proxy')
    ) {
        return cleanUrl;
    }

    // Check if the URL comes from Cloudinary or any external host
    const isCloudinary = cleanUrl.includes('cloudinary.com') || cleanUrl.includes('res.cloudinary.com');

    if (isCloudinary) {
        try {
            const base = apiBase || import.meta.env.VITE_API_BACKEND || '/api';
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
            const encodedSrc = btoa(unescape(encodeURIComponent(cleanUrl)));
            return `${cleanBase}/media/proxy?src=${encodeURIComponent(encodedSrc)}`;
        } catch {
            // Fallback to direct query param if btoa fails
            const base = apiBase || import.meta.env.VITE_API_BACKEND || '/api';
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
            return `${cleanBase}/media/proxy?url=${encodeURIComponent(cleanUrl)}`;
        }
    }

    return cleanUrl;
};

/**
 * Array helper to proxy multiple image URLs
 */
export const getProxyImageUrls = (urls, apiBase = '') => {
    if (!Array.isArray(urls)) return [];
    return urls.map(u => getProxyImageUrl(u, apiBase));
};
