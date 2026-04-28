// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let G={
  name:'PLAYER',level:1,xp:0,totalXp:0,gold:100,
  hp:100,maxHp:100,mp:100,maxMp:100,
  stats:{STR:0,AGI:0,STA:0,INT:0,SEN:0},
  quests:[],customShop:[],customCategories:[],inventory:[],
  equippedTitle:null,unlockedTitles:['tw'],
  unlockedSkills:[],shadows:[],shadowArmy:[],
  shadowCrystal:false,   // ×2 XP next dungeon
  shadowSigil:false,     // ×2 spawn chance next dungeon
  shadowSeal:false,      // guarantee Boss spawn next dungeon
  shadowScrollPending:false, // force Hidden dungeon next selection
  shadowPendant:'',      // date string — army ×1.5 XP if matches today
  jobClass:null,
  questsTotal:0,qsd:{STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0},
  fx:{shield:false,skipfit:false,fitb:false,intb:false,str3:0,slp2x:false,
      read7:0,read10:0,sta5:false,str6:false,str12:false,agi8:false,
      mind7:false,anki10:false,water5:false,gld20:false,all5:false},
  shopCooldowns:{},shopOverrides:{},lastDate:'',weekDate:'',dailyLog:[],
  urgentQuest:null,urgentExpiry:null,urgentNextDate:null,lastUrgentId:-1,
  dungeonToday:{},         // {dungeonId: true} if cleared today
  activeDungeonId:null,    // which dungeon is active today
  activeDungeonDate:'',    // date string when active dungeon was selected
  hiddenDungeon:null,      // {questIds, gold, names} for hidden dungeon runs
  debuff:{xp:false,expiry:null},   // xp debuff from missing quests yesterday
  penaltyPending:false,            // persistent penalty zone banner until accepted
  streakUnlocksGiven:[],   // tracks which streak milestone unlocks have been given
  // ── BOSS SYSTEM ──
  dailyBossId:null,dailyBossDate:'',   // current daily boss id & date assigned
  weeklyBossId:null,weeklyBossWeek:'', // current weekly boss id & week assigned
  dailyGateShown:'',  // date string — gate cinematic shown for daily
  weeklyGateShown:'', // week string — gate cinematic shown for weekly
  bossThresholds:{daily:[],weekly:[]}, // which 20% thresholds have fired
  hiddenShopItems:[],      // IDs of built-in shop items that user has hidden
  // ── MVW (Minimum Viable Week) tracking ──
  mvwLog:{},               // {YYYY-WW: {dailyDays:0, gym:0, content:0, japanese:0}}
  weekRecapShown:'',       // week string of last recap shown, to avoid repeat
  // ── iOS Health sync (written by Apple Shortcuts via Firebase) ──
  healthSync:{date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0},
};
let curTab='home',qFilter='all',shopCat='All',editMode=false;
let editQId=null,editQStat='STR',editQType='daily';
let saiCdDays=0,saiCat='Treats',lastCompletedStat='STR';
let penTimer=null;
const cineQ=[];let cineActive=false;

// HTML sanitizer — prevents XSS from user-controlled strings
function esc(s){if(!s)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));}

// Themed confirm dialog — replaces native confirm() for visual consistency
function themedConfirm(msg){
  return new Promise(resolve=>{
    document.getElementById('confirm-msg').textContent=msg;
    openModal('confirm-modal');
    const ok=document.getElementById('confirm-ok');
    const cancel=document.getElementById('confirm-cancel');
    function cleanup(){ok.removeEventListener('click',onOk);cancel.removeEventListener('click',onCancel);}
    function onOk(){cleanup();closeModal('confirm-modal');resolve(true);}
    function onCancel(){cleanup();closeModal('confirm-modal');resolve(false);}
    ok.addEventListener('click',onOk);
    cancel.addEventListener('click',onCancel);
  });
}

