/* ============================================================================
   THE SYSTEM v2 — state, render, loop.

   THE ONE IDEA: the log is the only truth. Everything else is derived.

     save = { v, log: { "2026-09-26": ["bodyweight","vitamins"] }, spent, ... }

   XP, level, rank, gold, streak — all computed from that map on every render.
   Nothing accumulates in a counter, so nothing can drift, and a double-tap or
   a page reload CANNOT double-grant anything. v1 had the inverse bug: undoing
   a quest refunded raw q.xp while completing it granted the buffed calcXP, so
   with any XP title equipped, check/uncheck cycling printed free XP forever
   (js/quests.js:138-141). A number you can inflate stops being believed, and
   that erosion happens without you ever consciously deciding to quit.

   Derived-from-log makes that class of bug unrepresentable.
   ========================================================================= */

import { HABITS, REWARDS, RANKS, NUDGES } from './habits.js'
import { haptic, animateNumber, sparks, reduceMotion } from './fx.js'

const KEY = 'system_v2'
const GOLD_PER_XP = 0.4

/* ---------- dates ---------------------------------------------------------- */
const iso = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
const today = () => iso(new Date())
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const dow = (key) => new Date(key + 'T12:00:00').getDay()

/* ---------- state ---------------------------------------------------------- */
let S = load()

function load() {
  let s = null
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (_) { s = null }
  if (!s || typeof s !== 'object') s = {}
  return {
    v: 2,
    log: (s.log && typeof s.log === 'object') ? s.log : {},
    spent: Array.isArray(s.spent) ? s.spent : [],
    lastOpen: s.lastOpen || null,
    carry: s.carry || { xp: 0, gold: 0 },   // hand-entered v1 carry-over
    _ts: s._ts || 0,
  }
}

function save() {
  S._ts = Date.now()
  try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (_) {}
  pushBadge()
}

/* ---------- derived -------------------------------------------------------- */
const xpOf = (id) => { const h = HABITS.find((x) => x.id === id); return h ? h.xp : 0 }

function scheduledOn(h, key) { return !h.archived && (!h.days || h.days.indexOf(dow(key)) !== -1) }
const scheduledToday = () => HABITS.filter((h) => scheduledOn(h, today()))

function totalXp() {
  let t = S.carry.xp || 0
  for (const k in S.log) for (const id of S.log[k]) t += xpOf(id)
  return t
}

/* Linear: level N -> N+1 costs N*100. Cumulative to N is 50*N*(N-1). */
function levelFromXp(t) {
  let lv = 1, need = 100, left = t
  while (left >= need) { left -= need; lv++; need = lv * 100 }
  return { level: lv, into: left, need }
}

const rankOf = (t) => RANKS.reduce((acc, r) => (t >= r.at ? r.r : acc), 'E')

function gold() {
  const earned = Math.floor(totalXp() * GOLD_PER_XP) + (S.carry.gold || 0)
  const out = S.spent.reduce((n, p) => n + (p.cost || 0), 0)
  return earned - out
}

const doneToday = () => S.log[today()] || []
const remaining = () => scheduledToday().filter((h) => doneToday().indexOf(h.id) === -1).length

/* Forgiving streak. Breaks only when 2 of the last 7 scheduled days were
   missed — never on a single bad Tuesday. Lally et al. found one missed
   opportunity does not impair habit formation at all, so a hard reset is not
   just harsh, it is factually wrong about how habits work. */
function streak() {
  let n = 0, misses = 0
  for (let i = 0; i < 400; i++) {
    const key = daysAgo(i)
    const due = HABITS.filter((h) => scheduledOn(h, key))
    if (!due.length) continue
    const got = S.log[key] || []
    const perfect = due.every((h) => got.indexOf(h.id) !== -1)
    if (i === 0 && !perfect) continue          // today still in progress
    if (perfect) { n++; misses = Math.max(0, misses - 0) }
    else { misses++; if (misses >= 2) break; n++ }
  }
  return n
}

function bestStreak() {
  const keys = Object.keys(S.log).sort()
  let best = 0, run = 0, prev = null
  for (const k of keys) {
    const due = HABITS.filter((h) => scheduledOn(h, k))
    const got = S.log[k] || []
    const perfect = due.length && due.every((h) => got.indexOf(h.id) !== -1)
    if (!perfect) { run = 0; prev = k; continue }
    run = (prev && (new Date(k) - new Date(prev)) <= 86400000 * 1.5) ? run + 1 : 1
    best = Math.max(best, run); prev = k
  }
  return best
}

function rate30() {
  let due = 0, got = 0
  for (let i = 0; i < 30; i++) {
    const key = daysAgo(i)
    const d = HABITS.filter((h) => scheduledOn(h, key)).length
    if (!d) continue
    due += d
    got += (S.log[key] || []).length
  }
  return due ? Math.round((got / due) * 100) : 0
}

const lifetime = () => Object.keys(S.log).reduce((n, k) => n + S.log[k].length, 0)

/* ---------- actions -------------------------------------------------------- */
export function toggle(id, ev) {
  const k = today()
  if (!S.log[k]) S.log[k] = []
  const at = S.log[k].indexOf(id)
  const adding = at === -1

  if (adding) S.log[k].push(id)
  else S.log[k].splice(at, 1)

  // idempotent by construction: the log is a SET of ids for the day, and every
  // number on screen is recomputed from it. no counter to desync.
  if (S.log[k].length === 0) delete S.log[k]

  save()
  render()

  if (adding) {
    haptic(8)
    if (ev) sparks(ev)
    import('./sfx.js').then((m) => m.play('check')).catch(() => {})
  }
}

