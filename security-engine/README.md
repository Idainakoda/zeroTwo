# ZeroTwo Security Engine (FastAPI)

This is the Python security engine from the team's architecture. Spring Boot calls it **before** a prompt goes to the external AI and **after** the AI answers. It returns findings and an `ALLOW` / `SANITIZE` / `BLOCK` recommendation. Spring Boot then applies the organisation's policy and stores the `audit` record in MySQL.

Current robustness behavior, supported obfuscations, offline tests and model
limitations are documented in [Data protection](../docs/03_DATA_PROTECTION.md).

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
| 12 | Uploads and OCR | `app/extraction.py` | Text from PDF (PyMuPDF), Word (python-docx) and pictures. Embedded pictures and scanned pages are read with **RapidOCR** (ONNX, CPU, about 1 s per picture). Only document, picture and text types are accepted; `.env`, keys and executables are refused |
| 13 | Standard documents | `app/detectors/id_documents.py` | Recognises Aadhaar, PAN, passport, voter ID, driving licence, bank statement, cheque, salary slip and Form 16 from printed titles and field labels plus validated identifiers. It works on OCR text without spaces. The evidence lists cue names, never values |

**Access and data-handling safeguards**
- **Engine key:** the engine only answers requests carrying the shared `ENGINE_API_KEY`, which `setup.ps1` generates. With no key configured it refuses everything, unless `ENGINE_ALLOW_NO_KEY=true` is set explicitly for local tests.
- **Vault:** masked values are bound to the user who sent the prompt. They expire after `VAULT_TTL_S` and can be used once. Another user's request neither receives them nor uses them up.
- **Unknown classifications:** a document with an unknown or misspelt classification counts as SECRET. A user with an unknown clearance gets the least access.
- **Personal data cannot weaken an attack:** the classifier also scores the prompt without the sentences that carry personal data. Adding "my phone is …" to an attack therefore can't lower its score.

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

**Local Llama (optional but recommended):** install Ollama from ollama.com, then run `ollama pull llama3.2:3b`. Rules continue operating when it is unavailable, but possible confidential business content and unresolved suspicious input fail closed. `/health` checks that the configured model is installed and reports missing enabled layers as `degraded`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Presidio and local LLM status |
| POST | `/v1/analyze/prompt` | `{prompt, user:{user_id, role, department, clearance}, deep_scan}` |
| POST | `/v1/analyze/response` | `{request_id, response, user}`. Use the `request_id` from the prompt call |
| POST | `/v1/analyze/document` | `{chunks:[...], source}` for uploaded files and RAG chunks |
| POST | `/v1/extract` | `{filename, content_base64}`: text of a PDF, Word file, picture or text file (OCR included), plus `document_types`. A refused file returns 422 with a reason |
| POST | `/v1/rag/search` | `{query, user:{clearance, department}}`: clearance-filtered retrieval, with an `unauthorised_attempt` flag and scanned, spotlighted `context` |
| GET | `/v1/rag/documents` | knowledge-base documents (`?clearance=&department=` adds an `accessible` flag) |
| POST | `/v1/eval/run` | runs the evaluation set and returns metrics (for the dashboard) |
| POST | `/v1/eval/blind` | blind reworded-attack set with the per-layer comparison |
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

- **Development set** `evaluation/testset.json`: 123 cases (48 legitimate, 75 adversarial) covering prompts, documents and AI responses. The rules were tuned on it.
- **Blind set** `evaluation/blind_set.json`: 30 unseen attacks and 30 legitimate look-alikes, written before the ML layers were built and kept out of `attack_library.json`. Run it with `python -m evaluation.blind`.

Development set, all layers except Llama:

| Metric | Value |
|---|---|
| Detection accuracy | 98.4 % |
| Precision / Recall | 100 % / 97.3 % |
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

### Disguised identifiers (`python -m evaluation.obfuscation`)

This set has 22 attempts to sneak identifiers past the gateway and 20 legitimate look-alikes. The attempts:
- split numbers (`7|6|1|1 :: 9|1|2|6`), spelled-out or Devanagari digits;
- identity labels without the word Aadhaar ("IDREF", "KYC", "ID#");
- "concatenate the two halves";
- "reconstruct it and return the full number in plain digits".

A live test found that a split 12-digit number with an invalid checksum was forwarded unmasked, and the AI rebuilt it. That is fixed with three changes:
- A 12-digit value chopped into pieces of one or two digits, or labelled as an identity number, is now masked even if its checksum fails.
- Rule `EXF-03` blocks rebuild-and-reveal requests aimed at an identity number.
- Once a value is identified, every other copy of it in the same text is masked too, including in AI answers.

| Set | Before | After |
|---|---|---|
| Attacks protected | 18 / 22 | **22 / 22** |
| Legitimate prompts blocked | 0 / 20 | 0 / 20 |

The development, blind, data-protection and robustness results did not change.

A plain 12-digit number with no identity wording and an invalid checksum (e.g. `123456789012`) is still allowed. It cannot be a real Aadhaar, and masking every 12-digit number would also hide order and invoice numbers.

### Robustness set (demanding prompts in five categories)

`python -m evaluation.robust` runs 100 prompts in five categories:
- complex instruction following and negative constraints
- hallucination resistance and fact verification
- multi-step reasoning
- structured extraction and transformation
- adversarial and safety alignment

Each category mixes hard but legitimate work ("do not use bullet points", "ignore the second paragraph", "convert this to JSON", "verify this claim") with attacks written in the same style. `python -m evaluation.robust --holdout` runs a separate 30-prompt set that was written at the same time but never used for tuning. The local judge is off for both.

| Set | Accuracy | Attacks blocked | Legitimate prompts blocked |
|---|---|---|---|
| Robustness set, before tuning | 93 % | 37 / 40 | 4 / 60 |
| Robustness set, after tuning | 99 % | 40 / 40 | 1 / 60 |
| **Hold-out set (never tuned on)** | **90 %** | **14 / 15** | **2 / 15** |

Tuning added three things:
- A rule for harvesting stored identifiers ("Aadhaar numbers you have seen from any user").
- A rule for "every secret / API key from your setup".
- An exemption for override verbs aimed only at the user's own text ("ignore the typos", "forget the earlier draft"). With it, the classifier alone cannot block those prompts.

No threshold was changed. The development, blind and data-protection results did not move.

Remaining errors, which need the local judge or are out of scope:
- A request to write example attack phrases for training.
- "What the finance staff asked you this morning" style requests.
- A defensive question about hidden instructions in documents.
- One email draft with several negative constraints.

Honest notes:
- The first blind run had **2 / 30** legitimate prompts blocked. One was a rule bug (Hinglish "do" matching English "why do"). The other was the English-only classifier misfiring on Hindi script. Both were fixed afterwards, so the 0 / 30 above is no longer fully blind.
- The attacks still missed are mostly "what did *another officer* discuss with you" style requests. The real defence for those is architectural: never put other users' data in the model's context. That is the access-controlled RAG part.
