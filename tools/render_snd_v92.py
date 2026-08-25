#!/usr/bin/env python3
"""render_snd_v92.py - offline renderer for the v92 recorded-audio pass.

Writes assets/snd/<key>.mp3, one file per manifest key. Deterministic: every
voice renders from a seed derived from its key, so re-running the script
reproduces the same bytes and the repository never drifts.

WHY THESE ARE RENDERED AND NOT RECORDED. The v92 session had no way to obtain
real field recordings (its network reached package registries and nothing
else), and the one thing this project must never do is ship audio nobody has
the rights to. So phase 2 ships the complete recorded-audio PIPELINE plus a
first asset set rendered offline from the same recipes the live synthesiser
plays - the recipes are the part that was tuned by ear across v64-v88, and
this renderer keeps their layer structure and frequencies while adding what a
3-node realtime graph cannot afford: per-sample filter sweeps, modal
resonators for metal and plastic, debris fields an order of magnitude denser,
and a proper mastering chain. Any file here can be replaced by a real
recording ONE AT A TIME (drop the .mp3 in assets/snd/, re-run
tools/embed_snd.py, then ./build.sh) - that swap path is the point of the
override architecture.

Files are rendered DRY on purpose: the game runs every recorded one-shot
through the same aout()/rsend() chain as the synthesis, so distance
absorption, panning and the two convolution reverbs are applied live and a
dry file sits in the world exactly the way a synthesised voice does.

Needs: pip install numpy scipy lameenc
"""
import hashlib, os, sys
import numpy as np
from scipy import signal

SR = 22050          # output rate: effects content lives comfortably under 11 kHz
OSR = 44100         # internal render rate; decimated at the end
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'snd')
BITRATE = 112       # mono mp3; short one-shots, transient-safe headroom

# ---------------------------------------------------------------- primitives

def nsamp(d):
    # int(x + .5), never round(): a product landing on an exact .5 must go the
    # same way everywhere or a signal and its envelope come out a sample apart
    return int(OSR * d + 0.5)

def rng_for(key):
    h = hashlib.sha256(('pw-v92:' + key).encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], 'big'))

def T(dur):
    return np.arange(nsamp(dur)) / OSR

def env_ahd(n, atk, hold, dur, floor=1e-4):
    """The penv() shape: exponential rise to 1, hold, exponential fall."""
    t = np.arange(n) / OSR
    e = np.zeros(n)
    a, h = max(atk, 1e-4), max(hold, 0)
    up = t < a
    e[up] = floor ** (1 - t[up] / a)
    hd = (t >= a) & (t < a + h)
    e[hd] = 1.0
    dn = t >= a + h
    rest = max(dur - a - h, 1e-3)
    e[dn] = floor ** np.clip((t[dn] - a - h) / rest, 0, 1)
    return e

def white(rng, dur):
    return rng.standard_normal(nsamp(dur))

def pink(rng, dur):
    """Paul Kellet's economy pinking filter, same family the game uses."""
    w = rng.standard_normal(nsamp(dur))
    b = signal.lfilter([0.049922035, -0.095993537, 0.050612699, -0.004408786],
                       [1, -2.494956002, 2.017265875, -0.522189400], w)
    return b / (np.max(np.abs(b)) + 1e-9)

def bp(x, freq, q):
    freq = min(freq, OSR * 0.45)
    b, a = signal.iirpeak(freq, max(q, 0.3), fs=OSR)
    return signal.lfilter(b, a, x)

def lp(x, freq, order=2):
    sos = signal.butter(order, min(freq, OSR * 0.45), 'lowpass', fs=OSR, output='sos')
    return signal.sosfilt(sos, x)

def hp(x, freq, order=2):
    sos = signal.butter(order, max(freq, 10), 'highpass', fs=OSR, output='sos')
    return signal.sosfilt(sos, x)

