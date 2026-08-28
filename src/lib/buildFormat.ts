/**
 * The guide format, written down for a machine: what an exported build looks
 * like, what every block may hold, how the text names the game's things, and
 * the ids a guide for one class may use. Served beside every export so that
 * an AI handed "make me one like this" has the schema and the vocabulary in
 * the same breath, not one example to guess from.
 *
 * Nothing here is authoritative on its own: a guide that comes back through
 * the editor is read by `readBlocks` and checked by `validateBuild` like any
 * other save. This is the description of those rules, not a second copy.
 */

import { siTracks, type RankKey } from './ranks.ts';
import { allMos, items, mosById, rankTracksFor, siFor, skillIdentifiers, usableItemsFor, type Mos } from './mos';
import { modeNames } from './players';
import { rules, skillPoints } from './mechanics';
import { mapSize } from './map';
import { placedKinds, regionNames } from './buildRender';
import { BUILD_LIMITS, MAP_MARK_KINDS, MAP_TONES, TABLE_ALIGNS } from './builds';
import { SCHEMA_URL } from './buildSchema';

export const FORMAT_VERSION = 1;

/** The export of one guide: the document, with where its format is described. */
export interface BuildExport {
	$schema: string;
	format: string;
	version: number;
	mos: string;
	slug: string;
	title: string;
	modes: string[];
	ranks: RankKey[];
	skills: string[];
	sis: { num: number; choice?: string }[];
	blocks: unknown[];
}

export const formatHref = (mos: string) => `/guides/format?mos=${encodeURIComponent(mos)}`;

export function buildFormat(mos: Mos) {
	const vehicle = mos.vehicle ? mosById.get(mos.vehicle) : undefined;
	return {
		version: FORMAT_VERSION,
		schema: SCHEMA_URL,
		about: [
			'A guide is a JSON document for the UAR Unit Database (uar.cedricdessalles.dev): a player-written guide for one class. Its JSON Schema is at `schema`; this document adds what the schema cannot say: the ids this class may use.',
			'Import it in the guide editor (Write a guide → Import); the site validates it on save with the limits below.',
			'Top-level fields: title, modes, ranks, skills, sis, blocks. Everything else in an export is informational.',
			'modes: names from `modes` below, or [] for any mode.',
			'ranks: track keys from `ranks` below (the rank tracks this class can be played on), or [] for any rank; a class open to one track gets that track whatever is sent. With a rank set, every SI taken must list that track in its `tracks`.',
			'skills: skill ids, one entry per point in the order the points are spent (one point per level, the first at level 1). Repeat an id to put more points in it; never more than its `levels`.',
			'sis: skill identifiers taken, [{num, choice?}]; `choice` is a key from that SI\'s `choices` when it has a menu.',
			'blocks: the document, top to bottom. See `blocks` for each type.'
		],
		blocks: {
			nesting: 'section holds any block but a section; columns hold only markdown, table and map blocks.',
			section: { type: 'section', title: 'string (band heading, may be empty)', children: 'block[]' },
			columns: {
				type: 'columns',
				columns: `block[][] (${BUILD_LIMITS.columns.min} to ${BUILD_LIMITS.columns.max} columns; each block of a column is drawn as a card, side by side)`
			},
			markdown: { type: 'markdown', text: 'string (markdown; see `text`)' },
			table: {
				type: 'table',
				columns: `[{label, align: ${TABLE_ALIGNS.join('|')}, wide?: true}] (1 to ${BUILD_LIMITS.table.columns}; the wide column wraps, default the last)`,
				rows: `string[][] (up to ${BUILD_LIMITS.table.rows} rows, one cell per column, cells are inline markdown)`
			},
			map: {
				type: 'map',
				title: 'string (optional)',
				caption: 'string (optional)',
				marks: `[{kind: ${MAP_MARK_KINDS.join('|')}, tone: ${MAP_TONES.join('|')}, label, at?: {x, y} | {region}, r?, side?: left|right, placed?}] (up to ${BUILD_LIMITS.map.marks})`,
				marksAbout: [
					'pin, area, label need `at`: a point in game coordinates (0..' + mapSize + ' on both axes, origin bottom-left) or a region name from `map.regions`. A mark on a region follows the map data.',
					'area: `r` is the radius in map units; absent means the region\'s own size.',
					'dots draws every pre-placed object of one kind: `placed` is a key from `map.placed`; `label` is its legend entry.'
				]
			}
		},
		text: {
			markdown: 'headings (#, ##, ###), paragraphs, **bold**, *italic*, - lists, 1. lists, > quotes, `code`, [links](https://…), | tables |, ---. A new line is a new line. Raw HTML is shown as typed.',
			references: [
				'[[skill:Security]], [[ability:Craft]], [[item:Scope]], [[mos:CombatEngineer]], [[si:17]], [[unit:MULE]], [[mission:<group id>]]: a chip with the thing\'s icon, hover text and link. Ids from this document; names work too. [[player:<toon>|Name]] names a player by handle (the editor\'s @ search writes it).',
				'[[Sentry Gun]] with no kind looks everywhere (skills, abilities, items, classes, SIs, entities).',
				'[[kind:id|words]] shows other words on the chip. Inside a table cell written in markdown, escape the pipe: [[kind:id\\|words]].',
				'{{kind:id}} is the same reference drawn as an entry: the icon beside a bold name, for the first column of a table or the head of a list item.'
			],
			keys: 'A backticked key (`F1`, `Q`, `2`, `Ctrl`) is drawn as a key cap; [[key:Ctrl+F]] for anything longer.',
			pictures: `![what it shows](img:<id>) shows a picture uploaded in the editor (the editor writes this for you). Only pictures the saving account uploaded may be shown; up to ${BUILD_LIMITS.images} per build.`
		},
		limits: BUILD_LIMITS,
		modes: modeNames,
		ranks: rankTracksFor(mos.id).map((t) => ({ key: t.key, name: t.name })),
		levels: { max: rules.levels.max, pointsPerLevel: rules.levels.pointsPerLevel, points: skillPoints },
		class: {
			id: mos.id,
			name: mos.name,
			skills: mos.skills.map((s) => ({ id: s.id, name: s.name, levels: s.levels })),
			abilities: [...mos.common, ...(vehicle?.common ?? [])].map((a) => ({ id: a.id, name: a.name })),
			vehicle: vehicle ? { id: vehicle.id, name: vehicle.name } : null,
			items: usableItemsFor(mos.id)
				.filter((i) => i.type !== 'supply')
				.map((i) => ({ id: i.id, name: i.name, type: i.type })),
			sis: [...siFor(mos.id), ...skillIdentifiers.filter((s) => s.mos === null)].map((s) => ({
				num: s.num,
				name: s.name,
				code: s.code,
				tracks: siTracks(s.xp),
				...(s.choices ? { choices: s.choices.map((c) => ({ key: c.key, name: c.name })) } : {})
			}))
		},
		classes: allMos.filter((m) => m.id !== 'TemplateMOS').map((m) => ({ id: m.id, name: m.name, mos: m.mos })),
		itemsAll: items.filter((i) => i.playable).map((i) => ({ id: i.id, name: i.name })),
		map: { size: mapSize, regions: regionNames, placed: placedKinds }
	};
}
