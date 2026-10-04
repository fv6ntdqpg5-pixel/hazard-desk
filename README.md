# North America Hazard Desk

A single-page, ad-free tracker for hurricanes, tornado warnings, severe storms, flooding rain,
fire weather, snow, earthquakes and volcanoes across the United States, Canada, Mexico and the
surrounding waters. Static files only; every visitor's browser pulls the data straight from
the public agencies.

## Files

| file | what it is |
| --- | --- |
| `index.html` | The page Vercel serves. Generated: do not edit by hand. |
| `page.html` | The page source (also what the claude.ai artifact publishes). Edit this, then run `python3 build_site.py`. |
| `basemap.js` | Coastlines, state/province lines, lakes, cities (Natural Earth, public domain). Built once by `build_basemap.py`. |
| `data.js` | Snapshot used as a fallback and for text bulletins. Built by `build_data.py` from `raw/`. |

## Live feeds (fetched in the browser)

| feed | source | refresh |
| --- | --- | --- |
| Tornado, severe thunderstorm, flash flood warnings (polygon, storm motion, tags) | api.weather.gov `/alerts/active`; falls back to NOAA mapservices WWA layer 0 | 60 s |
| Other watches, warnings, advisories | NOAA mapservices `WWA/watch_warn_adv` layer 1 | 5 min |
| Hurricanes: forecast points and cones | NOAA mapservices `NHC_tropical_weather` | 5 min |
| Severe storm, tornado probability, fire weather outlooks | NOAA mapservices `SPC_wx_outlks`, `SPC_firewx` | 5 min |
| Excessive rainfall outlook | NOAA mapservices `wpc_precip_hazards` | 5 min |
| Radar | NOAA MRMS WMS (`opengeo.ncep.noaa.gov`, `conus_bref_qcd`); falls back to Iowa Environmental Mesonet | 2 to 5 min, and on pan/zoom |
| Tornado reports | Iowa Environmental Mesonet local storm reports | 5 min |
| Earthquakes | USGS `fdsnws/event` | 5 min |
| Volcano alert levels | USGS HANS API | 5 min |

Text that has no browser-friendly feed (NHC tropical outlook wording, storm hazard statements,
the WPC heavy snow discussion, the Yellowstone monthly update) comes from `data.js` and is
hidden once it is more than 12 hours old.

## Rebuilding the snapshot

`raw/` holds the fetched source files; `python3 build_data.py <fetch time, UTC ISO>` writes `data.js`.

| raw file | source |
| --- | --- |
| currentstorms.json | https://www.nhc.noaa.gov/CurrentStorms.json |
| tcm_<id>.txt, tcp_<id>.txt | NHC forecast advisory and public advisory text for each active storm |
| cones.txt | mapservices NHC_tropical_weather, Forecast Cone layer of each storm bin |
| two_at.txt, two_ep.txt, two_cp.txt | NHC / CPHC Tropical Weather Outlook text |
| outlooks.txt | mapservices SPC_wx_outlks (1, 3, 9, 17), wpc_precip_hazards (0, 1, 2), SPC_firewx (1, 4) |
| wwa.txt | mapservices WWA watch_warn_adv layer 1, generalized |
| quakes_*.txt | earthquake.usgs.gov fdsnws event query, format=text |
| volcanoes.json, yellowstone.json | volcanoes.usgs.gov hans-public API |
| snow_hsd.txt | WPC Probabilistic Heavy Snow and Icing Discussion (QPFHSD) |

## Not an official warning service

This page is an independent summary of public data. It only helps while it is open, and the
NWS feed can lag a new warning by a minute or two. Keep Wireless Emergency Alerts on and follow
weather.gov and local officials.
