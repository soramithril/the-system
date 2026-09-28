/* Restoring an archive merges; it can never lose a logged day. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveText, parseArchive, mergeSaves } from '../archive.js'

const cur = { v: 3, first: '2026-10-05', log: { '2026-10-05': ['vitamins'], '2026-10-06': ['bodyweight'] }, seen: ['awaken'], name: 'Jin', equip: { aura: 'aura-gold' } }
const old = { v: 3, first: '2026-09-28', log: { '2026-09-28': ['bodyweight', 'vitamins'], '2026-10-05': ['bodyweight'] }, seen: ['title:awakened'], name: '', equip: { sigil: 'sigil-crown' } }

test('round trip through the file format', () => {
  const back = parseArchive(archiveText(cur, '2026-10-06'))
  assert.deepEqual(back.log, cur.log)
  assert.equal(back.first, cur.first)
})

test('merge is a union: every day from both, earliest first day, current settings win', () => {
  const m = mergeSaves(cur, parseArchive(archiveText(old, '2026-10-01')))
  assert.deepEqual(Object.keys(m.log).sort(), ['2026-09-28', '2026-10-05', '2026-10-06'])
  assert.deepEqual(m.log['2026-10-05'].sort(), ['bodyweight', 'vitamins'])
  assert.equal(m.first, '2026-09-28')
  assert.equal(m.name, 'Jin')
  assert.deepEqual(m.equip, { sigil: 'sigil-crown', aura: 'aura-gold' })
  assert.ok(m.seen.includes('awaken') && m.seen.includes('title:awakened'))
})

test('merge keeps run km, trial results and tape measurements from both', () => {
  const a = { ...cur, km: { '2026-10-05': 3 }, tests: { pushups: [{ v: 30, d: '2026-10-05' }] }, body: [{ d: '2026-10-05', waist: 105, neck: 42, weight: 92 }] }
  const b = { ...old, km: { '2026-10-05': 2.5, '2026-09-28': 1.4 }, tests: { pushups: [{ v: 30, d: '2026-10-05' }, { v: 22, d: '2026-09-28' }], runkm: [{ v: 1.2, d: '2026-09-28' }] }, body: [{ d: '2026-09-28', waist: 107, neck: 42, weight: 93 }] }
  const m = mergeSaves(a, b)
  assert.deepEqual(m.km, { '2026-10-05': 3, '2026-09-28': 1.4 })
  assert.equal(m.tests.pushups.length, 2)
  assert.equal(m.tests.runkm.length, 1)
  assert.equal(m.body.length, 2)
})

test('rejects files that are not a record', () => {
  assert.throws(() => parseArchive('{"hello":1}'))
  assert.throws(() => parseArchive('{"log":{"nope":["x"]}}'))
  assert.throws(() => parseArchive('not json'))
})

test('reads RTDB-shaped arrays (objects with numeric keys)', () => {
  const s = parseArchive(JSON.stringify({ log: { '2026-10-01': { 0: 'vitamins', 1: 'bodyweight' } } }))
  assert.deepEqual(s.log['2026-10-01'], ['vitamins', 'bodyweight'])
})
