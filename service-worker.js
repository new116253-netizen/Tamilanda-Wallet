const CACHE_NAME="tamilanda-wallet-final-v2";
const APP_FILES=[
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./pages/about.html",
  "./pages/accounts.html",
  "./pages/backup.html",
  "./pages/borrowed-money.html",
  "./pages/buyers.html",
  "./pages/emi.html",
  "./pages/export.html",
  "./pages/give-money.html",
  "./pages/more.html",
  "./pages/my-ids.html",
  "./pages/net-worth.html",
  "./pages/privacy.html",
  "./pages/profile.html",
  "./pages/quick-add.html",
  "./pages/receivable.html",
  "./pages/reports.html",
  "./pages/security.html",
  "./pages/settings.html",
  "./pages/transactions.html",
  "./pages/transfer.html",
  "./pages/trash.html"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(response=>{if(response&&response.status===200&&response.type==="basic"){const clone=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,clone)).catch(()=>{})}return response}).catch(()=>caches.match(event.request).then(cached=>cached|| (event.request.mode==="navigate"?caches.match("./index.html"):new Response("Offline",{status:503,statusText:"Offline"})))))});
