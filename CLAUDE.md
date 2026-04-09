# ExPhys LIMS — CLAUDE.md

## Project Overview

A multi-page static web application (LIMS) for an exercise physiology lab. Google Sheets is the database; Google Apps Script serves as the API layer. Hosted on Open eQuella as a microsite.

**Version:** v2.0.0

## Architecture

```
Open eQuella (10 static HTML/CSS/JS/JPG files)
        │
        │  fetch() calls
        ▼
Google Apps Script Web App  (Code.gs — deployed separately)
        │
        │  Sheets API (server-side, no CORS issues)
        ▼
Google Sheet (12 tabs)
```

## File Structure

| File | Role |
|---|---|
| `Code.gs` | Apps Script backend — routes GET/POST, all CRUD, auto-decrement on log entry, batch/expiration tracking |
| `api.js` | Shared: `apiGet()`, `apiPost()`, `showToast()`, `populateSelect()`, `downloadCSV()`, pill helpers, `startClock()`, sessionStorage caching |
| `style.css` | Shared stylesheet — all pages reference this |
| `index.html` | Live dashboard — fetches individual endpoints in parallel, computes KPIs client-side (low stock, expiring, maintenance) |
| `consumables.html` | CRUD for consumables — add/edit modal, per-class tab filter, restock modal (with expiration date), batch management modal, merge modal |
| `hardware.html` | CRUD for hardware — model/serial/BYU-ID fields; per-device maintenance task modal (Tasks + History tabs); mark-complete with inventory deduction |
| `daily-log.html` | Log entry form + history table; logging a consumable auto-decrements qty; CSV bulk import with template + row-by-row review |
| `reports.html` | Usage pivot, reorder report (vendor contact + order status), maintenance status, semester/annual usage — all filterable + CSV export |
| `budget.html` | Per-class budget tracking — semester enrollment entry, KPI cards, spending history, CSV export |
| `settings.html` | Manage Staff/Vendor (with contact info)/Class/Item dropdowns; inline rename for Staff/Classes; connection test |

## Google Sheet Schema

**Consumables** — `ID | Name | Class | Vendor | Unit | Units Per Pack | Cost Per Unit | Quantity | Reorder Threshold | Expiration Date | Order Status | Notes`

**Hardware** — `ID | Name | Model Number | Serial Number | BYU-ID | Vendor | Purchase Date | Cost | Status | Notes`

**Daily Log** — `ID | Date | Item Name | Item Type | Quantity Used | Class | Used By | Notes`

**Vendors** — `ID | Name | Phone | Email | Website`

**Staff** — `ID | Name`

**Classes** — `ID | Name` (seeded: ESS 375L Ex Phys Lab, ESS 497 Research, ESS 386 H&D)

**Items** — `ID | Name` (lookup list of consumable item names; seeded with 35 common supplies)

**Budget** — `ID | Class | Semester | Year | Total Enrollment | Course Fee Per Student | Semester Total | Notes`

**Restock Log** — `ID | Date | Item Name | Class | Quantity | Invoice Amount | Shipping Tax | Total Cost | Notes`

**Maintenance Tasks** — `ID | Hardware ID | Hardware Name | Task Name | Frequency | Supplies Needed | Next Due | Notes`

**Maintenance Log** — `ID | Date | Hardware ID | Hardware Name | Task Name | Completed By | Supplies Used | Notes`

**Batches** — `ID | Item Name | Class | Quantity | Expiration Date | Received Date | Notes`

## Key Behaviours

- **Per-class inventory pools:** Each `Name + Class` pair is a unique row in Consumables. The same physical item (e.g., "Alcohol Wipes") has separate stock rows per class. This matches the physical reality of course-allocated supplies.
- **Auto-create on first log:** `addLogEntry()` in Code.gs matches by `Name + Class`. If no row exists for that combination, it auto-creates one with `Quantity = -used`. The user then restocks to set the correct on-hand value.
- **Auto-decrement:** When a Daily Log entry with `Item Type = Consumable` is saved, `addLogEntry()` subtracts `Quantity Used` from the matched Consumables row. Quantities can go negative (no floor) to reflect usage before stock is set.
- **Restock action:** `restockConsumable` is additive — it adds the received qty to the current value (not a set). Also logs to Restock Log with invoice amount, shipping/tax, and total cost. Clears `Order Status` on the consumable row. This correctly handles negative balances from the auto-create pattern.
- **Expiration / Batch tracking:** Restocking with an expiration date creates a row in the Batches tab. The Consumables row `Expiration Date` is updated to the earliest upcoming date across all batches. Deleting a batch recomputes the nearest date. Items expiring within 30 days appear in the Dashboard low stock panel via `expPill()`.
- **Order Status:** The Reorder Report lets users flag an item as "Ordered" (`markOrdered` action). The flag is cleared automatically when the item is restocked.
- **Merge duplicates:** `mergeConsumables` adds the source row's Quantity to the target row, then deletes the source. Used when auto-create and manual add produce two rows for the same item+class.
- **Budget tracking:** Fiscal year = calendar year (Jan–Dec). Budget entries are per class+semester+year. Allocated = sum of all `Semester Total` entries for that class+year. Spent = sum of all Restock Log `Total Cost` entries for that class+year. Classes without a `Course Fee Per Student > 0` display spending only (no allocated/remaining balance). Dashboard shows compact per-class remaining balance.
- **Low stock alert:** Dashboard and Reports flag items where `Quantity ≤ Reorder Threshold`.
- **Maintenance tasks:** Each hardware device can have up to ~6 named tasks (e.g. "Belt Lubrication") with a frequency (Monthly / Every 3 Months / Every 6 Months / Annually / custom "Every N Days|Weeks|Months|Years"). Dashboard and Reports flag tasks due within 14 days or overdue. Stored in `Maintenance Tasks` tab keyed by `Hardware ID`.
- **Mark complete:** `completeMaintTask()` logs to Maintenance Log and auto-advances `Next Due` via `advanceDate()`. Optionally decrements a consumable via `decrementConsumable()` — same auto-create logic as Daily Log.
- **`decrementConsumable(name, cls, qty)`:** Shared Code.gs helper used by both `addLogEntry` and `completeMaintTask`. Finds the matching Name+Class row in Consumables and subtracts qty; auto-creates row with negative qty if not found.
- **CSV bulk import (Daily Log):** Client-side CSV parse → row-by-row review table (editable fields) → sequential `addLogEntry` calls. Each row triggers the same auto-decrement as manual entry.
- **Vendor contact info:** Vendors now store `Phone`, `Email`, `Website`. The Reorder Report displays contact details inline. `updateVendor` cascades a name change to all matching rows in Consumables and Hardware.
- **Rename Staff / Classes:** `updateStaff` and `updateClass` rename entries. The settings page uses an inline edit modal for both.
- **sessionStorage caching:** `apiGet()` caches responses for 90 seconds keyed by action+params. Any `apiPost()` call clears all cache entries. Dashboard uses parallel individual `apiGet()` calls (not `getAll`) so each endpoint benefits independently from cache.
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

