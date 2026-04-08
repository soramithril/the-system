// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function goTab(t){sfx('tab');
  curTab=t;
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('act'));
  document.querySelectorAll('.bn').forEach(b=>b.classList.remove('act'));
  document.getElementById('s-'+t).classList.add('act');
  document.getElementById('bn-'+t).classList.add('act');
  document.getElementById('fab').classList.toggle('show',t==='quests');
renderAll();
}

function toggleEditMode(){
  editMode=!editMode;
  document.getElementById('app').classList.toggle('hide-edit',!editMode);
  const btn=document.getElementById('edit-toggle-btn');
  btn.classList.toggle('active',editMode);
  btn.textContent=editMode?'✎ EDIT ON':'✎ EDIT';
}

function toggleSec(id){
  const b=document.getElementById(id),a=document.getElementById('arr-'+id);
  const o=b.classList.toggle('open');a.classList.toggle('open',o);
}

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
function curRank(){let r=RANKS[0];for(let i=RANKS.length-1;i>=0;i--){if(G.totalXp>=RANKS[i].xp){r=RANKS[i];break;}}return r;}

function renderAll(){rHdr();rHome();rQuests();rStats();rShop();rProf();rCal();renderBossSection();renderPenaltyBanner();}

function rHdr(){
  // Recalculate maxes BEFORE rendering bars so values are always fresh
  G.maxMp=100+((G.stats.INT||0)*2);
  G.maxHp=100+((G.stats.STA||0)*2);
  const r=curRank();
  const rl=document.getElementById('h-rl');
  rl.textContent=r.id==='N'?'★':r.id;
  rl.className='rank-ltr rk-'+r.id;
  document.getElementById('h-cls').textContent=r.title.toUpperCase();
  document.getElementById('h-lv').textContent='Lv.'+G.level+' · '+G.totalXp.toLocaleString()+' Total XP';
  const need=G.level*100;
  document.getElementById('h-xp-fill').style.width=Math.min(100,(G.xp/need)*100)+'%';
  document.getElementById('h-xp-val').textContent=G.xp+'/'+need;
  document.getElementById('h-hp-fill').style.width=Math.min(100,(G.hp/G.maxHp)*100)+'%';
  document.getElementById('h-hp-val').textContent=G.hp+'/'+G.maxHp;
  document.getElementById('h-mp-fill').style.width=Math.min(100,(G.mp/G.maxMp)*100)+'%';
  document.getElementById('h-mp-val').textContent=G.mp+'/'+G.maxMp;
  document.getElementById('h-level').textContent=G.level;
  document.getElementById('h-gold').textContent=G.gold;
  document.getElementById('h-txp').textContent=G.totalXp.toLocaleString();
  ['STR','AGI','STA','INT','SEN'].forEach(k=>document.getElementById('ss-'+k).textContent=G.stats[k]||0);
}

