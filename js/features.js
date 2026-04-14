// ══════════════════════════════════════════════
// v9 — MANHWA FEATURES
// ══════════════════════════════════════════════

// ── SYSTEM VOICE typewriter intro ──
const SYS_VOICE_MSGS=[
  'You have heard the voice of the System.',
  'A new quest has been assigned.',
  'The System has detected your weakness.',
  'You have been chosen by the System.',
  'Do not ignore the voice of the System.',
];
let sysVoiceShown=false;
function showSysVoice(msg){sfx('sysVoice');
  const el=document.getElementById('sys-voice');
  const tv=document.getElementById('sv-text');
  tv.innerHTML='';
  el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  // typewriter
  const text=msg||SYS_VOICE_MSGS[0];
  let i=0;
  const type=()=>{
    if(i<text.length){
      const span=document.createElement('span');
      span.className='sv-char';
      span.textContent=text[i];
      span.style.opacity='1';
      tv.appendChild(span);
      i++;
      setTimeout(type,38);
    }
  };
  setTimeout(type,500);
}
function closeSysVoice(){
  const el=document.getElementById('sys-voice');
  el.style.opacity='0';el.style.transition='opacity .3s';
  setTimeout(()=>{el.classList.remove('show');el.style.opacity='';el.style.transition='';},300);
}

// ── SYSTEM NOTICE POPUP ──
const noticeQ=[];let noticeActive=false;
function showNotice(title,icon,body,color){
  noticeQ.push({title,icon,body,color});
  if(!noticeActive)showNextNotice();
}
function showNextNotice(){
  if(!noticeQ.length){noticeActive=false;return;}
  noticeActive=true;
  const n=noticeQ.shift();
  const el=document.getElementById('sys-notice');
  document.getElementById('sn-title').textContent=n.title||'NOTICE';
  document.getElementById('sn-title').style.color=n.color||'var(--white)';
  document.getElementById('sn-icon').innerHTML=slImg(n.icon||'','sl-icon-lg');
  document.getElementById('sn-body').innerHTML=n.body||'';
  el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  sfx('sysVoice');
}
function closeSysNotice(){
  const el=document.getElementById('sys-notice');
  el.style.opacity='0';el.style.transition='opacity .25s';
  setTimeout(()=>{el.classList.remove('show');el.style.opacity='';el.style.transition='';noticeActive=false;showNextNotice();},250);
}

// ── ITEM TOOLTIP ──
let tooltipTimer=null,activeTooltip=null;
function showTooltip(item,x,y){
  hideTooltip();
  const RAR_COLS={normal:'rgba(140,155,180,.4)',magic:'rgba(0,232,150,.5)',rare:'rgba(80,100,140,.6)',epic:'rgba(191,143,255,.7)',legendary:'rgba(255,200,0,.7)'};
  const rc=RAR_COLS[item.rar]||RAR_COLS.normal;
  const tt=document.createElement('div');
  tt.className='item-tooltip';
  tt.id='active-tooltip';
  tt.innerHTML=`
    <span class="it-tt-icon">${slImg(item.icon)}</span>
    <div class="it-tt-name">${item.n}</div>
    <div class="it-tt-rar" style="color:${rc};border:1px solid ${rc};background:${rc}18;">${item.rar.toUpperCase()}</div>
    <div class="it-tt-desc">${item.d}</div>
    ${item.e?`<div class="it-tt-eff">◆ ${item.d}</div>`:''}
    ${item.coolDays>0?`<div class="it-tt-eff" style="color:rgba(255,200,68,.5)">⏱ ${item.coolDays}d cooldown</div>`:''}
    <div class="it-tt-price">${item.cost}</div>
  `;
  // position
  const vw=window.innerWidth,vh=window.innerHeight;
  let tx=x-130,ty=y-20;
  if(tx<8)tx=8;if(tx+270>vw)tx=vw-278;
  if(ty<8)ty=8;if(ty+240>vh)ty=y-250;
  tt.style.left=tx+'px';tt.style.top=ty+'px';
  document.body.appendChild(tt);
  activeTooltip=tt;
}
function hideTooltip(){
  if(activeTooltip){activeTooltip.remove();activeTooltip=null;}
  if(tooltipTimer){clearTimeout(tooltipTimer);tooltipTimer=null;}
}
// Add touch hold on shop items
document.addEventListener('touchstart',e=>{
  const si=e.target.closest('.sitem');
  if(!si)return;
  const id=si.querySelector('.si-buy')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
  if(!id)return;
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const item=allShop.find(x=>x.id===id);
  if(!item)return;
  tooltipTimer=setTimeout(()=>{
    const r=si.getBoundingClientRect();
    showTooltip(item,r.left+r.width/2,r.top);
    navigator.vibrate&&navigator.vibrate(12);
  },500);
},{passive:true});
document.addEventListener('touchend',hideTooltip,{passive:true});
document.addEventListener('touchmove',hideTooltip,{passive:true});

