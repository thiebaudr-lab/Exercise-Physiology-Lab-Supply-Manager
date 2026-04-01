// ============================================================
// ExPhys LIMS — Google Apps Script Backend
// ============================================================
// SETUP INSTRUCTIONS:
//   1. Open your Google Sheet
//   2. Go to Extensions > Apps Script
//   3. Paste this entire file, replacing any existing code
//   4. Run initializeSheets() once from the editor (Run menu)
//   5. Deploy as Web App:
//        Deploy > New deployment > Web App
//        Execute as: Me
//        Who has access: Anyone (or Anyone with Google account)
//   6. Copy the Web App URL into api.js (API_URL constant)
// ============================================================

var ss = SpreadsheetApp.getActiveSpreadsheet();

var TABS = {
  consumables : 'Consumables',
  hardware    : 'Hardware',
  log         : 'Daily Log',
  vendors     : 'Vendors',
  staff       : 'Staff',
  classes     : 'Classes'
};

// ── Routers ──────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  var result;
  try {
    switch (action) {
      case 'getConsumables' : result = getRows(TABS.consumables); break;
      case 'getHardware'    : result = getRows(TABS.hardware);    break;
      case 'getDailyLog'    : result = getDailyLog(e.parameter);  break;
      case 'getVendors'     : result = getRows(TABS.vendors);     break;
      case 'getStaff'       : result = getRows(TABS.staff);       break;
      case 'getClasses'     : result = getRows(TABS.classes);     break;
      case 'getAll'         : result = getAll();                  break;
      default               : result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return respond(result);
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch (err) { return respond({ error: 'Invalid JSON: ' + err.toString() }); }

  var result;
  try {
    switch (data.action) {
      case 'addConsumable'    : result = addRow(TABS.consumables, data.row);               break;
      case 'updateConsumable' : result = updateRow(TABS.consumables, data.id, data.row);   break;
      case 'deleteConsumable' : result = deleteRow(TABS.consumables, data.id);             break;
      case 'addHardware'      : result = addRow(TABS.hardware, data.row);                  break;
      case 'updateHardware'   : result = updateRow(TABS.hardware, data.id, data.row);      break;
      case 'deleteHardware'   : result = deleteRow(TABS.hardware, data.id);                break;
      case 'addLogEntry'      : result = addLogEntry(data.row);                            break;
      case 'updateLogEntry'   : result = updateRow(TABS.log, data.id, data.row);           break;
      case 'deleteLogEntry'   : result = deleteRow(TABS.log, data.id);                     break;
      case 'addVendor'        : result = addRow(TABS.vendors, data.row);                   break;
      case 'deleteVendor'     : result = deleteRow(TABS.vendors, data.id);                 break;
      case 'addStaff'         : result = addRow(TABS.staff, data.row);                     break;
      case 'deleteStaff'      : result = deleteRow(TABS.staff, data.id);                   break;
      case 'addClass'         : result = addRow(TABS.classes, data.row);                   break;
      case 'deleteClass'      : result = deleteRow(TABS.classes, data.id);                 break;
      default                 : result = { error: 'Unknown action: ' + data.action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return respond(result);
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── CRUD Helpers ─────────────────────────────────────────────

function getSheet(name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found. Run initializeSheets() first.');
  return sheet;
}

function getRows(tabName) {
  var sheet = getSheet(tabName);
  if (sheet.getLastRow() < 2) return [];
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var tz      = ss.getSpreadsheetTimeZone();
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      var val = row[i];
      // Convert Date objects to ISO date strings for HTML date inputs
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      }
      obj[h] = (val === null || val === undefined) ? '' : val;
    });
    return obj;
  });
}

function getDailyLog(params) {
  var rows = getRows(TABS.log);
  if (params.class && params.class !== '') {
    rows = rows.filter(function (r) { return r['Class'] === params.class; });
  }
  if (params.from && params.from !== '') {
    rows = rows.filter(function (r) { return String(r['Date']) >= params.from; });
  }
  if (params.to && params.to !== '') {
    rows = rows.filter(function (r) { return String(r['Date']) <= params.to; });
  }
  // Return most recent first
  return rows.reverse();
}

