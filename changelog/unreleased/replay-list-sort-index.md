---
title: Replay pages no longer fail when the list refreshes
type: fix
area: replays
---

Opening a replay could end in a server error for a while: the list of games shown next to it is sorted by date on the database, which had no index for that order and gave up once the newest games grew past its memory limit. The order is now indexed, so the list refreshes without sorting in memory.
