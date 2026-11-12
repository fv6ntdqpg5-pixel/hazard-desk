// TEMPORARY research probe on a preview branch only. Never merge to main. Reads the weather sources the page is being
// built against (the build workspace cannot reach them). ?u=url|url|... ; padded so the reading tool saves it to a file.
const OK = /^https:\/\/(api\.weather\.gov|api\.weather\.gc\.ca|dd\.weather\.gc\.ca|api\.open-meteo\.com|geocoding-api\.open-meteo\.com|opengeo\.ncep\.noaa\.gov|mesonet\.agron\.iastate\.edu)\//;
module.exports = async (req, res) => {
  const urls = String((req.query && req.query.u) || '').split('|').filter(u => OK.test(u)).slice(0, 8);
  if (!urls.length) { res.statusCode = 400; return res.end('host'); }
  const out = await Promise.all(urls.map(async u => { try {
    const r = await fetch(u, { headers: { 'User-Agent': 'WeatherDesk research (hazard-desk.vercel.app)' }, signal: AbortSignal.timeout(25000) });
    const t = await r.text();
    return { u, status: r.status, cors: r.headers.get('access-control-allow-origin'), type: r.headers.get('content-type'), len: t.length, text: t.slice(0, +((req.query && req.query.max) || 400000)) };
  } catch (e) { return { u, error: String(e && e.message || e) }; } }));
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ out, pad: 'x'.repeat(320000) }));
};