function rHome(){
  if(curTab!=='home')return;
  // Render new combat features
  renderBossSection();
  renderDungeons();
  renderDebuff();
  renderMVW();
  renderRecovery();
  checkHealthSync();
  const daily=G.quests.filter(q=>q.t==='daily');
  const done=daily.filter(q=>q.done).length,total=daily.length;
  const pct=total?Math.round(done/total*100):0;
  const circ=182;
  document.getElementById('ring-c').style.strokeDashoffset=circ-circ*(pct/100);
  document.getElementById('ring-n').textContent=done;
  document.getElementById('ring-of').textContent='/ '+total;
  document.getElementById('ring-sub').textContent=done+' of '+total+' complete';
  document.getElementById('ring-pct').textContent=pct+'% — '+(pct===100?'◈ ARISE!':pct>=50?'HALFWAY':'KEEP GOING');
  const ub=document.getElementById('urg-banner');
  if(G.urgentQuest&&!G.urgentQuest.done){ub.classList.add('on');document.getElementById('urg-banner-name').textContent=G.urgentQuest.n;}
  else ub.classList.remove('on');
  // system notice panel
  const np=document.getElementById('h-notice'),nb=document.getElementById('h-notice-body');
  const inc=daily.filter(q=>!q.done).length;
  if(pct===100&&total>0){
    np.style.display='block';
    nb.innerHTML=`<strong>All daily quests complete.</strong> The System acknowledges your discipline. Reward distributed. Rest and prepare for tomorrow.`;
  } else if(pct===0&&total>0){
    np.style.display='block';
    nb.innerHTML=`<strong>Daily quests await, Player.</strong> Complete all ${total} assigned missions before midnight or face the <strong>Penalty Zone</strong>.`;
  } else if(inc<=2&&inc>0){
    np.style.display='block';
    nb.innerHTML=`<strong>${inc} quest${inc>1?'s':''} remaining.</strong> Do not relent now. The System is watching.`;
  } else {
    np.style.display='none';
  }
  const urgents=(G.urgentQuest&&!G.urgentQuest.done)?[G.urgentQuest]:[];
  // Show ALL daily quests — incomplete first, then done — plus any active urgent
  const allDailies=G.quests.filter(q=>q.t==='daily');
  const prev=[...urgents,...allDailies.filter(q=>!q.done),...allDailies.filter(q=>q.done)];
  document.getElementById('h-qprev').innerHTML=prev.length?prev.map(q=>qCardHTML(q)).join(''):'<div style="text-align:center;padding:30px 20px;color:rgba(140,155,180,.25);font-family:\'Share Tech Mono\',monospace;font-size:9px;letter-spacing:3px;">NO DAILY QUESTS YET — TAP + TO CREATE ONE</div>';

  // ── ACTIVE TITLE STRIP ──
  const strip=document.getElementById('h-title-strip');
  if(G.equippedTitle){
    const t=TITLES.find(x=>x.id===G.equippedTitle);
    if(t){
      strip.style.display='flex';
      document.getElementById('h-title-name').innerHTML=slImg(t.icon,'sl-icon-sm')+' '+t.n;
      document.getElementById('h-title-eff').textContent=t.e;
    }
  } else strip.style.display='none';

  // ── SKILLS WIDGET ──
  const unlockedSkills=SKILLS.filter(sk=>sk.f(G));
  document.getElementById('h-skill-count').textContent=unlockedSkills.length+' / '+SKILLS.length+' unlocked';
  const sl=document.getElementById('h-skills-list');
  if(!unlockedSkills.length){
    sl.innerHTML=`<div class="hs-locked">No skills unlocked yet — reach Level 3 for first skill</div>`;
  } else {
    sl.innerHTML=unlockedSkills.map(sk=>`<div class="hs-item">
      <span class="hs-icon">${slImg(sk.icon)}</span>
      <span class="hs-name">${sk.n}</span>
      <span class="hs-desc">${sk.d.split('.')[0]}</span>
    </div>`).join('');
  }

  // ── SHADOW ARMY WIDGET ──
  const shadowIcons={igris:'⚔',beru:'🐜',iron:'🗿',tank:'🛡',fangs:'🦷'};
  const gc={E:'#8090b0',D:'#00e896',C:'#4d9fff',B:'#a678ff',A:'#ffd060',S:'#ff8099'};
  document.getElementById('h-shadow-count').textContent=G.shadows.length+' extracted';
  const sb=document.getElementById('h-shadow-body');
  if(!G.shadows.length){
    const hasExtract=SKILLS.find(s=>s.id==='se').f(G);
    sb.innerHTML=`<div class="hsw-empty">${hasExtract?'Shadow Extraction active.<br>Clear dungeons to recruit soldiers. Complete milestones for named shadows.':'Clear your first dungeon — a shadow soldier may emerge.<br>Named shadows (Igris, Beru…) unlock at <strong>B-Rank</strong>.'}</div>`;
  } else {
    sb.innerHTML=`<div class="hsw-army">${G.shadows.map(sh=>{
      const col=gc[sh.grade]||'#a678ff';
      return `<div class="hsw-card" style="--sc:${col}">
        <span class="hsw-grade" style="color:${col}">${sh.grade}</span>
        <span class="hsw-icon">${shadowIcons[sh.id]||'🌑'}</span>
        <div class="hsw-name">${sh.n}</div>
        <div class="hsw-type">${sh.type}</div>
        <div class="hsw-stat">${sh.stats[0]||''}</div>
      </div>`;
    }).join('')}</div>`;
  }
  // ── SHADOW SOLDIERS (dungeon-spawned army) ──
  const army=G.shadowArmy||[];
  const soldierDiv=document.getElementById('h-shadow-soldiers');
  if(soldierDiv){
    if(!army.length){
      soldierDiv.innerHTML='';soldierDiv.style.display='none';
    } else {
      const stc={BASIC:'#00e896',ELITE:'#a678ff',BOSS:'#ffd060',SPECIAL:'#ff8099'};
      document.getElementById('h-soldier-count').textContent=army.length+' soldier'+(army.length!==1?'s':'');
      soldierDiv.style.display='block';
      document.getElementById('h-soldier-list').innerHTML=army.map(sh=>{
        const col=stc[sh.type]||'#a678ff';
        const xpNext=SHADOW_XP_THRESHOLDS[Math.min(5,sh.level+1)]||SHADOW_XP_THRESHOLDS[5];
        const xpPrev=SHADOW_XP_THRESHOLDS[sh.level]||0;
        const pct=sh.level>=5?100:Math.round(((sh.xp-xpPrev)/(xpNext-xpPrev))*100);
        const equipIcons=(sh.equip||[]).map(e=>e==='shackle'?'⛓':e==='core'?'💜':'').join('');
        return `<div class="sol-card" style="--sc:${col}">
          <span class="sol-icon">${slChiImg(sh.id, sh.icon)}</span>
          <div class="sol-body">
            <div class="sol-name">${sh.n} ${equipIcons}</div>
            <div class="sol-type" style="color:${col}">${sh.type} · LV ${sh.level}</div>
            <div class="sol-xp-track"><div class="sol-xp-fill" style="width:${pct}%;background:${col}"></div></div>
          </div>
        </div>`;
      }).join('');
    }
  }
}

