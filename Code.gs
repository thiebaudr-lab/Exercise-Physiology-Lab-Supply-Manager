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
  classes     : 'Classes',
  items       : 'Items',
  budget      : 'Budget',
  restockLog  : 'Restock Log',
  maintTasks  : 'Maintenance Tasks',
  maintLog    : 'Maintenance Log',
  batches     : 'Batches'
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
      case 'getItems'       : result = getRows(TABS.items);       break;
      case 'getBudget'      : result = getRows(TABS.budget);      break;
      case 'getRestockLog'  : result = getRows(TABS.restockLog);  break;
      case 'getMaintTasks'  : result = getRows(TABS.maintTasks);  break;
      case 'getMaintLog'    : result = getRows(TABS.maintLog);    break;
      case 'getBatches'     : result = getBatchesForItem(e.parameter.name, e.parameter.class); break;
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
      case 'addConsumable'     : result = addRow(TABS.consumables, data.row);                                          break;
      case 'updateConsumable'  : result = updateRow(TABS.consumables, data.id, data.row);                             break;
      case 'deleteConsumable'  : result = deleteRow(TABS.consumables, data.id);                                       break;
      case 'restockConsumable' : result = restockConsumable(data.id, data.qty, data.invoiceAmount, data.shippingTax, data.notes, data.expirationDate); break;
      case 'addBatch'          : result = addBatch(data.row);                                                             break;
      case 'deleteBatch'       : result = deleteBatch(data.id);                                                           break;
      case 'markOrdered'       : result = markOrdered(data.id, data.status);                                          break;
      case 'mergeConsumables'  : result = mergeConsumables(data.sourceId, data.targetId);                            break;
      case 'clearConsumables'  : result = clearConsumables();                                                         break;
      case 'addHardware'       : result = addRow(TABS.hardware, data.row);                                            break;
      case 'updateHardware'    : result = updateRow(TABS.hardware, data.id, data.row);                                break;
      case 'deleteHardware'    : result = deleteRow(TABS.hardware, data.id);                                          break;
      case 'addLogEntry'       : result = addLogEntry(data.row);                                                      break;
      case 'updateLogEntry'    : result = updateRow(TABS.log, data.id, data.row);                                     break;
      case 'deleteLogEntry'    : result = deleteRow(TABS.log, data.id);                                               break;
      case 'addVendor'         : result = addRow(TABS.vendors, data.row);                                             break;
      case 'updateVendor'      : result = renameVendor(data.id, data.row);                                            break;
      case 'deleteVendor'      : result = deleteRow(TABS.vendors, data.id);                                           break;
      case 'addStaff'          : result = addRow(TABS.staff, data.row);                                               break;
      case 'updateStaff'       : result = renameStaff(data.id, data.row['Name']);                                     break;
      case 'deleteStaff'       : result = deleteRow(TABS.staff, data.id);                                             break;
      case 'addClass'          : result = addRow(TABS.classes, data.row);                                             break;
      case 'updateClass'       : result = renameClass(data.id, data.row['Name']);                                     break;
      case 'deleteClass'       : result = deleteRow(TABS.classes, data.id);                                           break;
      case 'addItem'           : result = addRow(TABS.items, data.row);                                               break;
      case 'updateItem'        : result = renameItem(data.id, data.row['Name']);                                      break;
      case 'deleteItem'        : result = deleteRow(TABS.items, data.id);                                             break;
      case 'addBudgetEntry'    : result = addRow(TABS.budget, data.row);                                              break;
      case 'updateBudgetEntry' : result = updateRow(TABS.budget, data.id, data.row);                                  break;
      case 'deleteBudgetEntry' : result = deleteRow(TABS.budget, data.id);                                            break;
      case 'addMaintTask'      : result = addRow(TABS.maintTasks, data.row);                                          break;
      case 'updateMaintTask'   : result = updateRow(TABS.maintTasks, data.id, data.row);                              break;
      case 'deleteMaintTask'   : result = deleteRow(TABS.maintTasks, data.id);                                        break;
      case 'completeMaintTask' : result = completeMaintTask(data.taskId, data.log);                                   break;
      case 'deleteMaintLog'    : result = deleteRow(TABS.maintLog, data.id);                                          break;
      default                  : result = { error: 'Unknown action: ' + data.action };
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
  return rows.reverse();
}

