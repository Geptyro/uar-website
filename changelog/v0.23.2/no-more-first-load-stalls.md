---
title: No more slow first load on the player, clan and replay pages
type: fix
area: site
---
Since this morning's speed work, one visitor every ten minutes was still
waiting several seconds for [players](/players), [clans](/clans) or
[replays](/replays) to open — the pages were meant to refresh quietly in the
background instead of making somebody wait, and a mistake on our side had
switched that off.

The site also fills its cache when it starts up now, so the first person to
visit after an update no longer pays for it either.
