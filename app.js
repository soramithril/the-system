/* ============================================================================
   THE SYSTEM v3 — state, actions, the director, render, boot.

   THE ONE IDEA, still: the log is the only truth. model.js derives every
   number on screen from it; this file only changes the log, asks the model
   what changed, and shows it.

     save = { v, log: { "2026-09-26": ["bodyweight","vitamins"] }, first,
              seen, name, title, equip, ink, dq, rep, arch, push }

   Everything beyond `log` and `first` is presentation: which one-time
   announcements have been made, what you named yourself, what you equipped.
   None of it feeds XP, and none of it can be lost in a way that costs you
   progress.
   ========================================================================= */

import { HABITS, STATS, RANKS, LINES, PERMITS, JOB_LEVEL, TESTS, BODY } from './habits.js'
import { BOSSES, ITEMS, RARITY } from './lore.js'
import { derive, diff, byId, partsFor, questName, iso, addDays, diffDays, gradeOf, navyBf, round1 } from './model.js'
import { haptic, animateNumber, sparks, floatUp, pulse, riseFrom, reduceMotion } from './fx.js'
import { play } from './sfx.js'
import { notify, dismiss, openSheet, closeSheet, sheetOpen, esc } from './ui.js'
import { connect, writeState, flush, onStatus, onInbox, clearInbox, currentUid, inboxUrl } from './sync.js'
import * as archive from './archive.js'
import * as push from './push.js'

/* ---------- state ---------------------------------------------------------
   Firebase is the only copy. `loaded` stays false until the real record has
   come back, and every write is gated on it. Without that gate, opening the
   app before the network answers would render an empty board, and one tap
   would write a save containing exactly one day — silently destroying the
   record. A blank screen for a second is recoverable; that is not. */
let S = blank()
let loaded = false

function blank() {
  return { v: 3, log: {}, first: null, lastOpen: null, seen: [], name: '', title: '', equip: {}, km: {}, tests: {}, body: [], dq: '', rep: '', arch: '', push: null, _ts: 0 }
}

const listOf = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : [])
const num = (x, lo, hi) => typeof x === 'number' && isFinite(x) && x > lo && x <= hi

const DAY = /^\d{4}-\d{2}-\d{2}$/
/* Accepts whatever came back and fills in anything missing, so a partial or
   older document can never produce undefined downstream. RTDB hands arrays
   back as objects when they have gaps; both shapes are read. */
function adopt(r) {
  if (!r || typeof r !== 'object') return blank()
  const log = {}
  for (const k of Object.keys(r.log || {})) {
    if (!DAY.test(k)) continue
    const v = Array.isArray(r.log[k]) ? r.log[k] : Object.values(r.log[k] || {})
    const ids = v.filter((x) => typeof x === 'string')
    if (ids.length) log[k] = ids
  }
  const keys = Object.keys(log).sort()
  return {
    ...blank(),
    ...r,
    v: 3,
    log,
    first: r.first || keys[0] || null,
    seen: Array.isArray(r.seen) ? r.seen.filter((x) => typeof x === 'string') : Object.values(r.seen || {}),
    equip: r.equip && typeof r.equip === 'object' ? r.equip : {},
    ink: typeof r.ink === 'string' && r.ink.length >= 16 ? r.ink : undefined,
    km: Object.fromEntries(Object.entries(r.km && typeof r.km === 'object' ? r.km : {}).filter(([k, v]) => DAY.test(k) && num(v, 0, 100))),
    tests: Object.fromEntries(Object.entries(r.tests && typeof r.tests === 'object' ? r.tests : {})
      .map(([t, l]) => [t, listOf(l).filter((e) => e && num(e.v, 0, 10000) && DAY.test(e.d))])),
    body: listOf(r.body).filter((m) => m && DAY.test(m.d) && num(m.waist, 20, 250) && num(m.neck, 10, 100)),
    _ts: r._ts || 0,
  }
}

let writing = null
function save() {
  if (!loaded) return                   // never write over a record we have not read
  S._ts = Date.now()
  writing = writeState(S)
  pushBadge()
}

const seen = (k) => S.seen.indexOf(k) !== -1
const mark = (k) => { if (!seen(k)) S.seen.push(k) }

/* ---------- the model, cached ----------------------------------------------
   derive() is a pure function of the log and the date, so it is recomputed
   only when one of those changes: a tap bumps `rev`, midnight changes the
   day key, noon closes the late report. */
let rev = 0, cacheKey = '', M = null
function model() {
  const now = new Date()
  const k = rev + '|' + iso(now) + '|' + (now.getHours() < 12)
  if (k !== cacheKey || !M) { M = derive(S, now); cacheKey = k }
  return M
}
const bump = () => { rev++ }

/* ---------- actions -------------------------------------------------------- */
const lateOpen = (key, now = new Date()) =>
  !!S.first && now.getHours() < 12 && key === addDays(iso(now), -1) && key >= S.first

function offered(A, h, key) {
  if (key === A.today) {
    if (h.beyond) return A.opt.indexOf(h) !== -1 && ((S.log[key] || []).indexOf(h.id) !== -1 || (S.log[key] || []).indexOf('bodyweight') !== -1)
    return A.req.indexOf(h) !== -1 || A.opt.indexOf(h) !== -1 || A.early.indexOf(h) !== -1 || A.wk.indexOf(h) !== -1
  }
  const r = A.days[key]
  return !!r && (r.req.indexOf(h.id) !== -1 || r.wk.indexOf(h.id) !== -1 || r.early.indexOf(h.id) !== -1 || (r.opt.indexOf(h.id) !== -1 && !h.beyond))
}

/* Toggle one quest on one day. `key` is today, or yesterday for a late
   report. Everything that follows — XP, the Gate, the boss, the box — is
   the model's business; this only edits the log and asks what changed. */
export function toggle(id, key, ctx = {}) {
  if (!loaded) return                   // the board is not yours yet
  const now = new Date()
  const today = iso(now)
  key = key || today
  const late = key !== today
  if (late && !lateOpen(key, now)) return
  const h = byId(id)
  if (!h) return
  const A = model()
  if (!offered(A, h, key)) return

  const accepting = !S.first
  if (accepting) { S.first = key; mark('awaken'); dismiss('awaken') }
  if (!S.log[key]) S.log[key] = []
  const day = S.log[key]
  const at = day.indexOf(id)
  const adding = at === -1
  if (adding) day.push(id)
  else day.splice(at, 1)
  /* unticking the run takes its +KM entry with it, unless +KM itself is
     lowering the distance below the target */
  if (!adding && h.run && S.km && S.km[key] != null && !ctx.keepKm) { S.km = { ...S.km }; delete S.km[key] }

  /* THE RETURN QUEST. First completion of the day, after a day with a
     scheduled miss: bonus XP and a System line. The comeback micro-reward —
     the top-ranked intervention of 54 in a 61,000-person megastudy. A
     sentinel in the log keeps it derived and pays it once per day. */
  if (adding && !late && day.filter((x) => x[0] !== '_').length === 1 && day.indexOf('__return') === -1) {
    const y = A.days[addDays(key, -1)]
    if (y && y.req.length && !y.kept) day.push('__return')
  }
  /* an emptied day is dropped — unless it was the whole record. The rules
     refuse a save with no log at all (the net under the design), so the
     last day keeps a sentinel instead and the untick still gets written. */
  if (!day.some((x) => x[0] !== '_')) {
    if (Object.keys(S.log).length > 1) delete S.log[key]
    else S.log[key] = ['__cleared']
  }

  bump()
  const B = model()
  render()                              // first, so the moment animates the new state
  if (adding) {
    const ev = diff(A, B, key)
    if (accepting) ev.push({ type: 'accepted' })
    moment(ev, { ...ctx, id, key, gain: B.xp - A.xp, late, req: !h.optional && !h.weekly })
    lateKeys()
  } else {
    play('uncheck')
    haptic('light')
  }
  save()
}

/* ---------- +KM: the distance you actually ran ------------------------------
   The run card's tick logs today's target. +KM logs the real number. At or
   over the target it ticks the quest; under it, the km still count toward the
   week (so the plan knows) but the quest stays open. Next Monday the plan
   rises to meet a week you ran ahead — see RUN in habits.js. */