// ── DAILY QUEST RESET TIMER ──
function updateResetTimer(){
  const el=document.getElementById('reset-timer-val');
  if(!el)return;
  const now=new Date();
  const midnight=new Date(now);
  midnight.setHours(24,0,0,0);
  const diff=midnight-now;
  const h=Math.floor(diff/3600000);
  const m=Math.floor((diff%3600000)/60000);
  const s=Math.floor((diff%60000)/1000);
  const str=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.textContent=str;
  el.classList.toggle('urgent',h===0&&m<30);
}
setInterval(updateResetTimer,1000);
updateResetTimer();

// ── AUTO DAILY RESET AT MIDNIGHT ──
// dayCheck() only ran on page load — if the tab stays open past midnight,
// quests never reset. This interval + visibility listener fixes that.
let _lastDayCheckDate = new Date().toDateString();
function autoMidnightReset(){
  const today = new Date().toDateString();
  if(today !== _lastDayCheckDate){
    _lastDayCheckDate = today;
    dayCheck(); weekCheck(); selectDailyDungeon();
    rotateDailyBanners();
    renderAll();
  }
}
setInterval(autoMidnightReset, 15000); // check every 15s
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') autoMidnightReset();
});
// iOS Safari may restore pages from cache without firing visibilitychange
window.addEventListener('pageshow', (e)=>{
  if(e.persisted) autoMidnightReset();
});
window.addEventListener('focus', autoMidnightReset);

// ── PUSH NOTIFICATION REMINDERS ──
function initNotifications(){
  if(!('Notification' in window))return;
  if(Notification.permission==='default'){
    // Ask on first quest completion so it's not intrusive on load
    return;
  }
}
function requestNotifPermission(){
  if(!('Notification' in window))return;
  if(Notification.permission==='default')Notification.requestPermission();
}
// Schedule a check every minute; fire reminder at 9pm if incomplete dailies
let _lastNotifDate='';
function checkNotifReminder(){
  if(Notification.permission!=='granted')return;
  const now=new Date();
  const h=now.getHours();
  const todayStr=now.toDateString();
  // Only fire once per day, at 9pm (21:00)
  if(h>=21&&_lastNotifDate!==todayStr){
    // Check if rest day
    if(G.fx.restDay===todayStr)return;
    const inc=G.quests.filter(q=>q.t==='daily'&&!q.done&&!q.penaltyTask).length;
    if(inc>0){
      _lastNotifDate=todayStr;
      new Notification('⚔ THE SYSTEM',{
        body:`${inc} daily quest${inc>1?'s':''} remain. Complete them before midnight or face the Penalty Zone.`,
        icon:'/solo_leveling_icon.png',
        tag:'quest-reminder',
        silent:false,
      });
    }
  }
}
setInterval(checkNotifReminder, 60000); // check every minute
// Request permission subtly after app has been used a few seconds
setTimeout(()=>{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();},5000);

// ── FIRST-LAUNCH SYSTEM VOICE ──
function maybeShowFirstLaunch(){
  if(!localStorage.getItem('sl_v9_welcomed')){
    localStorage.setItem('sl_v9_welcomed','1');
    setTimeout(()=>showSysVoice('You have heard the voice of the System.'),1200);
  }
}

// ══════════════════════════════════════════════
// MINIMUM VIABLE WEEK
// ══════════════════════════════════════════════

function getWeekKey(){
  // Returns YYYY-WW string for current ISO week
  const d=new Date();
  const jan4=new Date(d.getFullYear(),0,4);
  const week=Math.ceil(((d-jan4)/86400000+jan4.getDay()+1)/7);
  return d.getFullYear()+'-W'+String(week).padStart(2,'0');
}

// MVW floor definitions
const MVW_FLOOR={
  dailyDays:{label:'Daily Discipline',target:5,unit:'days',col:'#c084ff'},
  gym:       {label:'Gym Sessions',   target:3,unit:'sessions',col:'var(--str)'},
  content:   {label:'Content Actions',target:2,unit:'actions',col:'var(--sen)'},
  japanese:  {label:'Japanese',       target:3,unit:'sessions',col:'var(--int)'},
};

function getMVWEntry(){
  const wk=getWeekKey();
  if(!G.mvwLog[wk])G.mvwLog[wk]={dailyDays:0,gym:0,content:0,japanese:0};
  return G.mvwLog[wk];
}