def sweep_lp(x, f0, f1, sweep_dur, order=2):
    """Time-varying low-pass: cutoff falls exponentially f0->f1 across
    sweep_dur. Block-processed with state carry - the 'whoomph' the game's
    psweep() makes, at twice the filter order."""
    n = len(x)
    blk = 64
    out = np.empty(n)
    zi = None
    for s in range(0, n, blk):
        e = min(s + blk, n)
        tt = min((s + blk * 0.5) / OSR / max(sweep_dur, 1e-3), 1.0)
        fc = f0 * (f1 / f0) ** tt
        sos = signal.butter(order, np.clip(fc, 25, OSR * 0.45), 'lowpass', fs=OSR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[s:e], zi = signal.sosfilt(sos, x[s:e], zi=zi)
    return out

def osc(kind, f0, f1, dur, sweep=None):
    """Phase-integrated oscillator with exponential pitch glide."""
    n = nsamp(dur)
    t = np.arange(n) / OSR
    sw = sweep if sweep else dur
    k = np.clip(t / max(sw, 1e-3), 0, 1)
    f = f0 * (max(f1, 1.0) / f0) ** k
    ph = 2 * np.pi * np.cumsum(f) / OSR
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'triangle':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'square':
        return np.sign(np.sin(ph))
    return 2 * ((ph / (2 * np.pi)) % 1.0) - 1  # sawtooth

def drive(x, k):
    return np.tanh(x * k) / np.tanh(k)

def comb(x, freq, fb, mix=1.0):
    """Feedback comb - the cheap modal resonance for metal/plastic rings."""
    d = max(2, int(OSR / freq))
    y = np.copy(x)
    for i in range(d, len(x)):
        y[i] += fb * y[i - d]
    return x * (1 - mix) + y * mix

def modal(rng, dur, modes, decays, gains):
    """A struck body: exponentially decaying sine partials with random phase."""
    n = nsamp(dur)
    t = np.arange(n) / OSR
    out = np.zeros(n)
    for f, dc, g in zip(modes, decays, gains):
        out += g * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / dc)
    return out

def mix_at(dst, src, at):
    i = nsamp(at)
    j = min(len(dst), i + len(src))
    if j > i:
        dst[i:j] += src[:j - i]
    return dst

def grains(rng, dst, n, freq, q, span, gain, gdur=0.05, bias=1.4, fade=1.1, delay=0.0, pinkish=False):
    """The pgrain() scatter, at any density: debris, rubble, casings."""
    for i in range(n):
        r = rng.random()
        at = delay + (r ** bias) * span
        f = freq * (0.5 + rng.random() * 1.3)
        g = gain * (0.35 + rng.random() * 0.9) * (1 - i / n) ** fade
        src = pink(rng, gdur) if pinkish else white(rng, gdur)
        burst = bp(src, f, q) * env_ahd(nsamp(gdur), 0.001, 0, gdur) * g
        mix_at(dst, burst, at)
    return dst

def canvas(dur):
    return np.zeros(nsamp(dur))

def master(x, peak=0.92, hp_hz=30, fade_out=0.02):
    x = hp(x, hp_hz, order=2)
    x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * 1.4) / np.tanh(1.4)   # soft limit
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    nf = nsamp(fade_out)
    if nf > 0 and nf < len(x):
        x[-nf:] *= np.linspace(1, 0, nf)
    # decimate to the output rate
    x = signal.resample_poly(x, SR, OSR)
    return np.clip(x, -1, 1)

# ------------------------------------------------------------------- voices
# Layer parameters are transcribed from the live GUNV/EXPLV recipes so the
# rendered takes keep the character that was tuned by ear across v64-v88.

