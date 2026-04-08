// ══════════════════════════════════════════════
// SHADOW ARMY — DUNGEON MECHANICS
// ══════════════════════════════════════════════
const SHADOW_XP_THRESHOLDS=[0,0,40,100,250,500];
function getShadowLevel(xp){
  for(let lv=5;lv>=2;lv--)if(xp>=SHADOW_XP_THRESHOLDS[lv])return lv;
  return 1;
}
function getShadowXpForLevel(lv){return SHADOW_XP_THRESHOLDS[Math.max(1,Math.min(5,lv))]||0;}

function trySpawnShadow(dungType){
  if(!G.shadowArmy)G.shadowArmy=[];
  // Monarch's Seal — guarantee Boss spawn
  if(G.shadowSeal){
    G.shadowSeal=false;sv();
    const pool=SHADOW_SPAWN_POOL.boss;
    const tmpl=pool[Math.floor(Math.random()*pool.length)];
    const uid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const sol={uid,id:tmpl.id,n:tmpl.n,icon:tmpl.icon,type:tmpl.type,xp:0,level:1,equip:[]};
    G.shadowArmy.push(sol);sv();return sol;
  }
  const cfg=SHADOW_SPAWN_CHANCES[dungType]||SHADOW_SPAWN_CHANCES.standard;
  // Dark Sigil — double spawn chance
  let chance=cfg.chance;
  if(G.shadowSigil){chance=Math.min(0.95,chance*2);G.shadowSigil=false;sv();}
  if(Math.random()>chance)return null;
  // Pick tier by weight
  const totalW=cfg.tiers.reduce((s,t)=>s+t.w,0);
  let r=Math.random()*totalW;
  let tier='basic';
  for(const t of cfg.tiers){r-=t.w;if(r<=0){tier=t.t;break;}}
  const pool=SHADOW_SPAWN_POOL[tier];
  if(!pool||!pool.length)return null;
  const tmpl=pool[Math.floor(Math.random()*pool.length)];
  const uid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const soldier={uid,id:tmpl.id,n:tmpl.n,icon:tmpl.icon,type:tmpl.type,xp:0,level:1,equip:[]};
  G.shadowArmy.push(soldier);
  sv();
  return soldier;
}

function gainShadowXp(baseAmount){
  if(!G.shadowArmy||!G.shadowArmy.length)return[];
  const doubled=!!G.shadowCrystal;
  if(doubled)G.shadowCrystal=false;
  const pendant=G.shadowPendant===new Date().toDateString();
  let amount=doubled?baseAmount*2:baseAmount;
  if(pendant)amount=Math.floor(amount*1.5);
  const leveled=[];
  G.shadowArmy.forEach(sh=>{
    const oldLv=getShadowLevel(sh.xp);
    let boost=1;
    (sh.equip||[]).forEach(eq=>{
      if(eq==='shackle')boost+=0.30;
      if(eq==='core')  boost+=1.00;
    });
    sh.xp+=Math.floor(amount*boost);
    sh.level=getShadowLevel(sh.xp);
    if(sh.level>oldLv)leveled.push({sh,newLevel:sh.level});
  });
  sv();
  return leveled;
}

function showShadowSpawnCine(soldier){
  const gradeMap={BASIC:'D',ELITE:'B',BOSS:'A',SPECIAL:'S'};
  const gc={D:'#00e896',B:'#a678ff',A:'#ffd060',S:'#ff8099'};
  const grade=gradeMap[soldier.type]||'C';
  const col=gc[grade]||'#a678ff';
  document.getElementById('se-icon').innerHTML=slImg(soldier.icon,'sl-icon-xl');
  document.getElementById('se-name').textContent=soldier.n;
  document.getElementById('se-grade').textContent=grade+'-RANK SOLDIER';
  document.getElementById('se-grade').style.color=col;
  document.getElementById('se-type').textContent=soldier.type;
  document.getElementById('se-stat').textContent='SHADOW EXTRACTED FROM DUNGEON';
  document.getElementById('shadow-extract').classList.add('show');
  sfx('shadowExtract');
}

function checkTitles(){
  if(!G.unlockedTitles)G.unlockedTitles=['tw'];
  TITLES.forEach(t=>{if(t.f(G)&&!G.unlockedTitles.includes(t.id)){G.unlockedTitles.push(t.id);showTitleCine(t);sv();}});
}
function checkSkills(){
  if(!G.unlockedSkills)G.unlockedSkills=[];
  SKILLS.forEach(sk=>{if(sk.f(G)&&!G.unlockedSkills.includes(sk.id)){G.unlockedSkills.push(sk.id);showSkillCine(sk);sv();}});
}
function eqTitle(id){sfx('equipTitle');G.equippedTitle=G.equippedTitle===id?null:id;sv();renderAll();}

