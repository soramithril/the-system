// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
ld();initBosses();renderAll();goTab('home');maybeShowFirstLaunch();fbInit();
setTimeout(()=>maybeShowGateCine(),1500);
document.getElementById('app').classList.add('hide-edit');
