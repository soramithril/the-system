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

   If offline logging ever matters, the fix is Firestore rather than
   hand-rolled caching: its SDK persists to IndexedDB itself, so it stays
   "Firebase only" while surviving a tunnel. Bigger change, not what was
   asked for here.

   SECURITY: rules are scoped to auth.uid (database.rules.json in this repo).
   The API key is a public project identifier and authorises nothing; the
   rules are the security, which is what v1 got wrong.
   ========================================================================= */

const CONFIG = {
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

/* Debounced write. Failures surface through onStatus rather than a throw, so
   a tap never fails visibly mid-animation. */
export function writeState(S) {
  if (!db || !uid) return
  pending = JSON.parse(JSON.stringify(S))
  clearTimeout(writeTimer)
  writeTimer = setTimeout(async () => {
    try {
      await rtdb.set(rtdb.ref(db, 'saves/' + uid), pending)
      if (state !== 'offline') setState('ready')
    } catch (e) {
      setState('error')
      console.warn('[store] write failed —', e && e.message)
    }
  }, 700)
}

/* Flush on pagehide so a tap made inside the debounce window is not lost when
   the app is swiped away. */
export function flush() {
  if (!db || !uid || !pending) return
  clearTimeout(writeTimer)
  try { rtdb.set(rtdb.ref(db, 'saves/' + uid), pending) } catch (_) {}
}

export const currentUid = () => uid
