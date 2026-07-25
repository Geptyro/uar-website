# Replays

UAR replays ingested into the `/players` page — and served for download at
`/replays/<file>`. Files are named after the game's UTC start time
(`YYYYMMDD-HHMM.SC2Replay`).

To pull new games straight from the local StarCraft II replay folder
(filters to UAR games, skips already-imported ones, regenerates the data):

```sh
npm run players:import            # or: node scripts/import-replays.ts [folder]
```

Or copy `.SC2Replay` files here manually (any filename works — the game time
is read from the replay itself) and run `npm run players:extract`.

Either way this rewrites `src/lib/data/players.json`: each player's profile
is their newest sighting (by game time), and every replay they appear in
becomes a row of their history. Commit + tag to deploy — the site is fully
static, so production only ever serves the committed JSON.

Parsing is pure TypeScript (`src/lib/server/replay/` — MPQ reader, s2protocol
decoders, UAR bank cipher; no Python needed). The original Python pipeline
(`scripts/extract_players.py`, `scripts/import_replays.py`) is kept as a
cross-check: both generators produce byte-identical players.json. To support
a future SC2 patch, run `scripts/convert_protocol.py <baseBuild>` and register
the JSON in `src/lib/server/replay/protocol.ts`.
