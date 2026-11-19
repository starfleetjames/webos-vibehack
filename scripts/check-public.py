#!/usr/bin/env python3
"""Check staged files for common accidental private artifacts (not a full secret audit)."""
import fnmatch
from pathlib import PurePosixPath
import re
import subprocess
import sys

blocked = [
    '.lgtv-key.json', '.env', '.env.*', '*.local.json', 'app/config.local.js',
    '*watchlist*.json', 'watchlist-list-*.txt', 'letterboxd-refresh-input.json',
    'app/apps.js', 'app/icons/*', 'app/icon.png', 'app/largeIcon.png',
    'build/*', 'private/*', 'work/*', 'outputs/*', '*.log', '*.ipk',
    '*.mp3', '*.wav', '*.m4a', '*.aac', '*.ogg', '*.flac',
    '*.pem', '*.key', '*.p12', '*.pfx', 'id_ed25519*', 'id_rsa*', '*.app/*',
]
patterns = {
    'private key': re.compile(rb'-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----'),
    'GitHub token': re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'),
    'AWS access key': re.compile(rb'AKIA[A-Z0-9]{16}'),
    'credential in URL': re.compile(rb'https?://[^\s/:@]+:[^\s/@]+@'),
    'absolute home path': re.compile(rb'/(?:Users|home)/[A-Za-z0-9_.-]+/'),
}
files = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
failures = []
for name in filter(None, files):
    if name != '.env.example' and any(fnmatch.fnmatch(name, p) or fnmatch.fnmatch(PurePosixPath(name).name, p) for p in blocked):
        failures.append((name, 'private/generated file path'))
    data = subprocess.check_output(['git', 'show', ':' + name])
    for label, pattern in patterns.items():
        if pattern.search(data):
            failures.append((name, label))
if failures:
    for name, label in failures:
        print(f'BLOCKED: {name}: {label}', file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(list(filter(None, files)))} staged files checked for private artifacts and common secret patterns')
