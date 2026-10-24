// /api/world — the World view's slow-changing feeds, gathered server-side (these agencies don't allow browser reads).
//   storms     GDACS (UN / European Commission) tropical cyclones now active: alert level, track (observed and forecast),
//              wind zones (60 / 90 / 120 km/h)
//   floods     GDACS floods now active at Orange or Red alert
//   gdacsVolc  GDACS volcano alerts now active
//   eruptions  Smithsonian Global Volcanism Program: eruptions it lists as continuing
//   usVolc     USGS volcanoes above normal (alert level / aviation color code)
//   tsunami    the latest message from each NOAA tsunami warning center (Palmer, Alaska and Honolulu)
//   fires      GDACS wildfires now burning (from the EU's Global Wildfire Information System), with burned area
//   space      NOAA Space Weather Prediction Center: storm scales now and 3-day outlook, latest Kp, recent alerts, aurora oval
//   calderas   the big caldera systems ("supervolcanoes"): live status from the agency that monitors each one, where a feed exists
// Earthquakes and sea temperature are read straight from USGS and NASA in the browser.
// © 2026 Randy Barnhill. All rights reserved.
const UA = 'Mozilla/5.0 (compatible; HazardDesk/1.0; +https://hazard-desk.vercel.app)';
async function get(url, as = 'json', timeout = 12000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: as === 'json' ? await r.json() : await r.text() };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
}
const r2 = x => Math.round(x * 100) / 100;
// Keep every n-th vertex so a ring stays under max points (wind zones arrive with thousands).
function thin(ring, max = 160) { if (ring.length <= max) return ring.map(p => [r2(p[0]), r2(p[1])]); const s = Math.ceil(ring.length / max), out = []; for (let i = 0; i < ring.length; i += s) out.push([r2(ring[i][0]), r2(ring[i][1])]); out.push([r2(ring[0][0]), r2(ring[0][1])]); return out; }
function rings(g) { if (!g) return []; if (g.type === 'Polygon') return [g.coordinates[0]]; if (g.type === 'MultiPolygon') return g.coordinates.map(p => p[0]); return []; }
const GD = 'https://www.gdacs.org/gdacsapi/api';
async function gdacsList(types, levels, from) {
  const q = new URLSearchParams({ eventlist: types, alertlevel: levels, fromdate: from, pageSize: '100' });
  const r = await get(`${GD}/events/geteventlist/SEARCH?${q}`);
  return r.ok && r.data && r.data.features ? r.data.features.filter(f => f.properties.iscurrent === 'true') : (r.ok ? [] : null);
}
function base(f) {
  const p = f.properties, c = f.geometry && f.geometry.coordinates;
  return { id: p.eventtype + p.eventid, name: (p.eventname || p.name || '').trim(), title: p.name, alert: p.alertlevel, countries: p.country || '', from: p.fromdate, to: p.todate,
    lon: c ? c[0] : null, lat: c ? c[1] : null, severity: p.severitydata && p.severitydata.severitytext || '', report: p.url && p.url.report, source: p.source || '' };
}
async function storm(f) {
  const s = base(f), g = await get(f.properties.url.geometry, 'json', 15000);
  s.track = []; s.zones = [];
  if (g.ok && g.data && g.data.features) {
    for (const x of g.data.features) {
      const p = x.properties || {}, cls = p.Class || '';
      if (cls.startsWith('Line_') && x.geometry && x.geometry.type === 'LineString') s.track.push({ f: !!p.forecast, c: p.polygonlabel || '', pts: x.geometry.coordinates.map(q => [r2(q[0]), r2(q[1])]) });
      else if (/^Poly_(Green|Orange|Red)$/.test(cls)) rings(x.geometry).forEach(r => s.zones.push({ lvl: cls.slice(5), kmh: p.polygonlabel || '', r: thin(r) }));
    }
  }
  return s;
}
// NOAA tsunami centers: the newest message from each, with its threat section.
async function tsunami(code) {
  const r = await get(`https://www.tsunami.gov/events/xml/${code}Atom.xml`, 'text');
  if (!r.ok) return { center: code, ok: false };
  const x = r.data, tag = (s, t) => { const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(s); return m ? m[1].trim() : ''; };
  const entry = tag(x, 'entry');
  let bulletin = (/href="([^"]+\.txt)"/.exec(entry || '') || [])[1];
  if (!bulletin) { const rel = (/rel="related"[^>]*href="([^"]+?)\s*"/.exec(x) || [])[1]; if (rel) { const m = /(.*\/)([A-Z]{4}\d{2})\/?$/.exec(rel.trim()); if (m) bulletin = m[1] + m[2] + '/' + m[2] + '.txt'; } }
  const out = { center: code === 'PAAQ' ? 'National Tsunami Warning Center (Palmer, Alaska)' : 'Pacific Tsunami Warning Center (Honolulu)', ok: true,
    title: tag(entry || x, 'title').replace(/\s+/g, ' '), updated: tag(entry || x, 'updated') || tag(x, 'updated'), region: entry ? tag(entry, 'title') : '',
    lat: entry ? parseFloat(tag(entry, 'geo:lat')) : null, lon: entry ? parseFloat(tag(entry, 'geo:long')) : null, bulletin: bulletin || null,
    category: ((/<strong>Category:<\/strong>\s*([^<]+)/.exec(entry || '') || [])[1] || '').trim() };
  if (bulletin) {
    const t = await get(bulletin, 'text');
    if (t.ok) {
      const txt = t.data.replace(/\r/g, '');
      const sec = name => { const m = new RegExp(name + '[^\\n]*\\n-+\\n([\\s\\S]*?)(\\n\\n\\n|\\n[A-Z][A-Z .]+\\n-{4,})').exec(txt); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
      out.threat = sec('TSUNAMI THREAT FORECAST') || sec('TSUNAMI THREAT');
      out.evaluation = sec('EVALUATION');
      out.final = /FINAL|NO LONGER A TSUNAMI THREAT|THREAT FROM THIS EARTHQUAKE HAS NOW PASSED|NOT EXPECTED TO GENERATE A TSUNAMI|NO TSUNAMI DANGER/i.test(txt);
      const mag = /MAGNITUDE\s+([\d.]+)/.exec(txt), loc = /LOCATION\s+([^\n]+)/.exec(txt), co = /COORDINATES\s+([\d.]+)\s+(NORTH|SOUTH)\s+([\d.]+)\s+(EAST|WEST)/.exec(txt);
      if (mag) out.magnitude = +mag[1];
      if (loc && !out.region) out.region = loc[1].trim();
      if (co && out.lat == null) { out.lat = +co[1] * (co[2] === 'SOUTH' ? -1 : 1); out.lon = +co[3] * (co[4] === 'WEST' ? -1 : 1); }
      const kind = /TSUNAMI (WARNING|ADVISORY|WATCH)\b/.exec(txt.slice(0, 600)) || /(Warning|Advisory|Watch|Threat)/.exec(out.category || '');
      out.level = out.final ? 'Final' : /HAZARDOUS TSUNAMI WAVES ARE FORECAST|TSUNAMI THREAT FORECAST\.\.\.[\s\S]{0,40}\n[\s\S]{0,200}METERS/.test(txt) && !out.final ? 'Threat' : kind ? kind[1][0] + kind[1].slice(1).toLowerCase() : (out.final ? 'Final / information' : 'Information');
    }
  }
  return out;
}
async function gdacsPaged(type, levels, from, pages = 3) {
  const out = []; let any = false;
  for (let n = 1; n <= pages; n++) {
    const q = new URLSearchParams({ eventlist: type, alertlevel: levels, fromdate: from, pageSize: '100', pageNumber: String(n) });
    const r = await get(`${GD}/events/geteventlist/SEARCH?${q}`);
    if (!r.ok || !r.data || !r.data.features) break;
    any = true; out.push(...r.data.features.filter(f => f.properties.iscurrent === 'true'));
    if (r.data.features.length < 100) break;
  }
  return any ? out : null;
}
function fire(f) { const b = base(f), sd = f.properties.severitydata || {}; b.ha = sd.severityunit === 'ha' ? +sd.severity || null : null; b.source = f.properties.source || ''; return b; }
// NOAA SWPC. Scales: R radio blackouts, S solar radiation storms, G geomagnetic storms (0 none to 5 extreme).
const SW = 'https://services.swpc.noaa.gov';
async function space() {
  const [sc, kp, al, ov] = await Promise.all([get(`${SW}/products/noaa-scales.json`), get(`${SW}/products/noaa-planetary-k-index.json`), get(`${SW}/products/alerts.json`), get(`${SW}/json/ovation_aurora_latest.json`, 'json', 15000)]);
  if (!sc.ok && !kp.ok && !al.ok) return null;
  const out = { scales: null, kp: null, alerts: [], aurora: null };
  if (sc.ok && sc.data) {
    const d = k => sc.data[k] || null, now = d('0');
    out.scales = { now: now && { time: `${now.DateStamp}T${now.TimeStamp}Z`, R: +now.R.Scale || 0, S: +now.S.Scale || 0, G: +now.G.Scale || 0 },
      ahead: ['1', '2', '3'].map(d).filter(Boolean).map(x => ({ day: x.DateStamp, rMinor: x.R.MinorProb != null ? +x.R.MinorProb : null, rMajor: x.R.MajorProb != null ? +x.R.MajorProb : null, s: x.S.Prob != null ? +x.S.Prob : null, G: x.G.Scale != null ? +x.G.Scale : null })) };
  }
  if (kp.ok && Array.isArray(kp.data) && kp.data.length) {
    const rows = kp.data.map(r => Array.isArray(r) ? { time_tag: r[0], Kp: +r[1] } : r).filter(r => r && r.time_tag && !isNaN(+r.Kp));
    const last = rows[rows.length - 1]; if (last) out.kp = { time: last.time_tag.replace(' ', 'T') + (/Z$/.test(last.time_tag) ? '' : 'Z'), value: +last.Kp, max24: Math.max(...rows.slice(-8).map(r => +r.Kp)) };
  }
  if (al.ok && Array.isArray(al.data)) {
    const cut = Date.now() - 48 * 3600e3;
    out.alerts = al.data.map(a => { const t = Date.parse(String(a.issue_datetime).replace(' ', 'T') + 'Z'); const m = String(a.message || '').replace(/\r/g, '');
      const head = (/^(ALERT|WARNING|WATCH|SUMMARY|CONTINUED ALERT|EXTENDED WARNING|CANCEL[A-Z ]*):[^\n]*/m.exec(m) || [''])[0].trim();
      const scale = (/NOAA Scale:\s*([^\n]+)/.exec(m) || [])[1]; return { t, head, scale: scale ? scale.trim() : null, code: (/Message Code:\s*(\w+)/.exec(m) || [])[1] || '' }; })
      .filter(a => a.t > cut && a.head).sort((a, b) => b.t - a.t).slice(0, 8).map(a => ({ ...a, t: new Date(a.t).toISOString() }));
  }
  if (ov.ok && ov.data && Array.isArray(ov.data.coordinates)) {
    // Probability (percent) of visible aurora overhead, 1-degree grid. Keep cells at 10% or more.
    out.aurora = { observed: ov.data['Observation Time'], forecast: ov.data['Forecast Time'], cells: ov.data.coordinates.filter(c => c[2] >= 10).map(c => [c[0] > 180 ? c[0] - 360 : c[0], c[1], c[2]]) };
  }
  return out;
}
// Caldera systems with very large past eruptions. Facts here are fixed history; status is read live, and only from the agency that monitors each.
const CALDERAS = [
  { id: 'yellowstone', name: 'Yellowstone', country: 'United States', lat: 44.43, lon: -110.67, vei: 8, past: 'Largest eruption 2.1 million years ago, about 2,450 cubic km (USGS)', usgs: 'Yellowstone', agency: 'USGS Yellowstone Volcano Observatory', url: 'https://www.usgs.gov/volcanoes/yellowstone' },
  { id: 'longvalley', name: 'Long Valley Caldera', country: 'United States', lat: 37.7, lon: -118.87, vei: 7, past: 'Caldera formed in the Bishop Tuff eruption about 760,000 years ago (USGS)', usgs: 'Long Valley Caldera', agency: 'USGS California Volcano Observatory', url: 'https://www.usgs.gov/volcanoes/long-valley-caldera' },
  { id: 'valles', name: 'Valles Caldera', country: 'United States', lat: 35.87, lon: -106.57, vei: 7, past: 'Caldera formed about 1.25 million years ago', agency: 'USGS (not on the alert-level list)', url: 'https://volcano.si.edu/volcano.cfm?vn=327040' },
  { id: 'toba', name: 'Toba', country: 'Indonesia', lat: 2.58, lon: 98.83, vei: 8, past: 'Supereruption about 74,000 years ago', agency: 'Indonesia\'s volcano agency (PVMBG)', url: 'https://volcano.si.edu/volcano.cfm?vn=261090' },
  { id: 'taupo', name: 'Taupō', country: 'New Zealand', lat: -38.78, lon: 175.9, vei: 8, past: 'The most recent supereruption on Earth, about 1,130 cubic km (USGS)', geonet: 'taupo', agency: 'GeoNet (GNS Science)', url: 'https://www.geonet.org.nz/volcano/taupo' },
  { id: 'campi', name: 'Campi Flegrei', country: 'Italy', lat: 40.827, lon: 14.139, vei: 7, past: 'Campanian Ignimbrite eruption about 39,000 years ago; the ground has been rising (bradyseism) since 2005', ingv: true, agency: 'INGV Vesuvius Observatory', url: 'https://www.ov.ingv.it/' },
  { id: 'aira', name: 'Aira (Sakurajima)', country: 'Japan', lat: 31.59, lon: 130.66, vei: 7, past: 'Caldera formed about 30,000 years ago; Sakurajima volcano grows inside it', gvp: 282080, agency: 'Japan Meteorological Agency', url: 'https://volcano.si.edu/volcano.cfm?vn=282080' },
];
async function calderas(eruptions) {
  const [mon, gn, ingv] = await Promise.all([
    get('https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes'),
    get('https://api.geonet.org.nz/volcano/val', 'json', 10000),
    get('https://webservices.ingv.it/fdsnws/event/1/query?' + new URLSearchParams({ lat: '40.827', lon: '14.139', maxradius: '0.1', starttime: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19), format: 'text' }), 'text', 12000)]);
  return CALDERAS.map(c => {
    const o = { ...c, status: null };
    if (c.usgs && mon.ok && Array.isArray(mon.data)) { const v = mon.data.find(x => x.volcano_name === c.usgs); if (v) o.status = { level: v.alert_level, color: v.color_code, since: v.sent_utc, src: 'USGS', url: v.notice_url }; }
    if (c.geonet && gn.ok && gn.data && gn.data.features) { const v = gn.data.features.find(f => f.properties.volcanoID === c.geonet); if (v) o.status = { level: 'Volcanic Alert Level ' + v.properties.level, color: String(v.properties.acc || '').toUpperCase(), text: v.properties.activity, src: 'GeoNet' }; }
    if (c.gvp && eruptions) { const e = eruptions.find(x => +x.num === c.gvp); o.erupting = e ? { since: e.since } : false; }
    if (c.ingv) { if (ingv.ok && typeof ingv.data === 'string') { const rows = ingv.data.split('\n').filter(l => l && l[0] !== '#').map(l => l.split('|')); const mags = rows.map(r => +r[10]).filter(m => !isNaN(m)); o.quakes7d = { n: rows.length, max: mags.length ? Math.max(...mags) : null, src: 'INGV' }; } else if (ingv.status === 204) o.quakes7d = { n: 0, max: null, src: 'INGV' }; }
    return o;
  });
}
module.exports = async function handler(req, res) {
  const now = Date.now(), from = new Date(now - 21 * 864e5).toISOString().slice(0, 10);
  const [tcs, floods, vol, gvp, us, t1, t2, wf, sp] = await Promise.all([
    gdacsList('TC', 'Green;Orange;Red', from),
    gdacsList('FL', 'Orange;Red', from),
    gdacsList('VO', 'Green;Orange;Red', from),
    get('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?' + new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'GVP-VOTW:E3WebApp_Eruptions1960', outputFormat: 'application/json', CQL_FILTER: "ContinuingEruption='True'" }), 'json', 15000),
    get('https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes'),
    tsunami('PAAQ'), tsunami('PHEB'), gdacsPaged('WF', 'Green;Orange;Red', from), space()]);
  const storms = tcs ? await Promise.all(tcs.slice(0, 12).map(storm)) : null;
  const eruptions = gvp.ok && gvp.data && gvp.data.features ? gvp.data.features.map(f => { const p = f.properties; return { name: p.VolcanoName, num: p.VolcanoNumber, lat: p.LatitudeDecimal, lon: p.LongitudeDecimal, since: p.StartDate, vei: p.ExplosivityIndexMax }; })
    .filter((v, i, a) => a.findIndex(w => w.num === v.num) === i) : null;
  let usVolc = us.ok && Array.isArray(us.data) ? us.data.map(v => ({ name: v.volcano_name, vnum: +v.vnum, alert: v.alert_level, color: v.color_code, obs: v.obs_abbr, updated: v.sent_utc || null, url: v.notice_url || null })) : null;
  // USGS lists no coordinates; the Smithsonian volcano number (vnum) gives them.
  if (usVolc && usVolc.length) {
    const ids = usVolc.map(v => v.vnum).filter(Boolean).join(',');
    const loc = await get('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?' + new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes', outputFormat: 'application/json', CQL_FILTER: `Volcano_Number IN (${ids})` }), 'json', 12000);
    const at = {}; if (loc.ok && loc.data && loc.data.features) loc.data.features.forEach(f => { at[f.properties.Volcano_Number] = f.geometry && f.geometry.coordinates; });
    usVolc = usVolc.map(v => ({ ...v, lon: at[v.vnum] ? at[v.vnum][0] : null, lat: at[v.vnum] ? at[v.vnum][1] : null }));
  }
  const cal = await calderas(eruptions);
  const body = { generated: new Date(now).toISOString(), storms, fires: wf ? wf.map(fire) : null, space: sp, calderas: cal, floods: floods ? floods.map(base) : null, gdacsVolc: vol ? vol.map(base) : null, eruptions, usVolc, tsunami: [t1, t2],
    sources: { gdacs: 'https://www.gdacs.org/', gvp: 'https://volcano.si.edu/', usgs: 'https://volcanoes.usgs.gov/', tsunami: 'https://www.tsunami.gov/', swpc: 'https://www.swpc.noaa.gov/', gwis: 'https://gwis.jrc.ec.europa.eu/' } };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
};
