---
title: One running game, one chip
type: fix
area: site
---
A game in progress could show up twice in the top bar, listing the same
players in both entries. The site groups players into games by the lobby id
the companion app reads from StarCraft, and not every player's install can
read it — the ones who could and the ones who couldn't were counted as two
separate games. They are now matched on their shared roster as well, so a
game counts once no matter who reported what.
