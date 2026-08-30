#!/usr/bin/env python3
"""cut_music_v104.py - cut the four chosen tracks into game loops.

Takes the full-length recordings the owner picked in the audition
(tools/audition_music.py) and produces assets/mus/*.mp3 plus the loop points
that source/js/02f-mus-data.js carries. Run it, then tools/embed_mus.py, then
./build.sh at the repo root.

    python3 tools/cut_music_v104.py            # fetch if needed, cut, report
    python3 tools/cut_music_v104.py --no-fetch # cut from build/audition/orig/

WHY THIS IS NOT JUST "ffmpeg -ss 20 -t 30". A game loop has to rejoin its own
start with no seam, every ~35 seconds, for as long as a match lasts. Cutting on
a stopwatch gives a lurch on every repeat. So the length is CHOSEN BY THE MUSIC:
for each candidate start the script correlates a 2-second window against the
whole track and takes the lag, inside the target range, where the music most
nearly repeats itself. That lag is the loop length.

BUT THE CORRELATION IS NOT THE SEAM, and expecting it to be was the first
mistake here. On live acoustic playing it tops out around 0.5 - these are human
performances, so the tempo drifts and the second time through a strain is never
the first time through it. Measured on this set: 0.43, 0.52, 0.34. A score like
that does not mean the loop is bad; it means correlation alone cannot say.
What actually decides audibility is WHERE the join falls, so a loud boundary is
penalised and a quiet one - a phrase end - preferred. Adding that penalty is
what took the seams below 1.0; read `seam`, not `score`.

WHY MP3 AND NOT OGG, having recommended OGG. Ogg Vorbis has no encoder padding,
which is the whole problem here - but Safari's decodeAudioData support for it
cannot be relied on, and the game is a file people double-click in whatever
browser they have. MP3 is also what assets/snd/ already is. The padding is
handled instead by the two mechanisms below, which cost nothing.

HOW THE PADDING IS BEATEN. Every MP3 encoder pads the start and end of a file
with silence, so looping the whole buffer ticks. Two things fix it:

  MARGIN. The file carries MARGIN seconds of real music on both sides of the
  loop, and the loop points sit inside it (loopStart=MARGIN,
  loopEnd=MARGIN+length). The padding is never inside the loop, so it is never
  heard. A decoder that reports its own delay D shifts BOTH points by D
  equally, so the loop LENGTH is still exact and the seam still lands where the
  music repeats - which is why this works without knowing D.

  A BAKED CROSSFADE. The first XFADE seconds after loopStart are blended with
  the XFADE seconds after loopEnd - the same music one loop-length apart - so
  the join is a blend rather than a butt cut. XFADE is comfortably longer than
  any decoder's delay, so a loop point shifted by one still lands inside the
  blended region. It MUST NOT exceed MARGIN: the blend reads the audio just
  past loopEnd, which is what the margin is.

  Length measured rather than guessed, mean seam across the three loops:
  40ms 0.84x, 120ms 0.65x, 300ms 0.58x. 300ms wins narrowly and blurs over half
  a beat of a march to do it, so 120ms is shipped - already well under 1.0 on
  every track, and a quarter of a beat.

The victory sting is NOT a loop: it plays once, so it is cut from the top of
the track with a fade and carries no loop points at all.

Needs: pip install imageio-ffmpeg numpy
"""
import json, math, os, subprocess, sys, urllib.parse, urllib.request

import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'build', 'audition', 'orig')
OUT = os.path.join(ROOT, 'assets', 'mus')
META = os.path.join(ROOT, 'assets', 'mus', 'loops.json')

MIRROR = 'https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main'
OG = 'freemusicarchive.org/The United States Army Old Guard Fife and Drum Corps - '
OGC = 'chosic.com/The_United_States_Army_Old_Guard_Fife_and_Drum_Corps_-_'

SR = 44100
BITRATE = '96k'      # mono, matching assets/snd/ and what the audition played
MARGIN = 0.50        # seconds of real music outside the loop, both sides
XFADE = 0.120        # seconds blended at the loop boundary
WIN = 2.0            # correlation window
ANA_SR = 11025       # analysis rate; the search does not need full bandwidth