function setKm(key, v) {
  if (!loaded) return
  const today = iso(new Date())
  if (key !== today && !lateOpen(key)) return
  const A = model()
  const rec = A.days[key]
  const run = HABITS.find((h) => h.run)
  if (!rec || !run || !offered(A, run, key)) return
  v = round1(Math.max(0, Math.min(100, v)))
  const target = rec.runKm
  S.km = { ...(S.km || {}) }
  if (v > 0 && v !== target) S.km[key] = v
  else delete S.km[key]
  const logged = (S.log[key] || []).indexOf(run.id) !== -1
  const line = v > target ? `Ran ${v.toFixed(1)} km · ${round1(v - target).toFixed(1)} over the plan` : ''
  if (v >= target && v > 0 && !logged) return toggle(run.id, key, { el: cardEl(run.id, key), line, sub: line ? 'Next week’s target follows what you actually run, up to 10% more.' : '' })
  if ((v < target || v === 0) && logged) return toggle(run.id, key, { keepKm: true })
  bump()
  render()
  if (line) notify({ title: line, sub: 'Next week’s target follows what you actually run, up to 10% more.', sound: 'check', hold: 3200 })
  save()
}

const cardEl = (id, key) => document.querySelector(`.q[data-id="${id}"][data-day="${key}"]`)

function openKm(key) {
  const M = model()
  const rec = M.days[key]
  if (!rec) return
  let v = S.km && S.km[key] != null ? S.km[key] : rec.runKm
  notify({
    head: 'QUEST INFO', title: 'Distance run', sound: null,
    sub: `<div class="kmstep"><button type="button" data-d="-1">&#8722;1</button><button type="button" data-d="-0.1">&#8722;.1</button>
      <b class="kmv">${v.toFixed(1)}</b><span>km</span>
      <button type="button" data-d="0.1">+.1</button><button type="button" data-d="1">+1</button></div>
      <div class="dim">Target ${rec.runKm.toFixed(1)} km${key !== M.today ? ' &#183; yesterday' : ''}. Run further and next week&#8217;s target rises to meet you &#8212; never more than 10% over what you ran.</div>`,
    actions: [
      { label: 'CANCEL' },
      { label: 'SAVE', primary: true, onClick: () => { setKm(key, v) } },
    ],
    onShow: (el) => {
      const out = el.querySelector('.kmv')
      el.querySelectorAll('.kmstep button').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation()
        v = round1(Math.max(0, Math.min(100, v + +b.dataset.d)))
        out.textContent = v.toFixed(1)
      }))
    },
  })
}

/* ---------- the inbox: Shortcut / NFC taps -----------------------------------
   Add-only and idempotent: a sticker can log a quest, never un-log one, and
   the same entry arriving twice changes nothing. It is deleted only after the
   save carrying it has been written. */
function applyInbox(k, v) {
  if (!loaded) return
  if (!v || typeof v.q !== 'string' || typeof v.t !== 'number' || !S.ink || v.k !== S.ink) { clearInbox(k); return }
  const key = iso(new Date(v.t))
  const h = byId(v.q)
  const A = model()
  const ok = h && key <= A.today && (!S.first || key >= S.first) && (S.first || key === A.today) && offered(A, h, key)
  if (!ok || (S.log[key] || []).indexOf(h.id) !== -1) { clearInbox(k); return }
  const accepting = !S.first
  if (accepting) { S.first = key; mark('awaken'); dismiss('awaken') }
  ;(S.log[key] = S.log[key] || []).push(h.id)
  bump()
  const B = model()
  render()
  const ev = diff(A, B, key)
  if (accepting) ev.push({ type: 'accepted' })
  moment(ev, { id: h.id, key, gain: B.xp - A.xp, remote: true, req: !h.optional && !h.weekly })
  lateKeys()
  save()
  Promise.resolve(writing).then(() => clearInbox(k)).catch(() => {})
}

/* ---------- ONE TAP, ONE MOMENT --------------------------------------------
   A single tap can finish a quest, keep the day, kill the boss, drop a box,
   level a skill and level you up. v1 played every one of those as its own
   full-screen animation, twelve in a row. Here the events are ranked, the
   biggest gets its effect and its sound, and the rest become lines inside
   that one window. Nothing blocks the next tap. */
const PRI = { accepted: 110, rank: 100, class: 90, kill: 80, red: 75, trial: 70, level: 60, title: 50, kept: 40, weekly: 35, returned: 32, box: 30, skill: 20 }
const ONCE = {
  rank: (e) => 'rank:' + RANKS[e.to].r,
  class: () => 'class',
  trial: () => 'trial',
  kill: (e) => 'kill:' + e.kill.week,
  red: (e) => 'red:' + e.week.start,
  title: (e) => 'title:' + e.title.id,
}
const rarityName = (id) => (RARITY.find((r) => r.id === id) || {}).name || id

function lineFor(e) {
  switch (e.type) {
    case 'accepted': return LINES.accepted
    case 'rank': return `Rank reassessment: ${RANKS[e.from].r} → ${RANKS[e.to].r}`
    case 'class': return `Job Change complete: ${e.job.name}`
    case 'trial': return 'Job Change Quest has arrived'
    case 'kill': return `${e.kill.boss.name} defeated · ARISE: ${e.kill.boss.shadow}`
    case 'red': return `Red Gate · ${e.week.boss.shadow} → ${gradeOf(e.shadow)}`
    case 'level': return `Level up! Lv.${e.to}`
    case 'title': return `Title acquired: ${e.title.name}`
    case 'kept': return LINES.complete.replace(/\.$/, '')
    case 'weekly': return `Weekly Quest complete: ${byId(e.id).name}`
    case 'returned': return LINES.returned.replace(/\.$/, '')
    case 'box': return `Random Box: ${e.item.name} (${rarityName(e.item.rarity)})`
    case 'skill': return `Skill level up: ${e.name} Lv.${e.level}`
  }
  return ''
}

function moment(evs, ctx = {}) {
  evs = evs.filter((e) => {
    const f = ONCE[e.type]
    if (!f) return true
    const k = f(e)
    if (seen(k)) return false
    mark(k)
    return true
  })
  /* two rank-ups at once (a big late import) → the higher one only */
  const ranks = evs.filter((e) => e.type === 'rank')
  if (ranks.length > 1) evs = evs.filter((e) => e.type !== 'rank' || e === ranks[ranks.length - 1])
  evs.sort((a, b) => PRI[b.type] - PRI[a.type])

  tapFeel(ctx)
  /* the record comes alive whether or not the kept day is the headline */
  const kept = evs.find((e) => e.type === 'kept')
  if (kept) flare(kept.key)
  const top = evs[0]
  buzzOk = !!(ctx.el || ctx.ev)          // haptics answer a thumb, never a background event
  if (!top) {
    play('check')
    buzz('light')
    if (ctx.line) notify({ title: ctx.line, sub: ctx.sub ? esc(ctx.sub) : '', sound: null, hold: 3200 })
    return
  }
  let lines = evs.slice(1).map(lineFor).filter(Boolean)
  if (ctx.line) lines.unshift(ctx.line)
  if (lines.length > 5) lines = lines.slice(0, 4).concat([`+${lines.length - 4} more`])
  bigEffect(top, lines, ctx)
}
let buzzOk = false
const buzz = (k) => { if (buzzOk) haptic(k) }

/* 11 + 12: the card presses in, light sweeps it, the diamond pops with a
   ring, "+35 XP" rolls up; today's square charges, the boss flinches. */
function tapFeel(ctx) {
  const el = ctx.el
  if (el) pulse(el, 'hit', 760)
  const pt = ctx.ev && (ctx.ev.clientX || ctx.ev.clientY) ? ctx.ev : el ? centerOf(el) : null
  if (pt && ctx.gain > 0) floatUp(pt.clientX, pt.clientY - 10, '+' + ctx.gain + ' XP')
  if (ctx.ev) sparks(ctx.ev)
  const cell = document.querySelector('#grid i[data-k="' + ctx.key + '"]')
  if (cell) pulse(cell, 'charge', 520)
  if (ctx.req && ctx.key === iso(new Date())) pulse(document.getElementById('gate'), 'hurt', 420)
}
const centerOf = (el) => { const r = el.getBoundingClientRect(); return { clientX: r.left + r.width * 0.72, clientY: r.top + r.height / 2 } }

