---
title: Game durations no longer count the time you sat in a finished game
type: fix
area: replays
---
UAR leaves you in the map after a game ends — you stay there until you click
through the win/loss screen. StarCraft keeps recording the whole time, so if
you walked away instead of clicking, your replay claimed a game that lasted
hours longer than it did. One archived game read 9 hours for a fight that
finished in 1 hour 18.

Every duration now reports the game itself: the replay list, the last-games
widget, your profile's history and the per-class playtime boards, which
credited that idle time to all twelve players in the lobby. A game's own page
still shows how long its recording ran when the two differ.

Game times are also placed correctly now. A replay's timestamp is the moment
StarCraft *saved* the file — the end of the game, not the start — so the
activity chart on the overview was drawing every game a full game-length late.
Replay pages now lead with when the game started.
