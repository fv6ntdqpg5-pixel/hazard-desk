#!/bin/sh
# Run before every push (installed as .git/hooks/pre-push). Blocks the push if the page is broken.
# © 2026 Randy Barnhill. All rights reserved.
set -e
cd "$(git rev-parse --show-toplevel)"
python3 build_site.py >/dev/null
if ! git diff --quiet -- index.html; then echo "index.html is out of date with page.html: run python3 build_site.py and commit it."; git checkout -- index.html; exit 1; fi
node tools/sitecheck.mjs
