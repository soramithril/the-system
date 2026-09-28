/* Run: TZ=America/New_York node --test test/*.test.mjs
   The model is pure, so every rule of the game is checkable here without a
   browser: the Gate, permits, bosses, earned grants, the Job Change, the run. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { derive, diff, addDays, runFor, boxFor, levelFromXp, skillLevel, partsFor, byId, dow } from '../model.js'

const MON = '2026-09-28'   // a Monday — the planned day 1
const at = (key, h = 12) => new Date(`${key}T${String(h).padStart(2, '0')}:00:00`)

/* every required quest that is due, for a model's day */
const keepAll = (first, days, extra = () => []) => {
  // two passes: derive once to learn what's due each day, then fill it
  let S = { log: {}, first }
  for (let i = 0; i < days; i++) {
    const k = addDays(first, i)
    const M = derive(S, at(k))
    S.log[k] = M.req.map((h) => h.id).concat(extra(i, k, M))
  }
  return S
}

test('day 0: nothing logged — two required cards, lifting on a lifting day', () => {
  const M = derive({ log: {}, first: null }, at(MON))
  assert.equal(M.started, false)
  assert.deepEqual(M.req.map((h) => h.id), ['bodyweight', 'vitamins'])
  assert.deepEqual(M.opt.map((h) => h.id), ['lift', 'beyond'])
  assert.equal(M.dungeon, 'UPPER A')
  assert.equal(M.xp, 0)
  assert.equal(M.level, 1)
  assert.equal(M.rank, 'E')
  assert.equal(M.cur.boss.id, 'raikans')
  assert.equal(M.cur.need, 5)
  // wednesday is a rest day: no lifting card
  const W = derive({ log: {}, first: null }, at('2026-09-30'))
  assert.deepEqual(W.opt.map((h) => h.id), ['beyond'])
  assert.equal(W.dungeon, null)
})

test('a kept day: xp, box, skills, stats, first titles', () => {
  const S = { first: MON, log: { [MON]: ['bodyweight', 'vitamins'] } }
  const M = derive(S, at(MON))
  assert.equal(M.today_.kept, true)
  assert.equal(M.xp, 42)
  assert.equal(M.boxes.length, 1)
  const st = Object.fromEntries(M.stats.map((s) => [s.key, s.value]))
  assert.deepEqual(st, { STR: 11, AGI: 11, VIT: 11 })
  assert.equal(M.skills.find((s) => s.name === 'Strength Training').level, 1)
  assert.deepEqual(M.earned.map((t) => t.id), ['awakened', 'unbroken'])
})

test('optional quests never affect a kept day', () => {
  const S = { first: MON, log: { [MON]: ['lift', 'beyond', 'vitamins'] } }
  const M = derive(S, at(MON))
  assert.equal(M.today_.kept, false)
  assert.equal(M.xp, 30 + 10 + 7)
})

test('the Gate: 5 kept days kills the boss on the 5th, and it rises', () => {
  const S = keepAll(MON, 5)
  const M = derive(S, at(addDays(MON, 4)))
  assert.equal(M.cur.cleared, true)
  assert.equal(M.cur.clearKey, addDays(MON, 4))
  assert.equal(M.kills.length, 1)
  assert.equal(M.kills[0].boss.id, 'raikans')
  assert.equal(M.shadows.raikans.kills, 1)
  assert.ok(M.earned.some((t) => t.id === 'gate'))
  // four is not enough
  const M4 = derive(keepAll(MON, 4), at(addDays(MON, 3)))
  assert.equal(M4.cur.cleared, false)
})

test('rest permits: two missed days are covered, a third is not', () => {
  const S = keepAll(MON, 7)
  delete S.log[addDays(MON, 1)]
  delete S.log[addDays(MON, 3)]
  delete S.log[addDays(MON, 5)]
  const M = derive(S, at(addDays(MON, 7)))           // next monday: last week is closed
  const w = M.weeks[0]
  assert.deepEqual(w.strip.map((d) => d.st), ['kept', 'permit', 'kept', 'permit', 'kept', 'missed', 'kept'])
  assert.equal(w.permitsUsed, 2)
  assert.equal(w.cleared, false)                      // 4 kept
  assert.equal(M.cur.boss.id, 'raikans', 'an unbeaten boss comes back next week')
})

test('red gate: 7 of 7 raises the shadow grade', () => {
  const M = derive(keepAll(MON, 7), at(addDays(MON, 6)))
  assert.equal(M.cur.red, true)
  assert.equal(M.redCount, 1)
  assert.equal(M.shadows.raikans.reds, 1)
  assert.ok(M.earned.some((t) => t.id === 'redgate'))
})

