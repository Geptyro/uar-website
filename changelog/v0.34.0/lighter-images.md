---
title: Pages with a lot of class art load much faster
type: improvement
area: site
---
The class and item icons were shipping at full colour depth for artwork that
never needed it — around 30 KB each, for pictures drawn at the size of a line of
text. A profile's replay tab pulls twenty-six of them, so nearly all of that
page was pictures.

They are now a quarter of the size, along with the camo swatches and the map,
and they look the same. Your browser is also told it may keep them, which it
previously was not — so moving between pages no longer re-checks every icon
before it can finish drawing.
