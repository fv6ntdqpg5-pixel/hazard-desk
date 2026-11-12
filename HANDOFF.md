# Weather Desk (formerly Hazard Desk): handoff

**Read this first in any new chat.** It is the current picture of the site, the rules it runs by, the decisions behind it,
and what is still open. Last updated **November 11, 2026**. Update the "Decisions" and "Open list" sections whenever
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

## 4b. "Your spot" (LIVE Nov 11, 2026 on Randy's Go)

- Randy, Nov 11: focus on the Hazard Desk next. Location first ("if a hurricane is coming that person wants to know
  everything about it"); the page stays continent-wide by default and people zoom in.
- `#spot` panel between the tornado banner and "Right now". Set a spot three ways: device location, town search, or tap
  the map. Stored in localStorage `hazdesk.spot` {lat, lon (2 decimals), name, cc}; never sent anywhere.
- Town search runs on `places.js` (20,388 places: all US and Canadian GeoNames places of 1,000+, Mexico and the
  Caribbean/Central America at 5,000+), loaded only on first use. Built by `tools/build_places.mjs` from the npm package
  all-the-cities 3.1.0 (GeoNames, CC BY 4.0; credited in the footer). No geocoding service is called.
- The panel (`renderSpot`) uses only feeds the page already reads: warnings covering the point and warnings within about
  40 miles (`distPolys`, with a projected arrival time from the warning's own motion, `etaAt`); every active storm with
  distance and bearing, cone in/out, closest forecast approach, the forecast track as a table of distances, wind-field
  reach on the reader's side, NHC watch and hazard text; SPC/WPC outlook for three days (`cityRisks`); quakes within
  300 km; elevated volcanoes within 500 km.
- Honesty rules built in: in snapshot mode it says it cannot tell what is in effect now; if the warning feed is stale it
  says so; outside the US it says NWS warnings stop at the border and links ECCC or SMN.
- Known gaps: (1) live storms carry wind radii and NHC watch/hazard text only when the saved snapshot holds the same
  advisory, so on a new storm those lines are absent; reading them live from NHC is the next step. (2) No ZIP code
  search yet. (3) River flood and marine warnings are not in the mapped set. (4) Tested against the saved snapshot with
  the clock set back; not yet seen with live feeds (the workspace cannot reach them) or on a real phone.

## 4c. One world map, map-first dark layout, renamed Weather Desk (LIVE Nov 11, 2026 on Randy's Go)

- Randy, Nov 11: "The map is still a little weak. Thinking just a global map, no reason for the switch." He chose a flat
  map over a globe (county-level accuracy, radar and warning outlines).
- `page.html` is now the only page. `world_page.html` and `world.html` are deleted; `vercel.json` forwards `/world.html`
  and `/world` to `/`. `build_site.py` builds `index.html` only. Randy, Nov 11: "Change it to weather instead of hazard desk." Title, H1 and this site's nav label are now
  "Weather Desk". The other desks' nav bars still say "North America Hazard Desk"; change them when this goes live.
  The address is still hazard-desk.vercel.app.
- Map engine: the North America engine, with the projection changed from Lambert azimuthal to Mercator (`proj`, `inv`,
  x measured east from 100°W so North America is mid-sheet). The world repeats every `TAU` in x: `copies()` draws each
  layer on up to three side-by-side copies, `sx()` puts a point on the copy nearest the view center, `ringPath` and
  `linePts` keep shapes in one piece across the date line, `hitPath` tests taps on every copy. World land comes from
  `world-countries.js` (skipping countries the detailed `basemap.js` already draws, `BM_HAS`).
- World layers ported from the World page: `drawWorld`, `wHtml` (pop-ups), `worldDeskHtml` and `spaceDeskHtml` (two new
  tabs: World, Space & supervolcanoes), world items in "Right now", tsunami banner, sea temperature (`sstLoad`, asked in
  two pieces when the view crosses the date line). `wStorms()` drops a GDACS storm the Hurricane Center already covers;
  `wQuakes()` drops world-feed quakes inside the North America feed's box. "Your spot" now also lists quakes and GDACS
  storms worldwide.
- Views: North America (default; a set spot opens on the spot), World, then the regional views as before.
- **Bug found and fixed in `api/world.js`:** every tsunami bulletin's header names the "TSUNAMI WARNING CENTER", and
  the parser read that as a warning. A no-threat information statement (M4.6 near Puerto Rico, Nov 8) was labeled
  "Warning" and would have raised the red tsunami banner for 24 hours. The center's name no longer counts, and "there
  is no tsunami threat" now marks a message final. Put live on its own Nov 11 (section 4d).
- Tested with the saved North America snapshot and a saved copy of the live `/api/world` answer. Not yet seen with live
  North America feeds (radar, warnings) on the new projection: the workspace cannot reach them.
- Step 2 (built on the same branch, Nov 11): Randy on the step-1 preview: "Having trouble moving the map up." The map sat
  under four rows of controls and, being nearly screen-wide, took every finger drag, so the page was hard to scroll.
  Now the map is the first thing after the header; View stays as one row under it; layer chips, outlook day and sea
  temperature fold into "Layers and outlook day"; the legend folds into "Map key" (open on wide screens). On a phone the
  map is `min(66vh,130vw)` tall so part of the page always shows for scrolling; a full-screen button (`#zfull`,
  `setFull`, Escape closes) fills the screen. "Your spot", "Right now" and the desks follow the map (beside it on wide
  screens). One dark look for everyone; the light theme is removed.
- Randy's screenshot of the step-1 preview showed live radar drawing on the new projection over Tennessee and Alabama.
## 4d. Tsunami label fix (LIVE Nov 11, 2026 on Randy's "Go on the tsunami fix")

- `api/world.js`: every tsunami bulletin's header names the issuing "TSUNAMI WARNING CENTER", and the parser read that
  as a warning. A no-threat information statement (M4.6 near Puerto Rico, Nov 8) was labeled "Warning" and would have
  raised the red tsunami banner for 24 hours. The center's name no longer counts, and "there is no tsunami threat" now
  marks a message final. Put live on its own, ahead of the one-map work.

## 4e. Live Hurricane Center details (LIVE Nov 11, 2026 on Randy's Go)

- Gap being closed: live storms carried wind radii and the Hurricane Center's watch and hazard text only when the saved
  snapshot held the same advisory, so a new storm showed a track and cone and nothing else.
- `api/storms.js` (server side, cached 3 min): reads NHC `CurrentStorms.json`, then each storm's Public Advisory (TCP)
  and Forecast/Advisory (TCM) from the URLs that file gives (nhc.noaa.gov only). Returns headline, location line, mph,
  movement, the watches/warnings, hazards and discussion sections as issued (paragraphs kept), wind radii now, every
  forecast point with its own wind radii, dissipation time and next advisory time. `?raw=1` adds the raw text for
  debugging. Nothing is computed there.
- Real-text lesson: NHC pads blank lines with a space, so sections never ended until `productText` strips trailing
  spaces. Covered by `tools/test_storms.js` (run by `tools/check.sh`) against Pena advisory 22 saved as issued in
  `tools/fixtures/` and Rachel advisory 29 in `raw/`.
- Page: `loadNhc`, `applyNhc`, `mergeNhc` join the details to the map service's storms by bin number (a storm in the
  advisory list but not yet in the map service is shown without a cone). The storm list's own position and strength
  win, since an intermediate advisory can be newer than the forecast.
- "Your spot" storm block: NHC headline, a "Winds at your spot" column from each forecast point's wind radii
  (`windAt`), the first forecast time 39+ mph winds cover the spot, dissipation time, watch/hazard text in the
  Hurricane Center's own paragraphs, and the discussion folded under a disclosure.
- Not done: NHC's own "earliest reasonable arrival time of tropical-storm-force winds" product exists only as KMZ
  (`earliestArrivalTimeTSWindsGIS` in CurrentStorms.json); reading it would give an official arrival time. Storm surge
  watch/warning and peak surge files are listed there too.

## 4f. Local weather for a U.S. spot (LIVE Nov 11, 2026 on Randy's Go)

- Randy, Nov 11: make this "more of a local weather site like AccuWeather as well": checking a hurricane or tornado
  from your own location without ads. He approved the plan: U.S. first from the National Weather Service; no 30- or
  90-day daily forecasts (none are reliable); official wind chill / heat index for "feels like".
- All of it is read by the browser straight from `api.weather.gov` (CORS is open; no key). Module `LW` in `page.html`:
  `lwLoad`, `lwPoint` (grid lookup, cached 12 h in localStorage `wxpt`), `lwObs` (nearest of four stations with a
  temperature from the last 3 h), `lwAlertHtml`, `lwNowHtml`, `lwHourlyHtml`, `lwDailyHtml`, `lwSections`.
  Refresh: alerts every 2 min, station reading every 10, forecast every 30.
- "Your spot" for a U.S. spot now leads with the Weather Service's own list of every alert at the point (all types,
  which closes the "river flood and marine warnings are not mapped" gap), each with "What to do" (the alert's
  instruction) and the full text folded. Then Right now, Next 24 hours (a sideways-scrolling table), Next 7 days (day and
  night paired; tap for the full wording), then storms, the severe weather outlook and quakes as before. The older
  polygon method remains the fallback and still supplies nearby warnings and projected arrival times.
