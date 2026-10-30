import React from 'react';

const WEEKDAYS = [
    { value: 1, label: 'ចន្ទ' },
    { value: 2, label: 'អង្គារ' },
    { value: 3, label: 'ពុធ' },
    { value: 4, label: 'ព្រហស្បតិ៍' },
    { value: 5, label: 'សុក្រ' },
    { value: 6, label: 'សៅរ៍' },
    { value: 0, label: 'អាទិត្យ' }
];

const AccountAccessPolicyEditor = ({ value, onChange }) => {
    const policyValue = value || {};
    const policy = {
        ...policyValue,
        locationRequired: Boolean(policyValue.locationRequired),
        locations: Array.isArray(policyValue.locations) ? policyValue.locations : [],
        loginSchedule: {
            enabled: Boolean(policyValue.loginSchedule?.enabled),
            windows: Array.isArray(policyValue.loginSchedule?.windows) ? policyValue.loginSchedule.windows : []
        }
    };
    const updatePolicy = (updates) => onChange({ ...policy, ...updates });
    const updateSchedule = (updates) => updatePolicy({
        loginSchedule: { ...policy.loginSchedule, ...updates }
    });

    const addLocation = () => updatePolicy({
        locations: [...policy.locations, { name: '', latitude: '', longitude: '', radiusMeters: 100 }]
    });
    const updateLocation = (index, updates) => updatePolicy({
        locations: policy.locations.map((location, locationIndex) =>
            locationIndex === index ? { ...location, ...updates } : location
        )
    });
    const addWindow = () => updateSchedule({
        windows: [...policy.loginSchedule.windows, { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }]
    });
    const updateWindow = (index, updates) => updateSchedule({
        windows: policy.loginSchedule.windows.map((window, windowIndex) =>
            windowIndex === index ? { ...window, ...updates } : window
        )
    });

    return (
        <section className="sm:col-span-2 rounded-xl border border-sky-800/60 bg-slate-950/70 p-4 space-y-4">
            <div>
                <h3 className="text-sm font-bold text-sky-300">កំណត់ទីតាំង និងម៉ោងប្រើប្រាស់</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Location ត្រូវការ HTTPS និងការអនុញ្ញាតពី browser។ ប្រព័ន្ធនឹង logout បើទីតាំងបាត់ ឬខុសតំបន់ដែលអនុញ្ញាត។
                </p>
            </div>

            <label className="flex items-start gap-3 text-xs font-semibold text-slate-200">
                <input
                    type="checkbox"
                    checked={Boolean(policy.locationRequired)}
                    onChange={event => updatePolicy({ locationRequired: event.target.checked })}
                    className="mt-0.5 accent-emerald-500"
                />
                <span>តម្រូវឱ្យបើក Location ដើម្បីប្រើ account</span>
            </label>

            {policy.locationRequired && (
                <div className="space-y-3">
                    {policy.locations.map((location, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-6 gap-2 rounded-lg border border-slate-800 p-3">
                            <input
                                value={location.name}
                                onChange={event => updateLocation(index, { name: event.target.value })}
                                placeholder="ឈ្មោះទីតាំង"
                                className="sm:col-span-2 h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                            />
                            <input
                                type="number"
                                min="-90"
                                max="90"
                                step="any"
                                value={location.latitude}
                                onChange={event => updateLocation(index, { latitude: event.target.value })}
                                placeholder="Latitude"
                                aria-label="Latitude"
                                className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                            />
                            <input
                                type="number"
                                min="-180"
                                max="180"
                                step="any"
                                value={location.longitude}
                                onChange={event => updateLocation(index, { longitude: event.target.value })}
                                placeholder="Longitude"
                                aria-label="Longitude"
                                className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="100000"
                                    value={location.radiusMeters}
                                    onChange={event => updateLocation(index, { radiusMeters: event.target.value })}
                                    aria-label="Radius in meters"
                                    className="h-9 min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                                />
                                <span className="self-center text-[10px] text-slate-400">ម៉ែត្រ</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => updatePolicy({ locations: policy.locations.filter((_, locationIndex) => locationIndex !== index) })}
                                className="h-9 rounded-lg border border-rose-900/70 px-2 text-[11px] font-bold text-rose-300 hover:bg-rose-950/50"
                            >
                                ដកចេញ
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addLocation}
                        className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/50"
                    >
                        + បន្ថែមទីតាំង (អនុញ្ញាតទីតាំងណាមួយក្នុងបញ្ជី)
                    </button>
                </div>
            )}

            <div className="border-t border-slate-800 pt-4 space-y-3">
                <label className="flex items-start gap-3 text-xs font-semibold text-slate-200">
                    <input
                        type="checkbox"
                        checked={Boolean(policy.loginSchedule.enabled)}
                        onChange={event => updateSchedule({ enabled: event.target.checked })}
                        className="mt-0.5 accent-emerald-500"
                    />
                    <span>កំណត់ថ្ងៃ និងម៉ោងដែលអាច login (ម៉ោងកម្ពុជា)</span>
                </label>

                {policy.loginSchedule.enabled && (
                    <div className="space-y-3">
                        {policy.loginSchedule.windows.map((window, index) => (
                            <div key={index} className="rounded-lg border border-slate-800 p-3 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {WEEKDAYS.map(day => (
                                        <label key={day.value} className="flex items-center gap-1 text-[11px] text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={window.days.includes(day.value)}
                                                onChange={event => updateWindow(index, {
                                                    days: event.target.checked
                                                        ? [...window.days, day.value]
                                                        : window.days.filter(value => value !== day.value)
                                                })}
                                                className="accent-emerald-500"
                                            />
                                            {day.label}
                                        </label>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="time"
                                        value={window.start}
                                        onChange={event => updateWindow(index, { start: event.target.value })}
                                        aria-label="Login window start"
                                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                                    />
                                    <span className="text-slate-500">ដល់</span>
                                    <input
                                        type="time"
                                        value={window.end}
                                        onChange={event => updateWindow(index, { end: event.target.value })}
                                        aria-label="Login window end"
                                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => updateSchedule({
                                            windows: policy.loginSchedule.windows.filter((_, windowIndex) => windowIndex !== index)
                                        })}
                                        className="h-9 rounded-lg border border-rose-900/70 px-3 text-[11px] font-bold text-rose-300 hover:bg-rose-950/50"
                                    >
                                        ដកចេញ
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addWindow}
                            className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/50"
                        >
                            + បន្ថែមពេលវេលា
                        </button>
                        <p className="text-[11px] text-amber-300">
                            ពេលផុតម៉ោង អ្នកប្រើមាន ១៥ នាទីដើម្បីចេញពីប្រព័ន្ធ។ ប្រព័ន្ធនឹងបង្ហាញសារ និង logout ដោយស្វ័យប្រវត្តិ។
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default AccountAccessPolicyEditor;
