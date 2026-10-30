const PHNOM_PENH_TIME_ZONE = 'Asia/Phnom_Penh';
const LOCATION_FAILURE_CODES = new Set([
    'LOCATION_REQUIRED',
    'LOCATION_OUTSIDE_ALLOWED_AREA',
    'LOCATION_UNAVAILABLE',
    'LOGIN_TIME_NOT_ALLOWED',
    'LOGIN_TIME_EXPIRED',
    'ACCESS_POLICY_CHANGED'
]);

const getCambodiaDateParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: PHNOM_PENH_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const getLoginWindowEnd = (accessPolicy = {}, now = new Date()) => {
    const schedule = accessPolicy.loginSchedule;
    if (!schedule?.enabled) return null;

    const parts = getCambodiaDateParts(now);
    const day = DAY_INDEX[parts.weekday];
    const currentMinute = Number(parts.hour) * 60 + Number(parts.minute);
    const activeEnds = (Array.isArray(schedule.windows) ? schedule.windows : [])
        .filter((window) => {
            if (!Array.isArray(window.days) || !window.days.includes(day)) return false;
            const [startHour, startMinute] = String(window.start || '').split(':').map(Number);
            const [endHour, endMinute] = String(window.end || '').split(':').map(Number);
            const start = startHour * 60 + startMinute;
            const end = endHour * 60 + endMinute;
            return Number.isFinite(start) && Number.isFinite(end) && start < end &&
                currentMinute >= start && currentMinute < end;
        })
        .map((window) => {
            const [endHour, endMinute] = window.end.split(':').map(Number);
            return new Date(
                now.getTime() +
                (endHour * 60 + endMinute - currentMinute) * 60_000 -
                now.getSeconds() * 1000 -
                now.getMilliseconds()
            );
        });

    return activeEnds.length ? new Date(Math.max(...activeEnds.map((date) => date.getTime()))) : null;
};

export const getAccessPolicyFailure = (accessPolicy = {}, location, now = new Date()) => {
    const windowEnd = getLoginWindowEnd(accessPolicy, now);
    if (accessPolicy.loginSchedule?.enabled && !windowEnd) {
        return { code: 'LOGIN_TIME_NOT_ALLOWED', message: 'Login is not allowed at this time.' };
    }

    if (accessPolicy.locationRequired) {
        const latitude = location?.latitude === '' || location?.latitude == null ? NaN : Number(location.latitude);
        const longitude = location?.longitude === '' || location?.longitude == null ? NaN : Number(location.longitude);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            return { code: 'LOCATION_REQUIRED', message: 'Enable device location and try again.' };
        }

        const allowedLocations = (Array.isArray(accessPolicy.locations) ? accessPolicy.locations : [])
            .filter(allowed => allowed.enabled !== false);
        if (!allowedLocations.length) {
            return { code: 'LOCATION_REQUIRED', message: 'No allowed locations are configured for this account.' };
        }

        const withinAllowedRadius = allowedLocations.some((allowed) => {
            const distance = getDistanceMeters(latitude, longitude, Number(allowed.latitude), Number(allowed.longitude));
            return Number.isFinite(distance) && distance <= Number(allowed.radiusMeters);
        });
        if (!withinAllowedRadius) {
            return { code: 'LOCATION_OUTSIDE_ALLOWED_AREA', message: 'This account cannot be used from the current location.' };
        }
    }

    return { code: null, windowEnd };
};

export const getDistanceMeters = (latitudeA, longitudeA, latitudeB, longitudeB) => {
    if (![latitudeA, longitudeA, latitudeB, longitudeB].every(Number.isFinite)) return Infinity;
    const radians = (degrees) => degrees * Math.PI / 180;
    const deltaLatitude = radians(latitudeB - latitudeA);
    const deltaLongitude = radians(longitudeB - longitudeA);
    const haversine = Math.sin(deltaLatitude / 2) ** 2 +
        Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) *
        Math.sin(deltaLongitude / 2) ** 2;
    return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const normalizeAccessPolicy = (value) => {
    const invalidPolicy = (message) => Object.assign(new Error(message), { code: 'INVALID_ACCESS_POLICY' });
    const policy = value && typeof value === 'object' ? value : {};
    const locationRequired = Boolean(policy.locationRequired);
    const rawLocations = Array.isArray(policy.locations) ? policy.locations : [];
    if (rawLocations.length > 50) throw invalidPolicy('You can configure up to 50 allowed locations.');

    const locations = rawLocations.map((location) => {
        const latitude = location.latitude === '' || location.latitude == null ? NaN : Number(location.latitude);
        const longitude = location.longitude === '' || location.longitude == null ? NaN : Number(location.longitude);
        const radiusMeters = Number(location.radiusMeters);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw invalidPolicy('Each allowed location needs valid latitude and longitude coordinates.');
        }
        if (!Number.isFinite(radiusMeters) || radiusMeters < 1 || radiusMeters > 100_000) {
            throw invalidPolicy('Location radius must be between 1 and 100000 meters.');
        }
        return {
            name: String(location.name || '').trim().slice(0, 100),
            latitude,
            longitude,
            radiusMeters,
            enabled: location.enabled !== false
        };
    });
    if (locationRequired && locations.length === 0) {
        throw invalidPolicy('Add at least one allowed location or disable the location requirement.');
    }

    const rawSchedule = policy.loginSchedule && typeof policy.loginSchedule === 'object'
        ? policy.loginSchedule
        : {};
    const rawWindows = Array.isArray(rawSchedule.windows) ? rawSchedule.windows : [];
    if (rawWindows.length > 50) throw invalidPolicy('You can configure up to 50 login time windows.');
    const windows = rawWindows.map((window) => {
        const days = [...new Set((Array.isArray(window.days) ? window.days : []).map(Number))];
        if (!days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
            throw invalidPolicy('Select at least one valid weekday for each login time window.');
        }
        const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
        if (!timePattern.test(window.start) || !timePattern.test(window.end) || window.start >= window.end) {
            throw invalidPolicy('Each login time window must have a valid start time before its end time.');
        }
        return { days, start: window.start, end: window.end };
    });
    if (rawSchedule.enabled && windows.length === 0) {
        throw invalidPolicy('Add at least one login time window or disable the login schedule.');
    }

    return {
        locationRequired,
        locations,
        loginSchedule: {
            enabled: Boolean(rawSchedule.enabled),
            windows
        }
    };
};

export const logAccessPolicyFailure = async (recordLoginLog, details, failure) => {
    if (!failure?.code || !LOCATION_FAILURE_CODES.has(failure.code)) return;
    await recordLoginLog({
        ...details,
        status: 'Failed',
        reason: failure.code
    });
};
