import React from 'react';
import { useProxyImage } from '../utils/mediaUtils';

/**
 * ProxyImage — Drop-in replacement for <img> that automatically fetches a
 * backend-signed proxy URL before rendering. Raw Cloudinary URLs are never
 * exposed in the browser's DOM or network tab.
 *
 * Usage:
 *   <ProxyImage src={rawCloudinaryUrl} alt="photo" className="w-12 h-12" />
 *
 * Props:
 *   src       - Raw image URL (Cloudinary or direct). Non-Cloudinary URLs render as-is.
 *   alt       - img alt text
 *   className - CSS class names
 *   style     - Inline styles
 *   ...rest   - Any other <img> props (onClick, etc.)
 */
const ProxyImage = ({ src, alt = '', className = '', style = {}, ...rest }) => {
    const proxyUrl = useProxyImage(src);

    if (!proxyUrl) {
        // While loading or if signing failed, show a placeholder
        return (
            <div
                className={className}
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'inherit',
                    ...style
                }}
                {...rest}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                </svg>
            </div>
        );
    }

    return (
        <img
            src={proxyUrl}
            alt={alt}
            className={className}
            style={style}
            {...rest}
        />
    );
};

export default ProxyImage;
