## 1. Tools and prompting

### Tools used

| Tool                           | What I used it for                                                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude (chat)                  | Breaking down the assessment, writing `AGENTS.md` from the provided guide, creating one plan file per development step in `/prompts`, deciding API conventions, explaining Prisma, and reviewing the repository against the specification                                                 |
| Antigravity (Gemini 3.8 Flash) | Implementing the approved plans for the initial schema, seed data, and authentication setup                                                                                                                                                                                               |
| ChatGPT (chat)                 | Building and refining the remaining application features, including the order workflow, verification workflow, sewing queue, state-transition APIs, validation, automated tests, security hardening, UI logic, and reviewing implementation decisions against the assessment requirements |

### How I prompted

I did not ask an AI tool to "build the whole app". I followed one development loop for each feature:

1. Write `AGENTS.md` first. It holds the product description, server and client boundary, stack, what not to use, decisions already made, the data model, and the checks to run.
2. For each feature, write a plan file such as `prompts/01-schema.md` with the goal, decisions and assumptions, expected files, security notes, acceptance criteria, and manual test steps.
3. Read the plan against the assessment specification and approve it before implementation.
4. Use the coding agent or ChatGPT to implement the approved feature in small, reviewable steps.
5. Run lint, type checks, tests, and the production build myself rather than relying on an AI tool's report.
6. Review the completed implementation against the original assessment requirements.

The plans were intentionally tool-independent. This allowed development to continue when Antigravity reached its usage limit. I checked `git status`, identified which planned files had already been created, and continued the remaining implementation with ChatGPT without discarding completed work.

### Where I refused AI suggestions

- The first schema plan added three columns to `cutting_orders` (`submitted_at`, `sewing_started_by`, `sewing_started_at`). No requirement asked for them, so I removed them from the plan and from `AGENTS.md`. The table now contains only the columns required by the specification.
- `npm audit` reported 8 high-severity findings. The suggested `npm audit fix --force` would have downgraded Prisma and the Next.js ESLint configuration to older major versions and risked breaking the working setup. Since the findings were in build-time tooling rather than application code executed by users, I did not blindly apply the forced downgrade.
- AI suggestions were also rejected or revised when they conflicted with the assessment's required HTTP status codes, state machine, security boundaries, or database rules. These issues are documented in the sections below.

### Division of AI-assisted implementation

The tools had different roles during development rather than one tool generating the entire application.

**Claude** was primarily used for early planning, specification breakdown, project instructions, and architectural discussion.

**Antigravity** was used as the coding agent for the initial project setup, particularly the Prisma schema, seed data, and authentication implementation.

**ChatGPT** was then used extensively for the remaining application development and refinement. This included implementing the cutting-order workflow, verification terminal, approval/rejection logic, rejected-order resubmission flow, sewing queue, start-sewing transition, API validation, automated route tests, security hardening, and later code review/refactoring.

The final code was therefore the result of an iterative process involving AI-generated implementation, human review, testing, correction, and additional AI-assisted refinement rather than a single generated codebase being accepted without review.

## 2. Flawed / Broken AI Code

AI generated code was not treated as production ready. I found several cases where the generated implementation was buggy, insecure, or contradicted the assessment requirements. Each issue was identified through automated tests, manual testing, or reviewing the completed workflow against the specification.

### 2.1 Incorrect Approval Status Code

**What AI generated:**  
The verification route initially returned HTTP `409 Conflict` when approval was blocked because of a component shortage.

**Problem:**  
The assessment and project rules defined this as a validation/business-rule failure requiring HTTP `422 Unprocessable Content`.

This also caused the automated test to encode the wrong behavior.

**How I detected it:**  
I reviewed the route against `AGENTS.md` and the assessment specification rather than accepting the implementation because the route and test were both passing.

**Fix:**  
The route was changed to return `422` for an approval attempt that violates the verification rules, while `409` remains appropriate for an invalid order state such as attempting to verify an order that is not currently `PENDING_VERIFICATION`.

---

### 2.2 Incorrect Traffic-Light Logic

**What AI generated:**  
The initial implementation did not correctly produce the required three verification states. In particular, an actual quantity greater than the expected quantity could be treated as `GREEN` instead of `YELLOW`.

**Problem:**  
The assessment requires:

```text
actual < expected  → RED
actual = expected  → GREEN
actual > expected  → YELLOW
```

