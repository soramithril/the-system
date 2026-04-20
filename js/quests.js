// ══════════════════════════════════════════════
// QUEST TOGGLE
// ══════════════════════════════════════════════
function togQ(id,evt){
  let q=G.quests.find(x=>x.id===id);
  if(!q&&G.urgentQuest?.id===id)q=G.urgentQuest;
  if(!q)return;
  if(!q.done){
    sfx('check');q.done=true;q.streak=(q.streak||0)+1;
    G.questsTotal=(G.questsTotal||0)+1;
    if(!G.qsd)G.qsd={STR:0,AGI:0,STA:0,INT:0,SEN:0,savings:0};
    G.qsd[q.s]=(G.qsd[q.s]||0)+1;
    if(q.m==='savings')G.qsd.savings=(G.qsd.savings||0)+1;
    lastCompletedStat=q.s;
    // MP
    if(q.mp>0)G.mp=Math.max(0,G.mp-q.mp);
    else if(q.mp<0)G.mp=Math.min(G.maxMp,G.mp+Math.abs(q.mp));
    // XP + gold
    const xp=calcXP(q),gold=calcGold(q);
    // ripple + check anim
    const chk=document.getElementById('qchk_'+id);
    if(chk){chk.classList.add('pop');setTimeout(()=>chk.classList.remove('pop'),400);}
    if(evt){
      const el=document.getElementById('qc_'+id)||evt.currentTarget;
      if(el){const r=document.createElement('div');r.className='rpl';const rect=el.getBoundingClientRect();const x=evt.clientX-rect.left,y=evt.clientY-rect.top;r.style.cssText=`left:${x}px;top:${y}px;width:36px;height:36px;margin:-18px 0 0 -18px;`;el.appendChild(r);setTimeout(()=>r.remove(),500);}
      // xp float
      sfx('xpPop');const pop=document.createElement('div');pop.className='xp-pop';pop.textContent='+'+xp+' XP';pop.style.left=(evt.clientX-28)+'px';pop.style.top=(evt.clientY-18)+'px';document.body.appendChild(pop);setTimeout(()=>pop.remove(),800);
    }
    gainXp(xp,q.s);G.gold+=gold;
    setTimeout(()=>showQuestCine(q,xp,gold),120);
    // ── BOSS COMBAT — deal damage ──
    if(q.t==='daily'||q.t==='urgent'){
      const dmg=q.xp;
      if(evt)showBossDmg(dmg,evt.clientX,evt.clientY,false);
      setTimeout(()=>checkBossThreshold('daily'),400);
    } else if(q.t==='weekly'){
      const dmg=q.xp;
      if(evt)showBossDmg(dmg,evt.clientX,evt.clientY,true);
      setTimeout(()=>checkBossThreshold('weekly'),400);
    }
    // ── DUNGEON CHECK — did completing this quest clear today's dungeon run? ──
    if(!G.dungeonToday)G.dungeonToday={};
    if(G.activeDungeonId){
      const aid=G.activeDungeonId;
      if(!G.dungeonToday[aid]){
        let questIds,dungIcon,dungName,dungGold,dungDesc;
        if(aid==='hidden'&&G.hiddenDungeon){
          questIds=G.hiddenDungeon.questIds;
          dungIcon='❓';dungName='Hidden Dungeon';dungGold=G.hiddenDungeon.gold;
          dungDesc='You faced your weak habits head-on. The hidden dungeon falls.';
        } else {
          const dung=DUNGEONS.find(d=>d.id===aid);
          if(dung){questIds=dung.questIds;dungIcon=dung.icon;dungName=dung.name;dungGold=dung.reward.gold;dungDesc=dung.reward.desc;}
        }
        if(questIds){
          const allDone=questIds.every(qid=>{const dq=G.quests.find(x=>x.id===qid);return dq&&dq.done;});
          if(allDone){
            G.dungeonToday[aid]=true;
            updateMVWOnDungeon(aid);
            G.gold+=dungGold;
            // ── Shadow Army: XP gain for all soldiers ──
            const _dungType=aid==='hidden'?'hidden':(DUNGEONS.find(d=>d.id===aid)?.type||'standard');
            const _xpMap={mini:10,standard:20,boss:50,hidden:30};
            const _leveled=gainShadowXp(_xpMap[_dungType]||20);
            sv();
            setTimeout(()=>{sfx('chest');showItemCine({icon:dungIcon,n:'DUNGEON CLEARED: '+dungName,d:'Bonus loot: +'+dungGold+'◈  '+dungDesc});},1800);
            // Shadow level-up notifications
            _leveled.forEach((lv,i)=>setTimeout(()=>showItemCine({icon:lv.sh.icon,n:lv.sh.n+' — Level Up!',d:lv.sh.type+' shadow now Level '+lv.newLevel}),2800+i*600));
            // Shadow spawn chance
            setTimeout(()=>{
              const _spawned=trySpawnShadow(_dungType);
              if(_spawned)setTimeout(()=>showShadowSpawnCine(_spawned),600);
            },_leveled.length?3800:2400);
          }
        }
      }
    }
    // streak milestones
    const miles=[7,14,30,50,100];
    if(miles.includes(q.streak))setTimeout(()=>showStreakCine(q.streak,q.n),700);
    // ── STREAK UNLOCKS ──
    if(!G.streakUnlocksGiven)G.streakUnlocksGiven=[];
    if(q.streak===7&&!G.streakUnlocksGiven.includes('7')){
      G.streakUnlocksGiven.push('7');
      // Award a Streak Shield
      G.inventory.push({id:'shield',n:'Streak Shield'});
      setTimeout(()=>showItemCine({icon:'🛡',n:'7-Day Streak Reward',d:'Streak Shield earned. Miss one day — your streaks are protected.'}),1100);
    }
    if(q.streak===14&&!G.streakUnlocksGiven.includes('14')){
      G.streakUnlocksGiven.push('14');
      // Shadow Dungeon unlocked (it's in DUNGEONS with unlockStreak:14)
      setTimeout(()=>showItemCine({icon:'🌑',n:'Shadow Dungeon Unlocked',d:'14-day streak achieved. The Shadow Dungeon is now available. Eight quests. No mercy.'}),1100);
    }
    if(q.streak===30&&!G.streakUnlocksGiven.includes('30')){
      G.streakUnlocksGiven.push('30');
      if(!G.unlockedTitles.includes('t30streak'))G.unlockedTitles.push('t30streak');
      setTimeout(()=>showTitleCine({icon:'💎',n:'The Unbroken',e:'+8% all XP'}),1100);
    }
    if(q.streak===60&&!G.streakUnlocksGiven.includes('60')){
      G.streakUnlocksGiven.push('60');
      if(!G.unlockedTitles.includes('t60streak'))G.unlockedTitles.push('t60streak');
      G.gold+=500;
      setTimeout(()=>showTitleCine({icon:'⚡',n:'Relentless',e:'+12% all XP · +500 Gold bonus'}),1100);
    }
    if(q.streak===100&&!G.streakUnlocksGiven.includes('100')){
      G.streakUnlocksGiven.push('100');
      if(!G.unlockedTitles.includes('t100streak'))G.unlockedTitles.push('t100streak');
      G.gold+=1000;
      setTimeout(()=>showTitleCine({icon:'🌟',n:"Monarch's Will",e:'+15% all XP & +10% gold · +1000 Gold bonus'}),1100);
    }
    // ruler's authority
    if(SKILLS.find(s=>s.id==='sk').f(G)&&G.questsTotal%10===0){gainXp(50,q.s);G.gold+=25;setTimeout(()=>showItemCine({icon:'⬡',n:"Ruler's Authority",d:'+50 XP & +25 Gold (every 10 quests)'}),900);}
    // MVW tracking
    updateMVWOnQuestComplete(q);
    // all daily complete — only consider quests scheduled for today
    const dailies=G.quests.filter(q=>q.t==='daily'&&isScheduledToday(q));
    if(dailies.length&&dailies.every(x=>x.done)){
      updateMVWDailyDay();
      const boosts=autoDistribute(3,q.s);applyBoosts(boosts);
      setTimeout(()=>showStatUpCine(boosts,'Daily quests complete — System rewarding your discipline'),600);
      if(SKILLS.find(s=>s.id==='sa').f(G)){gainXp(100,q.s);G.gold+=50;}
      if(SKILLS.find(s=>s.id==='sr').f(G))G.gold+=5;
      setTimeout(()=>showArise(),1400);
    }
    // check shadow unlocks
    checkShadows();
    checkTitles();
    checkSkills();
  } else {
    sfx('uncheck');q.done=false;q.streak=Math.max(0,(q.streak||0)-1);
    G.xp=Math.max(0,G.xp-q.xp);G.totalXp=Math.max(0,G.totalXp-q.xp);
    G.gold=Math.max(0,G.gold-(q.g||0));
    if(G.qsd?.[q.s]>0)G.qsd[q.s]--;
  }
  sv();renderAll();
}

