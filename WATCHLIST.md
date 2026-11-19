# Optional Reminders integration

TV Watchlist is a local, read-only EventKit helper for macOS 14 or newer. It reads
incomplete reminders from one selected list and exports only titles ending with a
recognized streaming service in parentheses, for example `Example Show (Netflix)`.
Notes, unrelated lists, completed reminders, headings and untagged entries are omitted.

The default list name is `TV Shows`. To use another name, save the exact name in
`~/Library/Application Support/webos-vibehack/watchlist-list-name.txt` before the
first run. The helper requires exactly one matching list. After its first success
it remembers that list's identifier and does not silently switch to another list
with the same name. To intentionally select a different list, stop the sync,
update the name file and remove `watchlist-list-id.txt` in that same private folder.

Build the native app with `bash watchlist-mac.sh build`. Open
`~/Library/Application Support/webos-vibehack/TV Watchlist.app` and grant Reminders
permission through macOS. Apple grants access broadly; the code only reads the
single selected list and never creates, edits or completes reminders. After a
successful read, `bash watchlist-mac.sh` installs the per-minute and login sync.

Enable display with `CONFIG.watchlist = { enabled: true }` in `app/config.local.js`
and reinstall the TV app. The Home helper delivers the cache when Home opens.
No HTTP server or cloud upload is involved. The payload contains recognized app
IDs and show titles, not the Reminders list's name or identifier. The TV retains
its most recent copy in localStorage. Disable display locally or uninstall the
launcher if you do not want that copy on the TV.

Only the focused app shows up to three titles. The center wheel pages through
longer lists and holds focus against pointer drift. Arrow keys or Back release
that hold. `bash watchlist-mac.sh uninstall` stops automatic syncing without
changing any reminders.
