// Portrait fallback lives in uar-shared: the companion renders the same chips
// from the same components, and the ready rows / presence groups on this site
// are those components (cf. $lib/presence.ts, which re-exports for the same
// reason). Re-exported under $lib so the call sites here read like the rest of
// the codebase.
//
// Why it exists: Blizzard hands out portrait urls for sprite sheets it never
// published, so a linked account can carry a portrait that has never existed
// and no refresh will fix it. See uar-shared/src/portrait.js.
export { hasFailed, portraitFallback } from 'uar-shared/portrait';
