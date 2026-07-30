# Changelog entries

One markdown file per user-visible change, committed in the same commit as the
change itself. `npm run release vX.Y.Z` moves the entries here into
`changelog/vX.Y.Z/`, stamps the release date, commits (changelog/ only), tags
and pushes — the deploy workflow re-runs CI on the tag and deploys only if it
passes. The site renders everything at `/changelog`.

Format — all frontmatter fields required, body written for players, not
developers:

```markdown
---
title: Short player-facing headline
type: feature
area: wiki
---
One or two sentences on what changed and why a player cares. Markdown subset:
paragraphs, "- " lists, **bold**, `code`, [links](/players) (absolute paths or
https only).
```

- `type`: `feature` (new), `improvement` (existing thing got better),
  `fix` (something wrong is now right), `data` (game-data refresh/expansion).
- `area`: `wiki` | `players` | `replays` | `site`.
- `impact` (optional): `major` = flagship, players shouldn't miss it (rare —
  at most one or two per release); `minor` = players wouldn't notice unless
  told — kept off the overview widget and the new-version dot, listed as a
  compact "Also:" line on /changelog. Omit for everything in between.

A title may be quoted or not — `title: 'Fixed: the thing'` and
`title: Fixed: the thing` both read as the same headline. Quote it if it
contains a `"`, and use single quotes when you do.

`npm run changelog:check` lints every entry (`npm test` runs it too). Worth
running after writing one: the parser deliberately never fails a build over an
entry, so an off-schema `type`/`area` would otherwise file the change under the
wrong heading without a word.
