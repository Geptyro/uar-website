/**
 * The effects the site can name, slim enough for the client: id, name, kind
 * and icon (effects-index.json, ~15 KB). The full catalog with what each does
 * stays server-side in behaviors.json; this is what the guide editor's `@`
 * search and the command palette carry.
 */
import raw from '$lib/data/effects-index.json';
import type { EffectKind } from './effects';

export interface EffectIndexEntry {
	id: string;
	name: string;
	kind: EffectKind;
	icon: string | null;
}

export const effectsIndex: EffectIndexEntry[] = raw as EffectIndexEntry[];
export const effectById = new Map(effectsIndex.map((e) => [e.id, e]));

export const EFFECT_KIND_WORD: Record<EffectKind, string> = {
	ailment: 'ailment',
	debuff: 'debuff',
	buff: 'buff',
	status: 'status'
};
