# Hazard Desk: handoff

**Read this first in any new chat.** It is the current picture of the site, the rules it runs by, the decisions behind it,
and what is still open. Last updated **October 24, 2026**. Update the "Decisions" and "Open list" sections whenever
something ships (Randy, Oct 24: "Let's periodically update the handoff notes"). README.md covers the North America page's
feeds in detail; this file covers everything, including the World view.

© 2026 Randy Barnhill. All rights reserved.

---

## 1. Who and what

- **Owner:** Randy Barnhill, engineering technician (never "engineer"), Nokomis, FL. Built openly with AI (Claude); say so.
- **Site:** https://hazard-desk.vercel.app, repo `fv6ntdqpg5-pixel/hazard-desk` (public), Vercel project `hazard-desk`
  (team `fv6ntdqpg5-pixels-projects`, Vercel Pro).
- **Two pages:**
  - `/` **North America Hazard Desk** (the default; opens first). Hurricanes, tornado/severe/flood warnings, radar,
    SPC/WPC outlooks, fire weather, snow, earthquakes, volcanoes. Live feeds read in the browser.
  - `/world.html` **World Hazard Desk** (an option, via the North America | World toggle under the title). Live Oct 24.
- **Sister desks** (cross-linked by the BDK nav block between `<!--BDK-->` and `<!--/BDK-->`): The Wire & Ledger
  (`global-unrest-desk`), Global Outbreak Desk, Earth Desk (`the-ledger-of-the-earth`), Overhead Now.

## 2. Standing rules (Randy's)

1. **Bad data is no data.** Real agency data only; label gaps as gaps; never invent or "illustrate."
2. **Preview before live** for anything visible: push a branch, Vercel builds
   `hazard-desk-git-<branch>-fv6ntdqpg5-pixels-projects.vercel.app`; merge to `main` only after Randy says "Go".
3. **Ask where the gaps are before building.**
4. **Commits** as `Randy Barnhill <279122844+fv6ntdqpg5-pixel@users.noreply.github.com>` with the Claude co-author trailer.
5. Footer `© 2026 Randy Barnhill. All rights reserved. Built with AI.`; proprietary `LICENSE`.
6. "Not an official warning service" stays on both pages.

## 3. How it is built

- Plain files. Edit `page.html` (North America) or `world_page.html` (World), then `python3 build_site.py`, which writes
  `index.html` and `world.html` (both generated; never edit by hand). `world.html` reuses page.html's stylesheet and BDK block.
- `tools/check.sh` (pre-push hook) rebuilds and **fails if index.html is out of date**, then runs `tools/sitecheck.mjs`.
  Commit the rebuilt files before running it, or it reverts index.html.
- `.github/workflows/site-check.yml` runs the site check on a schedule.
- **World map engine** is borrowed from the Outbreak Desk: Mercator-like `proj()` (y × 0.86), `world-countries.js`
  (Natural Earth borders), pan/pinch/wheel zoom, wrap-around drawing (`wrapDraw`).

### World view data

| Layer / panel | Source | Read where |
|---|---|---|
| Tropical storms (track observed/forecast, 60/90/120 km/h wind zones, alert level) | GDACS (UN/EC), tracks from JTWC/NHC | `/api/world` |
| Floods (Orange/Red only), volcano alerts | GDACS | `/api/world` |
| Wildfires (~5,000 ha and up, burned area) | EU GWIS via GDACS `WF` (paged, up to 300) | `/api/world` |
| Erupting volcanoes | Smithsonian GVP WFS, `ContinuingEruption='True'` | `/api/world` |
| US volcano alert levels | USGS HANS `getElevatedVolcanoes` (coords from GVP Holocene layer) | `/api/world` |
| Tsunami messages | NOAA tsunami.gov Atom feeds PAAQ (Palmer) + PHEB (Honolulu) and bulletin text | `/api/world` |
| Space weather (R/S/G scales, 3-day outlook, Kp, NOAA messages 48 h), aurora oval (≥10%) | NOAA SWPC JSON products | `/api/world` |
| Giant calderas panel | USGS `getMonitoredVolcanoes` (Yellowstone, Long Valley), GeoNet VAL (Taupō), INGV FDSN quakes 7 d within 0.1° (Campi Flegrei), GVP continuing eruption (Aira/Sakurajima). Toba and Valles: no feed, says so | `/api/world` |
| Earthquakes M4.5+ 7 days | USGS `4.5_week.geojson` | browser |
| Sea temperature (Temperature / Vs. normal) | NASA GIBS WMS, GHRSST MUR L4, date today−1 with fallback to −4 | browser |

