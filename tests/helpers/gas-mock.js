/**
 * Lightweight Google Apps Script global mocks.
 *
 * Call setupGasMocks() before evaluating Code.gs.
 * Use makeSheetDB(tabName, headers, rows) to build in-memory sheet state
 * that the mock SpreadsheetApp will serve.
 */

// ── In-memory sheet store ─────────────────────────────────────

/**
 * tabName → { headers: string[], rows: any[][] }
 * rows does NOT include the header row — that is stored separately.
 */
export const sheetDB = {};

export function resetSheetDB() {
  for (const k in sheetDB) delete sheetDB[k];
}

/**
 * Seed a tab with headers and data rows.
 * @param {string} tabName
 * @param {string[]} headers
 * @param {any[][]} rows  — each row is a plain array aligned to headers
 */
export function makeSheetDB(tabName, headers, rows = []) {
  sheetDB[tabName] = { headers: [...headers], rows: rows.map(r => [...r]) };
}

// ── Sheet mock ────────────────────────────────────────────────

function makeMockSheet(tabName) {
  const db = () => sheetDB[tabName];

  return {
    getName: () => tabName,

    getLastRow() {
      const d = db();
      return d ? 1 + d.rows.length : 0;
    },

    getLastColumn() {
      const d = db();
      return d ? d.headers.length : 0;
    },

    getDataRange() {
      return this.getRange(1, 1, this.getLastRow(), this.getLastColumn());
    },

    getRange(row, col, numRows, numCols) {
      const d = db();
      // Build a 2D values array on demand
      const allRows = d ? [d.headers, ...d.rows] : [];

      return {
        getValues() {
          const r1 = row - 1;
          const c1 = col - 1;
          const r2 = numRows !== undefined ? r1 + numRows : allRows.length;
          const c2 = numCols !== undefined ? c1 + numCols : (d ? d.headers.length : 0);
          return allRows.slice(r1, r2).map(r => r.slice(c1, c2));
        },
        getValue() {
          return (allRows[row - 1] || [])[col - 1] ?? '';
        },
        setValue(val) {
          // row and col are 1-based; row 1 = header, so first data row is row 2 → index 0
          const dataRowIdx = row - 2;
          const colIdx     = col - 1; // col is 1-based → 0-based index
          if (dataRowIdx >= 0 && d) {
            while (d.rows.length <= dataRowIdx) d.rows.push(new Array(d.headers.length).fill(''));
            d.rows[dataRowIdx][colIdx] = val;
          }
        },
        setValues(vals) {
          vals.forEach((rowVals, ri) => {
            rowVals.forEach((v, ci) => {
              const dataRowIdx = (row - 2) + ri;
              const colIdx     = (col - 1) + ci;
              if (dataRowIdx >= 0 && d) {
                while (d.rows.length <= dataRowIdx) d.rows.push(new Array(d.headers.length).fill(''));
                d.rows[dataRowIdx][colIdx] = v;
              }
            });
          });
        }
      };
    },

    appendRow(rowArray) {
      const d = db();
      if (d) d.rows.push([...rowArray]);
    },

    deleteRow(rowNumber) {
      // rowNumber is 1-based; row 1 = header
      const d = db();
      if (d) d.rows.splice(rowNumber - 2, 1);
    },

    deleteRows(startRow, numRows) {
      const d = db();
      if (d) d.rows.splice(startRow - 2, numRows);
    }
  };
}

// ── SpreadsheetApp mock ───────────────────────────────────────

export function buildSpreadsheetApp() {
  const mockSS = {
    getSpreadsheetTimeZone: () => 'America/Denver',
    getSheetByName: (name) => sheetDB[name] ? makeMockSheet(name) : null
  };

  return {
    getActiveSpreadsheet: () => mockSS,
    openById: () => mockSS
  };
}

// ── Utilities mock ────────────────────────────────────────────

export function buildUtilities() {
  let uuidCounter = 0;
  return {
    formatDate(date, _tz, fmt) {
      // Only supports 'yyyy-MM-dd'
      if (fmt === 'yyyy-MM-dd') {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return String(date);
    },
    getUuid() {
      uuidCounter++;
      return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, '0')}`;
    }
  };
}

// ── PropertiesService mock ────────────────────────────────────

export function buildPropertiesService(props = {}) {
  const store = { ...props };
  return {
    getScriptProperties: () => ({
      getProperty: (key) => store[key] || null,
      setProperty: (key, val) => { store[key] = val; }
    })
  };
}

// ── UrlFetchApp mock ──────────────────────────────────────────

export function buildUrlFetchApp(responseMap = {}) {
  return {
    fetch(url, _options) {
      const entry = responseMap[url] || responseMap['*'];
      if (!entry) throw new Error('UrlFetchApp: no mock for URL: ' + url);
      return {
        getResponseCode: () => entry.code,
        getContentText: () => typeof entry.body === 'string' ? entry.body : JSON.stringify(entry.body)
      };
    }
  };
}

// ── ContentService mock ───────────────────────────────────────

export function buildContentService() {
  return {
    createTextOutput: (text) => ({
      setMimeType: () => ({ _text: text })
    }),
    MimeType: { JSON: 'application/json' }
  };
}

// ── Setup all globals ─────────────────────────────────────────

/**
 * Inject all GAS globals into globalThis so Code.gs can use them.
 * @param {object} overrides  — optional per-mock overrides
 */
export function setupGasMocks({
  scriptProperties = {},
  urlFetchResponses = {}
} = {}) {
  resetSheetDB();
  const sp = buildSpreadsheetApp();
  globalThis.SpreadsheetApp      = sp;
  globalThis.ss                  = sp.getActiveSpreadsheet();
  globalThis.Utilities           = buildUtilities();
  globalThis.PropertiesService   = buildPropertiesService(scriptProperties);
  globalThis.UrlFetchApp         = buildUrlFetchApp(urlFetchResponses);
  globalThis.ContentService      = buildContentService();
}
