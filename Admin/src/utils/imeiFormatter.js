
export const formatIMEI = (imei) => {
    if (!imei || imei === '—' || imei === '-') return '—';
    const str = String(imei).trim();
    const clean = str.replace(/[^0-9A-Za-z]/g, '');
    if (clean.length === 15) {
        return `${clean.slice(0, 2)} ${clean.slice(2, 8)} ${clean.slice(8, 14)} ${clean.slice(14)}`;
    }
    if (clean.length === 14) {
        return `${clean.slice(0, 2)} ${clean.slice(2, 8)} ${clean.slice(8, 14)}`;
    }
    return str;
};

export default formatIMEI;
