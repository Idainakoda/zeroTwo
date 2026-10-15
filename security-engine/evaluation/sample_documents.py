"""Specimen documents for testing uploads and OCR. Every value is fictitious.

    python -m evaluation.sample_documents          # writes the files to ../demo-files/

The Aadhaar and PAN numbers pass their checksums so the detectors treat them as real
identifiers, but they belong to nobody. Each picture is stamped SPECIMEN.
"""
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AADHAAR = "4918 6372 5014"          # Verhoeff-valid, fictitious
PAN = "ABCPK1234F"                  # valid PAN format (individual), fictitious
NAME = "Ramesh Kumar Sharma"
DOB = "12/05/1990"


def _font(size: int, bold: bool = False):
    for name in (("arialbd.ttf", "DejaVuSans-Bold.ttf") if bold else ("arial.ttf", "DejaVuSans.ttf")):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def _png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _jpeg(png: bytes) -> bytes:
    """Photos inside PDFs are usually JPEG; it also keeps the specimen PDFs small."""
    buf = io.BytesIO()
    Image.open(io.BytesIO(png)).convert("RGB").save(buf, "JPEG", quality=85)
    return buf.getvalue()


def _stamp(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    d.text((w - 230, h - 50), "SPECIMEN", fill=(200, 40, 40), font=_font(30, True))


def aadhaar_card_png() -> bytes:
    w, h = 1000, 620
    img = Image.new("RGB", (w, h), (252, 250, 245))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 90], fill=(255, 153, 51))
    d.rectangle([0, 90, w, 110], fill=(255, 255, 255))
    d.rectangle([0, 110, w, 130], fill=(19, 136, 8))
    d.text((300, 25), "Government of India", fill=(20, 20, 20), font=_font(40, True))
    d.rectangle([40, 170, 260, 430], outline=(120, 120, 120), width=3)
    d.text((95, 285), "PHOTO", fill=(150, 150, 150), font=_font(30))
    d.text((300, 180), NAME, fill=(10, 10, 10), font=_font(36))
    d.text((300, 245), f"DOB: {DOB}", fill=(10, 10, 10), font=_font(34))
    d.text((300, 305), "Male", fill=(10, 10, 10), font=_font(34))
    d.text((300, 365), "Issue Date: 01/03/2015", fill=(10, 10, 10), font=_font(28))
    d.text((300, 470), AADHAAR, fill=(0, 0, 0), font=_font(54, True))
    d.text((300, 550), "Aadhaar - Mera Aadhaar, Meri Pehchan", fill=(160, 20, 20), font=_font(26))
    _stamp(d, w, h)
    return _png(img)


def pan_card_png() -> bytes:
    w, h = 1000, 620
    img = Image.new("RGB", (w, h), (214, 232, 245))
    d = ImageDraw.Draw(img)
    d.text((40, 30), "INCOME TAX DEPARTMENT", fill=(20, 20, 60), font=_font(38, True))
    d.text((640, 35), "GOVT. OF INDIA", fill=(20, 20, 60), font=_font(32, True))
    d.text((40, 120), "Permanent Account Number Card", fill=(20, 20, 60), font=_font(30))
    d.text((40, 170), PAN, fill=(0, 0, 0), font=_font(50, True))
    d.text((40, 260), "Name", fill=(60, 60, 60), font=_font(24))
    d.text((40, 295), NAME.upper(), fill=(0, 0, 0), font=_font(34))
    d.text((40, 360), "Father's Name", fill=(60, 60, 60), font=_font(24))
    d.text((40, 395), "SURESH KUMAR SHARMA", fill=(0, 0, 0), font=_font(34))
    d.text((40, 460), "Date of Birth", fill=(60, 60, 60), font=_font(24))
    d.text((40, 495), DOB, fill=(0, 0, 0), font=_font(34))
    d.text((640, 495), "Signature", fill=(60, 60, 60), font=_font(24))
    _stamp(d, w, h)
    return _png(img)


def notice_pdf_with_aadhaar_image() -> bytes:
    """A typed cover letter (text layer) with a photographed Aadhaar card pasted in as a picture."""
    import pymupdf as fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((56, 72), "Subject: Address change request", fontsize=14)
    page.insert_text((56, 100), "Please update my address in the employee records.", fontsize=11)
    page.insert_text((56, 118), "My identity proof is attached below.", fontsize=11)
    page.insert_image(fitz.Rect(56, 150, 456, 398), stream=_jpeg(aadhaar_card_png()))
    out = doc.tobytes()
    doc.close()
    return out


def scanned_pan_pdf() -> bytes:
    """A 'scanned' PDF: the page is only a picture, with no text layer at all."""
    import pymupdf as fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(36, 36, 559, 360), stream=_jpeg(pan_card_png()))
    out = doc.tobytes()
    doc.close()
    return out


def bank_statement_pdf() -> bytes:
    import pymupdf as fitz

    doc = fitz.open()
    page = doc.new_page()
    lines = [
        ("STATEMENT OF ACCOUNT", 16), ("Example Bank Ltd., Connaught Place Branch", 11),
        ("Account No: 50100234567812    IFSC: HDFC0001234", 11),
        ("Customer ID: 88412093    Period: 01/04/2026 to 30/04/2026", 11),
        ("Opening Balance: Rs 1,24,500.00", 11),
        ("Date        Description            Withdrawal    Deposit     Balance", 10),
        ("02/04/2026  Salary credit                         85,000.00   2,09,500.00", 10),
        ("05/04/2026  Rent transfer          25,000.00                  1,84,500.00", 10),
        ("Closing Balance: Rs 1,84,500.00", 11),
    ]
    y = 72
    for text, size in lines:
        page.insert_text((56, y), text, fontsize=size)
        y += 24
    out = doc.tobytes()
    doc.close()
    return out


def docx_with_pan_picture() -> bytes:
    from docx import Document
    from docx.shared import Inches

    document = Document()
    document.add_paragraph("KYC documents for vendor onboarding.")
    document.add_picture(io.BytesIO(pan_card_png()), width=Inches(5))
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()


SAMPLES = {
    "specimen-aadhaar-card.png": aadhaar_card_png,
    "specimen-pan-card.png": pan_card_png,
    "specimen-letter-with-aadhaar.pdf": notice_pdf_with_aadhaar_image,
    "specimen-scanned-pan.pdf": scanned_pan_pdf,
    "specimen-bank-statement.pdf": bank_statement_pdf,
    "specimen-kyc-with-pan.docx": docx_with_pan_picture,
}


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[2] / "demo-files"
    target.mkdir(exist_ok=True)
    for name, build in SAMPLES.items():
        (target / name).write_bytes(build())
        print("wrote", target / name)
