const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync('app/app.js', 'utf8');
function setup(bridge = 'webOSSystem', throws = false) {
  let now = 10000;
  const events = {}, calls = [];
  const document = { hidden: false, addEventListener(type, callback) { (events[type] ||= []).push(callback); } };
  const c = {
    document, Date: { now: () => now }, CONFIG: { startupSounds: [] },
    editing: null, focused: 0, pills: [], stopStartupSound() {}, finishEdit() {},
    releaseWatchlistFocus() {}, updateClock() {}, renderWatchlists() {}, animateIn() {}, focusTile() {},
    TVWatchlist: { receive: detail => !!detail?.watchlistUpdateOnly }
  };
  if (bridge) c[bridge] = { setCursorHidden(value) { calls.push(value); if (throws) throw Error('unsupported'); } };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('  var launchPointerHandled ='), source.indexOf('\n  hideLaunchPointer();')), c);
  const emit = (type, detail) => (events[type] || []).forEach(callback => callback({ detail }));
  return { c, document, calls, emit, advance(ms) { now += ms; } };
}
const t = setup();
t.c.hideLaunchPointer(); assert.deepEqual(t.calls, [true], 'cold Home starts without pointer');
t.emit('visibilitychange'); t.advance(100); t.emit('webOSRelaunch');
assert.equal(t.calls.length, 1, 'duplicate startup notifications must not hide the pointer twice');
t.emit('cursorStateChange', { visibility: true }); t.advance(2000); t.emit('visibilitychange');
assert.equal(t.calls.length, 1, 'remote movement and duplicate visible events leave pointer alone');
t.emit('webOSRelaunch', { watchlistUpdateOnly: true });
assert.equal(t.calls.length, 1, 'background list updates must not alter input mode');
t.emit('webOSRelaunch'); assert.equal(t.calls.length, 2, 'a later Home relaunch hides pointer again');
t.document.hidden = true; t.emit('visibilitychange'); t.emit('webOSRelaunch');
assert.equal(t.calls.length, 2, 'never change cursor while another app is visible');
t.document.hidden = false; t.emit('visibilitychange');
assert.equal(t.calls.length, 3, 'returning from another app hides pointer once');
t.emit('webOSRelaunch'); assert.equal(t.calls.length, 3);
const palm = setup('PalmSystem'); palm.c.webOSSystem = {}; palm.c.hideLaunchPointer();
assert.deepEqual(palm.calls, [true], 'legacy bridge works even if modern bridge lacks this method');
assert.doesNotThrow(() => setup(null).c.hideLaunchPointer());
assert.doesNotThrow(() => setup('webOSSystem', true).c.hideLaunchPointer());
console.log('PASS: cold/warm Home cursor hiding, movement preserved, duplicate events, hidden-app protection, watchlist-only updates and older firmware fallback');
