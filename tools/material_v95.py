#!/usr/bin/env python3
"""material_v95.py - the per-pixel plastic material pass, step two of the
phase-4 texture pipeline (step one is dump_base_v95.js).

Reads the 6x base renders from tools/_base_v95/ and writes the finished
textures into assets/img/ at the bake's own SS=3 supersample - run
tools/embed_img.py afterwards to refresh the embedded table, then
./build.sh. The worklist is whatever step one rendered, so the roster
lives in ONE place (dump_base_v95.js derives it from the game's tables).

WHY WEBP AND NOT PNG. The full roster is 212 sprites; as PNG that is
~5.8 MB before base64 puts it inside the shipped file. Measured on real
textures, lossy WebP at quality 95 is 4-6x smaller with a mean error
under 0.7/255 on covered pixels - invisible at game zoom - and a decode
failure in some hypothetical non-WebP browser degrades to the procedural
painter by the override architecture, exactly like a missing file.

THE RECIPE, AND WHY IT IS SHAPED THIS WAY. The painter's own shading IS
the light: the first cut of this pass flattened the albedo and relit
everything from a distance-field height dome, and the result read WORSE
than the painter - washed out, flat decks pillowed. What ships adds only
what a vector painter cannot: bump-lit plastic grain in patches, a mold
seam down infantry and vehicles, sparse bright scratches, worn edges
where painted detail changes hard, micro-occlusion in painted crevices,
a molded-color swirl. It finishes with the exact enrichCell numbers
(rim/shadow offsets scaled to the final supersample, sat 1.15, contrast
1.05), because textured cells SKIP enrichCell at runtime and must not
sit duller than procedural neighbours.

Deterministic: every random draw is seeded from kind_key alone - an
army-man of every colour comes off the same mold, and a walk cycle must
not boil between frames. Needs numpy, scipy, pillow.
"""
import os, sys
import json, hashlib, os
import numpy as np
from PIL import Image
from scipy import ndimage

RS, SS = 6, 3
K = RS // SS
LIGHT = np.array([-0.46, -0.66])

def seed_of(sid):
    return int(hashlib.sha256(sid.encode()).hexdigest()[:8], 16)

def value_noise(shape, rng, cell, amp):
    h, w = shape
    gh, gw = max(2, int(h / cell) + 2), max(2, int(w / cell) + 2)
    g = rng.standard_normal((gh, gw))
    return amp * ndimage.zoom(g, (h / gh, w / gw), order=3, mode='nearest')[:h, :w]

