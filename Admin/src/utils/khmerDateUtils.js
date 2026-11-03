/**
 * Utility functions for Khmer date formatting and daily comment rotation.
 * Timezone: Asia/Phnom_Penh (UTC+7)
 */

export const getKhmerCurrentDateString = (targetDate = new Date()) => {
    const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Phnom_Penh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const parts = formatter.formatToParts(validDate);
    const day = parts.find(p => p.type === 'day')?.value || String(validDate.getDate()).padStart(2, '0');
    const month = parts.find(p => p.type === 'month')?.value || String(validDate.getMonth() + 1).padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || String(validDate.getFullYear());
    return `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ ${year}`;
};

export const isTodayInCambodia = (dateValue) => {
    if (!dateValue) return false;
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    return dateStr === todayStr;
};

export const getCambodiaDateInputValue = (targetDate = new Date()) => {
    const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Phnom_Penh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).formatToParts(date);
    const day = parts.find(part => part.type === 'day')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const year = parts.find(part => part.type === 'year')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
};

export const hasActiveCommentToday = (contract) => {
    if (!contract || !contract.notes || !String(contract.notes).trim()) return false;
    if (contract.commentExpiryMode === 'never') return true;
    if (contract.commentExpiresAt) {
        const expiryDate = new Date(contract.commentExpiresAt);
        if (!Number.isNaN(expiryDate.getTime())) return expiryDate.getTime() > Date.now();
    }
    return isTodayInCambodia(contract.commentDate || contract.updatedAt);
};
