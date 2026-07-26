---
title: 'Hardened the replay upload endpoint'
type: fix
area: replays
impact: minor
---

The parser now refuses replay files whose contents claim to unpack to an
absurd size, instead of trying and running the server out of memory. Normal
replays are unaffected — even the longest games sit far below the new limit.
