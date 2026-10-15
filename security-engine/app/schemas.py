"""Request / response models. These form the contract with the Spring Boot backend."""
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Decision(str, Enum):
    ALLOW = "ALLOW"
    SANITIZE = "SANITIZE"
    BLOCK = "BLOCK"


class Category(str, Enum):
    PII = "PII"
    FINANCIAL = "FINANCIAL"
    SECRET = "SECRET"
    CONFIDENTIAL = "CONFIDENTIAL"
    INJECTION = "INJECTION"
    OUTPUT_LEAK = "OUTPUT_LEAK"


class Finding(BaseModel):
    category: Category
    type: str                     # e.g. AADHAAR, PAN, AWS_ACCESS_KEY, SYSTEM_PROMPT_EXTRACTION
    severity: int                 # 1 low .. 4 critical
    confidence: float             # 0..1
    start: int = -1               # character offsets in the ORIGINAL text (-1 = whole text)
    end: int = -1
    detector: str                 # which layer found it
    redactable: bool = False      # can be replaced by a placeholder
    preview: str = ""             # masked preview, never the raw value (e.g. "XXXX XXXX 0124")
    value_hash: str = ""          # HMAC-SHA256 of the value, safe for audit logs
    reason: str = ""


class UserContext(BaseModel):
    user_id: str = "anonymous"
    role: str = "Employee"
    department: str = ""
    clearance: str = "Internal"


class PromptRequest(BaseModel):
    prompt: str = Field(..., max_length=100_000)
    user: UserContext = UserContext()
    deep_scan: bool = False       # force the local LLM layer


class LayerTiming(BaseModel):
    normalize: float = 0
    detect: float = 0
    injection: float = 0
    ml: float = 0
    llm: float = 0
    redact: float = 0
    total: float = 0


class LlmVerdict(BaseModel):
    called: bool = False
    available: bool = True
    injection: Optional[bool] = None
    confidential_context: Optional[bool] = None
    risk: Optional[float] = None
    reason: str = ""


class PromptAnalysis(BaseModel):
    request_id: str
    decision: Decision
    risk_score: int                       # 0..100
    injection_score: float
    reasons: list[str]
    findings: list[Finding]
    sanitized_prompt: Optional[str] = None   # only when decision == SANITIZE
    masked_prompt: Optional[str] = None      # always: every redactable value replaced (None if masking is unsafe)
    residual_risk: bool = False              # sensitive data survived masking -> must not be forwarded
    system_prompt_addon: str = ""            # canary + safety rules to prepend to the LLM system prompt
    layer_scores: dict = {}                  # injection score per layer: rules, semantic, classifier, fused
    llm: LlmVerdict = LlmVerdict()
    timing_ms: LayerTiming
    audit: dict                              # privacy-safe record for MySQL


class ResponseRequest(BaseModel):
    request_id: str = ""                     # from the prompt analysis, enables re-hydration + canary check
    response: str = Field(..., max_length=200_000)
    user: UserContext = UserContext()
    rehydrate: bool = True                   # False for the REDACT action: placeholders stay redacted


class RagSearchRequest(BaseModel):
    query: str = Field(..., max_length=20_000)
    user: UserContext = UserContext()
    top_k: int = 4


class ResponseAnalysis(BaseModel):
    request_id: str
    decision: Decision
    findings: list[Finding]
    reasons: list[str]
    safe_response: Optional[str]             # what the employee may see (None when BLOCK)
    timing_ms: float
    audit: dict


class DocumentRequest(BaseModel):
    chunks: list[str] = Field(..., max_length=200)
    source: str = Field(default="upload", max_length=200)
    user: UserContext = UserContext()

    @field_validator("chunks")
    @classmethod
    def limit_document_size(cls, chunks):
        if sum(map(len, chunks)) > 200_000:
            raise ValueError("document exceeds the 200000-character inspection limit")
        return chunks


class ChunkVerdict(BaseModel):
    index: int
    quarantined: bool
    injection_score: float
    findings: list[Finding]


class DocumentAnalysis(BaseModel):
    chunks: list[ChunkVerdict]
    quarantined: int
    spotlighted_context: str                 # safe chunks wrapped as untrusted data
    timing_ms: float
