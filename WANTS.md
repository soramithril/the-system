# WANTS

**The code is frozen for 14 days from the first logged day.**

Building was the competing habit last time — months of it, against one week of
use. It has the stronger cue. So between day 1 and day 14 nothing ships except a
genuine bug that stops a habit being logged. Everything else goes here.

First logged day: _______________  →  freeze lifts: _______________

---

## Before day 1 — one-time setup outside the code

These are configuration, not building. Do them before the first tap, because
after it the freeze applies.

- [ ] `firebase deploy --only database` — publishes the inbox rules in
      `database.rules.json`. Shortcut / NFC logging does nothing until then.
- [ ] Evening reminder: deploy `worker/` (steps in `worker/README.md`), then put
      the worker URL and public key into `push.js`. Until then the System menu
      says the server is not deployed.
- [ ] `habits.js` → `DUNGEONS`: lifting is Saturday + Sunday, placeholder
      names FULL BODY A / B. Rename to the Toji program's sessions — and tell
      whoever writes that program it has to fit two weekend days.
- [ ] `habits.js` → `BODY.heightCm`: 175 — confirm; body fat depends on it.
- [ ] `habits.js` → `RANKS`: the `loot` on each rank — keep only treats you
      would genuinely withhold from yourself otherwise.

## Day 1 — baselines, in the app (STATUS → RANK TRIALS)

- [ ] MEASURE BODY: waist at the navel, neck below the larynx, weight. Same
      time of day each time after this (morning, before food).
- [ ] RECORD push-ups: one set, as many as you can.
- [ ] RECORD run non-stop: the longest you can run without walking.
- [ ] Re-measure every 2 weeks; re-test whenever a rank's XP is met.

## Shipped in v3 (built before day 1)

Every item on the research list, none of the skipped ones (no HP, no penalty
zone, no XP loss, no demotion, no shop, no resetting streak, no blocking
full-screen animations, no leaderboards).

- **The System:** System Window (typed, chimed, one at a time), Daily Quest
  arrival and completion, the Awakening, level-up rising out of the XP bar, the
  Hunter Association rank reassessment, keys and unsealing, title
  announcements, skills, the source-style status window, Job Change at level
  10, Random Box drops with auras and sigils you can equip.
- **Feel:** tap press / sweep / diamond ring / "+XP", today's square charging
  and flaring, state-change looks (connecting, offline, link restored, new
  day), real iPhone haptics (iOS 18 switch trick), and one tap → one moment.
- **Training:** Today's Dungeon line, the optional weekend lifting card (FULL
  BODY A/B), Go Beyond after 20/20/20. The run is its own card and pure AGI:
  +KM logs the real distance, and the plan grows 5% a week, rises to meet you
  when you run ahead (never more than 10% over what you ran — Nielsen 2014),
  and holds after a thin week.
- **Rank = XP and trials:** Level is the grind; rank is measured, like the
  Hunter Association. Each rank needs its XP and its trials (run distance,
  push-ups, 10 km time, body fat by tape). S-rank is the body goal: ~10% body
  fat, lean mass ≥ 70 kg at the same time, a sub-50 10 km, and the source's
  100/100/100 + 10 km in one day.
- **Quests:** nothing is locked — every quest is tappable from day 1 and pays
  XP. Required from day 1: Strength Training, Run, Vitamins, Japanese.
  Protein is "not required yet" until the first cleared Gate makes it
  required. Weekly: the weigh-in (opens the scale / tape window).
- **The Gate:** a boss every Monday that dies on the 5th kept day, ARISE and
  the Shadow Army with its 13-rung ladder, Red Gate on 7 of 7, the Monday
  report.
- **Research additions:** Rest Permits ("7 of 7, with 2 permits"), the Late
  Report until noon, the archive copy, sending the report to one person, the
  cue line only while a habit slides, the evening reminder, Shortcut / NFC
  logging.

Tests: `TZ=America/New_York node --test test/*.test.mjs`

## Decide after day 14

- [ ] **YouTube in the System, or not.** Parked in `habits.js` (`content`,
      `upload`, `archived: true`). If yes: one Gate-unlocked WEEKLY quest
      (batch recording fits a week, not a day) — e.g. "Create: 2 sessions" —
      and subscriber milestones as titles, never as rank. Subscribers depend
      on the algorithm; rank measures you.
- [ ] The v1 videos (sprint clip, Toji lifting, shadow aura) as card /
      ARISE backgrounds — only as files in the repo, only playing on screen.
- [ ] Art files into the repo (eyes band, backdrop, figure, crest) — `art/eyes.jpg`, `art/backdrop.jpg`

## Wants (raw, unsorted — write them here instead of building them)

-
