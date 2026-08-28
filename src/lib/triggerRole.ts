/**
 * What a trigger is for, read from what fires it and what it pays.
 *
 * Its own module, with nothing but a type import, so a plain node test can
 * load it: `$lib/flow` carries the flow data and cannot be loaded without
 * Vite's alias.
 */
import type { FlowNode } from './flow';

export type TriggerRole =
	| 'success'
	| 'fail'
	| 'timeout'
	| 'loop'
	| 'scheduled'
	| 'player action'
	| 'enter region'
	| 'unit dies'
	| 'called'
	| 'other';

const PLAYER_EVENTS = new Set([
	'UnitAbility',
	'UnitSelected',
	'DialogControl',
	'ChatMessage',
	'UnitBehaviorChange',
	'PlayerEffectUsed',
	'UnitInventoryChange',
	'UnitGainLevel',
	'UnitOrder',
	'MouseClicked'
]);

/**
 * What a trigger is for, read from what fires it and what it pays: the end
 * of something (success, fail, a timeout), a loop, a scheduled start, a
 * player's action, a unit somewhere. The chart and the cards tag chips with
 * it, so a group reads as start → loop → end at a glance.
 */
export function triggerRole(n: FlowNode): TriggerRole {
	const ev = new Set(n.events.map((e) => e.type));
	if (n.succeed.length && !n.fail.length) return 'success';
	if (n.fail.length) return ev.has('Timer') ? 'timeout' : 'fail';
	if (ev.has('TimePeriodic')) return 'loop';
	if ([...ev].some((t) => PLAYER_EVENTS.has(t))) return 'player action';
	if (ev.has('TimeElapsed') || ev.has('Timer')) return 'scheduled';
	if (ev.has('UnitRegion')) return 'enter region';
	if (ev.has('UnitDied')) return 'unit dies';
	if (!ev.size && !n.armed) return 'called';
	return 'other';
}

