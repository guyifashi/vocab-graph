// ══════════════════════════════════════════════
// WordNet Service Worker
// 策略：核心文件预缓存 + 网络优先 + 离线降级
// ══════════════════════════════════════════════

const CACHE_NAME    = 'wordnet-v1';
const CACHE_ASSETS  = [
  '/',
  '/index.html',
  '/manifest.json',
  // 字体（从Google Fonts加载的会被运行时缓存）
];

// ── 安装：预缓存核心文件 ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── 激活：清理旧版本缓存 ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── 请求拦截策略 ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pixabay / Unsplash 图片：网络优先，失败不缓存（避免占用空间）
  if (url.hostname.includes('pixabay.com') || url.hostname.includes('unsplash.com')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // 图片加载失败静默处理，由前端降级到emoji
        return new Response('', { status: 503 });
      })
    );
    return;
  }

  // Google Fonts：缓存优先（字体不常变）
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // CDN 脚本（force-graph等）：缓存优先
  if (url.hostname.includes('unpkg.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // 本地文件（index.html、图片等）：网络优先，离线降级缓存
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 更新缓存
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