function calcXP(q){
  let x=q.xp;const fx=G.fx,et=G.equippedTitle;
  // fitness gear bonuses
  if((fx.str8||fx.str6||fx.str5)&&q.s==='STR')x=Math.floor(x*(1+(fx.str8?.08:0)+(fx.str6?.06:0)+(fx.str5?.05:0)));
  if(fx.stagi5&&(q.s==='STA'||q.s==='AGI'))x=Math.floor(x*1.05);
  if(fx.agi5&&q.s==='AGI')x=Math.floor(x*1.05);
  if(fx.crd12&&q.id==='f4')x+=12;
  if(fx.sta5&&q.s==='STA')x=Math.floor(x*1.05);
  if(fx.water8&&q.id==='s5')x+=8;
  if(fx.water5&&q.id==='s5')x+=5;
  // learning bonuses
  if(fx.anki10&&(q.id==='j1'||q.id==='j2'))x=Math.floor(x*1.1);
  if(fx.int8&&q.s==='INT')x=Math.floor(x*1.08);
  if(fx.study5&&(q.s==='INT'||q.id==='y2'))x+=5;
  if(fx.read7>0&&q.id==='h1'){x=Math.floor(x*1.5);fx.read7--;}
  if(fx.read10>0&&q.id==='h1'){x=Math.floor(x*1.5);fx.read10--;}
  // kitchen bonuses
  if(fx.cook5&&(q.id==='c1'||q.id==='c3'))x=Math.floor(x*1.05);
  if(fx.cook10&&(q.id==='c1'||q.id==='c3'))x=Math.floor(x*1.1);
  if(fx.cook2wk>0&&(q.id==='c1'||q.id==='c3')){x=Math.floor(x*1.5);fx.cook2wk--;}
  if(fx.prep8&&q.id==='c3')x=Math.floor(x*1.08);
  if(fx.sleep10&&q.id==='h4')x+=10;
  // job class bonus
  const jc=getJobClass();
  if(jc&&jc.id!=='true'&&q.s===jc.req)x=Math.floor(x*1.15);
  if(jc&&jc.id==='true')x=Math.floor(x*1.05);
  // title bonuses
  if(et==='tt')x=Math.floor(x*1.1);
  if(et==='tm')x=Math.floor(x*1.2);
  if(et==='tc'&&q.s==='SEN')x=Math.floor(x*1.05);
  if(et==='tl'&&q.s==='INT')x=Math.floor(x*1.05);
  if(et==='ti'&&q.s==='STR')x=Math.floor(x*1.05);
  if(et==='tv'&&q.s==='SEN')x=Math.floor(x*1.15);
  // streak unlock title bonuses
  if(et==='t7streak')x=Math.floor(x*1.05);
  if(et==='t30streak')x=Math.floor(x*1.08);
  // ── DEBUFF — miss quests yesterday → −20% XP today ──
  if(G.debuff?.xp&&G.debuff.expiry===new Date().toDateString())x=Math.floor(x*0.8);
  return x;
}
function calcGold(q){
  let g=q.g||0;const et=G.equippedTitle;
  if(G.fx.gld20||et==='tm')g=Math.floor(g*1.2);
  if(et==='tg')g+=5;
  if(et==='ts'&&q.m==='savings')g+=3;
  if(SKILLS.find(s=>s.id==='sc').f(G)&&q.s==='SEN')g+=3;
  return g;
}

