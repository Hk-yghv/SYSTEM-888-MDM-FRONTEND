import { useLanguage } from '../context/LanguageContext';
import React, { useState } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

const CopyCell = ({ text, value, children, copyValue, className = '' }) => {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);

    const rawContent = text !== undefined && text !== null ? text : (value !== undefined && value !== null ? value : children);
    if (rawContent === null || rawContent === undefined || rawContent === '') return <span className={className}>-</span>;

    const handleCopy = async (e) => {
        e.stopPropagation();
        const valueToCopy = copyValue !== undefined ? String(copyValue) : String(rawContent);
        if (valueToCopy && valueToCopy !== '-') {
            try {
                await navigator.clipboard.writeText(valueToCopy);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            } catch (error) {
                console.error('Copy cell value error:', error);
            }
        }
    };

    return (
        <span
            onClick={handleCopy}
            data-copy-cell="true"
            className={`inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
            title={t ? [t('clickToCopy')]: 'Click to copy'}
        >
            <span>{rawContent}</span>
            {copied ? (
                <FaCheck className="text-emerald-500 text-[10px] flex-shrink-0" />
            ) : (
                <FaCopy className="text-slate-400 hover:text-slate-600 text-[10px] flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity" />
            )}
        </span>
    );
};

export default CopyCell;
