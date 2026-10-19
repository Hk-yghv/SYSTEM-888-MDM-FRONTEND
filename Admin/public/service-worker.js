const CACHE_NAME = "system-mdm-shell-v2";
const APP_SHELL = [
    "/",
    "/manifest.webmanifest",
    "/icons/icon.svg",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-180.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key.startsWith("system-mdm-shell-") && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request)) || (await caches.match("/")))
        );
        return;
    }

    if (url.pathname.startsWith("/assets/")) {
        event.respondWith(
            fetch(request).then((response) => {
                const contentType = response.headers.get("content-type") || "";
                const isExpectedAsset = request.destination === "script"
                    ? /javascript|ecmascript/i.test(contentType)
                    : request.destination === "style"
                        ? /text\/css/i.test(contentType)
                        : !/text\/html/i.test(contentType);
                if (response.ok && isExpectedAsset) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            }).catch(async () => (await caches.match(request)) || Response.error())
        );
        return;
    }

    if (APP_SHELL.includes(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                });
            })
        );
    }
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "APP_VERSION") { }
});