GUNV = {
 'rifle':  dict(imp=(2600, .34, 2.2), body=(1500, .9, .30, .085), thump=(135, 52, .06, .09, .22),
                air=(4200, .13, .028), act=(3100, 9, .05, .04, .075)),
 'smg':    dict(imp=(3200, .26, 2.6), body=(2100, 1.1, .22, .05), thump=(165, 70, .035, .05, .13),
                air=(5200, .09, .02), act=None),
 'carbine':dict(imp=(2200, .38, 2.0), body=(1150, .8, .32, .10), thump=(118, 46, .07, .11, .28),
                air=(3800, .14, .03), act=(2700, 8, .06, .05, .09)),
 'hmg':    dict(imp=(1500, .40, 1.8), body=(900, .7, .34, .11), thump=(88, 34, .09, .14, .34),
                air=(2600, .10, .035), act=(1900, 7, .05, .06, .10), thump2=(176, 70, .06, .09, .16)),
 'vmg':    dict(imp=(2800, .28, 2.4), body=(1750, 1.0, .24, .06), thump=(128, 56, .05, .07, .18),
                air=(4600, .10, .022), act=None),
 'amg':    dict(imp=(3400, .24, 2.8), body=(2400, .9, .21, .05), thump=(150, 62, .04, .06, .12),
                air=(6000, .10, .02), act=None),
 'sniper': dict(imp=(3000, .50, 3.0), body=(1000, .8, .38, .16), thump=(150, 46, .12, .18, .30),
                air=(5000, .18, .045), act=(2400, 10, .06, .06, .16), zip=(9000, 1200, .10, .12, .12)),
 'tower':  dict(imp=(2000, .32, 2.0), body=(1300, .9, .28, .08), thump=(105, 42, .06, .10, .24),
                air=(3600, .11, .03), act=None),
}

def r_gun(rng, kind, dur):
    V = GUNV[kind]
    x = canvas(dur)
    jf = lambda v: v * (1 + rng.uniform(-.06, .06))
    # transient: shaped noise burst through a highpass and hard drive, plus a
    # true one-sample crack - the pimp() layer with real teeth
    fi, gi, di = V['imp']
    tr = white(rng, .008)
    tr[0] = 3.0
    tr *= np.exp(-np.arange(len(tr)) / (OSR * .0012))
    tr = drive(hp(tr, jf(fi), 2), di * 1.4) * gi * 2.2
    mix_at(x, tr, 0)
    # body: resonant noise burst
    fb, qb, gb, db = V['body']
    body = bp(white(rng, db * 1.6), jf(fb), qb) * env_ahd(nsamp(db * 1.6), .002, 0, db) * gb * 2.4
    mix_at(x, body, .001)
    # muzzle thump: swept sine, mildly saturated
    f0, f1, sw, dt, gt = V['thump']
    th = drive(osc('sine', jf(f0), f1, dt * 1.4, sw), 1.6) * env_ahd(nsamp(dt * 1.4), .003, 0, dt) * gt * 2.6
    mix_at(x, th, .001)
    if 'thump2' in V and V['thump2']:
        f0, f1, sw, dt, gt = V['thump2']
        th2 = osc('triangle', jf(f0), f1, dt * 1.3, sw) * env_ahd(nsamp(dt * 1.3), .003, 0, dt) * gt * 2.2
        mix_at(x, th2, .002)
    # air: the supersonic hiss over the top
    fa, ga, da = V['air']
    air = hp(white(rng, da * 1.5), jf(fa), 2) * env_ahd(nsamp(da * 1.5), .001, 0, da) * ga * 2.0
    mix_at(x, air, 0)
    if 'zip' in V:
        z0, z1, zsw, zd, zg = V['zip']
        zz = sweep_lp(white(rng, zd), z0, z1, zsw) * env_ahd(nsamp(zd), .004, 0, zd) * zg * 2.2
        mix_at(x, zz, .02)
    # a short dry room burst: what a wall gives back inside 60 ms. kept small -
    # the live reverbs add the real tail.
    room = lp(white(rng, .09), 1400, 2) * env_ahd(nsamp(.09), .004, 0, .07) * gi * .35
    mix_at(x, room, .014)
    # mechanism: bolt/link clatter as a struck metal mode, not a filtered tick
    if V.get('act'):
        fa2, qa2, ga2, da2, dl = V['act']
        mech = modal(rng, da2 * 2, [fa2, fa2 * 1.6, fa2 * 2.3], [.012, .009, .006], [1, .5, .3]) * ga2 * 1.5
        mix_at(mech, bp(white(rng, da2), fa2, qa2) * env_ahd(nsamp(da2), .001, 0, da2) * ga2, 0)
        mix_at(x, mech, dl * (1 + rng.uniform(-.1, .1)))
    # shell casing ring on the slower weapons
    if kind in ('carbine', 'sniper', 'tower'):
        ring = modal(rng, .18, [3100 * (1 + rng.uniform(-.08, .08)), 5200], [.03, .02], [1, .4]) * .045
        mix_at(x, ring, .11 + rng.uniform(0, .04))
    return x

