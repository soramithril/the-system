// ══════════════════════════════════════════════
// EDIT QUEST
// ══════════════════════════════════════════════
function openEditQ(id){
  let q=G.quests.find(x=>x.id===id);
  if(!q&&G.urgentQuest?.id===id)q=G.urgentQuest;
  if(!q)return;
  editQId=id;editQStat=q.s;editQType=q.t;
  document.getElementById('eq-name').value=q.n;
  document.getElementById('eq-xp').value=q.xp;
  document.getElementById('eq-xpv').textContent='+'+q.xp+' XP';
  document.getElementById('eq-gold').value=q.g||0;
  document.getElementById('eq-goldv').textContent='+'+(q.g||0)+' ◈';
  document.getElementById('eq-mp').value=q.mp||0;
  document.getElementById('eq-mpv').textContent='-'+(q.mp||0)+' MP';
  document.getElementById('edit-modal-title').textContent=q.m==='custom'?'Edit Quest':'Edit Quest';
  document.getElementById('eq-delete-btn').style.display=q.m==='custom'?'block':'none';
  // highlight stat
  document.querySelectorAll('.mf-sb').forEach(b=>{const s=b.dataset.s;b.style.background=s===editQStat?'rgba(26,111,255,.18)':'';b.style.borderColor=s===editQStat?'var(--blue2)':'';});
  // highlight type
  document.querySelectorAll('.mf-tb').forEach(b=>{const t=b.dataset.t;b.className='mf-tb'+(t===editQType?' a-'+t:'');});
  openModal('edit-modal');
}
function eqStat(s){
  editQStat=s;
  document.querySelectorAll('.mf-sb').forEach(b=>{b.style.background=b.dataset.s===s?'rgba(26,111,255,.18)':'';b.style.borderColor=b.dataset.s===s?'var(--blue2)':'';});
}
function eqType(t){editQType=t;document.querySelectorAll('.mf-tb').forEach(b=>{b.className='mf-tb'+(b.dataset.t===t?' a-'+t:'');});}
// saveEditQuest defined below (after submitQuest) — single definition handles both add & edit
function deleteEditQuest(){sfx('delete');
  if(G.urgentQuest?.id===editQId){G.urgentQuest=null;}
  else{G.quests=G.quests.filter(x=>x.id!==editQId);}
  sv();closeModal('edit-modal');renderAll();
}
async function quickDeleteQuest(id){
  const q=G.quests.find(x=>x.id===id)||(G.urgentQuest?.id===id?G.urgentQuest:null);
  if(!q)return;
  if(!await themedConfirm('Delete quest: "'+q.n+'"?'))return;
  sfx('delete');
  if(G.urgentQuest?.id===id){G.urgentQuest=null;}
  else{G.quests=G.quests.filter(x=>x.id!==id);}
  sv();renderAll();
}
function openAddQuest(){
  editQId=null;editQStat='STR';editQType='daily';
  document.getElementById('eq-name').value='';
  document.getElementById('eq-xp').value=25;document.getElementById('eq-xpv').textContent='+25 XP';
  document.getElementById('eq-gold').value=10;document.getElementById('eq-goldv').textContent='+10 ◈';
  document.getElementById('eq-mp').value=0;document.getElementById('eq-mpv').textContent='-0 MP';
  document.getElementById('edit-modal-title').textContent='Add Quest';
  document.getElementById('eq-delete-btn').style.display='none';
  document.querySelectorAll('.mf-sb').forEach(b=>{b.style.background='';b.style.borderColor='';});
  document.querySelectorAll('.mf-tb').forEach(b=>{b.className='mf-tb'+(b.dataset.t==='daily'?' a-daily':'');});
  openModal('edit-modal');
  setTimeout(()=>document.getElementById('eq-name').focus(),320);
}
function submitQuest(){sfx('save');
  const nm=document.getElementById('eq-name')?.value.trim();if(!nm)return;
  const xp=parseInt(document.getElementById('eq-xp').value);
  const g=parseInt(document.getElementById('eq-gold').value);
  const mp=parseInt(document.getElementById('eq-mp').value);
  G.quests.push({id:'cq'+Date.now(),m:'custom',t:editQType,n:nm,s:editQStat,xp,g,mp,streak:0,done:false});
  sv();closeModal('edit-modal');renderAll();
}
// route save/add — single definition handles both new quests and edits
function saveEditQuest(){sfx('save');
  if(!editQId){submitQuest();return;}
  const nm=document.getElementById('eq-name').value.trim();if(!nm)return;
  let q=G.quests.find(x=>x.id===editQId);
  if(!q&&G.urgentQuest?.id===editQId)q=G.urgentQuest;
  if(!q)return;
  q.n=nm;q.s=editQStat;q.t=editQType;
  q.xp=parseInt(document.getElementById('eq-xp').value);
  q.g=parseInt(document.getElementById('eq-gold').value);
  q.mp=parseInt(document.getElementById('eq-mp').value);
  sv();closeModal('edit-modal');renderAll();
}

