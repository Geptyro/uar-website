/**
 * Protocol registry + top-level decode functions (port of s2protocol's
 * per-build protocol modules; the data tables live in protocols/*.json).
 *
 * To support a new SC2 base build, run scripts/convert_protocol.py <build>
 * and add the import below.
 */

import { BitPackedDecoder, VersionedDecoder, CorruptedError, type TypeInfo } from './decoders.ts';
import proto97563 from './protocols/protocol97563.json' with { type: 'json' };

export interface Protocol {
	build: number;
	typeinfos: TypeInfo[];
	game_event_types: Record<string, [number, string]>;
	message_event_types: Record<string, [number, string]>;
	tracker_event_types: Record<string, [number, string]>;
	game_eventid_typeid: number;
	message_eventid_typeid: number;
	tracker_eventid_typeid: number;
	svaruint32_typeid: number;
	replay_userid_typeid: number;
	replay_header_typeid: number;
	game_details_typeid: number;
	replay_initdata_typeid: number;
}

const PROTOCOLS = new Map<number, Protocol>([[97563, proto97563 as unknown as Protocol]]);

export function latestProtocol(): Protocol {
	let best: Protocol | null = null;
	for (const p of PROTOCOLS.values()) if (!best || p.build > best.build) best = p;
	return best as Protocol;
}

/** Exact protocol for a base build, or the latest one as a fallback. */
export function getProtocol(baseBuild: number): Protocol {
	return PROTOCOLS.get(baseBuild) ?? latestProtocol();
}

export function hasProtocol(baseBuild: number): boolean {
	return PROTOCOLS.has(baseBuild);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function decodeReplayHeader(userDataContent: Uint8Array): any {
	const p = latestProtocol();
	return new VersionedDecoder(userDataContent, p.typeinfos).instance(p.replay_header_typeid);
}

export function decodeReplayDetails(p: Protocol, contents: Uint8Array): any {
	return new VersionedDecoder(contents, p.typeinfos).instance(p.game_details_typeid);
}

export function decodeReplayInitdata(p: Protocol, contents: Uint8Array): any {
	return new BitPackedDecoder(contents, p.typeinfos).instance(p.replay_initdata_typeid);
}

function varuint32Value(value: Record<string, number>): number {
	for (const key in value) return value[key];
	return 0;
}

function* decodeEventStream(
	p: Protocol,
	decoder: BitPackedDecoder | VersionedDecoder,
	eventidTypeid: number,
	eventTypes: Record<string, [number, string]>,
	decodeUserId: boolean
): Generator<any> {
	let gameloop = 0;
	while (!decoder.done()) {
		const delta = varuint32Value(decoder.instance(p.svaruint32_typeid) as Record<string, number>);
		gameloop += delta;

		let userid: unknown;
		if (decodeUserId) userid = decoder.instance(p.replay_userid_typeid);

		const eventid = decoder.instance(eventidTypeid) as number;
		const eventType = eventTypes[String(eventid)];
		if (!eventType) throw new CorruptedError(`eventid(${eventid})`);

		const event = decoder.instance(eventType[0]) as Record<string, unknown>;
		event['_event'] = eventType[1];
		event['_eventid'] = eventid;
		event['_gameloop'] = gameloop;
		if (decodeUserId) event['_userid'] = userid;

		decoder.byteAlign();
		yield event;
	}
}

export function decodeReplayGameEvents(p: Protocol, contents: Uint8Array): Generator<any> {
	const decoder = new BitPackedDecoder(contents, p.typeinfos);
	return decodeEventStream(p, decoder, p.game_eventid_typeid, p.game_event_types, true);
}

export function decodeReplayTrackerEvents(p: Protocol, contents: Uint8Array): Generator<any> {
	const decoder = new VersionedDecoder(contents, p.typeinfos);
	return decodeEventStream(p, decoder, p.tracker_eventid_typeid, p.tracker_event_types, false);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
