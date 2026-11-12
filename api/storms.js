// /api/storms — the National Hurricane Center's own words and numbers for every active storm, read server-side
// (the browser cannot read nhc.noaa.gov directly). For each storm in NHC's CurrentStorms.json:
//   from the Public Advisory (TCP):          headline, where it is, top winds in mph, movement, the coastal watches and
//                                            warnings section and the hazards section, exactly as issued
//   from the Forecast/Advisory (TCM):        position, winds, pressure, wind radii now (34 / 50 / 64 kt by quadrant, in
//                                            nautical miles), every forecast point with its own wind radii, next advisory time
// Nothing here is computed or estimated; it is NHC text turned into fields. The page joins it to the forecast cone it
// already reads from NOAA's map service.
// © 2026 Randy Barnhill. All rights reserved.
const UA = 'Mozilla/5.0 (compatible; WeatherDesk/1.0; +https://hazard-desk.vercel.app)';
async function get(url, as = 'json', timeout = 12000, tries = 2) {
  for (let i = 1; i < tries; i++) { const r = await get(url, as, timeout, 1); if (r.ok || (r.status && r.status < 500 && r.status !== 429)) return r; await new Promise(z => setTimeout(z, 700)); }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: as === 'json' ? await r.json() : await r.text() };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
}
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

// NHC serves its text products inside a <pre> on a web page; a plain-text product passes through unchanged.
function productText(html) {
  const m = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html || '');
  return (m ? m[1] : String(html || '')).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n'); // NHC pads blank lines with a space; without this a section never ends
}
function radiiIn(block) { const o = {}; const re = /^(\d\d) KT\.+\s*(\d+)NE\s+(\d+)SE\s+(\d+)SW\s+(\d+)NW/gm; let m; while ((m = re.exec(block))) o[m[1]] = [+m[2], +m[3], +m[4], +m[5]]; return o; }

// Forecast/Advisory (TCM)
function parseTcm(text) {
  const o = { track: [], radii: {} };
  let m = /^(.+?) FORECAST\/ADVISORY NUMBER\s+(\S+)/m.exec(text); if (m) { o.title = m[1].toLowerCase().replace(/(^|[\s-])([a-z])/g, (x, a, b) => a + b.toUpperCase()); o.adv = m[2]; }
  m = /^(\d{4}) UTC \w{3} (\w{3}) (\d\d) (\d{4})/m.exec(text); if (!m || !(m[2] in MONTHS)) return null;
  const iy = +m[4], imo = MONTHS[m[2]], iday = +m[3], issue = Date.UTC(iy, imo, iday, +m[1].slice(0, 2), +m[1].slice(2));
  o.issued = issue;
  // a forecast day number smaller than the issue day by more than 15 has rolled into the next month, as NHC writes only the day
  const at = (day, hhmm) => Date.UTC(iy, day < iday - 15 ? imo + 1 : imo, day, +hhmm.slice(0, 2), +hhmm.slice(2));
  const ll = (lat, ns, lon, ew) => [parseFloat(lat) * (ns === 'N' ? 1 : -1), parseFloat(lon) * (ew === 'E' ? 1 : -1)];
  m = /CENTER LOCATED NEAR\s+([\d.]+)([NS])\s+([\d.]+)([EW]) AT (\d\d)\/(\d{4})Z/.exec(text); if (!m) return null;
  const p0 = ll(m[1], m[2], m[3], m[4]); o.lat = p0[0]; o.lon = p0[1]; const t0 = at(+m[5], m[6]); o.advTime = t0;
  m = /PRESENT MOVEMENT TOWARD THE ([A-Z-]+) OR\s+(\d+) DEGREES AT\s+(\d+) KT/.exec(text); if (m) { o.dirText = m[1].replace(/-/g, ' ').toLowerCase(); o.dir = +m[2]; o.spd = +m[3]; }
  m = /MINIMUM CENTRAL PRESSURE\s+(\d+) MB/.exec(text); if (m) o.mslp = +m[1];
  m = /MAX SUSTAINED WINDS\s+(\d+) KT WITH GUSTS TO\s+(\d+) KT/.exec(text); if (!m) return null; o.wind = +m[1]; o.gust = +m[2];
  o.radii = radiiIn(text.split(/(?:FORECAST|OUTLOOK) VALID/)[0]);
  o.track.push({ t: t0, lat: o.lat, lon: o.lon, wind: o.wind, gust: o.gust, radii: o.radii });
  const re = /(?:FORECAST|OUTLOOK) VALID (\d\d)\/(\d{4})Z\s+([\d.]+)([NS])\s+([\d.]+)([EW])[^\n]*\nMAX WIND\s+(\d+) KT\.\.\.GUSTS\s+(\d+) KT\.?((?:\n\d\d KT[^\n]*)*)/g;
  while ((m = re.exec(text))) { const p = ll(m[3], m[4], m[5], m[6]); o.track.push({ t: at(+m[1], m[2]), lat: p[0], lon: p[1], wind: +m[7], gust: +m[8], radii: radiiIn(m[9] || '') }); }
  m = /(?:FORECAST|OUTLOOK) VALID (\d\d)\/(\d{4})Z\.\.\.DISSIPATED/.exec(text); if (m) o.dissipated = at(+m[1], m[2]);
  m = /NEXT ADVISORY AT (\d\d)\/(\d{4})Z/.exec(text); if (m) o.nextAdv = at(+m[1], m[2]);
  return o;
}

