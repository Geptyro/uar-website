---
title: Opening a replay is quicker
type: improvement
area: replays
---
Opening a game from the [replays](/replays) list fetched the whole stored
record every time — including each player's full unlock data, which that page
has never shown — and fetched it again on every revisit.

It now asks only for what the page displays, and remembers it, so a replay
opens in a fraction of the time and a second look is instant.
