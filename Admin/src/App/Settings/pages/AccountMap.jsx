import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt, FaSearch, FaSyncAlt } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import { getAuthToken } from '../../../utils/authToken';

const REFRESH_INTERVAL_MS = 15_000;

const formatTimestamp = (value) => {
    if (!value) return 'មិនមានប្រវត្តិទីតាំង';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'មិនមានប្រវត្តិទីតាំង';
    return new Intl.DateTimeFormat('km-KH', {
        timeZone: 'Asia/Phnom_Penh',
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const makePopup = (account) => {
    const container = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = account.name || account.username;
    const username = document.createElement('div');
    username.textContent = account.username;
    const status = document.createElement('div');
    status.textContent = account.status === 'Online' ? 'Online' : 'Offline — last known location';
    const updated = document.createElement('div');
    updated.textContent = `ទីតាំងចុងក្រោយ: ${formatTimestamp(account.lastLocation?.timestamp)}`;
    container.append(title, username, status, updated);
    return container;
};

const AccountMap = () => {
    const { API_BASE } = useAuth();
    const mapElementRef = useRef(null);
    const mapRef = useRef(null);
    const markerLayerRef = useRef(null);
    const pathLayerRef = useRef(null);
    const hasFittedInitialBoundsRef = useRef(false);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchAccounts = useCallback(async () => {
        try {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE}/users/account-map`, {
                credentials: 'include',
                cache: 'no-store',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load account locations.');
            setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
            setLastUpdated(new Date());
            setError('');
        } catch (fetchError) {
            console.error('Account map refresh failed:', fetchError);
            setError(fetchError.message || 'Unable to load account locations.');
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        void fetchAccounts();
        const timer = window.setInterval(() => void fetchAccounts(), REFRESH_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [fetchAccounts]);

    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) return undefined;
        const map = L.map(mapElementRef.current, { preferCanvas: true }).setView([12.5657, 104.9915], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        pathLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            map.remove();
            mapRef.current = null;
            markerLayerRef.current = null;
            pathLayerRef.current = null;
        };
    }, []);

    useEffect(() => {
        const markerLayer = markerLayerRef.current;
        const pathLayer = pathLayerRef.current;
        const map = mapRef.current;
        if (!markerLayer || !pathLayer || !map) return;

        markerLayer.clearLayers();
        pathLayer.clearLayers();
        const bounds = [];
        accounts.forEach(account => {
            const history = (Array.isArray(account.locationHistory) ? account.locationHistory : [])
                .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
                .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
            const currentLocation = account.lastLocation;
            if (currentLocation &&
                Number.isFinite(Number(currentLocation.latitude)) &&
                Number.isFinite(Number(currentLocation.longitude))) {
                const coordinates = [Number(currentLocation.latitude), Number(currentLocation.longitude)];
                const marker = L.circleMarker(coordinates, {
                    radius: account.status === 'Online' ? 9 : 7,
                    color: account.status === 'Online' ? '#047857' : '#64748b',
                    weight: 2,
                    fillColor: account.status === 'Online' ? '#10b981' : '#94a3b8',
                    fillOpacity: 0.9
                });
                marker.bindPopup(makePopup(account)).addTo(markerLayer);
                bounds.push(coordinates);
            }
            if (history.length > 1) {
                L.polyline(history.map(location => [Number(location.latitude), Number(location.longitude)]), {
                    color: account.status === 'Online' ? '#10b981' : '#64748b',
                    weight: 3,
                    opacity: 0.6
                }).addTo(pathLayer);
            }
        });

        if (bounds.length && !hasFittedInitialBoundsRef.current) {
            map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
            hasFittedInitialBoundsRef.current = true;
        }
    }, [accounts]);

    const visibleAccounts = useMemo(() => {
        const query = search.trim().toLowerCase();
        return accounts
            .filter(account => !query ||
                `${account.name || ''} ${account.nameKh || ''} ${account.username || ''} ${account.brand || ''}`
                    .toLowerCase().includes(query))
            .sort((left, right) => {
                if (left.status !== right.status) return left.status === 'Online' ? -1 : 1;
                return (left.name || left.username).localeCompare(right.name || right.username);
            });
    }, [accounts, search]);

    const locatedCount = accounts.filter(account => account.lastLocation).length;
    const onlineCount = accounts.filter(account => account.status === 'Online').length;

    return (
        <main className="min-h-full space-y-4 p-3 text-slate-900">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-black text-slate-800">
                        <FaMapMarkerAlt className="text-emerald-600" /> Account Map
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                        Online {onlineCount} · មានប្រវត្តិទីតាំង {locatedCount} · update រៀងរាល់ ១៥ វិនាទី
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">
                        {lastUpdated ? `បានធ្វើបច្ចុប្បន្នភាព ${formatTimestamp(lastUpdated)}` : ''}
                    </span>
                    <button
                        type="button"
                        onClick={() => void fetchAccounts()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </header>

            {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700" role="alert">
                    {error}
                </div>
            )}

            <div className="grid min-h-[65vh] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="min-h-[55vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div ref={mapElementRef} className="h-full min-h-[55vh] w-full" aria-label="Map showing online accounts and last known locations" />
                </section>

                <aside className="flex min-h-[55vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <label className="relative block border-b border-slate-200 p-3">
                        <FaSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="ស្វែងរកគណនី..."
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-emerald-500"
                        />
                    </label>
                    <div className="flex-1 overflow-y-auto">
                        {visibleAccounts.map(account => (
                            <article key={account.userId} className="border-b border-slate-100 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-slate-800">{account.name || account.nameKh || account.username}</p>
                                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{account.username} · {account.brand || account.role}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        account.status === 'Online'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {account.status}
                                    </span>
                                </div>
                                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                                    {account.lastLocation
                                        ? `ទីតាំងចុងក្រោយ: ${formatTimestamp(account.lastLocation.timestamp)}`
                                        : account.locationRequired
                                            ? 'មិនទាន់មានទិន្នន័យទីតាំង'
                                            : 'មិនបានកំណត់ឱ្យចែករំលែកទីតាំង'}
                                </p>
                                {account.lastLocation && (
                                                    <>
                                                        <p className="mt-1 break-all font-mono text-[9px] text-slate-400">
                                                            {Number(account.lastLocation.latitude).toFixed(5)}, {Number(account.lastLocation.longitude).toFixed(5)}
                                                            {account.lastLocation.accuracyMeters ? ` · ±${Math.round(account.lastLocation.accuracyMeters)}m` : ''}
                                                        </p>
                                                        <p className="mt-1 break-all text-[10px] text-slate-500">
                                                            IP: {account.lastLocation.ip || '—'} · {account.lastLocation.deviceInfo || 'Web Browser'}
                                                        </p>
                                                    </>
                                                )}
                                <p className="mt-1 text-[10px] text-slate-400">Last online: {formatTimestamp(account.lastSeen)}</p>
                            </article>
                        ))}
                        {!loading && visibleAccounts.length === 0 && (
                            <p className="p-5 text-center text-xs text-slate-400">មិនមានគណនីត្រូវនឹងការស្វែងរកទេ</p>
                        )}
                    </div>
                    <p className="border-t border-slate-100 px-3 py-2 text-[9px] text-slate-400">
                        Map tiles © OpenStreetMap contributors. ទិន្នន័យទីតាំងចុងក្រោយ និងប្រវត្តិទីតាំងត្រូវបានរក្សាទុករហូតដល់ ៧ ថ្ងៃ។ Browser មិនអាចអាន Wi‑Fi SSID ឬ app ផ្សេងៗបានទេ។
                    </p>
                </aside>
            </div>
        </main>
    );
};

export default AccountMap;
