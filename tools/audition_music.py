#!/usr/bin/env python3
"""audition_music.py - build a listening page for candidate soundtrack music.

Roadmap 4 item 1 asks for four music loops. This is the tool that lets the
owner CHOOSE them by ear before a byte of audio goes near the game: it fetches
candidate tracks, cuts each to a 30-second excerpt at the encode the game would
actually ship, and writes one self-contained HTML page with a player, a
waveform and a running file-size budget per track.

    python3 tools/audition_music.py            # fetch, cut, write the page
    python3 tools/audition_music.py --no-fetch # re-cut from already-downloaded files

It is a CHOOSING tool, not a test. Like sim.sh and the probes it is not part of
seg.sh, nothing it produces is pinned, and it touches neither source/ nor the
build. Its output is an artifact you look at, and the answer it gives is
"which of these sounds like the game", which no assertion can answer.

WHY THESE TRACKS COME FROM A GITHUB MIRROR. Every music host worth using -
Musopen, OpenGameArt, Kenney, the Internet Archive - is blocked by the agent
sandbox's network policy; GitHub is not. SoundSafari/CC0-1.0-Music is a public
mirror that preserves the FreePD library after freepd.com shut down in 2025,
and its freepd.com/ folder is the portion used here: originally Kevin MacLeod
public-domain dedications, CC0.

THE LICENCE IS GOOD BUT SECOND-HAND, and that is the one thing this script
cannot check for you. A community-aggregated mirror is evidence, not
provenance. Before any track SHIPS, confirm it is CC0 at its original source.
CC0 is what makes this set worth auditioning at all: the game is one
double-clickable file with no credits screen, so a licence that needs
attribution needs somewhere to put it.

WHY THE PREVIEW IS MONO 96k AND NOT THE SOURCE QUALITY. Every asset rides
inside plastic-warfare.html as base64, at 4/3 of its own size, and music is
~100x longer than a gunshot: the whole 35-file sound set is 444 kB, while ONE
30-second stereo loop at 128k is 960 kB. Auditioning at source quality would
mean choosing a track you cannot afford. The preview IS the shipping encode,
so what you hear is what the game would sound like, and the page's per-track
"adds N to the game" figure is that file's own byte count times 4/3.

Needs: pip install imageio-ffmpeg   (bundles an ffmpeg binary; no apt, no PATH)
"""
import base64, json, math, os, struct, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WORK = os.path.join(ROOT, 'build', 'audition')
ORIG, PREV = os.path.join(WORK, 'orig'), os.path.join(WORK, 'prev')
TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audition_page.tpl.html')
OUT = os.path.join(WORK, 'soundtrack-audition.html')

MIRROR = ('https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/'
          'freepd.com')

PREVIEW_SEC = 30
BITRATE = '96k'      # mono; the shipping target, see the module docstring

# The four slots are a match's own arc, which is why they are ordered and
# numbered on the page. Each track: (name, start-offset seconds, tag, note).
# The offset skips the intro so the excerpt lands in the BODY of the piece -
# a track judged on its fade-in is a track judged wrong.
SLOTS = [
 ('01', 'setup', 'Setup & Menu',
  'Plays before a shot is fired. This is the track that has to say '
  '<em>toy soldiers</em> in five seconds.', [
  ('Honor Bound', 20, 'march',
   'Steady military march — snare, low brass, no melodrama. The most '
   'literal army-men cue in the set.'),
  ('The Britons', 45, 'ceremonial',
   'Stately fife-and-drum. Traditional to the point of ceremony; the longest '
   'track here at 5:06.'),
  ('Brothers Unite', 30, 'orchestral',
   'Warmer and orchestral. Heroic swell rather than a march — less parade '
   'ground, more campaign.'),
  ('Heroic Adventure', 20, 'adventure',
   'Bright and Saturday-morning. Reads as adventure, not military; the least '
   'martial option.')]),
 ('02', 'build', 'Build-Up',
  'Runs longest and gets the least attention. Its only real job is to loop for '
  'ten minutes without becoming irritating.', [
  ('Construction', 30, 'mechanical',
   'Mechanical, purposeful pulse. Named for the job, and it does behave like a '
   'work loop.'),
  ('Rural Industry', 15, 'low-key',
   'Light and workmanlike, very low drama. The best "nothing has happened yet" '
   'option.'),
  ('Drop Point', 30, 'tense',
   'Mid-tempo and holding something back. More forward motion than Rural '
   'Industry.'),
  ('Guerilla Tactics', 15, 'tense',
   'Stealthy and ticking. Closer to tension than to work — may fight the '
   'calm of an opening base.')]),
 ('03', 'combat', 'Combat',
  'Sits under gunfire. <code>COMBAT_DUCK_T</code> already pulls the mining loop '
  'down during firefights, so whatever goes here will duck too — it can '
  'afford to be busy.', [
  ('Battle Ready', 8, 'driving',
   'Compact and driving. At 1:17 it is the shortest full track here, so the '
   'least to cut down.'),
  ('Action Strike', 20, 'aggressive',
   'Percussive and aggressive, with real attack on the hits.'),
  ('Beginning of Conflict', 15, 'building',
   'Starts tense and opens into action — a natural fit if you ever cue '
   'music on first contact.'),
  ('Desert Conflict', 25, 'militaristic',
   'Heavy brass stabs, the most overtly militaristic of the five.'),
  ('Night Attack', 25, 'nocturnal',
   'Darker and lower-energy. Worth hearing with v101 in mind — this is the '
   'one that would suit the night phase.')]),
 ('04', 'victory', 'Victory Sting',
  'Plays once, for a few seconds. You are auditioning the <em>first four '
  'bars</em> here, not the track.', [
  ('Fanfare X', 0, 'fanfare',
   'Brass fanfare, 0:39 whole. Closest thing here to a ready-made sting.'),
  ('Celebration', 15, 'celebratory',
   'Upbeat and bright; would need trimming to its opening phrase.'),
  ('Fireworks', 25, 'celebratory',
   'Big and showy. Most sting-like material is buried past the intro.')]),
]