// Called after completing quests — increments the right MVW counters
function updateMVWOnQuestComplete(q){
  const e=getMVWEntry();
  // Content: daily core content action or content dungeon
  if(q.m==='youtube'||q.id==='y_core')e.content=Math.min(e.content+1,99);
  // Japanese: daily core or japanese dungeon or weekly listening sessions
  if(q.m==='japanese'||q.id==='j_core')e.japanese=Math.min(e.japanese+1,99);
  sv();
}

// Called when all daily quests are done for the day (or midnight reset)
function updateMVWDailyDay(){
  const e=getMVWEntry();
  const today=new Date().toDateString();
  if(G._mvwLastDailyDay!==today){
    const daily=G.quests.filter(q=>q.t==='daily');
    const done=daily.filter(q=>q.done).length,total=daily.length;
    // Count the day if at least 80% of dailies done (11/14)
    if(total>0&&done/total>=0.8){
      e.dailyDays=Math.min(e.dailyDays+1,7);
      G._mvwLastDailyDay=today;
      sv();
    }
  }
}

// Called when a dungeon is completed — gym dungeons count as gym sessions
function updateMVWOnDungeon(dungId){
  const gymIds=['push','pull','legs','fullbody','hiit'];
  if(gymIds.some(id=>dungId&&dungId.includes(id))){
    const e=getMVWEntry();
    e.gym=Math.min(e.gym+1,7);
    sv();
  }
}

function renderMVW(){
  const e=getMVWEntry();
  const keys=Object.keys(MVW_FLOOR);
  const passing=keys.every(k=>e[k]>=MVW_FLOOR[k].target);
  const allDone=keys.every(k=>e[k]>=MVW_FLOOR[k].target);

  const badge=document.getElementById('mvw-badge');
  if(badge){
    if(allDone){badge.textContent='✓ ON TRACK';badge.className='mvw-badge pass';}
    else {
      const remaining=keys.filter(k=>e[k]<MVW_FLOOR[k].target).length;
      badge.textContent=remaining+' REMAINING';badge.className='mvw-badge prog';
    }
  }

  const rows=document.getElementById('mvw-rows');
  if(!rows)return;
  rows.innerHTML=keys.map(k=>{
    const f=MVW_FLOOR[k];
    const val=Math.min(e[k]||0,f.target);
    const pct=Math.round((val/f.target)*100);
    const done=val>=f.target;
    return `<div class="mvw-row">
      <div class="mvw-dot" style="background:${done?f.col:'rgba(255,255,255,.1)'}"></div>
      <span class="mvw-label">${f.label}</span>
      <div class="mvw-track"><div class="mvw-fill" style="width:${pct}%;background:${f.col};opacity:${done?1:.7}"></div></div>
      <span class="mvw-count" style="color:${done?f.col:'rgba(140,155,180,.4)'}">${val}/${f.target}</span>
    </div>`;
  }).join('');
}

// ── END-OF-WEEK RECAP ──
function checkWeekRecap(){
  // Only fire on Monday (day 1) and only once per week
  const now=new Date();
  if(now.getDay()!==1)return; // not Monday
  const wk=getWeekKey();
  const prevWk=getPrevWeekKey();
  if(G.weekRecapShown===prevWk)return; // already shown
  const prev=G.mvwLog[prevWk];
  if(!prev)return;
  G.weekRecapShown=prevWk;sv();
  setTimeout(()=>showWeekRecap(prev),2000);
}

function getPrevWeekKey(){
  const d=new Date();
  d.setDate(d.getDate()-7);
  const jan4=new Date(d.getFullYear(),0,4);
  const week=Math.ceil(((d-jan4)/86400000+jan4.getDay()+1)/7);
  return d.getFullYear()+'-W'+String(week).padStart(2,'0');
}

function showWeekRecap(data){
  const keys=Object.keys(MVW_FLOOR);
  const allPass=keys.every(k=>(data[k]||0)>=MVW_FLOOR[k].target);
  const heading=document.getElementById('wr-heading');
  const sub=document.getElementById('wr-sub');
  heading.textContent=allPass?'WEEK CONQUERED':'WEEK COMPLETE';
  heading.className='wr-heading '+(allPass?'pass':'fail');
  sub.textContent=allPass?'Minimum Viable Week achieved. The System acknowledges your consistency.':'You fell short of your minimum this week. Adjust and rise next week.';
  document.getElementById('wr-items').innerHTML=keys.map(k=>{
    const f=MVW_FLOOR[k];
    const val=data[k]||0;
    const done=val>=f.target;
    return `<div class="wr-item">
      <div class="wr-dot" style="background:${done?f.col:'rgba(255,51,85,.5)'}"></div>
      <span class="wr-iname" style="color:${done?'var(--white)':'rgba(200,180,255,.4)'}">${f.label}</span>
      <span class="wr-ival" style="color:${done?f.col:'var(--red)'}">${val}/${f.target} ${f.unit}</span>
    </div>`;
  }).join('');
  sfx('sysVoice');
  document.getElementById('week-recap').classList.add('show');
}

