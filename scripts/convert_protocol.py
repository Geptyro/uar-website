#!/usr/bin/env python3
"""Convert an s2protocol protocol module to JSON for the TS replay parser.

The protocol files are pure data (typeinfos + event tables); the TS decoders
in src/lib/server/replay/ interpret them directly. Run once per SC2 base
build we want to support (rare — SC2 is in maintenance mode):

    .venv/bin/pip install s2protocol
    .venv/bin/python scripts/convert_protocol.py 97563

Writes src/lib/server/replay/protocols/protocol<build>.json
"""

import importlib
import json
import os
import sys

build = int(sys.argv[1]) if len(sys.argv) > 1 else 97563
mod = importlib.import_module(f"s2protocol.versions.protocol{build:05d}")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(ROOT, "src", "lib", "server", "replay", "protocols")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, f"protocol{build:05d}.json")

data = {
    "build": build,
    "typeinfos": mod.typeinfos,
    "game_event_types": mod.game_event_types,
    "message_event_types": mod.message_event_types,
    "tracker_event_types": mod.tracker_event_types,
    "game_eventid_typeid": mod.game_eventid_typeid,
    "message_eventid_typeid": mod.message_eventid_typeid,
    "tracker_eventid_typeid": mod.tracker_eventid_typeid,
    "svaruint32_typeid": mod.svaruint32_typeid,
    "replay_userid_typeid": mod.replay_userid_typeid,
    "replay_header_typeid": mod.replay_header_typeid,
    "game_details_typeid": mod.game_details_typeid,
    "replay_initdata_typeid": mod.replay_initdata_typeid,
}

with open(out_path, "w") as f:
    json.dump(data, f, separators=(",", ":"))
print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")
