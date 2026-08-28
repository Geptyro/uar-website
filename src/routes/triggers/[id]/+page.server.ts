import { groupIds } from '$lib/groups';
import type { EntryGenerator } from './$types';

/** One page per trigger group the extractor cut; the tabs are found from it. */
export const entries: EntryGenerator = () => groupIds.map((id) => ({ id }));