# key, source path, what it is, search hints.
#   'lo'/'hi'  - the loop length range to search, seconds
#   'from'     - earliest start to consider, seconds (skips intros)
#   'one'      - a one-shot: cut this many seconds from 'from', no loop
TRACKS = [
 ('menu',    OG + 'The Presidents March.mp3',
  dict(lo=24, hi=42, frm=8)),
 ('build',   OG + 'Paddy on the Handcar from the Minstrel Boy Show.mp3',
  dict(lo=16, hi=30, frm=4)),
 ('combat',  OGC + '07_-_Soldiers_Farewell_FanfareMontezumaMarch_of_War'
             'Windsor_Park(chosic.com).mp3',
  dict(lo=24, hi=42, frm=25)),
 ('victory', OG + 'ERAFNAF Fanfare.mp3',
  dict(one=6.5, frm=0.0)),
]


def ffmpeg():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit('need ffmpeg: pip install imageio-ffmpeg')
    return imageio_ffmpeg.get_ffmpeg_exe()


def fetch(key, src):
    dst = os.path.join(SRC, key + '.mp3')
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    os.makedirs(SRC, exist_ok=True)
    with urllib.request.urlopen(MIRROR + '/' + urllib.parse.quote(src),
                                timeout=180) as r, open(dst, 'wb') as f:
        f.write(r.read())
    return dst


