# ExPhys LIMS — CLAUDE.md

## Project Overview

A multi-page static web application (LIMS) for an exercise physiology lab. Google Sheets is the database; Google Apps Script serves as the API layer. Hosted on Open eQuella as a microsite.

**Version:** v2.0.0

## Architecture

```
Open eQuella (8 static HTML/CSS/JS files)
        │
        │  fetch() calls
        ▼
Google Apps Script Web App  (Code.gs — deployed separately)
        │
        │  Sheets API (server-side, no CORS issues)
        ▼
Google Sheet (6 tabs)
```

## File Structure

| File | Role |
|---|---|
| `Code.gs` | Apps Script backend — routes GET/POST, all CRUD, auto-decrement on log entry |
| `api.js` | Shared: `apiGet()`, `apiPost()`, `showToast()`, `populateSelect()`, `downloadCSV()`, pill helpers, `startClock()` |
| `style.css` | Shared stylesheet — all pages reference this |
| `index.html` | Live dashboard — fetches `getAll` on load, computes KPIs client-side |
| `consumables.html` | CRUD for consumables — add/edit modal, search + vendor/stock filters |
| `hardware.html` | CRUD for hardware — per-device calibration toggle, service date tracking |
| `daily-log.html` | Log entry form + history table; logging a consumable auto-decrements qty |
| `reports.html` | Usage pivot, reorder report, calibration status — all filterable + CSV export |
| `settings.html` | Manage Staff/Vendor/Class dropdowns; connection test; setup instructions |

## Google Sheet Schema

**Consumables** — `ID | Name | Vendor | Unit | Units Per Pack | Cost Per Unit | Quantity | Reorder Threshold | Notes`

**Hardware** — `ID | Name | Vendor | Purchase Date | Cost | Warranty Expiry | Needs Calibration | Last Calibration | Next Calibration | Last Service | Next Service | Status | Notes`

**Daily Log** — `ID | Date | Item Name | Item Type | Quantity Used | Class | Used By | Notes`

**Vendors** — `ID | Name`

**Staff** — `ID | Name`

**Classes** — `ID | Name` (seeded: ESS 375L Ex Phys Lab, ESS 497 Research, ESS 386 H&D)

## Key Behaviours

- **Auto-decrement:** When a Daily Log entry with `Item Type = Consumable` is saved, `addLogEntry()` in Code.gs searches the Consumables tab by name and subtracts `Quantity Used` from the current quantity (floor 0).
- **Low stock alert:** Dashboard and Reports flag items where `Quantity ≤ Reorder Threshold`.
- **Calibration alert:** Dashboard and Reports flag hardware where `Needs Calibration = Yes` and `Next Calibration` is within 14 days or overdue.
- **Date handling:** Apps Script converts Google Sheets `Date` objects to `yyyy-MM-dd` strings (via `Utilities.formatDate`) so HTML `<input type="date">` fields work directly.
- **CORS:** Apps Script Web Apps handle CORS automatically when deployed as "Anyone". POST requests use no `Content-Type` header to avoid preflight.

## API Pattern

All calls go to one Apps Script URL. Action is passed as a URL param (GET) or in the JSON body (POST).

```js
// Read
apiGet('getConsumables')
apiGet('getDailyLog', { class: 'ESS 375L Ex Phys Lab', from: '2025-01-01' })

// Write
apiPost({ action: 'addConsumable', row: { Name: '...', Vendor: '...', ... } })
apiPost({ action: 'updateConsumable', id: 'ABC123', row: { Quantity: 45 } })
apiPost({ action: 'deleteConsumable', id: 'ABC123' })
```

Full action list: `getAll | getConsumables | getHardware | getDailyLog | getVendors | getStaff | getClasses | addConsumable | updateConsumable | deleteConsumable | addHardware | updateHardware | deleteHardware | addLogEntry | updateLogEntry | deleteLogEntry | addVendor | deleteVendor | addStaff | deleteStaff | addClass | deleteClass`

## Shared Utilities in api.js

| Function | Purpose |
|---|---|
| `apiGet(action, params)` | Fetch wrapper for GET — shows toast on error |
| `apiPost(payload)` | Fetch wrapper for POST — shows toast on error |
| `showToast(msg, type)` | Toast notification (`success` / `error` / `warning`) |
| `populateSelect(el, items, valueKey, labelKey, selected, placeholder)` | Populates a `<select>` from an array |
| `downloadCSV(rows, filename)` | Converts array of objects to CSV and triggers download |
| `fmtDate(val)` | Formats `yyyy-MM-dd` to `Mon DD, YYYY` |
| `daysUntil(dateStr)` | Days from today to a date (negative = overdue) |
| `today()` | Returns today as `yyyy-MM-dd` |
| `calPill(dateStr, needsCal)` | Returns calibration status pill HTML |
| `servicePill(dateStr)` | Returns service status pill HTML |
| `stockPill(qty, threshold)` | Returns stock level pill HTML |
| `esc(str)` | HTML-escapes a string for safe inline rendering |
| `startClock()` | Starts the live clock in `#clock` element |
| `openModal(id)` / `closeModal(id)` | Show/hide a modal overlay |

## Settings Page Pattern

`settings.html` uses a `SETTINGS_CFG` config object to drive all three list sections (Staff, Vendors, Classes) with two generic functions `addSetting(type)` and `deleteSetting(type, id, name)` instead of six separate functions.

## UI System

Dark navy theme with glassmorphism panels. All shared CSS lives in `style.css`.

Color palette (CSS custom properties):
- `--blue: #4f8ef7` — hardware, general
- `--green: #3ecf8e` — in-stock, operational
- `--amber: #f5a623` — warnings, due soon
- `--rose: #f75f7a` — overdue, critical, out-of-stock
- `--violet: #a78bfa` — reports, classes

Key CSS classes: `.kpi` / `.kpi-{color}`, `.glass`, `.pill` / `.pill-{color}`, `.ltable`, `.table-wrap`, `.btn` / `.btn-{variant}`, `.form-grid`, `.modal-overlay` / `.modal-box`, `.alert-row`, `.settings-item`.

## Deployment

1. Create a Google Sheet → Extensions → Apps Script → paste `Code.gs`
2. Run `initializeSheets()` once from the editor
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Paste the Web App URL into `api.js` as `API_URL`
5. Upload all HTML/CSS/JS files to Open eQuella microsite

See `README.md` for full step-by-step instructions.