function bigEffect(top, lines, ctx) {
  switch (top.type) {
    case 'accepted':
      buzz('double')
      return notify({ title: LINES.accepted, sub: esc(LINES.firstDay), lines, big: true, sound: 'complete' })
    case 'rank':
      return reassess(top, lines)
    case 'class':
      buzz('heavy')
      pulse(document.getElementById('plate'), 'slam', 800)
      return notify({
        head: 'JOB CHANGE', title: 'Job Change complete', big: true, tone: 'violet', sound: 'arise', lines,
        sub: `<div class="cls cond">${esc(top.job.name)}</div><div>${esc(top.job.line)}</div>`,
      })
    case 'kill': {
      buzz('heavy')
      pulse(document.getElementById('gate'), 'killed', 1400)
      const b = top.kill.boss
      return notify({
        head: 'GATE CLEARED', title: 'ARISE', big: true, tone: 'violet', sound: 'arise', lines,
        img: `bosses/${b.id}.webp`,
        sub: `${esc(b.name)} has fallen.<br>Shadow extracted: <b>${esc(b.shadow)}</b> &#183; ${esc(gradeOf(top.shadow))}`,
        onShow: (el) => { const i = el.querySelector('.sw-img'); if (i) setTimeout(() => i.classList.add('risen'), 60) },
      })
    }
    case 'red':
      buzz('heavy')
      pulse(document.getElementById('gate'), 'redflash', 1400)
      return notify({
        head: 'RED GATE', title: 'Red Gate cleared', big: true, tone: 'red', sound: 'red', lines,
        img: `bosses/${top.week.boss.id}.webp`,
        sub: `7 of 7. Not one permit spent.<br><b>${esc(top.week.boss.shadow)}</b> rises to ${esc(gradeOf(top.shadow))}.`,
      })
    case 'trial':
      buzz('double')
      return notify({
        head: 'QUEST INFO', title: 'Job Change Quest has arrived', sound: 'key', lines, big: true,
        sub: `Level ${JOB_LEVEL} reached. From tomorrow: keep 5 days inside any one week.<br>A short week just rolls into the next. Nothing is lost.`,
      })
    case 'level':
      buzz('double')
      riseFrom(document.getElementById('xpwrap'), '[LEVEL UP!]')
      play('levelUp')
      if (lines.length) notify({ title: `Level up! Lv.${top.to}`, lines, sound: null })
      return
    case 'title':
      buzz('double')
      stampTitle()
      return notify({ title: 'Title acquired: ' + top.title.name, sub: esc(top.title.how), lines })
    case 'kept':
      buzz('double')
      return notify({ head: 'QUEST INFO', title: LINES.complete, lines, sound: 'complete' })
    case 'box':
      buzz('light')
      return notify({ title: 'Item acquired: Random Box', sub: `${esc(top.item.name)} &#183; ${esc(rarityName(top.item.rarity))}`, lines, sound: 'box' })
    default:
      buzz('light')
      return notify({ title: lineFor(top), lines })
  }
}

function flare(key) {
  const cell = document.querySelector('#grid i[data-k="' + key + '"]')
  if (cell) setTimeout(() => pulse(cell, 'flare', 1000), 120)
}
function stampTitle() {
  setTimeout(() => pulse(document.querySelector('#metaline .title'), 'stamp', 900), 30)
}

/* 4: the Hunter Association reassessment. Mana counts up to your lifetime XP
   and the new letter slams in with the sound. */
function reassess(top, lines) {
  const M = model()
  const r = RANKS[top.to]
  buzz('heavy')
  return notify({
    head: 'HUNTER ASSOCIATION', title: 'Rank reassessment', big: true, tone: 'gold', sound: null, lines,
    sub: `<div class="mana"><span>MANA MEASURED</span><b class="mana-n">0</b></div>
      <div class="reletter cond"><span class="from">${RANKS[top.from].r}</span><i>&#8594;</i><span class="to">${r.r}</span></div>
      ${r.loot ? `<div class="loot">GRANTED: ${esc(r.loot)}</div>` : ''}`,
    onShow: (el) => {
      animateNumber(el.querySelector('.mana-n'), M.xp, '', 700, 0)
      setTimeout(() => {
        el.querySelector('.to').classList.add('slam')
        pulse(document.getElementById('emblem'), 'slam', 800)
        play('slam')
      }, reduceMotion ? 0 : 720)
    },
  })
}

/* ---------- windows on open -------------------------------------------------
   Awakening on day 0. Otherwise, at most: the Monday report, the Daily Quest
   arrival (with any keys granted today folded in), and anything earned while
   the app was closed (a sticker tap, a restored archive) that was never
   announced. */
function opening() {
  const M = model()
  const away = S.lastOpen ? diffDays(S.lastOpen, M.today) : 0
  if (away >= 3) { awayAtOpen = away; cbDismissed = false }
  S.lastOpen = M.today
  if (!M.started) {
    if (!seen('awaken')) awakening()
    return
  }
  if (M.report && S.rep !== M.cur.start) { S.rep = M.cur.start; mondayReport(M) }
  if (S.dq !== M.today) { S.dq = M.today; arrival(M) }
  const pend = pendingEvents(M)
  if (pend.length) moment(pend, {})
  save()
}

function awakening() {
  notify({
    id: 'awaken', head: 'NOTIFICATION', title: LINES.awaken, big: true,
    sub: 'Accept, or tap your first quest.',
    actions: [
      { label: 'RESTORE ARCHIVE', onClick: () => { restore(); return false } },
      { label: 'ACCEPT', primary: true, onClick: () => { mark('awaken'); setTimeout(() => notify({ title: LINES.accepted, sub: 'Your first quest is below. Midnight is the only rule.', sound: 'complete' }), 200) } },
    ],
  })
}

function keyLines(M) {
  const out = []
  for (const h of HABITS) {
    const g = M.grants[h.id]
    if (g == null || g === 0 || g > M.dayIdx || seen('grant:' + h.id)) continue
    mark('grant:' + h.id)
    out.push(LINES.key, 'Quest unsealed: ' + questName(h, M.today).toUpperCase())
    unsealing.add(h.id)
  }
  return out
}
const unsealing = new Set()

/* a Gate cleared retroactively (late report, sticker) can hand over a key
   after today's arrival window has already come and gone */
function lateKeys() {
  const M = model()
  if (!M.started || S.dq !== M.today) return
  const k = keyLines(M)
  if (!k.length) return
  notify({ title: LINES.key, lines: k.filter((l) => l !== LINES.key), sound: 'key', sub: 'Optional today. Required from tomorrow.' })
  render()
}

function arrival(M) {
  const keys = keyLines(M)
  /* the run plan's weekly move, said once, on the Monday it happens */
  if (M.today === M.cur.start && M.weeks.length > 1) {
    const L = M.run.L.toFixed(1)
    if (M.run.why === 'ahead') keys.push(`Run target raised to ${L} km — you ran ahead`)
    else if (M.run.why === 'hold') keys.push(`Run target held at ${L} km — a lighter week, so no increase`)
    else keys.push(`Run target: ${L} km (+5%)`)
  }
  const goals = M.req.map((h) => {
    const parts = partsFor(h, M.run.km, M.rankIdx)
    if (!parts.length) return `<div class="goal"><b>${esc(h.name)}</b></div>`
    return `<div class="goal"><b>${esc(h.name)}</b>${parts.map((p) => `<span>${esc(p.label)} [0/${fmtN(p)}]</span>`).join('')}</div>`
  }).join('')
  const dg = M.dungeon ? `<div class="goal dim">Today's Dungeon: ${esc(M.dungeon)} &#183; optional</div>` : ''
  notify({
    head: 'QUEST INFO', title: LINES.arrived, lines: keys, hold: 5200,
    sound: keys.length ? 'key' : 'window',
    sub: goals + dg,
  })
}

function pendingEvents(M) {
  const out = []
  for (const t of M.earned) if (!seen('title:' + t.id)) out.push({ type: 'title', title: t })
  for (const k of M.kills) if (!seen('kill:' + k.week)) out.push({ type: 'kill', kill: k, shadow: M.shadows[k.boss.id] })
  for (const w of M.weeks) if (w.red && !seen('red:' + w.start)) out.push({ type: 'red', week: w, shadow: M.shadows[w.boss.id] })
  if (M.job.state === 'revealed' && !seen('class')) out.push({ type: 'class', job: M.job })
  if (M.job.state !== 'none' && !seen('trial')) out.push({ type: 'trial' })
  for (let r = 1; r <= M.rankIdx; r++) if (!seen('rank:' + RANKS[r].r)) out.push({ type: 'rank', from: r - 1, to: r })
  return out
}

/* A record from before v3 has earned things that were never announced under
   this system. Mark them all as seen once, silently, so the first open of
   the new version is not a flood of windows for old news. */
function quietMigrate() {
  const M = model()
  for (const e of pendingEvents(M)) { const f = ONCE[e.type]; if (f) mark(f(e)) }
  for (const h of HABITS) if (M.grants[h.id] != null && M.grants[h.id] <= M.dayIdx) mark('grant:' + h.id)
  mark('awaken')
}