The same business rule existed independently in the server verification route and the verifier UI. Because the logic was duplicated, the two implementations could drift apart.

**How I detected it:**  
I manually audited the workflow against the specification and tested quantities above the expected value.

**Fix:**  
The traffic-light calculation was corrected so excess quantities produce `YELLOW`. The calculation was also moved into a shared domain rule so the UI and server use the same business logic.

---

### 2.3 Approval Button Could Remain Available After a RED Result

**What AI generated:**  
The initial verifier UI displayed a warning when a component had a shortage, but the Approve action was not strictly disabled.

A later UI change disabled the button, but another state synchronization issue remained: an already selected approval decision could remain selected after the verification counts changed and the batch became invalid.

**Problem:**  
The specification requires the approval action to be clearly blocked when the verification contains a RED component.

More importantly, UI state must remain consistent with the current verification data.

**How I detected it:**  
I tested the verifier interactively by changing component quantities after selecting the approval decision.

**Fix:**  
The approval control was made dependent on the current verification summary, and the selected decision is cleared when the batch becomes ineligible for approval.

The backend independently enforces the same rule, so changing or bypassing the UI cannot result in an invalid approval.

---

## 3. Human refactoring

What I changed on my own judgment, beyond fixing individual bugs:

1. **Cut the schema back to the spec.** Removed three unrequested columns. Kept one deliberate addition, `verification_logs.variances` (a JSON snapshot of the counts at decision time), because the spec says variances must be stored permanently and item rows can be reset on resubmission.
2. **Moved safety into the database as well as the code.** Prisma cannot express CHECK constraints, triggers or RLS, so I added them by hand to the migration: positive quantities, non negative counts, a rejection note rule, an append only trigger on `verification_logs`, and RLS on every table.
3. **Made seeding repeatable.** The seed script uses `upsert` and looks components up by recipe and name, so running it twice never duplicates data.
4. **Extracted the repeated page header into one shared component.** Every main terminal page (supervisor, verifier and sewing) repeated the same header markup: the page title, the "Logged in as" name and the logout button. I moved it into a single component that takes the title and the user's full name, so the header looks the same on every page and changes in one place.
5. **Moved duplicated calculation logic into shared domain functions.** The traffic light rule and the fabric wastage formula were written separately in the verification API route and in the verifier screen, so any change to a rule had to be made twice and could be missed in one place. I moved them into `src/lib/domain/verification.ts` as pure functions with no server imports, so the server and the browser now run the same code:
   - `evaluateItem(actual, expected)` returns the status (GREEN, YELLOW, RED) and its label (OK, EXCESS, SHORTAGE, UNCOUNTED). It is used in the verification route and in the verifier screen's status column and summary counts.
   - `wastagePct(actualYds, expectedYds)` returns the wastage percentage rounded to 2 decimals, or `null` when the expected fabric is not above zero. It is used in the verification route and in the verifier screen's `getWastagePercentage`.

---

## 4. Defensive architecture

### Order state machine

```
CUTTING_IN_PROGRESS --submit--> PENDING_VERIFICATION --approve--> VERIFIED --start sewing--> IN_SEWING
                                        |
                                     reject (note required)
                                        v
                                    REJECTED --resubmit--> CUTTING_IN_PROGRESS
```

Each transition is a separate route with its own role check and its own required starting status. A route that receives an order in the wrong status returns 409. The client never sends a status.

### Layers that stop an unauthorized status change

| Layer           | What it enforces                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session         | `requireRole` on every route. Identity comes from a signed httpOnly cookie, and the role is loaded from the database                                                                 |
| Role            | Only `cutting_verifier` can call the verification route. Supervisors and sewing users get 403                                                                                        |
| Validation      | Strict Zod schemas. Counts must be whole numbers, 0 or more. A body with an unexpected field is rejected                                                                             |
| Business rule   | The server recomputes every traffic light from the submitted counts. Any RED, missing or uncounted component blocks approval with 422. The client's idea of the status is never used |
| Query isolation | The sewing queue query has `where: { status: VERIFIED }` in the database call and reads no URL parameters                                                                            |
| Audit           | The verification log (verifier id from the session, database timestamp, variances, wastage) is written in the same transaction as the status change                                  |
| Database        | CHECK constraints, an append only trigger on `verification_logs`                                                                                                                     |
