#!/usr/bin/env python3
"""Build data.js (the snapshot the page falls back to when it cannot fetch live)
from the files in raw/.

  python3 build_data.py [ISO time the raw files were fetched, UTC]

raw/ files and their sources are described in README.md.
"""
import json, re, sys, os, glob
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
MONTHS = {m: i + 1 for i, m in enumerate('JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split())}


def read(name):
    p = os.path.join(RAW, name)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else ''


def rows(name):
    return [l for l in read(name).splitlines() if l.strip() and not l.startswith('#')]


def ms(dt):
    return int(dt.timestamp() * 1000)


def iso_ms(s):
    s = s.strip()
    if not s:
        return None
    if re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\dZ', s):
        s = s[:-1] + ':00+00:00'
    elif s.endswith('Z'):
        s = s[:-1] + '+00:00'
    elif re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d', s):
        s += '+00:00'
    return ms(datetime.fromisoformat(s))


def as_polys(coords):
    """Polygon or MultiPolygon coordinates -> list of polygons (each a list of rings)."""
    d, x = 0, coords
    while isinstance(x, list):
        d += 1
        x = x[0]
    if d == 2:
        return [[coords]]
    if d == 3:
        return [coords]
    if d == 4:
        return coords
    raise ValueError('bad coordinate depth %d' % d)


# ---------------------------------------------------------------- storms
def parse_tcm(text):
    o = {'track': [], 'radii': {}}
    m = re.search(r'^(.+?) FORECAST/ADVISORY NUMBER\s+(\S+)', text, re.M)
    if m:
        o['title'], o['adv'] = m.group(1).title(), m.group(2)
    m = re.search(r'^(\d{4}) UTC \w{3} (\w{3}) (\d\d) (\d{4})', text, re.M)
    issue = datetime(int(m.group(4)), MONTHS[m.group(2)], int(m.group(3)), int(m.group(1)[:2]), int(m.group(1)[2:]),
                     tzinfo=timezone.utc)
    o['advTime'] = ms(issue)

    def at(day, hhmm):
        y, mo = issue.year, issue.month
        if day < issue.day - 15:           # rolled into next month
            mo += 1
            if mo == 13:
                y, mo = y + 1, 1
        return datetime(y, mo, day, int(hhmm[:2]), int(hhmm[2:]), tzinfo=timezone.utc)

    def ll(lat, ns, lon, ew):
        return (float(lat) * (1 if ns == 'N' else -1), float(lon) * (1 if ew == 'E' else -1))

    m = re.search(r'CENTER LOCATED NEAR\s+([\d.]+)([NS])\s+([\d.]+)([EW]) AT (\d\d)/(\d{4})Z', text)
    lat, lon = ll(*m.group(1, 2, 3, 4))
    o['lat'], o['lon'] = lat, lon
    t0 = at(int(m.group(5)), m.group(6))
    m = re.search(r'PRESENT MOVEMENT TOWARD THE ([A-Z-]+) OR\s+(\d+) DEGREES AT\s+(\d+) KT', text)
    if m:
        o['dirText'], o['dir'], o['spd'] = m.group(1).replace('-', ' ').lower(), int(m.group(2)), int(m.group(3))
    m = re.search(r'MINIMUM CENTRAL PRESSURE\s+(\d+) MB', text)
    if m:
        o['mslp'] = int(m.group(1))
    m = re.search(r'MAX SUSTAINED WINDS\s+(\d+) KT WITH GUSTS TO\s+(\d+) KT', text)
    o['wind'], o['gust'] = int(m.group(1)), int(m.group(2))
    head = text.split('FORECAST VALID')[0]
    for m in re.finditer(r'^(\d\d) KT\.+\s*(\d+)NE\s+(\d+)SE\s+(\d+)SW\s+(\d+)NW', head, re.M):
        o['radii'][m.group(1)] = [int(x) for x in m.group(2, 3, 4, 5)]
    o['track'].append({'t': ms(t0), 'lat': lat, 'lon': lon, 'wind': o['wind'], 'gust': o['gust']})
    for m in re.finditer(r'(?:FORECAST|OUTLOOK) VALID (\d\d)/(\d{4})Z\s+([\d.]+)([NS])\s+([\d.]+)([EW])[^\n]*\n'
                         r'MAX WIND\s+(\d+) KT\.\.\.GUSTS\s+(\d+) KT', text):
        la, lo = ll(*m.group(3, 4, 5, 6))
        o['track'].append({'t': ms(at(int(m.group(1)), m.group(2))), 'lat': la, 'lon': lo,
                           'wind': int(m.group(7)), 'gust': int(m.group(8))})
    m = re.search(r'NEXT ADVISORY AT (\d\d)/(\d{4})Z', text)
    if m:
        o['nextAdv'] = ms(at(int(m.group(1)), m.group(2)))
    return o


def smart_case(s):
    """'ABOUT 280 MI...455 KM SW OF THE SOUTHERN TIP OF BAJA CALIFORNIA' -> readable case."""
    s = re.sub(r'\s*\.\.\.\s*(\d+ KM)', r' (\1)', s)
    small = {'OF', 'THE', 'AND', 'MI', 'KM', 'ABOUT', 'TO', 'DE', 'DEL', 'LA'}
    dirs = {'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NNE', 'NNW', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'}
    out = []
    for i, w in enumerate(s.split(' ')):
        core = w.strip('()')
        if core in dirs:
            out.append(w)
        elif core in small:
            out.append(w.lower() if i else w.capitalize())
        else:
            out.append(w.capitalize() if not w.startswith('(') else w.lower())
    return ' '.join(out)


def section(text, title):
    m = re.search(r'^' + re.escape(title) + r'[^\n]*\n-+\n(.*?)(?=\n\n[A-Z][A-Z ]+\n-+\n|\Z)', text, re.S | re.M)
    return re.sub(r'\s*\n\s*', ' ', m.group(1)).strip() if m else ''


def build_storms():
    out = []
    cur = json.loads(read('currentstorms.json') or '{"activeStorms":[]}')
    cones = {}
    for l in rows('cones.txt'):
        sid, adv, coords = l.split('|', 2)
        cones[sid] = as_polys(json.loads(coords))
    for s in cur['activeStorms']:
        sid = s['id']
        o = {'id': sid, 'bin': s.get('binNumber'), 'name': s['name'], 'cls': s['classification'],
             'lat': s['latitudeNumeric'], 'lon': s['longitudeNumeric'], 'wind': int(s['intensity']),
             'mslp': int(s['pressure']), 'dir': s.get('movementDir'), 'advTime': iso_ms(s['lastUpdate']),
             'adv': str(int(s['publicAdvisory']['advNum'])), 'url': s['forecastGraphics']['url'],
             'track': [], 'radii': {}, 'cone': cones.get(sid, [])}
        tcm = read('tcm_%s.txt' % sid)
        if tcm:
            o.update({k: v for k, v in parse_tcm(tcm).items() if v not in (None, '', [], {})})
        tcp = read('tcp_%s.txt' % sid)
        if tcp:
            m = re.search(r'^\.\.\.(.+?)\.\.\.\s*$', tcp, re.S | re.M)
            if m:
                o['headline'] = re.sub(r'\s*\n\s*', ' ', m.group(1)).strip()
            m = re.search(r'^(ABOUT .+?)$', tcp, re.M)
            if m:
                o['where'] = smart_case(m.group(1).strip())
            m = re.search(r'MAXIMUM SUSTAINED WINDS\.\.\.(\d+) MPH', tcp)
            if m:
                o['mph'] = int(m.group(1))
            m = re.search(r'PRESENT MOVEMENT\.\.\.(\w+) OR \d+ DEGREES AT (\d+) MPH', tcp)
            if m:
                o['moveText'] = '%s at %s mph' % (m.group(1), m.group(2))
            o['watches'] = section(tcp, 'WATCHES AND WARNINGS')
            o['hazards'] = section(tcp, 'HAZARDS AFFECTING LAND')
        out.append(o)
    return out


def build_two():
    out = []
    for key, basin in (('at', 'Atlantic, Caribbean and Gulf'), ('ep', 'Eastern Pacific'), ('cp', 'Central Pacific')):
        text = read('two_%s.txt' % key)
        if not text:
            continue
        m = re.search(r'^(\d{3,4} [AP]M \w+ \w{3} \w{3} \d+ \d{4})', text, re.M)
        body = text.split('\n\n', 2)[-1]
        areas = []
        for blk in re.split(r'\n\n', text):
            pm = re.findall(r'\* Formation chance through (48 hours|7 days)\.\.\.(\w+)\.\.\.(?:near )?(\d+) percent', blk)
            if pm:
                lines = blk.strip().split('\n')
                desc = ' '.join(l.strip() for l in lines[1:] if not l.startswith('*'))
                d = {'name': lines[0].rstrip(':'), 'text': desc}
                for win, word, pct in pm:
                    d['p48' if win.startswith('48') else 'p7'] = int(pct)
                areas.append(d)
        quiet = 'not expected during the next 7 days' in text
        out.append({'key': key, 'basin': basin, 'issued': m.group(1) if m else '', 'areas': areas, 'quiet': quiet,
                    'text': text.strip()})
    return out


# ---------------------------------------------------------------- polygons
def build_outlooks():
    out = []
    for l in rows('outlooks.txt'):
        kind, day, label, start, end, issued, coords = l.split('|', 6)
        out.append({'kind': kind, 'day': int(day), 'label': label, 'start': iso_ms(start), 'end': iso_ms(end),
                    'issued': iso_ms(issued), 'polys': as_polys(json.loads(coords.replace('\u2212', '-')))})
    return out


def build_wwa():
    out = []
    for l in rows('wwa.txt'):
        typ, onset, ends, wfo, coords = l.split('|', 4)
        out.append({'type': typ, 'onset': iso_ms(onset), 'ends': iso_ms(ends), 'wfo': wfo,
                    'polys': as_polys(json.loads(coords))})
    return out


# ---------------------------------------------------------------- quakes
def quake_rows(name):
    out = []
    for l in rows(name):
        t, lat, lon, dep, mag, place = l.split('|', 5)
        out.append([iso_ms(t), float(lat), float(lon), float(dep), float(mag), place])
    return out


def build():
    fetched = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    seen, quakes = set(), []
    for q in quake_rows('quakes_na.txt') + quake_rows('quakes_west.txt'):
        k = (q[0] // 60000, round(q[1], 1), round(q[2], 1))
        if k not in seen:
            seen.add(k)
            quakes.append(q)
    quakes.sort(key=lambda q: -q[0])
    ys = json.loads(read('yellowstone.json') or '{}')
    ys['quakes'] = sorted(quake_rows('quakes_yellowstone.txt'), key=lambda q: -q[0])
    hsd = read('snow_hsd.txt')
    snow = {}
    if hsd:
        m = re.search(r'^(\d{3,4} [AP]M \w+ \w{3} \w{3} \d+ \d{4})', hsd, re.M)
        v = re.search(r'^Valid (.+)$', hsd, re.M)
        body = hsd.split(v.group(0))[-1] if v else hsd
        body = re.sub(r'\$\$', '', body).strip()
        snow = {'issued': m.group(1) if m else '', 'valid': v.group(1) if v else '', 'text': body}
    data = {
        'generated': iso_ms(fetched),
        'storms': build_storms(),
        'two': build_two(),
        'outlooks': build_outlooks(),
        'wwa': build_wwa(),
        'quakes': quakes,
        'yellowstone': ys,
        'volcanoes': json.loads(read('volcanoes.json') or '[]'),
        'snow': snow,
    }
    with open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8') as fh:
        fh.write('window.HAZ_SNAPSHOT=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
    print('storms %d (%s) | two %d | outlooks %d | wwa %d | quakes %d | yellowstone quakes %d | volcanoes %d | %d bytes' % (
        len(data['storms']), ', '.join('%s %d pts' % (s['name'], len(s['track'])) for s in data['storms']),
        len(data['two']), len(data['outlooks']), len(data['wwa']), len(quakes), len(ys['quakes']),
        len(data['volcanoes']), os.path.getsize(os.path.join(HERE, 'data.js'))))
    return data


if __name__ == '__main__':
    build()
