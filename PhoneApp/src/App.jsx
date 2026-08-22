import React, { useState } from 'react';
import BrandSelect from './pages/BrandSelect';
import Login from './pages/Login';
import MobileDashboard from './pages/MobileDashboard';

const getApiBase = () => {
    if (import.meta.env.VITE_API_BACKEND) {
        return import.meta.env.VITE_API_BACKEND;
    }
    if (typeof window !== 'undefined' && window.location.hostname) {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return `http://${host}:5000/api`;
        }
        return `${window.location.protocol}//${host}:5000/api`;
    }
    return 'http://localhost:5000/api';
};

const API_BASE = getApiBase();

const App = () => {
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [user, setUser] = useState(() => {
        const saved = sessionStorage.getItem('phone_mdm_user');
        return saved ? JSON.parse(saved) : null;
    });

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

    // Step 1: Select Brand (if not already logged in)
    if (!selectedBrand && !user) {
        return <BrandSelect API_BASE={API_BASE} onSelectBrand={(brand) => setSelectedBrand(brand)} />;
    }

    // Step 2: Login to System API
    if (!user) {
        return (
            <Login
                API_BASE={API_BASE}
                selectedBrand={selectedBrand}
                onChangeBrand={() => setSelectedBrand(null)}
                onLoginSuccess={handleLoginSuccess}
            />
        );
    }

    // Step 3: Main Mobile Dashboard & Real-time Scan
    return (
        <MobileDashboard
            user={user}
            API_BASE={API_BASE}
            onLogout={handleLogout}
            onChangeBrand={() => { handleLogout(); setSelectedBrand(null); }}
        />
    );
};

export default App;
