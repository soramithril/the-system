/* ============================================================================
   fx — the feedback that was worth keeping from v1.

   These three helpers were genuinely good work and are the reason completing a
   habit felt like something. They were also unreachable: all of them were
   private consts inside the IIFE at hud.js:15, so nothing outside that file
   could call them. Extracted here, callable directly.

   What did NOT survive: the MutationObserver plumbing that drove them
   (watchNumeric, wireQuestSparks, wireDeck, wireParallax, wireMilestones).
   v2 calls these at the moment of the change instead of observing the DOM for
   it — fewer moving parts, and no re-entrancy to guard against.

   Everything here is non-blocking and lands well under a second. None of it
   sits between a thumb and the next checkbox.
   ========================================================================= */

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

export const haptic = (ms = 8) => {
  if (reduceMotion) return
  try { navigator.vibrate && navigator.vibrate(ms) } catch (_) {}
}

/* Count-up. v1 disconnected a MutationObserver around every write to avoid
   recursive fires; with no observer there is nothing to guard, so this is just
   a rAF tween that writes the final value even when motion is reduced. */
export function animateNumber(el, to, suffix = '', dur = 520) {
  if (!el) return
  const from = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10)
  const start = Number.isFinite(from) ? from : to
  if (reduceMotion || start === to) { el.textContent = to + suffix; return }

  const t0 = performance.now()
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)              // easeOutCubic
    el.textContent = Math.round(start + (to - start) * e) + suffix
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* A short burst at the touch point. Self-cleaning: every node removes itself
   on animationend, so nothing accumulates across a day of taps. */
export function sparks(ev, n = 10) {
  if (reduceMotion) return
  const x = (ev.clientX != null) ? ev.clientX : 0
  const y = (ev.clientY != null) ? ev.clientY : 0
  if (!x && !y) return

  const host = document.createElement('div')
  host.className = 'sparks'
  host.style.left = x + 'px'
  host.style.top = y + 'px'

  for (let i = 0; i < n; i++) {
    const s = document.createElement('i')
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
    const d = 16 + Math.random() * 26
    s.style.setProperty('--dx', Math.cos(a) * d + 'px')
    s.style.setProperty('--dy', Math.sin(a) * d + 'px')
    s.style.animationDelay = (Math.random() * 60) + 'ms'
    host.appendChild(s)
  }

  document.body.appendChild(host)
  setTimeout(() => host.remove(), 900)
}

/* Float a value up from a point — used for +xp. */
export function floatUp(ev, text) {
  if (reduceMotion || !ev) return
  const el = document.createElement('div')
  el.className = 'floatup'
  el.textContent = text
  el.style.left = (ev.clientX || 0) + 'px'
  el.style.top = (ev.clientY || 0) + 'px'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1100)
}
