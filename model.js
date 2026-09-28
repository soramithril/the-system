/* ============================================================================
   THE MODEL — everything on screen, derived from the log in one pass.

   THE ONE IDEA (unchanged from v2): the log is the only truth.

     save = { log: { "2026-09-26": ["bodyweight","vitamins"] }, first, ... }

   derive() walks from the first logged day to today, once, and computes XP,
   level, rank, the week's Gate and its boss, Rest Permits, the Shadow Army,
   skills, stats, the Job Change, Random Box drops, weekly quests, titles and
   which quests the System has granted. Nothing accumulates in a counter, so
   nothing can drift, and a double-tap or a reload cannot double-grant.

   It is a single forward pass because the pieces depend on each other in
   time order: which quests are due depends on grants, grants after day 14
   depend on cleared Gates, a Gate depends on kept days, a kept day depends
   on which quests were due. Day by day, each only looks backwards.

   diff(before, after) turns two models into the events a tap caused. That
   is how the app knows a single tap finished a quest, kept the day, killed
   the boss and levelled you up — and picks only the biggest to make a
   moment of (see app.js, "one tap, one moment").

   Pure: no DOM, no storage. Runs under node for the tests in test/.
   ========================================================================= */

import { HABITS, STATS, RANKS, TITLES, RUN, DUNGEONS, BEYOND, JOB_LEVEL, RETURN_BONUS, PERMITS, TESTS, BODY } from './habits.js'
import { BOSSES, GRADES, CLASSES, NECRO_SHADOWS, RARITY, ITEMS } from './lore.js'

/* ---------- dates ----------------------------------------------------------
   Local-time day keys. Deliberately NOT toISOString(): that is UTC, so
   anything logged after 19:00 EDT would land on tomorrow's key and silently
   split a day in two. The local getters give the day you are actually living
   in. Arithmetic is done at local noon so a DST change can never push a key
   across midnight. Built from numbers, not parsed from strings — derive()
   does this thousands of times a render. */
const pad = (x) => (x < 10 ? '0' : '') + x
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const noon = (k) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 12)
export const addDays = (k, n) => { const d = noon(k); d.setDate(d.getDate() + n); return iso(d) }
export const diffDays = (a, b) => Math.round((noon(b) - noon(a)) / 86400000)
export const dow = (k) => noon(k).getDay()
export const mondayOf = (k) => addDays(k, -((dow(k) + 6) % 7))

/* ---------- catalog views -------------------------------------------------- */
export const byId = (id) => HABITS.find((h) => h.id === id)
const LIVE = HABITS.filter((h) => !h.archived)
const QUEUE = LIVE.filter((h) => h.queue)
export const FIXED_LAST = LIVE.filter((h) => !h.queue).reduce((m, h) => Math.max(m, h.unlock || 0), 0)
const BASE = LIVE.find((h) => h.parts && !h.queue) || LIVE[0]   // the Daily Quest card: Go Beyond scales its counters
const RUNQ = LIVE.find((h) => h.run) || null

/* Linear: level N -> N+1 costs N*100. Overflow carries, so a fresh bar never
   sits at exactly 0% after a level-up. */
export function levelFromXp(t) {
  let lv = 1, need = 100, left = t
  while (left >= need) { left -= need; lv++; need = lv * 100 }
  return { level: lv, into: left, need }
}

/* ---------- rank: XP and trials ----------------------------------------------
   The Hunter Association does not care how long you have been grinding; it
   measures. A rank needs its XP AND every one of its trials, in order, and a
   passed rank stays passed — a test keeps its best value, forever.

   Body fat: the US Navy tape formula, men, metric. */
export function navyBf(waistCm, neckCm, heightCm = BODY.heightCm) {
  if (!(waistCm > neckCm) || !(heightCm > 0)) return null
  return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
}

const listOf = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : [])

/* The best value of every test recorded up to `upto` (inclusive), or ever.
   Lean mass only counts from a measurement that was lean at the same time
   (TESTS.lean.atBf): bulking to a big number and cutting to a low body fat
   months apart cannot pass "big AND shredded". */
