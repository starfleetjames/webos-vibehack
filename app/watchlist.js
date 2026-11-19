/* Private Reminders titles arrive through the already-paired Mac-to-TV connection. */
(function () {
  'use strict';
  var key = 'tvhome.watchlist', data = null, listeners = [];

  function parameters(value) {
    try { if (typeof value === 'string') value = JSON.parse(value); } catch (e) { return {}; }
    return value && typeof value === 'object' ? value : {};
  }

  function clean(value) {
    if (!value || value.version !== 1 || value.source !== 'reminders' || !value.shows ||
        !isFinite(Date.parse(value.updatedAt))) return null;
    var shows = {};
    (CONFIG.streamingApps || []).forEach(function (id) {
      if (!Array.isArray(value.shows[id])) return;
      var titles = [];
      value.shows[id].slice(0, 100).forEach(function (title) {
        if (typeof title !== 'string' || !title.trim()) return;
        title = title.trim().slice(0, 300);
        if (titles.indexOf(title) === -1) titles.push(title);
      });
      if (titles.length) shows[id] = titles;
    });
    return { version: 1, source: 'reminders', updatedAt: value.updatedAt, shows: shows };
  }

  function receive(value) {
    var params = parameters(value);
    if (!params.watchlist && params.params) params = parameters(params.params);
    var incoming = clean(params.watchlist);
    if (incoming && (!data || Date.parse(incoming.updatedAt) >= Date.parse(data.updatedAt))) {
      var changed = !data || JSON.stringify(incoming.shows) !== JSON.stringify(data.shows);
      data = incoming;
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* optional offline cache */ }
      if (changed) listeners.forEach(function (fn) { fn(); });
    }
    return params.watchlistUpdateOnly === true;
  }

  try { data = clean(JSON.parse(localStorage.getItem(key))); } catch (e) { /* no saved list yet */ }
  window.TVWatchlist = {
    get: function (id) { return CONFIG.watchlist && CONFIG.watchlist.enabled && data ? (data.shows[id] || []).slice() : []; },
    receive: receive,
    onChange: function (fn) { listeners.push(fn); }
  };
  document.addEventListener('webOSLaunch', function (e) { receive(e.detail); });
  document.addEventListener('webOSRelaunch', function (e) { receive(e.detail); });
  try { if (window.PalmSystem) receive(PalmSystem.launchParams); } catch (e) { /* not on webOS */ }
})();
