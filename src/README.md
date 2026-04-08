# ExPhys LIMS — Log Sheet Importer

A standalone desktop tool that reads a scanned PDF of a handwritten lab log sheet,
extracts the entries using PaddleOCR, lets you review and edit them, then imports
them directly into the ExPhys LIMS web app.

---

## Workflow

1. **Select PDF** — click "Select PDF…" and choose your scanned log sheet
2. **Run OCR** — the tool reads every page and extracts rows automatically
3. **Review** — check the extracted table; click any cell to edit, ✕ to delete a row, or "+ Add Row" to add one manually
4. **Import** — click "Import to LIMS" to post all rows to your Apps Script API

---

## First-Time Setup

### 1 — Install Python

Download Python 3.10 or newer from https://python.org. During install, check **"Add Python to PATH"**.

### 2 — Install Poppler (required by pdf2image)

**Windows:**
1. Download from https://github.com/oschwartz10612/poppler-windows/releases
2. Extract the zip and add the `Library/bin` folder to your PATH

**Mac:**
```bash
brew install poppler
```

### 3 — Install dependencies

Open a terminal in the `src/` folder and run:

```bash
pip install -r requirements.txt
```

This installs PaddleOCR, CustomTkinter, pdf2image, and other dependencies.
The first run of the app will also download PaddleOCR's model weights (~100 MB).

### 4 — Run the app

```bash
python -m exphys_ocr.app
```

### 5 — Paste your API URL

In the top-right of the app window, paste your Apps Script Web App URL
(the same URL in `api.js` as `API_URL`). Click **Save** — it will be remembered
for future sessions.

---

## Building a Standalone Executable (optional)

If you want to distribute the tool without requiring Python to be installed:

**Windows:**
```bat
build_windows.bat
```
Output: `dist\ExPhysLogImporter.exe`

**Mac:**
```bash
bash build_mac.sh
```
Output: `dist/ExPhysLogImporter`

Note: The first build downloads PyInstaller and PaddleOCR model weights. The resulting
executable is large (~500 MB) because it bundles Python and all dependencies.

---

## Tips

- **Image quality matters.** Scan at 300 DPI or higher for best OCR accuracy.
- **Edit before importing.** The review table is editable — fix any misread values before clicking Import.
- **Class names are auto-standardised.** "375", "ESS 375", "ex phys" etc. are all mapped to "ESS 375L Ex Phys Lab". Edit the cell if the mapping is wrong.
- **Quantity must be a whole number.** The OCR strips units — "5 ea" becomes "5".
- **Date format.** Dates like "3/15" are assumed to be the current year and converted to YYYY-MM-DD.
