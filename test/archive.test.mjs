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

test('rejects files that are not a record', () => {
  assert.throws(() => parseArchive('{"hello":1}'))
  assert.throws(() => parseArchive('{"log":{"nope":["x"]}}'))
  assert.throws(() => parseArchive('not json'))
})

test('reads RTDB-shaped arrays (objects with numeric keys)', () => {
  const s = parseArchive(JSON.stringify({ log: { '2026-10-01': { 0: 'vitamins', 1: 'bodyweight' } } }))
  assert.deepEqual(s.log['2026-10-01'], ['vitamins', 'bodyweight'])
})
