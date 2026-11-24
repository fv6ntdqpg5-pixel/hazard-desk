// Tests for /api/airpath (air paths for the Iowa detonation watch). Run: node tools/test_airpath.js
// © 2026 Randy Barnhill. All rights reserved.
const A = require('../api/airpath.js');
let pass = 0, fail = 0;
const ok = (name, c) => { if (c) pass++; else { fail++; console.log('FAIL: ' + name); } };
const close = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const ev = { planned: '2026-11-25T15:00:00Z', hours: 6, site: { lat: 40.8, lon: -91.25 } };
  const steady = (spd, from) => async pts => pts.map(() => ({ A: [[spd, from], [spd, from]], B: [[spd, from], [spd, from]], C: [[spd * 2, from], [spd * 2, from]] }));
  // A steady 10 m/s wind FROM the west carries air east, 36 km (22 miles) an hour, and does not change its latitude.
  let p = await A.airPaths(steady(10, 270), ev);
  ok('three heights', p.length === 3 && p.map(x => x.id).join('') === 'ABC');
  ok('one point an hour', p[0].pts.length === 7 && p[0].hours === 6);
  ok('a west wind moves the air east', p[0].pts[1].lon > -91.25 && close(p[0].pts[1].lat, 40.8, 0.001));
  ok('10 m/s is 22 miles in an hour', close(p[0].pts[1].miles, 22, 1) && p[0].pts[1].dir === 'E');
  ok('six hours at 10 m/s is 134 miles', close(p[0].pts[6].miles, 134, 2));
  ok('twice the wind goes twice as far', close(p[2].pts[1].miles, 45, 1));
  ok('starting wind is reported in mph and words', p[0].start.mph === 22 && p[0].start.from === 'W' && p[0].start.toward === 'E');
  // FROM the north carries air south.
  p = await A.airPaths(steady(5, 0), ev);
  ok('a north wind moves the air south', p[0].pts[1].lat < 40.8 && close(p[0].pts[1].lon, -91.25, 0.001) && p[0].pts[1].dir === 'S');
  // The wind turns during the hour: the path uses both ends, so it ends between due east and due south.
  p = await A.airPaths(async pts => pts.map(() => ({ A: [[10, 270], [10, 0]], B: null, C: [[NaN, 0], [1, 1]] })), { ...ev, hours: 1 });
  ok('a turning wind is followed through the hour', p[0].pts[1].dir === 'SE');
  ok('a height with no wind data has no path, and nothing is made up', p[1].hours === 0 && p[1].pts.length === 1 && p[2].hours === 0);
  // The forecast stops answering part-way: the path stops there.
  let calls = 0;
  p = await A.airPaths(async pts => (++calls > 2 ? null : pts.map(() => ({ A: [[10, 270], [10, 270]], B: [[10, 270], [10, 270]], C: [[10, 270], [10, 270]] }))), ev);
  ok('a path stops where the forecast stops', p.every(x => x.hours === 2));
  ok('each point is placed against a named city', /, (IA|IL|MO)$/.test(p[0].pts[1].near.city) && p[0].pts[1].near.miles >= 0);
  ok('nearest city: the plant is next to Burlington, Iowa', A.near(40.8, -91.25).city === 'Burlington, IA');
  ok('the lead figure is arithmetic on the reported weight', Math.round(A.EVENT.facts.leadAzideLb * A.EVENT.facts.leadFraction / 100) * 100 === 6800);
  ok('the planned time is 9:00 AM Central on Nov 25, 2026', new Date(A.EVENT.planned).toLocaleString('en-US', { timeZone: 'America/Chicago' }) === '11/25/2026, 9:00:00 AM');
  console.log(`airpath: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
})();
