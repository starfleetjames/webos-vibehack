// Copy to config.local.js. This example contains invented settings only.
// config.local.js is ignored by Git but included when packaging your own TV app.
CONFIG.greetingName = 'Your name';
CONFIG.showDogIcon = true;
CONFIG.gamingTitle = 'Game Zone';
CONFIG.weather = { station: 'KSEA' }; // Example: Seattle; choose your nearby NWS station.
CONFIG.watchlist = { enabled: true };
// Add your own licensed audio files locally; none are distributed with this project.
// CONFIG.startupSounds = ['audio/startup-a.mp3', 'audio/startup-b.mp3'];

// Optional receiver-connected console. These addresses are examples, not discovery.
// 0x4300 means TV HDMI 4 -> receiver HDMI 3; verify your own EIM device response.
// CONFIG.inputApps.push({
//   id: 'shortcut.nintendo-switch2', title: 'Nintendo Switch 2',
//   icon: 'brands/nintendo-switch.svg', iconColor: '#e60012',
//   launchAppId: 'com.webos.app.hdmi4', cec: { physicalAddress: 0x4300, vendorId: 2495 }
// });
// CONFIG.gamingApps.splice(3, 0, 'shortcut.nintendo-switch2');
// CONFIG.hiddenApps.push('com.webos.app.hdmi4');
