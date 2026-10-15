# CyberCup Security Engine (FastAPI)

This is the Python security engine from the team's architecture. Spring Boot calls it **before** a prompt goes to the external AI and **after** the AI answers. It returns findings and an `ALLOW` / `SANITIZE` / `BLOCK` recommendation. Spring Boot then applies the organisation's policy and stores the `audit` record in MySQL.

```
Employee → Spring Boot ──POST /v1/analyze/prompt──▶ Engine
                         ◀── decision + sanitized_prompt + system_prompt_addon + audit
          (ALLOW/SANITIZE) → External AI (system prompt = your prompt + system_prompt_addon)
          Spring Boot ──POST /v1/analyze/response (request_id, AI answer)──▶ Engine
                         ◀── decision + safe_response (placeholders restored) + audit
          → Employee + MySQL audit + dashboard
```

## Layers

| # | Layer | File | What it does |
|---|---|---|---|
| 1 | Normaliser | `app/normalizer.py` | Unicode NFKC, removes zero-width characters, maps look-alike letters, collapses `i g n o r e`, folds leetspeak, decodes base64/hex, adds ROT13 and reversed views |
| 2 | Personal & financial data | `app/detectors/pii.py` | Aadhaar (Verhoeff), VID, PAN (holder-type rule), GSTIN (check digit), cards (Luhn), +91 mobile, email, UPI, IFSC, bank account, passport, voter ID, DL and DOB (context-gated), plus person names via **Presidio** |
| 3 | Secrets | `app/detectors/secrets.py` | AWS, OpenAI, Anthropic, Groq, Google, GitHub, Slack, HF, Stripe, Razorpay keys, JWTs, private keys, DB connection strings, `password=` / "password is …", high-entropy tokens |
| 4 | Confidential content | `app/detectors/confidential.py` | Classification markings (English and Hindi), internal codenames (`policy.yaml`), internal IPs and hosts, source code, business-context hints |
| 5 | Prompt injection | `app/detectors/injection.py` | About 60 weighted rules in English, Hinglish and Hindi covering override, system-prompt extraction, jailbreak, other users' data, chat-template injection, indirect injection, exfiltration. Each normalised view is scanned |
| 5b | Semantic similarity | `app/detectors/ml_injection.py` | Multilingual MiniLM embeddings compared with known attacks **and** legitimate look-alikes (`attack_library.json`). Catches paraphrases in English, Hindi and Hinglish |
| 5c | Injection classifier | `app/detectors/ml_injection.py` | `protectai/deberta-v3-base-prompt-injection-v2` on CPU. English only, so it's skipped for Devanagari text. On code snippets it is halved, so it can only send them to Llama |
| 6 | Local Llama | `app/llm_analyzer.py` | Ollama is called **only** for grey-zone prompts (injection score 0.30 to 0.70, or a business-context hint). It receives the redacted text. Its verdict can only make a decision **stricter**, never weaker |
| 7 | Risk score and decision | `app/engine.py` | 0–100 risk score. The strictest rule wins. Bulk personal data is blocked |
| 8 | Redaction and re-scan | `app/redaction.py` | `<AADHAAR_1>`-style placeholders (same value → same placeholder). The sanitised prompt is scanned again, and if anything remains the request is BLOCKED |
| 9 | Prompt hardening | `app/redaction.py` | `system_prompt_addon` holds a per-request **canary** and safety rules for Spring Boot to add to the AI's system prompt |
| 10 | Response inspection | `app/engine.py` | Canary leak, instruction-disclosure phrases, PII or secrets not from this user (redacted), then placeholders are restored for this user only |
| 11 | Document scan | `app/engine.py` | Each chunk is scanned. Chunks with indirect injection are quarantined. The rest are redacted and wrapped in `<<UNTRUSTED_DOCUMENT>>` markers |

The audit record contains **no raw values**: only types, counts, HMAC hashes, rules, decision and timings. Spring Boot should store it in MySQL and chain each row's hash to the previous one (`hash = SHA256(prev_hash + record_json)`) so tampering can be detected.

