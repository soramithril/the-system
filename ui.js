/* ============================================================================
   THE SYSTEM WINDOW — the one look every message uses.

   A floating navy panel with a glowing edge and a "[!] NOTIFICATION" header.
   The text types itself out under the chime. It floats at the top of the
   screen — over the plate, never over the quests — and it never blocks the
   next tap: the rest of the page stays live underneath it.

     tap once  → finish typing
     tap again → dismiss
     otherwise → it leaves on its own

   Windows queue and show one at a time. The director in app.js makes sure
   a single tap only ever queues ONE window (the biggest event, with the
   rest folded in as lines), so it never becomes v1's twelve full-screen
   animations in a row.
   ========================================================================= */

import { play } from './sfx.js'
import { reduceMotion } from './fx.js'

export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const queue = []
let showing = null

/* o = { head, title, sub (html), lines [text], big, tone ('red'|'violet'|'gold'),
         img, actions [{ label, primary, onClick }], hold (ms, 0 = stay),
         sound (cue name, or null for silence), onShow(el) } */
export function notify(o) {
  return new Promise((resolve) => {
    queue.push({ ...o, resolve })
    if (!showing) next()
  })
}

export const busy = () => !!showing || queue.length > 0

function next() {
  const o = queue.shift()
  showing = o || null
  if (!o) return
  const host = document.getElementById('windows')
  const el = document.createElement('div')
  el.className = 'sw' + (o.big ? ' big' : '') + (o.tone ? ' tone-' + o.tone : '')
  el.setAttribute('role', 'status')
  const hold = o.actions ? 0 : (o.hold != null ? o.hold : (o.big ? 6500 : 4200))
  el.innerHTML = `
    <i class="sw-edge"></i>
    <div class="sw-h mono"><b class="sw-x">!</b><span>${esc(o.head || 'NOTIFICATION')}</span></div>
    <div class="sw-b">
      ${o.img ? `<div class="sw-img"><img src="${esc(o.img)}" alt=""></div>` : ''}
      <p class="sw-t cond"></p>
      ${o.sub ? `<div class="sw-sub mono">${o.sub}</div>` : ''}
      ${o.lines && o.lines.length ? `<ul class="sw-l mono">${o.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>
    ${o.actions ? `<div class="sw-a">${o.actions.map((a, i) => `<button type="button" class="mono${a.primary ? ' pri' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    ${hold ? `<i class="sw-timer" style="animation-duration:${hold}ms"></i>` : ''}`
  host.appendChild(el)

  const text = o.title ? '[' + o.title + ']' : ''
  const t = el.querySelector('.sw-t')
  let typing = !!text && !reduceMotion
  let timer = 0, holdTimer = 0, closed = false

  const armHold = () => {
    if (!hold) return
    el.classList.add('holding')
    holdTimer = setTimeout(close, hold)
  }
  const finish = () => {
    clearTimeout(timer)
    t.textContent = text
    typing = false
    el.classList.remove('typing')
    armHold()
  }
  function close() {
    if (closed) return
    closed = true
    clearTimeout(timer)
    clearTimeout(holdTimer)
    el.classList.add('out')
    setTimeout(() => el.remove(), 240)
    o.resolve()
    showing = null
    setTimeout(next, 160)
  }

  if (typing) {
    el.classList.add('typing')
    const per = Math.max(8, Math.min(26, 560 / text.length))
    let i = 0
    const step = () => {
      i++
      t.textContent = text.slice(0, i)
      if (i < text.length) timer = setTimeout(step, per)
      else finish()
    }
    step()
  } else {
    t.textContent = text
    armHold()
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation()
    const b = e.target.closest('button[data-i]')
    if (b) {
      const a = o.actions[+b.dataset.i]
      const r = a.onClick ? a.onClick(el) : undefined
      if (r !== false) close()
      return
    }
    if (typing) finish()
    else if (!o.actions) close()
  })

  o.close = close
  if (o.sound !== null) play(o.sound || 'window')
  if (o.onShow) try { o.onShow(el) } catch (_) {}
}

/* Close the window on screen if it is the one with this id. */
export function dismiss(id) {
  if (showing && showing.id === id && showing.close) showing.close()
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].id === id) { queue[i].resolve(); queue.splice(i, 1) }
}

/* ---- the sheet: Status, Shadows, Inventory, System. Opened on purpose,
   closed on purpose — the only surface that covers the screen. ---------- */
export function openSheet(title, html, mount) {
  const s = document.getElementById('sheet')
  s.querySelector('.sheet-t').textContent = title
  /* a fresh body every time, so listeners from the last opening go with it */
  const old = s.querySelector('.sheet-b')
  const b = document.createElement('div')
  b.className = 'sheet-b'
  b.innerHTML = html
  old.replaceWith(b)
  s.hidden = false
  document.documentElement.classList.add('sheet-open')
  if (mount) mount(b)
}
export function closeSheet() {
  const s = document.getElementById('sheet')
  s.hidden = true
  document.documentElement.classList.remove('sheet-open')
}
export const sheetOpen = () => !document.getElementById('sheet').hidden