// ══════════════════════════════════════════════
// ADD CUSTOM SHOP ITEM
// ══════════════════════════════════════════════
function saiCd(d){
  saiCdDays=d;
  document.querySelectorAll('.mf-cdopt').forEach(b=>{b.classList.toggle('act',+b.dataset.d===d);});
}
function setSaiCat(cat){
  saiCat=cat;
  renderSaiCatPills();
}
function addShopCategory(){
  const inp=document.getElementById('sai-newcat');
  const nm=inp.value.trim();
  if(!nm)return;
  if(!(G.customCategories||[]).includes(nm)&&!SHOP_CATS_LIST.includes(nm)){
    if(!G.customCategories)G.customCategories=[];
    G.customCategories.push(nm);
    sv();
  }
  inp.value='';
  saiCat=nm;
  renderSaiCatPills();
}
function renderSaiCatPills(){
  const cats=visibleShopCats().filter(c=>c!=='All');
  const container=document.getElementById('sai-cat-pills');
  if(!container)return;
  container.innerHTML=cats.map(c=>{
    const isAct=saiCat===c;
    const isShadow=Object.values(SHADOW_SHOP_UNLOCK).includes(c);
    const isCustom=(G.customCategories||[]).includes(c);
    return `<button onclick="setSaiCat(${esc(JSON.stringify(c))})" style="
      padding:5px 11px;border:1px solid ${isAct?'var(--acc)':'var(--b1)'};
      background:${isAct?'rgba(80,100,140,.15)':'transparent'};
      color:${isAct?'var(--acc)':'rgba(140,155,180,.35)'};
      font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;
      letter-spacing:1px;cursor:pointer;white-space:nowrap;text-transform:uppercase;
      clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px));
      display:inline-flex;align-items:center;gap:4px;
    ">${isShadow?'👻 ':''}${isCustom?'✦ ':''}${esc(c)}${isCustom?`<span class="delete-btn" onclick="event.stopPropagation();removeShopCategory(${esc(JSON.stringify(c))})" style="color:rgba(255,40,70,.5);font-size:10px;margin-left:2px;">✕</span>`:''}
    </button>`;
  }).join('');
}
function removeShopCategory(cat){
  G.customCategories=(G.customCategories||[]).filter(c=>c!==cat);
  // Move items in this category to Treats
  G.customShop.forEach(i=>{if(i.cat===cat)i.cat='Treats';});
  if(saiCat===cat)saiCat='Treats';
  sv();renderSaiCatPills();rShop();
}
function openAddShopItem(){
  saiCat='Treats';saiCdDays=0;
  document.getElementById('sai-name').value='';
  document.getElementById('sai-icon').value='';
  document.getElementById('sai-desc').value='';
  document.getElementById('sai-cost').value=60;
  document.getElementById('sai-costv').textContent='◈ 60';
  document.getElementById('sai-newcat').value='';
  document.querySelectorAll('.mf-cdopt').forEach(b=>b.classList.toggle('act',+b.dataset.d===0));
  renderSaiCatPills();
  openModal('shop-add-modal');
}
function submitShopItem(){
  const nm=document.getElementById('sai-name').value.trim();if(!nm)return;
  const ic=document.getElementById('sai-icon').value.trim()||'🎁';
  const desc=document.getElementById('sai-desc').value.trim();
  const cost=parseInt(document.getElementById('sai-cost').value);
  const cat=saiCat||'Treats';
  G.customShop.push({id:'cs'+Date.now(),cat,icon:ic,n:nm,d:desc,cost,coolDays:saiCdDays,cons:true,rar:'normal'});
  sv();closeModal('shop-add-modal');shopCat=cat;rShop();
}

function removeShopItem(id){
  G.customShop=G.customShop.filter(x=>x.id!==id);
  // Also remove from inventory if owned
  G.inventory=G.inventory.filter(x=>x.id!==id);
  // If the removed item was the only one in its category, keep the category
  sv();rShop();
}