// ══════════════════════════════════════════════
// AUTO STAT DISTRIBUTION
// ══════════════════════════════════════════════
const STAT_MAP={STR:'STR',AGI:'AGI',STA:'STA',INT:'INT',SEN:'SEN'};
function autoDistribute(pts,triggerStat){
  if(pts<=0)return{};const boosts={};
  const primary=STAT_MAP[triggerStat]||'STR';
  const primPts=Math.max(1,Math.round(pts*0.6));
  boosts[primary]=(boosts[primary]||0)+primPts;
  const rem=pts-primPts;
  if(rem>0){
    const act=G.qsd||{};const tot=Object.values(act).reduce((a,b)=>a+b,0)||1;
    const others=Object.keys(STAT_MAP).filter(k=>k!==primary);let left=rem;
    others.forEach((k,i)=>{
      if(i===others.length-1){boosts[k]=(boosts[k]||0)+left;}
      else{const sh=Math.max(0,Math.round(rem*(act[k]||0)/tot));boosts[k]=(boosts[k]||0)+sh;left-=sh;}
    });
  }
  Object.keys(boosts).forEach(k=>{if(!boosts[k])delete boosts[k];});return boosts;
}
function applyBoosts(b){Object.entries(b).forEach(([k,v])=>{G.stats[k]=(G.stats[k]||0)+v;});}

// ══════════════════════════════════════════════
// GAIN XP
// ══════════════════════════════════════════════
function gainXp(amt,tStat){
  G.xp+=amt;G.totalXp+=amt;
  while(G.xp>=G.level*100){
    G.xp-=G.level*100;G.level++;
    Object.keys(G.stats).forEach(k=>G.stats[k]=(G.stats[k]||0)+1);
    const boosts=autoDistribute(5,tStat||'STR');applyBoosts(boosts);
    const r=curRank(),pi=RANKS.findIndex(x=>x.id===r.id);
    const rankUp=pi>0&&G.totalXp>=r.xp&&G.totalXp-amt<r.xp;
    setTimeout(()=>showLvUpCine(G.level,boosts,rankUp?r:null),200);
    if(rankUp)setTimeout(()=>showRankUpCine(r),2500);
  }
  sv();
}

