import { allMos } from '$lib/mos';
import type { EntryGenerator } from './$types';

/* Every class, and the piloted vehicle too: its entry prerenders the redirect
   stub that sends /mos/Goliath2 to the Assault Engineer's vehicle tab. */
export const entries: EntryGenerator = () => allMos.map((m) => ({ id: m.id }));
