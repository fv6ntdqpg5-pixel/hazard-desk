// Builds places.js: the town list behind "Your spot" search. No outside service is called when a reader searches;
// the list ships with the site and is loaded only when the search box is first used.
// Source: GeoNames (CC BY 4.0) cities with 1,000+ people, through the npm package all-the-cities 3.1.0.
// Run: npm i all-the-cities (in any folder), then  node tools/build_places.mjs <path to that node_modules>
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const cities = require((process.argv[2] || './node_modules') + '/all-the-cities');
const CA = { '01': 'AB', '02': 'BC', '03': 'MB', '04': 'NB', '05': 'NL', '07': 'NS', '08': 'ON', '09': 'PE', '10': 'QC', '11': 'SK', '12': 'YT', '13': 'NT', '14': 'NU' };
const MX = { '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur', '04': 'Campeche', '05': 'Chiapas', '06': 'Chihuahua', '07': 'Coahuila', '08': 'Colima', '09': 'Mexico City', '10': 'Durango', '11': 'Guanajuato', '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco', '15': 'México State', '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit', '19': 'Nuevo León', '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro', '23': 'Quintana Roo', '24': 'San Luis Potosí', '25': 'Sinaloa', '26': 'Sonora', '27': 'Tabasco', '28': 'Tamaulipas', '29': 'Tlaxcala', '30': 'Veracruz', '31': 'Yucatán', '32': 'Zacatecas' };
const OTHER = { PR: 'Puerto Rico', VI: 'U.S. Virgin Islands', BS: 'Bahamas', CU: 'Cuba', JM: 'Jamaica', HT: 'Haiti', DO: 'Dominican Republic', BM: 'Bermuda', KY: 'Cayman Islands', TC: 'Turks and Caicos', BZ: 'Belize', GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panama', AG: 'Antigua and Barbuda', BB: 'Barbados', DM: 'Dominica', GD: 'Grenada', KN: 'St. Kitts and Nevis', LC: 'St. Lucia', VC: 'St. Vincent', TT: 'Trinidad and Tobago', AI: 'Anguilla', VG: 'British Virgin Islands', GP: 'Guadeloupe', MQ: 'Martinique', SX: 'Sint Maarten', MF: 'St. Martin', AW: 'Aruba', CW: 'Curaçao' };
const regs = [], regIdx = {}, rows = [];
const reg = (label, cc) => { const k = label + '|' + cc; if (!(k in regIdx)) { regIdx[k] = regs.length; regs.push([label, cc]); } return regIdx[k]; };
const keep = cities.filter(c => c.country === 'US' || c.country === 'CA' || (c.country === 'MX' && c.population >= 5000) || (OTHER[c.country] && c.population >= 5000))
  .sort((a, b) => b.population - a.population);
const seen = new Set();
for (const c of keep) {
  let label;
  if (c.country === 'US') { if (!/^[A-Z]{2}$/.test(c.adminCode)) continue; label = c.adminCode; }
  else if (c.country === 'CA') { if (!CA[c.adminCode]) continue; label = CA[c.adminCode] + ', Canada'; }
  else if (c.country === 'MX') { if (!MX[c.adminCode]) continue; label = MX[c.adminCode] + ', Mexico'; }
  else label = OTHER[c.country];
  const name = c.name.replace(/[|\n]/g, ' ').trim(), [lon, lat] = c.loc.coordinates;
  const key = name + '|' + label; if (seen.has(key)) continue; seen.add(key); // the larger of two same-named places in one state
  rows.push(name + '|' + reg(label, c.country).toString(36) + '|' + lat.toFixed(2) + '|' + lon.toFixed(2));
}
fs.writeFileSync(new URL('../places.js', import.meta.url), '/* Town list for "Your spot". Source: GeoNames (CC BY 4.0), cities of 1,000+ people. Built by tools/build_places.mjs. */\nwindow.HAZ_PLACES=' + JSON.stringify({ r: regs, d: rows.join('\n') }) + ';\n');
console.log(rows.length, 'places,', regs.length, 'regions');
