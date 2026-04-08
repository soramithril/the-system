// ══════════════════════════════════════════════
// SHOP
// ══════════════════════════════════════════════
function setShopCat(c){sfx('filter');shopCat=c;rShop();}

// ── SHOP ITEM EDITOR ──
let _seiEditId=null, _seiCdVal=0;

function openShopEdit(id){
  sfx('modal');
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const base=allShop.find(x=>x.id===id);
  if(!base)return;
  const item={...base,...((G.shopOverrides||{})[id]||{})};
  _seiEditId=id;
  _seiCdVal=item.coolDays||0;
  const isBuiltin=BUILTIN_SHOP.some(x=>x.id===id);
  document.getElementById('sei-builtin-note').style.display=isBuiltin?'block':'none';
  document.getElementById('sei-icon').value=item.icon||'';
  document.getElementById('sei-name').value=item.n||'';
  document.getElementById('sei-desc').value=item.d||'';
  const costEl=document.getElementById('sei-cost');
  costEl.value=Math.min(2000,Math.max(10,item.cost||100));
  document.getElementById('sei-costv').textContent='◈ '+costEl.value;
  // Highlight active cooldown
  document.querySelectorAll('#sei-cd-grid .mf-cdopt').forEach(b=>{
    b.classList.toggle('act',Number(b.dataset.d)===_seiCdVal);
  });
  // Show/hide reset button for built-in items that have been overridden
  const hasOverride=isBuiltin&&G.shopOverrides&&G.shopOverrides[id];
  document.getElementById('sei-reset-btn').style.display=hasOverride?'block':'none';
  openModal('shop-edit-modal');
}

function seiCd(d){
  _seiCdVal=d;
  document.querySelectorAll('#sei-cd-grid .mf-cdopt').forEach(b=>b.classList.toggle('act',Number(b.dataset.d)===d));
}

function saveShopEdit(){
  if(!_seiEditId)return;
  const icon=document.getElementById('sei-icon').value.trim()||'📦';
  const name=document.getElementById('sei-name').value.trim();
  const desc=document.getElementById('sei-desc').value.trim();
  const cost=parseInt(document.getElementById('sei-cost').value)||100;
  if(!name){showError('Missing Name','Item needs a name');return;}
  const isCustom=G.customShop.some(x=>x.id===_seiEditId);
  if(isCustom){
    // Edit custom item in-place
    const idx=G.customShop.findIndex(x=>x.id===_seiEditId);
    if(idx>=0){G.customShop[idx]={...G.customShop[idx],icon,n:name,d:desc,cost,coolDays:_seiCdVal};}
  } else {
    // Store override for built-in item
    if(!G.shopOverrides)G.shopOverrides={};
    G.shopOverrides[_seiEditId]={icon,n:name,d:desc,cost,coolDays:_seiCdVal};
  }
  sv();closeModal('shop-edit-modal');rShop();
}