export function bests(S, upto) {
  const best = {}
  const tests = (S && S.tests) || {}
  for (const t of Object.keys(TESTS)) {
    if (TESTS[t].body) continue
    for (const e of listOf(tests[t])) {
      if (!e || typeof e.v !== 'number' || !(e.v > 0) || (upto && e.d > upto)) continue
      best[t] = best[t] == null ? e.v : TESTS[t].better === 'less' ? Math.min(best[t], e.v) : Math.max(best[t], e.v)
    }
  }
  for (const m of listOf(S && S.body)) {
    if (!m || (upto && m.d > upto)) continue
    const bf = navyBf(m.waist, m.neck, m.height || BODY.heightCm)
    if (bf == null || bf < 2 || bf > 60) continue
    best.bf = best.bf == null ? bf : Math.min(best.bf, bf)
    if (m.weight > 0 && bf <= (TESTS.lean.atBf || 100)) {
      const lean = m.weight * (1 - bf / 100)
      best.lean = best.lean == null ? lean : Math.max(best.lean, lean)
    }
  }
  return best
}

export const passes = (tr, best) => {
  const b = best[tr.test]
  if (b == null) return false
  return TESTS[tr.test].better === 'less' ? b <= tr.target : b >= tr.target
}

export function rankAt(xp, best) {
  let ri = 0
  for (let i = 1; i < RANKS.length; i++) {
    if (xp >= RANKS[i].at && RANKS[i].trials.every((tr) => passes(tr, best))) ri = i
    else break
  }
  return ri
}

/* Skills: level L needs L(L+1)/2 logged days — 1, 3, 6, 10, 15, 21 … so each
   level takes one day longer than the last. */
const tri = (L) => (L * (L + 1)) / 2
export function skillLevel(days) {
  let L = 0
  while (tri(L + 1) <= days) L++
  return { level: L, into: days - tri(L), need: L + 1 }
}

/* ---------- the run ----------------------------------------------------------
   The plan is one number per week, L: the long-day distance. Short days are
   half of it, clamped. derive() moves L on as each week closes — grow 5%, or
   rise to meet what you actually ran (at most 10% over it), or hold after a
   thin week. The evidence is with RUN in habits.js. */
export const round1 = (x) => Math.round(x * 10) / 10
const SHORTS = RUN.shortDays.length
export const shortOf = (L) => Math.min(L, Math.max(RUN.shortMin, Math.min(RUN.shortMax, round1(L * RUN.shortRatio))))
const weekVolume = (L) => { const l = round1(L); return (7 - SHORTS) * l + SHORTS * shortOf(l) }

/* the largest long-day distance whose planned week stays within V km */
export function longFor(V) {
  if (weekVolume(RUN.cap) <= V) return RUN.cap
  let lo = RUN.start, hi = RUN.cap
  if (weekVolume(lo) > V) return lo
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2
    if (weekVolume(m) <= V) lo = m
    else hi = m
  }
  return lo
}

/* The fiction's counters for a card on a given day. `km` is that day's run
   target, from the model. */
export function partsFor(h, km, ri = 0) {
  if (h.beyond) {
    const n = BEYOND[Math.min(ri, BEYOND.length - 1)]
    return (BASE.parts || []).map((p) => ({ label: p.label, n, unit: '' }))
  }
  if (h.run) return [{ label: 'Run', n: km || RUN.start, unit: 'km', run: true }]
  return (h.parts || []).map((p) => ({ label: p.label, n: p.n, unit: p.unit || '' }))
}

export const dungeonOn = (key) => DUNGEONS[dow(key)] || null
export const questName = (h, key) => (h.lift ? (dungeonOn(key) || h.name) : h.name)

