/* ============================================================================
   EVENING REMINDER — the client half. The server half is worker/.

   One a day, at a fixed evening time, and only when a quest is still open.
   The page tells the worker how many are open whenever that changes; if the
   app was never opened today, the worker assumes the quest is open. It never
   sends more than one a day, and never one when everything is done.

   iOS only allows web push from a home-screen app, only after a tap asks
   for it, and only once the worker is deployed. Until WORKER and VAPID
   below are filled in, the System menu says so instead of offering it.
   ========================================================================= */

export const WORKER = ''        // e.g. 'https://the-system-push.<you>.workers.dev'
export const VAPID = ''         // the public key printed by worker/keys.mjs

export const configured = () => !!(WORKER && VAPID)
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch (_) { return 'UTC' } }

const b64u = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function post(path, body) {
  const r = await fetch(WORKER + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error('Reminder server said ' + r.status)
  return r.json().catch(() => ({}))
}

/* Resolves with the worker's token for this subscription. The app keeps it
   in the save; every later call has to present it. */
export async function enable(id, hour, date, open, token) {
  if (!configured()) throw new Error('The reminder server is not deployed yet.')
  if (!supported()) throw new Error('This browser cannot receive reminders.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) })
  const r = await post('/subscribe', { id, sub: sub.toJSON(), tz: tz(), hour, date, open, token })
  return r.token || token
}

export async function disable(id, token) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  } catch (_) {}
  if (configured()) await post('/unsubscribe', { id, token }).catch(() => {})
}

/* Debounced: a burst of taps is one request. */
let t = 0, last = ''
export function report(id, token, hour, date, open) {
  if (!configured() || !id || !token) return
  const sig = [id, hour, date, open].join('|')
  if (sig === last) return
  clearTimeout(t)
  t = setTimeout(() => {
    last = sig
    post('/state', { id, token, tz: tz(), hour, date, open }).catch(() => { last = '' })
  }, 1500)
}