function getAll() {
  return {
    consumables : getRows(TABS.consumables),
    hardware    : getRows(TABS.hardware),
    log         : getDailyLog({}),
    vendors     : getRows(TABS.vendors),
    staff       : getRows(TABS.staff),
    classes     : getRows(TABS.classes)
  };
}

function genId() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
}

function addRow(tabName, rowData) {
  var sheet   = getSheet(tabName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!rowData['ID']) rowData['ID'] = genId();
  var row = headers.map(function (h) {
    return (rowData[h] !== undefined && rowData[h] !== null) ? rowData[h] : '';
  });
  sheet.appendRow(row);
  return { success: true, id: rowData['ID'] };
}

function updateRow(tabName, id, rowData) {
  var sheet  = getSheet(tabName);
  var data   = sheet.getDataRange().getValues();
  var hdrs   = data[0];
  var idIdx  = hdrs.indexOf('ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      hdrs.forEach(function (h, j) {
        if (h !== 'ID' && rowData[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(rowData[h]);
        }
      });
      return { success: true };
    }
  }
  return { error: 'Row not found: ' + id };
}

function deleteRow(tabName, id) {
  var sheet = getSheet(tabName);
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];
  var idIdx = hdrs.indexOf('ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Row not found: ' + id };
}

// Log entry with auto-decrement of consumable quantity
function addLogEntry(rowData) {
  var result = addRow(TABS.log, rowData);

  if (rowData['Item Type'] === 'Consumable' && rowData['Item Name'] && rowData['Quantity Used']) {
    var sheet = getSheet(TABS.consumables);
    var data  = sheet.getDataRange().getValues();
    var hdrs  = data[0];
    var nameI = hdrs.indexOf('Name');
    var qtyI  = hdrs.indexOf('Quantity');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][nameI]) === String(rowData['Item Name'])) {
        var cur  = Number(data[i][qtyI]) || 0;
        var used = Number(rowData['Quantity Used']) || 0;
        sheet.getRange(i + 1, qtyI + 1).setValue(Math.max(0, cur - used));
        break;
      }
    }
  }

  return result;
}

// ── One-time Setup ───────────────────────────────────────────

function initializeSheets() {
  var defs = [
    {
      name: TABS.consumables,
      headers: ['ID', 'Name', 'Vendor', 'Unit', 'Units Per Pack', 'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Notes']
    },
    {
      name: TABS.hardware,
      headers: ['ID', 'Name', 'Vendor', 'Purchase Date', 'Cost', 'Warranty Expiry', 'Needs Calibration', 'Last Calibration', 'Next Calibration', 'Last Service', 'Next Service', 'Status', 'Notes']
    },
    {
      name: TABS.log,
      headers: ['ID', 'Date', 'Item Name', 'Item Type', 'Quantity Used', 'Class', 'Used By', 'Notes']
    },
    { name: TABS.vendors, headers: ['ID', 'Name'] },
    { name: TABS.staff,   headers: ['ID', 'Name'] },
    { name: TABS.classes, headers: ['ID', 'Name'] }
  ];

  defs.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) sheet = ss.insertSheet(def.name);
    if (sheet.getLastRow() === 0) {
      var r = sheet.getRange(1, 1, 1, def.headers.length);
      r.setValues([def.headers]);
      r.setBackground('#1a1f35').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  // Seed classes if empty
  var cs = ss.getSheetByName(TABS.classes);
  if (cs.getLastRow() < 2) {
    cs.getRange(2, 1, 3, 2).setValues([
      [genId(), 'ESS 375L Ex Phys Lab'],
      [genId(), 'ESS 497 Research'],
      [genId(), 'ESS 386 H&D']
    ]);
  }

  // Seed vendors if empty
  var vs = ss.getSheetByName(TABS.vendors);
  if (vs.getLastRow() < 2) {
    var vendors = ['Amazon', 'McKesson', 'lactate.com', 'Noraxon', 'Parvo', 'BYUI'];
    vs.getRange(2, 1, vendors.length, 2).setValues(
      vendors.map(function (v) { return [genId(), v]; })
    );
  }

  Logger.log('ExPhys LIMS sheets initialized successfully.');
}
