// ══════════════════════════════════════════════
// CALENDAR HEATMAP — GitHub-style compact grid
// ══════════════════════════════════════════════
let calYear=new Date().getFullYear();

function rCal(){
  if(curTab!=='cal')return;
  const c=document.getElementById('cal-container');
  if(!c)return;

  // Build lookup from dailyLog
  const logMap={};
  (G.dailyLog||[]).forEach(e=>{
    const d=new Date(e.date);
    if(!isNaN(d))logMap[d.toISOString().slice(0,10)]={done:e.done,total:e.total};
  });

  // Add today's live progress
  const now=new Date();
  const todayKey=now.toISOString().slice(0,10);
  if(now.getFullYear()===calYear){
    const dl=G.quests.filter(q=>q.t==='daily'&&!q.penaltyTask);
    const dDone=dl.filter(q=>q.done).length;
    const dTotal=dl.length;
    if(dTotal>0)logMap[todayKey]={done:dDone,total:dTotal};
  }

  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dowLabels=['M','T','W','T','F','S','S'];

  // Build list of all days in the year starting from Apr 7
  const startDate=new Date(calYear,3,7); // April 7
  const endDate=new Date(calYear+1,3,6); // April 6 next year
  const allDays=[];
  for(let d=new Date(startDate);d<=endDate;d.setDate(d.getDate()+1)){
    allDays.push(new Date(d));
  }

  // Calc stats over all days with data
  let totalTracked=0,perfectDays=0,curStreak=0,maxStreak=0,tempStreak=0;
  allDays.forEach(dt=>{
    if(dt>now){return;}
    const k=dt.toISOString().slice(0,10);
    if(logMap[k]){
      totalTracked++;
      if(logMap[k].done===logMap[k].total&&logMap[k].total>0){perfectDays++;tempStreak++;}
      else tempStreak=0;
    } else {tempStreak=0;}
    if(tempStreak>maxStreak)maxStreak=tempStreak;
  });
  // Current streak backwards from today
  curStreak=0;
  for(let i=allDays.length-1;i>=0;i--){
    if(allDays[i]>now)continue;
    const k=allDays[i].toISOString().slice(0,10);
    if(logMap[k]&&logMap[k].done===logMap[k].total&&logMap[k].total>0)curStreak++;
    else break;
  }

  let html='';
  // Year nav
  html+=`<div class="cal-year-nav">
    <button onclick="calYear--;rCal()">◄</button>
    <span class="cal-year-title">${calYear} — ${calYear+1}</span>
    <button onclick="calYear++;rCal()">►</button>
  </div>`;

  // Stats
  html+=`<div class="cal-stats-row">
    <div class="cal-stat-card"><div class="cal-stat-val">${curStreak}</div><div class="cal-stat-lbl">Streak</div></div>
    <div class="cal-stat-card"><div class="cal-stat-val">${maxStreak}</div><div class="cal-stat-lbl">Best</div></div>
    <div class="cal-stat-card"><div class="cal-stat-val">${perfectDays}</div><div class="cal-stat-lbl">Perfect</div></div>
    <div class="cal-stat-card"><div class="cal-stat-val">${totalTracked}</div><div class="cal-stat-lbl">Tracked</div></div>
  </div>`;

  // Legend
  html+=`<div class="cal-legend">
    <span>LESS</span>
    <div class="cal-legend-block cal-heat-0"></div>
    <div class="cal-legend-block cal-heat-1"></div>
    <div class="cal-legend-block cal-heat-2"></div>
    <div class="cal-legend-block cal-heat-3"></div>
    <div class="cal-legend-block cal-heat-4"></div>
    <div class="cal-legend-block cal-heat-5"></div>
    <span>MORE</span>
  </div>`;

  // Vertical grid: 7 columns (Mon-Sun), rows = weeks, month labels on left
  // Align start to Monday
  const startDow=(startDate.getDay()+6)%7; // 0=Mon
  // Pad to start on a Monday
  const gridStart=new Date(startDate);
  gridStart.setDate(gridStart.getDate()-startDow);

  html+=`<div class="cal-grid-wrap"><div class="cal-grid">`;
  // Header row: empty corner + Mon-Sun
  html+=`<div></div>`;
  dowLabels.forEach(l=>{html+=`<div class="cal-dow">${l}</div>`;});

  // Render week rows
  let d=new Date(gridStart);
  let lastMonthShown=-1;
  while(d<=endDate||d<=now){
    // Month label for this week (show if the week contains 1st of a new month or first row)
    let mLabel='';
    for(let i=0;i<7;i++){
      const check=new Date(d);check.setDate(check.getDate()+i);
      if(check.getDate()<=7&&check.getMonth()!==lastMonthShown){
        mLabel=months[check.getMonth()];
        lastMonthShown=check.getMonth();
        break;
      }
    }
    // First row always shows month
    if(d.getTime()===gridStart.getTime()&&!mLabel){
      mLabel=months[d.getMonth()];
      lastMonthShown=d.getMonth();
    }
    html+=`<div class="cal-mlabel">${mLabel}</div>`;

    // 7 day cells for this week
    for(let i=0;i<7;i++){
      const dt=new Date(d);
      dt.setDate(dt.getDate()+i);
      const k=dt.toISOString().slice(0,10);
      const entry=logMap[k];
      const isFuture=dt>now;
      const isToday=k===todayKey;
      const isBeforeStart=dt<startDate;
      const isAfterEnd=dt>endDate;

      if(isBeforeStart||isAfterEnd){
        html+=`<div></div>`;
        continue;
      }

      let heat=0;
      const mStr=months[dt.getMonth()]+' '+dt.getDate();
      let tipText=mStr;
      const isRest=entry&&entry.rest;
      if(isRest){
        tipText+=' · Rest Day';heat=0;
      } else if(entry&&entry.total>0){
        const pct=entry.done/entry.total;
        if(pct>0)heat=1;
        if(pct>=0.25)heat=2;
        if(pct>=0.5)heat=3;
        if(pct>=0.75)heat=4;
        if(pct>=1)heat=5;
        tipText+=` · ${entry.done}/${entry.total} (${Math.round(pct*100)}%)`;
      } else if(!isFuture){
        tipText+=' · No data';
      }
      html+=`<div class="cal-cell cal-heat-${isFuture?0:heat}${isToday?' today':''}${isFuture?' future':''}${isRest?' rest':''}"><div class="cal-tip">${tipText}</div></div>`;
    }
    d.setDate(d.getDate()+7);
    if(d>endDate&&d>now)break;
  }

  html+=`</div></div>`;

  // ── 12-WEEK SPARKLINE ──
  const weekData=[];
  for(let w=11;w>=0;w--){
    const wEnd=new Date(now);wEnd.setDate(wEnd.getDate()-w*7);
    const wStart=new Date(wEnd);wStart.setDate(wStart.getDate()-6);
    let wDone=0,wTotal=0;
    for(let d=new Date(wStart);d<=wEnd;d.setDate(d.getDate()+1)){
      const k=d.toISOString().slice(0,10);
      if(logMap[k]){wDone+=logMap[k].done;wTotal+=logMap[k].total;}
    }
    weekData.push(wTotal>0?Math.round((wDone/wTotal)*100):null);
  }
  const sparkVals=weekData.filter(v=>v!==null);
  if(sparkVals.length>=2){
    const svgW=300,svgH=36,pad=2;
    const mn=Math.min(...sparkVals),mx=Math.max(...sparkVals,1);
    const pts=[];let pi=0;
    weekData.forEach((v,i)=>{
      if(v===null)return;
      const x=pad+(i/(weekData.length-1))*(svgW-pad*2);
      const y=svgH-pad-((v-mn)/(mx-mn||1))*(svgH-pad*2);
      pts.push(`${x},${y}`);pi++;
    });
    const line=pts.join(' ');
    const lastPt=pts[pts.length-1];
    const trend=sparkVals[sparkVals.length-1]-sparkVals[0];
    const tCol=trend>=0?'rgba(100,190,255,.8)':'rgba(212,32,64,.7)';
    html+=`<div class="cal-spark-section">
      <div class="cal-spark-title">◆ 12-WEEK COMPLETION TREND ◆</div>
      <svg class="cal-spark-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
        <polyline points="${line}" fill="none" stroke="${tCol}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${lastPt.split(',')[0]}" cy="${lastPt.split(',')[1]}" r="3" fill="${tCol}"/>
      </svg>
    </div>`;
  }

  c.innerHTML=html;
}