BARS = 70            # waveform resolution on the page


def ffmpeg():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit('need ffmpeg: pip install imageio-ffmpeg')
    return imageio_ffmpeg.get_ffmpeg_exe()


def fetch(name):
    """Download one track from the mirror. Names carry spaces; quote them."""
    dst = os.path.join(ORIG, name + '.mp3')
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    url = MIRROR + '/' + urllib.parse.quote(name + '.mp3')
    with urllib.request.urlopen(url, timeout=120) as r, open(dst, 'wb') as f:
        f.write(r.read())
    return dst


def cut(ff, name, off):
    """One 30s excerpt at the shipping encode, faded so it starts and ends clean."""
    dst = os.path.join(PREV, name + '.mp3')
    subprocess.run([ff, '-y', '-loglevel', 'error', '-ss', str(off),
                    '-t', str(PREVIEW_SEC), '-i', os.path.join(ORIG, name + '.mp3'),
                    '-ac', '1', '-ar', '44100', '-b:a', BITRATE,
                    '-af', 'afade=t=in:d=0.4,afade=t=out:st=%.1f:d=0.6' % (PREVIEW_SEC - 0.6),
                    dst], check=True)
    return dst


def waveform(ff, path):
    """RMS per bucket, normalised and expanded.

    RMS and NOT peak: a mastered track's peak is near-constant across every
    bucket, so a peak waveform draws as a solid block and tells the eye
    nothing. RMS follows the arrangement, and the exponent pushes quiet
    passages down far enough to actually read as quiet.
    """
    raw = subprocess.run([ff, '-loglevel', 'error', '-i', path, '-ac', '1',
                          '-ar', '8000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    n = len(raw) // 2
    s = struct.unpack('<%dh' % n, raw[:n * 2])
    step = max(1, n // BARS)
    rms = []
    for i in range(BARS):
        c = s[i * step:(i + 1) * step] or (0,)
        rms.append(math.sqrt(sum(x * x for x in c) / len(c)) / 32768)
    m = max(rms) or 1
    return [round(min(1, (x / m) ** 1.45), 3) for x in rms]


def main():
    do_fetch = '--no-fetch' not in sys.argv
    for d in (ORIG, PREV):
        os.makedirs(d, exist_ok=True)
    ff = ffmpeg()
    data = {'slots': []}
    for num, key, title, need, tracks in SLOTS:
        out = []
        for name, off, tag, note in tracks:
            if do_fetch:
                fetch(name)
            p = cut(ff, name, off)
            out.append({'name': name, 'note': note, 'tag': tag, 'off': off,
                        'bytes': os.path.getsize(p), 'peaks': waveform(ff, p),
                        'b64': base64.b64encode(open(p, 'rb').read()).decode()})
            print('  %-24s %6.0f kB' % (name, os.path.getsize(p) / 1000))
        data['slots'].append({'n': num, 'k': key, 't': title, 'need': need,
                              'tracks': out})
    tpl = open(TPL, encoding='utf-8').read()
    open(OUT, 'w', encoding='utf-8').write(
        tpl.replace('/*__DATA__*/', json.dumps(data, separators=(',', ':'))))
    print('\nwrote %s (%.2f MB)' % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == '__main__':
    main()
