import React, { useEffect, useState } from 'react';
import { MdSearch } from 'react-icons/md';

const getResultRows = (result) => {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.records)) return result.records;
    if (Array.isArray(result?.rows)) return result.rows;
    return [];
};

const DatabaseSearchInput = ({
    apiBase,
    endpoint,
    params = {},
    value,
    placeholder = 'Search records...',
    onChange,
    onSelect,
    getLabel = (record) => record.name || record.customerName || record.customerNameEn || record.staffName || record.username || record.description || record._id || '',
    getDescription = (record) => [record.customerNameKh, record.phone, record.model, record.serialNumber, record.contractId].filter(Boolean).join(' · '),
    className = ''
}) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const paramsKey = JSON.stringify(params);

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
                const query = new URLSearchParams({
                    ...JSON.parse(paramsKey),
                    page: '1',
                    limit: '50',
                    search: term
                });
                const url = `${apiBase.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}?${query.toString()}`;
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error(`Search failed (${response.status})`);
                const result = await response.json();
                setSuggestions(getResultRows(result));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Database autocomplete error:', error);
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
    }, [apiBase, endpoint, paramsKey, value]);

    return (
        <div className={`relative ${className}`}>
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
                className="w-full rounded-[5px] border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
            {isOpen && value.trim().length >= 2 && (loading || suggestions.length > 0) && (
                <div className="absolute left-0 top-full z-[100] mt-1 max-h-80 w-80 overflow-y-auto rounded-[5px] border border-slate-200 bg-white py-1 shadow-xl">
                    {loading && suggestions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Searching all matching records...</p>
                    ) : suggestions.map((record, index) => {
                        const label = String(getLabel(record) || 'Unnamed record');
                        const description = getDescription(record);
                        return (
                            <button
                                key={record._id || record.id || record.transactionId || record.contractId || record.logId || index}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onSelect(record);
                                    setIsOpen(false);
                                }}
                                className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                            >
                                <span className="block truncate text-xs font-bold text-slate-800">{label}</span>
                                {description && <span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DatabaseSearchInput;
