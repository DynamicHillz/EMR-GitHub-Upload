# Licensing

SSMC EMR is licensed on-premise software: an implementation fee, a license, and an annual maintenance fee per clinic install — not a cloud subscription (see `CLAUDE.md`). This document covers how that license is technically issued, stored, and checked. It's vendor-facing, not clinic-facing — a clinic's own staff only ever see the Settings > License tab and, if it needs attention, a banner.

## How it works

A license is a signed token (an RS256 JWT) containing the clinic's name, when the license was issued, and when the current maintenance period expires. The app verifies the signature against a public key it ships with (`config/license-public-key.pem`) — it can check a signature is genuine, but never create one. Only the matching **private key**, which never ships with the app and is never committed to this repo, can actually issue a valid token.

**Enforcement is deliberately soft, always.** A missing, invalid, or maintenance-lapsed license never blocks login or any clinical/billing feature — it only shows a banner to SUPER_ADMIN/ADMIN. This is healthcare software; a billing dispute with the vendor must never risk patient care. See `src/backend/infrastructure/security/license.util.ts` for the exact status rules (`ACTIVE` / `GRACE` — 30 days past expiry, still just a banner / `EXPIRED` / `MISSING` / `INVALID`).

## One-time setup (done once, ever — not per clinic)

1. Generate a keypair:
   ```bash
   openssl genrsa -out license-private-key.pem 2048
   openssl rsa -in license-private-key.pem -pubout -out config/license-public-key.pem
   ```
2. Commit `config/license-public-key.pem` to the repo — it's safe to ship, it can only verify.
3. **Keep `license-private-key.pem` offline.** It's already gitignored (see `.gitignore`). Store it somewhere durable and private (a password manager, an encrypted drive) — if it's ever lost, you can't issue new licenses without generating a new keypair and shipping a new public key to every existing install (which invalidates every license issued under the old key). If it's ever leaked, anyone who has it can forge a valid license for any install.

## Issuing a license for a new clinic (implementation + license fee paid)

Run the generator locally, on your own machine — never on a clinic's server:
```bash
npx ts-node scripts/generate-license.ts --clinic "Clinic Name" --expires 2027-08-01
```
This prints a token. Send it to the clinic (or enter it yourself if you're doing the install) via **Settings > License** in the app — SUPER_ADMIN only. The status banner clears once a valid, current token is saved.

## Renewing (annual maintenance fee paid)

Same command, with a new `--expires` date. Each renewal simply replaces the stored token — there's no renewal-history table in the app itself; keep your own sales/billing records for that separately (there's no cross-clinic rollup possible anyway, since each on-premise install's database is independent).

## Recovering if you lose the private key

There's no recovery — this is by design (the same reason it's tamper-resistant). You'd generate a new keypair, ship the new public key to every existing install (a small code/config update + redeploy), and re-issue every clinic's license token under the new key.
