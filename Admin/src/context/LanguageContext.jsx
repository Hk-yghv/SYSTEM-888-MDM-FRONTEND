import React, { createContext, useContext, useState, useEffect } from 'react';
import dict from '../json/languages';

const LanguageContext = createContext();

export const LANGUAGES = [
    { code: 'km', label: 'ខ្មែរ (Khmer)', flag: '🇰🇭' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
    { code: 'th', label: 'ไทย (Thai)', flag: '🇹🇭' },
    { code: 'vi', label: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
    { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
    { code: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
    { code: 'ru', label: 'Русский (Russian)', flag: '🇷🇺' },
    { code: 'la', label: 'ພາສາລາວ (Lao)', flag: '🇱🇦' }
];

export const LanguageProvider = ({ children }) => {
    const [lang, setLang] = useState(() => localStorage.getItem('mdm_lang') || 'km');

    const changeLanguage = (code) => {
        setLang(code);
        localStorage.setItem('mdm_lang', code);
    };

    const t = (key) => {
        if (dict[lang] && dict[lang][key]) {
            return dict[lang][key];
        }
        if (dict['en'] && dict['en'][key]) {
            return dict['en'][key];
        }
        return key;
    };

    return (
        <LanguageContext.Provider value={{ lang, changeLanguage, t, LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
