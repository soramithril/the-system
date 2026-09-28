/* ============================================================================
   ARCHIVE COPY — the record as a file you keep.

   The Firebase uid is anonymous: deleting the home-screen app deletes the
   only key to the record, and nothing can bring it back. An archive copy is
   the answer — one JSON file, saved through the share sheet (Save to Files,
   AirDrop, mail it to yourself), restorable after a reinstall.

   Restoring MERGES, it never replaces: every logged day in either copy is
   kept, so restoring an old file onto a newer record cannot lose anything.
   ========================================================================= */

const KIND = 'the-system/archive'

export function archiveText(S, today) {
  const { _ts, ...save } = S
  return JSON.stringify({ kind: KIND, v: 1, saved: today, save }, null, 1)
}

export async function saveArchive(S, today) {
  const name = `the-system-${today}.json`
  const file = new File([archiveText(S, today)], name, { type: 'application/json' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'THE SYSTEM — archive copy' })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

/* Opens the file picker; resolves with a validated save, or null. */
export function pickArchive() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'application/json,.json'
    inp.style.display = 'none'
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]
      inp.remove()
      if (!f) return resolve(null)
      try { resolve(parseArchive(await f.text())) } catch (e) { reject(e) }
    })
    document.body.appendChild(inp)
    inp.click()
  })
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function parseArchive(text) {
  const j = JSON.parse(text)
  const s = j && j.kind === KIND ? j.save : j          // also accept a bare save
  if (!s || typeof s !== 'object' || !s.log || typeof s.log !== 'object') throw new Error('Not a SYSTEM archive.')
  const log = {}
  for (const k of Object.keys(s.log)) {
    if (!DAY.test(k)) continue
    const v = Array.isArray(s.log[k]) ? s.log[k] : Object.values(s.log[k] || {})
    const ids = v.filter((x) => typeof x === 'string' && x.length <= 32)
    if (ids.length) log[k] = ids
  }
  if (!Object.keys(log).length) throw new Error('That archive has no logged days.')
  return { ...s, log }
}

/* Union of both records. The current copy wins on settings. */
export function mergeSaves(cur, inc) {
  const log = { ...cur.log }
  for (const k of Object.keys(inc.log)) {
    const a = log[k] || []
    const add = inc.log[k].filter((id) => a.indexOf(id) === -1)
    if (add.length || !log[k]) log[k] = a.concat(add)
  }
  const keys = Object.keys(log).sort()
  const firsts = [cur.first, inc.first, keys[0]].filter(Boolean).sort()
  const seen = (cur.seen || []).slice()
  for (const x of inc.seen || []) if (seen.indexOf(x) === -1) seen.push(x)

  /* km: the longer of the two for a day. tests and body: every entry from
     both, once. */
  const km = { ...(inc.km || {}) }
  for (const k of Object.keys(cur.km || {})) km[k] = Math.max(km[k] || 0, cur.km[k])
  const tests = {}
  for (const t of new Set(Object.keys(cur.tests || {}).concat(Object.keys(inc.tests || {})))) {
    tests[t] = uniq(list((cur.tests || {})[t]).concat(list((inc.tests || {})[t])), (e) => e.d + '|' + e.v)
  }
  const body = uniq(list(cur.body).concat(list(inc.body)), (m) => [m.d, m.waist, m.neck, m.weight].join('|'))

  return {
    ...inc,
    ...cur,
    log,
    first: firsts[0] || null,
    seen,
    km,
    tests,
    body,
    name: cur.name || inc.name || '',
    title: cur.title || inc.title || '',
    equip: { ...(inc.equip || {}), ...(cur.equip || {}) },
  }
}

const list = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []).filter((e) => e && typeof e === 'object')
function uniq(arr, key) {
  const seen = new Set()
  return arr.filter((e) => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true })
}
