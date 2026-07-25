# Replays

Production replay storage is a Tigris bucket (blobs at `replays/<file>`) +
MongoDB (`replays` collection: one doc per game with parsed sightings;
`players` collection: merged profiles, rebuilt from all sightings on every
ingest). The /players and /replays pages are server-rendered from Mongo, and
uploads via /replays (POST /api/replays) go live immediately. Downloads are
streamed from the bucket at the same /replays/<file> URLs.

Required app secrets: MONGODB_URI (+ optional MONGODB_DB, default "uar") and
the Tigris credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
AWS_ENDPOINT_URL_S3, BUCKET_NAME — injected by `fly storage create`).

The .SC2Replay files in this folder are the local working copy / seed source.
To push them into production storage (idempotent):

```sh
MONGODB_URI=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
BUCKET_NAME=... node scripts/seed-storage.ts
```

File names are the game's UTC start time (`YYYYMMDD-HHMM.SC2Replay`), which
is also the dedupe key. Parsing is pure TypeScript (`src/lib/server/replay/`
— MPQ reader, s2protocol decoders, UAR bank cipher). scripts/extract-players.ts
still builds a static players.json from this folder — kept as the golden
cross-check for the parser. To support a future SC2 patch, run
`scripts/convert_protocol.py <baseBuild>` and register the JSON in
`src/lib/server/replay/protocol.ts`.