function resetShopEdit(){
  if(!_seiEditId)return;
  if(!G.shopOverrides)return;
  delete G.shopOverrides[_seiEditId];
  sv();closeModal('shop-edit-modal');rShop();
}
function buyItem(id){
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const base=allShop.find(x=>x.id===id);if(!base)return;
  const item={...base,...(G.shopOverrides?.[id]||{})};
  // Candy is always gold-only
  if(id==='candy')delete item.reqPct;
  if(G.gold<item.cost){sfx('cantBuy');showError('Not Enough Gold','Need ◈'+item.cost);return;}
  if(item.coolDays>0&&checkCooldown(id,item.coolDays)){showError('On Cooldown','This item has a cooldown');return;}
  if(item.reqPct){const pct=weeklyDailyPct();if(pct<item.reqPct){sfx('cantBuy');showError('Not Unlocked','Need '+item.reqPct+'% weekly daily completion (current: '+pct+'%)');return;}}
  G.gold-=item.cost;
  if(item.coolDays>0)G.shopCooldowns[id]=new Date().toISOString();
  if(!item.cons){
    G.inventory.push({id:item.id,n:item.n});
    applyPermEffect(item.e);
  } else {
    G.inventory.push({id:item.id,n:item.n});
  }
  sfx('buy');showItemCine({icon:item.icon,n:item.n,d:item.d},true);
  sv();renderAll();
}
function applyPermEffect(e){
  if(!e)return;
  if(e==='all5')Object.keys(G.stats).forEach(k=>G.stats[k]=(G.stats[k]||0)+5);
  const bools={sta5:'sta5',str6:'str6',str8:'str8',str12:'str12',str5:'str5',agi5:'agi5',agi8:'agi8',
    anki10:'anki10',water8:'water8',water5:'water5',gld20:'gld20',int8:'int8',
    stagi5:'stagi5',crd12:'crd12',cook5:'cook5',cook10:'cook10',prep8:'prep8',
    sleep10:'sleep10',study5:'study5'};
  if(bools[e])G.fx[bools[e]]=true;
}
function useItem(idx){
  const inv=G.inventory[idx];if(!inv)return;
  const allShop=[...BUILTIN_SHOP,...G.customShop];
  const item=allShop.find(x=>x.id===inv.id);
  if(!item||!item.cons)return;
  const e=item.e;
  if(e==='shield'){G.fx.shield=true;showItemCine({icon:'🛡',n:'Streak Shield Active',d:'All streaks protected until next miss'});}
  else if(e==='restpermit'){G.fx.restDay=new Date().toDateString();showItemCine({icon:'🏖',n:'Rest Day Declared',d:'All daily quests suspended today. No penalties. No streak loss. Recovery is part of the mission.'});}
  else if(e==='skipfit'){G.fx.skipfit=true;showItemCine({icon:'🛋',n:'Rest Day Pass',d:'One fitness quest can be skipped today'});}
  else if(e==='read7'){G.fx.read7=(G.fx.read7||0)+7;showItemCine(item);}
  else if(e==='read10'){G.fx.read10=(G.fx.read10||0)+10;showItemCine(item);}
  else if(e==='cook2wk'){G.fx.cook2wk=14;showItemCine(item);}
  else if(e==='rand'){const r=applyRandBox();showItemCine({icon:'🎲',n:'Random Reward Box',d:r+' added to your inventory!'});}
  // Shadow gear — shadow-select required
  else if(['shackle','core','rune','fragment','elixir','badge','essence','blade'].includes(e)){
    openShadowEquip(idx,e);return;
  }
  // Shadow gear — immediate effects
  else if(e==='crystal'){G.shadowCrystal=true;showItemCine({icon:'🔹',n:'Army Crystal Activated',d:'All soldiers gain ×2 XP from the next dungeon run.'});}
  else if(e==='mana'){gainShadowXp(15);showItemCine({icon:'🔵',n:'Mana Crystal',d:'All soldiers gained +15 XP.'});}
  else if(e==='vial'){gainShadowXp(35);showItemCine({icon:'🧪',n:"Monarch's Vial",d:'All soldiers gained +35 XP.'});}
  else if(e==='medal'){
    if(!G.shadowArmy||!G.shadowArmy.length){showError('No Soldiers','Extract shadows from dungeons first');return;}
    G.shadowArmy.forEach(sh=>{if(sh.type==='BASIC'){sh.xp+=20;sh.level=getShadowLevel(sh.xp);}});
    sv();showItemCine({icon:'🏅',n:'Iron Medal',d:'All Basic soldiers gained +20 XP.'});
  }
  else if(e==='pendant'){G.shadowPendant=new Date().toDateString();showItemCine({icon:'🔮',n:'Dark Pendant',d:'Army XP gains are ×1.5 for the rest of today.'});}
  else if(e==='sigil'){G.shadowSigil=true;showItemCine({icon:'🌀',n:'Dark Sigil',d:'Next dungeon clear has ×2 shadow spawn chance.'});}
  else if(e==='scroll'){G.shadowScrollPending=true;showItemCine({icon:'📜',n:'Ancient Scroll',d:'The next dungeon selection will be a Hidden Dungeon.'});}
  else if(e==='seal'){G.shadowSeal=true;showItemCine({icon:'🔱',n:"Monarch's Seal Active",d:'The next dungeon clear will guarantee a Boss-tier shadow spawn.'});}
  else if(e==='token'){
    if(!G.shadowArmy)G.shadowArmy=[];
    const tiers=['basic','basic','basic','elite','elite','boss'];
    const tier=tiers[Math.floor(Math.random()*tiers.length)];
    const pool=SHADOW_SPAWN_POOL[tier];
    const tmpl=pool[Math.floor(Math.random()*pool.length)];
    const uid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const sol={uid,id:tmpl.id,n:tmpl.n,icon:tmpl.icon,type:tmpl.type,xp:0,level:1,equip:[]};
    G.shadowArmy.push(sol);sv();
    setTimeout(()=>showShadowSpawnCine(sol),200);
  }
  else if(e==='crown'){
    if(!G.shadowArmy||!G.shadowArmy.length){showError('No Soldiers','Extract shadows from dungeons first');return;}
    G.shadowArmy.forEach(sh=>{const nl=Math.min(5,sh.level+1);sh.xp=Math.max(sh.xp,getShadowXpForLevel(nl));sh.level=getShadowLevel(sh.xp);});
    sv();showItemCine({icon:'👑',n:'Shadow Crown',d:'All soldiers gained 1 level!'});
  }
  else if(e==='tome'){
    if(!G.shadowArmy||!G.shadowArmy.length){showError('No Soldiers','Extract shadows from dungeons first');return;}
    const weakest=G.shadowArmy.reduce((a,b)=>a.level<b.level?a:b);
    const nl=Math.min(5,weakest.level+3);
    weakest.xp=Math.max(weakest.xp,getShadowXpForLevel(nl));weakest.level=getShadowLevel(weakest.xp);
    sv();showItemCine({icon:'📕',n:'Forbidden Tome',d:weakest.n+' advanced to Level '+weakest.level+'!'});
  }
  else if(e==='herald'){
    if(!G.shadowArmy)G.shadowArmy=[];
    const pool=SHADOW_SPAWN_POOL.special;
    const tmpl=pool[Math.floor(Math.random()*pool.length)];
    const uid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const sol={uid,id:tmpl.id,n:tmpl.n,icon:tmpl.icon,type:tmpl.type,xp:0,level:1,equip:[]};
    G.shadowArmy.push(sol);sv();
    setTimeout(()=>showShadowSpawnCine(sol),200);
  }
  else showItemCine(item);
  sfx('useItem');G.inventory.splice(idx,1);sv();renderAll();
}
let _shPendingInvIdx=null,_shPendingEffect=null;
function openShadowEquip(invIdx,effect){
  if(!G.shadowArmy||!G.shadowArmy.length){showError('No Soldiers','Clear dungeons to extract shadow soldiers first');return;}
  _shPendingInvIdx=invIdx;_shPendingEffect=effect;
  const cfg={
    shackle:{title:'BIND SHACKLE',     sub:'Choose a soldier — +30% XP permanently'},
    core:   {title:'FUSE DARK CORE',   sub:'Choose a soldier — ×2 XP permanently'},
    rune:   {title:'APPLY POWER RUNE', sub:'Choose a soldier — +2 levels instantly'},
    fragment:{title:'SOUL FRAGMENT',   sub:'Choose a soldier — +30 XP'},
    elixir: {title:'SHADOW ELIXIR',    sub:'Choose a soldier — +80 XP'},
    badge:  {title:'IRON BADGE',       sub:'Choose a soldier — +1 level instantly'},
    essence:{title:'PURE ESSENCE',     sub:'Choose a Basic soldier — upgrade to Elite tier'},
    blade:  {title:'SHADOW BLADE',     sub:'Choose a soldier — reach max Level 5'},
  };
  const c=cfg[effect]||{title:'SELECT SHADOW',sub:'Choose a soldier'};
  document.getElementById('sh-equip-title').textContent=c.title;
  document.getElementById('sh-equip-sub').textContent=c.sub;
  const gc={BASIC:'#00e896',ELITE:'#a678ff',BOSS:'#ffd060',SPECIAL:'#ff8099'};
  // For essence, only show Basic soldiers
  const candidates=(effect==='essence')?G.shadowArmy.filter(s=>s.type==='BASIC'):G.shadowArmy;
  if(!candidates.length){showError('No Valid Soldiers',effect==='essence'?'No Basic soldiers to upgrade':'No soldiers available');return;}
  document.getElementById('sh-equip-list').innerHTML=candidates.map(sh=>`
    <div class="sh-sel-card" onclick="confirmShadowEquip('${sh.uid}')">
      <span class="sh-sel-icon">${slChiImg(sh.id, sh.icon)}</span>
      <div class="sh-sel-info">
        <div class="sh-sel-name">${sh.n}</div>
        <div class="sh-sel-meta" style="color:${gc[sh.type]||'#a678ff'}">${sh.type} · LV ${sh.level} · ${sh.xp}XP</div>
        ${(sh.equip||[]).length?`<div class="sh-sel-equip">${sh.equip.map(e=>e==='shackle'?'⛓+30%':e==='core'?'💜×2':'').join(' ')}</div>`:''}
      </div>
    </div>`).join('');
  openModal('sh-equip-modal');
}
function confirmShadowEquip(uid){
  const sh=(G.shadowArmy||[]).find(s=>s.uid===uid);
  if(!sh||_shPendingInvIdx===null)return;
  const inv=G.inventory[_shPendingInvIdx];if(!inv)return;
  const e=_shPendingEffect;
  if(!sh.equip)sh.equip=[];
  if(e==='shackle'||e==='core'){
    sh.equip.push(e);
    showItemCine({icon:e==='shackle'?'⛓':'💜',n:e==='shackle'?'Shackle Bound':'Core Fused',d:sh.n+' gains '+(e==='shackle'?'+30% XP':'×2 XP')+' from all dungeon runs.'});
  } else if(e==='rune'){
    const nl=Math.min(5,sh.level+2);sh.xp=Math.max(sh.xp,getShadowXpForLevel(nl));sh.level=getShadowLevel(sh.xp);
    showItemCine({icon:'🔷',n:'Power Rune — '+sh.n,d:'Reached Level '+sh.level+'!'});
  } else if(e==='fragment'){
    sh.xp+=30;sh.level=getShadowLevel(sh.xp);
    showItemCine({icon:'💠',n:'Soul Fragment — '+sh.n,d:'+30 XP. Now Level '+sh.level+'.'});
  } else if(e==='elixir'){
    sh.xp+=80;sh.level=getShadowLevel(sh.xp);
    showItemCine({icon:'⚗',n:'Shadow Elixir — '+sh.n,d:'+80 XP. Now Level '+sh.level+'.'});
  } else if(e==='badge'){
    const nl=Math.min(5,sh.level+1);sh.xp=Math.max(sh.xp,getShadowXpForLevel(nl));sh.level=getShadowLevel(sh.xp);
    showItemCine({icon:'🎖',n:'Iron Badge — '+sh.n,d:'Reached Level '+sh.level+'!'});
  } else if(e==='essence'){
    sh.type='ELITE';sh.icon='🛡';
    showItemCine({icon:'✨',n:'Pure Essence — '+sh.n,d:'Basic shadow evolved to ELITE tier!'});
  } else if(e==='blade'){
    sh.xp=SHADOW_XP_THRESHOLDS[5];sh.level=5;
    showItemCine({icon:'🗡',n:'Shadow Blade — '+sh.n,d:'Shadow reached maximum Level 5!'});
  }
  G.inventory.splice(_shPendingInvIdx,1);
  _shPendingInvIdx=null;_shPendingEffect=null;
  sfx('useItem');sv();closeModal('sh-equip-modal');renderAll();
}
// Random Reward Box — shadow gear drop table (weight per item)
// Normal treats = 700 combined weight; shadow total ≈ 376 → ~35% shadow chance overall
const SHADOW_BOX_POOL=[
  {id:'sh_fragment',  w:50},  // ~4.65%
  {id:'sh_mana',      w:50},  // ~4.65%
  {id:'sh_medal',     w:40},  // ~3.72%
  {id:'sh_vial',      w:40},  // ~3.72%
  {id:'sh_crystal',   w:30},  // ~2.79%
  {id:'sh_pendant',   w:25},  // ~2.33%
  {id:'sh_sigil',     w:20},  // ~1.86%
  {id:'sh_scroll',    w:18},  // ~1.67%
  {id:'sh_badge',     w:15},  // ~1.39%
  {id:'sh_shackle',   w:15},  // ~1.39%
  {id:'sh_token',     w:12},  // ~1.12%
  {id:'sh_elixir',    w:10},  // ~0.93%
  {id:'sh_rune',      w:10},  // ~0.93%
  {id:'sh_essence',   w:8},   // ~0.74%
  {id:'sh_seal',      w:8},   // ~0.74%
  {id:'sh_core',      w:5},   // ~0.46%
  {id:'sh_blade',     w:5},   // ~0.46%
  {id:'sh_tome',      w:5},   // ~0.46%
  {id:'sh_crown',     w:5},   // ~0.46%
  {id:'sh_herald_call',w:5},  // ~0.46%
];
function applyRandBox(){
  const treatPool=BUILTIN_SHOP.filter(x=>x.cons&&x.cat==='Treats'&&x.coolDays>0);
  const TREAT_W=700;
  const shadowW=SHADOW_BOX_POOL.reduce((s,x)=>s+x.w,0);
  const grand=TREAT_W+shadowW;
  let r=Math.floor(Math.random()*grand);
  if(r>=TREAT_W){
    // Shadow gear drop
    r-=TREAT_W;
    let cum=0;
    for(const entry of SHADOW_BOX_POOL){
      cum+=entry.w;
      if(r<cum){
        const item=BUILTIN_SHOP.find(x=>x.id===entry.id);
        if(item){G.inventory.push({id:item.id,n:item.n});return'★ '+item.n+' (Shadow Gear!)';}
      }
    }
  }
  // Normal treat
  const pick=treatPool[~~(Math.random()*treatPool.length)];
  G.inventory.push({id:pick.id,n:pick.n});
  return pick.n;
}

