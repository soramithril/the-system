/* ============================================================================
   Web Push on WebCrypto alone — no npm, runs in a Cloudflare Worker and in
   node 20+. Two standards, both small:

     RFC 8292  VAPID: a short ES256 JWT proving which server is sending.
     RFC 8291  the message body, encrypted to the browser's key with
               aes128gcm (RFC 8188), so the push service cannot read it.

   test/webpush.test.mjs checks encrypt() byte-for-byte against the worked
   example in RFC 8291 Appendix A.
   ========================================================================= */

const te = new TextEncoder()

export const b64u = {
  enc: (buf) => {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let s = ''
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  dec: (str) => {
    const s = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  },
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/* HKDF-SHA256 extract-and-expand in one call */
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

/* a P-256 key from raw public bytes (65, uncompressed) and optionally d */
function jwk(pub, d) {
  return { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ...(d ? { d } : {}), ext: true }
}

/* RFC 8291 §3.4 + RFC 8188: one record, delimiter 0x02, no padding.
   `fixed` = { salt, asPrivate, asPublic } exists only for the test vector. */
export async function encrypt(payload, keys, fixed) {
  const uaPublic = b64u.dec(keys.p256dh)
  const authSecret = b64u.dec(keys.auth)
  const salt = fixed ? b64u.dec(fixed.salt) : crypto.getRandomValues(new Uint8Array(16))

  let asPriv, asPublic
  if (fixed) {
    asPublic = b64u.dec(fixed.asPublic)
    asPriv = await crypto.subtle.importKey('jwk', jwk(asPublic, fixed.asPrivate), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    asPriv = kp.privateKey
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  }

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPriv, 256))

  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12)

  const plain = concat(typeof payload === 'string' ? te.encode(payload) : payload, new Uint8Array([2]))
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain))

  const rs = new Uint8Array([0, 0, 16, 0])               // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct)
}

/* RFC 8292: Authorization: vapid t=<jwt>, k=<public key> */
export async function vapid(endpoint, subject, publicB64, privateB64) {
  const pub = b64u.dec(publicB64)
  const key = await crypto.subtle.importKey('jwk', jwk(pub, privateB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64u.enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u.enc(te.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + body))
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${publicB64}`
}

/* Send one message. Resolves with the push service's status: 201 is
   delivered-to-service; 404/410 mean the subscription is gone for good. */
export async function send(sub, message, env, ttl = 6 * 3600) {
  const body = await encrypt(JSON.stringify(message), sub.keys)
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapid(sub.endpoint, env.VAPID_SUBJECT, env.VAPID_PUBLIC, env.VAPID_PRIVATE),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  })
  return r.status
}