def r_flame(rng, dur):
    x = canvas(dur)
    # ignition: the cutoff falling is the gout of fuel catching
    ig = sweep_lp(white(rng, .5), 3000, 300, .14) * env_ahd(nsamp(.5), .015, .05, .40) * .9
    mix_at(x, ig, 0)
    roar = lp(pink(rng, dur), 380, 2) * env_ahd(nsamp(dur), .03, dur * .45, dur * .92) * 1.5
    mix_at(x, roar, .02)
    # fuel-pop crackle, far denser than the live 6 grains
    grains(rng, x, 26, 3200, 5, dur * .8, .10, gdur=.022, bias=1.1)
    gr = drive(osc('sawtooth', 140, 52, .30, .18), 1.8) * env_ahd(nsamp(.30), .01, 0, .26) * .30
    mix_at(x, gr, .01)
    return x

def r_throw(rng, dur):
    x = canvas(dur)
    mix_at(x, bp(white(rng, .09), 1400, 1.2) * env_ahd(nsamp(.09), .002, 0, .07) * .55, 0)
    mix_at(x, bp(white(rng, .05), 3600, 6) * env_ahd(nsamp(.05), .001, 0, .04) * .35, .03)
    arc = osc('sine', 900, 640, .18, .12) * env_ahd(nsamp(.18), .03, 0, .16) * .25
    mix_at(x, arc, .05)
    return x