async function deleteShopItem(id){
  const isCustom=G.customShop.some(x=>x.id===id);
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const item=allShop.find(x=>x.id===id);
  if(!item)return;
  // Show themed confirmation
  if(!await themedConfirm('Delete "'+item.n+'" from the shop?'))return;
  sfx('delete');
  if(isCustom){
    G.customShop=G.customShop.filter(x=>x.id!==id);
    G.inventory=G.inventory.filter(x=>x.id!==id);
  } else {
    // For built-in items, mark as hidden
    if(!G.hiddenShopItems)G.hiddenShopItems=[];
    if(!G.hiddenShopItems.includes(id))G.hiddenShopItems.push(id);
  }
  sv();rShop();
}

// ══════════════════════════════════════════════
// CINEMATIC QUEUE
// ══════════════════════════════════════════════
function cineShow(id){
  // Quest-complete cinematics are non-essential and should NEVER queue —
  // chaining them traps the user in sequential overlays they can't dismiss.
  if(id==='cq' && (cineActive || cineQ.includes('cq'))) return;
  cineQ.push(id);
  if(!cineActive)cineNext();
}
function cineNext(){if(!cineQ.length){cineActive=false;return;}cineActive=true;const id=cineQ.shift();const el=document.getElementById(id);if(!el){cineActive=false;cineNext();return;}el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function closeCine(id){
  const el=document.getElementById(id);
  if(!el)return;
  // Drain any queued duplicates of this cinematic so a single tap clears the
  // whole chain (especially for 'cq' which can stack with rapid quest taps).
  if(id==='cq') cineQ=cineQ.filter(x=>x!=='cq');
  el.style.opacity='0';el.style.transition='opacity .3s';
  setTimeout(()=>{
    el.classList.remove('show');
    el.style.opacity='';el.style.transition='';
    cineActive=false;
    cineNext();
    renderAll();
  },300);
}

function showQuestCine(q,xp,gold){sfx('questCine');
  const sc={STR:'var(--str)',AGI:'var(--agi)',STA:'var(--sta)',INT:'var(--int)',SEN:'var(--sen)'};
  document.getElementById('cq-name').textContent=q.n;
  document.getElementById('cq-xp').textContent='+'+xp;
  document.getElementById('cq-gold').textContent='+'+gold;
  const stag=document.getElementById('cq-stag');stag.textContent=q.s;stag.style.color=sc[q.s];stag.style.borderColor=sc[q.s]+'55';stag.style.background=sc[q.s]+'11';
  const se=document.getElementById('cq-streak');if(q.streak>1){se.textContent='🔥 '+q.streak+' DAY STREAK';se.style.display='block';}else se.style.display='none';
  cineShow('cq');
  // Shadow quote — show relevant shadow after tap
  setTimeout(()=>maybeShadowQuote(q.s),2200);
}
function showLvUpCine(lv,boosts,rankData){sfx('levelUp');
  const statCols={STR:'var(--str)',AGI:'var(--agi)',STA:'var(--sta)',INT:'var(--int)',SEN:'var(--sen)'};
  document.getElementById('clu-n').textContent=lv;
  document.getElementById('clu-stats').innerHTML=Object.entries(G.stats).map(([k,v])=>`<div class="lu-stat"><span class="lu-stat-k" style="color:${statCols[k]}">${k}</span><span class="lu-stat-v" style="color:${statCols[k]}">${v}</span><span class="lu-stat-up">+1</span></div>`).join('');
  document.getElementById('clu-pts').textContent='+5 STAT POINTS AUTO-DISTRIBUTED';
  // Shadow Army — show active shadows during level up
  const shadowIcons={igris:'⚔',beru:'🐜',iron:'🗿',tank:'🛡',fangs:'🦷'};
  const gc={E:'#8090b0',D:'#00e896',C:'#4d9fff',B:'#a678ff',A:'#ffd060',S:'#ff8099'};
  const shaRow=document.getElementById('clu-shadows');
  if(G.shadows.length){
    shaRow.innerHTML=G.shadows.map(sh=>{
      const col=gc[sh.grade]||'#a678ff';
      return `<div class="sha-cine-card" style="--sc:${col}">
        <span class="sha-cine-icon">${shadowIcons[sh.id]||'🌑'}</span>
        <div class="sha-cine-name" style="color:${col}">${sh.n}</div>
        <span class="sha-cine-lbl">${sh.grade}-RANK</span>
      </div>`;
    }).join('');
    shaRow.style.display='flex';
  } else {
    shaRow.innerHTML='';shaRow.style.display='none';
  }
  cineShow('clu');
}
function showRankUpCine(r){sfx('rankUp');
  document.getElementById('cru-badge').textContent=r.id==='N'?'★':r.id;
  document.getElementById('cru-name').textContent=r.title;
  document.getElementById('cru-ab').textContent=r.ab;
  document.getElementById('cru-label').textContent='RANK UP — '+r.label.toUpperCase();
  cineShow('cru');
}
function showTitleCine(t){sfx('titleUnlock');document.getElementById('ctlIcon').innerHTML=slImg(t.icon||'👑','sl-icon-xl');document.getElementById('ctlName').textContent=t.n||t.name;document.getElementById('ctlEff').textContent=t.e||t.eff;cineShow('ctl');}
function showSkillCine(sk){sfx('skillUnlock');document.getElementById('cskIcon').innerHTML=slImg(sk.icon||'⚡','sl-icon-xl');document.getElementById('cskName').textContent=sk.n||sk.name;document.getElementById('cskDesc').textContent=sk.d||sk.desc;cineShow('csk');}
function showItemCine(item){sfx('itemGet');document.getElementById('cit-ey').textContent='ITEM ACQUIRED';document.getElementById('cit-ic').innerHTML=slImg(item.icon||'📦','sl-icon-xl');document.getElementById('cit-nm').textContent=item.n||item.name;document.getElementById('cit-ds').textContent=item.d||item.desc||'';cineShow('cit');}
function showStatUpCine(boosts,reason){sfx('statUp');
  const sc={STR:'var(--str)',AGI:'var(--agi)',STA:'var(--sta)',INT:'var(--int)',SEN:'var(--sen)'};
  document.getElementById('csu-chips').innerHTML=Object.entries(boosts).filter(([,v])=>v>0).map(([k,v])=>`<div class="su-chip" style="border-color:${sc[k]}33;background:${sc[k]}08;"><span class="su-k" style="color:${sc[k]}">${k}</span><span class="su-v" style="color:${sc[k]}">${G.stats[k]||0}</span><span class="su-up">+${v}</span></div>`).join('');
  cineShow('csu');
}
function showStreakCine(days,qn){sfx('streak');document.getElementById('cstr-days').textContent=days;document.getElementById('cstr-qn').textContent=qn;cineShow('cstr');}
function showUrgentCine(q){if(!q)return;
  showNotice('URGENT QUEST','⚡','<strong style="color:var(--red)">'+q.n+'</strong><br><br>'+( q.desc||'The System demands immediate action.'),'var(--red)');
  sfx('urgent');document.getElementById('curg-name').textContent=q.n;document.getElementById('curg-desc').textContent=q.desc||'Complete this quest immediately.';cineShow('curg');}
function showArise(){sfx('arise');
  const hasSa=SKILLS.find(s=>s.id==='sa').f(G);
  const hasSr=SKILLS.find(s=>s.id==='sr').f(G);
  const isMonarch=G.shadows.length>=5;
  document.getElementById('chest-arise-bonus').style.display=hasSa?'':'none';
  document.getElementById('chest-gold-bonus').style.display=(hasSa||hasSr)?'':'none';
  const shadowIcons={igris:'⚔',beru:'🐜',iron:'🗿',tank:'🛡',fangs:'🦷'};
  if(G.shadows.length){
    document.querySelector('.chest-sub').textContent=
      G.shadows.map(s=>(shadowIcons[s.id]||'🌑')+' '+s.n).join(' · ');
  } else {
    document.querySelector('.chest-sub').textContent='THE SYSTEM ACKNOWLEDGES YOUR EFFORT';
  }
  const chest=document.getElementById('chest-cine');
  sfx('chest');chest.classList.remove('show');void chest.offsetWidth;chest.classList.add('show');
}
function closeChest(){
  const chest=document.getElementById('chest-cine');
  chest.style.opacity='0';chest.style.transition='opacity .3s';
  setTimeout(()=>{
    chest.classList.remove('show');chest.style.opacity='';chest.style.transition='';
    const el=document.getElementById('arise-ov');
    const isMonarch=G.shadows.length>=SHADOW_DEFS.length;
    // Swap ARISE word and show Monarch subtitle
    const aw=document.getElementById('arise-word');
    const ms=document.getElementById('arise-monarch-sub');
    const sub=document.getElementById('arise-sub-text');
    if(isMonarch){
      aw.className='arise-word monarch';
      aw.textContent='ARISE';
      ms.style.display='block';
      sub.textContent='SHADOW ARMY DEPLOYED';
    } else {
      aw.className='arise-word';
      aw.textContent='ARISE';
      ms.style.display='none';
      sub.textContent='ALL DAILY QUESTS COMPLETE';
    }
    document.getElementById('arise-bonus').textContent=SKILLS.find(s=>s.id==='sa').f(G)?'ARISE BONUS: +100 XP · +50 ◈':'';
    el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),7000);
  },300);
}

