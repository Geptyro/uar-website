---
title: "Fixed: the Alligator LK19 spun a robot tiger, and the Predator was bare chrome"
type: fix
area: wiki
---
The Alligator's entity and class pages showed a Predator — the base game's robotic
tiger — where the combat helicopter should have been. The class flies a Ka-52
Alligator, a coaxial-rotor gunship the map builds out of Banshee, Wraith and
Hellion parts; that model is now pulled from the map's own model archive, so the
viewer shows the helicopter you actually fly.

The Predator's Black Ops Goliath had a different problem: it loaded, but as
polished grey metal, its paint and cyan running lights gone. The exporter had
been handed StarCraft's packed specular and normal maps as if they were glow and
shine; both models now carry their plain in-game paint the way every other one
does.
