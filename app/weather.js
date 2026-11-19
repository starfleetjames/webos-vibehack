/* Nearby station observations from the National Weather Service; locally drawn SVG symbols. */
(function () {
  'use strict';
  var config = CONFIG.weather;
  var panel = document.getElementById('weather');
  if (!config) {
    panel.style.display = document.getElementById('weatherDivider').style.display = 'none';
    return;
  }

  var MINUTE = 60000, REFRESH = 15 * MINUTE, MAX_AGE = 90 * MINUTE;
  var cacheKey = 'tvhome.weather.nws.' + config.station + '.v1';
  var current = null, pending = false, nextFetch = 0;
  var icon = document.getElementById('weatherIcon');
  var temperature = document.getElementById('weatherTemperature');
  var condition = document.getElementById('weatherCondition');
  var updated = document.getElementById('weatherUpdated');

  function parseObservation(feature) {
    var values = feature && feature.properties;
    var reading = values && values.temperature;
    if (!reading || typeof reading.value !== 'number' || !isFinite(reading.value)) return null;
    var fahrenheit;
    if (reading.unitCode === 'wmoUnit:degC') fahrenheit = reading.value * 9 / 5 + 32;
    else if (reading.unitCode === 'wmoUnit:degF') fahrenheit = reading.value;
    else return null;

    var match = /\/icons\/land\/(day|night)\/([^/?]+)/.exec(values.icon || '');
    var day = match && match[1] === 'day';
    var code = match ? match[2].split(',')[0] : '';
    var conditions = {
      skc: [day ? 'Sunny' : 'Clear', day ? 'sun' : 'moon'],
      few: ['Mostly clear', day ? 'partly' : 'partly-night'],
      sct: ['Partly cloudy', day ? 'partly' : 'partly-night'],
      bkn: ['Mostly cloudy', 'cloud'], ovc: ['Cloudy', 'cloud'],
      rain: ['Rain', 'rain'], rain_showers: ['Rain showers', 'rain'], rain_showers_hi: ['Rain showers', 'rain'],
      snow: ['Snow', 'snow'], sleet: ['Sleet', 'sleet'], fzra: ['Freezing rain', 'sleet'],
      rain_snow: ['Rain and snow', 'sleet'], rain_sleet: ['Rain and sleet', 'sleet'],
      snow_sleet: ['Snow and sleet', 'sleet'], rain_fzra: ['Freezing rain', 'sleet'], snow_fzra: ['Wintry mix', 'sleet'],
      tsra: ['Thunderstorms', 'storm'], tsra_sct: ['Thunderstorms', 'storm'], tsra_hi: ['Thunderstorms', 'storm'],
      fog: ['Foggy', 'fog'], haze: ['Hazy', 'fog'], smoke: ['Smoke', 'fog'], dust: ['Dust', 'fog'],
      blizzard: ['Blizzard', 'snow'], hurricane: ['Hurricane', 'storm'], tropical_storm: ['Tropical storm', 'storm'],
      hot: ['Hot', 'thermometer'], cold: ['Cold', 'thermometer']
    };
    var description = typeof values.textDescription === 'string' ? values.textDescription.trim() : '';
    var presentation = conditions[code] || [description || 'Conditions unavailable', ''];
    if (code.indexOf('wind_') === 0) presentation = ['Windy', 'wind'];
    var data = { temperature: fahrenheit, description: presentation[0], symbol: presentation[1],
      time: Date.parse(values.timestamp) };
    return valid(data) ? data : null;
  }

  function symbol(kind) {
    if (!kind) return '';
    var sun = '<g stroke="#ffd474" stroke-width="2.6" stroke-linecap="round"><circle cx="24" cy="24" r="9" fill="#ffd474"/><path d="M24 3v5m0 32v5M3 24h5m32 0h5M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4"/></g>';
    var moon = '<path d="M33 7A17 17 0 1 0 41 34 16 16 0 0 1 33 7Z" fill="#d9e6ff"/>';
    var cloud = '<path d="M12 34a8 8 0 0 1-1-16 11 11 0 0 1 21-2 9 9 0 1 1 4 18Z" fill="#dae5ef"/>';
    var rain = '<path d="m17 38-3 6m12-6-3 6m12-6-3 6" stroke="#78c8ff" stroke-width="3" stroke-linecap="round"/>';
    var snow = '<g fill="#c1e6ff"><circle cx="15" cy="40" r="2.2"/><circle cx="25" cy="44" r="2.2"/><circle cx="35" cy="40" r="2.2"/></g>';
    var body;
    if (kind === 'sun') body = sun;
    else if (kind === 'moon') body = moon;
    else if (kind === 'wind') body = '<path d="M6 16h23a6 6 0 1 0-6-6M4 25h34a5 5 0 1 0-5-5M9 34h17a5 5 0 1 1-5 5" fill="none" stroke="#dae5ef" stroke-width="3" stroke-linecap="round"/>';
    else if (kind === 'thermometer') body = '<path d="M20 29V10a5 5 0 0 1 10 0v19a10 10 0 1 1-10 0Z" fill="none" stroke="#dae5ef" stroke-width="3"/><path d="M25 15v20" stroke="#78c8ff" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="37" r="5" fill="#78c8ff"/>';
    else if (kind === 'partly' || kind === 'partly-night') {
      body = '<g transform="translate(1 -5) scale(.8)">' + (kind === 'partly' ? sun : moon) + '</g>' + cloud;
    } else {
      body = cloud;
      if (kind === 'rain') body += rain;
      else if (kind === 'snow') body += snow;
      else if (kind === 'sleet') body += '<path d="m17 38-3 6m20-6-3 6" stroke="#78c8ff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="41" r="2.2" fill="#dae5ef"/>';
      else if (kind === 'fog') body += '<path d="M7 39h34M12 44h25" stroke="#b5c5d5" stroke-width="2.5" stroke-linecap="round"/>';
      else if (kind === 'storm') body += '<path d="m25 28-8 11h7l-3 9 13-15h-8l3-5Z" fill="#ffd474"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" focusable="false">' + body + '</svg>';
  }

  function valid(data) {
    return data && typeof data.temperature === 'number' && isFinite(data.temperature) &&
      typeof data.description === 'string' && typeof data.symbol === 'string' &&
      typeof data.time === 'number' && isFinite(data.time) &&
      data.time <= Date.now() + 5 * MINUTE && Date.now() - data.time <= MAX_AGE;
  }

  function render() {
    if (!valid(current)) {
      icon.innerHTML = '';
      temperature.textContent = '';
      condition.textContent = 'Weather unavailable';
      updated.textContent = '';
      panel.classList.remove('stale');
      return;
    }
    // Airport observations are normally hourly; label readings beyond the normal reporting cycle.
    var stale = Date.now() - current.time > 75 * MINUTE;
    var detail = '';
    if (stale) {
      var time = new Date(current.time), h = time.getHours(), m = time.getMinutes();
      detail = 'Updated ' + ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
    }
    icon.innerHTML = symbol(current.symbol);
    temperature.textContent = Math.round(current.temperature) + '°F';
    condition.textContent = current.description;
    updated.textContent = detail;
    panel.classList.toggle('stale', stale);
  }

  function requestJSON(url, done) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.setRequestHeader('Accept', 'application/geo+json');
    request.timeout = 12000;
    request.onload = function () {
      var result = null;
      try { if (request.status === 200) result = JSON.parse(request.responseText); } catch (e) { /* invalid response */ }
      done(result);
    };
    request.onerror = request.ontimeout = request.onabort = function () { done(null); };
    try { request.send(); } catch (e) { done(null); }
  }

  function refresh() {
    if (document.hidden) return;
    if (current) render();
    if (pending || Date.now() < nextFetch) return;
    pending = true;
    nextFetch = Date.now() + 5 * MINUTE;
    var base = 'https://api.weather.gov/stations/' + encodeURIComponent(config.station) + '/observations';

    function finish(data) {
      pending = false;
      if (data) {
        current = data;
        nextFetch = Date.now() + REFRESH;
        try { localStorage.setItem(cacheKey, JSON.stringify(current)); } catch (e) { /* optional cache */ }
      }
      render();
    }

    requestJSON(base + '/latest?require_qc=true', function (result) {
      var latest = parseObservation(result);
      if (latest) { finish(latest); return; }
      // An incomplete newest report must not turn a missing temperature into 0 degrees.
      requestJSON(base + '?limit=5', function (recent) {
        var readings = recent && Array.isArray(recent.features) ? recent.features : [];
        var best = null;
        readings.forEach(function (feature) {
          var data = parseObservation(feature);
          if (data && (!best || data.time > best.time)) best = data;
        });
        finish(best);
      });
    });
  }

  try { current = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { /* no cache yet */ }
  if (current) render();
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('webOSRelaunch', refresh);
  window.addEventListener('online', function () { nextFetch = 0; refresh(); });
  setInterval(refresh, MINUTE);
  refresh();
})();
