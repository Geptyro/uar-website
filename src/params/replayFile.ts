import type { ParamMatcher } from '@sveltejs/kit';

/** Canonical replay file name (YYYYMMDD-HHMM[-n].SC2Replay) — the download URLs. */
export const match: ParamMatcher = (param) => /^\d{8}-\d{4}(-\d+)?\.SC2Replay$/.test(param);