// ══════════════════════════════════════════════
// PENALTY ZONE
// ══════════════════════════════════════════════
function renderPenaltyBanner(){
  const banner=document.getElementById('pz-persistent-banner');
  if(!banner)return;
  if(G.penaltyPending){
    banner.classList.add('show');
    // Push body content down so banner doesn't overlap
    document.body.style.paddingTop='62px';
  } else {
    banner.classList.remove('show');
    document.body.style.paddingTop='0';
  }
}
function openPenaltyFromBanner(){
  sfx('penalty');
  document.getElementById('pz-accept').classList.add('show');
}
function showPenaltyZone(){sfx('penalty');
  // Set pending flag and show banner — user clicks banner when ready
  G.penaltyPending=true;sv();renderPenaltyBanner();
}
function acceptPenalty(){
  document.getElementById('pz-accept').classList.remove('show');
  // Clear the persistent banner
  G.penaltyPending=false;sv();renderPenaltyBanner();
  const tasks=['50 push-ups right now','30 squats','10 minutes of running'];
  document.getElementById('pz-tasks').innerHTML=tasks.map((t,i)=>`<div class="pz-task" id="pzt${i}" onclick="togPZTask(${i})"><div class="pz-tck" id="pztck${i}"></div><span class="pz-tn">${t}</span></div>`).join('');
  document.getElementById('pz').classList.add('show');
  let s=3600;if(penTimer)clearInterval(penTimer);
  const el=document.getElementById('pz-timer');
  penTimer=setInterval(()=>{s--;const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;el.textContent=h>0?h+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'):m+':'+String(sc).padStart(2,'0');el.style.color=s<=300?'#ff6680':'var(--red)';if(s<=0){clearInterval(penTimer);penTimer=null;completePenalty();}},1000);
  sfx('penalty');
}
function togPZTask(i){const t=document.getElementById('pzt'+i),c=document.getElementById('pztck'+i);t.classList.toggle('done');c.textContent=t.classList.contains('done')?'✓':'';}
function completePenalty(){if(penTimer){clearInterval(penTimer);penTimer=null;}document.getElementById('pz').classList.remove('show');showItemCine({icon:'🏜',n:'Penalty Zone Escaped',d:'You survived the Poison-fanged Desert'});}

// ══════════════════════════════════════════════
// BOSS COMBAT
// ══════════════════════════════════════════════

// Returns {daily:{hp,maxHp,dead}, weekly:{hp,maxHp,dead}}
function getBossState(){
  // Scale daily boss HP to the quests actually due today (day-scheduled only)
  const dailyQs=G.quests.filter(q=>q.t==='daily'&&!q.penaltyTask&&isScheduledToday(q));
  const weeklyQs=G.quests.filter(q=>q.t==='weekly');
  const dailyMax=Math.max(100,dailyQs.reduce((s,q)=>s+q.xp,0));
  const weeklyMax=Math.max(200,weeklyQs.reduce((s,q)=>s+(q.xp*(q.weekDone!==undefined?2:1)),0));
  const dailyDmg=dailyQs.filter(q=>q.done).reduce((s,q)=>s+q.xp,0);
  const weeklyDmg=weeklyQs.filter(q=>q.done).reduce((s,q)=>s+q.xp,0);
  return {
    daily:{hp:Math.max(0,dailyMax-dailyDmg),maxHp:dailyMax,dead:dailyDmg>=dailyMax},
    weekly:{hp:Math.max(0,weeklyMax-weeklyDmg),maxHp:weeklyMax,dead:weeklyDmg>=weeklyMax},
  };
}
// renderBossSection is now in boss.js

// Floating damage number on boss hit
function showBossDmg(dmg,cx,cy,isWeekly){
  const el=document.createElement('div');
  el.className='boss-dmg-num'+(isWeekly?' weekly':'');
  el.textContent='-'+dmg;
  el.style.left=(cx-24)+'px';
  el.style.top=(cy-32)+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),800);
}

