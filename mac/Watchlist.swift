import AppKit
import EventKit
import Foundation

// Read-only EventKit bridge. The only exported fields are service-tagged show titles.
let support = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/webos-vibehack", isDirectory: true)
let listSetting = support.appendingPathComponent("watchlist-list-name.txt")
let listName = ((try? String(contentsOf: listSetting, encoding: .utf8)) ?? "TV Shows")
    .trimmingCharacters(in: .whitespacesAndNewlines)
let output = support.appendingPathComponent("watchlist.json")
let identity = support.appendingPathComponent("watchlist-list-id.txt")
let statusFile = support.appendingPathComponent("watchlist-status.json")
let serviceIDs = [
    "netflix": "netflix", "amazon": "amazon", "amazonprime": "amazon", "prime": "amazon", "primevideo": "amazon", "amazonprimevideo": "amazon",
    "apple": "com.apple.appletv", "appletv": "com.apple.appletv", "appletvplus": "com.apple.appletv",
    "hbo": "com.wbd.stream", "hbomax": "com.wbd.stream", "max": "com.wbd.stream",
    "hulu": "hulu", "disney": "com.disney.disneyplus-prod", "disneyplus": "com.disney.disneyplus-prod",
    "paramount": "com.cbs-all-access.webapp.prod", "paramountplus": "com.cbs-all-access.webapp.prod",
    "peacock": "com.peacock.tv", "plex": "cdp-30", "youtube": "youtube.leanback.v4"
]

func taggedShow(_ raw: String) -> (String, String)? {
    let title = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard title.hasSuffix(")"), let start = title.lastIndex(of: "(") else { return nil }
    let service = String(title[title.index(after: start)..<title.index(before: title.endIndex)])
        .lowercased().replacingOccurrences(of: "+", with: "plus")
        .filter { $0.isLetter || $0.isNumber }
    let show = String(title[..<start]).trimmingCharacters(in: .whitespacesAndNewlines)
    guard let id = serviceIDs[service], !show.isEmpty else { return nil }
    return (id, String(show.prefix(300)))
}

func writeJSON(_ value: [String: Any], to path: URL) throws {
    try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true,
                                          attributes: [.posixPermissions: 0o700])
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .prettyPrinted])
    try data.write(to: path, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
}

func report(_ state: String, _ message: String) {
    try? writeJSON(["status": state, "message": message,
                    "updatedAt": ISO8601DateFormatter().string(from: Date())], to: statusFile)
    print(message)
    fflush(stdout)
}

final class WatchlistReader: NSObject, NSApplicationDelegate {
    let store = EKEventStore()

    func applicationDidFinishLaunching(_ notification: Notification) {
        switch EKEventStore.authorizationStatus(for: .reminder) {
        case .fullAccess, .authorized:
            readList()
        case .notDetermined:
            report("permission_required", "Waiting for macOS Reminders permission for TV Watchlist.")
            store.requestFullAccessToReminders { granted, error in
                DispatchQueue.main.async {
                    if granted { self.readList() }
                    else { self.fail("Reminders permission was not granted.") }
                }
            }
        default:
            fail("Reminders permission is unavailable. Enable TV Watchlist in Privacy & Security > Reminders.")
        }
    }

    func fail(_ message: String) {
        report("unavailable", message)
        NSApp.terminate(nil)
    }

    func readList() {
        let calendars = store.calendars(for: .reminder)
        let selected: EKCalendar?
        if let savedID = try? String(contentsOf: identity, encoding: .utf8) {
            // Once selected, never silently switch to a different list with the same name.
            selected = calendars.first { $0.calendarIdentifier == savedID }
        } else {
            let matches = calendars.filter { $0.title == listName }
            selected = matches.count == 1 ? matches.first : nil
        }
        guard let calendar = selected else {
            fail("The selected selected reminders list was not found uniquely.")
            return
        }
        let predicate = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: [calendar])
        store.fetchReminders(matching: predicate) { reminders in
            DispatchQueue.main.async {
                guard let reminders = reminders else { self.fail("Unable to read the selected reminders list."); return }
                var groups: [String: Set<String>] = [:]
                for reminder in reminders where !reminder.isCompleted {
                    if let (id, title) = taggedShow(reminder.title ?? "") {
                        groups[id, default: []].insert(title)
                    }
                }
                let shows = groups.mapValues { $0.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending } }
                do {
                    try writeJSON(["version": 1, "source": "reminders", "shows": shows,
                                   "updatedAt": ISO8601DateFormatter().string(from: Date())], to: output)
                    if !FileManager.default.fileExists(atPath: identity.path) {
                        try calendar.calendarIdentifier.write(to: identity, atomically: true, encoding: .utf8)
                        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: identity.path)
                    }
                    report("ok", "Synced \(shows.values.reduce(0) { $0 + $1.count }) shows from selected reminders.")
                } catch { self.fail("Could not save the TV watchlist: \(error.localizedDescription)"); return }
                NSApp.terminate(nil)
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
            self.fail("Timed out while reading selected reminders.")
        }
    }
}

if CommandLine.arguments.contains("--self-test") {
    precondition(taggedShow("Example A (Apple TV)")?.0 == "com.apple.appletv")
    precondition(taggedShow("Show (Paramount+)")?.0 == "com.cbs-all-access.webapp.prod")
    precondition(taggedShow("Example B (HBO)")?.1 == "Example B")
    precondition(taggedShow("Example C (Amazon)")?.0 == "amazon")
    precondition(taggedShow("Untagged heading") == nil)
    precondition(taggedShow("Another untagged reminder") == nil)
    precondition(taggedShow("Example (Unknown)") == nil)
    print("PASS: streaming aliases, title preservation and untagged-entry exclusion")
} else {
    let app = NSApplication.shared
    let delegate = WatchlistReader()
    app.setActivationPolicy(.accessory)
    app.delegate = delegate
    app.run()
}
