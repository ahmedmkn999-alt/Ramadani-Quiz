// Service Worker: التطبيق كله بيتخزّن عند أول فتح ويشتغل بعدها بدون إنترنت.
// غيّر VERSION مع كل نشر جديد عشان الأجهزة تاخد التحديث.
const VERSION = 'rq27-v2.0.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'firebase-config.js', 'css/style.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/config.js', 'js/util.js', 'js/store.js', 'js/bank.js', 'js/engine.js', 'js/audio.js',
  'js/fx.js', 'js/icons.js', 'js/backend.js', 'js/backend-firebase.js',
  'js/screens/welcome.js', 'js/screens/home.js', 'js/screens/quiz.js', 'js/screens/practice.js',
  'js/screens/board.js', 'js/screens/me.js', 'js/screens/wheel.js', 'js/screens/admin.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// واجهات Firebase الحية لازم تعدّي مباشرة (Firestore بيدير كاشه الأوفلاين بنفسه)
const BYPASS = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'];

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.some((h) => url.hostname.endsWith(h))) return;

  // أصول التطبيق: من الكاش فوراً + تحديث في الخلفية (stale-while-revalidate)
  // الخطوط وSDK بتاع Firebase من CDN: نفس الأسلوب، فتشتغل أوفلاين بعد أول زيارة
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: false });
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