/* 26 + 30: the Monday report, and sending it to one person. */
function mondayReport(M) {
  const r = M.report
  const boss = r.kill ? `${r.boss.name} &#8594; ${esc(r.boss.shadow)}` : `${esc(r.boss.name)} &#183; escaped`
  const stale = !S.arch || diffDays(S.arch, M.today) >= 28
  notify({
    head: 'WEEKLY REPORT', title: r.red ? 'Red Gate cleared' : r.cleared ? 'Gate cleared' : 'The week closed', big: true,
    tone: r.red ? 'red' : null,
    sub: `<div class="rep">
      <span>KEPT</span><b>${r.kept}/${r.avail} &#183; ${r.permitsUsed} permit${r.permitsUsed === 1 ? '' : 's'}</b>
      <span>BOSS</span><b>${boss}</b>
      <span>RUN</span><b>${r.run.ran.toFixed(1)} of ${r.run.plan.toFixed(1)} km</b>
      <span>XP</span><b>+${r.xp}</b>
      <span>LEVEL</span><b>${r.levelFrom === r.levelTo ? r.levelTo : r.levelFrom + ' &#8594; ' + r.levelTo}</b>
      <span>RANK</span><b>${r.rankFrom === r.rankTo ? RANKS[r.rankTo].r : RANKS[r.rankFrom].r + ' &#8594; ' + RANKS[r.rankTo].r}</b>
      <span>BOXES</span><b>${r.boxes}</b>
    </div>${r.cleared ? '' : '<div class="dim">Nothing lost. The boss is back on Monday.</div>'}`,
    actions: [
      { label: 'SEND', onClick: () => { shareReport(); return false } },
      ...(stale ? [{ label: 'ARCHIVE', onClick: () => { saveArchive(); return false } }] : []),
      { label: 'CLOSE', primary: true },
    ],
  })
}

function reportText(M) {
  const r = M.report
  if (!r) return ''
  const d = new Date(r.start + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return [
    `THE SYSTEM — week of ${d}`,
    `Gate: ${r.red ? 'RED GATE (7 of 7)' : r.cleared ? 'cleared' : 'not cleared'} — ${r.kept} of ${r.avail} kept, ${r.permitsUsed} rest permit${r.permitsUsed === 1 ? '' : 's'}`,
    `Boss: ${r.boss.name}${r.kill ? ` — risen as ${r.boss.shadow}` : ' — escaped'}`,
    `Run: ${r.run.ran.toFixed(1)} of ${r.run.plan.toFixed(1)} km`,
    `XP +${r.xp} · Level ${r.levelTo} · ${RANKS[r.rankTo].r}-rank`,
  ].join('\n')
}

async function shareReport() {
  const text = reportText(model())
  if (!text) return notify({ title: 'No finished week to report yet', sound: null })
  try {
    if (navigator.share) { await navigator.share({ text }); return }
    await navigator.clipboard.writeText(text)
    notify({ title: 'Report copied', sound: null, hold: 2200 })
  } catch (_) {}
}

async function saveArchive() {
  const today = iso(new Date())
  const r = await archive.saveArchive(S, today)
  if (r === 'cancelled') return
  S.arch = today
  save()
  notify({ title: 'Archive copy saved', sub: 'Keep it somewhere that is not this phone.', sound: null, hold: 2800 })
  if (sheetOpen()) sheetSystem()
}

async function restore() {
  try {
    const inc = await archive.pickArchive()
    if (!inc) return
    if (!loaded) throw new Error('Wait for the archive to connect first.')
    S = { ...archive.mergeSaves(S, inc), v: 3 }
    dismiss('awaken')
    bump()
    quietMigrate()                      // it is your own history: no replay of every old moment
    const B = model()
    S.dq = B.today
    const days = Object.keys(S.log).length
    save()
    render()
    notify({ title: 'Archive restored', sub: `${days} logged day${days === 1 ? '' : 's'} &#183; level ${B.level} &#183; ${B.rank}&#8209;rank &#183; ${B.gates} shadow${B.gates === 1 ? '' : 's'}`, sound: 'complete' })
    if (sheetOpen()) sheetSystem()
  } catch (e) {
    notify({ title: 'Restore failed', sub: esc(e.message || String(e)), sound: null })
  }
}

/* ---------- render --------------------------------------------------------- */
const $ = (s) => document.querySelector(s)
const fmtN = (p) => (p.unit === 'km' ? p.n.toFixed(1) + ' km' : p.n + (p.unit ? ' ' + p.unit : ''))
const RAMP = ['#0d1017', '#132534', '#17455f', '#1d7ba6', '#33b6e8']

let lastDay = null, lastLevel = null, awayAtOpen = 0, cbDismissed = false

function render() {
  const M = model()
  const now = new Date()
  const newDay = lastDay && lastDay !== M.today
  lastDay = M.today

  applyEquip(M)
  renderPlate(M)
  renderComeback(M)
  renderRecord(M)
  renderGate(M)
  renderStatus(M)
  renderQuests(M)
  renderLate(M, now)
  renderWeekly(M)
  $('#lv').textContent = 'lv ' + M.level
  $('#meta').textContent = now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).toLowerCase()
  document.documentElement.style.setProperty('--rem', M.req.length - M.today_.doneReq)
  tickClock()

  /* 2 + 13: midnight while the app is open — the board resets with a sweep
     and the next Daily Quest arrives. */
  if (newDay && loaded) {
    pulse($('#list'), 'newday', 900)
    opening()
  }
}

function applyEquip(M) {
  const root = document.documentElement
  const aura = S.equip.aura && M.inv[S.equip.aura] ? ITEMS.find((i) => i.id === S.equip.aura) : null
  if (aura) root.style.setProperty('--acc-rgb', aura.rgb)
  else root.style.removeProperty('--acc-rgb')
  const sigil = S.equip.sigil && M.inv[S.equip.sigil] ? S.equip.sigil : ''
  if (sigil) $('#emblem').dataset.sigil = sigil
  else delete $('#emblem').dataset.sigil
}

const titleShown = (M) => (S.title && M.earned.find((t) => t.id === S.title)) || M.latest

function renderPlate(M) {
  const t = titleShown(M)
  $('#rank').textContent = M.rank
  $('#metaline').innerHTML = `${M.rank}&#8209;rank &#183; lv ${M.level}` +
    (M.job.state === 'revealed' ? ' &#183; ' + esc(M.job.name.toLowerCase()) : '') +
    (t ? ' &#183; <span class="title">' + esc(t.name) + '</span>' : '')
  const pct = Math.round((M.into / M.need) * 100) + '%'
  const bar = $('#xpbar')
  /* a level-up fills the bar, then it restarts from the overflow */
  if (lastLevel != null && M.level > lastLevel && !reduceMotion) {
    bar.style.width = '100%'
    setTimeout(() => {
      bar.style.transition = 'none'
      bar.style.width = '0%'
      void bar.offsetWidth
      bar.style.transition = ''
      bar.style.width = pct
    }, 460)
  } else bar.style.width = pct
  lastLevel = M.level
  $('#xpnum').textContent = M.dtl ? `${M.dtl}d to lv ${M.level + 1}` : `${M.into}/${M.need}`
}

function renderComeback(M) {
  const cb = $('#comeback')
  if (awayAtOpen >= 3 && !cbDismissed) {
    cb.hidden = false
    cb.querySelector('h2').textContent = `${awayAtOpen} DAYS CLOSED.`
    cb.querySelector('p').innerHTML = `level ${M.level} &#183; ${M.rank}&#8209;rank &#183; ${M.lifetime} logged<br>nothing lost &#183; no debt &#183; one quest reopens the gate`
  } else cb.hidden = true
}

/* swap an element's state classes without touching one-shot animation
   classes (charge, flare) that a tap may have just added */
function setBase(el, cls) {
  if (el._base === cls) return
  if (el._base) el.classList.remove(...el._base.split(' '))
  el.classList.add(...cls.split(' '))
  el._base = cls
}

let gridBuilt = false
function renderRecord(M) {
  const g = $('#grid')
  if (!gridBuilt) {
    g.innerHTML = M.grid.map((c) => '<b>' + c.cells.map(() => '<i></i>').join('') + '</b>').join('')
    gridBuilt = true
  }
  const cols = g.children
  M.grid.forEach((c, ci) => {
    const col = cols[ci]
    col.className = c.red ? 'red' : ''
    c.cells.forEach((cell, ri) => {
      const el = col.children[ri]
      el.dataset.k = cell.key
      setBase(el, 'c-' + cell.st + (cell.today ? ' today' : '') + (cell.lv === 4 ? ' full' : ''))
      el.style.background = cell.st === 'void' || cell.st === 'future' || cell.st === 'permit' ? '' : RAMP[cell.lv]
    })
  })
  const w = M.cur
  animateNumber($('#week'), w.kept)
  $('#weekof').textContent = '/' + w.avail
  animateNumber($('#cleared'), M.gates)
  animateNumber($('#rate'), M.rate30, '%')
  animateNumber($('#life'), M.lifetime)
}

