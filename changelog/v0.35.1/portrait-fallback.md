---
title: 'Fixed: broken-image icon instead of a player portrait'
type: fix
area: players
---

Some Battle.net portraits never load — Blizzard's profile service hands out
addresses for portrait art it has not actually published, so the picture is
missing at the source and no amount of refreshing brings it back.

Those players showed the browser's broken-image icon on their profile, in the
"played with" lists, on the class leaderboards and in the page header. They now
show the same anonymous portrait as a player who has not linked an account, and
will pick their real portrait back up if Blizzard ever publishes the art.
