import React from 'react';
import ZoomableImage from './ZoomableImage';

/**
 * ProxyImage — Renders images with interactive zoom bar (របាពង្រីកបង្រួម)
 */
const ProxyImage = ({ src, alt = '', className = '', style = {}, ...rest }) => {
    if (!src) return null;
    return (
        <ZoomableImage
            src={src}
            alt={alt}
            className={className}
            style={style}
            {...rest}
        />
    );
};

export default ProxyImage;
