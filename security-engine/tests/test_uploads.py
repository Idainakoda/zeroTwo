"""Uploads: PDF / Word / picture extraction, OCR, and recognition of standard documents."""
import base64

import pytest
from fastapi.testclient import TestClient

from app import engine, extraction
from app.detectors import id_documents
from app.detectors.canonical import number_candidates
from app.main import app
from app.schemas import DocumentRequest
from evaluation import sample_documents as samples

needs_ocr = pytest.mark.skipif(
    (extraction.ocr.load() or not extraction.ocr.ready), reason="OCR models not installed")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _types(text: str) -> list[str]:
    return [d["type"] for d in engine.recognise_documents(text)]


# ------------------------------------------------------------ file acceptance

@pytest.mark.parametrize("name", [".env", "prod.env", "id_rsa", "notes.exe", "backup.zip", "page.html"])
def test_unsupported_files_are_refused(name):
    with pytest.raises(extraction.ExtractionError):
        extraction.extract(name, b"API_KEY=sk-test")


def test_renamed_file_is_refused():
    with pytest.raises(extraction.ExtractionError, match="not a PDF"):
        extraction.extract("report.pdf", b"hello, this is text")


def test_empty_and_oversized_files_are_refused():
    with pytest.raises(extraction.ExtractionError):
        extraction.extract("a.txt", b"")
    with pytest.raises(extraction.ExtractionError, match="10 MB"):
        extraction.extract("a.txt", b"x" * (extraction.MAX_BYTES + 1))


def test_text_file():
    out = extraction.extract("notes.md", "# Notes\nMeeting at 4 pm".encode())
    assert out.kind == "text" and "Meeting at 4 pm" in out.text and out.ocr_images == 0


def test_typed_pdf_without_ocr():
    out = extraction.extract("statement.pdf", samples.bank_statement_pdf())
    assert out.kind == "pdf" and out.pages == 1 and out.ocr_images == 0
    assert "Closing Balance" in out.text
    assert _types(out.text) == ["BANK_STATEMENT"]


# ------------------------------------------------------------ OCR

@needs_ocr
def test_ocr_reads_aadhaar_picture():
    out = extraction.extract("card.png", samples.aadhaar_card_png())
    assert out.kind == "image" and out.ocr_images == 1
    found = {f.type for f in engine._detect_data(out.text)}
    assert "AADHAAR" in found
    assert _types(out.text)[0] == "AADHAAR_CARD"


@needs_ocr
def test_ocr_reads_picture_inside_pdf():
    out = extraction.extract("letter.pdf", samples.notice_pdf_with_aadhaar_image())
    assert "Address change request" in out.text            # the text layer
    assert out.ocr_images == 1 and "Text read from image 1 on page 1" in out.text
    assert "AADHAAR" in {f.type for f in engine._detect_data(out.text)}
    assert _types(out.text)[0] == "AADHAAR_CARD"


@needs_ocr
def test_ocr_reads_scanned_pdf_page():
    out = extraction.extract("scan.pdf", samples.scanned_pan_pdf())
    assert "scanned page 1" in out.text
    assert "PAN" in {f.type for f in engine._detect_data(out.text)}
    assert _types(out.text)[0] == "PAN_CARD"


@needs_ocr
def test_ocr_reads_picture_inside_word_file():
    out = extraction.extract("kyc.docx", samples.docx_with_pan_picture())
    assert out.kind == "docx" and "vendor onboarding" in out.text and out.ocr_images == 1
    assert _types(out.text)[0] == "PAN_CARD"


@needs_ocr
def test_extract_endpoint(client):
    body = {"filename": "card.png", "content_base64": base64.b64encode(samples.pan_card_png()).decode()}
    r = client.post("/v1/extract", json=body).json()
    assert r["kind"] == "image" and r["ocr_images"] == 1
    assert r["document_types"][0]["type"] == "PAN_CARD"
    assert all("ABCPK" not in e for e in r["document_types"][0]["evidence"])   # cues only, never values


def test_extract_endpoint_refuses_env(client):
    body = {"filename": ".env", "content_base64": base64.b64encode(b"GEMINI_API_KEY=x").decode()}
    r = client.post("/v1/extract", json=body)
    assert r.status_code == 422 and "not supported" in r.json()["detail"]


# ------------------------------------------------------------ document recognition

def test_ocr_style_text_without_spaces_is_recognised():
    text = ("INCOMETAXDEPARTMENT GOVT.OFINDIA\nPermanentAccountNumberCard\nABCPK1234F\n"
            "Father'sName\nDateofBirth\n12/05/1990 Signature")
    assert _types(text) == ["PAN_CARD"]


@pytest.mark.parametrize("text", [
    "Please draft a letter to the Income Tax Department about my PAN ABCPK1234F.",
    "What documents do I need to apply for a passport?",
    "My Aadhaar is 4918 6372 5014, please update the HR record.",
    "Summarise the quarterly balance and deposit trends for the branch.",
])
def test_ordinary_text_is_not_a_document(text):
    assert _types(text) == []


def test_document_scan_reports_document_types():
    statement = extraction.extract("s.pdf", samples.bank_statement_pdf()).text
    result = engine.analyze_document(DocumentRequest(chunks=statement.split("\n\n"), source="attachment"))
    assert [d.type for d in result.document_types] == ["BANK_STATEMENT"]
    assert "50100234567812" not in result.spotlighted_context          # the account number is masked


def test_recognition_evidence_holds_no_values():
    text = "Government of India\nDOB: 12/05/1990\nMale\n4918 6372 5014\nAadhaar"
    match = id_documents.recognise(text, {"AADHAAR"})[0]
    assert match.type == "AADHAAR_CARD" and not any(ch.isdigit() for e in match.evidence for ch in e)


# ------------------------------------------------------------ numbers on separate lines

def test_numbers_on_separate_lines_are_separate_values():
    found = [c.digits for c in number_candidates("Issue Date: 01/03/2015\n4918 6372 5014")]
    assert found == ["01032015", "491863725014"]


def test_number_wrapped_across_lines_still_joins():
    assert [c.digits for c in number_candidates("4918\n6372\n5014")] == ["491863725014"]