def r_launch(rng, kind, dur):
    x = canvas(dur)
    if kind in ('cannon', 'cannon_hvy'):
        hv = kind == 'cannon_hvy'
        tr = white(rng, .01); tr[0] = 3.0
        tr *= np.exp(-np.arange(len(tr)) / (OSR * .0015))
        mix_at(x, drive(hp(tr, 1000 if hv else 1200, 2), 3.0) * (0.95 if hv else 0.85), 0)
        bd = sweep_lp(white(rng, .30 if hv else .22), 4200 if hv else 5000, 200 if hv else 260,
                      .14 if hv else .10) * env_ahd(nsamp((.30 if hv else .22)), .002, 0, .22 if hv else .16)
        mix_at(x, bd * (1.0 if hv else .85), 0)
        sub = drive(osc('sine', 48 if hv else 62, 18 if hv else 24, .55 if hv else .40, .30 if hv else .22), 1.8)
        sub *= env_ahd(nsamp((.55 if hv else .40)), .004, 0, .48 if hv else .34) * (1.25 if hv else 1.0)
        mix_at(x, sub, .002)
        mid = osc('triangle', 96 if hv else 124, 38 if hv else 48, .28 if hv else .22, .18 if hv else .14)
        mix_at(x, mid * env_ahd(nsamp((.28 if hv else .22)), .003, 0, .26 if hv else .20) * .55, .002)
        rum = lp(pink(rng, dur * .8), 300, 2) * env_ahd(nsamp(dur * .8), .05, .1, dur * .7) * .55
        mix_at(x, rum, .04)
        grains(rng, x, 9, 1600, 7, .4, .07, gdur=.05, delay=.16)
    elif kind == 'mortar':
        # the hollow tube: one strong resonance IS the sound
        mix_at(x, drive(hp(white(rng, .006), 700, 2), 1.8) * .35, 0)
        tube = bp(white(rng, .30), 380, 5) * env_ahd(nsamp(.30), .004, 0, .24) * 1.3
        mix_at(x, tube, .001)
        thp = osc('sine', 230, 80, .18, .10) * env_ahd(nsamp(.18), .004, 0, .16) * 1.0
        mix_at(x, thp, 0)
        mix_at(x, bp(white(rng, .08), 1100, 3) * env_ahd(nsamp(.08), .002, 0, .07) * .35, .004)
    elif kind == 'aa':
        mix_at(x, drive(hp(white(rng, .006), 2600, 2), 2.6) * .5, 0)
        wh = sweep_lp(white(rng, .18), 8000, 1400, .10) * env_ahd(nsamp(.18), .006, 0, .16) * .8
        mix_at(x, wh, 0)
        ri = drive(osc('sawtooth', 500, 2600, .30, .22), 1.4) * env_ahd(nsamp(.30), .015, 0, .26) * .28
        mix_at(x, ri, .01)
        ri2 = osc('sine', 700, 2400, .34, .28) * env_ahd(nsamp(.34), .04, 0, .30) * .18
        mix_at(x, ri2, .02)
        jet = hp(white(rng, dur * .8), 2200, 2) * env_ahd(nsamp(dur * .8), .05, 0, dur * .7) * .16
        mix_at(x, jet, .04)
    elif kind == 'artyrocket':
        mix_at(x, drive(hp(white(rng, .008), 1400, 2), 2.6) * .7, 0)
        bd = sweep_lp(white(rng, .6), 7000, 400, .30) * env_ahd(nsamp(.6), .02, .05, .50) * .95
        mix_at(x, bd, 0)
        ri = drive(osc('sawtooth', 180, 900, .55, .40), 1.5) * env_ahd(nsamp(.55), .02, .05, .50) * .30
        mix_at(x, ri, .02)
        sub = osc('sine', 70, 30, .45, .26) * env_ahd(nsamp(.45), .006, 0, .40) * .85
        mix_at(x, sub, .002)
        rum = lp(pink(rng, dur * .85), 340, 2) * env_ahd(nsamp(dur * .85), .08, .15, dur * .75) * .6
        mix_at(x, rum, .08)
        grains(rng, x, 10, 2600, 7, .35, .07, gdur=.04)
    else:  # bazooka / generic rocket
        mix_at(x, drive(hp(white(rng, .007), 1800, 2), 2.4) * .6, 0)
        bd = sweep_lp(white(rng, .35), 6000, 700, .18) * env_ahd(nsamp(.35), .012, 0, .28) * .8
        mix_at(x, bd, 0)
        ri = drive(osc('sawtooth', 260, 1500, .34, .26), 1.4) * env_ahd(nsamp(.34), .02, 0, .30) * .22
        mix_at(x, ri, .01)
        sub = osc('sine', 90, 40, .22, .12) * env_ahd(nsamp(.22), .004, 0, .18) * .5
        mix_at(x, sub, .001)
        ex = bp(white(rng, .55), 900, .8) * env_ahd(nsamp(.55), .06, 0, .5) * .28
        mix_at(x, ex, .06)
    return x

EXPLV = {
 'small': dict(lf=0,  lf2=0,   b=(3200, 380, .10, .16, .38), imp=(2600, .34, 2.4), crack=(3000, .26, .05),
               deb=(14, 2800, .18, .07), tail=(260, .35, .18), slap=None),
 'med':   dict(lf=55, lf2=41,  b=(3600, 220, .18, .30, .62), imp=(2000, .46, 2.1), crack=(2400, .34, .07),
               deb=(24, 2400, .34, .09), tail=(170, .70, .30), slap=(92, 44, .10, .16, .34, .055)),
 'big':   dict(lf=42, lf2=34.5,b=(3800, 160, .26, .42, .82), imp=(1700, .55, 1.9), crack=(2100, .42, .09),
               deb=(38, 2200, .55, .11), tail=(140, 1.10, .42), slap=(70, 38, .14, .22, .48, .07)),
 'huge':  dict(lf=33, lf2=30,  b=(4200, 120, .34, .55, 1.05), imp=(1500, .62, 1.8), crack=(1900, .50, .11),
               deb=(54, 2000, .80, .13), tail=(120, 1.55, .55), slap=(62, 30, .16, .26, .60, .075)),
}

