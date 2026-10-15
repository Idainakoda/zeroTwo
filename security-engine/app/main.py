"""FastAPI security engine. Spring Boot calls these endpoints before and after the external AI call."""
import base64
import binascii
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import config, engine, extraction, llm_analyzer, policy
from app.detectors import pii
from app.detectors.ml_injection import ml
from app.extraction import ocr
from app.rag import store as rag_store
from app.schemas import (DocumentAnalysis, DocumentRequest, ExtractRequest, ExtractResponse, PromptAnalysis,
                         PromptRequest, RagSearchRequest, ResponseAnalysis, ResponseRequest)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    pii.presidio.load()
    ml.load()
    rag_store.load()
    ocr.load()
    yield


app = FastAPI(title="ZeroTwo Security Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def check_key(x_engine_key: str = Header(default="")) -> None:
    if config.API_KEY and x_engine_key != config.API_KEY:
        raise HTTPException(status_code=401, detail="invalid engine key")


@app.get("/health")
async def health():
    llm_ready = await llm_analyzer.is_available()
    missing = []
    if config.USE_PRESIDIO and not pii.presidio.ready:
        missing.append("presidio")
    if config.USE_ML_INJECTION and ml.embedder is None:
        missing.append("semantic")
    if config.USE_ML_INJECTION and config.USE_CLASSIFIER and ml.classifier is None:
        missing.append("classifier")
    if config.USE_OCR and not ocr.ready:
        missing.append("ocr")
    if config.USE_LLM and not llm_ready:
        missing.append("local_llm")
    return {
        "status": "degraded" if missing else "ok",
        "missing_layers": missing,
        "presidio": pii.presidio.ready,
        "presidio_error": pii.presidio.error or None,
        "ml_injection": {"semantic": ml.embedder is not None, "semantic_model": config.SEMANTIC_MODEL,
                         "semantic_revision": config.SEMANTIC_REVISION,
                         "classifier": ml.classifier is not None, "classifier_model": config.CLASSIFIER_MODEL,
                         "classifier_revision": config.CLASSIFIER_REVISION,
                         "error": ml.error or None},
        "rag_documents": len(rag_store.docs),
        "ocr": {"enabled": config.USE_OCR, "ready": ocr.ready, "error": ocr.error or None},
        "local_llm": {"enabled": config.USE_LLM, "model": config.OLLAMA_MODEL,
                      "reachable": llm_ready, "model_available": llm_ready},
    }


@app.post("/v1/analyze/prompt", response_model=PromptAnalysis, dependencies=[Depends(check_key)])
async def analyze_prompt(req: PromptRequest):
    return await engine.analyze_prompt(req)


@app.post("/v1/analyze/response", response_model=ResponseAnalysis, dependencies=[Depends(check_key)])
def analyze_response(req: ResponseRequest):
    return engine.analyze_response(req)


@app.post("/v1/analyze/document", response_model=DocumentAnalysis, dependencies=[Depends(check_key)])
def analyze_document(req: DocumentRequest):
    return engine.analyze_document(req)


@app.post("/v1/extract", response_model=ExtractResponse, dependencies=[Depends(check_key)])
def extract_file(req: ExtractRequest):
    """Text of an uploaded file (PDF, Word, picture, text), with OCR for pictures and scanned pages.

    Only extraction and document-type recognition happen here; the text is inspected in full by
    /v1/analyze/document when it is sent with a prompt."""
    try:
        data = base64.b64decode(req.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="The file could not be read.")
    try:
        out = extraction.extract(req.filename, data)
    except extraction.ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return ExtractResponse(filename=out.filename, kind=out.kind, text=out.text, chars=len(out.text),
                           pages=out.pages, ocr_images=out.ocr_images, ocr_ms=out.ocr_ms,
                           truncated=out.truncated, warnings=out.warnings,
                           document_types=engine.recognise_documents(out.text))


@app.post("/v1/rag/search", dependencies=[Depends(check_key)])
def rag_search(req: RagSearchRequest):
    """Clearance-filtered retrieval. Restricted chunks are never scored for the answer."""
    return rag_store.search(req.query, req.user.clearance, req.user.department, req.top_k)


@app.get("/v1/rag/documents", dependencies=[Depends(check_key)])
def rag_documents(clearance: str | None = None, department: str = ""):
    return rag_store.list_documents(clearance, department)


@app.post("/v1/rag/reload", dependencies=[Depends(check_key)])
def rag_reload():
    rag_store.load()
    return {"documents": len(rag_store.docs), "chunks": len(rag_store.chunks)}


@app.post("/v1/policy/reload", dependencies=[Depends(check_key)])
def reload_policy():
    p = policy.reload()
    return {"block_types": sorted(p.block_types), "codenames": len(p.codenames)}


@app.post("/v1/eval/run", dependencies=[Depends(check_key)])
async def run_eval():
    from evaluation.run import run_all
    report = await run_all()
    report.pop("results", None)
    return report


@app.post("/v1/eval/blind", dependencies=[Depends(check_key)])
async def run_blind_eval():
    from evaluation.blind import run_blind
    return await run_blind()