const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
function renderGate(M) {
  const w = M.cur, b = w.boss
  const img = $('#bossimg')
  const src = `bosses/${b.id}.webp`
  if (img.getAttribute('src') !== src) img.setAttribute('src', src)
  $('#bossrank').textContent = b.rank
  $('#bossname').textContent = b.name
  $('#gatek').textContent = `GATE · WEEK ${M.weeks.length}` + (w.cycle ? ` · ${'+'.repeat(Math.min(w.cycle, 3))}` : '')
  const left = diffDays(M.today, w.end) + 1
  $('#gatewhen').textContent = w.cleared ? (w.red ? 'RED GATE' : 'CLEARED') : `${left}d left`
  const gate = $('#gate')
  gate.classList.toggle('cleared', w.cleared)
  gate.classList.toggle('red', w.red)

  /* HP: one segment per kept day needed. Today's quests charge the next
     segment; it breaks when the day is kept. Nothing ever heals. */
  const broken = Math.min(w.kept, w.need)
  const charge = !w.cleared && !M.today_.kept ? M.today_.frac : 0
  const hp = $('#hp')
  if (hp.children.length !== w.need) hp.innerHTML = '<i><s></s></i>'.repeat(w.need)
  Array.from(hp.children).forEach((seg, i) => {
    const gone = i >= w.need - broken
    seg.className = gone ? 'gone' : ''
    const chargeIdx = w.need - broken - 1
    seg.firstChild.style.width = !gone && i === chargeIdx ? Math.round(charge * 100) + '%' : '0%'
  })

  $('#strip').innerHTML = w.strip.map((d, i) =>
    `<span class="pip p-${d.st}${d.key === M.today ? ' now' : ''}"><i></i><em>${DL[i]}</em></span>`).join('')

  const pl = '&#9670;'.repeat(w.permitsLeft) + '<span class="used">' + '&#9671;'.repeat(PERMITS - w.permitsLeft) + '</span>'
  let note
  if (w.red) note = `7 of 7 &#183; ${esc(b.shadow)} rose, grade raised`
  else if (w.cleared) note = `${esc(b.shadow)} rose as a shadow &#183; 7 of 7 turns the gate red`
  else {
    const togo = w.need - w.kept
    note = `${togo} more kept day${togo === 1 ? '' : 's'} kills it &#183; rest permits <span class="permits">${pl}</span>`
  }
  $('#gatenote').innerHTML = note
}

function renderStatus(M) {
  const t = titleShown(M)
  const job = M.job.state === 'revealed' ? M.job.name
    : M.job.state === 'trial' ? `Trial ${M.job.count}/5`
    : 'None'
  $('#idgrid').innerHTML = `
    <span>NAME</span><b>${esc(S.name || 'Player')}</b>
    <span>JOB</span><b>${esc(job)}</b>
    <span>TITLE</span><b>${t ? esc(t.name) : '—'}</b>
    <span>LEVEL</span><b>${M.level}</b>`
  const nx = M.next
  $('#nextrank').innerHTML = !nx ? 'RANK S &#183; the Association has nothing left to measure'
    : `NEXT RANK <b>${nx.r}</b> &#183; XP ${nx.xpOk ? '<i class="ok">&#10003;</i>' : `${M.xp}/${nx.at}`} &#183; trials <span class="${nx.passed === nx.trials.length ? 'ok' : ''}">${nx.passed}/${nx.trials.length}</span>`
  const box = $('#stats')
  if (box.children.length !== M.stats.length || box.dataset.sig !== M.stats.map((s) => s.key).join()) {
    box.innerHTML = M.stats.map((s) => `<div class="stat" data-s="${s.key}"><b>${s.key}</b><u></u><span class="bar"><span></span></span><i></i></div>`).join('')
    box.dataset.sig = M.stats.map((s) => s.key).join()
  }
  M.stats.forEach((s, i) => {
    const row = box.children[i]
    animateNumber(row.querySelector('u'), s.value)
    row.querySelector('.bar span').style.width = s.form + '%'
    const a = row.querySelector('i')
    a.className = s.trend > 0 ? 'up' : s.trend < 0 ? 'dn' : 'fl'
    a.innerHTML = s.trend > 0 ? '&#9650;' : s.trend < 0 ? '&#9660;' : '&#8212;'
  })
}

/* ---- quest cards, keyed: an element persists across renders, so a tap's
   animation is never cut off by the render the tap itself causes. v2
   rebuilt the list with innerHTML on every render, which replayed every
   card's entrance animation on every tap. ------------------------------- */
function keyed(parent, items, make, update) {
  const old = new Map()
  for (const el of Array.from(parent.children)) old.set(el.dataset.k, el)
  let prev = null
  for (const it of items) {
    let el = old.get(it.k)
    if (el && el.dataset.sig !== it.sig) { el.remove(); el = null }
    if (!el) { el = make(it); el.dataset.k = it.k; el.dataset.sig = it.sig }
    else old.delete(it.k)
    update(el, it)
    const at = prev ? prev.nextSibling : parent.firstChild
    if (at !== el) parent.insertBefore(el, at)
    prev = el
  }
  for (const el of old.values()) el.remove()
}

function cardView(M, h, key, done, dayIdx) {
  const rec = M.days[key]
  const parts = partsFor(h, rec ? rec.runKm : 0, M.rankIdx)
  const name = questName(h, key)
  const fresh = h.queue && !h.weekly && M.grants[h.id] === dayIdx
  const early = rec && rec.early.indexOf(h.id) !== -1
  const tag = h.beyond ? 'HIDDEN QUEST' : h.lift ? "TODAY'S DUNGEON" : early ? earlyTag(M, h) : fresh ? 'UNSEALED TODAY · OPTIONAL' : ''
  const detail = h.lift ? 'optional · never costs the Gate' : h.beyond ? 'optional · +' + h.xp : h.detail || ''
  return {
    k: h.id + '@' + key, h, key, done, parts, name, tag,
    detail: h.beyond ? '' : detail,
    cue: !done && h.cue && M.sliding[h.id] ? h.cue : '',
    xp: h.xp,
    ran: h.run && rec && S.km && S.km[key] != null ? S.km[key] : null,
    sig: [h.id, key, name, tag, detail, parts.map((p) => p.label + fmtN(p)).join(',')].join('|'),
  }
}

/* what the System still wants before this quest becomes required */
function earlyTag(M, h) {
  const s = M.sealed.find((x) => x.h === h)
  if (!s) return 'NOT REQUIRED YET'
  if (s.why === 'days') return `NOT REQUIRED YET · FROM ${s.inDays === 1 ? 'TOMORROW' : 'DAY ' + (M.dayIdx + s.inDays + 1)}`
  if (s.why === 'monday') return 'NOT REQUIRED YET · FROM MONDAY'
  return 'NOT REQUIRED YET · A GATE UNLOCKS IT'
}

function cardMake(v) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'q' + (v.h.optional || v.tag.indexOf('NOT REQUIRED') === 0 ? ' opt' : '') + (v.h.lift ? ' lift' : '') + (v.h.beyond ? ' beyond' : '') + (v.h.run ? ' run' : '')
  el.dataset.id = v.h.id
  el.dataset.day = v.key
  el.innerHTML = `<i class="tick t"></i><i class="tick b"></i>
    <span class="dia"><i class="ring"></i></span>
    <span class="qt">
      ${v.tag ? `<span class="tag mono">${esc(v.tag)}</span>` : ''}
      <span class="cue mono" hidden></span>
      <b>${esc(v.name)}</b>
      ${v.parts.length
        ? `<span class="parts mono">${v.parts.map((p) => `<span class="pt${p.short ? ' short' : ''}"><em>${esc(p.label)}</em><s></s></span>`).join('')}</span>`
        : v.detail ? `<em class="det">${esc(v.detail)}</em>` : ''}
    </span>
    ${v.h.run ? '<span class="kmbtn mono" role="button" data-km="1">+KM</span>' : ''}
    <u class="qx mono"></u>
    <i class="sweep"></i>`
  if (unsealing.has(v.h.id)) { unsealing.delete(v.h.id); pulse(el, 'unseal', 1200) }
  return el
}

function cardUpdate(el, v) {
  el.classList.toggle('done', v.done)
  const cue = el.querySelector('.cue')
  cue.hidden = !v.cue
  if (v.cue) cue.textContent = v.cue + ' →'
  el.querySelectorAll('.parts s').forEach((s, i) => {
    const p = v.parts[i]
    const n = p.unit === 'km' ? p.n.toFixed(1) : p.n
    const got = p.run && v.ran != null ? v.ran.toFixed(1) : v.done ? n : 0
    s.textContent = `[${got}/${n}${p.unit ? ' ' + p.unit : ''}]`
    s.classList.toggle('over', p.run && v.ran != null && v.ran > p.n)
  })
  el.querySelector('.qx').textContent = (v.done ? '+' : '') + v.xp
}

