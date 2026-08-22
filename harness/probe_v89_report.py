"""Summarise a probe_v89.sh batch: what the bots built, and where air lost.

Driven by probe_v89.sh; run by hand as `python3 probe_v89_report.py probe_out`.
Like sim.sh's report this is a measurement, not a test - nothing here is pinned.
"""
import json, glob, sys, collections, statistics

d = sys.argv[1] if len(sys.argv) > 1 else 'probe_out'
files = sorted(glob.glob(d + '/probe_*.json'))
if not files:
    sys.exit('no probe_*.json in ' + d)

SUPPORT = {'truck', 'medic', 'apc', 'chinook', 'cmdtruck', 'balloon'}
cls = collections.Counter()
opp = collections.defaultdict(collections.Counter)
rsv = collections.Counter()
byprof = collections.defaultdict(lambda: {'n': 0, 'pad': 0, 'padS': [], 'want': [], 'have': []})
slots = 0
for f in files:
    g = json.load(open(f))
    for a in g['armies']:
        slots += 1
        s = byprof[a['prof']]; s['n'] += 1
        if a['padDone'] is not None:
            s['pad'] += 1; s['padS'].append(a['padDone'] / 30.0)
        if a['wantAir'] is not None:
            s['want'].append(a['wantAir']); s['have'].append(a['haveAir'])
        for b, o in a['opp'].items():
            for k, v in o.items():
                opp[b][k] += v
        for k, v in a.get('rsv', {}).items():
            rsv[k] += v
        for uid, n in a['trained'].items():
            uk = uid.split('|')[1]
            if uk in SUPPORT:
                continue
            cls[a['cls'][uk]] += n

tot = sum(cls.values()) or 1
print('%d matches, %d army-slots\n' % (len(files), slots))
print('LINE PRODUCTION BY CLASS (support units excluded, as aiTick excludes them)')
for c in ('inf', 'veh', 'air', 'aa'):
    print('  %-4s %6d  %5.1f%%' % (c, cls[c], 100.0 * cls[c] / tot))

print('\nHELIPAD AND THE AIR TARGET, BY PROFILE')
print('  %-11s %4s %9s %11s %9s %9s' % ('profile', 'n', 'built a pad', 'median sec', 'wantAir', 'haveAir'))
for p in sorted(byprof):
    s = byprof[p]
    med = '%.0f' % statistics.median(s['padS']) if s['padS'] else '-'
    w = '%.3f' % statistics.mean(s['want']) if s['want'] else '-'
    h = '%.3f' % statistics.mean(s['have']) if s['have'] else '-'
    print('  %-11s %4d %6d/%-4d %11s %9s %9s' % (p, s['n'], s['pad'], s['n'], med, w, h))

t = sum(rsv.values()) or 1
print('\nWHICH CLASS THE RESERVE BANKS FOR, per AI tick')
print('  ' + '   '.join('%s %.1f%%' % (k, 100.0 * v / t) for k, v in rsv.most_common()))

cols = ['capped', 'queueFull', 'standdown', 'rsvBlocked', 'noPlastic', 'noEnergy', 'trained']
print('\nPRODUCTION OPPORTUNITIES (per producing building, per AI tick)')
print('  %-9s %8s' % ('building', 'seen') + ''.join('%11s' % c for c in cols))
for b in sorted(opp, key=lambda x: -opp[x]['seen']):
    o = opp[b]; se = o['seen'] or 1
    print('  %-9s %8d' % (b, o['seen']) + ''.join('%10.1f%%' % (100.0 * o[c] / se) for c in cols))
