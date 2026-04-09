"""
ocr.py — Convert a multi-page PDF to per-page OCR word lists using EasyOCR.

Each page is rasterised to an image, then passed to EasyOCR.
Returns a list of page dicts:
    [
        {
            'page': 1,          # 1-based page number
            'words': [          # all detected text blocks on this page
                {
                    'bbox': [[x1,y1],[x2,y1],[x2,y2],[x1,y2]],
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

from typing import Any

# ── Lazy imports so startup is fast ──────────────────────────────

def _import_easyocr():
    try:
        import easyocr
        return easyocr
    except ImportError:
        raise ImportError(
            "easyocr is not installed.\n"
            "Run:  pip install easyocr"
        )

def _import_pdf2image():
    try:
        from pdf2image import convert_from_path
        return convert_from_path
    except ImportError:
        raise ImportError(
            "pdf2image is not installed.\n"
            "Run:  pip install pdf2image\n"
            "Also install poppler:\n"
            "  Windows: https://github.com/oschwartz10612/poppler-windows/releases\n"
            "  Mac:     brew install poppler"
        )

# ── Module-level OCR singleton (initialised once) ─────────────────

_ocr_instance: Any = None

def _get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        easyocr = _import_easyocr()
        # gpu=False ensures it works on all machines without a CUDA GPU
        _ocr_instance = easyocr.Reader(['en'], gpu=False)
    return _ocr_instance

# ── Public API ────────────────────────────────────────────────────

def ocr_pdf(pdf_path: str, dpi: int = 300) -> list[dict]:
    """
    Rasterise each page of *pdf_path* and run EasyOCR on it.

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
        import numpy as np
        img_np = np.array(img)

        # EasyOCR returns list of (bbox, text, conf)
        # bbox is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        raw = ocr.readtext(img_np)

        words = []
        for (bbox, text, conf) in raw:
            words.append({
                'bbox': bbox,
                'text': text,
                'conf': float(conf)
            })

        results.append({'page': page_num, 'words': words})

    return results
