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
- [ ] `habits.js` → `DUNGEONS`: swap the placeholder upper/lower split for the
      Toji program's lifting days and session names.
- [ ] `habits.js` → `RUN`: check against the running plan (start 1.0 km, +5% a
      week, short days Tue/Fri at half distance, 10 km cap, run/walk weeks 1–8).
- [ ] `habits.js` → `RANKS`: the `loot` on each rank — keep only treats you
      would genuinely withhold from yourself otherwise.

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
- **Training:** Today's Dungeon line, the run inside the Daily Quest card
  (feeds STR and AGI, distance rises weekly), the optional lifting card, Go
  Beyond after 20/20/20.
- **Quests:** the sealed queue, earned grants after day 14 (one per cleared
  Gate), the weekly upload quest.
- **The Gate:** a boss every Monday that dies on the 5th kept day, ARISE and
  the Shadow Army with its 13-rung ladder, Red Gate on 7 of 7, the Monday
  report.
- **Research additions:** Rest Permits ("7 of 7, with 2 permits"), the Late
  Report until noon, the archive copy, sending the report to one person, the
  cue line only while a habit slides, the evening reminder, Shortcut / NFC
  logging.

Tests: `TZ=America/New_York node --test test/*.test.mjs`

## Queued (after day 14)

- [ ] Art files into the repo (eyes band, backdrop, figure, crest) — `art/eyes.jpg`, `art/backdrop.jpg`

## Wants (raw, unsorted — write them here instead of building them)

-
