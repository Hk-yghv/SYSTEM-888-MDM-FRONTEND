import React, { createContext, useContext, useState, useEffect } from 'react';
import dict from '../json/languages';

const LanguageContext = createContext();

export const LANGUAGES = [
    { code: 'km', label: 'ខ្មែរ', flag: '🇰🇭' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'th', label: 'ไทย', flag: '🇹🇭' },
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'la', label: 'ພາສາລາວ', flag: '🇱🇦' }
];

export const LanguageProvider = ({ children }) => {
    const [lang, setLang] = useState(() => localStorage.getItem('mdm_lang') || 'km');

    const changeLanguage = (code) => {
        setLang(code);
        localStorage.setItem('mdm_lang', code);
    };

    const t = (key, fallback) => {
        if (!key) return '';
        if (dict[lang] && dict[lang][key] !== undefined && dict[lang][key] !== '') {
            return dict[lang][key];
        }
        if (dict['en'] && dict['en'][key] !== undefined && dict['en'][key] !== '') {
            return dict['en'][key];
        }
        if (dict['km'] && dict['km'][key] !== undefined && dict['km'][key] !== '') {
            return dict['km'][key];
        }
        return fallback !== undefined ? fallback : key;
    };

    return (
        <LanguageContext.Provider value={{ lang, changeLanguage, t, LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);

