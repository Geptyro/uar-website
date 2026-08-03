---
title: 'Fixed: games thrown away when the site was busy'
type: fix
area: replays
impact: major
---
A replay that arrived while the site was busy processing others could be
answered with "Not a readable StarCraft II replay" — even though the file was
perfectly fine and the only thing wrong was that the server had run out of time
to read it.

That answer is final. The Companion took it at its word, wrote the game off as
rejected and never offered it again, so a busy few minutes could quietly cost
you real games. It showed up worst on a first run, where hundreds of past
replays are uploaded back to back.

The site now says it is busy instead of blaming the file, and the Companion
retries those uploads on its own a couple of minutes later. It also runs on
twice the processing power, so it is far less likely to fall behind in the
first place.

Games already written off this way are picked up again by the next Companion
update — you do not need to do anything, and none of your replay files were
changed.
