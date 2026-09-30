export const toCurrencyCents = (value) => {
    const amount = Number(value) || 0;
    return Math.round((amount + Math.sign(amount) * 1e-8) * 100);
};

export const roundPrincipalToCents = (value) => {
    const cents = (Number(value) || 0) * 100;
    return Math.round(cents + 1e-8);
};

export const roundMoney = (value) => toCurrencyCents(value) / 100;