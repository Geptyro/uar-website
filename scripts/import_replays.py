#!/usr/bin/env python3
"""Pull new UAR replays from the local StarCraft II folder into replays/.

Scans the SC2 account's Multiplayer replay folder, keeps only Undead
Assault reborn games (map title read from the replay), names each copy
after the game's UTC start time (YYYYMMDD-HHMM.SC2Replay — which also
deduplicates re-imports), then runs extract_players.py to refresh
src/lib/data/players.json.

Usage:
    .venv/bin/python scripts/import_replays.py [sc2-replay-folder]

The default folder is this machine's Wine-prefix SC2 install; pass the
folder explicitly on other setups.
"""

import datetime
import glob
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_players import ROOT, filetime_to_iso, utf  # noqa: E402  (installs the imp shim)

import mpyq  # noqa: E402
from s2protocol import versions  # noqa: E402

DEFAULT_SRC = (
    os.path.expanduser("~")
    + "/Games/battlenet/drive_c/users/steamuser/Documents/StarCraft II"
    + "/Accounts/121480455/2-S2-1-1809580/Replays/Multiplayer"
)
MAP_TITLE = "Undead Assault reborn"


def replay_info(path):
    """(map title, played-at ISO) — reads only the small details file."""
    archive = mpyq.MPQArchive(path)
    header = versions.latest().decode_replay_header(
        archive.header["user_data_header"]["content"]
    )
    try:
        protocol = versions.build(header["m_version"]["m_baseBuild"])
    except Exception:
        protocol = versions.latest()
    details = protocol.decode_replay_details(archive.read_file("replay.details"))
    return utf(details["m_title"]), filetime_to_iso(details["m_timeUTC"])


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.isdir(src):
        sys.exit(f"replay folder not found: {src}")
    dest = os.path.join(ROOT, "replays")

    imported = 0
    for path in sorted(glob.glob(os.path.join(src, "*.SC2Replay"))):
        try:
            title, played_at = replay_info(path)
        except Exception as e:
            print(f"  ! unreadable, skipped: {os.path.basename(path)} ({e})")
            continue
        if title != MAP_TITLE:
            continue
        stamp = datetime.datetime.strptime(played_at, "%Y-%m-%dT%H:%M:%SZ")
        name = stamp.strftime("%Y%m%d-%H%M") + ".SC2Replay"
        target = os.path.join(dest, name)
        if os.path.exists(target):
            continue
        shutil.copy(path, target)
        imported += 1
        print(f"imported {name}  ({os.path.basename(path)})")

    print(f"{imported} new replay(s)")
    if imported:
        subprocess.run(
            [sys.executable, os.path.join(ROOT, "scripts", "extract_players.py")],
            check=True,
        )
        print("players.json refreshed — review, commit and tag to deploy")


if __name__ == "__main__":
    main()
