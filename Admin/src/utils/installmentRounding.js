export const toCurrencyCents = (value) => {
    const amount = Number(value) || 0;
    return Math.round((amount + Math.sign(amount) * 1e-8) * 100);
};

export const roundPrincipalToCents = (value, mode = 'down') => {
    const cents = (Number(value) || 0) * 100;
    return mode === 'up'
        ? Math.ceil(cents - 1e-8)
        : Math.floor(cents + 1e-8);
};

export const roundMoney = (value) => toCurrencyCents(value) / 100;