function rQuests(){
  if(curTab!=='quests')return;
  const daily=G.quests.filter(q=>q.t==='daily');
  const done=daily.filter(q=>q.done).length,total=daily.length;
  document.getElementById('dp-fill').style.width=total?(done/total*100)+'%':'0%';
  document.getElementById('dp-cnt').textContent=done+'/'+total;
  document.getElementById('q-sub').textContent=done+' OF '+total+' DAILY QUESTS COMPLETE';
  // penalty header state — red if zero done and there are dailies
  const sh=document.getElementById('quest-sh');
  const pb=document.getElementById('penalty-banner');
  if(total>0&&done===0){
    sh.classList.add('penalty-mode');pb.classList.add('show');
  } else {
    sh.classList.remove('penalty-mode');pb.classList.remove('show');
  }
  let html='';
  if(G.urgentQuest&&(qFilter==='all'||qFilter==='urgent')){
    html+=`<div class="msec" style="--mc:var(--red);background:rgba(255,40,70,.04);">
      <div class="msec-icon" style="font-size:18px;">⚡</div>
      <div class="msec-body"><div class="msec-name" style="color:var(--red)">Urgent Quest</div><div class="msec-goal">MUST COMPLETE TODAY</div></div>
    </div><div class="qsec">${qCardHTML(G.urgentQuest)}</div>`;
  }
  MISSIONS.forEach(m=>{
    let qs=G.quests.filter(q=>q.m===m.id);
    if(qFilter!=='all')qs=qs.filter(q=>q.t===qFilter);
    if(!qs.length)return;
    const md=qs.filter(q=>q.done).length;
    html+=`<div class="msec" style="--mc:${m.mc};">
      <div class="msec-icon" style="font-size:18px;">${slImg(m.icon)}</div>
      <div class="msec-body"><div class="msec-name" style="color:${m.col}">${m.name}</div><div class="msec-goal">${m.goal}</div></div>
      <span class="msec-prog">${md}/${qs.length}</span>
    </div>
    <div class="qsec">${qs.sort((a,b)=>a.done-b.done).map(q=>qCardHTML(q)).join('')}</div>`;
  });
  const cq=G.quests.filter(q=>q.m==='custom'&&(qFilter==='all'||q.t===qFilter));
  if(cq.length){
    html+=`<div class="msec" style="--mc:var(--acc);">
      <div class="msec-icon" style="font-size:18px;">⬡</div>
      <div class="msec-body"><div class="msec-name" style="color:var(--acc)">Custom</div><div class="msec-goal">Your own quests</div></div>
    </div><div class="qsec">${cq.sort((a,b)=>a.done-b.done).map(q=>qCardHTML(q)).join('')}</div>`;
  }
  document.getElementById('q-list').innerHTML=html||'<div style="text-align:center;padding:40px;color:rgba(140,155,180,.2);font-family:\'Share Tech Mono\',monospace;font-size:8px;letter-spacing:3px;">NO QUESTS FOUND</div>';
}

