import { mosList } from '$lib/mos';
import type { EntryGenerator } from './$types';

/* Every class with a page of its own — the layout already turned a piloted
   vehicle away before this runs. */
export const entries: EntryGenerator = () => mosList.map((m) => ({ id: m.id }));
