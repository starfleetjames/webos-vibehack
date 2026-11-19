// Shareable defaults. Put household settings in ignored config.local.js.
// HDMI assignments below are examples: change them to match your cabling.
window.CONFIG = {
  greetingName: '',
  showDogIcon: false,
  gamingTitle: 'Game Zone',
  streamingTitle: 'Streaming',
  otherTitle: 'Other apps',
  gamingApps: ['com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'com.twin.app.gamingportal'],
  dockApps: ['netflix', 'amazon', 'youtube.leanback.v4', 'com.apple.appletv'],
  streamingApps: [
    'netflix', 'amazon', 'youtube.leanback.v4', 'com.apple.appletv',
    'com.disney.disneyplus-prod', 'com.wbd.stream', 'hulu', 'com.cbs-all-access.webapp.prod',
    'com.peacock.tv', 'cdp-30'
  ],
  startupSounds: [],
  weather: null,
  watchlist: { enabled: false },
  inputApps: [
    { id: 'com.webos.app.hdmi1', title: 'XBOX', icon: 'brands/xbox.svg', iconColor: '#107c10' },
    { id: 'com.webos.app.hdmi2', title: 'PlayStation 5', icon: 'brands/playstation.svg', iconColor: '#003791' },
    { id: 'com.webos.app.hdmi3', title: 'PC', icon: 'brands/steam.svg', iconColor: '#1b4567' }
  ],
  hiddenApps: ['com.gathin.tvhome', 'com.webos.app.livetv', 'com.webos.app.lgchannels', 'shortcutcopilot'],
  columns: 4
};
