import type { ParamMatcher } from '@sveltejs/kit';

/** Replay page id — the canonical file name without its .SC2Replay extension. */
export const match: ParamMatcher = (param) => /^\d{8}-\d{4}(-\d+)?$/.test(param);
