# ExPhys LIMS — Exercise Physiology Lab Information Management System

A lightweight, browser-based system for tracking lab supplies, equipment calibration, and daily usage in an exercise physiology lab. Hosted as a static microsite on Open eQuella with Google Sheets as the database.

---

## What It Does

| Page | Purpose |
|---|---|
| **Dashboard** | Live KPIs — budget overview, low stock count, expiring items, maintenance alerts |
| **Consumables** | Per-class supply inventory with reorder thresholds, expiration date / batch tracking, restock, and merge duplicates |
| **Hardware** | Track equipment with model/serial/BYU-ID; per-device maintenance tasks, history, and inventory deduction |
| **Daily Log** | Record supply usage by class; auto-decrements consumable inventory; CSV bulk import |
| **Reports** | Usage pivot, reorder report (with vendor contact and order status), calibration status, and semester/annual usage trends — all exportable to CSV |
| **Budget** | Per-class course fee budget tracking — semester enrollment entry, spending history, remaining balance |
| **Settings** | Manage Staff, Vendor (with contact info), Class, and Item Name dropdowns; connection test |

---

## Key Concepts

### Per-Class Inventory

Consumables are tracked **per class** — the same item (e.g., "Alcohol Wipes") has a separate stock row for each class that uses it (ESS 375L, ESS 497, ESS 386 H&D). This reflects the physical reality of supplies being allocated per course.

### Auto-Create on First Log

You do not need to manually add every consumable before the semester starts. When you log usage in the Daily Log for an item+class combination that has no stock row yet, the system **automatically creates the row** with a negative quantity (showing a deficit). You then use the **Restock** button to enter the actual quantity on hand, which adds to the current value.

### Restock vs. Set

The **Restock** action is additive — it adds the received quantity to the current stock. If you receive 200 alcohol wipes and the row currently shows −12 (used before stock was entered), restocking 200 results in 188.

When you restock, you can also enter the **Invoice Amount** and **Shipping & Tax Costs**. These are recorded in the Restock Log and rolled into the total cost spent for that class — which feeds the Budget page spending calculations.

### Expiration Date / Batch Tracking

When restocking, you can optionally enter an **Expiration Date** to create a lot-level batch record. Each batch is stored in the Batches tab. The Consumables row automatically tracks the nearest upcoming expiration date across all lots for that item+class. You can view, add, and delete batches from the **Expiration Batches** modal on the Consumables page.

The Dashboard **Low Stock** panel also surfaces items expiring within 30 days.

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

This creates twelve tabs (Consumables, Hardware, Daily Log, Vendors, Staff, Classes, Items, Budget, Restock Log, Maintenance Tasks, Maintenance Log, Batches) and pre-populates Vendors, Classes, and the Items name lookup with default values.

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
budget.html
settings.html
style.css
api.js
lab-banner.jpg
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

### Bulk Importing Log Entries (CSV)

If you have a backlog of entries in a spreadsheet, you can import them in bulk:

1. Go to **Daily Log** → expand the **Bulk Import from CSV** panel
2. Click **Download Template** to get a pre-formatted CSV file
3. Fill in the template (columns: Item, Quantity, Class, Date, Initials, Notes) and save it
4. Click **Upload CSV** and select your file
5. Review each row in the preview table — you can edit any field or remove rows
6. Click **Import All** to submit

Each imported row follows the same auto-decrement logic as a manually entered log entry.

### Restocking Supplies

1. Go to **Consumables**
2. Find the item and click **Restock**
3. Enter the **Quantity Received** — this is **added** to the current quantity on hand
4. Optionally enter the **Invoice Amount** and **Shipping & Tax Costs** — these are logged to the Restock Log and included in Budget spending totals for the item's class
5. Optionally enter an **Expiration Date** to record this lot as a batch — the consumable's expiration date will be updated if this lot expires sooner than any existing batch

### Tracking Expiration Dates

Click **Batches** on any consumable row to open the Expiration Batches modal. Here you can:
- View all lots on hand with their quantities and expiration dates
- Add a batch manually (for recording existing stock at setup)
- Delete a batch that has been fully consumed

The consumable row always shows the nearest upcoming expiration date. Items expiring within 30 days appear in the Dashboard **Low Stock** panel.

### Merging Duplicate Entries

