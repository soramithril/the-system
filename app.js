/* ============================================================================
   THE SYSTEM v2 — state, render, loop.

   THE ONE IDEA: the log is the only truth. Everything else is derived.

     save = { v, log: { "2026-09-26": ["bodyweight","vitamins"] }, first, seen }

   XP, level, rank, stats, titles, the week — all computed from that map on
   every render. Nothing accumulates in a counter, so nothing can drift, and a
   double-tap or a reload CANNOT double-grant anything. v1 had the inverse
   bug (js/quests.js:138-141): undo refunded raw q.xp while completion granted
   buffed calcXP, so check/uncheck cycling printed free XP forever.

   Derived-from-log makes that class of bug unrepresentable.
   ========================================================================= */

import { HABITS, STATS, RANKS, TITLES, LINES } from './habits.js'
import { haptic, animateNumber, sparks, floatUp, reduceMotion } from './fx.js'
import { initSync, pushState, exportLog, importLog } from './sync.js'

const KEY = 'system_v2'
const RETURN_BONUS = 15   // the Return Quest — top of 54 interventions, Milkman 2021

/* ---------- dates ---------------------------------------------------------- */
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10) }
const today = () => iso(new Date())
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const dow = (key) => new Date(key + 'T12:00:00').getDay()
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000)

/* ---------- state ---------------------------------------------------------- */
let S = load()

function load() {
  let s = null
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (_) { s = null }
  if (!s || typeof s !== 'object') s = {}
  return {
    v: 2,
    log: (s.log && typeof s.log === 'object') ? s.log : {},
    first: s.first || null,          // the day the System awakened — day 0
    lastOpen: s.lastOpen || null,
    seen: Array.isArray(s.seen) ? s.seen : [],   // system lines already spoken
    _ts: s._ts || 0,
  }
}

function save() {
  S._ts = Date.now()
  try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (_) {}
  pushBadge()
  pushState(S)            // debounced; does nothing until sync is ready
}

/* ---------- catalog views -------------------------------------------------- */
const byId = (id) => HABITS.find((h) => h.id === id)
const xpOf = (id) => { const h = byId(id); return h ? h.xp : 0 }

/* day index since the first logged day; 0 before anything is logged */
const dayIndex = (key = today()) => (S.first ? Math.max(0, diffDays(S.first, key)) : 0)

/* granted = past its unlock day. locked = visible but not yet granted. */
const granted = (h, key = today()) => !h.archived && (h.unlock || 0) <= dayIndex(key)
const scheduledOn = (h, key) => granted(h, key) && (!h.days || h.days.indexOf(dow(key)) !== -1)
const dueOn = (key) => HABITS.filter((h) => scheduledOn(h, key))
const dueToday = () => dueOn(today())
const lockedToday = () => HABITS.filter((h) => !h.archived && !granted(h))

/* ---------- derived: xp / level / rank ------------------------------------- */
function totalXp() {
  let t = 0
  for (const k in S.log) {
    const ids = S.log[k]
    for (const id of ids) t += xpOf(id)
    if (ids.length && ids.indexOf('__return') !== -1) t += RETURN_BONUS
  }
  return t
}

/* Linear: level N -> N+1 costs N*100. Overflow carries, so a fresh bar never
   sits at exactly 0% after a level-up. */
function levelFromXp(t) {
  let lv = 1, need = 100, left = t
  while (left >= need) { left -= need; lv++; need = lv * 100 }
  return { level: lv, into: left, need }
}

const rankIndex = (t) => RANKS.reduce((acc, r, i) => (t >= r.at ? i : acc), 0)

/* average xp/day over the last 7 logged days -> "N days to Level X" */
function daysToNextLevel(t) {
  let earned = 0, days = 0
  for (let i = 1; i <= 7; i++) {
    const k = daysAgo(i)
    if (!S.first || diffDays(S.first, k) < 0) continue
    days++
    for (const id of (S.log[k] || [])) earned += xpOf(id)
  }
  const L = levelFromXp(t)
  if (!days || !earned) return null
  return Math.max(1, Math.ceil((L.need - L.into) / (earned / days)))
}

