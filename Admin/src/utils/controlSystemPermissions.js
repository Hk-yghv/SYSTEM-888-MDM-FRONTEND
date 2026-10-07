export const CONTROL_SYSTEM_PATH = '/settings/control-system';

export const CONTROL_SYSTEM_SECTIONS = [
    { id: 'lock-screen', path: `${CONTROL_SYSTEM_PATH}/device-security`, label: 'Device & Security' },
    { id: 'penalties', path: `${CONTROL_SYSTEM_PATH}/finance`, label: 'Finance' },
    { id: 'roles', path: `${CONTROL_SYSTEM_PATH}/access-control`, label: 'Access Control' },
    { id: 'follow-up', path: `${CONTROL_SYSTEM_PATH}/workflows`, label: 'Workflows' },
    { id: 'dropdowns', path: `${CONTROL_SYSTEM_PATH}/system-data`, label: 'System Data' },
    { id: 'brands', path: `${CONTROL_SYSTEM_PATH}/organization`, label: 'Organization' }
];
