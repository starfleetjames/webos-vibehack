const fs=require('fs'), vm=require('vm'), assert=require('assert/strict');
const source=fs.readFileSync('app/app.js','utf8'), ctx={};ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('tests/layout-fixture.js','utf8'),ctx);
let saved=null;
ctx.localStorage={getItem:()=>saved,setItem:(_,v)=>saved=v};
vm.runInContext('var COLUMNS=4, gamingCount=0, streamingCount=0, items=[], focused=0, zone="grid", editing=null; var GAME_TOP=360, DOCK_TOP=736, ROW_PITCH=292, SECTION_GAP=116, CELL_W=424, TILE_W=360;'+source.slice(source.indexOf('  function orderedApps()'),source.indexOf('  function build()')),ctx);
const get=()=>{const apps=ctx.orderedApps();ctx.items=apps.map(app=>({app}));return Array.from(apps,a=>a.id);};
let ids=get();
const games=Array.from(ctx.CONFIG.gamingApps), streaming=Array.from(ctx.CONFIG.streamingApps);
const g=games.length,s=streaming.length;
assert.equal(g,5);assert.deepEqual(ids.slice(0,g),games);
assert.deepEqual(ids.slice(g,g+s),streaming);
assert.deepEqual(ids.slice(g+s),['com.webos.app.discovery','com.palmdts.devmode']);
assert.equal(new Set(ids).size,ids.length);
assert.equal(ctx.streamingRows(),3);
assert.equal(ctx.rowOf(g+s-1),3);assert.equal(ctx.columnOf(g+s-1),1);
assert.equal(ctx.rowOf(g+s),4);assert.equal(ctx.columnOf(g+s),0);
assert.equal(ctx.indexAt(3,3),g+s-1); // empty streaming slots never select utilities
assert.equal(ctx.indexAt(4,3),g+s+1);
assert.equal(ctx.neighborInRow(1,4),g+3,'fifth game goes to the nearest tile in the first streaming row');
assert.equal(ctx.indexAt(1,4),g+3,'fifth column never skips a streaming row');
assert.equal(ctx.tileWidth(0),275.2);assert.equal(ctx.tileWidth(g),360);
assert.equal(ctx.tileLeft(4)+ctx.tileWidth(4),1776);
for(let i=0;i<ids.length;i++)assert.equal(ctx.indexAt(ctx.rowOf(i),ctx.columnOf(i)),i);
assert(ctx.otherTop()-84 > ctx.tileTop(g+s-1)+202+72); // utility heading clears the panel
// Migrate old saved arrangements while keeping favorites and gaming order.
const oldOrder=[...games].reverse().concat(['amazon','netflix','youtube.leanback.v4','com.apple.appletv','com.webos.app.discovery','com.palmdts.devmode',...streaming.slice(4)]);
saved=JSON.stringify({dock:ctx.CONFIG.dockApps.join(','),gaming:games.join(','),ids:oldOrder});
ids=get();assert.deepEqual(ids.slice(0,g),[...games].reverse());assert.deepEqual(ids.slice(g,g+4),['amazon','netflix','youtube.leanback.v4','com.apple.appletv']);assert.deepEqual(ids.slice(g+s),['com.webos.app.discovery','com.palmdts.devmode']);
vm.runInContext(source.slice(source.indexOf('  function moveTo(to)'),source.indexOf('  function finishEdit(keep)'))+'\nfunction layout() {} function focusTile(i) { focused=i; }',ctx);
ctx.focused=g+s-1;const before=Array.from(ctx.items,x=>x.app.id);ctx.moveTo(g+s);assert.deepEqual(Array.from(ctx.items,x=>x.app.id),before);ctx.moveTo(g+5);assert.equal(ctx.items[g+5].app.id,before[g+s-1]);
ctx.saveOrder();ids=get();assert.equal(ids[g+5],before[g+s-1]);
// Section boundaries remain valid if some installed apps are missing.
ctx.TV_APPS.apps=ctx.TV_APPS.apps.filter(a=>a.id!=='com.twin.app.gamingportal'&&a.id!=='cdp-30');
ids=get();assert.equal(ctx.gamingCount,4);assert.equal(ctx.streamingCount,9);assert.equal(ctx.rowOf(13),4);assert.equal(ctx.columnOf(13),0);assert.equal(ctx.indexAt(3,3),12);assert.equal(ctx.tileWidth(0),360);
console.log('PASS: five-game row, nearest vertical navigation, streaming 4/4/2 layout, utility separation, saved-order preservation, section-safe reordering and missing-app handling');
