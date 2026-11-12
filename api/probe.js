// TEMPORARY research probe on a preview branch only. Never merge to main. Reads api.weather.gov so the page can be built
// against real answers (the build workspace cannot reach the Weather Service).
module.exports = async (req, res) => {
  const u = String((req.query && req.query.u) || '');
  if (!/^https:\/\/api\.weather\.gov\//.test(u)) { res.statusCode = 400; return res.end('host'); }
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'WeatherDesk research (hazard-desk.vercel.app)', Accept: 'application/geo+json' }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ status: r.status, cors: r.headers.get('access-control-allow-origin'), text: t.slice(0, +((req.query && req.query.max) || 60000)) }));
  } catch (e) { res.statusCode = 502; res.end(String(e && e.message || e)); }
};
