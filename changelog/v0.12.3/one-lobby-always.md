---
title: 'Open lobbies count as one lobby'
type: fix
area: site
impact: minor
---

When several people in a lobby run the companion app, the site showed the
lobby once per person. Nothing StarCraft tells us locally can distinguish
two lobbies that are open at the same time, so the status bar now treats
everyone waiting as being in the one lobby. Games are unaffected — those
are told apart properly and still list separately.