/* ---------- derived: the week ---------------------------------------------- */
/* "kept" = every due habit done that day. A partial day is still a logged
   day (it fills a cell); a kept day is the stronger thing. */
function keptOn(key) {
  const due = dueOn(key)
  if (!due.length) return false
  const got = S.log[key] || []
  return due.every((h) => got.indexOf(h.id) !== -1)
}
const loggedOn = (key) => !!(S.log[key] && S.log[key].filter((x) => x[0] !== '_').length)

function thisWeek() {
  const d = new Date(); const day = (d.getDay() + 6) % 7   // Mon=0
  let kept = 0, due = 0
  for (let i = 0; i <= day; i++) {
    const k = daysAgo(day - i)
    if (!dueOn(k).length) continue
    due++
    if (keptOn(k)) kept++
  }
  return { kept, due, day }
}

function weeksCleared() {
  if (!S.first) return 0
  let n = 0
  const d = new Date(); const day = (d.getDay() + 6) % 7
  for (let w = 1; w < 60; w++) {
    let kept = 0, any = false
    for (let i = 0; i < 7; i++) {
      const k = daysAgo(day + w * 7 - i)
      if (diffDays(S.first, k) < 0) continue
      any = true
      if (keptOn(k)) kept++
    }
    if (!any) break
    if (kept >= 5) n++
  }
  return n
}

function rate30() {
  let due = 0, got = 0
  for (let i = 0; i < 30; i++) {
    const k = daysAgo(i)
    const d = dueOn(k).length
    if (!d) continue
    due += d
    got += (S.log[k] || []).filter((id) => byId(id)).length
  }
  return due ? Math.round((got / due) * 100) : 0
}

const lifetime = () => Object.keys(S.log).reduce((n, k) => n + S.log[k].filter((id) => byId(id)).length, 0)

/* ---------- derived: stats (EWMA, 14-day) ---------------------------------- */
/* s += (1 - e^(-1/14)) * (100*done - s), oldest to newest, scheduled days
   only, today counted only once something is logged. A done day lifts it ~7%
   of the remaining gap; a miss drops it ~7% of its value. It can never fall
   on a day you did the habit — which is why this is an EWMA and not a
   rolling window. */
const ALPHA = 1 - Math.exp(-1 / 14)

function statValues() {
  const out = {}
  const t = today()
  for (const h of HABITS) {
    if (!h.stat || !granted(h)) continue
    let s = 0
    const start = S.first ? Math.max(0, diffDays(S.first, t)) : 0
    for (let i = start; i >= 0; i--) {
      const k = daysAgo(i)
      if (!scheduledOn(h, k)) continue
      const done = (S.log[k] || []).indexOf(h.id) !== -1
      if (i === 0 && !loggedOn(k)) continue
      s += ALPHA * (100 * (done ? 1 : 0) - s)
    }
    out[h.stat] = (out[h.stat] || []).concat([s])
  }
  const res = {}
  for (const k in out) res[k] = Math.round(out[k].reduce((a, b) => a + b, 0) / out[k].length)
  return res
}

function statValuesAt(daysBack) {
  // same walk, ending `daysBack` days ago — for the 7-day arrow
  const out = {}
  const end = daysAgo(daysBack)
  for (const h of HABITS) {
    if (!h.stat || !granted(h, end)) continue
    let s = 0
    const start = S.first ? Math.max(0, diffDays(S.first, end)) : 0
    for (let i = start; i >= 0; i--) {
      const k = daysAgo(daysBack + i)
      if (!scheduledOn(h, k)) continue
      const done = (S.log[k] || []).indexOf(h.id) !== -1
      s += ALPHA * (100 * (done ? 1 : 0) - s)
    }
    out[h.stat] = (out[h.stat] || []).concat([s])
  }
  const res = {}
  for (const k in out) res[k] = Math.round(out[k].reduce((a, b) => a + b, 0) / out[k].length)
  return res
}

