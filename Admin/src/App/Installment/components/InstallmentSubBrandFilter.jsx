import React, { useEffect, useMemo, useState } from 'react';

export const useInstallmentSubBrand = (user, requestedSubBrand = '') => {
    const availableSubBrands = useMemo(() => (
        Array.isArray(user?.subBrands)
            ? [...new Set(user.subBrands.map(value => String(value || '').trim()).filter(Boolean))]
            : []
    ), [user?.subBrands]);
    const [selectedSubBrand, setSelectedSubBrand] = useState(() => (
        requestedSubBrand || availableSubBrands[0] || ''
    ));

    useEffect(() => {
        setSelectedSubBrand(current => {
            if (requestedSubBrand && (!availableSubBrands.length || availableSubBrands.includes(requestedSubBrand))) {
                return requestedSubBrand;
            }
            if (current === 'All' || availableSubBrands.includes(current)) return current;
            return availableSubBrands[0] || '';
        });
    }, [availableSubBrands, requestedSubBrand]);

    return { availableSubBrands, selectedSubBrand, setSelectedSubBrand };
};

export const addInstallmentSubBrandParams = (params, user, selectedSubBrand) => {
    if (Array.isArray(user?.subBrands) && user.subBrands.length > 0) {
        params.set('userSubBrands', user.subBrands.join(','));
    }
    if (selectedSubBrand) params.set('subBrand', selectedSubBrand);
};

const InstallmentSubBrandFilter = ({ availableSubBrands, selectedSubBrand, onChange, t }) => {
    if (availableSubBrands.length < 2) return null;

    return (
        <select
            value={selectedSubBrand || availableSubBrands[0]}
            onChange={event => onChange(event.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-[5px] text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            aria-label={t('subBrand')}
        >
            <option value="All">{t('all')}</option>
            {availableSubBrands.map(subBrand => (
                <option key={subBrand} value={subBrand}>{subBrand}</option>
            ))}
        </select>
    );
};

export default InstallmentSubBrandFilter;
