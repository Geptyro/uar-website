---
title: A page for every trigger group, missions and mechanics alike
type: feature
area: wiki
impact: major
---
A new Triggers section, read from the map's trigger script rather than
written by hand. The script's triggers are grouped into what a player meets
as one thing, and each group gets a page with two tabs, framed like a class
page: the overview, with the minimap of the regions, points and units its
triggers name and, trigger by trigger, what fires it, what it puts on the
screen (objectives, messages, pings, the lines over a unit) and what it pays
or costs in XP; and the flow, the chain of those triggers on a canvas of its
own that pans and zooms like the map. What armed the
group and what it waits for link to the group that does it. The units in
play are named the way the map's author named them, with a link to the unit
they are (Abdul is a civilian by a wrecked truck); the routes a convoy or an
escort is driven along are drawn on the map in order, and so is the stretch a
thing may appear on. The map pans and zooms, its markers keep their size
while the ground grows, and the names are laid out so they can be read:
moved aside with a line back to their point where it is crowded, hidden with
a count when nothing fits until you zoom in. Point at anything on the map for
what it is, with its picture.

Groups are typed by what they do: a mission awards or fails an outcome or
sets an objective, a mechanic is run by what a player does (the MULE beside
the City Guard is one), an event by the clock, the rest by units and regions.
The index is a table under those headings, with a filter and a search, and
the site's search box finds a group by its name, an outcome or a trigger. Every
trigger is tagged with its role: a start, a loop, a player's action, the end
that pays or the timeout that costs.

Mission flow is gone: its chain chart is what every trigger page draws, top
to bottom, and its list of triggers scheduled at a fixed game time now opens
the Triggers index, each one linking to its group. Old links to Mission flow
land on the right trigger page. Map & missions is now just the Map: every
named region of the AO, on a minimap that pans and zooms, and for each one
the trigger groups whose triggers name it, linked; the outcomes table it had
lives on the Triggers index.

Under the hood, trigger events say more (which class was picked, which
ability was used, whether the unit was selected), and an outcome raised deep
in a helper function is now credited to the triggers that reach it, so more
outcomes have their trigger.