/* ---------- derived: titles ------------------------------------------------ */
function earnedTitles() {
  const keys = Object.keys(S.log).sort()
  const logged = keys.filter(loggedOn).length
  const anyFull = keys.some(keptOn)
  const returned = keys.some((k) => (S.log[k] || []).indexOf('__return') !== -1)
  const sv = statValues()
  const maxStat = Object.keys(sv).reduce((m, k) => Math.max(m, sv[k]), 0)
  const wk = weeksCleared()

  let perfectWeek = false
  if (S.first) {
    const d = new Date(); const day = (d.getDay() + 6) % 7
    for (let w = 1; w < 60 && !perfectWeek; w++) {
      let kept = 0, any = false
      for (let i = 0; i < 7; i++) {
        const k = daysAgo(day + w * 7 - i)
        if (diffDays(S.first, k) < 0) continue
        any = true
        if (keptOn(k)) kept++
      }
      if (!any) break
      if (kept === 7) perfectWeek = true
    }
  }

  return TITLES.filter((t) => ({
    awakened: logged >= 1,
    unbroken: anyFull,
    returned,
    gate: wk >= 1,
    steady: logged >= 14,
    redgate: perfectWeek,
    iron: maxStat >= 80,
    hunter: logged >= 50,
  })[t.id])
}

/* ---------- actions -------------------------------------------------------- */
export function toggle(id, ev) {
  const h = byId(id)
  if (!h || !granted(h)) return
  const k = today()
  if (!S.first) { S.first = k; speak(LINES.firstDay, 'first') }   // the System awakens
  if (!S.log[k]) S.log[k] = []
  const at = S.log[k].indexOf(id)
  const adding = at === -1

  const before = { t: totalXp(), first: loggedOn(k) }

  if (adding) S.log[k].push(id)
  else S.log[k].splice(at, 1)

  /* THE RETURN QUEST. First completion of the day, after a day with a
     scheduled miss: bonus XP and a System line. It fires on a one-day gap
     from day 2 onward. It is the comeback micro-reward — the top-ranked
     intervention of 54 in a 61,000-person megastudy. It marks the log with
     a sentinel so it is derived like everything else and can only pay once
     per day. */
  if (adding && !before.first) {
    const y = daysAgo(1)
    const missed = dueOn(y).length && !keptOn(y) && diffDays(S.first, y) >= 0
    if (missed && S.log[k].indexOf('__return') === -1) {
      S.log[k].push('__return')
      speak(LINES.returned, 'returned-' + k)
    }
  }
  if (S.log[k].filter((x) => x[0] !== '_').length === 0) delete S.log[k]

  save()
  const after = totalXp()
  render()

  if (adding) {
    haptic(8)
    if (ev) { sparks(ev); floatUp(ev, '+' + (after - before.t)) }
    import('./sfx.js').then((m) => m.play('check')).catch(() => {})
    // rank promotion is the biggest moment in the app
    if (rankIndex(after) > rankIndex(before.t)) promote(rankIndex(after))
    else if (levelFromXp(after).level > levelFromXp(before.t).level) import('./sfx.js').then((m) => m.play('levelUp')).catch(() => {})
  }
}

/* ---------- render --------------------------------------------------------- */
const $ = (s) => document.querySelector(s)
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const RAMP = ['#0d1017', '#132534', '#17455f', '#1d7ba6', '#33b6e8']

function heatCell(key, isToday) {
  const before = S.first && diffDays(S.first, key) < 0
  if (before) return '<i style="background:#0a0c12"></i>'          // before the awakening: void
  const due = dueOn(key).length
  const got = (S.log[key] || []).filter((id) => byId(id)).length
  const pct = due ? got / due : 0
  let lv = 0
  if (pct > 0) lv = pct >= 1 ? 4 : pct >= 0.66 ? 3 : pct >= 0.34 ? 2 : 1
  const lit = isToday && pct >= 1
  const setup = S.first === key && !got                              // day 0: the first cell, filled at setup
  const bg = lit ? '#5ad1ff' : setup ? '#1f3550' : RAMP[lv]
  return `<i style="background:${bg};${lit ? 'box-shadow:0 0 12px rgba(90,209,255,.9)' : ''}"></i>`
}

