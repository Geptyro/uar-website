/**
 * The guide document as a JSON Schema (draft 2020-12): what a validator, an
 * editor with schema support or an AI can check a document against before it
 * ever reaches the site. Built from the same limits and enums the site
 * enforces, so the two cannot drift; the class-specific vocabulary (which
 * skill ids, which regions) is not in the schema, since a schema is one for
 * every class: it lives in `/guides/format?mos=…` (see $lib/buildFormat).
 *
 * The site does not validate against this schema itself: `readBlocks` and
 * `validateBuild` are the authority, and the schema is their description.
 */

import { BUILD_LIMITS, MAP_MARK_KINDS, MAP_TONES, TABLE_ALIGNS } from './builds';
import { SITE_URL } from './seo';

export const SCHEMA_URL = `${SITE_URL}/guides/schema.json`;

const str = (max: number, description?: string) => ({ type: 'string', maxLength: max, ...(description ? { description } : {}) });

export function buildSchema() {
	const block = { $ref: '#/$defs/block' };
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: SCHEMA_URL,
		title: 'UAR build',
		description:
			'A player-written guide for one class of Undead Assault Reborn, as the UAR Unit Database imports and exports it. The ids a document may use (skills, abilities, items, SIs, map regions) depend on the class: see /builds/format?mos=<class id>.',
		type: 'object',
		required: ['title', 'blocks'],
		additionalProperties: true,
		properties: {
			$schema: { type: 'string' },
			format: { type: 'string', description: 'Where the format for this class is described.' },
			version: { type: 'integer' },
			mos: { type: 'string', description: 'The class id the guide is for.' },
			slug: { type: 'string', description: 'Set by the site; ignored on import.' },
			title: { type: 'string', minLength: BUILD_LIMITS.title.min, maxLength: BUILD_LIMITS.title.max },
			modes: {
				type: 'array',
				description: 'Game mode names the guide is written for; empty means any.',
				items: { type: 'string' },
				uniqueItems: true
			},
			ranks: {
				type: 'array',
				description: 'Rank track keys the guide is written for (en, wo, co); empty means any. Only tracks the class can be played on.',
				items: { type: 'string', enum: ['en', 'wo', 'co'] },
				uniqueItems: true
			},
			skills: {
				type: 'array',
				description:
					'Skill ids, one entry per point in the order the points are spent (one point per level, the first at level 1). Repeat an id for more points in it, never more than its level count.',
				items: { type: 'string' },
				maxItems: BUILD_LIMITS.skills
			},
			sis: {
				type: 'array',
				description: 'Skill identifiers taken.',
				maxItems: BUILD_LIMITS.sis,
				items: {
					type: 'object',
					required: ['num'],
					properties: {
						num: { type: 'integer', description: 'The SI number.' },
						choice: { type: 'string', description: 'For an SI with a menu (the Battle Buddy), the key of the entry.' }
					},
					additionalProperties: false
				}
			},
			blocks: {
				type: 'array',
				description: 'The document, top to bottom.',
				minItems: 1,
				items: block
			}
		},
		$defs: {
			block: {
				oneOf: [
					{ $ref: '#/$defs/section' },
					{ $ref: '#/$defs/columns' },
					{ $ref: '#/$defs/markdown' },
					{ $ref: '#/$defs/table' },
					{ $ref: '#/$defs/map' }
				]
			},
			leaf: {
				description: 'What a column may hold: no containers inside a column.',
				oneOf: [{ $ref: '#/$defs/markdown' }, { $ref: '#/$defs/table' }, { $ref: '#/$defs/map' }]
			},
			inSection: {
				description: 'What a section may hold: anything but a section.',
				oneOf: [
					{ $ref: '#/$defs/columns' },
					{ $ref: '#/$defs/markdown' },
					{ $ref: '#/$defs/table' },
					{ $ref: '#/$defs/map' }
				]
			},
			section: {
				type: 'object',
				description: 'A band heading over blocks.',
				required: ['type', 'title', 'children'],
				properties: {
					type: { const: 'section' },
					title: str(BUILD_LIMITS.heading, 'May be empty.'),
					children: { type: 'array', items: { $ref: '#/$defs/inSection' } }
				},
				additionalProperties: false
			},
			columns: {
				type: 'object',
				description: 'Two or three columns side by side; every block of a column is drawn as a card.',
				required: ['type', 'columns'],
				properties: {
					type: { const: 'columns' },
					columns: {
						type: 'array',
						minItems: BUILD_LIMITS.columns.min,
						maxItems: BUILD_LIMITS.columns.max,
						items: { type: 'array', items: { $ref: '#/$defs/leaf' } }
					}
				},
				additionalProperties: false
			},
			markdown: {
				type: 'object',
				description:
					'Markdown. Headings, lists, tables, quotes, code, links. [[kind:id]] or [[name]] for a chip of a skill/ability/item/mos/si/unit, {{kind:id}} for the entry form, `F1` for a key cap, ![alt](img:<id>) for an uploaded picture.',
				required: ['type', 'text'],
				properties: {
					type: { const: 'markdown' },
					text: str(BUILD_LIMITS.column)
				},
				additionalProperties: false
			},
			table: {
				type: 'object',
				description: 'A table whose cells are inline markdown.',
				required: ['type', 'columns', 'rows'],
				properties: {
					type: { const: 'table' },
					columns: {
						type: 'array',
						minItems: 1,
						maxItems: BUILD_LIMITS.table.columns,
						items: {
							type: 'object',
							required: ['label', 'align'],
							properties: {
								label: str(BUILD_LIMITS.heading),
								align: { enum: [...TABLE_ALIGNS] },
								wide: { const: true, description: 'The column that wraps and takes the width the others leave; default the last.' }
							},
							additionalProperties: false
						}
					},
					rows: {
						type: 'array',
						maxItems: BUILD_LIMITS.table.rows,
						items: {
							type: 'array',
							description: 'One cell per column.',
							items: str(BUILD_LIMITS.table.cell)
						}
					}
				},
				additionalProperties: false
			},
			map: {
				type: 'object',
				description: 'The minimap with marks on it.',
				required: ['type', 'marks'],
				properties: {
					type: { const: 'map' },
					title: str(BUILD_LIMITS.heading),
					caption: str(BUILD_LIMITS.map.caption),
					marks: { type: 'array', maxItems: BUILD_LIMITS.map.marks, items: { $ref: '#/$defs/mark' } }
				},
				additionalProperties: false
			},
			mark: {
				type: 'object',
				required: ['kind', 'tone', 'label'],
				properties: {
					kind: { enum: [...MAP_MARK_KINDS] },
					tone: { enum: [...MAP_TONES] },
					label: str(BUILD_LIMITS.heading, 'The words by the mark; for dots, the legend entry.'),
					at: {
						description: 'pin, area, label: a point in game coordinates (origin bottom-left, 0..map size), or a region name of the map.',
						oneOf: [
							{
								type: 'object',
								required: ['x', 'y'],
								properties: { x: { type: 'number', minimum: 0 }, y: { type: 'number', minimum: 0 } },
								additionalProperties: false
							},
							{
								type: 'object',
								required: ['region'],
								properties: { region: { type: 'string' } },
								additionalProperties: false
							}
						]
					},
					r: { type: 'number', exclusiveMinimum: 0, description: 'area: radius in map units; absent means the region\'s own size.' },
					side: { enum: ['left', 'right'], description: 'pin: which side the label sits.' },
					placed: { type: 'string', description: 'dots: a kind of pre-placed object (a key of the format\'s map.placed).' }
				},
				additionalProperties: false,
				allOf: [
					{ if: { properties: { kind: { const: 'dots' } } }, then: { required: ['placed'] }, else: { required: ['at'] } }
				]
			}
		}
	};
}
