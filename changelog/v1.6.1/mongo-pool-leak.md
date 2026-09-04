---
title: Fix a connection leak that could take the site down
type: fix
area: site
---

The server now keeps a single, size-capped database connection pool for its whole life instead of opening a new one whenever its code was reloaded. A leak there could exhaust the database's connection limit and stop every page that reads live data from loading.