function getAll() {
  return {
    consumables : getRows(TABS.consumables),
    hardware    : getRows(TABS.hardware),
    log         : getDailyLog({}),
    vendors     : getRows(TABS.vendors),
    staff       : getRows(TABS.staff),
    classes     : getRows(TABS.classes),
    budget      : getRows(TABS.budget),
    restockLog  : getRows(TABS.restockLog),
    maintTasks  : getRows(TABS.maintTasks),
    maintLog    : getRows(TABS.maintLog)
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

// Decrement a consumable by name+class; auto-creates the row with negative qty if not found
function decrementConsumable(name, cls, qty) {
  var sheet  = getSheet(TABS.consumables);
  var data   = sheet.getDataRange().getValues();
  var hdrs   = data[0];
  var nameI  = hdrs.indexOf('Name');
  var classI = hdrs.indexOf('Class');
  var qtyI   = hdrs.indexOf('Quantity');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nameI]) === String(name) && String(data[i][classI]) === String(cls)) {
      sheet.getRange(i + 1, qtyI + 1).setValue((Number(data[i][qtyI]) || 0) - qty);
      return;
    }
  }
  addRow(TABS.consumables, { 'Name': name, 'Class': cls, 'Quantity': -qty, 'Reorder Threshold': 0 });
}

// Log entry: auto-creates consumable row (Name+Class) if not found, then decrements
function addLogEntry(rowData) {
  var result = addRow(TABS.log, rowData);
  if (rowData['Item Type'] === 'Consumable' && rowData['Item Name'] && rowData['Class'] && rowData['Quantity Used']) {
    decrementConsumable(rowData['Item Name'], rowData['Class'], Number(rowData['Quantity Used']) || 0);
  }
  return result;
}

// Set or clear the Order Status flag on a consumable
function markOrdered(id, status) {
  return updateRow(TABS.consumables, id, { 'Order Status': status || 'Ordered' });
}

// Add qty to existing consumable stock, log to Restock Log, and optionally create a batch
function restockConsumable(id, qty, invoiceAmount, shippingTax, notes, expirationDate) {
  var sheet  = getSheet(TABS.consumables);
  var data   = sheet.getDataRange().getValues();
  var hdrs   = data[0];
  var idIdx  = hdrs.indexOf('ID');
  var qtyI   = hdrs.indexOf('Quantity');
  var nameI  = hdrs.indexOf('Name');
  var clsI   = hdrs.indexOf('Class');
  var orderI = hdrs.indexOf('Order Status');
  var expI   = hdrs.indexOf('Expiration Date');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      var cur    = Number(data[i][qtyI]) || 0;
      var name   = String(data[i][nameI]);
      var cls    = String(data[i][clsI]);
      var newQty = cur + Number(qty);
      sheet.getRange(i + 1, qtyI + 1).setValue(newQty);
      if (orderI >= 0) sheet.getRange(i + 1, orderI + 1).setValue('');

      var inv  = Number(invoiceAmount) || 0;
      var ship = Number(shippingTax)   || 0;
      var tz   = ss.getSpreadsheetTimeZone();
      var dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
      addRow(TABS.restockLog, {
        'Date'          : dateStr,
        'Item Name'     : name,
        'Class'         : cls,
        'Quantity'      : Number(qty),
        'Invoice Amount': inv,
        'Shipping Tax'  : ship,
        'Total Cost'    : inv + ship,
        'Notes'         : notes || ''
      });

      if (expirationDate) {
        addRow(TABS.batches, {
          'Item Name'      : name,
          'Class'          : cls,
          'Quantity'       : Number(qty),
          'Expiration Date': expirationDate,
          'Received Date'  : dateStr,
          'Notes'          : notes || ''
        });
        // Update Consumables exp date only if new date is earlier than existing (or none exists).
        // Consumables row is already in `data` — no need to re-read the sheet.
        var curExp = expI >= 0 ? String(data[i][expI]) : '';
        if (expI >= 0 && (!curExp || expirationDate < curExp)) {
          sheet.getRange(i + 1, expI + 1).setValue(expirationDate);
        }
      }

      return { success: true, newQty: newQty };
    }
  }
  return { error: 'Row not found: ' + id };
}