If the same item+class ends up with two rows (e.g., created via auto-create and then added manually), click **Merge** on either row. Select the row to keep — the quantities are combined and the duplicate is deleted.

### Tracking Hardware

1. Go to **Hardware** → click **+ Add Hardware**
2. Enter the equipment name, Model Number, Serial Number, and BYU-ID (university asset tag)
3. Click **🔧 Maintenance** on any device to manage its maintenance tasks

**Adding maintenance tasks:**
1. In the Maintenance modal, click **+ Add Task**
2. Enter the task name (e.g. "Belt Lubrication"), frequency, next due date, and supplies needed
3. Frequency options: Monthly, Every 3 Months, Every 6 Months, Annually, or a custom interval (e.g. "Every 2 Weeks")
4. When a task is due within 14 days the device row turns amber; overdue turns red. The Dashboard Maintenance Alerts panel shows all tasks due soon

**Marking tasks complete:**
1. Click **✓ Complete** on a task
2. Enter the date, who completed it, and any notes
3. Optionally select a **Class** and **Item** to deduct consumable inventory at the same time (e.g. sampling lines replaced from ESS 375L stock)
4. The Next Due date auto-advances based on the task frequency

**Viewing history:**
Click the **History** tab in the Maintenance modal to see a full log of past completions for that device.

### Running Reports

1. Go to **Reports**
2. Use the filter bar at the top to narrow by Class and/or date range
3. Four reports update automatically:
   - **Usage Summary** — total quantity used per item, number of sessions, top user and class
   - **Reorder Report** — all consumables at or below their reorder threshold, with vendor contact info; click **Mark Ordered** to flag items already on order
   - **Maintenance Status** — all maintenance tasks across all devices, sorted by urgency
   - **Semester & Annual Usage** — consumable totals broken down by Winter / Spring / Fall and year, per class. Use this to plan ordering quantities for upcoming semesters.
4. Click **Export CSV** on any section to download that report, or **Export All CSV** to download all four

> **Semester boundaries (BYUI calendar):**
> - Winter: January 1 – April 10
> - Spring: April 15 – July 31
> - Fall: September 1 – December 31
>
> The date range filter is ignored on the Semester report — it always shows all historical data so you can compare year over year.

### Managing the Budget

The Budget page tracks course fee spending per class and semester.

**Setting semester budgets:**
1. Go to **Budget**
2. Use the year selector to choose the fiscal year (calendar year Jan–Dec)
3. Click **+ Add Budget Entry**
4. Select the class, semester, and enter **Total Enrollment** (sum of all sections for that semester)
5. Enter the **Course Fee Per Student** — the Semester Total auto-calculates
6. Save the entry — the KPI cards at the top update immediately

> Classes without a course fee (e.g., ESS 386 H&D) show total spending only — no allocated budget or remaining balance.

**Viewing spending:**
The Budget page shows a spending history table of all restock entries with their invoice amounts and shipping/tax costs. Use **Export Spending CSV** to download the full history.

The Dashboard Budget Overview shows a compact summary of remaining balance per class for the current fiscal year.

---

### Managing Dropdowns

Staff names, vendor names, class names, and consumable item names that appear in dropdown menus are managed on the **Settings** page. Add or remove entries there — changes take effect immediately across all pages.

Vendor entries support optional **Phone**, **Email**, and **Website** fields. These appear as contact info in the Reorder Report. Staff and Class names can also be renamed (inline edit) without losing historical data.

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
| `api.js` | Shared API wrapper, utility functions, sessionStorage caching, CSV export. **Set `API_URL` here.** |
| `style.css` | Shared stylesheet for all pages |
| `index.html` | Dashboard with lab banner and live KPIs (low stock, expiring items, maintenance) |
| `consumables.html` | Consumables CRUD with per-class tabs, expiration batch tracking, restock, and merge |
| `hardware.html` | Hardware CRUD with model/serial/BYU-ID; per-device maintenance task management and history |
| `daily-log.html` | Daily usage log with CSV bulk import |
| `reports.html` | Reports and CSV export — usage summary, reorder (with vendor contact + order status), maintenance, semester/annual |
| `budget.html` | Per-class budget tracking — semester enrollment, spending history, remaining balance |
| `settings.html` | Dropdown management, vendor contact info, connection test |
| `lab-banner.jpg` | Lab photo displayed on the dashboard |
| `build.sh` | Build script — copies eQuella files into `deploy/` |
