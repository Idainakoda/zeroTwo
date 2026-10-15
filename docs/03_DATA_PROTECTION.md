# Data protection and robustness

The gateway detects personal data, financial details, credentials and confidential
content before answer generation. The same PII/secret recognizers are used by
prompt inspection, response inspection, uploaded documents and retrieved chunks.
Detection is a layered safeguard, not a guarantee that arbitrary secrets can be
recognized without labels or context.

## What changed

- A detection-only Unicode view maps NFKC characters, decimal scripts, common
  look-alike letters and invisible formatting back to original offsets. The
  message itself stays unchanged until a value is masked.
- Numeric candidates accept bounded spaces, ordinary/Unicode dashes, dots,
  slashes, pipes, underscores and line breaks. Maximal runs avoid taking a valid
  substring out of an unrelated longer number. Blank lines and record boundaries
  do not join values.
- Digit words in English, Hindi and common Hinglish spellings, mixed words and
  digits, and English `double`/`triple` repetitions are supported. This is
  digit-by-digit speech; arbitrary cardinal phrases such as "two thousand..."
  are not parsed. Spoken phone numbers require phone context.
- Aadhaar/VID use Verhoeff, cards use Luhn, and PAN uses its structural/holder-type
  rule. A checksum verifies structure, not whether an identity/account exists.
- Aadhaar/card/PAN-labelled values with supported lengths but invalid validation
  become `POSSIBLE_*` findings and are masked conservatively. Unlabelled invalid
  order numbers stay unflagged.
- PAN supports lowercase, separated letters/digits and spoken digit portions.
  Bank accounts support separated/spoken digits with bank context. Other existing
  recognizers benefit from the Unicode view; this does not mean every identifier
  type supports every separator or spoken spelling.
- Added labelled balance/pay amounts, card security codes and mod-97 IBAN checks
  for GB, DE, FR, NL, ES, IT, IE, CH, BE, AT, AE and SA.
- Passwords include simple lowercase literals and quoted values containing spaces
  or punctuation. Provider-specific API keys, authorization headers, credential
  URLs and connection strings remain covered. Environment references and obvious
  documentation placeholders are excluded. Unlabelled ordinary words cannot be
  reliably distinguished from passwords.
- Overlapping mask spans are merged in full. Blocking findings are retained.
  A second scan checks prompt, response and document masks. Split identifiers
  spanning uploaded chunks cause the affected chunks to be quarantined.
- Document classification markings/private keys and unresolved business context
  are quarantined in uploads. RAG retains its existing classification/clearance
  checks; authorized classified documents can still be routed according to the
  gateway's external-model classification setting.
- An unavailable/disabled/invalid local judge blocks possible confidential
  business content and unresolved suspicious input. Low-scoring, rule-only,
  educational wording can remain allowed with a warning. Engine BLOCK decisions
  and residual-risk failures cannot be weakened by backend ALLOW/WARN policies.

## Models and health

The injection classifier remains `protectai/deberta-v3-base-prompt-injection-v2`.
Multilingual semantic matching remains
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. Neither was trained
in this repository. Models load independently, and both now receive overlapping
token windows covering the full input, in bounded batches. Scores are heuristics
and require calibration on representative held-out data.

`SEMANTIC_REVISION` and `CLASSIFIER_REVISION` optionally accept immutable Hugging
Face commit hashes for reproducible deployments. Choose and evaluate revisions
before pinning them; no accuracy claims are attached to an untested revision.

Llama is still the separately downloaded Ollama `llama3.2:3b` judge, with strict
JSON boolean/number validation. Inputs above its 6,000-character review limit are
reported unavailable instead of silently truncated. Business content then fails
closed. `/health` reports `degraded`, missing layers, configured model IDs and
whether the exact Ollama model is installed, rather than only checking the server.
This checks installation, not a successful inference or adequate runtime memory.

Install/start Ollama separately and run:

```bash
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

No custom Llama weights, fine-tuning adapters or new trained PII model are included.
An API key does not supply or train a local model. Gemini remains the optional
external answer provider configured through `GEMINI_API_KEY`. Do not put keys or
real identity documents in tests or Git.

## Verification

From `security-engine`:

```bash
python -m pip install -r requirements-test.txt
python -m pytest -q tests
python -m evaluation.data_protection
```

The tests default to optional models disabled and do not download weights. They
cover original spans, complete masks, non-sensitive examples, provider secrets,
Unicode/word/separator variants, shared API paths, unavailable-model status,
strict judge parsing and classifier window coverage using a deterministic fake.
CI runs the Python tests and the data-protection benchmark.

The data-protection benchmark contains 261 public synthetic regression fixtures
(253 positives, eight negatives); it reports per-entity detection, full redaction,
false positives and p95 latency. Its fixtures and transformations are visible and
have been used during development: it is not a blind benchmark or a production
accuracy estimate. Keep the existing injection benchmark separate.

For the existing development set without optional models, set `USE_PRESIDIO=false`,
`USE_ML_INJECTION=false`, `USE_LLM=false`, then run:

```bash
python -m evaluation.run --no-llm --no-ml
```

Java policy safety tests can run without MySQL:

```bash
./mvnw -Dtest=PolicyDecisionServiceTests test
```

Before production, collect consented/anonymized representative examples and hard
negatives, split by underlying identity/document before generating variants,
and hold out unseen languages and transformation combinations. Measure span
precision/recall, redaction leak rate, policy decisions and latency by entity and
language. Use those results to tune context/thresholds and decide whether a
multilingual PII span model or fine-tuning adds value. Synthetic-only success is
insufficient evidence to train or select such a model.

References: [tokenizer offsets](https://huggingface.co/docs/transformers/main_classes/tokenizer),
[Ollama model inventory](https://docs.ollama.com/api/tags),
[Ollama CLI](https://docs.ollama.com/cli).