// Fetch all batches for a given item+class
function getBatchesForItem(name, cls) {
  var rows = getRows(TABS.batches);
  return rows.filter(function(b) {
    return b['Item Name'] === name && b['Class'] === cls;
  });
}

// Manually add a batch (without restocking — for recording existing stock at setup)
function addBatch(rowData) {
  var result = addRow(TABS.batches, rowData);
  recomputeExpDate(rowData['Item Name'], rowData['Class']);
  return result;
}

// Delete a batch and recompute the consumable's nearest expiration date
function deleteBatch(id) {
  var sheet = getSheet(TABS.batches);
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];
  var idIdx = hdrs.indexOf('ID');
  var nameI = hdrs.indexOf('Item Name');
  var clsI  = hdrs.indexOf('Class');
  var expI  = hdrs.indexOf('Expiration Date');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      var name = String(data[i][nameI]);
      var cls  = String(data[i][clsI]);
      // Compute remaining dates from already-read data — skip re-reading Batches sheet
      var remainingDates = [];
      for (var j = 1; j < data.length; j++) {
        if (j !== i && String(data[j][nameI]) === name && String(data[j][clsI]) === cls && data[j][expI]) {
          remainingDates.push(String(data[j][expI]));
        }
      }
      remainingDates.sort();
      sheet.deleteRow(i + 1);
      recomputeExpDate(name, cls, remainingDates);
      return { success: true };
    }
  }
  return { error: 'Batch not found: ' + id };
}

// Recompute the nearest upcoming expiration date across all batches for an item+class
// and write it back to the Consumables row so the table and dashboard stay current
// preSortedDates: optional sorted array of remaining exp dates — avoids re-reading Batches sheet
function recomputeExpDate(itemName, cls, preSortedDates) {
  var dates = preSortedDates !== undefined ? preSortedDates :
    getBatchesForItem(itemName, cls)
      .map(function(b) { return b['Expiration Date']; })
      .filter(Boolean)
      .sort();
  var nearest = dates.length > 0 ? dates[0] : '';

  var sheet = getSheet(TABS.consumables);
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];
  var nameI = hdrs.indexOf('Name');
  var clsI  = hdrs.indexOf('Class');
  var expI  = hdrs.indexOf('Expiration Date');
  if (expI < 0) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nameI]) === String(itemName) && String(data[i][clsI]) === String(cls)) {
      if (String(data[i][expI]) === String(nearest)) return; // no change — skip write
      sheet.getRange(i + 1, expI + 1).setValue(nearest);
      return;
    }
  }
}

// Mark a maintenance task complete: logs the event, optionally decrements a consumable, and auto-advances Next Due
function completeMaintTask(taskId, logData) {
  var tz          = ss.getSpreadsheetTimeZone();
  var dateStr     = logData['Date'] || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  addRow(TABS.maintLog, {
    'Date'         : dateStr,
    'Hardware ID'  : logData['Hardware ID']   || '',
    'Hardware Name': logData['Hardware Name'] || '',
    'Task Name'    : logData['Task Name']     || '',
    'Completed By' : logData['Completed By']  || '',
    'Supplies Used': logData['Supplies Used'] || '',
    'Notes'        : logData['Notes']         || ''
  });

  var cQty = Number(logData['Consumable Qty']) || 0;
  if (logData['Consumable Name'] && logData['Consumable Class'] && cQty > 0) {
    decrementConsumable(logData['Consumable Name'], logData['Consumable Class'], cQty);
  }

  var sheet      = getSheet(TABS.maintTasks);
  var data       = sheet.getDataRange().getValues();
  var hdrs       = data[0];
  var idIdx      = hdrs.indexOf('ID');
  var freqIdx    = hdrs.indexOf('Frequency');
  var nextDueIdx = hdrs.indexOf('Next Due');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(taskId)) {
      var nextDue = advanceDate(new Date(dateStr + 'T00:00:00'), String(data[i][freqIdx]));
      if (nextDue) {
        sheet.getRange(i + 1, nextDueIdx + 1).setValue(Utilities.formatDate(nextDue, tz, 'yyyy-MM-dd'));
      }
      return { success: true };
    }
  }
  return { error: 'Task not found: ' + taskId };
}