let _fbReady=false;
function sv(){localStorage.setItem('sl_v5',JSON.stringify(G));if(_fbReady)fbPush();}
function ld(){
  // Items removed from shop — purge from any saved inventory on load
  const REMOVED_IDS=new Set([
    'bands','gloves','straps','yoga','tracker','roller','bottle','shaker',
    'manga','book','anki','podcast','notebook',
    'scale','pan','recipebook','containers',
    'sleeptrk','skincare','candle','epsom','restday',
    'expstone','sd_manga2','ka_belt',
  ]);
  const d=localStorage.getItem('sl_v5');
  if(d){
    try{
      const p=JSON.parse(d);
      G={...G,...p};
      G.stats={STR:0,AGI:0,STA:0,INT:0,SEN:0,...(p.stats||{})};
      G.qsd={STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0,...(p.qsd||{})};
      G.fx={...G.fx,...(p.fx||{})};
      G.shopCooldowns=p.shopCooldowns||{};
      G.dailyLog=p.dailyLog||[];
      G.urgentNextDate=p.urgentNextDate||null;
      G.lastUrgentId=p.lastUrgentId||-1;
      G.customShop=p.customShop||[];
      G.customCategories=p.customCategories||[];
      G.shadows=p.shadows||[];
      G.shadowArmy=p.shadowArmy||[];
      G.shadowCrystal=p.shadowCrystal||false;
      G.shadowSigil=p.shadowSigil||false;
      G.shadowSeal=p.shadowSeal||false;
      G.shadowScrollPending=p.shadowScrollPending||false;
      G.shadowPendant=p.shadowPendant||'';
      G.dungeonToday=p.dungeonToday||{};
      G.activeDungeonId=p.activeDungeonId||null;
      G.activeDungeonDate=p.activeDungeonDate||'';
      G.hiddenDungeon=p.hiddenDungeon||null;
      G.debuff=p.debuff||{xp:false,expiry:null};
      G.streakUnlocksGiven=p.streakUnlocksGiven||[];
      G.shopOverrides=p.shopOverrides||{};
      G.hiddenShopItems=p.hiddenShopItems||[];
      G.mvwLog=p.mvwLog||{};
      G.weekRecapShown=p.weekRecapShown||'';
      G.healthSync=p.healthSync||{date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0};
      // Scrub any stale reqPct from candy (should only be gold-locked)
      if(G.shopOverrides.candy)delete G.shopOverrides.candy.reqPct;
      // Purge gear/removed items from inventory
      G.inventory=(p.inventory||[]).filter(i=>!REMOVED_IDS.has(i.id));
      // ── QUEST MIGRATION v2 ──
      // Sync saved quests with DEFAULT_QUESTS: update names, remove deleted, add new
      if(!G._qmig2){
        const defMap=new Map(DEFAULT_QUESTS.map(q=>[q.id,q]));
        const savedIds=new Set(G.quests.map(q=>q.id));
        // Update existing quests to match new defaults (name, xp, gold, stat, type)
        G.quests=G.quests.map(q=>{
          const def=defMap.get(q.id);
          if(def)return {...q, n:def.n, s:def.s, xp:def.xp, g:def.g, mp:def.mp, t:def.t};
          return q;
        });
        // Remove quests that no longer exist in defaults (except custom quests)
        const REMOVED_QUEST_IDS=new Set(['h3','h4','gr3','s1','s2','j5','s5','m_shake2','c3','w_recover']);
        G.quests=G.quests.filter(q=>!REMOVED_QUEST_IDS.has(q.id)||q.m==='custom');
        // Add new quests that don't exist in saved data
        DEFAULT_QUESTS.forEach(dq=>{
          if(!savedIds.has(dq.id)&&!REMOVED_QUEST_IDS.has(dq.id)){
            G.quests.push({...dq});
          }
        });
        G._qmig2=true;
        sv();
      }
      // ── QUEST MIGRATION v3 ── Remove stale quests not in DEFAULT_QUESTS
      if(!G._qmig3){
        const validIds=new Set(DEFAULT_QUESTS.map(q=>q.id));
        G.quests=G.quests.filter(q=>validIds.has(q.id)||q.m==='custom');
        const savedIds3=new Set(G.quests.map(q=>q.id));
        DEFAULT_QUESTS.forEach(dq=>{
          if(!savedIds3.has(dq.id))G.quests.push({...dq});
        });
        G._qmig3=true;
        sv();
      }
      // ── QUEST MIGRATION v4 (2026-04-19) ──
      // Meal protocol + day-scheduled training schedule.
      // Adds: m_shake1/m_lunch/m_shake2/m_dinner/m_shake3, w_upper/w_lower/w_pel40/w_pel45/w_recover.
      // Retires: s7 "2 protein shakes" (now covered by 3 shake meals).
      // Also syncs `days` onto any existing quest whose default now has one.
      if(!G._qmig4){
        const REMOVED_V4=new Set(['s7']);
        G.quests=G.quests.filter(q=>!REMOVED_V4.has(q.id)||q.m==='custom');
        const defMap4=new Map(DEFAULT_QUESTS.map(q=>[q.id,q]));
        G.quests.forEach(q=>{
          const def=defMap4.get(q.id);
          if(def&&def.days)q.days=def.days;
        });
        const savedIds4=new Set(G.quests.map(q=>q.id));
        DEFAULT_QUESTS.forEach(dq=>{
          if(!savedIds4.has(dq.id))G.quests.push({...dq});
        });
        G._qmig4=true;
        sv();
      }
      // -- QUEST MIGRATION v5 (2026-04-26) --
      // Remove dinner/morning shake/lunch/evening shake/omega-3/magnesium/collagen.
      // Add Vitamins (s8). Clear stale full_fuel active dungeon ref.
      if(!G._qmig5){
        const REMOVED_V5=new Set(['s3','s4','s6','m_shake1','m_lunch','m_dinner','m_shake3']);
        G.quests=G.quests.filter(q=>!REMOVED_V5.has(q.id)||q.m==='custom');
        const savedIds5=new Set(G.quests.map(q=>q.id));
        DEFAULT_QUESTS.forEach(dq=>{
          if(!savedIds5.has(dq.id))G.quests.push({...dq});
        });
        if(G.activeDungeonId==='full_fuel'){G.activeDungeonId=null;G.activeDungeonDate='';}
        G._qmig5=true;
        sv();
      }
      // -- QUEST MIGRATION v6 (2026-04-27) --
      // Remove water (s5), afternoon shake (m_shake2), meal prep (c3) per player request.
      if(!G._qmig6){
        const REMOVED_V6=new Set(['s5','m_shake2','c3']);
        G.quests=G.quests.filter(q=>!REMOVED_V6.has(q.id)||q.m==='custom');
        G._qmig6=true;
        sv();
      }
      // -- QUEST MIGRATION v7 (2026-04-27) --
      // Training schedule rewrite: Mon/Sat=Upper, Sun/Wed=Lower, Tue=Pel40, Fri=Pel45,
      // Thu=OFF. Retire w_recover.
      if(!G._qmig7){
        G.quests=G.quests.filter(q=>q.id!=='w_recover'||q.m==='custom');
        const DAY_UPDATES={w_upper:[1,6], w_lower:[0,3], w_pel40:[2], w_pel45:[5]};
        G.quests=G.quests.map(q=>DAY_UPDATES[q.id] ? {...q, days:DAY_UPDATES[q.id]} : q);
        G._qmig7=true;
        sv();
      }
      // ── FRESH START RESET (runs once, 2026-04-20) ──
      // Full progress wipe requested by player. Heatmap begins Mon Apr 20 2026.
      // Preserves: player name, gate cinematic flag, firstLaunch flag (cosmetic only).
      if(!G._reset20260420){
        const FRESH_START='Mon Apr 20 2026';
        // Core progress
        G.level=1;G.xp=0;G.totalXp=0;G.gold=100;
        G.hp=100;G.maxHp=100;G.mp=100;G.maxMp=100;
        G.stats={STR:0,AGI:0,STA:0,INT:0,SEN:0};
        G.qsd={STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0};
        G.questsTotal=0;
        // Buffs / debuffs / penalty state
        G.fx={shield:false,skipfit:false,fitb:false,intb:false,str3:0,slp2x:false,
              read7:0,read10:0,sta5:false,str6:false,str12:false,agi8:false,
              mind7:false,anki10:false,water5:false,gld20:false,all5:false};
        G.debuff={xp:false,expiry:null};
        G.penaltyPending=false;
        // Inventory / shadows / titles / skills / job
        G.inventory=[];G.shadows=[];G.shadowArmy=[];
        G.shadowCrystal=false;G.shadowSigil=false;G.shadowSeal=false;
        G.shadowScrollPending=false;G.shadowPendant='';
        G.unlockedTitles=['tw'];G.equippedTitle=null;G.unlockedSkills=[];
        G.jobClass=null;
        // Shop state
        G.shopCooldowns={};G.shopOverrides={};G.hiddenShopItems=[];
        G.customShop=[];G.customCategories=[];
        // Dungeon + boss state
        G.dungeonToday={};G.activeDungeonId=null;G.activeDungeonDate='';G.hiddenDungeon=null;
        G.dailyBossId=null;G.dailyBossDate='';G.dailyGateShown='';
        G.weeklyBossId=null;G.weeklyBossWeek='';G.weeklyGateShown='';
        G.bossThresholds={daily:[],weekly:[]};
        // Urgent + streak unlocks + recap + weekly MVW
        // urgentNextDate set to morning of startDate so nothing spawns during the
        // pre-start day and can't be auto-penalized at midnight rollover.
        G.urgentQuest=null;G.urgentExpiry=null;G.lastUrgentId=-1;G.lastUrgentQuestId='';
        G.urgentNextDate=new Date(FRESH_START+' 08:00:00').toISOString();
        G.streakUnlocksGiven=[];
        G.mvwLog={};G.weekRecapShown='';
        // Heatmap + stat history — both empty so heatmap begins on FRESH_START
        G.dailyLog=[];G.statLog=[];
        // Quests: rebuild from DEFAULT_QUESTS so all done/streak/weekDone flags are clean
        G.quests=DEFAULT_QUESTS.map(q=>({...q,done:false,streak:0,weekDone:0}));
        // Health sync
        G.healthSync={date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0};
        // Date fields:
        //   lastDate = today → dayCheck short-circuits on today's load (no false penalty)
        //   startDate = Mon Apr 20 → dayCheck uses this to skip penalty+logging
        //                            for any "yesterday" date before the fresh start
        //   weekDate = '' → weekCheck resets weekly quests cleanly on next load
        G.lastDate=new Date().toDateString();
        G.weekDate='';
        G.startDate=FRESH_START;
        G._reset20260420=true;
        sv();
      }
      // -- FRESH START RESET (runs once, 2026-04-27) --
      // Third full progress wipe requested by player. Heatmap begins today (Mon Apr 27 2026).
      // Wipes EVERYTHING: progress, dailyLog, statLog, mvwLog, custom shop, shadows,
      // titles (except baseline 'tw'), skills, dungeons, bosses, urgent state.
      if(!G._reset20260427){
        const FRESH_START='Mon Apr 27 2026';
        G.level=1;G.xp=0;G.totalXp=0;G.gold=100;
        G.hp=100;G.maxHp=100;G.mp=100;G.maxMp=100;
        G.stats={STR:0,AGI:0,STA:0,INT:0,SEN:0};
        G.qsd={STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0};
        G.questsTotal=0;
        G.fx={shield:false,skipfit:false,fitb:false,intb:false,str3:0,slp2x:false,
              read7:0,read10:0,sta5:false,str6:false,str12:false,agi8:false,
              mind7:false,anki10:false,water5:false,gld20:false,all5:false};
        G.debuff={xp:false,expiry:null};
        G.penaltyPending=false;
        G.inventory=[];G.shadows=[];G.shadowArmy=[];
        G.shadowCrystal=false;G.shadowSigil=false;G.shadowSeal=false;
        G.shadowScrollPending=false;G.shadowPendant='';
        G.unlockedTitles=['tw'];G.equippedTitle=null;G.unlockedSkills=[];
        G.jobClass=null;
        G.shopCooldowns={};G.shopOverrides={};G.hiddenShopItems=[];
        G.customShop=[];G.customCategories=[];
        G.dungeonToday={};G.activeDungeonId=null;G.activeDungeonDate='';G.hiddenDungeon=null;
        G.dailyBossId=null;G.dailyBossDate='';G.dailyGateShown='';
        G.weeklyBossId=null;G.weeklyBossWeek='';G.weeklyGateShown='';
        G.bossThresholds={daily:[],weekly:[]};
        G.urgentQuest=null;G.urgentExpiry=null;G.lastUrgentId=-1;G.lastUrgentQuestId='';
        G.urgentNextDate=new Date(FRESH_START+' 08:00:00').toISOString();
        G.streakUnlocksGiven=[];
        G.mvwLog={};G.weekRecapShown='';
        // Heatmap + stat history wiped — log/calendar will start fresh from today
        G.dailyLog=[];G.statLog=[];
        G.quests=DEFAULT_QUESTS.map(q=>({...q,done:false,streak:0,weekDone:0}));
        G.healthSync={date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0};
        G.lastDate=new Date().toDateString();
        G.weekDate='';
        G.startDate=FRESH_START;
        G._reset20260427=true;
        sv();
      }
      // -- FRESH START RESET (runs once, 2026-04-26) --
      // Second full progress wipe requested by player. Heatmap begins today.
      if(!G._reset20260426){
        const FRESH_START='Sun Apr 26 2026';
        G.level=1;G.xp=0;G.totalXp=0;G.gold=100;
        G.hp=100;G.maxHp=100;G.mp=100;G.maxMp=100;
        G.stats={STR:0,AGI:0,STA:0,INT:0,SEN:0};
        G.qsd={STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0};
        G.questsTotal=0;
        G.fx={shield:false,skipfit:false,fitb:false,intb:false,str3:0,slp2x:false,
              read7:0,read10:0,sta5:false,str6:false,str12:false,agi8:false,
              mind7:false,anki10:false,water5:false,gld20:false,all5:false};
        G.debuff={xp:false,expiry:null};
        G.penaltyPending=false;
        G.inventory=[];G.shadows=[];G.shadowArmy=[];
        G.shadowCrystal=false;G.shadowSigil=false;G.shadowSeal=false;
        G.shadowScrollPending=false;G.shadowPendant='';
        G.unlockedTitles=['tw'];G.equippedTitle=null;G.unlockedSkills=[];
        G.jobClass=null;
        G.shopCooldowns={};G.shopOverrides={};G.hiddenShopItems=[];
        G.customShop=[];G.customCategories=[];
        G.dungeonToday={};G.activeDungeonId=null;G.activeDungeonDate='';G.hiddenDungeon=null;
        G.dailyBossId=null;G.dailyBossDate='';G.dailyGateShown='';
        G.weeklyBossId=null;G.weeklyBossWeek='';G.weeklyGateShown='';
        G.bossThresholds={daily:[],weekly:[]};
        G.urgentQuest=null;G.urgentExpiry=null;G.lastUrgentId=-1;G.lastUrgentQuestId='';
        G.urgentNextDate=new Date(FRESH_START+' 08:00:00').toISOString();
        G.streakUnlocksGiven=[];
        G.mvwLog={};G.weekRecapShown='';
        G.dailyLog=[];G.statLog=[];
        G.quests=DEFAULT_QUESTS.map(q=>({...q,done:false,streak:0,weekDone:0}));
        G.healthSync={date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0};
        G.lastDate=new Date().toDateString();
        G.weekDate='';
        G.startDate=FRESH_START;
        G._reset20260426=true;
        sv();
      }
    }catch(e){
      console.error('Save data corrupted, starting fresh:',e);
      setTimeout(()=>showError('⚠ SAVE DATA CORRUPTED','Starting fresh. Firebase recovery will be attempted.'),500);
    }
  } else {
    G.quests=DEFAULT_QUESTS.map(q=>({...q}));
    sv();
  }
  dayCheck();weekCheck();
  selectDailyDungeon();
  rotateDailyBanners();
  // Show dungeon notice once per day
  if(G.activeDungeonId && !sessionStorage.getItem('dung_notice_'+new Date().toDateString())){
    sessionStorage.setItem('dung_notice_'+new Date().toDateString(),'1');
    const dung=G.activeDungeonId==='hidden'?{name:'Hidden Dungeon',icon:'❓',lore:'Your weakest habits have formed a hidden dungeon. Face them.'}:DUNGEONS.find(d=>d.id===G.activeDungeonId);
    if(dung)setTimeout(()=>showNotice('DUNGEON AVAILABLE',slImg(dung.icon||'⚔','sl-icon-lg'),'<strong>'+(dung.name||'Dungeon')+'</strong><br><br>'+(dung.lore||'A new challenge awaits.'),'var(--acc)'),1200);
  }
  if(!G.urgentQuest) maybeSpawnUrgent();
}

