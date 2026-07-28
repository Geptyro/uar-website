"""Bake the variable latin woff2s into the static TTFs the card renderer needs.

See README.md — run from this directory, after woff2_decompress. Not part of
any build: its output is committed, and only an upgrade of the two
@fontsource-variable packages should ever change it.
"""

from fontTools import ttLib
from fontTools.subset import Options, Subsetter
from fontTools.varLib import instancer

# Latin-1 plus the punctuation the cards draw (dashes, quotes, ellipsis,
# bullet). Wider than anything in the extracted data, so a name that gains an
# accent later still renders instead of dropping a glyph.
RANGES = [
    (0x0020, 0x007E),
    (0x00A0, 0x00FF),
    (0x2013, 0x2014),
    (0x2018, 0x2019),
    (0x201C, 0x201D),
    (0x2022, 0x2022),
    (0x2026, 0x2026),
]

JOBS = [
    ("inter-latin-wght-normal.ttf", 400, "Inter-Regular.ttf"),
    ("inter-latin-wght-normal.ttf", 700, "Inter-Bold.ttf"),
    ("jetbrains-mono-latin-wght-normal.ttf", 500, "JetBrainsMono-Medium.ttf"),
]

unicodes = [c for lo, hi in RANGES for c in range(lo, hi + 1)]

for src, weight, out in JOBS:
    font = instancer.instantiateVariableFont(
        ttLib.TTFont(src), {"wght": weight}, updateFontNames=True
    )
    options = Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.save(out)
    check = ttLib.TTFont(out)
    print(
        f'{out}: family="{check["name"].getDebugName(1)}" '
        f'weight={check["OS/2"].usWeightClass}'
    )
