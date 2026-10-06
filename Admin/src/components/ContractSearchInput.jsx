import React, { useEffect, useState } from 'react';
import { MdSearch } from 'react-icons/md';

const ContractSearchInput = ({ value, onChange, onSelect, apiBase, user, status, placeholder }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const term = value.trim();
        if (term.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    status,
                    page: '1',
                    limit: '50',
                    userBrand: user?.brand || '',
                    userRole: user?.role || '',
                    username: user?.username || '',
                    isImmutable: user?.isImmutable ? 'true' : 'false',
                    search: term
                });
                const response = await fetch(`${apiBase}/contracts?${params.toString()}`, { signal: controller.signal });
                if (!response.ok) throw new Error(`Search failed (${response.status})`);
                const result = await response.json();
                setSuggestions(result.data || []);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Contract autocomplete error:', error);
                    setSuggestions([]);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [apiBase, status, user, value]);

    return (
        <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
            <input
                type="search"
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-52 rounded-[5px] border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
            {isOpen && value.trim().length >= 2 && (loading || suggestions.length > 0) && (
                <div className="absolute left-0 top-full z-[100] mt-1 max-h-80 w-80 overflow-y-auto rounded-[5px] border border-slate-200 bg-white py-1 shadow-xl">
                    {loading && suggestions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Searching all matching records...</p>
                    ) : suggestions.map((contract) => (
                        <button
                            key={contract._id || contract.contractId}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                onSelect(contract);
                                setIsOpen(false);
                            }}
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                        >
                            <span className="block truncate text-xs font-bold text-slate-800">
                                {contract.customerNameEn || contract.customerNameKh || 'Unnamed customer'}
                                {contract.customerNameKh && contract.customerNameEn ? ` · ${contract.customerNameKh}` : ''}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                                {[contract.contractId, contract.model, contract.serialNumber].filter(Boolean).join(' · ')}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContractSearchInput;
