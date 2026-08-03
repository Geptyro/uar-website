---
title: Lobby and game chips update with less load on the database
type: improvement
area: site
impact: minor
---
Who is in a lobby or a game is now tracked in the site's memory instead of
being written to the database every minute. Nothing changes on screen, except
that for up to a minute after a site update the chips are empty while each
companion app checks back in.
