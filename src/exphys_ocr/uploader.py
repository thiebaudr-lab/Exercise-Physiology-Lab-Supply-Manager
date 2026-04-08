"""
uploader.py — Post parsed log rows directly to the ExPhys LIMS Apps Script API.

Each row is sent as an addLogEntry POST request, which triggers the same
auto-decrement logic as a manually entered Daily Log entry.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Callable

# ── Public API ────────────────────────────────────────────────────

def upload_rows(
    rows: list[dict],
    api_url: str,
    progress_cb: Callable[[int, int, str], None] | None = None,
    timeout: int = 20
) -> tuple[int, list[str]]:
    """
    Upload each row to the Apps Script Web App via addLogEntry.

    Parameters
    ----------
    rows : list of dicts with keys matching Daily Log headers:
           Item, Quantity, Class, Date, Initials, Notes
    api_url : str
        The Apps Script Web App URL (from api.js API_URL).
    progress_cb : optional callable(current, total, status_message)
        Called after each row so a GUI can update a progress bar.
    timeout : int
        Per-request timeout in seconds.

    Returns
    -------
    (success_count, error_messages)
    """
    success = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=1):
        payload = {
            'action': 'addLogEntry',
            'row': {
                'Item Name'    : row.get('Item', ''),
                'Item Type'    : 'Consumable',
                'Quantity Used': row.get('Quantity', ''),
                'Class'        : row.get('Class', ''),
                'Date'         : row.get('Date', ''),
                'Used By'      : row.get('Initials', ''),
                'Notes'        : row.get('Notes', '')
            }
        }

        if progress_cb:
            progress_cb(i - 1, len(rows), f'Uploading row {i} of {len(rows)}…')

        try:
            data = json.dumps(payload).encode('utf-8')
            req  = urllib.request.Request(
                api_url,
                data=data,
                method='POST'
                # No Content-Type header — avoids CORS preflight, matches api.js pattern
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                if body.get('error'):
                    errors.append(f"Row {i} ({row.get('Item','')}): {body['error']}")
                else:
                    success += 1
        except urllib.error.URLError as e:
            errors.append(f"Row {i} ({row.get('Item','')}): network error — {e.reason}")
        except Exception as e:
            errors.append(f"Row {i} ({row.get('Item','')}): {e}")

    if progress_cb:
        progress_cb(len(rows), len(rows), 'Done')

    return success, errors


def validate_row(row: dict) -> list[str]:
    """
    Return a list of validation problems for a single row.
    An empty list means the row is ready to upload.
    """
    problems = []
    if not row.get('Item', '').strip():
        problems.append('Item is required')
    if not row.get('Quantity', '').strip():
        problems.append('Quantity is required')
    if not row.get('Class', '').strip():
        problems.append('Class is required')
    if not row.get('Date', '').strip():
        problems.append('Date is required')
    if not row.get('Initials', '').strip():
        problems.append('Initials are required')
    return problems
