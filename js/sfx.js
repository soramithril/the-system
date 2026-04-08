// ══════════════════════════════════════════════
// FRIEREN SOUND ENGINE — ethereal anime bells
// ══════════════════════════════════════════════
const SFX=(()=>{
  let AC=null;
  let muted=false;
  let iosUnlocked=false;
  const vol=()=>muted?0:0.75;

  // iOS Safari requires AudioContext to be created AND resumed on a user gesture.
  // We unlock it on the very first touch/click and keep it alive.
  function unlockiOS(){
    if(iosUnlocked)return;
    const c=ctx();
    // Play a silent buffer to fully unlock the audio pipeline on iOS
    const buf=c.createBuffer(1,1,22050);
    const src=c.createBufferSource();
    src.buffer=buf;src.connect(c.destination);
    src.start(0);
    if(c.state==='suspended')c.resume();
    iosUnlocked=true;
  }
  // Attach unlock to first user interaction
  ['touchstart','touchend','click','keydown'].forEach(evt=>{
    document.addEventListener(evt,unlockiOS,{once:true,passive:true});
  });

  function ctx(){
    if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    return AC;
  }

  // Bell with inharmonic overtones — core Frieren sound
  function bell(fund,vl,dur,t0,partials){
    const c=ctx(),t=t0??c.currentTime;
    (partials||[[1,1,1],[2.756,.6,1.2],[5.404,.25,1.5],[8.933,.1,2],[13.21,.04,2.5]]).forEach(([r,a,d])=>{
      const o=c.createOscillator(),g=c.createGain();
      o.type='sine';o.frequency.value=fund*r;
      g.gain.setValueAtTime(vl*a*vol(),t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur*d);
      o.connect(g);g.connect(c.destination);
      o.start(t);o.stop(t+dur*d+0.15);
    });
  }

  // Singing bowl — sustained resonant fundamental
  function bowl(fund,vl,dur,t0){
    bell(fund,vl,dur,t0,[[1,1,1],[2.01,.3,1.4],[3.00,.15,1.8],[4.00,.07,2.2],[5.01,.03,2.8]]);
  }

  // Pure tone with smooth attack/decay
  function tone(freq,vl,attack,dur,t0){
    const c=ctx(),t=t0??c.currentTime;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vl*vol(),t+attack);
    g.gain.exponentialRampToValueAtTime(0.0001,t+attack+dur);
    o.connect(g);g.connect(c.destination);
    o.start(t);o.stop(t+attack+dur+0.15);
  }

  // Frequency sweep
  function sweep(f0,f1,vl,dur,t0,attack){
    const c=ctx(),t=t0??c.currentTime,a=attack||0.02;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(f1,t+dur*0.8);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vl*vol(),t+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(c.destination);
    o.start(t);o.stop(t+dur+0.1);
  }

  // Filtered noise shimmer — mana/air/breath
  function shimmer(vl,dur,t0,loFreq,hiFreq){
    const c=ctx(),t=t0??c.currentTime;
    const n=Math.ceil(c.sampleRate*dur);
    const buf=c.createBuffer(1,n,c.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const src=c.createBufferSource();src.buffer=buf;
    const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=loFreq||3000;
    const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=hiFreq||800;
    const g=c.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vl*vol(),t+dur*0.25);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(lp);lp.connect(hp);hp.connect(g);g.connect(c.destination);
    src.start(t);src.stop(t+dur+0.1);
  }

  // Soft sub thud
  function thud(freq,vl,dur,t0){
    const c=ctx(),t=t0??c.currentTime;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(freq,t);
    o.frequency.exponentialRampToValueAtTime(freq*0.3,t+dur*0.6);
    g.gain.setValueAtTime(vl*vol(),t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(c.destination);
    o.start(t);o.stop(t+dur+0.1);
  }

  // Bell arpeggio — ascending cascade
  function bellArp(freqs,vl,noteDur,spacing,t0){
    const t=t0??(ctx().currentTime);
    freqs.forEach((f,i)=>bell(f,vl*(1-i*0.06),noteDur,t+i*spacing));
  }

  // Cash-App coin — metallic snap + ring
  function coin(freq,vl,t0){
    const c=ctx(),t=t0??c.currentTime;
    shimmer(vl*0.4,0.012,t,8000,4000);
    bell(freq,vl,0.45,t+0.005,[[1,1,1],[2.76,.5,1.3],[5.4,.2,1.7],[8.93,.08,2.2]]);
  }

  // Magic rise shimmer
  function magicRise(baseFreq,vl,dur,t0){
    const t=t0??(ctx().currentTime);
    [1,1.25,1.5,1.78,2.0,2.38,3.0].forEach((r,i)=>bell(baseFreq*r,vl*(1-i*0.1),dur*(1-i*0.04),t+i*dur*0.18));
  }

  // ── SOUND LIBRARY ──────────────────────────────────────────────
  const S={

    // Navigation
    tab:()=>{const c=ctx(),t=c.currentTime;bell(1760,.22,.25,t,[[1,1,1],[2.76,.3,1.3]]);},
    modal:()=>{const c=ctx(),t=c.currentTime;shimmer(.1,.28,t,2000,300);sweep(150,320,.1,.3,t+.04,.1);bell(330,.18,.9,t+.18);},
    modalClose:()=>{const c=ctx(),t=c.currentTime;sweep(320,150,.1,.2,t,.02);shimmer(.07,.18,t+.02,1800,500);bell(330,.12,.6,t+.05);},
    filter:()=>{const c=ctx(),t=c.currentTime;bell(1319,.2,.18,t,[[1,1,1],[2.76,.25,1.4]]);},
    save:()=>{const c=ctx(),t=c.currentTime;bell(659,.25,.7,t);bell(784,.2,.65,t+.1);},
    delete:()=>{const c=ctx(),t=c.currentTime;tone(300,.15,.04,.15,t);sweep(280,80,.14,.4,t+.06);shimmer(.06,.25,t+.08,1000,200);tone(60,.1,.05,.5,t+.25);},
    error:()=>{const c=ctx(),t=c.currentTime;bowl(82,.4,1.8,t);tone(65,.15,.06,1.0,t+.05);bowl(73,.2,1.5,t+.35);},
    equipTitle:()=>{const c=ctx(),t=c.currentTime;bellArp([523,659,784,988],.2,.9,.16,t);bell(1319,.15,1.0,t+.65);shimmer(.05,.4,t+.5,3500,1500);},

    // Quests
    check:()=>{const c=ctx(),t=c.currentTime;thud(120,.2,.12,t);bell(659,.3,1.0,t+.04);bell(880,.22,.9,t+.14);bell(1109,.15,.8,t+.26);shimmer(.06,.4,t+.15,3000,1000);},
    uncheck:()=>{const c=ctx(),t=c.currentTime;bell(880,.2,.7,t);bell(659,.15,.6,t+.12);tone(400,.08,.06,.3,t+.2);},
    xpPop:()=>{const c=ctx(),t=c.currentTime;bell(2637,.28,.3,t,[[1,1,1],[2.1,.3,1.4]]);bell(3136,.16,.22,t+.06,[[1,1,1]]);},
    streak:()=>{const c=ctx(),t=c.currentTime;shimmer(.08,.5,t,2500,600);tone(165,.12,.08,.6,t+.05);bellArp([330,415,523,659,784],.22,1.0,.14,t+.1);bell(1047,.15,1.2,t+.85);},

    // Shop
    buy:()=>{const c=ctx(),t=c.currentTime;coin(1200,.55,t);coin(1500,.45,t+.07);coin(1800,.35,t+.13);bell(440,.18,1.2,t+.2);bell(554,.12,1.0,t+.32);},
    cantBuy:()=>{const c=ctx(),t=c.currentTime;bowl(90,.35,1.5,t);tone(70,.15,.05,.8,t+.1);},
    useItem:()=>{const c=ctx(),t=c.currentTime;shimmer(.12,.3,t,2000,400);sweep(300,700,.1,.35,t+.05);bell(880,.2,.8,t+.25);},
    shopNotif:()=>{const c=ctx(),t=c.currentTime;bell(1760,.4,.7,t);bell(2217,.2,.5,t+.12);},

    // Cinematics
    questCine:()=>{const c=ctx(),t=c.currentTime;shimmer(.1,.6,t,1500,200);tone(110,.14,.2,.8,t);tone(165,.1,.25,.7,t+.15);thud(100,.18,.2,t+.6);bell(440,.28,1.4,t+.65);bell(554,.22,1.2,t+.78);bell(659,.16,1.0,t+.94);shimmer(.08,.5,t+.7,3000,800);},

    levelUp:()=>{
      const c=ctx(),t=c.currentTime;
      shimmer(.1,.8,t,2000,200);tone(82,.12,.3,1.0,t);tone(110,.1,.4,.9,t+.2);
      bellArp([165,208,262,330,415],.22,1.2,.2,t+.4);
      [523,659,784,988].forEach((f,i)=>bell(f,.28-i*.03,2.0,t+1.5+i*.1));
      shimmer(.12,.8,t+1.5,4000,1000);
      bellArp([1047,1319,1568,1760,2093],.15,1.5,.18,t+2.4);
    },

    rankUp:()=>{
      const c=ctx(),t=c.currentTime;
      thud(55,.35,.8,t);bowl(55,.45,4.0,t);bowl(82,.3,3.5,t+.08);shimmer(.18,.8,t+.1,1000,80);
      shimmer(.1,1.2,t+.8,5000,800);tone(110,.12,.5,1.5,t+1.0);
      bellArp([220,277,330,415,494],.2,1.5,.22,t+1.3);
      [659,784,988,1245].forEach((f,i)=>bell(f,.22-i*.03,2.5,t+2.3+i*.15));
      [0,.1,.2,.32,.46].forEach((d,i)=>coin(1200+i*200,.3-i*.04,t+3.0+d));
      bell(2093,.18,2.0,t+3.4);bell(2637,.12,1.8,t+3.6);
    },

    titleUnlock:()=>{const c=ctx(),t=c.currentTime;shimmer(.08,.3,t,3500,1500);sweep(250,180,.08,.4,t+.05,.15);bell(220,.2,2.5,t+.35);bellArp([330,415,494],.18,1.5,.2,t+.7);shimmer(.06,.8,t+.9,4000,1200);},

    skillUnlock:()=>{const c=ctx(),t=c.currentTime;tone(110,.1,.4,.8,t);shimmer(.1,.8,t+.2,2500,400);sweep(200,600,.12,.6,t+.3,.2);bellArp([440,554,659,784,988],.24,1.2,.16,t+.8);shimmer(.1,.7,t+.95,5000,1500);bell(1319,.18,1.5,t+1.55);bell(1760,.12,1.2,t+1.72);},

    itemGet:()=>{const c=ctx(),t=c.currentTime;shimmer(.06,.15,t,3000,800);coin(1200,.35,t+.04);coin(1500,.25,t+.12);bell(659,.2,.8,t+.2);bell(784,.14,.7,t+.32);},

    statUp:()=>{const c=ctx(),t=c.currentTime;bellArp([330,415,523,659],.2,.9,.14,t);shimmer(.06,.4,t+.3,4000,1200);},

    shadowExtract:()=>{
      const c=ctx(),t=c.currentTime;
      tone(41,.2,.8,2.0,t);tone(55,.15,1.0,1.8,t+.3);shimmer(.15,1.5,t+.2,600,40);
      tone(82,.12,.6,1.2,t+1.2);shimmer(.1,.8,t+1.4,1500,200);sweep(80,220,.14,1.0,t+1.6,.5);
      bowl(110,.3,3.0,t+2.5);shimmer(.12,.8,t+2.6,3000,500);
      bellArp([220,277,330,415],.2,1.5,.22,t+2.8);bell(659,.15,2.0,t+3.6);
    },

    arise:()=>{
      const c=ctx(),t=c.currentTime;
      bowl(28,.4,6.0,t);bowl(41,.35,5.5,t+.1);bowl(55,.3,5.0,t+.2);shimmer(.25,2.0,t,800,30);
      [.4,.8,1.2,1.6,2.0].forEach((d,i)=>tone(55+i*18,.1+i*.02,.5,2.5-i*.2,t+d));
      shimmer(.15,2.0,t+1.0,2000,100);
      [110,138,165,207,247].forEach((f,i)=>bell(f,.25,4.0,t+2.5+i*.2,[[1,1,1],[2.01,.5,1.3],[3.01,.25,1.6],[4.02,.12,2.0]]));
      shimmer(.2,2.5,t+3.0,6000,1500);
      bellArp([440,554,659,784,988,1245],.2,2.5,.22,t+3.5);
      [0,.1,.2,.32,.46,.62,.8].forEach((d,i)=>coin(1200+i*150,.38-i*.04,t+5.2+d));
      bellArp([1319,1568,1760,2093,2637,3136],.18,3.0,.25,t+5.8);
    },

    chest:()=>{const c=ctx(),t=c.currentTime;shimmer(.08,.2,t,2000,300);thud(80,.18,.2,t+.05);bell(330,.2,1.2,t+.1);[0,.08,.17,.28,.4,.55].forEach((d,i)=>coin(1100+i*120,.45-i*.05,t+.2+d));bellArp([523,659,784],.18,1.0,.18,t+.75);},

    penalty:()=>{const c=ctx(),t=c.currentTime;bowl(55,.45,3.5,t);bowl(41,.35,3.0,t+.12);shimmer(.12,1.0,t+.1,500,40);bowl(55,.3,3.0,t+1.5);tone(41,.15,.2,1.5,t+1.6);shimmer(.08,.8,t+1.7,400,null);},

    urgent:()=>{const c=ctx(),t=c.currentTime;bell(880,.4,.3,t,[[1,1,1],[2.76,.4,1.2]]);shimmer(.08,.12,t,4000,1500);bell(880,.35,.3,t+.28,[[1,1,1],[2.76,.4,1.2]]);shimmer(.07,.12,t+.28,4000,1500);sweep(300,800,.12,.5,t+.55,.1);bell(659,.2,.8,t+.7);},

    sysVoice:()=>{const c=ctx(),t=c.currentTime;shimmer(.12,.5,t,500,40);tone(55,.15,.4,1.2,t);tone(82,.12,.5,1.0,t+.3);bowl(110,.3,2.5,t+.7);shimmer(.08,1.0,t+.9,2500,400);bellArp([220,277,330],.18,1.2,.2,t+1.4);},

    // Extras
    streakCine:()=>{const c=ctx(),t=c.currentTime;shimmer(.08,.5,t,2500,600);tone(165,.12,.08,.6,t+.05);bellArp([330,415,523,659,784],.22,1.0,.14,t+.1);bell(1047,.15,1.2,t+.85);},
  };

  // Resume AudioContext when returning from background (iOS suspends it)
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&AC&&AC.state==='suspended')AC.resume();
  });

  // Public API
  return {
    play:(name)=>{try{if(S[name])S[name]();}catch(e){}},
    mute:()=>{muted=!muted;return muted;},
    isMuted:()=>muted,
  };
})();

