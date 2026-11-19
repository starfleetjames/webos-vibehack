#!/usr/bin/env python3
"""Validate a complete browser refresh and publish the local movie availability cache.

The browser reads public Letterboxd pages. This module does not log in, scrape an
undocumented API, launch the TV, or change the Letterboxd watchlist.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata

SOURCE_ID = 'letterboxd'
MAX_AGE_SECONDS = 3 * 24 * 60 * 60
MAX_BYTES = 1_000_000

# Exact names prevent add-on channels and YouTube TV from becoming base subscriptions.
PROVIDERS = {
    'Netflix': ('netflix', 'stream'),
    'Netflix Standard with Ads': ('netflix', 'stream'),
    'Amazon Prime Video': ('amazon', 'stream'),
    'Amazon Prime Video with Ads': ('amazon', 'stream'),
    'Amazon Prime Video Free with Ads': ('amazon', 'stream'),
    'Amazon Video': ('amazon', 'rent'),
    'Apple TV': ('com.apple.appletv', 'stream'),
    'Apple TV Plus': ('com.apple.appletv', 'stream'),
    'Apple TV+': ('com.apple.appletv', 'stream'),
    'Apple TV Store': ('com.apple.appletv', 'rent'),
    'Disney Plus': ('com.disney.disneyplus-prod', 'stream'),
    'HBO Max': ('com.wbd.stream', 'stream'),
    'HBO Max with Ads': ('com.wbd.stream', 'stream'),
    'Max': ('com.wbd.stream', 'stream'),
    'Hulu': ('hulu', 'stream'),
    'Paramount Plus': ('com.cbs-all-access.webapp.prod', 'stream'),
    'Paramount Plus Essential': ('com.cbs-all-access.webapp.prod', 'stream'),
    'Paramount Plus Premium': ('com.cbs-all-access.webapp.prod', 'stream'),
    'Peacock Premium': ('com.peacock.tv', 'stream'),
    'Peacock Premium Plus': ('com.peacock.tv', 'stream'),
    'Peacock': ('com.peacock.tv', 'stream'),
    'YouTube': ('youtube.leanback.v4', 'rent'),
    'YouTube Free': ('youtube.leanback.v4', 'stream'),
    'Plex': ('cdp-30', None),
    'Plex Player': ('cdp-30', 'stream'),
}
APP_IDS = {value[0] for value in PROVIDERS.values()}


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Refresh timestamp must include its time zone')
    return parsed.timestamp()


def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split()).casefold()


def compile_snapshot(raw, source_url):
    if not isinstance(source_url, str) or not re.fullmatch(
            r'https://letterboxd\.com/[A-Za-z0-9_-]+/watchlist/', source_url):
        raise ValueError('Supply the exact public Letterboxd watchlist URL')
    if (raw.get('version') != 1 or raw.get('source') != source_url or raw.get('region') != 'US'
            or not isinstance(raw.get('films'), list)):
        raise ValueError('Unexpected watchlist source or region')
    films = raw['films']
    if type(raw.get('expectedCount')) is not int or raw['expectedCount'] != len(films) or len(films) > 500:
        raise ValueError('Incomplete watchlist: page count does not match collected films')
    checked = timestamp(raw['checkedAt'])
    if not -300 <= datetime.now(timezone.utc).timestamp() - checked <= 6 * 60 * 60:
        raise ValueError('Import must be a fresh browser observation')
    movies, seen = {}, set()
    for film in films:
        url = film.get('url', '')
        if not re.fullmatch(r'https://letterboxd\.com/film/[a-z0-9-]+/', url) or url in seen:
            raise ValueError('Duplicate or invalid film URL')
        seen.add(url)
        title = re.fullmatch(r'Poster for (.+) \((\d{4})\)', film.get('poster', ''))
        if not title or film.get('complete') is not True or film.get('country') != 'USA':
            raise ValueError('Unverified film or country')
        name, year = title.group(1), int(title.group(2))
        if normalized(film.get('heading', '')) != normalized(f'{name} {year}'):
            raise ValueError('Availability panel does not match its watchlist film')
        if not isinstance(film.get('offers'), list):
            raise ValueError('Missing availability observations')
        per_app = {}
        for offer in film['offers']:
            if not isinstance(offer, dict) or offer.get('region') != 'USA':
                raise ValueError('Non-U.S. or malformed availability observation')
            kind = offer.get('type')
            if kind not in ('stream', 'rent'):
                continue  # Purchase-only listings never reach Home.
            mapped = PROVIDERS.get(offer.get('provider'))
            if mapped is None:
                continue
            app_id, allowed_kind = mapped
            if allowed_kind is not None and kind != allowed_kind:
                continue
            if app_id not in per_app or kind == 'stream':
                per_app[app_id] = kind
        for app_id, kind in per_app.items():
            movies.setdefault(app_id, []).append({'title': name, 'year': year, 'mode': kind})
    for entries in movies.values():
        entries.sort(key=lambda movie: movie['mode'] != 'stream')  # Stable watchlist order within each type.
    return {'version': 1, 'source': SOURCE_ID, 'region': 'US', 'updatedAt': raw['checkedAt'], 'movies': movies}


def clean_payload(data):
    if (not isinstance(data, dict) or data.get('version') != 1 or data.get('source') != SOURCE_ID
            or data.get('region') != 'US' or not isinstance(data.get('movies'), dict)):
        raise ValueError('Invalid movie cache')
    timestamp(data['updatedAt'])
    movies = {}
    for app_id, entries in data['movies'].items():
        if app_id not in APP_IDS or not isinstance(entries, list):
            continue
        seen = set()
        for entry in entries[:500]:
            if (not isinstance(entry, dict) or not isinstance(entry.get('title'), str)
                    or not entry['title'].strip() or entry.get('mode') not in ('stream', 'rent')
                    or type(entry.get('year')) is not int):
                continue
            title = entry['title'].strip()[:300]
            key = (title, entry['year'])
            if key in seen:
                continue
            seen.add(key)
            movies.setdefault(app_id, []).append({'title': title, 'year': entry['year'], 'mode': entry['mode']})
    return {'version': 1, 'source': SOURCE_ID, 'region': 'US', 'updatedAt': data['updatedAt'], 'movies': movies}


def load_payload(path):
    try:
        with open(path) as handle:
            raw = handle.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            return None
        return clean_payload(json.loads(raw))
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        return None


def publish(raw, destination, source_url):
    data = compile_snapshot(raw, source_url)
    previous = load_payload(destination)
    if previous and timestamp(previous['updatedAt']) > timestamp(data['updatedAt']):
        raise ValueError('Refusing to replace newer availability with an older refresh')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.movie-watchlist-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'w') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Published {len(raw['films'])} checked films across {len(data['movies'])} installed services.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--import', dest='input', required=True)
    parser.add_argument('--source', required=True, help='Exact public watchlist URL to validate against')
    parser.add_argument('--output', default=str(Path(__file__).with_name('movie-watchlist.json')))
    args = parser.parse_args()
    with open(args.input) as handle:
        publish(json.load(handle), args.output, args.source)