def r_boom(rng, size, dur):
    S = EXPLV[size]
    x = canvas(dur)
    # 1 leading edge
    tr = white(rng, .01); tr[0] = 3.2
    tr *= np.exp(-np.arange(len(tr)) / (OSR * .0015))
    fi, gi, di = S['imp']
    mix_at(x, drive(hp(tr, fi, 2), di * 1.3) * gi * 2.2, 0)
    # 2 crack shell
    fc, gc, dc = S['crack']
    mix_at(x, hp(white(rng, dc * 1.5), fc, 2) * env_ahd(nsamp(dc * 1.5), .001, 0, dc) * gc * 2.2, 0)
    # 3 body: the collapsing cutoff
    f0, f1, sw, db, gb = S['b']
    bd = sweep_lp(white(rng, db * 1.6), f0, f1, sw) * env_ahd(nsamp(db * 1.6), .002, 0, db) * gb * 2.2
    mix_at(x, bd, 0)
    # 4 sub + octave-up so it reads on a laptop
    if S['lf']:
        lo = S['lf2']
        sub = drive(osc('sine', S['lf'], lo, db * 1.6, db * 1.4), 1.7) * env_ahd(nsamp(db * 1.6), .004, 0, db * 1.5) * gb * 2.6
        mix_at(x, sub, .002)
        oc = osc('triangle', S['lf'] * 2, lo * 1.7, db * 1.1, db * .9) * env_ahd(nsamp(db * 1.1), .003, 0, db) * gb * 1.1
        mix_at(x, oc, .002)
    # 5 debris, dense
    dn, df, dspan, dg = S['deb']
    grains(rng, x, dn, df, 6, dspan, dg * 1.4, gdur=.05, delay=.02)
    # 6 tail rumble
    tf, td, tg = S['tail']
    tl = lp(pink(rng, td), tf, 2) * env_ahd(nsamp(td), .03, td * .2, td * .95) * tg * 1.8
    mix_at(x, tl, .02)
    # 7 ground slap
    if S['slap']:
        f0s, f1s, sws, ds, gs, dls = S['slap']
        sl = drive(osc('sine', f0s, f1s, ds * 1.2, sws), 1.5) * env_ahd(nsamp(ds * 1.2), .006, 0, ds) * gs * 2.2
        mix_at(x, sl, dls)
    if size == 'huge':
        sl2 = osc('sine', 50, 32, .34, .20) * env_ahd(nsamp(.34), .01, 0, .30) * .9
        mix_at(x, sl2, .145)
        grains(rng, x, 26, 900, 4, dur - .5, .10, gdur=.09, delay=.35, fade=.6, pinkish=True)
    return x

def r_destroy(rng, dur):
    x = canvas(dur)
    # 1 the detonation
    tr = white(rng, .012); tr[0] = 3.2
    tr *= np.exp(-np.arange(len(tr)) / (OSR * .0018))
    mix_at(x, drive(hp(tr, 1300, 2), 2.4) * 1.0, 0)
    mix_at(x, hp(white(rng, .16), 1900, 2) * env_ahd(nsamp(.16), .001, 0, .12) * .85, 0)
    bd = sweep_lp(white(rng, .7), 4400, 130, .30) * env_ahd(nsamp(.7), .002, 0, .50) * 1.5
    mix_at(x, bd, 0)
    sub = drive(osc('sine', 44, 30, 1.1, .60), 1.8) * env_ahd(nsamp(1.1), .004, 0, 1.0) * 1.9
    mix_at(x, sub, .002)
    mix_at(x, osc('triangle', 88, 52, .65, .40) * env_ahd(nsamp(.65), .003, 0, .60) * .8, .002)
    mix_at(x, drive(osc('sine', 64, 32, .3, .18), 1.4) * env_ahd(nsamp(.3), .008, 0, .28) * .7, .075)
    # 2 structural groan: three detuned saws sagging through a falling low-pass
    for f0, f1, g, dl in ((142, 58, .30, .15), (151, 62, .27, .17), (97, 41, .23, .16)):
        saw = osc('sawtooth', f0 * (1 + rng.uniform(-.02, .02)), f1, 1.0, .85)
        saw = sweep_lp(saw, 900, 180, .9) * env_ahd(nsamp(1.0), .10, .1, .95) * g
        mix_at(x, saw, dl)
    mix_at(x, bp(white(rng, .8), 300, 12) * env_ahd(nsamp(.8), .14, 0, .70) * .5, .18)
    # 3 collapse rumble
    rum = lp(pink(rng, dur - .4), 130, 2) * env_ahd(nsamp((dur - .4)), .10, .4, dur - .55) * 1.1
    mix_at(x, rum, .35)
    # 4 rubble rain - twice the live density, with woody lows under the clatter
    grains(rng, x, 44, 1400, 5, dur - 1.0, .12, gdur=.07, delay=.45, fade=.8)
    grains(rng, x, 16, 600, 3, dur - 1.2, .11, gdur=.11, delay=.55, pinkish=True)
    # 5 dust settling
    dust = hp(white(rng, dur - 1.1), 5200, 2) * env_ahd(nsamp((dur - 1.1)), .35, 0, dur - 1.3) * .07
    mix_at(x, dust, 1.10)
    return x