- Times in the local sections use the spot's time zone from the Weather Service. Re-rendering keeps open sections
  open and the hourly table's scroll position.
- Privacy line changed: for a U.S. spot the browser sends the coordinates (two decimals) to the Weather Service;
  nothing comes to this site.
- A point outside NWS coverage answers 404 and the panel says so. Coordinates are sent without trailing zeros because
  the Weather Service redirects 43.10 to 43.1.
- Built against real answers fetched through a throwaway branch `probe-nws` (`api/probe.js`, api.weather.gov only),
  emptied after this went live (the probe file is removed from the branch; the branch itself could not be deleted
  from the build workspace and can be deleted in GitHub). Not yet seen in a real browser against the live Weather Service.
- Not built yet: radar loop; notifications when the page is closed. Canada and the rest of the world: see 4g.

## 4g. Local weather for Canada, and a labeled computer model everywhere else (LIVE Nov 11, 2026 on Randy's Go)

Randy, Nov 11: "Add Canada / Show computer model everywhere else".

- New module `GW` in `page.html`, right after the U.S. module `LW`. `gwWant()` picks the source: `''` = U.S. Weather Service
  (unchanged), `'ca'` = Environment and Climate Change Canada, `'om'` = Open-Meteo model. A spot labeled U.S. where the Weather
  Service answers "not covered" (404/400) falls through to Canada (if inside a rough Canada box) and then to the model.
