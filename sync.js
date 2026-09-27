/* ============================================================================
   THE STORE — Firebase Realtime Database. The only copy.

   No localStorage. The log lives at saves/<uid> and nowhere else.

   WHAT THAT COSTS, stated plainly so it is not a surprise later:

     - The app cannot open without a network. There is no local copy to
       render from, so a cold launch offline shows CONNECTING and nothing
       else.
     - RTDB's web SDK queues writes offline IN MEMORY ONLY (unlike the iOS
       and Android SDKs, which persist to disk). A tap made offline is held
       in RAM and flushed on reconnect — but closing the app before it
       reconnects loses it silently.
     - Every tap is a network write.
     - The uid is ANONYMOUS. Deleting the home-screen app deletes the key to
       the record. That is what the archive copy (archive.js) is for.

   SECURITY: rules are scoped to auth.uid (database.rules.json in this repo).
   The API key is a public project identifier and authorises nothing; the
   rules are the security, which is what v1 got wrong.

   THE INBOX (inbox/<uid>): the one path something other than this app can
   write to. An iOS Shortcut — run from an NFC sticker or a tap — POSTs
   { q, t, k } there over REST with no sign-in; the rules accept it only if
   k matches the secret stored in the save. The app applies each entry to
   the log on the day it was sent, then deletes it.
   ========================================================================= */

export const CONFIG = {
  apiKey: 'AIzaSyAYd3KGSylkvpWJUSEti-PSb4ir5Xbp0qE',
  authDomain: 'the-system-970f9.firebaseapp.com',
  databaseURL: 'https://the-system-970f9-default-rtdb.firebaseio.com',
  projectId: 'the-system-970f9',
  storageBucket: 'the-system-970f9.firebasestorage.app',
  messagingSenderId: '104227504438',
  appId: '1:104227504438:web:ae5ab6d6d3652d694e3397',
}

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/'

let db = null, uid = null, rtdb = null
let state = 'connecting'          // connecting | ready | offline | error
let listeners = []
let writeTimer = null
let pending = null

export const storeState = () => state
export const onStatus = (fn) => { listeners.push(fn); fn(state) }
function setState(s) { state = s; listeners.forEach((f) => { try { f(s) } catch (_) {} }) }

/* Auth + first read. Resolves with the saved state, or null for a new user.
   THROWS on failure — the caller must not fall back to an empty save, or a
   transient blip would look like a fresh install and the next tap would
   overwrite a real record with one day. */
export async function connect() {
  setState('connecting')
  const [{ initializeApp }, auth, database] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-database.js'),
  ])
  rtdb = database
  const app = initializeApp(CONFIG)

  const cred = await auth.signInAnonymously(auth.getAuth(app))
  uid = cred.user.uid
  db = rtdb.getDatabase(app)

  /* Surface the live connection, so a dropped network is visible rather than
     silently queueing writes into memory that may never flush. */
  rtdb.onValue(rtdb.ref(db, '.info/connected'), (snap) => {
    setState(snap.val() === true ? 'ready' : 'offline')
  })

  const snap = await rtdb.get(rtdb.ref(db, 'saves/' + uid))
  setState('ready')
  return snap.exists() ? snap.val() : null
}

/* A record with no logged day is never written. The rules reject a save
   without a `log` child (RTDB drops empty objects, so {log:{}} arrives as
   no log at all) — and that rule is the net under the whole design, so the
   client respects it instead of weakening it. Before the first tap there is
   nothing worth keeping anyway. */
const writable = (S) => S && S.log && Object.keys(S.log).length > 0

/* Debounced write. Failures surface through onStatus rather than a throw, so
   a tap never fails visibly mid-animation. The returned promise settles when
   the write carrying this state has landed — the inbox waits on it before
   deleting an entry. */
let waiters = []
export function writeState(S) {
  if (!db || !uid || !writable(S)) return Promise.resolve()
  pending = JSON.parse(JSON.stringify(S))
  clearTimeout(writeTimer)
  const done = new Promise((res, rej) => waiters.push({ res, rej }))
  writeTimer = setTimeout(send, 700)
  return done
}

async function send() {
  const body = pending
  const ws = waiters
  pending = null
  waiters = []
  if (!body) return
  try {
    await rtdb.set(rtdb.ref(db, 'saves/' + uid), body)
    if (state !== 'offline') setState('ready')
    ws.forEach((w) => w.res())
  } catch (e) {
    setState('error')
    console.warn('[store] write failed —', e && e.message)
    ws.forEach((w) => w.rej(e))
  }
}

/* Flush on pagehide so a tap made inside the debounce window is not lost when
   the app is swiped away. */
export function flush() {
  if (!db || !uid || !pending) return
  clearTimeout(writeTimer)
  send()
}

/* Every entry already waiting, then each new one as it lands — so a sticker
   tapped while the app is open shows up live. */
export function onInbox(fn) {
  if (!db || !uid) return
  rtdb.onChildAdded(rtdb.ref(db, 'inbox/' + uid), (snap) => {
    try { fn(snap.key, snap.val()) } catch (e) { console.warn('[inbox]', e && e.message) }
  })
}
export function clearInbox(key) {
  if (!db || !uid) return
  rtdb.remove(rtdb.ref(db, 'inbox/' + uid + '/' + key)).catch(() => {})
}

export const currentUid = () => uid
export const inboxUrl = () => (uid ? `${CONFIG.databaseURL}/inbox/${uid}.json` : '')