## Run it (Windows PowerShell)

```powershell
cd "security-engine"
python -m venv .venv
.venv\Scripts\python -m pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spacy download en_core_web_sm
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/health

**Local Llama (optional but recommended):** install Ollama from ollama.com, then run `ollama pull llama3.2:3b`. If Ollama isn't running, the engine still works with rules only, and `/health` shows `reachable: false`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Presidio and local LLM status |
| POST | `/v1/analyze/prompt` | `{prompt, user:{user_id, role, department, clearance}, deep_scan}` |
| POST | `/v1/analyze/response` | `{request_id, response, user}`. Use the `request_id` from the prompt call |
| POST | `/v1/analyze/document` | `{chunks:[...], source}` for uploaded files and RAG chunks |
| POST | `/v1/eval/run` | runs the evaluation set and returns metrics (for the dashboard) |
| POST | `/v1/policy/reload` | reloads `policy.yaml` |

Example `/v1/analyze/prompt` response (shortened):
```json
{
  "request_id": "9f2c…",
  "decision": "SANITIZE",
  "risk_score": 100,
  "injection_score": 0.0,
  "reasons": ["Sensitive data will be masked: AADHAAR, PAN, PHONE_IN"],
  "findings": [{"category": "PII", "type": "AADHAAR", "severity": 4, "confidence": 0.99,
                "start": 40, "end": 54, "detector": "regex+validator",
                "preview": "XXXX XXXX 0124", "value_hash": "1c9e…"}],
  "sanitized_prompt": "Draft a letter to <PERSON_1>, Aadhaar <AADHAAR_1>, PAN <PAN_1> …",
  "system_prompt_addon": "[Security notice | internal reference CNRY-…] …",
  "timing_ms": {"normalize": 0.3, "detect": 9.1, "injection": 1.2, "llm": 0, "redact": 4.0, "total": 15.2},
  "audit": {"…": "privacy-safe record for MySQL"}
}
```

## Evaluation

```powershell
.venv\Scripts\python -m evaluation.run --no-llm     # rules only
.venv\Scripts\python -m evaluation.run              # with local Llama, if Ollama is running
.venv\Scripts\python -m pytest -q tests
```

There are two sets:

- **Development set** `evaluation/testset.json`: 118 cases (47 legitimate, 71 adversarial) covering prompts, documents and AI responses. The rules were tuned on it.
- **Blind set** `evaluation/blind_set.json`: 30 unseen attacks and 30 legitimate look-alikes, written before the ML layers were built and kept out of `attack_library.json`. Run it with `python -m evaluation.blind`.

Development set, all layers except Llama:

| Metric | Value |
|---|---|
| Detection accuracy | 98.3 % |
| Precision / Recall | 100 % / 97.2 % |
| False-positive rate | 0.0 % |
| Added latency (CPU laptop) | p50 ≈ 130 ms, p95 ≈ 280 ms (rules alone: p95 ≈ 12 ms) |
| Misses | C06, C07: confidential business context, which needs the local Llama layer |

Blind set (unseen wording), what each layer adds:

| Layers | Attacks blocked | + sent to Llama | Legit blocked |
|---|---|---|---|
| Rules only | 8 / 30 | 2 | 0 / 30 |
| Rules + semantic | 9 / 30 | 12 | 0 / 30 |
| Rules + classifier | 21 / 30 | 6 | 0 / 30 |
| **Rules + semantic + classifier** | **25 / 30** | **4** | **0 / 30** |

Honest notes:
- The first blind run had **2 / 30** legitimate prompts blocked. One was a rule bug (Hinglish "do" matching English "why do"). The other was the English-only classifier misfiring on Hindi script. Both were fixed afterwards, so the 0 / 30 above is no longer fully blind.
- The attacks still missed are mostly "what did *another officer* discuss with you" style requests. The real defence for those is architectural: never put other users' data in the model's context. That is the access-controlled RAG part.