// Returns the next due date based on frequency string.
// Named presets: Monthly, Every 3 Months, Every 6 Months, Annually.
// Custom format: "Every N Days|Weeks|Months|Years" (e.g. "Every 2 Weeks").
// Returns null only if frequency is unrecognizable (Next Due left unchanged).
function advanceDate(fromDate, frequency) {
  var d = new Date(fromDate.getTime());
  switch (frequency) {
    case 'Monthly':        d.setMonth(d.getMonth() + 1);       return d;
    case 'Every 3 Months': d.setMonth(d.getMonth() + 3);       return d;
    case 'Every 6 Months': d.setMonth(d.getMonth() + 6);       return d;
    case 'Annually':       d.setFullYear(d.getFullYear() + 1); return d;
    default:
      var m = frequency.match(/^Every (\d+) (Day|Days|Week|Weeks|Month|Months|Year|Years)$/i);
      if (!m) return null;
      var n    = parseInt(m[1], 10);
      var unit = m[2].toLowerCase();
      if (unit.startsWith('day'))   d.setDate(d.getDate() + n);
      else if (unit.startsWith('week'))  d.setDate(d.getDate() + n * 7);
      else if (unit.startsWith('month')) d.setMonth(d.getMonth() + n);
      else if (unit.startsWith('year'))  d.setFullYear(d.getFullYear() + n);
      return d;
  }
}

// Merge sourceId into targetId: add quantities, move batches, delete source row
function mergeConsumables(sourceId, targetId) {
  var sheet = getSheet(TABS.consumables);
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];
  var idIdx = hdrs.indexOf('ID');
  var qtyI  = hdrs.indexOf('Quantity');
  var nameI = hdrs.indexOf('Name');
  var clsI  = hdrs.indexOf('Class');

  var srcRow = -1, tgtRow = -1;
  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][idIdx]);
    if (rowId === String(sourceId)) srcRow = i;
    if (rowId === String(targetId)) tgtRow = i;
  }
  if (srcRow < 0) return { error: 'Source row not found: ' + sourceId };
  if (tgtRow < 0) return { error: 'Target row not found: ' + targetId };

  var srcQty  = Number(data[srcRow][qtyI]) || 0;
  var tgtQty  = Number(data[tgtRow][qtyI]) || 0;
  var srcName = String(data[srcRow][nameI]);
  var srcCls  = String(data[srcRow][clsI]);
  var tgtName = String(data[tgtRow][nameI]);
  var tgtCls  = String(data[tgtRow][clsI]);

  // Update target quantity
  sheet.getRange(tgtRow + 1, qtyI + 1).setValue(srcQty + tgtQty);

  // Re-assign any batch records from source to target
  var bSheet = getSheet(TABS.batches);
  var bData  = bSheet.getDataRange().getValues();
  var bHdrs  = bData[0];
  var bNameI = bHdrs.indexOf('Item Name');
  var bClsI  = bHdrs.indexOf('Class');
  for (var j = 1; j < bData.length; j++) {
    if (String(bData[j][bNameI]) === srcName && String(bData[j][bClsI]) === srcCls) {
      bSheet.getRange(j + 1, bNameI + 1).setValue(tgtName);
      bSheet.getRange(j + 1, bClsI  + 1).setValue(tgtCls);
    }
  }

  // Delete the source row (re-read to get accurate row index after no structural changes above)
  sheet.deleteRow(srcRow + 1);

  // Recompute expiration date on target
  recomputeExpDate(tgtName, tgtCls);

  return { success: true };
}

