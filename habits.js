/* ============================================================================
   THE CATALOG — the only file you edit to change what you track.
   ----------------------------------------------------------------------------
   DATA, never progress. Re-read from source on every boot, never persisted.
   The save holds only { log: { "2026-09-26": ["bodyweight"] } }; everything
   on screen is derived from that map. Add a habit = add a line. No migration.

   FIELDS
     id        stable key. NEVER change after it has been logged against.
     name      card title (rendered uppercase).
     detail    small line under the name when there are no parts.
     parts     the fiction's counters: "Push-ups [0/20]". One tap fills them
               all. { run: true } is a distance from RUN below.
     stats     which status rows this habit feeds.
     skill     the skill it levels. Habits sharing a skill level it together.
     cue       shown on the card ONLY while this habit is sliding.
     unlock    days after your first logged day before the System grants it.
     queue     no fixed day: granted by clearing a Gate after the last fixed
               unlock (one per cleared week, in the order listed here).
     days      optional [0-6], Sun=0. Omit = daily.
     optional  never counts toward a kept day, so skipping it never costs
               the Gate. It still pays XP and feeds stats.
     weekly    a weekly target instead of a daily quest. Each session pays
               xp; reaching the target pays `bonus` once. Missing costs 0.
     xp        contributes to level and rank. Never decreases.

   WHY SO FEW ON DAY ONE
     Planning many goals at once backfires versus one simple commitment
     (Dalton & Spiller 2012, three controlled studies). About half of
     motivated volunteers fail to repeat even ONE chosen behaviour
     consistently (Lally 2010). v1 opened with 14 dailies + 9 weeklies +
     15 mains and was used for a week. So: two required cards on day one,
     one optional lifting card on lifting days, and the System grants the
     rest over time.

   NO TIME OF DAY
     The Daily Quest in the source has no anchor. It has a deadline: done
     before midnight, or not. That is the whole rule here too.
   ========================================================================= */

export const HABITS = [
  {
    /* The Daily Quest, as in the source: four counters, one tap. The run is
       inside it and feeds AGI as well as STR. */
    id: 'bodyweight',
    name: 'Strength Training',
    parts: [
      { label: 'Push-ups', n: 20 },
      { label: 'Sit-ups', n: 20 },
      { label: 'Squats', n: 20 },
      { label: 'Run', run: true },
    ],
    stats: ['STR', 'AGI'],
    skill: 'Strength Training',
    cue: 'After the kettle',
    unlock: 0,
    xp: 35,
  },
  {
    id: 'vitamins',
    name: 'Vitamins',
    stats: ['VIT'],
    skill: 'Recovery',
    cue: 'After the kettle',
    unlock: 0,
    xp: 7,
  },
  {
    /* Today's Dungeon. The card takes the session's name from DUNGEONS and
       only appears on those days. Optional: skipping it never costs the week. */
    id: 'lift',
    name: 'Dungeon',
    lift: true,
    optional: true,
    days: [1, 2, 4, 5],
    stats: ['STR'],
    skill: 'Iron Body',
    unlock: 0,
    xp: 30,
  },
  {
    /* Hidden until the Daily Quest is done. Grows with rank (BEYOND). */
    id: 'beyond',
    name: 'Go Beyond',
    beyond: true,
    optional: true,
    stats: ['STR'],
    skill: 'Strength Training',
    unlock: 0,
    xp: 10,
  },
  {
    id: 'japanese',
    name: 'Japanese',
    detail: '15 minutes minimum',
    stats: ['INT'],
    skill: 'Japanese',
    unlock: 7,
    xp: 38,
  },
  {
    id: 'content',
    name: 'One content action',
    detail: 'film, edit or upload',
    stats: ['SEN'],
    skill: 'Creation',
    unlock: 14,
    xp: 40,
  },

  /* THE QUEUE. Sealed until earned: after day 14, each cleared Gate unseals
     the next one on the following Monday — at most one a week, so the list
     never grows faster than it is being kept. Add a quest = add a line. */
  {
    id: 'protein',
    name: 'Protein',
    parts: [{ label: 'Protein', n: 150, unit: 'g' }],
    stats: ['VIT'],
    skill: 'Recovery',
    queue: true,
    xp: 15,
  },
  {
    id: 'upload',
    name: 'Upload a video',
    weekly: 1,
    bonus: 25,
    stats: ['SEN'],
    skill: 'Creation',
    queue: true,
    xp: 50,
  },
  {
    id: 'listening',
    name: 'Japanese listening',
    detail: '20 minutes of audio',
    stats: ['INT'],
    skill: 'Japanese',
    queue: true,
    xp: 20,
  },
]

/* The lifting week, Sun=0. Placeholder split until the Toji program lands —
   swap the names and days here and the Dungeon card follows. */
