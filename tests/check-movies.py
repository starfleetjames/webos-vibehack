import copy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import movie_watchlist as movies

raw = {'version': 1, 'source': 'https://letterboxd.com/example/watchlist/', 'region': 'US', 'checkedAt': datetime.now(timezone.utc).isoformat(),
       'expectedCount': 1, 'films': [{'url': 'https://letterboxd.com/film/example/', 'poster': 'Poster for Example (2000)',
       'heading': 'Example 2000', 'country': 'USA', 'complete': True, 'offers': [
           {'provider': 'Amazon Video', 'type': 'rent', 'region': 'USA'},
           {'provider': 'Amazon Prime Video', 'type': 'stream', 'region': 'USA'},
           {'provider': 'Amazon Prime Video with Ads', 'type': 'stream', 'region': 'USA'},
           {'provider': 'HBO Max Amazon Channel', 'type': 'stream', 'region': 'USA'},
           {'provider': 'YouTube TV', 'type': 'stream', 'region': 'USA'},
           {'provider': 'Apple TV Store', 'type': 'buy', 'region': 'USA'},
           {'provider': 'Plex', 'type': 'rent', 'region': 'USA'}]}]}
snapshot = movies.compile_snapshot(raw, raw['source'])
assert snapshot['movies'] == {'amazon': [{'title': 'Example', 'year': 2000, 'mode': 'stream'}],
                              'cdp-30': [{'title': 'Example', 'year': 2000, 'mode': 'rent'}]}
with tempfile.TemporaryDirectory() as directory:
    output = Path(directory) / 'movies.json'
    movies.publish(raw, output, raw['source'])
    original = output.read_bytes()
    for change in ('partial', 'wrong-film', 'wrong-country', 'wrong-account', 'duplicate', 'incomplete', 'old'):
        broken = copy.deepcopy(raw)
        if change == 'partial': broken['expectedCount'] = 2
        if change == 'wrong-film': broken['films'][0]['heading'] = 'Example 2025'
        if change == 'wrong-country': broken['films'][0]['offers'][0]['region'] = 'GBR'
        if change == 'wrong-account': broken['source'] = 'https://letterboxd.com/different/watchlist/'
        if change == 'duplicate': broken['films'] *= 2; broken['expectedCount'] = 2
        if change == 'incomplete': broken['films'][0]['complete'] = False
        if change == 'old': broken['checkedAt'] = '2020-01-01T00:00:00Z'
        try:
            movies.publish(broken, output, raw['source'])
            raise AssertionError(change + ' was accepted')
        except ValueError:
            pass
        assert output.read_bytes() == original
    assert output.stat().st_mode & 0o777 == 0o600
    assert snapshot['source'] == 'letterboxd' and raw['source'] not in output.read_text()
    spec = importlib.util.spec_from_file_location('homewatch', 'home-watch.py')
    home = importlib.util.module_from_spec(spec); spec.loader.exec_module(home)
    home.MOVIE_WATCHLIST_FILE = str(output)
    home.WATCHLIST_FILE = str(Path(directory) / 'reminders.json')
    assert home.home_payload()['params']['movieWatchlist']['movies'] == snapshot['movies']
    Path(home.WATCHLIST_FILE).write_text(json.dumps({'version': 1, 'source': 'reminders', 'updatedAt': raw['checkedAt'], 'shows': {'netflix': ['Example Show']}}))
    assert set(home.home_payload()['params']) == {'watchlist', 'movieWatchlist'}
    empty = copy.deepcopy(raw); empty['expectedCount'] = 0; empty['films'] = []
    movies.publish(empty, output, raw['source'])
    assert movies.load_payload(output)['movies'] == {}
    output.write_text('bad JSON')
    assert 'watchlist' in home.home_payload()['params'] and 'movieWatchlist' not in home.home_payload()['params']
print('PASS: rental/stream preference, purchases and add-on exclusion, complete/region/title checks, atomic preservation, removal updates, independent movie/Reminders delivery')
