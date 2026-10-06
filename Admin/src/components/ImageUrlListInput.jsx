import { useState } from 'react';

const ImageUrlListInput = ({ onAddUrls, className = '' }) => {
    const [value, setValue] = useState('');

    const addUrls = () => {
        const urls = [...new Set(value.split(/\r?\n/).map(url => url.trim()).filter(Boolean))];
        if (!urls.length) return;
        onAddUrls(urls);
        setValue('');
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            <textarea
                rows={2}
                value={value}
                onChange={event => setValue(event.target.value)}
                onKeyDown={event => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        addUrls();
                    }
                }}
                placeholder="Paste image links (one URL per line)"
                aria-label="Image links"
                className="w-full rounded-[5px] border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
            />
            <button
                type="button"
                onClick={addUrls}
                disabled={!value.trim()}
                className="rounded-[5px] bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Add image links
            </button>
        </div>
    );
};

export default ImageUrlListInput;