// ══════════════════════════════════════════════
// DAILY DUNGEON SELECTION
// ══════════════════════════════════════════════
function selectDailyDungeon(){
  const today=new Date().toDateString();
  // Ancient Scroll override — force Hidden Dungeon (even if today already has one)
  if(G.shadowScrollPending&&!G.dungeonToday?.[G.activeDungeonId]){
    G.shadowScrollPending=false;
    const allD=G.quests.filter(q=>q.t==='daily');
    const picks=[...allD].sort(()=>Math.random()-0.5).slice(0,4);
    G.hiddenDungeon={questIds:picks.map(q=>q.id),gold:130,names:picks.map(q=>q.n)};
    G.activeDungeonId='hidden';G.activeDungeonDate=today;sv();return;
  }
  if(G.activeDungeonDate===today&&G.activeDungeonId)return; // already set
  const maxStreak=G.quests.reduce((m,q)=>Math.max(m,q.streak||0),0);
  const available=DUNGEONS.filter(d=>d.unlockStreak===0||maxStreak>=d.unlockStreak);
  if(!available.length)return;
  // Weak quests = low streak dailies
  const weakQ=G.quests.filter(q=>q.t==='daily'&&(q.streak||0)<3);
  const hiddenChance=weakQ.length>=4?0.22:(weakQ.length>=2?0.12:0);
  if(Math.random()<hiddenChance&&weakQ.length>=2){
    // Hidden dungeon — built from the user's weakest habits
    const picks=[...weakQ].sort(()=>Math.random()-0.5).slice(0,Math.min(4,weakQ.length));
    const hGold=Math.max(80,picks.reduce((s,q)=>s+Math.floor((q.g||10)*1.8),0));
    G.hiddenDungeon={questIds:picks.map(q=>q.id),gold:hGold,names:picks.map(q=>q.n)};
    G.activeDungeonId='hidden';
  } else {
    // Weighted pick by type: mini=3, standard=4, boss=2
    const tw={mini:3,standard:4,boss:2};
    const pool=available.flatMap(d=>Array(tw[d.type]||3).fill(d.id));
    G.activeDungeonId=pool[Math.floor(Math.random()*pool.length)];
    G.hiddenDungeon=null;
  }
  G.activeDungeonDate=today;
  sv();
}

