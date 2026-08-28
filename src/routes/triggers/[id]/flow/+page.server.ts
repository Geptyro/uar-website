import { groupIds } from '$lib/groups';
import type { EntryGenerator } from './$types';

/** The flow tab of every group, prerendered like the overview. */
export const entries: EntryGenerator = () => groupIds.map((id) => ({ id }));
