const memoryVault = new Map();
const LEGACY_STORAGE_KEYS = [
    '__sys_session_v:',
    '_sys_stk_',
    '_sys_suk_',
    '_sys_sdk_',
    '_sys_stk_t'
];
const LEGACY_VAULT_PREFIX = '__sys_sec_v:';

export { setAuthToken, getAuthToken, clearAuthToken } from './authToken.js';

const purgeLegacyAuthStorage = () => {
    if (typeof window === 'undefined') return;
    for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of LEGACY_STORAGE_KEYS) {
            storage.removeItem(key);
        }
    }
    if (window.name.startsWith(LEGACY_VAULT_PREFIX)) {
        window.name = '';
    }
};

try {
    purgeLegacyAuthStorage();
} catch (error) {
    console.warn('Unable to remove legacy browser auth storage:', error);
}

export const setSecureItem = (key, value) => {
    memoryVault.set(key, value);
};

export const getSecureItem = (key, isJson = false) => {
    const value = memoryVault.get(key);
    if (value === undefined || value === null) return null;
    if (isJson && typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
};

export const removeSecureItem = (key) => {
    memoryVault.delete(key);
};

export const clearSecureAuth = () => {
    memoryVault.clear();
    try {
        purgeLegacyAuthStorage();
    } catch (error) {
        console.warn('Unable to remove legacy browser auth storage:', error);
    }
};

export default {
    setSecureItem,
    getSecureItem,
    removeSecureItem,
    clearSecureAuth
};
