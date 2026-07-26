# UAR Unit Database

Unofficial unit reference for the StarCraft II arcade map **Undead Assault Reborn** (EU, by Znimu#743).

SvelteKit (Svelte 5) site, fully prerendered to static HTML with `@sveltejs/adapter-static` — 428 unit pages plus an overview and a filterable table.

## Data

`src/lib/data/units.json` is generated from the map's game data files, extracted from the local
Battle.net cache (`.s2ma` MPQ archives → `UnitData.xml`, `WeaponData.xml`, `EffectData.xml`,
English localization). Raw extracted files live in `../extracted/`. Values are pre-trigger raw
data; in-game numbers can differ because `MapScript.galaxy` applies runtime modifiers.

## Battle.net login

Players can connect their Battle.net account on `/account` (Blizzard OAuth,
authorization-code flow, scope `openid sc2.profile`). The SC2 profiles linked to
the account are matched to player pages by toon handle and marked as verified.

Env vars (`.env` for dev, `fly secrets` in prod):

- `BNET_CLIENT_ID` / `BNET_CLIENT_SECRET` — OAuth client from
  <https://develop.battle.net/access/clients>. Register both redirect URLs:
  `https://uar.cedricdessalles.dev/auth/bnet/callback` and
  `http://localhost:5173/auth/bnet/callback` (dev).
- `AUTH_SECRET` — random 32+ bytes (`openssl rand -hex 32`); signs the session
  cookie. Rotating it signs everyone out.
- `BNET_REDIRECT_URI` — optional override if the URI derived from the request
  origin can't match a registered redirect URL.

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
