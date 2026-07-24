# UAR Unit Database

Unofficial unit reference for the StarCraft II arcade map **Undead Assault Reborn** (EU, by Znimu#743).

SvelteKit (Svelte 5) site, fully prerendered to static HTML with `@sveltejs/adapter-static` — 428 unit pages plus an overview and a filterable table.

## Data

`src/lib/data/units.json` is generated from the map's game data files, extracted from the local
Battle.net cache (`.s2ma` MPQ archives → `UnitData.xml`, `WeaponData.xml`, `EffectData.xml`,
English localization). Raw extracted files live in `../extracted/`. Values are pre-trigger raw
data; in-game numbers can differ because `MapScript.galaxy` applies runtime modifiers.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build    # static site in build/
npm run preview
```
