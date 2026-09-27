# Evening reminder — setup

One push a day at the hour you pick, only while a quest is still open. The app
side is already built (`push.js`, the System menu); this worker is the sender.
Until it is deployed, the System menu says "not deployed yet" instead of
offering the switch.

## Deploy (about ten minutes, once)

```sh
cd worker
npm i -g wrangler          # or: npx wrangler …
wrangler login

wrangler kv namespace create SUBS
#   → paste the printed id into wrangler.toml (kv_namespaces.id)

node keys.mjs
#   → prints VAPID_PUBLIC and VAPID_PRIVATE
wrangler secret put VAPID_PUBLIC     # paste the public key
wrangler secret put VAPID_PRIVATE    # paste the private key — nowhere else

# in wrangler.toml: set VAPID_SUBJECT to mailto:<your email>
# (and APP_URL / ORIGIN if the app is not at soramithril.github.io/the-system/)

wrangler deploy
#   → prints https://the-system-push.<account>.workers.dev
```

Then in `push.js` at the repo root:

```js
export const WORKER = 'https://the-system-push.<account>.workers.dev'
export const VAPID = '<the VAPID_PUBLIC key>'
```

Commit, let Pages publish, then on the phone: open THE SYSTEM **from the home
screen** → tap **SYSTEM** (top left) → **Evening reminder** → **TURN ON**.

## How it decides

- Cron runs hourly. A subscriber is only considered in the hour they picked,
  in their own time zone.
- The app reports `{ date, open }` whenever the open count changes. `open: 0`
  for today → no push. No report for today (app never opened) → it assumes
  the quest is open and sends.
- `sent` stores the local date of the last push, so it can never send twice
  in a day.
- A push service answering 404/410 means the subscription is dead; it is
  deleted.

The message uses the Declarative Web Push shape (`web_push: 8030`), which
iOS 18.4+ renders itself; `sw.js` handles the same JSON on older iOS.

`test/webpush.test.mjs` checks the encryption byte-for-byte against RFC 8291
Appendix A.
