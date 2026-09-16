import React from 'react';

/**
 * ProxyImage — Pass-through component for standard <img> rendering.
 */
const ProxyImage = ({ src, alt = '', className = '', style = {}, ...rest }) => {
    if (!src) return null;
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            {...rest}
        />
    );
};

export default ProxyImage;
