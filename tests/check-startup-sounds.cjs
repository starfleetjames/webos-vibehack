const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const config = { window: {} };
vm.runInNewContext(fs.readFileSync('app/config.js', 'utf8'), config);
const tracks = config.window.CONFIG.startupSounds;
assert.equal(tracks.length, 0, 'public defaults contain no private audio');
tracks.push(...Array.from({length:5}, (_,i) => 'audio/example-' + i + '.mp3'));

class Events {
  constructor() { this.events = {}; }
  addEventListener(type, callback) { (this.events[type] ||= new Set()).add(callback); }
  removeEventListener(type, callback) { this.events[type]?.delete(callback); }
  emit(type, detail) { [...(this.events[type] || [])].forEach(callback => callback({ detail })); }
  count(type) { return this.events[type]?.size || 0; }
}

function setup() {
  let now = 10000, random = 0, mode = 'ok', nextTimer = 0;
  const timers = new Map(), document = new Events(), sound = new Events(), played = [];
  document.hidden = false;
  sound.play = () => {
    played.push(sound.src);
    if (mode === 'blocked') return Promise.reject({ name: 'NotAllowedError' });
    sound.emit('playing');
  };
  sound.pause = () => {};
  sound.load = () => {};
  sound.removeAttribute = name => { delete sound[name]; };
  const context = {
    CONFIG: config.window.CONFIG, document, $: () => sound,
    stopStartupSound: () => {}, editing: null, focused: 0, pills: [],
    finishEdit: () => {}, releaseWatchlistFocus: () => {}, updateClock: () => {}, renderWatchlists: () => {}, animateIn: () => {}, focusTile: () => {},
    Math: Object.assign(Object.create(Math), { random: () => random }), Date: { now: () => now },
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    TVWatchlist: { receive: detail => !!detail?.watchlistUpdateOnly }
  };
  context.window = context;
  const app = fs.readFileSync('app/app.js', 'utf8');
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('  var launchPointerHandled ='), app.indexOf('\n  hideLaunchPointer();')), context);
  return {
    context, sound, document, played, timers,
    random: value => { random = value; }, advance: ms => { now += ms; },
    mode: value => { mode = value; },
    hide: () => { document.hidden = true; document.emit('visibilitychange'); },
    show: () => { document.hidden = false; document.emit('visibilitychange'); },
    relaunch: detail => document.emit('webOSRelaunch', detail)
  };
}

(async () => {
  // Every configured track is selectable, including both random boundaries.
  tracks.forEach((track, index) => {
    const t = setup(); t.random(index === 4 ? 0.999999 : index / tracks.length);
    t.context.playStartupSound(); assert.deepEqual(t.played, [track]);
    t.sound.emit('ended');
    assert.equal(t.document.count('keydown'), 0);
    assert.equal(t.sound.count('ended'), 0);
    assert.equal(t.sound.count('error'), 0);
    assert.equal(t.sound.count('playing'), 0);
    assert.equal(t.sound.src, undefined);
  });

  const t = setup(); t.context.playStartupSound();
  t.advance(100); t.relaunch(); t.show();
  assert.equal(t.played.length, 1, 'duplicate cold-launch notifications must not replay');
  t.hide(); assert.equal(t.sound.src, undefined);
  t.random(0.4); t.relaunch(); assert.equal(t.played.length, 1, 'hidden relaunch waits for visibility');
  t.show(); assert.equal(t.played.at(-1), tracks[2]);
  t.advance(100); t.relaunch(); assert.equal(t.played.length, 2, 'visible then relaunch is one opening');
  t.hide(); t.show(); assert.equal(t.played.length, 3, 'a new opening can occur within one second');
  t.advance(2000); t.relaunch(); assert.equal(t.played.length, 4, 'explicit visible relaunch gets a new pick');
  t.show(); assert.equal(t.played.length, 4);
  t.advance(2000); t.relaunch({ watchlistUpdateOnly: true }); assert.equal(t.played.length, 4);
  assert.equal(t.sound.count('ended'), 1, 'relaunches must not accumulate audio listeners');
  assert.equal(t.document.count('keydown'), 1);

  const retry = setup(); retry.mode('blocked'); retry.context.playStartupSound();
  await Promise.resolve(); retry.mode('ok'); retry.document.emit('keydown');
  assert.equal(retry.played.length, 2); assert.equal(retry.played[0], retry.played[1]);
  assert.equal(retry.timers.size, 0, 'playing clears delayed-start timeout');
  retry.hide(); retry.document.emit('keydown'); assert.equal(retry.played.length, 2);

  const stale = setup(); stale.mode('blocked'); stale.context.playStartupSound();
  stale.hide(); stale.mode('ok'); stale.random(0.8); stale.show();
  await Promise.resolve();
  assert.equal(stale.sound.src, tracks[4], 'a stale rejected attempt cannot stop the next jingle');
  stale.context.stopStartupSound();
  assert.equal(stale.sound.src, undefined);
  console.log('PASS: all five random choices, cold/warm opens, duplicate notifications, hidden playback, watchlist-only updates, gesture retry and decoder/listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