Full action list: `getAll | getConsumables | getHardware | getDailyLog | getVendors | getStaff | getClasses | getItems | getBatches | addConsumable | updateConsumable | deleteConsumable | restockConsumable | clearConsumables | markOrdered | mergeConsumables | addBatch | deleteBatch | addHardware | updateHardware | deleteHardware | addLogEntry | updateLogEntry | deleteLogEntry | addVendor | updateVendor | deleteVendor | addStaff | updateStaff | deleteStaff | addClass | updateClass | deleteClass | addItem | deleteItem | getBudget | getRestockLog | addBudgetEntry | updateBudgetEntry | deleteBudgetEntry | getMaintTasks | getMaintLog | addMaintTask | updateMaintTask | deleteMaintTask | completeMaintTask | deleteMaintLog`

## Shared Utilities in api.js

| Function | Purpose |
|---|---|
| `apiGet(action, params)` | Fetch wrapper for GET — 90s sessionStorage cache, 30s timeout, shows toast on error |
| `apiPost(payload)` | Fetch wrapper for POST — clears all cache on success, 30s timeout, shows toast on error |
| `showToast(msg, type)` | Toast notification (`success` / `error` / `warning`) |
| `populateSelect(el, items, valueKey, labelKey, selected, placeholder)` | Populates a `<select>` from an array |
| `downloadCSV(rows, filename)` | Converts array of objects to CSV and triggers download |
| `fmtDate(val)` | Formats `yyyy-MM-dd` to `Mon DD, YYYY` |
| `daysUntil(dateStr)` | Days from today to a date (negative = overdue) |
| `today()` | Returns today as `yyyy-MM-dd` |
| `fmt$(n)` | Formats a number as a dollar string (e.g. `$12.50`) |
| `getYear(dateStr)` | Extracts the 4-digit year from a `yyyy-MM-dd` string |
| `calPill(dateStr, needsCal)` | Returns calibration status pill HTML |
| `servicePill(dateStr)` | Returns service status pill HTML |
| `stockPill(qty, threshold)` | Returns stock level pill HTML |
| `expPill(dateStr)` | Returns expiration status pill HTML (Expired / Exp Soon / OK / N/A) |
| `esc(str)` | HTML-escapes a string for safe inline rendering |
| `startClock()` | Starts the live clock in `#clock` element |
| `openModal(id)` / `closeModal(id)` | Show/hide a modal overlay |

## Settings Page Pattern

`settings.html` uses a `SETTINGS_CFG` config object to drive the Staff, Classes, and Items list sections with two generic functions `addSetting(type)` and `deleteSetting(type, id, name)`. Vendors are handled separately (`addVendor()`) because they have extra fields (Phone, Email, Website). Staff and Classes support inline rename via a shared edit modal (`setting-edit-modal`).

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

## Build & Deployment

Run `bash build.sh` from the repo root to populate `deploy/` with the 10 files needed for eQuella (HTML, CSS, JS, and `lab-banner.jpg`). The `deploy/` folder is gitignored. After updating `Code.gs`, paste into Apps Script and deploy a new version — the Web App URL stays the same.

Full deployment steps:
1. Create a Google Sheet → Extensions → Apps Script → paste `Code.gs`
2. Run `initializeSheets()` once from the editor
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Paste the Web App URL into `api.js` as `API_URL`
5. Run `bash build.sh`, then upload `deploy/` contents to Open eQuella microsite

See `README.md` for full step-by-step instructions.

## Custom Commands

`.claude/commands/finalize.md` — project-level `/finalize` command that updates README, updates CLAUDE.md, commits, runs `bash build.sh`, and pushes to GitHub.
