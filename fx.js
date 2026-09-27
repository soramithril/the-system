/* ============================================================================
   fx — the feedback that makes a tap feel like something.

   Everything here is non-blocking and lands under a second. None of it sits
   between a thumb and the next checkbox: every node is pointer-events:none
   and removes itself when its animation ends.
   ========================================================================= */

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---- haptics --------------------------------------------------------------
   navigator.vibrate does not exist on iOS, so every "haptic" v2 shipped was
   silent on the one platform it was built for. Safari 18 added a native
   switch control — <input type="checkbox" switch> — and toggling one plays
   the system's light haptic tick. Clicking a hidden label for one, inside the
   user's tap, is the only way a web page can reach the Taptic Engine.
   Patterns are ticks spaced ~110ms apart, well inside the gesture window. */
let sw = null
const ios = !('vibrate' in navigator)
function tick() {
  if (!sw) {
    sw = document.createElement('label')
    sw.setAttribute('aria-hidden', 'true')
    sw.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
    const i = document.createElement('input')
    i.type = 'checkbox'
    i.setAttribute('switch', '')
    i.tabIndex = -1
    sw.appendChild(i)
    document.body.appendChild(sw)
  }
  sw.click()
}
const PATTERNS = { light: [10], double: [10, 60, 14], heavy: [18, 70, 18, 70, 28] }
export function haptic(kind = 'light') {
  const p = PATTERNS[kind] || PATTERNS.light
  try {
    if (!ios) { navigator.vibrate(p); return }
    const n = Math.ceil(p.length / 2)
    for (let k = 0; k < n; k++) k ? setTimeout(tick, k * 110) : tick()
  } catch (_) {}
}

/* Count-up. Writes the final value immediately when motion is reduced or the
   page is hidden: rAF does not fire in the background, so a tween started
   off-screen would park on its START value and show a stale number the next
   time you look — the COMMON case on a phone, reopened from the background. */
export function animateNumber(el, to, suffix = '', dur = 520, from) {
  if (!el) return
  const cur = from != null ? from : parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10)
  const start = Number.isFinite(cur) ? cur : to
  if (reduceMotion || start === to || document.hidden) { el.textContent = to + suffix; return }
  const t0 = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    el.textContent = Math.round(start + (to - start) * e) + suffix
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/* A short burst at the touch point. */
export function sparks(ev, n = 10) {
  if (reduceMotion || !ev) return
  const x = ev.clientX || 0, y = ev.clientY || 0
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

/* Roll a value up from a point — "+35 XP". */
export function floatUp(x, y, text, cls = '') {
  if (reduceMotion) return
  const el = document.createElement('div')
  el.className = 'floatup ' + cls
  el.textContent = text
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1000)
}

/* Replay a one-shot CSS animation class on an element. */
export function pulse(el, cls, ms = 900) {
  if (!el || reduceMotion) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  clearTimeout(el['_t_' + cls])
  el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), ms)
}

/* Rise a label out of an element — "[LEVEL UP!]" out of the XP bar. */
export function riseFrom(el, text, cls = '') {
  if (!el || reduceMotion) return
  const r = el.getBoundingClientRect()
  const t = document.createElement('div')
  t.className = 'rise ' + cls
  t.textContent = text
  t.style.left = (r.left + r.width / 2) + 'px'
  t.style.top = r.top + 'px'
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 1000)
}