function dayCheck(){
  const today=new Date().toDateString();
  if(G.lastDate===today)return;
  let wasRestDay=false;
  // Fresh-start guard: when G.startDate is set, any "yesterday" that predates it
  // should NOT trigger penalty logic or heatmap logging. Keeps the dailyLog clean
  // so the calendar heatmap begins exactly on G.startDate.
  const beforeStart=G.startDate&&G.lastDate&&new Date(G.lastDate)<new Date(G.startDate);
  if(G.lastDate&&!beforeStart){
    // Check if yesterday was a declared rest day
    wasRestDay=G.fx.restDay&&G.fx.restDay===G.lastDate;
    if(wasRestDay){
      // Rest day — no penalties, no streak loss, clear the flag
      G.fx.restDay=null;
      G.debuff={xp:false,expiry:null};
    } else {
      // Only count quests that were actually scheduled for yesterday (day-scheduled
      // workouts like Tue-only Upper shouldn't count as "missed" on Mon).
      const inc=G.quests.filter(q=>q.t==='daily'&&!q.done&&!q.penaltyTask&&wasScheduledOn(q,G.lastDate)).length;
      if(inc>0){
        if(G.fx.shield){
          G.fx.shield=false;
          showItemCine({icon:'🛡',n:'Streak Shield Activated',d:'All streaks protected — no penalty applied'});
        } else {
          // ── ENHANCED PENALTY SYSTEM ──
          // Lose HP proportional to missed quests (8 HP each, max 40)
          const hpLoss=Math.min(40, inc*8);
          G.hp=Math.max(1, G.hp-hpLoss);
          // Lose gold (5 gold per missed quest, max 60)
          const goldLoss=Math.min(60, inc*5);
          G.gold=Math.max(0, G.gold-goldLoss);
          // Apply XP debuff for today (−20% XP)
          G.debuff={xp:true, expiry:today};
          // Reset streaks — but only for quests that were actually due yesterday.
          // A Tuesday-only workout should keep its streak when Mon→Tue rolls over.
          G.quests.filter(q=>q.t==='daily'&&wasScheduledOn(q,G.lastDate)).forEach(q=>q.streak=0);
          // Set penalty pending — banner persists until user accepts
          G.penaltyPending=true;
        }
      } else {
        // Clear debuff if all quests were done
        G.debuff={xp:false,expiry:null};
      }
    }
    if(new Date().getDay()===0&&SKILLS.find(s=>s.id==='sl').f(G)){G.stats.INT+=3;showStatUpCine({INT:3},'Sunday Language Absorption bonus');}
  }
  // Log yesterday's daily completion rate — only count quests scheduled yesterday
  // Skipped when yesterday predates the fresh-start date (heatmap starts clean).
  if(G.lastDate&&!beforeStart){
    const dl=G.quests.filter(q=>q.t==='daily'&&!q.penaltyTask&&wasScheduledOn(q,G.lastDate));
    const dDone=dl.filter(q=>q.done).length;
    const dTotal=dl.length;
    if(dTotal>0){
      if(!G.dailyLog)G.dailyLog=[];
      G.dailyLog.push({date:G.lastDate,done:dDone,total:dTotal,rest:wasRestDay||false});
      // Keep last 366 days for annual calendar
      while(G.dailyLog.length>366)G.dailyLog.shift();
    }
    // Snapshot stats for sparkline history
    if(!G.statLog)G.statLog=[];
    G.statLog.push({date:G.lastDate,s:{...G.stats}});
    while(G.statLog.length>366)G.statLog.shift();
  }
  G.quests.filter(q=>!q.penaltyTask).forEach(q=>{if(q.t==='daily')q.done=false;});
  G.quests=G.quests.filter(q=>!q.penaltyTask);
  // Reset dungeon runs for new day
  G.dungeonToday={};
  G.activeDungeonId=null;
  G.activeDungeonDate='';
  G.hiddenDungeon=null;
  // Reset daily boss for new day
  G.dailyBossId=null;G.dailyBossDate='';G.dailyGateShown='';
  if(G.bossThresholds)G.bossThresholds.daily=[];
  // Clear urgent quest if it's from a previous day — apply penalty if failed
  // (Skipped on fresh-start day so a reset doesn't auto-penalize an unfired urgent.)
  if(G.urgentExpiry&&G.urgentExpiry!==today){
    if(G.urgentQuest&&!G.urgentQuest.done&&!beforeStart){
      // Penalty for ignoring urgent quest: lose gold and small XP penalty
      G.gold=Math.max(0,G.gold-25);
      G.xp=Math.max(0,G.xp-20);G.totalXp=Math.max(0,G.totalXp-20);
    }
    G.urgentQuest=null;G.urgentExpiry=null;
  }
  G.lastDate=today;sv();
}

