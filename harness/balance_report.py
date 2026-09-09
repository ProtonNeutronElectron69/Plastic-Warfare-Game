"""balance_report.py - by army, by doctrine, and army x doctrine, over any sim_out dirs.
Driven by probe_v113.sh; run by hand as `python3 balance_report.py sim_out [more dirs]`.
A measurement, not a test - nothing here is pinned."""
import json,glob,sys,collections
dirs=sys.argv[1:]
games=[]
for d in dirs:
    for f in sorted(glob.glob(d+'/game_*.json')):
        games.append(json.load(open(f)))
print(len(games),'matches')
def table(key):
    agg=collections.defaultdict(lambda:collections.defaultdict(float))
    for g in games:
        for a in g['armies']:
            k=a[key];x=agg[k]
            x['n']+=1;x['wins']+=1 if g['winner']==a['fac'] else 0
            x['kills']+=a['kills'];x['lost']+=a['lost'];x['mined']+=a['mined'];x['units']+=a['unitsBuilt']
            x['outposts']+=a['builtB'].get('outpost',0);x['towers']+=a['builtB'].get('guardtower',0)+a['builtB'].get('bunker',0)
            x['uu']+=a['uuBuilt'];x['ub']+=a['ubBuilt'];x['alive']+=1 if a['alive'] else 0
            x['elim']+=a['elimAt'] if a['elimAt'] else 0;x['nelim']+=1 if a['elimAt'] else 0
            x['air']+=a['cls']['air'];x['veh']+=a['cls']['veh'];x['inf']+=a['cls']['inf']
    print('\n%-11s %4s %5s %5s %6s %7s %7s %8s %6s %6s %5s %5s %6s %7s'%(key,'n','wins','win%','K/L','kills','lost','mined','units','outp','twr','uu','alive%','elim@s'))
    for k,x in sorted(agg.items(),key=lambda kv:-kv[1]['wins']):
        n=x['n']
        print('%-11s %4d %5d %5.0f %6.2f %7.0f %7.0f %8.0f %6.0f %6.1f %5.1f %5.1f %6.0f %7.0f'%(k,n,x['wins'],100*x['wins']/n,x['kills']/max(1,x['lost']),x['kills']/n,x['lost']/n,x['mined']/n,x['units']/n,x['outposts']/n,x['towers']/n,x['uu']/n,100*x['alive']/n,x['elim']/max(1,x['nelim'])))
table('fac');table('profile')
ends=collections.Counter(g['endReason'] for g in games);print('\nend reasons',dict(ends),' median length',sorted(g['simSeconds'] for g in games)[len(games)//2],'s')
# cross: fac x profile wins
cross=collections.defaultdict(lambda:[0,0])
for g in games:
    for a in g['armies']:
        c=cross[(a['fac'],a['profile'])];c[0]+=1;c[1]+=1 if g['winner']==a['fac'] else 0
print('\narmy x doctrine (wins/drawn):')
profs=sorted({p for _,p in cross});facs=['green','tan','gray','blue']
print('%-7s'%''+''.join('%12s'%p for p in profs))
for f in facs:print('%-7s'%f+''.join('%12s'%('%d/%d'%(cross[(f,p)][1],cross[(f,p)][0])) for p in profs))
