/* ============================================================================
   T95 - v110: THE HOTKEY PASS
   The owner asked for a review of the hotkey assignments with two goals: keep as
   many keys as possible within reach of the left hand, and make a thing that can
   be reached from more than one host carry ONE key. Both were the same bug, and
   the review found a third: the letters moved between ARMIES too.

   Through v109 `hotNext()` handed the next letter of MENU_KEYS to whatever tile
   the panel built next, so a letter belonged to a SLOT. Measured on v109 before
   anything was touched:
     Barricade   'm' on the HQ (Tan/Green/Gray), 'n' on Blue's HQ, 'c' on the Outpost
     Guard Tower 'n' / 'o' / 'e'      HQ 'r' / 't' / 'g'      Dump Truck 'z' / 'i'
     Garage      built with 'e', researched with 'c'
   `hk` is a declared field on the B row, the U row and the UPGRADES row now, and
   RESEARCH derives its own from whatever the tech unlocks.

   Left-half share across all 24 host x faction panels: 95/184 (51.6%) on v109,
   120/184 (65.2%) here - measured with the base run out of a git worktree.
   ==========================================================================*/
section('T95.A the alphabet: fifteen letters, eight of them under the left hand');
const LEFT110 = 'qwertasdfgzxcvb';        // the left half of a QWERTY board
const SRC110 = require('fs').readFileSync('pw.html', 'utf8');
{
  ok('T95.A fifteen distinct letters, and \'b\' is the one v110 added',
     MENU_KEYS.length === 15 && new Set(MENU_KEYS).size === 15 && MENU_KEYS.includes('b'));
  const left = MENU_KEYS.filter(k => LEFT110.includes(k));
  ok(`T95.A eight of them sit on the left half (${left.join('')})`,
     left.length === 8 && left.join('') === 'bcegrtvz');
  /* WHAT THE EIGHT ARE SPENT ON is the whole of the owner's first ask, so it is
     stated rather than counted: the eight most-pressed tiles in the game, read
     off the rows themselves. A re-price that moved one of these to a right-hand
     letter would fire here. */
  const wantLeft = {barracks:'b', barricade:'c', generator:'e', garage:'g',
                    guardtower:'t', supply:'v', outpost:'z'};
  ok('T95.A ...and they are spent on the tiles a player presses most, the Dump Truck first',
     U.truck.hk === 'r' && LEFT110.includes(U.truck.hk) &&
     Object.keys(wantLeft).every(k => B[k].hk === wantLeft[k] && LEFT110.includes(B[k].hk)));
  ok('T95.A the mnemonic survives wherever the two rules agree',
     B.barracks.hk === 'b' && B.barricade.hk === 'c' && B.generator.hk === 'e' &&
     B.garage.hk === 'g' && B.guardtower.hk === 't' && U.grunt.hk === 'g' && U.tank.hk === 't');
  /* DERIVED, so a 27th unit or a 20th structure fails the suite until it declares
     a letter - the conscious-edit rule T71.A is built on. Only rows that can
     appear on a menu are asked: wildlife, level art and the Paratrooper cannot. */
  const menuB = Object.keys(B).filter(k => B[k].cat), menuU = [];
  for (const bk in B) for (const u of (B[bk].prod || [])) if (!menuU.includes(u)) menuU.push(u);
  for (const f in FAC) for (const u of (FAC[f].uu || [])) if (!menuU.includes(u)) menuU.push(u);
  ok(`T95.A every row that can reach a menu declares a legal letter (${menuB.length} structures, ${menuU.length} units)`,
     menuB.length >= 19 && menuU.length >= 25 &&
     menuB.every(k => MENU_KEYS.includes(B[k].hk)) && menuU.every(k => MENU_KEYS.includes(U[k].hk)));
  ok('T95.A ...and nothing that can never reach one carries a letter it would not use',
     !B.nest.hk && !B.crate.hk && !U.para.hk);
  ok('T95.A a research row derives its letter from the thing it unlocks, never a second copy',
     Object.keys(RESEARCH).filter(k => RESEARCH[k].bkey && RESEARCH[k].kind === 'unlock')
       .every(k => RESEARCH[k].hk === B[RESEARCH[k].bkey].hk) &&
     RESEARCH.b_garage.hk === B.garage.hk && RESEARCH.b_garage.hk === 'g');
  ok('T95.A \'k\' is the spare - the first this menu has had since v85',
     !Object.keys(B).some(k => B[k].cat && B[k].hk === 'k') && MENU_KEYS.includes('k'));
}

