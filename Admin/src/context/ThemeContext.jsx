import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('mdm_theme') || 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (theme === 'light') {
            body.classList.add('light');
            body.classList.remove('dark');
        } else {
            body.classList.add('dark');
            body.classList.remove('light');
        }
        localStorage.setItem('mdm_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
