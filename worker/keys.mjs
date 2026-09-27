/* Run once: node worker/keys.mjs
   Prints a fresh VAPID key pair. The PUBLIC key goes in push.js (VAPID) and
   in the worker as a secret; the PRIVATE key goes ONLY into the worker:
     wrangler secret put VAPID_PUBLIC
     wrangler secret put VAPID_PRIVATE
   Never commit the private key. */

const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
const d = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d
const pub = Buffer.from(raw).toString('base64url')

console.log('VAPID_PUBLIC  (push.js + worker secret):', pub)
console.log('VAPID_PRIVATE (worker secret ONLY):     ', d)
