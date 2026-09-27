/* The reminder worker's rules, against an in-memory KV and a fake push
   service: right hour only, once a day, never when everything is done,
   dead subscriptions dropped. */

import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { tick } from '../worker/index.js'

function kv() {
  const m = new Map()
  return {
    m,
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, v) },
    delete: async (k) => { m.delete(k) },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  }
}

async function env() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const b = (x) => Buffer.from(new Uint8Array(x)).toString('base64url')
  return {
    SUBS: kv(),
    VAPID_PUBLIC: b(await crypto.subtle.exportKey('raw', kp.publicKey)),
    VAPID_PRIVATE: (await crypto.subtle.exportKey('jwk', kp.privateKey)).d,
    VAPID_SUBJECT: 'mailto:test@example.com',
    APP_URL: 'https://example.com/the-system/',
    ORIGIN: 'https://example.com',
    _p256dh: b(await crypto.subtle.exportKey('raw', ua.publicKey)),
  }
}

const post = (E, path, body) => worker.fetch(new Request('https://w' + path, { method: 'POST', body: JSON.stringify(body) }), E)

test('sends once, in the chosen local hour, only while a quest is open', async () => {
  const E = await env()
  const sent = []
  let status = 201
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status }) }

  const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: E._p256dh, auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url') } }
  let r = await post(E, '/subscribe', { id: 'user_123456', sub, tz: 'America/New_York', hour: 20, date: '2026-10-01', open: 2 })
  assert.equal(r.status, 200)

  await tick(E, new Date('2026-10-01T23:00:00Z'))          // 19:00 EDT — too early
  assert.equal(sent.length, 0)
  await tick(E, new Date('2026-10-02T00:00:00Z'))          // 20:00 EDT
  assert.equal(sent.length, 1)
  assert.equal(sent[0].init.headers['Content-Encoding'], 'aes128gcm')
  assert.match(sent[0].init.headers.Authorization, /^vapid t=/)
  await tick(E, new Date('2026-10-02T00:30:00Z'))          // same hour again: never twice
  assert.equal(sent.length, 1)

  // next day, all done → silent
  r = await post(E, '/state', { id: 'user_123456', date: '2026-10-02', open: 0 })
  assert.equal(r.status, 200)
  await tick(E, new Date('2026-10-03T00:00:00Z'))
  assert.equal(sent.length, 1)

  // day after, never opened → assumed open → sends
  await tick(E, new Date('2026-10-04T00:00:00Z'))
  assert.equal(sent.length, 2)

  // subscription gone → removed
  status = 410
  await tick(E, new Date('2026-10-05T00:00:00Z'))
  assert.equal(E.SUBS.m.size, 0)
})

test('rejects junk', async () => {
  const E = await env()
  assert.equal((await post(E, '/subscribe', { id: 'x' })).status, 400)
  assert.equal((await post(E, '/subscribe', { id: 'user_123456', sub: { endpoint: 'http://insecure' }, tz: 'UTC', hour: 20 })).status, 400)
  assert.equal((await post(E, '/state', { id: 'user_nobody1' })).status, 404)
})