function render() {
  const t = totalXp(), L = levelFromXp(t), ri = rankIndex(t), rank = RANKS[ri].r
  const due = dueToday(), got = S.log[today()] || []
  const doneN = due.filter((h) => got.indexOf(h.id) !== -1).length
  const titles = earnedTitles()
  const latest = titles.length ? titles[titles.length - 1] : null
  const dtl = daysToNextLevel(t)
  const wk = thisWeek()

  $('#rank').textContent = rank
  $('#meta').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).toLowerCase()
  $('#metaline').innerHTML = `${rank}&#8209;rank &#183; lv ${L.level}${latest ? ' &#183; <span class="title">' + esc(latest.name) + '</span>' : ''}`
  $('#count').textContent = `${doneN}/${due.length}`
  $('#xpbar').style.width = Math.round((L.into / L.need) * 100) + '%'
  $('#xpnum').textContent = dtl ? `${dtl}d to lv ${L.level + 1}` : `${L.into}/${L.need}`
  $('#lv').textContent = 'lv ' + L.level

  animateNumber($('#week'), wk.kept)
  $('#weekof').textContent = '/' + Math.max(wk.due, 1)
  animateNumber($('#cleared'), weeksCleared())
  animateNumber($('#rate'), rate30(), '%')
  animateNumber($('#life'), lifetime())

  // 18 weeks, oldest first, ending today
  let cells = ''
  const total = 18 * 7
  for (let col = 0; col < 18; col++) {
    cells += '<b>'
    for (let row = 0; row < 7; row++) {
      const back = total - 1 - (col * 7 + row)
      cells += heatCell(daysAgo(back), back === 0)
    }
    cells += '</b>'
  }
  $('#grid').innerHTML = cells

  // the status window: one row per stat with a live habit
  const sv = statValues(), prev = statValuesAt(7)
  const rows = Object.keys(STATS).filter((k) => sv[k] != null)
  $('#stats').innerHTML = rows.map((k) => {
    const v = sv[k], p = prev[k]
    const d = (p == null) ? 0 : v - p
    const arrow = d > 0 ? '<span class="up">&#9650;</span>' : d < 0 ? '<span class="dn">&#9660;</span>' : '<span class="fl">&#8212;</span>'
    return `<div class="stat"><b>${k}</b><span class="bar"><span style="width:${v}%"></span></span><u>${v}</u>${arrow}</div>`
  }).join('')
  $('#statsbox').hidden = !rows.length

  // quests: granted ones as cards, locked ones as sealed rows
  const locked = lockedToday()
  $('#list').innerHTML = due.map((h) => {
    const done = got.indexOf(h.id) !== -1
    return `<button class="q${done ? ' done' : ''}" data-id="${h.id}">
      <i class="tick t"></i><i class="tick b"></i>
      <span class="dia"></span>
      <span class="qt"><b>${esc(h.name)}</b><em>${esc(h.detail || '')}</em></span>
      <u>${done ? '+' : ''}${h.xp}</u>
    </button>`
  }).join('') + locked.map((h) => {
    const inDays = (h.unlock || 0) - dayIndex()
    return `<div class="q locked">
      <span class="dia"></span>
      <span class="qt"><b>${esc(h.name)}</b><em>sealed &#183; the System grants this in ${inDays} day${inDays === 1 ? '' : 's'}</em></span>
    </div>`
  }).join('')

  // comeback: shown only after a real absence, and it never scolds
  const away = S.lastOpen ? diffDays(S.lastOpen, today()) : 0
  const cb = $('#comeback')
  if (away >= 3) {
    cb.hidden = false
    cb.querySelector('h2').textContent = `${away} DAYS CLOSED.`
    cb.querySelector('p').innerHTML = `level ${L.level} &#183; ${rank}&#8209;rank &#183; ${lifetime()} logged<br>nothing lost &#183; no debt &#183; one quest reopens the gate`
  } else cb.hidden = true

  // system lines, spoken once
  for (const h of HABITS) {
    if (granted(h) && (h.unlock || 0) > 0 && dayIndex() === (h.unlock || 0)) speak(`${LINES.granted} ${h.name.toUpperCase()}.`, 'grant-' + h.id)
  }

  document.documentElement.style.setProperty('--rem', due.length - doneN)
  tickClock()
}