- **Canada** (`api.weather.gc.ca`, read by the browser, CORS open): nearest forecast city from
  `collections/citypageweather-realtime/items?bbox=` (boxes widen in four steps, limit 12; the city id is cached 7 days in
  localStorage `wxca`, refreshes use `/items/{id}`); current conditions, 24 hourly rows, the day and night periods in
  Environment Canada's own words. Alerts from `collections/weather-alerts/items?bbox=` around the spot, kept only if the
  published polygon contains the spot, status is not "ended" and it has not expired. Warning type drives the red verdict.
  The city name and its distance are always shown. Canada has no time zone in the feed, so times use the device's zone and say so.
  `properties=` is NOT supported on the citypage collection (400). ECCC calls this API experimental; the page says so.
- **Everywhere else** (`api.open-meteo.com/v1/forecast`, `timezone=auto`): current, 24 hours, 7 days. Every heading says
  "(computer model)"; the notes say it is not a measurement, not an agency forecast, and never carries warnings. Times are the
  spot's own clock time as Open-Meteo wrote them (parsed as written, never shifted). If the units in the reply are not °C and
  km/h the reply is rejected, so a number is never mislabeled. Weather-code words are the WMO table in `WMO`.
  Licence: free for non-commercial use, CC BY 4.0, credit "Weather data by Open-Meteo.com" (in the panel and the footer).
  If the desk ever carries ads or sells anything, this needs their paid plan.
- Units outside the U.S.: °C and km/h first, °F and mph beside them. Refresh: Canadian alerts 5 min, forecasts 15 min.
- Privacy line updated: coordinates (to about half a mile) go to the service that covers the spot.
- Tested in a browser against saved real replies (Richmond Hill city page, three Vancouver rainfall warnings, Mexico City model
  reply), plus feed-down cases and the U.S. path. **Not yet seen against the live feeds from a real browser** (this workspace
  cannot reach them); Open-Meteo's browser access (CORS) in particular is unverified until Randy opens the preview.
- Not done: Canadian and Mexican warnings drawn on the map; French text; a °C/°F switch; Mexico's official forecast (no open feed found).

## 4h. Tracking: pick a storm or warning and watch it (LIVE Nov 11, 2026 on Randy's Go)

Randy, Nov 11: anyone must be able to "pinpoint/select" a hurricane, tornado or severe storm "and watch it. This could help save a life".

- Module "tracking" near the end of `page.html` (`trk`, `trkStart`, `trkFind`, `trkCheck`, `trkRender`). No new feed and no
  new estimate: it repeats what the feeds already say about one chosen thing and measures it against "Your spot".
