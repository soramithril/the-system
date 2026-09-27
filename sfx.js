/* ============================================================================
   sfx — a small synth. No audio files, no network, ~2KB.

   Carried over from v1's sound engine, trimmed from ~28 cues to 5. The other
   23 (shadowExtract, arise, bossReveal, titleUnlock, penalty, …) left with the
   features they belonged to.

   The iOS unlock below is kept deliberately: Safari will not start an
   AudioContext outside a user gesture, and merely calling resume() is not
   enough — a silent buffer has to actually play once to open the pipeline.
   That detail is easy to lose and produces a silent app on exactly one
   platform, which is the one this is built for.
   ========================================================================= */

let ctx = null
let unlocked = false

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  return ctx
}

function unlock() {
  if (unlocked) return
  const c = ac()
  if (!c) return
  const b = c.createBuffer(1, 1, 22050)
  const s = c.createBufferSource()
  s.buffer = b
  s.connect(c.destination)
  s.start(0)
  if (c.state === 'suspended') c.resume()
  unlocked = true
}
;['touchstart', 'touchend', 'click', 'keydown'].forEach((e) =>
  document.addEventListener(e, unlock, { once: true, passive: true })
)

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/* one partial */
function tone(freq, t0, dur, gain = 0.12, type = 'sine') {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

const CUES = {
  /* inharmonic partials — reads as a struck bell, not a beep */
  check: (t) => { tone(523.25, t, 0.5, 0.10); tone(1318.5, t + 0.012, 0.42, 0.055); tone(1975.5, t + 0.02, 0.3, 0.03) },
  uncheck: (t) => { tone(392, t, 0.22, 0.06); tone(261.6, t + 0.03, 0.26, 0.04) },
  clear:  (t) => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.075, 0.6, 0.085)) },
  levelUp:(t) => { [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.06, 0.7, 0.09)) },
  buy:    (t) => { tone(659.25, t, 0.28, 0.08); tone(987.77, t + 0.05, 0.34, 0.05) },
}

export function play(name) {
  if (quiet()) return
  const c = ac()
  const cue = CUES[name]
  if (!c || !cue) return
  if (c.state === 'suspended') c.resume()
  try { cue(c.currentTime + 0.005) } catch (_) {}
}
