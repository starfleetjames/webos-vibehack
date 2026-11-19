const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync('app/app.js', 'utf8');
class Element {
  constructor() { this.children = []; this.events = {}; this.classList = { toggle() {}, add() {}, remove() {} }; }
  addEventListener(type, callback, options) { (this.events[type] ||= []).push({ callback, capture: options === true }); }
  setAttribute() {}
  set textContent(value) { this.text = value; this.children = []; }
  appendChild(child) { this.children.push(child); }
}
let now = 10000, nextTimer = 0;
const document = new Element(), pill = new Element(), launched = [], timers = new Map();
document.createElement = () => new Element();
const c = {
  document, pills: [pill], pillFocus: 0, tilesEl: new Element(), items: [], focused: 0, zone: 'grid', editing: null,
  watchlistBrowsing: false, ignoreHoverUntil: 0, lastKeyActivation: 0,
  KEY: { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27 },
  orderedApps: () => ['Netflix', 'Prime', 'YouTube'].map(title => ({ id: title, title })),
  TVWatchlist: { get: () => ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'] },
  Date: { now: () => now }, layout() {}, paintTile() {},
  focusTile(i) { c.focused = i; c.zone = 'grid'; },
  focusPill(i) { c.pillFocus = i; c.zone = 'top'; },
  columnOf: i => i, rowOf: () => 0, indexAt: (_, col) => col, pillAbove: () => 0,
  launch(id) { launched.push(id); }, activatePill() { launched.push('Settings'); },
  setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
  clearTimeout(id) { timers.delete(id); },
  startEdit() { c.releaseWatchlistFocus(); c.editing = {}; }, finishEdit() { c.editing = null; }
};
c.window = c;
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('  function build()'), source.indexOf('  /** Places every tile')), c);
vm.runInContext(source.slice(source.indexOf('  function pointerMayFocus()'), source.indexOf('  function focusTile(i)')), c);
vm.runInContext(source.slice(source.indexOf('  var LONG_PRESS_MS ='), source.indexOf('  // ---- lifecycle')), c);
c.build();
function send(target, type, data = {}) {
  const event = { ...data, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  const run = entries => { for (const entry of entries) { if (event.stopped) break; entry.callback(event); } };
  run((document.events[type] || []).filter(entry => entry.capture));
  if (target !== document) run(target.events[type] || []);
  run((document.events[type] || []).filter(entry => !entry.capture));
  return event;
}
const tile = i => c.items[i].el;
send(tile(1), 'mouseover'); assert.equal(c.focused, 1, 'normal pointer navigation works');
send(document, 'cursorStateChange', { detail: { visibility: true } });
send(tile(2), 'mouseover'); assert.equal(c.focused, 1, 'pointer wake must not steal focus before wheel');
assert(send(document, 'wheel', { deltaY: 1 }).prevented);
assert.equal(c.items[1].watchlistPage, 1);
assert.match(c.items[1].watchlist.children.at(-1).text, /Arrows to leave/);
now += 60000;
send(tile(2), 'mouseover'); send(tile(2), 'mousemove'); send(pill, 'mouseover'); send(pill, 'mousemove');
assert.equal(c.focused, 1); assert.equal(c.zone, 'grid', 'pointer drift cannot select tiles or Settings, even after a pause');
send(document, 'wheel', { deltaY: 1 }); assert.equal(c.items[1].watchlistPage, 2);
send(document, 'wheel', { deltaY: 1 }); assert.equal(c.items[1].watchlistPage, 2, 'wheel throttle retained');
now += 250; send(document, 'wheel', { deltaY: -1 }); assert.equal(c.items[1].watchlistPage, 1);
send(tile(2), 'click'); assert.deepEqual(launched, ['Prime'], 'pointer-mode OK must open the highlighted app');
launched.length = 0;
send(document, 'keydown', { keyCode: 13 });
send(tile(2), 'click'); assert.equal(launched.length, 0, 'click during held OK must not launch');
send(document, 'keyup', { keyCode: 13 }); send(tile(2), 'click');
assert.deepEqual(launched, ['Prime'], 'keyboard OK plus synthetic click launches once');
send(document, 'keydown', { keyCode: 39 });
assert.equal(c.focused, 2); assert.equal(c.watchlistBrowsing, false, 'arrow releases lock and changes app');
send(tile(0), 'mouseover'); assert.equal(c.focused, 2, 'layout hover cannot undo arrow navigation');
now += 501; send(tile(0), 'mousemove'); assert.equal(c.focused, 0, 'intentional pointer navigation resumes');
send(document, 'wheel', { deltaY: 1 }); assert.equal(c.watchlistBrowsing, true);
send(document, 'keydown', { keyCode: 461 });
assert.equal(c.focused, 0); assert.equal(c.watchlistBrowsing, false, 'Back unlocks without changing app');
assert.match(c.items[0].watchlist.children.at(-1).text, /Scroll wheel/);
now += 501; send(pill, 'mousemove'); assert.equal(c.zone, 'top');
c.zone = 'grid'; c.items[0].shows = ['One', 'Two'];
assert.equal(send(document, 'wheel', { deltaY: 1 }).prevented, false);
assert.equal(c.watchlistBrowsing, false, 'short lists must not trap pointer navigation');
console.log('PASS: pointer wake, persistent drift protection, wheel paging, focused OK, duplicate click suppression, arrow/Back exit, Settings and short lists');
