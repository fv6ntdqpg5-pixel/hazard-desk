// TEMPORARY research probe on a preview branch only. Never merge to main. Reads api.weather.gov so the page can be built
// against real answers (the build workspace cannot reach the Weather Service). ?u=url|url|... ; the padding makes the
// answer large enough that the reading tool saves it to a file.
module.exports = async (req, res) => {
  const urls = String((req.query && req.query.u) || '').split('|').filter(u => /^https:\/\/api\.weather\.gov\//.test(u)).slice(0, 8);
  if (!urls.length) { res.statusCode = 400; return res.end('host'); }
  const out = await Promise.all(urls.map(async u => { try {
    const r = await fetch(u, { headers: { 'User-Agent': 'WeatherDesk research (hazard-desk.vercel.app)', Accept: 'application/geo+json' }, signal: AbortSignal.timeout(25000) });
    return { u, status: r.status, text: await r.text() };
  } catch (e) { return { u, error: String(e && e.message || e) }; } }));
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ out, pad: 'x'.repeat(320000) }));
};
