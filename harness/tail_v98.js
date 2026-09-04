/* tail_v98.js - T75: the balance-and-interface pass. Four owner asks, each one
   landing as a change AND a check, on the v92.1 / v96.1 / v97 pattern:

     A  the Heavy Barricade: 40 plastic, a 15% mine, and a mine only ITS OWNER sees
     B  the release stamp in the menu's corner
     C  the ability hotkeys - the number row - and the control groups' move to F1-F9
     D  the menu's own chrome: a tick under the cursor, a clack under the click

   TWO THINGS IN HERE ARE THE INTERESTING ONES.

   The first is that A moved the hash trails, and the reason is worth carrying
   forward: a GRAY-EXCLUSIVE building's price reached a green and a tan trail
   because RESEARCH.b_hbarricade's cost is DERIVED from B.hbarricade.cp, and the
   Gray bot in those four-army matches starts that research at tick 627 - inside
   the 900-tick window. The four dm combos held because their Gray never gets
   there. "Nobody in this match can build it" is not the same claim as "nothing
   in this match reads its price", and T75.A pins the derivation so the next
   re-price knows what it is touching.

   The second is that C is a REBINDING, not an addition. 1-9 were the control
   groups and are now the ability row; the groups are on F1-F9; and pause, which
   was F9, is F10. Shadowing was refused on the rule MENU_KEYS was chosen under -
   no key in this file means two things at once - and every one of those three
   claims is checked below, including the one that is only true because pause
   moved out of the way. */
'use strict';
section('T75 v98: the barricade re-price, the stamp, the number row, the menu chrome');

