"""
ocr.py — Convert a multi-page PDF to per-page OCR word lists using PaddleOCR.

Each page is rasterised to an image, then passed to PaddleOCR.
Returns a list of page dicts:
    [
        {
            'page': 1,          # 1-based page number
            'words': [          # all detected text blocks on this page
                {
                    'bbox': [[x1,y1],[x2,y1],[x2,y2],[x1,y2]],  # 4-point polygon
                    'text': 'Alcohol Wipes',
                    'conf': 0.97
                },
                ...
            ]
        },
        ...
    ]
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

# ── Lazy imports so startup is fast ──────────────────────────────


def _import_paddle():
    try:
        from paddleocr import PaddleOCR
        return PaddleOCR
    except ImportError:
        raise ImportError(
            "PaddleOCR is not installed.\n"
            "Run:  pip install paddleocr paddlepaddle"
        )


def _import_pdf2image():
    try:
        from pdf2image import convert_from_path
        return convert_from_path
    except ImportError:
        raise ImportError(
            "pdf2image is not installed.\n"
            "Run:  pip install pdf2image\n"
            "Also install poppler:  https://poppler.freedesktop.org/"
        )


# ── Module-level OCR singleton (initialised once) ─────────────────

_ocr_instance: Any = None


def _get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        PaddleOCR = _import_paddle()
        # lang='en', use_angle_cls detects rotated text
        _ocr_instance = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr_instance


# ── Public API ────────────────────────────────────────────────────


def ocr_pdf(pdf_path: str, dpi: int = 300) -> list[dict]:
    """
    Rasterise each page of *pdf_path* and run PaddleOCR on it.

    Parameters
    ----------
    pdf_path : str
        Path to the input PDF file.
    dpi : int
        Resolution for rasterisation. 300 is a good default for lab scans.

    Returns
    -------
    list of page dicts (see module docstring).
    """
    convert_from_path = _import_pdf2image()
    ocr = _get_ocr()

    pages_pil = convert_from_path(pdf_path, dpi=dpi)
    results = []

    for page_num, img in enumerate(pages_pil, start=1):
        # PaddleOCR accepts a numpy array
        import numpy as np
        img_np = np.array(img)

        raw = ocr.ocr(img_np, cls=True)
        words = []

        # raw is a list of lists; outer list = one element per image passed.
        # raw[0] = list of [bbox, (text, conf)] for this page.
        page_raw = raw[0] if raw and raw[0] else []
        for item in page_raw:
            if item is None:
                continue
            bbox, (text, conf) = item
            words.append({
                'bbox': bbox,   # [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
                'text': text,
                'conf': float(conf)
            })

        results.append({'page': page_num, 'words': words})

    return results
