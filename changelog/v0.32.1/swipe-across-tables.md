---
title: Swiping between profile tabs works over the tables too
type: fix
area: players
---
On a phone you can swipe left and right across a profile to move between its
tabs. Any table on the page used to swallow that — the mode and teammate boards
on the overview stopped it dead, and the replay history took every sideways drag
whether it had columns left to show or not.

Tables now keep only the drags they can use. A wide one still scrolls sideways
under your thumb; run it to its last column and the next pull that way turns the
page instead. A table narrow enough to fit gets out of the way entirely.
