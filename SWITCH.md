# Receiver-connected console shortcut

A separate console tile can route HDMI-CEC through a receiver using LG's input
manager. Configure it for your own cabling; there is no universal receiver input
number. See the commented Nintendo Switch example in `app/config.local.example.js`.

With the console awake, inspect the TV's device list using an already configured
webOS CLI device:

```sh
ares-novacom --device lgtv --run '/usr/bin/luna-send-pub -f -n 1 -w 3000 luna://com.webos.service.eim/getAllInputStatus {}'
```

Treat that device output as private. Find the console beneath its TV HDMI app and
set the shortcut's `launchAppId`, `physicalAddress` and `vendorId` to the observed
values in ignored `app/config.local.js`. A physical path of `0x4300`, for example,
means TV HDMI 4 → receiver HDMI 3. This is an invented cabling example. Do not copy
another installation's physical address or logical ID.

On selection, `cec-input.js` queries the current input list, matches the HDMI app,
physical path and vendor, then launches the HDMI app with
`{id: 'uniqueId', value: '<current logical ID>'}`. The logical ID is resolved each
time because it can change. Missing or ambiguous matches and timeouts show a
message instead of switching to a different device. If a docked console is absent,
wake it and retry. Moving cables requires updating the physical path.

The gaming row adapts its tile widths to fit an added console. Streaming keeps its
four-column layout. Up/down navigation chooses the closest tile horizontally.
Receiver network access and root access are not required. Support depends on the
TV, console and receiver exposing the expected SIMPLINK/HDMI-CEC behavior.

References:
- https://github.com/webosbrew/home-chooser/blob/main/docs/launcher-api.md#listinputs-subscribe
- https://rorygallagher2024.github.io/glasshouse/development/TV-RESEARCH/#selecting-and-waking-a-source-through-a-receiver-g3-webos-922
