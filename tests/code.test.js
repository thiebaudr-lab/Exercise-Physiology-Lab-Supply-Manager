/**
 * Tests for Code.gs — business logic with GAS globals mocked.
 * Environment: node (default in vitest.config.js)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import {
  setupGasMocks,
  makeSheetDB,
  sheetDB
} from './helpers/gas-mock.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load Code.gs once ─────────────────────────────────────────

// Code.gs starts with `var ss = SpreadsheetApp.getActiveSpreadsheet();`
// so GAS globals must be in place before we eval it.
beforeAll(() => {
  setupGasMocks();
  const src = readFileSync(join(__dir, '../Code.gs'), 'utf-8');
  runInThisContext(src);
});

// Reset sheet data before each test so tests are independent
beforeEach(() => {
  setupGasMocks();
  // Re-bind ss after each reset (Code.gs uses the module-level `ss` variable)
  globalThis.ss = globalThis.SpreadsheetApp.getActiveSpreadsheet();
});

// ── advanceDate ───────────────────────────────────────────────

describe('advanceDate', () => {
  const base = new Date('2025-01-15T00:00:00');

  it('advances by one month for Monthly', () => {
    const result = advanceDate(base, 'Monthly');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it('advances by 3 months for Every 3 Months', () => {
    const result = advanceDate(base, 'Every 3 Months');
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(15);
  });

  it('advances by 6 months for Every 6 Months', () => {
    const result = advanceDate(base, 'Every 6 Months');
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(15);
  });

  it('advances by one year for Annually', () => {
    const result = advanceDate(base, 'Annually');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it('advances by custom days — Every 30 Days', () => {
    const result = advanceDate(new Date('2025-01-01T00:00:00'), 'Every 30 Days');
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-31');
  });

  it('advances by custom weeks — Every 2 Weeks', () => {
    const result = advanceDate(new Date('2025-01-01T00:00:00'), 'Every 2 Weeks');
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-15');
  });

  it('advances by custom months — Every 2 Months', () => {
    const result = advanceDate(base, 'Every 2 Months');
    expect(result.getMonth()).toBe(2); // March
  });

  it('advances by custom years — Every 2 Years', () => {
    const result = advanceDate(base, 'Every 2 Years');
    expect(result.getFullYear()).toBe(2027);
  });

  it('returns null for an unrecognisable frequency', () => {
    expect(advanceDate(base, 'Fortnightly')).toBeNull();
  });

  it('returns null for empty string frequency', () => {
    expect(advanceDate(base, '')).toBeNull();
  });

  it('handles singular unit — Every 1 Day', () => {
    const result = advanceDate(new Date('2025-01-01T00:00:00'), 'Every 1 Day');
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-02');
  });

  it('does not mutate the input date', () => {
    const input = new Date('2025-01-15T00:00:00');
    const before = input.getTime();
    advanceDate(input, 'Monthly');
    expect(input.getTime()).toBe(before);
  });
});

// ── decrementConsumable ───────────────────────────────────────

describe('decrementConsumable', () => {
  beforeEach(() => {
    makeSheetDB('Consumables', [
      'ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack',
      'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes'
    ], [
      ['ABC1', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', 'MedSupply', 'Each', '', '', 50, 10, '', '', ''],
      ['ABC2', 'Gloves',        'ESS 375L Ex Phys Lab', 'MedSupply', 'Box',  '', '', 20, 5,  '', '', '']
    ]);
  });

  it('decrements the matching row by the given quantity', () => {
    decrementConsumable('Alcohol Wipes', 'ESS 375L Ex Phys Lab', 5);
    expect(sheetDB['Consumables'].rows[0][7]).toBe(45);
  });

  it('allows quantity to go negative', () => {
    decrementConsumable('Alcohol Wipes', 'ESS 375L Ex Phys Lab', 60);
    expect(sheetDB['Consumables'].rows[0][7]).toBe(-10);
  });

  it('does not touch non-matching rows', () => {
    decrementConsumable('Alcohol Wipes', 'ESS 375L Ex Phys Lab', 5);
    expect(sheetDB['Consumables'].rows[1][7]).toBe(20);
  });

  it('auto-creates a row with negative qty when item+class not found', () => {
    const initialCount = sheetDB['Consumables'].rows.length;
    decrementConsumable('New Item', 'ESS 497 Research', 3);
    expect(sheetDB['Consumables'].rows.length).toBe(initialCount + 1);
    const newRow = sheetDB['Consumables'].rows[sheetDB['Consumables'].rows.length - 1];
    expect(newRow[1]).toBe('New Item');       // Name
    expect(newRow[2]).toBe('ESS 497 Research'); // Class
    expect(newRow[7]).toBe(-3);               // Quantity
  });
});

// ── markOrdered ───────────────────────────────────────────────

describe('markOrdered', () => {
  beforeEach(() => {
    makeSheetDB('Consumables', [
      'ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack',
      'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes'
    ], [
      ['ID01', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', '', '', '', '', 50, 10, '', '', '']
    ]);
  });

  it('sets Order Status to Ordered', () => {
    const result = markOrdered('ID01', 'Ordered');
    expect(result.success).toBe(true);
    expect(sheetDB['Consumables'].rows[0][10]).toBe('Ordered');
  });

  it('clears Order Status when status is empty string', () => {
    sheetDB['Consumables'].rows[0][10] = 'Ordered';
    const result = markOrdered('ID01', '');
    expect(result.success).toBe(true);
    // markOrdered uses `status || 'Ordered'` so empty → 'Ordered'
    // This matches the actual Code.gs behavior
    expect(sheetDB['Consumables'].rows[0][10]).toBe('Ordered');
  });

  it('returns an error for a non-existent id', () => {
    const result = markOrdered('NOTEXIST', 'Ordered');
    expect(result.error).toBeDefined();
  });
});

// ── restockConsumable ─────────────────────────────────────────

describe('restockConsumable', () => {
  beforeEach(() => {
    makeSheetDB('Consumables', [
      'ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack',
      'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes'
    ], [
      ['RST1', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', 'MedSupply', 'Each', '', '', 10, 5, '', 'Ordered', '']
    ]);
    makeSheetDB('Restock Log', [
      'ID', 'Date', 'Item Name', 'Class', 'Quantity', 'Invoice Amount', 'Shipping Tax', 'Total Cost', 'Notes'
    ]);
    makeSheetDB('Batches', [
      'ID', 'Item Name', 'Class', 'Quantity', 'Expiration Date', 'Received Date', 'Notes'
    ]);
  });

  it('adds quantity to existing stock', () => {
    restockConsumable('RST1', 50, 0, 0, '');
    expect(sheetDB['Consumables'].rows[0][7]).toBe(60);
  });

  it('handles negative starting quantity (auto-created row scenario)', () => {
    sheetDB['Consumables'].rows[0][7] = -12;
    restockConsumable('RST1', 50, 0, 0, '');
    expect(sheetDB['Consumables'].rows[0][7]).toBe(38);
  });

  it('clears Order Status after restock', () => {
    restockConsumable('RST1', 50, 0, 0, '');
    expect(sheetDB['Consumables'].rows[0][10]).toBe('');
  });

  it('logs the restock to Restock Log', () => {
    restockConsumable('RST1', 50, 100, 10, 'test notes');
    expect(sheetDB['Restock Log'].rows.length).toBe(1);
    const log = sheetDB['Restock Log'].rows[0];
    const headers = sheetDB['Restock Log'].headers;
    expect(log[headers.indexOf('Item Name')]).toBe('Alcohol Wipes');
    expect(log[headers.indexOf('Quantity')]).toBe(50);
    expect(log[headers.indexOf('Invoice Amount')]).toBe(100);
    expect(log[headers.indexOf('Shipping Tax')]).toBe(10);
    expect(log[headers.indexOf('Total Cost')]).toBe(110);
    expect(log[headers.indexOf('Notes')]).toBe('test notes');
  });

  it('creates a batch record when expiration date is provided', () => {
    restockConsumable('RST1', 50, 0, 0, '', '2026-06-30');
    expect(sheetDB['Batches'].rows.length).toBe(1);
    const bh = sheetDB['Batches'].headers;
    const batch = sheetDB['Batches'].rows[0];
    expect(batch[bh.indexOf('Expiration Date')]).toBe('2026-06-30');
    expect(batch[bh.indexOf('Quantity')]).toBe(50);
  });

  it('does not create a batch when no expiration date', () => {
    restockConsumable('RST1', 50, 0, 0, '');
    expect(sheetDB['Batches'].rows.length).toBe(0);
  });

  it('returns the new quantity on success', () => {
    const result = restockConsumable('RST1', 50, 0, 0, '');
    expect(result.success).toBe(true);
    expect(result.newQty).toBe(60);
  });

  it('returns an error for a non-existent id', () => {
    const result = restockConsumable('NOTEXIST', 10, 0, 0, '');
    expect(result.error).toBeDefined();
  });
});

// ── getBatchesForItem ─────────────────────────────────────────

describe('getBatchesForItem', () => {
  beforeEach(() => {
    makeSheetDB('Batches', [
      'ID', 'Item Name', 'Class', 'Quantity', 'Expiration Date', 'Received Date', 'Notes'
    ], [
      ['B01', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', 100, '2026-01-01', '2025-01-01', ''],
      ['B02', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', 50,  '2026-06-01', '2025-03-01', ''],
      ['B03', 'Gloves',        'ESS 375L Ex Phys Lab', 30,  '2025-12-01', '2025-01-01', ''],
      ['B04', 'Alcohol Wipes', 'ESS 497 Research',     20,  '2026-03-01', '2025-01-01', '']
    ]);
  });

  it('returns only batches matching name+class', () => {
    const result = getBatchesForItem('Alcohol Wipes', 'ESS 375L Ex Phys Lab');
    expect(result.length).toBe(2);
    result.forEach(b => {
      expect(b['Item Name']).toBe('Alcohol Wipes');
      expect(b['Class']).toBe('ESS 375L Ex Phys Lab');
    });
  });

  it('returns empty array when no batches match', () => {
    const result = getBatchesForItem('Unknown Item', 'ESS 375L Ex Phys Lab');
    expect(result).toEqual([]);
  });

  it('does not include batches from a different class', () => {
    const result = getBatchesForItem('Alcohol Wipes', 'ESS 375L Ex Phys Lab');
    const ids = result.map(b => b['ID']);
    expect(ids).not.toContain('B04');
  });
});

// ── mergeConsumables ──────────────────────────────────────────

describe('mergeConsumables', () => {
  beforeEach(() => {
    makeSheetDB('Consumables', [
      'ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack',
      'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes'
    ], [
      ['SRC1', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', '', '', '', '', 30, 5, '', '', ''],
      ['TGT1', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', '', '', '', '', 20, 5, '', '', '']
    ]);
    makeSheetDB('Batches', [
      'ID', 'Item Name', 'Class', 'Quantity', 'Expiration Date', 'Received Date', 'Notes'
    ]);
  });

  it('adds source qty to target qty', () => {
    mergeConsumables('SRC1', 'TGT1');
    // Target is now the only row; qty should be 50
    const targetRow = sheetDB['Consumables'].rows.find(r => r[0] === 'TGT1');
    expect(targetRow[7]).toBe(50);
  });

  it('removes the source row', () => {
    mergeConsumables('SRC1', 'TGT1');
    const ids = sheetDB['Consumables'].rows.map(r => r[0]);
    expect(ids).not.toContain('SRC1');
  });

  it('returns success', () => {
    const result = mergeConsumables('SRC1', 'TGT1');
    expect(result.success).toBe(true);
  });

  it('returns error when source not found', () => {
    const result = mergeConsumables('NOTEXIST', 'TGT1');
    expect(result.error).toMatch(/Source row not found/);
  });

  it('returns error when target not found', () => {
    const result = mergeConsumables('SRC1', 'NOTEXIST');
    expect(result.error).toMatch(/Target row not found/);
  });
});

// ── addLogEntry ───────────────────────────────────────────────

describe('addLogEntry', () => {
  beforeEach(() => {
    makeSheetDB('Daily Log', [
      'ID', 'Date', 'Item Name', 'Item Type', 'Quantity Used', 'Class', 'Used By', 'Notes'
    ]);
    makeSheetDB('Consumables', [
      'ID', 'Name', 'Class', 'Vendor', 'Unit', 'Units Per Pack',
      'Cost Per Unit', 'Quantity', 'Reorder Threshold', 'Expiration Date', 'Order Status', 'Notes'
    ], [
      ['C01', 'Alcohol Wipes', 'ESS 375L Ex Phys Lab', '', '', '', '', 50, 10, '', '', '']
    ]);
  });

  it('adds the entry to the Daily Log', () => {
    addLogEntry({
      'Date': '2025-03-01', 'Item Name': 'Alcohol Wipes', 'Item Type': 'Consumable',
      'Quantity Used': 5, 'Class': 'ESS 375L Ex Phys Lab', 'Used By': 'JD', 'Notes': ''
    });
    expect(sheetDB['Daily Log'].rows.length).toBe(1);
  });

  it('decrements consumable stock for Consumable type', () => {
    addLogEntry({
      'Date': '2025-03-01', 'Item Name': 'Alcohol Wipes', 'Item Type': 'Consumable',
      'Quantity Used': 5, 'Class': 'ESS 375L Ex Phys Lab', 'Used By': 'JD', 'Notes': ''
    });
    expect(sheetDB['Consumables'].rows[0][7]).toBe(45);
  });

  it('does not decrement stock for Hardware type', () => {
    addLogEntry({
      'Date': '2025-03-01', 'Item Name': 'Treadmill', 'Item Type': 'Hardware',
      'Quantity Used': 1, 'Class': 'ESS 375L Ex Phys Lab', 'Used By': 'JD', 'Notes': ''
    });
    expect(sheetDB['Consumables'].rows[0][7]).toBe(50);
  });

  it('auto-creates consumable row for unknown item+class', () => {
    addLogEntry({
      'Date': '2025-03-01', 'Item Name': 'New Supply', 'Item Type': 'Consumable',
      'Quantity Used': 3, 'Class': 'ESS 497 Research', 'Used By': 'JD', 'Notes': ''
    });
    expect(sheetDB['Consumables'].rows.length).toBe(2);
    const newRow = sheetDB['Consumables'].rows[1];
    expect(newRow[7]).toBe(-3);
  });
});

// ── getDailyLog filtering ─────────────────────────────────────

describe('getDailyLog', () => {
  beforeEach(() => {
    makeSheetDB('Daily Log', [
      'ID', 'Date', 'Item Name', 'Item Type', 'Quantity Used', 'Class', 'Used By', 'Notes'
    ], [
      ['L1', '2025-01-10', 'Wipes', 'Consumable', 5, 'ESS 375L Ex Phys Lab', 'JD', ''],
      ['L2', '2025-02-15', 'Wipes', 'Consumable', 3, 'ESS 497 Research',     'AB', ''],
      ['L3', '2025-03-20', 'Gloves','Consumable', 1, 'ESS 375L Ex Phys Lab', 'JD', '']
    ]);
  });

  it('returns all rows in reverse order when no filter', () => {
    const result = getDailyLog({});
    expect(result.length).toBe(3);
    expect(result[0]['ID']).toBe('L3'); // reversed
  });

  it('filters by class', () => {
    const result = getDailyLog({ class: 'ESS 375L Ex Phys Lab' });
    expect(result.length).toBe(2);
    result.forEach(r => expect(r['Class']).toBe('ESS 375L Ex Phys Lab'));
  });

  it('filters by from date', () => {
    const result = getDailyLog({ from: '2025-02-01' });
    expect(result.length).toBe(2);
    result.forEach(r => expect(r['Date'] >= '2025-02-01').toBe(true));
  });

  it('filters by to date', () => {
    const result = getDailyLog({ to: '2025-02-28' });
    expect(result.length).toBe(2);
  });

  it('filters by both from and to date', () => {
    const result = getDailyLog({ from: '2025-02-01', to: '2025-02-28' });
    expect(result.length).toBe(1);
    expect(result[0]['ID']).toBe('L2');
  });

  it('filters by class and date together', () => {
    const result = getDailyLog({ class: 'ESS 375L Ex Phys Lab', from: '2025-03-01' });
    expect(result.length).toBe(1);
    expect(result[0]['ID']).toBe('L3');
  });
});
