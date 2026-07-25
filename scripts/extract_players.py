#!/usr/bin/env python3
"""Build src/lib/data/players.json from the replays/ folder.

SC2 replays record, at game start, the full contents of every player's UAR
bank (the map's save file) as bank events in the game-events stream, plus a
signature event carrying the owner's toon handle. This script decodes them.

Bank cipher (reversed from the map's MapScript.galaxy):
- integers (gf_hx): base-7 strings, least-significant digit first,
  digits 0-6 written as "t j c h w y o"
- booleans: a random char from "howfk" (true) or "cglzmn" (false)
- key names are decoys: nbe/nbw/nbc hold EN/WO/CO experience (cap 250000),
  "xp" holds games won per mode (12 modes, space-separated), "m" holds
  gamesPlayed, revives, avgGameTime + 2 UI offsets, "pb" holds prestige.

Usage:
    python3 -m venv .venv && .venv/bin/pip install mpyq s2protocol
    .venv/bin/python scripts/extract_players.py

s2protocol still imports the stdlib `imp` module (removed in Python 3.12);
a minimal shim is installed below before importing it.
"""

import datetime
import glob
import json
import os
import sys

# --- shim the removed `imp` module for s2protocol on Python >= 3.12 ---
import importlib.util
import types

if "imp" not in sys.modules:
    imp = types.ModuleType("imp")

    def _find_module(name, path=None):
        base = path[0] if path else "."
        pathname = os.path.join(base, name + ".py")
        if not os.path.exists(pathname):
            raise ImportError(name)
        return None, pathname, (".py", "r", 1)

    def _load_module(name, fp, pathname, description):
        spec = importlib.util.spec_from_file_location(name, pathname)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    imp.find_module = _find_module
    imp.load_module = _load_module
    sys.modules["imp"] = imp

import mpyq  # noqa: E402
from s2protocol import versions  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPLAY_GLOB = os.path.join(ROOT, "replays", "*.SC2Replay")
OUT = os.path.join(ROOT, "src", "lib", "data", "players.json")

DIGITS = "tjchwyo"  # base-7 digit alphabet, index = digit value


def hx1(s):
    """Decode a gf_hx string to an int (empty string = 0)."""
    n = 0
    for i, ch in enumerate(s):
        n += DIGITS.index(ch) * 7**i
    return n


def hx_list(s):
    return [hx1(part) for part in s.split(" ")]


def utf(b):
    return b.decode("utf-8", "replace") if isinstance(b, (bytes, bytearray)) else b


def filetime_to_iso(ft):
    """Replay m_timeUTC is 100ns ticks since 1601-01-01."""
    epoch = datetime.datetime(1601, 1, 1, tzinfo=datetime.timezone.utc)
    return (epoch + datetime.timedelta(microseconds=ft / 10)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def parse_replay(path):
    archive = mpyq.MPQArchive(path)
    header = versions.latest().decode_replay_header(
        archive.header["user_data_header"]["content"]
    )
    try:
        protocol = versions.build(header["m_version"]["m_baseBuild"])
    except Exception:
        protocol = versions.latest()

    details = protocol.decode_replay_details(archive.read_file("replay.details"))
    initdata = protocol.decode_replay_initdata(archive.read_file("replay.initData"))
    users = initdata["m_syncLobbyState"]["m_userInitialData"]
    played_at = filetime_to_iso(details["m_timeUTC"])

    banks = {}  # userId -> {key: raw string}
    toons = {}  # userId -> toon handle from the bank signature
    cur_bank = {}
    cur_key = {}
    for ev in protocol.decode_replay_game_events(archive.read_file("replay.game.events")):
        t = ev["_event"]
        if "Bank" not in t:
            if ev["_gameloop"] > 0:
                break  # bank preload only happens at loop 0
            continue
        uid = ev["_userid"]["m_userId"]
        if t.endswith("SBankFileEvent"):
            cur_bank[uid] = utf(ev["m_name"])
        elif cur_bank.get(uid) != "UAR":
            continue
        elif t.endswith("SBankKeyEvent"):
            banks.setdefault(uid, {})[utf(ev["m_name"])] = utf(ev["m_data"])
            cur_key[uid] = utf(ev["m_name"])
        elif t.endswith("SBankValueEvent"):
            # value continuation for the preceding key event
            banks.setdefault(uid, {})[cur_key.get(uid, "?")] = utf(ev["m_data"])
        elif t.endswith("SBankSignatureEvent"):
            toons[uid] = utf(ev.get("m_toonHandle", ""))

    players = []
    for uid, bank in banks.items():
        u = users[uid]
        m = hx_list(bank.get("m", ""))
        players.append(
            {
                "name": utf(u["m_name"]),
                "clan": utf(u.get("m_clanTag") or b""),
                "toon": toons.get(uid, ""),
                "xpEn": hx1(bank.get("nbe", "")),
                "xpWo": hx1(bank.get("nbw", "")),
                "xpCo": hx1(bank.get("nbc", "")),
                "prestige": hx1(bank.get("pb", "")),
                "gamesPlayed": m[0] if len(m) > 0 else 0,
                "revives": m[1] if len(m) > 1 else 0,
                "avgGameTime": m[2] if len(m) > 2 else 0,
                "winsByMode": hx_list(bank.get("xp", "").rstrip()),
                "lastSeen": played_at,
            }
        )
    return played_at, players


def main():
    paths = sorted(glob.glob(REPLAY_GLOB))
    if not paths:
        sys.exit(f"no replays found at {REPLAY_GLOB}")

    merged = {}  # toon -> profile, newest sighting wins
    replays_meta = []
    for path in paths:
        played_at, players = parse_replay(path)
        replays_meta.append(
            {"file": os.path.basename(path), "playedAt": played_at, "players": len(players)}
        )
        print(f"{os.path.basename(path)}: {played_at}, {len(players)} profiles")
        for p in players:
            key = p["toon"] or p["name"]
            if key not in merged or p["lastSeen"] >= merged[key]["lastSeen"]:
                merged[key] = p

    players = sorted(
        merged.values(), key=lambda p: -(p["xpEn"] + p["xpWo"] + p["xpCo"])
    )
    out = {
        "replays": sorted(replays_meta, key=lambda r: r["playedAt"]),
        "players": players,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    print(f"wrote {OUT}: {len(players)} players from {len(paths)} replays")


if __name__ == "__main__":
    main()