function renderQuests(M) {
  const key = M.today
  const got = S.log[key] || []
  const cards = M.req.map((h) => cardView(M, h, key, got.indexOf(h.id) !== -1, M.dayIdx))
  for (const h of M.early) cards.push(cardView(M, h, key, got.indexOf(h.id) !== -1, M.dayIdx))
  for (const h of M.opt) {
    if (h.beyond && got.indexOf('bodyweight') === -1 && got.indexOf(h.id) === -1) continue
    cards.push(cardView(M, h, key, got.indexOf(h.id) !== -1, M.dayIdx))
  }
  keyed($('#list'), cards, cardMake, cardUpdate)

  const doneN = M.today_.doneReq
  $('#count').textContent = `${doneN}/${M.req.length}`
  $('#dungeon').innerHTML = `Today: <b>${esc(M.dungeon || 'REST')}</b> &#183; run week ${M.run.week}` +
    (M.run.short ? ' &#183; short day' : '')
}

let lateSeenThisSession = false
function renderLate(M, now) {
  const y = addDays(M.today, -1)
  const rec = M.days[y]
  const box = $('#late')
  const open = lateOpen(y, now) && rec
  if (open && rec.req.length && !rec.kept) lateSeenThisSession = true
  if (!open || !lateSeenThisSession) { box.hidden = true; $('#latelist').innerHTML = ''; return }
  box.hidden = false
  const got = S.log[y] || []
  const hs = rec.req.concat(rec.early, rec.opt.filter((id) => !byId(id).beyond)).map(byId)
  keyed($('#latelist'), hs.map((h) => {
    const v = cardView(M, h, y, got.indexOf(h.id) !== -1, rec.i)
    v.cue = ''
    return v
  }), (v) => { const el = cardMake(v); el.classList.add('small'); return el }, cardUpdate)
}