// Rename a class and cascade the new name to all tabs that store class names
function renameClass(id, newName) {
  var oldName = '';
  var rows = getRows(TABS.classes);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['ID']) === String(id)) { oldName = rows[i]['Name']; break; }
  }
  if (!oldName) return { error: 'Class not found: ' + id };
  if (oldName === newName) return { success: true };

  var result = updateRow(TABS.classes, id, { 'Name': newName });
  if (result.error) return result;

  // Cascade to all tabs with a 'Class' column
  var cascadeTabs = [
    { tab: TABS.consumables, col: 'Class' },
    { tab: TABS.log,         col: 'Class' },
    { tab: TABS.restockLog,  col: 'Class' },
    { tab: TABS.budget,      col: 'Class' },
    { tab: TABS.batches,     col: 'Class' }
  ];
  cascadeTabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data  = sheet.getDataRange().getValues();
    var hdrs  = data[0];
    var colI  = hdrs.indexOf(t.col);
    if (colI < 0) return;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][colI]) === oldName) {
        sheet.getRange(r + 1, colI + 1).setValue(newName);
      }
    }
  });

  return { success: true };
}

// Rename a staff member and cascade to log entries
function renameStaff(id, newName) {
  var oldName = '';
  var rows = getRows(TABS.staff);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['ID']) === String(id)) { oldName = rows[i]['Name']; break; }
  }
  if (!oldName) return { error: 'Staff not found: ' + id };
  if (oldName === newName) return { success: true };

  var result = updateRow(TABS.staff, id, { 'Name': newName });
  if (result.error) return result;

  // Cascade to Daily Log 'Used By' and Maintenance Log 'Completed By'
  var cascadeTabs = [
    { tab: TABS.log,      col: 'Used By' },
    { tab: TABS.maintLog, col: 'Completed By' }
  ];
  cascadeTabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data  = sheet.getDataRange().getValues();
    var hdrs  = data[0];
    var colI  = hdrs.indexOf(t.col);
    if (colI < 0) return;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][colI]) === oldName) {
        sheet.getRange(r + 1, colI + 1).setValue(newName);
      }
    }
  });

  return { success: true };
}

// Rename an item and cascade to Consumables (Name) and Daily Log (Item Name)
function renameItem(id, newName) {
  var oldName = '';
  var rows = getRows(TABS.items);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['ID']) === String(id)) { oldName = rows[i]['Name']; break; }
  }
  if (!oldName) return { error: 'Item not found: ' + id };
  if (oldName === newName) return { success: true };

  var result = updateRow(TABS.items, id, { 'Name': newName });
  if (result.error) return result;

  var cascadeTabs = [
    { tab: TABS.consumables, col: 'Name' },
    { tab: TABS.log,         col: 'Item Name' },
    { tab: TABS.restockLog,  col: 'Item Name' },
    { tab: TABS.batches,     col: 'Item Name' }
  ];
  cascadeTabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getDataRange().getValues();
    var hdrs = data[0];
    var colI = hdrs.indexOf(t.col);
    if (colI < 0) return;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][colI]) === oldName) {
        sheet.getRange(r + 1, colI + 1).setValue(newName);
      }
    }
  });

  return { success: true };
}

// Update vendor contact info; if name changed, cascade to Consumables and Hardware
function renameVendor(id, rowData) {
  var newName = rowData['Name'];
  var oldName = '';

  if (newName !== undefined) {
    var rows = getRows(TABS.vendors);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i]['ID']) === String(id)) { oldName = rows[i]['Name']; break; }
    }
    if (!oldName) return { error: 'Vendor not found: ' + id };
  }

  var result = updateRow(TABS.vendors, id, rowData);
  if (result.error) return result;

  // Cascade name change to Consumables and Hardware 'Vendor' column
  if (newName !== undefined && oldName && oldName !== newName) {
    var cascadeTabs = [TABS.consumables, TABS.hardware];
    cascadeTabs.forEach(function(tabName) {
      var sheet = ss.getSheetByName(tabName);
      if (!sheet || sheet.getLastRow() < 2) return;
      var data  = sheet.getDataRange().getValues();
      var hdrs  = data[0];
      var colI  = hdrs.indexOf('Vendor');
      if (colI < 0) return;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][colI]) === oldName) {
          sheet.getRange(r + 1, colI + 1).setValue(newName);
        }
      }
    });
  }

  return { success: true };
}

