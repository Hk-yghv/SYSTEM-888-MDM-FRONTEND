/**
 * Utility function to proxy image URLs through backend /api/media/proxy
 * Simple pass-through — returns the URL as-is for public Cloudinary images.
 */

export const getProxyImageUrl = (url) => {
    if (!url || typeof url !== 'string') return url || '';
    return url.trim();
};

/**
 * Array helper
 */
export const getProxyImageUrls = (urls) => {
    if (!Array.isArray(urls)) return [];
    return urls.map(u => getProxyImageUrl(u));
};
