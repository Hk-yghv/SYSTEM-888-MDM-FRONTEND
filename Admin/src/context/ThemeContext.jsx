import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const PRESET_THEMES = {
    default: {
        name: 'Default MDM',
        mode: 'default',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#f4f6f8',
        bgCard: '#ffffff',
        textPrimary: '#0f172a',
        textSecondary: '#64748b',
        accentColor: '#4f46e5',
        sidebarBg: '#f8fafc',
        headerBg: '#ffffff',
        borderColor: '#cbd5e1',
        cardOpacity: 90,
        bgOpacity: 65,
        glassBlur: 12,
        bgImage: '',
        bgVideo: ''
    },
    dark: {
        name: 'Dark Mode',
        mode: 'dark',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#0f172a',
        bgCard: '#1e293b',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        accentColor: '#6366f1',
        sidebarBg: '#0f172a',
        headerBg: '#1e293b',
        borderColor: '#334155',
        cardOpacity: 85,
        bgOpacity: 70,
        glassBlur: 14,
        bgImage: '',
        bgVideo: ''
    },
    ocean: {
        name: 'Ocean Deep',
        mode: 'ocean',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#0b192c',
        bgCard: '#1e3e62',
        textPrimary: '#f1f5f9',
        textSecondary: '#94a3b8',
        accentColor: '#008bbf',
        sidebarBg: '#001f3f',
        headerBg: '#1e3e62',
        borderColor: '#1e40af',
        cardOpacity: 80,
        bgOpacity: 75,
        glassBlur: 16,
        bgImage: '',
        bgVideo: ''
    },
    sunset: {
        name: 'Sunset Rose',
        mode: 'sunset',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#18181b',
        bgCard: '#27272a',
        textPrimary: '#f4f4f5',
        textSecondary: '#a1a1aa',
        accentColor: '#f43f5e',
        sidebarBg: '#18181b',
        headerBg: '#27272a',
        borderColor: '#3f3f46',
        cardOpacity: 85,
        bgOpacity: 70,
        glassBlur: 14,
        bgImage: '',
        bgVideo: ''
    },
    emerald: {
        name: 'Emerald Mint',
        mode: 'emerald',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#064e3b',
        bgCard: '#065f46',
        textPrimary: '#ecfdf5',
        textSecondary: '#a7f3d0',
        accentColor: '#10b981',
        sidebarBg: '#022c22',
        headerBg: '#065f46',
        borderColor: '#047857',
        cardOpacity: 85,
        bgOpacity: 75,
        glassBlur: 12,
        bgImage: '',
        bgVideo: ''
    },
    cyberpunk: {
        name: 'Cyberpunk Neon',
        mode: 'cyberpunk',
        bgType: 'color',
        showDashboardBg: true,
        bgPrimary: '#09090b',
        bgCard: '#18181b',
        textPrimary: '#f4f4f5',
        textSecondary: '#a1a1aa',
        accentColor: '#ec4899',
        sidebarBg: '#09090b',
        headerBg: '#18181b',
        borderColor: '#831843',
        cardOpacity: 80,
        bgOpacity: 80,
        glassBlur: 16,
        bgImage: '',
        bgVideo: ''
    }
};

const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
    if (hex.startsWith('rgba') || hex.startsWith('hsla')) return hex;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ThemeProvider = ({ children }) => {
    let user = null;
    try {
        const auth = useAuth();
        user = auth ? auth.user : null;
    } catch {
        user = null;
    }

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
        const opacity = (theme.cardOpacity ?? 85) / 100;
        const isMediaBg = theme.bgType === 'image' || theme.bgType === 'video';
        // When image or video background is active, enforce crystal-clear glass translucency (0.35 opacity max)
        const cardAlpha = isMediaBg ? Math.min(opacity, 0.35) : opacity;

        root.style.setProperty('--app-bg', theme.bgPrimary || '#f4f6f8');
        root.style.setProperty('--app-card', hexToRgba(theme.bgCard || '#ffffff', cardAlpha));
        root.style.setProperty('--app-text', theme.textPrimary || '#0f172a');
        root.style.setProperty('--app-text-sub', theme.textSecondary || '#64748b');
        root.style.setProperty('--app-accent', theme.accentColor || '#4f46e5');
        root.style.setProperty('--app-th-color', theme.tableHeaderTextColor || theme.accentColor || '#6366f1');
        root.style.setProperty('--app-sidebar', hexToRgba(theme.sidebarBg || '#ffffff', cardAlpha));
        root.style.setProperty('--app-header', hexToRgba(theme.headerBg || '#ffffff', cardAlpha));
        root.style.setProperty('--app-border', theme.borderColor || '#cbd5e1');
        root.style.setProperty('--app-card-opacity', cardAlpha.toString());
        root.style.setProperty('--app-bg-opacity', ((theme.bgOpacity ?? 85) / 100).toString());
        root.style.setProperty('--app-glass-blur', `${theme.glassBlur ?? 14}px`);
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
