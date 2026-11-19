/* Resolve a console behind the receiver by its HDMI path, not its changeable CEC logical ID. */
(function () {
  'use strict';
  function resolve(shortcut, request, callback) {
    var finished = false;
    var timeout = setTimeout(function () { finish('Could not reach the Switch input. Try again.'); }, 4000);
    function finish(error, params) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      callback(error, params);
    }
    request('luna://com.webos.service.eim/getAllInputStatus', {}, function (response) {
      if (!response || response.returnValue === false || !Array.isArray(response.devices)) {
        finish('Could not read the Switch input. Try again.');
        return;
      }
      var matches = [];
      response.devices.forEach(function (input) {
        if (input.appId !== shortcut.launchAppId) return;
        (input.subList || []).forEach(function (device) {
          if (device.id === 'SIMPLINK' && device.physicalAddress === shortcut.cec.physicalAddress &&
              device.vendorId === shortcut.cec.vendorId && typeof device.uniqueId === 'number' && device.uniqueId >= 0) {
            matches.push(device);
          }
        });
      });
      if (matches.length !== 1) {
        finish('Wake Nintendo Switch 2 in its dock, then try again.');
        return;
      }
      finish(null, { id: 'uniqueId', value: String(matches[0].uniqueId) });
    });
  }
  window.CECInput = { resolve: resolve };
})();
