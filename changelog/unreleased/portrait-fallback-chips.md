---
title: 'Fixed: broken portraits in the ready and presence lists'
type: fix
area: players
impact: minor
---

The previous release fixed missing Battle.net portraits on profiles and
leaderboards, but the "ready to play" rows and the in-game presence lists draw
their portraits from shared code that still showed the broken-image icon.

Those lists now fall back to the anonymous portrait too, so a player whose
Battle.net portrait cannot be loaded looks the same everywhere on the site.