function renderWeekly(M) {
  const box = $('#weekly')
  if (!M.wk.length) { box.hidden = true; return }
  box.hidden = false
  const left = diffDays(M.today, M.cur.end) + 1
  $('#wkclock').textContent = `resets monday · ${left}d`
  const got = S.log[M.today] || []
  keyed($('#wklist'), M.wk.map((h) => ({ k: h.id, sig: h.id, h })),
    (v) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'q wk'
      el.dataset.id = v.h.id
      el.dataset.day = M.today
      el.innerHTML = `<i class="tick t"></i><i class="tick b"></i><span class="dia"><i class="ring"></i></span>
        <span class="qt"><b>${esc(v.h.name)}</b><span class="pips mono"></span></span><u class="qx mono"></u><i class="sweep"></i>`
      return el
    },
    (el, v) => {
      el.dataset.day = M.today
      const n = M.cur.sessions[v.h.id] || 0
      const doneToday = got.indexOf(v.h.id) !== -1
      el.classList.toggle('done', doneToday)
      el.classList.toggle('met', n >= v.h.weekly)
      el.querySelector('.pips').innerHTML = `[${n}/${v.h.weekly}] ` +
        Array.from({ length: Math.max(v.h.weekly, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('') +
        (n >= v.h.weekly ? ' &#183; complete' : ' &#183; missing it costs nothing')
      el.querySelector('.qx').textContent = (doneToday ? '+' : '') + v.h.xp
    })
}

/* the fiction's rule: the Daily Quest resets at midnight. a countdown, not
   a time of day. */
function tickClock() {
  const el = $('#clock')
  if (!el) return
  const now = new Date(), end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const ms = end - now, h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  el.textContent = `${h}h ${String(m).padStart(2, '0')}m`
}

function pushBadge() {
  if (!loaded) return
  const M = model()
  const n = M.req.length - M.today_.doneReq
  try {
    if (navigator.setAppBadge) { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge() }
    navigator.serviceWorker?.controller?.postMessage({ type: 'badge', count: n })
  } catch (_) {}
  if (S.push && S.push.on) push.report(currentUid(), S.push.token, S.push.hour, M.today, n)
}

/* ---------- sheets ---------------------------------------------------------- */
function sheetStatus() {
  const M = model()
  const t = titleShown(M)
  const job = M.job.state === 'revealed' ? `${M.job.name}`
    : M.job.state === 'trial' ? `Trial &#183; ${M.job.count}/5 kept this week &#183; ${M.job.started ? M.job.left + 'd left' : 'starts tomorrow'}`
    : `None &#183; the Job Change arrives at level ${JOB_LEVEL}`
  const stats = M.stats.map((s) => `<div class="srow"><b>${s.key}</b><span>${esc(STATS[s.key].name)}</span><u>${s.value}</u></div>`).join('')
  const skills = M.skills.map((s) => `<div class="skrow"><b>${esc(s.name)}</b><span class="lvl">Lv.${s.level}</span>
      <span class="bar"><span style="width:${Math.round((s.into / s.need) * 100)}%"></span></span><em>${s.into}/${s.need}d</em></div>`).join('')
  const titles = M.titles.map((x) => x.key
    ? `<button type="button" class="trow${t && t.id === x.id ? ' on' : ''}" data-title="${x.id}"><b>${esc(x.name)}</b><em>${esc(x.how)}</em><span>${t && t.id === x.id ? 'EQUIPPED' : 'EQUIP'}</span></button>`
    : `<div class="trow off"><b>[???]</b><em>${esc(x.how)}</em></div>`).join('')
  const nx = M.next
  const trialRow = (tr) => `<div class="trial${tr.pass ? ' pass' : ''}">
      <i>${tr.pass ? '&#10003;' : ''}</i><b>${esc(tr.name)}</b>
      <span>${tr.best == null ? '&#8212;' : fmtTest(tr.test, tr.best)} / ${tr.better === 'done' ? 'done' : fmtTest(tr.test, tr.target)}${tr.better === 'less' ? ' or under' : ''}</span>
      <button type="button" ${TESTS[tr.test].body ? 'data-measure="1"' : `data-rec="${tr.test}"`}>${TESTS[tr.test].body ? 'MEASURE' : 'RECORD'}</button>
    </div>`
  const trials = !nx ? '<p class="note mono">S-rank. The Association has nothing left to measure.</p>'
    : `<div class="trials mono">
        <div class="trial${nx.xpOk ? ' pass' : ''}"><i>${nx.xpOk ? '&#10003;' : ''}</i><b>Experience</b><span>${M.xp} / ${nx.at} xp</span></div>
        ${nx.trials.map(trialRow).join('')}
      </div>
      <p class="note mono">Rank ${esc(nx.r)} needs its XP and every trial. Records keep their best, and a passed rank is never lost.</p>`
  const records = Object.keys(TESTS).map((k) => `<div class="srow"><span>${esc(TESTS[k].name)}</span><u>${M.best[k] == null ? '&#8212;' : fmtTest(k, M.best[k])}</u></div>`).join('')
  openSheet('STATUS', `
    <div class="idgrid big mono">
      <span>NAME</span><b><input id="pname" maxlength="18" value="${esc(S.name || '')}" placeholder="Player" autocomplete="off"></b>
      <span>JOB</span><b>${job}</b>
      <span>TITLE</span><b>${t ? esc(t.name) : '—'}</b>
      <span>LEVEL</span><b>${M.level} &#183; ${M.rank}&#8209;rank &#183; ${M.xp} xp</b>
    </div>
    <h3 class="cond">RANK TRIALS${nx ? ' &#183; ' + esc(RANKS[nx.idx - 1].r) + ' &#8594; ' + esc(nx.r) : ''}</h3>${trials}
    <h3 class="cond">RECORDS</h3><div class="records mono">${records}</div>
    <button type="button" data-measure="1">MEASURE BODY</button>
    <h3 class="cond">STATS</h3><div class="sgrid mono">${stats}</div>
    <p class="note mono">Each is 10, plus one for every day you logged a quest that feeds it. They only go up. The bar on the main screen is the honest part: 14&#8209;day form.</p>
    <h3 class="cond">SKILLS</h3><div class="mono">${skills || '<p class="note">No skills yet.</p>'}</div>
    <h3 class="cond">TITLES</h3><div class="mono">${titles}</div>`,
  (b) => {
    const inp = b.querySelector('#pname')
    inp.addEventListener('change', () => { S.name = inp.value.trim().slice(0, 18); save(); render() })
    b.addEventListener('click', (e) => {
      if (e.target.closest('[data-rec]')) return recordTest(e.target.closest('[data-rec]').dataset.rec)
      if (e.target.closest('[data-measure]')) return measure()
      const tb = e.target.closest('[data-title]')
      if (!tb) return
      S.title = tb.dataset.title
      save()
      render()
      sheetStatus()
    })
  })
}

/* ---------- rank trials: what you record, and how -------------------------- */
function fmtTest(k, v) {
  const t = TESTS[k]
  if (t.better === 'done') return v ? 'done' : '&#8212;'
  if (k === 'run10k') { const sec = Math.round(v * 60); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` }
  const n = t.unit === 'reps' ? Math.round(v) : round1(v).toFixed(1)
  return n + (t.unit === '%' ? '%' : t.unit ? ' ' + t.unit : '')
}

/* "52:30" or "52.5" for a time; a plain number otherwise */
function parseTest(k, s) {
  s = String(s || '').trim()
  if (k === 'run10k' && s.indexOf(':') !== -1) {
    const [m, sec] = s.split(':').map(Number)
    return m + (sec || 0) / 60
  }
  return parseFloat(s.replace(',', '.'))
}

/* Every record goes through the same diff as a tap, so the trial that
   completes a rank plays the reassessment. */
function addTest(k, v) {
  if (!loaded || !(v > 0)) return
  const A = model()
  const today = iso(new Date())
  S.tests = { ...(S.tests || {}), [k]: listOf((S.tests || {})[k]).concat([{ v: round1(v * 100) / 100, d: today }]) }
  bump()
  const B = model()
  render()
  const pass = A.next && A.next.trials.find((t) => t.test === k)
  const line = `Recorded: ${TESTS[k].name} ${fmtTest(k, v)}`
  moment(diff(A, B, today), { line, sub: pass ? (meets(pass, v) ? 'Trial passed.' : 'Not yet — the best stays on record.') : '' })
  save()
  if (sheetOpen()) sheetStatus()
}
const meets = (tr, v) => (TESTS[tr.test].better === 'less' ? v <= tr.target : v >= tr.target)

function recordTest(k) {
  const t = TESTS[k]
  if (t.better === 'done') {
    return notify({
      head: 'RANK TRIAL', title: t.name, sound: null, sub: esc(t.how),
      actions: [{ label: 'CANCEL' }, { label: 'DONE TODAY', primary: true, onClick: () => addTest(k, 1) }],
    })
  }
  notify({
    head: 'RANK TRIAL', title: t.name, sound: null,
    sub: `<div class="recin"><input id="recv" type="text" inputmode="decimal" autocomplete="off" placeholder="${k === 'run10k' ? '52:30' : '0'}"><span>${esc(t.unit)}</span></div><div class="dim">${esc(t.how)}</div>`,
    actions: [
      { label: 'CANCEL' },
      { label: 'SAVE', primary: true, onClick: (el) => {
        const v = parseTest(k, el.querySelector('#recv').value)
        if (!(v > 0)) { el.querySelector('#recv').focus(); return false }
        addTest(k, v)
      } },
    ],
    onShow: (el) => setTimeout(() => { try { el.querySelector('#recv').focus() } catch (_) {} }, 350),
  })
}

/* Tape: waist at the navel, neck just below the larynx, plus weight. Stored
   metric; typed in whichever units the tape and scale use. */
function measure() {
  const imp = S.units !== 'metric'
  notify({
    head: 'RANK TRIAL', title: 'Measure', sound: null,
    sub: `<div class="meas">
        <label>WAIST <input id="mw" type="text" inputmode="decimal" autocomplete="off"><em>${imp ? 'in' : 'cm'}</em></label>
        <label>NECK <input id="mn" type="text" inputmode="decimal" autocomplete="off"><em>${imp ? 'in' : 'cm'}</em></label>
        <label>WEIGHT <input id="mk" type="text" inputmode="decimal" autocomplete="off"><em>${imp ? 'lb' : 'kg'}</em></label>
      </div>
      <div class="bfout">body fat <b id="mbf">&#8212;</b> &#183; height ${BODY.heightCm} cm</div>
      <div class="dim">Waist at the navel, relaxed. Neck just below the larynx. Same time of day each time &#8212; the trend matters more than any one number.</div>`,
    actions: [
      { label: imp ? 'USE CM/KG' : 'USE IN/LB', onClick: () => { S.units = imp ? 'metric' : 'imperial'; save(); setTimeout(measure, 250) } },
      { label: 'CANCEL' },
      { label: 'SAVE', primary: true, onClick: (el) => {
        const m = readMeasure(el, imp)
        if (!m) return false
        addBody(m)
      } },
    ],
    onShow: (el) => {
      el.querySelectorAll('.meas input').forEach((i) => i.addEventListener('input', () => {
        const m = readMeasure(el, imp)
        el.querySelector('#mbf').textContent = m ? navyBf(m.waist, m.neck).toFixed(1) + '%' : '—'
      }))
    },
  })
}

function readMeasure(el, imp) {
  const f = (id) => parseFloat(String(el.querySelector(id).value || '').replace(',', '.'))
  const k = imp ? 2.54 : 1
  const waist = f('#mw') * k, neck = f('#mn') * k
  const w = f('#mk')
  const weight = w > 0 ? (imp ? w * 0.45359237 : w) : 0
  if (!(waist > 40 && waist < 250 && neck > 20 && neck < 80 && waist > neck)) return null
  return { waist: round1(waist), neck: round1(neck), weight: round1(weight) }
}

function addBody(m) {
  if (!loaded) return
  const A = model()
  const today = iso(new Date())
  S.body = listOf(S.body).concat([{ d: today, ...m, height: BODY.heightCm }])
  bump()
  const B = model()
  render()
  const bf = navyBf(m.waist, m.neck)
  moment(diff(A, B, today), { line: `Body fat ${bf.toFixed(1)}%${m.weight ? ` · lean mass ${round1(m.weight * (1 - bf / 100)).toFixed(1)} kg` : ''}`, sub: 'Recorded. The trend is what matters.' })
  save()
  if (sheetOpen()) sheetStatus()
}

function sheetShadows() {
  const M = model()
  const army = BOSSES.filter((b) => M.shadows[b.id]).map((b) => {
    const sh = M.shadows[b.id]
    return `<div class="shadow"><div class="simg"><img src="bosses/${b.id}.webp" alt="" loading="lazy"></div>
      <b class="cond">${esc(b.shadow)}</b><em>${esc(gradeOf(sh))}</em><span>${sh.kills} kill${sh.kills === 1 ? '' : 's'}${sh.reds ? ` &#183; ${sh.reds} red` : ''}</span></div>`
  }).join('')
  const cur = M.cur.boss.id
  const ladder = BOSSES.map((b, i) => {
    const sh = M.shadows[b.id]
    const now = b.id === cur && !M.cur.cleared
    if (sh) return `<div class="rung won"><i>${i + 1}</i><span class="r cond">${b.rank}</span><b>${esc(b.name)}</b><em>${esc(b.shadow)} &#183; ${esc(gradeOf(sh))}</em></div>`
    if (now) return `<div class="rung now"><i>${i + 1}</i><span class="r cond">${b.rank}</span><b>${esc(b.name)}</b><em>this week</em></div>`
    return `<div class="rung"><i>${i + 1}</i><span class="r cond">${b.rank}</span><b>[???]</b><em>unbeaten</em></div>`
  }).join('')
  const n = Object.keys(M.shadows).length
  openSheet('SHADOW ARMY', `
    <p class="note mono">${n ? `${n} soldier${n === 1 ? '' : 's'} &#183; never spent, never lost` : 'Every Gate boss you kill rises here. None yet.'}</p>
    <div class="army">${army}</div>
    <h3 class="cond">THE LADDER</h3>
    <div class="ladder mono">${ladder}</div>
    <p class="note mono">A boss dies on the week's 5th kept day. 7 of 7 turns the gate red and raises that shadow's grade. After the 13th, the ladder climbs again.</p>`)
}

function sheetInventory() {
  const M = model()
  const kinds = [['aura', 'AURAS', 'recolour the System'], ['sigil', 'SIGILS', 'reframe your rank emblem'], ['relic', 'RELICS', 'kept for what they mean']]
  const html = kinds.map(([k, label, about]) => {
    const items = ITEMS.filter((i) => i.kind === k).map((i) => {
      const own = M.inv[i.id]
      if (!own) return `<div class="item off r-${i.rarity}"><b>[???]</b><em>${esc(rarityName(i.rarity))}</em></div>`
      const on = S.equip[k] === i.id
      return `<div class="item r-${i.rarity}${on ? ' on' : ''}">
        ${i.rgb ? `<i class="sw8" style="background:rgb(${i.rgb})"></i>` : ''}
        <b>${esc(i.name)}</b><em>${esc(rarityName(i.rarity))}${own.count > 1 ? ' &#183; x' + own.count : ''}</em>
        ${i.about ? `<span class="about">${esc(i.about)}</span>` : ''}
        ${k !== 'relic' ? `<button type="button" data-equip="${i.id}" data-kind="${k}">${on ? 'UNEQUIP' : 'EQUIP'}</button>` : ''}
      </div>`
    }).join('')
    return `<h3 class="cond">${label}</h3><p class="note mono">${about}</p><div class="items mono">${items}</div>`
  }).join('')
  const total = M.boxes.length
  openSheet('INVENTORY', `<p class="note mono">${total} Random Box${total === 1 ? '' : 'es'} opened &#183; one for every fully kept day. Cosmetic only &#8212; never XP, never stats.</p>${html}`,
    (b) => b.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-equip]')
      if (!btn) return
      const k = btn.dataset.kind
      S.equip = { ...S.equip, [k]: S.equip[k] === btn.dataset.equip ? '' : btn.dataset.equip }
      save()
      render()
      sheetInventory()
    }))
}

