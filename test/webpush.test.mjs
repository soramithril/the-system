/* RFC 8291 Appendix A: the one worked example of an encrypted push message.
   If encrypt() reproduces it byte for byte, the body a browser receives is
   decryptable — which is the whole question. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { encrypt, vapid, b64u } from '../worker/webpush.js'

test('aes128gcm body matches RFC 8291 Appendix A', async () => {
  const body = await encrypt('When I grow up, I want to be a watermelon', {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  }, {
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  })
  assert.equal(b64u.enc(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
})

test('VAPID header is a verifiable ES256 JWT for the endpoint origin', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pub = b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey))
  const d = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d
  const h = await vapid('https://web.push.apple.com/abc/def', 'mailto:test@example.com', pub, d)
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)
  assert.ok(m)
  assert.equal(m[4], pub)
  const claims = JSON.parse(new TextDecoder().decode(b64u.dec(m[2])))
  assert.equal(claims.aud, 'https://web.push.apple.com')
  assert.equal(claims.sub, 'mailto:test@example.com')
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64u.dec(m[3]), new TextEncoder().encode(m[1] + '.' + m[2]))
  assert.equal(ok, true)
})
