/* ============================================================================
   THE SYSTEM — service worker

   Two jobs: make the app openable offline, and receive push.

   The push rules below are not style preferences. On iOS, a push handler that
   fails to display a notification is scored as a silent push, and WebKit
   REVOKES the subscription after roughly three of them. Chrome forgives a
   missing waitUntil by showing a default notification; Safari does not — which
   is exactly why this bug ships undetected and the push quietly dies weeks
   later with nothing in any log.
   ========================================================================= */

const CACHE = 'system-v2-5'
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './habits.js',
  './fx.js',
  './sync.js',
  './sfx.js',
  './icon-192.png',
  './manifest.webmanifest',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/* Cache-first for the shell, network-first for everything else. The app is
   local-first — the save lives in localStorage — so a cold offline launch
   must still render today's list. */
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() => caches.match('./index.html')))
  )
})

/* --------------------------------------------------------------------------
   PUSH. Always display. Always inside waitUntil. No exceptions, no early
   returns — a malformed payload still shows something rather than costing us
   the subscription.

   Payload is the Declarative Web Push shape:
     { "web_push": 8030, "notification": { title, body, navigate, data } }
   On iOS 18.4+ the browser renders it itself and the revocation penalty does
   not apply at all; older iOS falls through to this handler. Same JSON covers
   16.4 through current.
   ------------------------------------------------------------------------ */
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let n = {}
    try {
      const raw = e.data ? e.data.json() : {}
      n = raw.notification || raw || {}
    } catch (_) {
      try { n = { body: e.data ? e.data.text() : '' } } catch (__) { n = {} }
    }

    const title = n.title || 'THE SYSTEM'
    const body = n.body || 'The gate is open.'
    const remaining = (n.data && typeof n.data.remaining === 'number') ? n.data.remaining : null

    await self.registration.showNotification(title, {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'system-daily',
      renotify: false,
      data: { url: (n.navigate || './'), remaining },
    })

    /* The badge is the cue Focus cannot suppress. Web push has no access to
       the Time Sensitive interruption level (that needs a native
       entitlement), so a reminder CAN be held back by Focus or Scheduled
       Summary — but a number on the icon is visible regardless.
       Safari mishandles setAppBadge() with 0 or no argument, so clear
       explicitly instead of passing a falsy count. */
    try {
      if (remaining && remaining > 0) await self.registration.navigator?.setAppBadge?.(remaining)
      else if (self.navigator && self.navigator.setAppBadge && remaining && remaining > 0) await self.navigator.setAppBadge(remaining)
      else if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge()
    } catch (_) { /* badging unsupported or denied — never let this throw */ }
  })())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || './'
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if ('focus' in w) return w.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

/* Let the page push a badge count without a notification. */
self.addEventListener('message', (e) => {
  const d = e.data || {}
  if (d.type !== 'badge') return
  try {
    if (d.count > 0) self.navigator.setAppBadge && self.navigator.setAppBadge(d.count)
    else self.navigator.clearAppBadge && self.navigator.clearAppBadge()
  } catch (_) {}
})
