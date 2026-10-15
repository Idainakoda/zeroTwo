# Running CyberCup across two laptops (shared MySQL database)

Goal: the backend and the **MySQL database run on one teammate's laptop**. The other laptop runs the security engine and the frontend. Every prompt anyone sends is recorded in that MySQL database in real time, and you can watch it in MySQL Workbench.

> **MySQL Workbench is only the viewer.** The database itself is the **MySQL Server** service (`MySQL80`) that Workbench connects to. It must be running on the database laptop: Windows key → *Services* → `MySQL80` → *Running*.

## Pick a layout

| | Laptop B (database owner) | Laptop A (you) | Network links needed |
|---|---|---|---|
| **Layout 1 (recommended)** | MySQL + **backend** | engine + frontend | A → B:8080 (frontend → backend), B → A:8000 (backend → engine) |
| **Layout 2 (simplest)** | MySQL only | engine + backend + frontend | A → B:3306 (backend → MySQL) |

Both give the same result: every prompt lands in B's MySQL in real time. Layout 1 keeps the backend on the laptop that owns the database. Layout 2 needs only one open port and is the most reliable for a live demo.

## Step 0: both laptops must see each other

- **Same Wi-Fi / hotspot:** use each laptop's LAN IP (`ipconfig` → *IPv4 Address*, e.g. `192.168.1.20`). Set the Wi-Fi to **Private** (*Settings → Network & internet → Wi-Fi → your network → Private network*).
- **College/office Wi-Fi often blocks laptop-to-laptop traffic** ("client isolation"). If the checks below fail, use a **phone hotspot**, or install **Tailscale** (free) on both laptops and sign in with the same account. Then use the `100.x.y.z` addresses Tailscale shows instead of LAN IPs, and add `-Tailscale` to the firewall command. Tailscale also works when the laptops are in different places.
- **Both laptops pull the latest code:** `git pull`.

## Step 1: prepare MySQL (laptop B, once)

1. Open MySQL Workbench, connect as `root`, then *File → Open SQL Script →* `scripts/mysql-setup.sql`.
2. Replace `CHANGE_ME_STRONG_PASSWORD` with a real password and run the script (lightning icon). It creates the database `cybercup_db` and a user `cybercup` that can only use that database, so the root password is never shared.
3. **Layout 2 only:** open the MySQL port. In PowerShell **as administrator**, in the repo folder:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1 -Ports @() -MySQL
   ```

The backend creates and updates all tables itself on first start (`ddl-auto=update`). Existing data is kept.

## Layout 1: backend on laptop B

**Laptop B** `.env` (copy `.env.example` to `.env`; `setup.ps1` fills `JWT_SECRET`):
```ini
START_ENGINE=false
START_BACKEND=true
START_FRONTEND=false
SHARE_ON_NETWORK=true

DB_PROFILE=mysql
DB_URL=jdbc:mysql://localhost:3306/cybercup_db?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=Asia/Kolkata
DB_USERNAME=cybercup
DB_PASSWORD=<the password from step 1>

AI_ENGINE_BASE_URL=http://<IP of laptop A>:8000
ENGINE_API_KEY=<any long random text, the SAME on both laptops>
GEMINI_API_KEY=<your Gemini key: the backend is the one that calls Gemini>
```
Then:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1                               # installs Java tools only
powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1 -Ports 8080   # as administrator, once
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

**Laptop A** `.env`:
```ini
START_ENGINE=true
START_BACKEND=false
START_FRONTEND=true
SHARE_ON_NETWORK=true

BACKEND_URL=http://<IP of laptop B>:8080
ENGINE_API_KEY=<same value as laptop B>
```
Then:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1                               # engine + frontend only
powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1 -Ports 8000   # as administrator, once
powershell -ExecutionPolicy Bypass -File .\start.ps1
```
Start laptop A first (the engine takes about 30 s to load), then laptop B.

## Layout 2: only MySQL on laptop B

Laptop B: finish step 1 (including the firewall command). Nothing else is needed.

**Laptop A** `.env`:
```ini
DB_PROFILE=mysql
DB_URL=jdbc:mysql://<IP of laptop B>:3306/cybercup_db?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=Asia/Kolkata
DB_USERNAME=cybercup
DB_PASSWORD=<the password from step 1>
```
Then run `start.ps1` as usual.

## Step 2: check the connection

On either laptop:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-connection.ps1
```
It prints `[OK]` or `[FAIL]` (with the fix) for MySQL, the engine and the backend, based on what is in `.env`.

| Symptom | Fix |
|---|---|
| `[FAIL] TCP connection to MySQL` | MySQL80 service running? Firewall opened with `-MySQL`? Same network / Tailscale? |
| `Public Key Retrieval is not allowed` | Keep `allowPublicKeyRetrieval=true` in `DB_URL` |
| `Access denied for user 'cybercup'@'...'` | Wrong password, or `mysql-setup.sql` not run (the user must be `'cybercup'@'%'`) |
| Frontend shows *Cannot connect to the CyberCup backend* | `BACKEND_URL` on laptop A, `SHARE_ON_NETWORK=true` + port 8080 open on laptop B |
| Every prompt is blocked: *Security engine is unavailable* | Backend can't reach the engine: `AI_ENGINE_BASE_URL`, port 8000 on laptop A, same `ENGINE_API_KEY` on both |
| CORS error in the browser console | Add the frontend address you opened (e.g. `http://192.168.1.15:5173`) to `EXTRA_CORS_ORIGINS` on the backend laptop |

## Step 3: watch prompts arrive in Workbench

Send prompts from the Secure Assistant, then in Workbench run (and re-run to refresh):
```sql
SELECT id, created_at, user_id, action, finding_types, risk_score, total_ms
FROM cybercup_db.gateway_events ORDER BY id DESC LIMIT 20;

SELECT created_at, category, decision, severity, finding_types, policy_name
FROM cybercup_db.incidents ORDER BY id DESC LIMIT 20;
```
`gateway_events` gets **one row per prompt**, every user, including allowed ones. `incidents`, `audit_logs` and `approval_requests` fill up as well.

### Why the prompt *text* is not in the database

That is deliberate. Requirement 6 of the problem statement asks for a privacy-aware audit log *"without storing full sensitive content"*. Each row records who, when, what was detected (types and keyed hashes), which policy fired and the action, but not the raw text, so the database itself can't leak Aadhaar numbers or passwords. The only text stored is the **masked** prompt of requests held for approval (`approval_requests.masked_prompt`). Tell the jury this is a privacy feature, not a gap.

## Security notes

- Use the `cybercup` database user, never `root`, and a strong password. Don't commit `.env`.
- The firewall rules allow only the private network / local subnet (or Tailscale). Never port-forward 3306 to the internet.
- Remove the rules after the event: `Remove-NetFirewallRule -DisplayName "CyberCup*"` (as administrator).