/* ---------- Random Box ------------------------------------------------------
   The drop is a pure function of the date: FNV-1a into one mulberry32 step.
   Same day, same item, on every device, forever. */
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function unit(seed) {
  let t = (seed + 0x6D2B79F5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export function boxFor(key) {
  const total = RARITY.reduce((s, r) => s + r.w, 0)
  let x = unit(hash(key + '#rarity')) * total
  let rar = RARITY[RARITY.length - 1]
  for (const r of RARITY) { if (x < r.w) { rar = r; break } x -= r.w }
  const pool = ITEMS.filter((it) => it.rarity === rar.id)
  return pool[Math.floor(unit(hash(key + '#item')) * pool.length)]
}

function classFor(statCount, shadowN) {
  if (shadowN >= NECRO_SHADOWS) return 'NECRO'
  let best = 'STR', bv = -1
  for (const k of Object.keys(STATS)) if ((statCount[k] || 0) > bv) { bv = statCount[k] || 0; best = k }
  return best
}

export const gradeOf = (sh) => GRADES[Math.min(GRADES.length - 1, Math.max(0, sh.kills - 1 + sh.reds))]

/* ---------- derive --------------------------------------------------------- */
const ALPHA = 1 - Math.exp(-1 / 14)
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length

export function derive(S, now = new Date()) {
  const today = iso(now)
  const log = (S && S.log) || {}
  const started = !!(S && S.first)
  let first = started ? S.first : today
  if (first > today) first = today                 // a skewed clock never yields a negative walk
  const n = diffDays(first, today)

  /* grants: day index each quest is granted on. Fixed ones are known up
     front; queued ones are filled in as Gates are cleared. */
  const grants = {}
  for (const h of LIVE) if (!h.queue) grants[h.id] = h.unlock || 0
  let qPtr = 0
  let prevGrant = FIXED_LAST

  const days = {}
  const weeks = []
  const kills = []
  const shadows = {}
  const boxes = []
  const skillDays = {}
  const statCount = {}
  const form = {}
  const formPrev = {}
  const titleKey = {}
  let week = null
  let lastRec = null
  let cum = 0
  let ladder = 0
  let loggedDays = 0, keptTotal = 0, lifetime = 0, redCount = 0
  let returned = false
  let statFormMax = 0
  let titlesLeft = TITLES.length
  let job = { state: 'none' }
  let runL = RUN.start, runWhy = 'start'
  const kmLog = (S && S.km) || {}

  const openWeek = (key) => {
    const start = mondayOf(key)
    const lead = Math.max(0, diffDays(start, first))            // days before the awakening
    const avail = 7 - lead
    week = {
      start, end: addDays(start, 6), lead, avail,
      need: Math.max(1, avail - PERMITS),
      boss: BOSSES[ladder % BOSSES.length], cycle: Math.floor(ladder / BOSSES.length),
      kept: 0, cleared: false, clearKey: null, red: false, redKey: null,
      sessions: {}, wkDone: {}, xp: 0, cumStart: cum, cumEnd: cum, days: [],
      runL, runWhy, runPlan: 0, runActual: 0,
    }
    weeks.push(week)
  }

  /* Monday: the week that just ended is judged. If its Gate was cleared, and
     it ended after the last grant, the next sealed quest in the queue opens
     today. One per week at most, by construction.
     The run plan moves on too: hold after a thin week, otherwise grow 5% —
     or, if you ran more than planned, rise to meet what you really ran, never
     more than 10% above it. */
  const closeWeek = (i) => {
    week.cumEnd = cum
    if (week.cleared && qPtr < QUEUE.length && i - 1 >= prevGrant) {
      grants[QUEUE[qPtr].id] = i
      prevGrant = i
      qPtr++
    }
    const plan = week.runPlan, act = week.runActual
    if (plan > 0 && act < RUN.hold * plan) runWhy = 'hold'
    else {
      const grow = runL * (1 + RUN.growth)
      const ahead = act > plan ? longFor(act * (1 + RUN.ahead)) : 0
      runWhy = ahead > grow ? 'ahead' : 'grow'
      runL = Math.min(RUN.cap, Math.max(grow, ahead))
    }
  }

  const cursor = noon(first)
  const statKeys = Object.keys(STATS)
  let shadowN = 0
  for (let i = 0; i <= n; i++, cursor.setDate(cursor.getDate() + 1)) {
    const key = iso(cursor)
    const wd = cursor.getDay()
    if (!week) openWeek(key)
    else if (wd === 1) { closeWeek(i); openWeek(key) }

    const raw = Array.isArray(log[key]) ? log[key] : []
    const has = (id) => raw.indexOf(id) !== -1

    /* A queued quest is optional on the day its key arrives. That day can be
       granted retroactively — a late report of Sunday clears last week's
       Gate on Monday morning — and a quest that became required halfway
       through a kept day would silently un-keep it. */
    /* Nothing is locked. A quest the System has not granted yet is EARLY:
       tappable from day one, pays its XP and feeds its stat, but it is not
       required — it cannot cost a day or a Gate until its key arrives. */
    const req = [], opt = [], wk = [], early = []
    for (const h of LIVE) {
      const g = grants[h.id]
      if (h.weekly) { wk.push(h); continue }
      if (h.days && h.days.indexOf(wd) === -1) continue
      if (g == null || g > i) { early.push(h); continue }
      ;(h.optional || (h.queue && g === i) ? opt : req).push(h)
    }

    const doneReq = req.filter((h) => has(h.id))
    const done = doneReq.concat(opt.filter((h) => has(h.id)), early.filter((h) => has(h.id)), wk.filter((h) => has(h.id)))
    const kept = req.length > 0 && doneReq.length === req.length
    /* the sentinel pays only while yesterday really is a miss — a late
       report or a restored archive that fills yesterday in withdraws it, so
       XP never depends on the order of taps */
    const ret = done.length > 0 && has('__return') && !!lastRec && lastRec.req.length > 0 && !lastRec.kept

    let xp = done.reduce((s, h) => s + h.xp, 0)
    if (ret) { xp += RETURN_BONUS; returned = true }
    for (const h of done) {
      if (!h.weekly) continue
      week.sessions[h.id] = (week.sessions[h.id] || 0) + 1
      if (!week.wkDone[h.id] && week.sessions[h.id] >= h.weekly) { week.wkDone[h.id] = key; xp += h.bonus || 0 }
    }
    cum += xp
    week.xp += xp
    week.cumEnd = cum
    if (done.length) loggedDays++
    lifetime += done.length

    /* the run: today's target from the week's L; what was actually run is
       the +KM entry if there is one, else the target if the quest was
       ticked. A mistyped 42 km cannot drag the plan up — for planning, one
       day counts at most twice its target or 3 km over it. */
    const shortDay = RUN.shortDays.indexOf(wd) !== -1
    const Lr = round1(week.runL)
    const runKm = shortDay ? shortOf(Lr) : Lr
    const km = typeof kmLog[key] === 'number' && kmLog[key] > 0 ? kmLog[key] : null
    const runDue = RUNQ && grants[RUNQ.id] != null && grants[RUNQ.id] <= i
    const ranKm = km != null ? km : RUNQ && has(RUNQ.id) ? runKm : 0
    if (runDue) {
      week.runPlan += runKm
      week.runActual += Math.min(ranKm, Math.max(2 * runKm, runKm + 3))
    }

    /* stats only go up; stats and skills both count days, once each per day */
    const skillToday = {}, statToday = {}
    for (const h of done) {
      for (const s of h.stats || []) statToday[s] = 1
      if (h.skill) skillToday[h.skill] = 1
    }
    for (const s in statToday) statCount[s] = (statCount[s] || 0) + 1
    for (const s in skillToday) skillDays[s] = (skillDays[s] || 0) + 1

    /* form: s += (1 - e^(-1/14)) * (100*done - s), required habits only,
       today counted only once something is logged. A done day lifts it ~7%
       of the remaining gap; a miss drops it ~7% of its value. It can never
       fall on a day you did the habit. */
    if (!(i === n && !done.length)) {
      for (const h of req) {
        const s0 = form[h.id] || 0
        form[h.id] = s0 + ALPHA * (100 * (has(h.id) ? 1 : 0) - s0)
      }
      if (statFormMax < 80) {
        for (const k of statKeys) {
          let s = 0, c = 0
          for (const h of req) if (h.stats && h.stats.indexOf(k) !== -1) { s += form[h.id]; c++ }
          if (c && s / c > statFormMax) statFormMax = s / c
        }
      }
    }
    if (i === n - 7) for (const id in form) formPrev[id] = form[id]

    const rec = {
      key, i, wd,
      req: req.map((h) => h.id), opt: opt.map((h) => h.id), wk: wk.map((h) => h.id), early: early.map((h) => h.id),
      done: done.map((h) => h.id), doneReq: doneReq.length,
      kept, frac: req.length ? doneReq.length / req.length : 0,
      ret, xp, cum, st: null,
      runKm, ranKm, short: shortDay,
    }
    days[key] = rec
    lastRec = rec
    week.days.push(rec)

    /* the Gate. The boss dies on the week's `need`th kept day (5 of 7: the
       two Rest Permits cover the rest), and rises as a shadow. */
    if (kept) {
      keptTotal++
      week.kept++
      boxes.push({ key, item: boxFor(key) })
      if (!week.cleared && week.kept >= week.need) {
        week.cleared = true
        week.clearKey = key
        const b = week.boss
        if (!shadows[b.id]) shadowN++
        const sh = shadows[b.id] || (shadows[b.id] = { id: b.id, boss: b, kills: 0, reds: 0, firstKey: key, lastKey: key })
        sh.kills++
        sh.lastKey = key
        kills.push({ boss: b, key, week: week.start, cycle: week.cycle })
        ladder++
      }
      if (week.kept === 7) {
        week.red = true
        week.redKey = key
        redCount++
        shadows[week.boss.id].reds++
      }
    }

    /* the Job Change: the day level JOB_LEVEL is reached, a trial starts the
       next day. Five kept days inside any one trial week reveals the class.
       No failure state — a short week just rolls into the next trial week. */
    const lv = levelFromXp(cum).level
    if (job.state === 'none') {
      if (lv >= JOB_LEVEL) job = { state: 'trial', reachedKey: key, start: i + 1, win: -1, count: 0 }
    } else if (job.state === 'trial' && i >= job.start) {
      const w = Math.floor((i - job.start) / 7)
      if (w !== job.win) { job.win = w; job.count = 0 }
      if (kept) job.count++
      if (job.count >= 5) job = { state: 'revealed', key, cls: classFor(statCount, shadowN) }
    }
    rec.level = lv

    /* titles, stamped with the day they were earned */
    if (titlesLeft) {
      const t = {
        awakened: loggedDays >= 1,
        unbroken: keptTotal >= 1,
        returned,
        gate: kills.length >= 1,
        steady: loggedDays >= 14,
        redgate: redCount >= 1,
        iron: statFormMax >= 80,
        hunter: loggedDays >= 50,
        demon: !!shadows.vulcan,
        hundred: loggedDays >= 100,
        monarch: shadowN >= BOSSES.length,
      }
      for (const x of TITLES) if (!titleKey[x.id] && t[x.id]) { titleKey[x.id] = key; titlesLeft-- }
    }
  }

  /* ---- the week strips: kept, permit, missed, open, future, void ---- */
  for (const w of weeks) {
    let used = 0
    w.strip = []
    for (let d = 0; d < 7; d++) {
      const key = addDays(w.start, d)
      const rec = days[key]
      let st
      if (key < first) st = 'void'
      else if (key > today) st = 'future'
      else if (rec && rec.kept) st = 'kept'
      else if (key === today) st = 'open'
      else if (used < PERMITS) { st = 'permit'; used++ }
      else st = 'missed'
      if (rec) rec.st = st
      w.strip.push({ key, st, frac: rec ? rec.frac : 0 })
    }
    w.permitsUsed = used
    w.permitsLeft = PERMITS - used
  }

  const cur = weeks[weeks.length - 1]
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null
  const L = levelFromXp(cum)
  const best = bests(S)
  const ri = rankAt(cum, best)
  const grantedNow = (h) => grants[h.id] != null && grants[h.id] <= n

  /* ---- the next rank: what the Association still wants to see ---- */
  let next = null
  if (ri < RANKS.length - 1) {
    const R = RANKS[ri + 1]
    const trials = R.trials.map((tr) => ({
      ...tr, ...TESTS[tr.test], best: best[tr.test] == null ? null : best[tr.test], pass: passes(tr, best),
    }))
    next = { idx: ri + 1, r: R.r, at: R.at, xpOk: cum >= R.at, trials, passed: trials.filter((t) => t.pass).length }
  }

  /* ---- stats: the number only goes up; the bar is 14-day form ---- */
  const stats = Object.keys(STATS)
    .filter((k) => statCount[k] > 0 || LIVE.some((h) => grantedNow(h) && (h.stats || []).indexOf(k) !== -1))
    .map((k) => {
      const feed = LIVE.filter((h) => grantedNow(h) && !h.optional && !h.weekly && (h.stats || []).indexOf(k) !== -1)
      const f = feed.filter((h) => form[h.id] != null).map((h) => form[h.id])
      const p = feed.filter((h) => formPrev[h.id] != null).map((h) => formPrev[h.id])
      const fv = f.length ? Math.round(mean(f)) : 0
      const pv = p.length ? Math.round(mean(p)) : null
      return { key: k, value: 10 + (statCount[k] || 0), form: fv, prev: pv, trend: pv == null ? 0 : Math.sign(fv - pv) }
    })

  const sliding = {}
  for (const h of LIVE) if (formPrev[h.id] != null && form[h.id] < formPrev[h.id] - 2) sliding[h.id] = true

  /* ---- skills ---- */
  const skillNames = []
  for (const h of LIVE) if (h.skill && (grantedNow(h) || skillDays[h.skill] > 0) && skillNames.indexOf(h.skill) === -1) skillNames.push(h.skill)
  const skills = skillNames.map((name) => ({ name, days: skillDays[name] || 0, ...skillLevel(skillDays[name] || 0) }))

  /* ---- titles ---- */
  const titles = TITLES.map((x, idx) => ({ ...x, idx, key: titleKey[x.id] || null }))
  const earned = titles.filter((x) => x.key)
  const latest = earned.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.idx - b.idx)).pop() || null

  /* ---- inventory ---- */
  const inv = {}
  for (const b of boxes) {
    const e = inv[b.item.id] || (inv[b.item.id] = { item: b.item, count: 0, firstKey: b.key })
    e.count++
  }

  /* ---- sealed quests, and what opens them ---- */
  const curEndIdx = diffDays(first, cur.end)
  const nextQ = QUEUE.find((h) => grants[h.id] == null)
  const sealed = LIVE.filter((h) => !grantedNow(h)).map((h) => {
    if (!h.queue) return { h, why: 'days', inDays: (h.unlock || 0) - n }
    if (h !== nextQ) return { h, why: 'queued' }
    if (grants[h.id] != null) return { h, why: 'days', inDays: grants[h.id] - n }
    if (n < FIXED_LAST) return { h, why: 'after', day: FIXED_LAST }
    if (cur.cleared && curEndIdx >= prevGrant) return { h, why: 'monday' }
    return { h, why: 'gate' }
  })

  /* ---- today ---- */
  const T = days[today]
  const pick = (ids) => ids.map(byId)

  /* ---- job display ---- */
  let jobView = { state: job.state }
  if (job.state === 'trial') {
    const started2 = n >= job.start
    const w = started2 ? Math.floor((n - job.start) / 7) : 0
    const winStart = job.start + 7 * w
    jobView = {
      state: 'trial', reachedKey: job.reachedKey, started: started2,
      count: started2 && job.win === w ? job.count : 0,
      left: started2 ? winStart + 6 - n : 7,
    }
  } else if (job.state === 'revealed') {
    jobView = { state: 'revealed', key: job.key, cls: job.cls, name: CLASSES[job.cls].name, line: CLASSES[job.cls].line }
  }

  /* ---- 30-day rate, days to next level ---- */
  let rq = 0, rd = 0
  for (let i = 0; i < 30; i++) {
    const r = days[addDays(today, -i)]
    if (!r) continue
    rq += r.req.length
    rd += r.doneReq
  }
  let e7 = 0, d7 = 0
  for (let i = 1; i <= 7; i++) {
    const r = days[addDays(today, -i)]
    if (!r) continue
    d7++
    e7 += r.xp
  }
  const dtl = d7 && e7 ? Math.max(1, Math.ceil((L.need - L.into) / (e7 / d7))) : null

  /* ---- the record: 18 calendar weeks, Monday on top ---- */
  const gStart = addDays(mondayOf(today), -7 * 17)
  const redWeeks = {}
  for (const w of weeks) if (w.red) redWeeks[w.start] = true
  const grid = []
  for (let c = 0; c < 18; c++) {
    const col = { start: addDays(gStart, c * 7), red: false, cells: [] }
    col.red = !!redWeeks[col.start]
    for (let r = 0; r < 7; r++) {
      const key = addDays(gStart, c * 7 + r)
      const rec = days[key]
      let st = 'void', lv = 0
      if (key > today) st = 'future'
      else if (started && rec) {
        st = rec.st || 'open'
        lv = rec.kept ? 4 : rec.frac >= 0.66 ? 3 : rec.frac >= 0.34 ? 2 : rec.frac > 0 ? 1 : 0
      }
      col.cells.push({ key, st, lv, today: key === today })
    }
    grid.push(col)
  }

  /* ---- last week, for the Monday report ---- */
  let report = null
  if (prev) {
    const kill = kills.find((k) => k.week === prev.start) || null
    report = {
      start: prev.start, end: prev.end, kept: prev.kept, avail: prev.avail, need: prev.need,
      permitsUsed: prev.permitsUsed, cleared: prev.cleared, red: prev.red, boss: prev.boss, kill,
      xp: prev.xp,
      levelFrom: levelFromXp(prev.cumStart).level, levelTo: levelFromXp(prev.cumEnd).level,
      rankFrom: rankAt(prev.cumStart, bests(S, addDays(prev.start, -1))), rankTo: rankAt(prev.cumEnd, bests(S, prev.end)),
      run: { plan: round1(prev.runPlan), ran: round1(prev.runActual) },
      boxes: boxes.filter((b) => b.key >= prev.start && b.key <= prev.end).length,
    }
  }

  return {
    today, first: started ? first : null, started, dayIdx: n, now,
    days, weeks, cur, prev, report,
    xp: cum, level: L.level, into: L.into, need: L.need, rankIdx: ri, rank: RANKS[ri].r, dtl, next, best,
    grants, sealed, sliding,
    today_: T,
    req: pick(T.req), opt: pick(T.opt), wk: pick(T.wk), early: pick(T.early),
    stats, skills, titles, earned, latest,
    kills, shadows, redCount, gates: kills.length,
    boxes, inv,
    job: jobView,
    lifetime, loggedDays, rate30: rq ? Math.round((rd / rq) * 100) : 0,
    grid,
    run: { km: T.runKm, ran: T.ranKm, short: T.short, L: round1(cur.runL), why: cur.runWhy, week: weeks.length },
    dungeon: dungeonOn(today),
  }
}

