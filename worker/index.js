/* ============================================================================
   THE SYSTEM — evening reminder worker (Cloudflare Workers + KV).

   One a day, at a fixed evening hour in your own time zone, and only while
   a quest is still open. The page tells the worker how many are open each
   time that changes (POST /state). If the app was not opened at all today,
   the worker has no count for today and assumes the quest is open — which
   is exactly the day a reminder is for.

   Never more than one a day: `sent` records the local date of the last one.

   Routes (all POST, JSON):
     /subscribe    { id, sub, tz, hour, date, open, token? }  → { token }
     /state        { id, token, tz, hour, date, open }
     /unsubscribe  { id, token }

   AUTH. The worker URL is public (it sits in push.js), so:
     - /subscribe hands back a random token, and every later call for that
       id must carry it — nobody else can silence or delete your reminder.
     - ALLOWED_IDS (a var, comma-separated uids) closes /subscribe to
       everyone else, so strangers cannot fill the slots. Your uid is at the
       bottom of the app's SYSTEM menu.

   Cron: hourly. Setup: worker/README.md.
   ========================================================================= */

import { send } from './webpush.js'

const MAX_SUBS = 20        // one person's devices, not a service
const LINES = [
  '{open} still open.',
  'The Daily Quest is still open.',
  'The gate is open. {open} left.',
  'Still time. {open} left before midnight.',
]

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
})
const json = (env, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env) } })

const DAY = /^\d{4}-\d{2}-\d{2}$/
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(id)
const validTz = (tz) => { if (typeof tz !== 'string' || !tz) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch (_) { return false } }
const validHour = (h) => Number.isInteger(h) && h >= 0 && h <= 23

function localNow(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) })
    if (req.method !== 'POST') return json(env, { ok: true, service: 'the-system reminder' })
    const path = new URL(req.url).pathname
    let b
    try { b = await req.json() } catch (_) { return json(env, { error: 'bad json' }, 400) }
    if (!b || !validId(b.id)) return json(env, { error: 'bad id' }, 400)
    const key = 'sub:' + b.id
    const owns = (rec) => typeof b.token === 'string' && b.token.length >= 16 && rec.token === b.token

    if (path === '/unsubscribe') {
      const raw = await env.SUBS.get(key)
      if (!raw) return json(env, { ok: true })
      if (!owns(JSON.parse(raw))) return json(env, { error: 'forbidden' }, 403)
      await env.SUBS.delete(key)
      return json(env, { ok: true })
    }

    if (path === '/subscribe') {
      const s = b.sub
      if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json(env, { error: 'bad subscription' }, 400)
      if (!validTz(b.tz) || !validHour(b.hour)) return json(env, { error: 'bad time' }, 400)
      const allowed = (env.ALLOWED_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)
      if (allowed.length && allowed.indexOf(b.id) === -1) return json(env, { error: 'not allowed' }, 403)
      const existing = await env.SUBS.get(key)
      if (existing && !owns(JSON.parse(existing))) return json(env, { error: 'forbidden' }, 403)
      if (!existing) {
        const n = (await env.SUBS.list({ prefix: 'sub:' })).keys.length
        if (n >= MAX_SUBS) return json(env, { error: 'full' }, 429)
      }
      const token = existing ? b.token : crypto.randomUUID().replace(/-/g, '')
      const rec = {
        token,
        sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
        tz: b.tz, hour: b.hour,
        date: DAY.test(b.date) ? b.date : null,
        open: Number.isInteger(b.open) ? b.open : null,
        sent: existing ? JSON.parse(existing).sent : null,
      }
      await env.SUBS.put(key, JSON.stringify(rec))
      return json(env, { ok: true, token })
    }

    if (path === '/state') {
      const raw = await env.SUBS.get(key)
      if (!raw) return json(env, { ok: false, error: 'not subscribed' }, 404)
      const rec = JSON.parse(raw)
      if (!owns(rec)) return json(env, { error: 'forbidden' }, 403)
      if (validTz(b.tz)) rec.tz = b.tz
      if (validHour(b.hour)) rec.hour = b.hour
      if (DAY.test(b.date)) rec.date = b.date
      if (Number.isInteger(b.open) && b.open >= 0 && b.open < 100) rec.open = b.open
      await env.SUBS.put(key, JSON.stringify(rec))
      return json(env, { ok: true })
    }

    return json(env, { error: 'not found' }, 404)
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env))
  },
}

export async function tick(env, now = new Date()) {
  const list = await env.SUBS.list({ prefix: 'sub:' })
  for (const { name } of list.keys) {
    const raw = await env.SUBS.get(name)
    if (!raw) continue
    const rec = JSON.parse(raw)
    const L = localNow(rec.tz, now)
    if (L.hour !== rec.hour || rec.sent === L.date) continue
    const open = rec.date === L.date ? rec.open : null     // unknown today → assume open
    if (open === 0) continue

    const n = open || 0
    const words = n ? `${n} quest${n === 1 ? '' : 's'}` : 'The quest'
    const pick = LINES[(Number(L.date.slice(8)) + rec.hour) % LINES.length]
    const body = n ? pick.replace('{open}', words) : LINES[1]
    const message = {
      web_push: 8030,
      notification: {
        title: 'THE SYSTEM',
        body,
        navigate: env.APP_URL,
        ...(n ? { app_badge: String(n) } : {}),
        data: n ? { remaining: n } : {},
      },
    }
    try {
      const status = await send(rec.sub, message, env)
      if (status === 404 || status === 410) { await env.SUBS.delete(name); continue }
      if (status >= 200 && status < 300) {
        rec.sent = L.date
        await env.SUBS.put(name, JSON.stringify(rec))
      }
    } catch (e) {
      console.warn('push failed', name, e && e.message)
    }
  }
}
