"""
app.py — ExPhys LIMS Photo Log Importer

CustomTkinter GUI workflow:
  1. User selects a PDF file
  2. OCR runs in a background thread (progress bar shown)
  3. Extracted rows appear in an editable table
  4. User can edit any cell, add rows, or delete rows
  5. Clicking "Import to LIMS" posts all rows to the Apps Script API
  6. Success/error summary is displayed

Run:
    python -m exphys_ocr.app
or (if packaged):
    ExPhysLogImporter.exe  /  ExPhysLogImporter.app
"""

from __future__ import annotations

import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path

try:
    import customtkinter as ctk
except ImportError:
    raise ImportError("customtkinter is not installed.\nRun: pip install customtkinter")

from .ocr import ocr_pdf
from .parse import parse_page, EXPECTED_HEADERS, normalise_quantity
from .uploader import upload_rows, validate_row

UNCLEAR = 'UNCLEAR'
REQUIRED_COLS = {'Item', 'Quantity', 'Class', 'Date', 'Initials'}

# ── App config ────────────────────────────────────────────────────

APP_TITLE   = 'ExPhys LIMS — Log Sheet Importer'
APP_WIDTH   = 1100
APP_HEIGHT  = 720
THEME_COLOR = '#1e2a4a'   # matches LIMS dark navy
ACCENT      = '#4f8ef7'   # --blue

# Column display widths (pixels) for the review table
COL_WIDTHS = {
    'Item': 200, 'Quantity': 70, 'Class': 170,
    'Date': 100, 'Initials': 80, 'Notes': 200
}

DISPLAY_HEADERS = ['Item', 'Quantity', 'Class', 'Date', 'Initials', 'Notes']

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme('blue')


# ── Settings persistence ──────────────────────────────────────────

import json, os

SETTINGS_PATH = Path.home() / '.exphys_lims_importer.json'

def load_settings() -> dict:
    try:
        with open(SETTINGS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}

def save_settings(s: dict):
    try:
        with open(SETTINGS_PATH, 'w') as f:
            json.dump(s, f)
    except Exception:
        pass