`api/world.js` (CommonJS) caches at the edge 5 min (`s-maxage=300, stale-while-revalidate=900`) and retries each feed
once on a timeout/5xx/429 (GDACS occasionally drops one of several parallel calls). The caldera eruption facts in
`CALDERAS` are fixed history checked against USGS (Yellowstone 2.1 Ma / 2,450 km³; Long Valley ~760 ka; Valles ~1.25 Ma;
Taupō most recent supereruption ~1,130 km³), INGV (Campi Flegrei uplift since 2005) and Smithsonian/Wikipedia (Toba ~74 ka,
Aira ~30 ka, Campanian Ignimbrite ~39 ka).

## 4. Decisions

| Date | Decision | Why |
|---|---|---|
| Oct 24 | World view as a separate page; North America stays the default, World is the option | Randy: "NA is the default"; NA projection and NA-only layers (radar, NWS warnings, outlooks) untouched |
| Oct 24 | World page states coverage is thinner than NA (no free worldwide warnings/radar/outlooks) | Honesty about gaps |
| Oct 24 | Storm winds shown in km/h and mph; GDACS text shown as published | US audience; don't reword agency text |
| Oct 24 | Finished tsunami messages labeled "Final"; only non-final Warning/Advisory/Watch/Threat within 24 h counts as active (red banner + pulsing ring) | An old cancelled message read "Warning" |
| Oct 24 | Group 2 live: wildfires, space weather + aurora button, giant caldera panel | Randy "Go" 5:20 pm |
| Oct 24 | Calderas panel includes VEI 7 systems, labeled as such; "none of these is a forecast" | Only Yellowstone, Toba, Taupō had VEI 8 |
| Oct 24 | Wildfires from GDACS (no key); NASA FIRMS detections not added | FIRMS needs a free key Randy would add in Vercel; offered as an option |

## 5. Open list

1. **NASA FIRMS fire detections** (every hotspot, not just big fires): needs `FIRMS_MAP_KEY` in Vercel; aggregate
   server-side to a grid (a world day of VIIRS is tens of thousands of rows).
2. Campi Flegrei official alert level (Italian Civil Protection) has no machine-readable feed; Toba (PVMBG) and Valles
   likewise. Revisit if a feed appears.
3. Possible: merge NA and World into one map engine (large refactor; only if Randy wants one map).
4. World page has no snapshot fallback (`data.js` is NA-only); if `/api/world` fails the lists say "not reachable".

## 6. Gotchas

- The Claude workspace cannot reach USGS, NASA, GDACS etc. directly. Research goes through the `probe-gn` preview branch of
  `global-unrest-desk` (`api/probe.js`, host allowlist; push with `--no-verify`; never merge). Read protected previews with
  the Vercel MCP `web_fetch_vercel_url`; big answers land in a tool-results file (parse `json.load(f)['text']`).
- Local screenshots: serve files by routing in Playwright and fulfil `/api/world` from a saved copy; USGS/NASA requests
  fail locally (blocked), which is expected.
- `.sw` is the layer-chip swatch class; don't reuse it (space weather boxes are `.swc`).
- Saved layer choices live in localStorage `worlddesk`; new layers merge into saved state by key.

- **Oct 25: "Built by Randy Barnhill" credit line live** (Randy: self-marketing). Small line under the Desks bar on every desk (class `rbby`, just after `<!--/BDK-->`; on Hazard World it sits right after `<!--BDK-->` because build_site.py copies only the BDK block). It links to the About the Builder page at https://www.thewireandledger.com/builder (bio, the five desks as a portfolio, "Work with me", Email button; the address is assembled in script against scrapers). On The Wire & Ledger the line sits under the tagline.

## Oct 27, 2026: World map markers (live Oct 27)
- `wrapDraw` now draws one copy of each point (the copy nearest the map's middle). Before, points near the dateline
  (Taupō, Pacific quakes) showed twice on the full-world view, one copy cut in half at the edge.
- Caldera rings scale with zoom (radius 4.5 to 9 px, `view.k*3.3`) so Yellowstone, Long Valley and Valles don't pile up
  on a phone; VEI 8 calderas draw last so Yellowstone is never covered. Desktop size unchanged.
