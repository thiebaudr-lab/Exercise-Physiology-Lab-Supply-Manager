@echo off
REM ============================================================
REM  ExPhys LIMS — Build standalone Windows .exe
REM  Run this from the src\ folder:   build_windows.bat
REM  Requires PyInstaller: pip install pyinstaller
REM ============================================================

echo Installing / verifying dependencies...
pip install -r requirements.txt
pip install pyinstaller

echo.
echo Building .exe...
pyinstaller ^
  --onefile ^
  --windowed ^
  --name "ExPhysLogImporter" ^
  --icon "../deploy/favicon.ico" ^
  exphys_ocr\app.py

echo.
echo Done! Find the executable at: dist\ExPhysLogImporter.exe
pause
