#!/usr/bin/env python3
"""
verify_v58.py - static assertions on the spliced HTML.

These are properties of the document, not of the extracted script, so the node
harness cannot see them. Run after splice_v58.py:

    python3 verify_v58.py            # defaults to ./pw.html, written by build.sh
"""
import pathlib, re, sys

CHECKS = []


def chk(name, cond, detail=''):
    CHECKS.append((name, bool(cond), detail))


def main(path):
    s = pathlib.Path(path).read_text(encoding='utf-8')

    # ---- single-file discipline ----
    chk('one <style> block', s.count('<style>') == 1, str(s.count('<style>')))
    chk('one <script> block', s.count('<script>') == 1, str(s.count('<script>')))

    # ---- the squeeze guard (cost two rounds during mockup) ----
    chk('setup column children pinned against shrinking',
        s.count('#setup > *{flex:none}') == 1)
    seam = re.search(r"#setup \.opt::after\{[^}]*\}", s)
    chk('mould seam exists', bool(seam))
    chk('mould seam clipped by border-radius, not an overflow clip',
        bool(seam) and 'border-radius:11px' in seam.group(0) and 'overflow' not in seam.group(0),
        seam.group(0)[:70] if seam else '')
    start = re.search(r"\n#startBtn\{[^}]*\}", s)
    chk('#startBtn declares no overflow clip',
        bool(start) and 'overflow' not in start.group(0))
    # no rule inside the setup block may reintroduce the clip
    setup_rules = re.findall(r"#setup[^{]*\{[^}]*\}", s)
    chk('no #setup rule uses overflow:hidden',
        not any('overflow:hidden' in r for r in setup_rules),
        next((r[:60] for r in setup_rules if 'overflow:hidden' in r), ''))

    # ---- scoping: in-match UI must keep its v57 styling ----
    chk('shared .opt base rule intact',
        s.count('\n.opt{background:rgba(255,255,255,.08);border:3px solid rgba(255,255,255,.18);') == 1)
    chk('shared .opt.sel base rule intact',
        s.count('\n.opt.sel{border-color:#ffe34d;background:rgba(255,255,255,.16)}') == 1)
    chk('shared .card base rule intact',
        s.count('\n.card{background:rgba(255,255,255,.08);') == 1)
    chk('chart toggle off-state rule intact',
        s.count('#chartToggles .ctog{font-size:12px;padding:4px 10px;margin:0 3px;opacity:.45}') == 1)
    # every new plastic rule must be scoped
    plastic = ['.opt{border:0;border-radius:11px', '.opt::after{', '.opt.sel{color:#2b2200',
               '.card{border:0;border-radius:14px']
    for frag in plastic:
        idx = s.find(frag)
        chk('scoped to #setup: ' + frag[:26],
            idx > 0 and s[max(0, idx - 7):idx] == '#setup ',
            repr(s[max(0, idx - 9):idx + 20]) if idx > 0 else 'not found')

    # ---- markup ----
    chk('#infoBtn inline margin removed',
        s.count('<button id="infoBtn" class="opt">') == 1 and
        s.count('id="infoBtn" class="opt" style=') == 0)

    # ---- the module must not write the shared sprite pipeline ----
    # The banner carried a "v58 " prefix when this script was written. A later
    # cleanup pass stripped every vNN prefix out of banner titles to satisfy
    # T49.D, which rejects them - so this anchor stopped matching, and because
    # the thirteen checks below sit inside `if m:` they stopped running with it.
    # Nothing reported that: the script is not wired into run.sh or seg.sh, and
    # its default path pointed at a file outside the repo, so it was never run.
    # The prefix is optional here so the anchor holds in either form.
    m = re.search(r"/\* =+ (?:v58 )?MENU BACKDROP \(MENUBG\) =+(.|\n)*?\nmenubgInit\(\);", s)
    chk('MENUBG module present', bool(m))
    if m:
        mod = m.group(0)
        for forbidden in ('SPR.done=', 'SPR.done =', 'SPR.inf[', 'SPR.veh[', 'SPR.bld[', 'bakeSprites('):
            chk('module never touches ' + forbidden.rstrip('[('), forbidden not in mod)
        for forbidden in ('hashState', 'G.tick', 'srand(', 'update('):
            chk('module never references ' + forbidden.rstrip('('), forbidden not in mod)
        chk('module gates on the setup screen', "getElementById('setup')" in mod)
        chk('module gates on document.hidden', 'document.hidden' in mod)
        chk('module honours prefers-reduced-motion', 'prefers-reduced-motion' in mod)
        chk('module guards matchMedia for headless runs', "typeof matchMedia==='function'" in mod)
        chk('module uses its own rng', 'menubgRng' in mod and 'srand' not in mod)

    # ---- report ----
    bad = [c for c in CHECKS if not c[1]]
    for n, o, d in CHECKS:
        if not o:
            print('  FAIL: ' + n + ('  <' + d + '>' if d else ''))
    print(f'{len(CHECKS) - len(bad)} passed, {len(bad)} failed')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'pw.html'))
