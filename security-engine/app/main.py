"""FastAPI security engine. Spring Boot calls these endpoints before and after the external AI call."""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import config, engine, llm_analyzer, policy
from app.detectors import pii
from app.detectors.ml_injection import ml
from app.rag import store as rag_store
from app.schemas import (DocumentAnalysis, DocumentRequest, PromptAnalysis, PromptRequest, RagSearchRequest,
                         ResponseAnalysis, ResponseRequest)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    pii.presidio.load()
    ml.load()
    rag_store.load()
    yield


app = FastAPI(title="CyberCup Security Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def check_key(x_engine_key: str = Header(default="")) -> None:
    if config.API_KEY and x_engine_key != config.API_KEY:
        raise HTTPException(status_code=401, detail="invalid engine key")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "presidio": pii.presidio.ready,
        "presidio_error": pii.presidio.error or None,
        "ml_injection": {"semantic": ml.ready, "classifier": ml.classifier is not None, "error": ml.error or None},
        "rag_documents": len(rag_store.docs),
        "local_llm": {"enabled": config.USE_LLM, "model": config.OLLAMA_MODEL,
                      "reachable": await llm_analyzer.is_available()},
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
