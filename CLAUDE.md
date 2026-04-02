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
Google Sheet (7 tabs)
```

## File Structure

| File | Role |
|---|---|
| `Code.gs` | Apps Script backend — routes GET/POST, all CRUD, auto-decrement on log entry |
| `api.js` | Shared: `apiGet()`, `apiPost()`, `showToast()`, `populateSelect()`, `downloadCSV()`, pill helpers, `startClock()` |
| `style.css` | Shared stylesheet — all pages reference this |
| `index.html` | Live dashboard — fetches `getAll` on load, computes KPIs client-side |
| `consumables.html` | CRUD for consumables — add/edit modal, per-class tab filter, restock modal |
| `hardware.html` | CRUD for hardware — per-device calibration toggle, service date tracking |
| `daily-log.html` | Log entry form + history table; logging a consumable auto-decrements qty |
| `reports.html` | Usage pivot, reorder report, calibration status, semester/annual usage — all filterable + CSV export |
| `settings.html` | Manage Staff/Vendor/Class/Item dropdowns; connection test; setup instructions |

## Google Sheet Schema

**Consumables** — `ID | Name | Class | Vendor | Unit | Units Per Pack | Cost Per Unit | Quantity | Reorder Threshold | Notes`

**Hardware** — `ID | Name | Vendor | Purchase Date | Cost | Warranty Expiry | Needs Calibration | Last Calibration | Next Calibration | Last Service | Next Service | Status | Notes`

**Daily Log** — `ID | Date | Item Name | Item Type | Quantity Used | Class | Used By | Notes`

**Vendors** — `ID | Name`

**Staff** — `ID | Name`

**Classes** — `ID | Name` (seeded: ESS 375L Ex Phys Lab, ESS 497 Research, ESS 386 H&D)

**Items** — `ID | Name` (lookup list of consumable item names; seeded with 35 common supplies)

## Key Behaviours

- **Per-class inventory pools:** Each `Name + Class` pair is a unique row in Consumables. The same physical item (e.g., "Alcohol Wipes") has separate stock rows per class. This matches the physical reality of course-allocated supplies.
- **Auto-create on first log:** `addLogEntry()` in Code.gs matches by `Name + Class`. If no row exists for that combination, it auto-creates one with `Quantity = -used`. The user then restocks to set the correct on-hand value.
- **Auto-decrement:** When a Daily Log entry with `Item Type = Consumable` is saved, `addLogEntry()` subtracts `Quantity Used` from the matched Consumables row. Quantities can go negative (no floor) to reflect usage before stock is set.
- **Restock action:** `restockConsumable` is additive — it adds the received qty to the current value (not a set). This correctly handles negative balances from the auto-create pattern.
- **Low stock alert:** Dashboard and Reports flag items where `Quantity ≤ Reorder Threshold`.
- **Calibration alert:** Dashboard and Reports flag hardware where `Needs Calibration = Yes` and `Next Calibration` is within 14 days or overdue.
- **Date handling:** Apps Script converts Google Sheets `Date` objects to `yyyy-MM-dd` strings (via `Utilities.formatDate`) so HTML `<input type="date">` fields work directly.
- **CORS:** Apps Script Web Apps handle CORS automatically when deployed as "Anyone". POST requests use no `Content-Type` header to avoid preflight.

## Semester Boundaries (BYUI Calendar)

- **Winter:** January 1 – April 10
- **Spring:** April 15 – July 31
- **Fall:** September 1 – December 31
- Entries in the gaps (April 11–14, August) are excluded from semester totals.

## API Pattern

All calls go to one Apps Script URL. Action is passed as a URL param (GET) or in the JSON body (POST).

```js
// Read
apiGet('getConsumables')
apiGet('getDailyLog', { class: 'ESS 375L Ex Phys Lab', from: '2025-01-01' })

// Write
apiPost({ action: 'addConsumable', row: { Name: '...', Class: '...', Vendor: '...', ... } })
apiPost({ action: 'updateConsumable', id: 'ABC123', row: { Quantity: 45 } })
apiPost({ action: 'deleteConsumable', id: 'ABC123' })
apiPost({ action: 'restockConsumable', id: 'ABC123', qty: 50 })
apiPost({ action: 'clearConsumables' })
```

Full action list: `getAll | getConsumables | getHardware | getDailyLog | getVendors | getStaff | getClasses | getItems | addConsumable | updateConsumable | deleteConsumable | restockConsumable | clearConsumables | addHardware | updateHardware | deleteHardware | addLogEntry | updateLogEntry | deleteLogEntry | addVendor | deleteVendor | addStaff | deleteStaff | addClass | deleteClass | addItem | deleteItem`

## Shared Utilities in api.js

| Function | Purpose |
|---|---|
| `apiGet(action, params)` | Fetch wrapper for GET — shows toast on error, 15s timeout |
| `apiPost(payload)` | Fetch wrapper for POST — shows toast on error, 15s timeout |
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

`settings.html` uses a `SETTINGS_CFG` config object to drive all four list sections (Staff, Vendors, Classes, Items) with two generic functions `addSetting(type)` and `deleteSetting(type, id, name)` instead of eight separate functions.

## UI System

Dark navy theme with glassmorphism panels. All shared CSS lives in `style.css`.

Color palette (CSS custom properties):
- `--blue: #4f8ef7` — hardware, general
- `--green: #3ecf8e` — in-stock, operational
- `--amber: #f5a623` — warnings, due soon
- `--rose: #f75f7a` — overdue, critical, out-of-stock
- `--violet: #a78bfa` — reports, classes

Key CSS classes: `.kpi` / `.kpi-{color}`, `.glass`, `.pill` / `.pill-{color}`, `.ltable`, `.table-wrap`, `.btn` / `.btn-{variant}`, `.form-grid`, `.modal-overlay` / `.modal-box`, `.alert-row`, `.settings-item`.

Note: `backdrop-filter` is intentionally absent from `.modal-overlay` — it creates a stacking context on Windows/Chrome that clips native `<select>` dropdown popups.

## Deployment

1. Create a Google Sheet → Extensions → Apps Script → paste `Code.gs`
2. Run `initializeSheets()` once from the editor
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Paste the Web App URL into `api.js` as `API_URL`
5. Upload all HTML/CSS/JS files to Open eQuella microsite

See `README.md` for full step-by-step instructions.
