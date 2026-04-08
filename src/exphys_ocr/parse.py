"""
parse.py — Convert raw PaddleOCR word list into structured log rows.

The physical log sheet has six printed columns (left-to-right):
    Item | Quantity | Class | Date | Initials | Notes

Rules applied (in order):
  1. Group OCR words into lines by Y-centre proximity.
  2. Detect the header row on page 1 and carry those column X-positions
     forward to all subsequent pages.
  3. Skip single-value rows that span the full width (section labels / dates
     written large as dividers).
  4. Assign each word to its nearest column bucket.
  5. Apply fill-down for Item, Class, Date, Initials when a cell contains
     a ditto / continuation marker or is blank.
  6. Normalize item names, class names, quantities, and dates.
  7. Mark ambiguous / illegible values as UNCLEAR.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

# ── Constants ─────────────────────────────────────────────────────

EXPECTED_HEADERS = ['Item', 'Quantity', 'Class', 'Date', 'Initials', 'Notes']
FILLDOWN_COLS    = {'Item', 'Class', 'Date', 'Initials'}

# Anything in this set is treated as "same as the row above" in fill-down columns
DITTO_MARKERS = {
    # Punctuation
    '"', '""', "'", "''", '``',
    # Words
    'same', 'ditto', 'same as above',
    # Arrows and lines
    '↓', '↑', '|', '‖', '||', '—', '–', '-', '--',
    # Common OCR misreads of arrows/lines
    'i', 'l', '1', '!',
    # Explicit blank
    ''
}

# Fuzzy matches for header cell detection (lowercase → canonical)
HEADER_ALIASES = {
    'item': 'Item', 'supply': 'Item', 'supplies': 'Item', 'description': 'Item',
    'qty': 'Quantity', 'quantity': 'Quantity', 'amount': 'Quantity', 'q': 'Quantity',
    'class': 'Class', 'course': 'Class', 'section': 'Class',
    'date': 'Date',
    'initials': 'Initials', 'by': 'Initials', 'user': 'Initials', 'name': 'Initials',
    'notes': 'Notes', 'note': 'Notes', 'comments': 'Notes', 'comment': 'Notes',
}

# ── Item normalisation map ────────────────────────────────────────
# Key: lowercase pattern (matched as prefix/substring/exact)
# Value: canonical name

ITEM_MAP: list[tuple[str, str]] = [
    # Alcohol Wipes
    ('alcohol wipe',        'Alcohol Wipes'),
    ('alc wipe',            'Alcohol Wipes'),
    ('alc.',                'Alcohol Wipes'),

    # Electrode Stickers (must come before plain "electrode")
    ('noraxon sticker',     'Electrode Stickers'),
    ('noraxon strip',       'Electrode Stickers'),
    ('noraxon',             'Electrode Stickers'),
    ('electrode sticker',   'Electrode Stickers'),
    ('electrode sticki',    'Electrode Stickers'),  # "stickies"

    # Electrodes (general)
    ('electrode',           'Electrodes'),
    ('ecg electrode',       'Resting ECG Electrodes'),
    ('resting ecg',         'Resting ECG Electrodes'),

    # Gloves — size-specific (checked before generic "glove")
    ('small glove',         'Gloves (S)'),
    ('sm glove',            'Gloves (S)'),
    ('s glove',             'Gloves (S)'),
    ('medium glove',        'Gloves (M)'),
    ('med glove',           'Gloves (M)'),
    ('m glove',             'Gloves (M)'),
    ('large glove',         'Gloves (L)'),
    ('lg glove',            'Gloves (L)'),
    ('l glove',             'Gloves (L)'),
    ('xl glove',            'Gloves (XL)'),
    ('x-large glove',       'Gloves (XL)'),
    ('glove',               'Gloves'),       # generic fallback

    # Razors
    ('razor',               'Razors'),

    # Sandpaper
    ('sand paper',          'Sandpaper'),
    ('sandpaper',           'Sandpaper'),

    # Kim Wipes
    ('kim wipe',            'Kim Wipes'),
    ('kimwipe',             'Kim Wipes'),

    # Lancets
    ('lancet',              'Lancets'),

    # Test Strips
    ('test strip',          'Test Strips'),
    ('lactate strip',       'Lactate Strips'),
    ('lac strip',           'Lactate Strips'),
    ('lactate control',     'Lactate Control Solution'),

    # Pre-Wrap
    ('pre wrap',            'Pre-Wrap'),
    ('pre-wrap',            'Pre-Wrap'),
    ('prewrap',             'Pre-Wrap'),

    # Disinfectant
    ('disinfectant',        'Disinfectant'),
    ('germicidal wipe',     'Germicidal Wipes'),
    ('germ wipe',           'Germicidal Wipes'),

    # Drinks / snacks
    ('capri sun',           'Capri Sun'),
    ('caprison',            'Capri Sun'),
    ('caprison',            'Capri Sun'),
    ('jolly rancher',       'Jolly Rancher'),
    ('granola bar',         'Granola Bar'),
    ('granola',             'Granola Bar'),

    # Tape / Gauze
    ('athletic tape',       'Athletic Tape Rolls'),
    ('athletic gauze',      'Athletic Gauze Roll'),
    ('gauze roll',          'Athletic Gauze Roll'),
    ('gauze',               'Gauze'),
    ('tape',                'Athletic Tape Rolls'),
    ('bandaid',             'Bandaids'),
    ('band-aid',            'Bandaids'),
    ('band aid',            'Bandaids'),

    # Metabolic / lab equipment consumables
    ('metabolic tube',      'Metabolic Tube'),
    ('permapure',           'PermaPure Drying Tubes and Filters'),
    ('blue water trap',     'Blue Water Trap Filters'),
    ('exercise calibration','Exercise Calibration Gas'),
    ('command strip',       'Command Strips'),

    # Batteries
    ('battery aaa',         'Battery AAA'),
    ('battery 9v',          'Battery 9V'),
    ('battery cr2450',      'Battery CR2450'),
    ('battery cr 2025',     'Battery CR 2025'),

    # Posters / misc
    ('poster',              'Posters'),
]

# ── Class normalisation map ───────────────────────────────────────

CLASS_MAP: list[tuple[str, str]] = [
    ('ess 375l',    'ESS 375L Ex Phys Lab'),
    ('ess375l',     'ESS 375L Ex Phys Lab'),
    ('ess 375',     'ESS 375L Ex Phys Lab'),
    ('ess375',      'ESS 375L Ex Phys Lab'),
    ('375l',        'ESS 375L Ex Phys Lab'),
    ('375',         'ESS 375L Ex Phys Lab'),
    ('ex phys',     'ESS 375L Ex Phys Lab'),
    ('exphys',      'ESS 375L Ex Phys Lab'),

    ('ess 497',     'ESS 497 Research'),
    ('ess497',      'ESS 497 Research'),
    ('497',         'ESS 497 Research'),
    ('research',    'ESS 497 Research'),

    ('ess 386',     'ESS 386 H&D'),
    ('ess386',      'ESS 386 H&D'),
    ('386',         'ESS 386 H&D'),
    ('h&d',         'ESS 386 H&D'),
    ('h & d',       'ESS 386 H&D'),
    ('hd',          'ESS 386 H&D'),
]


# ── Geometry helpers ──────────────────────────────────────────────

def _x_centre(bbox: list) -> float:
    return sum(p[0] for p in bbox) / 4.0

def _y_centre(bbox: list) -> float:
    return sum(p[1] for p in bbox) / 4.0

def _x_span(bbox: list) -> float:
    xs = [p[0] for p in bbox]
    return max(xs) - min(xs)


def _group_into_lines(words: list[dict], y_tol: int = 12) -> list[list[dict]]:
    """Group words into lines by Y-centre proximity, sorted top-to-bottom."""
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: _y_centre(w['bbox']))
    lines: list[list[dict]] = []
    current = [sorted_words[0]]
    current_y = _y_centre(sorted_words[0]['bbox'])
    for w in sorted_words[1:]:
        cy = _y_centre(w['bbox'])
        if abs(cy - current_y) <= y_tol:
            current.append(w)
        else:
            lines.append(sorted(current, key=lambda x: _x_centre(x['bbox'])))
            current = [w]
            current_y = cy
    lines.append(sorted(current, key=lambda x: _x_centre(x['bbox'])))
    return lines


def _detect_header_line(lines: list[list[dict]]) -> tuple[int, dict[str, float]]:
    """
    Find the first line that contains at least 3 recognised header words.
    Returns (line_index, {canonical_col: x_centre}).
    Returns (-1, {}) if no header is found.
    """
    for i, line in enumerate(lines):
        col_positions: dict[str, float] = {}
        for w in line:
            canonical = HEADER_ALIASES.get(w['text'].strip().lower())
            if canonical and canonical not in col_positions:
                col_positions[canonical] = _x_centre(w['bbox'])
        if len(col_positions) >= 3:
            return i, col_positions
    return -1, {}


def _assign_column(x: float, col_positions: dict[str, float]) -> str:
    """Return the column whose X-centre is closest to x."""
    return min(col_positions, key=lambda c: abs(col_positions[c] - x))


def _positional_fallback(lines: list[list[dict]]) -> dict[str, float]:
    """Spread 6 columns evenly across the estimated page width."""
    all_x = [_x_centre(w['bbox']) for line in lines for w in line]
    if not all_x:
        return {c: i * 100 for i, c in enumerate(EXPECTED_HEADERS)}
    page_width = max(all_x)
    step = page_width / len(EXPECTED_HEADERS)
    return {c: (i + 0.5) * step for i, c in enumerate(EXPECTED_HEADERS)}


def _is_section_label(line: list[dict], col_positions: dict[str, float]) -> bool:
    """
    Return True if this line looks like a section label / divider rather than
    a data row. Criteria: only one word (or words that all land in the same
    column bucket) AND that bucket covers more than half the page width.
    """
    if not line:
        return False
    # If only one word and it spans a large horizontal area, treat as label
    if len(line) == 1:
        span = _x_span(line[0]['bbox'])
        all_x = list(col_positions.values())
        page_width = max(all_x) - min(all_x) if len(all_x) > 1 else 100
        if span > page_width * 0.4:
            return True
    # If all words map to the same column it's likely a single-cell label row
    if col_positions:
        cols_used = {_assign_column(_x_centre(w['bbox']), col_positions) for w in line}
        if len(cols_used) == 1 and len(line) <= 2:
            return True
    return False


# ── Fill-down ─────────────────────────────────────────────────────

def _is_ditto(text: str) -> bool:
    t = text.strip().lower()
    return t in DITTO_MARKERS or re.fullmatch(r'[|‖/\\↓↑\-"\'`]+', t) is not None


def fill_down(rows: list[dict], key: str) -> list[dict]:
    """Replace ditto / blank values in *key* with the last valid value above."""
    last = ''
    for r in rows:
        val = r.get(key, '').strip()
        if not val or _is_ditto(val):
            r[key] = last
        else:
            last = val
    return rows


# ── Item normalisation ────────────────────────────────────────────

def normalise_item(raw: str) -> str:
    if not raw or raw.strip().upper() == 'UNCLEAR':
        return raw.strip() if raw else 'UNCLEAR'
    key = raw.strip().lower()
    for pattern, canonical in ITEM_MAP:
        if pattern in key:
            return canonical
    # If nothing matched, return title-cased original
    return raw.strip() if raw.strip() else 'UNCLEAR'


# ── Class normalisation ───────────────────────────────────────────

def normalise_class(raw: str) -> str:
    if not raw or raw.strip().upper() == 'UNCLEAR':
        return 'UNCLEAR'
    key = raw.strip().lower()
    for pattern, canonical in CLASS_MAP:
        if key == pattern or key.startswith(pattern):
            return canonical
    # Return cleaned original — don't invent a class
    return raw.strip()


# ── Quantity parsing ──────────────────────────────────────────────

# Fraction characters → decimal
_VULGAR_FRACTIONS = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3,
    '¼': 0.25, '¾': 0.75,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

_WORD_NUMBERS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'a': 1, 'an': 1,
}


def normalise_quantity(raw: str) -> str:
    """
    Parse a quantity string into a clean numeric string.
    Returns 'UNCLEAR' if the value cannot be determined.

    Examples:
        '6 pieces'    → '6'
        '4 little pieces' → '4'
        '1 pair'      → '2'
        '2 pairs'     → '4'
        '1/2 sheet'   → '0.5'
        '½ sheet'     → '0.5'
        'some'        → 'UNCLEAR'
    """
    if not raw:
        return 'UNCLEAR'

    t = raw.strip()

    # Vulgar fraction characters
    for char, val in _VULGAR_FRACTIONS.items():
        if char in t:
            return str(int(val) if val == int(val) else val)

    # Written fraction: "1/2", "1/4" etc.
    frac_m = re.search(r'(\d+)\s*/\s*(\d+)', t)
    if frac_m:
        num, den = int(frac_m.group(1)), int(frac_m.group(2))
        if den != 0:
            val = num / den
            return str(int(val) if val == int(val) else round(val, 4))

    # Leading integer
    num_m = re.search(r'(\d+(?:\.\d+)?)', t)
    if num_m:
        qty = float(num_m.group(1))
        # "pair" doubles the count
        if re.search(r'\bpairs?\b', t, re.I):
            qty *= 2
        return str(int(qty) if qty == int(qty) else qty)

    # Word numbers
    lower = t.lower().strip()
    # Check for "word pair(s)" e.g. "one pair"
    word_pair_m = re.match(r'^(\w+)\s+pairs?$', lower)
    if word_pair_m:
        n = _WORD_NUMBERS.get(word_pair_m.group(1))
        if n:
            return str(n * 2)

    if lower in _WORD_NUMBERS:
        return str(_WORD_NUMBERS[lower])

    return 'UNCLEAR'


# ── Date parsing ──────────────────────────────────────────────────

def normalise_date(raw: str, year_hint: int | None = None) -> str:
    """
    Parse MM/DD/YY, MM/DD/YYYY, or MM/DD → yyyy-MM-dd.
    Defaults to current year when year is absent.
    Returns original text if unparseable (do not invent).
    """
    if not raw or raw.strip().upper() == 'UNCLEAR':
        return 'UNCLEAR'

    t = raw.strip()
    year = year_hint or datetime.now().year

    # Already ISO format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', t):
        return t

    # Inject year for MM/DD
    if re.match(r'^\d{1,2}/\d{1,2}$', t):
        t = t + f'/{year}'

    formats = [
        '%m/%d/%y',    # MM/DD/YY  — two-digit year
        '%m/%d/%Y',    # MM/DD/YYYY
        '%m-%d-%Y',
        '%m-%d-%y',
        '%B %d %Y',
        '%b %d %Y',
        '%b %d, %Y',
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(t, fmt)
            # Two-digit year: 25 → 2025, not 1925
            if dt.year < 2000:
                dt = dt.replace(year=dt.year + 2000)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue

    # Could not parse — do not invent a date
    return raw.strip()


# ── Main page parser ──────────────────────────────────────────────

def parse_page(
    words: list[dict],
    page_num: int = 1,
    inherited_col_positions: dict[str, float] | None = None
) -> tuple[list[dict], dict[str, float]]:
    """
    Convert a list of PaddleOCR word dicts for one page into structured rows.

    Parameters
    ----------
    words : list of {'bbox', 'text', 'conf'}
    page_num : 1-based page number
    inherited_col_positions : column X-positions detected on page 1.
        If provided, skip header detection and use these positions.
        Pass None for page 1.

    Returns
    -------
    (rows, col_positions)
        rows — list of dicts with keys: Item, Quantity, Class, Date, Initials, Notes, __page
        col_positions — the detected (or inherited) column X-positions;
                        pass these to subsequent pages.
    """
    lines = _group_into_lines(words)
    if not lines:
        return [], inherited_col_positions or {}

    # Determine column positions
    if inherited_col_positions:
        col_positions = inherited_col_positions
        data_lines = lines
    else:
        header_idx, col_positions = _detect_header_line(lines)
        if header_idx < 0 or not col_positions:
            col_positions = _positional_fallback(lines)
            data_lines = lines
        else:
            data_lines = lines[header_idx + 1:]

    rows: list[dict] = []
    for line in data_lines:
        if not line:
            continue

        # Skip section labels / divider rows
        if _is_section_label(line, col_positions):
            continue

        # Assign each word to its nearest column
        row: dict[str, str] = {c: '' for c in EXPECTED_HEADERS}
        for w in line:
            col = _assign_column(_x_centre(w['bbox']), col_positions)
            row[col] = (row[col] + ' ' + w['text']).strip()

        # Skip entirely blank lines
        if not any(row[c] for c in EXPECTED_HEADERS):
            continue

        row['__page'] = str(page_num)
        rows.append(row)

    # ── Fill-down for continuation columns ──
    for col in FILLDOWN_COLS:
        fill_down(rows, col)

    # ── Normalise ──
    for r in rows:
        r['Item']     = normalise_item(r.get('Item', ''))
        r['Class']    = normalise_class(r.get('Class', ''))
        r['Quantity'] = normalise_quantity(r.get('Quantity', ''))
        r['Date']     = normalise_date(r.get('Date', ''))
        # Initials: keep as-is but mark clearly blank ones UNCLEAR
        initials = r.get('Initials', '').strip()
        r['Initials'] = initials if initials else 'UNCLEAR'

    return rows, col_positions
