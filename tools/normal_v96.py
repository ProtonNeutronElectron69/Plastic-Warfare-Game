#!/usr/bin/env python3
"""normal_v96.py - render the normal map companion of every v95 texture,
step three of the texture pipeline (after dump_base_v95.js; independent of
material_v95.py's own run, but it MUST share its rng recipe - see below).
Writes assets/nrm/<same id>.webp; run tools/embed_img.py afterwards, then
./build.sh at the repo root.

A normal map records, per pixel, which way the surface faces. The height
field is built from the same base render the texture came from:
  - a molding dome from the silhouette's distance transform (the FORM - the
    thing the v95 albedo pass deliberately did NOT relight, because the
    painter's own shading already carries it in COLOR; for normals it is
    exactly what we need)
  - the painter's low-frequency luminance (painted domes, roofs, slopes)
  - the SAME detail height the texture carries - identical seeds and rng
    call order as material_v95.process, so the grain a pixel shows in color
    is the grain it shows in relief
Encoded n*0.5+0.5 into RGB (x right, y down, z out), alpha = coverage.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
import importlib.util

_here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('m95', os.path.join(_here, 'material_v95.py'))
m95 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m95)

RS, SS = 8, 4  # v97: matches material_v95.py - the two passes must share the grid
K = RS // SS

def normals(base_png, out_path, sid, seam, P, lossless=True, q=95):
    rng = np.random.default_rng(m95.seed_of(sid))
    im = np.array(Image.open(base_png)).astype(np.float64)
    H, W = im.shape[:2]
    a = im[:, :, 3] / 255.0
    mask = a > .5
    lum = im[:, :, :3].mean(axis=2) / 255.0

    # ---- detail height: SAME rng sequence as material_v95.process ----
    gloss_protect = 1 - np.clip((lum - .78) / .17, 0, 1)
    patch = .45 + .55 * np.clip(m95.value_noise((H, W), rng, 14 * K, 1.0) * .5 + .5, 0, 1)
    det = (m95.value_noise((H, W), rng, 4 * K, .55) + m95.value_noise((H, W), rng, 1.8 * K, .45)) * patch
    det *= P['grain']
    lum_hp = lum - ndimage.gaussian_filter(lum, 5.0)
    det += P['emboss'] * lum_hp * 12
    if seam == 'v' and mask.any():
        xs = np.nonzero(mask.any(axis=0))[0]
        cx = (xs.min() + xs.max()) / 2
        x = np.arange(W)[None, :]
        det += P['seam'] * np.exp(-((x - cx) ** 2) / (2 * (0.5 * RS) ** 2))
    det *= gloss_protect
    det = ndimage.gaussian_filter(det, 0.8)

    # ---- form height: molding dome + painted low-frequency shape ----
    dt = ndimage.distance_transform_edt(mask)
    dome_r = P['dome_r'] * K
    dome = np.tanh(dt / dome_r) * dome_r
    lum_lo = ndimage.gaussian_filter(np.where(mask, lum, lum[mask].mean() if mask.any() else .5), 4.0)
    form = P['w_dome'] * dome + P['w_lum'] * lum_lo * 22
    form = ndimage.gaussian_filter(form, 1.4)

    hgt = form + det * P['w_det']

    gy, gx = np.gradient(hgt)
    nz = np.full((H, W), P['nz'])
    inv = 1.0 / np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)
    n = np.stack([-gx * inv, -gy * inv, nz * inv], axis=2)

    # ---- downsample RS -> SS: average weighted by alpha, then renormalize ----
    a4 = a[:, :, None]
    pm = np.concatenate([n * a4, a4], axis=2)
    Hs, Ws = H // K, W // K
    pm = pm[:Hs * K, :Ws * K].reshape(Hs, K, Ws, K, 4).mean(axis=(1, 3))
    aa = np.maximum(pm[:, :, 3:4], 1e-6)
    nd = pm[:, :, :3] / aa
    ln = np.maximum(np.sqrt((nd ** 2).sum(axis=2, keepdims=True)), 1e-6)
    nd /= ln
    rgb = np.clip((nd * .5 + .5) * 255, 0, 255)
    al = np.clip(pm[:, :, 3:4] * 255, 0, 255)
    outim = Image.fromarray(np.concatenate([rgb, al], axis=2).astype(np.uint8), 'RGBA')
    if lossless:
        outim.save(out_path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    else:
        outim.save(out_path, 'WEBP', quality=q, method=6, exact=True)

DEFAULTS = dict(dome_r=7.0, w_dome=1.0, w_lum=1.0, w_det=0.35, nz=2.4)
# v96.1, owner feedback: at the shared defaults an infantryman's tiny
# silhouette makes the molding dome steep everywhere, so the lit half of the
# figure ran near the shader's maximum and read washed out. Flatter normals
# for the little men: higher nz damps every tilt, the dome and painted-shape
# weights come down with it.
KIND_NRM = {'inf': dict(nz=3.6, w_dome=0.55, w_lum=0.65)}

if __name__ == '__main__':
    root = os.path.join(_here, '..')
    base = os.path.join(root, 'tools', '_base_v95')
    outd = os.path.join(root, 'assets', 'nrm')
    os.makedirs(outd, exist_ok=True)
    ids = sorted(f[:-4] for f in os.listdir(base) if f.endswith('.png'))
    if not ids:
        sys.exit('no base renders - run tools/dump_base_v95.js first')
    for sid in ids:
        kind = sid.split('_', 1)[0]
        P = dict(DEFAULTS)
        P.update(KIND_NRM.get(kind, {}))
        P['grain'] = m95.KIND_CFG.get(kind, {}).get('grain', m95.DEFAULTS['grain'])
        P['emboss'] = m95.DEFAULTS['emboss']; P['seam'] = m95.DEFAULTS['seam']
        seed_id = '_'.join(sid.split('_')[:2])
        seam = 'v' if kind != 'bld' else 'none'
        normals(os.path.join(base, sid + '.png'), os.path.join(outd, sid + '.webp'),
                seed_id, seam, P, lossless=False, q=92)
        print('ok', sid)
