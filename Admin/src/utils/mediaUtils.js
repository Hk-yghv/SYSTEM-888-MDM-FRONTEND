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

/**
 * Convert a File or Blob to a Base64 data URL.
 * Automatically resizes large images (max 1600x1600) and compresses to ensure optimal MongoDB document size and fast rendering.
 */
export const fileToBase64 = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        if (!file.type || !file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                // If the file is already small (< 400KB) and dimensions are within bounds, keep original
                if (file.size < 400 * 1024 && width <= maxWidth && height <= maxHeight) {
                    return resolve(e.target.result);
                }

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const compressedDataUrl = canvas.toDataURL(mimeType, quality);
                resolve(compressedDataUrl);
            };
            img.onerror = () => {
                // If image rendering failed, fallback to raw base64
                resolve(e.target.result || '');
            };
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

/**
 * Convert an array/FileList of files to Base64 data URLs.
 */
export const filesToBase64 = async (files, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
    const list = Array.from(files || []);
    const results = await Promise.all(list.map(f => fileToBase64(f, maxWidth, maxHeight, quality)));
    return results.filter(Boolean);
};

/**
 * Automatically fetch and convert any image URL (especially from Cloudinary) to a Base64 data URL.
 * If already a Base64 string, returns it immediately.
 */
export const ensureBase64 = async (url) => {
    if (!url || typeof url !== 'string') return url || '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:')) return trimmed; // Already Base64
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;

    try {
        // Use backend to-base64 API endpoint to bypass browser CORS policies
        const res = await fetch(`/api/media/to-base64?url=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.base64) return data.base64;
        }
    } catch (e) {
        console.warn('Backend to-base64 conversion failed:', e);
    }

    try {
        // Fallback to client-side direct fetch
        const clientRes = await fetch(trimmed);
        const blob = await clientRes.blob();
        return await fileToBase64(blob);
    } catch (err) {
        console.warn('Direct fetch to base64 failed:', err);
    }
    return trimmed;
};

/**
 * Automatically convert an array of URLs to Base64 data URLs.
 */
export const ensureBase64List = async (urls) => {
    if (!Array.isArray(urls)) return [];
    return Promise.all(urls.map(u => ensureBase64(u)));
};