test('ladder climbs: second cleared week meets the second boss', () => {
  const M = derive(keepAll(MON, 14), at(addDays(MON, 13)))
  assert.deepEqual(M.kills.map((k) => k.boss.id), ['raikans', 'kasaka'])
  const N = derive(keepAll(MON, 15), at(addDays(MON, 14)))
  assert.equal(N.cur.boss.id, 'werewolf')
})

test('mid-week start: the first Gate needs fewer days', () => {
  const WED = '2026-09-30'
  const M = derive({ first: WED, log: {} }, at(WED))
  assert.equal(M.cur.avail, 5)
  assert.equal(M.cur.need, 3)
  assert.equal(M.cur.strip[0].st, 'void')
})

test('fixed grants on day 7 and 14, then one earned grant per cleared week', () => {
  const S = keepAll(MON, 36)
  const M = derive(S, at(addDays(MON, 35)))
  assert.equal(M.grants.japanese, 7)
  assert.equal(M.grants.content, 14)
  // week of day 7-13 ends before day 14 → no grant; week 14-20 → protein on 21
  assert.equal(M.grants.protein, 21)
  assert.equal(M.grants.upload, 28)
  assert.equal(M.grants.listening, 35)
})

test('an uncleared week grants nothing; the next cleared one does', () => {
  const S = keepAll(MON, 21, () => [])
  for (let i = 14; i < 21; i++) if (i % 2) delete S.log[addDays(MON, i)]   // week 3 not cleared
  const S2 = { first: MON, log: { ...S.log } }
  const more = keepAll(MON, 28)
  for (let i = 21; i < 28; i++) S2.log[addDays(MON, i)] = more.log[addDays(MON, i)]
  const M = derive(S2, at(addDays(MON, 28)))
  assert.equal(M.grants.protein, 28)
})

test('sealed rows say what opens them', () => {
  const M = derive({ first: MON, log: {} }, at(addDays(MON, 3)))
  const why = Object.fromEntries(M.sealed.map((s) => [s.h.id, s.why]))
  assert.equal(why.japanese, 'days')
  assert.equal(why.protein, 'after')
  assert.equal(why.upload, 'queued')
  assert.equal(M.sealed.find((s) => s.h.id === 'japanese').inDays, 4)
})

test('weekly quest: a session pays xp, reaching the target pays the bonus once', () => {
  const S = keepAll(MON, 29)
  const k = addDays(MON, 28)                          // upload granted day 28
  const before = derive(S, at(k))
  assert.ok(before.wk.some((h) => h.id === 'upload'))
  S.log[k] = S.log[k].concat(['upload'])
  const after = derive(S, at(k))
  assert.equal(after.xp - before.xp, 50 + 25)
  const ev = diff(before, after, k)
  assert.ok(ev.some((e) => e.type === 'weekly' && e.id === 'upload'))
})

test('job change: level 10 starts a trial tomorrow; 5 kept days reveal the class', () => {
  const S = keepAll(MON, 70, (i, k, M) => M.opt.filter((h) => !h.beyond).map((h) => h.id))
  const M = derive(S, at(addDays(MON, 69)))
  assert.ok(M.level >= 10)
  assert.equal(M.job.state, 'revealed')
  assert.equal(M.job.name, 'Necromancer')             // gates cleared → shadows
})

test('the run: 1.0 km week 1, 1.1 week 2, short days halved, 10 km cap near week 48', () => {
  assert.equal(runFor(0, MON).km, 1.0)
  assert.equal(runFor(1, addDays(MON, 1)).km, 0.5)   // tuesday: short
  assert.equal(runFor(1, addDays(MON, 1)).short, true)
  assert.equal(runFor(7, addDays(MON, 7)).km, 1.1)
  assert.equal(runFor(0, MON).walk, true)
  const w48 = runFor(47 * 7, addDays(MON, 47 * 7)).km
  const w49 = runFor(48 * 7, addDays(MON, 48 * 7)).km
  assert.ok(w48 >= 9.8 && w48 < 10, `week 48 = ${w48}`)
  assert.equal(w49, 10)
  const tueLate = addDays(MON, 48 * 7 + 1)
  assert.equal(runFor(48 * 7 + 1, tueLate).km, 2)     // short days end at 2 km
})

test('daily quest parts: four counters, the run from the plan', () => {
  const p = partsFor(byId('bodyweight'), 0, MON)
  assert.deepEqual(p.map((x) => x.label), ['Push-ups', 'Sit-ups', 'Squats', 'Run/walk'])
  assert.equal(p[3].n, 1.0)
  const b = partsFor(byId('beyond'), 0, MON, 5)
  assert.deepEqual(b.map((x) => x.n), [100, 100, 100])
})

