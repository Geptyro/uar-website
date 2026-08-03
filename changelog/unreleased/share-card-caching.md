---
title: Share cards are cached like the rest of the artwork
type: fix
area: site
impact: minor
---
The per-page share cards — the pictures that appear when a link is posted in
Discord — were left out of the caching added in v0.34.0, so they were fetched
again every time rather than kept. Only the site-wide card was covered.