def decode(ff, path, sr):
    """Whole file as mono float32 in -1..1."""
    raw = subprocess.run([ff, '-loglevel', 'error', '-i', path, '-ac', '1',
                          '-ar', str(sr), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768.0


def find_loop(a, sr, lo, hi, frm):
    """Best (start, length) in samples, plus the correlation that chose it.

    For each candidate start, one FFT correlation of a WIN-second template
    against the whole track; the winning lag inside [lo,hi] is a length at
    which this music repeats itself. Normalised, so the score is comparable
    across tracks and a low one is a real warning rather than a quiet failure.
    """
    n = len(a)
    w = int(WIN * sr)
    lo_s, hi_s = int(lo * sr), int(hi * sr)
    # cumulative energy, for the sliding-window norm
    e = np.concatenate([[0.0], np.cumsum(a.astype(np.float64) ** 2)])
    rms = math.sqrt(float(np.mean(a.astype(np.float64) ** 2))) or 1e-9
    fa = np.fft.rfft(a, 2 * n)
    best = (-1e9, 0, 0, 0.0)
    starts = range(int(frm * sr), min(int((frm + 40) * sr), n - hi_s - w),
                   max(1, int(0.5 * sr)))
    for s in starts:
        t = a[s:s + w]
        tn = math.sqrt(float(np.dot(t, t))) or 1e-9
        # sliding dot product of the template over the whole track
        corr = np.fft.irfft(fa * np.conj(np.fft.rfft(t, 2 * n)), 2 * n)[:n]
        lags = np.arange(s + lo_s, min(s + hi_s, n - w))
        if len(lags) == 0:
            continue
        win_e = e[lags + w] - e[lags]
        norm = np.sqrt(np.maximum(win_e, 1e-12)) * tn
        sc = corr[lags] / norm
        # A seam is far less audible if it falls where the music is quiet -
        # a phrase end rather than mid-strain. Live playing drifts, so pure
        # correlation tops out around 0.5 on this material and cannot be the
        # only vote; penalising a loud boundary picks a better join among
        # candidates that score much the same.
        be = np.sqrt(np.maximum(e[lags + w] - e[lags], 0) / w) / rms
        rank = sc - 0.35 * np.clip(be, 0, 3)
        i = int(np.argmax(rank))
        if rank[i] > best[0]:
            best = (float(rank[i]), s, int(lags[i]) - s, float(sc[i]))
    return best


def seam_flux(seg, m, L, sr):
    """How audible is the loop join, in units of ordinary musical change.

    The first metric here compared the BLENDED head against unblended audio a
    loop later, which of course differ - it measured the crossfade, not the
    seam, and reported ~1.0 for every track. This builds what the game actually
    plays (the loop region twice, back to back) and asks a fair question: is
    the spectral jump AT the join bigger than the jumps this music makes
    everywhere else? 1.0 means the seam is indistinguishable from an ordinary
    beat-to-beat transition. Above ~3 it is audible as a lurch.
    """
    loop = seg[m:m + L]
    played = np.concatenate([loop, loop])
    h = int(0.046 * sr)                       # ~46ms frames
    n = len(played) // h
    fr = played[:n * h].reshape(n, h) * np.hanning(h)
    mag = np.abs(np.fft.rfft(fr, axis=1))
    flux = np.sqrt(np.sum(np.diff(mag, axis=0) ** 2, axis=1))
    med = float(np.median(flux)) or 1e-9
    j = L // h                                # the frame index at the join
    at = float(np.max(flux[max(0, j - 1):j + 2]))
    return at / med


def write(ff, key, pcm, sr, path):
    p = subprocess.Popen([ff, '-y', '-loglevel', 'error', '-f', 's16le',
                          '-ar', str(sr), '-ac', '1', '-i', '-',
                          '-b:a', BITRATE, path], stdin=subprocess.PIPE)
    p.communicate(np.clip(pcm, -1, 1).__mul__(32767).astype('<i2').tobytes())
    if p.returncode:
        sys.exit('ffmpeg failed on ' + key)


def main():
    do_fetch = '--no-fetch' not in sys.argv
    os.makedirs(OUT, exist_ok=True)
    if XFADE > MARGIN:
        sys.exit('XFADE (%.3f) must not exceed MARGIN (%.3f): the blend reads '
                 'the audio just past loopEnd, and the margin is what that is.'
                 % (XFADE, MARGIN))
    ff = ffmpeg()
    meta = {}
    for key, src, hint in TRACKS:
        path = fetch(key, src) if do_fetch else os.path.join(SRC, key + '.mp3')
        full = decode(ff, path, SR)
        out = os.path.join(OUT, key + '.mp3')

        if 'one' in hint:                      # the sting: cut, fade, done
            s = int(hint['frm'] * SR)
            # TRIM THE RECORDING'S OWN LEAD-IN. ERAFNAF Fanfare opens with 0.56s
            # of true digital silence before the first brass hit. sndLead() skips
            # it at playback either way, so the sting sounded right - but it was
            # shipping half a second of silence as base64 and delivering 5.94s of
            # fanfare out of a 6.5s budget. Starting at the attack is the same
            # result, said on purpose. Found by reading pwOff off a decoded
            # buffer in a real browser; no assertion would have shown it.
            lead = np.argmax(np.abs(full[s:]) > 0.003)
            s += int(lead)
            seg = full[s:s + int(hint['one'] * SR)].copy()
            f = int(0.25 * SR)
            seg[-f:] *= np.linspace(1, 0, f)
            write(ff, key, seg, SR, out)
            meta[key] = {'loop': False, 'dur': round(len(seg) / SR, 3)}
            print('%-8s one-shot  %5.2fs  (trimmed %.2fs of lead-in)  %6.0f kB' %
                  (key, len(seg) / SR, lead / SR, os.path.getsize(out) / 1000))
            continue

        ana = decode(ff, path, ANA_SR)
        _, s_a, l_a, score = find_loop(ana, ANA_SR, hint['lo'], hint['hi'],
                                       hint['frm'])
        s, L = int(s_a / ANA_SR * SR), int(l_a / ANA_SR * SR)
        m = int(MARGIN * SR)
        if s < m or s + L + m > len(full):     # keep the margin inside the track
            s = max(m, min(s, len(full) - L - m))
        seg = full[s - m:s + L + m].copy()

        # bake the crossfade AT the loop boundary: the XFADE seconds after
        # loopStart blended with the same music one loop-length later.
        x = int(XFADE * SR)
        head, tail = seg[m:m + x], seg[m + L:m + L + x]
        ramp = np.linspace(0, 1, x)
        seg[m:m + x] = head * ramp + tail * (1 - ramp)

        write(ff, key, seg, SR, out)
        res = seam_flux(seg, m, L, SR)
        meta[key] = {'loop': True, 'start': round(MARGIN, 3),
                     'end': round(MARGIN + L / SR, 3),
                     'dur': round(len(seg) / SR, 3),
                     'score': round(score, 3), 'seam': round(res, 2)}
        flag = '  <-- AUDIBLE SEAM, listen' if res > 3.0 else ''
        print('%-8s loop %5.2fs  match %.2f  seam %.2fx  %6.0f kB%s' %
              (key, L / SR, score, res, os.path.getsize(out) / 1000, flag))

    json.dump(meta, open(META, 'w'), indent=1, sort_keys=True)
    tot = sum(os.path.getsize(os.path.join(OUT, k + '.mp3')) for k in meta)
    print('\n%d files, %.0f kB raw, %.0f kB embedded (+%.1f%% on the game)'
          % (len(meta), tot / 1000, tot * 4 / 3 / 1000, tot * 4 / 3 / 6773396 * 100))


if __name__ == '__main__':
    main()
