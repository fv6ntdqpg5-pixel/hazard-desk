// What a healthy North America Hazard Desk looks like. Warnings, quakes and storms load live in the reader's browser;
// the saved snapshot is only a fallback, so the live check insists on "Live".
export default {
  name: 'North America Hazard Desk', url: 'https://hazard-desk.vercel.app',
  checks: [
    { label: 'map legend drawn', test: () => (document.getElementById('legend')?.children.length || 0) >= 3 },
    { label: '"Right now" panel filled', test: () => (document.getElementById('now')?.children.length || 0) >= 1 },
    { label: 'map drawn', test: () => { const c = document.querySelector('#mapbox canvas, #map canvas, canvas'); if (!c || c.width < 100) return 'no canvas'; let g; try { g = c.getContext('2d'); } catch (e) { return true; } if (!g) return true; let d; try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return true; } /* a canvas locked by outside imagery (radar) has been drawn on */ let n = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n++; return n > 20 ? true : 'canvas is blank'; } },
    { label: 'live feeds connected (not the saved snapshot)', liveOnly: true, test: () => { const t = document.getElementById('modeText')?.textContent || ''; return /^Live/.test(t) ? true : 'mode: ' + t + '; ' + (document.getElementById('stamp')?.textContent || ''); } },
    { label: 'weather warning feed responding', liveOnly: true, test: () => { const t = document.getElementById('stamp')?.textContent || ''; return !/not responding/i.test(t) ? true : t; } }
  ]
};