// ══════════════════════════════════════════════
// DUNGEON RUNS RENDER
// ══════════════════════════════════════════════
function renderDungeons(){
  if(!G.dungeonToday)G.dungeonToday={};
  const list=document.getElementById('h-dung-list');
  if(!list)return;
  const aid=G.activeDungeonId;
  if(!aid){list.innerHTML='<div style="font-family:\'Share Tech Mono\',monospace;font-size:7px;color:rgba(140,155,180,.25);letter-spacing:2px;text-align:center;padding:12px 8px;">NO DUNGEON ASSIGNED</div>';return;}
  // Resolve active dungeon data
  let active,questIds,activeIcon,activeName,activeGold,activeLore,activeType;
  if(aid==='hidden'&&G.hiddenDungeon){
    questIds=G.hiddenDungeon.questIds;
    activeIcon='❓';activeName='Hidden Dungeon';activeGold=G.hiddenDungeon.gold;
    activeLore='A dungeon born from your weakest habits. Face them.';
    activeType='hidden';
  } else {
    active=DUNGEONS.find(d=>d.id===aid);
    if(!active){list.innerHTML='';return;}
    questIds=active.questIds;activeIcon=active.icon;activeName=active.name;
    activeGold=active.reward.gold;activeLore=active.lore;activeType=active.type;
  }
  const cleared=!!G.dungeonToday[aid];
  const done=questIds.filter(qid=>{const q=G.quests.find(x=>x.id===qid);return q&&q.done;}).length;
  const total=questIds.length;
  const pct=total?Math.round((done/total)*100):0;
  // Type badge config
  const typeMeta={
    mini:   {label:'MINI',    color:'rgba(100,200,255,.85)', bg:'rgba(20,60,90,.4)'},
    standard:{label:'STD',   color:'rgba(140,155,180,.85)',  bg:'rgba(40,10,80,.4)'},
    boss:   {label:'BOSS',   color:'rgba(255,60,60,.85)',   bg:'rgba(80,5,5,.4)'},
    hidden: {label:'HIDDEN', color:'rgba(255,208,60,.9)',   bg:'rgba(60,40,0,.4)'},
  };
  const tm=typeMeta[activeType]||typeMeta.standard;
  // Quest list preview
  const questPreview=questIds.map(qid=>{
    const q=G.quests.find(x=>x.id===qid);
    if(!q)return'';
    return`<div class="dung-q-row${q.done?' dung-q-done':''}"><span class="dung-q-dot">${q.done?'◆':'◇'}</span>${q.n}</div>`;
  }).join('');
  // Other dungeons (locked footer)
  const maxStreak=G.quests.reduce((m,q)=>Math.max(m,q.streak||0),0);
  const others=DUNGEONS.filter(d=>d.id!==aid&&(d.unlockStreak===0||maxStreak>=d.unlockStreak));
  const othersHtml=others.length?`<div class="dung-others-row">${others.map(d=>`<span class="dung-other-chip" title="${d.lore}">${slImg(d.icon)} ${d.name}</span>`).join('')}${aid!=='hidden'?'<span class="dung-other-chip dung-other-hidden" title="Appears when you have weak habits">❓ Hidden</span>':''}</div>`:'';
  list.innerHTML=`
    <div class="dung-card${cleared?' cleared':''}${activeType==='boss'?' dung-boss':activeType==='hidden'?' dung-hidden':''}">
      <div class="dung-type-badge" style="background:${tm.bg};color:${tm.color}">${tm.label}</div>
      <div class="dung-top">
        <span class="dung-icon">${activeIcon}</span>
        <div class="dung-info">
          <div class="dung-name">${activeName}</div>
          <div class="dung-lore">${activeLore}</div>
        </div>
        <span class="dung-reward">+${activeGold}◈</span>
      </div>
      <div class="dung-q-list">${questPreview}</div>
      <div class="dung-prog-row" style="margin-top:8px">
        <span class="dung-prog-lbl">RUN</span>
        <div class="dung-prog-track"><div class="dung-prog-fill${done===total?' full':''}" style="width:${pct}%"></div></div>
        <span class="dung-prog-cnt">${done}/${total}</span>
      </div>
      ${cleared?'<div class="dung-cleared-lbl">◆ DUNGEON CLEARED ◆</div>':''}
    </div>
    ${others.length?`<div class="dung-locked-hdr">⊘ LOCKED TODAY — NEXT DUNGEONS TOMORROW</div>${othersHtml}`:''}
  `;
}

