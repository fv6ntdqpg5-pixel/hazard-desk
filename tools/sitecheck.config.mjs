// What a healthy North America Hazard Desk looks like. Warnings, quakes and storms load live in the reader's browser;
// the saved snapshot is only a fallback, so the live check insists on "Live".
export default {
  name: 'North America Hazard Desk', url: 'https://hazard-desk.vercel.app',
  checks: [
    { label: 'map legend drawn', test: () => (document.getElementById('legend')?.children.length || 0) >= 3 },
    { label: '"Right now" panel filled', test: () => (document.getElementById('now')?.children.length || 0) >= 1 },
    { label: 'map drawn', test: () => { const c = document.querySelector('#mapbox canvas, #map canvas, canvas'); return !!c && c.width > 100; } },
    { label: 'live feeds connected (not the saved snapshot)', liveOnly: true, test: () => { const t = document.getElementById('modeText')?.textContent || ''; return /^Live/.test(t) ? true : 'mode: ' + t + '; ' + (document.getElementById('stamp')?.textContent || ''); } },
    { label: 'weather warning feed responding', liveOnly: true, test: () => { const t = document.getElementById('stamp')?.textContent || ''; return !/not responding/i.test(t) ? true : t; } }
  ]
};