/* -------- B: no panel in the game can ask for one letter twice -------------- */
section('T95.B every host x faction panel is collision-free, with no fallback used');
{
  /* The declared keys are computed the way refreshSelPanel picks them, then
     compared against the LIVE registry. Equal sets prove two things at once: no
     two tiles on one panel declared the same letter (a duplicate would have been
     pushed onto a fallback letter and broken the set), and no call site forgot to
     ask for the declared key at all. */
  let panels = 0, worst = 0, worstAt = '', bad = [];
  for (const fac of ['tan', 'green', 'gray', 'blue']) {
    for (const allTech of [false, true]) {
      G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: 1, seed: 951100 });
      const p = G.human; p.res.p = 9e9; p.res.e = 9e9;
      if (allTech) for (const t in RESEARCH) if (techAvailable(p, t)) p.tech.add(t);
      const hq = p.blds.find(b => b.key === 'hq');
      const host = key => {
        if (key === 'hq') return hq;
        const b = makeBuilding(key, p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6, true);
        b.prog = 1; return b;
      };
      for (const hk of ['hq', 'outpost', 'barracks', 'garage', 'helipad', 'lab']) {
        const e = host(hk);
        const want = [];
        if (hk === 'hq' || hk === 'outpost') for (const k of constructRoster(hk)) want.push(B[k].hk);
        if (B[hk].lab) for (const k of researchCatalog(p)) { if (!hasTech(p, k)) want.push(RESEARCH[k].hk); }
        if (B[hk].prod) {
          for (const k of fullRoster(p, hk)) want.push(U[k].hk);
          for (const k of bldResearchList(p, hk))
            if (RESEARCH[k].kind === 'upgrade' && !hasTech(p, k)) want.push(RESEARCH[k].hk);
        }
        lastSelSig = ''; setSel([e]);
        const got = Object.keys(MENU_HOT).sort().join('');
        const wantS = want.slice().sort().join('');
        panels++;
        if (want.length > worst) { worst = want.length; worstAt = fac + '/' + hk; }
        if (got !== wantS || new Set(want).size !== want.length)
          bad.push(fac + '/' + hk + (allTech ? '+tech' : '') + ' want=' + wantS + ' got=' + got);
      }
    }
  }
  ok(`T95.B all ${panels} panels claim exactly the letters their rows declare (widest ${worst} at ${worstAt})`,
     panels === 48 && bad.length === 0, bad.slice(0, 3).join(' | '));
  ok('T95.B ...and the widest of them is still inside the alphabet, with the spare left over',
     worst === 14 && worst < MENU_KEYS.length);
}

/* -------- C: one thing, one key - the owner's ask ---------------------------- */
section('T95.C a thing reached from two hosts carries one key');
{
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 1, seed: 951101 });
  const p = G.human; p.res.p = 9e9; p.res.e = 9e9;
  const hq = p.blds.find(b => b.key === 'hq');
  const op = makeBuilding('outpost', p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6, true); op.prog = 1;
  const keysOf = e => { lastSelSig = ''; setSel([e]); const m = {}; for (const k in MENU_HOT) m[k] = MENU_HOT[k]; return m; };
  const nameOf = (m, k) => { const b = m[k]; const r = b && /<div class="b"><span>([^<]*)</.exec(b.innerHTML || ''); return r ? r[1] : null; };
  const KH = keysOf(hq), KO = keysOf(op);
  const shared = ['Barricade', 'Guard Tower', 'HQ', 'Dump Truck'];
  const at = (m, n) => Object.keys(m).find(k => nameOf(m, k) === n);
  ok(`T95.C the Outpost's four tiles wear their HQ letters (${shared.map(n => at(KO, n) + '=' + n).join(', ')})`,
     shared.every(n => at(KH, n) && at(KO, n) && at(KH, n) === at(KO, n)));
  /* the v109 values, so the fix cannot be quietly undone back to them */
  ok('T95.C ...which is the pairing v109 got wrong: the Barricade was m/c and the Dump Truck z/i',
     at(KO, 'Barricade') === 'c' && at(KO, 'Dump Truck') === 'r' &&
     at(KH, 'Barricade') === 'c' && at(KH, 'Dump Truck') === 'r');

  /* THE FINDING NOBODY ASKED ABOUT: the letters moved between ARMIES, because
     Blue has a fourth economy structure and everything below it in the sorted
     roster shifted one along. Stated over the shared roster, so a fifth army
     cannot bring it back. */
  const seen = {};
  for (const fac of ['tan', 'green', 'gray', 'blue']) {
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: 1, seed: 951102 });
    for (const k of constructRoster('hq')) (seen[k] = seen[k] || []).push(B[k].hk);
  }
  const sharedRows = Object.keys(seen).filter(k => seen[k].length === 4);
  ok(`T95.C every structure all four armies can build carries one letter in all four (${sharedRows.length} of them)`,
     sharedRows.length === 11 && sharedRows.every(k => new Set(seen[k]).size === 1));
  ok('T95.C ...and the two exclusive slots are the only per-army letters, always m and n',
     Object.keys(seen).filter(k => seen[k].length < 4).every(k => 'mn'.includes(B[k].hk)));

  /* building a structure and researching it are the same letter now */
  ok('T95.C researching a structure uses the letter that builds it',
     ['garage', 'helipad', 'generator', 'guardtower', 'radiotower'].every(k =>
       RESEARCH[B[k].tech].hk === B[k].hk));
}

