import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const theme = 'light';
    
    React.useEffect(() => {
        const body = document.body;
        body.classList.add('light');
        body.classList.remove('dark');
        localStorage.setItem('mdm_theme', 'light');
    }, []);

    const toggleTheme = () => {};

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