/* the fiction's rule: the Daily Quest resets at midnight. a countdown, not
   a time of day. */
function tickClock() {
  const el = $('#clock'); if (!el) return
  const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0)
  const ms = end - now, h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  el.textContent = `${h}h ${String(m).padStart(2, '0')}m`
}
setInterval(tickClock, 30000)

function speak(text, once) {
  if (once && S.seen.indexOf(once) !== -1) return
  if (once) { S.seen.push(once); save() }
  const el = $('#line')
  el.textContent = text
  el.hidden = false
  el.classList.remove('pl'); void el.offsetWidth; el.classList.add('pl')
}

function promote(ri) {
  const r = RANKS[ri]
  const ov = $('#promo')
  ov.querySelector('.from').textContent = RANKS[ri - 1].r
  ov.querySelector('.to').textContent = r.r
  ov.querySelector('.loot').textContent = r.loot ? 'GRANTED: ' + r.loot : ''
  ov.hidden = false
  import('./sfx.js').then((m) => m.play('levelUp')).catch(() => {})
}

function pushBadge() {
  const due = dueToday(), got = S.log[today()] || []
  const n = due.filter((h) => got.indexOf(h.id) === -1).length
  try {
    if (navigator.setAppBadge) { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge() }
    navigator.serviceWorker?.controller?.postMessage({ type: 'badge', count: n })
  } catch (_) {}
}

/* ---------- notifications (later, and small) ------------------------------- */
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

function syncNotifyUI() {
  const box = $('#notify')
  if (!box) return
  if (!standalone()) { box.innerHTML = '<span>Share &#8594; Add to Home Screen</span>'; return }
  box.hidden = true   // push lands after day 7 at the earliest; the badge already works
}

/* ---------- backup ---------------------------------------------------------- */
/* Union the two logs rather than picking a winner by timestamp. Last-writer-
   wins was v1's model and it silently loses a day when two copies disagree;
   a union can only ADD days, never remove one you actually logged. */
function mergeRemote(r) {
  if (!r || typeof r !== 'object' || !r.log) return
  let added = 0
  for (const k in r.log) {
    const mine = S.log[k] || []
    const theirs = Array.isArray(r.log[k]) ? r.log[k] : []
    const union = Array.from(new Set(mine.concat(theirs)))
    if (union.length !== mine.length) added++
    if (union.length) S.log[k] = union
  }
  if (r.first && (!S.first || r.first < S.first)) S.first = r.first
  if (Array.isArray(r.seen)) S.seen = Array.from(new Set(S.seen.concat(r.seen)))
  if (added) { save(); render(); speak('Record restored from the System archive.', null) }
}

export function backup() { exportLog(S) }
export async function restore(file) {
  try { mergeRemote(await importLog(file)); save(); render() }
  catch (_) { speak('That file could not be read.', null) }
}

/* ---------- boot ----------------------------------------------------------- */
function boot() {
  document.body.addEventListener('click', (e) => {
    const q = e.target.closest('.q:not(.locked)')
    if (q) return toggle(q.dataset.id, e)
    if (e.target.id === 'cbclose') { S.lastOpen = today(); save(); render(); return }
    if (e.target.closest('#promo')) { $('#promo').hidden = true; return }
    if (e.target.id === 'line') { $('#line').hidden = true; return }
    if (e.target.id === 'backup') { backup(); return }
    if (e.target.id === 'restore') { $('#restorefile').click(); return }
  })

  render()
  syncNotifyUI()
  S.lastOpen = today()
  save()

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})

  // AFTER first paint, but NOT via requestIdleCallback — rIC does not fire in a
  // hidden tab, and "app not in front" is the normal state on a phone, not the
  // edge case. Same trap as the count-up tween. A plain timeout always fires.
  setTimeout(() => initSync(mergeRemote), 900)

  setInterval(render, 60000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render() })
}

if (reduceMotion) document.documentElement.classList.add('rm')
boot()
