// ══════════════════════════════════════════════
// FIREBASE SYNC
// ══════════════════════════════════════════════
// Paste your Firebase config here:
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYd3KGSylkvpWJUSEti-PSb4ir5Xbp0qE",
  authDomain: "the-system-970f9.firebaseapp.com",
  databaseURL: "https://the-system-970f9-default-rtdb.firebaseio.com",
  projectId: "the-system-970f9",
  storageBucket: "the-system-970f9.firebasestorage.app",
  messagingSenderId: "104227504438",
  appId: "1:104227504438:web:ae5ab6d6d3652d694e3397"
};

const FIREBASE_CONFIGURED = !Object.values(FIREBASE_CONFIG).some(v=>v.startsWith('PASTE_'));

let fbDb=null, fbUserId=null, fbSyncTimeout=null;

async function fbInit(){
  if(!FIREBASE_CONFIGURED)return;
  try{
    // Use pre-loaded Firebase modules (avoids dynamic import failures with file:// protocol)
    await new Promise((resolve,reject)=>{
      if(window.__firebase!==undefined)return resolve();
      const t=setTimeout(()=>reject(new Error('Firebase load timeout')),10000);
      window.addEventListener('firebase-ready',()=>{clearTimeout(t);resolve();},{once:true});
    });
    if(!window.__firebase)throw new Error('Firebase modules unavailable');
    const {initializeApp,getDatabase,ref,set,get,onValue}=window.__firebase;
    const app=initializeApp(FIREBASE_CONFIG);
    fbDb=getDatabase(app);
    // Single-user app — fixed key is fine; lock down via Firebase Rules (see below)
    // Firebase Console → Realtime Database → Rules:
    //   {"rules":{"saves":{"player":{".read":true,".write":true}},".read":false,".write":false}}
    fbUserId='player';
    window._fbRef=ref; window._fbSet=set; window._fbGet=get; window._fbOnValue=onValue;
    // Pull remote state first
    await fbPull();
    // Set up live listener for cross-device sync
    onValue(ref(fbDb,'saves/'+fbUserId),(snap)=>{
      const data=snap.val();
      if(!data)return;
      // Only update if remote is newer
      if(data._ts&&G._ts&&data._ts<=G._ts)return;
      mergeRemote(data);
    });
    _fbReady=true;
    showFbStatus('◆ FIREBASE CONNECTED','#00e896');
  }catch(e){
    console.warn('Firebase init failed:',e);
    showFbStatus('◆ OFFLINE MODE','rgba(140,155,180,.4)');
  }
}

async function fbPull(){
  if(!fbDb)return;
  try{
    const snap=await window._fbGet(window._fbRef(fbDb,'saves/'+fbUserId));
    const data=snap.val();
    if(!data)return;
    mergeRemote(data);
  }catch(e){console.warn('fbPull failed:',e);}
}

