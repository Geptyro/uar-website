---
title: Player, clan and replay pages stay fast
type: fix
area: site
---
The site keeps recent results in memory so pages open instantly. Every status
update from a running Companion — one every half-minute, from each player who
has it open — was throwing that away wholesale, so most visits were paying to
look everything up from scratch again.

A status update now only refreshes who is online, which is all it ever
changed. The pages themselves stay warm.
