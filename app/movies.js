/* Daily public Letterboxd/JustWatch observations arrive through the paired Mac. */
(function () {
  'use strict';
  var key = 'tvhome.movies', data = null, listeners = [];
  var maxAge = 3 * 24 * 60 * 60 * 1000;
  function clean(value) {
    if (!value || value.version !== 1 || value.source !== 'letterboxd' || value.region !== 'US' ||
        !value.movies || !isFinite(Date.parse(value.updatedAt))) return null;
    var movies = {};
    (CONFIG.streamingApps || []).forEach(function (id) {
      if (!Array.isArray(value.movies[id])) return;
      var entries = [], seen = {};
      value.movies[id].slice(0, 500).forEach(function (movie) {
        if (!movie || typeof movie.title !== 'string' || !movie.title.trim() ||
            (movie.mode !== 'stream' && movie.mode !== 'rent') || typeof movie.year !== 'number') return;
        var title = movie.title.trim().slice(0, 300), identity = title + ':' + movie.year;
        if (Object.prototype.hasOwnProperty.call(seen, identity)) return;
        seen[identity] = true;
        entries.push({ title: title, year: movie.year, mode: movie.mode });
      });
      if (entries.length) movies[id] = entries;
    });
    return { version: 1, source: value.source, region: 'US', updatedAt: value.updatedAt, movies: movies };
  }
  function receive(value) {
    try {
      if (typeof value === 'string') value = JSON.parse(value);
      if (value && !value.movieWatchlist && value.params) value = typeof value.params === 'string' ? JSON.parse(value.params) : value.params;
    } catch (e) { return; }
    var incoming = clean(value && value.movieWatchlist);
    if (!incoming || (data && Date.parse(incoming.updatedAt) < Date.parse(data.updatedAt))) return;
    var changed = !data || data.updatedAt !== incoming.updatedAt || JSON.stringify(data.movies) !== JSON.stringify(incoming.movies);
    data = incoming;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* optional cache */ }
    if (changed) listeners.forEach(function (fn) { fn(); });
  }
  try { data = clean(JSON.parse(localStorage.getItem(key))); } catch (e) { /* no prior movies */ }
  window.MovieWatchlist = {
    get: function (id) {
      var age = data ? Date.now() - Date.parse(data.updatedAt) : Infinity;
      if (!CONFIG.watchlist || !CONFIG.watchlist.enabled || age < -300000 || age > maxAge) return [];
      return (data.movies[id] || []).slice();
    },
    receive: receive,
    onChange: function (fn) { listeners.push(fn); }
  };
  document.addEventListener('webOSLaunch', function (e) { receive(e.detail); });
  document.addEventListener('webOSRelaunch', function (e) { receive(e.detail); });
  try { if (window.PalmSystem) receive(PalmSystem.launchParams); } catch (e) { /* preview */ }
})();
