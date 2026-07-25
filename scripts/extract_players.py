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
- "o" is a positional bool string: camos 2-20, 1 separator char,
  decals 1-10, sep, Skill Identifiers 1-23, sep, medals 1-13.
  Patch keys extend it: "o3" camos 21-25, "o2" SIs 24-30, "qpo" decal 14.
- class gear unlocks: "p" walker gear x6, "r" LK19 skills x9,
  "s" Predator x6, "jo" robot Rjx-73 x2, "adz" medical visor x2.
- CurrentCamo / CurrentDecal are plain ints.

Every replay a player appears in becomes a history entry; the newest
sighting is the player's current profile.

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
TRUE_CHARS = set("howfk")
XP_CAP = 250000


def hx1(s):
    """Decode a gf_hx string to an int (empty string = 0)."""
    n = 0
    for i, ch in enumerate(s):
        n += DIGITS.index(ch) * 7**i
    return n


def hx_list(s):
    return [hx1(part) for part in s.split(" ")]


class Bits:
    """Positional bool-string reader; past-the-end reads are False
    (mirrors gf_recup_nxt in the map script)."""

    def __init__(self, s):
        self.s = s
        self.i = 0

    def next(self):
        if self.i >= len(self.s):
            return False
        ch = self.s[self.i]
        self.i += 1
        return ch in TRUE_CHARS


def decode_unlocks(bank):
    o = Bits(bank.get("o", ""))
    camos = {1: True}
    for i in range(2, 21):
        camos[i] = o.next()
    camos[19] = True  # load code forces it
    o.next()  # separator
    decals = {}
    for i in range(1, 11):
        decals[i] = o.next()
    o.next()
    sis = {}
    for i in range(1, 24):
        sis[i] = o.next()
    o.next()
    medals = {}
    for i in range(1, 14):
        medals[i] = o.next()

    o3 = Bits(bank.get("o3", ""))
    for i in range(21, 26):
        camos[i] = o3.next()
    o2 = Bits(bank.get("o2", ""))
    for i in range(24, 31):
        sis[i] = o2.next()
    decals[14] = Bits(bank.get("qpo", "")).next()

    p = Bits(bank.get("p", ""))
    walker = [p.next() for _ in range(6)]
    r = Bits(bank.get("r", ""))
    lk19 = [r.next() for _ in range(9)]
    s = Bits(bank.get("s", ""))
    predator = [s.next() for _ in range(6)]
    jo = Bits(bank.get("jo", ""))
    robot = [jo.next() for _ in range(2)]
    adz = Bits(bank.get("adz", ""))
    medvisor = [adz.next() for _ in range(2)]

    decals[11] = walker[5]  # cluster rockets grant decal 11 (load code)

    return {
        "camos": sorted(k for k, v in camos.items() if v),
        "decals": sorted(k for k, v in decals.items() if v),
        "sis": sorted(k for k, v in sis.items() if v),
        "medals": sorted(k for k, v in medals.items() if v),
        "walker": walker,
        "lk19": lk19,
        "predator": predator,
        "robot": robot,
        "medvisor": medvisor,
    }


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

    sightings = []
    for uid, bank in banks.items():
        u = users[uid]
        m = hx_list(bank.get("m", ""))
        sightings.append(
            {
                "name": utf(u["m_name"]),
                "clan": utf(u.get("m_clanTag") or b""),
                "toon": toons.get(uid, ""),
                "xpEn": min(hx1(bank.get("nbe", "")), XP_CAP),
                "xpWo": min(hx1(bank.get("nbw", "")), XP_CAP),
                "xpCo": min(hx1(bank.get("nbc", "")), XP_CAP),
                "prestige": hx1(bank.get("pb", "")),
                "gamesPlayed": m[0] if len(m) > 0 else 0,
                "revives": m[1] if len(m) > 1 else 0,
                "avgGameTime": m[2] if len(m) > 2 else 0,
                "winsByMode": hx_list(bank.get("xp", "").rstrip()),
                "camo": int(bank.get("CurrentCamo", "0") or 0),
                "decal": int(bank.get("CurrentDecal", "0") or 0),
                "unlocks": decode_unlocks(bank),
                "playedAt": played_at,
                "file": os.path.basename(path),
            }
        )
    return played_at, sightings


def main():
    paths = sorted(glob.glob(REPLAY_GLOB))
    if not paths:
        sys.exit(f"no replays found at {REPLAY_GLOB}")

    by_toon = {}  # toon -> list of sightings
    replays_meta = []
    for path in paths:
        played_at, sightings = parse_replay(path)
        replays_meta.append(
            {"file": os.path.basename(path), "playedAt": played_at, "players": len(sightings)}
        )
        print(f"{os.path.basename(path)}: {played_at}, {len(sightings)} profiles")
        for s in sightings:
            by_toon.setdefault(s["toon"] or s["name"], []).append(s)

    players = []
    for sightings in by_toon.values():
        sightings.sort(key=lambda s: s["playedAt"])
        cur = sightings[-1]
        history = [
            {
                k: s[k]
                for k in (
                    "playedAt",
                    "file",
                    "xpEn",
                    "xpWo",
                    "xpCo",
                    "prestige",
                    "gamesPlayed",
                    "revives",
                    "avgGameTime",
                )
            }
            | {"wins": sum(s["winsByMode"])}
            for s in sightings
        ]
        players.append({**{k: v for k, v in cur.items() if k != "file"}, "lastSeen": cur["playedAt"], "history": history})
    for p in players:
        del p["playedAt"]

    players.sort(key=lambda p: -(p["xpEn"] + p["xpWo"] + p["xpCo"]))
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