/* ---------- diff: what a tap caused ---------------------------------------- */
export function diff(A, B, key) {
  const ev = []
  if (B.rankIdx > A.rankIdx) ev.push({ type: 'rank', from: A.rankIdx, to: B.rankIdx })
  if (B.job.state === 'revealed' && A.job.state !== 'revealed') ev.push({ type: 'class', job: B.job })
  if (B.job.state === 'trial' && A.job.state === 'none') ev.push({ type: 'trial' })
  const ak = {}
  for (const k of A.kills) ak[k.week] = 1
  for (const k of B.kills) if (!ak[k.week]) ev.push({ type: 'kill', kill: k, shadow: B.shadows[k.boss.id] })
  const ar = {}
  for (const w of A.weeks) if (w.red) ar[w.start] = 1
  for (const w of B.weeks) if (w.red && !ar[w.start]) ev.push({ type: 'red', week: w, shadow: B.shadows[w.boss.id] })
  if (B.level > A.level) ev.push({ type: 'level', from: A.level, to: B.level })
  const at = {}
  for (const t of A.earned) at[t.id] = 1
  for (const t of B.earned) if (!at[t.id]) ev.push({ type: 'title', title: t })
  const a = A.days[key], b = B.days[key]
  if (b && b.kept && !(a && a.kept)) ev.push({ type: 'kept', key })
  if (b && b.ret && !(a && a.ret)) ev.push({ type: 'returned' })
  const ab = {}
  for (const x of A.boxes) ab[x.key] = 1
  for (const x of B.boxes) if (!ab[x.key]) ev.push({ type: 'box', item: x.item, key: x.key })
  const as = {}
  for (const s of A.skills) as[s.name] = s.level
  for (const s of B.skills) if (s.level > (as[s.name] || 0)) ev.push({ type: 'skill', name: s.name, level: s.level })
  const aw = {}
  for (const w of A.weeks) for (const id in w.wkDone) aw[w.start + id] = 1
  for (const w of B.weeks) for (const id in w.wkDone) if (!aw[w.start + id]) ev.push({ type: 'weekly', id })
  return ev
}