// ── SFX HELPERS — call these from interaction points ──
function sfx(name){SFX.play(name);}

// ══════════════════════════════════════════════
// PARTICLES
// ══════════════════════════════════════════════
(()=>{
  const cv=document.getElementById('cvs'),ctx=cv.getContext('2d');
  let W,H,ps=[];
  const rsz=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight;};
  rsz();addEventListener('resize',rsz);
  const cols=['rgba(80,100,140,','rgba(140,155,180,','rgba(191,143,255,','rgba(96,32,208,','rgba(80,100,140,'];
  const np=()=>({x:Math.random()*W,y:Math.random()*H+H*.1,vx:(Math.random()-.5)*.25,vy:-(Math.random()*.45+.05),sz:Math.random()*1.3+.2,a:Math.random()*.35+.06,col:cols[~~(Math.random()*cols.length)],life:Math.random()});
  for(let i=0;i<70;i++)ps.push(np());
  function draw(){
    ctx.clearRect(0,0,W,H);
    ps.forEach((p,i)=>{
      p.x+=p.vx;p.y+=p.vy;p.life+=.0018;
      if(p.life>1||p.y<-8)ps[i]={...np(),y:H+4};
      const a=p.a*Math.sin(p.life*Math.PI);
      ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
      ctx.fillStyle=p.col+a+')';ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

