#!/usr/bin/env python3
"""repin_v103.py - write the recut_v103 tables into the tails that pin them.

    cat shim_head.js game.js recut_v103.js > rc103.js && node rc103.js > cut_v103.json
    python3 repin_v103.py cut_v103.json

EIGHT tables across five files, and three of them are the LAYOUT pins - v103 is
the release that changes map generation on purpose, so for once the 42-pin gate
is a thing to recut rather than a thing to obey:

    BASE43_LAYOUTS  tail_v43.js   the 15 layout pins
    BASE62_LAYOUTS  tail_v62.js   the same 15, pinned a second time
    V271_LAYOUTS    tail_v28.js   12 more: always dm, 3 opponents, no desk
    BASE45_TRAILS   tail_v43.js   T23.A
    BASE45_AI       tail_v44.js   T24.I, and tail_v44_1's T25.F reads the same one
    BASE43_DESK     tail_v45.js   T26.G
    BASE48_TRAILS   tail_v49.js   T30.A   (block-scoped, one leading space)
    BASE62_TRAILS   tail_v62.js   T41.A

Every edit asserts it matched exactly one existing table and that the new text
differs from the old, so a re-run against already-repinned tails fails loudly
instead of silently doing nothing. Each file is read, rewritten in memory and
only then written out, so a failure part-way leaves every tail untouched.

The v76 repin cut two of the trail tables wrong because the recut assumed every table
is captured by "boot a match and hash it" - BASE43_DESK is not, it needs the
Gunner-at-90 fixture, and BASE45_AI needs the human seat handed to the AI first.
recut_v103 reproduces both, and this script verifies the shape of what it was
handed (key sets and sample counts) before writing a byte.
"""
import json
import re
import sys

CUT = sys.argv[1] if len(sys.argv) > 1 else 'cut_v103.json'
cut = json.load(open(CUT, encoding='utf-8'))

# ---- shape gate: refuse a cut that does not look like the tables it replaces --
TRAIL_KEYS = {'backyard:dm:777001', 'kitchen:dm:777001', 'livingroom:dm:777001',
              'sandbox:dm:777001', 'backyard:koth:424243', 'kitchen:ctf:424243',
              'desk:surv:424243'}
AI_KEYS = {'backyard:dm:normal:green:3:441001', 'kitchen:ctf:hard:tan:2:441002',
           'sandbox:koth:easy:gray:3:441003', 'livingroom:dm:hard:blue:3:441004'}

for name in ('BASE45_TRAILS', 'BASE48_TRAILS', 'BASE62_TRAILS'):
    got = set(cut[name])
    if got != TRAIL_KEYS:
        sys.exit('%s has the wrong combos: %s' % (name, sorted(got ^ TRAIL_KEYS)))
    for k, v in cut[name].items():
        want = 26 if k.startswith('desk') else 10   # 2400/90 and 900/90
        if len(v) != want:
            sys.exit('%s[%s] has %d samples, expected %d' % (name, k, len(v), want))
if set(cut['BASE45_AI']) != AI_KEYS:
    sys.exit('BASE45_AI has the wrong combos')
if any(len(v) != 3 for v in cut['BASE45_AI'].values()):
    sys.exit('BASE45_AI rows should hold 3 samples each (1800/600)')
if len(cut['BASE43_DESK']) != 26:
    sys.exit('BASE43_DESK should hold 26 samples (2400/90), got %d' % len(cut['BASE43_DESK']))
if cut['BASE45_TRAILS'] != cut['BASE62_TRAILS']:
    sys.exit('the two tan tables disagree - recut_v103 should have caught this')


def obj(table, indent):
    rows = [("%s'%s': [%s]," % (indent, k, ', '.join(str(n) for n in v))) for k, v in table.items()]
    return '{\n' + '\n'.join(rows) + '\n' + indent[:-2] + '}'


def arr(a):
    return '[' + ', '.join(str(n) for n in a) + ']'


def flat(table):
    """the layout tables are one line of JSON with double-quoted keys - keep that
    shape exactly, because tail_v43 and tail_v62 must stay diffable line for line
    against each other and against every release before this one."""
    return '{' + ','.join('"%s":%d' % (k, v) for k, v in table.items()) + '}'


