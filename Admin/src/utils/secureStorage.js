/**
 * In-Memory & Window Vault Secure Storage
 * Stores sensitive authentication data in memory plus encrypted session-scoped persistence.
 * Keeps plain localStorage clean while preserving auth across reloads.
 */

const SECRET_SALT = 0x5C;
const VAULT_PREFIX = '__sys_sec_v:';
const SESSION_VAULT_KEY = '__sys_session_v:';
const LEGACY_AUTH_KEYS = ['mdm_token', 'mdm_user'];

// In-memory runtime storage
let _memoryVault = {};

const readLegacyStorageItem = (storage, key) => {
    try {
        if (!storage || typeof storage.getItem !== 'function') return null;
        const raw = storage.getItem(key);
        return raw === null ? null : raw;
    } catch {
        return null;
    }
};

const readLegacyAuthFallback = () => {
    const legacy = {};
    const storages = [];
    if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
    if (typeof localStorage !== 'undefined') storages.push(localStorage);

    for (const storage of storages) {
        for (const key of LEGACY_AUTH_KEYS) {
            const raw = readLegacyStorageItem(storage, key);
            if (raw === null || raw === '') continue;
            legacy[key] = raw;
        }
    }
    return legacy;
};

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

const readSessionVault = () => {
    try {
        if (typeof sessionStorage === 'undefined') return {};
        const raw = sessionStorage.getItem(SESSION_VAULT_KEY);
        return raw ? decodeVault(raw) : {};
    } catch {
        return {};
    }
};

const writeSessionVault = (vault) => {
    try {
        if (typeof sessionStorage !== 'undefined') {
            const encoded = encodeVault(vault);
            if (encoded) {
                sessionStorage.setItem(SESSION_VAULT_KEY, encoded);
            } else {
                sessionStorage.removeItem(SESSION_VAULT_KEY);
            }
        }
    } catch {}
};

// Auto-purge legacy traces only from localStorage to avoid clobbering the active session
const purgeStorageTraces = () => {
    try {
        if (typeof localStorage !== 'undefined') {
            const sensitiveKeys = [
                'mdm_token', 'mdm_user', 'recent_login_device', 'show_login_toast',
                '_sys_stk_', '_sys_suk_', '_sys_sdk_', '_sys_stk_t'
            ];
            sensitiveKeys.forEach(k => localStorage.removeItem(k));
        }
    } catch {}
};

// Initialize vault from window.name, sessionStorage, and a compatibility fallback on load/refresh
const initVault = () => {
    try {
        const restored = {};
        if (typeof window !== 'undefined' && window.name) {
            Object.assign(restored, decodeVault(window.name));
        }
        const sessionVault = readSessionVault();
        if (Object.keys(sessionVault).length > 0) {
            Object.assign(restored, sessionVault);
        }
        const legacyFallback = readLegacyAuthFallback();
        if (Object.keys(legacyFallback).length > 0) {
            Object.assign(restored, legacyFallback);
        }
        _memoryVault = restored;
    } catch {}
    purgeStorageTraces();
};

initVault();

const syncVault = () => {
    try {
        if (typeof window !== 'undefined') {
            window.name = encodeVault(_memoryVault);
        }
        writeSessionVault(_memoryVault);
    } catch {}
    purgeStorageTraces();
};

export const setSecureItem = (key, val) => {
    _memoryVault[key] = val;
    try {
        if (typeof sessionStorage !== 'undefined' && LEGACY_AUTH_KEYS.includes(key)) {
            sessionStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        }
        if (typeof localStorage !== 'undefined' && LEGACY_AUTH_KEYS.includes(key)) {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        }
    } catch {}
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
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_VAULT_KEY);
        LEGACY_AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
    }
    if (typeof localStorage !== 'undefined') {
        LEGACY_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
    }
    purgeStorageTraces();
};

export default {
    setSecureItem,
    getSecureItem,
    removeSecureItem,
    clearSecureAuth
};