def r_pop(rng, dur):
    x = canvas(dur)
    tr = white(rng, .004); tr[0] = 2.2
    tr *= np.exp(-np.arange(len(tr)) / (OSR * .0008))
    mix_at(x, drive(hp(tr, 4200, 2), 2.0) * .55, 0)
    # the polystyrene crack: high, tight modes of a small brittle shell
    mix_at(x, modal(rng, .07, [3400 * (1 + rng.uniform(-.05, .05)), 5600, 7600], [.008, .006, .004], [1, .6, .35]) * .5, 0)
    mix_at(x, bp(white(rng, .05), 1800, 8) * env_ahd(nsamp(.05), .001, 0, .045) * .45, .015)
    tw = osc('triangle', 420, 180, .06, .04) * env_ahd(nsamp(.06), .002, 0, .05) * .3
    mix_at(x, tw, .008)
    # the clatter onto the mat
    grains(rng, x, 5, 1200, 7, .10, .22, gdur=.035, delay=.05, bias=1.2)
    return x

def r_nest(rng, dur):
    x = canvas(dur)
    mix_at(x, drive(hp(white(rng, .006), 900, 2), 1.8) * .5, 0)
    mix_at(x, lp(pink(rng, .16), 700, 2) * env_ahd(nsamp(.16), .002, 0, .12) * .8, 0)
    # woody splintering: low modal knocks, irregular
    for i in range(6):
        at = .01 + (rng.random() ** 1.3) * (dur * .6)
        f = 260 * (0.8 + rng.random() * 1.1)
        mix_at(x, modal(rng, .12, [f, f * 2.7, f * 4.1], [.05, .02, .012], [1, .4, .2]) * .30, at)
    grains(rng, x, 18, 1500, 5, dur * .8, .10, gdur=.05)
    th = osc('sine', 110, 48, .20, .12) * env_ahd(nsamp(.20), .006, 0, .18) * .5
    mix_at(x, th, .01)
    return x

def r_struct(rng, dur):
    x = canvas(dur)
    mix_at(x, bp(white(rng, .05), 2200, 7) * env_ahd(nsamp(.05), .001, 0, .04) * .5, 0)
    # wire + sheet metal: comb-resonated rattle and a real metallic ring-down
    rat = comb(bp(white(rng, dur * .8), 1900, 3), 330, .82, .8) * env_ahd(nsamp(dur * .8), .004, 0, dur * .55) * .30
    mix_at(x, rat, .01)
    for i in range(4):
        at = .02 + (rng.random() ** 1.2) * (dur * .5)
        f = 2400 * (0.7 + rng.random() * 1.4)
        mix_at(x, modal(rng, .16, [f, f * 1.5], [.04, .025], [1, .5]) * .16, at)
    th = osc('sine', 180, 70, .16, .10) * env_ahd(nsamp(.16), .003, 0, .14) * .55
    mix_at(x, th, .005)
    body = lp(white(rng, .4), 400, 2) * env_ahd(nsamp(.4), .02, 0, .32) * .5
    mix_at(x, body, .02)
    return x

