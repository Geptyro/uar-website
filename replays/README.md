# Replays

UAR replays ingested into the `/players` page. Files are named after the game's
UTC start time (`YYYYMMDD-HHMM.SC2Replay`).

To pull new games straight from the local StarCraft II replay folder
(filters to UAR games, skips already-imported ones, regenerates the data):

```sh
python3 -m venv .venv && .venv/bin/pip install mpyq s2protocol   # once
.venv/bin/python scripts/import_replays.py [sc2-replay-folder]
```

Or copy `.SC2Replay` files here manually (any filename works — the game time
is read from the replay itself) and run `scripts/extract_players.py`.

Either way this rewrites `src/lib/data/players.json`: each player's profile
is their newest sighting (by game time), and every replay they appear in
becomes a row of their history. Commit + tag to deploy — the site is fully
static, so production only ever serves the committed JSON.
