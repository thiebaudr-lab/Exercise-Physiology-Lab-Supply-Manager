/**
 * Tests for api.js — pure utility functions.
 * Environment: jsdom (set in vitest.config.js) so DOM globals are available.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';
import { describe, it, expect, beforeAll, vi } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load api.js into the test global scope ────────────────────

beforeAll(() => {
  // Stub browser globals that api.js touches at parse time
  globalThis.sessionStorage = {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = v; },
    removeItem(k) { delete this._store[k]; },
    get length() { return Object.keys(this._store).length; },
    key(i) { return Object.keys(this._store)[i]; }
  };
  Object.defineProperty(globalThis.sessionStorage, Symbol.iterator, {
    value: function* () { yield* Object.keys(this._store); }
  });

  // api.js adds a keydown listener at parse time — stub addEventListener on document
  if (!globalThis.document) {
    globalThis.document = {
      addEventListener: () => {},
      getElementById: () => null,
      createElement: () => ({ className: '', textContent: '', style: {}, remove: () => {} }),
      body: { appendChild: () => {} },
      querySelectorAll: () => []
    };
  }

  const src = readFileSync(join(__dir, '../api.js'), 'utf-8');
  runInThisContext(src);
});

// ── fmtDate ───────────────────────────────────────────────────

describe('fmtDate', () => {
  it('returns — for null', () => {
    expect(fmtDate(null)).toBe('—');
  });

  it('returns — for empty string', () => {
    expect(fmtDate('')).toBe('—');
  });

  it('formats a valid date string', () => {
    expect(fmtDate('2025-01-15')).toBe('Jan 15, 2025');
  });

  it('formats another valid date', () => {
    expect(fmtDate('2024-12-31')).toBe('Dec 31, 2024');
  });

  it('returns the raw value for an unrecognisable string', () => {
    expect(fmtDate('not-a-date')).toBe('not-a-date');
  });
});

// ── daysUntil ─────────────────────────────────────────────────

describe('daysUntil', () => {
  it('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(daysUntil('')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(daysUntil('not-a-date')).toBeNull();
  });

  it('returns 0 for today', () => {
    expect(daysUntil(today())).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const dateStr = future.toISOString().slice(0, 10);
    expect(daysUntil(dateStr)).toBe(7);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const dateStr = past.toISOString().slice(0, 10);
    expect(daysUntil(dateStr)).toBe(-3);
  });
});

// ── today ─────────────────────────────────────────────────────

describe('today', () => {
  it('returns a yyyy-MM-dd string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the current local date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(today()).toBe(expected);
  });
});

// ── fmt$ ──────────────────────────────────────────────────────

describe('fmt$', () => {
  it('formats zero', () => {
    expect(fmt$(0)).toBe('$0.00');
  });

  it('formats a whole number', () => {
    expect(fmt$(100)).toBe('$100.00');
  });

  it('formats a decimal', () => {
    expect(fmt$(12.5)).toBe('$12.50');
  });

  it('formats a negative value', () => {
    expect(fmt$(-5)).toBe('$-5.00');
  });

  it('rounds to two decimal places', () => {
    expect(fmt$(1.999)).toBe('$2.00');
  });
});

// ── getYear ───────────────────────────────────────────────────

describe('getYear', () => {
  it('returns null for null input', () => {
    expect(getYear(null)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(getYear('garbage')).toBeNull();
  });

  it('extracts the year from a date string', () => {
    expect(getYear('2025-06-15')).toBe(2025);
  });

  it('extracts year from a different year', () => {
    expect(getYear('2024-01-01')).toBe(2024);
  });
});

// ── esc ───────────────────────────────────────────────────────

describe('esc', () => {
  it('escapes &', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes <', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes >', () => {
    expect(esc('x > y')).toBe('x &gt; y');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('returns empty string for null', () => {
    expect(esc(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(esc(undefined)).toBe('');
  });

  it('leaves safe strings unchanged', () => {
    expect(esc('Hello World')).toBe('Hello World');
  });

  it('handles mixed content', () => {
    expect(esc('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });
});

// ── stockPill ─────────────────────────────────────────────────

describe('stockPill', () => {
  it('shows Out of Stock when qty is 0', () => {
    expect(stockPill(0, 10)).toContain('Out of Stock');
    expect(stockPill(0, 10)).toContain('pill-rose');
  });

  it('shows Low Stock when qty is negative but threshold is set', () => {
    // stockPill only checks q === 0 for Out of Stock; negative qty is still below threshold → Low Stock
    expect(stockPill(-5, 10)).toContain('Low Stock');
  });

  it('shows Low Stock when qty is at or below threshold', () => {
    expect(stockPill(5, 5)).toContain('Low Stock');
    expect(stockPill(5, 5)).toContain('pill-amber');
  });

  it('shows Low Stock when qty is below threshold', () => {
    expect(stockPill(3, 10)).toContain('Low Stock');
  });

  it('shows In Stock when qty is above threshold', () => {
    expect(stockPill(15, 10)).toContain('In Stock');
    expect(stockPill(15, 10)).toContain('pill-green');
  });

  it('shows In Stock when there is no threshold (0)', () => {
    expect(stockPill(5, 0)).toContain('In Stock');
  });
});

// ── expPill ───────────────────────────────────────────────────

describe('expPill', () => {
  it('returns N/A for empty date', () => {
    expect(expPill('')).toContain('N/A');
    expect(expPill('')).toContain('pill-blue');
  });

  it('returns N/A for null', () => {
    expect(expPill(null)).toContain('N/A');
  });

  it('shows Expired for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(expPill(past.toISOString().slice(0, 10))).toContain('Expired');
    expect(expPill(past.toISOString().slice(0, 10))).toContain('pill-rose');
  });

  it('shows Exp Soon for a date within 30 days', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    expect(expPill(soon.toISOString().slice(0, 10))).toContain('Exp Soon');
    expect(expPill(soon.toISOString().slice(0, 10))).toContain('pill-amber');
  });

  it('shows OK for a date more than 30 days away', () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    expect(expPill(far.toISOString().slice(0, 10))).toContain('OK');
    expect(expPill(far.toISOString().slice(0, 10))).toContain('pill-green');
  });
});

// ── servicePill ───────────────────────────────────────────────

describe('servicePill', () => {
  it('returns a blue pill for no date', () => {
    expect(servicePill('')).toContain('pill-blue');
  });

  it('shows Overdue for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(servicePill(past.toISOString().slice(0, 10))).toContain('Overdue');
    expect(servicePill(past.toISOString().slice(0, 10))).toContain('pill-rose');
  });

  it('shows Due Soon for a date within 14 days', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    expect(servicePill(soon.toISOString().slice(0, 10))).toContain('Due Soon');
    expect(servicePill(soon.toISOString().slice(0, 10))).toContain('pill-amber');
  });

  it('shows OK for a date more than 14 days away', () => {
    const far = new Date();
    far.setDate(far.getDate() + 30);
    expect(servicePill(far.toISOString().slice(0, 10))).toContain('OK');
    expect(servicePill(far.toISOString().slice(0, 10))).toContain('pill-green');
  });
});

// ── calPill ───────────────────────────────────────────────────

describe('calPill', () => {
  it('returns N/A when needsCal is No', () => {
    expect(calPill('2025-01-01', 'No')).toContain('N/A');
  });

  it('returns N/A when needsCal is false', () => {
    expect(calPill('2025-01-01', false)).toContain('N/A');
  });

  it('returns N/A when needsCal is empty string', () => {
    expect(calPill('2025-01-01', '')).toContain('N/A');
  });

  it('returns Not Set when needsCal is Yes but no date', () => {
    expect(calPill('', 'Yes')).toContain('Not Set');
    expect(calPill('', 'Yes')).toContain('pill-amber');
  });

  it('shows Overdue for a past calibration date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(calPill(past.toISOString().slice(0, 10), 'Yes')).toContain('Overdue');
  });

  it('shows Due Soon for a date within 14 days', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    expect(calPill(soon.toISOString().slice(0, 10), 'Yes')).toContain('Due Soon');
  });

  it('shows OK for a date more than 14 days away', () => {
    const far = new Date();
    far.setDate(far.getDate() + 30);
    expect(calPill(far.toISOString().slice(0, 10), 'Yes')).toContain('OK');
    expect(calPill(far.toISOString().slice(0, 10), 'Yes')).toContain('pill-green');
  });
});

// ── downloadCSV ───────────────────────────────────────────────

describe('downloadCSV', () => {
  // showToast is also loaded from api.js but needs a DOM container — stub it
  beforeAll(() => {
    globalThis.showToast = vi.fn();
  });

  it('shows a warning toast for empty array', () => {
    downloadCSV([], 'test.csv');
    expect(globalThis.showToast).toHaveBeenCalledWith('No data to export', 'warning');
  });

  it('shows a warning toast for null', () => {
    downloadCSV(null, 'test.csv');
    expect(globalThis.showToast).toHaveBeenCalled();
  });

  it('generates correct CSV with a header row and data rows', () => {
    // Intercept the anchor click
    const clicks = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = () => clicks.push({ href: el.href, download: el.download });
      }
      return el;
    });

    // Stub Blob and URL
    globalThis.Blob = class {
      constructor(parts) { this.text = parts.join(''); }
    };
    globalThis.URL = { createObjectURL: (b) => 'blob:' + b.text, revokeObjectURL: () => {} };

    downloadCSV([{ Name: 'Gloves', Qty: 10 }], 'out.csv');

    expect(clicks.length).toBe(1);
    expect(clicks[0].download).toBe('out.csv');
    // The blob URL encodes the CSV content
    expect(clicks[0].href).toContain('Name,Qty');
    expect(clicks[0].href).toContain('Gloves,10');

    vi.restoreAllMocks();
  });

  it('quotes values that contain commas', () => {
    const captured = [];
    globalThis.Blob = class {
      constructor(parts) { captured.push(parts.join('')); }
    };
    globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
    vi.spyOn(document, 'createElement').mockImplementation(() => ({
      click: () => {}, style: {}, setAttribute: () => {}
    }));

    downloadCSV([{ Name: 'A, B', Qty: 1 }], 'x.csv');
    expect(captured[0]).toContain('"A, B"');

    vi.restoreAllMocks();
  });
});