# ── Main Application ──────────────────────────────────────────────

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry(f'{APP_WIDTH}x{APP_HEIGHT}')
        self.minsize(800, 500)

        self._settings = load_settings()
        self._rows: list[dict] = []          # parsed + edited rows
        self._entry_widgets: list[list[tk.StringVar]] = []  # per-cell StringVars

        self._build_ui()
        self._restore_api_url()

    # ── UI Construction ───────────────────────────────────────────

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # ── Top bar ──
        top = ctk.CTkFrame(self, fg_color=THEME_COLOR, corner_radius=0)
        top.grid(row=0, column=0, sticky='ew', padx=0, pady=0)
        top.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(top, text='⚗  ExPhys LIMS — Log Sheet Importer',
                     font=ctk.CTkFont(size=16, weight='bold'),
                     text_color='white').grid(row=0, column=0, padx=20, pady=14, sticky='w')

        # API URL field
        url_frame = ctk.CTkFrame(top, fg_color='transparent')
        url_frame.grid(row=0, column=1, padx=20, pady=8, sticky='e')
        ctk.CTkLabel(url_frame, text='Apps Script URL:', text_color='#aab4c8',
                     font=ctk.CTkFont(size=12)).pack(side='left', padx=(0, 6))
        self._url_var = tk.StringVar()
        ctk.CTkEntry(url_frame, textvariable=self._url_var, width=360,
                     placeholder_text='Paste your Web App URL here…').pack(side='left')
        ctk.CTkButton(url_frame, text='Save', width=60, command=self._save_url).pack(side='left', padx=(6, 0))

        # ── Step bar ──
        steps = ctk.CTkFrame(self, fg_color='#141b2d', corner_radius=0)
        steps.grid(row=1, column=0, sticky='ew')

        step_frame = ctk.CTkFrame(steps, fg_color='transparent')
        step_frame.pack(fill='x', padx=20, pady=14)

        # Select PDF button
        ctk.CTkButton(step_frame, text='📂  Select PDF…', width=160,
                      command=self._select_pdf).pack(side='left', padx=(0, 12))

        self._file_label = ctk.CTkLabel(step_frame, text='No file selected',
                                         text_color='#6b7a99',
                                         font=ctk.CTkFont(size=12))
        self._file_label.pack(side='left', padx=(0, 20))

        self._run_btn = ctk.CTkButton(step_frame, text='▶  Run OCR', width=120,
                                       state='disabled', command=self._run_ocr)
        self._run_btn.pack(side='left', padx=(0, 12))

        self._progress = ctk.CTkProgressBar(step_frame, width=200)
        self._progress.set(0)
        self._progress.pack(side='left', padx=(0, 12))

        self._status_label = ctk.CTkLabel(step_frame, text='', text_color='#6b7a99',
                                           font=ctk.CTkFont(size=12))
        self._status_label.pack(side='left')

        # ── Table area ──
        self.grid_rowconfigure(2, weight=1)
        table_container = ctk.CTkFrame(self, fg_color='#0f1525', corner_radius=0)
        table_container.grid(row=2, column=0, sticky='nsew', padx=0, pady=0)
        table_container.grid_columnconfigure(0, weight=1)
        table_container.grid_rowconfigure(1, weight=1)

        # Table header row
        header_frame = ctk.CTkFrame(table_container, fg_color='#1a2540', corner_radius=0)
        header_frame.grid(row=0, column=0, sticky='ew', padx=0, pady=0)
        self._build_header_row(header_frame)

        # Scrollable table body
        self._table_scroll = ctk.CTkScrollableFrame(
            table_container, fg_color='#0f1525', corner_radius=0)
        self._table_scroll.grid(row=1, column=0, sticky='nsew', padx=0, pady=0)

        self._empty_label = ctk.CTkLabel(
            self._table_scroll,
            text='Select a PDF and click "Run OCR" to extract log entries.',
            text_color='#3a4a6b', font=ctk.CTkFont(size=14))
        self._empty_label.pack(pady=60)

        # ── Bottom bar ──
        bottom = ctk.CTkFrame(self, fg_color=THEME_COLOR, corner_radius=0)
        bottom.grid(row=3, column=0, sticky='ew', padx=0, pady=0)
        bottom.grid_columnconfigure(0, weight=1)

        self._row_count_label = ctk.CTkLabel(bottom, text='', text_color='#6b7a99',
                                              font=ctk.CTkFont(size=12))
        self._row_count_label.grid(row=0, column=0, padx=20, pady=10, sticky='w')

        btn_frame = ctk.CTkFrame(bottom, fg_color='transparent')
        btn_frame.grid(row=0, column=1, padx=20, pady=8, sticky='e')

        ctk.CTkButton(btn_frame, text='+ Add Row', width=100,
                      fg_color='#2a3a5e', hover_color='#3a4e7a',
                      command=self._add_blank_row).pack(side='left', padx=(0, 8))

        self._import_btn = ctk.CTkButton(
            btn_frame, text='⬆  Import to LIMS', width=160,
            state='disabled', command=self._import_to_lims)
        self._import_btn.pack(side='left')

    def _build_header_row(self, parent):
        parent.grid_columnconfigure(tuple(range(len(DISPLAY_HEADERS) + 1)), weight=0)
        for j, col in enumerate(DISPLAY_HEADERS):
            ctk.CTkLabel(parent, text=col,
                         font=ctk.CTkFont(size=12, weight='bold'),
                         text_color='#8899bb',
                         width=COL_WIDTHS[col], anchor='w').grid(
                row=0, column=j, padx=(8 if j == 0 else 4, 4), pady=6, sticky='w')
        # Delete column header
        ctk.CTkLabel(parent, text='', width=36).grid(
            row=0, column=len(DISPLAY_HEADERS), padx=4, pady=6)

    # ── Settings ──────────────────────────────────────────────────

    def _restore_api_url(self):
        url = self._settings.get('api_url', '')
        self._url_var.set(url)

    def _save_url(self):
        self._settings['api_url'] = self._url_var.get().strip()
        save_settings(self._settings)
        self._set_status('API URL saved.')

    # ── File Selection ────────────────────────────────────────────

    def _select_pdf(self):
        path = filedialog.askopenfilename(
            title='Select Log Sheet PDF',
            filetypes=[('PDF files', '*.pdf'), ('All files', '*.*')]
        )
        if not path:
            return
        self._pdf_path = path
        self._file_label.configure(text=Path(path).name, text_color='#c8d6f0')
        self._run_btn.configure(state='normal')
        self._set_status('')

    # ── OCR ───────────────────────────────────────────────────────

    def _run_ocr(self):
        self._run_btn.configure(state='disabled')
        self._import_btn.configure(state='disabled')
        self._progress.set(0)
        self._set_status('Starting OCR…')
        self._clear_table()

        threading.Thread(target=self._ocr_thread, daemon=True).start()

    def _ocr_thread(self):
        try:
            self._set_status('Loading PDF…')
            pages = ocr_pdf(self._pdf_path)
            total = len(pages)
            all_rows: list[dict] = []
            inherited_cols: dict | None = None

            for i, page in enumerate(pages, start=1):
                self._set_status(f'Processing page {i} of {total}…')
                self._set_progress(i / total * 0.9)
                rows, inherited_cols = parse_page(
                    page['words'],
                    page_num=page['page'],
                    inherited_col_positions=inherited_cols if i > 1 else None
                )
                all_rows.extend(rows)

            self._set_status('Building table…')
            self._set_progress(1.0)
            # Update UI on main thread
            self.after(0, lambda: self._populate_table(all_rows))

        except Exception as e:
            self.after(0, lambda: self._ocr_error(str(e)))

    def _ocr_error(self, msg: str):
        self._run_btn.configure(state='normal')
        self._set_status('')
        messagebox.showerror('OCR Error', msg)

    # ── Table ─────────────────────────────────────────────────────

    def _clear_table(self):
        for widget in self._table_scroll.winfo_children():
            widget.destroy()
        self._rows = []
        self._entry_widgets = []
        self._row_count_label.configure(text='')

    def _populate_table(self, rows: list[dict]):
        self._clear_table()

        if not rows:
            ctk.CTkLabel(self._table_scroll,
                         text='No rows extracted. Check that the PDF is not blank or rotated.',
                         text_color='#f75f7a').pack(pady=40)
            self._run_btn.configure(state='normal')
            self._set_status('No rows found.')
            return

        for row in rows:
            self._add_table_row(row)

        self._run_btn.configure(state='normal')
        n = len(self._rows)
        self._row_count_label.configure(text=f'{n} rows')
        self._refresh_unclear_status()

    def _add_table_row(self, row: dict | None = None):
        if row is None:
            row = {c: '' for c in DISPLAY_HEADERS}

        row_frame = ctk.CTkFrame(self._table_scroll, fg_color='transparent', corner_radius=0)
        row_frame.pack(fill='x', padx=0, pady=1)

        svars: list[tk.StringVar] = []
        entries: list[ctk.CTkEntry] = []
        for j, col in enumerate(DISPLAY_HEADERS):
            val = str(row.get(col, ''))
            svar = tk.StringVar(value=val)
            is_unclear = (val.strip().upper() == UNCLEAR and col in REQUIRED_COLS)
            entry = ctk.CTkEntry(
                row_frame, textvariable=svar,
                width=COL_WIDTHS[col],
                fg_color='#3a1220' if is_unclear else '#1a2540',
                border_color='#f75f7a' if is_unclear else '#2a3a5e',
                text_color='#f75f7a' if is_unclear else '#c8d6f0',
                font=ctk.CTkFont(size=12)
            )
            entry.grid(row=0, column=j, padx=(8 if j == 0 else 2, 2), pady=2, sticky='w')
            # Re-colour on edit so user gets live feedback
            entry.bind('<FocusOut>', lambda e, sv=svar, en=entry, c=col: self._on_cell_edit(sv, en, c))
            svars.append(svar)
            entries.append(entry)

        # Delete button
        row_idx = len(self._rows)
        del_btn = ctk.CTkButton(row_frame, text='✕', width=32, height=28,
                                 fg_color='#3a1a2a', hover_color='#6b1a2a',
                                 text_color='#f75f7a', font=ctk.CTkFont(size=11),
                                 command=lambda f=row_frame, idx=row_idx: self._delete_row(f, idx))
        del_btn.grid(row=0, column=len(DISPLAY_HEADERS), padx=(4, 8), pady=2)

        self._rows.append(row)
        self._entry_widgets.append(svars)

    def _on_cell_edit(self, svar: tk.StringVar, entry: ctk.CTkEntry, col: str):
        """Recolour a cell live as the user edits it."""
        val = svar.get().strip()
        is_unclear = (val.upper() == UNCLEAR and col in REQUIRED_COLS) or (not val and col in REQUIRED_COLS)
        entry.configure(
            fg_color='#3a1220' if is_unclear else '#1a2540',
            border_color='#f75f7a' if is_unclear else '#2a3a5e',
            text_color='#f75f7a' if is_unclear else '#c8d6f0',
        )
        self._refresh_unclear_status()

    def _refresh_unclear_status(self):
        """Update the status label and Import button based on UNCLEAR cell count."""
        unclear_count = 0
        for i, svars in enumerate(self._entry_widgets):
            if self._rows[i] is None:
                continue
            for j, col in enumerate(DISPLAY_HEADERS):
                if col not in REQUIRED_COLS:
                    continue
                val = svars[j].get().strip()
                if val.upper() == UNCLEAR or not val:
                    unclear_count += 1
        n = sum(1 for r in self._rows if r is not None)
        if unclear_count > 0:
            self._set_status(f'⚠ {unclear_count} cell{"s" if unclear_count != 1 else ""} need fixing (highlighted in red)')
            self._import_btn.configure(state='disabled')
        else:
            self._set_status(f'{n} rows ready to import.')
            self._import_btn.configure(state='normal' if n > 0 else 'disabled')

    def _add_blank_row(self):
        self._empty_label.pack_forget()
        self._add_table_row()
        self._import_btn.configure(state='normal')
        n = len(self._rows)
        self._row_count_label.configure(text=f'{n} rows')

    def _delete_row(self, frame: ctk.CTkFrame, idx: int):
        frame.destroy()
        # Mark as deleted by clearing; actual removal happens at import time
        if idx < len(self._rows):
            self._rows[idx] = None  # type: ignore
        n = sum(1 for r in self._rows if r is not None)
        self._row_count_label.configure(text=f'{n} rows')
        if n == 0:
            self._import_btn.configure(state='disabled')

    def _collect_rows(self) -> list[dict]:
        """Read current StringVar values back into row dicts."""
        result = []
        for i, svars in enumerate(self._entry_widgets):
            if self._rows[i] is None:
                continue
            row = {col: svars[j].get().strip() for j, col in enumerate(DISPLAY_HEADERS)}
            result.append(row)
        return result

    # ── Import ────────────────────────────────────────────────────

    def _import_to_lims(self):
        api_url = self._url_var.get().strip()
        if not api_url:
            messagebox.showerror('No API URL',
                'Please paste your Apps Script Web App URL at the top of the window.')
            return

        rows = self._collect_rows()
        if not rows:
            messagebox.showwarning('Nothing to import', 'There are no rows to import.')
            return

        # Block on any UNCLEAR values in required columns
        unclear_rows = []
        for i, row in enumerate(rows, start=1):
            for col in REQUIRED_COLS:
                val = row.get(col, '').strip()
                if val.upper() == UNCLEAR or not val:
                    unclear_rows.append(f'Row {i} — {col}')
        if unclear_rows:
            msg = '\n'.join(unclear_rows[:15])
            if len(unclear_rows) > 15:
                msg += f'\n…and {len(unclear_rows) - 15} more'
            messagebox.showerror('Fix UNCLEAR Values',
                f'Please fix all highlighted cells before importing:\n\n{msg}')
            return

        self._import_btn.configure(state='disabled')
        self._run_btn.configure(state='disabled')
        self._set_status(f'Importing {len(rows)} rows…')
        self._progress.set(0)

        threading.Thread(
            target=self._upload_thread,
            args=(rows, api_url),
            daemon=True
        ).start()

    def _upload_thread(self, rows: list[dict], api_url: str):
        def progress(current, total, msg):
            pct = current / total if total else 0
            self.after(0, lambda: self._set_progress(pct))
            self.after(0, lambda: self._set_status(msg))

        success, errors = upload_rows(rows, api_url, progress_cb=progress)
        self.after(0, lambda: self._upload_done(success, errors))

    def _upload_done(self, success: int, errors: list[str]):
        self._import_btn.configure(state='normal')
        self._run_btn.configure(state='normal')
        self._progress.set(1.0)

        if not errors:
            self._set_status(f'✓ {success} rows imported successfully.')
            messagebox.showinfo('Import Complete',
                f'{success} log entries imported to LIMS successfully.')
        else:
            self._set_status(f'{success} imported, {len(errors)} failed.')
            err_text = '\n'.join(errors[:15])
            if len(errors) > 15:
                err_text += f'\n…and {len(errors) - 15} more'
            messagebox.showerror('Import Errors',
                f'{success} rows imported.\n\n{len(errors)} failed:\n\n{err_text}')

    # ── Helpers ───────────────────────────────────────────────────

    def _set_status(self, msg: str):
        self._status_label.configure(text=msg)

    def _set_progress(self, value: float):
        self._progress.set(value)


# ── Entry point ───────────────────────────────────────────────────

def main():
    app = App()
    app.mainloop()


if __name__ == '__main__':
    main()
