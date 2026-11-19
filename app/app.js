/*
 * tvOS style home for webOS: black, gaming and streaming sections, and one glass highlight that
 * springs between tiles. A port of the Android launcher in ../../launcher.
 *
 * webOS does not let third-party apps list installed apps, so sync-apps.py writes them into apps.js.
 */
(function () {
  'use strict';

  var COLUMNS = Math.max(1, CONFIG.columns || 4);
  var TILE_W = 360, TILE_H = 202;
  var CELL_W = (1920 - 2 * 112) / COLUMNS;
  var ROW_PITCH = 292;
  var GAME_TOP = 360, DOCK_TOP = 736;   // both highlighted rows fit on the opening screen
  var SECTION_GAP = 116;        // space for the Other apps heading below the streaming panel
  var FOCUS_SCALE = 1.1;
  var GLASS_PAD = 12;           // room for the glass glow around the scaled tile
  var VIEW_TOP = 80, VIEW_BOTTOM = 1060;    // area grid rows scroll into (the header hides below the dock)

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27 };

  var GREETINGS = [[5, 'Good night'], [12, 'Good morning'], [17, 'Good afternoon'], [22, 'Good evening'], [24, 'Good night']];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), tilesEl = $('tiles'), glass = $('glass');
  var ambients = [$('ambientA'), $('ambientB')], ambientFront = 0, ambientColor = null;
  var pills = [$('btnSettings')];

  var items = [];               // {app, el, color}
  var zone = 'grid';            // 'grid' | 'top'
  var focused = 0, pillFocus = 0;
  var offset = 0, glassShown = false, gamingCount = 0, streamingCount = 0;
  var editing = null;           // {item, snapshot} while a tile is being moved
  var stopStartupSound = function () {};
  var watchlistBrowsing = false, ignoreHoverUntil = 0, lastKeyActivation = 0;

  // ---- luna bus ------------------------------------------------------------------------------

  var bridges = [];   // keep a reference: a collected bridge drops its callback

  function luna(uri, params, cb) {
    try {
      var b = new PalmServiceBridge();
      b.onservicecallback = function (msg) {
        var res;
        try { res = JSON.parse(msg); } catch (e) { res = { returnValue: false }; }
        if (cb) cb(res);
        if (!params || !params.subscribe) bridges.splice(bridges.indexOf(b), 1);
      };
      bridges.push(b);
      b.call(uri, JSON.stringify(params || {}));
    } catch (e) {
      if (cb) cb({ returnValue: false, errorText: String(e) });   // not on a TV (desktop preview)
    }
  }

  var cecLaunchPending = false;

  function launch(id, title, params) {
    stopStartupSound();
    var shortcut = (CONFIG.inputApps || []).filter(function (app) { return app.id === id; })[0];
    if (shortcut && shortcut.cec) {
      if (cecLaunchPending) return;
      cecLaunchPending = true;
      CECInput.resolve(shortcut, luna, function (error, targetParams) {
        cecLaunchPending = false;
        if (error) { toast(error); return; }
        launchNative(shortcut.launchAppId, title, targetParams);
      });
      return;
    }
    launchNative(id, title, params);
  }

  function launchNative(id, title, params) {
    luna('luna://com.webos.applicationManager/launch', { id: id, params: params || {} }, function (res) {
      if (res.returnValue === false) toast("Can't open " + (title || id));
    });
  }

  var toastTimer;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('shown'); }, 2200);
  }

  // ---- apps ----------------------------------------------------------------------------------

  function orderedApps() {
    var all = (window.TV_APPS && TV_APPS.apps) || [];
    var inputApps = CONFIG.inputApps || [];
    var inputIds = {};
    inputApps.forEach(function (a) { inputIds[a.id] = true; });
    // A TV-discovered HDMI app must not duplicate its branded shortcut.
    all = all.filter(function (a) { return !inputIds[a.id]; }).concat(inputApps);
    var byId = {};
    all.forEach(function (a) { byId[a.id] = a; });
    var hidden = {};
    (CONFIG.hiddenApps || []).forEach(function (id) { hidden[id] = true; });
    var byTitle = function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; };

    // Keep games together, migrating the old single-dock order without disturbing favorites.
    var saved = loadOrder();
    var gameIds = CONFIG.gamingApps || [];
    var gameOrder = saved ? saved.ids.concat(gameIds) : gameIds;
    var games = [];
    gameOrder.forEach(function (id) {
      if (gameIds.indexOf(id) !== -1 && byId[id] && !hidden[id]) {
        games.push(byId[id]); hidden[id] = true;
      }
    });
    gamingCount = games.length;

    var streamIds = CONFIG.streamingApps || [];
    var streamOrder = (saved ? saved.ids : (CONFIG.dockApps || [])).concat(streamIds);
    var streaming = [];
    streamOrder.forEach(function (id) {
      if (streamIds.indexOf(id) !== -1 && byId[id] && !hidden[id]) {
        streaming.push(byId[id]); hidden[id] = true;
      }
    });
    streamingCount = streaming.length;

    var other = [];
    if (saved) saved.ids.forEach(function (id) {
      if (byId[id] && !hidden[id]) { other.push(byId[id]); hidden[id] = true; }
    });
    return games.concat(streaming, other, all.filter(function (a) { return !hidden[a.id]; }).sort(byTitle));
  }

  var ORDER_KEY = 'tvhome.order';

  function loadOrder() {
    try {
      var s = JSON.parse(localStorage.getItem(ORDER_KEY));
      return s && Array.isArray(s.ids) && s.dock === (CONFIG.dockApps || []).join(',') ? s : null;
    } catch (e) {
      return null;
    }
  }

  function saveOrder() {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify({
        dock: (CONFIG.dockApps || []).join(','),
        gaming: (CONFIG.gamingApps || []).join(','),
        ids: items.map(function (it) { return it.app.id; })
      }));
    } catch (e) { /* storage unavailable: the order lasts until the app restarts */ }
  }

  function dockRow() { return gamingCount ? 1 : 0; }
  function streamingRows() { return Math.ceil(streamingCount / COLUMNS); }
  function sectionOf(i) { return i < gamingCount ? 'gaming' : i < gamingCount + streamingCount ? 'streaming' : 'other'; }
  function rowOf(i) {
    if (i < gamingCount) return 0;
    if (i < gamingCount + streamingCount) return dockRow() + Math.floor((i - gamingCount) / COLUMNS);
    return dockRow() + streamingRows() + Math.floor((i - gamingCount - streamingCount) / COLUMNS);
  }
  function columnOf(i) {
    if (i < gamingCount) return i;
    return (i - gamingCount - (sectionOf(i) === 'other' ? streamingCount : 0)) % COLUMNS;
  }
  function indexAt(row, col) {
    if (row < 0 || row > rowOf(items.length - 1)) return -1;
    if (gamingCount && row === 0) return Math.min(col, gamingCount - 1);
    col = Math.min(col, COLUMNS - 1);
    if (row < dockRow() + streamingRows()) {
      return Math.min(gamingCount + (row - dockRow()) * COLUMNS + col, gamingCount + streamingCount - 1);
    }
    return Math.min(gamingCount + streamingCount + (row - dockRow() - streamingRows()) * COLUMNS + col, items.length - 1);
  }
  function rowColumns(i) { return sectionOf(i) === 'gaming' ? Math.max(COLUMNS, gamingCount) : COLUMNS; }
  function cellWidth(i) { return (1920 - 2 * 112) / rowColumns(i); }
  function tileWidth(i) { return cellWidth(i) - (CELL_W - TILE_W); }
  function tileLeft(i) { return 112 + columnOf(i) * cellWidth(i) + (CELL_W - TILE_W) / 2; }
  function neighborInRow(row, from) {
    var center = tileLeft(from) + tileWidth(from) / 2, best = -1, distance = Infinity;
    items.forEach(function (item, i) {
      if (rowOf(i) !== row) return;
      var d = Math.abs(tileLeft(i) + tileWidth(i) / 2 - center);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  }
  function detailSpace(i) {
    var count = items[i] && items[i].shows ? items[i].shows.length : 0;
    if (zone !== 'grid' || editing || !count) return 70;
    return Math.max(70, 60 + Math.min(3, count) * 26 + (count > 3 ? 20 : 0));
  }
  function watchlistExtra() { return sectionOf(focused) === 'streaming' ? detailSpace(focused) - 70 : 0; }
  function otherTop() { return DOCK_TOP + streamingRows() * ROW_PITCH + (streamingCount ? SECTION_GAP : 0) + watchlistExtra(); }
  function tileTop(i) {
    var r = rowOf(i);
    if (gamingCount && r === 0) return GAME_TOP;
    if (sectionOf(i) === 'streaming') return DOCK_TOP + (r - dockRow()) * ROW_PITCH + (r > rowOf(focused) ? watchlistExtra() : 0);
    return otherTop() + (r - dockRow() - streamingRows()) * ROW_PITCH;
  }

  function build() {
    tilesEl.innerHTML = '';
    items = orderedApps().map(function (app) {
      var el = document.createElement('div');
      el.className = 'item';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', app.title);
      el.setAttribute('data-app-id', app.id);
      var card = document.createElement('div');
      card.className = 'card';
      var img = document.createElement('img');
      var item = { app: app, el: el, card: card, color: null, shows: [], watchlistPage: 0 };
      img.onload = function () { paintTile(item, img); };
      img.src = app.icon;
      card.appendChild(img);
      el.appendChild(card);
      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = app.title;
      el.appendChild(name);
      item.watchlist = document.createElement('div');
      item.watchlist.className = 'watchlist';
      el.appendChild(item.watchlist);
      function hoverTile() {
        var i = items.indexOf(item);
        if (pointerMayFocus() && (zone !== 'grid' || focused !== i)) focusTile(i);
      }
      el.addEventListener('mouseover', hoverTile);
      el.addEventListener('mousemove', hoverTile);
      el.addEventListener('click', function () {
        if (editing) finishEdit(true);
        else launch(app.id, app.title);
      });
      tilesEl.appendChild(el);
      return item;
    });
    renderWatchlists();
    layout();
  }

  function combineWatchlist(shows, movies) {
    var entries = shows.map(function (title) { return { title: title, mode: 'show' }; });
    // Let both kinds appear immediately, while keeping the first two shows at the top.
    if (entries.length > 2 && movies.length) return entries.slice(0, 2).concat(movies.slice(0, 1), entries.slice(2), movies.slice(1));
    return entries.concat(movies);
  }

  function renderWatchlist(it) {
      it.watchlist.textContent = '';
      it.el.classList.toggle('hasWatchlist', it.shows.length > 0);
      if (!it.shows.length) return;
      var heading = document.createElement('div');
      heading.className = 'watchlistHeading';
      heading.textContent = 'Your list';
      it.watchlist.appendChild(heading);
      var lines = document.createElement('div');
      lines.className = it.shows.length > 3 ? 'watchlistLines paged' : 'watchlistLines';
      it.watchlist.appendChild(lines);
      var start = (it.watchlistPage || 0) * 3;
      it.shows.slice(start, start + 3).forEach(function (entry) {
        var line = document.createElement('div');
        line.className = 'watchlistTitle';
        var title = document.createElement('span');
        title.className = 'watchlistText';
        title.textContent = entry.title;
        line.appendChild(title);
        if (entry.mode === 'stream' || entry.mode === 'rent') {
          var mode = document.createElement('span');
          mode.className = 'watchlistMode';
          mode.textContent = '(' + entry.mode + ')';
          line.appendChild(mode);
        }
        lines.appendChild(line);
      });
      if (it.shows.length > 3) {
        var more = document.createElement('div');
        more.className = 'watchlistMore';
        more.textContent = ((it.watchlistPage || 0) + 1) + ' of ' + Math.ceil(it.shows.length / 3) +
          (watchlistBrowsing ? ' · Arrows to leave' : ' · Scroll wheel');
        it.watchlist.appendChild(more);
      }
  }

  function renderWatchlists() {
    items.forEach(function (it) {
      var shows = window.TVWatchlist ? TVWatchlist.get(it.app.id) : [];
      var movies = window.MovieWatchlist ? MovieWatchlist.get(it.app.id) : [];
      it.shows = combineWatchlist(shows, movies);
      it.watchlistPage = 0;
      renderWatchlist(it);
    });
  }

  function changeWatchlistPage(direction) {
    var it = items[focused];
    if (zone !== 'grid' || editing || !it || it.shows.length <= 3) return false;
    var pages = Math.ceil(it.shows.length / 3);
    it.watchlistPage = ((it.watchlistPage || 0) + direction + pages) % pages;
    renderWatchlist(it);
    return true;
  }

  /** Places every tile by its position in items; tiles glide when the order changes. */
  function layout() {
    items.forEach(function (it, i) {
      it.el.style.left = tileLeft(i) + 'px';
      it.el.style.top = tileTop(i) + 'px';
      it.el.style.width = it.card.style.width = tileWidth(i) + 'px';
      it.el.setAttribute('data-section', sectionOf(i));
    });
    placeBand('gamingBand', 'gamingLabel', 0, gamingCount, GAME_TOP, 28);
    placeBand('dockBand', 'streamingLabel', gamingCount, streamingCount, DOCK_TOP, 72);
    $('dockBand').style.height = (parseFloat($('dockBand').style.height) + watchlistExtra()) + 'px';
    $('otherLabel').style.display = items.length > gamingCount + streamingCount ? 'block' : 'none';
    $('otherLabel').style.top = (otherTop() - 84) + 'px';
  }

  function placeBand(bandId, labelId, start, count, top, bottomPad) {
    var band = $(bandId), label = $(labelId);
    band.style.display = label.style.display = count ? 'block' : 'none';
    band.style.left = (tileLeft(start) - 28) + 'px';
    band.style.top = (top - 28) + 'px';
    var columns = rowColumns(start);
    band.style.width = ((Math.min(count, columns) - 1) * cellWidth(start) + tileWidth(start) + 56) + 'px';
    band.style.height = (Math.max(0, Math.ceil(count / columns) - 1) * ROW_PITCH + TILE_H + 28 + bottomPad) + 'px';
    label.style.top = (top - 84) + 'px';
  }

  function animateIn() {
    items.forEach(function (it, i) {
      it.el.classList.remove('shown');
      setTimeout(function () { it.el.classList.add('shown'); }, 60 + Math.min(i, 16) * 40);
    });
  }

  /**
   * Store icons are square logos on a solid colour: fill the wide tile with that colour so the logo
   * reads as a banner. LG's system icons are glyphs on transparent: use the app's own colour.
   */
  function paintTile(item, img) {
    var px = null, edge = null;
    try {
      var c = document.createElement('canvas');
      c.width = 12; c.height = 12;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 12, 12);
      px = g.getImageData(0, 0, 12, 12).data;
      edge = edgeColor(img);
    } catch (e) { /* tainted canvas: fall back to the app's colour */ }

    var glyphColor = null;
    if (edge && edge[3] > 200) {
      item.card.style.background = 'rgb(' + edge[0] + ',' + edge[1] + ',' + edge[2] + ')';
    } else {
      item.card.classList.add('glyph');
      item.card.style.background = glyphBackground(item.app.iconColor);
      glyphColor = glyphBackground(item.app.iconColor) === '#2c2c2e' ? null : parseColor(item.app.iconColor);
    }
    // A white glyph says nothing about the app: glow in the tile's colour instead.
    item.color = glyphColor || (px ? vividColor(px) : parseColor(item.app.iconColor));
    if (items[focused] === item) setAmbient(item.color);
  }

  /**
   * The icon's background at full size: a corner pixel, or the middle of the left edge for rounded
   * icons whose corners are transparent. A downscaled sample would blend in the logo.
   */
  function edgeColor(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    var corner = g.getImageData(2, 2, 1, 1).data;
    return corner[3] > 200 ? corner : g.getImageData(2, Math.floor(h / 2), 1, 1).data;
  }

  function glyphBackground(hex) {
    var c = parseColor(hex);
    if (!c) return '#2c2c2e';
    var hsv = rgbToHsv(c);
    if (hsv[1] < 0.15 && (hsv[2] > 0.85 || hsv[2] < 0.1)) return '#2c2c2e';   // white or black glyph colour
    return 'rgb(' + c.join(',') + ')';
  }

  /** A vivid colour from the icon: the most saturated, not too dark pixel, or the lifted average. */
  function vividColor(px) {
    var best = null, bestScore = -1, sum = [0, 0, 0], n = 0;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var p = [px[i], px[i + 1], px[i + 2]];
      sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
      var hsv = rgbToHsv(p);
      var score = hsv[1] * Math.min(1, hsv[2] * 1.4);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!n) return [68, 68, 68];
    if (bestScore < 0.25) {   // nearly monochrome icon (e.g. white): its average, lifted
      var avg = rgbToHsv([sum[0] / n, sum[1] / n, sum[2] / n]);
      avg[2] = Math.max(avg[2], 0.55);
      return hsvToRgb(avg);
    }
    var h = rgbToHsv(best);
    h[1] = Math.min(1, h[1] * 1.1);
    h[2] = Math.max(0.5, h[2]);
    return hsvToRgb(h);
  }

  function parseColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }

  function rgbToHsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  }

  function hsvToRgb(hsv) {
    var h = hsv[0], s = hsv[1], v = hsv[2];
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map(function (k) { return Math.round((k + m) * 255); });
  }

  // ---- focus & glass -------------------------------------------------------------------------

  function pointerMayFocus() {
    return !editing && !watchlistBrowsing && Date.now() >= ignoreHoverUntil;
  }

  function releaseWatchlistFocus() {
    ignoreHoverUntil = Date.now() + 500;  // Ignore hover events caused by the grid sliding under the cursor.
    if (!watchlistBrowsing) return;
    watchlistBrowsing = false;
    if (items[focused]) renderWatchlist(items[focused]);
  }

  function focusTile(i) {
    if (!items.length) return;
    i = Math.max(0, Math.min(i, items.length - 1));
    setZone('grid');
    if (items[focused]) items[focused].el.classList.remove('focused');
    if (focused !== i && items[i].watchlistPage) {
      items[i].watchlistPage = 0;
      renderWatchlist(items[i]);
    }
    focused = i;
    items[i].el.classList.add('focused');
    layout();

    var top = tileTop(i), row = rowOf(i);
    if (row <= dockRow()) {
      offset = 0;
    }
    // Include the selected service's show titles in the visible area.
    if (top - offset + TILE_H + detailSpace(i) > VIEW_BOTTOM) offset = top + TILE_H + detailSpace(i) - VIEW_BOTTOM;
    if (top - offset - 24 < VIEW_TOP) offset = top - 24 - VIEW_TOP;
    stage.style.transform = 'translateY(' + (-offset) + 'px)';
    // Hide the header before a row label scrolls into it.
    var header = document.querySelector('header');
    var headerBottom = header.offsetTop + header.offsetHeight;   // layout box: ignores the hide slide
    document.body.classList.toggle('scrolled', (gamingCount ? GAME_TOP : DOCK_TOP) - 84 - offset < headerBottom + 24);

    var w = tileWidth(i) * FOCUS_SCALE + 2 * GLASS_PAD, h = TILE_H * FOCUS_SCALE + 2 * GLASS_PAD;
    var x = tileLeft(i) + tileWidth(i) / 2 - w / 2, y = top + TILE_H / 2 - h / 2;
    glass.style.width = w + 'px';
    glass.style.height = h + 'px';
    glass.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    if (!glassShown) {
      // First show: jump there without the spring, then fade in.
      glass.style.transition = 'none';
      glass.offsetWidth;   // flush the jump before restoring the transition
      glass.style.transition = '';
      glass.style.opacity = '1';
      glassShown = true;
    }

    setAmbient(items[i].color);   // the glow follows the focused tile in every row
  }

  function hideGlass() {
    glassShown = false;
    glass.style.opacity = '0';
  }

  /** Crossfades the glow to a new colour by swapping between two layers. */
  function setAmbient(color) {
    if (!color) return;
    var key = color.join(',');
    if (key === ambientColor) return;
    ambientColor = key;
    var back = ambients[1 - ambientFront];
    back.style.background = 'radial-gradient(circle 1190px at 32% 42%, rgba(' + key + ',0.36) 0%, rgba(' +
      key + ',0.15) 50%, rgba(' + key + ',0) 100%)';
    back.style.opacity = '1';
    ambients[ambientFront].style.opacity = '0';
    ambientFront = 1 - ambientFront;
  }

  function focusPill(i) {
    setZone('top');
    layout();
    document.body.classList.remove('scrolled');
    offset = 0;
    stage.style.transform = 'translateY(0px)';
    pills[pillFocus].classList.remove('focused');
    pillFocus = Math.max(0, Math.min(i, pills.length - 1));
    pills[pillFocus].classList.add('focused');
  }

  function setZone(z) {
    if (zone === z) return;
    if (zone === 'top') pills[pillFocus].classList.remove('focused');
    if (zone === 'grid') {
      if (items[focused]) items[focused].el.classList.remove('focused');
      hideGlass();
    }
    zone = z;
  }

  /** The pill straight above a dock tile, by horizontal distance. */
  function pillAbove(i) {
    var cx = tileLeft(i) + tileWidth(i) / 2, best = 0, bestD = Infinity;
    pills.forEach(function (p, k) {
      var r = p.getBoundingClientRect();
      var d = Math.abs(r.left + r.width / 2 - cx);
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }

  // ---- top bar -------------------------------------------------------------------------------

  function updateClock() {
    var now = new Date(), h = now.getHours();
    for (var k = 0; k < GREETINGS.length; k++) {
      if (h < GREETINGS[k][0]) { $('greetingText').textContent = GREETINGS[k][1] + (CONFIG.greetingName ? ', ' + CONFIG.greetingName : ''); break; }
    }
    var m = now.getMinutes();
    $('clock').textContent = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
    $('ampm').textContent = h < 12 ? 'am' : 'pm';
    $('weekday').textContent = DAYS[now.getDay()];
    $('date').textContent = now.getFullYear() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getDate();
  }

  function activatePill() {
    launch('com.palm.app.settings', 'Settings');
  }

  // ---- rearranging ---------------------------------------------------------------------------

  /** Hold OK on a tile: it wiggles, the arrows move it, OK places it, Back puts everything back. */
  function startEdit() {
    var it = items[focused];
    if (!it) return;
    releaseWatchlistFocus();
    editing = { item: it, snapshot: items.slice() };
    it.el.classList.add('moving');
    document.body.classList.add('editing');
    toast('Arrows to move  ·  OK to place  ·  Back to cancel');
    focusTile(focused);
  }

  function moveTo(to) {
    if (to < 0 || to >= items.length || to === focused) return;
    // Rearrange within each section so utilities stay outside the streaming panel.
    if (sectionOf(focused) !== sectionOf(to)) return;
    items.splice(to, 0, items.splice(focused, 1)[0]);
    focused = to;
    layout();
    focusTile(to);
  }

  function finishEdit(keep) {
    var it = editing.item;
    if (!keep) {
      items = editing.snapshot;
      layout();
    }
    editing = null;
    it.el.classList.remove('moving');
    document.body.classList.remove('editing');
    if (keep) saveOrder();
    focused = items.indexOf(it);
    focusTile(focused);
  }

  // ---- keys ----------------------------------------------------------------------------------

  var LONG_PRESS_MS = 600;
  var okDown = false, okTimer = null;
  var lastWatchlistWheel = 0;

  // The pointer can wake before the first wheel event. Give that event a chance to lock the list.
  document.addEventListener('cursorStateChange', function (e) {
    if (e.detail && e.detail.visibility) ignoreHoverUntil = Date.now() + 300;
  });

  // The Magic Remote's wheel works in both pointer and directional navigation modes.
  document.addEventListener('wheel', function (e) {
    var it = items[focused];
    if (!e.deltaY || zone !== 'grid' || editing || !it || it.shows.length <= 3) return;
    e.preventDefault();
    watchlistBrowsing = true;
    var now = Date.now();
    if (now - lastWatchlistWheel < 220) return;
    lastWatchlistWheel = now;
    changeWatchlistPage(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // In pointer mode the wheel's OK press can arrive as a click at the cursor's location.
  // While browsing a list, that press belongs to the highlighted service, wherever the cursor is.
  document.addEventListener('click', function (e) {
    if (!watchlistBrowsing || zone !== 'grid' || editing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (okDown || Date.now() - lastKeyActivation < 500) return;
    var it = items[focused];
    if (it) launch(it.app.id, it.app.title);
  }, true);

  // On tiles OK acts on release, so a held OK can start rearranging instead of opening the app.
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== KEY.OK) return;
    okDown = false;
    if (!okTimer) return;
    clearTimeout(okTimer);
    okTimer = null;
    var it = items[focused];
    if (zone === 'grid' && it && !editing) {
      lastKeyActivation = Date.now();
      launch(it.app.id, it.app.title);
    }
  });

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.UP || k === KEY.DOWN || k === KEY.BACK || k === KEY.ESC) {
      releaseWatchlistFocus();
    }
    // Yellow/blue are optional remote alternatives; Page Up/Down also work on keyboards.
    if (k === 33 || k === 34 || k === 405 || k === 406) {
      if (changeWatchlistPage(k === 33 || k === 405 ? -1 : 1)) e.preventDefault();
      return;
    }
    if (k === KEY.OK && okDown) { e.preventDefault(); return; }   // key repeat while held
    if (k === KEY.OK) okDown = true;
    if (editing) {
      if (k === KEY.LEFT) moveTo(focused - 1);
      else if (k === KEY.RIGHT) moveTo(focused + 1);
      else if (k === KEY.UP) moveTo(indexAt(rowOf(focused) - 1, columnOf(focused)));
      else if (k === KEY.DOWN) moveTo(indexAt(rowOf(focused) + 1, columnOf(focused)));
      else if (k === KEY.OK) finishEdit(true);
      else if (k === KEY.BACK || k === KEY.ESC) finishEdit(false);
      else return;
    } else if (zone === 'top') {
      if (k === KEY.LEFT) focusPill(pillFocus - 1);
      else if (k === KEY.RIGHT) focusPill(pillFocus + 1);
      else if (k === KEY.DOWN) focusTile(rowOf(focused) === 0 ? focused : 0);
      else if (k === KEY.OK) activatePill(pillFocus);
      else if (k === KEY.BACK) { /* home screen: Back goes nowhere */ }
      else return;
    } else {
      var col = columnOf(focused), last = items.length - 1;
      if (k === KEY.LEFT) { if (col > 0) focusTile(focused - 1); }
      else if (k === KEY.RIGHT) { if (focused < last && rowOf(focused + 1) === rowOf(focused)) focusTile(focused + 1); }
      else if (k === KEY.UP) {
        if (rowOf(focused) === 0) focusPill(pillAbove(focused));
        else focusTile(neighborInRow(rowOf(focused) - 1, focused));
      } else if (k === KEY.DOWN) {
        if (rowOf(focused) < rowOf(last)) focusTile(neighborInRow(rowOf(focused) + 1, focused));
      } else if (k === KEY.OK) {
        okTimer = setTimeout(function () { okTimer = null; startEdit(); }, LONG_PRESS_MS);
      } else if (k === KEY.BACK) { /* home screen: Back goes nowhere */ }
      else return;
    }
    e.preventDefault();
  });

  pills.forEach(function (p, i) {
    function hoverPill() {
      if (pointerMayFocus() && (zone !== 'top' || pillFocus !== i)) focusPill(i);
    }
    p.addEventListener('mouseover', hoverPill);
    p.addEventListener('mousemove', hoverPill);
    p.addEventListener('click', function () { activatePill(i); });
  });

  // ---- lifecycle -----------------------------------------------------------------------------

  var launchPointerHandled = false, launchPointerHandledAt = 0;

  /** Start Home in button mode; webOS can show the pointer again when the remote moves. */
  function hideLaunchPointer(relaunch) {
    if (document.hidden) return;
    var now = Date.now();
    // Visibility and relaunch can describe the same opening. Do not hide it again after a wave.
    if (launchPointerHandled && (!relaunch || now - launchPointerHandledAt < 1000)) return;
    launchPointerHandled = true;
    launchPointerHandledAt = now;
    var system = window.webOSSystem;
    if (!system || typeof system.setCursorHidden !== 'function') system = window.PalmSystem;
    if (!system || typeof system.setCursorHidden !== 'function') return;
    try { system.setCursorHidden(true); }
    catch (e) { /* Older firmware and browser previews may not expose cursor control. */ }
  }

  var startupSoundStarted = false, startupSoundStartedAt = 0;

  /** Choose one jingle per opening; visibility and relaunch can describe the same opening. */
  function playStartupSound(relaunch) {
    var tracks = (CONFIG.startupSounds || []).filter(function (track) { return typeof track === 'string' && track; });
    if (!tracks.length || document.hidden) return;
    var now = Date.now();
    if (startupSoundStarted && (!relaunch || now - startupSoundStartedAt < 1000)) return;
    startupSoundStarted = true;
    startupSoundStartedAt = now;
    stopStartupSound();
    var sound = $('startupSound'), finished = false, pending = false, retry = false;
    var retryTimer;

    function stop() {
      if (finished) return;
      finished = true;
      clearTimeout(retryTimer);
      document.removeEventListener('keydown', onGesture);
      document.removeEventListener('click', onGesture);
      sound.removeEventListener('ended', stop);
      sound.removeEventListener('error', stop);
      sound.removeEventListener('playing', onPlaying);
      sound.pause();
      sound.removeAttribute('src');
      sound.load();             // release the TV's media decoder before another app opens
    }
    function rejected(err) {
      pending = false;
      if (!finished && err && err.name === 'NotAllowedError') retry = true;
      else stop();
    }
    function attempt() {
      if (finished || pending || document.hidden) return;
      pending = true;
      retry = false;
      try {
        var result = sound.play();
        if (result && result.then) result.then(function () { pending = false; }, rejected);
        else pending = false;
      } catch (err) { rejected(err); }
    }
    function onGesture() { if (retry) attempt(); }
    function onPlaying() { clearTimeout(retryTimer); }

    stopStartupSound = stop;
    sound.addEventListener('ended', stop);
    sound.addEventListener('error', stop);
    sound.addEventListener('playing', onPlaying);
    document.addEventListener('keydown', onGesture);
    document.addEventListener('click', onGesture);
    sound.src = tracks[Math.floor(Math.random() * tracks.length)];
    retryTimer = setTimeout(stop, 10000);  // do not surprise the user with a delayed sound
    attempt();
  }

  /** Back from another app (or opened again from the shortcut): replay the entrance, keep the tile. */
  function resume(relaunch) {
    if (editing) finishEdit(false);
    hideLaunchPointer(relaunch);
    releaseWatchlistFocus();
    updateClock();
    renderWatchlists();
    pills.forEach(function (p) { p.classList.remove('focused'); });
    zone = 'none';
    animateIn();
    focusTile(focused);
    playStartupSound(relaunch);
  }

  document.addEventListener('webOSRelaunch', function (e) {
    if (window.TVWatchlist && TVWatchlist.receive(e.detail)) return;
    resume(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      launchPointerHandled = false;
      startupSoundStarted = false;
      stopStartupSound();
    }
    else resume();
  });

  hideLaunchPointer();
  $('gamingLabel').textContent = CONFIG.gamingTitle || 'Game Zone';
  $('streamingLabel').textContent = CONFIG.streamingTitle || 'Streaming';
  $('otherLabel').textContent = CONFIG.otherTitle || 'Other apps';
  $('greetingIcon').style.display = CONFIG.showDogIcon ? '' : 'none';
  build();
  if (window.TVWatchlist) TVWatchlist.onChange(function () {
    renderWatchlists();
    if (zone === 'grid') focusTile(focused);
    else layout();
  });
  if (window.MovieWatchlist) MovieWatchlist.onChange(function () {
    renderWatchlists();
    if (zone === 'grid') focusTile(focused);
    else layout();
  });
  updateClock();
  setInterval(updateClock, 10000);
  animateIn();
  zone = 'none';
  focusTile(0);
  playStartupSound();
})();
