// Invented installed-app list; never copied from a real television.
window.CONFIG = {
  columns: 4,
  gamingApps: ['com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'shortcut.example-console', 'com.twin.app.gamingportal'],
  dockApps: ['netflix', 'amazon', 'youtube.leanback.v4', 'com.apple.appletv'],
  streamingApps: ['netflix', 'amazon', 'youtube.leanback.v4', 'com.apple.appletv',
    'com.disney.disneyplus-prod', 'com.wbd.stream', 'hulu', 'com.cbs-all-access.webapp.prod', 'com.peacock.tv', 'cdp-30'],
  inputApps: [1, 2, 3].map(function (n) { return { id: 'com.webos.app.hdmi' + n, title: 'Console ' + n }; })
    .concat([{ id: 'shortcut.example-console', title: 'Example console' }]),
  hiddenApps: []
};
window.TV_APPS = { apps: CONFIG.streamingApps.map(function (id) { return { id: id, title: id }; })
  .concat([{ id: 'com.twin.app.gamingportal', title: 'Gaming Portal' },
    { id: 'com.webos.app.discovery', title: 'Apps' }, { id: 'com.palmdts.devmode', title: 'Developer Mode' }]) };