- What can be tracked: an NHC storm (`storm:<id>`), a GDACS storm outside NHC's area (`wstorm:<id>`), and a Tornado, Severe
  Thunderstorm or Flash Flood Warning (`cell:<key>`). "Track this" buttons (`data-tk`) are in the map popup, the red tornado
  banner (tapping a banner line now opens that warning with the button), and the "Your spot" storm and warning lists.
- A warning's identity is its VTEC event (office.hazard.significance.number, `vtecKey`), added to `liveCells` as `key`, so it
  survives the Weather Service's updates. If that event is gone and another warning of the same kind is within 25 miles
  (40 km), the card switches to it and says so in words. If nothing matches, the card says it is no longer in effect and
  that this is not an all-clear. If the 60-second feed is stale the card says it cannot confirm, never "ended".
- The card (`#trk`) is fixed to the bottom of the screen, above the full-screen map too. Compact on phones (More / Less).
  It shows: covers your spot or distance to the nearest edge, projected arrival at the spot (same straight-line method as
  before), in effect until, storm motion, towns along the path; for hurricanes category, movement, distance, closest forecast
  approach, advisory. Changes (new advisory, extended, upgraded tags, now covers your spot, ended, replaced) are announced in
  the card with a marker and time, a tone (Web Audio, "Sound on/off") and vibration where the phone allows. Three tones when
  a warning starts covering the spot.
- Map: frames the warned area plus the spot (if within 75 miles), dashed white outline on the warning, dashed ring and a
  "TRACKING" label on storms; turns radar on for warnings. Panning or zooming stops the auto-centering ("Re-center map").
- Screen Wake Lock keeps the phone awake while tracking, where the browser supports it; the card says which.
- The choice is saved in localStorage `haztrk` and restored on reload (sound stays off until tapped: browsers require a tap).
- Limits, stated on the card: no live tornado position exists, only the warning area and stated motion; it works only while
  the page is open; outside the U.S. only hurricanes can be tracked.
- Tested in a browser with a constructed Tornado Warning in the real feed format (no real tornado warning was available to
  save): start, update (extended + observed + now covers spot), replacement by a new warning, end, reload, stop, map pan;
  and with the saved hurricane. **Not yet seen against a live warning.** Sound and wake lock cannot be tested here at all.

## 4i. Weather bar above the map (LIVE Nov 12, 2026 on Randy's Go)

Randy, Nov 11-12: make the weather more prominent without ruining the look of the main page.

- One row (`#wbar`, a button) between the title and the map: current temperature and sky, the next two forecast periods
  (high / low), the highest rain-or-snow chance in the next 6 hours, and the alert status. Tapping it scrolls to "Your spot".
- It adds no data and no logic of its own: `barData()` reads the same `LW` / `GW` objects as the panel, and the alert status
  is copied from the verdict already rendered in "Your spot" (same words, same shape marker), so the two can never disagree.
- With a warning at the spot the alert moves to the top of the bar in a solid red block with the triangle marker.
- No spot: the bar is a single "Set your spot for local weather and alerts" button that jumps to the search box.
- Model forecasts are marked "(computer model)" in the bar too. A failed forecast says so instead of "Reading…".
- `renderBar()` is called at the end of every `renderSpot()`.

## 4j. Light look, a Top button, and a limit on dragging the map (LIVE Nov 12, 2026 on Randy's Go)

Randy, Nov 12: his mom would prefer a light map (light blue sea, cream or sand land); and "when moving the map around -
can't move back up in the map again".

