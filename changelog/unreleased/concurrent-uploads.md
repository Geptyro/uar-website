---
title: 'Two players uploading the same game at once'
type: fix
area: replays
---

When several players run the companion app, they all upload their own
recording of the same game — sometimes within the same second. Those
uploads are now handled one at a time, so the second one gets the normal
"already ingested" answer (or replaces the stored copy if it recorded
longer) instead of failing.
