// ══════════════════════════════════════════════
// BOSS SYSTEM — image-based bosses, gate cinematics, threshold hits
// ══════════════════════════════════════════════

// ── BOSS SELECTION (seeded by date so it's deterministic) ──
function seedFromDate(str){
  let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}
  return Math.abs(h);
}

function pickDailyBoss(){
  const today=new Date().toDateString();
  if(G.dailyBossId&&G.dailyBossDate===today)return;
  const seed=seedFromDate(today+'daily');
  G.dailyBossId=DAILY_BOSSES[seed%DAILY_BOSSES.length].id;
  G.dailyBossDate=today;
  G.dailyGateShown='';
  G.bossThresholds.daily=[];
  sv();
}

function pickWeeklyBoss(){
  const week=getMondayStr();
  if(G.weeklyBossId&&G.weeklyBossWeek===week)return;
  const seed=seedFromDate(week+'weekly');
  G.weeklyBossId=WEEKLY_BOSSES[seed%WEEKLY_BOSSES.length].id;
  G.weeklyBossWeek=week;
  G.weeklyGateShown='';
  G.bossThresholds.weekly=[];
  sv();
}

function getCurrentDailyBoss(){return DAILY_BOSSES.find(b=>b.id===G.dailyBossId)||DAILY_BOSSES[0];}
function getCurrentWeeklyBoss(){return WEEKLY_BOSSES.find(b=>b.id===G.weeklyBossId)||WEEKLY_BOSSES[0];}

// ── GATE CINEMATIC — full-screen boss reveal ──
function maybeShowGateCine(){
  const today=new Date().toDateString();
  const week=getMondayStr();
  // Daily gate
  if(G.dailyGateShown!==today){
    G.dailyGateShown=today;sv();
    const boss=getCurrentDailyBoss();
    setTimeout(()=>showGateCine(boss,'daily'),800);
    // Weekly gate on Monday
    if(G.weeklyGateShown!==week){
      G.weeklyGateShown=week;sv();
      const wboss=getCurrentWeeklyBoss();
      setTimeout(()=>showGateCine(wboss,'weekly'),4200);
    }
    return;
  }
  // Weekly gate standalone (e.g. reopen on Monday after daily was already shown)
  if(G.weeklyGateShown!==week){
    G.weeklyGateShown=week;sv();
    const wboss=getCurrentWeeklyBoss();
    setTimeout(()=>showGateCine(wboss,'weekly'),800);
  }
}

function showGateCine(boss,type){
  const el=document.getElementById('gate-cine');
  if(!el)return;
  const isWeekly=type==='weekly';
  // Set content
  document.getElementById('gate-rank').textContent=boss.rank+'-RANK';
  document.getElementById('gate-rank').style.color=boss.col;
  document.getElementById('gate-type').textContent=isWeekly?'◆ WEEKLY RAID BOSS ◆':'◆ DAILY DUNGEON BOSS ◆';
  document.getElementById('gate-type').style.color=isWeekly?'rgba(160,80,255,.7)':'rgba(255,60,90,.6)';
  document.getElementById('gate-name').textContent=boss.name;
  document.getElementById('gate-name').style.color=boss.col;
  document.getElementById('gate-title').textContent=boss.title;
  document.getElementById('gate-img').src=boss.img;
  document.getElementById('gate-img').alt=boss.name;
  // Ring colors
  const rings=el.querySelectorAll('.gate-ring');
  rings.forEach((r,i)=>{
    const a=[.5,.3,.15,.06][i]||.1;
    r.style.borderColor=boss.col.replace(')',`,${a})`).replace('rgb','rgba').replace('#','')?
      hexToRgba(boss.col,a):'rgba(255,60,90,'+a+')';
  });
  // Corner colors
  el.querySelectorAll('.cine-corner').forEach(c=>c.style.borderColor=hexToRgba(boss.col,.5));
  // Border glow
  el.style.setProperty('--gate-col',boss.col);
  el.classList.add('show');
  sfx('bossReveal');
  // Auto-close after 3.5s or tap
  el._timeout=setTimeout(()=>closeGateCine(),3500);
}

function closeGateCine(){
  const el=document.getElementById('gate-cine');
  if(!el)return;
  if(el._timeout)clearTimeout(el._timeout);
  el.classList.remove('show');
}