- Light look: `:root[data-theme="light"]` redefines the same color variables (sea #B7D6EA, land #F2E8D0). Dark stays the
  default. "Light look / Dark look" button under the clock (`#themeBtn`), saved in localStorage `haztheme`. A link ending
  in `?theme=light` opens light and remembers it, so a link can be sent to someone already set up. A tiny script in the
  head applies it before the page paints. The map reads the variables through `readCss()`, so it follows.
- The "can't move back up" report could not be reproduced here. Two things that fit it were fixed: (1) `clampView()` keeps
  the middle of the map on the world, so it can no longer be dragged off into empty sea; (2) a fixed "Top" button
  (`#toTop`, phones and tablets only) because a finger on the map moves the map and never the page. If Randy still sees
  it, ask exactly what he was dragging and on which screen.
- Randy then pinned it down: on his phone he can drag the map up (to look south) but not down (to look north). The code
  has no such limit (tested both ways with a mouse), so the phone's browser is taking the downward drag for itself (pull to
  refresh or an in-app browser's swipe-down-to-close). Fix: the map canvas now cancels `touchstart` / `touchmove`
  (non-passive `preventDefault`) and sets `overscroll-behavior`. **Not verifiable here; needs Randy's phone.** If it still
  fails, ask which app the page is open in (Safari itself, or a link opened inside another app).

## 4k. Radar loop (LIVE Nov 12, 2026 on Randy's Go)

- "Radar loop" button at the top left of the map (`#rl`, shown when radar is on and live). It replays the past hour of
  NOAA's MRMS radar: about one scan every 6 minutes, up to 11 frames, for the area on screen. Play / pause, a slider, and
  the scan time with its age on every frame. The words "Past hour, observed. Not a forecast." stay under it.
- Scan times are NOAA's own: the `time` list in the layer's WMS GetCapabilities
  (`opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows`, verified Nov 12: 60 times, about 2 minutes apart, two hours
  back, CORS open). Each frame is the same GetMap request the single radar image uses, plus `TIME=`.
- Backup when NOAA's list or image fails: Iowa State's fixed layers `nexrad-n0q-900913-m05m` … `-m50m` (verified in its
  capabilities). Those have no exact times, so frames are labeled "about N min before the latest scan" and the note says
  "backup source, times approximate".
- Frames are warped with the existing `warp()` at a capped pixel ratio (1.5) to keep phone memory down. Moving or zooming
  the map reloads the frames for the new view; new scans are picked up every 5 minutes. With "reduce motion" set on the
  device it does not auto-play; the slider still works.
- Tested with mock radar images and a mock time list in the real format. **Not yet seen against NOAA's live images.**
  The research probe was re-armed for this and removed again from `probe-nws`.

## 4l. Weather symbols and a brighter forecast (LIVE Nov 12, 2026 on Randy's Go)

Randy, Nov 12: "How do we brighten this up and add little weather symbols" in the weather section.
- `wxIco(kind,size)` draws eleven small pictures as inline SVG (sun, moon, partly sunny, partly cloudy night, cloud, rain,
  snow, rain-and-snow, thunderstorm, fog, wind). No image files and no emoji (emoji look different on every phone).
- The picture is chosen from the forecast's own words: `wxKind(text,night)` for the Weather Service and Environment Canada,
  `wmoKind(code,night)` for the model's weather code. Night comes from the forecast's own day/night flag or from that
  place's sunrise and sunset (`nightAt`). If no word matches, no picture is shown. The words always stay beside the picture.
- Where: beside the big temperature in "Right now", above each hour's temperature, beside each day's name, and in the weather
  bar. Highs are warm-colored and lows cool-colored (`--hi`, `--lo`) with the words "High" and "Low" kept; rain bars are blue.
- Each picture has its own shape, so it does not depend on color.

## 5. Open list

1. **NASA FIRMS fire detections** (every hotspot, not just big fires): needs `FIRMS_MAP_KEY` in Vercel; aggregate
   server-side to a grid (a world day of VIIRS is tens of thousands of rows).
2. Campi Flegrei official alert level (Italian Civil Protection) has no machine-readable feed; Toba (PVMBG) and Valles
   likewise. Revisit if a feed appears.
3. (Done on branch `one-map`, see 4c.) One map engine for North America and the world.
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

- **Nov 4, 2026: Global Vaccine Desk added to the Desks row** (https://global-vaccine-desk.vercel.app, chip colour #C2418F, label "Global Vaccine Desk" / "Vaccine"), last in the row after Overhead Now, on every site in the network (Randy: "Yes" to adding it everywhere).

## Nov 12, 2026: the light or dark look carries between desks (LIVE Nov 12, 2026)
Randy: if someone picks dark (or light) on one desk, every other desk they open should match; each desk keeps its own switch.
- The sites are on different addresses, so a saved choice cannot be shared. Instead a small script (comment "Desk network: the
  light or dark look") adds `?theme=light|dark` to any link to another desk at the moment it is tapped, using the look the
  visitor chose with a switch (Randy, Nov 12: "viewer choice ... carries through"). A visitor who never pressed a switch gets
  each desk's own default. Each desk reads `?theme=` from its own address, saves it as that desk's choice and applies it
  before the page paints.
- Per desk: Wire & Ledger key `theme` (front page and editions, builder, about); Weather Desk `haztheme`; Outbreak Desk `obtheme`;
  Earth Desk and Vaccine Desk `deskTheme` plus a new "Light look / Dark look" button beside the credit line (they had no
  switch); Overhead Now has one dark look only, so it just remembers an incoming choice and passes it on.
- LIVE Nov 12, 2026 on Randy's "Go on the look".
