import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'system_mdm_32byte_secret_key_encrypt_2026!').digest();

export const encryptText = (text) => {
    if (text === null || text === undefined || text === '') return text;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
        let encrypted = cipher.update(String(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (err) {
        console.error('Encryption error:', err);
        return text;
    }
};

export const decryptText = (encryptedText) => {
    if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) return encryptedText;
    try {
        const [ivHex, encryptedHex] = encryptedText.split(':');
        if (!ivHex || !encryptedHex) return encryptedText;
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        // If it's plain text or decryption fails, return original
        return encryptedText;
    }
};
