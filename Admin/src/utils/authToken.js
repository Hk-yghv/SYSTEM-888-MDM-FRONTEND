/**
 * authToken.js - Robust Client-Side Authentication Token Management
 */

export const setAuthToken = (token) => {
    if (typeof window === 'undefined') return;
    try {
        if (token) {
            localStorage.setItem('mdm_token', token);
            sessionStorage.setItem('mdm_token', token);
        } else {
            localStorage.removeItem('mdm_token');
            sessionStorage.removeItem('mdm_token');
        }
    } catch { }
};

export const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem('mdm_token') || sessionStorage.getItem('mdm_token') || null;
    } catch {
        return null;
    }
};

export const clearAuthToken = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem('mdm_token');
        sessionStorage.removeItem('mdm_token');
    } catch { }
};
