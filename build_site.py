#!/usr/bin/env python3
"""Wrap page.html (the page source, also what the claude.ai artifact publishes)
into index.html, the full document that Vercel serves.

  python3 build_site.py
"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'page.html'), encoding='utf-8').read()
cut = src.index('<div class="wrap">')
head, body = src[:cut].rstrip(), src[cut:]
DESC = ('Live map of hurricanes, tornado warnings, severe storms, flooding rain, fire weather, snow, '
        'earthquakes and volcanoes for the United States, Canada and Mexico. Public agency data, no ads.')
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
        "%3Crect width='32' height='32' rx='6' fill='%2316202A'/%3E"
        "%3Cpath d='M6 8h20l-3 5H9zM10 15h12l-2.5 4.500h-7zM13.500 21.500h5L16 27z' fill='%23FF3B30'/%3E%3C/svg%3E")
doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{DESC}">
<meta property="og:title" content="North America Hazard Desk">
<meta property="og:description" content="{DESC}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<link rel="icon" href="{ICON}">
<style>:root{{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}
</head>
<body>
{body.rstrip()}
</body>
</html>
'''
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(doc)
print('index.html', len(doc), 'bytes')

# world.html: the World view. Same stylesheet and desk-network bar as the main page, its own body from world_page.html.
wsrc = open(os.path.join(HERE, 'world_page.html'), encoding='utf-8').read()
bdk = src[src.index('<!--BDK-->'):src.index('<!--/BDK-->') + len('<!--/BDK-->')]
wcut = wsrc.index('<div class="wrap">')
whead, wbody = wsrc[:wcut].rstrip(), wsrc[wcut:].replace('<!--BDK-->', bdk, 1)
WDESC = ('World map of tropical storms, earthquakes, tsunami messages, erupting volcanoes, major floods and sea '
         'surface temperature. Public agency data, no ads.')
wdoc = (doc.replace(DESC, WDESC).replace('content="North America Hazard Desk"', 'content="World Hazard Desk"')
        .replace(head, head.replace('<title>North America Hazard Desk</title>', '<title>World Hazard Desk</title>') + '\n' + whead))
wdoc = wdoc[:wdoc.index('<body>') + len('<body>')] + '\n' + wbody.rstrip() + '\n</body>\n</html>\n'
open(os.path.join(HERE, 'world.html'), 'w', encoding='utf-8').write(wdoc)
print('world.html', len(wdoc), 'bytes')
