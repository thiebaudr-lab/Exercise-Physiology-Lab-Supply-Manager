# ExPhys LIMS — Exercise Physiology Lab Information Management System

A lightweight, browser-based system for tracking lab supplies, equipment calibration, and daily usage in an exercise physiology lab. Hosted as a static microsite on Open eQuella with Google Sheets as the database.

---

## What It Does

| Page | Purpose |
|---|---|
| **Dashboard** | Live KPIs — low stock count, calibration alerts, recent activity |
| **Consumables** | Per-class supply inventory with reorder thresholds and restock tracking |
| **Hardware** | Track equipment, calibration schedules, and service dates |
| **Daily Log** | Record supply usage by class; auto-decrements consumable inventory |
| **Reports** | Usage pivot, reorder report, calibration status, and semester/annual usage trends — all exportable to CSV |
| **Settings** | Manage Staff, Vendor, Class, and Item Name dropdown options |

---

## Key Concepts

### Per-Class Inventory

Consumables are tracked **per class** — the same item (e.g., "Alcohol Wipes") has a separate stock row for each class that uses it (ESS 375L, ESS 497, ESS 386 H&D). This reflects the physical reality of supplies being allocated per course.

### Auto-Create on First Log

You do not need to manually add every consumable before the semester starts. When you log usage in the Daily Log for an item+class combination that has no stock row yet, the system **automatically creates the row** with a negative quantity (showing a deficit). You then use the **Restock** button to enter the actual quantity on hand, which adds to the current value.

### Restock vs. Set

The **Restock** action is additive — it adds the received quantity to the current stock. If you receive 200 alcohol wipes and the row currently shows −12 (used before stock was entered), restocking 200 results in 188.

---

## Deployment

### Step 1 — Create a Google Sheet

Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it something like `ExPhys LIMS Data`.

### Step 2 — Set Up the Apps Script Backend

1. In the Sheet, click **Extensions → Apps Script**
2. Delete any existing code in the editor
3. Paste the entire contents of `Code.gs` from this repository
4. Save the file (Ctrl+S / Cmd+S)

### Step 3 — Initialize the Sheet Structure

1. In the Apps Script editor, select `initializeSheets` from the function dropdown at the top
2. Click **Run**
3. When prompted, click **Review permissions** → **Allow**

This creates seven tabs (Consumables, Hardware, Daily Log, Vendors, Staff, Classes, Items) and pre-populates Vendors, Classes, and the Items name lookup with default values.

### Step 4 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Type" and select **Web app**
3. Set the following:
   - **Description:** ExPhys LIMS API
   - **Execute as:** Me
   - **Who has access:** Anyone *(or "Anyone with Google account" if you want to restrict to your org)*
4. Click **Deploy**
5. Copy the **Web App URL** — it will look like `https://script.google.com/macros/s/AKfy.../exec`

### Step 5 — Connect the Frontend

Open `api.js` in this repository and replace the placeholder on line 8:

```js
const API_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

with your Web App URL:

```js
const API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
```

### Step 6 — Upload to Open eQuella

Upload all files to your Open eQuella microsite resource:

```
index.html
consumables.html
hardware.html
daily-log.html
reports.html
settings.html
style.css
api.js
```

Set `index.html` as the entry point. The site is now live.

> **Tip:** Verify the connection is working by opening `settings.html` and clicking **Test Connection**.

---

## Usage Guide

### Adding Supplies (Consumables)

You have two options:

**Option A — Add manually:** Go to **Consumables** → click **+ Add Consumable**. Fill in Name, Class, Vendor, Unit, Quantity, and Reorder Threshold.

**Option B — Log first, restock later:** Go to **Daily Log** and log usage as normal. The system creates the consumable row automatically with a negative quantity. Then go to **Consumables**, find the row, click **Restock**, and enter the quantity you actually have on hand.

The Reorder Threshold triggers a low-stock alert on the Dashboard and the Reorder Report when stock falls at or below that number.

### Logging Daily Usage

1. Go to **Daily Log** → fill in the form at the top
2. Select **Consumable** or **Hardware** as the item type — the Item Name dropdown updates accordingly
3. Select the **Class** the supplies were used in
4. When you log a consumable, the quantity in the Consumables tab for that item+class is automatically decremented
5. To edit a past entry, click **Edit** on any row — the form switches to edit mode

> **Note:** Deleting a log entry does **not** restore inventory. Adjust stock manually via Restock if needed.

### Restocking Supplies

1. Go to **Consumables**
2. Find the item and click **Restock**
3. Enter the quantity received — this is **added** to the current quantity on hand

### Tracking Hardware

1. Go to **Hardware** → click **+ Add Hardware**
2. Check **"This equipment requires periodic calibration"** to enable calibration date fields
3. Equipment with calibration due within 14 days appears as **Due Soon** (amber); past due shows as **Overdue** (red)
4. Both the Dashboard and Reports page surface overdue items automatically

### Running Reports

1. Go to **Reports**
2. Use the filter bar at the top to narrow by Class and/or date range
3. Four reports update automatically:
   - **Usage Summary** — total quantity used per item, number of sessions, top user and class
   - **Reorder Report** — all consumables at or below their reorder threshold
   - **Calibration Status** — all equipment requiring calibration, sorted by urgency
   - **Semester & Annual Usage** — consumable totals broken down by Winter / Spring / Fall and year, per class. Use this to plan ordering quantities for upcoming semesters.
4. Click **Export CSV** on any section to download that report, or **Export All CSV** to download all four

> **Semester boundaries (BYUI calendar):**
> - Winter: January 1 – April 10
> - Spring: April 15 – July 31
> - Fall: September 1 – December 31
>
> The date range filter is ignored on the Semester report — it always shows all historical data so you can compare year over year.

### Managing Dropdowns

Staff names, vendor names, class names, and consumable item names that appear in dropdown menus are managed on the **Settings** page. Add or remove entries there — changes take effect immediately across all pages.

---

## Updating the Apps Script

If you make changes to `Code.gs`, you must create a **new deployment** for changes to take effect:

1. In Apps Script, click **Deploy → Manage deployments**
2. Click the pencil (edit) icon on your existing deployment
3. Change the version to **"New version"**
4. Click **Deploy**
5. The Web App URL stays the same — no changes needed in `api.js`

---

## Building the Deploy Package

Run the build script from the repo root to generate the `deploy/` folder with only the files needed for eQuella:

```bash
bash build.sh
```

Upload the contents of `deploy/` to your Open eQuella microsite and set `index.html` as the entry point. The `deploy/` folder is regenerated fresh each run and is not tracked by Git.

---

## File Reference

| File | Description |
|---|---|
| `Code.gs` | Google Apps Script backend — paste into Apps Script editor |
| `api.js` | Shared API wrapper, utility functions, CSV export. **Set `API_URL` here.** |
| `style.css` | Shared stylesheet for all pages |
| `index.html` | Dashboard with lab banner and live KPIs |
| `consumables.html` | Consumables CRUD with per-class tabs and restock |
| `hardware.html` | Hardware CRUD with calibration and service tracking |
| `daily-log.html` | Daily usage log |
| `reports.html` | Reports and CSV export, including semester/annual usage |
| `settings.html` | Dropdown management + setup instructions |
| `lab-banner.jpg` | Lab photo displayed on the dashboard |
| `build.sh` | Build script — copies eQuella files into `deploy/` |