def r_whoosh(rng, dur):
    x = canvas(dur)
    bd = sweep_lp(white(rng, dur * .8), 6000, 200, dur * .55) * env_ahd(nsamp(dur * .8), .06, .1, dur * .7) * .9
    mix_at(x, bd, 0)
    body = lp(pink(rng, dur * .75), 700, 2) * env_ahd(nsamp(dur * .75), .06, .1, dur * .65) * .8
    mix_at(x, body, .02)
    sub = osc('sine', 90, 50, dur * .65, dur * .5) * env_ahd(nsamp(dur * .65), .05, 0, dur * .6) * .55
    mix_at(x, sub, .03)
    grains(rng, x, 10, 3400, 4, dur * .5, .05, gdur=.05, delay=.10)
    return x

# --------------------------------------------------------------- the roster
# (key base, take count, dry duration, render fn)  -  SND_VAR in 03-audio.js
# must agree with the take counts here; tail_v92 T67 asserts it both ways.

ROSTER = [
 ('gun_rifle',   2, .42, lambda r: r_gun(r, 'rifle', .42)),
 ('gun_smg',     2, .32, lambda r: r_gun(r, 'smg', .32)),
 ('gun_carbine', 1, .52, lambda r: r_gun(r, 'carbine', .52)),
 ('gun_hmg',     2, .46, lambda r: r_gun(r, 'hmg', .46)),
 ('gun_vmg',     2, .34, lambda r: r_gun(r, 'vmg', .34)),
 ('gun_amg',     2, .32, lambda r: r_gun(r, 'amg', .32)),
 ('gun_sniper',  1, .88, lambda r: r_gun(r, 'sniper', .88)),
 ('gun_tower',   2, .50, lambda r: r_gun(r, 'tower', .50)),
 ('flame',       1, 1.10, lambda r: r_flame(r, 1.10)),
 ('throw',       1, .40, lambda r: r_throw(r, .40)),
 ('launch_cannon',     1, .95, lambda r: r_launch(r, 'cannon', .95)),
 ('launch_cannon_hvy', 1, 1.25, lambda r: r_launch(r, 'cannon_hvy', 1.25)),
 ('launch_mortar',     1, .55, lambda r: r_launch(r, 'mortar', .55)),
 ('launch_aa',         1, .75, lambda r: r_launch(r, 'aa', .75)),
 ('launch_artyrocket', 1, 1.30, lambda r: r_launch(r, 'artyrocket', 1.30)),
 ('launch_rocket',     1, .95, lambda r: r_launch(r, 'rocket', .95)),
 ('boom_small',  2, .55, lambda r: r_boom(r, 'small', .55)),
 ('boom_med',    1, .95, lambda r: r_boom(r, 'med', .95)),
 ('boom_big',    1, 1.50, lambda r: r_boom(r, 'big', 1.50)),
 ('boom_huge',   1, 2.10, lambda r: r_boom(r, 'huge', 2.10)),
 ('bld_destroy', 1, 2.80, lambda r: r_destroy(r, 2.80)),
 ('pop',         2, .22, lambda r: r_pop(r, .22)),
 ('nest_break',  1, .55, lambda r: r_nest(r, .55)),
 ('struct_break',1, .55, lambda r: r_struct(r, .55)),
 ('whoosh',      1, .85, lambda r: r_whoosh(r, .85)),
]

def encode_mp3(x):
    import lameenc
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    enc.silence()
    return enc.encode(pcm.tobytes()) + enc.flush()

def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    print(f'{"key":22s} {"dur":>5s} {"peak":>5s} {"rms":>6s} {"kB":>6s}')
    for base, takes, dur, fn in ROSTER:
        for i in range(takes):
            key = f'{base}_{i}'
            x = master(fn(rng_for(key)))
            data = encode_mp3(x)
            path = os.path.join(OUT, key + '.mp3')
            with open(path, 'wb') as f:
                f.write(data)
            total += len(data)
            rms = float(np.sqrt(np.mean(x * x)))
            print(f'{key:22s} {len(x)/SR:5.2f} {float(np.max(np.abs(x))):5.2f} {rms:6.3f} {len(data)/1024:6.1f}')
    print(f'total {total/1024:.0f} kB across {sum(t for _, t, _, _ in ROSTER)} files')

if __name__ == '__main__':
    sys.exit(main())