// 'ABOUT 280 MI...455 KM SW OF THE SOUTHERN TIP OF BAJA CALIFORNIA' -> readable case; no word is added or changed
function smartCase(s) {
  s = s.replace(/\s*\.\.\.\s*(\d+ KM)/, ' ($1)');
  const small = new Set(['OF', 'THE', 'AND', 'MI', 'KM', 'ABOUT', 'TO', 'DE', 'DEL', 'LA']), dirs = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NNE', 'NNW', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW']);
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return s.split(' ').map((w, i) => { const core = w.replace(/^[()]+|[()]+$/g, ''); if (dirs.has(core)) return w; if (small.has(core)) return i ? w.toLowerCase() : cap(w); return w.startsWith('(') ? w.toLowerCase() : cap(w); }).join(' ');
}
// one titled section of the advisory (a title line, a line of dashes, then text up to the next titled section)
function section(text, title) {
  const m = new RegExp('(?:^|\\n)' + title + '[^\\n]*\\n-+\\n([\\s\\S]*?)(?:\\n{2,}[A-Z][A-Z ]+\\n-+\\n|\\n\\$\\$|$)').exec(text);
  if (!m) return [];
  return m[1].split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}
// Public Advisory (TCP)
function parseTcp(text) {
  const o = {};
  let m = /Advisory Number\s+(\S+)/i.exec(text); if (m) o.adv = m[1];
  m = /(?:^|\n)\.\.\.([\s\S]+?)\.\.\.\s*(?:\n|$)/.exec(text); if (m) o.headline = m[1].replace(/\s*\n\s*/g, ' ').trim();
  m = /^(ABOUT .+?)$/m.exec(text); if (m) o.where = smartCase(m[1].trim());
  m = /MAXIMUM SUSTAINED WINDS\.\.\.(\d+) MPH/.exec(text); if (m) o.mph = +m[1];
  m = /PRESENT MOVEMENT\.\.\.(\w+) OR \d+ DEGREES AT (\d+) MPH/.exec(text); if (m) o.moveText = m[1] + ' at ' + m[2] + ' mph'; else if (/PRESENT MOVEMENT\.\.\.STATIONARY/.test(text)) o.moveText = 'stationary';
  o.watchesParas = section(text, 'WATCHES AND WARNINGS'); o.watches = o.watchesParas.join(' ');
  o.hazardsParas = section(text, 'HAZARDS AFFECTING LAND'); o.hazards = o.hazardsParas.join(' ');
  o.discussionParas = section(text, 'DISCUSSION AND OUTLOOK');
  return o;
}

function parseTcpText(t) { return parseTcp(productText(t)); }
async function storm(s, raw) {
  const tcpUrl = s.publicAdvisory && s.publicAdvisory.url, tcmUrl = (s.forecastAdvisory && s.forecastAdvisory.url) || (tcpUrl ? tcpUrl.replace(/TCP(?=[A-Z]{2}\d\.shtml)/, 'TCM') : null);
  const okUrl = u => /^https:\/\/www\.nhc\.noaa\.gov\//.test(u || '');
  const [a, b] = await Promise.all([okUrl(tcpUrl) ? get(tcpUrl, 'text') : { ok: false }, okUrl(tcmUrl) ? get(tcmUrl, 'text') : { ok: false }]);
  const tcpText = a.ok ? productText(a.data) : '', tcmText = b.ok ? productText(b.data) : '';
  const tcp = tcpText ? parseTcp(tcpText) : null, tcm = tcmText ? parseTcm(tcmText) : null;
  const out = { id: s.id, bin: s.binNumber, name: s.name, cls: s.classification, lat: s.latitudeNumeric, lon: s.longitudeNumeric, wind: +s.intensity || null, mslp: +s.pressure || null,
    dir: s.movementDir, spd: s.movementSpeed, lastUpdate: s.lastUpdate || null, adv: s.publicAdvisory && s.publicAdvisory.advNum ? String(s.publicAdvisory.advNum).replace(/^0+(?=\d)/, '') : null,
    url: (s.forecastGraphics && s.forecastGraphics.url) || 'https://www.nhc.noaa.gov/', tcpUrl: okUrl(tcpUrl) ? tcpUrl : null, tcmUrl: okUrl(tcmUrl) ? tcmUrl : null, tcp, tcm, got: { tcp: !!tcp, tcm: !!tcm } };
  if (raw) { out.rawTcp = tcpText.slice(0, 6000); out.rawTcm = tcmText.slice(0, 6000); out.rawEntry = s; }
  return out;
}

async function handler(req, res) {
  const raw = req.query && req.query.raw === '1';
  const cur = await get('https://www.nhc.noaa.gov/CurrentStorms.json');
  const list = cur.ok && cur.data && Array.isArray(cur.data.activeStorms) ? cur.data.activeStorms : null;
  const storms = list ? await Promise.all(list.slice(0, 12).map(s => storm(s, raw))) : null;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', raw ? 'no-store' : 'public, s-maxage=180, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({ generated: new Date().toISOString(), ok: !!list, error: list ? undefined : (cur.error || cur.status || 'no list'), storms, source: 'https://www.nhc.noaa.gov/' }));
}
module.exports = handler;
module.exports.parseTcm = parseTcm; module.exports.parseTcp = parseTcp; module.exports.productText = productText;
