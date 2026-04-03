#!/usr/bin/env bash
# Build script — copies eQuella deployment files into deploy/
# Run from the repo root: bash build.sh

set -e

DEPLOY_DIR="deploy"
FILES=(
  index.html
  consumables.html
  hardware.html
  daily-log.html
  reports.html
  settings.html
  style.css
  api.js
  lab-banner.jpg
)

rm -rf "$DEPLOY_DIR"
mkdir "$DEPLOY_DIR"

for f in "${FILES[@]}"; do
  cp "$f" "$DEPLOY_DIR/$f"
  echo "  copied $f"
done

echo ""
echo "Deploy folder ready: $DEPLOY_DIR/ (${#FILES[@]} files)"
echo "Upload these files to Open eQuella and set index.html as the entry point."
