#!/usr/bin/env python3
"""Build basemap.js (North America land, state/province lines, lakes, cities)
from Natural Earth GeoJSON. Run once; the output does not change with the weather.

  python3 build_basemap.py <natural-earth-vector/geojson dir>
"""
import json, sys, math, os

src = sys.argv[1] if len(sys.argv) > 1 else 'geo/natural-earth-vector/geojson'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'basemap.js')


def dp(points, tol):
    """Douglas-Peucker on a list of (x, y)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if d2 == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                dist = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if dist > best:
                best, bi = dist, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(points, keep) if k]


def flat(points):
    o = []
    for x, y in points:
        o.append(round(x, 2))
        o.append(round(y, 2))
    return o


def ring_area(r):
    s = 0.0
    for i in range(len(r) - 1):
        s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return abs(s) / 2


def want_ring(r):
    xs = [p[0] for p in r]
    ys = [p[1] for p in r]
    if max(ys) < 7:
        return False
    if min(xs) < -48 and max(xs) < -8:
        return True
    if min(xs) >= 170 and 45 < max(ys) < 72:   # far Aleutians / Chukotka tip
        return True
    return False


def polys(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


def lines(geom):
    if geom['type'] == 'LineString':
        return [geom['coordinates']]
    if geom['type'] == 'MultiLineString':
        return geom['coordinates']
    return []


land = []
for f in json.load(open(os.path.join(src, 'ne_50m_admin_0_countries.geojson')))['features']:
    p = f['properties']
    rings = []
    for poly in polys(f['geometry']):
        outer = poly[0]
        if not want_ring(outer):
            continue
        if ring_area(outer) < 0.02:
            continue
        s = dp(outer, 0.025)
        if len(s) >= 4:
            rings.append(flat(s))
    if rings:
        land.append({'n': p.get('NAME') or p.get('ADMIN'), 'a': p.get('ADM0_A3'), 'r': rings})

states = []
for fn, names, tol in (('ne_50m_admin_1_states_provinces_lines.geojson', ('United States of America', 'Canada'), 0.025),
                       ('ne_10m_admin_1_states_provinces_lines.geojson', ('Mexico',), 0.04)):
    for f in json.load(open(os.path.join(src, fn)))['features']:
        p = {k.lower(): v for k, v in f['properties'].items()}
        if p.get('adm0_name') not in names:
            continue
        for ln in lines(f['geometry']):
            s = dp(ln, tol)
            if len(s) >= 2:
                states.append(flat(s))

lakes = []
for f in json.load(open(os.path.join(src, 'ne_50m_lakes.geojson')))['features']:
    for poly in polys(f['geometry']):
        outer = poly[0]
        if not want_ring(outer) or ring_area(outer) < 0.12:
            continue
        s = dp(outer, 0.025)
        if len(s) >= 4:
            lakes.append(flat(s))

cities = []
for f in json.load(open(os.path.join(src, 'ne_50m_populated_places_simple.geojson')))['features']:
    p = f['properties']
    lon, lat = p['longitude'], p['latitude']
    if not (-172 < lon < -50 and 8 < lat < 72):
        continue
    if p.get('adm0name') not in ('United States of America', 'Canada', 'Mexico', 'Cuba', 'The Bahamas', 'Puerto Rico',
                                 'Dominican Republic', 'Jamaica', 'Haiti'):
        continue
    cities.append([p['name'], round(lon, 2), round(lat, 2), int(p.get('scalerank', 9)), int(p.get('pop_max') or 0)])
cities.sort(key=lambda c: (c[3], -c[4]))

data = {'land': land, 'states': states, 'lakes': lakes, 'cities': cities}
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('window.BASEMAP=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
npts = sum(len(r) // 2 for c in land for r in c['r'])
print('countries', len(land), 'land pts', npts, 'state lines', len(states), 'pts', sum(len(s) // 2 for s in states),
      'lakes', len(lakes), 'cities', len(cities), 'bytes', os.path.getsize(out))