// Wipe all consumable rows (keeps header row)
function clearConsumables() {
  var sheet = getSheet(TABS.consumables);
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  return { success: true };
}

// Called by a time-based trigger every 5 minutes to prevent Apps Script cold starts.
// Setup: Apps Script editor → Triggers (clock icon) → Add Trigger
//   Function: keepWarm | Event source: Time-driven | Type: Minutes timer | Every 5 minutes
function keepWarm() {
  return { ok: true, ts: new Date().toISOString() };
}

// ── One-time Setup ───────────────────────────────────────────

function initializeSheets() {
  var defs = [
    {
      name: TABS.consumables,
      headers: ['ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack', 'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes']
    },
    {
      name: TABS.hardware,
      headers: ['ID', 'Name', 'Model Number', 'Serial Number', 'BYU-ID', 'Vendor', 'Purchase Date', 'Cost', 'Status', 'Notes']
    },
    {
      name: TABS.log,
      headers: ['ID', 'Date', 'Item Name', 'Item Type', 'Quantity Used', 'Class', 'Used By', 'Notes']
    },
    { name: TABS.vendors,    headers: ['ID', 'Name', 'Phone', 'Email', 'Website'] },
    { name: TABS.staff,      headers: ['ID', 'Name'] },
    { name: TABS.classes,    headers: ['ID', 'Name'] },
    { name: TABS.items,      headers: ['ID', 'Name'] },
    {
      name: TABS.budget,
      headers: ['ID', 'Class', 'Semester', 'Year', 'Total Enrollment', 'Course Fee Per Student', 'Semester Total', 'Notes']
    },
    {
      name: TABS.restockLog,
      headers: ['ID', 'Date', 'Item Name', 'Class', 'Quantity', 'Invoice Amount', 'Shipping Tax', 'Total Cost', 'Notes']
    },
    {
      name: TABS.maintTasks,
      headers: ['ID', 'Hardware ID', 'Hardware Name', 'Task Name', 'Frequency', 'Supplies Needed', 'Next Due', 'Notes']
    },
    {
      name: TABS.maintLog,
      headers: ['ID', 'Date', 'Hardware ID', 'Hardware Name', 'Task Name', 'Completed By', 'Supplies Used', 'Notes']
    },
    {
      name: TABS.batches,
      headers: ['ID', 'Item Name', 'Class', 'Quantity', 'Expiration Date', 'Received Date', 'Notes']
    }
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
    var vendors = ['Amazon', 'McKesson', 'lactate.com', 'Noraxon', 'Parvo', 'BYUI', 'Cosmed'];
    vs.getRange(2, 1, vendors.length, 2).setValues(
      vendors.map(function (v) { return [genId(), v]; })
    );
  }

  var SUPPLY_NAMES = [
    'Alcohol Wipes','Sandpaper Pieces','Caprison','Jolly Rancher','Granola Bar',
    'Athletic Gauze Roll','Athletic Tape Rolls','Bandaids','Battery AAA','Battery 9V',
    'Battery CR2450','Battery CR 2025','Gauze','Kim Wipes','Lactate Strips',
    'Lactate Control Solution','Electrodes','Razors','S Gloves Pairs','M Gloves Pairs',
    'L Gloves Pairs','Lancets','Disinfectant Gallons','Resting ECG Electrodes',
    'Germicidal Wipes','Electrode Stickers','Metabolic Tube',
    'PermaPure Drying Tubes and Filters','PermaPure Drying Loop for Auto-Cal Circuit',
    'Blue Water Trap Filters','Exercise Calibration Gas','Gas Regulator',
    'Gas Washers','Command Strips','Posters'
  ];

  var its = ss.getSheetByName(TABS.items);
  if (its.getLastRow() < 2) {
    its.getRange(2, 1, SUPPLY_NAMES.length, 2).setValues(
      SUPPLY_NAMES.map(function(n) { return [genId(), n]; })
    );
  }

  Logger.log('ExPhys LIMS sheets initialized successfully.');
}