function hexToRgba(hex,a){
  hex=hex.replace('#','');
  if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r=parseInt(hex.substring(0,2),16),g=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── BOSS SECTION RENDER (replaces old renderBossSection) ──
function renderBossSection(){
  const bs=getBossState();
  const db=getCurrentDailyBoss();
  const wb=getCurrentWeeklyBoss();

  // Daily boss card
  const dc=document.getElementById('boss-daily-card');
  if(dc){
    dc.classList.toggle('dead',bs.daily.dead);
    document.getElementById('boss-daily-img').src=db.img;
    document.getElementById('boss-daily-img').alt=db.name;
    document.getElementById('boss-daily-name').textContent=db.name;
    document.getElementById('boss-daily-rank').textContent=db.rank;
    document.getElementById('boss-daily-rank').style.color=db.col;
    const pct=bs.daily.maxHp>0?Math.max(0,(bs.daily.hp/bs.daily.maxHp)*100):0;
    document.getElementById('boss-daily-fill').style.width=pct+'%';
    document.getElementById('boss-daily-fill').style.background=`linear-gradient(90deg,${hexToRgba(db.col,.4)},${db.col})`;
    document.getElementById('boss-daily-val').textContent=bs.daily.hp+'/'+bs.daily.maxHp;
    document.getElementById('boss-daily-dead').style.display=bs.daily.dead?'flex':'none';
  }

  // Weekly boss card
  const wc=document.getElementById('boss-weekly-card');
  if(wc){
    wc.classList.toggle('dead',bs.weekly.dead);
    document.getElementById('boss-weekly-img').src=wb.img;
    document.getElementById('boss-weekly-img').alt=wb.name;
    document.getElementById('boss-weekly-name').textContent=wb.name;
    document.getElementById('boss-weekly-rank').textContent=wb.rank;
    document.getElementById('boss-weekly-rank').style.color=wb.col;
    const pct=bs.weekly.maxHp>0?Math.max(0,(bs.weekly.hp/bs.weekly.maxHp)*100):0;
    document.getElementById('boss-weekly-fill').style.width=pct+'%';
    document.getElementById('boss-weekly-fill').style.background=`linear-gradient(90deg,${hexToRgba(wb.col,.4)},${wb.col})`;
    document.getElementById('boss-weekly-val').textContent=bs.weekly.hp+'/'+bs.weekly.maxHp;
    document.getElementById('boss-weekly-dead').style.display=bs.weekly.dead?'flex':'none';
  }
}

// ── THRESHOLD HIT ANIMATIONS ──
// Called after quest completion. Checks if a 20% threshold was crossed.
function checkBossThreshold(type){
  const bs=getBossState();
  const state=bs[type];
  if(!state||state.maxHp<=0)return;
  if(!G.bossThresholds)G.bossThresholds={daily:[],weekly:[]};
  if(!G.bossThresholds[type])G.bossThresholds[type]=[];

  const pctRemaining=state.hp/state.maxHp;
  // Thresholds at 80%, 60%, 40%, 20%, 0%
  const thresholds=[80,60,40,20,0];
  for(const t of thresholds){
    if(pctRemaining*100<=t && !G.bossThresholds[type].includes(t)){
      G.bossThresholds[type].push(t);
      sv();
      if(t===0){
        // Boss death!
        triggerBossDeath(type);
      } else {
        triggerBossStagger(type,t);
      }
      break; // one animation at a time
    }
  }
}

function triggerBossStagger(type,threshold){
  const cardId=type==='daily'?'boss-daily-card':'boss-weekly-card';
  const card=document.getElementById(cardId);
  if(!card)return;

  // Screen shake
  document.body.classList.add('screen-shake');
  setTimeout(()=>document.body.classList.remove('screen-shake'),500);

  // Boss stagger animation
  card.classList.add('boss-stagger');
  setTimeout(()=>card.classList.remove('boss-stagger'),600);

  // Crack overlay flash
  const crack=document.createElement('div');
  crack.className='boss-crack-flash';
  card.appendChild(crack);
  setTimeout(()=>crack.remove(),800);

  // Damage burst text
  const boss=type==='daily'?getCurrentDailyBoss():getCurrentWeeklyBoss();
  const pctHit=100-threshold;
  const burst=document.createElement('div');
  burst.className='boss-threshold-burst';
  burst.innerHTML=`<span style="color:${boss.col}">${pctHit}%</span> DAMAGE`;
  card.appendChild(burst);
  setTimeout(()=>burst.remove(),1200);

  sfx('bossHit');
}

function triggerBossDeath(type){
  const cardId=type==='daily'?'boss-daily-card':'boss-weekly-card';
  const card=document.getElementById(cardId);
  if(!card)return;

  // Big screen shake
  document.body.classList.add('screen-shake-heavy');
  setTimeout(()=>document.body.classList.remove('screen-shake-heavy'),700);

  // Shatter animation on card
  card.classList.add('boss-shatter');
  setTimeout(()=>card.classList.remove('boss-shatter'),1500);

  // Death flash overlay
  const flash=document.createElement('div');
  flash.className='boss-death-flash';
  document.body.appendChild(flash);
  setTimeout(()=>flash.remove(),600);

  // Victory text
  const boss=type==='daily'?getCurrentDailyBoss():getCurrentWeeklyBoss();
  setTimeout(()=>{
    showNotice(
      type==='daily'?'DUNGEON CLEARED':'RAID BOSS DEFEATED',
      `<img src="${boss.img}" class="boss-notice-img" alt="${boss.name}">`,
      `<strong style="color:${boss.col}">${boss.name}</strong> has been vanquished!`,
      boss.col
    );
  },800);

  sfx('bossDeath');
}

// ── INIT BOSSES ──
function initBosses(){
  pickDailyBoss();
  pickWeeklyBoss();
  // Ensure threshold arrays exist
  if(!G.bossThresholds)G.bossThresholds={daily:[],weekly:[]};
  if(!G.bossThresholds.daily)G.bossThresholds.daily=[];
  if(!G.bossThresholds.weekly)G.bossThresholds.weekly=[];
}