export const DUNGEONS = {
  1: 'UPPER A',
  2: 'LOWER A',
  4: 'UPPER B',
  5: 'LOWER B',
}

/* THE RUN, 1 km to 10 km. Week N is counted from your first logged day.
   Long days grow 5% a week (1.0, 1.1, 1.1, 1.2 …) and reach 10 km around
   week 48. Short days sit on the lower-body days so legs are not asked for
   both, at half distance, never under 0.5 or over 2 km. Where it ends:
   10 km five days, 2 km two, 54 km a week. Run/walk for the first weeks —
   bones and tendons adapt slower than lungs. */
export const RUN = {
  start: 1.0,
  growth: 0.05,
  cap: 10,
  shortDays: [2, 5],
  shortRatio: 0.5,
  shortMin: 0.5,
  shortMax: 2,
  walkWeeks: 8,
}

/* Go Beyond: push-ups / sit-ups / squats per set, by rank index (E..S). */
export const BEYOND = [30, 40, 50, 65, 80, 100]

/* The status window. Names are the fiction's; the numbers only go up —
   10, plus one for every day you logged a habit that feeds it. The thin bar
   beside each one is the honest part: a 14-day exponentially-weighted
   completion rate for the REQUIRED habits behind it. It is the one thing on
   screen that says which habit is sliding. */
export const STATS = {
  STR: { name: 'Strength',     about: 'the body, kept' },
  AGI: { name: 'Agility',      about: 'the distance, run' },
  VIT: { name: 'Vitality',     about: 'the small daily upkeep' },
  INT: { name: 'Intelligence', about: 'the language, practised' },
  SEN: { name: 'Sense',        about: 'the work, shipped' },
}

/* Rank by lifetime XP. Never lost. Tuned so that on the day-one cards
   (~60 xp/day with lifting) D lands around day 5, then with Japanese and
   content C lands around week 4, B near week 8, A around week 14, S around
   week 24 — all at full adherence, so real life lands later. `loot` is a
   real-world treat the System GRANTS on promotion — announced on the
   reassessment, never bought. Keep only ones you would genuinely withhold
   from yourself otherwise. */
export const RANKS = [
  { r: 'E', at: 0 },
  { r: 'D', at: 250 },
  { r: 'C', at: 3000,  loot: 'Takeaway of your choice' },
  { r: 'B', at: 7000,  loot: 'Massage' },
  { r: 'A', at: 14000, loot: 'Something you want under £50' },
  { r: 'S', at: 27000, loot: 'Name it now, collect it then' },
]

/* The level the Job Change quest arrives at: a one-week trial, and five kept
   days in any trial week reveals the class. No failure — the trial simply
   runs again the next week. */
export const JOB_LEVEL = 10

/* The Return Quest — top of 54 interventions, Milkman 2021. */
export const RETURN_BONUS = 15

/* Rest Permits per week. The Gate reads "7 of 7, with 2 permits": a missed
   day spends one automatically. Framed that way it beat a plain "5 of 7" in
   the field (4.0 vs 3.1 successful days a week). */
export const PERMITS = 2

/* Titles: derived from the log, hidden as [???] until earned, never removed.
   The one earned most recently shows on the plate unless you pick another. */
export const TITLES = [
  { id: 'awakened', name: 'Player',                     how: 'first logged day' },
  { id: 'unbroken', name: 'Unbroken',                   how: 'first full day' },
  { id: 'returned', name: 'One Who Overcame Adversity', how: 'first quest after a missed day' },
  { id: 'gate',     name: 'Wolf Slayer',                how: 'first Gate boss killed' },
  { id: 'steady',   name: 'Steady',                     how: '14 logged days' },
  { id: 'redgate',  name: 'Red Gate Survivor',          how: 'a perfect 7 of 7 week' },
  { id: 'iron',     name: 'Iron Will',                  how: 'any 14-day bar reaches 80' },
  { id: 'hunter',   name: 'Hunter',                     how: '50 logged days' },
  { id: 'demon',    name: 'Demon Hunter',               how: 'kill Vulcan, the Demon King' },
  { id: 'hundred',  name: 'The Hundred',                how: '100 logged days' },
  { id: 'monarch',  name: 'Shadow Monarch',             how: 'every boss on the ladder beaten' },
]

/* System lines. */
export const LINES = {
  awaken:   'You have acquired the qualifications to be a Player. Will you accept?',
  accepted: 'Congratulations on becoming a Player.',
  firstDay: 'A quest becomes automatic around week ten. Until then, midnight is the only rule.',
  arrived:  'Daily Quest has arrived.',
  complete: 'Daily Quest complete.',
  returned: 'Passive: Will to Recover activated.',
  key:      'Item acquired: Key',
  offline:  'Connection lost. Taps are held until it returns.',
}

/* The evening reminder's copy lives with its sender, in worker/index.js. */
