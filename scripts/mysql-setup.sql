-- CyberCup: prepare MySQL for the gateway (run once in MySQL Workbench on the database machine,
-- connected as root: File > Open SQL Script, then Execute with the lightning button).
--
-- 1. Replace CHANGE_ME_STRONG_PASSWORD below with a strong password (also put it in .env as DB_PASSWORD).
-- 2. '%' lets the backend connect from another device. If the backend runs on THIS machine,
--    you can use 'cybercup'@'localhost' instead.

CREATE DATABASE IF NOT EXISTS cybercup_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'cybercup'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

-- Only this database, not the whole server. The backend creates/updates its tables itself.
GRANT ALL PRIVILEGES ON cybercup_db.* TO 'cybercup'@'%';
FLUSH PRIVILEGES;

-- Check: should list the new user.
SELECT user, host FROM mysql.user WHERE user = 'cybercup';

-- After the backend has started once, these tables exist and fill up in real time:
--   gateway_events    one row per prompt (decision, detected types, risk, timings - no prompt text)
--   incidents         flagged prompts / answers / restricted retrievals
--   audit_logs        hash-chained, privacy-safe audit trail
--   approval_requests prompts held for approval (masked text only)
--   users, roles, policies
-- Example live view:
--   SELECT created_at, user_id, action, finding_types, risk_score FROM cybercup_db.gateway_events
--   ORDER BY id DESC LIMIT 20;
