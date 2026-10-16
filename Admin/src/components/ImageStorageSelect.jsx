import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const ImageStorageSelect = ({ value, onChange, disabled = false }) => {
    const { t } = useLanguage();

    return (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>{t('imageStorageDestination')}</span>
            <select
                value={value}
                onChange={event => onChange(event.target.value)}
                disabled={disabled}
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
                <option value="cloudinary">{t('cloudinaryStorage')}</option>
                <option value="base64">{t('base64Storage')}</option>
            </select>
        </label>
    );
};

export default ImageStorageSelect;