function qCardHTML(q){
  const sc={STR:'var(--str)',AGI:'var(--agi)',STA:'var(--sta)',INT:'var(--int)',SEN:'var(--sen)'};
  const mpStr=q.mp>0?`<span class="qmp">-${q.mp}MP</span>`:q.mp<0?`<span class="qmp" style="color:var(--sta)">+${Math.abs(q.mp)}MP</span>`:'';
  return `<div class="qcard${q.done?' done':''}" style="--qc:${sc[q.s]||'var(--acc)'}" onclick="togQ('${q.id}',event)" oncontextmenu="openEditQ('${q.id}');return false;">
    <div class="qchk" id="qchk_${q.id}"></div>
    <div class="qbody">
      <div class="qn">${esc(q.n)}</div>
      <div class="qmeta">
        <span class="qtag t${q.s}">${q.s}</span>
        <span class="qtype-tag qt-${q.t}">${q.t.toUpperCase()}</span>
        <span class="qxp">+${q.xp} XP</span>
        ${q.g>0?`<span class="qgd">+${q.g}◈</span>`:''}
        ${mpStr}
        ${q.streak>1?`<span class="qstr">◆${q.streak}d</span>`:''}
      </div>
    </div>
    <span class="qc-orn">◆</span>
    <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">
      <div class="edit-btn" onclick="event.stopPropagation();openEditQ('${q.id}')" style="padding:3px 5px;cursor:pointer;opacity:.5;font-size:12px;color:var(--acc);text-align:center;" title="Edit">✎</div>
      <div class="delete-btn" onclick="event.stopPropagation();quickDeleteQuest('${q.id}')" style="padding:2px 5px;cursor:pointer;opacity:.35;font-size:10px;color:var(--red);text-align:center;" title="Delete">✕</div>
    </div>
  </div>`;
}

function rStats(){
  if(curTab!=='stats')return;
  // job class
  const jc=getJobClass();
  const jcard=document.getElementById('job-card');
  if(jc){
    jcard.classList.add('show');
    document.getElementById('jc-name').innerHTML=slImg(jc.icon)+' '+jc.name;
    document.getElementById('jc-eff').textContent=jc.eff;
  } else jcard.classList.remove('show');
  const MAX=Math.max(100,...Object.values(G.stats));
  document.getElementById('stat-bars').innerHTML=Object.entries(STAT_INFO).map(([k,v])=>{
    const val=G.stats[k]||0;
    // Build sparkline from statLog
    let sparkHtml='';
    const log=G.statLog||[];
    if(log.length>=2){
      const vals=log.map(e=>(e.s&&e.s[k])||0);
      vals.push(val); // add current
      const mn=Math.min(...vals),mx=Math.max(...vals,1);
      const svgW=200,svgH=24,pad=2;
      const pts=vals.map((v2,i)=>{
        const x=pad+(i/(vals.length-1))*(svgW-pad*2);
        const y=svgH-pad-((v2-mn)/(mx-mn||1))*(svgH-pad*2);
        return `${x},${y}`;
      });
      sparkHtml=`<svg class="stat-spark-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
        <polyline points="${pts.join(' ')}" fill="none" stroke="${v.col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
        <circle cx="${pts[pts.length-1].split(',')[0]}" cy="${pts[pts.length-1].split(',')[1]}" r="2" fill="${v.col}" opacity=".8"/>
      </svg>`;
    }
    return `<div class="sbar" style="--sc:${v.col}">
      <div class="sbar-top"><div class="sbar-left"><div class="sbar-dot" style="background:${v.col};box-shadow:0 0 6px ${v.col};"></div><span class="sbar-name" style="color:${v.col};">${v.name}</span></div><span class="sbar-val" id="sbv-${k}" style="color:${v.col};">${val}</span></div>
      <div class="sbar-track"><div class="sbar-fill" style="width:${Math.max(2,(val/MAX)*100)}%;background:${v.fill};box-shadow:2px 0 8px ${v.col};"></div></div>
      ${sparkHtml}
      <div class="sbar-desc">${v.desc}</div>
    </div>`;
  }).join('');
}

