# UAR website — uar.cedricdessalles.dev

Unit database & player stats for the SC2 arcade map Undead Assault Reborn.
SvelteKit (Svelte 5, Kit 2), adapter-node on Fly.io. Wiki pages (units, MOS,
items, camos…) are prerendered from JSON snapshots in `src/lib/data/`;
players/replays/account pages are SSR from MongoDB Atlas; replay blobs live in
a Tigris bucket.

## Hard rules (each learned from a real incident)

- NEVER `git add -A` or stage by directory — parallel sessions share this
  working tree. Stage explicit files only, and only what your task touched.
- Release = `npm run release vX.Y.Z` (rolls up the changelog, tags, pushes
  main + tag in one step). deploy.yml re-runs full CI on the tagged commit
  and only deploys when green, so a tag cannot ship a broken tree — but a
  local build still cannot catch parallel-WIP contamination (the files exist
  locally); only clean-checkout CI can, so keep commits self-contained.
- Prod is never a test bench. Test uploads/ingest against the local docker
  rig, not uar.cedricdessalles.dev.
- `src/lib/data/*.json` is generated (extractor in `../` for game data,
  `scripts/` for players/protocol). Never hand-edit; regenerate.
- Never import `$lib/server/*` from client-reachable code. Keep logic under
  test in dependency-free modules (pattern: `$lib/xp.ts`) so plain node:test
  can load it without Vite's import chain.

## Changelog

Every user-visible change must include a `changelog/unreleased/*.md` entry in
the same commit (frontmatter: `title`, `type: feature|improvement|fix|data`,
`area: wiki|players|replays|site`; body written for players, not developers —
see `changelog/unreleased/README.md`). `npm run release vX.Y.Z` rolls entries
into `changelog/vX.Y.Z/` before tagging.

## Dev & tests

- `npm run dev` needs `.env` (gitignored). Server code reads `process.env`
  (not `$env`) so CLIs work: `node --env-file=.env scripts/<x>.ts`.
- `npm test` = unit tests (node:test, `tests/**/*.test.ts`).
- `npm run test:integration` = throwaway docker mongo+minio against the real
  built server.
- Form actions from dev/curl need an `Origin` header or adapter-node returns
  403 cross-site; prod sets `ORIGIN` in fly.toml.
- Rate limiters are in-memory: `fly apps restart` clears them.

## Deploy

Tag push → `deploy.yml` → Fly app `uar-website` (private flycast behind the
gateway app). Secrets: repo secret `APP_SECRETS` (dotenv-style lines) is
staged into Fly on each deploy; Tigris creds were set by `fly storage create`.