const cfg98 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });
function fresh98(seed, fac) { G = null; newGame(cfg98(fac || 'green', seed)); return G.human; }
function put98(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function bld98(k, p, tx, ty) { const b = makeBuilding(k, p, tx, ty, true); b.prog = 1; b.hp = b.mhp; b.abilityCool = 0; return b; }
/* the shim's innerHTML is a plain property, so setting it to '' detaches
   NOTHING and panel columns accumulate across refreshes - the tail_v73 trap. */
function scrub98(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
function panel98() { return document.getElementById('prodBtns'); }
function bbs98() {
  const out = [];
  (function walk(n) {
    if (n && typeof n.className === 'string' && n.className.split(' ')[0] === 'bb') out.push(n);
    (n && n.children || []).forEach(walk);
  })(panel98());
  return out;
}
function label98(b) { const m = /<b>([^<]*)<\/b>/.exec(String(b.innerHTML || '')); return m ? m[1] : ''; }
/* the number badge abilAdd stamped on a button, or '' if it carries none */
function keyOf98(b) { const m = /<span class="ak">(\d)<\/span>/.exec(String(b.innerHTML || '')); return m ? m[1] : ''; }
/* rebuild the panel for a selection, from a clean column */
function sel98(list) { scrub98(panel98()); lastSelSig = ''; setSel(list); }
/* a function's source with its COMMENTS removed: every source-text claim below
   is about what the CODE does, and a comment that merely names the thing it
   promises not to do would satisfy a plain indexOf (the tail_v87_1 lesson). */
function nocmt98(fn) { return String(fn).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }
let HTML98 = null;
try { HTML98 = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { HTML98 = null; }
const SCRIPT98 = HTML98 ? HTML98.slice(HTML98.indexOf('<script>'), HTML98.indexOf('</script>')) : '';
/* the keydown chain, read out of the shipped script. It cannot be reached any
   other way: the shim's addEventListener keeps no reference to a window-level
   listener, so there is no function object to call toString on. */
const KEYDOWN98 = (function () {
  const a = SCRIPT98.indexOf("addEventListener('keydown'");
  const b = SCRIPT98.indexOf("addEventListener('keyup'", a);
  return (a > 0 && b > a) ? SCRIPT98.slice(a, b) : '';
})();

/* ============================================ A: the Heavy Barricade ========= */
section('T75.A 40 plastic, a 15% mine, and a mine only its owner sees');
{
  ok('T75.A pw.html is readable next to the harness', !!HTML98);

  /* ---- the price ---- */
  ok('T75.A the wall is 40 plastic', HBARR_COST === 40);
  ok('T75.A ...and the B row reads the constant rather than a second copy',
    B.hbarricade.cp === HBARR_COST && B.hbarricade.ce === 0);
  /* DERIVED, not transcribed: the shape of the re-price is the claim - twice the
     cheap wall's plastic for three times its HP - so a future move of either
     wall shows up here instead of leaving this pinned to a number nobody meant. */
  ok('T75.A the shape of it: twice BARR_COST for three times BARR_HP',
    HBARR_COST === BARR_COST * 2 && HBARR_HP === BARR_HP * 3);
  ok('T75.A ...which is better plastic-for-HP than the cheap wall, deliberately',
    HBARR_HP / HBARR_COST > BARR_HP / BARR_COST);
  /* the RESCALE pass still skips it on t.barr and not on the key (the v88 rule):
     a second pass would have cubed the wall. */
  ok('T75.A the HP rescale still skips it, so 40 buys exactly HBARR_HP',
    B.hbarricade.hp === HBARR_HP && B.barricade.hp === BARR_HP);
  /* re-pricing changed nothing about WHO may build it */
  ok('T75.A it is still Gray-exclusive and still behind the Lab',
    FAC.gray.ub.includes('hbarricade') && B.hbarricade.req === 'lab' &&
    B.hbarricade.tech === 'b_hbarricade' &&
    ['green', 'tan', 'blue'].every(f => !techAvailable({ fac: f }, 'b_hbarricade')));

  /* WHY THIS MOVED THE TRAILS. The research price is derived from the building
     price, so re-pricing a Gray building re-prices a Gray research project - and
     a Gray bot in a green or tan trail spends differently for it. Pinned as the
     DERIVATION rather than as the two numbers, so the next re-price is told. */
  ok('T75.A the unlock research price is DERIVED from the building price',
    RESEARCH.b_hbarricade.cp === clamp(Math.round(50 + (B.hbarricade.cp * 0.85 + B.hbarricade.ce * 0.5) * 0.42), 50, 200));
  ok('T75.A ...so a Gray-only re-price reaches every match that holds a Gray bot',
    RESEARCH.b_hbarricade.cp !== clamp(Math.round(50 + (60 * 0.85) * 0.42), 50, 200));

  /* ---- the mine roll ---- */
  ok('T75.A the roll is 15%', HBARR_MINE_P === 0.15);
  ok('T75.A ...and the help slot states it off the constant', HELP_TUNE.hbarrMineP() === 15);
  {
    /* driven over a real sample, exactly as T62.F drives it. The draw is taken
       for EVERY completed wall whether or not it succeeds, which is what keeps
       the seeded stream from forking on the outcome - re-checked here because
       raising the probability would be a natural place to break it. */
    G = null; newGame(cfg98('gray', 980101));
    const me = G.human;
    G.map.mines.length = 0;
    let tries = 0;
    for (let i = 0; i < 400; i++) {
      const b = makeBuilding('hbarricade', me, 2 + (i % 40), 2 + ((i / 40) | 0), true);
      b.prog = 0.99; tries++; updateBld(b, 1);
    }
    const buried = G.map.mines.filter(m => m.gray).length;
    ok(`T75.A the sample lands near ${Math.round(HBARR_MINE_P * 100)}% (${buried}/${tries})`,
      tries === 400 && Math.abs(buried / tries - HBARR_MINE_P) < 0.05);
    ok('T75.A ...and it really is higher than the 10% it replaced', buried / tries > 0.10);
    ok('T75.A the draw is still taken for every wall, so the stream cannot fork',
      /const roll=srand\(\);/.test(buryHBMine.toString()) &&
      buryHBMine.toString().indexOf('srand()') === buryHBMine.toString().lastIndexOf('srand()'));
  }

  /* ---- what the tooltip and the manual say ---- */
  ok('T75.A the wall\'s own card states the chance off the constant',
    B.hbarricade.d.indexOf(Math.round(HBARR_MINE_P * 100) + '% chance') > 0);
  ok('T75.A ...and no longer carries the "one in ten" phrasing, which 15% breaks',
    B.hbarricade.d.indexOf('One in') < 0);
  if (HTML98) {
    ok('T75.A the Field Manual still fills the figure from the tune slot',
      HTML98.indexOf('data-tune="hbarrMineP"') > 0);
    ok('T75.A ...and reads it as a PERCENTAGE, which is what the slot returns',
      /chance of burying a mine/.test(HTML98) && HTML98.indexOf('One in <span data-tune="hbarrMineP"') < 0);
  }

  /* ---- who can see it, and who is safe from it ---- */
  {
    /* SIGHT is a render decision and the only place it is made is renderCore's
       buried-mine block, so it is read out of the source. The block must test
       IDENTITY with the local army; allied() reaching it again is the whole of
       the regression this replaces. */
    const src = nocmt98(renderCore);
    const i = src.indexOf('mn.gray');
    ok('T75.A renderCore still has a buried-mine block', i > 0);
    const block = src.slice(i, i + 320);
    ok('T75.A ...and it draws for the OWNER by identity', block.indexOf('ow!==G.human') > 0);
    ok('T75.A ...and no longer shares the mine with an ally', block.indexOf('allied(') < 0);
    ok('T75.A MUTATION: the check would catch the ally test it removed',
      'if(!ow||!allied(ow,G.human))continue;'.indexOf('allied(') > 0);
    ok('T75.A a spectator still sees none of them, on the G.human gate',
      src.indexOf('if(G.human&&G.map.mines)') > 0);
  }
  {
    /* SAFETY did not move, and that is the point of the pair: an ally is no
       longer SHOWN the mine but is still not blown up by it. mineArms is the one
       function that decides, and it is driven rather than read. */
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'gray', opp: 3, seed: 980102 });
    const me = G.human;
    const ally = G.players.find(q => q !== me && q.fac !== 'bug');
    const en = G.players.find(q => q !== me && q !== ally && q.fac !== 'bug');
    ally.team = me.team;                       // same team: allied() is true both ways
    ok('T75.A the fixture really has an ally and an enemy',
      allied(ally, me) === true && allied(en, me) === false);
    const mn = { x: 20, y: 20, live: true, gray: 1, pi: me.i };
    ok('T75.A the owner still walks over his own mine', mineArms(mn, { p: me }) === false);
    ok('T75.A ...and so does an ally, who simply is not shown it any more',
      mineArms(mn, { p: ally }) === false);
    ok('T75.A ...while an enemy still sets it off', mineArms(mn, { p: en }) === true);
    ok('T75.A a map mine still answers to everybody, Gray included',
      mineArms({ x: 1, y: 1, live: true }, { p: me }) === true);
  }
}

/* ============================================ B: the release stamp =========== */
section('T75.B the version and date, stamped in the menu\'s corner');
{
  /* DELIBERATELY TRANSCRIBED, on the rule that a test needing a conscious edit
     is doing its job: the menu prints this and the save tag derives from it, so
     the NEXT release has to come here and say which version it is. Bump
     GAME_VER and GAME_DATE in 01-constants.js and this line with them. */
  ok('T75.B the release constants name THIS version - bump them together',
    GAME_VER === 'v107.2' && /^v\d+(\.\d+)?$/.test(GAME_VER)); // v107.2: bumped with the constants, as this line's comment demands
  ok('T75.B the date is ISO, which is the form a repository can check',
    /^\d{4}-\d{2}-\d{2}$/.test(GAME_DATE));
  ok('T75.B the save-snapshot tag is DERIVED from the version, not typed twice',
    GAME_VER_N === parseInt(GAME_VER.slice(1), 10) &&
    nocmt98(saveState).indexOf('v:GAME_VER_N') > 0);
  {
    /* it was a hand-typed v:86 twelve releases after v86. Nothing reads it back,
       which is why it could go stale unnoticed - so both halves are pinned. */
    G = null; newGame(cfg98('green', 980201));
    const blob = saveState(), S = JSON.parse(blob);
    ok('T75.B ...so a fresh save carries this build\'s number', S.v === GAME_VER_N);
    const a = hashState();
    loadState(JSON.stringify(Object.assign(JSON.parse(blob), { v: 86 })));
    ok('T75.B ...and the tag stays informational: an old one still loads identically',
      hashState() === a);
  }

  /* the human date. `new Date('2026-08-26')` parses as UTC MIDNIGHT and getDate()
     reads back LOCAL, so every player west of Greenwich would have been shown the
     25th. The parse is a regex for exactly that reason, and this is the check
     that says so. */
  ok('T75.B the reformat never goes through the Date constructor, which is the trap',
    !/new Date|Date\.parse|Date\.UTC|getDate|getMonth/.test(nocmt98(stampDate)));
  ok('T75.B ...and the day it prints is the day in the string, every month',
    ['2026-01-01', '2026-02-28', '2026-06-09', '2026-08-26', '2026-12-31']
      .every(d => { const out = stampDate(d); return out.indexOf(String(+d.slice(8))) === 0 && out.indexOf(d.slice(0, 4)) > 0; }));
  ok('T75.B ...and each month gets its own name', new Set(STAMP_MON).size === 12);
  ok('T75.B a string that is not ISO is printed verbatim rather than as NaN',
    stampDate('unreleased') === 'unreleased' && stampDate('') === '');

  {
    const t = menuStamp();
    const el = document.getElementById('verStamp');
    ok('T75.B menuStamp writes the version and the date into the stamp',
      typeof t === 'string' && t.indexOf(String(GAME_VER).toUpperCase()) === 0 && t.indexOf(stampDate(GAME_DATE)) > 0); // v99: derived - the literal 'V98' was this check's own second copy of the version
    ok('T75.B ...into the element itself, not just as a return value', el.textContent === t);
    ok('T75.B ...and it names BOTH things the owner asked for',
      t.indexOf(String(GAME_VER).toUpperCase()) >= 0 && /UPDATED/.test(t));
  }
  if (HTML98) {
    ok('T75.B the stamp is a child of #setup, so it hides with the menu',
      HTML98.indexOf('<div id="verStamp"></div>') > 0 &&
      HTML98.indexOf('<div id="verStamp"></div>') > HTML98.indexOf('<div id="setup">') &&
      HTML98.indexOf('<div id="verStamp"></div>') < HTML98.indexOf('<div id="infoPanel">'));
    const rule = (/#verStamp\{[^}]*\}/.exec(HTML98) || [''])[0];
    ok('T75.B ...pinned to a CORNER of the viewport rather than flowed into the column',
      /position:fixed/.test(rule) && /right:/.test(rule) && /bottom:/.test(rule));
    ok('T75.B ...and it can never eat a click meant for the button beside it',
      /pointer-events:none/.test(rule));
    ok('T75.B the element ships EMPTY: every character in it is written by menuStamp',
      /<div id="verStamp"><\/div>/.test(HTML98));
  }
}

/* ============================================ C: the number row ============== */
section('T75.C the ability hotkeys, and where the control groups went');
{
  /* ---- the registry ---- */
  ok('T75.C the ability alphabet is the number row, 1 to 9',
    ABIL_KEYS.length === 9 && ABIL_KEYS.join('') === '123456789');
  ok('T75.C ...and it is disjoint from the build-menu letters, so no key means two things',
    ABIL_KEYS.every(k => !MENU_KEYS.includes(k)));
  ok('T75.C hotReset clears BOTH registries, so the panel rebuild is the context gate',
    nocmt98(hotReset).indexOf('ABIL_HOT=Object.create(null)') > 0 &&
    nocmt98(hotReset).indexOf('MENU_HOT=Object.create(null)') > 0 &&
    nocmt98(refreshSelPanel).indexOf('hotReset()') > 0);
  ok('T75.C past the ninth a button carries no key rather than reusing one',
    abilNext !== undefined && nocmt98(abilNext).indexOf('ABIL_HOT_N<ABIL_KEYS.length') > 0);

  /* ---- one unit ---- */
  {
    const p = fresh98(980301, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const bx = Math.floor(hq.tx) + 6, by = Math.floor(hq.ty) + 6;
    const sarge = put98('sarge', p, bx, by);
    sel98([sarge]);
    const bs = bbs98();
    ok('T75.C a single Sarge offers his one ability', bs.length === 1 && label98(bs[0]) === 'On Me!');
    ok('T75.C ...and it carries the number 1 as a badge on the button', keyOf98(bs[0]) === '1');
    ok('T75.C ...and the tooltip says which key it is', /Hotkey: 1$/.test(String(bs[0].title || '')));
    ok('T75.C ...and the label itself is untouched under the badge',
      String(bs[0].innerHTML).indexOf('<span class="ak">1</span><b>') === 0);
    abilHotkey('1'); execCmds();
    ok('T75.C pressing 1 opens the broadcast', sarge.onMe === true);
    sel98([sarge]);
    abilHotkey('1'); execCmds();
    ok('T75.C ...and pressing it again closes it, the button being a toggle', sarge.onMe === false);
    ok('T75.C a key nothing registered does nothing and says so', abilHotkey('7') === false);
  }

  /* ---- a mixed group: 1, 2, 3... in the order the row is built ---- */
  {
    const p = fresh98(980302, 'green');
    const hq = p.blds.find(b => b.key === 'hq');
    const bx = Math.floor(hq.tx) + 6, by = Math.floor(hq.ty) + 8;
    const gun = put98('gunner', p, bx, by), gun2 = put98('gunner', p, bx + 1, by);
    const sarge = put98('sarge', p, bx + 2, by);
    const snip = put98('sniper', p, bx + 3, by);
    const art = put98('arty', p, bx + 4, by);
    const bike = put98('bike', p, bx + 5, by);
    const grunt = put98('grunt', p, bx + 6, by);          // carries no ability at all
    sel98([gun, gun2, sarge, snip, art, bike, grunt]);
    const bs = bbs98();
    ok('T75.C the mixed squad offers one button per ability present', bs.length === 5);
    ok('T75.C ...numbered 1,2,3... down the row, with none skipped or repeated',
      bs.map(keyOf98).join('') === '12345');
    ok('T75.C ...and every ability button in the row got one', bs.every(b => keyOf98(b) !== ''));

    /* the number fires that button and ONLY the men that carry that ability -
       which is the whole of the owner's "for a group of mixed units" ask. */
    const rip = bs.findIndex(b => label98(b).indexOf('Ripple Fire') === 0);
    ok('T75.C the battery\'s button is in the row', rip >= 0);
    abilHotkey(String(rip + 1)); execCmds();
    ok('T75.C its number ripples the battery', art.rip === true);
    ok('T75.C ...and moves nothing else in the selection',
      !snip.cs && !bike.flat && !sarge.onMe && !gun.entrenched && !gun2.entrenched);
  }

  /* ---- what is deliberately NOT numbered ---- */
  {
    const p = fresh98(980303, 'blue');
    const hq = p.blds.find(b => b.key === 'hq');
    const tur = bld98('turbine', p, Math.floor(hq.tx) + 7, Math.floor(hq.ty) + 7);
    sel98([tur]);
    const bs = bbs98().filter(b => label98(b) === 'Overdrive');
    ok('T75.C a structure still offers its ability button', bs.length === 1);
    ok('T75.C ...and it is deliberately NOT numbered: the letters already own that panel',
      keyOf98(bs[0]) === '');
  }

  /* ---- a greyed-out button refuses the key, exactly as a click on it would ---- */
  {
    const p = fresh98(980304, 'tan');
    const hq = p.blds.find(b => b.key === 'hq');
    const fb = put98('firebomb', p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6);
    fb.abCool = 0;
    sel98([fb]);
    const hot = bbs98()[0];
    ok('T75.C the Firebomb Heli\'s blast takes a number like any other ability',
      !!hot && keyOf98(hot) === '1' && hot.disabled === false);
    abilHotkey('1'); execCmds();
    ok('T75.C ...and firing it puts the ability on its cooldown', fb.abCool === FB_CD);
    sel98([fb]);
    const cold = bbs98()[0];
    ok('T75.C a button on cooldown is disabled and still numbered',
      !!cold && cold.disabled === true && keyOf98(cold) === '1');
    const before = fb.abCool;
    ok('T75.C ...and the key refuses it, so a key and a click do the same thing',
      abilHotkey('1') === false && fb.abCool === before);
  }

  /* ---- the rebinding itself ---- */
  {
    const kd = nocmt98(KEYDOWN98);
    ok('T75.C the keydown chain is readable out of the shipped script', kd.length > 500);
    ok('T75.C the number row is dispatched through the ability registry',
      /\/\^\[1-9\]\$\/\.test\(k\)[^}]*abilHotkey\(k\)/.test(kd));
    ok('T75.C ...and no longer writes or reads a control group',
      !/\[1-9\]\$\/\.test\(k\)\)\{\s*if\(e\.ctrlKey\|\|e\.metaKey\)\{G\.groups/.test(kd));
    ok('T75.C the control groups are on F1-F9, saved with Ctrl and recalled bare',
      /\/\^F\[1-9\]\$\/\.test\(k\)/.test(kd) && /G\.groups\[gk\]=G\.sel\.filter/.test(kd));
    ok('T75.C ...and G.groups is still keyed by the DIGIT, so an old save restores unchanged',
      /const gk=k\.slice\(1\)/.test(kd));
    ok('T75.C pause moved to F10, because F9 is now group 9 and cannot be both',
      /k==='F10'/.test(kd) && !/k==='F9'/.test(kd));
    ok('T75.C ...and both function-key branches stop the browser taking the key',
      /k==='F10'\)\{e\.preventDefault\(\)/.test(kd) && /\^F\[1-9\]\$\/\.test\(k\)\)\{\s*e\.preventDefault\(\)/.test(kd));
    ok('T75.C a modified digit is left alone, so Ctrl+C is still Ctrl+C',
      /\[1-9\]\$\/\.test\(k\)&&!e\.ctrlKey&&!e\.metaKey&&!e\.altKey/.test(kd));
  }
  if (HTML98) {
    ok('T75.C the Field Manual moves the control groups with the code',
      /Ctrl \+ F1–F9<\/b>: save the selection as a control group/.test(HTML98) &&
      HTML98.indexOf('<b>Ctrl + 1–9</b>') < 0);
    ok('T75.C ...documents the number row', /<b>1–9<\/b>: fire the selected units/.test(HTML98));
    ok('T75.C ...and both places that name the pause key say F10',
      (HTML98.match(/<b>F10<\/b>/g) || []).length === 2 && HTML98.indexOf('<b>F9</b>') < 0);
    const rule = (/\.bb \.ak\{[^}]*\}/.exec(HTML98) || [''])[0];
    ok('T75.C the badge has a style, in the corner of the button and out of the way',
      /position:absolute/.test(rule) && /pointer-events:none/.test(rule));
    ok('T75.C ...and .bb still opens on `background`, which T49.A transcribes',
      HTML98.indexOf('.bb{background') > 0);
  }
  ok('T75.C the registry is client-local: nothing about it is hashed',
    nocmt98(hashState).indexOf('ABIL_HOT') < 0 && nocmt98(hashState).indexOf('G.groups') < 0);
}

/* ============================================ D: the menu chrome ============= */
section('T75.D a tick under the cursor, a clack under the click');
{
  audioReset();
  const tick = cap(() => sTick());
  const clack = cap(() => sMenuClick());
  const click = cap(() => sClick());
  ok('T75.D the hover tick makes a sound at all', tick.length > 0);
  ok('T75.D the menu click makes one too, and a fuller one', clack.length > click.length);
  /* the peak each one is scheduled to reach, off the gain automation the
     primitives write - measured rather than transcribed from the call. */
  const peak = ns => Math.max.apply(null, [0].concat(
    ofKind(ns, 'gain').map(n => Math.max.apply(null, [0].concat(gainEv(n).map(e => e[1] || 0))))));
  ok('T75.D the tick is the quietest of the three, deliberately', peak(tick) < peak(click));
  ok('T75.D ...and the menu click is the strongest, which is what was asked for',
    peak(clack) > peak(click) && peak(clack) > peak(tick));
  ok('T75.D the tick is the SHORTEST of the three - it fires on every button crossed',
    spanOf(tick) < spanOf(click) && spanOf(tick) < spanOf(clack) && spanOf(tick) < 0.08);
  ok('T75.D both are `pure`, so an interface sound never wanders in pitch',
    nocmt98(sTick).indexOf('pure:1') > 0 &&
    (nocmt98(sMenuClick).match(/pure:1/g) || []).length === 2);
  {
    muted = true;
    const q1 = cap(() => sTick()), q2 = cap(() => sMenuClick());
    muted = false;
    ok('T75.D the mute button silences both', q1.length === 0 && q2.length === 0);
  }
  {
    /* rule 2's mirror: a UI voice must never draw from the seeded stream. */
    G = null; newGame(cfg98('green', 980401));
    const r0 = G.rngS;
    sTick(); sMenuClick();
    ok('T75.D neither voice touches the seeded RNG', G.rngS === r0);
  }

  /* ---- the delegation, driven ---- */
  {
    audioReset();
    const host = document.createElement('div');
    ok('T75.D menuAudioBind binds to a host', menuAudioBind(host) === true);
    const btnA = document.createElement('button'), btnB = document.createElement('button');
    const kidA = { closest: () => btnA }, kidA2 = { closest: () => btnA }, kidB = { closest: () => btnB };
    const dead = { closest: () => null };
    const ticks = () => cap(() => host.dispatchEvent({ type: 'mouseover', target: kidA })).length;
    ok('T75.D crossing onto a button ticks once', ticks() > 0);
    ok('T75.D ...and sliding across its own children does NOT tick again', ticks() === 0);
    ok('T75.D moving to the next button ticks',
      cap(() => host.dispatchEvent({ type: 'mouseover', target: kidB })).length > 0);
    ok('T75.D moving onto dead space is silent',
      cap(() => host.dispatchEvent({ type: 'mouseover', target: dead })).length === 0);
    ok('T75.D ...and coming back to a button ticks again, having been forgotten',
      cap(() => host.dispatchEvent({ type: 'mouseover', target: kidA2 })).length > 0);
    ok('T75.D leaving the host forgets it too',
      (host.dispatchEvent({ type: 'mouseleave', target: host }), menuHoverEl === null));
    ok('T75.D a click on a button clacks',
      cap(() => host.dispatchEvent({ type: 'click', target: kidA })).length > 0);
    ok('T75.D ...and a click on dead space does not',
      cap(() => host.dispatchEvent({ type: 'click', target: dead })).length === 0);
    btnB.disabled = true;
    ok('T75.D a disabled button neither ticks nor clacks',
      cap(() => { host.dispatchEvent({ type: 'mouseover', target: kidB }); host.dispatchEvent({ type: 'click', target: kidB }); }).length === 0);
  }

  /* ---- both hosts are bound, and the per-site calls are gone ---- */
  if (HTML98) {
    const script = SCRIPT98;
    ok('T75.D the setup screen and the Field Manual are both bound',
      script.indexOf("menuAudioBind(document.getElementById('setup'))") > 0 &&
      script.indexOf("menuAudioBind(document.getElementById('infoPanel'))") > 0);
    /* the SETUP SCREEN's own section, start to end: not one handler in it still
       makes its own click sound, or a click would make two. */
    const a = script.indexOf('---------------- SETUP SCREEN ----------------');
    const b = script.indexOf('---------------- GAME STATE ----------------');
    ok('T75.D the setup section is findable, and bounded by the section after it',
      a > 0 && b > a && (b - a) > 20000);
    ok('T75.D ...and no handler inside it still calls sClick, so a click sounds once',
      nocmt98(script.slice(a, b)).indexOf('sClick(') < 0);
    /* the manual's own block, comments stripped: a comment that merely NAMES
       sClick would satisfy a plain indexOf, which is how the first cut of this
       check failed itself. */
    const c = script.indexOf('function infoBuildGrid()');
    const d = script.indexOf("menuAudioBind(document.getElementById('infoPanel'))");
    const manual = nocmt98(script.slice(c, d));
    ok('T75.D the Field Manual\'s buttons dropped theirs too',
      c > 0 && d > c && (manual.match(/sClick\(/g) || []).length === 1);
    ok('T75.D ...and the one that remains is #manualBtn, which lives in the HUD',
      /getElementById\('manualBtn'\)\.onclick=\(\)=>\{openInfo\(\);sClick\(\)\}/.test(script));
    ok('T75.D the HUD\'s own voice is untouched: sClick still has many callers',
      (script.match(/sClick\(\)/g) || []).length > 20);
  }
}