function getJobClass(){
  if(G.jobClass)return JOB_CLASSES.find(j=>j.id===G.jobClass)||null;
  // check all balanced
  const vals=Object.values(G.stats);
  if(vals.every(v=>v>=JOB_CLASSES.find(j=>j.id==='true').threshold)){return JOB_CLASSES.find(j=>j.id==='true');}
  // check dominant
  const entries=Object.entries(G.stats).sort((a,b)=>b[1]-a[1]);
  const top=entries[0];
  if(top[1]>=20){
    const jc=JOB_CLASSES.find(j=>j.req===top[0]);
    if(jc){
      if(!G.jobClass){G.jobClass=jc.id;sv();showTitleCine({icon:jc.icon,n:'Job Class Unlocked: '+jc.name,e:jc.eff});}
      return jc;
    }
  }
  return null;
}

function rShop(){
  if(curTab!=='shop')return;
  document.getElementById('shop-gd').textContent=G.gold;
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const cats=visibleShopCats();
  const shadowCats=new Set(Object.values(SHADOW_SHOP_UNLOCK));
  document.getElementById('shop-cats').innerHTML=cats.map(c=>{
    const isShadow=shadowCats.has(c);
    const isAct=shopCat===c;
    return `<button class="scat${isAct?' act':''}${isShadow?' shadow-unlocked':''}" onclick="setShopCat('${c}')">${isShadow?'🌑 ':''}${c}</button>`;
  }).join('');
  if(!cats.includes(shopCat))shopCat='All';
  const hiddenIds=new Set(G.hiddenShopItems||[]);
  const items=(shopCat==='All'
    ? allShop.filter(i=>cats.includes(i.cat)||['Treats','System'].includes(i.cat))
    : allShop.filter(i=>i.cat===shopCat)).filter(i=>!hiddenIds.has(i.id));
  document.getElementById('shop-grid').innerHTML=items.map(baseItem=>{
    // Merge any saved overrides (name, icon, desc, cost, coolDays)
    const item={...baseItem,...(G.shopOverrides?.[baseItem.id]||{})};
    // Candy is always gold-only — strip any reqPct that snuck in
    if(item.id==='candy')delete item.reqPct;
    const isCustom=G.customShop.some(x=>x.id===item.id);
    const owned=!item.cons&&G.inventory.some(i=>i.id===item.id);
    const cdInfo=item.coolDays>0?checkCooldown(item.id,item.coolDays):null;
    const onCd=!!cdInfo;
    const reqLocked=item.reqPct?weeklyDailyPct()<item.reqPct:false;
    const cant=!owned&&!onCd&&!reqLocked&&G.gold<item.cost;
    const rarClass='r-'+item.rar;
    const cdText=onCd?`${cdInfo}d left`:'';
    return `<div class="sitem${item.cons?'':' perm'} ${rarClass}${cant||reqLocked?' cant':''}${onCd?' on-cooldown':''}" style="--ic:${RAR_COL[item.rar]||'var(--b2)'};position:relative;">
      <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;z-index:2;">
        <button class="edit-btn" onclick="event.stopPropagation();openShopEdit('${item.id}')" style="background:rgba(80,100,140,.1);border:1px solid rgba(80,100,140,.2);color:var(--acc);font-size:9px;cursor:pointer;padding:2px 5px;line-height:1;font-family:'Barlow Condensed',sans-serif;font-weight:700;">✎</button>
        <button class="delete-btn" onclick="event.stopPropagation();deleteShopItem('${item.id}')" style="background:rgba(255,40,70,.06);border:1px solid rgba(255,40,70,.15);color:var(--red);font-size:9px;cursor:pointer;padding:2px 5px;line-height:1;font-family:'Barlow Condensed',sans-serif;font-weight:700;">✕</button>
      </div>
      <div class="si-icon-box" style="background:${RAR_COL[item.rar]||'var(--b1)'}18;">${slImg(item.icon)}</div>
      <div class="si-body">
        <div class="si-name">${esc(item.n)}${isCustom?'<span style="font-family:\'Share Tech Mono\',monospace;font-size:7px;color:rgba(140,155,180,.35);margin-left:5px;letter-spacing:1px;">CUSTOM</span>':''}</div>
        <div class="si-desc">${esc(item.d)}</div>
        ${reqLocked?`<div style="font-family:'Share Tech Mono',monospace;font-size:7px;color:var(--red);letter-spacing:1px;margin-top:2px;">🔒 REQUIRES ${item.reqPct}% WEEKLY COMPLETION (${weeklyDailyPct()}% CURRENT)</div>`:''}
        <div class="si-meta">
          ${owned?`<span class="si-owned">OWNED</span>`:onCd?`<span class="si-cd">⏱ ${cdText}</span>`:`<span class="si-price">${item.cost}</span>`}
          ${item.coolDays>0?`<span class="si-cd">·${item.coolDays}d CD</span>`:''}
          <span class="si-rarity" style="color:${RAR_COL[item.rar]};border:1px solid ${RAR_COL[item.rar]};background:${RAR_COL[item.rar]}11;">${item.rar.toUpperCase()}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;">
        ${owned?'':`<button class="si-buy ${item.cons?'cons':'prm'}${onCd?' cd-btn':''}" onclick="event.stopPropagation();buyItem('${item.id}')" ${onCd||reqLocked?'disabled':''}>${reqLocked?'🔒':onCd?'⏱':cant?'◈'+item.cost:'BUY'}</button>`}
      </div>
    </div>`;
  }).join('')||`<div style="text-align:center;padding:40px;color:rgba(140,155,180,.2);font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:2px;">NO ITEMS</div>`;
}

