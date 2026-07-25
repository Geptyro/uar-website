# Replays

UAR replays ingested into the `/players` page. Files are named after the game's
UTC start time (`YYYYMMDD-HHMM.SC2Replay`).

To add games, copy `.SC2Replay` files here (any filename works — the game time
is read from the replay itself) and regenerate the player data:

```sh
python3 -m venv .venv && .venv/bin/pip install mpyq s2protocol
.venv/bin/python scripts/extract_players.py
```

This rewrites `src/lib/data/players.json`. The newest sighting of each player
(by game time, not filename) wins.
