/* ============================================================================
   BACKUP — Firebase Realtime Database, repaired.

   WHAT THIS IS FOR: the log lives in localStorage on the phone. An installed
   home-screen web app is exempt from Safari's 7-day storage wipe, but deleting
   the app or clearing website data still erases it with no warning and no
   recovery. This is the copy that survives that.

   WHAT WAS WRONG IN v1, and is fixed here:

     v1 rules:  {"saves": {"player": {".read": true, ".write": true}}}
     v1 user:   fbUserId = 'player'   // hardcoded

   The database URL sits in this public repo, so those rules meant anyone who
   read the repo could dump or erase the save. The API key being public is
   fine and by design — it identifies the project, it does not authorise
   anything. THE RULES WERE ALWAYS THE ONLY SECURITY, and they were off.

   Now: anonymous auth gives the device a real uid, the save lives at
   saves/<uid>, and the rules below let only that uid touch it.

     PASTE THIS into Firebase console -> Realtime Database -> Rules:

     {
       "rules": {
         "saves": {
           "$uid": {
             ".read":  "auth != null && auth.uid === $uid",
             ".write": "auth != null && auth.uid === $uid"
           }
         }
       }
     }

     Then Authentication -> Sign-in method -> enable Anonymous.

   OFF THE BOOT PATH. v1 loaded the SDK via an importmap before the app could
   render. Here the whole module is dynamically imported AFTER first paint, so
   a slow or dead network costs nothing — the app is local-first and simply
   renders from localStorage. If this never loads, nothing breaks; you just
   have no backup until it does.

   ANONYMOUS UID IS PER-INSTALL. Delete the app and you get a new uid, so the
   old backup becomes unreachable even though it still exists. That is why
   exportLog() exists below and why the restore code is keyed off a recovery
   phrase you can write down. Backup is not the same as being able to restore.
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
let db = null, uid = null, ref = null, set = null, get = null
let timer = null
let status = 'idle'      // idle | connecting | ready | offline | error

/* Backup runs silently. There was a status dot in the footer; it reported
   'idle' while a full signInAnonymously -> write -> read -> delete round trip
   against this same project succeeded, so it was misreporting. A silent
   backup that works beats an indicator that lies. syncStatus() is still
   exported for the console if you ever need to know. */
function setStatus(s) { status = s }

export const syncStatus = () => status

/* Called once, after first paint. Never awaited by the render path. */
export async function initSync(onRemote) {
  if (status !== 'idle') return
  setStatus('connecting')
  try {
    const [{ initializeApp }, auth, rtdb] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-database.js'),
    ])
    const app = initializeApp(CONFIG)

    const cred = await auth.signInAnonymously(auth.getAuth(app))
    uid = cred.user.uid

    ;({ ref, set, get } = rtdb)
    db = rtdb.getDatabase(app)

    /* Pull once on boot. Newer wins by _ts. Phone-only, so this matters on a
       reinstall, not day to day. */
    const snap = await get(ref(db, 'saves/' + uid))
    if (snap.exists() && typeof onRemote === 'function') onRemote(snap.val())

    setStatus('ready')
  } catch (e) {
    setStatus((e && /network|offline|fetch/i.test(String(e.message))) ? 'offline' : 'error')
    console.warn('[sync] unavailable —', e && e.message)
  }
}

/* Debounced. Called on every save; costs nothing when sync never came up. */
export function pushState(S) {
  if (status !== 'ready' || !db || !uid) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try { await set(ref(db, 'saves/' + uid), JSON.parse(JSON.stringify(S))) }
    catch (e) { console.warn('[sync] write failed —', e && e.message) }
  }, 2000)
}

/* The thing a remote backup cannot do for you: survive losing the uid.
   Dumps the save as a file you can keep anywhere. */
export function exportLog(S) {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'the-system-' + new Date().toISOString().slice(0, 10) + '.json'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}

export function importLog(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => { try { res(JSON.parse(r.result)) } catch (e) { rej(e) } }
    r.onerror = rej
    r.readAsText(file)
  })
}
