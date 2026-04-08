#!/usr/bin/env bash
# ============================================================
#  ExPhys LIMS — Build standalone Mac .app
#  Run this from the src/ folder:   bash build_mac.sh
#  Requires PyInstaller: pip install pyinstaller
# ============================================================

set -e

echo "Installing / verifying dependencies..."
pip install -r requirements.txt
pip install pyinstaller

echo ""
echo "Building .app..."
pyinstaller \
  --onefile \
  --windowed \
  --name "ExPhysLogImporter" \
  exphys_ocr/app.py

echo ""
echo "Done! Find the app at: dist/ExPhysLogImporter"