// ══════════════════════════════════════════════
// DEBUFF RENDER
// ══════════════════════════════════════════════
function renderDebuff(){
  const bar=document.getElementById('h-debuff-bar');
  if(!bar)return;
  const active=G.debuff?.xp&&G.debuff.expiry===new Date().toDateString();
  bar.style.display=active?'flex':'none';
}

// ══════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════
function openModal(id){sfx('modal');document.getElementById(id).classList.add('open');}
function closeModal(id){sfx('modalClose');document.getElementById(id).classList.remove('open');}
function closeOvIf(e){if(e.target===e.currentTarget)closeModal(e.currentTarget.id);}
function setF(f,btn){sfx('filter');qFilter=f;document.querySelectorAll('.fp').forEach(b=>b.classList.remove('act'));btn.classList.add('act');rQuests();}
async function resetD(){if(await themedConfirm('Reset all daily quest completions?')){G.quests.forEach(q=>{if(q.t==='daily')q.done=false;});sv();renderAll();}}

// ══════════════════════════════════════════════
// ERROR TOAST
// ══════════════════════════════════════════════
function showError(msg,sub){sfx('error');
  const el=document.createElement('div');el.className='notif';
  el.innerHTML=`<div class="notif-msg">${msg}</div>${sub?`<div class="notif-sub">${sub}</div>`:''}`;
  document.getElementById('notifs').appendChild(el);
  setTimeout(()=>{el.style.transition='all .22s';el.style.opacity='0';el.style.transform='translateY(-7px)';setTimeout(()=>el.remove(),230);},3200);
}

function showShopUnlockNotif(shadowName,icon,catName){sfx('shopNotif');
  showError(icon+' '+shadowName+' unlocked a new shop!','◆ '+catName+' now available in Store');
}

// ══════════════════════════════════════════════
// v11 — SHADOW EXTRACTION + QUOTES + MONARCH
// ══════════════════════════════════════════════

