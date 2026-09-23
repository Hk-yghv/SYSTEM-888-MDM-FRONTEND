/**
 * In-Memory & Window Vault Secure Storage
 * Stores sensitive authentication data strictly in memory & encrypted window vault.
 * Keeps Session Storage & Local Storage 100% clean so nothing is exposed in browser DevTools.
 */

const SECRET_SALT = 0x5C;
const VAULT_PREFIX = '__sys_sec_v:';

// In-memory runtime storage
let _memoryVault = {};

const encodeVault = (obj) => {
    try {
        const str = JSON.stringify(obj);
        let xored = '';
        for (let i = 0; i < str.length; i++) {
            xored += String.fromCharCode(str.charCodeAt(i) ^ (SECRET_SALT + (i % 7)));
        }
        return VAULT_PREFIX + btoa(unescape(encodeURIComponent(xored)));
    } catch {
        return '';
    }
};

const decodeVault = (raw) => {
    try {
        if (!raw || typeof raw !== 'string' || !raw.startsWith(VAULT_PREFIX)) return {};
        const b64 = raw.slice(VAULT_PREFIX.length);
        const decoded = decodeURIComponent(escape(atob(b64)));
        let original = '';
        for (let i = 0; i < decoded.length; i++) {
            original += String.fromCharCode(decoded.charCodeAt(i) ^ (SECRET_SALT + (i % 7)));
        }
        return JSON.parse(original) || {};
    } catch {
        return {};
    }
};

// Auto-purge all storage to keep DevTools clean
const purgeStorageTraces = () => {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
        }
        if (typeof localStorage !== 'undefined') {
            const sensitiveKeys = [
                'mdm_token', 'mdm_user', 'recent_login_device', 'show_login_toast',
                '_sys_stk_', '_sys_suk_', '_sys_sdk_', '_sys_stk_t'
            ];
            sensitiveKeys.forEach(k => localStorage.removeItem(k));
        }
    } catch {}
};

// Initialize vault from window.name on load/refresh
const initVault = () => {
    try {
        if (typeof window !== 'undefined' && window.name) {
            _memoryVault = decodeVault(window.name);
        }
    } catch {}
    purgeStorageTraces();
};

initVault();

const syncVault = () => {
    try {
        if (typeof window !== 'undefined') {
            window.name = encodeVault(_memoryVault);
        }
    } catch {}
    purgeStorageTraces();
};

export const setSecureItem = (key, val) => {
    _memoryVault[key] = val;
    syncVault();
};

export const getSecureItem = (key, isJson = false) => {
    if (Object.keys(_memoryVault).length === 0) {
        initVault();
    }
    const val = _memoryVault[key];
    if (val === undefined || val === null) return null;
    if (isJson && typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch {
            return val;
        }
    }
    return val;
};

export const removeSecureItem = (key) => {
    delete _memoryVault[key];
    syncVault();
};

export const clearSecureAuth = () => {
    _memoryVault = {};
    if (typeof window !== 'undefined') {
        window.name = '';
    }
    purgeStorageTraces();
};

export default {
    setSecureItem,
    getSecureItem,
    removeSecureItem,
    clearSecureAuth
};
