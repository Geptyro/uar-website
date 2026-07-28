---
title: Uploading a replay is much faster
type: improvement
area: replays
---
Uploading a replay could take over a minute to come back, because the site
rebuilt every player profile from every stored game before answering — and
that got slower each time anyone uploaded anything.

An upload can only change the people who were in that game, so now only their
profiles are rebuilt. Uploads finish in a few seconds instead, whether you use
the [upload form](/replays) or the UAR Companion.
