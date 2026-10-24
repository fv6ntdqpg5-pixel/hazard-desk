// /api/world — the World view's slow-changing feeds, gathered server-side (these agencies don't allow browser reads).
//   storms     GDACS (UN / European Commission) tropical cyclones now active: alert level, track (observed and forecast),
//              wind zones (60 / 90 / 120 km/h)
//   floods     GDACS floods now active at Orange or Red alert
//   gdacsVolc  GDACS volcano alerts now active
//   eruptions  Smithsonian Global Volcanism Program: eruptions it lists as continuing
//   usVolc     USGS volcanoes above normal (alert level / aviation color code)
//   tsunami    the latest message from each NOAA tsunami warning center (Palmer, Alaska and Honolulu)
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
module.exports = async function handler(req, res) {
  const now = Date.now(), from = new Date(now - 21 * 864e5).toISOString().slice(0, 10);
  const [tcs, floods, vol, gvp, us, t1, t2] = await Promise.all([
    gdacsList('TC', 'Green;Orange;Red', from),
    gdacsList('FL', 'Orange;Red', from),
    gdacsList('VO', 'Green;Orange;Red', from),
    get('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?' + new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'GVP-VOTW:E3WebApp_Eruptions1960', outputFormat: 'application/json', CQL_FILTER: "ContinuingEruption='True'" }), 'json', 15000),
    get('https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes'),
    tsunami('PAAQ'), tsunami('PHEB')]);
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
  const body = { generated: new Date(now).toISOString(), storms, floods: floods ? floods.map(base) : null, gdacsVolc: vol ? vol.map(base) : null, eruptions, usVolc, tsunami: [t1, t2],
    sources: { gdacs: 'https://www.gdacs.org/', gvp: 'https://volcano.si.edu/', usgs: 'https://volcanoes.usgs.gov/', tsunami: 'https://www.tsunami.gov/' } };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
};
