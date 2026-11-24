// /api/airpath — where the air leaving one place is forecast to go. Built Nov 24, 2026 for the Army's planned detonation of
// degraded lead azide at the Iowa Army Ammunition Plant (Randy: "Can we monitor this blast when it happens and have
// dispersal patterns").
//
// WHAT THIS IS: forward air paths ("trajectories"). A marker is released at the site at the planned time, at three
// heights, and moved along by NOAA's forecast winds (HRRR and GFS, read through open-meteo.com) for 12 hours. Each
// hour the wind is read again at the place the marker has reached; within the hour it is moved in 20-minute steps
// with the wind interpolated in time. The marker stays at its height (no rising or sinking air), which is the main
// simplification against NOAA's own HYSPLIT model.
// WHAT THIS IS NOT: a lead forecast. It says which way and how fast the air moves, nothing about how much lead is in
// it or lands anywhere. That would need how much of the lead becomes airborne dust, the particle sizes and how high
// the cloud rises, none of which is published (the permit papers are partly redacted), and the Army is burying,
// wetting and misting the site to hold dust down. No figure is guessed here ("bad data is no data").
// The facts in EVENT are from the sources listed with it; the one computed figure (pounds of lead) says so.
// © 2026 Randy Barnhill. All rights reserved.
const UA = 'Mozilla/5.0 (compatible; WeatherDesk/1.0; +https://hazard-desk.vercel.app)';
const OM = 'https://api.open-meteo.com/v1/forecast';

const EVENT = {
  id: 'iaaap-2026',
  name: 'Army lead azide detonation, Middletown, Iowa',
  // The plant's published address is 17571 DMC Highway 79, Middletown. The Army has not published where inside the
  // 19,000-acre plant the drums are, so this point is the plant, not the blast.
  site: { lat: 40.80, lon: -91.25, label: 'Iowa Army Ammunition Plant', exact: false },
  planned: '2026-11-25T15:00:00Z',        // 9:00 AM Central, Wednesday Nov 25 (CBS2 Iowa, Nov 23). The Army can move it.
  hours: 12,
  showUntil: '2026-11-28T06:00:00Z',
  facts: {
    drums: 68,
    leadAzideLb: 9500,                    // as reported (PBS NewsHour; some outlets say "nearly five tons")
    leadFraction: 0.711,                  // lead azide, Pb(N3)2: 207.2 of 291.2 by weight
    detonations: 2
  },
  links: [
    ['EPA: measured air, soil and water results', 'https://response.epa.gov/IAAAPleadazide'],
    ['Army: advisory and maps', 'https://www.army.mil/asc#org-iowa-army-ammunition-plant'],
    ['EPA: reducing lead exposure', 'https://www.epa.gov/lead/actions-reduce-potential-lead-exposure']
  ]
};
// Heights the markers ride at. Different dashes and letters on the map, never color alone.
const LEVELS = [
  { id: 'A', label: 'Near the ground', height: '33 ft', spd: 'wind_speed_10m', dir: 'wind_direction_10m' },
  { id: 'B', label: 'Above the treetops', height: '590 ft', spd: 'wind_speed_180m', dir: 'wind_direction_180m' },
  { id: 'C', label: 'Higher up', height: 'about 1,800 ft above the ground', spd: 'wind_speed_925hPa', dir: 'wind_direction_925hPa' }
];
// Cities used only to say where a point is in words (name, state, lat, lon).
const CITIES = [['Burlington', 'IA', 40.81, -91.11], ['Fort Madison', 'IA', 40.63, -91.32], ['Mount Pleasant', 'IA', 40.96, -91.56], ['Keokuk', 'IA', 40.40, -91.38],
  ['Iowa City', 'IA', 41.66, -91.53], ['Ottumwa', 'IA', 41.02, -92.41], ['Davenport', 'IA', 41.52, -90.58], ['Cedar Rapids', 'IA', 41.98, -91.67], ['Des Moines', 'IA', 41.59, -93.62],
  ['Dubuque', 'IA', 42.50, -90.66], ['Monmouth', 'IL', 40.91, -90.65], ['Galesburg', 'IL', 40.95, -90.37], ['Macomb', 'IL', 40.46, -90.67], ['Quincy', 'IL', 39.94, -91.41],
  ['Peoria', 'IL', 40.69, -89.59], ['Springfield', 'IL', 39.80, -89.64], ['Bloomington', 'IL', 40.48, -88.99], ['Rockford', 'IL', 42.27, -89.09], ['Champaign', 'IL', 40.12, -88.24],
  ['Chicago', 'IL', 41.88, -87.63], ['Hannibal', 'MO', 39.71, -91.36], ['Kirksville', 'MO', 40.19, -92.58], ['Columbia', 'MO', 38.95, -92.33], ['St. Louis', 'MO', 38.63, -90.20],
  ['Madison', 'WI', 43.07, -89.40], ['Milwaukee', 'WI', 43.04, -87.91], ['Indianapolis', 'IN', 39.77, -86.16], ['Kansas City', 'MO', 39.10, -94.58], ['Omaha', 'NE', 41.26, -95.93], ['Minneapolis', 'MN', 44.98, -93.27]];

