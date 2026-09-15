---
title: No more errors when leaving some pages
type: fix
area: site
impact: minor
---
Leaving an effect, unit, class, trigger or player page could throw an error in the background while the next page loaded, which sometimes left the page stuck. Those pages now keep their own data until they are fully gone.