function weekCheck(){
  const monday=getMondayStr();
  if(G.weekDate===monday){checkWeekRecap();return;}
  G.quests.filter(q=>q.t==='weekly').forEach(q=>{q.done=false;if('weekDone' in q)q.weekDone=0;});
  // Reset weekly boss for new week
  G.weeklyBossId=null;G.weeklyBossWeek='';G.weeklyGateShown='';
  if(G.bossThresholds)G.bossThresholds.weekly=[];
  G.weekDate=monday;sv();
  checkWeekRecap();
}

function getMondayStr(){
  const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));d.setHours(0,0,0,0);return d.toDateString();
}

// Stat-specific pressure lines for personalised urgent quests
const URGENT_PRESSURE={
  STR:['Iron doesn\'t forge itself. Complete this now.','Your STR stat is stalling. The System will not wait.','Physical output required. No more delays.'],
  AGI:['Your cardio is falling behind. Move.','Speed is earned through repetition. Do it now.','The gap between you and the next rank is one session.'],
  STA:['Recovery is not optional. Patch your stamina now.','The System detected a discipline gap. Fix it.','Consistency builds the body. You are inconsistent here.'],
  INT:['Your INT stat is bleeding. Fill the gap now.','The mind sharpens only through use. Use it.','You have been neglecting this. The System noticed.'],
  SEN:['Your creative output has dropped. Fix it today.','The algorithm doesn\'t wait for motivation. Post.','Content discipline is the same as physical discipline.'],
};

