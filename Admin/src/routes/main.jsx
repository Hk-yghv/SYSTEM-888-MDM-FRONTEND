import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "../utils/smartFetch";

document.title = __APP_NAME__;

localStorage.setItem("website_version", __WEBSITE_VERSION__);

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const retryKey = `mdm_chunk_retry_${__WEBSITE_VERSION__}`;
  try {
    const lastRetry = Number(sessionStorage.getItem(retryKey) || 0);
    if (Date.now() - lastRetry < 30000) {
      console.error("App module failed to load after refreshing; retry later or clear site cache.");
      return;
    }
    sessionStorage.setItem(retryKey, String(Date.now()));
  } catch (error) {
    console.error("Unable to prepare app reload after module load failure:", error);
    return;
  }
  window.location.reload();
});

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
      })
      .catch((error) => console.error("Service worker registration failed:", error));
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