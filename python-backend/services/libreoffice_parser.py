"""
LibreOffice-based Office document parser.
Uses LibreOffice in headless mode (soffice --headless --convert-to txt) to extract
text from Office formats: doc, docx, odt, ods, odp, xls, xlsx, ppt, pptx, etc.
Requires LibreOffice to be installed on the system.
"""
import os
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional, List

# Office extensions that LibreOffice can convert to text
LIBREOFFICE_OFFICE_EXTENSIONS = [
    "doc", "docx", "odt", "ods", "odp", "odg", "odf", "odm", "odc", "odb",
    "xls", "xlsx", "ppt", "pptx", "rtf", "docm", "dot", "dotx", "dotm",
    "xlsm", "xlsb", "pptm", "pps", "ppsx", "ppsm", "sxc", "sxd", "sxi", "sxw",
    "stw", "sxg", "csv",
]

# Common Windows paths for soffice.exe
WINDOWS_SOFFICE_PATHS = [
    os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "LibreOffice", "program", "soffice.exe"),
    os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "LibreOffice", "program", "soffice.exe"),
    os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "LibreOffice 5", "program", "soffice.exe"),
    os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "LibreOffice 5", "program", "soffice.exe"),
]


def find_soffice() -> Optional[str]:
    """Locate soffice executable. Prefer SOFFICE_PATH env, then PATH, then common Windows paths."""
    env_path = os.environ.get("SOFFICE_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path
    which = "where" if sys.platform == "win32" else "which"
    try:
        out = subprocess.run([which, "soffice"], capture_output=True, text=True, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            candidate = out.stdout.strip().split("\n")[0].strip()
            if os.path.isfile(candidate):
                return candidate
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    if sys.platform == "win32":
        for p in WINDOWS_SOFFICE_PATHS:
            if os.path.isfile(p):
                return p
    return None


def extract_text_with_libreoffice(file_path: str, out_dir: Optional[str] = None) -> str:
    """
    Convert Office document to plain text using LibreOffice headless and return text.
    Returns empty string on failure; raises no exceptions.
    """
    if not os.path.isfile(file_path):
        return ""
    soffice = find_soffice()
    if not soffice:
        return ""
    use_dir = out_dir
    if not use_dir:
        use_dir = tempfile.mkdtemp()
    else:
        os.makedirs(use_dir, exist_ok=True)
    try:
        # txt:Text (encoded):UTF8 for UTF-8 output
        cmd = [
            soffice,
            "--headless",
            "--convert-to", "txt:Text (encoded):UTF8",
            "--outdir", use_dir,
            file_path,
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if proc.returncode != 0:
            return ""
        base = Path(file_path).stem
        txt_path = os.path.join(use_dir, base + ".txt")
        if not os.path.isfile(txt_path):
            return ""
        with open(txt_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except (subprocess.TimeoutExpired, OSError, IOError):
        return ""
    finally:
        if not out_dir and use_dir and os.path.isdir(use_dir):
            try:
                shutil.rmtree(use_dir, ignore_errors=True)
            except OSError:
                pass


def convert_to_pdf(file_path: str, out_dir: Optional[str] = None) -> Optional[str]:
    """
    Convert Office document to PDF using LibreOffice headless.
    Returns path to generated PDF file, or None on failure.
    """
    if not os.path.isfile(file_path):
        return None
    soffice = find_soffice()
    if not soffice:
        return None
    use_dir = out_dir
    if not use_dir:
        use_dir = tempfile.mkdtemp()
    else:
        os.makedirs(use_dir, exist_ok=True)
    try:
        cmd = [
            soffice,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", use_dir,
            file_path,
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if proc.returncode != 0:
            return None
        base = Path(file_path).stem
        pdf_path = os.path.join(use_dir, base + ".pdf")
        if not os.path.isfile(pdf_path):
            return None
        return pdf_path
    except (subprocess.TimeoutExpired, OSError, IOError):
        return None
    finally:
        if not out_dir and use_dir and os.path.isdir(use_dir):
            try:
                shutil.rmtree(use_dir, ignore_errors=True)
            except OSError:
                pass


def is_office_extension(ext: str) -> bool:
    """Return True if extension is one LibreOffice can convert to text."""
    return (ext or "").lower().strip() in LIBREOFFICE_OFFICE_EXTENSIONS
