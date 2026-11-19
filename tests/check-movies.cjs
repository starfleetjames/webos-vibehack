const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const clock={now:Date.parse('2026-11-18T20:00:00Z')};
const context={CONFIG:{streamingApps:['netflix','amazon'],watchlist:{enabled:true}},document:{addEventListener(){}},
  localStorage:{getItem(){return null},setItem(){}},Date:{now:()=>clock.now,parse:Date.parse}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('app/movies.js','utf8'),context);
const movie={title:'Example',year:2000,mode:'stream'};
const snapshot={version:1,source:'letterboxd',region:'US',updatedAt:'2026-11-18T20:00:00Z',movies:{netflix:[movie,movie,{...movie,title:'Buy Only',mode:'buy'}],unrelated:[movie]}};
context.MovieWatchlist.receive({params:{movieWatchlist:snapshot}});
assert.equal(context.MovieWatchlist.get('netflix').length,1);assert.equal(context.MovieWatchlist.get('unrelated').length,0);
clock.now+=3*24*60*60*1000+1;assert.equal(context.MovieWatchlist.get('netflix').length,0);
context.MovieWatchlist.receive({movieWatchlist:{...snapshot,updatedAt:'2026-11-22T20:00:00Z'}});
assert.equal(context.MovieWatchlist.get('netflix').length,0,'future observations must not display');
clock.now=Date.parse('2026-11-22T20:00:00Z');assert.equal(context.MovieWatchlist.get('netflix').length,1);
context.MovieWatchlist.receive({movieWatchlist:{...snapshot,updatedAt:'2026-11-22T20:01:00Z',movies:{}}});
assert.equal(context.MovieWatchlist.get('netflix').length,0);
// Exercise actual list mixing, rendering and paging with a tiny DOM.
class Element {constructor(){this.children=[];this.classList={toggle(){}};}set textContent(value){this.text=value;this.children=[];}appendChild(child){this.children.push(child);}}
const item={shows:[],watchlistPage:0,watchlist:new Element(),el:new Element()};
const ui={document:{createElement:()=>new Element()},items:[item],focused:0,zone:'grid',editing:null,watchlistBrowsing:false};
vm.createContext(ui);const app=fs.readFileSync('app/app.js','utf8');
vm.runInContext(app.slice(app.indexOf('  function combineWatchlist('),app.indexOf('  /** Places every tile')),ui);
item.shows=ui.combineWatchlist(['Show A','Show B','Show C'],[movie,{title:'Another',year:2001,mode:'rent'}]);
assert.deepEqual(Array.from(item.shows,e=>e.title),['Show A','Show B','Example','Show C','Another']);
ui.renderWatchlist(item);assert.equal(item.watchlist.children[1].children.length,3);
assert.equal(item.watchlist.children[1].children[2].children[1].text,'(stream)');
assert.equal(ui.changeWatchlistPage(1),true);assert.equal(item.watchlistPage,1);
assert.equal(item.watchlist.children[1].children[1].children[1].text,'(rent)');
ui.changeWatchlistPage(1);assert.equal(item.watchlistPage,0);ui.changeWatchlistPage(-1);assert.equal(item.watchlistPage,1);
ui.editing={};assert.equal(ui.changeWatchlistPage(1),false);
console.log('PASS: movie filtering, expiry, future rejection, removals, mixed first page, mode badges and bidirectional paging');