function maybeSpawnUrgent(){
  const today=new Date().toDateString();
  if(G.urgentQuest&&!G.urgentQuest.done&&G.urgentExpiry===today)return;
  if(G.urgentNextDate&&new Date()<new Date(G.urgentNextDate))return;

  // ── PERSONALISED URGENT: pull from weak or missed daily quests (today's schedule only) ──
  const dailies=G.quests.filter(q=>q.t==='daily'&&!q.penaltyTask&&isScheduledToday(q));

  // Tier 1: incomplete today AND no streak at all (chronically skipped)
  const t1=dailies.filter(q=>!q.done&&(q.streak||0)===0);
  // Tier 2: incomplete today with a weak streak (< 3 days)
  const t2=dailies.filter(q=>!q.done&&(q.streak||0)<3);
  // Tier 3: any quest incomplete today
  const t3=dailies.filter(q=>!q.done);
  // Tier 4: any quest with a weak streak (even if done today)
  const t4=dailies.filter(q=>(q.streak||0)<3);

  const candidates=t1.length?t1:t2.length?t2:t3.length?t3:t4.length?t4:null;

  if(candidates&&candidates.length){
    // Don't repeat the same quest as last time
    const filtered=candidates.filter(q=>q.id!==(G.lastUrgentQuestId||''));
    const base=(filtered.length?filtered:candidates)[~~(Math.random()*(filtered.length||candidates.length))];
    const pressureLines=URGENT_PRESSURE[base.s]||['The System has flagged this quest. Complete it now.'];
    const desc=pressureLines[~~(Math.random()*pressureLines.length)];
    G.urgentQuest={
      ...base,
      id:'urg_'+Date.now(),
      m:'urgent',t:'urgent',done:false,streak:0,
      xp:Math.round(base.xp*1.6),   // +60% XP bonus for urgency
      g:Math.round((base.g||0)*1.6),
      desc,
    };
    G.lastUrgentQuestId=base.id;
  } else {
    // Fallback to static pool when all habits are strong
    const pool=URGENT_POOL;
    const available=pool.filter((_,i)=>i!==(G.lastUrgentId||-1));
    const pick=available[~~(Math.random()*available.length)];
    G.urgentQuest={...pick,id:'urg_'+Date.now(),m:'urgent',t:'urgent',done:false,streak:0};
    G.lastUrgentId=pool.indexOf(pick);
  }

  G.urgentExpiry=today;
  // ── FREQUENCY: 3–5 days between urgents (1–2 per week max) ──
  const daysUntilNext=3+Math.floor(Math.random()*3); // 3, 4, or 5
  const next=new Date();next.setDate(next.getDate()+daysUntilNext);next.setHours(~~(Math.random()*14)+7,~~(Math.random()*60),0,0);
  G.urgentNextDate=next.toISOString();
  sv();
  const delay=G.lastDate?2500:7000;
  setTimeout(()=>{if(G.urgentQuest&&!G.urgentQuest.done){showUrgentCine(G.urgentQuest);renderAll();}},delay);
}

