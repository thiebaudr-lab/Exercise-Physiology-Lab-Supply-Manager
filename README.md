# ExPhys LIMS — Exercise Physiology Lab Information Management System

A lightweight, browser-based system for tracking lab supplies, equipment calibration, and daily usage in an exercise physiology lab. Hosted as a static microsite on Open eQuella with Google Sheets as the database.

---

## What It Does

| Page | Purpose |
|---|---|
| **Dashboard** | Live KPIs — low stock count, calibration alerts, recent activity |
| **Consumables** | Add, edit, delete supply inventory with reorder thresholds |
| **Hardware** | Track equipment, calibration schedules, and service dates |
| **Daily Log** | Record supply usage by class; auto-decrements consumable inventory |
| **Reports** | Usage pivot by item, reorder report, calibration status — all exportable to CSV |
| **Settings** | Manage Staff, Vendor, and Class dropdown options |

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

This creates six tabs (Consumables, Hardware, Daily Log, Vendors, Staff, Classes) and pre-populates the Vendors and Classes dropdowns with the default values.

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

Open `api.js` in this repository and replace the placeholder on line 10:

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

1. Go to **Consumables** → click **+ Add Consumable**
2. Fill in Name, Vendor, Unit, Quantity, and Reorder Threshold
3. The Reorder Threshold triggers an alert on the Dashboard when stock falls at or below that number

### Logging Daily Usage

1. Go to **Daily Log** → fill in the form at the top
2. Select **Consumable** or **Hardware** as the item type — the Item Name dropdown updates accordingly
3. When you log a consumable, the quantity in the Consumables tab is automatically decremented
4. To edit a past entry, click **Edit** on any row — the form switches to edit mode

### Tracking Hardware

1. Go to **Hardware** → click **+ Add Hardware**
2. Check **"This equipment requires periodic calibration"** to enable calibration date fields
3. Equipment with calibration due within 14 days appears as **Due Soon** (amber); past due shows as **Overdue** (red)
4. Both the Dashboard and Reports page surface overdue items automatically

### Running Reports

1. Go to **Reports**
2. Use the filter bar to narrow by Class and/or date range
3. Three reports update automatically:
   - **Usage Summary** — total quantity used per item, number of sessions, top user and class
   - **Reorder Report** — all consumables at or below their reorder threshold
   - **Calibration Status** — all equipment requiring calibration, sorted by urgency
4. Click **Export CSV** on any section to download that report, or **Export All CSV** to download all three

### Managing Dropdowns

Staff names, vendor names, and class names that appear in dropdown menus are managed on the **Settings** page. Add or remove entries there — changes take effect immediately across all pages.

---

## Updating the Apps Script

If you make changes to `Code.gs`, you must create a **new deployment** for changes to take effect:

1. In Apps Script, click **Deploy → Manage deployments**
2. Click the pencil (edit) icon on your existing deployment
3. Change the version to **"New version"**
4. Click **Deploy**
5. The Web App URL stays the same — no changes needed in `api.js`

---

## File Reference

| File | Description |
|---|---|
| `Code.gs` | Google Apps Script backend — paste into Apps Script editor |
| `api.js` | Shared API wrapper, utility functions, CSV export. **Set `API_URL` here.** |
| `style.css` | Shared stylesheet for all pages |
| `index.html` | Dashboard |
| `consumables.html` | Consumables CRUD |
| `hardware.html` | Hardware CRUD |
| `daily-log.html` | Daily usage log |
| `reports.html` | Reports and CSV export |
| `settings.html` | Dropdown management + setup instructions |