export function buy(id) {
  const r = REWARDS.find((x) => x.id === id)
  if (!r || gold() < r.cost) return
  const last = S.spent.filter((p) => p.id === id).map((p) => p.on).sort().pop()
  if (last && (new Date(today()) - new Date(last)) < r.cooldown * 86400000) return
  S.spent.push({ id, cost: r.cost, on: today() })
  save(); render()
}

/* ---------- render --------------------------------------------------------- */
const $ = (s) => document.querySelector(s)
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const RAMP = ['#0d1017', '#132534', '#17455f', '#1d7ba6', '#33b6e8']

function heatCell(key, isToday) {
  const due = HABITS.filter((h) => scheduledOn(h, key)).length
  const got = (S.log[key] || []).length
  const pct = due ? got / due : 0
  let lv = 0
  if (pct > 0) lv = pct >= 1 ? 4 : pct >= 0.66 ? 3 : pct >= 0.34 ? 2 : 1
  const lit = isToday && pct >= 1
  return `<i style="background:${lit ? '#5ad1ff' : RAMP[lv]};${lit ? 'box-shadow:0 0 12px rgba(90,209,255,.9)' : ''}"></i>`
}

function render() {
  const t = totalXp(), L = levelFromXp(t), rank = rankOf(t)
  const due = scheduledToday(), got = doneToday()
  const rem = due.length - got.length
  const st = streak()

  $('#rank').textContent = rank
  $('#meta').innerHTML = `${new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).toLowerCase()}<br>${rank}&#8209;rank &#183; lv ${L.level}`
  $('#count').textContent = `${got.length}/${due.length}`
  $('#xpbar').style.width = Math.round((L.into / L.need) * 100) + '%'
  $('#xpnum').textContent = `${L.into}/${L.need}`
  $('#lv').textContent = 'lv ' + L.level

  animateNumber($('#streak'), st)
  animateNumber($('#best'), Math.max(bestStreak(), st))
  animateNumber($('#rate'), rate30(), '%')
  animateNumber($('#life'), lifetime())
  $('#gold').textContent = gold()

  // 18 weeks, oldest first, ending today
  let cells = ''
  const total = 18 * 7
  for (let col = 0; col < 18; col++) {
    cells += '<b>'
    for (let row = 0; row < 7; row++) {
      const back = total - 1 - (col * 7 + row)
      const key = daysAgo(back)
      cells += heatCell(key, back === 0)
    }
    cells += '</b>'
  }
  $('#grid').innerHTML = cells

  $('#list').innerHTML = due.map((h) => {
    const done = got.indexOf(h.id) !== -1
    return `<button class="q${done ? ' done' : ''}" data-id="${h.id}">
      <i class="tick t"></i><i class="tick b"></i>
      <span class="dia"></span>
      <span class="qt">
        <b>${esc(h.name)}</b>
        <em>${esc(h.when || h.detail || '')}</em>
      </span>
      <u>${done ? '+' : ''}${h.xp}</u>
    </button>`
  }).join('')

  // comeback: shown only after a real absence, and it never scolds
  const away = S.lastOpen ? Math.round((new Date(today()) - new Date(S.lastOpen)) / 86400000) : 0
  const cb = $('#comeback')
  if (away >= 3) {
    cb.hidden = false
    cb.querySelector('h2').textContent = `${away} DAYS CLOSED.`
    cb.querySelector('p').innerHTML = `level ${L.level} &#183; ${gold()} gold &#183; ${lifetime()} lifetime<br>no debt to clear &#183; no penalty`
  } else cb.hidden = true

  document.documentElement.style.setProperty('--rem', rem)
}

function pushBadge() {
  const n = remaining()
  try {
    if (navigator.setAppBadge) { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge() }
    navigator.serviceWorker?.controller?.postMessage({ type: 'badge', count: n })
  } catch (_) {}
}

/* ---------- notifications -------------------------------------------------- */
/* Permission is asked from ONE explicit button, and only once the app is
   installed. On iOS a denial is effectively permanent — there is no API to
   re-prompt, and recovery means deleting the home-screen app and clearing
   site data. v1 fired requestPermission() from a blind 5s setTimeout
   (js/features.js:192), which on iOS is both silently blocked AND the exact
   pattern that burns the single grant you get. */
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export async function enableAlerts() {
  if (!standalone()) return
  if (!('Notification' in window)) return
  const p = await Notification.requestPermission()
  if (p !== 'granted') return
  syncNotifyUI()
  // subscription + Worker wiring lands in the next step
}

function syncNotifyUI() {
  const box = $('#notify')
  if (!box) return
  if (!standalone()) {
    box.innerHTML = '<span>Share &#8594; Add to Home Screen to enable alerts</span>'
    return
  }
  const p = ('Notification' in window) ? Notification.permission : 'denied'
  if (p === 'granted') box.hidden = true
  else if (p === 'denied') box.innerHTML = '<span>Alerts blocked in iOS Settings</span>'
  else box.innerHTML = '<button id="ask">ENABLE SYSTEM ALERTS</button>'
}

/* ---------- boot ----------------------------------------------------------- */
function boot() {
  document.body.addEventListener('click', (e) => {
    const q = e.target.closest('.q')
    if (q) return toggle(q.dataset.id, e)
    if (e.target.id === 'ask') return enableAlerts()
    if (e.target.id === 'cbclose') { S.lastOpen = today(); save(); render() }
  })

  render()
  syncNotifyUI()

  // record the visit AFTER render, so the comeback card gets to see the gap
  S.lastOpen = today()
  save()

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})
  }

  // a day can roll over while the app sits open
  setInterval(() => { if ($('#count').textContent.split('/')[1] !== String(scheduledToday().length)) render() }, 60000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render() })
}

if (reduceMotion) document.documentElement.classList.add('rm')
boot()
