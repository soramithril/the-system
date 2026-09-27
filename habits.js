/* ============================================================================
   THE CATALOG — the only file you edit to change what you track.
   ----------------------------------------------------------------------------
   DATA, never progress. Re-read from source on every boot, never persisted.
   The save holds only { log: { "2026-09-26": ["bodyweight"] } }; everything
   on screen is derived from that map. Add a habit = add a line. No migration.

   FIELDS
     id      stable key. NEVER change after it has been logged against.
     name    card title (rendered uppercase).
     detail  small line under the name when no anchor is set.
     stat    which status-window row this habit feeds. A stat only exists
             once a habit feeds it, so week one shows two rows.
     unlock  days after your first logged day before the System grants
             this quest. 0 = from day one.
     days    optional [0-6], Sun=0. Omit = daily. None of these need it.
     xp      contributes to level and rank. Never decreases.

   WHY ONLY TWO ON DAY ONE
     Planning many goals at once backfires versus one simple commitment
     (Dalton & Spiller 2012, three controlled studies). About half of
     motivated volunteers fail to repeat even ONE chosen behaviour
     consistently (Lally 2010). v1 opened with 14 dailies + 9 weeklies +
     15 mains and was used for a week. So: two morning habits sharing one
     cue, then the System grants the others at day 7 and day 14.

   NO TIME OF DAY
     The Daily Quest in the source has no anchor. It has a deadline: done
     before midnight, or not. That is the whole rule here too. The research
     favours a fixed cue ("after the kettle goes on"); the owner chose the
     fiction's rule instead, and it is his call. `detail` is what the card
     shows, in the fiction's own format.
   ========================================================================= */

export const HABITS = [
  {
    id: 'bodyweight',
    name: 'Bodyweight set',
    detail: '20 push-ups · 20 sit-ups · 20 squats',
    stat: 'STR',
    unlock: 0,
    xp: 20,
  },
  {
    id: 'vitamins',
    name: 'Vitamins',
    detail: '',
    stat: 'VIT',
    unlock: 0,
    xp: 7,
  },
  {
    id: 'japanese',
    name: 'Japanese',
    detail: '15 minutes minimum',
    stat: 'INT',
    unlock: 7,
    xp: 38,
  },
  {
    id: 'content',
    name: 'One content action',
    detail: 'film, edit or upload',
    stat: 'SEN',
    unlock: 14,
    xp: 40,
  },
]

/* The status window. Names are the fiction's; the numbers are honest.
   Each is a 0-100 exponentially-weighted 14-day completion rate for the
   habits that feed it. It rises on a done day and falls on a missed one, and
   it can never fall on a day you did the habit. It gates nothing. Its only
   job is to be the one thing on screen that says which habit is sliding. */
export const STATS = {
  STR: { name: 'Strength',     about: 'the body, kept' },
  VIT: { name: 'Vitality',     about: 'the small daily upkeep' },
  INT: { name: 'Intelligence', about: 'the language, practised' },
  SEN: { name: 'Sense',        about: 'the work, shipped' },
}

/* Rank by lifetime XP. Never lost. Tuned so that on two morning habits
   (27 xp/day) D lands on day 6, then with Japanese (65/day) and content
   (105/day) C lands around week 4, B near the Job Change at week 8-10.
   `loot` is a real-world treat the System GRANTS on promotion — announced
   on the rank screen, never bought. Keep only ones you would genuinely
   withhold from yourself otherwise. */
export const RANKS = [
  { r: 'E', at: 0 },
  { r: 'D', at: 150 },
  { r: 'C', at: 1800,  loot: 'Takeaway of your choice' },
  { r: 'B', at: 4500,  loot: 'Massage' },
  { r: 'A', at: 10000, loot: 'Something you want under £50' },
  { r: 'S', at: 20000, loot: 'Name it now, collect it then' },
]

/* Titles: derived from the log, hidden until earned, never removed. The
   first two are reachable before day two. Order matters — the most recent
   earned one is shown in the identity plate. */
export const TITLES = [
  { id: 'awakened',  name: 'Awakened',    how: 'first logged day' },
  { id: 'unbroken',  name: 'Unbroken',    how: 'first full day' },
  { id: 'returned',  name: 'Returned',    how: 'first quest after a missed day' },
  { id: 'gate',      name: 'Gatekeeper',  how: 'first week with 5 of 7 kept' },
  { id: 'steady',    name: 'Steady',      how: '14 logged days' },
  { id: 'redgate',   name: 'Red Gate',    how: 'a perfect 7 of 7 week' },
  { id: 'iron',      name: 'Iron Will',   how: 'any stat reaches 80' },
  { id: 'hunter',    name: 'Hunter',      how: '50 logged days' },
]

/* System lines. Spoken once each, on the day they apply. */
export const LINES = {
  firstDay: 'A quest becomes automatic around week ten. Until then, midnight is the only rule.',
  returned: '[Passive: Will to Recover activated]',
  granted:  'The System grants a new quest.',
}

/* Reminder copy pool for later. Rotated with a recency penalty. */
export const NUDGES = [
  '{habit} — {when}.',
  'One left: {habit}.',
  '{habit} is still open.',
  'The gate is open. {habit}.',
  'Still time. {habit}.',
  'Nothing else tonight. Just {habit}.',
]
