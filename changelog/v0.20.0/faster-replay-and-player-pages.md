---
title: Pages load instantly instead of occasionally hanging
type: improvement
area: site
---
Every so often a page would sit there for ten seconds before appearing —
usually the [replays](/replays) list or the overview, and usually right after
a reload. The site was reading its entire archive from the database just to
show one screen of it, and it got slower with every game uploaded.

Every page now asks for exactly the rows it shows: the replay list, the
[leaderboard](/players) (including sorting and search), [clans](/clans), and
the per-class top-players tables. Each game's result is worked out once when a
replay is uploaded rather than re-derived on every visit. The stalls are gone,
and pages stay fast as the archive keeps growing.
