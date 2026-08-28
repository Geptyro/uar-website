/**
 * What the new-build and edit-build actions share: the class as validation
 * sees it, the author as the session names them, the reading of a posted
 * form into a guide (or into a failure the editor can show), and the word to
 * the maintainer when one is published.
 */

import { fail, type ActionFailure } from '@sveltejs/kit';
import { modeNames } from '$lib/players';
import { siFor, skillIdentifiers, type Mos } from '$lib/mos';
import { rules, skillPoints } from '$lib/mechanics';
import { mapSize } from '$lib/map';
import { placedKinds, regionNames } from '$lib/buildRender';
import {
	buildHref,
	imageRefs,
	readBuildForm,
	validateBuild,
	type BuildAuthor,
	type BuildContext,
	type BuildDoc,
	type BuildFormValues,
	type BuildInput
} from '$lib/builds';
import { imagesOwnedBy } from './builds';
import { pushToAdmins } from './notify';
import { mosTracks, siTracks } from '$lib/ranks';
import type { Session } from './session';

export function buildContext(mos: Mos): BuildContext {
	return {
		skills: mos.skills.map((s) => ({ id: s.id, name: s.name, levels: s.levels })),
		modes: modeNames,
		ranks: mosTracks(mos.unlock),
		points: skillPoints,
		levelMax: rules.levels.max,
		// its own, and the ones any class may take, each with the keys of its menu
		sis: [...siFor(mos.id), ...skillIdentifiers.filter((s) => s.mos === null)].map((s) => ({
			num: s.num,
			name: s.name,
			choices: (s.choices ?? []).map((c) => c.key),
			tracks: siTracks(s.xp)
		})),
		mapSize,
		regions: regionNames,
		placed: placedKinds.map((p) => p.key)
	};
}

export function authorOf(session: Session): BuildAuthor {
	return {
		sub: session.sub,
		battletag: session.battletag,
		...(session.toon ? { toon: session.toon } : {})
	};
}

export function valuesOf(input: BuildInput): BuildFormValues {
	const { publish: _publish, ...values } = input;
	return values;
}

export interface BuildFormFailure {
	error: string;
	values?: BuildFormValues;
}

export type ParsedBuildForm =
	| { ok: true; value: BuildInput }
	| { ok: false; failure: ActionFailure<BuildFormFailure> };

/**
 * A posted form as a guide, checked against the class and against who is
 * saving it: a picture may only be shown by the account that uploaded it, so
 * a reference copied out of someone else's build is refused here rather than
 * silently dropped by the sweep later.
 */
export async function parseBuildForm(
	request: Request,
	mos: Mos,
	sub: string
): Promise<ParsedBuildForm> {
	const form = await request.formData().catch(() => null);
	if (!form) {
		return { ok: false, failure: fail(400, { error: 'The form did not arrive whole. Try again.' }) };
	}
	const input = readBuildForm(form);
	const values = valuesOf(input);
	const v = validateBuild(input, buildContext(mos));
	if (!v.ok) return { ok: false, failure: fail(400, { error: v.error, values }) };
	const refs = imageRefs(v.value.blocks);
	if (refs.length) {
		const mine = await imagesOwnedBy(sub, refs);
		if (refs.some((id) => !mine.has(id))) {
			return {
				ok: false,
				failure: fail(400, { error: 'One of the pictures is not one you uploaded.', values })
			};
		}
	}
	return { ok: true, value: v.value };
}

/** Tell the maintainer. Fire and forget: the save has already happened. */
export function announceBuild(doc: BuildDoc, mos: Mos): void {
	void pushToAdmins({
		title: `New ${mos.name} guide`,
		body: `${doc.title}, by ${doc.author.battletag}`,
		url: buildHref(mos.id, doc.slug)
	}).catch((e) => console.error('build announce failed:', e));
}
