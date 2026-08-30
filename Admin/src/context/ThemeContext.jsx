import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const PRESET_THEMES = {
    default: {
        name: 'Default MDM (ដើម)',
        mode: 'default',
        bgPrimary: '#f4f6f8',
        bgCard: '#ffffff',
        textPrimary: '#0f172a',
        textSecondary: '#64748b',
        accentColor: '#4f46e5',
        sidebarBg: '#f8fafc',
        headerBg: '#ffffff'
    },
    dark: {
        name: 'Dark Mode (ងងឹត)',
        mode: 'dark',
        bgPrimary: '#0f172a',
        bgCard: '#1e293b',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        accentColor: '#6366f1',
        sidebarBg: '#0f172a',
        headerBg: '#1e293b'
    },
    ocean: {
        name: 'Ocean Deep (សមុទ្រ)',
        mode: 'ocean',
        bgPrimary: '#0b192c',
        bgCard: '#1e3e62',
        textPrimary: '#f1f5f9',
        textSecondary: '#94a3b8',
        accentColor: '#008bbf',
        sidebarBg: '#001f3f',
        headerBg: '#1e3e62'
    },
    sunset: {
        name: 'Sunset Rose (ថ្ងៃលិច)',
        mode: 'sunset',
        bgPrimary: '#18181b',
        bgCard: '#27272a',
        textPrimary: '#f4f4f5',
        textSecondary: '#a1a1aa',
        accentColor: '#f43f5e',
        sidebarBg: '#18181b',
        headerBg: '#27272a'
    },
    emerald: {
        name: 'Emerald Mint (បៃតង)',
        mode: 'emerald',
        bgPrimary: '#064e3b',
        bgCard: '#065f46',
        textPrimary: '#ecfdf5',
        textSecondary: '#a7f3d0',
        accentColor: '#10b981',
        sidebarBg: '#022c22',
        headerBg: '#065f46'
    },
    cyberpunk: {
        name: 'Cyberpunk Neon (ស៊ីប័រ)',
        mode: 'cyberpunk',
        bgPrimary: '#09090b',
        bgCard: '#18181b',
        textPrimary: '#f4f4f5',
        textSecondary: '#a1a1aa',
        accentColor: '#ec4899',
        sidebarBg: '#09090b',
        headerBg: '#18181b'
    }
};

export const ThemeProvider = ({ children }) => {
    const { user } = useAuth();
    const storageKey = `mdm_theme_${user?.username || 'guest'}`;

    const [theme, setTheme] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : PRESET_THEMES.default;
        } catch {
            return PRESET_THEMES.default;
        }
    });

    // Reload user-specific theme whenever logged-in user changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setTheme(JSON.parse(saved));
            } else {
                setTheme(PRESET_THEMES.default);
            }
        } catch {
            setTheme(PRESET_THEMES.default);
        }
    }, [user?.username]);

    // Dynamically set CSS Custom Properties on document root
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--app-bg', theme.bgPrimary || '#f4f6f8');
        root.style.setProperty('--app-card', theme.bgCard || '#ffffff');
        root.style.setProperty('--app-text', theme.textPrimary || '#0f172a');
        root.style.setProperty('--app-text-sub', theme.textSecondary || '#64748b');
        root.style.setProperty('--app-accent', theme.accentColor || '#4f46e5');
        root.style.setProperty('--app-sidebar', theme.sidebarBg || '#ffffff');
        root.style.setProperty('--app-header', theme.headerBg || '#ffffff');
    }, [theme]);

    const updateTheme = (newTheme) => {
        setTheme(newTheme);
        try {
            localStorage.setItem(storageKey, JSON.stringify(newTheme));
        } catch {}
    };

    const applyPreset = (presetKey) => {
        const selectedPreset = PRESET_THEMES[presetKey] || PRESET_THEMES.default;
        updateTheme(selectedPreset);
    };

    const resetDefault = () => {
        updateTheme(PRESET_THEMES.default);
    };

    return (
        <ThemeContext.Provider value={{ theme, updateTheme, applyPreset, resetDefault, PRESET_THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
