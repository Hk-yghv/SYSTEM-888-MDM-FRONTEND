import React, { useState } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

const CopyCell = ({ text, className = '' }) => {
    const [copied, setCopied] = useState(false);

    if (!text) return <span className={className}>-</span>;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <span
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
            title="Click to copy"
        >
            <span>{text}</span>
            {copied ? (
                <FaCheck className="text-emerald-500 text-[10px] flex-shrink-0" />
            ) : (
                <FaCopy className="text-slate-400 hover:text-slate-600 text-[10px] flex-shrink-0 opacity-0 hover:opacity-100 transition-opacity" />
            )}
        </span>
    );
};

export default CopyCell;
