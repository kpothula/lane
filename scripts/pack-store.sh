#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
version=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("manifest.json","utf8")).version)')
mkdir -p dist
zip -r "dist/lane-${version}.zip" \
  manifest.json \
  background.js \
  theme.css \
  blocked.html blocked.css blocked.js \
  options.html options.css options.js \
  popup.html popup.css popup.js \
  icons \
  lib \
  fonts \
  -x '*.DS_Store'
echo "dist/lane-${version}.zip"