function mergeRemote(data){
  // Deep merge remote into G, preserving local keys remote doesn't have
  const localTs=G._ts||0, remoteTs=data._ts||0;
  if(remoteTs>localTs){
    const merged={...G,...data};
    // Always keep arrays/objects intact
    merged.stats={...G.stats,...(data.stats||{})};
    merged.qsd={...G.qsd,...(data.qsd||{})};
    merged.fx={...G.fx,...(data.fx||{})};
    merged.quests=data.quests?.length?data.quests:G.quests;
    merged.inventory=data.inventory||G.inventory;
    merged.shadows=data.shadows||G.shadows;
    merged.customShop=data.customShop||G.customShop;
    merged.customCategories=data.customCategories||G.customCategories||[];
    merged.unlockedTitles=data.unlockedTitles||G.unlockedTitles;
    merged.unlockedSkills=data.unlockedSkills||G.unlockedSkills;
    merged.shopCooldowns=data.shopCooldowns||G.shopCooldowns;
    merged.dailyLog=data.dailyLog||G.dailyLog||[];
    // ── New fields: boss combat, dungeons, debuff, streak unlocks ──
    merged.dungeonToday=data.dungeonToday||G.dungeonToday||{};
    merged.activeDungeonId=data.activeDungeonId!==undefined?data.activeDungeonId:G.activeDungeonId||null;
    merged.activeDungeonDate=data.activeDungeonDate||G.activeDungeonDate||'';
    merged.hiddenDungeon=data.hiddenDungeon||G.hiddenDungeon||null;
    // ── Shadow Army soldiers + all item flags ──
    merged.shadowArmy=data.shadowArmy||G.shadowArmy||[];
    merged.shadowCrystal=data.shadowCrystal!==undefined?data.shadowCrystal:(G.shadowCrystal||false);
    merged.shadowSigil=data.shadowSigil!==undefined?data.shadowSigil:(G.shadowSigil||false);
    merged.shadowSeal=data.shadowSeal!==undefined?data.shadowSeal:(G.shadowSeal||false);
    merged.shadowScrollPending=data.shadowScrollPending!==undefined?data.shadowScrollPending:(G.shadowScrollPending||false);
    merged.shadowPendant=data.shadowPendant||G.shadowPendant||'';
    merged.debuff=data.debuff||G.debuff||{xp:false,expiry:null};
    merged.penaltyPending=data.penaltyPending!==undefined?data.penaltyPending:(G.penaltyPending||false);
    merged.streakUnlocksGiven=data.streakUnlocksGiven||G.streakUnlocksGiven||[];
    merged.shopOverrides=data.shopOverrides||G.shopOverrides||{};
    merged.mvwLog=data.mvwLog||G.mvwLog||{};
    merged.weekRecapShown=data.weekRecapShown||G.weekRecapShown||'';
    merged.statLog=data.statLog||G.statLog||[];
    // ── iOS Health: always take the newer healthSync record ──
    const remoteHs=data.healthSync||null;
    const localHs=G.healthSync||null;
    if(remoteHs&&(!localHs||(remoteHs.updated||0)>(localHs.updated||0))){
      merged.healthSync=remoteHs;
    } else {
      merged.healthSync=localHs||{date:'',steps:0,workouts:[],sleep:{hours:0},hrv:0,updated:0};
    }
    Object.assign(G,merged);
    // Run quest migration on Firebase data too
    if(!G._qmig2){
      const defMap=new Map(DEFAULT_QUESTS.map(q=>[q.id,q]));
      const savedIds=new Set(G.quests.map(q=>q.id));
      G.quests=G.quests.map(q=>{
        const def=defMap.get(q.id);
        if(def)return {...q, n:def.n, s:def.s, xp:def.xp, g:def.g, mp:def.mp, t:def.t};
        return q;
      });
      const REMOVED_QUEST_IDS=new Set(['h3','h4','gr3','s1','s2','j5','s5','m_shake2','c3']);
      G.quests=G.quests.filter(q=>!REMOVED_QUEST_IDS.has(q.id)||q.m==='custom');
      DEFAULT_QUESTS.forEach(dq=>{
        if(!savedIds.has(dq.id)&&!REMOVED_QUEST_IDS.has(dq.id)){
          G.quests.push({...dq});
        }
      });
      G._qmig2=true;
      // Push migrated data back to Firebase so all devices get it
      fbPush();
    }
    // Re-run day/week check after merge so remote data doesn't undo today's reset
    dayCheck();weekCheck();
    localStorage.setItem('sl_v5',JSON.stringify(G));
    renderAll();
    showFbStatus('◆ SYNCED FROM CLOUD','#00e896');
  }
}

function fbPush(){
  if(!fbDb||!FIREBASE_CONFIGURED)return;
  // Debounce — only push after 1.5s of no changes
  clearTimeout(fbSyncTimeout);
  fbSyncTimeout=setTimeout(async()=>{
    try{
      G._ts=Date.now();
      await window._fbSet(window._fbRef(fbDb,'saves/'+fbUserId),JSON.parse(JSON.stringify(G)));
    }catch(e){console.warn('fbPush failed:',e);}
  },1500);
}

function showFbStatus(msg,col){
  const el=document.getElementById('fb-status');
  if(!el)return;
  el.textContent=msg;
  el.style.color=col||'rgba(140,155,180,.4)';
  el.style.opacity='1';
  setTimeout(()=>{el.style.transition='opacity 1s';el.style.opacity='0.4';},3000);
}

// Mark Firebase as ready so sv() can push
// (sv() is now a single definition that checks _fbReady)