// Shadow data — icons, quotes, stat affinity
const SHADOW_DATA={
  igris:{
    icon:'⚔',col:'#4d9fff',
    quotes:[
      'Your blade does not waver. Neither does mine.',
      'Every repetition forges iron.',
      'I serve only the strong. Prove yourself worthy.',
    ],
    stats:['STR','AGI']
  },
  beru:{
    icon:'🐜',col:'#ff4d6d',
    quotes:[
      'My King does not rest. Neither shall I.',
      'Pain is temporary. Strength is permanent.',
      'The weak complain. The strong adapt.',
    ],
    stats:['STA','STR']
  },
  iron:{
    icon:'🗿',col:'#a678ff',
    quotes:[
      'Consistency builds monuments.',
      'I did not become Iron by quitting.',
      'One more rep. Always one more.',
    ],
    stats:['STR']
  },
  tank:{
    icon:'🛡',col:'#5dff8a',
    quotes:[
      'A soldier shows up every day. No exceptions.',
      'Discipline is the highest form of self-respect.',
      'Your habits build your fortress.',
    ],
    stats:['STA','AGI']
  },
  fangs:{
    icon:'🦷',col:'#c084ff',
    quotes:[
      'A sharp mind is the deadliest weapon.',
      'Learn. Adapt. Overcome.',
      'Knowledge compounds like interest.',
    ],
    stats:['INT']
  },
};

// Shadow quote — stat affinity match
let lastQuoteTime=0;
function maybeShadowQuote(stat){
  if(!G.shadows.length)return;
  const now=Date.now();
  if(now-lastQuoteTime<30000)return; // max once per 30s
  // Find shadows that care about this stat
  const matching=G.shadows.filter(sh=>{
    const data=SHADOW_DATA[sh.id];
    return data&&data.stats.includes(stat);
  });
  if(!matching.length)return;
  // 40% chance to show
  if(Math.random()>0.4)return;
  const sh=matching[~~(Math.random()*matching.length)];
  const data=SHADOW_DATA[sh.id];
  const quote=data.quotes[~~(Math.random()*data.quotes.length)];
  lastQuoteTime=now;
  showShadowQuote(sh,data,quote);
}

function showShadowQuote(sh,data,quote){
  // Remove existing quote if any
  const old=document.getElementById('shadow-quote-el');
  if(old)old.remove();
  const el=document.createElement('div');
  el.className='shadow-quote';
  el.id='shadow-quote-el';
  el.style.setProperty('--sq-col',data.col);
  el.innerHTML=`
    <span class="sq-icon">${slImg(data.icon,"sl-icon-lg")}</span>
    <div class="sq-body">
      <div class="sq-name" style="color:${data.col}">${sh.n}</div>
      <div class="sq-quote">"${quote}"</div>
    </div>`;
  document.body.appendChild(el);
  // Auto-remove after 4s with fade
  setTimeout(()=>{
    if(el.parentNode){
      el.style.transition='opacity .4s';el.style.opacity='0';
      setTimeout(()=>el.remove(),400);
    }
  },4000);
}

// Shadow extraction cinematic
function showShadowExtract(sd,shadowIcons,gc){sfx('shadowExtract');
  const data=SHADOW_DATA[sd.id]||{};
  const col=gc[sd.grade]||'#a678ff';
  const icon=shadowIcons[sd.id]||'🌑';
  document.getElementById('se-arise-text').textContent=
    sd.id==='beru'?'ARISE — ANT KING':
    sd.id==='igris'?'ARISE — KNIGHT':
    'ARISE';
  document.getElementById('se-icon').textContent=icon;
  document.getElementById('se-name').textContent=sd.n;
  document.getElementById('se-grade').textContent=sd.grade+'-RANK SHADOW';
  document.getElementById('se-grade').style.color=col;
  document.getElementById('se-type').textContent=sd.type;
  document.getElementById('se-stat').textContent=sd.stats[0]||'';
  // Force chain re-animation by cloning
  const chains=document.querySelector('.se-chains');
  chains.innerHTML=chains.innerHTML;
  const ex=document.getElementById('shadow-extract');
  ex.classList.remove('show');void ex.offsetWidth;ex.classList.add('show');
}
function closeShadowExtract(){
  const el=document.getElementById('shadow-extract');
  el.style.opacity='0';el.style.transition='opacity .3s';
  setTimeout(()=>{el.classList.remove('show');el.style.opacity='';el.style.transition='';renderAll();},300);
}

