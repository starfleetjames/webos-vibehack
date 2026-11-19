# Keeping household information private

Public source uses generic defaults. Household personalization belongs in
`app/config.local.js`, which is ignored by Git but packaged into your own TV app.
The example file contains invented settings. Weather, watchlists and startup
sounds are disabled until you configure them.

Never commit pairing keys, developer keys, personal audio, Reminders snapshots,
movie observations, installed-app exports, local configuration, screenshots of
your setup, logs, or built TV packages. Ignore rules cover the standard generated
paths and common secret/media formats. A TV package can contain private settings
and recordings: do not upload it as a public release asset.

Private runtime data belongs in
`~/Library/Application Support/webos-vibehack`, outside the source checkout.
The Home helper sends watchlists only over its existing paired TV connection.
Weather requests go to NOAA/NWS for the configured station. A separately configured
movie refresh reads public Letterboxd/JustWatch pages. No telemetry is added.

Before publishing, review `git diff --cached` and run
`python3 scripts/check-public.py`. The check scans the staged files, including
files force-added despite ignore rules. It catches common accidental private
artifacts and token formats; it cannot prove that arbitrary prose, filenames,
images or custom settings contain no personal information. Review those manually.
Once sensitive data enters a public commit, deleting the file in a later commit
does not erase its history. Always sanitize before the first public commit.
