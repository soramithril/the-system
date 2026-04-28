/* ============================================================================
   THE SYSTEM — HUD JS  v6  (game-feel + structural behavior)
   - Freeze-safe MutationObservers (re-entry guard + disconnect-during-write)
   - Numeric count-up on key HUD values
   - Tick-up + glow pulse on stat increases
   - Screen-shake on level-up reveal
   - Banner parallax on hud-stage scroll
   - Tap ripple + haptic on premium surfaces
   - Quest-complete spark burst (CORRECT selector .qcard, not .qbtn)
   - Bar-fill flash on width increase
   - Command-deck → drawer toggling (HOME)
   - Tab-strip sliding indicator (QUESTS)
   - Reward-track milestones light up as dp-fill grows
   ============================================================================ */
(() => {
  'use strict';

  const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ── tiny haptic ────────────────────────────────────────────────────── */
  const haptic = (ms = 8) => {
    if (RM) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {}
  };

  /* ── freeze-safe number count-up ────────────────────────────────────── */
  /*  Strategy: store the MutationObserver on the element, and
      DISCONNECT it for the duration of every textContent write.
      This guarantees no recursive observer fires regardless of how
      many intermediate values we paint.                              */
  const animateNumber = (el, from, to, dur = 600, after) => {
    if (RM || from === to) {
      writeSafely(el, format(el, to));
      after && after();
      return;
    }
    const t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const v = from + (to - from) * ease(k);
      writeSafely(el, format(el, Math.round(v)));
      if (k < 1) requestAnimationFrame(step);
      else after && after();
    };
    requestAnimationFrame(step);
  };
  const format = (el, n) => {
    const fmt = el.dataset.hudFmt || '';
    if (fmt === '%') return n + '%';
    return String(n);
  };
  const writeSafely = (el, val) => {
    const mo = el._hudMo;
    if (mo) mo.disconnect();
    el.textContent = val;
    if (mo) mo.observe(el, { characterData:true, childList:true, subtree:true });
  };

  /* ── observe a numeric element ──────────────────────────────────────── */
  const watchNumeric = (el, opts = {}) => {
    if (!el || el.dataset.hudWatched) return;
    el.dataset.hudWatched = '1';
    el.dataset.hudFmt = String(el.textContent).includes('%') ? '%' : '';
    let prev = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10) || 0;
    let busy = false;

    const mo = new MutationObserver(() => {
      if (busy) return;                     // re-entry guard
      const next = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10);
      if (Number.isNaN(next) || next === prev) return;
      const went = next - prev;
      busy = true;
      const dur = Math.abs(went) > 50 ? 900 : (Math.abs(went) > 5 ? 600 : 360);
      animateNumber(el, prev, next, dur, () => {
        busy = false;
        prev = next;
        if (went > 0 && opts.onUp) {
          try { opts.onUp(el, prev - went, next); } catch (_) {}
        }
      });
    });
    el._hudMo = mo;
    mo.observe(el, { characterData:true, childList:true, subtree:true });
  };

  /* ── tile flash ─────────────────────────────────────────────────────── */
  const flashTile = (el) => {
    if (!el || RM) return;
    el.classList.remove('is-tickup');
    void el.offsetWidth;
    el.classList.add('is-tickup');
    setTimeout(() => el.classList.remove('is-tickup'), 700);
  };

  /* ── screen-shake on level-up ───────────────────────────────────────── */
  const wireShake = () => {
    const lu = $('#clu');
    if (!lu) return;
    new MutationObserver(() => {
      if (lu.classList.contains('show') && !RM) {
        const app = $('#app');
        app && app.classList.remove('is-shake');
        void (app && app.offsetWidth);
        app && app.classList.add('is-shake');
        haptic(28);
        setTimeout(() => app && app.classList.remove('is-shake'), 600);
      }
    }).observe(lu, { attributes:true, attributeFilter:['class'] });
  };

  /* ── spark burst ────────────────────────────────────────────────────── */
  const spawnSparks = (host, count = 14, hue = '255,200,98') => {
    if (RM || !host) return;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:5;';
    host.appendChild(layer);
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      const ang = (Math.PI * 2 * i / count) + Math.random() * 0.4;
      const dist = 90 + Math.random() * 90;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const sz = 4 + Math.random() * 5;
      s.style.cssText = `
        position:absolute;left:50%;top:50%;width:${sz}px;height:${sz}px;
        background:rgba(${hue},.95);border-radius:50%;
        transform:translate(-50%,-50%);box-shadow:0 0 12px rgba(${hue},.85);
        transition:transform .9s cubic-bezier(.16,1,.3,1),opacity .9s ease-out;
        will-change:transform,opacity;`;
      layer.appendChild(s);
      requestAnimationFrame(() => {
        s.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${.4 + Math.random() * .6})`;
        s.style.opacity = '0';
      });
    }
    setTimeout(() => layer.remove(), 1100);
  };

  const wireQuestSparks = () => {
    const cq = $('#cq');
    if (cq) new MutationObserver(() => {
      if (cq.classList.contains('show') && !cq.dataset.hudSparked) {
        cq.dataset.hudSparked = '1';
        spawnSparks($('.qc-chk-wrap', cq) || cq, 18, '43,227,149');
        setTimeout(() => spawnSparks(cq, 12, '168,120,255'), 120);
        haptic(14);
        setTimeout(() => { cq.dataset.hudSparked = ''; }, 1400);
      }
    }).observe(cq, { attributes:true, attributeFilter:['class'] });

    const chest = $('#chest-cine');
    if (chest) new MutationObserver(() => {
      if (chest.classList.contains('show') && !chest.dataset.hudSparked) {
        chest.dataset.hudSparked = '1';
        spawnSparks(chest, 26, '255,200,98');
        haptic(38);
        setTimeout(() => { chest.dataset.hudSparked = ''; }, 1600);
      }
    }).observe(chest, { attributes:true, attributeFilter:['class'] });
  };

  /* ── parallax ───────────────────────────────────────────────────────── */
  const wireParallax = () => {
    if (RM) return;
    const update = (scr) => {
      const stage = scr.querySelector('.hud-stage');
      const img = scr.querySelector('.scr-banner img');
      if (!img) return;
      const y = scr.scrollTop || 0;
      const t = Math.min(72, y * 0.32);
      img.style.transform = `translate3d(0,${-t}px,0) scale(1.06)`;
      if (stage) stage.style.setProperty('--scroll-y', y + 'px');
    };
    $$('.scr').forEach(scr => {
      let raf = 0;
      scr.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { update(scr); raf = 0; });
      }, { passive:true });
    });
  };

  /* ── ripple on premium surfaces ─────────────────────────────────────── */
  const RIPPLE_SEL = [
    '.qcard',                          /* quest cards (correct class) */
    '.fp',                             /* filter / tab pills */
    '.cat-pill', '.shop-cat-pill',     /* shop categories */
    '.si-card',                        /* shop items */
    '.add-shop-btn', '.new-mission-tile',
    '.bn',                             /* nav */
    '.mbtn',                           /* modal buttons */
    '.fab',                            /* FAB */
    '.cmd-tile'                        /* command deck */
  ].join(',');

  const wireRipples = () => {
    document.addEventListener('pointerdown', (e) => {
      const t = e.target.closest(RIPPLE_SEL);
      if (!t) return;
      // Don't ripple the inner edit/delete sub-buttons inside .qcard
      if (e.target.closest('.edit-btn,.delete-btn')) return;
      haptic(t.matches('.bn,.cmd-tile') ? 6 : 10);
      if (RM) return;
      const r = t.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const size = Math.max(r.width, r.height) * 1.6;
      const ripple = document.createElement('span');
      const goldish = t.matches('.cat-pill,.shop-cat-pill,.si-card,.fab,.new-mission-tile');
      const color = goldish
        ? 'rgba(255,200,98,.45)'
        : 'rgba(168,120,255,.45)';
      ripple.style.cssText = `
        position:absolute;left:${x - size/2}px;top:${y - size/2}px;
        width:${size}px;height:${size}px;border-radius:50%;
        background:radial-gradient(circle,${color} 0%,transparent 60%);
        pointer-events:none;opacity:.9;transform:scale(.2);
        transition:transform .55s cubic-bezier(.16,1,.3,1),opacity .55s ease-out;
        z-index:50;mix-blend-mode:screen;`;
      const cs = getComputedStyle(t);
      if (cs.position === 'static') t.style.position = 'relative';
      const prevOver = t.style.overflow;
      t.style.overflow = 'hidden';
      t.appendChild(ripple);
      requestAnimationFrame(() => {
        ripple.style.transform = 'scale(1)';
        ripple.style.opacity = '0';
      });
      setTimeout(() => { ripple.remove(); t.style.overflow = prevOver; }, 600);
    }, { passive:true });
  };

  /* ── Stat hex tagging  (so the CSS ::before can colour by stat) ─────── */
  const wireQcardStatHooks = () => {
    // After every render of the quest list / preview, the qcards have
    // a `--qc:var(--str)` style. Mirror that to a data-stat attribute
    // so attribute-selector CSS rules can target it without a JS re-flow.
    const tagAll = (root) => {
      $$('.qcard', root || document).forEach(c => {
        const css = c.getAttribute('style') || '';
        const m = css.match(/--qc:var\(--(str|agi|sta|int|sen)\)/i);
        if (m) {
          const stat = m[1].toUpperCase();
          c.setAttribute('data-stat', stat);
          // Mirror to the .qchk so the emblem ::after can render the stat letter
          const chk = c.querySelector('.qchk');
          if (chk) chk.setAttribute('data-stat-letter', stat);
        }
        const meta = c.querySelector('.qmeta .qtype-tag');
        if (meta) {
          const cls = (meta.className.match(/qt-(\w+)/) || [])[1];
          if (cls) c.setAttribute('data-type', cls);
        }
      });
    };
    tagAll();
    const list = $('#q-list'), prev = $('#h-qprev');
    [list, prev].forEach(host => {
      if (!host) return;
      new MutationObserver(() => tagAll(host)).observe(host, { childList:true, subtree:true });
    });
  };

  /* ── COMMAND DECK  → drawers ────────────────────────────────────────── */
  const wireDeck = () => {
    const tiles = $$('.cmd-tile');
    if (!tiles.length) return;
    const drawers = {};
    $$('.deck-drawer').forEach(d => drawers[d.dataset.drawer] = d);
    // collapsed by default
    Object.values(drawers).forEach(d => d.classList.remove('open'));
    tiles.forEach(t => {
      t.addEventListener('click', () => {
        const key = t.dataset.deck;
        const d   = drawers[key];
        if (!d) return;
        const wasOpen = d.classList.contains('open');
        // Close all others first (single-pane behavior)
        Object.values(drawers).forEach(x => x.classList.remove('open'));
        tiles.forEach(x => { x.classList.remove('act'); x.setAttribute('aria-selected','false'); });
        if (!wasOpen) {
          d.classList.add('open');
          t.classList.add('act');
          t.setAttribute('aria-selected','true');
          // Smooth-scroll the drawer into view if needed
          requestAnimationFrame(() => {
            const home = $('#s-home');
            if (home && d.getBoundingClientRect().bottom > window.innerHeight - 80) {
              home.scrollBy({ top: d.getBoundingClientRect().top - 200, behavior:'smooth' });
            }
          });
        }
      });
    });

    // Status pip — light up tiles that have content worth viewing
    const updatePips = () => {
      const has = (sel) => {
        const el = document.querySelector(sel);
        return !!(el && el.textContent.trim().length);
      };
      const set = (key, on) => {
        const pip = document.querySelector(`.cmd-pip[data-pip="${key}"]`);
        const tile = document.querySelector(`.cmd-tile[data-deck="${key}"]`);
        if (pip)  pip.classList.toggle('on', on);
        if (tile) tile.classList.toggle('has-content', on);
      };
      set('boss',    has('#boss-daily-name') || has('#boss-weekly-name'));
      set('dung',    has('#h-dung-list'));
      set('skills',  has('#h-skills-list'));
      set('shadows', has('#h-shadow-body') || has('#h-soldier-list'));
      set('recovery', !!document.querySelector('#h-recovery:not([style*="display:none"])'));
      set('mvw',     has('#mvw-rows'));
    };
    updatePips();
    const home = $('#s-home');
    if (home) new MutationObserver(updatePips).observe(home, { childList:true, subtree:true, characterData:true });
  };

  /* ── TAB STRIP  sliding indicator ───────────────────────────────────── */
  const wireQtabs = () => {
    const row = $('.filter-row.qtabs');
    if (!row) return;
    const ind = row.querySelector('.qtab-ind');
    if (!ind) return;
    const place = () => {
      const act = row.querySelector('.fp.act');
      if (!act) return;
      const r0 = row.getBoundingClientRect();
      const r1 = act.getBoundingClientRect();
      ind.style.transform = `translateX(${r1.left - r0.left}px)`;
      ind.style.width = `${r1.width}px`;
    };
    place();
    // re-place when act class changes
    new MutationObserver(place).observe(row, { attributes:true, subtree:true, attributeFilter:['class'] });
    window.addEventListener('resize', place);
    setTimeout(place, 60);
  };

  /* ── REWARD TRACK  milestone lighting ───────────────────────────────── */
  const wireMilestones = () => {
    const fill = $('#dp-fill');
    if (!fill) return;
    const update = () => {
      const w = parseFloat(fill.style.width) || 0;
      $$('.qcon-mile').forEach(m => {
        const pct = parseFloat(m.dataset.pct);
        m.classList.toggle('lit', w >= pct - 0.5);
      });
    };
    update();
    new MutationObserver(update).observe(fill, { attributes:true, attributeFilter:['style'] });
  };

  /* ── HUD numeric arming ─────────────────────────────────────────────── */
  const wireHud = () => {
    [
      '#h-level', '#h-gold', '#h-txp',
      '#shop-gd', '#sgb-val',
      '#ring-n'
    ].forEach(s => watchNumeric($(s)));

    ['STR','AGI','STA','INT','SEN'].forEach(k => {
      const el = $(`#ss-${k}`);
      if (!el) return;
      watchNumeric(el, { onUp: e => flashTile(e.closest('.stat-hex')) });
    });

    // Bar-fill brightness pulse on text update
    ['#h-hp-val','#h-mp-val','#h-xp-val'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      let prev = parseInt(el.textContent, 10) || 0;
      let busy = false;
      const mo = new MutationObserver(() => {
        if (busy) return;
        const next = parseInt(el.textContent, 10);
        if (Number.isNaN(next) || next === prev) return;
        busy = true;
        prev = next;
        const fillSel = sel.replace('-val','-fill');
        const fill = $(fillSel);
        if (fill && !RM) {
          fill.style.filter = 'brightness(1.4) saturate(1.2)';
          setTimeout(() => fill.style.filter = '', 380);
        }
        setTimeout(() => { busy = false; }, 50);
      });
      mo.observe(el, { characterData:true, childList:true, subtree:true });
    });
  };

  /* ── HLS video backgrounds  (Pinterest m3u8 → muted-loop poster) ────── */
  // Map a stat key to a Pinterest .m3u8 URL. Add more entries as the user
  // picks them; if a stat isn't in this map, we just keep the GIF bg.
  // Per-stat HLS streams. URGENT keys override the stat-based mapping
  // (urgent quests get the URGENT video regardless of their stat).
  // STA + STR use static images via CSS — no video injection.
  const QCARD_VIDEOS = {
    // STR — barbell lift (static, see CSS).
    AGI:    'https://v1.pinimg.com/videos/iht/hls/3c/a3/03/3ca303b99ad24f089167fb983a1c7ade.m3u8', // sprint
    INT:    'https://v1.pinimg.com/videos/iht/hls/05/40/70/054070ffa0eb0314cf3d9f80a271abf4.m3u8', // focused gaze
    SEN:    'https://v1.pinimg.com/videos/iht/hls/39/5c/48/395c481e1376ba1a90a2ee1b5108ab9f.m3u8', // shadow aura
    URGENT: 'https://v1.pinimg.com/videos/iht/hls/05/75/eb/0575eb36443a5b528c81c2c9ef051b1e.m3u8', // threat
  };
  let _hlsLoading = null;
  const loadHls = () => {
    if (_hlsLoading) return _hlsLoading;
    if (window.Hls) return Promise.resolve(window.Hls);
    _hlsLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload  = () => resolve(window.Hls);
      s.onerror = () => reject(new Error('hls.js load failed'));
      document.head.appendChild(s);
    });
    return _hlsLoading;
  };

  // Pause/play videos as cards enter & leave the viewport (perf + battery).
  const _vidIo = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const v = e.target.querySelector('video[data-hud-video]');
      if (!v) return;
      if (e.isIntersecting) {
        try { const p = v.play(); if (p && p.catch) p.catch(()=>{}); } catch (_) {}
      } else {
        try { v.pause(); } catch (_) {}
      }
    });
  }, { threshold: 0.05 }) : null;

  const attachVideoTo = async (card) => {
    if (!card || RM) return;
    const stat = card.getAttribute('data-stat');
    const type = card.getAttribute('data-type');
    // Urgent overrides stat
    const url = (type === 'urgent' && QCARD_VIDEOS.URGENT) || QCARD_VIDEOS[stat];
    if (!url) return;
    if (card.querySelector('video[data-hud-video]')) return;     // already attached

    const video = document.createElement('video');
    video.dataset.hudVideo = '1';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    card.insertBefore(video, card.firstChild);

    const cleanup = () => { try { video.remove(); } catch (_) {} };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;                                          // Safari native HLS
      video.addEventListener('error', cleanup, { once:true });
    } else {
      try {
        const Hls = await loadHls();
        if (!Hls || !Hls.isSupported()) { cleanup(); return; }
        const hls = new Hls({ lowLatencyMode: false, capLevelToPlayerSize: true });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data && data.fatal) { try { hls.destroy(); } catch (_) {} cleanup(); }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        // store for potential later cleanup
        video._hls = hls;
      } catch (e) {
        console.warn('hud:hls', e);
        cleanup();
        return;
      }
    }
    if (_vidIo) _vidIo.observe(card);
  };

  const wireQcardVideos = () => {
    const sweep = (root) => {
      $$('.qcard', root || document).forEach(c => attachVideoTo(c));
    };
    sweep();
    ['#q-list', '#h-qprev'].forEach(sel => {
      const host = $(sel);
      if (!host) return;
      new MutationObserver(() => sweep(host)).observe(host, { childList:true, subtree:true });
    });
  };

  /* ── boot ───────────────────────────────────────────────────────────── */
  const boot = () => {
    try { wireHud(); }            catch (e) { console.warn('hud:wireHud',e); }
    try { wireShake(); }          catch (e) { console.warn('hud:wireShake',e); }
    try { wireQuestSparks(); }    catch (e) { console.warn('hud:wireQuestSparks',e); }
    try { wireParallax(); }       catch (e) { console.warn('hud:wireParallax',e); }
    try { wireRipples(); }        catch (e) { console.warn('hud:wireRipples',e); }
    try { wireQcardStatHooks(); } catch (e) { console.warn('hud:wireQcardStatHooks',e); }
    try { wireDeck(); }           catch (e) { console.warn('hud:wireDeck',e); }
    try { wireQtabs(); }          catch (e) { console.warn('hud:wireQtabs',e); }
    try { wireMilestones(); }     catch (e) { console.warn('hud:wireMilestones',e); }
    try { wireQcardVideos(); }    catch (e) { console.warn('hud:wireQcardVideos',e); }

    // Re-arm any new HUD numerics that get created later (defensive)
    const root = $('#app') || document.body;
    new MutationObserver(() => {
      ['#h-level','#h-gold','#h-txp','#shop-gd','#ring-n','#sgb-val']
        .forEach(s => watchNumeric($(s)));
    }).observe(root, { childList:true, subtree:true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