function weeklyDailyPct(){
  if(!G.dailyLog||G.dailyLog.length===0)return 0;
  // Look at last 7 logged days
  const recent=G.dailyLog.slice(-7);
  const totalDone=recent.reduce((s,d)=>s+d.done,0);
  const totalPossible=recent.reduce((s,d)=>s+d.total,0);
  return totalPossible>0?Math.round(totalDone/totalPossible*100):0;
}

function checkCooldown(id,days){
  const last=G.shopCooldowns[id];if(!last)return null;
  const lastD=new Date(last),now=new Date();
  const diff=Math.ceil((lastD-(now-86400000*days))/86400000);
  return diff>0?diff:null;
}

function rProf(){
  if(curTab!=='prof')return;
  const r=curRank();
  const gc={E:'#8090b0',D:'#00e896',C:'#4d9fff',B:'#a678ff',A:'#ffd060',S:'#ff8099',N:'#fff8d0'};

  // ── RANK SCROLL ──
  document.getElementById('rk-scroll').innerHTML=RANKS.map(rk=>{
    const isCur=rk.id===r.id,isDone=G.totalXp>=rk.xp&&!isCur,isLk=G.totalXp<rk.xp;
    const pct=isCur?Math.round(Math.min(100,(G.totalXp/(RANKS[RANKS.indexOf(rk)+1]?.xp||rk.xp+1))*100)):isDone?100:0;
    return `<div class="rk-card${isCur?' cur':isDone?' done':' locked'}">
      <span class="rk-card-letter" style="color:${rk.col}">${rk.id==='N'?'★':rk.id}</span>
      <span class="rk-card-name">${rk.label.toUpperCase()}</span>
      <span class="rk-card-xp">${isCur?'NOW':isDone?'✓':rk.xp.toLocaleString()+'xp'}</span>
    </div>`;
  }).join('');
  document.getElementById('rk-ability').innerHTML=`<div class="rk-ability-lbl">◆ Current Rank Ability</div><div class="rk-ability-txt">${r.ab}</div>`;

  // ── TITLES GRID ──
  document.getElementById('tl-grid').innerHTML=TITLES.map(t=>{
    const unl=G.unlockedTitles?.includes(t.id),eqd=G.equippedTitle===t.id;
    return `<div class="tl-card${eqd?' eqd':unl?' unl':''}">
      <span class="tl-card-icon">${slImg(t.icon)}</span>
      <div class="tl-card-name">${t.n}</div>
      <div class="tl-card-eff">${t.e}</div>
      ${!unl&&t.r?`<div class="tl-card-req">REQ: ${t.r}</div>`:''}
      ${unl?`<button class="tl-card-eq${eqd?' on':''}" onclick="eqTitle('${t.id}')">${eqd?'✓ ACTIVE':'EQUIP'}</button>`:''}
    </div>`;
  }).join('');

  // ── SKILLS FULL LIST ──
  document.getElementById('sk-full-list').innerHTML=SKILLS.map(sk=>{
    const unl=sk.f(G);
    return `<div class="sk-full${unl?' unl':' locked'}">
      <span class="sk-full-icon">${slImg(sk.icon)}</span>
      <div class="sk-full-body">
        <div class="sk-full-name">${sk.n}</div>
        <div class="sk-full-desc">${sk.d}</div>
        ${!unl?`<div class="sk-full-req">REQ: ${sk.r}</div>`:''}
      </div>
      <span class="sk-full-badge">${unl?'ACTIVE':'LOCKED'}</span>
    </div>`;
  }).join('');

  // ── SHADOW ARMY ──
  const shadowIcons={igris:'⚔',beru:'🐜',iron:'🗿',tank:'🛡',fangs:'🦷'};
  const army=G.shadowArmy||[];
  const totalShadows=G.shadows.length+army.length;
  if(!totalShadows){
    document.getElementById('sha-grid').innerHTML=`<div class="sha-locked">Shadow Army Empty<br><br>Unlock <strong>Shadow Extraction</strong> at B-Rank<br>Then clear dungeons to recruit soldiers<br><br>◆ &nbsp; ◆ &nbsp; ◆</div>`;
  } else {
    const stc={BASIC:'#00e896',ELITE:'#a678ff',BOSS:'#ffd060',SPECIAL:'#ff8099'};
    const milestoneCards=G.shadows.map(sh=>{
      const col=gc[sh.grade]||'#a678ff';
      return `<div class="sha-card" style="--sc:${col}">
        <div class="sha-grade-badge" style="background:${col}18;color:${col};border:1px solid ${col}44">${sh.grade}</div>
        <span class="sha-icon">${shadowIcons[sh.id]||'🌑'}</span>
        <div class="sha-name">${sh.n}</div>
        <span class="sha-type">${sh.type}</span>
        <div class="sha-stat">${sh.stats[0]||''}</div>
      </div>`;
    }).join('');
    const soldierCards=army.map(sh=>{
      const col=stc[sh.type]||'#a678ff';
      const xpNext=SHADOW_XP_THRESHOLDS[Math.min(5,sh.level+1)]||SHADOW_XP_THRESHOLDS[5];
      const xpPrev=SHADOW_XP_THRESHOLDS[sh.level]||0;
      const pct=sh.level>=5?100:Math.round(((sh.xp-xpPrev)/(xpNext-xpPrev))*100);
      const equipIcons=(sh.equip||[]).map(e=>e==='shackle'?'⛓':e==='core'?'💜':'').join('');
      return `<div class="sha-sol-card" style="--sc:${col}">
        <div class="sha-grade-badge" style="background:${col}18;color:${col};border:1px solid ${col}44">${sh.type.slice(0,3)}</div>
        <span class="sha-icon">${slChiImg(sh.id, sh.icon)}</span>
        <div class="sha-name">${sh.n}</div>
        <span class="sha-type">LV ${sh.level} ${equipIcons}</span>
        <div class="sol-xp-track" style="margin-top:4px"><div class="sol-xp-fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;
    }).join('');
    document.getElementById('sha-grid').innerHTML=milestoneCards+
      (army.length?`<div style="width:100%;font-family:'Share Tech Mono',monospace;font-size:7px;letter-spacing:2px;color:rgba(140,155,180,.3);margin:8px 0 4px;padding:4px 0;border-top:1px solid rgba(140,155,180,.1);">⚔ DUNGEON SOLDIERS</div>${soldierCards}`:'');
  }

  // ── INVENTORY 3-COL ──
  const ig=document.getElementById('inv-grid3');
  if(!G.inventory.length){
    ig.innerHTML='<div class="inv-empty3">Inventory empty<br>Buy items in the Store</div>';
  } else {
    const allShop=[...BUILTIN_SHOP,...G.customShop];
    ig.innerHTML=G.inventory.map((inv,idx)=>{
      const item=allShop.find(x=>x.id===inv.id)||{icon:'?',n:inv.id,d:'',cons:true};
      return `<div class="iv-card">
        <span class="iv-card-ic">${slImg(item.icon)}</span>
        <div class="iv-card-nm">${item.n}</div>
        ${item.cons?`<button class="iv-card-use" onclick="useItem(${idx})">USE</button>`:'<div style="font-family:\'Share Tech Mono\',monospace;font-size:7px;color:rgba(0,232,150,.4);letter-spacing:1px;">PERMANENT</div>'}
      </div>`;
    }).join('');
  }
}