def process(base_png, out_png, sid, seam, P):
    rng = np.random.default_rng(seed_of(sid))
    im = np.array(Image.open(base_png)).astype(np.float64)
    H, W = im.shape[:2]
    alb, a = im[:, :, :3], im[:, :, 3] / 255.0
    mask = a > .5
    lum = alb.mean(axis=2) / 255.0

    # ---- detail-only height: grain + seam + painted-detail emboss ----
    # plastic is mostly SMOOTH: fine, weak grain, in patches (molded surface
    # variation), and gloss highlights the painter drew stay pristine
    gloss_protect = 1 - np.clip((lum - .78) / .17, 0, 1)
    patch = .45 + .55 * np.clip(value_noise((H, W), rng, 14 * K, 1.0) * .5 + .5, 0, 1)
    hgt = (value_noise((H, W), rng, 4 * K, .55) + value_noise((H, W), rng, 1.8 * K, .45)) * patch
    hgt *= P['grain']
    lum_hp = lum - ndimage.gaussian_filter(lum, 5.0)       # painted panel lines & rivets
    hgt += P['emboss'] * lum_hp * 12
    if seam == 'v' and mask.any():
        xs = np.nonzero(mask.any(axis=0))[0]
        cx = (xs.min() + xs.max()) / 2
        x = np.arange(W)[None, :]
        hgt += P['seam'] * np.exp(-((x - cx) ** 2) / (2 * (0.5 * RS) ** 2))
    hgt *= gloss_protect
    hgt = ndimage.gaussian_filter(hgt, 0.8)

    # ---- bump-light the detail around a flat baseline ----
    gy, gx = np.gradient(hgt)
    nz = np.full((H, W), P['nz'])
    inv = 1.0 / np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)
    n = np.stack([-gx * inv, -gy * inv, nz * inv], axis=2)
    L = np.array([LIGHT[0], LIGHT[1], .70]); L /= np.linalg.norm(L)
    Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
    ndl, ndh = n @ L, np.clip(n @ Hh, 0, None)
    flat_ndh = Hh[2]
    dshade = P['kd'] * ndl
    dshade -= dshade[mask].mean() if mask.any() else 0       # zero-mean: no net darkening
    dspec = P['ks'] * (ndh ** P['shin'] - flat_ndh ** P['shin'])

    # ---- sparse scratches: thin bright nicks, denser on vehicles ----
    scr = np.zeros((H, W))
    nscr = int(P['scratches'] * mask.sum() / (90 * 90))
    ys, xs2 = np.nonzero(mask)
    for _ in range(nscr):
        i = rng.integers(len(xs2))
        x0, y0 = xs2[i], ys[i]
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(3, 9) * K
        x1, y1 = x0 + np.cos(ang) * ln, y0 + np.sin(ang) * ln
        t = np.linspace(0, 1, int(ln * 2))
        px, py = (x0 + (x1 - x0) * t).astype(int), (y0 + (y1 - y0) * t).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        scr[py[ok], px[ok]] = rng.uniform(.5, 1.0)
    scr = ndimage.gaussian_filter(scr, 0.7) * mask

    # ---- worn edges: bright chips where painted detail changes hard ----
    edge = np.hypot(*np.gradient(ndimage.gaussian_filter(lum, 1.2)))
    edge = np.clip(edge * 10 - .18, 0, 1)
    wear_n = np.clip(value_noise((H, W), rng, 5 * K, 1.0), .25, None) - .25
    wear = edge * wear_n * P['wear']

    # ---- micro-AO in painted crevices ----
    ao = np.clip(-lum_hp, 0, 1) * P['ao']

    out = alb * (1 + dshade - ao)[:, :, None] \
        + 255.0 * (dspec + scr * P['scr_a'] + wear)[:, :, None]

    # ---- subtle molded-color swirl ----
    swirl = ndimage.gaussian_filter(rng.standard_normal((H, W)), 13.0)
    swirl /= max(np.abs(swirl).max(), 1e-6)
    out *= (1 + P['mottle'] * swirl)[:, :, None]

    # ---- the exact enrichCell finish (offsets scaled RS/SS) ----
    off = max(2, round(1.1 * SS)) * K
    am = a > 40 / 255
    ul = np.zeros_like(am); ul[off:, off:] = am[:-off, :-off]
    dr = np.zeros_like(am); dr[:-off, :-off] = am[off:, off:]
    lit_edge = am & ~ul
    sh_edge = am & ~dr & ~lit_edge
    out[lit_edge] += np.array([64, 64, 56])
    out[sh_edge] *= np.array([.75, .77, .81])
    l = out.mean(axis=2, keepdims=True)
    out = l + (out - l) * 1.15
    out = (out - 128) * 1.05 + np.array([131, 131, 130])
    out = np.clip(out, 0, 255)

    # ---- premultiplied downsample RS -> SS ----
    a4 = a[:, :, None]
    pm = np.concatenate([out * a4, a4 * 255], axis=2)
    Hs, Ws = H // K, W // K
    pm = pm[:Hs * K, :Ws * K].reshape(Hs, K, Ws, K, 4).mean(axis=(1, 3))
    aa = pm[:, :, 3:4]
    rgb_o = np.where(aa > 1, pm[:, :, :3] / np.maximum(aa / 255, 1e-6), 0)
    final = np.concatenate([np.clip(rgb_o, 0, 255), np.clip(aa, 0, 255)], axis=2).astype(np.uint8)
    Image.fromarray(final, 'RGBA').save(out_png, 'WEBP', quality=95, method=6, exact=True)

DEFAULTS = dict(grain=.38, emboss=.5, seam=.6, nz=2.4, kd=.8, ks=.7, shin=36,
                scratches=4, scr_a=.12, wear=.25, ao=.10, mottle=.045)


# per-kind overrides: vehicles carry a little less grain than buildings
KIND_CFG = {'veh': {'grain': 0.3}}

if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    base = os.path.join(root, 'tools', '_base_v95')
    outd = os.path.join(root, 'assets', 'img')
    os.makedirs(outd, exist_ok=True)
    ids = sorted(f[:-4] for f in os.listdir(base) if f.endswith('.png'))
    if not ids:
        sys.exit('no base renders - run tools/dump_base_v95.js first')
    for sid in ids:
        kind = sid.split('_', 1)[0]
        P = dict(DEFAULTS)
        P.update(KIND_CFG.get(kind, {}))
        # one seed per kind_key: an army-man of every colour comes off the same
        # mold, and a walk cycle must not boil between frames
        seed_id = '_'.join(sid.split('_')[:2])
        seam = 'v' if kind != 'bld' else 'none'
        process(os.path.join(base, sid + '.png'), os.path.join(outd, sid + '.webp'), seed_id, seam, P)
        print('ok', sid)