const R = Math.PI / 180, COMP8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function distKm(la1, lo1, la2, lo2) { const a = Math.sin((la2 - la1) * R / 2), b = Math.sin((lo2 - lo1) * R / 2); return 12742 * Math.asin(Math.min(1, Math.sqrt(a * a + Math.cos(la1 * R) * Math.cos(la2 * R) * b * b))); }
function bearing(la1, lo1, la2, lo2) { const y = Math.sin((lo2 - lo1) * R) * Math.cos(la2 * R), x = Math.cos(la1 * R) * Math.sin(la2 * R) - Math.sin(la1 * R) * Math.cos(la2 * R) * Math.cos((lo2 - lo1) * R); return (Math.atan2(y, x) / R + 360) % 360; }
const compass = deg => COMP8[Math.round(deg / 45) % 8];
function near(lat, lon) {
  let best = null;
  CITIES.forEach(c => { const km = distKm(lat, lon, c[2], c[3]); if (!best || km < best.km) best = { city: c[0] + ', ' + c[1], km, dir: compass(bearing(c[2], c[3], lat, lon)) }; });
  return { city: best.city, miles: Math.round(best.km * 0.6214), dir: best.dir };
}
// Wind "from" a direction at a speed (m/s) as east and north parts of the air's own motion.
function uv(speed, from) { const t = (from + 180) * R; return [speed * Math.sin(t), speed * Math.cos(t)]; }
// Move a point for `sec` seconds with wind (u east, v north, m/s).
function step(p, u, v, sec) { return { lat: p.lat + v * sec / 111320, lon: p.lon + u * sec / (111320 * Math.cos(p.lat * R)) }; }

// The paths. windAt(points, hourIso) -> for each point, { A: [[spd0, dir0], [spd1, dir1]], B: ..., C: ... }: the wind at
// the start and end of that hour. Returns null for a level whose wind is missing; that level's path stops there.
async function airPaths(windAt, ev = EVENT, levels = LEVELS) {
  const t0 = Date.parse(ev.planned);
  const out = levels.map(l => ({ id: l.id, label: l.label, height: l.height, pts: [{ t: new Date(t0).toISOString(), lat: ev.site.lat, lon: ev.site.lon }], done: false }));
  for (let h = 0; h < ev.hours; h++) {
    const live = out.filter(o => !o.done); if (!live.length) break;
    const w = await windAt(live.map(o => o.pts[o.pts.length - 1]), new Date(t0 + h * 3600e3).toISOString());
    live.forEach((o, i) => {
      const pair = w && w[i] && w[i][o.id];
      if (!pair || pair.some(x => !x || x[0] == null || x[1] == null || isNaN(x[0]) || isNaN(x[1]))) { o.done = true; return; }
      const a = uv(pair[0][0], pair[0][1]), b = uv(pair[1][0], pair[1][1]);
      let p = o.pts[o.pts.length - 1];
      if (h === 0) o.start = { mph: Math.round(pair[0][0] * 2.23694), from: compass(pair[0][1]), toward: compass(pair[0][1] + 180) };
      for (let k = 0; k < 3; k++) { const f = (k + 0.5) / 3; p = step(p, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 1200); }
      o.pts.push({ t: new Date(t0 + (h + 1) * 3600e3).toISOString(), lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4) });
    });
  }
  out.forEach(o => {
    delete o.done; o.hours = o.pts.length - 1;
    o.pts.forEach((p, i) => { if (i) { p.miles = Math.round(distKm(ev.site.lat, ev.site.lon, p.lat, p.lon) * 0.6214); p.dir = compass(bearing(ev.site.lat, ev.site.lon, p.lat, p.lon)); p.near = near(p.lat, p.lon); } });
  });
  return out;
}

async function get(url) {
  for (let i = 0; i < 2; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(9000) }); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* try once more */ }
  }
  return null;
}
// NOAA forecast winds for several points for one hour and the next (open-meteo.com, model "gfs_seamless": HRRR where it
// reaches, GFS beyond).
async function omWind(points, hourIso) {
  const t = Date.parse(hourIso), hh = ms => new Date(ms).toISOString().slice(0, 13) + ':00';
  const vars = LEVELS.map(l => l.spd + ',' + l.dir).join(',');
  const j = await get(`${OM}?latitude=${points.map(p => p.lat.toFixed(3)).join(',')}&longitude=${points.map(p => p.lon.toFixed(3)).join(',')}&hourly=${vars}&wind_speed_unit=ms&models=gfs_seamless&timezone=GMT&start_hour=${hh(t)}&end_hour=${hh(t + 3600e3)}`);
  if (!j) return null;
  const list = Array.isArray(j) ? j : [j];
  return list.map(x => { const o = {}; const hr = x && x.hourly; LEVELS.forEach(l => { o[l.id] = hr && hr[l.spd] && hr[l.spd].length >= 2 ? [[hr[l.spd][0], hr[l.dir][0]], [hr[l.spd][1], hr[l.dir][1]]] : null; }); return o; });
}

async function handler(req, res) {
  let paths = null, error;
  try { paths = await airPaths(omWind); if (!paths.some(p => p.hours > 0)) { paths = null; error = 'the wind forecast did not answer'; } } catch (e) { error = String(e && e.message || e).slice(0, 120); }
  const f = EVENT.facts;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', paths ? 'public, s-maxage=1200, stale-while-revalidate=3600' : 'public, s-maxage=60');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({
    generated: new Date().toISOString(), ok: !!paths, error,
    event: { id: EVENT.id, name: EVENT.name, site: EVENT.site, planned: EVENT.planned, showUntil: EVENT.showUntil, links: EVENT.links,
      facts: { ...f, leadLb: Math.round(f.leadAzideLb * f.leadFraction / 100) * 100 } },
    paths, model: 'NOAA HRRR and GFS forecast winds, read through open-meteo.com',
    note: 'Paths of the air, not amounts of lead.'
  }));
}
module.exports = handler;
module.exports.airPaths = airPaths; module.exports.uv = uv; module.exports.step = step; module.exports.near = near; module.exports.EVENT = EVENT; module.exports.LEVELS = LEVELS; module.exports.omWind = omWind;
