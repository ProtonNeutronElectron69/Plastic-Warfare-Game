/* tail_v90_2.js - T65: the v90.2 HUD legibility pass.

   Two things the owner asked for and one bug that fell out of the second.

     A  the message toasts move from the bottom centre to the top centre
     B  the bar's height is ONE number now, and four boxes derive from it
     C  the bar is twice as tall and its text is bigger
     D  the top edge-scroll band, which has never once worked

   D is the interesting one. `MOUSE.y<14&&MOUSE.y>44` is a condition no number
   satisfies, so pushing the top of the screen has never scrolled the camera in
   any release, while the Field Manual has promised "push the screen edge" since
   v43. Doubling the bar is what exposed it: the 44 in that dead test is the old
   bar's height, so this release had to touch the line anyway.

   Nothing here reaches the simulation. G.cam is neither hashed nor serialized -
   T65.D asserts that rather than assuming it - and the rest is stylesheet. */
'use strict';
section('T65 v90.2: the HUD legibility pass');

/* The stylesheet is not in game.js: build.sh extracts the SCRIPT body for the
   harness and refreshes pw.html for exactly this kind of check. */
let CSS65 = null;
try { CSS65 = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { CSS65 = null; }
CSS65 = CSS65 ? CSS65.slice(0, CSS65.indexOf('<script>')) : null;
const rule65 = sel => {
  if (!CSS65) return '';
  const i = CSS65.indexOf(sel + '{');
  if (i < 0) return '';
  return CSS65.slice(i, CSS65.indexOf('}', i) + 1);
};
const px65 = (sel, prop) => {
  const m = new RegExp(prop + ':(-?\\d+(?:\\.\\d+)?)px').exec(rule65(sel));
  return m ? parseFloat(m[1]) : NaN;
};

ok('T65 pw.html is readable next to the harness and carries the stylesheet',
  !!CSS65 && CSS65.indexOf('#topbar{') > 0);

/* ---------- A: the toasts moved to the top ---------- */
{
  section('T65.A the toasts are at the top centre, off the selection panel');

  const msgs = rule65('#msgs');
  ok('T65.A they are anchored from the TOP now', /top:calc\(/.test(msgs));
  ok('T65.A ...and the bottom anchor is explicitly released',
    /bottom:auto/.test(msgs) && !/bottom:\d/.test(msgs));
  ok('T65.A MUTATION: the pre-v90.2 bottom:160px is gone from the sheet',
    CSS65.indexOf('bottom:160px') < 0);
  ok('T65.A they are still horizontally centred', /left:50%/.test(msgs) && /translateX\(-50%\)/.test(msgs));
  ok('T65.A ...and still ignore the mouse, so they cannot eat a click either',
    /pointer-events:none/.test(msgs));

  /* WHY THIS MOVED. The toasts sat 160px off the bottom, which is inside the
     selection panel: the panel is 118px minimum and stands 8px off the bottom,
     and with a Construct row it runs past 300. Five seconds of text landed on
     the build menu every time anything happened. Derived from the sheet's own
     numbers rather than asserted from the screenshot. */
  const selMin = px65('#selPanel', 'min-height');
  /* read off the whole sheet, not off rule65(':root'): there are TWO :root
     blocks now - this release's bar variables and the older tile ones - and
     rule65 returns the first one it finds. */
  const tileH = parseFloat((/--th:(\d+)px/.exec(CSS65) || [])[1]);
  /* The panel stands 8px off the bottom and is at least min-height tall; once it
     carries a Construct row it is at least one tile taller than that. So the old
     160px toast was inside it whenever a build menu was open, which is exactly
     when the player needs to see it. Derived from the sheet, not from a
     screenshot - the measured panel with a Construct row is 332. */
  ok(`T65.A the old position really was inside the panel with a build row open (160 vs 8+${selMin}+${tileH})`,
    160 < 8 + selMin + tileH);

  /* The one other thing that claims the top centre is the survival banner, and
     the toasts clear it BY CONSTRUCTION - the offset names the banner's height
     rather than happening to be larger than it. */
  ok('T65.A the offset is built from the bar AND the banner\'s own slot',
    /top:calc\(var\(--topbarH\) \+ 10px \+ var\(--bannerH\)\)/.test(msgs));
  {
    const bannerTop = /top:calc\(var\(--topbarH\) \+ (\d+)px\)/.exec(rule65('#survBanner'));
    const big = px65('#survBanner .wbig', 'font-size');
    const sub = px65('#survBanner .wsub', 'font-size');
    ok('T65.A the banner sits in the slot the toasts leave for it',
      !!bannerTop && +bannerTop[1] === 10);
    /* the declared --bannerH must actually cover what the banner draws */
    const bannerH = (/--bannerH:(\d+)px/.exec(CSS65) || [])[1];
    ok(`T65.A ...and --bannerH (${bannerH}) covers its two lines (${big} + ${sub})`,
      !!bannerH && +bannerH >= big + sub);
  }

  /* the entry animation was rewritten with the anchor: a toast pinned to the top
     that slides UP out of the page below it reads as leaving, not arriving */
  ok('T65.A the toast now drops in from above rather than rising from below',
    /@keyframes fadeout\{0%\{opacity:0;transform:translateY\(-8px\)/.test(CSS65));
}

/* ---------- B: one number for the bar ---------- */
{
  section('T65.B the bar\'s height is stated once and derived four times');

  const declared = (/--topbarH:(\d+)px/.exec(CSS65) || [])[1];
  ok('T65.B the stylesheet declares the height as a variable', !!declared);
  ok('T65.B ...and #topbar uses it rather than a literal',
    /height:var\(--topbarH\)/.test(rule65('#topbar')));

  /* THE COPY THAT HAS TO AGREE. TOPBAR_H is a second statement of this number,
     in a language that cannot read the first. This is the check that makes the
     duplication safe, and it is the reason the constant is allowed to exist. */
  ok(`T65.B TOPBAR_H (${TOPBAR_H}) equals the declared --topbarH (${declared})`,
    +declared === TOPBAR_H);
  /* and it is the OUTER height, not the height plus the border: the sheet opens
     with a global border-box, so the 2px bottom border is drawn inside it. */
  ok('T65.B the sheet really is border-box, which is why no border is added',
    /\*\{[^}]*box-sizing:border-box/.test(CSS65));

  /* every box that hangs off the bar's bottom edge derives, so moving the bar
     moves all of them. Before this release each was a hand-typed 50 or 52 that
     nothing tied back to the 42 it came from. */
  for (const sel of ['#rightRail', '#helpBox', '#survBanner', '#msgs']) {
    const r = rule65(sel);
    ok(`T65.B ${sel} derives its top from the bar`, /top:calc\(var\(--topbarH\)/.test(r));
    ok(`T65.B ...and states no literal top of its own`, !/top:-?\d+px/.test(r));
  }
  ok('T65.B MUTATION: the pre-v90.2 literals are gone',
    CSS65.indexOf('top:50px') < 0 && CSS65.indexOf('top:52px') < 0);
}

/* ---------- C: twice as tall, and readable ---------- */
{
  section('T65.C the bar doubled and its text grew with it');

  const h = +(/--topbarH:(\d+)px/.exec(CSS65) || [])[1];
  ok(`T65.C the bar is exactly twice the 42px it was (${h})`, h === 84);
  const fs = px65('#topbar', 'font-size');
  ok(`T65.C its text is bigger than the 14px it was (${fs})`, fs > 14);
  const dot = px65('.dotS', 'width');
  ok(`T65.C the army dot grew with the text (${dot} from 14)`, dot > 14);
  const tb = px65('.tbtn', 'font-size');
  ok(`T65.C the bar's buttons grew too (${tb} from 13)`, tb > 13);
  const ab = px65('.aBtn', 'font-size');
  ok(`T65.C ...and so did the testing-mode army chips beside them (${ab} from 13)`, ab > 13);

  /* THE BLAST RADIUS OF RAISING .tbtn. Three .tbtn buttons live OUTSIDE the bar,
     and they only stay put because each overrides BOTH font-size and padding.
     Asserted rather than trusted: dropping either override from any of them
     would silently inflate a button in the corner of the screen. */
  for (const sel of ['#hqBtn', '#mmSizeBtn', '#hqPlaceBtn']) {
    const r = rule65(sel);
    ok(`T65.C ${sel} still overrides the base font-size`, /font-size:\d/.test(r));
    ok(`T65.C ${sel} still overrides the base padding`, /padding:\d/.test(r));
  }
  ok('T65.C those three are the ONLY .tbtn outside the bar',
    (CSS65.match(/class="tbtn"/g) || []).length === 8);
}

/* ---------- D: the top edge-scroll band ---------- */
{
  section('T65.D pushing the top of the screen scrolls the camera, at last');

  /* THE DEAD CONDITION, reproduced. This is the whole bug: no number is both
     below 14 and above 44, so the branch could never run. Stated as arithmetic
     rather than as prose so it cannot be argued with. */
  {
    let anyOldHit = false;
    for (let y = 0; y <= 2000; y++) if (y < 14 && y > 44) anyOldHit = true;
    ok('T65.D MUTATION: the condition it replaces is satisfied by NO screen row', !anyOldHit);
    /* and the live test is the new one. Deliberately NOT "the old string is
       absent": the comment above the fix quotes the dead condition verbatim, and
       a check that forbade the string would forbid explaining the bug. */
    ok('T65.D the branch that runs is the derived band, not a literal',
      /MOUSE\.y>TOPBAR_H&&MOUSE\.y<TOPBAR_H\+14/.test(game65()));
  }

  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 900903 });
  /* one probe: park the camera, put the mouse at a row, run a tick, report the
     camera's movement. Everything else about the tick is irrelevant to it. */
  const probe = y => {
    G.cam.y = 400; MOUSE.inside = true; MOUSE.x = view.width / 2; MOUSE.y = y;
    update(1 / 30);
    const d = G.cam.y - 400;
    MOUSE.inside = false;
    return d;
  };
  ok('T65.D over the bar itself, nothing scrolls',
    probe(0) === 0 && probe(40) === 0 && probe(TOPBAR_H - 2) === 0);
  ok('T65.D just under the bar, the camera moves UP',
    probe(TOPBAR_H + 2) < 0 && probe(TOPBAR_H + 13) < 0);
  ok('T65.D past the band it stops again, so the whole upper map is not a scroll zone',
    probe(TOPBAR_H + 20) === 0);
  ok('T65.D the bottom edge still scrolls DOWN, which was never broken',
    probe(view.height - 5) > 0);
  ok('T65.D the band is 14px, matching the left, right and bottom edges',
    probe(TOPBAR_H + 13) < 0 && probe(TOPBAR_H + 14) === 0);
  ok('T65.D and with the mouse off the window nothing scrolls at all',
    (function () { G.cam.y = 400; MOUSE.inside = false; MOUSE.y = TOPBAR_H + 2; update(1 / 30); return G.cam.y === 400 })());

  /* IT IS A CAMERA, NOT THE SIMULATION. The whole section drives update() with a
     mouse position, which would be a lockstep divergence if the camera were sim
     state. It is not, and this is the check that says so rather than the comment
     three files away that claims it. */
  {
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 900904 });
    for (let i = 0; i < 30; i++) update(1 / 30);
    const h0 = hashState(), s0 = saveState();
    G.cam.y = 400; MOUSE.inside = true; MOUSE.x = view.width / 2; MOUSE.y = TOPBAR_H + 2;
    const camBefore = G.cam.y;
    update(1 / 30);
    MOUSE.inside = false;
    ok('T65.D the probe genuinely moved the camera', G.cam.y !== camBefore);
    ok('T65.D ...and the camera is in neither the hash nor the snapshot',
      hashState() !== h0 /* the tick advanced */ &&
      JSON.parse(s0).cam === undefined && String(hashState.toString()).indexOf('cam') < 0);
  }
}
/* the source of the extracted script, for the two text checks above. Reading
   game.js rather than pw.html on purpose: it is what actually ran. */
function game65() {
  try { return require('fs').readFileSync('game.js', 'utf8') } catch (e) { return '' }
}
