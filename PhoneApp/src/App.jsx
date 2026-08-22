import React, { useState } from 'react';
import BrandSelect from './pages/BrandSelect';
import Login from './pages/Login';
import MobileDashboard from './pages/MobileDashboard';

const getApiBase = () => {
    if (typeof window !== 'undefined') {
        const savedUrl = localStorage.getItem('mdm_custom_api_url');
        if (savedUrl && savedUrl.trim()) return savedUrl.trim();
    }

    // Explicit production / backend environment URL
    if (import.meta.env.VITE_API_BACKEND) {
        return import.meta.env.VITE_API_BACKEND;
    }

    // Only fallback to localhost if running in local web browser (NOT inside Capacitor native app)
    if (typeof window !== 'undefined' && window.location.hostname) {
        const host = window.location.hostname;
        const isCapacitorNative = window.Capacitor?.isNativePlatform() || window.location.protocol === 'capacitor:';
        if (!isCapacitorNative && (host === 'localhost' || host === '127.0.0.1')) {
            return `http://${host}:5000/api`;
        }
    }

    return 'https://system-mdm.onrender.com/api';
};

const App = () => {
    const [apiBase, setApiBase] = useState(getApiBase());
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [user, setUser] = useState(() => {
        const saved = sessionStorage.getItem('phone_mdm_user');
        return saved ? JSON.parse(saved) : null;
    });

    const handleUpdateApiUrl = (newUrl) => {
        if (newUrl) {
            localStorage.setItem('mdm_custom_api_url', newUrl);
            setApiBase(newUrl);
        } else {
            localStorage.removeItem('mdm_custom_api_url');
            setApiBase(getApiBase());
        }
    };

    const handleLoginSuccess = (userObj, token) => {
        setUser(userObj);
        if (userObj) {
            sessionStorage.setItem('phone_mdm_user', JSON.stringify(userObj));
            if (token) sessionStorage.setItem('phone_mdm_token', token);
        }
    };

    const handleLogout = () => {
        setUser(null);
        sessionStorage.removeItem('phone_mdm_user');
        sessionStorage.removeItem('phone_mdm_token');
    };

    // Step 1: Select Brand (if not logged in)
    if (!selectedBrand && !user) {
        return (
            <BrandSelect
                API_BASE={apiBase}
                onSelectBrand={(brand) => setSelectedBrand(brand)}
                onUpdateApiUrl={handleUpdateApiUrl}
            />
        );
    }

    // Step 2: Login to System API
    if (!user) {
        return (
            <Login
                API_BASE={apiBase}
                selectedBrand={selectedBrand}
                onChangeBrand={() => setSelectedBrand(null)}
                onLoginSuccess={handleLoginSuccess}
                onUpdateApiUrl={handleUpdateApiUrl}
            />
        );
    }

    // Step 3: Main Mobile Dashboard & Real-time Scan
    return (
        <MobileDashboard
            user={user}
            API_BASE={apiBase}
            onLogout={handleLogout}
            onChangeBrand={() => { handleLogout(); setSelectedBrand(null); }}
            onUpdateApiUrl={handleUpdateApiUrl}
        />
    );
};

export default App;