function checkShadows(){
  if(!SKILLS.find(s=>s.id==='se').f(G))return;
  const shadowIcons={igris:'⚔',beru:'🐜',iron:'🗿',tank:'🛡',fangs:'🦷'};
  const gc={E:'#8090b0',D:'#00e896',C:'#4d9fff',B:'#a678ff',A:'#ffd060',S:'#ff8099'};
  let delay=1400;
  SHADOW_DEFS.forEach(sd=>{
    if(sd.req()&&!G.shadows.find(s=>s.id===sd.id)){
      G.shadows.push({id:sd.id,n:sd.n,type:sd.type,grade:sd.grade,stats:sd.stats});
      sv();
      // Unlock a title per shadow
      const shadowTitles={igris:'ti',iron:'ti',tank:'ts',fangs:'tl',beru:'tv'};
      const tId=shadowTitles[sd.id];
      if(tId&&!G.unlockedTitles?.includes(tId)){
        if(!G.unlockedTitles)G.unlockedTitles=['tw'];
        G.unlockedTitles.push(tId);sv();
      }
      // Show shadow extraction cine
      setTimeout(()=>showShadowExtract(sd,shadowIcons,gc),delay);
      // If this shadow unlocks a shop category, show notification after cine
      const unlockedCat=SHADOW_SHOP_UNLOCK[sd.id];
      if(unlockedCat){
        setTimeout(()=>showShopUnlockNotif(sd.n,shadowIcons[sd.id]||'🌑',unlockedCat),delay+4000);
      }
      delay+=400;
    }
  });
}