function closeWeekRecap(){
  const el=document.getElementById('week-recap');
  el.style.opacity='0';el.style.transition='opacity .3s';
  setTimeout(()=>{el.classList.remove('show');el.style.opacity='';el.style.transition='';},300);
}

// ══════════════════════════════════════════════
// iOS HEALTH SYNC
// ══════════════════════════════════════════════

function checkHealthSync(){
  const hs=G.healthSync;
  if(!hs||!hs.date)return;
  const today=new Date().toDateString();
  const hsDate=hs.date?new Date(hs.date).toDateString():'';
  if(hsDate!==today)return; // stale data — don't act on old health data

  // ── Auto-complete steps quest ──
  if((hs.steps||0)>=10000){
    const stepsQ=G.quests.find(q=>q.id==='f13'&&!q.done);
    if(stepsQ){
      stepsQ.done=true;
      G.stats[stepsQ.s]=(G.stats[stepsQ.s]||0)+stepsQ.xp;
      G.qsd[stepsQ.s]=(G.qsd[stepsQ.s]||0)+stepsQ.xp;
      G.gold=(G.gold||0)+(stepsQ.g||0);
      stepsQ.streak=(stepsQ.streak||0)+1;
      showNotice('AUTO-COMPLETED','🏃','<strong>10,000 steps</strong> detected from Apple Health. Quest auto-completed. +'+(stepsQ.xp)+' XP','var(--agi)');
      sv();renderAll();
    }
  }

  // ── Workout detection — suggest dungeon completion ──
  if(hs.workouts&&hs.workouts.length){
    const gymTypes=['Traditional Strength Training','Functional Strength Training','High Intensity Interval Training','Cross Training','Other'];
    const gymSession=hs.workouts.find(w=>gymTypes.includes(w.type));
    if(gymSession&&!sessionStorage.getItem('health_workout_notice_'+today)){
      sessionStorage.setItem('health_workout_notice_'+today,'1');
      const dur=gymSession.duration?Math.round(gymSession.duration)+' min':'';
      const cal=gymSession.calories?gymSession.calories+' kcal':'';
      setTimeout(()=>showNotice('WORKOUT DETECTED','💪',`<strong>${gymSession.type||'Workout'}</strong>${dur?' · '+dur:''}${cal?' · '+cal:''}<br><br>Open Dungeons to log this session and claim your XP.`,'var(--str)'),1500);
    }
  }
}

function renderRecovery(){
  const hs=G.healthSync;
  const card=document.getElementById('h-recovery');
  if(!card)return;
  if(!hs||!hs.date||(hs.sleep?.hours||0)===0){
    card.style.display='none';return;
  }
  const today=new Date().toDateString();
  const hsDate=hs.date?new Date(hs.date).toDateString():'';
  if(hsDate!==today){card.style.display='none';return;}

  card.style.display='flex';

  // Recovery score: 0–100
  const hrs=hs.sleep?.hours||0;
  let score=0;
  if(hrs>=7&&hrs<=9)score=100;
  else if(hrs>=6)score=75;
  else if(hrs>=5)score=50;
  else score=25;
  const hrv=hs.hrv||0;
  if(hrv>40)score=Math.min(100,score+10);
  else if(hrv>0&&hrv<30)score=Math.max(0,score-10);

  const col=score>=80?'var(--green)':score>=60?'var(--gold)':'var(--red)';
  const label=score>=80?'PEAK':score>=60?'MODERATE':'LOW';

  document.getElementById('rec-score-val').textContent=score;
  document.getElementById('rec-score-val').style.color=col;
  document.getElementById('rec-title').textContent=label+' RECOVERY';
  document.getElementById('rec-title').style.color=col;
  card.style.setProperty('--rc-col',col.replace('var(','').replace(')',''));

  const sleepBar=Math.min(100,Math.round((hrs/9)*100));
  const hrvBar=hrv?Math.min(100,Math.round((hrv/60)*100)):0;
  document.getElementById('rec-meta').textContent=hrs.toFixed(1)+'h sleep'+(hrv?' · HRV '+hrv:'');
  document.getElementById('rec-bars').innerHTML=`
    <div class="rec-bar-row">
      <span class="rec-bar-lbl">SLEEP</span>
      <div class="rec-bar-track"><div class="rec-bar-fill" style="width:${sleepBar}%;background:${col}"></div></div>
    </div>
    ${hrv?`<div class="rec-bar-row">
      <span class="rec-bar-lbl">HRV</span>
      <div class="rec-bar-track"><div class="rec-bar-fill" style="width:${hrvBar}%;background:${col}"></div></div>
    </div>`:''}
  `;
}