function sheetSystem() {
  const M = model()
  const uid = currentUid()
  let rem
  if (!push.configured()) rem = `<p class="note">The reminder server is not deployed yet (worker/README.md). Once it is, turn it on here.</p>`
  else if (!push.standalone()) rem = `<p class="note">iPhone only allows reminders from the home-screen app: Share &#8594; Add to Home Screen, then open it from there.</p>`
  else {
    const on = S.push && S.push.on
    const hour = (S.push && S.push.hour) || 20
    rem = `<p class="note">One a day at ${hour}:00, only while a quest is still open. Never when you are done.</p>
      <label class="row">TIME <select id="remhour">${[17, 18, 19, 20, 21, 22].map((h) => `<option value="${h}"${h === hour ? ' selected' : ''}>${h}:00</option>`).join('')}</select></label>
      <button type="button" id="remtoggle" class="${on ? '' : 'pri'}">${on ? 'TURN OFF' : 'TURN ON'}</button>`
  }
  const nfc = !uid ? '<p class="note">Connect first.</p>'
    : !Object.keys(S.log).length ? '<p class="note">Log your first quest, then come back to set this up.</p>'
    : S.ink ? nfcHelp(uid)
    : `<p class="note">Tap an NFC sticker by the dumbbells, or run a Shortcut, and the quest is logged. This creates a private key for your record.</p><button type="button" id="nfcmake" class="pri">SET UP</button>`
  openSheet('SYSTEM', `
    <section><h3 class="cond">ARCHIVE COPY</h3>
      <p class="note">Your record lives under an anonymous key. Delete the home-screen app and the key is gone. An archive copy is a file you keep: restore it after a reinstall. Restoring merges &#8212; it can never lose a day.</p>
      <button type="button" id="arcsave" class="pri">SAVE ARCHIVE COPY</button><button type="button" id="arcload">RESTORE FROM FILE</button>
      <p class="note dim">${S.arch ? 'last saved ' + esc(S.arch) : 'never saved'}</p></section>
    <section><h3 class="cond">REPORT</h3>
      <p class="note">Send last week's report to one person. Telling someone is what makes keeping count work.</p>
      <button type="button" id="repsend">SEND LAST WEEK</button></section>
    <section><h3 class="cond">EVENING REMINDER</h3>${rem}</section>
    <section><h3 class="cond">SHORTCUT &amp; NFC</h3>${nfc}</section>
    <section><h3 class="cond">THE SYSTEM</h3><p class="note dim">day ${M.started ? M.dayIdx + 1 : 0} &#183; ${esc(uid || 'not connected')}</p></section>`,
  (b) => b.addEventListener('click', async (e) => {
    const id = e.target.id
    if (id === 'arcsave') saveArchive()
    else if (id === 'arcload') restore()
    else if (id === 'repsend') shareReport()
    else if (id === 'nfcmake') { S.ink = randomKey(); save(); sheetSystem() }
    else if (id === 'remtoggle') {
      const hour = +(b.querySelector('#remhour') || {}).value || 20
      try {
        const token = S.push && S.push.token
        if (S.push && S.push.on) { await push.disable(uid, token); S.push = { on: false, hour } }
        else S.push = { on: true, hour, token: await push.enable(uid, hour, M.today, M.req.length - M.today_.doneReq, token) }
        save()
        notify({ title: S.push.on ? 'Evening reminder on' : 'Evening reminder off', sound: null, hold: 2200 })
      } catch (err) { notify({ title: 'Reminder not set', sub: esc(err.message || String(err)), sound: null }) }
      sheetSystem()
    } else if (e.target.dataset.copy) {
      try { await navigator.clipboard.writeText(e.target.dataset.copy); e.target.textContent = 'COPIED' } catch (_) {}
    }
  }))
  const sel = document.getElementById('remhour')
  if (sel) sel.addEventListener('change', () => {
    if (S.push && S.push.on) { S.push.hour = +sel.value; save(); push.report(uid, S.push.token, S.push.hour, M.today, M.req.length - M.today_.doneReq) }
  })
}

const randomKey = () => {
  const b = new Uint8Array(18)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function nfcHelp(uid) {
  const url = inboxUrl()
  const body = (q) => JSON.stringify({ q, t: { '.sv': 'timestamp' }, k: S.ink })
  const quests = HABITS.filter((h) => !h.beyond).map((h) =>
    `<div class="nq"><b>${esc(h.lift ? 'Lifting session' : h.name)}</b><code>${esc(h.id)}</code><button type="button" data-copy="${esc(body(h.id))}">COPY BODY</button></div>`).join('')
  return `<p class="note">In Shortcuts: <b>Automation &#8594; NFC</b> (or a plain shortcut) &#8594; <b>Get Contents of URL</b>:</p>
    <div class="kv"><span>URL</span><code>${esc(url)}</code><button type="button" data-copy="${esc(url)}">COPY</button></div>
    <div class="kv"><span>METHOD</span><code>POST</code></div>
    <div class="kv"><span>BODY</span><code>JSON: q = quest id &#183; t = dictionary {".sv": "timestamp"} &#183; k = your key</code></div>
    <div class="kv"><span>KEY</span><code>${esc(S.ink)}</code><button type="button" data-copy="${esc(S.ink)}">COPY</button></div>
    <p class="note">Turn off &#8220;Ask Before Running&#8221;. Taps are logged to the day they happen, show up live, and can only ever add &#8212; never remove. Treat the key like a password.</p>
    <div class="nqs">${quests}</div>`
}

/* ---------- boot ----------------------------------------------------------- */
function boot() {
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#sheet')) {
      if (e.target.id === 'sheetx' || e.target.id === 'sheet') closeSheet()
      return
    }
    const kmb = e.target.closest('[data-km]')
    if (kmb) { const card = kmb.closest('.q'); if (card && loaded) openKm(card.dataset.day); return }
    const q = e.target.closest('.q:not(.locked)')
    if (q) return toggle(q.dataset.id, q.dataset.day, { ev: e, el: q })
    if (e.target.id === 'cbclose') { cbDismissed = true; render(); return }
    const sh = e.target.closest('[data-sheet]')
    if (sh) {
      const which = sh.dataset.sheet
      if (which === 'status') sheetStatus()
      else if (which === 'shadows') sheetShadows()
      else if (which === 'inventory') sheetInventory()
      else if (which === 'system') sheetSystem()
    }
  })

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})

  /* 13: every store state has a look. connecting scans; offline flickers
     gold; a restored link sweeps cyan. */
  let prev = 'connecting'
  onStatus((st) => {
    document.documentElement.dataset.store = st
    const hud = document.getElementById('hud')
    if (loaded && st === 'offline' && prev !== 'offline') {
      pulse(hud, 'glitch', 700)
      notify({ head: 'ALERT', title: LINES.offline, sound: null, hold: 2600 })
    }
    if (st === 'ready' && prev !== 'ready') {
      pulse(hud, 'linked', 1400)
      if (loaded && (prev === 'offline' || prev === 'error')) play('link')
    }
    prev = st
  })

  render()                       // skeleton, so the frame is up immediately
  start()

  setInterval(() => { if (loaded) render(); else tickClock() }, 30000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && loaded) render() })
  addEventListener('pagehide', flush)
}

async function start() {
  try {
    const remote = await connect()
    S = adopt(remote)
    loaded = true
    lastLevel = null                    // the real record is not a level-up
    bump()
    if (remote && remote.v !== 3) quietMigrate()
    opening()
    render()
    syncNotifyUI()
    onInbox(applyInbox)
  } catch (e) {
    /* Do NOT fall through to an empty board. An unreadable record must look
       like a problem, not like a fresh start. */
    document.documentElement.dataset.store = 'error'
    notify({ head: 'ALERT', title: 'The System cannot reach the archive', sub: 'Your record is safe. Reopen when you have signal.', sound: null, hold: 0, actions: [{ label: 'CLOSE', primary: true }] })
    console.warn('[store] connect failed —', e && e.message)
  }
}

function syncNotifyUI() {
  const box = $('#notify')
  if (!box) return
  if (!push.standalone()) { box.innerHTML = '<span>Share &#8594; Add to Home Screen</span>'; return }
  box.hidden = true
}

if (reduceMotion) document.documentElement.classList.add('rm')
boot()