test('return quest bonus is derived from the sentinel', () => {
  const S = { first: MON, log: { [MON]: ['bodyweight', 'vitamins'], [addDays(MON, 2)]: ['vitamins', '__return'] } }
  const M = derive(S, at(addDays(MON, 2)))
  assert.equal(M.xp, 42 + 7 + 15)
  assert.ok(M.earned.some((t) => t.id === 'returned'))
})

test('diff: the tap that keeps day 5 kills the boss, keeps the day, drops a box', () => {
  const S = keepAll(MON, 5)
  const k = addDays(MON, 4)
  const after = derive(S, at(k))
  S.log[k] = ['bodyweight']
  const before = derive(S, at(k))
  const types = diff(before, derive({ ...S, log: { ...S.log, [k]: ['bodyweight', 'vitamins'] } }, at(k)), k).map((e) => e.type)
  assert.ok(types.includes('kill'))
  assert.ok(types.includes('kept'))
  assert.ok(types.includes('box'))
  assert.ok(types.includes('title'))                  // Wolf Slayer
  assert.equal(after.gates, 1)
})

test('random box is a pure function of the date', () => {
  assert.equal(boxFor('2026-10-01').id, boxFor('2026-10-01').id)
  const seen = new Set()
  for (let i = 0; i < 400; i++) seen.add(boxFor(addDays(MON, i)).rarity)
  assert.ok(seen.has('common') && seen.has('rare') && seen.has('epic'))
})

test('levels and skills', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, need: 100 })
  assert.equal(levelFromXp(4500).level, 10)
  assert.deepEqual([0, 1, 2, 3, 6, 10].map((d) => skillLevel(d).level), [0, 1, 1, 2, 3, 4])
})

test('form: a sliding habit is flagged; stats never drop', () => {
  const S = keepAll(MON, 21)
  for (let i = 14; i < 21; i++) S.log[addDays(MON, i)] = S.log[addDays(MON, i)].filter((id) => id !== 'bodyweight')
  const M = derive(S, at(addDays(MON, 20)))
  assert.equal(M.sliding.bodyweight, true)
  assert.equal(M.sliding.vitamins, undefined)
  const str = M.stats.find((s) => s.key === 'STR')
  assert.equal(str.value, 10 + 14)                    // 14 logged days, never less
  assert.equal(str.trend, -1)
})

test('grid: 18 calendar columns, today in the last one', () => {
  const M = derive(keepAll(MON, 3), at(addDays(MON, 2)))
  assert.equal(M.grid.length, 18)
  const last = M.grid[17]
  assert.equal(last.start, MON)
  assert.equal(last.cells[2].today, true)
  assert.equal(last.cells[2].lv, 4)
  assert.equal(last.cells[3].st, 'future')
  assert.equal(dow(last.start), 1)
})

test('return bonus is withdrawn if yesterday gets filled in later (tap order never matters)', () => {
  const y = addDays(MON, 1), t = addDays(MON, 2)
  const base = { first: MON, log: { [MON]: ['bodyweight', 'vitamins'], [t]: ['vitamins', '__return'] } }
  const missed = derive(base, at(t))
  const filled = derive({ ...base, log: { ...base.log, [y]: ['bodyweight', 'vitamins'] } }, at(t))
  const noSentinel = derive({ first: MON, log: { [MON]: ['bodyweight', 'vitamins'], [y]: ['bodyweight', 'vitamins'], [t]: ['vitamins'] } }, at(t))
  assert.equal(missed.xp, 42 + 7 + 15)
  assert.equal(filled.xp, noSentinel.xp)
})

test('a queued quest is optional on the day its key arrives, required from the next', () => {
  const S = keepAll(MON, 23)
  const d21 = derive(S, at(addDays(MON, 21)))
  assert.ok(d21.opt.some((h) => h.id === 'protein'))
  assert.ok(!d21.req.some((h) => h.id === 'protein'))
  assert.equal(d21.today_.kept, true, 'a late grant cannot un-keep the day')
  const d22 = derive(S, at(addDays(MON, 22)))
  assert.ok(d22.req.some((h) => h.id === 'protein'))
})

test('stats count days, not quests: three STR quests in one day is +1', () => {
  const M = derive({ first: MON, log: { [MON]: ['bodyweight', 'lift', 'beyond'] } }, at(MON))
  assert.equal(M.stats.find((s) => s.key === 'STR').value, 11)
})
