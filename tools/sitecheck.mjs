// Desk site check: loads this desk in a headless browser on phone and desktop and fails if a page script throws,
// the page does not finish loading, its data is stale, or the shared "Desks" row is missing a sister site.
//   Live (scheduled GitHub check): node tools/sitecheck.mjs --live
//   Local, before a push:          node tools/sitecheck.mjs        (serves this folder; outside data requests are blocked,
//                                                                   so checks that need live feeds are skipped)
// © 2026 Randy Barnhill. All rights reserved.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DESK from './sitecheck.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE = path.join(ROOT, DESK.serveDir || '.');
const live = process.argv.includes('--live');
let pw;
try { pw = await import('playwright-core'); } catch { pw = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'); }
const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '/usr/bin/google-chrome');
const BASE = live ? DESK.url : 'http://desk.test';
const SISTERS = ['thewireandledger.com', 'global-outbreak-desk', 'hazard-desk', 'the-ledger-of-the-earth', 'overhead-now'];

async function route(page) {
  if (live) return;
  await page.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.origin !== BASE) return r.abort();
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html'; else if (!path.extname(p)) p += '.html';
    const f = path.join(SERVE, p);
    if (!f.startsWith(SERVE) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'not found' });
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream';
    return r.fulfill({ body: fs.readFileSync(f), contentType: type });
  });
}

const problems = [], notes = [];
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const page = await browser.newPage({ viewport: vp });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await route(page);
  const resp = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!resp || resp.status() !== 200) problems.push(`${name}: HTTP ${resp && resp.status()}`);
  const checks = DESK.checks.filter(c => live || !c.liveOnly);
  const deadline = Date.now() + (live ? 45000 : 10000);
  let failed = checks;
  while (Date.now() < deadline) {
    failed = [];
    for (const c of checks) { const v = await page.evaluate(c.test).catch(e => 'error: ' + e.message); if (v !== true) failed.push([c.label, v]); }
    if (!failed.length) break;
    await page.waitForTimeout(1500);
  }
  failed.forEach(([label, v]) => problems.push(`${name}: ${label}${typeof v === 'string' ? ' (' + v + ')' : ''}`));
  const links = await page.evaluate(() => [...document.querySelectorAll('.bdk a, .bdk .bdk-here')].map(a => a.href || location.href));
  const missing = SISTERS.filter(s => !links.some(h => h.includes(s)) && !DESK.url.includes(s));
  if (missing.length) problems.push(`${name}: Desks row is missing ${missing.join(', ')}`);
  errs.filter(e => live || !(DESK.localIgnore || []).some(re => re.test(e))).forEach(e => problems.push(`${name}: page script error: ${e}`));
  if (name === 'desktop' && DESK.fresh && (live || !DESK.fresh.liveOnly)) {
    const f = await page.evaluate(DESK.fresh.read).catch(() => null);
    const ageH = f ? (Date.now() - Date.parse(f)) / 3600e3 : NaN;
    if (!isFinite(ageH)) problems.push(`Data date could not be read (${DESK.fresh.label})`);
    else if (ageH > DESK.fresh.maxHours) problems.push(`Data is stale: ${DESK.fresh.label} is ${(ageH / 24).toFixed(1)} days old (limit ${(DESK.fresh.maxHours / 24).toFixed(1)} days); the refresh may have stopped`);
    else notes.push(`${DESK.fresh.label}: ${(ageH / 24).toFixed(1)} days old`);
  }
  await page.close();
}
for (const p of DESK.extraPages || []) {
  const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await route(page);
  const r = await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!r || r.status() !== 200) problems.push(`${p}: HTTP ${r && r.status()}`);
  errs.filter(e => live || !(DESK.localIgnore || []).some(re => re.test(e))).forEach(e => problems.push(`${p}: page script error: ${e}`));
  await page.close();
}
await browser.close();
if (problems.length) { console.log(`${DESK.name}: PROBLEMS\n` + problems.map(p => '  - ' + p).join('\n')); process.exit(1); }
console.log(`${DESK.name}: check passed on phone and desktop${live ? ' (live site)' : ' (local copy; live-feed checks skipped)'}${notes.length ? '. ' + notes.join('; ') : ''}`);
