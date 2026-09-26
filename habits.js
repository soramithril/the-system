/* ============================================================================
   THE CATALOG — the only file you edit to change what you track.
   ----------------------------------------------------------------------------
   This is DATA, never progress. It is re-read from source on every boot and is
   never written to, never merged into the save, never persisted.

   That split is the whole point. In v1 `G.quests` was both the catalog AND the
   per-quest progress, so every edit here had to be reconciled against saved
   state — which is what the seven stacked _qmigN blocks in js/app.js existed to
   do, plus a duplicate copy inside js/firebase.js. ~180 lines running on every
   single load, forever.

   Here the save holds only:  { log: { "2026-09-26": ["bodyweight"] }, ... }
   Render is a join of this list against that map. So:

     add a habit     -> append a line. it appears. no migration.
     remove a habit  -> delete the line. old log entries become harmless
                        orphans, which is also honest history.
     retune one      -> edit it. applies everywhere, retroactively, correctly.
     stop scheduling -> set archived: true (keeps it in history)

   FIELDS
     id      stable key. NEVER change one after it has been logged against.
     name    shown on the card, uppercase in the UI.
     detail  the small grey line under the name.
     when    THE IF-THEN PLAN. See below. Not decorative.
     days    optional [0-6], Sun=0. Omit = every day.
     xp      contributes to level + rank.

   ABOUT `when`
     Implementation intentions ("when X, I will Y") are the single
     highest-leverage mechanic in the research behind this rebuild —
     Gollwitzer & Sheeran 2006, 94 independent tests, d=0.65, larger than
     anything else measured here. v1 had nothing like them.

     It only works if it names a REAL cue you already reliably hit. "in the
     morning" is not a cue. "after the kettle goes on" is. These four are
     placeholders — replace them with your actual anchors. They are surfaced
     on the card and reused verbatim in the reminder copy.
   ========================================================================= */

export const HABITS = [
  {
    id: 'bodyweight',
    name: 'Bodyweight set',
    detail: '20 push-ups · 20 sit-ups · 20 squats',
    when: 'after the kettle goes on',
    xp: 20,
  },
  {
    id: 'vitamins',
    name: 'Vitamins',
    detail: '',
    when: 'with the first coffee',
    xp: 7,
  },
  {
    id: 'japanese',
    name: 'Japanese',
    detail: '15 minutes minimum',
    when: 'when I sit down after dinner',
    xp: 38,
  },
  {
    id: 'content',
    name: 'One content action',
    detail: 'film, edit or upload',
    when: 'before I open YouTube',
    xp: 40,
  },
]

/* ----------------------------------------------------------------------------
   REWARDS — gold buys things that happen OFF the phone.

   v1 shipped 48 items and the economy outran its sinks; that is the single
   most consistent complaint about this genre after years of use ("1,000 gold
   and nothing worth buying"). Against 4 habits a 48-item shop is a treadmill
   with a hard floor, and ~5 months is about how long it takes to hit it.

   So: write your own, keep it short, and make them things you would actually
   want. `cooldown` is in days.
   ------------------------------------------------------------------------- */

export const REWARDS = [
  { id: 'choc', name: 'Chocolate bar', cost: 200, cooldown: 3 },
  { id: 'takeaway', name: 'Takeaway', cost: 500, cooldown: 14 },
  { id: 'rest', name: 'Guilt-free rest day', cost: 300, cooldown: 7 },
  { id: 'buy', name: 'Something you want under £20', cost: 1000, cooldown: 30 },
  { id: 'massage', name: 'Massage', cost: 1500, cooldown: 90 },
]

/* Rank thresholds by lifetime XP. Rank is never lost. */
export const RANKS = [
  { r: 'E', at: 0 },
  { r: 'D', at: 500 },
  { r: 'C', at: 1500 },
  { r: 'B', at: 3500 },
  { r: 'A', at: 7000 },
  { r: 'S', at: 15000 },
]

/* Reminder copy pool. Effectiveness decays with repetition and recovers with
   rest (Duolingo, KDD 2020), so the sender demotes whatever it used recently
   rather than always picking a favourite. {habit} and {when} are filled in. */
export const NUDGES = [
  '{habit} — {when}.',
  'One left: {habit}.',
  '{habit} is still open.',
  'The gate is open. {habit}.',
  '{habit}, {when}.',
  'Still time. {habit}.',
  '{habit} — that is the whole ask.',
  'Nothing else tonight. Just {habit}.',
]
