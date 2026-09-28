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
     15 mains and was used for a week. So: three small required cards on
     day one (the set, the run, vitamins — two of them share one morning
     cue), one optional lifting card at the weekend, and the System grants
     the rest over time.

   NO TIME OF DAY
     The Daily Quest in the source has no anchor. It has a deadline: done
     before midnight, or not. That is the whole rule here too.
   ========================================================================= */

export const HABITS = [
  {
    /* The Daily Quest, as in the source: the fiction's counters, one tap. */
    id: 'bodyweight',
    name: 'Strength Training',
    parts: [
      { label: 'Push-ups', n: 20 },
      { label: 'Sit-ups', n: 20 },
      { label: 'Squats', n: 20 },
    ],
    stats: ['STR'],
    skill: 'Strength Training',
    cue: 'After the kettle',
    unlock: 0,
    xp: 20,
  },
  {
    /* Just the run, and it is agility. Its distance comes from RUN below and
       follows what you actually run: +KM on the card logs more than the
       target, and next week's target moves up to meet it. */
    id: 'run',
    name: 'Run',
    run: true,
    stats: ['AGI'],
    skill: 'Sprint',
    unlock: 0,
    xp: 15,
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
    days: [6, 0],
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

/* The lifting week, Sun=0: Saturday and Sunday. With two days a week, full
   body both days trains every muscle twice, which beats once a week for
   size; an upper/lower split would hit each only once. Rename these to the
   Toji program's sessions when it lands. */
export const DUNGEONS = {
  6: 'FULL BODY A',
  0: 'FULL BODY B',
}

/* THE RUN, 1 km to 10 km, every day.

   The evidence it follows: in 873 novice runners (Nielsen 2014), those who
   raised weekly distance by more than 30% over two weeks got more
   distance-related injuries than those who stayed under 10%. Tendons and
   bones adapt slower than heart and lungs, more so at a higher body weight.

   So, week by week:
     - the long-day target grows 5% (1.0, 1.1, 1.1, 1.2 … 10 km ~week 48)
     - AHEAD: if last week you actually ran more than planned (+KM on the
       card), this week's target rises to meet you — up to 10% above the
       distance you really covered, never a bigger jump than that
     - HOLD: a week under 60% of its plan (illness, travel) does not grow;
       the next week repeats it instead of piling on
   Short days are Sunday and Monday — the lifting day and the day after,
   when legs are tired — at half distance, never under 0.5 or over 2 km.
   Where it ends: 10 km five days, 2 km two, 54 km a week. */
export const RUN = {
  start: 1.0,
  growth: 0.05,
  ahead: 0.10,
  hold: 0.6,
  cap: 10,
  shortDays: [0, 1],
  shortRatio: 0.5,
  shortMin: 0.5,
  shortMax: 2,
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

/* RANK — the Hunter Association's measurement, as in the source: Level is
   grinding (XP, every day), Rank is measured power. A rank needs BOTH:
     - `at`: lifetime XP, so it cannot be skipped by one good test day
     - `trials`: real numbers you record in STATUS → RANK TRIALS
   Ranks go in order and a passed one is never lost. S is the body goal:
   Sung Jin-woo shredded — ~10% body fat with real muscle under it (lean
   mass 70 kg at 175 cm is an FFMI of ~23, very muscular for a natural) —
   plus the source's full Daily Quest in one day.
   XP alone would put S around week 24 at full adherence; the trials will
   set the real pace. `loot` is a real-world treat the System GRANTS on
   promotion. Keep only ones you would genuinely withhold otherwise. */
export const RANKS = [
  { r: 'E', at: 0,     trials: [] },
  { r: 'D', at: 250,   trials: [{ test: 'runkm', target: 2 }, { test: 'pushups', target: 30 }] },
  { r: 'C', at: 3000,  trials: [{ test: 'runkm', target: 5 }, { test: 'pushups', target: 40 }, { test: 'bf', target: 25 }], loot: 'Takeaway of your choice' },
  { r: 'B', at: 7000,  trials: [{ test: 'runkm', target: 10 }, { test: 'pushups', target: 50 }, { test: 'bf', target: 18 }], loot: 'Massage' },
  { r: 'A', at: 14000, trials: [{ test: 'run10k', target: 60 }, { test: 'pushups', target: 70 }, { test: 'bf', target: 14 }], loot: 'Something you want under £50' },
  { r: 'S', at: 27000, trials: [{ test: 'quest', target: 1 }, { test: 'run10k', target: 50 }, { test: 'bf', target: 10 }, { test: 'lean', target: 70 }], loot: 'Name it now, collect it then' },
]

/* What a trial measures. `better`: more | less | done. Body tests come from
   tape measurements, not typed in: body fat by the US Navy formula (waist at
   the navel, neck just below the larynx, height), lean mass = weight × (1 −
   body fat). A tape is within a few points of a scan and, more importantly,
   consistent with itself — the trend is what matters. */
export const TESTS = {
  runkm:   { name: 'Run non-stop',     unit: 'km',   better: 'more', how: 'Your longest run without stopping to walk.' },
  pushups: { name: 'Push-ups, one set', unit: 'reps', better: 'more', how: 'Chest to a fist from the floor, no rest at the top.' },
  run10k:  { name: '10 km time',       unit: 'min',  better: 'less', how: 'A timed 10 km, any route, no stopping the clock.' },
  quest:   { name: 'The Daily Quest (source)', unit: '', better: 'done', how: '100 push-ups, 100 sit-ups, 100 squats and a 10 km run, all in one day.' },
  bf:      { name: 'Body fat',         unit: '%',    better: 'less', body: true, how: 'Tape: waist at the navel, neck below the larynx. US Navy formula.' },
  lean:    { name: 'Lean mass',        unit: 'kg',   better: 'more', body: true, atBf: 10, how: 'Weight × (1 − body fat), from a measurement at 10% body fat or under — big AND shredded, at the same time.' },
}

export const BODY = { heightCm: 175 }

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
