const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('app/watchlist.js','utf8');
const config={streamingApps:['netflix','amazon','hulu'],watchlist:{enabled:true}};
const events={}, stored={}, c={CONFIG:config,document:{addEventListener:(n,f)=>events[n]=f},localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v}};c.window=c;vm.createContext(c);vm.runInContext(source,c);
const packet={version:1,source:'reminders',updatedAt:'2026-11-18T20:00:00Z',shows:{netflix:['Example Show','Example Show','<b>Literal Title</b>'],amazon:['Another Show'],unrelated:['Ignore']}};
let changes=0;c.TVWatchlist.onChange(()=>changes++);
c.TVWatchlist.receive({watchlist:packet});assert.deepEqual(Array.from(c.TVWatchlist.get('netflix')),['Example Show','<b>Literal Title</b>']);assert.deepEqual(Array.from(c.TVWatchlist.get('unrelated')),[]);assert.equal(changes,1);
c.TVWatchlist.receive(JSON.stringify({params:{watchlist:packet,watchlistUpdateOnly:true}}));assert.equal(changes,1);
c.CONFIG.watchlist.enabled=false;assert.equal(c.TVWatchlist.get('netflix').length,0);c.CONFIG.watchlist.enabled=true;
c.TVWatchlist.receive({watchlist:{...packet,source:'unrelated',shows:{}}});assert.equal(c.TVWatchlist.get('netflix').length,2);
c.TVWatchlist.receive({watchlist:{...packet,updatedAt:'2020-01-01T00:00:00Z',shows:{}}});assert.equal(c.TVWatchlist.get('netflix').length,2);
c.TVWatchlist.receive({watchlist:{...packet,updatedAt:'2026-11-18T20:01:00Z',shows:{}}});assert.equal(c.TVWatchlist.get('netflix').length,0);assert.equal(changes,2);
// Test the actual layout functions with a populated list, then collapse and overflow cases.
const app=fs.readFileSync('app/app.js','utf8'), layout={CONFIG:{columns:4},zone:'grid',editing:null,focused:4,gamingCount:4,streamingCount:10,COLUMNS:4,ROW_PITCH:292,GAME_TOP:360,DOCK_TOP:736,SECTION_GAP:116,CELL_W:424,TILE_W:360,items:Array.from({length:16},()=>({shows:[]}))};
vm.createContext(layout);vm.runInContext(app.slice(app.indexOf('  function dockRow()'),app.indexOf('  function build()')),layout);
layout.items[4].shows=['One','Two','Three'];assert.equal(layout.watchlistExtra(),68);assert.equal(layout.tileTop(8),1096);assert.equal(layout.otherTop(),1796);
layout.focused=5;assert.equal(layout.watchlistExtra(),0);assert.equal(layout.tileTop(8),1028);
layout.focused=4;layout.items[4].shows.push('Four');assert.equal(layout.detailSpace(4),158);layout.editing={};assert.equal(layout.watchlistExtra(),0);
console.log('PASS: watchlist privacy filtering, caching, empty-list updates, disabled mode, older updates and focused-row expansion');
