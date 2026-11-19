# Optional movie watchlist

The launcher can display movies from a public Letterboxd watchlist, grouped by
U.S. streaming or rental service. The repository contains the validator and TV
integration, but no user's account, movie list, browser session, or automation.
A separate browser-capable scheduler must collect complete observations regularly.
Installing this repository alone does not schedule a refresh.

Configure that scheduler with your own public watchlist URL and an appropriate
schedule. It should use ordinary visible website controls, respect access controls,
and preserve the last good cache if any page or availability panel cannot be read.
Do not replace failed automatic updates with invented or partial results.

## Collection contract

Read every page of the public watchlist and its displayed total. For each unique
film, open its public film page and **All services…** panel. Verify the title, year,
and **USA** country. Collect all stream/rent offers, omitting buy offers. An
explicit **No available sources** panel or a buy-only panel is a valid empty result;
an unloaded panel is a failed read. Do not activate purchase or subscription links.

Save the complete observations outside Git, such as `private/refresh.json`:

```json
{
  "version": 1,
  "source": "https://letterboxd.com/example/watchlist/",
  "region": "US",
  "checkedAt": "2025-01-01T12:00:00Z",
  "expectedCount": 1,
  "films": [{
    "url": "https://letterboxd.com/film/example/",
    "poster": "Poster for Example (2000)",
    "heading": "Example 2000",
    "country": "USA",
    "complete": true,
    "offers": [{"provider": "Amazon Video", "type": "rent", "region": "USA"}]
  }]
}
```

All values above are examples. Use the actual observation timestamp, account,
films, count and offers. Preserve watchlist order. Import the completed snapshot:

```sh
python3 movie_watchlist.py --source 'https://letterboxd.com/YOUR_USERNAME/watchlist/' \
  --import private/refresh.json \
  --output "$HOME/Library/Application Support/webos-vibehack/movie-watchlist.json"
```

The validator rejects incomplete counts, duplicate URLs, title/year mismatches,
wrong countries, wrong source accounts and old observations. Exact provider
mapping excludes unrelated add-on channels; streaming wins over rental on the
same service. Successful writes are atomic with owner-only file permissions.
The exported cache uses a generic source marker, not the account's username.

The Home helper sends the cache over the paired TV connection the next time Home
opens. Refreshing the cache does not need to launch a TV app or restart the helper.
The TV hides movies after 72 hours without a successful refresh. Configure
`CONFIG.watchlist.enabled = true` locally to display them. The scheduler should
report failed reads so its owner can fix them; public website markup can change.
