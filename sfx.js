/* ============================================================================
   sfx — a small synth. No audio files, no network, ~3KB.

   The iOS unlock below is kept deliberately: Safari will not start an
   AudioContext outside a user gesture, and merely calling resume() is not
   enough — a silent buffer has to actually play once to open the pipeline.
   That detail is easy to lose and produces a silent app on exactly one
   platform, which is the one this is built for.

   One cue per moment. The director in app.js picks the single biggest event
   a tap caused and plays only its cue, so a tap that keeps the day, kills
   the boss and levels up is one sound, not three stacked.
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
/* capture phase, so the unlock runs BEFORE the tap's own handler — otherwise
   the very first tap of a session would be the one silent tap */
;['touchstart', 'touchend', 'click', 'keydown'].forEach((e) =>
  document.addEventListener(e, unlock, { once: true, passive: true, capture: true })
)

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/* one partial */
function tone(freq, t0, dur, gain = 0.12, type = 'sine', attack = 0.012, glide) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

const CUES = {
  /* inharmonic partials — reads as a struck bell, not a beep */
  check:   (t) => { tone(523.25, t, 0.5, 0.10); tone(1318.5, t + 0.012, 0.42, 0.055); tone(1975.5, t + 0.02, 0.3, 0.03) },
  uncheck: (t) => { tone(392, t, 0.22, 0.06); tone(261.6, t + 0.03, 0.26, 0.04) },
  /* the System's notification chime: two glassy notes, a fifth apart */
  window:  (t) => { tone(1174.7, t, 0.34, 0.05); tone(1760, t + 0.07, 0.42, 0.045); tone(3520, t + 0.07, 0.2, 0.012) },
  /* Daily Quest complete: rising arpeggio with a shimmer on top */
  complete:(t) => {
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.07, 0.7, 0.075))
    tone(2637, t + 0.35, 0.6, 0.02)
  },
  levelUp: (t) => { [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.06, 0.7, 0.09)) },
  /* rank reassessment: a low hit, then the letter lands */
  slam:    (t) => {
    tone(90, t, 0.5, 0.22, 'sine', 0.005, 45)
    tone(180, t, 0.3, 0.08, 'triangle', 0.005, 90)
    ;[783.99, 1046.5, 1568].forEach((f, i) => tone(f, t + 0.12 + i * 0.05, 0.8, 0.06))
  },
  /* ARISE: a slow low swell under a minor chord */
  arise:   (t) => {
    tone(55, t, 1.3, 0.2, 'sine', 0.35, 82.4)
    tone(110, t + 0.05, 1.2, 0.07, 'triangle', 0.4)
    ;[220, 261.63, 329.63].forEach((f, i) => tone(f, t + 0.25 + i * 0.04, 1.0, 0.045, 'sine', 0.2))
  },
  /* a key turning: metallic click, then a chime */
  key:     (t) => { tone(2400, t, 0.05, 0.05, 'square'); tone(1600, t + 0.06, 0.05, 0.04, 'square'); tone(1318.5, t + 0.14, 0.6, 0.06) },
  box:     (t) => { [1318.5, 1760, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.045, 0.35, 0.035)) },
  red:     (t) => { tone(146.8, t, 0.9, 0.12, 'sawtooth', 0.02, 110); [440, 523.25, 622.25].forEach((f, i) => tone(f, t + 0.1 + i * 0.06, 0.7, 0.05)) },
  link:    (t) => { tone(880, t, 0.16, 0.04); tone(1318.5, t + 0.06, 0.22, 0.04) },
}

export function play(name) {
  if (quiet() || !unlocked) return        // no sound before the first touch — browsers refuse it anyway
  const c = ac()
  const cue = CUES[name]
  if (!c || !cue) return
  if (c.state === 'suspended') c.resume()
  try { cue(c.currentTime + 0.005) } catch (_) {}
}
