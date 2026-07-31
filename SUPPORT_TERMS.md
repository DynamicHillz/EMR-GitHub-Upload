# Support Terms — SSMC EMR

**This is a starting draft for you to adapt, not a finished legal contract.** The content — what's covered, response times, what the clinic is responsible for — is something worth getting right in writing before you take money. Whether the *wording* holds up as an enforceable agreement is a question for a lawyer, especially given this involves patient care. Treat this as the honest terms to put in front of one, not as something to hand a clinic unreviewed.

---

## 1. What's covered

- Keeping the system running: diagnosing and fixing outages, crashes, and errors in the software as delivered.
- Applying the backup and recovery procedures already built into the system.
- Answering questions about how to use the system.

## 2. What's *not* covered under standard support

- New features or workflow changes — quoted and billed separately.
- Problems caused by the clinic's own infrastructure: internet outage, power outage beyond what the system's own safeguards handle, a workstation's own hardware failure.
- Outages of third-party services this system depends on but doesn't control: payment gateway downtime (Flutterwave/Moniepoint/Paystack), the local WHO ICD-11 lookup service if it's not kept running, SMS/email provider outages.
- Data entered incorrectly by clinic staff — the system can be asked to help correct it, but that's a request, not a defect.

## 3. Response times — stated honestly, not aspirationally

*[Fill in with what you can actually commit to — the numbers below are a reasonable starting point given full-time employment elsewhere, not a requirement.]*

| Severity | Example | Target response |
|---|---|---|
| Critical — system fully down, patient care blocked | Nobody can log in, app unreachable | Best-effort within [X hours], during agreed support hours |
| High — a core feature broken, workaround exists | Billing broken but records still accessible | Within [1 business day] |
| Low — cosmetic, minor, or a feature request | UI glitch, "can we also add..." | Within [3–5 business days] |

**No 24/7 guarantee.** Support is provided on a best-effort basis outside of full-time employment hours. This is stated plainly here so it's an agreed term, not a discovered limitation during an actual emergency.

## 4. What the clinic is responsible for, in return

This isn't just a liability shield — it's the difference between "the system has one point of failure" and "the system has a real safety net."

- **At least one staff member trained on Tier-1 steps** from `INCIDENT_RUNBOOK.md` (checking `pm2 status`, restarting the app) — most outages resolve at this level, and it shouldn't require reaching you at all.
- Not sharing login credentials outside authorized staff.
- Reporting issues with enough detail to act on (what happened, what page, what error message) — see Section 0 of the runbook.
- Keeping the server machine's basic upkeep current (Windows updates, not disabling the auto-login the boot-recovery mechanism depends on) — see `CLINIC_DEPLOYMENT_CHECKLIST.md`.

## 5. Updates and changes

- Updates are scheduled in advance, not pushed without notice — patient-facing systems don't get surprise deploys during clinic hours.
- Every update follows the rollback procedure in `INCIDENT_RUNBOOK.md`: a fresh backup is taken immediately before any change, and there's a tested path back to the previous working version.
- Schema/database changes get tested against a copy of the data before touching the live database — this is already the standing procedure (`CLAUDE.md`'s Prisma Migration History section), not a new commitment being made here.

## 6. Escalation if you're genuinely unreachable

State plainly what happens if you can't be reached during a critical outage — e.g., a named backup contact, or an honest acknowledgment that there isn't one yet and the clinic's own Tier-1 training (Section 4) is the actual first line of defense in that gap. Don't leave this section blank; an unstated answer is still an answer, just a bad one to discover during an actual incident.

## 7. Liability

*[This section specifically should not ship without a lawyer's input — healthcare software carries real liability exposure, and the right limitation-of-liability language depends on your jurisdiction and the actual contract structure (employee vs. independent contractor relationship with the clinic matters here too). Don't treat placeholder text here as protection.]*
