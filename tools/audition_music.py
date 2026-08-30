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
mirror aggregating several CC0 libraries, and tracks here are drawn from its
freemusicarchive.org/ and chosic.com/ folders by full path.

THE PROVENANCE IS UNUSUALLY GOOD FOR MOST OF THIS SET, and that is why it is
this set. Twelve of the seventeen are the UNITED STATES ARMY OLD GUARD FIFE AND
DRUM CORPS - a serving US Army unit, so its recordings are works of the US
federal government and public domain in the US under 17 USC 105, independent of
anything the mirror asserts. Three more (Edison Military Band, Arthur Pryor's
Band, Prince's Orchestra) are acoustic-era sides from roughly 1900-1920, long
out of copyright. That matters because the game is one double-clickable file
with no credits screen: a licence needing attribution has nowhere to put it.

STILL CONFIRM BEFORE SHIPPING. A community-aggregated mirror is evidence, not
provenance, and this script cannot check a licence for you. The argument above
is about the RECORDINGS' origin, not about the mirror - verify the track you
choose at its original source.

WHY THE PREVIEW IS MONO 96k AND NOT THE SOURCE QUALITY. Every asset rides
inside plastic-warfare.html as base64, at 4/3 of its own size, and music is
~100x longer than a gunshot: the whole 35-file sound set is 444 kB, while ONE
30-second stereo loop at 128k is 960 kB. Auditioning at source quality would
mean choosing a track you cannot afford. The preview IS the shipping encode,
so what you hear is what the game would sound like, and the page's per-track
"adds N to the game" figure is that file's own byte count times 4/3.

Needs: pip install imageio-ffmpeg   (bundles an ffmpeg binary; no apt, no PATH)
"""
import base64, json, math, os, re, struct, subprocess, sys
import urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WORK = os.path.join(ROOT, 'build', 'audition')
ORIG, PREV = os.path.join(WORK, 'orig'), os.path.join(WORK, 'prev')
TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audition_page.tpl.html')
OUT = os.path.join(WORK, 'soundtrack-audition.html')

MIRROR = 'https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main'

# The two long repeated path prefixes, spelled once.
OG = 'freemusicarchive.org/The United States Army Old Guard Fife and Drum Corps - '
OGC = ('chosic.com/The_United_States_Army_Old_Guard_Fife_and_Drum_Corps_-_')
FMA = 'freemusicarchive.org/'

PREVIEW_SEC = 30
BITRATE = '96k'      # mono; the shipping target, see the module docstring

# The four slots are a match's own arc, which is why they are ordered and
# numbered on the page. Each track:
#   (display name, path under MIRROR, start-offset seconds, tag, note, warn)
# The offset skips the intro so the excerpt lands in the BODY of the piece -
# a track judged on its fade-in is a track judged wrong. `warn` is an amber
# flag on the card, used for the acoustic-era sides: they are 20+ dB down above
# 10 kHz against the modern recordings here, which is audible as 78rpm hiss and
# is a taste decision, not a defect.
PHONO = 'Acoustic-era recording — will sound like a 78rpm record.'

SLOTS = [
 ('01', 'setup', 'Setup & Menu',
  'Plays before a shot is fired. This is the track that has to say '
  '<em>toy soldiers</em> in five seconds.', [
  ("The President's March", OG + 'The Presidents March.mp3', 25, 'fife & drum',
   'Old Guard Fife and Drum Corps. A period march played by the real thing — '
   'fifes carrying the tune over a rope-tension snare line.', ''),
  ('Brandywine Quickstep', OG + 'Brandywine Quickstep from the Minstrel Boy Show.mp3',
   15, 'quickstep',
   'A quickstep is the marching tempo proper — brisker than the President\'s '
   'March and built to be walked to.', ''),
  ("Sousa's Thunderer March", FMA + "Free Tim - Sousa's Thunderer March.mp3", 20,
   'sousa',
   'The only Sousa in the mirror. Full concert band rather than fife and drum, '
   'and a modern recording.', ''),
  ('Uncle Sammy March', FMA + 'Edison Military Band - Uncle Sammy March.mp3', 20,
   'phonograph',
   'The Edison Military Band, c.1905 — an actual period military band on an '
   'actual period recording.', PHONO)]),
 ('02', 'build', 'Build-Up',
  'Runs longest and gets the least attention. Its only real job is to loop for '
  'ten minutes without becoming irritating — so these lean on fifes rather '
  'than on the full drum line.', [
  ("Fisher's Hornpipe", OGC + '11_-_Fife_Feature_Fishers_Hornpipe_VariationGuilderoy'
   'Red_Haired_Boy(chosic.com).mp3', 20, 'fife feature',
   'A fife feature: the drums drop back and the fifes carry it. Lighter than '
   'anything in the setup slot.', ''),
  ('Lowlands Away', OGC + '04_-_Fife_Feature_Lowlands_AwayTrenton_from_the_George_'
   'Washington_Show(chosic.com).mp3', 12, 'fife feature',
   'The other fife feature, and the slower of the two — closer to an air than '
   'to a march.', ''),
  ('Paddy on the Handcar', OG + 'Paddy on the Handcar from the Minstrel Boy Show.mp3',
   8, 'jaunty',
   'Bright and quick, and at 0:51 the shortest Old Guard track here.', ''),
  ('Water Music', OG + 'Water Music from the Handel Show.mp3', 15, 'stately',
   'Handel on fifes and bugles. Stately and low-drama — the least martial '
   'thing the corps plays.', ''),
  ('Children Toy March', FMA + "Prince's Orchestra - Children Toy March.mp3", 20,
   'phonograph',
   'Named, in 1912, for exactly this game. A toy march played straight, on a '
   'record old enough to be a toy itself.', PHONO)]),
 ('03', 'combat', 'Combat',
  'Sits under gunfire. <code>COMBAT_DUCK_T</code> already pulls the mining loop '
  'down during firefights, so whatever goes here will duck too — which is '
  'why the drum features belong in this slot and not in the menu.', [
  ('The Rage of Cornwallis', OG + 'Drum Feature: The Rage of Cornwallis from the '
   'George Washington Show.mp3', 18, 'drum feature',
   'A drum feature — no fifes at all, just the marching line. The most '
   'literal "battle" cue in the set.', ''),
  ('Generations', OG + 'Drum Feature: Generations from the Simple Gifts Show.mp3',
   15, 'drum feature',
   'The other drum feature, and the busier of the two.', ''),
  ('Three Little Drummers', OG + 'Three Little Drummers from the George Washington '
   'Show.mp3', 8, 'drums',
   'Drums with a tune over them. At 1:04 it is short enough to loop with '
   'little cutting.', ''),
  ("Soldier's Farewell / March of War", OGC + '07_-_Soldiers_Farewell_Fanfare'
   'MontezumaMarch_of_WarWindsor_Park(chosic.com).mp3', 20, 'medley',
   'A four-part medley that runs fanfare into "March of War" — the most '
   'dramatic thing the corps plays.', ''),
  ('General Mixup March', FMA + 'Arthur Pryors Band - General Mixup March.mp3', 18,
   'phonograph',
   "Arthur Pryor was Sousa's trombone soloist and took his own band out in "
   '1903. Driving, and genuinely of the period.', PHONO)]),
 ('04', 'victory', 'Victory Sting',
  'Plays once, for a few seconds. You are auditioning the <em>first four '
  'bars</em> here, not the track.', [
  ('ERAFNAF Fanfare', OG + 'ERAFNAF Fanfare.mp3', 0, 'fanfare',
   'A bugle fanfare, 0:36 whole, and it opens cold. The closest thing here to '
   'a ready-made sting.', ''),
  ('Pezel Twist', OG + 'Bugle Feature: Pezel Twist from Warlike Musick.mp3', 5,
   'bugle',
   'A bugle feature from a 17th-century tower-music collection literally '
   'titled "Warlike Musick".', ''),
  ('Reveille & Drum Call', OGC + '09_-_Reveille_VariationDrum_CallSlow_Scotch'
   'Quick_ScotchYankee_DoodleMont(chosic.com).mp3', 10, 'calls',
   'Field calls — reveille, drum call, and Yankee Doodle. Bugle calls are '
   'signals by design, so this is the one to raid for short cues.', '')]),
]

BARS = 70            # waveform resolution on the page


def ffmpeg():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit('need ffmpeg: pip install imageio-ffmpeg')
    return imageio_ffmpeg.get_ffmpeg_exe()


def slug(name):
    """A display name is free text; a filename is not.

    "Soldier's Farewell / March of War" is a perfectly good title and a broken
    path - the slash makes it a directory. Everything on disk is keyed through
    here so a title can stay readable without constraining the filesystem.
    """
    return re.sub(r'[^\w .,&\'-]', '_', name).strip()


def fetch(name, src):
    """Download one track. Paths carry spaces, colons and apostrophes; quote them.

    Saved under the DISPLAY name, not the source filename: two folders in the
    mirror hold the same recording under different naming conventions, and the
    display name is the one thing guaranteed unique across the table.
    """
    dst = os.path.join(ORIG, slug(name) + '.mp3')
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    url = MIRROR + '/' + urllib.parse.quote(src)
    with urllib.request.urlopen(url, timeout=180) as r, open(dst, 'wb') as f:
        f.write(r.read())
    return dst


def cut(ff, name, off):
    """One 30s excerpt at the shipping encode, faded so it starts and ends clean."""
    dst = os.path.join(PREV, slug(name) + '.mp3')
    subprocess.run([ff, '-y', '-loglevel', 'error', '-ss', str(off),
                    '-t', str(PREVIEW_SEC), '-i', os.path.join(ORIG, slug(name) + '.mp3'),
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
        for name, src, off, tag, note, warn in tracks:
            if do_fetch:
                fetch(name, src)
            p = cut(ff, name, off)
            out.append({'name': name, 'note': note, 'tag': tag, 'off': off,
                        'warn': warn,
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