EDITS = [
    ('tail_v28.js', 'V271_LAYOUTS',   flat(cut['V271_LAYOUTS']),        'const'),
    ('tail_v43.js', 'BASE43_LAYOUTS', flat(cut['BASE43_LAYOUTS']),      'const'),
    ('tail_v62.js', 'BASE62_LAYOUTS', flat(cut['BASE62_LAYOUTS']),      'const'),
    ('tail_v43.js', 'BASE45_TRAILS', obj(cut['BASE45_TRAILS'], '  '), 'const'),
    ('tail_v44.js', 'BASE45_AI',     obj(cut['BASE45_AI'],     '  '), 'const'),
    ('tail_v45.js', 'BASE43_DESK',   arr(cut['BASE43_DESK']),         'const'),
    ('tail_v49.js', 'BASE48_TRAILS', obj(cut['BASE48_TRAILS'], '   '), 'const'),
    ('tail_v62.js', 'BASE62_TRAILS', obj(cut['BASE62_TRAILS'], '  '), 'const'),
]

# Tables this release is EXPECTED to leave alone, with the reason. Anything not
# listed here that comes back unchanged is treated as a failed recut, not a no-op.
# v103: ONE entry, and it was measured rather than assumed. Map generation moved,
# so every table that hashes a board (the three layout tables) or hashes a match
# played on one (the trail tables) is expected to move - except BASE43_DESK, which
# is a single 2400-tick match on desk:surv:424243, and THAT BOARD GENERATES
# IDENTICALLY: layout hash 3434555268 before and after, 22 props and 4 fields in
# the same places. It is a Desk seed on which every retry this release added
# happens to clear on its first roll, so no rnd() draw shifts. The one v103 change
# that does reach it is the decoration prune (68 decorations down to 64), and a
# decoration is art - not in pass, not in fld, not in hashState, not in the save.
# The other five tables all carry desk rows too, but each is one row of seven, so
# the table as a whole still moves.
UNMOVED_OK = {'BASE43_DESK': 'desk:surv:424243 generates an identical board; only its decoration count moved, and deco is art'}

# v103: tail_v43 and tail_v62 each carry TWO of these tables (a layout table and
# a trail table), so the edits are applied CUMULATIVELY to one in-memory copy per
# file. Reading each file fresh per edit - which is what this loop did while every
# file held exactly one table - would have written the second edit over the first
# and silently thrown a repinned layout away.
work = {}
pending = []
for path, name, body, kw in EDITS:
    src = work.get(path)
    if src is None:
        src = work[path] = open(path, encoding='utf-8').read()
    pat = re.compile(r'(^[ \t]*' + kw + r' ' + name + r'\s*=\s*)([\{\[][\s\S]*?[\}\]])(;)', re.M)
    hits = pat.findall(src)
    if len(hits) != 1:
        sys.exit('%s: expected exactly 1 %s table, found %d' % (path, name, len(hits)))
    new = pat.sub(lambda m: m.group(1) + body + m.group(3), src, count=1)
    if new == src:
        # v88.1: a table that legitimately did NOT move is not a re-run. BASE43_DESK
        # is cut from a fixture that sets U.gunner.cp=90 before it runs, so the one
        # thing this release changed in the simulation - the Gunner's shipped price -
        # cannot reach it, and its numbers are expected to be identical. Named
        # explicitly rather than allowed in general, because for the other four an
        # unchanged table really would mean the recut had not run.
        if name in UNMOVED_OK:
            print('unchanged %-14s in %s (expected: %s)' % (name, path, UNMOVED_OK[name]))
            continue
        sys.exit('%s: %s already carries these numbers - is this a re-run?' % (path, name))
    work[path] = new
    pending.append((path, name))

for path in dict.fromkeys(p for p, _ in pending):
    open(path, 'w', encoding='utf-8').write(work[path])
for path, name in pending:
    print('repinned %-14s in %s' % (name, path))
print('%d tables written. tail_v44_1 needs no edit: T25.F reads tail_v44 BASE45_AI.' % len(pending))
