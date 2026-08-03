---
title: Long backfills no longer pause for a quarter of an hour
type: improvement
area: replays
impact: minor
---
Uploading is much faster than it was, and the flood guard had not moved with
it — a big first-run backfill could reach the hourly ceiling and sit waiting
fifteen minutes before carrying on. Nothing was ever lost, but it looked like
the upload had stopped.

The ceiling is now well clear of anything a real backfill does.
