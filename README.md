# ZeroTwo: AI Security Gateway (CyberCup CC6-AI03)

A gateway that sits between employees and an AI model. It inspects every prompt and every answer, masks or blocks sensitive data, stops prompt-injection attacks, enforces document access by clearance, and keeps a privacy-safe, tamper-evident audit trail. Legitimate work carries on.

```
Employee ─▶ React frontend ─▶ Spring Boot backend ──▶ Security engine (FastAPI)
                                   │   policy, approvals,     rules + ML + Presidio + RAG access control
                                   │   audit chain, dashboard
                                   ├──▶ External AI (Gemini) or local model (Ollama)
                                   └──▶ MySQL / H2
```

| Folder | What it is |
|---|---|
| `frontend/` | React + Vite + Tailwind: secure assistant, admin dashboard, incidents, approvals, audit log, policies, users, evaluation lab |
| `src/` (root) | Spring Boot 4 backend: authentication (JWT), policy enforcement, the gateway flow, approvals, hash-chained audit log, dashboard statistics |
| `security-engine/` | Python FastAPI engine: detection layers, masking, response inspection, document quarantine, access-controlled retrieval, evaluation sets. See [its README](security-engine/README.md) |
| `docs/` | System workflow and design notes |

## Run it (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1    # once: tools, Python env + models (~2 GB), packages, .env
powershell -ExecutionPolicy Bypass -File .\start.ps1    # every time: engine :8000, backend :8080, frontend :5173
```

Or double-click `start.cmd`, which works even in terminals where `powershell` is not on PATH.

`setup.ps1` uses Java 21 and Node 22 if they are installed. If not, it downloads portable copies into `.\tools`, so no admin rights are needed. Python 3.11 or 3.12 must be installed.

- **AI answers:** paste a Gemini key into `.env` (`GEMINI_API_KEY=...`, free at aistudio.google.com). Without a key, every security check still runs. Answers come from the local model if [Ollama](https://ollama.com) is running (`ollama pull llama3.2:3b`).
- **Database:** the default `DB_PROFILE=local` uses a file database in `./data`, so nothing needs installing. For MySQL, set `DB_PROFILE=mysql` and `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` in `.env`.
- **Fail-closed:** if the security engine is down, requests are blocked, never forwarded.
- **Engine key and demo accounts:** `setup.ps1` writes a shared `ENGINE_API_KEY` (the engine refuses requests without it) and `SEED_DEMO_ACCOUNTS=true` (the four demo accounts, local demo only) into `.env`. For two laptops, copy the same `ENGINE_API_KEY` to both. Turning demo seeding off never deletes existing users.
- **Classification ceiling:** a prompt or attachment marked SECRET (or गुप्त) is never sent to the external AI, even after approval. It goes to the local model only, and if that isn't running, nothing is sent. Documents with an unknown classification label count as SECRET.
- **MySQL on this laptop:** run `scripts/mysql-setup.sql` once as root (MySQL Workbench or `mysql -u root -p -e "source scripts/mysql-setup.sql"`, replacing the password in it first), then set `DB_PROFILE=mysql`, `DB_USERNAME=cybercup` and `DB_PASSWORD` in `.env`. The backend creates all tables itself.
- **Prompt log:** every prompt is stored in `gateway_events.prompt_text`, **masked**: personal data and secrets are replaced by placeholders such as `<AADHAAR_1>`, so raw values never reach the database. Admins and analysts see it under *Prompt Log*; employees see their own under *My Activity*. Set `STORE_PROMPTS=NONE` to keep metadata only.
- **Attachments:** *Attach file* accepts PDF, Word (.docx), pictures (PNG, JPG, WEBP, BMP, TIFF) and text files up to 10 MB. Configuration and credential files such as `.env` are refused. Text inside pictures is read with OCR: scanned pages, photos pasted into a PDF or Word file, and photographed ID cards. ZeroTwo recognises standard documents from their printed text (Aadhaar card, PAN card, passport, voter ID, driving licence, bank statement, cheque, salary slip, Form 16). Their numbers are always masked. An identity document follows the *Identity documents* policy (default: require approval), and a financial document follows the *Financial* policy. Specimen files made from fake data are in `demo-files/`; regenerate them with `python -m evaluation.sample_documents` from `security-engine/`.
- **Demo data:** with everything running, `powershell -ExecutionPolicy Bypass -File .\scripts\send-demo-prompts.ps1` sends 19 realistic prompts (all three scenarios plus approvals) as the demo users, and an admin approves the held ones.
- **Two laptops / shared MySQL:** to run the backend and MySQL on one laptop and the engine and frontend on another, follow [docs/02_REMOTE_SETUP.md](docs/02_REMOTE_SETUP.md). Every prompt is then recorded in that MySQL database in real time.

### Demo accounts (seeded locally; disable with `app.seed-demo=false`)

| Account | Role | Department | Clearance | Password |
|---|---|---|---|---|
| asha@cybercup.demo | Employee | Revenue | INTERNAL | Asha@2026 |
| meera@cybercup.demo | Employee | Finance | CONFIDENTIAL | Meera@2026 |
| analyst@cybercup.demo | Security analyst | SOC | SECRET | Analyst@2026 |
| admin@cybercup.demo | Admin | SOC | SECRET | Admin@2026 |

The login page has one-click buttons for these accounts.

## Demo script (the three required scenarios)

Sign in as **Asha** and use the scenario buttons above the chat box. The **Security inspector** on the right shows each step, the detection layers, the findings and the policy that fired.

1. **Accidental disclosure of personal data:** click *Personal data*. Aadhaar (checksum-validated), PAN, phone and name are replaced with `<AADHAAR_1>`-style placeholders before Gemini sees them. Expand *What the AI model received* to show this. The answer comes back with the real values restored for Asha only. *API key in code* shows credentials being **redacted** permanently.
2. **Prompt-injection extraction:** click *Prompt injection*, *Hinglish attack* or *Reworded attack*. All are **blocked** before reaching the model, and the inspector shows which layer caught each (rules, semantic similarity, ML classifier). *Hidden instruction in CV* shows an **indirect** injection: the poisoned section of the attached document is quarantined and the rest is summarised.
   *Uploaded ID card:* click **Attach file**, choose `demo-files/specimen-letter-with-aadhaar.pdf` and ask "Summarise this letter in one line." The Aadhaar card pictured inside the PDF is read with OCR and recognised. Its number is masked, and the request is held for a supervisor under the *Identity documents* policy.
3. **Unauthorised retrieval of a restricted document:** click *Restricted document* (with "Use department documents" on). Asha (INTERNAL) is **denied** and the attempt is logged. Sign in as **Meera** (CONFIDENTIAL, Finance) and ask the same question: she gets the answer, citing *Draft Departmental Budget 2027-28*. Restricted documents are filtered **before** the search runs, so their text never reaches the AI. Answers are also checked against restricted documents as a second layer.

Then sign in as **Admin**:
- **Overview:** incidents, data categories, blocked requests, trends and added delay.
- **Approvals:** *Classified note* (sent as Asha) is held here. Approve it and Asha sees the answer under *My Activity*.
- **Policies:** change any action (allow / warn / mask / redact / require approval / block). It applies to the next request.
- **Audit Log → Verify chain integrity:** proves no entry was edited. Entries hold types, counts and keyed hashes, never the values.
- **Users & clearance:** raise Asha to CONFIDENTIAL and retry scenario 3.
- **Evaluation Lab:** runs the 123-case test set and the blind set of reworded attacks live.

## How the requirements are met

| Requirement | Where |
|---|---|
| 1. Prompt inspection (Aadhaar, PAN, phone, financial, passwords, API keys, confidential content) | `security-engine/app/detectors/` (checksum validators, Presidio, secret signatures, classification markings, codenames) |
| 2. Response inspection | engine `analyze_response`: canary leak, instruction disclosure, other people's data, restricted-document text |
| 3. Prompt injection incl. indirect | rules (English / Hinglish / Hindi) + normaliser (base64, leetspeak, homoglyphs…) + multilingual semantic similarity + DeBERTa classifier + optional local Llama; document quarantine |
| 4. Access-controlled RAG | `security-engine/app/rag.py`: clearance + department filter before retrieval, attempt detection, output fingerprint check |
| 5. Configurable actions | `PolicyDecisionService` + Policies page: ALLOW, WARN, MASK, REDACT, REQUIRE_APPROVAL, BLOCK |
| 6. Privacy-aware audit log | `AuditLogService`: no content, HMAC hashes, SHA-256 hash chain with verification |
| 7. Dashboard | Admin overview, incidents, approvals, audit log |
| Detection metrics (≥ 30 prompts) | 123-case development set + 60-case blind set, live in the Evaluation Lab or via `python -m evaluation.run` |

**Latest measured results** (rules + ML layers, local model off, after the data-protection hardening):
- **Development set:** 99.2 % detection accuracy, 100 % recall, 98.7 % precision. 1 of 48 legitimate prompts is blocked: a classifier-only signal that would go to the local model if it were running.
- **Blind reworded attacks:** 29 / 30 blocked, with 0 / 30 legitimate prompts blocked. Rules alone blocked 8 / 30; rules + ML layers alone blocked 25 / 30.
- **Data protection** (spelled-out digits, Unicode tricks, split identifiers, quoted passwords): see [docs/03_DATA_PROTECTION.md](docs/03_DATA_PROTECTION.md) and `python -m evaluation.data_protection`.
- **Without the local model**, borderline prompts fail closed unless the only signal is the ML classifier on code or on text whose secrets are masked. Classified content, private keys and bulk personal data are recommendations the backend's policy turns into **REQUIRE_APPROVAL**; attacks and data left visible after masking are always blocked.

Engine delay is about 0.3 s (p50) on a laptop CPU. See the engine README for the honest caveats.
