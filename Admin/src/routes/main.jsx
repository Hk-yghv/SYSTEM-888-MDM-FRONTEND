import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// ── Global System Security API Interceptor ──
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    const urlStr = typeof resource === 'string' ? resource : resource?.url || '';
    if (urlStr.includes('/api/') || urlStr.startsWith('/api')) {
        config = config || {};
        const token = sessionStorage.getItem('mdm_token') || localStorage.getItem('mdm_token');
        const defaultHeaders = {
            'x-system-api-key': 'SYSTEM_MDM_SECURE_AUTH_HEADER_TOKEN_2026',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        if (config.headers instanceof Headers) {
            config.headers.set('x-system-api-key', 'SYSTEM_MDM_SECURE_AUTH_HEADER_TOKEN_2026');
            if (token) config.headers.set('Authorization', `Bearer ${token}`);
        } else {
            config.headers = {
                ...defaultHeaders,
                ...config.headers
            };
        }
    }
    return originalFetch(resource, config);
};

document.title = __APP_NAME__;

localStorage.setItem("website_version", __WEBSITE_VERSION__);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then((reg) => {
        navigator.serviceWorker.ready.then(() => {
          reg.active?.postMessage({
            type: "APP_VERSION",
            version: __WEBSITE_VERSION__,
          });
        });
      });
  });
}

console.log(
  "%c" + __APP_NAME__ + " %c V" + __WEBSITE_VERSION__ + " %c SUCCESS",
  "background:#35495e;color:#fff;padding:3px 6px;border-radius:3px 0 0 3px;",
  "background:#42b883;color:#fff;padding:3px 6px;",
  "background:#e6ffed;color:#2e7d32;padding:3px 6px;border-radius:0 3px 3px 0;"
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)