/* -------- D: the fallback is still there and still fires --------------------- */
section('T95.D a row with no letter, or one already taken, still gets a key');
{
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 1, seed: 951103 });
  const p = G.human; p.res.p = 9e9; p.res.e = 9e9;
  const hq = p.blds.find(b => b.key === 'hq');
  const keep = B.supply.hk;
  B.supply.hk = undefined;                       // a row that forgot to declare one
  lastSelSig = ''; setSel([hq]);
  const n1 = Object.keys(MENU_HOT).length;
  ok('T95.D a row with no declared letter still gets one rather than shipping keyless',
     n1 === constructRoster('hq').length + fullRoster(p, 'hq').length && !!MENU_HOT['k']);
  B.supply.hk = B.barricade.hk;                  // a row that declares a taken one
  lastSelSig = ''; setSel([hq]);
  const n2 = Object.keys(MENU_HOT).length;
  ok('T95.D a duplicate declaration is pushed onto the spare rather than eating the other tile',
     n2 === n1 && !!MENU_HOT['c'] && !!MENU_HOT['k']);
  B.supply.hk = keep;
  lastSelSig = ''; setSel([hq]);
  ok('T95.D ...and with the row restored the spare goes back to being spare',
     Object.keys(MENU_HOT).length === n1 && !MENU_HOT['k'] && MENU_HOT['v']);
  ok('T95.D hotFor honours a free declared letter and refuses one outside the alphabet',
     (hotReset(), hotFor('v') === 'v') && (hotReset(), hotFor('q') === MENU_KEYS[0]));
  hotReset();
}

/* -------- E: the toy moved off 'b', and the two help surfaces say so --------- */
section('T95.E the blast preview left the left hand, and the docs agree');
{
  ok('T95.E the handler names the backtick and no longer names b/B',
     SRC110.indexOf("k==='`'||k==='~'") > 0 && SRC110.indexOf("k==='b'||k==='B'") < 0);
  ok('T95.E both help surfaces name the new key, and neither still advertises B',
     (SRC110.match(/preview blast/g) || []).length === 2 &&
     (SRC110.match(/Shift\+`/g) || []).length === 2 &&
     SRC110.indexOf('Shift+B') < 0);
  /* THE STALE LINE. The quick-reference Help box still told the player that
     Ctrl+1-9 saved a control group and 1-9 recalled it - which stopped being
     true at v98, when the abilities took the number row and the groups moved to
     F1-F9. Eleven releases, and the line two rows below it said the right thing
     the whole time. Found by this review; both surfaces agree now. */
  ok('T95.E the Help box no longer claims the control groups live on the number row',
     SRC110.indexOf('<b>Ctrl+1-9</b>: set group') < 0 &&
     (SRC110.match(/F1&ndash;F9/g) || []).length >= 2);
  ok('T95.E the number row still belongs to the abilities alone',
     ABIL_KEYS.every(k => !MENU_KEYS.includes(k)) && ABIL_KEYS.length === 9);
  /* the alphabet is still disjoint from every letter the handler binds outright */
  ok('T95.E no letter means two things: the alphabet and the global bindings still partition a-z',
     ['f', 'h', 'j', 'p', 'q', 'u', 'x', 'w', 'a', 's', 'd'].every(k => !MENU_KEYS.includes(k)) &&
     MENU_KEYS.length + 11 === 26);
}

/* -------- F: none of it can reach the simulation ---------------------------- */
section('T95.F the whole pass is client-local');
{
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'gray', opp: 3, seed: 951104 });
  for (let i = 0; i < 120; i++) update(1 / 30);
  const p = G.human; p.res.p = 9e9; p.res.e = 9e9;
  const hq = p.blds.find(b => b.key === 'hq');
  /* the hosts are MADE first: makeBuilding is a simulation call and would be the
     thing measured otherwise. Only the panel work sits between the two reads. */
  const hosts = [hq];
  for (const k of ['barracks', 'garage', 'lab']) {
    const b = makeBuilding(k, p, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6, true); b.prog = 1; hosts.push(b);
  }
  const h0 = hashState(), r0 = G.rngS;
  for (const e of hosts) { lastSelSig = ''; setSel([e]); hotReset(); refreshSelPanel(); }
  clearSel();
  ok('T95.F building every panel in the game leaves the seeded stream and the hash where it found them',
     G.rngS === r0 && hashState() === h0);
  const blob = saveState();
  ok('T95.F nothing about the letters rides in the snapshot',
     blob.indexOf('MENU_HOT') < 0 && blob.indexOf('"hk"') < 0 && blob.length > 100);
}
